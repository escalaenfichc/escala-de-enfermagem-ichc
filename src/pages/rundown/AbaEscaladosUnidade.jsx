import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Save,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Sun,
  Moon,
  UserCheck,
  Wand2,
  Building2,
} from 'lucide-react';
import {
  carregarSetoresAtivos,
  carregarEscaladosMensal,
  salvarEscaladosMensal,
  criarPadraoTurnosEscaladosVazio,
} from '../../services/rundownService';
import { useAuth } from '../../contexts/AuthContext';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AbaEscaladosUnidade({
  setorFiltro,
  responsavelPadrao = '',
  onSalvoSucesso,
}) {
  const { user } = useAuth();
  const [setores, setSetores] = useState([]);
  const [setorNome, setSetorNome] = useState('');
  const [mesRef, setMesRef] = useState(new Date());
  const [responsavelNome, setResponsavelNome] = useState(responsavelPadrao);
  const [padraoTurnos, setPadraoTurnos] = useState(criarPadraoTurnosEscaladosVazio());
  const [dias, setDias] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [msgSalvo, setMsgSalvo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarSetoresAtivos().then((lista) => {
      setSetores(lista);
      const preferencial =
        setorFiltro && setorFiltro !== 'Global' && setorFiltro !== 'Todos'
          ? setorFiltro
          : user?.unidadeLogada && user?.unidadeLogada !== 'Global'
          ? user.unidadeLogada
          : lista[0]?.nome || '';
      setSetorNome(preferencial);
    });
  }, [setorFiltro, user?.unidadeLogada]);

  const setorObj = useMemo(
    () =>
      setores.find(
        (s) => (s.nome || '').toUpperCase() === (setorNome || '').toUpperCase()
      ) || null,
    [setores, setorNome]
  );
  const setorId = setorObj?.id;

  const ano = mesRef.getFullYear();
  const mesIdx0 = mesRef.getMonth();
  const mesAnoStr = `${ano}-${String(mesIdx0 + 1).padStart(2, '0')}`;
  const diasNoMes = new Date(ano, mesIdx0 + 1, 0).getDate();

  useEffect(() => {
    if (!setorNome) return;
    setLoading(true);
    carregarEscaladosMensal(setorId, setorNome, mesAnoStr)
      .then((reg) => {
        if (reg) {
          setPadraoTurnos(reg.padrao_turnos || criarPadraoTurnosEscaladosVazio());
          setDias(reg.dias || {});
          if (reg.responsavel_nome && !responsavelNome) {
            setResponsavelNome(reg.responsavel_nome);
          }
        } else {
          setPadraoTurnos(criarPadraoTurnosEscaladosVazio());
          setDias({});
        }
      })
      .finally(() => setLoading(false));
  }, [setorId, setorNome, mesAnoStr]);

  const atualizarPadrao = (chaveTurno, cat, valor) => {
    const num = Math.max(0, parseInt(valor, 10) || 0);
    setPadraoTurnos((prev) => ({
      ...prev,
      [chaveTurno]: {
        ...(prev[chaveTurno] || {}),
        [cat]: num,
      },
    }));
  };

  // Preenche todos os dias do mês a partir do padrão dos turnos
  const aplicarPadraoNosDias = () => {
    const novoMapaDias = {};
    for (let d = 1; d <= diasNoMes; d++) {
      const ehPar = d % 2 === 0;
      const noiteRef = ehPar ? padraoTurnos.NOITE_PAR : padraoTurnos.NOITE_IMPAR;
      novoMapaDias[String(d)] = {
        MANHA: {
          ENF: Number(padraoTurnos.MANHA?.ENF) || 0,
          TEC: Number(padraoTurnos.MANHA?.TEC) || 0,
        },
        TARDE: {
          ENF: Number(padraoTurnos.TARDE?.ENF) || 0,
          TEC: Number(padraoTurnos.TARDE?.TEC) || 0,
        },
        DIURNO12: {
          ENF: Number(padraoTurnos.DIURNO12?.ENF) || 0,
          TEC: Number(padraoTurnos.DIURNO12?.TEC) || 0,
        },
        NOITE: {
          ENF: Number(noiteRef?.ENF) || 0,
          TEC: Number(noiteRef?.TEC) || 0,
        },
      };
    }
    setDias(novoMapaDias);
  };

  const atualizarDia = (dia, chaveTurno, cat, valor) => {
    const num = Math.max(0, parseInt(valor, 10) || 0);
    const k = String(dia);
    const ehPar = dia % 2 === 0;
    const noitePadrao = ehPar ? padraoTurnos.NOITE_PAR : padraoTurnos.NOITE_IMPAR;

    setDias((prev) => {
      const atualDia = prev[k] || {
        MANHA: { ...(padraoTurnos.MANHA || { ENF: 0, TEC: 0 }) },
        TARDE: { ...(padraoTurnos.TARDE || { ENF: 0, TEC: 0 }) },
        DIURNO12: { ...(padraoTurnos.DIURNO12 || { ENF: 0, TEC: 0 }) },
        NOITE: { ...(noitePadrao || { ENF: 0, TEC: 0 }) },
      };
      return {
        ...prev,
        [k]: {
          ...atualDia,
          [chaveTurno]: {
            ...(atualDia[chaveTurno] || {}),
            [cat]: num,
          },
        },
      };
    });
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!responsavelNome.trim()) {
      alert('Informe o nome da pessoa responsável pelas informações.');
      return;
    }
    setSalvando(true);
    try {
      await salvarEscaladosMensal({
        setorId,
        setorNome,
        mesAno: mesAnoStr,
        padraoTurnos,
        dias,
        responsavelNome: responsavelNome.trim(),
      });
      setMsgSalvo(`Escalados de ${MESES[mesIdx0]}/${ano} salvos com sucesso!`);
      setTimeout(() => setMsgSalvo(''), 4000);
      if (onSalvoSucesso) onSalvoSucesso();
    } finally {
      setSalvando(false);
    }
  };

  const prevMonth = () => setMesRef(new Date(ano, mesIdx0 - 1, 1));
  const nextMonth = () => setMesRef(new Date(ano, mesIdx0 + 1, 1));

  const listaDias = useMemo(() => {
    return Array.from({ length: diasNoMes }, (_, i) => {
      const d = i + 1;
      const ds = DIAS_SEMANA[new Date(ano, mesIdx0, d).getDay()];
      const ehPar = d % 2 === 0;
      const noitePadrao = ehPar ? padraoTurnos.NOITE_PAR : padraoTurnos.NOITE_IMPAR;
      const dObj = dias[String(d)] || {};

      const manha = {
        ENF: dObj.MANHA?.ENF ?? padraoTurnos.MANHA?.ENF ?? 0,
        TEC: dObj.MANHA?.TEC ?? padraoTurnos.MANHA?.TEC ?? 0,
      };
      const tarde = {
        ENF: dObj.TARDE?.ENF ?? padraoTurnos.TARDE?.ENF ?? 0,
        TEC: dObj.TARDE?.TEC ?? padraoTurnos.TARDE?.TEC ?? 0,
      };
      const diurno12 = {
        ENF: dObj.DIURNO12?.ENF ?? padraoTurnos.DIURNO12?.ENF ?? 0,
        TEC: dObj.DIURNO12?.TEC ?? padraoTurnos.DIURNO12?.TEC ?? 0,
      };
      const noite = {
        ENF: dObj.NOITE?.ENF ?? noitePadrao?.ENF ?? 0,
        TEC: dObj.NOITE?.TEC ?? noitePadrao?.TEC ?? 0,
      };

      return {
        dia: d,
        ds,
        ehPar,
        manha,
        tarde,
        diurno12,
        noite,
        totalManhaENF: Number(manha.ENF) + Number(diurno12.ENF),
        totalManhaTEC: Number(manha.TEC) + Number(diurno12.TEC),
        totalTardeENF: Number(tarde.ENF) + Number(diurno12.ENF),
        totalTardeTEC: Number(tarde.TEC) + Number(diurno12.TEC),
      };
    });
  }, [diasNoMes, ano, mesIdx0, padraoTurnos, dias]);

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-400 font-bold">
        Carregando quantidade de escalados...
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSalvar}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6"
    >
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-600" /> Inserir Quantidade de Escalados — {setorNome}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Os números de escalados salvos aqui alimentam diretamente o <strong>Calendário Mensal</strong> e preenchem automaticamente o <strong>Rundown Diário</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <Building2 size={12} className="text-indigo-600" /> Unidade *
            </label>
            <select
              value={setorNome}
              onChange={(e) => setSetorNome(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
            >
              {setores.map((s) => (
                <option key={s.id || s.nome} value={s.nome}>
                  {s.sigla ? `${s.sigla} — ${s.nome}` : s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px]">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
              <UserCheck size={12} className="text-indigo-600" /> Responsável pelas Informações *
            </label>
            <input
              type="text"
              required
              placeholder="Digite seu nome completo..."
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-500 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-black text-slate-700 text-xs capitalize w-36 text-center">
              {MESES[mesIdx0]} {ano}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-500 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Grade Diária do Mês (Editável dia a dia) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">
              Quantidade Diária de Escalados ({MESES[mesIdx0]} / {ano})
            </h4>
            <p className="text-xs text-slate-500">
              Preencha a quantidade de profissionais escalados em cada dia e turno. O <strong>Diurno 12h</strong> soma automaticamente na Manhã e na Tarde.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {msgSalvo && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 size={14} /> {msgSalvo}
              </span>
            )}
            <button
              type="submit"
              disabled={salvando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Save size={15} />
              {salvando ? 'Salvando...' : 'Salvar Quantidade de Escalados'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <th className="p-2.5">Dia</th>
                <th className="p-2.5 text-center bg-sky-50/60">Manhã 6h (ENF / TÉC)</th>
                <th className="p-2.5 text-center bg-amber-50/60">Tarde 6h (ENF / TÉC)</th>
                <th className="p-2.5 text-center bg-orange-50/60">Diurno 12h (ENF / TÉC)</th>
                <th className="p-2.5 text-center bg-violet-50/60">Noite 12h (ENF / TÉC)</th>
                <th className="p-2.5 text-center bg-indigo-50/40">Total M / T / N (ENF / TÉC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaDias.map((item) => {
                const fds = item.ds === 'Sáb' || item.ds === 'Dom';
                return (
                  <tr
                    key={item.dia}
                    className={fds ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'}
                  >
                    <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">
                      <span className="inline-block w-7 font-black">
                        {String(item.dia).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          fds
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.ds}
                      </span>
                      <span className="ml-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                        {item.ehPar ? 'PAR' : 'ÍMPAR'}
                      </span>
                    </td>

                    {/* Manhã 6h */}
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.manha.ENF}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'MANHA', 'ENF', e.target.value)
                          }
                          className="w-12 text-center font-bold text-indigo-700 bg-white border border-slate-300 rounded py-1"
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number"
                          min="0"
                          value={item.manha.TEC}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'MANHA', 'TEC', e.target.value)
                          }
                          className="w-12 text-center font-bold text-teal-700 bg-white border border-slate-300 rounded py-1"
                        />
                      </div>
                    </td>

                    {/* Tarde 6h */}
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.tarde.ENF}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'TARDE', 'ENF', e.target.value)
                          }
                          className="w-12 text-center font-bold text-indigo-700 bg-white border border-slate-300 rounded py-1"
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number"
                          min="0"
                          value={item.tarde.TEC}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'TARDE', 'TEC', e.target.value)
                          }
                          className="w-12 text-center font-bold text-teal-700 bg-white border border-slate-300 rounded py-1"
                        />
                      </div>
                    </td>

                    {/* Diurno 12h */}
                    <td className="p-2 text-center bg-orange-50/20">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.diurno12.ENF}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'DIURNO12', 'ENF', e.target.value)
                          }
                          className="w-12 text-center font-bold text-indigo-700 bg-white border border-orange-300 rounded py-1"
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number"
                          min="0"
                          value={item.diurno12.TEC}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'DIURNO12', 'TEC', e.target.value)
                          }
                          className="w-12 text-center font-bold text-teal-700 bg-white border border-orange-300 rounded py-1"
                        />
                      </div>
                    </td>

                    {/* Noite 12h */}
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.noite.ENF}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'NOITE', 'ENF', e.target.value)
                          }
                          className="w-12 text-center font-bold text-indigo-700 bg-white border border-violet-300 rounded py-1"
                        />
                        <span className="text-slate-300">/</span>
                        <input
                          type="number"
                          min="0"
                          value={item.noite.TEC}
                          onChange={(e) =>
                            atualizarDia(item.dia, 'NOITE', 'TEC', e.target.value)
                          }
                          className="w-12 text-center font-bold text-teal-700 bg-white border border-violet-300 rounded py-1"
                        />
                      </div>
                    </td>

                    {/* Resumo Somado M, T e N (Última Coluna) */}
                    <td className="p-2 text-center text-[11px] font-bold text-slate-600 bg-indigo-50/20">
                      <div>
                        M: <strong className="text-indigo-700">{item.totalManhaENF}</strong> /{' '}
                        <strong className="text-teal-700">{item.totalManhaTEC}</strong>
                      </div>
                      <div>
                        T: <strong className="text-indigo-700">{item.totalTardeENF}</strong> /{' '}
                        <strong className="text-teal-700">{item.totalTardeTEC}</strong>
                      </div>
                      <div>
                        N: <strong className="text-indigo-700">{Number(item.noite.ENF) || 0}</strong> /{' '}
                        <strong className="text-teal-700">{Number(item.noite.TEC) || 0}</strong>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
}
