import {
  Biohazard,
  HeartPulse,
  BedDouble,
  Stethoscope,
  Package,
  Info,
} from 'lucide-react';

export const TIPOS_ALERTA = [
  { id: 'isolamentos',      label: 'Isolamentos',                 tipo: 'isolamento', icon: Biohazard   },
  { id: 'protocolo_agravo', label: 'Protocolo de Agravo',         tipo: 'leitos',     icon: HeartPulse  },
  { id: 'acamados',         label: 'Pacientes Acamados',          tipo: 'leitos',     icon: BedDouble   },
  { id: 'traqueostomia',    label: 'Pacientes c/ Traqueostomia',  tipo: 'leitos',     icon: Stethoscope },
  { id: 'falta_material',   label: 'Falta de Materiais Críticos', tipo: 'material',   icon: Package     },
  { id: 'demais_infos',     label: 'Demais Informações',          tipo: 'livre',      icon: Info        },
];

export const TIPOS_ISOLAMENTO = [
  'Isolamento por Contacto',
  'Isolamento Respiratório',
  'Isolamento por Gotículas',
  'Isolamento Reverso',
];

export const TURNOS_RUNDOWN = [
  { id: 'MANHA', label: 'Manhã (6h + Diurno 12h)', curto: 'Manhã' },
  { id: 'TARDE', label: 'Tarde (6h + Diurno 12h)', curto: 'Tarde' },
  { id: 'NOITE', label: 'Noite 12h (Par / Ímpar)', curto: 'Noite' },
];

export const CATEGORIAS_RUNDOWN = [
  { id: 'ENF', label: 'Enfermeiros', cor: 'indigo' },
  { id: 'TEC', label: 'Técnicos e Auxiliares de Enfermagem', cor: 'teal' },
];

export const TIPOS_AFASTAMENTO = [
  'Atestado Médico',
  'Licença Médica / INSS',
  'Licença Maternidade',
  'Férias',
  'Restrição de Trabalho Compatível (RTC)',
  'Outros Afastamentos',
];

/**
 * Calcula se a data informada (YYYY-MM-DD) corresponde à equipe Noturna PAR ou ÍMPAR.
 * Regra: dia do mês par -> PAR; dia do mês ímpar -> IMPAR.
 */
export function calcularEquipeNoite(dataStr) {
  if (!dataStr) return 'PAR';
  const partes = String(dataStr).split('-');
  const dia = parseInt(partes[2], 10);
  if (isNaN(dia)) return 'PAR';
  return dia % 2 === 0 ? 'PAR' : 'IMPAR';
}

export function criarQuadroVazio() {
  return {
    ENF: {
      escalados: 0,
      faltas: { fnj: 0, atestado: 0, outras: 0 },
      recebidos: 0,
      cedidos: 0,
    },
    TEC: {
      escalados: 0,
      faltas: { fnj: 0, atestado: 0, outras: 0 },
      recebidos: 0,
      cedidos: 0,
    },
  };
}
