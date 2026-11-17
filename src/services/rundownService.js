// =============================================================================
// src/services/rundownService.js
// Serviço de dados e cálculos do Módulo Rundown (V2 · Quantitativo) e Supervisão
// Suporta tabelas Supabase (001_rundown_v2.sql) com fallback transparente
// em localStorage caso a migração SQL ainda não tenha sido executada no banco.
// =============================================================================
import { supabase } from '../supabase';
import { calcularEquipeNoite, criarQuadroVazio } from '../components/plantao/constantes';

const LS_KEYS = {
  REGISTROS: 'escalaenf_rundown_registros_v2',
  DIURNO12: 'escalaenf_rundown_diurno12_v2',
  AFASTAMENTOS: 'escalaenf_rundown_afastamentos_v2',
  DIMENSIONAMENTO: 'escalaenf_dimensionamento_v2',
  LEITOS: 'escalaenf_leitos_setor_v2',
  ESCALADOS: 'escalaenf_rundown_escalados_v2',
};

function lerLS(chave, padrao) {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? JSON.parse(raw) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLS(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) {
    console.warn('Falha ao gravar cache local:', e);
  }
}

/**
 * Serializa alertas removendo referências a funções (ícones Lucide) para JSONB.
 */
export function serializarAlertas(alertas = []) {
  return alertas.map((a) => ({
    uid: a.uid,
    tipoId: a.tipoDef?.id || a.tipoId,
    tipoDef: a.tipoDef
      ? { id: a.tipoDef.id, label: a.tipoDef.label, tipo: a.tipoDef.tipo }
      : undefined,
    dados: a.dados || {},
  }));
}

/**
 * Calcula totais de uma categoria (ENF ou TEC) em um turno.
 * Regra decidida: quando o turno é MANHA ou TARDE, o bloco Diurno 12h soma
 * automaticamente nos dois períodos (tanto escalados quanto faltas e remanejados).
 */
export function calcularTotaisCategoria({
  cat = 'ENF',
  turno = 'MANHA',
  quadroTurno = {},
  quadroDiurno12 = {},
  minimo = 0,
}) {
  const base = quadroTurno?.[cat] || {};
  const incluiDiurno = turno === 'MANHA' || turno === 'TARDE';
  const d12 = incluiDiurno ? quadroDiurno12?.[cat] || {} : {};

  const n = (v) => Math.max(0, parseInt(v, 10) || 0);

  const escaladosBase = n(base.escalados);
  const escaladosD12 = n(d12.escalados);
  const escalados = escaladosBase + escaladosD12;

  const fnj = n(base.faltas?.fnj) + n(d12.faltas?.fnj);
  const atestado = n(base.faltas?.atestado) + n(d12.faltas?.atestado);
  const outras = n(base.faltas?.outras) + n(d12.faltas?.outras);
  const totalFaltas = fnj + atestado + outras;

  const recebidos = n(base.recebidos) + n(d12.recebidos);
  const cedidos = n(base.cedidos) + n(d12.cedidos);

  const presentes = Math.max(0, escalados - totalFaltas + recebidos - cedidos);
  const necessarios = n(minimo);
  const saldo = presentes - necessarios; // negativo = déficit

  return {
    necessarios,
    escaladosBase,
    escaladosD12,
    escalados,
    fnj,
    atestado,
    outras,
    totalFaltas,
    recebidos,
    cedidos,
    presentes,
    saldo,
    temDeficit: saldo < 0,
  };
}

// -----------------------------------------------------------------------------
// 1. Setores e Dimensionamento (Leitos + Quadro Mínimo/Necessários)
// -----------------------------------------------------------------------------
export async function carregarSetoresAtivos() {
  const { data, error } = await supabase
    .from('setores_unidades')
    .select('*')
    .order('nome_oficial');

  const leitosCache = lerLS(LS_KEYS.LEITOS, {});
  if (error || !data) return [];

  return data
    .filter((s) => (s.status || s.Status || '').toUpperCase() === 'ATIVO')
    .map((s) => {
      const id = s.id;
      const nome = s.nome_oficial || s.Nome_Oficial || s.nome_setor || s.nome || '';
      const leitosBanco = s.leitos_operacionais ?? s.Leitos_Operacionais;
      const leitos =
        leitosBanco !== undefined && leitosBanco !== null && leitosBanco > 0
          ? Number(leitosBanco)
          : Number(leitosCache[id] ?? leitosCache[nome] ?? 0);
      return {
        ...s,
        id,
        nome,
        sigla: s.sigla_localizacao || s.Sigla_Localizacao || '',
        leitos_operacionais: leitos,
      };
    });
}

export async function carregarTodoDimensionamento() {
  const mapaLS = lerLS(LS_KEYS.DIMENSIONAMENTO, {});
  const { data, error } = await supabase.from('dimensionamento_setor').select('*');

  const resultado = { ...mapaLS };
  if (!error && Array.isArray(data)) {
    data.forEach((row) => {
      const chave = `${row.setor_id}__${row.turno}__${row.categoria}`;
      resultado[chave] = Number(row.minimo) || 0;
    });
  }
  return resultado;
}

export function obterMinimoDimensionamento(mapaDim, setorId, setorNome, turno, categoria) {
  if (!mapaDim) return 0;
  const kId = `${setorId}__${turno}__${categoria}`;
  const kNome = `${setorNome}__${turno}__${categoria}`;
  if (mapaDim[kId] !== undefined) return Number(mapaDim[kId]);
  if (mapaDim[kNome] !== undefined) return Number(mapaDim[kNome]);
  return 0;
}

export async function salvarConfigSetorCompleta({
  setorId,
  setorNome,
  leitosOperacionais,
  minimos, // { MANHA: { ENF, TEC }, TARDE: { ENF, TEC }, NOITE: { ENF, TEC } }
}) {
  // 1. Grava cache local imediatamente
  const leitosLS = lerLS(LS_KEYS.LEITOS, {});
  leitosLS[setorId] = Number(leitosOperacionais) || 0;
  leitosLS[setorNome] = Number(leitosOperacionais) || 0;
  gravarLS(LS_KEYS.LEITOS, leitosLS);

  const dimLS = lerLS(LS_KEYS.DIMENSIONAMENTO, {});
  const rows = [];
  ['MANHA', 'TARDE', 'NOITE'].forEach((turno) => {
    ['ENF', 'TEC'].forEach((categoria) => {
      const val = Math.max(0, parseInt(minimos?.[turno]?.[categoria], 10) || 0);
      dimLS[`${setorId}__${turno}__${categoria}`] = val;
      dimLS[`${setorNome}__${turno}__${categoria}`] = val;
      if (setorId) {
        rows.push({
          setor_id: setorId,
          turno,
          categoria,
          minimo: val,
          updated_at: new Date().toISOString(),
        });
      }
    });
  });
  gravarLS(LS_KEYS.DIMENSIONAMENTO, dimLS);

  // 2. Tenta persistir no Supabase (se a migração 001 já estiver aplicada)
  let avisos = [];
  if (setorId) {
    const { error: eSetor } = await supabase
      .from('setores_unidades')
      .update({ leitos_operacionais: Number(leitosOperacionais) || 0 })
      .eq('id', setorId);
    if (eSetor) avisos.push(eSetor.message);

    const { error: eDim } = await supabase
      .from('dimensionamento_setor')
      .upsert(rows, { onConflict: 'setor_id,turno,categoria' });
    if (eDim) avisos.push(eDim.message);
  }
  return { ok: true, avisos };
}

// -----------------------------------------------------------------------------
// 1.5 Quantidade de Escalados da Unidade por Mês/Dia/Turno (rundown_escalados)
// -----------------------------------------------------------------------------
export function criarPadraoTurnosEscaladosVazio() {
  return {
    MANHA: { ENF: 0, TEC: 0 },
    TARDE: { ENF: 0, TEC: 0 },
    DIURNO12: { ENF: 0, TEC: 0 },
    NOITE_PAR: { ENF: 0, TEC: 0 },
    NOITE_IMPAR: { ENF: 0, TEC: 0 },
  };
}

export async function carregarEscaladosMensal(setorId, setorNome, mesAno) {
  const mapaLS = lerLS(LS_KEYS.ESCALADOS, {});
  const kId = `${setorId}__${mesAno}`;
  const kNome = `${(setorNome || '').toUpperCase()}__${mesAno}`;
  const local = mapaLS[kId] || mapaLS[kNome] || null;

  if (setorId) {
    const { data, error } = await supabase
      .from('rundown_escalados')
      .select('*')
      .eq('setor_id', setorId)
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (!error && data) {
      return {
        ...data,
        padrao_turnos: { ...criarPadraoTurnosEscaladosVazio(), ...(data.padrao_turnos || {}) },
        dias: data.dias || {},
      };
    }
  }

  if (local) {
    return {
      ...local,
      padrao_turnos: { ...criarPadraoTurnosEscaladosVazio(), ...(local.padrao_turnos || {}) },
      dias: local.dias || {},
    };
  }

  return null;
}

export async function salvarEscaladosMensal({
  setorId,
  setorNome,
  mesAno,
  padraoTurnos,
  dias,
  responsavelNome,
}) {
  const agora = new Date().toISOString();
  const payload = {
    setor_id: setorId,
    setor_nome: setorNome,
    mes_ano: mesAno,
    padrao_turnos: padraoTurnos || criarPadraoTurnosEscaladosVazio(),
    dias: dias || {},
    responsavel_nome: responsavelNome || 'Unidade',
    updated_at: agora,
  };

  const mapaLS = lerLS(LS_KEYS.ESCALADOS, {});
  if (setorId) mapaLS[`${setorId}__${mesAno}`] = payload;
  if (setorNome) mapaLS[`${setorNome.toUpperCase()}__${mesAno}`] = payload;
  gravarLS(LS_KEYS.ESCALADOS, mapaLS);

  if (setorId) {
    const { error } = await supabase
      .from('rundown_escalados')
      .upsert(payload, { onConflict: 'setor_id,mes_ano' });
    if (error) {
      console.warn('Aviso ao gravar rundown_escalados no Supabase (salvo localmente):', error.message);
      return { ok: true, salvoNoBanco: false, aviso: error.message };
    }
  }

  return { ok: true, salvoNoBanco: true };
}

/**
 * Obtém a quantidade de escalados salva para um dia específico (1..31) e turno ('MANHA' | 'TARDE' | 'NOITE').
 * Se houver ajuste específico salvo para o dia em `dias[dia]`, usa o dia;
 * caso contrário usa `padrao_turnos`.
 * Para MANHA e TARDE, retorna também o DIURNO12 correspondente e a soma total.
 */
export function obterEscaladosSalvosNoDia(registroEscaladosMes, dia, turno) {
  if (!registroEscaladosMes) {
    return {
      ENF: { base: 0, diurno12: 0, total: 0 },
      TEC: { base: 0, diurno12: 0, total: 0 },
    };
  }

  const n = (v) => Math.max(0, parseInt(v, 10) || 0);
  const padrao = registroEscaladosMes.padrao_turnos || {};
  const diaObj = registroEscaladosMes.dias?.[String(dia)] || null;
  const ehPar = Number(dia) % 2 === 0;

  if (turno === 'NOITE') {
    const chaveNoitePadrao = ehPar ? 'NOITE_PAR' : 'NOITE_IMPAR';
    const enfNoite =
      diaObj?.NOITE?.ENF !== undefined ? n(diaObj.NOITE.ENF) : n(padrao[chaveNoitePadrao]?.ENF);
    const tecNoite =
      diaObj?.NOITE?.TEC !== undefined ? n(diaObj.NOITE.TEC) : n(padrao[chaveNoitePadrao]?.TEC);

    return {
      ENF: { base: enfNoite, diurno12: 0, total: enfNoite },
      TEC: { base: tecNoite, diurno12: 0, total: tecNoite },
    };
  }

  // MANHA ou TARDE (soma o bloco 6h + Diurno 12h)
  const enfBase =
    diaObj?.[turno]?.ENF !== undefined ? n(diaObj[turno].ENF) : n(padrao[turno]?.ENF);
  const tecBase =
    diaObj?.[turno]?.TEC !== undefined ? n(diaObj[turno].TEC) : n(padrao[turno]?.TEC);

  const enfD12 =
    diaObj?.DIURNO12?.ENF !== undefined ? n(diaObj.DIURNO12.ENF) : n(padrao.DIURNO12?.ENF);
  const tecD12 =
    diaObj?.DIURNO12?.TEC !== undefined ? n(diaObj.DIURNO12.TEC) : n(padrao.DIURNO12?.TEC);

  return {
    ENF: { base: enfBase, diurno12: enfD12, total: enfBase + enfD12 },
    TEC: { base: tecBase, diurno12: tecD12, total: tecBase + tecD12 },
  };
}

// -----------------------------------------------------------------------------
// 2. Histórico e Registro Diário do Rundown
// -----------------------------------------------------------------------------
export async function carregarHistoricoRundown(setorId, setorNome) {
  const local = lerLS(LS_KEYS.REGISTROS, []).filter(
    (r) =>
      (setorId && r.setor_id === setorId) ||
      (setorNome && (r.setor_nome || '').toUpperCase() === setorNome.toUpperCase())
  );

  let query = supabase
    .from('rundown_registro')
    .select('*')
    .order('data_plantao', { ascending: false });

  if (setorId) {
    query = query.eq('setor_id', setorId);
  } else if (setorNome) {
    query = query.eq('setor_nome', setorNome);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return local.sort((a, b) => (b.data_plantao || '').localeCompare(a.data_plantao || ''));
  }

  // Mescla registros do banco com locais (banco tem prioridade)
  const porChave = new Map();
  local.forEach((r) => porChave.set(`${r.data_plantao}__${r.turno}`, r));
  data.forEach((r) => porChave.set(`${r.data_plantao}__${r.turno}`, r));

  return Array.from(porChave.values()).sort((a, b) =>
    (b.data_plantao || '').localeCompare(a.data_plantao || '')
  );
}

export async function carregarDiurno12Dia(setorId, setorNome, dataPlantao) {
  const local = lerLS(LS_KEYS.DIURNO12, {}).find?.(
    (d) =>
      d.data_plantao === dataPlantao &&
      ((setorId && d.setor_id === setorId) ||
        (setorNome && (d.setor_nome || '').toUpperCase() === setorNome.toUpperCase()))
  );

  if (setorId) {
    const { data, error } = await supabase
      .from('rundown_diurno12')
      .select('*')
      .eq('setor_id', setorId)
      .eq('data_plantao', dataPlantao)
      .maybeSingle();
    if (!error && data) return data.quadro || criarQuadroVazio();
  }
  return local?.quadro || criarQuadroVazio();
}

export async function salvarRundownCompleto({
  setorId,
  setorNome,
  dataPlantao,
  turno,
  quadroTurno,
  quadroDiurno12,
  leitosTotais,
  ocupados,
  bloqueados,
  alertas,
  responsavelNome,
  registroExistente,
}) {
  const agora = new Date().toISOString();
  const alertasLimpos = serializarAlertas(alertas);
  const equipeNoite = turno === 'NOITE' ? calcularEquipeNoite(dataPlantao) : null;

  const payload = {
    setor_id: setorId,
    setor_nome: setorNome,
    data_plantao: dataPlantao,
    turno,
    equipe_noite: equipeNoite,
    quadro: quadroTurno,
    leitos_totais: Number(leitosTotais) || 0,
    ocupados: Number(ocupados) || 0,
    bloqueados: Number(bloqueados) || 0,
    alertas: alertasLimpos,
    responsavel_nome: registroExistente?.responsavel_nome || responsavelNome,
    editado_por_nome: registroExistente ? responsavelNome : null,
    editado_em: registroExistente ? agora : null,
    origem: 'MANUAL',
  };

  // 1. Salva sempre no cache local para resiliência imediata
  const listaLS = lerLS(LS_KEYS.REGISTROS, []);
  const idx = listaLS.findIndex(
    (r) =>
      r.data_plantao === dataPlantao &&
      r.turno === turno &&
      (r.setor_id === setorId || r.setor_nome === setorNome)
  );
  const itemLS = {
    ...payload,
    created_at: registroExistente?.created_at || agora,
  };
  if (idx >= 0) listaLS[idx] = itemLS;
  else listaLS.unshift(itemLS);
  gravarLS(LS_KEYS.REGISTROS, listaLS);

  // Salva Diurno 12h quando o turno for Manhã ou Tarde
  if (turno === 'MANHA' || turno === 'TARDE') {
    const listaD12 = Array.isArray(lerLS(LS_KEYS.DIURNO12, []))
      ? lerLS(LS_KEYS.DIURNO12, [])
      : [];
    const idxD12 = listaD12.findIndex(
      (d) =>
        d.data_plantao === dataPlantao &&
        (d.setor_id === setorId || d.setor_nome === setorNome)
    );
    const itemD12 = {
      setor_id: setorId,
      setor_nome: setorNome,
      data_plantao: dataPlantao,
      quadro: quadroDiurno12,
      responsavel_nome: responsavelNome,
      editado_por_nome: idxD12 >= 0 ? responsavelNome : null,
      editado_em: idxD12 >= 0 ? agora : null,
    };
    if (idxD12 >= 0) listaD12[idxD12] = itemD12;
    else listaD12.push(itemD12);
    gravarLS(LS_KEYS.DIURNO12, listaD12);
  }

  // 2. Persiste no Supabase
  if (setorId) {
    const { error: eReg } = await supabase
      .from('rundown_registro')
      .upsert(payload, { onConflict: 'setor_id,data_plantao,turno' });

    if ((turno === 'MANHA' || turno === 'TARDE') && quadroDiurno12) {
      await supabase.from('rundown_diurno12').upsert(
        {
          setor_id: setorId,
          data_plantao: dataPlantao,
          quadro: quadroDiurno12,
          responsavel_nome: responsavelNome,
          editado_por_nome: registroExistente ? responsavelNome : null,
          editado_em: registroExistente ? agora : null,
        },
        { onConflict: 'setor_id,data_plantao' }
      );
    }

    if (eReg) {
      console.warn('Aviso Supabase (salvo localmente):', eReg.message);
      return { ok: true, salvoNoBanco: false, aviso: eReg.message };
    }
  }

  return { ok: true, salvoNoBanco: true };
}

// -----------------------------------------------------------------------------
// 3. Afastamentos Previstos (sem nomes, com projeção nos dias seguintes)
// -----------------------------------------------------------------------------
export async function carregarAfastamentosSetor(setorId, setorNome) {
  const local = lerLS(LS_KEYS.AFASTAMENTOS, []).filter(
    (a) =>
      (setorId && a.setor_id === setorId) ||
      (setorNome && (a.setor_nome || '').toUpperCase() === setorNome.toUpperCase())
  );

  if (!setorId) return local;

  const { data, error } = await supabase
    .from('rundown_afastamentos')
    .select('*')
    .eq('setor_id', setorId)
    .order('inicio', { ascending: false });

  if (error || !Array.isArray(data)) return local;

  const idsBanco = new Set(data.map((d) => String(d.id)));
  const extrasLocais = local.filter((l) => !idsBanco.has(String(l.id)));
  return [...data, ...extrasLocais];
}

export async function adicionarAfastamentoPrevisto({
  setorId,
  setorNome,
  categoria,
  turno,
  tipo,
  quantidade,
  inicio,
  retornoPrevisto,
  responsavelNome,
}) {
  const novo = {
    id: `local_${Date.now()}`,
    setor_id: setorId,
    setor_nome: setorNome,
    categoria,
    turno,
    tipo,
    quantidade: Math.max(1, parseInt(quantidade, 10) || 1),
    inicio,
    retorno_previsto: retornoPrevisto,
    responsavel_nome: responsavelNome || 'Responsável da Unidade',
    created_at: new Date().toISOString(),
  };

  if (setorId) {
    const { data, error } = await supabase
      .from('rundown_afastamentos')
      .insert({
        setor_id: setorId,
        categoria,
        turno,
        tipo,
        quantidade: novo.quantidade,
        inicio,
        retorno_previsto: retornoPrevisto,
        responsavel_nome: novo.responsavel_nome,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      return data;
    }
  }

  const lista = lerLS(LS_KEYS.AFASTAMENTOS, []);
  lista.unshift(novo);
  gravarLS(LS_KEYS.AFASTAMENTOS, lista);
  return novo;
}

export async function excluirAfastamentoPrevisto(id) {
  const lista = lerLS(LS_KEYS.AFASTAMENTOS, []).filter((a) => String(a.id) !== String(id));
  gravarLS(LS_KEYS.AFASTAMENTOS, lista);

  if (id && !String(id).startsWith('local_')) {
    await supabase.from('rundown_afastamentos').delete().eq('id', id);
  }
}

/**
 * Calcula quantos profissionais estão afastados por projeção em uma determinada data e turno.
 * Se o afastamento for DIURNO12, projeta tanto na MANHA quanto na TARDE.
 */
export function calcularAfastamentosProjetadosNoDia(afastamentos = [], dataStr, turno, categoria) {
  return afastamentos
    .filter((a) => {
      if (a.categoria !== categoria) return false;
      const turnoMatch =
        !turno ||
        a.turno === turno ||
        ((turno === 'MANHA' || turno === 'TARDE') && a.turno === 'DIURNO12');
      if (!turnoMatch) return false;
      return a.inicio <= dataStr && a.retorno_previsto >= dataStr;
    })
    .reduce((acc, a) => acc + (Number(a.quantidade) || 0), 0);
}

// -----------------------------------------------------------------------------
// 4. Consolidação Global para a Supervisão
// -----------------------------------------------------------------------------
export async function carregarConsolidadoSupervisao(dataPlantao) {
  const [setores, mapaDim] = await Promise.all([
    carregarSetoresAtivos(),
    carregarTodoDimensionamento(),
  ]);

  // Busca registros do dia no banco + localStorage
  const localReg = lerLS(LS_KEYS.REGISTROS, []).filter((r) => r.data_plantao === dataPlantao);
  const localD12 = (Array.isArray(lerLS(LS_KEYS.DIURNO12, [])) ? lerLS(LS_KEYS.DIURNO12, []) : []).filter(
    (d) => d.data_plantao === dataPlantao
  );
  const localAfast = lerLS(LS_KEYS.AFASTAMENTOS, []).filter(
    (a) => a.inicio <= dataPlantao && a.retorno_previsto >= dataPlantao
  );

  const [resReg, resD12, resAfast] = await Promise.all([
    supabase.from('rundown_registro').select('*').eq('data_plantao', dataPlantao),
    supabase.from('rundown_diurno12').select('*').eq('data_plantao', dataPlantao),
    supabase
      .from('rundown_afastamentos')
      .select('*')
      .lte('inicio', dataPlantao)
      .gte('retorno_previsto', dataPlantao),
  ]);

  const registros = [
    ...localReg,
    ...(Array.isArray(resReg.data) ? resReg.data : []),
  ];
  const diurnos12 = [
    ...localD12,
    ...(Array.isArray(resD12.data) ? resD12.data : []),
  ];
  const afastamentos = [
    ...localAfast,
    ...(Array.isArray(resAfast.data) ? resAfast.data : []),
  ];

  return {
    setores,
    mapaDim,
    registros,
    diurnos12,
    afastamentos,
  };
}
