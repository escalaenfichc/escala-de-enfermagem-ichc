import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardCheck,
  Plus,
  Send,
  ShieldAlert,
  X,
  Lock,
  CalendarClock,
  Trash2,
  UserCheck,
  Building2,
  Sun,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Info,
  Printer,
  Users,
  CalendarDays,
} from 'lucide-react';
import {
  TURNOS_RUNDOWN,
  CATEGORIAS_RUNDOWN,
  TIPOS_AFASTAMENTO,
  calcularEquipeNoite,
  criarQuadroVazio,
} from '../../components/plantao/constantes';
import GestaoLeitosCard from '../../components/plantao/GestaoLeitosCard';
import AlertasUnidadeCard from '../../components/plantao/AlertasUnidadeCard';
import ModalAlerta from '../../components/plantao/ModalAlerta';
import AbaEscaladosUnidade from './AbaEscaladosUnidade';
import CalendarioMensal from './CalendarioMensal';
import {
  carregarSetoresAtivos,
  carregarTodoDimensionamento,
  obterMinimoDimensionamento,
  carregarHistoricoRundown,
  carregarDiurno12Dia,
  salvarRundownCompleto,
  carregarAfastamentosSetor,
  adicionarAfastamentoPrevisto,
  excluirAfastamentoPrevisto,
  calcularAfastamentosProjetadosNoDia,
  calcularTotaisCategoria,
  carregarEscaladosMensal,
  obterEscaladosSalvosNoDia,
} from '../../services/rundownService';

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function formatarDataBR(iso) {
  if (!iso) return '—';
  return String(iso).split('-').reverse().join('/');
}

export default function Rundown({ setorFiltro }) {
  const { user } = useAuth();
  const [setores, setSetores] = useState([]);
  const [mapaDim, setMapaDim] = useState({});
  const [setorSelecionadoNome, setSetorSelecionadoNome] = useState('');
  const [loadingInicial, setLoadingInicial] = useState(true);

  // Fluxo Lobby vs Formulário
  const [viewAtual, setViewAtual] = useState('lobby'); // 'lobby' | 'form'
  const [listaHistorico, setListaHistorico] = useState([]);
  const [registroAtivo, setRegistroAtivo] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Campos principais do Rundown
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO());
  const [turno, setTurno] = useState('MANHA');
  const [responsavelNome, setResponsavelNome] = useState('');

  // Quadro numérico (Turno 6h/Noite 12h + Diurno 12h compartilhado)
  const [quadroTurno, setQuadroTurno] = useState(criarQuadroVazio());
  const [quadroDiurno12, setQuadroDiurno12] = useState(criarQuadroVazio());

  // Leitos e Alertas
  const [ocupados, setOcupados] = useState(0);
  const [bloqueados, setBloqueados] = useState(0);
  const [alertas, setAlertas] = useState([]);
  const [modalAlerta, setModalAlerta] = useState(null);

  // Afastamentos previstos (com projeção nos dias seguintes)
  const [afastamentos, setAfastamentos] = useState([]);
  const [novoAfast, setNovoAfast] = useState({
    categoria: 'TEC',
    turno: 'MANHA',
    tipo: TIPOS_AFASTAMENTO[0],
    quantidade: 1,
    inicio: hojeISO(),
    retornoPrevisto: hojeISO(),
  });
  const [salvando, setSalvando] = useState(false);

  // Carrega lista de unidades ativas e dimensionamento
  useEffect(() => {
    async function init() {
      setLoadingInicial(true);
      const [listaSetores, dim] = await Promise.all([
        carregarSetoresAtivos(),
        carregarTodoDimensionamento(),
      ]);
      setSetores(listaSetores);
      setMapaDim(dim);

      // Define unidade inicial a partir do filtro global, perfil do usuário ou primeira da lista
      const preferencial =
        setorFiltro && setorFiltro !== 'Global' && setorFiltro !== 'Todos'
          ? setorFiltro
          : user?.unidadeLogada && user?.unidadeLogada !== 'Global'
          ? user.unidadeLogada
          : listaSetores[0]?.nome || '';

      setSetorSelecionadoNome(preferencial);
      setLoadingInicial(false);
    }
    init();
  }, [setorFiltro, user?.unidadeLogada]);

  const setorAtualObj = useMemo(
    () =>
      setores.find(
        (s) => (s.nome || '').toUpperCase() === (setorSelecionadoNome || '').toUpperCase()
      ) || null,
    [setores, setorSelecionadoNome]
  );

  const leitosTotaisSetor = registroAtivo?.leitos_totais || setorAtualObj?.leitos_operacionais || 0;

  // Carrega histórico e afastamentos da unidade selecionada
  const recarregarDadosUnidade = async () => {
    if (!setorSelecionadoNome) return;
    const [hist, afast] = await Promise.all([
      carregarHistoricoRundown(setorAtualObj?.id, setorSelecionadoNome),
      carregarAfastamentosSetor(setorAtualObj?.id, setorSelecionadoNome),
    ]);
    setListaHistorico(hist);
    setAfastamentos(afast);
  };

  useEffect(() => {
    recarregarDadosUnidade();
  }, [setorSelecionadoNome, setorAtualObj?.id]);

  // Quando abrir formulário em Manhã ou Tarde, carrega o bloco Diurno 12h já salvo para a data
  useEffect(() => {
    if (viewAtual !== 'form') return;
    if (turno === 'MANHA' || turno === 'TARDE') {
      carregarDiurno12Dia(setorAtualObj?.id, setorSelecionadoNome, dataSelecionada).then((q) => {
        setQuadroDiurno12(q || criarQuadroVazio());
      });
    }
  }, [viewAtual, turno, dataSelecionada, setorAtualObj?.id, setorSelecionadoNome]);

  const iniciarNovoRundown = async () => {
    if (!setorSelecionadoNome) {
      alert('Selecione a unidade na lista antes de iniciar.');
      return;
    }
    if (!turno) {
      alert('Selecione o turno para iniciar.');
      return;
    }
    const hoje = hojeISO();
    const existente = listaHistorico.find(
      (r) => r.data_plantao === hoje && r.turno === turno
    );
    if (existente) {
      alert(
        `Já existe um Rundown registrado hoje (${formatarDataBR(hoje)}) para o turno ${turno}. Abra o registro existente na lista para consultar ou editar.`
      );
      return;
    }

    setRegistroAtivo(null);
    setIsReadOnly(false);
    setDataSelecionada(hoje);

    // Busca os Escalados salvos na aba "Inserir Quantidade de Escalados" para pré-preencher o dia
    const mesAnoHoje = hoje.slice(0, 7);
    const diaHojeNum = parseInt(hoje.split('-')[2], 10);
    const [d12Salvo, regEscMes] = await Promise.all([
      carregarDiurno12Dia(setorAtualObj?.id, setorSelecionadoNome, hoje),
      carregarEscaladosMensal(setorAtualObj?.id, setorSelecionadoNome, mesAnoHoje),
    ]);

    const escDia = obterEscaladosSalvosNoDia(regEscMes, diaHojeNum, turno);
    const qBaseInicial = criarQuadroVazio();
    qBaseInicial.ENF.escalados = escDia.ENF.base;
    qBaseInicial.TEC.escalados = escDia.TEC.base;
    setQuadroTurno(qBaseInicial);

    const qD12Inicial = d12Salvo || criarQuadroVazio();
    if (!qD12Inicial.ENF?.escalados && escDia.ENF.diurno12 > 0) {
      qD12Inicial.ENF = { ...(qD12Inicial.ENF || {}), escalados: escDia.ENF.diurno12 };
    }
    if (!qD12Inicial.TEC?.escalados && escDia.TEC.diurno12 > 0) {
      qD12Inicial.TEC = { ...(qD12Inicial.TEC || {}), escalados: escDia.TEC.diurno12 };
    }
    setQuadroDiurno12(qD12Inicial);

    setOcupados(0);
    setBloqueados(0);
    setAlertas([]);
    setViewAtual('form');
  };

  const abrirRegistro = async (reg) => {
    const hoje = hojeISO();
    setRegistroAtivo(reg);
    setDataSelecionada(reg.data_plantao);
    setTurno(reg.turno);
    setQuadroTurno(reg.quadro || criarQuadroVazio());
    const d12 = await carregarDiurno12Dia(
      setorAtualObj?.id,
      setorSelecionadoNome,
      reg.data_plantao
    );
    setQuadroDiurno12(d12 || criarQuadroVazio());
    setOcupados(reg.ocupados || 0);
    setBloqueados(reg.bloqueados || 0);
    setAlertas(reg.alertas || []);
    setResponsavelNome(reg.editado_por_nome || reg.responsavel_nome || '');
    setIsReadOnly(reg.data_plantao < hoje);
    setViewAtual('form');
  };

  // Helpers para atualizar campos numéricos do quadro
  const atualizarCampoQuadro = (bloco, cat, campo, valor, subcampo) => {
    if (isReadOnly) return;
    const num = Math.max(0, parseInt(valor, 10) || 0);
    const setter = bloco === 'D12' ? setQuadroDiurno12 : setQuadroTurno;
    setter((prev) => {
      const catAtual = prev[cat] || {
        escalados: 0,
        faltas: { fnj: 0, atestado: 0, outras: 0 },
        recebidos: 0,
        cedidos: 0,
      };
      if (campo === 'faltas') {
        return {
          ...prev,
          [cat]: {
            ...catAtual,
            faltas: { ...(catAtual.faltas || {}), [subcampo]: num },
          },
        };
      }
      return {
        ...prev,
        [cat]: {
          ...catAtual,
          [campo]: num,
        },
      };
    });
  };

  // Cálculos consolidados por categoria (ENF e TEC)
  const resumoENF = useMemo(
    () =>
      calcularTotaisCategoria({
        cat: 'ENF',
        turno,
        quadroTurno,
        quadroDiurno12,
        minimo: obterMinimoDimensionamento(
          mapaDim,
          setorAtualObj?.id,
          setorSelecionadoNome,
          turno,
          'ENF'
        ),
      }),
    [turno, quadroTurno, quadroDiurno12, mapaDim, setorAtualObj?.id, setorSelecionadoNome]
  );

  const resumoTEC = useMemo(
    () =>
      calcularTotaisCategoria({
        cat: 'TEC',
        turno,
        quadroTurno,
        quadroDiurno12,
        minimo: obterMinimoDimensionamento(
          mapaDim,
          setorAtualObj?.id,
          setorSelecionadoNome,
          turno,
          'TEC'
        ),
      }),
    [turno, quadroTurno, quadroDiurno12, mapaDim, setorAtualObj?.id, setorSelecionadoNome]
  );

  const resumoPorCat = { ENF: resumoENF, TEC: resumoTEC };
  const incluiDiurno12 = turno === 'MANHA' || turno === 'TARDE';
  const equipeNoite = turno === 'NOITE' ? calcularEquipeNoite(dataSelecionada) : null;

  // Alertas
  const abrirNovoAlerta = (tipoDef) =>
    setModalAlerta({ tipoDef, uid: null, dadosExistentes: null });
  const abrirEditarAlerta = (alerta) =>
    setModalAlerta({ tipoDef: alerta.tipoDef, uid: alerta.uid, dadosExistentes: alerta.dados });
  const salvarAlerta = (dados) => {
    setAlertas((prev) => {
      if (modalAlerta.uid) {
        return prev.map((a) => (a.uid === modalAlerta.uid ? { ...a, dados } : a));
      }
      const uid = `${modalAlerta.tipoDef.id}_${Date.now()}`;
      return [...prev, { uid, tipoDef: modalAlerta.tipoDef, dados }];
    });
    setModalAlerta(null);
  };
  const removerAlerta = () => {
    setAlertas((prev) => prev.filter((a) => a.uid !== modalAlerta.uid));
    setModalAlerta(null);
  };

  // Afastamentos previstos
  const handleAdicionarAfastamento = async (e) => {
    e.preventDefault();
    if (!responsavelNome.trim()) {
      alert('Preencha o nome do responsável pelas informações antes de incluir um afastamento.');
      return;
    }
    if (novoAfast.retornoPrevisto < novoAfast.inicio) {
      alert('A data de retorno previsto deve ser igual ou posterior à data de início.');
      return;
    }
    await adicionarAfastamentoPrevisto({
      setorId: setorAtualObj?.id,
      setorNome: setorSelecionadoNome,
      categoria: novoAfast.categoria,
      turno: novoAfast.turno,
      tipo: novoAfast.tipo,
      quantidade: novoAfast.quantidade,
      inicio: novoAfast.inicio,
      retornoPrevisto: novoAfast.retornoPrevisto,
      responsavelNome: responsavelNome.trim(),
    });
    const atualizados = await carregarAfastamentosSetor(setorAtualObj?.id, setorSelecionadoNome);
    setAfastamentos(atualizados);
  };

  const handleExcluirAfastamento = async (id) => {
    await excluirAfastamentoPrevisto(id);
    const atualizados = await carregarAfastamentosSetor(setorAtualObj?.id, setorSelecionadoNome);
    setAfastamentos(atualizados);
  };

  // Salvar Rundown
  const handleSalvarRundown = async () => {
    if (!setorSelecionadoNome) {
      alert('Selecione a unidade.');
      return;
    }
    if (!responsavelNome.trim()) {
      alert('Informe o nome da pessoa responsável pelas informações.');
      return;
    }
    setSalvando(true);
    try {
      await salvarRundownCompleto({
        setorId: setorAtualObj?.id,
        setorNome: setorSelecionadoNome,
        dataPlantao: dataSelecionada,
        turno,
        quadroTurno,
        quadroDiurno12,
        leitosTotais: leitosTotaisSetor,
        ocupados,
        bloqueados,
        alertas,
        responsavelNome: responsavelNome.trim(),
        registroExistente: registroAtivo,
      });
      await recarregarDadosUnidade();
      alert('Rundown da unidade registrado com sucesso!');
      setViewAtual('lobby');
    } catch (err) {
      alert('Erro ao salvar Rundown: ' + (err.message || err));
    } finally {
      setSalvando(false);
    }
  };

  if (loadingInicial) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold">
        Carregando unidades e parâmetros do Rundown...
      </div>
    );
  }

  const labelTurno = TURNOS_RUNDOWN.find((t) => t.id === turno)?.curto || turno;

  return (
    <div className="flex flex-col gap-6">
      {/* ── BARRA DE SELEÇÃO DA UNIDADE ── */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">
              Rundown
            </h2>
            <p className="text-xs text-slate-500">
              Lançamento diário por turno, gestão de leitos, alertas e projeção de afastamentos.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Unidade Assistencial *
            </label>
            <select
              value={setorSelecionadoNome}
              onChange={(e) => {
                setSetorSelecionadoNome(e.target.value);
                setViewAtual('lobby');
              }}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-3.5 py-2.5 font-bold outline-none focus:ring-2 focus:ring-indigo-500 min-w-[260px]"
            >
              {setores.map((s) => (
                <option key={s.id || s.nome} value={s.nome}>
                  {s.sigla ? `${s.sigla} — ${s.nome}` : s.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: LOBBY (HISTÓRICO DA UNIDADE) ── */}
      {viewAtual === 'lobby' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6 print:hidden">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b pb-4">
            <div>
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                Histórico de Rundowns — {setorSelecionadoNome}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Capacidade configurada: <strong className="text-slate-600">{leitosTotaisSetor} leitos</strong> · Selecione o turno abaixo para iniciar o preenchimento de hoje.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                className="border border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
              >
                {TURNOS_RUNDOWN.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={iniciarNovoRundown}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm shadow-sm"
              >
                <Plus size={18} /> Iniciar Rundown de Hoje
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {listaHistorico.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClipboardCheck size={36} className="mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium">
                  Nenhum Rundown registrado para {setorSelecionadoNome}.
                </p>
              </div>
            ) : (
              listaHistorico.map((r) => {
                const tInfo = TURNOS_RUNDOWN.find((t) => t.id === r.turno);
                return (
                  <div
                    key={`${r.data_plantao}-${r.turno}`}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors gap-4"
                  >
                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Data</p>
                        <p className="font-bold text-slate-800">{formatarDataBR(r.data_plantao)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Turno</p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-indigo-600">
                            {tInfo?.curto || r.turno}
                          </span>
                          {r.turno === 'NOITE' && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              Noite {r.equipe_noite || calcularEquipeNoite(r.data_plantao)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Leitos</p>
                        <p className="text-xs font-bold text-slate-700">
                          Ocup: <span className="text-blue-600">{r.ocupados || 0}</span> · Bloq:{' '}
                          <span className="text-rose-600">{r.bloqueados || 0}</span> /{' '}
                          {r.leitos_totais || leitosTotaisSetor}
                        </p>
                      </div>
                      <div className="border-l border-slate-200 pl-5">
                        <p className="text-[11px] text-slate-500">
                          <span className="font-bold text-slate-400 uppercase mr-1">
                            Responsável pelas informações:
                          </span>
                          <span className="font-bold text-indigo-600 mr-2">
                            {r.responsavel_nome || 'Não informado'}
                          </span>
                          {r.created_at && (
                            <span className="text-slate-400">
                              ({new Date(r.created_at).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })})
                            </span>
                          )}
                        </p>
                        {r.editado_em && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            <span className="font-bold text-slate-400 uppercase mr-1">
                              Última edição:
                            </span>
                            <span className="font-semibold text-slate-700 mr-1">
                              {r.editado_por_nome || r.responsavel_nome}
                            </span>
                            <span className="text-slate-400">
                              ({new Date(r.editado_em).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })})
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => abrirRegistro(r)}
                      className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 self-end md:self-center"
                    >
                      Abrir Registro
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: FORMULÁRIO DO RUNDOWN ── */}
      {viewAtual === 'form' && (
        <div
          id="area-impressao-rundown"
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6"
        >
          {/* Cabeçalho do Formulário */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewAtual('lobby')}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 print:hidden"
                title="Voltar ao histórico"
              >
                <X size={20} />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black text-slate-800 uppercase">
                    Rundown · {setorSelecionadoNome}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Turno: {labelTurno}
                  </span>
                  {turno === 'NOITE' && (
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 flex items-center gap-1">
                      <Moon size={13} /> Plantão 12h · Equipe {equipeNoite}
                    </span>
                  )}
                  {incluiDiurno12 && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Sun size={13} /> Soma automática do Diurno 12h (Manhã + Tarde)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Data de referência: <strong>{formatarDataBR(dataSelecionada)}</strong>
                </p>
              </div>
            </div>

            {/* Responsável + Data + Modo Leitura */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[240px]">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <UserCheck size={12} className="text-indigo-600" /> Nome do Responsável pelas Informações *
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  placeholder="Digite seu nome completo..."
                  value={responsavelNome}
                  onChange={(e) => setResponsavelNome(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={dataSelecionada}
                  disabled={!!registroAtivo}
                  onChange={(e) => setDataSelecionada(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-slate-50 outline-none"
                />
              </div>

              {isReadOnly && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <ShieldAlert size={15} /> MODO CONSULTA (Encerrado)
                </div>
              )}
            </div>
          </div>

          {/* Cards de Resumo Consolidado do Turno */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Lock size={11} /> Necessários (Fixo ADM)
              </p>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {resumoENF.necessarios + resumoTEC.necessarios}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ENF: <strong>{resumoENF.necessarios}</strong> · TÉC/AUX:{' '}
                <strong>{resumoTEC.necessarios}</strong>
              </p>
            </div>

            <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-700 uppercase">Total Escalados</p>
              <p className="text-2xl font-black text-indigo-800 mt-1">
                {resumoENF.escalados + resumoTEC.escalados}
              </p>
              <p className="text-[11px] text-indigo-600 mt-0.5">
                ENF: <strong>{resumoENF.escalados}</strong> · TÉC/AUX:{' '}
                <strong>{resumoTEC.escalados}</strong>
              </p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">
                Presentes Efetivos
              </p>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                {resumoENF.presentes + resumoTEC.presentes}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                ENF: <strong>{resumoENF.presentes}</strong> · TÉC/AUX:{' '}
                <strong>{resumoTEC.presentes}</strong>
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                resumoENF.temDeficit || resumoTEC.temDeficit
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50/50 border-emerald-200'
              }`}
            >
              <p
                className={`text-[10px] font-bold uppercase ${
                  resumoENF.temDeficit || resumoTEC.temDeficit
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                Faltas no Dia / Saldo
              </p>
              <p
                className={`text-2xl font-black mt-1 ${
                  resumoENF.temDeficit || resumoTEC.temDeficit
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {resumoENF.totalFaltas + resumoTEC.totalFaltas} falta(s)
              </p>
              <p className="text-[11px] font-bold mt-0.5 text-slate-600">
                Saldo ENF:{' '}
                <span className={resumoENF.saldo < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {resumoENF.saldo >= 0 ? `+${resumoENF.saldo}` : resumoENF.saldo}
                </span>{' '}
                · TÉC:{' '}
                <span className={resumoTEC.saldo < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {resumoTEC.saldo >= 0 ? `+${resumoTEC.saldo}` : resumoTEC.saldo}
                </span>
              </p>
            </div>
          </div>

          {/* ── BLOCO 1: QUADRO QUANTITATIVO POR CATEGORIA ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {CATEGORIAS_RUNDOWN.map((cat) => {
              const res = resumoPorCat[cat.id];
              const qBase = quadroTurno[cat.id] || {};
              const qD12 = quadroDiurno12[cat.id] || {};
              const afastHoje = calcularAfastamentosProjetadosNoDia(
                afastamentos,
                dataSelecionada,
                turno,
                cat.id
              );

              return (
                <div
                  key={cat.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col"
                >
                  {/* Header da Categoria */}
                  <div
                    className={`px-5 py-3.5 border-b flex items-center justify-between ${
                      cat.id === 'ENF'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-teal-700 text-white'
                    }`}
                  >
                    <div>
                      <h3 className="font-extrabold text-sm uppercase tracking-wide">
                        {cat.label}
                      </h3>
                      <p className="text-[11px] opacity-85">
                        Necessários (Admin): <strong>{res.necessarios}</strong> · Presentes:{' '}
                        <strong>{res.presentes}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {res.temDeficit ? (
                        <span className="bg-rose-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <AlertTriangle size={13} /> Déficit: {res.saldo}
                        </span>
                      ) : (
                        <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle2 size={13} /> Coberto ({res.saldo >= 0 ? `+${res.saldo}` : res.saldo})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aviso de Afastamentos Projetados para Hoje */}
                  {afastHoje > 0 && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <CalendarClock size={14} className="text-amber-600" />
                        Afastamentos vigentes projetados para hoje neste turno:
                      </span>
                      <span className="font-black bg-amber-200/70 px-2 py-0.5 rounded-full">
                        {afastHoje} profissional(is)
                      </span>
                    </div>
                  )}

                  {/* Tabela de Preenchimento */}
                  <div className="p-4">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                          <th className="py-2 text-left">Indicador do Turno</th>
                          <th className="py-2 text-center w-28">
                            {incluiDiurno12 ? `Turno ${labelTurno} (6h)` : `Noite 12h (${equipeNoite})`}
                          </th>
                          {incluiDiurno12 && (
                            <th className="py-2 text-center w-32 bg-amber-50/70 text-amber-800 rounded-t-lg">
                              Diurno 12h (M+T)
                            </th>
                          )}
                          <th className="py-2 text-center w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70">
                        {/* Necessários (Fixo Admin) */}
                        <tr className="bg-white/60">
                          <td className="py-2.5 px-2 font-bold text-slate-700 flex items-center gap-1.5">
                            <Lock size={12} className="text-slate-400" />
                            Necessários (Quadro Mínimo)
                          </td>
                          <td
                            colSpan={incluiDiurno12 ? 2 : 1}
                            className="py-2 text-center text-[11px] text-slate-400 italic"
                          >
                            Fixo pela Administração
                          </td>
                          <td className="py-2 text-center font-black text-sm text-slate-800">
                            {res.necessarios}
                          </td>
                        </tr>

                        {/* Escalados */}
                        <tr>
                          <td className="py-2.5 px-2 font-bold text-slate-700">
                            Escalados no Turno
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.escalados ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro('BASE', cat.id, 'escalados', e.target.value)
                              }
                              className="w-20 text-center font-bold text-slate-800 bg-white border border-slate-300 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.escalados ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro('D12', cat.id, 'escalados', e.target.value)
                                }
                                className="w-20 text-center font-bold text-amber-900 bg-white border border-amber-300 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-black text-sm text-indigo-700">
                            {res.escalados}
                          </td>
                        </tr>

                        {/* Falta Não Justificada */}
                        <tr>
                          <td className="py-2 px-2 text-rose-700 font-semibold">
                            ↳ Falta não justificada
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.faltas?.fnj ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro('BASE', cat.id, 'faltas', e.target.value, 'fnj')
                              }
                              className="w-20 text-center font-bold text-rose-700 bg-white border border-rose-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.faltas?.fnj ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro('D12', cat.id, 'faltas', e.target.value, 'fnj')
                                }
                                className="w-20 text-center font-bold text-rose-700 bg-white border border-amber-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-bold text-rose-600">{res.fnj}</td>
                        </tr>

                        {/* Afastamento Médico / Atestado no dia */}
                        <tr>
                          <td className="py-2 px-2 text-rose-700 font-semibold">
                            ↳ Atestado / Afastamento médico
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.faltas?.atestado ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro(
                                  'BASE',
                                  cat.id,
                                  'faltas',
                                  e.target.value,
                                  'atestado'
                                )
                              }
                              className="w-20 text-center font-bold text-rose-700 bg-white border border-rose-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.faltas?.atestado ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro(
                                    'D12',
                                    cat.id,
                                    'faltas',
                                    e.target.value,
                                    'atestado'
                                  )
                                }
                                className="w-20 text-center font-bold text-rose-700 bg-white border border-amber-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-bold text-rose-600">
                            {res.atestado}
                          </td>
                        </tr>

                        {/* Outras Justificativas */}
                        <tr>
                          <td className="py-2 px-2 text-rose-700 font-semibold">
                            ↳ Outras justificativas
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.faltas?.outras ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro(
                                  'BASE',
                                  cat.id,
                                  'faltas',
                                  e.target.value,
                                  'outras'
                                )
                              }
                              className="w-20 text-center font-bold text-rose-700 bg-white border border-rose-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.faltas?.outras ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro(
                                    'D12',
                                    cat.id,
                                    'faltas',
                                    e.target.value,
                                    'outras'
                                  )
                                }
                                className="w-20 text-center font-bold text-rose-700 bg-white border border-amber-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-rose-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-bold text-rose-600">
                            {res.outras}
                          </td>
                        </tr>

                        {/* Remanejados Recebidos */}
                        <tr>
                          <td className="py-2 px-2 text-emerald-700 font-semibold">
                            + Remanejados recebidos de outro setor
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.recebidos ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro('BASE', cat.id, 'recebidos', e.target.value)
                              }
                              className="w-20 text-center font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.recebidos ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro('D12', cat.id, 'recebidos', e.target.value)
                                }
                                className="w-20 text-center font-bold text-emerald-700 bg-white border border-amber-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-emerald-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-bold text-emerald-600">
                            +{res.recebidos}
                          </td>
                        </tr>

                        {/* Remanejados Cedidos */}
                        <tr>
                          <td className="py-2 px-2 text-amber-700 font-semibold">
                            − Remanejados cedidos para outro setor
                          </td>
                          <td className="py-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              disabled={isReadOnly}
                              value={qBase.cedidos ?? 0}
                              onChange={(e) =>
                                atualizarCampoQuadro('BASE', cat.id, 'cedidos', e.target.value)
                              }
                              className="w-20 text-center font-bold text-amber-700 bg-white border border-amber-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </td>
                          {incluiDiurno12 && (
                            <td className="py-1.5 text-center bg-amber-50/40">
                              <input
                                type="number"
                                min="0"
                                disabled={isReadOnly}
                                value={qD12.cedidos ?? 0}
                                onChange={(e) =>
                                  atualizarCampoQuadro('D12', cat.id, 'cedidos', e.target.value)
                                }
                                className="w-20 text-center font-bold text-amber-700 bg-white border border-amber-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </td>
                          )}
                          <td className="py-1.5 text-center font-bold text-amber-700">
                            -{res.cedidos}
                          </td>
                        </tr>

                        {/* Total Presentes */}
                        <tr className="bg-emerald-50/70 font-black">
                          <td className="py-2.5 px-2 text-emerald-900">
                            = Total Presentes no Plantão
                          </td>
                          <td colSpan={incluiDiurno12 ? 2 : 1} className="text-center text-[11px] text-emerald-700">
                            Escalados ({res.escalados}) − Faltas ({res.totalFaltas}) + Rec ({res.recebidos}) − Ced ({res.cedidos})
                          </td>
                          <td className="py-2.5 text-center text-base text-emerald-800">
                            {res.presentes}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── BLOCO 2: AFASTAMENTOS / ATESTADOS PREVISTOS (PROJEÇÃO NOS DIAS SEGUINTES) ── */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <CalendarClock className="text-indigo-600" /> Atestados e Afastamentos Previstos (Projeção nos Dias Seguintes)
                </h3>
                <p className="text-xs text-slate-500">
                  Registre a quantidade e o período de afastamento (sem nome de colaborador). O sistema projeta automaticamente nos próximos dias do calendário e da supervisão.
                </p>
              </div>
            </div>

            {!isReadOnly && (
              <form
                onSubmit={handleAdicionarAfastamento}
                className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end print:hidden"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Categoria
                  </label>
                  <select
                    value={novoAfast.categoria}
                    onChange={(e) =>
                      setNovoAfast((p) => ({ ...p, categoria: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 bg-slate-50"
                  >
                    <option value="ENF">Enfermeiro</option>
                    <option value="TEC">Técnico / Auxiliar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Turno Afetado
                  </label>
                  <select
                    value={novoAfast.turno}
                    onChange={(e) =>
                      setNovoAfast((p) => ({ ...p, turno: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 bg-slate-50"
                  >
                    <option value="MANHA">Manhã (6h)</option>
                    <option value="TARDE">Tarde (6h)</option>
                    <option value="DIURNO12">Diurno 12h (Manhã + Tarde)</option>
                    <option value="NOITE">Noite 12h</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Motivo / Tipo
                  </label>
                  <select
                    value={novoAfast.tipo}
                    onChange={(e) =>
                      setNovoAfast((p) => ({ ...p, tipo: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 bg-slate-50"
                  >
                    {TIPOS_AFASTAMENTO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Qtd. Profissionais
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={novoAfast.quantidade}
                    onChange={(e) =>
                      setNovoAfast((p) => ({
                        ...p,
                        quantidade: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-700 bg-slate-50 text-center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Início
                    </label>
                    <input
                      type="date"
                      value={novoAfast.inicio}
                      onChange={(e) =>
                        setNovoAfast((p) => ({ ...p, inicio: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-[11px] font-bold text-slate-700 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Retorno Previsto
                    </label>
                    <input
                      type="date"
                      value={novoAfast.retornoPrevisto}
                      onChange={(e) =>
                        setNovoAfast((p) => ({ ...p, retornoPrevisto: e.target.value }))
                      }
                      className="w-full border border-slate-300 rounded-lg p-2 text-[11px] font-bold text-slate-700 bg-slate-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-indigo-700 transition-colors text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus size={15} /> Projetar Afastamento
                </button>
              </form>
            )}

            {/* Lista de Afastamentos Vigentes/Futuros */}
            {afastamentos.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Nenhum afastamento ou atestado prolongado cadastrado para projeção nesta unidade.
              </p>
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Turno</th>
                      <th className="p-3">Motivo</th>
                      <th className="p-3 text-center">Quantidade</th>
                      <th className="p-3">Período Projetado</th>
                      <th className="p-3">Registrado por</th>
                      {!isReadOnly && <th className="p-3 text-right print:hidden">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {afastamentos.map((a) => {
                      const ativoNaData =
                        a.inicio <= dataSelecionada && a.retorno_previsto >= dataSelecionada;
                      return (
                        <tr
                          key={a.id}
                          className={ativoNaData ? 'bg-amber-50/40' : 'hover:bg-slate-50'}
                        >
                          <td className="p-3 font-bold text-slate-700">
                            {a.categoria === 'ENF' ? 'Enfermeiro' : 'Técnico / Auxiliar'}
                          </td>
                          <td className="p-3 font-semibold text-indigo-600">{a.turno}</td>
                          <td className="p-3 font-medium text-slate-700">{a.tipo}</td>
                          <td className="p-3 text-center font-black text-rose-600">
                            {a.quantidade}
                          </td>
                          <td className="p-3 font-semibold text-slate-600">
                            {formatarDataBR(a.inicio)} até {formatarDataBR(a.retorno_previsto)}
                            {ativoNaData && (
                              <span className="ml-2 text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                                Em curso
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-slate-500">{a.responsavel_nome || '—'}</td>
                          {!isReadOnly && (
                            <td className="p-3 text-right print:hidden">
                              <button
                                type="button"
                                onClick={() => handleExcluirAfastamento(a.id)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                                title="Encerrar / remover projeção"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── BLOCO 3: GESTÃO DE LEITOS + ALERTAS DA UNIDADE ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GestaoLeitosCard
              leitosTotais={leitosTotaisSetor}
              ocupados={ocupados}
              bloqueados={bloqueados}
              onChangeOcupados={setOcupados}
              onChangeBloqueados={setBloqueados}
              isReadOnly={isReadOnly}
            />

            <AlertasUnidadeCard
              alertas={alertas}
              onNovoAlerta={abrirNovoAlerta}
              onEditarAlerta={abrirEditarAlerta}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Rodapé de Ações */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>

            {!isReadOnly ? (
              <button
                type="button"
                disabled={salvando}
                onClick={handleSalvarRundown}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-indigo-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Send size={18} />
                {salvando ? 'Salvando...' : 'Salvar e Finalizar Rundown'}
              </button>
            ) : (
              <div className="bg-slate-100 border border-slate-200 text-slate-600 font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 text-sm">
                <Info size={16} /> Modo Consulta: Plantão Encerrado
              </div>
            )}
          </div>
        </div>
      )}

      {modalAlerta && (
        <ModalAlerta
          tipoDef={modalAlerta.tipoDef}
          dadosExistentes={modalAlerta.dadosExistentes}
          onSalvar={salvarAlerta}
          onRemover={removerAlerta}
          onCancelar={() => setModalAlerta(null)}
        />
      )}
    </div>
  );
}
