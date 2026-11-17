import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Moon,
  Sun,
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
  carregarAfastamentosSetor,
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

export default function CalendarioMensal({ setorFiltro }) {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [turno, setTurno] = useState('MANHA');
  const [setores, setSetores] = useState([]);
  const [setorNome, setSetorNome] = useState('');
  const [mapaDim, setMapaDim] = useState({});
  const [registros, setRegistros] = useState([]);
  const [afastamentos, setAfastamentos] = useState([]);

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

  useEffect(() => {
    if (!setorNome) return;
    Promise.all([
      carregarHistoricoRundown(setorObj?.id, setorNome),
      carregarAfastamentosSetor(setorObj?.id, setorNome),
    ]).then(([hist, afast]) => {
      setRegistros(hist);
      setAfastamentos(afast);
    });
  }, [setorNome, setorObj?.id]);

  const ano = mesAtual.getFullYear();
  const mesIdx0 = mesAtual.getMonth();
  const nomeMes = `${MESES[mesIdx0]} ${ano}`;
  const diasMes = new Date(ano, mesIdx0 + 1, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mesIdx0, 1).getDay();

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

      if (reg) {
        const enf = calcularTotaisCategoria({
          cat: 'ENF',
          turno,
          quadroTurno: reg.quadro || criarQuadroVazio(),
          quadroDiurno12: criarQuadroVazio(),
          minimo: minENF,
        });
        const tec = calcularTotaisCategoria({
          cat: 'TEC',
          turno,
          quadroTurno: reg.quadro || criarQuadroVazio(),
          quadroDiurno12: criarQuadroVazio(),
          minimo: minTEC,
        });
        return {
          dia,
          dataStr,
          preenchido: true,
          equipeNoite: calcularEquipeNoite(dataStr),
          enf: {
            min: minENF,
            esc: enf.escalados,
            pres: enf.presentes,
            aus: enf.totalFaltas,
            afastProj: afastENF,
          },
          tec: {
            min: minTEC,
            esc: tec.escalados,
            pres: tec.presentes,
            aus: tec.totalFaltas,
            afastProj: afastTEC,
          },
        };
      }

      // Dia futuro/sem Rundown lançado: mostra Necessários (Fixo ADM) e Afastamentos Projetados
      return {
        dia,
        dataStr,
        preenchido: false,
        equipeNoite: calcularEquipeNoite(dataStr),
        enf: {
          min: minENF,
          esc: minENF,
          pres: Math.max(0, minENF - afastENF),
          aus: afastENF,
          afastProj: afastENF,
        },
        tec: {
          min: minTEC,
          esc: minTEC,
          pres: Math.max(0, minTEC - afastTEC),
          aus: afastTEC,
          afastProj: afastTEC,
        },
      };
    });
  }, [diasMes, ano, mesIdx0, registros, afastamentos, turno, minENF, minTEC]);

  const prevMonth = () => setMesAtual(new Date(ano, mesIdx0 - 1, 1));
  const nextMonth = () => setMesAtual(new Date(ano, mesIdx0 + 1, 1));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" /> Planejamento Quantitativo Mensal & Projeção de Afastamentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Integra os Rundowns lançados e projeta automaticamente os atestados/afastamentos previstos nos dias seguintes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
          const hasShortage = c.enf.pres < c.enf.min || c.tec.pres < c.tec.min;
          const temProjecao = c.enf.afastProj > 0 || c.tec.afastProj > 0;
          const bgClass = c.preenchido
            ? hasShortage
              ? 'bg-rose-50 border-rose-300'
              : 'bg-emerald-50 border-emerald-300'
            : temProjecao
            ? 'bg-amber-50/70 border-amber-300'
            : 'bg-slate-50/70 border-slate-200';

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
                      title="Rundown preenchido"
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
