import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarClock,
  Building2,
} from 'lucide-react';
import {
  TURNOS_RUNDOWN,
  calcularEquipeNoite,
  criarQuadroVazio,
} from '../../components/plantao/constantes';
import {
  carregarSetoresAtivos,
  carregarTodoDimensionamento,
  obterMinimoDimensionamento,
  carregarHistoricoRundown,
  carregarDiurno12Dia,
  carregarAfastamentosSetor,
  carregarEscaladosMensal,
  obterEscaladosSalvosNoDia,
  calcularTotaisCategoria,
  calcularAfastamentosProjetadosNoDia,
} from '../../services/rundownService';

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

export default function CalendarioMensal({ setorFiltro, ocultarSeletorUnidade = false }) {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [turno, setTurno] = useState('MANHA');
  const [setores, setSetores] = useState([]);
  const [setorNome, setSetorNome] = useState('');
  const [mapaDim, setMapaDim] = useState({});
  const [registros, setRegistros] = useState([]);
  const [mapaDiurno12, setMapaDiurno12] = useState({});
  const [afastamentos, setAfastamentos] = useState([]);
  const [escaladosMes, setEscaladosMes] = useState(null);

  useEffect(() => {
    async function init() {
      const [s, dim] = await Promise.all([
        carregarSetoresAtivos(),
        carregarTodoDimensionamento(),
      ]);
      setSetores(s);
      setMapaDim(dim);
      const inicial =
        setorFiltro && setorFiltro !== 'Global' && setorFiltro !== 'Todos'
          ? setorFiltro
          : s[0]?.nome || '';
      setSetorNome(inicial);
    }
    init();
  }, [setorFiltro]);

  const setorObj = useMemo(
    () =>
      setores.find((s) => (s.nome || '').toUpperCase() === (setorNome || '').toUpperCase()) ||
      null,
    [setores, setorNome]
  );

  const ano = mesAtual.getFullYear();
  const mesIdx0 = mesAtual.getMonth();
  const mesAnoStr = `${ano}-${String(mesIdx0 + 1).padStart(2, '0')}`;
  const nomeMes = `${MESES[mesIdx0]} ${ano}`;
  const diasMes = new Date(ano, mesIdx0 + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mesIdx0, 1).getDay();

  useEffect(() => {
    if (!setorNome) return;
    Promise.all([
      carregarHistoricoRundown(setorObj?.id, setorNome),
      carregarAfastamentosSetor(setorObj?.id, setorNome),
      carregarEscaladosMensal(setorObj?.id, setorNome, mesAnoStr),
    ]).then(async ([hist, afast, escMes]) => {
      setRegistros(hist);
      setAfastamentos(afast);
      setEscaladosMes(escMes);

      // Carrega Diurno 12h dos dias em que há registro no mês
      const regsDoMes = hist.filter((r) => (r.data_plantao || '').startsWith(mesAnoStr));
      const datasUnicas = Array.from(new Set(regsDoMes.map((r) => r.data_plantao)));
      const d12Map = {};
      for (const dt of datasUnicas) {
        d12Map[dt] = await carregarDiurno12Dia(setorObj?.id, setorNome, dt);
      }
      setMapaDiurno12(d12Map);
    });
  }, [setorNome, setorObj?.id, mesAnoStr]);

  const minENF = obterMinimoDimensionamento(mapaDim, setorObj?.id, setorNome, turno, 'ENF');
  const minTEC = obterMinimoDimensionamento(mapaDim, setorObj?.id, setorNome, turno, 'TEC');

  const cards = useMemo(() => {
    return Array.from({ length: diasMes }, (_, i) => {
      const dia = i + 1;
      const dataStr = `${ano}-${String(mesIdx0 + 1).padStart(2, '0')}-${String(dia).padStart(
        2,
        '0'
      )}`;
      const reg = registros.find((r) => r.data_plantao === dataStr && r.turno === turno);

      const afastENF = calcularAfastamentosProjetadosNoDia(
        afastamentos,
        dataStr,
        turno,
        'ENF'
      );
      const afastTEC = calcularAfastamentosProjetadosNoDia(
        afastamentos,
        dataStr,
        turno,
        'TEC'
      );

      // Escalados cadastrados na aba "Inserir Quantidade de Escalados"
      const escSalvo = obterEscaladosSalvosNoDia(escaladosMes, dia, turno);

      if (reg) {
        const d12 = mapaDiurno12[dataStr] || criarQuadroVazio();
        const enf = calcularTotaisCategoria({
          cat: 'ENF',
          turno,
          quadroTurno: reg.quadro || criarQuadroVazio(),
          quadroDiurno12: d12,
          minimo: minENF,
        });
        const tec = calcularTotaisCategoria({
          cat: 'TEC',
          turno,
          quadroTurno: reg.quadro || criarQuadroVazio(),
          quadroDiurno12: d12,
          minimo: minTEC,
        });

        // Se no registro diário o escalado ficou 0 mas há escalado salvo na aba de Escalados, usa o salvo
        const enfEscFinal = enf.escalados > 0 ? enf.escalados : escSalvo.ENF.total;
        const tecEscFinal = tec.escalados > 0 ? tec.escalados : escSalvo.TEC.total;
        const enfPresFinal =
          enf.escalados > 0
            ? enf.presentes
            : Math.max(0, enfEscFinal - enf.totalFaltas + enf.recebidos - enf.cedidos);
        const tecPresFinal =
          tec.escalados > 0
            ? tec.presentes
            : Math.max(0, tecEscFinal - tec.totalFaltas + tec.recebidos - tec.cedidos);

        return {
          dia,
          dataStr,
          preenchido: true,
          temEscaladoSalvo: true,
          equipeNoite: calcularEquipeNoite(dataStr),
          enf: {
            min: minENF,
            esc: enfEscFinal,
            pres: enfPresFinal,
            aus: enf.totalFaltas,
            afastProj: afastENF,
          },
          tec: {
            min: minTEC,
            esc: tecEscFinal,
            pres: tecPresFinal,
            aus: tec.totalFaltas,
            afastProj: afastTEC,
          },
        };
      }

      // Sem Rundown diário lançado ainda: reflete exatamente os Escalados salvos na tabela + Afastamentos projetados
      const enfEsc = escSalvo.ENF.total;
      const tecEsc = escSalvo.TEC.total;
      const temEscaladoSalvo = enfEsc > 0 || tecEsc > 0;

      return {
        dia,
        dataStr,
        preenchido: false,
        temEscaladoSalvo,
        equipeNoite: calcularEquipeNoite(dataStr),
        enf: {
          min: minENF,
          esc: enfEsc,
          pres: Math.max(0, enfEsc - afastENF),
          aus: afastENF,
          afastProj: afastENF,
        },
        tec: {
          min: minTEC,
          esc: tecEsc,
          pres: Math.max(0, tecEsc - afastTEC),
          aus: afastTEC,
          afastProj: afastTEC,
        },
      };
    });
  }, [
    diasMes,
    ano,
    mesIdx0,
    registros,
    mapaDiurno12,
    afastamentos,
    escaladosMes,
    turno,
    minENF,
    minTEC,
  ]);

  const prevMonth = () => setMesAtual(new Date(ano, mesIdx0 - 1, 1));
  const nextMonth = () => setMesAtual(new Date(ano, mesIdx0 + 1, 1));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" /> Calendário Quantitativo Mensal — {setorNome}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reflete os <strong>Escalados</strong> salvos pela unidade, os <strong>Rundowns Diários</strong> e os <strong>Afastamentos Projetados</strong> (sem dados fictícios).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!ocultarSeletorUnidade && (
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-slate-400" />
              <select
                value={setorNome}
                onChange={(e) => setSetorNome(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50"
              >
                {setores.map((s) => (
                  <option key={s.id || s.nome} value={s.nome}>
                    {s.sigla ? `${s.sigla} — ${s.nome}` : s.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            value={turno}
            onChange={(e) => setTurno(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50"
          >
            {TURNOS_RUNDOWN.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-500 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-black text-slate-700 text-xs capitalize w-32 text-center">
              {nomeMes}
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

      <div className="grid grid-cols-7 gap-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div
            key={d}
            className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 py-1.5 rounded"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
          <div key={`blank-${i}`} className="p-2" />
        ))}

        {cards.map((c) => {
          const ativo = c.preenchido || c.temEscaladoSalvo;
          const hasShortage =
            ativo &&
            ((c.enf.min > 0 && c.enf.pres < c.enf.min) ||
              (c.tec.min > 0 && c.tec.pres < c.tec.min));
          const temProjecao = c.enf.afastProj > 0 || c.tec.afastProj > 0;

          const bgClass = c.preenchido
            ? hasShortage
              ? 'bg-rose-50 border-rose-300'
              : 'bg-emerald-50 border-emerald-300'
            : c.temEscaladoSalvo
            ? hasShortage
              ? 'bg-amber-50 border-amber-300'
              : 'bg-sky-50/70 border-sky-200'
            : temProjecao
            ? 'bg-amber-50/50 border-amber-200'
            : 'bg-slate-50/60 border-slate-200';

          return (
            <div
              key={c.dia}
              className={`border rounded-xl p-2 shadow-sm flex flex-col transition-shadow hover:shadow-md ${bgClass}`}
            >
              <div className="font-bold pb-1 mb-1 border-b border-slate-200/80 flex justify-between items-center">
                <span className="text-xs text-slate-800">
                  Dia {String(c.dia).padStart(2, '0')}
                </span>
                <div className="flex items-center gap-1">
                  {turno === 'NOITE' && (
                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                      {c.equipeNoite}
                    </span>
                  )}
                  {c.preenchido ? (
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500"
                      title="Rundown diário preenchido"
                    />
                  ) : c.temEscaladoSalvo ? (
                    <span
                      className="w-2 h-2 rounded-full bg-sky-500"
                      title="Escalados cadastrados pela unidade"
                    />
                  ) : temProjecao ? (
                    <CalendarClock
                      size={11}
                      className="text-amber-600"
                      title="Afastamento previsto projetado"
                    />
                  ) : null}
                </div>
              </div>

              <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50 py-0.5 px-1 text-center rounded border border-indigo-100 mb-0.5">
                ENF
              </div>
              <div className="flex justify-between text-[9px] leading-tight px-0.5">
                <span className="text-slate-500">NEC/ESC</span>
                <span className="font-bold text-slate-700">
                  {c.enf.min}/{c.enf.esc}
                </span>
              </div>
              <div className="flex justify-between text-[9px] leading-tight px-0.5">
                <span className="text-slate-500">PRES/AUS</span>
                <span
                  className={`font-bold ${
                    c.enf.aus > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {c.enf.pres}/{c.enf.aus}
                </span>
              </div>

              <div className="text-[9px] font-bold text-teal-700 bg-teal-50 py-0.5 px-1 text-center rounded border border-teal-100 mt-1 mb-0.5">
                TÉC/AUX
              </div>
              <div className="flex justify-between text-[9px] leading-tight px-0.5">
                <span className="text-slate-500">NEC/ESC</span>
                <span className="font-bold text-slate-700">
                  {c.tec.min}/{c.tec.esc}
                </span>
              </div>
              <div className="flex justify-between text-[9px] leading-tight px-0.5">
                <span className="text-slate-500">PRES/AUS</span>
                <span
                  className={`font-bold ${
                    c.tec.aus > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {c.tec.pres}/{c.tec.aus}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
