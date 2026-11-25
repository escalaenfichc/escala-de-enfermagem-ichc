import React, { useState, useEffect, Fragment } from "react";
import { CalendarDays, Filter, BarChart2, UserMinus, Building, UserPlus, ArrowRightLeft, ChevronLeft, ChevronRight, Edit2, Save, AlertTriangle, Trash2, X, Plus, ThumbsUp, ThumbsDown, Search, TrendingUp, User, Clock, Calendar, Eye, ShieldCheck, Settings, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RelatorioGerencial from '../components/RelatorioGerencial';
import { supabase } from '../supabase';

// Novos componentes para o perfil Plantão Assistencial
import PlantaoDiario from './PlantaoDiario';
import PlanejamentoDiario from './PlanejamentoDiario';
import MeuPainel from './MeuPainel';
import EscalaNominal from '../components/EscalaNominal';

// Módulo Rundown (V2 Quantitativo) e Supervisão Consolidada
import Rundown from './rundown/Rundown';
import AbaEscaladosUnidade from './rundown/AbaEscaladosUnidade';
import ConsolidadoSupervisao from './rundown/ConsolidadoSupervisao';
import CalendarioMensal from './rundown/CalendarioMensal';
import ConfigDimensionamentoAdmin from '../components/plantao/ConfigDimensionamentoAdmin';
import { isNominal, moduloVisivelNoModo } from '../config/ambiente';

// ─────────────────────────────────────────────────────────────────────────────
// FazerEscala (Double-row, coverage totals, alerts)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// AusenciasPage
// ─────────────────────────────────────────────────────────────────────────────
function AusenciasPage({ colaboradores, ausencias, setAusencias, user, filtroGlobalSetor }) {
  const dataAtual = new Date();
  const dataHojeInput = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth()+1).padStart(2,'0')}-${String(dataAtual.getDate()).padStart(2,'0')}`;
  const [matBusca,     setMatBusca]     = useState("");
  const [motivo,       setMotivo]       = useState("Atestado");
  const [dataAusencia, setDataAusencia] = useState(dataHojeInput);
  const [turnoAus,     setTurnoAus]     = useState("Manhã");
  const colabEncontrado = colaboradores.find(c => String(c.matricula) === String(matBusca));

  function handleSalvar(e) {
    e.preventDefault();
    if (!colabEncontrado) return alert("Colaborador não encontrado. Verifique a matrícula.");
    const [anoStr, mesStr, diaStr] = dataAusencia.split('-');
    const dataFormatada = `${diaStr}/${mesStr}/${anoStr}`;
    setAusencias(prev => [{ id: Date.now(), colaborador: colabEncontrado.nome, matricula: colabEncontrado.matricula, setor: colabEncontrado.setor, motivo, data: dataFormatada, turno: turnoAus }, ...prev]);
    alert("Ausência registrada!"); setMatBusca("");
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Gestão de Ausências</h2>
      
      {user?.role !== "Supervisão" && (
         <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 mb-8 shadow-inner animate-fade-in">
           <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2"><UserMinus size={18}/> Registrar Ausência</h3>
        <form onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div><label className="block text-xs font-bold text-rose-900 mb-1">Matrícula</label><input type="text" className="w-full border border-rose-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-rose-400" value={matBusca} onChange={e => setMatBusca(e.target.value)} placeholder="Ex: 1001" required/></div>
          <div className="md:col-span-2"><label className="block text-xs font-bold text-rose-900 mb-1">Motivo</label><select className="w-full border border-rose-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-400" value={motivo} onChange={e => setMotivo(e.target.value)}><option>Atestado</option><option>Falta Injustificada</option><option>Licença/Folga Extra</option></select></div>
          <div><label className="block text-xs font-bold text-rose-900 mb-1">Data</label><input type="date" className="w-full border border-rose-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-400" value={dataAusencia} onChange={e => setDataAusencia(e.target.value)} required/></div>
          <div><label className="block text-xs font-bold text-rose-900 mb-1">Turno</label><select className="w-full border border-rose-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-rose-400" value={turnoAus} onChange={e => setTurnoAus(e.target.value)}><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div>
          <div className="md:col-span-5 flex justify-end"><button type="submit" className="bg-rose-600 text-white font-bold px-8 py-2.5 rounded-xl hover:bg-rose-700 shadow-md">Registrar</button></div>
        </form>
      </div>
      )}

      <h3 className="font-bold text-slate-800 mb-4">Ausências Registradas</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b"><tr><th className="p-4">Colaborador</th><th className="p-4">Matrícula</th><th className="p-4">Setor</th><th className="p-4">Data/Turno</th><th className="p-4">Motivo</th></tr></thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {(() => {
               let ausenciasVisiveis = ausencias;
               if (user?.role === "Supervisão" && filtroGlobalSetor) ausenciasVisiveis = ausenciasVisiveis.filter(a => a.setor === filtroGlobalSetor);
               if (ausenciasVisiveis.length === 0) return <tr><td colSpan="5" className="p-6 text-center text-slate-400 italic">Nenhuma ausência registrada.</td></tr>;
               return ausenciasVisiveis.map((a, i) => (
                 <tr key={a.id || i} className="hover:bg-slate-50">
                   <td className="p-4 font-bold text-slate-800">{a.colaborador}</td>
                   <td className="p-4 text-slate-500 font-mono">{a.matricula}</td>
                   <td className="p-4"><span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-bold text-slate-600">{a.setor}</span></td>
                   <td className="p-4 text-slate-600 font-medium">{a.data} • {a.turno}</td>
                   <td className="p-4"><span className="text-rose-700 font-bold text-[10px] uppercase bg-rose-50 border border-rose-100 px-2 py-1 rounded-md">{a.motivo}</span></td>
                 </tr>
               ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SetoresConfigPage
// ─────────────────────────────────────────────────────────────────────────────
function SetoresConfigPage({ setores, setSetores, unidadeLogada }) {
  const setoresVisiveis = unidadeLogada ? setores.filter(s => s.nome === unidadeLogada) : setores;
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Setores e Parâmetros</h2>
      <p className="mb-6 text-slate-600 font-medium bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm">Apenas o perfil <span className="font-bold text-indigo-700">Administrativo</span> pode ajustar parâmetros de mínimos e leitos.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-sm">
          <thead><tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200"><th className="p-4">Setor</th><th className="p-4">Grupo</th><th className="p-4 text-center">Leitos Op.</th><th className="p-4 text-center">Mín. Enf.</th><th className="p-4 text-center">Mín. Tec.</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {setoresVisiveis.map((s, idx) => {
              const ri = setores.findIndex(x => x === s);
              const upd = (field, val) => { const n = [...setores]; n[ri] = { ...n[ri], [field]: parseInt(val)||0 }; setSetores(n); };
              return (
                <tr key={`${s.nome}-${idx}`} className="hover:bg-slate-50">
                  <td className="p-4 font-bold text-slate-800">{s.nome}</td>
                  <td className="p-4 text-sm text-slate-500">{s.grupo}</td>
                  <td className="p-4 text-center"><input type="number" disabled className="border border-slate-300 p-2 rounded-lg w-20 text-center bg-transparent border-transparent font-bold text-slate-700 outline-none" value={s.leitosOperacionais} onChange={e => upd('leitosOperacionais', e.target.value)}/></td>
                  <td className="p-4 text-center"><input type="number" disabled className="border border-slate-300 p-2 rounded-lg w-20 text-center bg-transparent border-transparent font-bold text-slate-700 outline-none" value={s.minEnf} onChange={e => upd('minEnf', e.target.value)}/></td>
                  <td className="p-4 text-center"><input type="number" disabled className="border border-slate-300 p-2 rounded-lg w-20 text-center bg-transparent border-transparent font-bold text-slate-700 outline-none" value={s.minTec} onChange={e => upd('minTec', e.target.value)}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GestaoColabPage
// ─────────────────────────────────────────────────────────────────────────────
const MOTIVOS_AFASTAMENTO = [
  "39-Alistamento Militar", "15-CAT", "26-Afastamento c/ vencimentos", "29-Afastamento s/ vencimentos", 
  "79-Compensação por decreto", "77-Convocação Eleitoral", "38-Convocação Judicial", "30-Doação de Sangue", 
  "19-Licença filho menor", "22-Falta Abonada", "06-Falta Injustificada", "20-Falta Justificada", 
  "87-Falta por greve transporte", "80-Folga de decreto", "77-Greve", "27-Licença Gala", 
  "18-Licença INSS irregular", "16-Licença Médica > 15 Dias", "17-Licença médica até 15 Dias", 
  "28-Licença Nojo", "11-Licença Paternidade", "05-Licença Prêmio", "14-Maternidade", 
  "81-Pagar horas greve", "31-Suspensão de contrato", "04-Suspensão Disciplinar"
];

function GestaoColabPage({ colaboradores, setColaboradores, unidadeLogada, user, filtroGlobalSetor }) {
  let lista = colaboradores; 
  const [colabEditando, setColabEditando] = useState(null);
  const [isNovo, setIsNovo] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");

  if (termoBusca) {
    const q = termoBusca.toLowerCase();
    lista = lista.filter(c => 
      ((c.nome_completo || c.nome || '').toLowerCase().includes(q)) || 
      (c.matricula && String(c.matricula).toLowerCase().includes(q)) || 
      ((c.categoria_profissional || c.cargo || '').toLowerCase().includes(q))
    );
  }

  const transferenciasPendentes = colaboradores.filter(c => c.setorDestino === unidadeLogada && c.statusTransferencia === 'Pendente');

  const aceitarTransferencia = async (colab) => {
    try {
      const matriculaStr = String(colab.matricula);
      const { error } = await supabase.from('colaboradores').update({
        unidade_alocacao: unidadeLogada,
        setorDestino: null,
        statusTransferencia: null
      }).eq('matricula', matriculaStr);

      if (error) throw error;

      setColaboradores(prev => prev.map(c => 
        String(c.matricula) === matriculaStr ? { ...c, unidade_alocacao: unidadeLogada, setor: unidadeLogada, setorDestino: null, statusTransferencia: null } : c
      ));
      alert(`${colab.nome || colab.nome_completo} foi integrado ao seu setor com sucesso no Supabase.`);
    } catch (error) {
      console.error("Erro ao aceitar transferência:", error);
      alert("Erro ao aceitar transferência. Verifique o console.");
    }
  };

  const recusarTransferencia = async (colab) => {
    try {
      const matriculaStr = String(colab.matricula);
      const { error } = await supabase.from('colaboradores').update({
        setorDestino: null,
        statusTransferencia: 'Recusada'
      }).eq('matricula', matriculaStr);

      if (error) throw error;

      setColaboradores(prev => prev.map(c => 
        String(c.matricula) === matriculaStr ? { ...c, setorDestino: null, statusTransferencia: 'Recusada' } : c
      ));
      alert(`Transferência de ${colab.nome || colab.nome_completo} foi recusada no banco de dados.`);
    } catch (error) {
      console.error("Erro ao recusar transferência:", error);
      alert("Erro ao recusar transferência.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(!colabEditando.matricula) return alert("Matrícula é obrigatória!");
    
    // Prepara o pacote de dados com mapeamento estrito às colunas do banco
    const payload = {
      matricula: String(colabEditando.matricula),
      nome_completo: colabEditando.nome_completo || colabEditando.nome,
      cargo: colabEditando.cargo || colabEditando.categoria_profissional,
      unidade_alocacao: colabEditando.setor || colabEditando.unidade_alocacao,
      status: 'Ativo'
    };

    try {
      const { error } = await supabase
        .from('colaboradores')
        .upsert(payload, { onConflict: 'matricula' });

      if (error) throw error;

      // Mantém o estado local completo para a UI, mas confirma o salvamento
      const colabCompleto = { ...colabEditando, ...payload };
      
      if (isNovo) {
        setColaboradores(prev => [...prev, colabCompleto]);
      } else {
        setColaboradores(prev => prev.map(c => String(c.matricula) === String(payload.matricula) ? colabCompleto : c));
      }
      
      setColabEditando(null);
      setIsNovo(false);
      alert("✅ Colaborador salvo com sucesso no banco de dados!");

    } catch (error) {
      console.error("Erro ao salvar no Supabase:", error);
      alert("Erro ao salvar no banco de dados: " + error.message);
    }
  };

  const handleDelete = async (colab) => {
    if (window.confirm(`Deseja excluir o colaborador "${colab.nome_completo || colab.nome}" (Mat. ${colab.matricula}) do banco de dados? Esta ação não pode ser desfeita.`)) {
      try {
        const { error } = await supabase
          .from('colaboradores')
          .delete()
          .eq('matricula', String(colab.matricula));

        if (error) throw error;

        setColaboradores(prev => prev.filter(c => String(c.matricula) !== String(colab.matricula)));
        alert("Colaborador excluído com sucesso.");
      } catch (error) {
        console.error("Erro ao deletar:", error);
        alert("Erro ao excluir do Supabase: " + error.message);
      }
    }
  };

  const openNew = () => {
    setColabEditando({
      matricula: "", nome: "", dataNascimento: "", cargo: "", contrato: "",
      dataAdmissao: "", turno: "", setor: unidadeLogada || "",
      horarioEspecial: "", motivoAfastamento: "", dataInicioAfastamento: "",
      quantidadeDiasAfastamento: 0, condicaoEspecial: "Nenhuma"
    });
    setIsNovo(true);
  };

  const openEdit = (c) => {
    setColabEditando({ ...c,
      setor: c.unidade_alocacao || c.setor, // Garante que o input recarregue o dado correto
      quantidadeDiasAfastamento: c.quantidadeDiasAfastamento ?? 0,
      condicaoEspecial: c.condicaoEspecial ?? 'Nenhuma'
    });
    setIsNovo(false);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
         <h2 className="text-2xl font-bold text-slate-800">Gestão de Colaboradores</h2>
         <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
           <div className="relative w-full sm:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <input type="text" placeholder="Buscar por Nome, Matrícula..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" value={termoBusca} onChange={e => setTermoBusca(e.target.value)} />
           </div>
           {user?.role !== "Supervisão" && (
              <button onClick={openNew} className="w-full sm:w-auto whitespace-nowrap bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors text-sm shadow-sm flex items-center justify-center gap-2">
                 <Plus size={16}/> Cadastrar Colaborador
              </button>
           )}
         </div>
      </div>

      {transferenciasPendentes.length > 0 && (
        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 animate-fade-in shadow-sm">
          <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2"><ArrowRightLeft size={16}/> Alertas de Transferência</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {transferenciasPendentes.map(t => (
              <div key={t.matricula} className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.nome_completo || t.nome}</p>
                  <p className="text-xs text-slate-500 mb-3 mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    Origem: <span className="font-bold text-indigo-700">{t.setor || t.unidade_alocacao}</span>
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => aceitarTransferencia(t)} className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-600 transition-all shadow-sm">Aceitar</button>
                  <button onClick={() => recusarTransferencia(t)} className="flex-1 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold py-2 rounded-lg hover:bg-rose-100 transition-all shadow-sm">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200"><tr>{["Mat.","Nome","Cargo","Setor","Turno","Contrato","Status", "Ações"].map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map(c => {
              const hoje = new Date();
              let badgeLabel = 'ATIVO';
              let badgeCls = 'bg-emerald-50 text-emerald-700 border-emerald-100';
              if (c.motivoAfastamento && c.dataInicioAfastamento && c.quantidadeDiasAfastamento) {
                const [sY, sM, sD] = c.dataInicioAfastamento.split('-').map(Number);
                const inicio = new Date(sY, sM - 1, sD);
                const fim = new Date(sY, sM - 1, sD + parseInt(c.quantidadeDiasAfastamento, 10) - 1);
                if (hoje >= inicio && hoje <= fim) {
                  badgeLabel = 'AFASTADO';
                  badgeCls = 'bg-amber-50 text-amber-700 border-amber-200';
                }
              }
              return (
                <tr key={c.matricula} className="hover:bg-slate-50">
                  <td className="p-4 font-mono text-slate-400">{c.matricula}</td>
                  <td className="p-4 font-bold text-slate-800">{c.nome_completo || c.nome}</td>
                  <td className="p-4 text-slate-600">{c.categoria_profissional || c.cargo}</td>
                  <td className="p-4 text-slate-600">{c.unidade_alocacao || c.setor}</td>
                  <td className="p-4 text-slate-600">{c.turno || c.turno_padrao}</td>
                  <td className="p-4"><span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded border border-indigo-100">{c.contrato || c.tipo_contrato}</span></td>
                  <td className="p-4"><span className={`text-xs font-bold px-2 py-0.5 rounded border ${badgeCls}`}>{badgeLabel}</span></td>
                  <td className="p-4">
                    {user?.role === "Supervisão" ? (
                      <span className="text-[10px] uppercase font-bold text-slate-400">Leitura</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} title="Editar" className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 rounded hover:bg-indigo-50"><Edit2 size={16}/></button>
                        <button onClick={() => handleDelete(c)} title="Excluir" className="text-rose-500 hover:text-rose-700 transition-colors p-1 rounded hover:bg-rose-50"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {colabEditando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden">
             <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2">
                  {isNovo ? <Plus size={20}/> : <Edit2 size={20}/>}
                  {isNovo ? 'Cadastrar Colaborador' : 'Editar Colaborador'}
                </h3>
                <button onClick={() => { setColabEditando(null); setIsNovo(false); }} className="hover:bg-indigo-700 p-1.5 rounded-full transition-colors"><X size={20}/></button>
             </div>
             <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[85vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Matrícula</label>
                    <input required disabled={!isNovo} type="text" className={`w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800 ${!isNovo ? 'bg-slate-100 text-slate-500' : ''}`} value={colabEditando.matricula || ''} onChange={e => setColabEditando({...colabEditando, matricula: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <input required type="text" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" value={colabEditando.nome_completo || colabEditando.nome || ''} onChange={e => setColabEditando({...colabEditando, nome_completo: e.target.value, nome: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Nasc.</label>
                    <input required type="date" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" value={colabEditando.dataNascimento || ''} onChange={e => setColabEditando({...colabEditando, dataNascimento: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Admissão</label>
                    <input required type="date" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" value={colabEditando.dataAdmissao || ''} onChange={e => setColabEditando({...colabEditando, dataAdmissao: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Função (Cargo)</label>
                    <input required type="text" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" value={colabEditando.cargo || colabEditando.categoria_profissional || ''} onChange={e => setColabEditando({...colabEditando, cargo: e.target.value, categoria_profissional: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contrato</label>
                    <select required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 focus:bg-indigo-50/30 text-sm font-semibold text-slate-800" value={colabEditando.contrato || colabEditando.tipo_contrato || ''} onChange={e => setColabEditando({...colabEditando, contrato: e.target.value, tipo_contrato: e.target.value})}>
                      <option value="">Selecione...</option>
                      <option value="HC30">HC30</option>
                      <option value="HC35">HC35</option>
                      <option value="HC40">HC40</option>
                      <option value="FFM40">FFM40</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turno de Trab.</label>
                    <select required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 focus:bg-indigo-50/30 text-sm font-semibold text-slate-800" value={colabEditando.turno || colabEditando.turno_padrao || ''} onChange={e => setColabEditando({...colabEditando, turno: e.target.value, turno_padrao: e.target.value})}>
                      <option value="">Selecione...</option><option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Diurno 12x36">Diurno 12x36</option><option value="Noturno 12x36">Noturno 12x36</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setor / Unidade</label>
                    <input required type="text" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 focus:bg-indigo-50/30 text-sm font-semibold text-slate-800" value={colabEditando.setor || ''} onChange={e => setColabEditando({...colabEditando, setor: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Condição Especial de Trabalho</label>
                  <select className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-indigo-500 focus:bg-indigo-50/30 text-sm font-semibold text-slate-800" value={colabEditando.condicaoEspecial || 'Nenhuma'} onChange={e => setColabEditando({...colabEditando, condicaoEspecial: e.target.value})}>
                    <option value="Nenhuma">Nenhuma</option>
                    <option value="Restrição de Trabalho Compatível (RTC)">Restrição de Trabalho Compatível (RTC)</option>
                    <option value="Gestante">Gestante</option>
                    <option value="Lactante">Lactante</option>
                  </select>
                </div>

                {(colabEditando.turno === 'Manhã' || colabEditando.turno === 'Tarde') && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                       <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded cursor-pointer" checked={!!colabEditando.horarioEspecial} onChange={e => setColabEditando({...colabEditando, horarioEspecial: e.target.checked ? "07h as 13h" : ""})} />
                       Possui horário especial?
                    </label>
                    {!!colabEditando.horarioEspecial && (
                       <input type="text" className="w-full mt-3 border border-slate-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-indigo-500" placeholder="Ex: 08h as 14h" value={colabEditando.horarioEspecial} onChange={e => setColabEditando({...colabEditando, horarioEspecial: e.target.value})} />
                    )}
                  </div>
                )}
                
                {!isNovo && (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-2 flex flex-col gap-3">
                    <h4 className="font-bold text-rose-800 text-sm">Incluir Afastamento</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                        <input type="date" className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-rose-500 text-sm font-semibold text-slate-800" value={colabEditando.dataInicioAfastamento || ''} onChange={e => setColabEditando({...colabEditando, dataInicioAfastamento: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo</label>
                        <select className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:border-rose-500 text-sm font-semibold text-slate-800" value={colabEditando.motivoAfastamento || ''} onChange={e => {
                          const motivo = e.target.value;
                          const diasPadrao = { '14': 120, '27': 8, '28': 8, '11': 5 };
                          const codigo = motivo.split('-')[0];
                          const precisaDigitar = ['16', '17'].includes(codigo);
                          const qtdAuto = diasPadrao[codigo] || 1;
                          setColabEditando({
                            ...colabEditando,
                            motivoAfastamento: motivo,
                            quantidadeDiasAfastamento: precisaDigitar ? (colabEditando.quantidadeDiasAfastamento || '') : qtdAuto
                          });
                        }}>
                          <option value="">Nenhum...</option>
                          {MOTIVOS_AFASTAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    {colabEditando.motivoAfastamento && (() => {
                      const cod = colabEditando.motivoAfastamento.split('-')[0];
                      const precisaDigitar = ['16', '17'].includes(cod);
                      return (
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Qtd. de Dias {precisaDigitar ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(preenchido automaticamente)</span>}
                          </label>
                          <input
                            type="number" min="1"
                            required={precisaDigitar}
                            readOnly={!precisaDigitar}
                            className={`w-full border p-2.5 rounded-xl outline-none text-sm font-semibold text-slate-800 ${
                              precisaDigitar ? 'border-rose-400 focus:border-rose-600 bg-white' : 'border-slate-200 bg-slate-100 text-slate-500'
                            }`}
                            value={colabEditando.quantidadeDiasAfastamento || ''}
                            onChange={e => precisaDigitar && setColabEditando({...colabEditando, quantidadeDiasAfastamento: parseInt(e.target.value) || ''})}
                            placeholder={precisaDigitar ? 'Informe os dias...' : ''}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
                  <button type="button" onClick={() => { setColabEditando(null); setIsNovo(false); }} className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors text-sm">Cancelar</button>
                  <button type="submit" className="bg-indigo-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-indigo-700 shadow-sm transition-colors text-sm">{isNovo ? 'Cadastrar Colaborador' : 'Salvar Alterações'}</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}

// PlanejamentoQuantPage removido — substituído por CalendarioMensal conectado às tabelas reais

// ─────────────────────────────────────────────────────────────────────────────
// RemanejamentoTab
// ─────────────────────────────────────────────────────────────────────────────

function RemanejamentoTab({ colaboradores, user, filtroGlobalSetor, setores }) {
  const dataAtual = new Date();
  const dataHojeInput = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth()+1).padStart(2,'0')}-${String(dataAtual.getDate()).padStart(2,'0')}`;
  
  const [matColab, setMatColab] = useState("");
  const [destino, setDestino] = useState("");
  const [dataRem, setDataRem] = useState(dataHojeInput);
  const [turnoRem, setTurnoRem] = useState("Manhã");
  const [motivoRem, setMotivoRem] = useState("");
  const [remanejamentos, setRemanejamentos] = useState([]);

  const colabEncontrado = matColab ? colaboradores.find(c => String(c.matricula) === String(matColab)) : null;

  function handleSalvar(e) {
    e.preventDefault();
    if (!colabEncontrado) return alert("Selecione um colaborador válido.");
    if (!destino) return alert("Selecione o setor de destino.");
    
    const [anoStr, mesStr, diaStr] = dataRem.split('-');
    const diaF = parseInt(diaStr, 10);
    const mesF = parseInt(mesStr, 10) - 1;
    const anoF = parseInt(anoStr, 10);
    const dataFormatada = `${String(diaF).padStart(2, '0')}/${String(mesF + 1).padStart(2, '0')}/${anoF}`;

    setRemanejamentos(prev => [{
      id: Date.now(),
      colaborador: colabEncontrado.nome || colabEncontrado.nome_completo,
      matricula: colabEncontrado.matricula,
      origem: colabEncontrado.setor || colabEncontrado.unidade_alocacao,
      destino,
      data: dataFormatada,
      dia: diaF, mes: mesF, ano: anoF,
      turno: turnoRem,
      motivo: motivoRem || "Necessidade do Serviço"
    }, ...prev]);

    alert("Remanejamento registrado com sucesso!");
    setMatColab(""); setDestino(""); setMotivoRem("");
  }

  const [anoH, mesH, diaH] = dataHojeInput.split('-').map(Number);
  const remsHoje = remanejamentos.filter(r => r.dia === diaH && r.mes === (mesH - 1) && r.ano === anoH);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
       <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowRightLeft className="text-indigo-600" /> Remanejamento de Colaboradores</h2>
       
       {user?.role !== "Plantão Assistencial" && (
          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8 shadow-inner animate-fade-in">
            <h3 className="font-bold text-indigo-800 mb-4">Registrar Novo Remanejamento</h3>
            <form onSubmit={handleSalvar} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-indigo-900 mb-1">Selecionar Colaborador</label>
                <select className="w-full border border-indigo-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400" value={matColab} onChange={e => setMatColab(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {colaboradores.filter(c => (c.condicao_especial || c.condicaoEspecial) !== "Inativo").map(c => <option key={c.matricula} value={c.matricula}>{c.nome_completo || c.nome} ({c.categoria_profissional || c.cargo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Origem (Atual)</label>
                <input type="text" className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-100 text-slate-500 font-bold outline-none" value={colabEncontrado ? (colabEncontrado.setor || colabEncontrado.unidade_alocacao) : ""} disabled />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Destino</label>
                <select className="w-full border border-indigo-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400" value={destino} onChange={e => setDestino(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {setores.filter(s => !colabEncontrado || s.nome !== (colabEncontrado.setor || colabEncontrado.unidade_alocacao)).map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <div className="flex gap-2 w-full">
                   <div className="flex-1">
                     <label className="block text-xs font-bold text-indigo-900 mb-1">Data</label>
                     <input type="date" className="w-full border border-indigo-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400" value={dataRem} onChange={e => setDataRem(e.target.value)} required />
                   </div>
                   <div className="flex-1">
                     <label className="block text-xs font-bold text-indigo-900 mb-1">Turno</label>
                     <select className="w-full border border-indigo-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400" value={turnoRem} onChange={e => setTurnoRem(e.target.value)} required>
                       <option value="Manhã">Manhã</option><option value="Tarde">Tarde</option><option value="Noite">Noite</option>
                     </select>
                   </div>
                </div>
              </div>
              <div className="md:col-span-5">
                <label className="block text-xs font-bold text-indigo-900 mb-1">Motivo (Opcional)</label>
                <input type="text" className="w-full border border-indigo-200 p-2.5 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-400" value={motivoRem} onChange={e => setMotivoRem(e.target.value)} placeholder="Ex: Cobrir furo de escala, Alta demanda, etc." />
              </div>
              <div className="md:col-span-1 flex justify-end">
                <button type="submit" className="bg-indigo-600 text-white font-bold w-full py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md">Confirmar</button>
              </div>
            </form>
          </div>
       )}

       <h3 className="font-bold text-slate-800 mb-4">Remanejamentos Realizados (Hoje)</h3>
       <div className="overflow-x-auto rounded-xl border border-slate-200">
         <table className="w-full text-left border-collapse text-sm">
           <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
             <tr><th className="p-4">Colaborador</th><th className="p-4">De (Origem)</th><th className="p-4">Para (Destino)</th><th className="p-4">Data/Turno</th><th className="p-4">Motivo</th></tr>
           </thead>
           <tbody className="divide-y divide-slate-100 bg-white">
             {remsHoje.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-slate-500 italic">Nenhum remanejamento registrado para a data de hoje.</td></tr>}
             {remsHoje.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                   <td className="p-4 font-bold text-slate-800">{r.colaborador}</td>
                   <td className="p-4 text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{r.origem}</span></td>
                   <td className="p-4 text-emerald-600 font-bold"><span className="bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-200">{r.destino}</span></td>
                   <td className="p-4 text-slate-600 font-medium">{r.data} • {r.turno}</td>
                   <td className="p-4 text-xs italic text-slate-400">{r.motivo}</td>
                </tr>
             ))}
           </tbody>
         </table>
       </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function Planejamento() {
  const { user, filtroGlobalSetor } = useAuth();
  const unidadeLogada = user?.unidadeLogada || "";
  const userRole = user?.role || "";
  
  const userRoles = [user?.role, user?.perfil_secundario].filter(Boolean);

  const perfisGlobais = ['Diretor', 'Supervisão', 'Supervisão Plantonista', 'Secretaria', 'Administrador'];
  const perfisLocais = ['Colaborador', 'Enf. Assistencial', 'Enf. Liderança 1', 'Enf. Liderança 2'];

  const dataAtual = new Date();
  const [setores,        setSetores]       = useState([]);
  const [colaboradores,  setColaboradores] = useState([]);
  const [escalaNominal,  setEscalaNominal] = useState([]);
  const [ausencias,      setAusencias]     = useState([]);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingDados, setLoadingDados] = useState(true);

  useEffect(() => {
    if (userRoles.length > 0) {
      setLoadingAuth(false);
    }
  }, [userRoles.length]);

  useEffect(() => {
    if (loadingAuth || userRoles.length === 0) return;

    const isGlobal = userRoles.some(role => perfisGlobais.includes(role));
    const isLocalOnly = !isGlobal;

    if (isLocalOnly && !unidadeLogada) {
      setLoadingDados(false);
      return;
    }

    async function carregarDados() {
      setLoadingDados(true);
      try {
        const { data: sData } = await supabase.from('setores_unidades').select('*');
        if (sData) setSetores(sData);

        // No modo QUANTITATIVO (V2 Rundown), NÃO consulta a tabela colaboradores.
        if (!isNominal) {
          setColaboradores([]);
          setLoadingDados(false);
          return;
        }

        // --- BUSCA SEGURA E AMPLA (Modo Nominal V1) ---
        setLoadingDados(true);
        console.log("🚀 Buscando dados (Limite 5000 ativos)...");
        
        const { data, error } = await supabase
          .from('colaboradores')
          .select('*')
          .ilike('status', '%ativo%')
          .limit(5000); // Ultrapassa o limite de 1000 do Supabase

        if (error) {
          console.error("❌ ERRO DO SUPABASE AO CARREGAR:", error.message);
        } else {
          console.log("✅ DADOS RECEBIDOS DO BANCO:", data?.length);
        }
        // --- FIM DA BUSCA SEGURA ---

        if (data) {
          // Mapeamento para camelCase (usado no restante deste componente)
          const colaboradoresFormatados = data.map(c => ({
            matricula: c.Matricula || c.matricula,
            nome: c.Nome_Completo || c.nome_completo,
            nome_completo: c.Nome_Completo || c.nome_completo,
            categoria_profissional: c.Categoria_Profissional || c.categoria_profissional,
            cargo: c.Categoria_Profissional || c.categoria_profissional,
            unidade_alocacao: c.Unidade_Alocacao || c.unidade_alocacao,
            setor: c.Unidade_Alocacao || c.unidade_alocacao,
            vinculo: c.Vinculo || c.vinculo,
            turno_padrao: c.Turno_Padrao || c.turno_padrao,
            contrato: c.Vinculo || c.vinculo || c.Contrato || c.contrato,
            status: c.Status_Atual || c.Status || c.status_atual || c.status || 'Ativo',
            dataNascimento: c.Data_Nascimento || c.data_nascimento,
            dataAdmissao: c.Data_Admissao || c.data_admissao,
            cargaHoraria: c.Carga_Horaria_Mensal || c.carga_horaria_mensal || 0,
            motivoAfastamento: c.Motivo_Afastamento || c.motivoAfastamento,
            dataInicioAfastamento: c.Data_Inicio_Afastamento || c.dataInicioAfastamento,
            quantidadeDiasAfastamento: c.Quantidade_Dias_Afastamento || c.quantidadeDiasAfastamento || 0,
            condicaoEspecial: c.Condicao_Especial || c.condicaoEspecial || 'Nenhuma'
          }));

          // Filtrar apenas ativos
          let listaFinal = colaboradoresFormatados.filter(c => 
            (c.status || '').toLowerCase().includes('ativo')
          );

          // Filtrar por setor (Unidade de Alocação)
          if (isLocalOnly) {
            listaFinal = listaFinal.filter(c => (c.unidade_alocacao || '').toUpperCase() === (unidadeLogada || '').toUpperCase());
          } else if (isGlobal && filtroGlobalSetor && filtroGlobalSetor !== 'Todos') {
            listaFinal = listaFinal.filter(c => (c.unidade_alocacao || '').toUpperCase() === (filtroGlobalSetor || '').toUpperCase());
          }
          
          const isOnlySupervisao = isGlobal && !userRoles.includes('Administrador') && !userRoles.includes('Diretor');
          
          if (isOnlySupervisao) {
              listaFinal = listaFinal.filter(c => {
                 const cat = c.categoria_profissional || "";
                 return !cat.includes('Enfermeir') && !cat.includes('Liderança') && !cat.includes('Assistencial');
              });
          }
          
          setColaboradores(listaFinal);
        }
      } catch (err) {
        console.error('Exceção ao carregar dados:', err);
      } finally {
        setLoadingDados(false);
      }
    }
    carregarDados();
  }, [unidadeLogada, JSON.stringify(userRoles), filtroGlobalSetor, loadingAuth]);

  // Tela inicial padrão conforme Modo de Operação (V1 Nominal vs V2 Quantitativo/Rundown)
  const navigate = useNavigate();
  const isGestorAltoNivel = user?.role === 'Administrador' || user?.role === 'Diretor';
  const isSupervisao = (user?.role || '').includes('Supervisão');

  const abaInicial = !isNominal
    ? 'OPERACIONAL'
    : (isGestorAltoNivel ? 'OPERACIONAL' : 'MEU_PAINEL');

  const moduloInicial = !isNominal
    ? (isSupervisao ? 'supervisao_rundown' : 'rundown')
    : (isGestorAltoNivel ? 'escala_nominal' : 'meu_painel');

  const [abaPrincipal, setAbaPrincipal] = useState(abaInicial);
  const [moduloAtivo, setModuloAtivo] = useState(moduloInicial);
  const [setorSelecionado, setSetorSelecionado] = useState(user?.unidadeLogada || 'Global');

  const ROLES_OPERACIONAIS_TODOS = [
    'Unidade',
    'Colaborador',
    'Plantão Assistencial',
    'Enf. Assistencial',
    'Liderança',
    'Liderança 1',
    'Enf. Liderança 1',
    'Liderança 2',
    'Enf. Liderança 2',
    'Supervisão',
    'Supervisão Plantonista',
    'Diretor',
    'Administrador',
    'Administrativo',
  ];

  const TODOS_MODULOS = [
    // Módulos Quantitativos / Compartilhados (acima do card, limpos e sem duplicidade)
    { id: "rundown", label: "Supervisão", icon: <Clock size={16}/>, allowedRoles: ROLES_OPERACIONAIS_TODOS, categoria: 'OPERACIONAL', modo: 'AMBOS' },
    { id: "escala", label: "Escala Mensal", icon: <CalendarDays size={16}/>, allowedRoles: ROLES_OPERACIONAIS_TODOS, categoria: 'OPERACIONAL', modo: 'AMBOS' },
    { id: "inserir_escala", label: "Inserir Escala", icon: <UserPlus size={16}/>, allowedRoles: ROLES_OPERACIONAIS_TODOS, categoria: 'OPERACIONAL', modo: 'AMBOS' },
    { id: "supervisao_rundown", label: "Supervisão Consolidada", icon: <Globe size={16}/>, allowedRoles: ['Supervisão', 'Supervisão Plantonista', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador', 'Administrativo'], categoria: 'OPERACIONAL', modo: 'AMBOS' },
    { id: "dimensionamento_op", label: "Config. Leitos e Necessários", icon: <Settings size={16}/>, allowedRoles: ['Supervisão', 'Diretor', 'Administrador', 'Administrativo'], categoria: 'OPERACIONAL', modo: 'AMBOS' },

    // Módulos Exclusivos da Versão 1 (Nominal)
    { id: "meu_painel", label: "Meu Painel", icon: <User size={16}/>, allowedRoles: ['ALL'], categoria: 'MEU_PAINEL', modo: 'NOMINAL' },
    { id: "plantao_diario", label: "Plantão Diário (Nominal)", icon: <Clock size={16}/>, allowedRoles: ['Plantão Assistencial', 'Enf. Assistencial', 'Liderança 1', 'Enf. Liderança 1', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "planejamento_diario", label: "Planejamento Diário", icon: <Calendar size={16}/>, allowedRoles: ['Plantão Assistencial', 'Liderança 1', 'Enf. Liderança 1', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "escala_nominal", label: "Fazer Escala (Nominal)", icon: <CalendarDays size={16}/>, allowedRoles: ['Liderança 1', 'Enf. Liderança 1', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "ausencias", label: "Ausências (Nominal)", icon: <UserMinus size={16}/>, allowedRoles: ['Liderança 1', 'Enf. Liderança 1', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "remanejamento", label: "Remanejamento (Nominal)", icon: <ArrowRightLeft size={16}/>, allowedRoles: ['Liderança 1', 'Enf. Liderança 1', 'Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "gestao_colab", label: "Gestão de Colab.", icon: <UserPlus size={16}/>, allowedRoles: ['Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Secretaria', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "relatorio", label: "Relatório Gerencial", icon: <TrendingUp size={16}/>, allowedRoles: ['Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'OPERACIONAL', modo: 'NOMINAL' },
    { id: "setores", label: "Setores Config.", icon: <Building size={16}/>, allowedRoles: ['Liderança 2', 'Enf. Liderança 2', 'Diretor', 'Administrador'], categoria: 'ESTRATEGICO', modo: 'AMBOS' },
    { id: "visao_estrategica", label: "Visão Estratégica", icon: <Eye size={16}/>, allowedRoles: ['Diretor', 'Administrador'], categoria: 'ESTRATEGICO', modo: 'NOMINAL' },
    { id: "auditoria", label: "Auditoria de Escalas", icon: <ShieldCheck size={16}/>, allowedRoles: ['Diretor', 'Administrador'], categoria: 'ESTRATEGICO', modo: 'NOMINAL' },
    { id: "dimensionamento", label: "Config. Dimensionamento", icon: <Settings size={16}/>, allowedRoles: ['Diretor', 'Administrador'], categoria: 'ESTRATEGICO', modo: 'AMBOS' },
    { id: "dashboard_global", label: "Dashboard Global", icon: <Globe size={16}/>, allowedRoles: ['Diretor', 'Administrador'], categoria: 'ESTRATEGICO', modo: 'AMBOS' },
  ];

  const isAdmin = userRoles.includes('Administrador') || userRoles.includes('Administrativo');
  const modulosPermitidos = TODOS_MODULOS.filter(modulo => 
    moduloVisivelNoModo(modulo.modo) &&
    (isAdmin || modulo.allowedRoles.includes('ALL') || userRoles.some(role => modulo.allowedRoles.includes(role)))
  );
  if (loadingAuth || loadingDados) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
          <p className="text-slate-500 font-medium">
            {loadingAuth ? 'Validando perfil de acesso (RBAC)...' : 'Carregando colaboradores do setor via Supabase...'}
          </p>
          <p className="text-slate-400 text-sm mt-1">{unidadeLogada || 'Verificando unidade...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
        {/* Nível 1: Abas Principais */}
        <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-200 pb-2 hide-on-print">
           {isNominal && (
             <button onClick={() => { setAbaPrincipal('MEU_PAINEL'); setModuloAtivo('meu_painel'); }} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors flex items-center gap-2 ${abaPrincipal === 'MEU_PAINEL' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                <User size={16} />
                Meu Painel
             </button>
           )}
           
           <button onClick={() => { 
              setAbaPrincipal('OPERACIONAL'); 
              setModuloAtivo(!isNominal ? 'rundown' : (user?.role === 'Plantão Assistencial' ? 'plantao_diario' : 'escala_nominal')); 
           }} className={`px-4 py-2 font-bold text-sm rounded-t-lg transition-colors flex items-center gap-2 ${abaPrincipal === 'OPERACIONAL' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <CalendarDays size={16} />
              {isNominal ? 'Gestão Operacional' : 'Supervisão'}
           </button>
        </div>

        {/* Nível 2: Submódulos da Aba Selecionada */}
        {abaPrincipal !== 'MEU_PAINEL' && (
          <div className="flex flex-wrap gap-2 mb-6 hide-on-print">
             {modulosPermitidos.filter(m => m.categoria === abaPrincipal).map(modulo => (
                <button 
                   key={modulo.id} 
                   onClick={() => setModuloAtivo(modulo.id)}
                   className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      moduloAtivo === modulo.id 
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 shadow-indigo-200' 
                      : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
                   }`}
                >
                   {modulo.icon}
                   {modulo.label}
                </button>
             ))}
          </div>
        )}

        {/* ========================================== */}
        {/* FILTRO GLOBAL DE SETOR (Visual Consistente)*/}
        {/* ========================================== */}
        {abaPrincipal === 'OPERACIONAL' && isGestorAltoNivel && user?.setores?.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center gap-6 hide-on-print">
            
            {/* Bloco do Ícone */}
            <div className="flex items-center gap-2 text-indigo-600 font-bold pr-6 border-r border-slate-200">
              <Filter size={20} />
              <span className="text-sm">Filtros</span>
            </div>
            
            {/* Bloco do Select */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Setor</label>
              <select
                value={setorSelecionado}
                onChange={(e) => setSetorSelecionado(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-indigo-600 focus:border-indigo-600 block px-3 py-2 font-bold cursor-pointer min-w-[280px] shadow-sm transition-all"
              >
                <option value="Global">Visão Global (Todos os Setores)</option>
                {user.setores.map((setor, index) => (
                  <option key={`setor-dropdown-${index}`} value={setor}>
                    {setor}
                  </option>
                ))}
              </select>
            </div>

          </div>
        )}

      {/* Módulos Quantitativos (V2 Rundown + Supervisão, disponíveis também na V1) */}
      {moduloAtivo === "rundown" && <Rundown setorFiltro={setorSelecionado} />}
      {moduloAtivo === "inserir_escala" && <AbaEscaladosUnidade setorFiltro={setorSelecionado} />}
      {moduloAtivo === "supervisao_rundown" && <ConsolidadoSupervisao />}
      {moduloAtivo === "dimensionamento_op" && <ConfigDimensionamentoAdmin />}

      {isNominal && moduloAtivo === "escala_nominal" &&
        <EscalaNominal
          colaboradores={colaboradores} 
          setColaboradores={setColaboradores}
          escalaNominal={escalaNominal} 
          setEscalaNominal={setEscalaNominal}
          ausencias={ausencias} 
          unidadeLogada={setorSelecionado}
        />
      }
      {moduloAtivo === "escala"       && <CalendarioMensal setorFiltro={setorSelecionado} />}
      {isNominal && moduloAtivo === "ausencias"    && <AusenciasPage colaboradores={colaboradores} ausencias={ausencias} setAusencias={setAusencias} user={user} filtroGlobalSetor={filtroGlobalSetor} />}
      {moduloAtivo === "setores"      && <SetoresConfigPage setores={setores} setSetores={setSetores} unidadeLogada={unidadeLogada} />}
      {isNominal && moduloAtivo === "gestao_colab" && <GestaoColabPage colaboradores={colaboradores} setColaboradores={setColaboradores} unidadeLogada={unidadeLogada} user={user} filtroGlobalSetor={filtroGlobalSetor}/>}
      {isNominal && moduloAtivo === "remanejamento" && <RemanejamentoTab colaboradores={colaboradores} user={user} filtroGlobalSetor={filtroGlobalSetor} setores={setores} />}
      {isNominal && moduloAtivo === "relatorio" && <RelatorioGerencial colaboradores={colaboradores} ausencias={ausencias} unidadeLogada={unidadeLogada} />}
      
      {/* Novas páginas do perfil Plantão Assistencial (Somente V1 Nominal) */}
      {isNominal && moduloAtivo === "meu_painel" && <MeuPainel setPagina={setModuloAtivo} />}
      {isNominal && moduloAtivo === "plantao_diario" && <PlantaoDiario setPagina={setModuloAtivo} setorFiltro={setorSelecionado} />}
      {isNominal && moduloAtivo === "planejamento_diario" && <PlanejamentoDiario setPagina={setModuloAtivo} setorFiltro={setorSelecionado} />}
    </div>
  );
}