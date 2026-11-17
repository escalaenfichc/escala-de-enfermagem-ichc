import React, { useState, useRef } from 'react';
import { AlertCircle, Plus, ChevronDown, ShieldAlert, Info } from 'lucide-react';
import { TIPOS_ALERTA } from './constantes';

export default function AlertasUnidadeCard({
  alertas = [],
  onNovoAlerta,
  onEditarAlerta,
  isReadOnly = false,
}) {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropRef = useRef(null);

  const resolverTipoDef = (alerta) => {
    const id = alerta?.tipoDef?.id || alerta?.tipoId;
    return TIPOS_ALERTA.find((t) => t.id === id) || alerta?.tipoDef || TIPOS_ALERTA[5];
  };

  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
            <AlertCircle className="text-orange-500" /> Alertas da Unidade
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Registre situações que requerem atenção da supervisão (apenas números de leitos).
          </p>
        </div>

        <div className="relative print:hidden" ref={dropRef}>
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => setDropdownAberto((v) => !v)}
            className="flex items-center gap-2 bg-orange-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors text-sm shadow-sm disabled:opacity-50"
          >
            <Plus size={16} /> Incluir Alerta{' '}
            <ChevronDown
              size={14}
              className={`transition-transform ${dropdownAberto ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownAberto && !isReadOnly && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 min-w-[230px] overflow-hidden">
              {TIPOS_ALERTA.map((tipo) => {
                const Icon = tipo.icon;
                const count = alertas.filter(
                  (a) => (a.tipoDef?.id || a.tipoId) === tipo.id
                ).length;
                return (
                  <button
                    type="button"
                    key={tipo.id}
                    onClick={() => {
                      setDropdownAberto(false);
                      onNovoAlerta(tipo);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-orange-50 text-left transition-colors border-b border-slate-100 last:border-0 ${
                      count > 0 ? 'text-orange-600' : 'text-slate-700'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={count > 0 ? 'text-orange-500' : 'text-slate-400'}
                    />{' '}
                    {tipo.label}
                    {count > 0 && (
                      <span className="ml-auto bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8">
          <ShieldAlert size={36} className="mb-2" />
          <p className="text-sm font-medium">Nenhum alerta registrado</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-48 pr-1">
          {alertas.map((a) => {
            const tipoDef = resolverTipoDef(a);
            const Icon = tipoDef.icon || Info;
            const dados = a.dados || {};
            const resumo =
              dados.leitosPaciente ||
              dados.quaisLeitos ||
              dados.materialDescricao ||
              dados.textoLivre ||
              '';
            const clsMap = {
              isolamento: {
                bg: 'bg-orange-50',
                border: 'border-orange-200',
                text: 'text-orange-800',
                iconBg: 'bg-orange-100',
                iconText: 'text-orange-600',
                badgeBg: 'bg-orange-200',
              },
              material: {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-800',
                iconBg: 'bg-red-100',
                iconText: 'text-red-600',
                badgeBg: 'bg-red-200',
              },
              leitos: {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-800',
                iconBg: 'bg-blue-100',
                iconText: 'text-blue-600',
                badgeBg: 'bg-blue-200',
              },
              livre: {
                bg: 'bg-slate-50',
                border: 'border-slate-200',
                text: 'text-slate-800',
                iconBg: 'bg-slate-100',
                iconText: 'text-slate-600',
                badgeBg: 'bg-slate-200',
              },
            };
            const c = clsMap[tipoDef.tipo] || clsMap.livre;

            return (
              <div
                key={a.uid}
                className={`flex items-start gap-3 ${c.bg} border ${c.border} p-3 rounded-xl transition-all`}
              >
                <div className={`${c.iconBg} p-2 rounded-lg ${c.iconText} mt-0.5`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${c.text}`}>{tipoDef.label}</p>
                    {tipoDef.tipo === 'isolamento' && dados.tipoIsolamento && (
                      <span
                        className={`${c.badgeBg} ${c.text} text-[10px] px-2 py-0.5 rounded-full font-bold truncate`}
                      >
                        {dados.tipoIsolamento}
                      </span>
                    )}
                  </div>
                  {resumo && (
                    <p className={`text-xs ${c.iconText} truncate mt-0.5`}>{resumo}</p>
                  )}
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onEditarAlerta({ ...a, tipoDef })}
                    className={`text-[11px] ${c.iconText} font-semibold hover:underline shrink-0 mt-0.5 print:hidden`}
                  >
                    Editar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
