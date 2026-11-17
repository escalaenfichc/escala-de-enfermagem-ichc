import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  CheckCircle2,
  BedDouble,
  Users,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  Moon,
  Sun,
  CalendarClock,
} from 'lucide-react';
import {
  TURNOS_RUNDOWN,
  calcularEquipeNoite,
  criarQuadroVazio,
} from '../../components/plantao/constantes';
import {
  carregarConsolidadoSupervisao,
  obterMinimoDimensionamento,
  calcularTotaisCategoria,
  calcularAfastamentosProjetadosNoDia,
} from '../../services/rundownService';

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export default function ConsolidadoSupervisao({ onAbrirUnidade }) {
  const [dataPlantao, setDataPlantao] = useState(hojeISO());
  const [turno, setTurno] = useState('MANHA');
  const [filtroStatus, setFiltroStatus] = useState('TODOS'); // TODOS | PREENCHIDOS | PENDENTES | DEFICIT | ALERTAS
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState({
    setores: [],
    mapaDim: {},
    registros: [],
    diurnos12: [],
    afastamentos: [],
  });

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await carregarConsolidadoSupervisao(dataPlantao);
      setDados(res);
    } catch (e) {
      console.error('Erro ao carregar consolidado da supervisão:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [dataPlantao]);

  const linhasUnidades = useMemo(() => {
    const { setores, mapaDim, registros, diurnos12, afastamentos } = dados;

    return setores.map((s) => {
      const reg = registros.find(
        (r) =>
          r.turno === turno &&
          ((s.id && r.setor_id === s.id) ||
            (r.setor_nome || '').toUpperCase() === (s.nome || '').toUpperCase())
      );

      const d12 = diurnos12.find(
        (d) =>
          (s.id && d.setor_id === s.id) ||
          (d.setor_nome || '').toUpperCase() === (s.nome || '').toUpperCase()
      );

      const afastSetor = afastamentos.filter(
        (a) =>
          (s.id && a.setor_id === s.id) ||
          (a.setor_nome || '').toUpperCase() === (s.nome || '').toUpperCase()
      );

      const minENF = obterMinimoDimensionamento(mapaDim, s.id, s.nome, turno, 'ENF');
      const minTEC = obterMinimoDimensionamento(mapaDim, s.id, s.nome, turno, 'TEC');

      const enf = calcularTotaisCategoria({
        cat: 'ENF',
        turno,
        quadroTurno: reg?.quadro || criarQuadroVazio(),
        quadroDiurno12: d12?.quadro || criarQuadroVazio(),
        minimo: minENF,
      });

      const tec = calcularTotaisCategoria({
        cat: 'TEC',
        turno,
        quadroTurno: reg?.quadro || criarQuadroVazio(),
        quadroDiurno12: d12?.quadro || criarQuadroVazio(),
        minimo: minTEC,
      });

      const afastENF = calcularAfastamentosProjetadosNoDia(
        afastSetor,
        dataPlantao,
        turno,
        'ENF'
      );
      const afastTEC = calcularAfastamentosProjetadosNoDia(
        afastSetor,
        dataPlantao,
        turno,
        'TEC'
      );

      const leitosTotais = reg?.leitos_totais || s.leitos_operacionais || 0;
      const ocupados = reg?.ocupados || 0;
      const bloqueados = reg?.bloqueados || 0;
      const vagos = Math.max(0, leitosTotais - (ocupados + bloqueados));
      const alertas = reg?.alertas || [];
      const preenchido = !!reg;
      const temDeficit = preenchido && (enf.temDeficit || tec.temDeficit);

      return {
        setor: s,
        preenchido,
        reg,
        enf,
        tec,
        afastENF,
        afastTEC,
        leitosTotais,
        ocupados,
        bloqueados,
        vagos,
        alertas,
        temDeficit,
      };
    });
  }, [dados, turno, dataPlantao]);

  const kpis = useMemo(() => {
    const totalUnidades = linhasUnidades.length;
    const preenchidas = linhasUnidades.filter((l) => l.preenchido).length;
    const comDeficit = linhasUnidades.filter((l) => l.temDeficit).length;
    const totalAlertas = linhasUnidades.reduce((acc, l) => acc + l.alertas.length, 0);
    const leitosTotais = linhasUnidades.reduce((acc, l) => acc + l.leitosTotais, 0);
    const leitosOcupados = linhasUnidades
      .filter((l) => l.preenchido)
      .reduce((acc, l) => acc + l.ocupados, 0);
    const leitosBloqueados = linhasUnidades
      .filter((l) => l.preenchido)
      .reduce((acc, l) => acc + l.bloqueados, 0);

    return {
      totalUnidades,
      preenchidas,
      comDeficit,
      totalAlertas,
      leitosTotais,
      leitosOcupados,
      leitosBloqueados,
    };
  }, [linhasUnidades]);

  const linhasFiltradas = useMemo(() => {
    return linhasUnidades.filter((l) => {
      const texto = `${l.setor.sigla || ''} ${l.setor.nome || ''}`.toLowerCase();
      if (busca && !texto.includes(busca.toLowerCase())) return false;
      if (filtroStatus === 'PREENCHIDOS') return l.preenchido;
      if (filtroStatus === 'PENDENTES') return !l.preenchido;
      if (filtroStatus === 'DEFICIT') return l.temDeficit;
      if (filtroStatus === 'ALERTAS') return l.alertas.length > 0;
      return true;
    });
  }, [linhasUnidades, busca, filtroStatus]);

  const equipeNoite = turno === 'NOITE' ? calcularEquipeNoite(dataPlantao) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho e Filtros */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <LayoutDashboard className="text-indigo-600" /> Painel Consolidado da Supervisão (Rundown)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento em tempo real do quantitativo de enfermagem, ocupação de leitos, alertas e projeção de afastamentos de todas as unidades.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Data do Plantão
              </label>
              <input
                type="date"
                value={dataPlantao}
                onChange={(e) => setDataPlantao(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Turno
              </label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50 outline-none"
              >
                {TURNOS_RUNDOWN.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={carregar}
              className="mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>

        {/* KPIs Globais do Turno */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Clock size={12} /> Adesão das Unidades no Turno
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {kpis.preenchidas}{' '}
              <span className="text-sm font-semibold text-slate-400">/ {kpis.totalUnidades}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {turno === 'NOITE' ? (
                <span className="text-violet-700 font-bold inline-flex items-center gap-1">
                  <Moon size={11} /> Noite 12h · Equipe {equipeNoite}
                </span>
              ) : (
                <span className="text-amber-700 font-bold inline-flex items-center gap-1">
                  <Sun size={11} /> Inclui Diurno 12h (M+T)
                </span>
              )}
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              kpis.comDeficit > 0
                ? 'bg-rose-50 border-rose-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                kpis.comDeficit > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              <Users size={12} /> Unidades com Déficit de Pessoal
            </p>
            <p
              className={`text-2xl font-black mt-1 ${
                kpis.comDeficit > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {kpis.comDeficit}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Presentes abaixo do quadro mínimo fixo
            </p>
          </div>

          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1">
              <BedDouble size={12} /> Leitos Informados (Ocup / Bloq)
            </p>
            <p className="text-2xl font-black text-blue-900 mt-1">
              {kpis.leitosOcupados}{' '}
              <span className="text-xs font-bold text-rose-600">
                (+{kpis.leitosBloqueados} bloq.)
              </span>
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">
              Capacidade total cadastrada: {kpis.leitosTotais}
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              kpis.totalAlertas > 0
                ? 'bg-orange-50 border-orange-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                kpis.totalAlertas > 0 ? 'text-orange-700' : 'text-slate-500'
              }`}
            >
              <AlertCircle size={12} /> Alertas de Unidade no Turno
            </p>
            <p
              className={`text-2xl font-black mt-1 ${
                kpis.totalAlertas > 0 ? 'text-orange-700' : 'text-slate-700'
              }`}
            >
              {kpis.totalAlertas}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Isolamentos, agravos, materiais e leitos
            </p>
          </div>
        </div>

        {/* Barra de Busca e Filtro Rápido */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'TODOS', label: `Todas (${linhasUnidades.length})` },
              { id: 'PREENCHIDOS', label: `Preenchidas (${kpis.preenchidas})` },
              {
                id: 'PENDENTES',
                label: `Pendentes (${kpis.totalUnidades - kpis.preenchidas})`,
              },
              { id: 'DEFICIT', label: `Com Déficit (${kpis.comDeficit})` },
              {
                id: 'ALERTAS',
                label: `Com Alertas (${linhasUnidades.filter((l) => l.alertas.length > 0).length})`,
              },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroStatus(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filtroStatus === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[260px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar unidade ou sigla..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela Consolidada de Todas as Unidades */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Unidade</th>
                <th className="p-3.5">Status / Responsável</th>
                <th className="p-3.5 text-center">Enfermeiros (Mín / Esc / Pres)</th>
                <th className="p-3.5 text-center">Técnicos/Aux. (Mín / Esc / Pres)</th>
                <th className="p-3.5 text-center">Afast. Projetados</th>
                <th className="p-3.5 text-center">Leitos (Ocup / Bloq / Total)</th>
                <th className="p-3.5">Alertas da Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhasFiltradas.map((l) => (
                <tr
                  key={l.setor.id || l.setor.nome}
                  className={
                    l.temDeficit
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : 'hover:bg-slate-50/80'
                  }
                >
                  <td className="p-3.5">
                    <div className="font-bold text-slate-800">{l.setor.nome}</div>
                    {l.setor.sigla && (
                      <span className="text-[10px] font-bold text-slate-400">
                        Sigla: {l.setor.sigla}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    {l.preenchido ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={11} /> Preenchido
                        </span>
                        <div className="text-[11px] font-semibold text-slate-600 mt-1">
                          Resp.: <strong>{l.reg.responsavel_nome}</strong>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                        Pendente
                      </span>
                    )}
                  </td>

                  {/* Enfermeiros */}
                  <td className="p-3.5 text-center">
                    {l.preenchido ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-700">
                          {l.enf.necessarios} / {l.enf.escalados} /{' '}
                          <strong className="text-indigo-700">{l.enf.presentes}</strong>
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-0.5 ${
                            l.enf.temDeficit
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {l.enf.temDeficit
                            ? `Déficit ${l.enf.saldo} (Faltas: ${l.enf.totalFaltas})`
                            : `OK (${l.enf.saldo >= 0 ? `+${l.enf.saldo}` : l.enf.saldo})`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Mín: {l.enf.necessarios}</span>
                    )}
                  </td>

                  {/* Técnicos / Auxiliares */}
                  <td className="p-3.5 text-center">
                    {l.preenchido ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold text-slate-700">
                          {l.tec.necessarios} / {l.tec.escalados} /{' '}
                          <strong className="text-teal-700">{l.tec.presentes}</strong>
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-0.5 ${
                            l.tec.temDeficit
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {l.tec.temDeficit
                            ? `Déficit ${l.tec.saldo} (Faltas: ${l.tec.totalFaltas})`
                            : `OK (${l.tec.saldo >= 0 ? `+${l.tec.saldo}` : l.tec.saldo})`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Mín: {l.tec.necessarios}</span>
                    )}
                  </td>

                  {/* Afastamentos Projetados */}
                  <td className="p-3.5 text-center">
                    {l.afastENF + l.afastTEC > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                        <CalendarClock size={12} /> ENF: {l.afastENF} · TÉC: {l.afastTEC}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Leitos */}
                  <td className="p-3.5 text-center">
                    {l.preenchido ? (
                      <div className="font-bold text-slate-700">
                        <span className="text-blue-700">{l.ocupados}</span> /{' '}
                        <span className="text-rose-600">{l.bloqueados}</span> / {l.leitosTotais}
                        <div className="text-[10px] text-emerald-700">Vagos: {l.vagos}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Cap.: {l.leitosTotais}</span>
                    )}
                  </td>

                  {/* Alertas */}
                  <td className="p-3.5">
                    {l.alertas.length === 0 ? (
                      <span className="text-slate-300 italic">Sem alertas</span>
                    ) : (
                      <div className="flex flex-col gap-1 max-w-xs">
                        {l.alertas.map((a, i) => {
                          const label = a.tipoDef?.label || a.tipoId || 'Alerta';
                          const det =
                            a.dados?.leitosPaciente ||
                            a.dados?.materialDescricao ||
                            a.dados?.textoLivre ||
                            '';
                          return (
                            <div
                              key={a.uid || i}
                              className="text-[11px] bg-orange-50 border border-orange-200 text-orange-900 px-2 py-1 rounded-lg"
                            >
                              <strong>{label}:</strong> {det}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
