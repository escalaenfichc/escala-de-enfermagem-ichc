import React, { useState } from 'react';
import { ClipboardCheck, CalendarDays, User } from 'lucide-react';

// Como este ficheiro está na mesma pasta (src/pages), importamos assim:
import PlantaoDiario from './PlantaoDiario'; 
import PlanejamentoDiario from './PlanejamentoDiario';
import MeuPainel from './MeuPainel';

export default function DashboardChefia() {
  // Estado que controla qual aba aparece. Começa no 'meu_painel'
  const [abaAtiva, setAbaAtiva] = useState('meu_painel');

  return (
    <div className="flex flex-col h-full">
      {/* ── MENU DE ABAS ── */}
      <div className="bg-white border-b border-slate-200 mb-6 rounded-t-2xl px-6 print:hidden">
        <div className="flex gap-6">
          <button
            onClick={() => setAbaAtiva('meu_painel')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-colors ${
              abaAtiva === 'meu_painel' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <User size={18} />
            Meu Painel
          </button>

          <button
            onClick={() => setAbaAtiva('plantao')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-colors ${
              abaAtiva === 'plantao' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ClipboardCheck size={18} />
            Plantão Diário
          </button>

          <button
            onClick={() => setAbaAtiva('planejamento')}
            className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-colors ${
              abaAtiva === 'planejamento' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <CalendarDays size={18} />
            Planejamento Diário
          </button>
        </div>
      </div>

      {/* ── CONTEÚDO DA ABA SELECIONADA ── */}
      <div className="flex-1">
        {abaAtiva === 'meu_painel' && <MeuPainel setPagina={setAbaAtiva} />}
        {abaAtiva === 'plantao' && <PlantaoDiario setPagina={setAbaAtiva} />}
        {abaAtiva === 'planejamento' && <PlanejamentoDiario setPagina={setAbaAtiva} />}
      </div>
    </div>
  );
}