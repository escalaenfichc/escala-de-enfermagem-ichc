import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase'; 
import {
  ClipboardCheck, Users, Activity, Send, CheckCircle2,
  AlertCircle, BedDouble, AlertTriangle, ShieldAlert, X,
  Plus, ChevronDown, FileText, Biohazard, HeartPulse, Stethoscope, Package, Info, Search, Loader2, Filter
} from 'lucide-react';
import { TIPOS_ALERTA, TIPOS_ISOLAMENTO } from '../components/plantao/constantes';
import ModalAlerta from '../components/plantao/ModalAlerta';
import GestaoLeitosCard from '../components/plantao/GestaoLeitosCard';
import AlertasUnidadeCard from '../components/plantao/AlertasUnidadeCard';

// ─── Modal de Justificativa de Ausência ──────────────────────────────────────
function ModalAusencia({ colaborador, dados, onSalvar, onCancelar }) {
  const [motivo, setMotivo] = useState(dados?.motivo || '');
  const [obs, setObs] = useState(dados?.obs || '');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-rose-500 p-5 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2"><AlertCircle size={20}/> Justificativa de Ausência</h3>
          <button onClick={onCancelar} className="hover:bg-rose-600 p-1 rounded-full transition-colors"><X size={20}/></button>
        </div>
        <div className="p-6">
          <p className="text-sm font-bold text-slate-700 mb-4">Colaborador: <span className="text-rose-600">{colaborador?.nome}</span></p>
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Ausência *</label>
            <select
              autoFocus required
              className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-400 bg-slate-50"
              value={motivo} onChange={e => setMotivo(e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="Afastamento médico">Afastamento médico</option>
              <option value="Outras justificativas">Outras justificativas</option>
              <option value="Falta não justificada">Falta não justificada</option>
            </select>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Observações</label>
            <textarea
              rows="3" placeholder="Detalhes adicionais (opcional)..."
              className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-400 bg-slate-50 resize-none"
              value={obs} onChange={e => setObs(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button onClick={onCancelar} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors text-sm">Cancelar</button>
            <button
              disabled={!motivo} onClick={() => onSalvar({ motivo, obs })}
              className="bg-rose-500 text-white font-bold px-6 py-2 rounded-xl hover:bg-rose-600 shadow-sm transition-colors text-sm disabled:opacity-40"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ModalAlerta importado de ../components/plantao/ModalAlerta

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function PlantaoDiario({ setPagina }) {
  const { user, filtroGlobalSetor } = useAuth();
  const isSupervisao = user?.role === "Supervisão";
  const setorAplicado = (isSupervisao && filtroGlobalSetor) ? filtroGlobalSetor : (user?.unidadeLogada || "");
  
  // ─── Estados de Fluxo e Auditoria ───
  const [viewAtual, setViewAtual] = useState('lobby'); // 'lobby' ou 'form'
  const [listaHistorico, setListaHistorico] = useState([]);
  const [plantaoAtivo, setPlantaoAtivo] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const [dataSelecionada, setDataSelecionada] = useState(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]);
  const [colabsSetor, setColabsSetor] = useState([]);
  const [leitosTotais, setLeitosTotais] = useState(30);
  const [loading, setLoading] = useState(true);

  // Filtros e Dados do Form
  const [turno, setTurno] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas as Categorias');
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [ocupados, setOcupados] = useState(0);
  const [bloqueados, setBloqueados] = useState(0);
  const leitosVagos = leitosTotais - (ocupados + bloqueados);
  const [presencas, setPresencas] = useState({});
  const [ausencias, setAusencias] = useState({});
  const [modalAusencia, setModalAusencia] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [modalAlerta, setModalAlerta] = useState(null);
  const dropRef = useRef(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  const registrarAtualizacao = () => setUltimaAtualizacao(new Date());

  function abrirNovoAlerta(tipoDef) { setModalAlerta({ tipoDef, uid: null, dadosExistentes: null }); setDropdownAberto(false); }
  function abrirEditarAlerta(alerta) { setModalAlerta({ tipoDef: alerta.tipoDef, uid: alerta.uid, dadosExistentes: alerta.dados }); }
  function salvarAlerta(dados) {
    registrarAtualizacao();
    setAlertas(prev => {
      if (modalAlerta.uid) return prev.map(a => a.uid === modalAlerta.uid ? { ...a, dados } : a);
      const uid = `${modalAlerta.tipoDef.id}_${Date.now()}`;
      return [...prev, { uid, tipoDef: modalAlerta.tipoDef, dados }];
    });
    setModalAlerta(null);
  }
  function removerAlerta() {
    registrarAtualizacao();
    setAlertas(prev => prev.filter(a => a.uid !== modalAlerta.uid));
    setModalAlerta(null);
  }

  const marcarTodosVisiveis = () => {
    const p = { ...presencas };
    colabsSetor
      .filter(c => {
        const matchNome = c.nome.toLowerCase().includes(buscaColaborador.toLowerCase());
        const matchCat = filtroCategoria === 'Todas as Categorias' 
          ? true 
          : filtroCategoria === 'Enfermeiro' 
            ? (c.cargo || '').includes('Enfermeiro')
            : !(c.cargo || '').includes('Enfermeiro');
        return matchNome && matchCat;
      })
      .forEach(c => { p[c.id] = true; });
    setPresencas(p);
  };

  const clicarPresenca = (colab) => {
    if (isReadOnly) return;
    registrarAtualizacao();
    setPresencas(prev => {
      const atual = prev[colab.id];
      if (atual === undefined || atual === true) {
        setModalAusencia(colab);
        return { ...prev, [colab.id]: false };
      } else {
        setAusencias(a => { const n = { ...a }; delete n[colab.id]; return n; });
        return { ...prev, [colab.id]: true };
      }
    });
  };

  // ─── Carregamento Inicial (Histórico) ───
  useEffect(() => {
    const buscarHistorico = async () => {
      if (!setorAplicado) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('plantao_diario')
        .select('*')
        .eq('setor', setorAplicado)
        .order('data_plantao', { ascending: false });
      
      if (!error && data) setListaHistorico(data);
      setLoading(false);
    };
    buscarHistorico();
  }, [setorAplicado]);

  // ─── Lógica de Início e Abertura ───
  const iniciarNovoPlantao = () => {
    const hoje = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    // Verifica se já existe plantão para hoje/turno selecionado (precisa do turno selecionado no lobby ou forçar seleção)
    if (!turno) { alert("Selecione um turno para iniciar."); return; }
    
    const existe = listaHistorico.find(p => p.data_plantao === hoje && p.turno === turno);
    if (existe) {
      alert(`Já existe um plantão registrado para ${hoje} no turno ${turno}. Por favor, abra o registro existente.`);
      return;
    }

    setPlantaoAtivo(null);
    setIsReadOnly(false);
    setDataSelecionada(hoje);
    // Resetar campos
    setPresencas({}); setAusencias({}); setAlertas([]); setOcupados(0); setBloqueados(0);
    setViewAtual('form');
  };

  const abrirPlantao = (p) => {
    const hoje = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    setPlantaoAtivo(p);
    setDataSelecionada(p.data_plantao);
    setTurno(p.turno);
    setPresencas(p.presencas || {});
    setAusencias(p.ausencias || {});
    setAlertas(p.alertas || []);
    setOcupados(p.ocupados || 0);
    setBloqueados(p.bloqueados || 0);
    
    // Trava de Auditoria
    setIsReadOnly(p.data_plantao < hoje);
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

  const enviarPlantao = async () => {
    const payload = {
      setor: setorAplicado,
      data_plantao: dataSelecionada,
      turno: turno,
      presencas,
      ausencias,
      alertas,
      ocupados,
      bloqueados,
      editado_em: plantaoAtivo ? new Date().toISOString() : null,
      responsavel_nome: plantaoAtivo?.responsavel_nome || user?.Nome_Completo || user?.nome_completo || user?.nome || user?.name || 'Equipe Assistencial',
      editado_por_nome: plantaoAtivo ? (user?.Nome_Completo || user?.nome_completo || user?.nome || user?.name || 'Equipe Assistencial') : null,
    };

    if (plantaoAtivo) {
       console.log(`[Editado em: ${new Date().toLocaleString()}]`);
    }

    const { error } = await supabase.from('plantao_diario').upsert(payload, { onConflict: 'setor,data_plantao,turno' });

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      alert('Plantão diário registrado com sucesso!');
      
      setTimeout(() => {
        if (window.confirm("Deseja imprimir o PDF deste plantão para arquivo?")) {
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
            body * {
              visibility: hidden;
            }
            #area-impressao, #area-impressao * {
              visibility: visible;
            }
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
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Histórico de Plantões Diários</p>
              <p className="text-xs text-slate-400 mt-1">Unidade: {setorAplicado}</p>
            </div>
            <div className="flex items-center gap-3">
              <select className="border p-2 rounded-xl text-sm font-bold" value={turno} onChange={e => setTurno(e.target.value)}>
                <option value="">Selecione o Turno...</option>
                <option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Noite">Noite</option>
              </select>
              <button onClick={iniciarNovoPlantao} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                <Plus size={18}/> Iniciar Novo Plantão
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {listaHistorico.length === 0 ? (
              <p className="text-center py-10 text-slate-400 italic">Nenhum plantão localizado para este setor.</p>
            ) : (
              listaHistorico.map(p => (
                <div key={`${p.data_plantao}-${p.turno}`} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Data do Plantão</p>
                      <p className="font-bold text-slate-700">{p.data_plantao.split('-').reverse().join('/')}</p>
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
                  <button onClick={() => abrirPlantao(p)} className="text-indigo-600 font-bold text-sm px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100">Abrir Registro</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── VIEW: FORMULÁRIO ── */}
      {viewAtual === 'form' && (
        <div id="area-impressao" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6 relative">
          
          {/* Header Compacto (Lógica de Trava) */}
          <div className="flex justify-between items-center border-b pb-4 print:mb-8">
             <div className="flex items-center gap-4">
                <button onClick={() => setViewAtual('lobby')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 print:hidden"><X size={20}/></button>
                <div>
                   <p className="text-sm font-black text-slate-700 uppercase tracking-tighter">Folha de Plantão: {turno}</p>
                   <p className="text-[10px] font-bold text-slate-500">{dataSelecionada.split('-').reverse().join('/')} — {setorAplicado}</p>
                </div>
             </div>
             <div className="flex items-center gap-3 print:hidden">
               <input 
                 type="date" 
                 value={dataSelecionada} 
                 disabled={!!plantaoAtivo}
                 onChange={e => setDataSelecionada(e.target.value)} 
                 className="border border-slate-300 rounded-lg p-2 text-sm text-slate-700 outline-none focus:border-indigo-500" 
               />
               {isReadOnly && (
                 <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                   <ShieldAlert size={14}/> MODO CONSULTA (Plantão Encerrado)
                 </div>
               )}
             </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border">
               <p className="text-[10px] font-bold text-slate-500 uppercase">Equipe Escala</p>
               <p className="text-xl font-black text-slate-700">{colabsSetor.length}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
               <p className="text-[10px] font-bold text-emerald-700 uppercase">Presentes</p>
               <p className="text-xl font-black text-emerald-700">{Object.values(presencas).filter(v => v === true).length}</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
               <p className="text-[10px] font-bold text-rose-700 uppercase">Ausentes</p>
               <p className="text-xl font-black text-rose-700">{Object.values(presencas).filter(v => v === false).length}</p>
            </div>
          </div>


          {/* Barra de Filtros Nominal */}
          <div className="flex flex-col md:flex-row gap-3 print:hidden">
            <div className="relative flex-1 flex gap-3">
              <select 
                value={filtroCategoria} 
                onChange={e => setFiltroCategoria(e.target.value)}
                className="border border-slate-300 rounded-lg p-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-500 bg-white shadow-sm"
              >
                <option value="Todas as Categorias">Todas as Categorias</option>
                <option value="Enfermeiro">Enfermeiros</option>
                <option value="Técnico">Técnicos/Auxiliares</option>
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar colaborador por nome..." 
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                  value={buscaColaborador}
                  onChange={e => setBuscaColaborador(e.target.value)}
                />
              </div>
              <button
                onClick={marcarTodosVisiveis}
                disabled={isReadOnly}
                className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95 shrink-0"
              >
                <CheckCircle2 size={16}/> Marcar Visíveis
              </button>
            </div>
          </div>

          {/* Listagem de Colabs */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                <tr><th className="p-3">Colaborador</th><th className="p-3 text-center">Status</th><th className="p-3">Observação</th></tr>
              </thead>
              <tbody className="divide-y">
                {colabsSetor
                  .filter(c => {
                    const matchNome = c.nome.toLowerCase().includes(buscaColaborador.toLowerCase());
                    const matchCat = filtroCategoria === 'Todas as Categorias' 
                      ? true 
                      : filtroCategoria === 'Enfermeiro' 
                        ? (c.cargo || '').includes('Enfermeiro')
                        : !(c.cargo || '').includes('Enfermeiro');
                    return matchNome && matchCat;
                  })
                  .map(c => (
                  <tr key={c.id} className={presencas[c.id] === false ? "bg-rose-50/30" : ""}>
                    <td className="p-3 font-medium">{c.nome} <span className="text-[10px] text-slate-400 ml-1">({c.cargo})</span></td>
                    <td className="p-3 text-center">
                      <button 
                        disabled={isReadOnly}
                        onClick={() => clicarPresenca(c)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold ${presencas[c.id] === true ? 'bg-emerald-500 text-white' : presencas[c.id] === false ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                      >
                        {presencas[c.id] === true ? 'Presente' : presencas[c.id] === false ? 'Faltou' : 'Pendente'}
                      </button>
                    </td>
                    <td className="p-3">
                      {presencas[c.id] === false ? (
                        <button 
                          onClick={() => { if(!isReadOnly) setModalAusencia(c); }} 
                          disabled={isReadOnly}
                          className="text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md hover:bg-rose-100 transition-colors"
                        >
                          {ausencias[c.id]?.motivo || 'Adicionar Justificativa...'}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Gestão de Leitos + Alertas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <GestaoLeitosCard
              leitosTotais={leitosTotais}
              ocupados={ocupados}
              bloqueados={bloqueados}
              onChangeOcupados={(v) => { setOcupados(v); registrarAtualizacao(); }}
              onChangeBloqueados={(v) => { setBloqueados(v); registrarAtualizacao(); }}
              isReadOnly={isReadOnly}
            />

            <AlertasUnidadeCard
              alertas={alertas}
              onNovoAlerta={abrirNovoAlerta}
              onEditarAlerta={abrirEditarAlerta}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Ação Final */}
          <div className="flex justify-end pt-4 border-t print:hidden mt-6">
            {!isReadOnly ? (
              <button onClick={enviarPlantao} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg hover:bg-indigo-700 flex items-center gap-2 transition-all active:scale-95">
                <Send size={18}/> Salvar e Finalizar Plantão
              </button>
            ) : (
              <div className="bg-slate-100 border border-slate-200 text-slate-600 font-bold px-8 py-3 rounded-xl flex items-center gap-3 w-full md:w-auto justify-center text-sm">
                 <Info size={18}/> Modo Leitura: Plantão Encerrado
              </div>
            )}
          </div>
          
        </div> /* Fecha a caixa branca do formulário */
      )} {/* Fecha a tela do formulário */}

      {/* Renderização dos Modais Invisíveis */}
      {modalAusencia && <ModalAusencia colaborador={modalAusencia} dados={ausencias[modalAusencia.id]} onSalvar={(d) => {setAusencias({...ausencias, [modalAusencia.id]: d}); setModalAusencia(null);}} onCancelar={() => setModalAusencia(null)} />}
      {modalAlerta && <ModalAlerta tipoDef={modalAlerta.tipoDef} dadosExistentes={modalAlerta.dadosExistentes} isEdicao={!!modalAlerta.uid} onSalvar={salvarAlerta} onRemover={removerAlerta} onCancelar={() => setModalAlerta(null)} />}
    
    </div> /* Fecha a tela inteira */
  );
}
