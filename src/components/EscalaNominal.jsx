import React, { useState, useEffect, Fragment } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Edit2, Save, AlertTriangle, Trash2, X, ThumbsUp, ThumbsDown, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';

// ── Mínimo de cobertura por turno / dia (mock configurável) ──────────────────
const MINIMO_DIA = 4;

// ── Definição completa de códigos ─────────────────────────────────────────────
const TIPOS_PLANTAO = [
  { code: 'D',   hours: 12, label: 'Diurno (12h)',   color: 'bg-indigo-100 text-indigo-800',   row: 1 },
  { code: 'N',   hours: 12, label: 'Noturno (12h)',  color: 'bg-sky-100 text-sky-800',         row: 1 },
  { code: 'M',   hours: 6,  label: 'Manhã (6h)',     color: 'bg-blue-50 text-blue-700',        row: 1 },
  { code: 'T',   hours: 6,  label: 'Tarde (6h)',     color: 'bg-cyan-50 text-cyan-700',        row: 1 },
  { code: 'F',   hours: 0,  label: 'Folga',          color: 'bg-emerald-50 text-emerald-600',  row: 1 },
  { code: 'DSR', hours: 0,  label: 'DSR',            color: 'bg-emerald-100 text-emerald-700', row: 1 },
  { code: '-',   hours: 0,  label: 'Descanso', color: 'bg-slate-100 text-slate-500',      row: 1 },
  { code: 'PRD', hours: 0,  label: 'PR Diurno',            color: 'bg-indigo-200 text-indigo-900',    row: 2 },
  { code: 'PRN', hours: 0,  label: 'PR Noturno',            color: 'bg-sky-200 text-sky-900',         row: 2 },
  { code: 'FE',  hours: 0,  label: 'Férias',         color: 'bg-amber-100 text-amber-700',      row: 0 },
  { code: 'Att', hours: 0,  label: 'Atestado',       color: 'bg-rose-100 text-rose-700',        row: 0 },
  { code: 'Lic', hours: 0,  label: 'Licença',        color: 'bg-purple-100 text-purple-700',    row: 0 },
  { code: 'TR-F',hours: 0,  label: 'Troca/Folga',    color: 'bg-pink-100 text-pink-800',        row: 0 },
  { code: 'TR-E',hours: 0,  label: 'Troca/Extra',    color: 'bg-teal-100 text-teal-800',        row: 2 },
  { code: '',    hours: 0,  label: 'Apagar',         color: 'bg-white text-slate-400 border border-slate-300', row: 'all' },
];

const TIPOS_L1 = TIPOS_PLANTAO.filter(t => t.row === 1 || t.row === 'all');
const TIPOS_L2 = TIPOS_PLANTAO.filter(t => t.row === 2 || t.row === 'all');

function shiftColor(code) {
  return TIPOS_PLANTAO.find(t => t.code === code)?.color || 'bg-white text-slate-300';
}


export default function EscalaNominal({ colaboradores, setColaboradores, escalaNominal, setEscalaNominal, ausencias, unidadeLogada }) {
  const { user, pedidosFolga, setPedidosFolga } = useAuth();
  const nomeMeses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const dataAtual = new Date();
  const mesAtual  = dataAtual.getMonth();
  const anoAtual  = dataAtual.getFullYear();
  const nomesTurnos = { 'M': 'Manhã', 'T': 'Tarde', 'N': 'Noturno', 'D': 'Diurno 12h', 'SN': 'Plantão Noturno' };

  const [mesSelecionado,     setMesSelecionado]     = useState(mesAtual);
  const [anoSelecionado,     setAnoSelecionado]     = useState(anoAtual);
  const [filtroTurnoEscala,  setFiltroTurnoEscala]  = useState("Todos");
  const [filtroCategoria,    setFiltroCategoria]    = useState("Todas");
  const [ferramentaL1,       setFerramentaL1]       = useState('D');
  const [ferramentaL2,       setFerramentaL2]       = useState('PRD');
  const [showSaveModal,      setShowSaveModal]      = useState(false);
  const [saveConformity,     setSaveConformity]     = useState(true);
  const [inconformes,        setInconformes]        = useState([]);
  const [statusEscala, setStatusEscala] = useState('Rascunho');
  const [statusAlvoSave, setStatusAlvoSave] = useState('Rascunho');
  const [ultimaAlteracaoEscala, setUltimaAlteracaoEscala] = useState(localStorage.getItem('ultimaAlteracaoEscala') || null);
  const [historicoEscalas,   setHistoricoEscalas]   = useState(() => JSON.parse(localStorage.getItem('historicoEscalas')) || []);
  const [modalTroca,         setModalTroca]         = useState(false);
  const [trocaForm,          setTrocaForm]          = useState({ matricula: '', diaOrigem: '', diaDestino: '', motivo: '' });
  const [modalFerias,        setModalFerias]        = useState(false);
  const [feriasForm,         setFeriasForm]         = useState({ matricula: '', dataInicio: '', dias: '' });
  const [chConfig, setChConfig] = useState(() => JSON.parse(localStorage.getItem('chConfig')) || { HC30_PAR: 144, HC30_IMPAR: 132, HC35_PAR: 168, HC35_IMPAR: 168, HC40_PAR: 192, HC40_IMPAR: 192, FFM40_PAR: 192, FFM40_IMPAR: 192 });
  const [regraMesGlob, setRegraMesGlob] = useState("PAR");
  const [showChPanel, setShowChPanel] = useState(false);
  const [folgaActionModal, setFolgaActionModal] = useState(null);
  const [modalLimparEscala, setModalLimparEscala] = useState(false);
  const [matriculaLimpar, setMatriculaLimpar] = useState("");

  const diasNoMes = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const dow = d => new Date(anoSelecionado, mesSelecionado, d).getDay();
  const dowAbrev = ["D","S","T","Q","Q","S","S"];
  const [versaoTabela, setVersaoTabela] = useState(0);
  // Linha 1: base schedule  |  Linha 2: extras / absences
  const [gridL1, setGridL1] = useState({});
  const [gridL2, setGridL2] = useState({});

  // Load grids from Supabase when month/year/sector changes
  useEffect(() => {
    if (!unidadeLogada) return;
    const mes_ano = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}`;
    async function carregarEscala() {
      try {
        const { data, error } = await supabase
          .from('escalas_mensais')
          .select('*')
          .eq('mes_ano', mes_ano)
          .eq('setor', unidadeLogada);

        if (error) { console.error('Erro ao carregar escala:', error); return; }
        if (data && data.length > 0) {
          const novoGridL1 = {};
          const novoGridL2 = {};
          setStatusEscala(data[0].status_escala || 'Rascunho');
          data.forEach(row => {
            const key = String(row.matricula_colaborador);
            novoGridL1[key] = row.grid1 || row.dias_escala || {};
            novoGridL2[key] = row.grid2 || {};
          });
          setGridL1(novoGridL1);
          setGridL2(novoGridL2);
        } else {
          setGridL1({});
          setGridL2({});
        }
      } catch (err) {
        console.error('Exceção ao carregar escala:', err);
      }
    }
    carregarEscala();
  }, [mesSelecionado, anoSelecionado, unidadeLogada]);

  const historicoFiltrado = historicoEscalas.filter(h => h.mes === mesSelecionado && h.ano === anoSelecionado && h.setor === unidadeLogada);
  const escalaOficial = historicoFiltrado.length > 0 ? historicoFiltrado[historicoFiltrado.length - 1] : null;

  // L2 Auto Injection for Afastamentos
  useEffect(() => {
    setGridL2(prev => {
      let changed = false;
      const novagrid = { ...prev };
      
      colaboradores.forEach(c => {
        const mat = String(c.matricula);
        if (c.motivoAfastamento && c.dataInicioAfastamento) {
          if (!novagrid[mat]) novagrid[mat] = {};
          
          const [y, m, day] = c.dataInicioAfastamento.split('-');
          const parseIntY = parseInt(y, 10), parseIntM = parseInt(m, 10), parseIntD = parseInt(day, 10);
          const code = c.motivoAfastamento.split('-')[0];
          const qtdDias = parseInt(c.quantidadeDiasAfastamento, 10) || 1;

          const inicioAfast = new Date(parseIntY, parseIntM - 1, parseIntD);
          const fimAfast = new Date(parseIntY, parseIntM - 1, parseIntD + qtdDias - 1);

          dias.forEach(d => {
            const diaAtual = new Date(anoSelecionado, mesSelecionado, d);
            if (diaAtual >= inicioAfast && diaAtual <= fimAfast) {
              if (novagrid[mat][d] !== code) {
                novagrid[mat][d] = code;
                changed = true;
              }
            }
          });
        }
      });
      return changed ? novagrid : prev;
    });
  }, [colaboradores, mesSelecionado, anoSelecionado, diasNoMes]);

  let colabsFiltrados = colaboradores || [];

  if (unidadeLogada && unidadeLogada !== 'Global') {
    // Função interna para remover acentos, espaços e padronizar para maiúsculas
    const padronizarTexto = (valor) => 
      (valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase();

    const termoBusca = padronizarTexto(unidadeLogada);

    colabsFiltrados = colabsFiltrados.filter(c => {
      const setorBase = padronizarTexto(c.setor);
      const alocacaoBase = padronizarTexto(c.unidade_alocacao);
      
      // Retorna verdadeiro se o termo de busca bater com qualquer uma das colunas
      return setorBase === termoBusca || alocacaoBase === termoBusca;
    });
  }
  if (filtroTurnoEscala !== "Todos") {
    colabsFiltrados = colabsFiltrados.filter(c => {
      const t = (c.turno_padrao || '').toUpperCase();
      if (filtroTurnoEscala === "Manhã"   && (t === "M" || t === "D")) return true;
      if (filtroTurnoEscala === "Tarde"   && (t === "T" || t === "D")) return true;
      if (filtroTurnoEscala === "Noturno" && (t === "N" || t === "SN")) return true;
      return false;
    });
  }

  if (filtroCategoria !== "Todas") {
    colabsFiltrados = colabsFiltrados.filter(c => {
      const cat = c.categoria_profissional || c.cargo || '';
      return cat === filtroCategoria;
    });
  }
  colabsFiltrados.sort((a, b) => {
    const cargoA = a.categoria_profissional || a.cargo || '';
    const cargoB = b.categoria_profissional || b.cargo || '';
    const eA = cargoA.includes("Enferm"), eB = cargoB.includes("Enferm");
    if (eA && !eB) return -1; if (!eA && eB) return 1;
    const nomeA = a.nome_completo || a.nome || '';
    const nomeB = b.nome_completo || b.nome || '';
    return nomeA.localeCompare(nomeB);
  });

  function isDateInLeave(d, m, y, startDateStr, days) {
    if (!startDateStr || !days) return false;
    const [sY, sM, sD] = startDateStr.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD);
    const current = new Date(y, m, d);
    const end = new Date(sY, sM - 1, sD);
    end.setDate(end.getDate() + parseInt(days) - 1);
    return current >= start && current <= end;
  }

  // ── Cell click handlers ──────────────────────────────────────────────────
  function handleCellL1(colab, dia) {
    const matricula = String(colab.matricula);
    setGridL1(prev => {
      const ng = { ...prev }; 
      const colabGrid = { ...(ng[matricula] || {}) };
      
      const hasAny = Object.values(colabGrid).some(v => v !== null && v !== undefined && v !== '');

      let turnoPreencher = ferramentaL1;
      if (!hasAny) {
         const tPadrao = (colab.turno_padrao || colab.turno || '').toUpperCase();
         if (tPadrao.includes('MANH') || tPadrao === 'M') turnoPreencher = 'M';
         else if (tPadrao.includes('TARD') || tPadrao === 'T') turnoPreencher = 'T';
         else if (tPadrao.includes('NOTURNO') || tPadrao === 'N' || tPadrao === 'SN') turnoPreencher = 'N';
         else if (tPadrao.includes('DIURNO') || tPadrao === 'D') turnoPreencher = 'D';
      }

      if (!hasAny && turnoPreencher && !['F','-','DSR',''].includes(turnoPreencher)) {
         colabGrid[dia] = turnoPreencher;
         const is12 = turnoPreencher === 'D' || turnoPreencher === 'N';
         dias.forEach(d => {
            if (d === dia) return;
            if (is12) {
               colabGrid[d] = (Math.abs(d - dia) % 2 === 0) ? turnoPreencher : '-';
            } else {
               if (dow(d) === 6) {
                   colabGrid[d] = 'F';
               } else if (dow(d) === 0) {
                   colabGrid[d] = 'DSR';
               } else {
                   colabGrid[d] = turnoPreencher;
               }
            }
         });
      } else {
         colabGrid[dia] = ferramentaL1;
      }
      
      ng[matricula] = colabGrid;
      return ng;
    });
    setVersaoTabela(prev => prev + 1);
  }

  function handleCellL2(matriculaRaw, dia) {
    const matricula = String(matriculaRaw);
    setGridL2(prev => {
      const ng = { ...prev }; if (!ng[matricula]) ng[matricula] = {};
      const code = ferramentaL2;
      ng[matricula][dia] = code;

      if (code === 'PRD' || code === 'PRN') {
        setGridL1(prevL1 => {
          const nl1 = { ...prevL1 };
          if (!nl1[matricula]) nl1[matricula] = {};
          if (['D', 'M', 'T', 'N'].includes(nl1[matricula][dia])) {
            nl1[matricula][dia] = 'F';
          }
          return nl1;
        });
      }

      return ng;
    });
    setVersaoTabela(prev => prev + 1);
  }

  function limparLinha(matricula) {
    setMatriculaLimpar(String(matricula));
    setModalLimparEscala(true);
  }

  async function gerarEscalaPreditiva() {
    if (!window.confirm("Isso irá preencher a grade atual com a sugestão automática baseada no mês passado. Deseja continuar?")) return;
    
    const mesAnt = mesSelecionado === 0 ? 11 : mesSelecionado - 1;
    const anoAnt = mesSelecionado === 0 ? anoSelecionado - 1 : anoSelecionado;
    const queryMesAno = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}`;
    const ultDiaMesAnt = new Date(anoAnt, mesAnt + 1, 0).getDate();

    try {
      const { data, error } = await supabase
        .from('escalas_mensais')
        .select('*')
        .eq('mes_ano', queryMesAno)
        .eq('setor', unidadeLogada);

      if (error) throw error;

      const escalaAntiga = {};
      if (data) data.forEach(r => escalaAntiga[String(r.matricula_colaborador)] = r.dias_escala || r.grid1 || {});

      const pedidosPendentes = pedidosFolga?.filter(p => p.mes === mesSelecionado && p.ano === anoSelecionado && p.status === 'Pendente') || [];
      if (pedidosPendentes.length > 0) {
         alert(`Atenção: Existem ${pedidosPendentes.length} pedido(s) de folga pendente(s) neste mês. O sistema já alocou 'F' nestes dias, mas você ainda precisará aprovar clicando na bolinha amarela na grade.`);
      }

      setGridL1(prev => {
        const ng = { ...prev };
        colabsFiltrados.forEach(c => {
          const mat = String(c.matricula);
          const turno = (c.turno_padrao || c.turno || '').toUpperCase();
          ng[mat] = ng[mat] || {};

          // Nova verificação robusta que aceita as nomenclaturas do hospital
          const is12h = turno.includes('12') || turno.includes('NOTURNO') || turno.includes('DIURNO') || turno === 'N' || turno === 'D' || turno === 'SN';
          const isRotina = turno.includes('MANH') || turno.includes('TARD') || turno === 'M' || turno === 'T';

          if (is12h) {
             const sigla = (turno.includes('NOTURNO') || turno === 'N' || turno === 'SN') ? 'N' : 'D';
             // Descobre se ele trabalhou no último dia do mês anterior para intercalar corretamente
             const trabUltimoDia = escalaAntiga[mat] && escalaAntiga[mat][ultDiaMesAnt] === sigla;
             
             dias.forEach(d => {
                const temFolga = pedidosFolga?.find(p => String(p.colabId) === mat && p.mes === mesSelecionado && p.ano === anoSelecionado && p.dia === d && (p.status === 'Pendente' || p.status === 'Aprovado'));
                if (temFolga) {
                   ng[mat][d] = 'F';
                } else {
                   // Se trabalhou no último dia do mês anterior, trabalha nos dias PARES deste mês
                   ng[mat][d] = trabUltimoDia ? (d % 2 === 0 ? sigla : '-') : (d % 2 !== 0 ? sigla : '-');
                }
             });
          } else if (isRotina) {
             const sigla = (turno.includes('MANH') || turno === 'M') ? 'M' : 'T';
             dias.forEach(d => {
                const temFolga = pedidosFolga?.find(p => String(p.colabId) === mat && p.mes === mesSelecionado && p.ano === anoSelecionado && p.dia === d && (p.status === 'Pendente' || p.status === 'Aprovado'));
                if (temFolga) {
                   ng[mat][d] = 'F';
                } else if (dow(d) === 6) {
                   ng[mat][d] = 'F';
                } else if (dow(d) === 0) {
                   ng[mat][d] = 'DSR';
                } else {
                   ng[mat][d] = sigla;
                }
             });
          }
        });
        return ng;
      });
      setVersaoTabela(p => p + 1);
      if (pedidosPendentes.length === 0) {
         alert("✨ Escala sugerida com sucesso! Por favor, revise as marcações.");
      }
    } catch (err) {
      console.error(err);
      alert("Não foi possível buscar os dados do mês anterior para gerar a previsão.");
    }
  }

  // ── Hours calculation ────────────────────────────────────────────────────
  function calcHoras(matriculaRaw) {
    const matricula = String(matriculaRaw);
    const row = gridL1[matricula] || {}; let total = 0;
    Object.values(row).forEach(val => { const s = TIPOS_PLANTAO.find(t => t.code === val); if (s) total += s.hours; });
    return total;
  }

  // ── Daily coverage totals ────────────────────────────────────────────────
  function coberturaDaily(dia) {
    let manha = 0, tarde = 0, noite = 0;
    colabsFiltrados.forEach(c => {
      const mat = String(c.matricula);
      const v1 = gridL1[mat]?.[dia];
      const v2 = gridL2[mat]?.[dia];
      const ausente = v2 && !['PRD','PRN','TR-E'].includes(v2);
      if (!ausente) {
        if (v1 === 'M' || v1 === 'D' || v1 === 'PRD' || v2 === 'PRD' || v2 === 'TR-E') manha++;
        if (v1 === 'T' || v1 === 'D' || v1 === 'PRD' || v2 === 'PRD' || v2 === 'TR-E') tarde++;
        if (v1 === 'N' || v1 === 'PRN' || v2 === 'PRN') noite++;
      }
    });
    const efetiva = Math.max(manha, tarde, noite);
    return { manha, tarde, noite, efetiva };
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function salvarEscala(novoStatus = 'Rascunho') {
    setStatusAlvoSave(novoStatus);
    const ic = colabsFiltrados.map(c => {
      const feitas = calcHoras(c.matricula), meta = c.cargaHoraria || 0;
      return { ...c, feitas, meta, diff: feitas - meta };
    }).filter(c => c.diff !== 0);
    setSaveConformity(ic.length === 0);
    setInconformes(ic);
    setShowSaveModal(true);
  }

  async function efetivarSalvamento() {
    const timestamp = new Date().toLocaleString('pt-BR');
    const author = user?.nome || user?.role || 'Sistema';
    
    const mes_ano = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}`;
    const listaUpsert = colabsFiltrados.map(c => {
       const mat = String(c.matricula);
       return {
         mes_ano,
         setor: unidadeLogada,
         matricula_colaborador: String(mat),
         dias_escala: gridL1[mat] || {}, // Mantido por retrocompatibilidade
         grid1: gridL1[mat] || {},       // Oficial L1
         grid2: gridL2[mat] || {},       // Oficial L2 (Férias, Afastamentos, Extras)
         status_escala: statusAlvoSave,
         ...(statusAlvoSave === 'em aprovação' ? { finalizado_por: author, finalizado_em: timestamp } : {}),
         ...(statusAlvoSave === 'aprovada' ? { aprovado_por: author, aprovado_em: timestamp } : {}),
         updated_at: timestamp,
         author: author
       };
    });

    try {
      const { error } = await supabase
        .from('escalas_mensais')
        .upsert(listaUpsert, { onConflict: 'mes_ano,setor,matricula_colaborador' });
        
      if (error) {
        console.error("Erro ao salvar escala no Supabase:", error);
        alert("Ocorreu um erro ao salvar a escala no banco de dados.");
        setShowSaveModal(false);
        return;
      }
      
      const novoSnapshot = {
        id: Date.now(),
        dataHora: timestamp,
        autor: author,
        mes: mesSelecionado,
        ano: anoSelecionado,
        setor: unidadeLogada,
        grid1: gridL1,
        grid2: gridL2
      };
      setHistoricoEscalas([...historicoEscalas, novoSnapshot]);
      setUltimaAlteracaoEscala(timestamp);
      setStatusEscala(statusAlvoSave);
      alert(`✅ Escala de ${String(mesSelecionado + 1).padStart(2,'0')}/${anoSelecionado} salva como ${statusAlvoSave} no banco de dados!`);
      
    } catch (err) {
       console.error("Exceção ao salvar:", err);
       alert("❌ Erro inesperado ao salvar: " + err.message);
    }

    setShowSaveModal(false);
    
    setTimeout(() => {
       if (window.confirm("Deseja imprimir a escala?")) {
          window.print();
       }
    }, 300);
  }

  function atualizaCargaHoraria(matriculaRaw, valor) {
    const mat = String(matriculaRaw);
    setColaboradores(prev => prev.map(c => String(c.matricula) === mat ? { ...c, cargaHoraria: parseInt(valor) || 0 } : c));
  }

  function handleSalvarTroca() {
    const { matricula, diaOrigem, diaDestino, motivo } = trocaForm;
    const matStr = String(matricula);
    const dO = parseInt(diaOrigem, 10);
    const dD = parseInt(diaDestino, 10);

    if (!matStr || !dO || !dD || !motivo) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    if (dO === dD) {
      alert('Os dias de origem e destino devem ser diferentes.');
      return;
    }
    if (dO < 1 || dO > diasNoMes || dD < 1 || dD > diasNoMes) {
      alert(`Os dias devem estar entre 1 e ${diasNoMes}.`);
      return;
    }

    setGridL1(prev => {
      const escalaColab = { ...(prev[matStr] || {}) };
      const turnoOrigem  = escalaColab[dO]  || '';
      const turnoDestino = escalaColab[dD] || '';
      return {
        ...prev,
        [matStr]: {
          ...escalaColab,
          [dO]:  turnoDestino,
          [dD]: turnoOrigem,
        }
      };
    });

    alert(`✅ Turno do dia ${dO} movido para o dia ${dD} (motivo: ${motivo}).`);
    setModalTroca(false);
    setTrocaForm({ matricula: '', diaOrigem: '', diaDestino: '', motivo: '' });
    setVersaoTabela(prev => prev + 1);
  }

  function handleSalvarFerias() {
    if (!feriasForm.matricula || !feriasForm.dataInicio || !feriasForm.dias) return;
    const matStr = String(feriasForm.matricula);
    const [y, mm, d] = feriasForm.dataInicio.split('-');
    const diasTotal = parseInt(feriasForm.dias, 10);
    const startObj = new Date(parseInt(y, 10), parseInt(mm, 10) - 1, parseInt(d, 10));
    
    setGridL2(prev => {
      const ng = { ...prev };
      if (!ng[matStr]) ng[matStr] = {};
      
      for(let i = 0; i < diasTotal; i++) {
        const dCursor = new Date(startObj);
        dCursor.setDate(dCursor.getDate() + i);
        if (dCursor.getMonth() === mesSelecionado && dCursor.getFullYear() === anoSelecionado) {
           ng[matStr][dCursor.getDate()] = 'FE';
        }
      }
      return ng;
    });

    setColaboradores(prev => prev.map(c => 
      String(c.matricula) === matStr ? { ...c, motivoAfastamento: 'FE', dataInicioAfastamento: feriasForm.dataInicio, quantidadeDiasAfastamento: diasTotal } : c
    ));

    alert(`Férias de ${diasTotal} dias projetadas com sucesso no rascunho. O funcionário assumiu a Tag (Afastado) com sucesso!`);
    setVersaoTabela(prev => prev + 1);
    setModalFerias(false);
    setFeriasForm({ matricula: '', dataInicio: '', dias: '' });
  }

  function aplicarCalculoChMensal() {
    localStorage.setItem('chConfig', JSON.stringify(chConfig));
    setColaboradores(prev => prev.map(c => {
      if (c.unidade_alocacao !== unidadeLogada && c.setor !== unidadeLogada) return c;
      let base = '';
      const contratoStr = c.tipo_contrato || c.contrato || '';
      if (contratoStr.includes('HC30')) base = 'HC30';
      else if (contratoStr.includes('HC35')) base = 'HC35';
      else if (contratoStr.includes('HC40')) base = 'HC40';
      else if (contratoStr.includes('FFM')) base = 'FFM40';

      if (base) {
        let regra = regraMesGlob;
        const turnoStr = c.turno_padrao || c.turno || '';
        if (turnoStr.includes('12')) {
           const mat = String(c.matricula);
           const d1 = gridL1[mat]?.[1];
           const d2 = gridL1[mat]?.[2];
           if (d1 && !['-','F','DSR'].includes(d1)) regra = 'IMPAR';
           else if (d2 && !['-','F','DSR'].includes(d2)) regra = 'PAR';
        }
        const novaCarga = chConfig[`${base}_${regra}`];
        if (novaCarga) return { ...c, cargaHoraria: novaCarga };
      }
      return c;
    }));
    alert("Carga Horária distribuída! (Grelhas de 12h foram analisadas automaticamente: plantão dia 1 = ÍMPAR).");
  }



  if (!unidadeLogada || unidadeLogada === 'Global') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border text-center mt-6 animate-fade-in">
        <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Selecione uma Unidade Específica</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          Para criar ou aprovar a Escala Nominal, você precisa selecionar um setor específico no filtro acima. A visão "Global" não permite edição direta.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 impressao-escala">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-5 gap-4 hide-on-print">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" /> Escala Nominal
            <span className="text-sm font-normal text-slate-400 ml-1">— {unidadeLogada}</span>
          </h2>
          {ultimaAlteracaoEscala && <p className="text-sm font-medium text-slate-500 mt-1">Última alteração: {ultimaAlteracaoEscala}</p>}
          {historicoFiltrado.length > 0 && (
            <select className="mt-2 text-[10px] bg-slate-100 border border-slate-200 rounded outline-none p-1 text-slate-600 font-bold max-w-xs" defaultValue="">
              <option value="" disabled>Ver Histórico de Versões Publicadas</option>
              {historicoFiltrado.slice().reverse().map((h, i) => (
                 <option key={h.id} value={h.id}>V{historicoFiltrado.length - i} — {h.dataHora} por {h.autor}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => setShowChPanel(!showChPanel)} className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-100 flex items-center gap-2">⚙️ CH Mensal</button>
          <div className="flex items-center gap-2">
            <button onClick={() => setMesSelecionado(p => p === 0 ? 11 : p - 1)} className="p-1.5 border bg-white rounded-lg"><ChevronLeft size={15}/></button>
            <span className="text-center w-36 font-bold text-indigo-700 text-sm">{nomeMeses[mesSelecionado]} {anoSelecionado}</span>
            <button onClick={() => setMesSelecionado(p => p === 11 ? 0 : p + 1)} className="p-1.5 border bg-white rounded-lg"><ChevronRight size={15}/></button>
          </div>
          <div className="border-l border-slate-300 pl-3 flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase">Turno:</label>
            <select className="bg-white border border-slate-300 p-1.5 rounded-lg text-xs font-bold text-indigo-700 outline-none"
              value={filtroTurnoEscala} onChange={e => setFiltroTurnoEscala(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noturno">Noturno</option>
            </select>
            <label className="text-xs font-bold text-slate-600 uppercase ml-2">Categoria:</label>
            <select className="bg-white border border-slate-300 p-1.5 rounded-lg text-xs font-bold text-indigo-700 outline-none"
              value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="Todas">Todas</option>
              <option value="Enfermeiro">Enfermeiro</option>
              <option value="Técnico de Enfermagem">Técnico de Enfermagem</option>
              <option value="Auxiliar de Enfermagem">Auxiliar de Enfermagem</option>
            </select>
          </div>
        </div>
      </div>

      {showChPanel && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl mb-5 hide-on-print animate-fade-in">
          <div className="flex justify-between items-center border-b border-indigo-100 pb-2 mb-3">
             <h3 className="font-bold text-indigo-800 text-sm flex items-center gap-2">Configurar CH Alvo do Mês</h3>
             <div className="flex items-center gap-2 text-xs font-bold text-indigo-800">
               Regra Principal (Rotinas):
               <select className="p-1 border border-indigo-200 rounded outline-none" value={regraMesGlob} onChange={e => setRegraMesGlob(e.target.value)}>
                 <option value="PAR">Mês PAR</option>
                 <option value="IMPAR">Mês ÍMPAR</option>
               </select>
             </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {['HC30', 'HC35', 'HC40', 'FFM40'].map(cat => (
              <div key={cat} className="bg-white p-2 rounded-lg border border-indigo-100 shadow-sm flex flex-col gap-1 text-xs">
                 <span className="font-black text-slate-700 text-center">{cat}</span>
                 <div className="flex items-center justify-between"><label className="text-slate-500">Par:</label><input type="number" className="w-16 border rounded p-1 text-center font-bold outline-none focus:border-indigo-400" value={chConfig[`${cat}_PAR`]} onChange={e => setChConfig({...chConfig, [`${cat}_PAR`]: parseInt(e.target.value)||0})} /></div>
                 <div className="flex items-center justify-between"><label className="text-slate-500">Ímpar:</label><input type="number" className="w-16 border rounded p-1 text-center font-bold outline-none focus:border-indigo-400" value={chConfig[`${cat}_IMPAR`]} onChange={e => setChConfig({...chConfig, [`${cat}_IMPAR`]: parseInt(e.target.value)||0})} /></div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-indigo-600 mb-3 italic">Nota: Para plantões 12x36, o sistema lê automaticamente se o colaborador iniciou no dia 1 e sobrepõe a regra selecionada.</p>
          <button onClick={aplicarCalculoChMensal} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 active:scale-[0.99] transition-all">Calcular e Preencher CH na Tabela</button>
        </div>
      )}

      <div className="hidden print:block text-center mb-6">
         <h2 className="text-2xl font-black text-slate-900 border-b pb-2 mb-2">Escala Nominal de Enfermagem - {unidadeLogada}</h2>
         <p className="text-sm font-bold text-slate-600">{nomeMeses[mesSelecionado]} {anoSelecionado} | Base de Turno: {filtroTurnoEscala}</p>
         {ultimaAlteracaoEscala && <p className="text-xs text-slate-500 mt-1">Última alteração: {ultimaAlteracaoEscala}</p>}
      </div>

      <div className="flex flex-col gap-2 mb-4 hide-on-print">
        <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Edit2 size={12}/> Linha 1 — Base:
          </span>
          {TIPOS_L1.map(tp => (
            <button key={tp.code} onClick={() => setFerramentaL1(tp.code)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${ferramentaL1 === tp.code ? 'bg-indigo-600 text-white border-indigo-700 shadow scale-105' : `${tp.color} hover:opacity-80`}`}>
              {tp.code || '✕'} <span className="hidden md:inline">— {tp.label}</span>
            </button>
          ))}
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Edit2 size={12}/> Linha 2 — Extras:
          </span>
          {TIPOS_L2.map(tp => (
            <button key={tp.code} onClick={() => setFerramentaL2(tp.code)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${ferramentaL2 === tp.code ? 'bg-slate-700 text-white border-slate-800 shadow scale-105' : `${tp.color} hover:opacity-80`}`}>
              {tp.code || '✕'} <span className="hidden md:inline">— {tp.label}</span>
            </button>
          ))}
          <div className="ml-auto flex flex-nowrap items-center gap-2">
            <button onClick={gerarEscalaPreditiva} className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-colors flex items-center gap-1">✨ Sugerir Escala</button>
            <button onClick={() => setModalLimparEscala(true)} className="px-3 py-1 bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 hover:bg-rose-200 transition-colors flex items-center gap-1">🧹 Limpar Escala</button>
            <button onClick={() => setModalFerias(true)} className="px-3 py-1 bg-amber-100 text-amber-700 font-bold text-[11px] rounded-lg border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1">🏝️ Lançar Férias</button>
            <button onClick={() => setModalTroca(true)} className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors flex items-center gap-1">🔄 Registrar Troca</button>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 hide-on-print">
        <span className="text-xs text-slate-500 font-medium">Mínimo de cobertura por turno/dia:</span>
        <span className="bg-red-50 text-red-700 font-black text-xs px-2 py-0.5 rounded border border-red-200">{MINIMO_DIA} profissionais</span>
        <span className="text-[10px] text-slate-400 italic">— dias abaixo ficam marcados a vermelho</span>
      </div>

      <div className="overflow-auto max-h-[800px] rounded-xl border border-slate-300 bg-slate-50 shadow-inner">
        <table key={versaoTabela} className="w-full text-left border-collapse text-xs min-w-[max-content] table-fixed">
          <thead className="sticky top-0 z-40 bg-slate-100 outline outline-1 outline-slate-200">
            <tr className="text-slate-600 font-semibold h-11">
              <th className="p-2 w-[200px] min-w-[200px] sticky left-0 z-50 bg-slate-100 border-r border-slate-300">Colaborador</th>
              <th className="p-2 w-[60px] min-w-[60px] sticky left-[200px] z-50 bg-slate-100 border-r border-slate-300 text-center text-[10px] uppercase">CH<br/>Mensal</th>
              <th className="p-2 w-[60px] min-w-[60px] sticky left-[260px] z-50 bg-slate-100 border-r border-slate-300 text-center text-[10px] uppercase">Horas<br/>Feitas</th>
              <th className="p-2 w-[55px] min-w-[55px] sticky left-[320px] z-50 bg-slate-100 border-r border-slate-300 text-center text-[10px] uppercase">Total<br/>PR</th>
              {dias.map(d => {
                const fds = dow(d) === 0 || dow(d) === 6;
                return (
                  <th key={d} className={`p-1 w-[38px] min-w-[38px] text-center border-r border-slate-200 ${fds ? 'bg-rose-100 text-rose-800' : ''}`}>
                    <div className="font-bold text-[11px]">{d}</div>
                    <div className="text-[9px] uppercase">{dowAbrev[dow(d)]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          
          <tbody className="bg-white">
            {colabsFiltrados.map((c, index) => {
              const mat = String(c.matricula);
              const horas  = calcHoras(mat);
              const meta   = c.cargaHoraria || 0;
              const excede = horas > meta;
              const base   = excede ? 'bg-yellow-50' : 'bg-white';
              const hover1 = excede ? 'hover:bg-yellow-100' : 'hover:bg-slate-50';

              return (
                <Fragment key={`colab-${mat}-${index}`}>
                  <tr className={`h-[42px] group transition-colors border-t border-slate-200 ${base} ${hover1}`}>
                    <td rowSpan={2} className={`p-2 sticky left-0 z-30 border-r border-slate-300 align-top ${base} border-b border-slate-200`}>
                      <div className="font-bold text-slate-800 text-[11px] truncate max-w-[185px]" title={c.nome_completo}>{c.nome_completo}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5 truncate mb-1.5">
                        {c.categoria_profissional} • {c.vinculo} • {c.turno_padrao && nomesTurnos[c.turno_padrao] ? nomesTurnos[c.turno_padrao] : c.turno_padrao}
                      </div>
                    </td>
                    <td rowSpan={2} className={`p-1 sticky left-[200px] z-30 border-r border-slate-300 text-center align-middle ${base} border-b border-slate-200`}>
                      <input type="number" className="w-11 text-center text-[11px] font-bold border rounded p-1 outline-none" value={meta} onChange={e => atualizaCargaHoraria(mat, e.target.value)} />
                    </td>
                    <td rowSpan={2} className={`p-1 sticky left-[260px] z-30 border-r border-slate-300 text-center align-middle ${base} border-b border-slate-200`}>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${excede ? 'bg-rose-100 text-rose-700' : 'text-slate-600'}`}>{horas}h</span>
                    </td>
                    {(() => {
                      const totalPR = (Object.values(gridL1[mat] || {}).filter(v => v === 'PRD' || v === 'PRN').length) +
                                      (Object.values(gridL2[mat] || {}).filter(v => v === 'PRD' || v === 'PRN').length);
                      return (
                        <td rowSpan={2} className={`p-1 sticky left-[320px] z-30 border-r border-slate-300 text-center align-middle ${base} border-b border-slate-200`}>
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded text-slate-600">{totalPR}</span>
                        </td>
                      );
                    })()}

                    {dias.map(d => {
                      const val = gridL1[mat]?.[d];
                      const pendingPedido = pedidosFolga?.find(p => String(p.colabId) === mat && p.mes === mesSelecionado && p.ano === anoSelecionado && p.dia === d && p.status === 'Pendente');
                      const fds = dow(d) === 0 || dow(d) === 6;

                      let cls = fds ? 'bg-slate-100' : '';
                      let txt = val || '';
                      let txtCls = 'text-slate-300';
                      if (val) { cls = shiftColor(val); txtCls = 'font-black'; }

                      return (
                        <td key={`l1-${d}`} className={`p-0.5 border-r border-slate-200 cursor-pointer relative ${cls} hover:opacity-75 transition-opacity`}
                          onClick={() => {
                            if (pendingPedido) {
                               setFolgaActionModal({ c, d, req: pendingPedido });
                            } else {
                               handleCellL1(c, d);
                            }
                          }}>
                          <div className={`w-full h-[34px] flex items-center justify-center text-[11px] select-none ${txtCls}`}>
                             <span>{txt}</span>
                             <span className={`absolute top-1 right-1 h-2.5 w-2.5 ${pendingPedido ? 'flex' : 'hidden'}`}>
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" title="Pedido de Folga Pendente"></span>
                             </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr className={`h-[30px] border-b border-slate-200 ${base}`}>
                    {dias.map(d => {
                      const val = gridL2[mat]?.[d];
                      let cls = '';
                      let txtCls = 'text-slate-200';
                      if (val) { cls = shiftColor(val); txtCls = 'font-black text-[10px]'; }
                      return (
                        <td key={`l2-${d}`} className={`p-0.5 border-r border-slate-200 cursor-pointer ${cls} hover:opacity-75 transition-opacity`}
                          onClick={() => handleCellL2(mat, d)}>
                          <div className={`w-full h-[22px] flex items-center justify-center text-[10px] select-none ${txtCls} italic`}>
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>

          {colabsFiltrados.length > 0 ? (
            <tfoot className="sticky bottom-0 z-40 outline outline-1 outline-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
              <tr className="bg-blue-50/90 h-[32px] border-b border-blue-200">
                <td colSpan={4} className="p-2 text-right text-[10px] font-bold text-blue-800 sticky left-0 z-50 bg-blue-100/90 border-r border-blue-200">
                  Soma Manhã (M+D+PRD)
                </td>
                {dias.map(d => {
                  const sum = colabsFiltrados.reduce((acc, c) => {
                    const mat = String(c.matricula);
                    const v1 = gridL1[mat]?.[d], v2 = gridL2[mat]?.[d];
                    const ausente = v2 && !['PRD','PRN','TR-E'].includes(v2);
                    if (ausente) return acc;
                    return acc + (['M','D','PRD'].includes(v1) || v2 === 'PRD' || v2 === 'TR-E' ? 1 : 0);
                  }, 0);
                  return <td key={d} className="border-r border-blue-200 text-center font-black text-blue-800 text-[10px]">{sum > 0 ? sum : ''}</td>;
                })}
              </tr>
              <tr className="bg-cyan-50/90 h-[32px] border-b border-cyan-200">
                <td colSpan={4} className="p-2 text-right text-[10px] font-bold text-cyan-800 sticky left-0 z-50 bg-cyan-100/90 border-r border-cyan-200">
                  Soma Tarde (T+D+PRD)
                </td>
                {dias.map(d => {
                  const sum = colabsFiltrados.reduce((acc, c) => {
                    const mat = String(c.matricula);
                    const v1 = gridL1[mat]?.[d], v2 = gridL2[mat]?.[d];
                    const ausente = v2 && !['PRD','PRN','TR-E'].includes(v2);
                    if (ausente) return acc;
                    return acc + (['T','D','PRD'].includes(v1) || v2 === 'PRD' || v2 === 'TR-E' ? 1 : 0);
                  }, 0);
                  return <td key={d} className="border-r border-cyan-200 text-center font-black text-cyan-800 text-[10px]">{sum > 0 ? sum : ''}</td>;
                })}
              </tr>
              <tr className="bg-sky-50/90 h-[32px] border-b border-sky-200">
                <td colSpan={4} className="p-2 text-right text-[10px] font-bold text-sky-800 sticky left-0 z-50 bg-sky-100/90 border-r border-sky-200">
                  Soma Noite (N+PRN)
                </td>
                {dias.map(d => {
                  const sum = colabsFiltrados.reduce((acc, c) => {
                    const mat = String(c.matricula);
                    const v1 = gridL1[mat]?.[d], v2 = gridL2[mat]?.[d];
                    const ausente = v2 && !['PRD','PRN','TR-E'].includes(v2);
                    if (ausente) return acc;
                    return acc + (['N','PRN'].includes(v1) || v2 === 'PRN' ? 1 : 0);
                  }, 0);
                  return <td key={d} className="border-r border-sky-200 text-center font-black text-sky-800 text-[10px]">{sum > 0 ? sum : ''}</td>;
                })}
              </tr>
              <tr className="bg-slate-100 h-[36px]">
                <td colSpan={4} className="p-2 text-right text-[10px] font-black text-slate-700 sticky left-0 z-50 bg-slate-200 border-r border-slate-300">
                  ⚡ Força Efetiva (máx turno)
                </td>
                {dias.map(d => {
                  const cob = coberturaDaily(d);
                  const abaixo = cob.efetiva > 0 && cob.efetiva < MINIMO_DIA;
                  return (
                    <td key={d} className={`border-r border-slate-300 text-center text-[10px] font-black ${
                      abaixo ? 'bg-red-200 text-red-800' : cob.efetiva === 0 ? 'text-slate-300' : 'bg-emerald-50 text-emerald-800'
                    }`} title={abaixo ? `Abaixo do mínimo (${MINIMO_DIA})!` : ''}>
                      {cob.efetiva > 0 ? cob.efetiva : ''}
                      {abaixo && <span className="block text-[7px] leading-none">⚠</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-t border-slate-200 pt-4 mt-4 gap-4 hide-on-print">
        <div className="flex flex-col">
          <p className="text-xs font-bold text-slate-600 mb-1">Status Atual: <span className={`px-2 py-0.5 rounded text-white font-bold shadow-sm ${statusEscala === 'Aprovada' ? 'bg-emerald-500' : statusEscala === 'Finalizada' ? 'bg-amber-500' : 'bg-slate-500'}`}>{statusEscala || 'Rascunho'}</span></p>
          <p className="text-[10px] text-slate-400 italic">Estes totais só ficarão oficiais após salvar.</p>
        </div>
                {/* ========================================================= */}
        {/* MÁQUINA DE ESTADOS - FLUXO DE APROVAÇÃO DA ESCALA         */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* ============================================================== */}
          {/* VISÃO: LIDERANÇA 1 (Em produção)                               */}
          {/* ============================================================== */}
          {(user?.role?.includes('Liderança 1') || user?.role?.includes('Lideranca 1')) && (statusEscala === 'em produção' || statusEscala === 'Rascunho') && (
            <>
              <button onClick={() => salvarEscala('em produção')} className="bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-300 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                <Save size={14} /> Salvar Rascunho
              </button>
              <button onClick={() => salvarEscala('em revisão')} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-blue-700 shadow-md flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                <CalendarDays size={14} /> Enviar para Revisão (L2)
              </button>
            </>
          )}

          {/* ============================================================== */}
          {/* VISÃO: LIDERANÇA 2 (Intervenção e Revisão)                     */}
          {/* ============================================================== */}
          {(user?.role?.includes('Liderança 2') || user?.role?.includes('Lideranca 2')) && statusEscala !== 'aprovada' && statusEscala !== 'em aprovação' && (
            <>
              <button onClick={() => salvarEscala('em revisão')} className="bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-300 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                <Save size={14} /> Salvar / Assumir Revisão
              </button>
              
              {statusEscala === 'em revisão' && (
                <button onClick={() => salvarEscala('em produção')} className="bg-rose-100 text-rose-700 font-bold px-4 py-2 rounded-xl hover:bg-rose-200 border border-rose-200 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                  <X size={14} /> Devolver para L1
                </button>
              )}
              
              <button onClick={() => salvarEscala('em aprovação')} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-md flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                <CalendarDays size={14} /> Enviar para Aprovação Final
              </button>
            </>
          )}

          {/* ============================================================== */}
          {/* VISÃO: ALTA GESTÃO / DIRETORIA ("Poder de Deus")                 */}
          {/* ============================================================== */}
          {(user?.role === 'Administrador' || user?.role === 'Diretor') && (
            <>
              {statusEscala !== 'aprovada' && (
                <button onClick={() => salvarEscala(statusEscala)} className="bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl hover:bg-slate-300 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                  <Save size={14} /> Salvar Alterações
                </button>
              )}

              {statusEscala !== 'aprovada' && statusEscala !== 'Rascunho' && statusEscala !== 'em produção' && (
                <button onClick={() => salvarEscala('em revisão')} className="bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-xl hover:bg-amber-200 border border-amber-200 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                  <X size={14} /> Devolver para Ajustes
                </button>
              )}

              {statusEscala !== 'aprovada' && (
                <button onClick={() => salvarEscala('aprovada')} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-md flex items-center gap-2 active:scale-[0.98] transition-all text-xs">
                  <ShieldCheck size={14} /> Aprovar e Publicar Escala
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showSaveModal && (() => {
        // Lógica inteligente: Determina o tipo de ação para renderizar o layout correto
        const isSubmissao = 
          (statusAlvoSave === 'em revisão' && (statusEscala === 'em produção' || statusEscala === 'Rascunho')) ||
          (statusAlvoSave === 'em aprovação' && statusEscala === 'em revisão') ||
          statusAlvoSave === 'aprovada';
        
        const isDevolucao = 
          (statusAlvoSave === 'em produção' && statusEscala === 'em revisão') ||
          (statusAlvoSave === 'em revisão' && statusEscala === 'em aprovação');
          
        const isRascunho = !isSubmissao && !isDevolucao;

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-on-print">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
              
              {isSubmissao ? (
                 // ============================================
                 // LAYOUT DE SUBMISSÃO (Com Inconformidades)
                 // ============================================
                 <>
                   <h3 className="text-lg font-bold mb-4">{saveConformity ? "✅ Escala conforme!" : "⚠️ Inconformidades encontradas"}</h3>
                   {!saveConformity && (
                     <div className="mb-4 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                       <table className="w-full text-xs border-collapse">
                         <thead><tr className="bg-slate-100 text-slate-500"><th className="p-2 text-left">Colaborador</th><th className="p-2 text-center">Meta</th><th className="p-2 text-center">Feitas</th><th className="p-2 text-center">Diff.</th></tr></thead>
                         <tbody className="divide-y divide-slate-100">
                           {inconformes.map(c => (
                             <tr key={c.matricula}>
                               <td className="p-2 font-semibold">{c.nome}</td>
                               <td className="p-2 text-center">{c.meta}h</td>
                               <td className="p-2 text-center">{c.feitas}h</td>
                               <td className={`p-2 text-center font-bold ${c.diff > 0 ? 'text-rose-600' : 'text-amber-600'}`}>{c.diff > 0 ? `+${c.diff}h` : `${c.diff}h`}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   )}
                   <p className="text-sm text-slate-600 mb-5">
                     {saveConformity ? "Todas as cargas horárias estão dentro do esperado. Deseja enviar a escala?" : "Existem colaboradores com horas fora da meta. Deseja enviar mesmo assim?"}
                   </p>
                 </>
              ) : isDevolucao ? (
                 // ============================================
                 // LAYOUT DE DEVOLUÇÃO (Simples e Alerta)
                 // ============================================
                 <>
                   <h3 className="text-lg font-bold mb-2 text-amber-600 flex items-center gap-2">
                     <AlertTriangle size={20} /> Confirmar Devolução
                   </h3>
                   <p className="text-sm text-slate-600 mb-5">
                     Você está devolvendo esta escala para ajustes. O status retornará para <strong>"{statusAlvoSave}"</strong>. Deseja confirmar?
                   </p>
                 </>
              ) : (
                 // ============================================
                 // LAYOUT DE RASCUNHO / SALVAR ALTERAÇÕES
                 // ============================================
                 <>
                   <h3 className="text-lg font-bold mb-2 text-indigo-600 flex items-center gap-2">
                     <Save size={20} /> Salvar Alterações
                   </h3>
                   <p className="text-sm text-slate-600 mb-5">
                     O progresso atual será salvo. Você poderá continuar editando esta escala depois sem alterar a etapa de aprovação.
                   </p>
                 </>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-all">Cancelar</button>
                <button onClick={efetivarSalvamento} className={`font-bold px-6 py-2 rounded-xl text-white transition-all shadow-md active:scale-95 ${isDevolucao ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {isDevolucao ? 'Devolver Escala' : 'Confirmar e Salvar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {modalTroca && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-on-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">🔄 Mover Turno de Dia</h3>
              <button onClick={() => setModalTroca(false)} className="hover:bg-indigo-700 p-1 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 mb-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                Selecione o colaborador e os dois dias. Os turnos de <strong>Origem</strong> e <strong>Destino</strong> serão <strong>trocados entre si</strong> na Linha 1 (Base).
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Colaborador <span className="text-rose-500">*</span></label>
                  <select
                    required
                    className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
                    value={trocaForm.matricula}
                    onChange={e => setTrocaForm({...trocaForm, matricula: e.target.value})}
                  >
                    <option value="">Selecione o colaborador...</option>
                    {colabsFiltrados.map(c => (
                      <option key={c.matricula} value={c.matricula}>
                        {c.nome_completo || c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Dia de Origem <span className="text-rose-500">*</span></label>
                    <input
                      type="number" min={1} max={diasNoMes} required
                      placeholder={`1–${diasNoMes}`}
                      className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-center font-bold"
                      value={trocaForm.diaOrigem}
                      onChange={e => setTrocaForm({...trocaForm, diaOrigem: e.target.value})}
                    />
                    {trocaForm.matricula && trocaForm.diaOrigem && (
                      <p className="text-[10px] text-indigo-600 mt-1 font-bold">
                        Turno atual: {gridL1[String(trocaForm.matricula)]?.[parseInt(trocaForm.diaOrigem)] || '(vazio)'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Dia de Destino <span className="text-rose-500">*</span></label>
                    <input
                      type="number" min={1} max={diasNoMes} required
                      placeholder={`1–${diasNoMes}`}
                      className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 text-center font-bold"
                      value={trocaForm.diaDestino}
                      onChange={e => setTrocaForm({...trocaForm, diaDestino: e.target.value})}
                    />
                    {trocaForm.matricula && trocaForm.diaDestino && (
                      <p className="text-[10px] text-indigo-600 mt-1 font-bold">
                        Turno atual: {gridL1[String(trocaForm.matricula)]?.[parseInt(trocaForm.diaDestino)] || '(vazio)'}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Motivo <span className="text-rose-500">*</span></label>
                  <select
                    required
                    className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400"
                    value={trocaForm.motivo}
                    onChange={e => setTrocaForm({...trocaForm, motivo: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Particular">Particular</option>
                    <option value="Necessidade Institucional">Necessidade Institucional</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-slate-100">
                <button onClick={() => setModalTroca(false)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button
                  onClick={handleSalvarTroca}
                  disabled={!trocaForm.matricula || !trocaForm.diaOrigem || !trocaForm.diaDestino || !trocaForm.motivo}
                  className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >Mover Turno</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalFerias && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-on-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-amber-500 p-5 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2">🏝️ Gerenciamento de Férias</h3>
              <button onClick={() => setModalFerias(false)} className="hover:bg-amber-600 p-1 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Colaborador</label>
                  <select required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-400" value={feriasForm.matricula} onChange={e => setFeriasForm({...feriasForm, matricula: e.target.value})}>
                    <option value="">Selecione...</option>
                    {colabsFiltrados.map(c => <option key={c.matricula} value={c.matricula}>{c.nome_completo || c.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Data de Início</label>
                    <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-400" value={feriasForm.dataInicio} onChange={e => setFeriasForm({...feriasForm, dataInicio: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Quantidade de Dias</label>
                    <input type="number" min="1" required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-amber-400" value={feriasForm.dias} onChange={e => setFeriasForm({...feriasForm, dias: e.target.value})} placeholder="Ex: 30" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-6 mt-4 border-t border-slate-100">
                <button onClick={() => setModalFerias(false)} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={handleSalvarFerias} disabled={!feriasForm.matricula || !feriasForm.dataInicio || !feriasForm.dias} className="bg-amber-500 text-white font-bold px-6 py-2 rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-all">Automatizar Férias</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folgaActionModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 hide-on-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in">
             <div className="p-6 text-center">
                <div className="mx-auto w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4"><CalendarDays size={28}/></div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Pedido de Folga</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  O colaborador <b>{folgaActionModal.c.nome}</b> solicitou folga para o dia <b>{folgaActionModal.d}</b>. Como deseja proceder?
                </p>
                <div className="flex justify-center gap-3">
                   <button onClick={() => {
                      try {
                        const matStr = String(folgaActionModal.c.matricula);
                        setGridL1(p => { 
                           const ng = {...p}; 
                           const cb = {...(ng[matStr] || {})}; 
                           cb[folgaActionModal.d] = 'F'; 
                           ng[matStr] = cb; 
                           return ng; 
                        });
                        setPedidosFolga(prev => prev.map(x => x === folgaActionModal.req ? {...x, status: 'Aprovado'} : x));
                        setFolgaActionModal(null);
                        setVersaoTabela(prev => prev + 1);
                      } catch(e) { alert("ERRO Aprovar: " + e.message); }
                   }} className="bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-600 flex items-center gap-2 active:scale-95 transition-all shadow-md">
                      <ThumbsUp size={18}/> Aprovar
                   </button>
                   <button onClick={() => {
                      try {
                        setPedidosFolga(prev => prev.map(x => x === folgaActionModal.req ? {...x, status: 'Recusado'} : x));
                        setFolgaActionModal(null);
                        setVersaoTabela(prev => prev + 1);
                      } catch(e) { alert("ERRO Recusar: " + e.message); }
                   }} className="bg-rose-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-rose-600 flex items-center gap-2 active:scale-95 transition-all shadow-md">
                      <ThumbsDown size={18}/> Recusar
                   </button>
                </div>
                <button onClick={() => setFolgaActionModal(null)} className="mt-5 text-sm font-bold text-slate-400 hover:text-slate-600 outline-none">
                  Decidir depois
                </button>
             </div>
          </div>
        </div>
      )}

      {modalLimparEscala && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 hide-on-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            <div className="bg-rose-500 p-5 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2"><Trash2 size={20}/> Limpar Escala</h3>
              <button onClick={() => setModalLimparEscala(false)} className="hover:bg-rose-600 p-1 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6">
              <p className="text-slate-500 text-sm mb-4">Selecione o colaborador para apagar todos os seus plantões deste mês.</p>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-1">Colaborador <span className="text-rose-500">*</span></label>
                <select
                  className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-rose-400"
                  value={matriculaLimpar}
                  onChange={e => setMatriculaLimpar(e.target.value)}
                >
                  <option value="">Selecione o colaborador...</option>
                  {colabsFiltrados.map(c => (
                    <option key={c.matricula} value={c.matricula}>
                      {c.nome_completo || c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button onClick={() => setModalLimparEscala(false)} className="px-4 py-2 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-all">Cancelar</button>
                <button
                  disabled={!matriculaLimpar}
                  onClick={() => {
                    const matStr = String(matriculaLimpar);
                    setGridL1(p => ({ ...p, [matStr]: {} }));
                    setGridL2(p => ({ ...p, [matStr]: {} }));
                    setModalLimparEscala(false);
                    setMatriculaLimpar("");
                    setVersaoTabela(prev => prev + 1);
                  }}
                  className="px-6 py-2 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 disabled:opacity-50 transition-all shadow-md"
                >Confirmar Limpeza</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

