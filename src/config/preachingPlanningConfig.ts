import { PreachingPlan, PreachingPlanStatus, Sermon } from '../types';

/**
 * LISTA CENTRAL DE TIPOS DE CULTO DO PLANEJAMENTO DE PREGAÇÕES
 *
 * Para adicionar, renomear ou remover tipos de culto no formulário e nos filtros,
 * edite apenas este array abaixo.
 */
export const PREACHING_SERVICE_TYPES = [
  'Culto de domingo manhã',
  'Culto de domingo noite',
  'Culto de quarta',
  'Escola Bíblica',
  'Evento especial',
] as const;

export const PREACHING_PLAN_STATUSES: PreachingPlanStatus[] = [
  'Planejado',
  'Em preparo',
  'Pronto',
  'Pregado',
];

export const PREACHING_STATUS_STYLES: Record<
  PreachingPlanStatus,
  {
    label: PreachingPlanStatus;
    badgeClass: string;
    dotClass: string;
    calendarChipClass: string;
  }
> = {
  Planejado: {
    label: 'Planejado',
    badgeClass: 'text-slate-700 bg-slate-100/90 border-slate-200',
    dotClass: 'bg-slate-400',
    calendarChipClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  'Em preparo': {
    label: 'Em preparo',
    badgeClass: 'text-amber-900 bg-amber-50 border-amber-200',
    dotClass: 'bg-amber-500',
    calendarChipClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  Pronto: {
    label: 'Pronto',
    badgeClass: 'text-emerald-900 bg-emerald-50 border-emerald-200',
    dotClass: 'bg-emerald-600',
    calendarChipClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  Pregado: {
    label: 'Pregado',
    badgeClass: 'text-[#3F402B] bg-[#F2F1EA] border-[#D6D3C4]',
    dotClass: 'bg-[#5A5A40]',
    calendarChipClass: 'bg-[#F2F1EA] text-[#3F402B] border-[#D6D3C4]',
  },
};

const BOOK_ABBREV_MAP: Record<string, string> = {
  gn: 'genesis',
  gen: 'genesis',
  ex: 'exodo',
  lv: 'levitico',
  nm: 'numeros',
  dt: 'deuteronomio',
  js: 'josue',
  jz: 'juizes',
  rt: 'rute',
  '1sm': '1samuel',
  '2sm': '2samuel',
  '1rs': '1reis',
  '2rs': '2reis',
  '1cr': '1cronicas',
  '2cr': '2cronicas',
  ed: 'esdras',
  ne: 'neemias',
  et: 'ester',
  sl: 'salmos',
  salmo: 'salmos',
  pv: 'proverbios',
  ec: 'eclesiastes',
  ct: 'canticos',
  is: 'isaias',
  jr: 'jeremias',
  lm: 'lamentacoes',
  ez: 'ezequiel',
  dn: 'daniel',
  os: 'oseias',
  jl: 'joel',
  am: 'amos',
  ob: 'obadias',
  jn: 'jonas',
  mq: 'miqueias',
  na: 'naum',
  hc: 'habacuque',
  sf: 'sofonias',
  ag: 'ageu',
  zc: 'zacarias',
  ml: 'malaquias',
  mt: 'mateus',
  mc: 'marcos',
  lc: 'lucas',
  jo: 'joao',
  at: 'atos',
  rm: 'romanos',
  '1co': '1corintios',
  '2co': '2corintios',
  gl: 'galatas',
  ef: 'efesios',
  fp: 'filipenses',
  cl: 'colossenses',
  '1ts': '1tessalonicenses',
  '2ts': '2tessalonicenses',
  '1tm': '1timoteo',
  '2tm': '2timoteo',
  tt: 'tito',
  fm: 'filemom',
  hb: 'hebreus',
  tg: 'tiago',
  '1pe': '1pedro',
  '2pe': '2pedro',
  '1jo': '1joao',
  '2jo': '2joao',
  '3jo': '3joao',
  jd: 'judas',
  ap: 'apocalipse',
};

/**
 * Normaliza uma referência bíblica para comparação tolerante
 * (ex.: "Rm 12.1-2", "Romanos 12:1 - 2" e "romanos 12:1-2" viram a mesma chave).
 */
export function normalizeBibleReference(raw?: string): string {
  if (!raw || !raw.trim()) return '';
  let text = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[–—]/g, '-')
    .replace(/\./g, ':')
    .replace(/\s+/g, ' ')
    .trim();

  // Separa prefixo numérico de livro abreviado ("1 jo" -> "1jo")
  text = text.replace(/^([123])\s+([a-z]+)/, '$1$2');

  const match = text.match(/^([123]?[a-z]+)\s+(.+)$/);
  if (match) {
    const rawBook = match[1];
    const mappedBook = BOOK_ABBREV_MAP[rawBook] || rawBook;
    const rest = match[2].replace(/\s*([:,\-])\s*/g, '$1').trim();
    return `${mappedBook} ${rest}`;
  }

  return text.replace(/\s*([:,\-])\s*/g, '$1').trim();
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function formatIsoDateShort(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function formatIsoDateWithWeekday(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${weekdays[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export interface RepetitionMatch {
  source: 'plan' | 'sermon-history';
  date: string;
  label: string;
  status?: PreachingPlanStatus;
}

/**
 * Verifica se o mesmo texto bíblico já foi planejado ou pregado nos últimos 6 meses
 * em relação à data informada (ou à data de hoje).
 */
export function findRecentScriptureMatches(params: {
  scripture: string;
  referenceDate?: string;
  plans: PreachingPlan[];
  sermons: Sermon[];
  excludePlanId?: string;
}): RepetitionMatch[] {
  const normalizedTarget = normalizeBibleReference(params.scripture);
  if (!normalizedTarget || normalizedTarget.length < 3) return [];

  const anchorIso =
    params.referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(params.referenceDate)
      ? params.referenceDate
      : getTodayIsoDate();
  const [ay, am, ad] = anchorIso.split('-').map(Number);
  const anchorTime = new Date(ay, am - 1, ad).getTime();

  const todayIso = getTodayIsoDate();
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const todayTime = new Date(ty, tm - 1, td).getTime();

  // Considera os últimos 6 meses (~183 dias) a partir da data selecionada ou de hoje
  const sixMonthsMs = 183 * 24 * 60 * 60 * 1000;
  const maxReferenceTime = Math.max(anchorTime, todayTime);
  const minWindowTime = Math.min(anchorTime, todayTime) - sixMonthsMs;

  const matches: RepetitionMatch[] = [];

  for (const plan of params.plans) {
    if (!plan || plan.id === params.excludePlanId) continue;
    if (!plan.scripture || !plan.date || !/^\d{4}-\d{2}-\d{2}$/.test(plan.date)) continue;
    const planNorm = normalizeBibleReference(plan.scripture);
    if (!planNorm || planNorm !== normalizedTarget) continue;

    const [py, pm, pd] = plan.date.split('-').map(Number);
    const planTime = new Date(py, pm - 1, pd).getTime();
    if (planTime >= minWindowTime && planTime <= maxReferenceTime + sixMonthsMs) {
      matches.push({
        source: 'plan',
        date: plan.date,
        label: plan.themeOrTitle?.trim()
          ? `${plan.serviceType} — ${plan.themeOrTitle}`
          : plan.serviceType,
        status: plan.status,
      });
    }
  }

  for (const sermon of params.sermons) {
    if (!sermon || !sermon.history || sermon.history.length === 0) continue;
    const sermonNorm = normalizeBibleReference(sermon.scripture);
    if (!sermonNorm || sermonNorm !== normalizedTarget) continue;

    for (const h of sermon.history) {
      if (!h.date) continue;
      const iso = h.date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
      const [hy, hm, hd] = iso.split('-').map(Number);
      const hTime = new Date(hy, hm - 1, hd).getTime();
      if (hTime >= minWindowTime && hTime <= maxReferenceTime) {
        matches.push({
          source: 'sermon-history',
          date: iso,
          label: `${sermon.title}${h.event ? ` (${h.event})` : ''}`,
          status: 'Pregado',
        });
      }
    }
  }

  // Deduplica por data + rótulo e ordena da mais recente para a mais antiga
  const seen = new Set<string>();
  return matches
    .filter((m) => {
      const key = `${m.date}::${m.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
