import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TIPOS_ISOLAMENTO } from './constantes';

export default function ModalAlerta({ tipoDef, dadosExistentes, onSalvar, onRemover, onCancelar }) {
  const [form, setForm] = useState({
    tipoIsolamento: dadosExistentes?.tipoIsolamento || '',
    leitosPaciente: dadosExistentes?.leitosPaciente || '',
    quantidadeLeitos: dadosExistentes?.quantidadeLeitos || '',
    quaisLeitos: dadosExistentes?.quaisLeitos || '',
    materialDescricao: dadosExistentes?.materialDescricao || '',
    impacto: dadosExistentes?.impacto || '',
    textoLivre: dadosExistentes?.textoLivre || '',
  });

  const u = (f) => setForm((prev) => ({ ...prev, ...f }));
  const Icon = tipoDef.icon;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-orange-500 p-5 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2">
            <Icon size={20} /> {tipoDef.label}
          </h3>
          <button
            type="button"
            onClick={onCancelar}
            className="hover:bg-orange-600 p-1 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          className="p-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSalvar(form);
          }}
        >
          {tipoDef.tipo === 'isolamento' && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Tipo de Isolamento *
                </label>
                <select
                  required
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50"
                  value={form.tipoIsolamento}
                  onChange={(e) => u({ tipoIsolamento: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {TIPOS_ISOLAMENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Número do(s) Leito(s) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Leito 12, Leito 14 (informe apenas o número do leito)"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50"
                  value={form.leitosPaciente}
                  onChange={(e) => u({ leitosPaciente: e.target.value })}
                />
                <p className="text-[10px] text-slate-500 mt-1 ml-1">
                  Informe apenas números/identificação dos leitos, sem nomes de pacientes. Separe por vírgulas se houver mais de um.
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Observações
                </label>
                <textarea
                  rows="2"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50 resize-none"
                  placeholder="Precauções adicionais..."
                  value={form.textoLivre}
                  onChange={(e) => u({ textoLivre: e.target.value })}
                />
              </div>
            </>
          )}

          {tipoDef.tipo === 'leitos' && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Número do(s) Leito(s) *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Leito 04, Leito 09 (apenas número do leito)"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50"
                  value={form.leitosPaciente}
                  onChange={(e) => u({ leitosPaciente: e.target.value })}
                />
                <p className="text-[10px] text-slate-500 mt-1 ml-1">
                  Informe apenas o número do leito (não inclua nome de paciente).
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Observações
                </label>
                <textarea
                  rows="2"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50 resize-none"
                  placeholder="Detalhes adicionais..."
                  value={form.textoLivre}
                  onChange={(e) => u({ textoLivre: e.target.value })}
                />
              </div>
            </>
          )}

          {tipoDef.tipo === 'material' && (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Descrição do Material *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ex: Luvas descartáveis M, sonda vesical 14Fr"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50"
                  value={form.materialDescricao}
                  onChange={(e) => u({ materialDescricao: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Impacto na Assistência
                </label>
                <textarea
                  rows="2"
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50 resize-none"
                  placeholder="Descreva o impacto ou urgência..."
                  value={form.impacto}
                  onChange={(e) => u({ impacto: e.target.value })}
                />
              </div>
            </>
          )}

          {tipoDef.tipo === 'livre' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Informação *
              </label>
              <textarea
                required
                rows="5"
                className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-400 bg-slate-50 resize-none"
                placeholder="Descreva a situação ou informação relevante para a equipe (sem dados pessoais)..."
                value={form.textoLivre}
                onChange={(e) => u({ textoLivre: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {dadosExistentes ? (
              <button
                type="button"
                onClick={onRemover}
                className="text-rose-600 font-bold px-4 py-2 hover:bg-rose-50 rounded-lg transition-colors text-sm"
              >
                Remover Alerta
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancelar}
                className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-orange-500 text-white font-bold px-6 py-2 rounded-xl hover:bg-orange-600 shadow-sm transition-colors text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
