import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Save,
  Search,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  carregarSetoresAtivos,
  carregarTodoDimensionamento,
  obterMinimoDimensionamento,
  salvarConfigSetorCompleta,
} from '../../services/rundownService';
import { useAuth } from '../../contexts/AuthContext';

export default function ConfigDimensionamentoAdmin() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'Administrador' ||
    user?.role === 'Diretor' ||
    user?.email === 'admin@teste.com';

  const [setores, setSetores] = useState([]);
  const [busca, setBusca] = useState('');
  const [editMap, setEditMap] = useState({});
  const [salvandoId, setSalvandoId] = useState(null);
  const [salvoMsg, setSalvoMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const [listaSetores, dim] = await Promise.all([
        carregarSetoresAtivos(),
        carregarTodoDimensionamento(),
      ]);
      setSetores(listaSetores);

      const inicial = {};
      listaSetores.forEach((s) => {
        const key = s.id || s.nome;
        inicial[key] = {
          leitos: s.leitos_operacionais ?? 30,
          MANHA: {
            ENF: obterMinimoDimensionamento(dim, s.id, s.nome, 'MANHA', 'ENF'),
            TEC: obterMinimoDimensionamento(dim, s.id, s.nome, 'MANHA', 'TEC'),
          },
          TARDE: {
            ENF: obterMinimoDimensionamento(dim, s.id, s.nome, 'TARDE', 'ENF'),
            TEC: obterMinimoDimensionamento(dim, s.id, s.nome, 'TARDE', 'TEC'),
          },
          NOITE: {
            ENF: obterMinimoDimensionamento(dim, s.id, s.nome, 'NOITE', 'ENF'),
            TEC: obterMinimoDimensionamento(dim, s.id, s.nome, 'NOITE', 'TEC'),
          },
        };
      });
      setEditMap(inicial);
      setLoading(false);
    }
    init();
  }, []);

  const atualizarValor = (key, turno, cat, valor) => {
    if (!isAdmin) return;
    const n = Math.max(0, parseInt(valor, 10) || 0);
    setEditMap((prev) => {
      const atual = prev[key] || {};
      if (turno === 'LEITOS') {
        return { ...prev, [key]: { ...atual, leitos: n } };
      }
      return {
        ...prev,
        [key]: {
          ...atual,
          [turno]: { ...(atual[turno] || {}), [cat]: n },
        },
      };
    });
  };

  const handleSalvarLinha = async (setor) => {
    if (!isAdmin) return;
    const key = setor.id || setor.nome;
    const cfg = editMap[key];
    if (!cfg) return;

    setSalvandoId(key);
    try {
      await salvarConfigSetorCompleta({
        setorId: setor.id,
        setorNome: setor.nome,
        leitosOperacionais: cfg.leitos,
        minimos: {
          MANHA: cfg.MANHA,
          TARDE: cfg.TARDE,
          NOITE: cfg.NOITE,
        },
      });
      setSalvoMsg(`Parâmetros salvos para ${setor.nome}`);
      setTimeout(() => setSalvoMsg(''), 3000);
    } finally {
      setSalvandoId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-400 font-bold">
        Carregando configuração de leitos e quadro mínimo...
      </div>
    );
  }

  const filtrados = setores.filter((s) =>
    `${s.sigla || ''} ${s.nome || ''}`.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
            <ShieldCheck size={20} className="text-indigo-600" /> Configuração de Leitos e Quadro Mínimo Fixo (Necessários)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Os valores de <strong>Necessários</strong> e <strong>Leitos Totais</strong> definidos aqui alimentam automaticamente o Rundown de cada unidade. Somente o Administrador pode alterá-los.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {salvoMsg && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 size={14} /> {salvoMsg}
            </span>
          )}
          <div className="relative min-w-[240px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar unidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
          <Lock size={14} /> Somente o perfil Administrador pode alterar os valores de Necessários e Leitos.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <th className="p-3">Unidade</th>
              <th className="p-3 text-center">Leitos Totais</th>
              <th className="p-3 text-center bg-sky-50/60">Manhã (ENF / TÉC)</th>
              <th className="p-3 text-center bg-amber-50/60">Tarde (ENF / TÉC)</th>
              <th className="p-3 text-center bg-violet-50/60">Noite 12h (ENF / TÉC)</th>
              {isAdmin && <th className="p-3 text-right">Salvar</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((s) => {
              const key = s.id || s.nome;
              const cfg = editMap[key] || {
                leitos: 30,
                MANHA: { ENF: 2, TEC: 6 },
                TARDE: { ENF: 2, TEC: 6 },
                NOITE: { ENF: 2, TEC: 6 },
              };
              return (
                <tr key={key} className="hover:bg-slate-50/70">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{s.nome}</div>
                    {s.sigla && (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Sigla: {s.sigla}
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min="0"
                      disabled={!isAdmin}
                      value={cfg.leitos}
                      onChange={(e) =>
                        atualizarValor(key, 'LEITOS', null, e.target.value)
                      }
                      className="w-16 text-center font-black text-slate-800 bg-slate-50 border border-slate-300 rounded-lg py-1 outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </td>

                  {['MANHA', 'TARDE', 'NOITE'].map((t) => (
                    <td key={t} className="p-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          disabled={!isAdmin}
                          title={`${t} - Enfermeiros Necessários`}
                          value={cfg[t]?.ENF ?? 0}
                          onChange={(e) =>
                            atualizarValor(key, t, 'ENF', e.target.value)
                          }
                          className="w-12 text-center font-bold text-indigo-700 bg-indigo-50/60 border border-indigo-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-slate-300 font-bold">/</span>
                        <input
                          type="number"
                          min="0"
                          disabled={!isAdmin}
                          title={`${t} - Técnicos/Auxiliares Necessários`}
                          value={cfg[t]?.TEC ?? 0}
                          onChange={(e) =>
                            atualizarValor(key, t, 'TEC', e.target.value)
                          }
                          className="w-12 text-center font-bold text-teal-700 bg-teal-50/60 border border-teal-200 rounded-lg py-1 outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                    </td>
                  ))}

                  {isAdmin && (
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        disabled={salvandoId === key}
                        onClick={() => handleSalvarLinha(s)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        <Save size={13} />
                        {salvandoId === key ? '...' : 'Salvar'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
