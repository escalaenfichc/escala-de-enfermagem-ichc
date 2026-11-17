import React from 'react';
import { FlaskConical, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { MODO_ATUAL, isNominal, AMBIENTE_LABEL, setModoOperacaoPreview } from '../config/ambiente';
import { useAuth } from '../contexts/AuthContext';

export default function BannerAmbiente() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrador' || user?.role === 'Diretor' || user?.email === 'admin@teste.com';

  if (!AMBIENTE_LABEL && !isAdmin) return null;

  const alternarModo = () => {
    const proximo = isNominal ? 'QUANTITATIVO' : 'NOMINAL';
    setModoOperacaoPreview(proximo);
  };

  return (
    <div
      className={`px-4 py-1.5 text-xs font-bold flex items-center justify-between gap-3 print:hidden border-b ${
        isNominal
          ? 'bg-amber-500 text-white border-amber-600'
          : 'bg-emerald-700 text-white border-emerald-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {isNominal ? <FlaskConical size={14} /> : <ShieldCheck size={14} />}
        <span>
          {isNominal
            ? AMBIENTE_LABEL || 'VERSÃO 1 · DEMONSTRAÇÃO NOMINAL (DADOS FICTÍCIOS)'
            : 'VERSÃO 2 · RUNDOWN QUANTITATIVO & SUPERVISÃO (SEM DADOS NOMINAIS)'}
        </span>
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={alternarModo}
          className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors"
          title="Alternar visualização entre V1 (Nominal Demo) e V2 (Rundown Produção)"
        >
          <ArrowLeftRight size={12} />
          Alternar para {isNominal ? 'V2 (Rundown)' : 'V1 (Demo Nominal)'}
        </button>
      )}
    </div>
  );
}
