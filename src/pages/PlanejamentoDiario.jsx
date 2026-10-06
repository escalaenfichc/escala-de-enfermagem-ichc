import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase'; 
import {
  CalendarDays, Users, ClipboardList, Coffee, AlertCircle, Plus, X,
  Search, Filter, Loader2, Save, FileText, CheckCircle2, MapPin, ShieldAlert
} from 'lucide-react';

// Opções padrão para o Planeamento (podem ser customizadas depois)
const OPCOES_ATIVIDADE = [
  'Cuidados Integrais (Leitos 01-05)',
  'Cuidados Integrais (Leitos 06-10)',
  'Medicação / Preparo',
  'Triagem / Acolhimento',
  'Chefia de Equipe',
  'Apoio / Corredor',
  'Rotina Administrativa'
];

const OPCOES_PAUSAS = [
  '09:00 - 09:15',
  '10:00 - 10:15',
  '11:00 - 12:00 (Almoço)',
  '12:00 - 13:00 (Almoço)',
  '15:00 - 15:15',
  '16:00 - 16:15',
  '21:00 - 22:00 (Jantar)',
  '02:00 - 04:00 (Descanso)',
  '04:00 - 06:00 (Descanso)'
];

export default function PlanejamentoDiario({ setPagina }) {
  const { user, filtroGlobalSetor } = useAuth();
  const isSupervisao = user?.role === "Supervisão";
  const setorAplicado = (isSupervisao && filtroGlobalSetor) ? filtroGlobalSetor : (user?.unidadeLogada || "");

  // ─── Estados de Fluxo e Auditoria ───
  const [viewAtual, setViewAtual] = useState('lobby'); // 'lobby' ou 'form'
  const [listaHistorico, setListaHistorico] = useState([]);
  const [planejamentoAtivo, setPlanejamentoAtivo] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Timezone Compensated Date
  const getHojeLocal = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const [dataSelecionada, setDataSelecionada] = useState(getHojeLocal());
  const [colabsSetor, setColabsSetor] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros e Dados do Form
  const [turno, setTurno] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [planejamento, setPlanejamento] = useState({});
  const [salvando, setSalvando] = useState(false);

  // ─── Carregamento Inicial (Histórico) ───
  useEffect(() => {
    const buscarHistorico = async () => {
      if (!setorAplicado) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('planejamento_turnos')
        .select('*')
        .eq('setor', setorAplicado)
        .order('data_referencia', { ascending: false });
      
      if (!error && data) setListaHistorico(data);
      setLoading(false);
    };
    buscarHistorico();
  }, [setorAplicado]);

  // ─── Lógica de Início e Abertura ───
  const iniciarNovoPlanejamento = () => {
    const hoje = getHojeLocal();
    if (!turno) { alert("Selecione um turno para iniciar."); return; }
    
    const existe = listaHistorico.find(p => p.data_referencia === hoje && p.turno === turno);
    if (existe) {
      alert(`Já existe um planejamento para ${hoje} no turno ${turno}. Abra o registro existente.`);
      return;
    }

    setPlanejamentoAtivo(null);
    setIsReadOnly(false);
    setDataSelecionada(hoje);
    setPlanejamento({});
    setViewAtual('form');
  };

  const abrirPlanejamento = (p) => {
    const hoje = getHojeLocal();
    setPlanejamentoAtivo(p);
    setDataSelecionada(p.data_referencia);
    setTurno(p.turno);
    setPlanejamento(p.dados || {});
    
    setIsReadOnly(p.data_referencia < hoje);
    setViewAtual('form');
  };

  // ─── Efeito para carregar colabs do setor ───
  useEffect(() => {
    if (viewAtual !== 'form') return;
    const carregarEquipe = async () => {
      const { data: colabsData } = await supabase.from('colaboradores').select('*');
      if (colabsData) {
        const formatados = colabsData.map(c => ({
          id: c.Matricula || c.matricula,
          nome: c.Nome_Completo || c.nome_completo,
          cargo: c.Categoria_Profissional || c.categoria_profissional,
          setor: c.Unidade_Alocacao || c.unidade_alocacao,
          matricula: c.Matricula || c.matricula,
          turno_padrao: c.Turno_Padrao || c.turno_padrao,
          status: c.Status_Atual || c.status
        })).filter(c => (c.status || '').toLowerCase().includes('ativo') && (c.setor || '').toUpperCase() === (setorAplicado || '').toUpperCase());
        setColabsSetor(formatados);
      }
    };
    carregarEquipe();
  }, [viewAtual, setorAplicado]);

  const atualizarPlanejamento = (id, campo, valor) => {
    if (isReadOnly) return;
    setPlanejamento(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { atividade: '', pausa: '', obs: '' }),
        [campo]: valor
      }
    }));
  };

  const salvarPlanejamento = async () => {
    setSalvando(true);
    
    const payload = {
      setor: setorAplicado,
      data_referencia: dataSelecionada,
      turno: turno,
      dados: planejamento,
      editado_em: planejamentoAtivo ? new Date().toISOString() : null,
      responsavel_nome: planejamentoAtivo?.responsavel_nome || user?.Nome_Completo || user?.nome_completo || user?.nome || user?.name || 'Equipe Assistencial',
      editado_por_nome: planejamentoAtivo ? (user?.Nome_Completo || user?.nome_completo || user?.nome || user?.name || 'Equipe Assistencial') : null,
    };

    const { error } = await supabase.from('planejamento_turnos').upsert(payload);

    setSalvando(false);
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      alert('Planejamento diário salvo com sucesso!');
      setTimeout(() => {
        if (window.confirm("Deseja imprimir o PDF deste planejamento para arquivo?")) {
          window.print(); 
        }
        setViewAtual('lobby');
      }, 500);
    }
  };

  if (loading && viewAtual === 'lobby') {
    return <div className="p-12 text-center text-slate-500 font-bold">Carregando histórico...</div>;
  }

  return (
    <div className="print:block">
        <style type="text/css" media="print">
          {`
            @page { size: landscape; margin: 10mm; }
            body * { visibility: hidden; }
            #area-impressao, #area-impressao * { visibility: visible; }
            #area-impressao {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          `}
        </style>
      
      {/* ── VIEW: LOBBY (Histórico) ── */}
      {viewAtual === 'lobby' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6 print:hidden">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Histórico de Planejamentos Diários</p>
              <p className="text-xs text-slate-400 mt-1">Unidade: {setorAplicado}</p>
            </div>
            <div className="flex items-center gap-3">
              <select className="border p-2 rounded-xl text-sm font-bold" value={turno} onChange={e => setTurno(e.target.value)}>
                <option value="">Turno...</option>
                <option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Noite">Noite</option>
              </select>
              <button onClick={iniciarNovoPlanejamento} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                <Plus size={18}/> Novo Planejamento
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {listaHistorico.length === 0 ? (
              <p className="text-center py-10 text-slate-400 italic">Nenhum planejamento localizado.</p>
            ) : (
              listaHistorico.map(p => (
                <div key={`${p.data_referencia}-${p.turno}`} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Data</p>
                      <p className="font-bold text-slate-700">{p.data_referencia.split('-').reverse().join('/')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Turno</p>
                      <p className="font-bold text-indigo-600">{p.turno}</p>
                    </div>
                    <div className="flex flex-col justify-center gap-1 border-l border-slate-200 pl-6 ml-2">
                      <p className="text-[11px] text-slate-500">
                        <span className="font-bold text-slate-400 uppercase mr-1">Enviado por:</span> 
                        <span className="font-bold text-indigo-600 mr-2">{p.responsavel_nome || 'Profissional'}</span>
                        <span className="font-bold text-slate-400 uppercase mr-1">às:</span> 
                        <span className="font-semibold text-slate-600">{p.created_at ? new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Indisponível'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        <span className="font-bold text-slate-400 uppercase mr-1">Última edição por:</span> 
                        {p.editado_em ? (
                          <>
                            <span className="font-bold text-indigo-600 mr-2">{p.editado_por_nome || p.responsavel_nome || 'Profissional'}</span>
                            <span className="font-bold text-slate-400 uppercase mr-1">às:</span> 
                            <span className="font-semibold text-slate-600">{new Date(p.editado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </>
                        ) : (
                          <span className="font-semibold text-slate-600">Sem edições</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => abrirPlanejamento(p)} className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100">Visualizar</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── VIEW: FORMULÁRIO ── */}
      {viewAtual === 'form' && (
        <div id="area-impressao" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6 relative">
          
          {/* Header Compacto */}
          <div className="flex justify-between items-center border-b pb-4 print:mb-8">
             <div className="flex items-center gap-4">
                <button onClick={() => setViewAtual('lobby')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 print:hidden"><X size={20}/></button>
                <div>
                   <p className="text-sm font-black text-slate-700 uppercase tracking-tighter">Distribuição de Atividades: {turno}</p>
                   <p className="text-[10px] font-bold text-slate-500">{dataSelecionada.split('-').reverse().join('/')} — {setorAplicado}</p>
                </div>
             </div>
             <div className="flex items-center gap-3 print:hidden">
               <input 
                 type="date" 
                 value={dataSelecionada} 
                 disabled={!!planejamentoAtivo}
                 onChange={e => setDataSelecionada(e.target.value)} 
                 className="border border-slate-300 rounded-lg p-2 text-sm text-slate-700 outline-none focus:border-indigo-500" 
               />
               {isReadOnly && (
                 <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                   <ShieldAlert size={14}/> REGISTRO ARQUIVADO
                 </div>
               )}
             </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                <tr><th className="p-3">Colaborador</th><th className="p-3">Atividade / Setor</th><th className="p-3">Pausa</th></tr>
              </thead>
              <tbody className="divide-y">
                {colabsSetor.map(c => (
                  <tr key={c.id}>
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3">
                      <select 
                        disabled={isReadOnly}
                        className="w-full p-1.5 border rounded-lg text-xs bg-slate-50"
                        value={planejamento[c.id]?.atividade || ''}
                        onChange={e => atualizarPlanejamento(c.id, 'atividade', e.target.value)}
                      >
                        <option value="">Atribuir...</option>
                        {OPCOES_ATIVIDADE.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                       <select 
                        disabled={isReadOnly}
                        className="w-full p-1.5 border rounded-lg text-xs bg-slate-50"
                        value={planejamento[c.id]?.pausa || ''}
                        onChange={e => atualizarPlanejamento(c.id, 'pausa', e.target.value)}
                      >
                        <option value="">Definir...</option>
                        {OPCOES_PAUSAS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isReadOnly && (
            <div className="flex justify-end pt-4 border-t print:hidden">
              <button 
                onClick={salvarPlanejamento} 
                disabled={salvando}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                {salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Planejamento
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
