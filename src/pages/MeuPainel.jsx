import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { CalendarDays, AlertTriangle, User, Clock, Loader2 } from 'lucide-react';

export default function MeuPainel() {
  const { user } = useAuth();
  
  const [colabGlobal, setColabGlobal] = useState(null);
  const [loading, setLoading] = useState(true);

  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const diasNoMes = new Date(anoSelecionado, mesSelecionado + 1, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  // Form de Férias/Folgas
  const [dia1, setDia1] = useState('');
  const [dia2, setDia2] = useState('');

  const [escalaDoMes, setEscalaDoMes] = useState(null);
  const [pedidosFolga, setPedidosFolga] = useState([]);
  const [historicoPedidos, setHistoricoPedidos] = useState([]);

  // 1. Efeito para buscar o COLABORADOR no Supabase
  useEffect(() => {
    const fetchColaborador = async () => {
      const matLogin = user?.matricula;
      if (!matLogin) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('matricula', String(matLogin))
        .maybeSingle();

      if (!error && data) {
        setColabGlobal({
          id: data.Matricula || data.matricula,
          nome: data.Nome_Completo || data.nome_completo,
          cargo: data.Categoria_Profissional || data.categoria_profissional,
          setor: data.Unidade_Alocacao || data.unidade_alocacao,
          matricula: data.Matricula || data.matricula
        });
      } else {
         // Fallback try in lowercase
         const { data: dataLow} = await supabase
           .from('colaboradores')
           .select('*')
           .eq('matricula', String(matLogin))
           .maybeSingle();
         if (dataLow) {
           setColabGlobal({
             id: dataLow.matricula, nome: dataLow.nome, cargo: dataLow.cargo, 
             setor: dataLow.setor, matricula: dataLow.matricula
           });
         }
      }
      setLoading(false);
    };

    fetchColaborador();
  }, [user]);

  // 2. Efeito para buscar a ESCALA (Supabase) e Pedidos (planejamento_turnos)
  useEffect(() => {
    const fetchEscala = async () => {
      if (!colabGlobal) return;
      
      const mes_ano = `${String(mesSelecionado + 1).padStart(2, '0')}-${anoSelecionado}`;
      const matricula = colabGlobal.matricula;

      // --- INÍCIO DA BUSCA INTELIGENTE DO PAINEL ---
      console.log("🚀 Buscando a escala mais recente para:", user?.matricula);
      
      const { data, error } = await supabase
        .from('escalas_mensais')
        .select('*')
        .eq('matricula_colaborador', String(matricula));

      if (error) {
        console.error("❌ Erro ao buscar escala do painel:", error);
      } else if (data && data.length > 0) {
        // Pega o último registro do array (geralmente o mais recente inserido)
        const escalaMaisRecente = data[data.length - 1]; 
        
        console.log("✅ Escala encontrada e carregada para o painel!", escalaMaisRecente);
        
        setEscalaDoMes({ 
            l1: escalaMaisRecente.grid1 || {}, 
            l2: escalaMaisRecente.grid2 || {}, 
            dh: escalaMaisRecente.updated_at || escalaMaisRecente.created_at || 'Publicada' 
        });
      } else {
        console.log("⚠️ Nenhuma escala encontrada para este colaborador.");
        setEscalaDoMes(null);
      }
      // --- FIM DA BUSCA INTELIGENTE ---

      // Buscar Pedidos no planejamento_turnos
      const { data: pedidosData } = await supabase
         .from('planejamento_turnos')
         .select('*')
         .eq('mes_ano', mes_ano)
         .eq('matricula_colaborador', String(matricula));
         
      if (pedidosData) {
         setPedidosFolga(pedidosData.map(p => ({
            id: p.id, dia: p.dia, status: p.status || 'Pendente'
         })));
      } else {
         setPedidosFolga([]);
      }

      // Buscar TODO o histórico de pedidos do colaborador
      const { data: todosPedidos } = await supabase
         .from('planejamento_turnos')
         .select('*')
         .eq('matricula_colaborador', String(matricula))
         .order('created_at', { ascending: false });

      if (todosPedidos) {
         setHistoricoPedidos(todosPedidos);
      }
    };
    
    fetchEscala();
  }, [mesSelecionado, anoSelecionado, colabGlobal]);

  const enviarPedidos = async (e) => {
    e.preventDefault();
    if (!colabGlobal) return;
    
    const mes_ano = `${String(mesSelecionado + 1).padStart(2, '0')}-${anoSelecionado}`;
    
    const insereDia = async (d) => {
      const idx = pedidosFolga.findIndex(x => parseInt(x.dia) === d);
      if (idx === -1) {
        await supabase.from('planejamento_turnos').insert({
           matricula_colaborador: String(colabGlobal.matricula),
           setor: colabGlobal.setor,
           mes_ano: mes_ano,
           dia: d,
           status: 'Pendente',
           tipo_pedido: 'Folga'
        });
      }
    };
    
    try {
       if (dia1) await insereDia(parseInt(dia1));
       if (dia2) await insereDia(parseInt(dia2));
       
       alert("Pedidos de folga enviados à Liderança!");
       setDia1(''); setDia2('');
       
       // Reload pedidos
       const { data: pedidosData } = await supabase
         .from('planejamento_turnos')
         .select('*')
         .eq('mes_ano', mes_ano)
         .eq('matricula_colaborador', String(colabGlobal.matricula));
       if (pedidosData) {
         setPedidosFolga(pedidosData.map(p => ({
            id: p.id, dia: p.dia, status: p.status || 'Pendente'
         })));
       }

       const { data: todosPedidos } = await supabase
         .from('planejamento_turnos')
         .select('*')
         .eq('matricula_colaborador', String(colabGlobal.matricula))
         .order('created_at', { ascending: false });
       if (todosPedidos) setHistoricoPedidos(todosPedidos);

    } catch(err) {
       console.error("Erro", err);
       alert("Erro ao enviar pedidos.");
    }
  };

  // Função para calcular o status do pedido baseado na escala oficial
  const calcularStatusPedido = (pedido, escala) => {
    if (!escala) return { status: 'Aguardando Escala', cor: 'bg-slate-200 text-slate-700' };
    
    // Na escala oficial (l1), os dias são chaves do objeto
    const valorNaEscala = escala.l1[pedido.dia] || escala.l1[pedido.dia.toString()];
    
    // Se não houver escala salva para aquele dia
    if (!valorNaEscala) return { status: 'Processando...', cor: 'bg-amber-100 text-amber-800' };

    // Regra de Negócio: F e DSR contam como folga atendida
    if (valorNaEscala === 'F' || valorNaEscala === 'DSR' || valorNaEscala === '-') {
        return { status: 'Atendido', cor: 'bg-emerald-100 text-emerald-800' };
    } else {
        return { status: 'Não Atendido', cor: 'bg-rose-100 text-rose-800' };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-500 font-medium">Buscando seus dados no sistema...</p>
      </div>
    );
  }

  if (!colabGlobal) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border text-center">
        <AlertTriangle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Colaborador não encontrado</h2>
        <p className="text-slate-500 mt-1">A matrícula {user?.matricula} não foi identificada no banco.</p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Esquerdo: Solicitar Folgas */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
          <CalendarDays size={32} className="text-indigo-600 mb-3" />
          <h3 className="text-lg font-bold text-slate-800 text-center mb-1">Pedidos de Folga</h3>
          <p className="text-xs text-slate-500 text-center mb-5">Selecione Mês/Ano abaixo e forneça a sua preferência de folga.</p>

          <div className="flex items-center gap-2 mb-6 bg-slate-100 p-2 rounded-xl">
             <select className="bg-transparent font-bold text-slate-700 outline-none" value={mesSelecionado} onChange={e => setMesSelecionado(parseInt(e.target.value))}>
               {nomeMeses.map((m, i) => <option key={i} value={i}>{m}</option>)}
             </select>
             <span className="font-medium text-slate-400">/</span>
             <select className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer" value={anoSelecionado} onChange={e => setAnoSelecionado(parseInt(e.target.value))}>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                <option value={new Date().getFullYear()+1}>{new Date().getFullYear()+1}</option>
             </select>
          </div>

          <form onSubmit={enviarPedidos} className="w-full space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label className="text-xs font-bold text-slate-600">Dia de Preferência 1</label>
              <select className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 mt-1" value={dia1} onChange={e=>setDia1(e.target.value)}>
                <option value="">Selecione um dia...</option>
                {dias.map(d => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Dia de Preferência 2 (Opcional)</label>
              <select className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 mt-1" value={dia2} onChange={e=>setDia2(e.target.value)}>
                <option value="">Nenhum...</option>
                {dias.map(d => <option key={d} value={d}>Dia {d}</option>)}
              </select>
            </div>
            <button type="submit" disabled={!dia1} className="w-full bg-indigo-600 text-white font-bold p-3 rounded-xl disabled:opacity-50 mt-4">Gravar Pedidos</button>
          </form>

          {pedidosFolga.length > 0 && (
            <div className="w-full mt-6 bg-amber-50 rounded-xl p-4 border border-amber-100">
               <h4 className="text-xs font-black text-amber-800 mb-2 flex items-center gap-1"><Clock size={12}/> Suas submissões neste mês:</h4>
               <ul className="text-xs text-amber-900 space-y-1">
                 {pedidosFolga.map((p, idx) => {
                   const resultado = calcularStatusPedido(p, escalaDoMes);
                   return (
                     <li key={idx} className="flex justify-between items-center border-b border-amber-200/50 pb-1 gap-2">
                       <span className="text-slate-700">Dia {p.dia}:</span>
                       <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resultado.cor}`}>
                         {resultado.status}
                       </span>
                     </li>
                   );
                 })}
               </ul>
            </div>
          )}
        </div>

        {/* Painel Direito: Escala */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Sua Escala Oficial de {nomeMeses[mesSelecionado]} {anoSelecionado}</h3>
           
           {!escalaDoMes && (
             <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <AlertTriangle className="mx-auto text-slate-400 mb-2" />
                <p className="text-slate-500 font-medium">A Escala deste mês ainda não foi Salva/Publicada pela sua liderança.</p>
                <p className="text-xs text-slate-400 mt-1">Acompanhe regularmente.</p>
             </div>
           )}

           {escalaDoMes && (
             <>
               <p className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded inline-block mb-4">Vigente (Atualizado em: {escalaDoMes.dh})</p>
               <div className="overflow-x-auto rounded-xl border border-slate-200">
                 <table className="w-full text-center border-collapse text-xs">
                   <thead className="bg-slate-100 border-b border-slate-200 text-slate-500">
                     <tr>
                       {dias.map(d => <th key={d} className="p-1 min-w-[32px] border-r">{d}</th>)}
                     </tr>
                   </thead>
                   <tbody>
                     {/* L1 */}
                     <tr>
                       {dias.map(d => {
                         const val = escalaDoMes.l1[d] || escalaDoMes.l1[d.toString()];
                         const isF = val === 'F' || val === 'DSR' || val === '-';
                         return <td key={d} className={`p-1.5 border-r border-b font-bold ${val && !isF ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>{val || '—'}</td>
                       })}
                     </tr>
                     {/* L2 */}
                     <tr className="bg-slate-50">
                       {dias.map(d => {
                         const val = escalaDoMes.l2[d] || escalaDoMes.l2[d.toString()];
                         return <td key={d} className="p-1 border-r text-[10px] text-slate-500 font-bold italic">{val || ''}</td>
                       })}
                     </tr>
                   </tbody>
                 </table>
               </div>
             </>
           )}
        </div>

      </div>

      {/* --- INÍCIO DA SEÇÃO DE HISTÓRICO --- */}
      <div className="mt-8">
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">
              Meu Histórico de Solicitações
          </h3>
          
          {historicoPedidos && historicoPedidos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historicoPedidos.map((pedido, index) => {
                      // Calcula o status usando a função auxiliar e a escala atual
                      // Nota: Aqui passamos a escalaDoMes, mas idealmente seria a escala do mês do pedido.
                      // Para este MVP, usamos a escala que está em memória.
                      const { status, cor } = calcularStatusPedido(pedido, escalaDoMes); 
                      
                      return (
                          <div key={pedido.id || index} className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-center mb-3">
                                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                                      {pedido.mes_ano || 'Período n/d'}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${cor}`}>
                                      {status}
                                  </span>
                              </div>
                              
                              <div className="space-y-2 text-sm text-slate-600">
                                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                      <span className="text-xs font-bold text-slate-400">DIA SOLICITADO:</span>
                                      <span className="font-black text-slate-700">
                                          {pedido.dia ? `Dia ${pedido.dia}` : 'Nenhum'}
                                      </span>
                                  </div>
                                  <div className="flex justify-between items-center px-2">
                                      <span className="text-[10px] font-bold text-slate-400">TIPO:</span>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                                          {pedido.tipo_pedido || 'Folga'}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          ) : (
              <div className="bg-slate-50 rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-300">
                  <Clock size={48} className="mx-auto mb-2 opacity-20" />
                  <p className="font-medium">Nenhum pedido de folga registrado no histórico.</p>
              </div>
          )}
      </div>
      {/* --- FIM DA SEÇÃO DE HISTÓRICO --- */}
    </>
  );
}