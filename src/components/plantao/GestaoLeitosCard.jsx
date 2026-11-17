import React from 'react';
import { BedDouble } from 'lucide-react';

export default function GestaoLeitosCard({
  leitosTotais = 30,
  ocupados = 0,
  bloqueados = 0,
  onChangeOcupados,
  onChangeBloqueados,
  isReadOnly = false,
}) {
  const leitosVagos = leitosTotais - (Number(ocupados || 0) + Number(bloqueados || 0));
  const excedeu = leitosVagos < 0;

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
          <BedDouble className="text-indigo-500" /> Gestão de Leitos
        </h3>
        {excedeu && (
          <span className="text-[11px] font-bold bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full">
            Ocupados + Bloqueados excedem a capacidade ({leitosTotais})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500 text-xs font-bold uppercase">Leitos Totais</p>
          <p className="text-3xl font-black text-slate-800 mt-2">{leitosTotais}</p>
        </div>
        <div
          className={`p-4 rounded-xl shadow-sm border text-center ${
            excedeu
              ? 'bg-rose-50 border-rose-200'
              : 'bg-emerald-50 border-emerald-100'
          }`}
        >
          <p
            className={`text-xs font-bold uppercase ${
              excedeu ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            Leitos Vagos
          </p>
          <p
            className={`text-3xl font-black mt-2 ${
              excedeu ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {Math.max(0, leitosVagos)}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100 text-center">
          <p className="text-blue-700 text-xs font-bold uppercase mb-2">Ocupados</p>
          <input
            disabled={isReadOnly}
            type="number"
            min="0"
            className="w-full text-center text-2xl font-black text-blue-800 border-none bg-white p-2 rounded-lg shadow-inner outline-none focus:ring-2 focus:ring-blue-400"
            value={ocupados}
            onChange={(e) => onChangeOcupados(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
        <div className="bg-rose-50 p-4 rounded-xl shadow-sm border border-rose-100 text-center">
          <p className="text-rose-700 text-xs font-bold uppercase mb-2">Bloqueados</p>
          <input
            disabled={isReadOnly}
            type="number"
            min="0"
            className="w-full text-center text-2xl font-black text-rose-800 border-none bg-white p-2 rounded-lg shadow-inner outline-none focus:ring-2 focus:ring-rose-400"
            value={bloqueados}
            onChange={(e) => onChangeBloqueados(Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
      </div>
    </div>
  );
}
