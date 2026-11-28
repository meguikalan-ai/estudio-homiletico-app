import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
  Pencil,
  Trash2,
  AlertTriangle,
  Search,
  X,
  Check,
  Filter,
  RotateCcw,
  User,
  Layers,
  Clock
} from 'lucide-react';
import { PreachingPlan, PreachingPlanStatus, Sermon } from '../types';
import {
  PREACHING_SERVICE_TYPES,
  PREACHING_PLAN_STATUSES,
  PREACHING_STATUS_STYLES,
  getTodayIsoDate,
  addDaysToIsoDate,
  formatIsoDateShort,
  formatIsoDateWithWeekday,
  findRecentScriptureMatches
} from '../config/preachingPlanningConfig';

interface PreachingPlannerProps {
  plans: PreachingPlan[];
  sermons: Sermon[];
  availableSeriesNames?: string[];
  onSavePlan: (plan: PreachingPlan) => void | Promise<void>;
  onDeletePlan: (planId: string) => void | Promise<void>;
  onOpenLinkedSermon: (sermonId: string) => void;
}

const MONTH_NAMES_PT = [
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

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface PlanFormState {
  date: string;
  serviceType: string;
  scripture: string;
  themeOrTitle: string;
  seriesName: string;
  preacher: string;
  status: PreachingPlanStatus;
  linkedSermonId: string;
  linkedSermonTitle: string;
  notes: string;
}

function buildEmptyFormState(defaultDate?: string): PlanFormState {
  return {
    date: defaultDate || getTodayIsoDate(),
    serviceType: PREACHING_SERVICE_TYPES[0],
    scripture: '',
    themeOrTitle: '',
    seriesName: '',
    preacher: '',
    status: 'Planejado',
    linkedSermonId: '',
    linkedSermonTitle: '',
    notes: '',
  };
}

export const PreachingPlanner: React.FC<PreachingPlannerProps> = ({
  plans,
  sermons,
  availableSeriesNames = [],
  onSavePlan,
  onDeletePlan,
  onOpenLinkedSermon,
}) => {
  const todayIso = getTodayIsoDate();
  const weekEndIso = addDaysToIsoDate(todayIso, 7);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [listPeriodTab, setListPeriodTab] = useState<'upcoming' | 'past'>('upcoming');

  // Filtros
  const [filterSeries, setFilterSeries] = useState<string>('');
  const [filterServiceType, setFilterServiceType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Calendário mensal
  const [calendarCursor, setCalendarCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDayIso, setSelectedDayIso] = useState<string>(todayIso);

  // Confirmação de exclusão inline
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Modal de criação/edição
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<PreachingPlan | null>(null);
  const [formState, setFormState] = useState<PlanFormState>(() => buildEmptyFormState(todayIso));
  const [sermonSearchQuery, setSermonSearchQuery] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const sermonMap = useMemo(() => {
    const map = new Map<string, Sermon>();
    sermons.forEach((s) => {
      if (s && s.id) map.set(s.id, s);
    });
    return map;
  }, [sermons]);

  // Opções de série combinando planos, sermões e séries criadas
  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.seriesName && p.seriesName.trim()) set.add(p.seriesName.trim());
    });
    sermons.forEach((s) => {
      if (s.seriesName && s.seriesName.trim()) set.add(s.seriesName.trim());
    });
    availableSeriesNames.forEach((name) => {
      if (name && name.trim()) set.add(name.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [plans, sermons, availableSeriesNames]);

  // Lista de tipos de culto para o formulário e filtro (inclui legados se o usuário editar a lista depois)
  const serviceTypeFilterOptions = useMemo(() => {
    const list: string[] = [...PREACHING_SERVICE_TYPES];
    plans.forEach((p) => {
      if (p.serviceType && !list.includes(p.serviceType)) {
        list.push(p.serviceType);
      }
    });
    return list;
  }, [plans]);

  // Pregações da semana (próximos 7 dias: hoje até hoje + 7 dias)
  const weekPlans = useMemo(() => {
    return plans
      .filter((p) => p.date >= todayIso && p.date <= weekEndIso)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  }, [plans, todayIso, weekEndIso]);

  // Aplicação dos filtros
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (filterSeries && (p.seriesName || '').trim() !== filterSeries) return false;
      if (filterServiceType && p.serviceType !== filterServiceType) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [plans, filterSeries, filterServiceType, filterStatus]);

  const upcomingPlans = useMemo(() => {
    return filteredPlans
      .filter((p) => p.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  }, [filteredPlans, todayIso]);

  const pastPlans = useMemo(() => {
    return filteredPlans
      .filter((p) => p.date < todayIso)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [filteredPlans, todayIso]);

  // Mapa de data -> planejamentos filtrados para o calendário
  const plansByDate = useMemo(() => {
    const map = new Map<string, PreachingPlan[]>();
    filteredPlans.forEach((p) => {
      const existing = map.get(p.date) || [];
      existing.push(p);
      map.set(p.date, existing);
    });
    return map;
  }, [filteredPlans]);

  // Células do calendário mensal
  const calendarDays = useMemo(() => {
    const { year, month } = calendarCursor;
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 = Dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string | null; dayNumber: number | null }> = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ iso: null, dayNumber: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, dayNumber: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ iso: null, dayNumber: null });
    }
    return cells;
  }, [calendarCursor]);

  const selectedDayPlans = useMemo(() => {
    return (plansByDate.get(selectedDayIso) || []).slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [plansByDate, selectedDayIso]);

  // Aviso discreto de repetição (últimos 6 meses)
  const repetitionMatches = useMemo(() => {
    if (!isFormOpen || !formState.scripture.trim()) return [];
    return findRecentScriptureMatches({
      scripture: formState.scripture,
      referenceDate: formState.date,
      plans,
      sermons,
      excludePlanId: editingPlan?.id,
    });
  }, [isFormOpen, formState.scripture, formState.date, plans, sermons, editingPlan?.id]);

  // Busca de sermões da Biblioteca dentro do formulário
  const searchableSermons = useMemo(() => {
    const q = sermonSearchQuery.trim().toLowerCase();
    return sermons
      .filter((s) => {
        if (!s || !s.title) return false;
        if (!q) return true;
        return (
          s.title.toLowerCase().includes(q) ||
          (s.scripture || '').toLowerCase().includes(q) ||
          (s.theme || '').toLowerCase().includes(q) ||
          (s.seriesName || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [sermons, sermonSearchQuery]);

  // Fechar modal com ESC
  useEffect(() => {
    if (!isFormOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFormOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFormOpen]);

  const hasActiveFilters = Boolean(filterSeries || filterServiceType || filterStatus);

  const openCreateForm = (prefilledDate?: string) => {
    setEditingPlan(null);
    setFormState(buildEmptyFormState(prefilledDate || todayIso));
    setSermonSearchQuery('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (plan: PreachingPlan) => {
    setEditingPlan(plan);
    setFormState({
      date: plan.date || todayIso,
      serviceType: plan.serviceType || PREACHING_SERVICE_TYPES[0],
      scripture: plan.scripture || '',
      themeOrTitle: plan.themeOrTitle || '',
      seriesName: plan.seriesName || '',
      preacher: plan.preacher || '',
      status: plan.status || 'Planejado',
      linkedSermonId: plan.linkedSermonId || '',
      linkedSermonTitle: plan.linkedSermonTitle || '',
      notes: plan.notes || '',
    });
    setSermonSearchQuery('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleLinkSermonInForm = (sermon: Sermon) => {
    setFormState((prev) => ({
      ...prev,
      linkedSermonId: sermon.id,
      linkedSermonTitle: sermon.title,
      scripture: prev.scripture.trim() ? prev.scripture : sermon.scripture || '',
      themeOrTitle: prev.themeOrTitle.trim() ? prev.themeOrTitle : sermon.title || sermon.theme || '',
      seriesName: prev.seriesName.trim() ? prev.seriesName : sermon.seriesName || '',
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.date || !/^\d{4}-\d{2}-\d{2}$/.test(formState.date)) {
      setFormError('Informe uma data válida para a pregação.');
      return;
    }
    if (!formState.serviceType.trim()) {
      setFormError('Selecione o tipo de culto.');
      return;
    }

    const now = Date.now();
    const nextPlan: PreachingPlan = {
      id: editingPlan?.id || `plan_${now}_${Math.random().toString(36).slice(2, 7)}`,
      date: formState.date,
      serviceType: formState.serviceType.trim(),
      scripture: formState.scripture.trim() || undefined,
      themeOrTitle: formState.themeOrTitle.trim() || undefined,
      seriesName: formState.seriesName.trim() || undefined,
      preacher: formState.preacher.trim(),
      status: formState.status,
      linkedSermonId: formState.linkedSermonId.trim() || undefined,
      linkedSermonTitle: formState.linkedSermonTitle.trim() || undefined,
      notes: formState.notes.trim() || undefined,
      createdAt: editingPlan?.createdAt || now,
      updatedAt: now,
    };

    await onSavePlan(nextPlan);
    setSelectedDayIso(nextPlan.date);
    setIsFormOpen(false);
  };

  const handleQuickStatusChange = async (plan: PreachingPlan, nextStatus: PreachingPlanStatus) => {
    if (plan.status === nextStatus) return;
    await onSavePlan({
      ...plan,
      status: nextStatus,
      updatedAt: Date.now(),
    });
  };

  const handleConfirmDelete = async (planId: string) => {
    setConfirmingDeleteId(null);
    await onDeletePlan(planId);
  };

  const goToPrevMonth = () => {
    setCalendarCursor((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCalendarCursor((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const goToTodayMonth = () => {
    const now = new Date();
    setCalendarCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDayIso(todayIso);
  };

  const renderPlanCard = (plan: PreachingPlan) => {
    const statusStyle = PREACHING_STATUS_STYLES[plan.status] || PREACHING_STATUS_STYLES.Planejado;
    const linkedSermon = plan.linkedSermonId ? sermonMap.get(plan.linkedSermonId) : undefined;
    const isConfirmingDelete = confirmingDeleteId === plan.id;

    return (
      <article
        key={plan.id}
        className="bg-white rounded-xl border border-[#E6E2DA] p-4 sm:p-5 transition-colors hover:border-[#C9C2B4]"
      >
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            {/* Linha superior discreta: Data · Culto · Situação */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-600">
              <span className="font-bold text-[#2D2926] tabular-nums">
                {formatIsoDateWithWeekday(plan.date)}
              </span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span className="font-medium text-[#5A5A40]">{plan.serviceType}</span>
              <span aria-hidden="true" className="text-gray-300">·</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${statusStyle.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} aria-hidden="true" />
                <span>{statusStyle.label}</span>
              </span>
            </div>

            {/* Título / Tema principal */}
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#2D2926] leading-snug">
              {plan.themeOrTitle || plan.scripture || 'Pregação planejada (sem tema definido)'}
            </h3>

            {/* Metadados: Texto bíblico, Série, Pregador */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 pt-0.5">
              {plan.scripture && (
                <span className="inline-flex items-center gap-1.5 text-[#2D2926] font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                  <span>{plan.scripture}</span>
                </span>
              )}
              {plan.seriesName && (
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <Layers className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>Série: {plan.seriesName}</span>
                </span>
              )}
              {plan.preacher && (
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{plan.preacher}</span>
                </span>
              )}
            </div>

            {plan.notes && (
              <p className="text-xs text-gray-600 leading-relaxed pt-1 whitespace-pre-line">
                {plan.notes}
              </p>
            )}

            {plan.linkedSermonId && !linkedSermon && (
              <p className="text-[11px] text-amber-800 pt-1">
                Sermão vinculado ({plan.linkedSermonTitle || 'removido da Biblioteca'}) não foi encontrado na Biblioteca atual.
              </p>
            )}
          </div>

          {/* Controles de ação */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#F0ECE4]">
            <label className="sr-only" htmlFor={`status-select-${plan.id}`}>
              Alterar situação
            </label>
            <select
              id={`status-select-${plan.id}`}
              value={plan.status}
              onChange={(e) => void handleQuickStatusChange(plan, e.target.value as PreachingPlanStatus)}
              className="bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-2.5 py-2 text-xs font-medium text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer min-h-[38px]"
              title="Alterar situação"
            >
              {PREACHING_PLAN_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {linkedSermon && (
              <button
                type="button"
                onClick={() => onOpenLinkedSermon(linkedSermon.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#5A5A40] hover:bg-[#2D2926] text-white transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
                title={`Abrir "${linkedSermon.title}" na Oficina`}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Abrir sermão</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openEditForm(plan)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white hover:bg-[#FAF8F5] text-[#2D2926] border border-[#E6E2DA] transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
              title="Editar planejamento"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              <span>Editar</span>
            </button>

            {isConfirmingDelete ? (
              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                <button
                  type="button"
                  onClick={() => void handleConfirmDelete(plan.id)}
                  className="px-2.5 py-1 rounded-md bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(null)}
                  className="px-2 py-1 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeleteId(plan.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white hover:bg-red-50 text-gray-600 hover:text-red-700 border border-[#E6E2DA] hover:border-red-200 transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
                title="Apagar planejamento"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Apagar</span>
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Cabeçalho principal */}
      <div className="bg-white/80 p-5 sm:p-6 rounded-xl border border-[#E6E2DA] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-serif text-[#2D2926] font-bold">
            Planejamento de Pregações
          </h1>
          <p className="text-xs text-gray-500">
            Organize as datas dos cultos, textos bíblicos, pregadores e vínculos com a sua Biblioteca.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador Lista / Calendário */}
          <div className="inline-flex items-center p-1 bg-[#EDEBE6] rounded-lg border border-[#E6E2DA]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-white text-[#2D2926] shadow-2xs'
                  : 'text-gray-600 hover:text-[#2D2926]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#2D2926] shadow-2xs'
                  : 'text-gray-600 hover:text-[#2D2926]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openCreateForm(viewMode === 'calendar' ? selectedDayIso : todayIso)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white transition-colors cursor-pointer whitespace-nowrap min-h-[38px]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Novo planejamento</span>
          </button>
        </div>
      </div>

      {/* Resumo: Pregações da semana (próximos 7 dias) */}
      <section
        aria-label="Pregações da semana"
        className="bg-[#FAF8F5] rounded-xl border border-[#E6E2DA] p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#5A5A40] shrink-0" />
            <h2 className="font-serif text-base font-bold text-[#2D2926]">
              Pregações da semana
            </h2>
            <span className="text-xs text-gray-500 tabular-nums">
              ({formatIsoDateShort(todayIso)} a {formatIsoDateShort(weekEndIso)})
            </span>
          </div>
          <span className="text-xs font-medium text-[#5A5A40] tabular-nums">
            {weekPlans.length} {weekPlans.length === 1 ? 'pregação nos próximos 7 dias' : 'pregações nos próximos 7 dias'}
          </span>
        </div>

        {weekPlans.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {weekPlans.map((plan) => {
              const statusStyle = PREACHING_STATUS_STYLES[plan.status] || PREACHING_STATUS_STYLES.Planejado;
              const linkedSermon = plan.linkedSermonId ? sermonMap.get(plan.linkedSermonId) : undefined;
              return (
                <div
                  key={`week-${plan.id}`}
                  className="bg-white rounded-lg border border-[#E6E2DA] p-3.5 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[#2D2926] tabular-nums">
                        {formatIsoDateWithWeekday(plan.date)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${statusStyle.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotClass}`} aria-hidden="true" />
                        <span>{statusStyle.label}</span>
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#5A5A40]">{plan.serviceType}</p>
                    <p className="font-serif text-sm font-bold text-[#2D2926] line-clamp-1">
                      {plan.themeOrTitle || plan.scripture || 'Tema a definir'}
                    </p>
                    {plan.scripture && plan.themeOrTitle && (
                      <p className="text-xs text-gray-600 line-clamp-1">{plan.scripture}</p>
                    )}
                    {plan.preacher && (
                      <p className="text-[11px] text-gray-500 line-clamp-1">Pregador: {plan.preacher}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1.5 border-t border-[#F0ECE4]">
                    {linkedSermon && (
                      <button
                        type="button"
                        onClick={() => onOpenLinkedSermon(linkedSermon.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#5A5A40] hover:text-[#2D2926] cursor-pointer whitespace-nowrap"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Abrir sermão</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditForm(plan)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[#2D2926] ml-auto cursor-pointer whitespace-nowrap"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#E6E2DA] px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Nenhuma pregação planejada para os próximos 7 dias.
            </p>
            <button
              type="button"
              onClick={() => openCreateForm(todayIso)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5A40] hover:bg-[#F5F2ED] border border-[#E6E2DA] cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar para esta semana</span>
            </button>
          </div>
        )}
      </section>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-[#E6E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2D2926] shrink-0">
          <Filter className="w-3.5 h-3.5 text-[#5A5A40]" />
          <span>Filtrar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
          <select
            aria-label="Filtrar por tipo de culto"
            value={filterServiceType}
            onChange={(e) => setFilterServiceType(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
          >
            <option value="">Todos os tipos de culto</option>
            {serviceTypeFilterOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por série"
            value={filterSeries}
            onChange={(e) => setFilterSeries(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
          >
            <option value="">Todas as séries</option>
            {seriesOptions.map((series) => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por situação"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
          >
            <option value="">Todas as situações</option>
            {PREACHING_PLAN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilterSeries('');
              setFilterServiceType('');
              setFilterStatus('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:text-[#2D2926] bg-[#FAF8F5] border border-[#E6E2DA] cursor-pointer whitespace-nowrap self-start lg:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        )}
      </div>

      {/* VISÃO EM LISTA */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Abas Próximas / Anteriores */}
          <div className="flex items-center justify-between gap-3 border-b border-[#E6E2DA] pb-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setListPeriodTab('upcoming')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  listPeriodTab === 'upcoming'
                    ? 'bg-[#2D2926] text-white'
                    : 'text-gray-600 hover:bg-white hover:text-[#2D2926]'
                }`}
              >
                <span>Próximas</span>
                <span className="ml-1.5 opacity-80 tabular-nums">({upcomingPlans.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setListPeriodTab('past')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  listPeriodTab === 'past'
                    ? 'bg-[#2D2926] text-white'
                    : 'text-gray-600 hover:bg-white hover:text-[#2D2926]'
                }`}
              >
                <span>Anteriores</span>
                <span className="ml-1.5 opacity-80 tabular-nums">({pastPlans.length})</span>
              </button>
            </div>
          </div>

          {listPeriodTab === 'upcoming' ? (
            upcomingPlans.length > 0 ? (
              <div className="space-y-3">{upcomingPlans.map(renderPlanCard)}</div>
            ) : (
              <div className="bg-white rounded-xl border border-[#E6E2DA] p-10 text-center space-y-3">
                <p className="text-sm font-medium text-[#2D2926]">
                  {hasActiveFilters
                    ? 'Nenhuma pregação futura corresponde aos filtros aplicados.'
                    : 'Nenhuma pregação futura planejada ainda.'}
                </p>
                <p className="text-xs text-gray-500 max-w-md mx-auto">
                  Organize os próximos cultos registrando a data, o tipo de culto, o texto bíblico e o pregador.
                </p>
                <button
                  type="button"
                  onClick={() => openCreateForm(todayIso)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo planejamento</span>
                </button>
              </div>
            )
          ) : pastPlans.length > 0 ? (
            <div className="space-y-3">{pastPlans.map(renderPlanCard)}</div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E6E2DA] p-10 text-center space-y-2">
              <p className="text-sm font-medium text-[#2D2926]">
                Nenhum planejamento em datas anteriores.
              </p>
              <p className="text-xs text-gray-500">
                As pregações com data passada aparecem automaticamente nesta aba para consulta e controle de repetição.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VISÃO EM CALENDÁRIO MENSAL */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Grade do mês */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E6E2DA] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-bold text-[#2D2926]">
                {MONTH_NAMES_PT[calendarCursor.month]} de {calendarCursor.year}
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  aria-label="Mês anterior"
                  className="p-2 rounded-lg border border-[#E6E2DA] hover:bg-[#FAF8F5] text-[#2D2926] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={goToTodayMonth}
                  className="px-3 py-1.5 rounded-lg border border-[#E6E2DA] hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2926] cursor-pointer min-h-[38px]"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  aria-label="Próximo mês"
                  className="p-2 rounded-lg border border-[#E6E2DA] hover:bg-[#FAF8F5] text-[#2D2926] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dias da semana */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
              {WEEKDAY_HEADERS.map((wd) => (
                <div key={wd} className="text-[11px] font-semibold text-gray-500 py-1.5">
                  {wd}
                </div>
              ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((cell, idx) => {
                if (!cell.iso || cell.dayNumber === null) {
                  return <div key={`empty-${idx}`} className="min-h-[48px] sm:min-h-[76px] rounded-lg bg-[#FAF8F5]/50" />;
                }

                const dayPlans = plansByDate.get(cell.iso) || [];
                const isToday = cell.iso === todayIso;
                const isSelected = cell.iso === selectedDayIso;
                const hasPlans = dayPlans.length > 0;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => setSelectedDayIso(cell.iso!)}
                    className={`min-h-[48px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2D2926] text-white border-[#2D2926]'
                        : hasPlans
                        ? 'bg-[#FAF8F5] text-[#2D2926] border-[#CFC9BC] hover:border-[#5A5A40]'
                        : 'bg-white text-[#2D2926] border-[#EDEAE2] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-bold tabular-nums leading-none ${
                          isToday && !isSelected
                            ? 'text-[#5A5A40] underline underline-offset-4 decoration-2'
                            : ''
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {hasPlans && (
                        <span
                          className={`text-[10px] font-bold tabular-nums px-1 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-[#E9E5DC] text-[#2D2926]'
                          }`}
                        >
                          {dayPlans.length}
                        </span>
                      )}
                    </div>

                    {/* Marcadores visuais no dia */}
                    {hasPlans && (
                      <div className="w-full space-y-1 mt-1">
                        {/* Dots visíveis no celular e desktop */}
                        <div className="flex sm:hidden items-center gap-1 flex-wrap">
                          {dayPlans.slice(0, 3).map((dp) => {
                            const dotStyle = PREACHING_STATUS_STYLES[dp.status] || PREACHING_STATUS_STYLES.Planejado;
                            return (
                              <span
                                key={dp.id}
                                className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300' : dotStyle.dotClass}`}
                              />
                            );
                          })}
                        </div>

                        {/* Etiquetas compactas em telas sm+ */}
                        <div className="hidden sm:flex flex-col gap-0.5">
                          {dayPlans.slice(0, 2).map((dp) => (
                            <span
                              key={dp.id}
                              className={`text-[10px] leading-tight truncate px-1 py-0.5 rounded border ${
                                isSelected
                                  ? 'bg-white/15 border-white/20 text-white'
                                  : (PREACHING_STATUS_STYLES[dp.status] || PREACHING_STATUS_STYLES.Planejado).calendarChipClass
                              }`}
                            >
                              {dp.themeOrTitle || dp.scripture || dp.serviceType}
                            </span>
                          ))}
                          {dayPlans.length > 2 && (
                            <span className={`text-[10px] tabular-nums ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                              +{dayPlans.length - 2} mais
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel do dia selecionado */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#E6E2DA] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EDEAE2]">
              <div>
                <p className="text-[11px] font-semibold text-gray-500">Dia selecionado</p>
                <h3 className="font-serif text-base font-bold text-[#2D2926] tabular-nums">
                  {formatIsoDateWithWeekday(selectedDayIso)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => openCreateForm(selectedDayIso)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Planejar neste dia</span>
              </button>
            </div>

            {selectedDayPlans.length > 0 ? (
              <div className="space-y-3">{selectedDayPlans.map(renderPlanCard)}</div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs font-medium text-gray-600">
                  Nenhuma pregação planejada para este dia.
                </p>
                <p className="text-[11px] text-gray-400">
                  Toque em &ldquo;Planejar neste dia&rdquo; para adicionar um culto ou evento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FORMULÁRIO DE CRIAÇÃO / EDIÇÃO */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-[9998] bg-[#2D2926]/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsFormOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="preaching-plan-form-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[#E6E2DA] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E6E2DA] bg-[#FAF8F5]">
              <div>
                <h2 id="preaching-plan-form-title" className="font-serif text-lg font-bold text-[#2D2926]">
                  {editingPlan ? 'Editar planejamento' : 'Novo planejamento'}
                </h2>
                <p className="text-xs text-gray-500">
                  Preencha a data, o culto e os detalhes da pregação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                aria-label="Fechar formulário"
                className="p-2 rounded-lg text-gray-500 hover:text-[#2D2926] hover:bg-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo com rolagem */}
            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label htmlFor="plan-date" className="block text-xs font-semibold text-[#2D2926] mb-1">
                    Data *
                  </label>
                  <input
                    id="plan-date"
                    type="date"
                    required
                    value={formState.date}
                    onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                </div>

                <div>
                  <label htmlFor="plan-service-type" className="block text-xs font-semibold text-[#2D2926] mb-1">
                    Tipo de culto *
                  </label>
                  <select
                    id="plan-service-type"
                    required
                    value={formState.serviceType}
                    onChange={(e) => setFormState((prev) => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  >
                    {PREACHING_SERVICE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    {!PREACHING_SERVICE_TYPES.includes(formState.serviceType as (typeof PREACHING_SERVICE_TYPES)[number]) &&
                      formState.serviceType && (
                        <option value={formState.serviceType}>{formState.serviceType}</option>
                      )}
                  </select>
                </div>

                <div>
                  <label htmlFor="plan-status" className="block text-xs font-semibold text-[#2D2926] mb-1">
                    Situação *
                  </label>
                  <select
                    id="plan-status"
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, status: e.target.value as PreachingPlanStatus }))
                    }
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  >
                    {PREACHING_PLAN_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Texto bíblico + Aviso discreto de repetição */}
              <div>
                <label htmlFor="plan-scripture" className="block text-xs font-semibold text-[#2D2926] mb-1">
                  Texto bíblico (opcional)
                </label>
                <input
                  id="plan-scripture"
                  type="text"
                  value={formState.scripture}
                  onChange={(e) => setFormState((prev) => ({ ...prev, scripture: e.target.value }))}
                  placeholder="Ex.: Romanos 12:1-2 ou Salmos 23"
                  className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />

                {repetitionMatches.length > 0 && (
                  <div
                    role="status"
                    className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Aviso de repetição: este texto bíblico já aparece nos últimos 6 meses.
                      </p>
                      <ul className="space-y-0.5 text-[11px] text-amber-900">
                        {repetitionMatches.slice(0, 3).map((match, idx) => (
                          <li key={`${match.date}-${idx}`}>
                            <span className="font-semibold tabular-nums">{formatIsoDateShort(match.date)}</span>
                            {' — '}
                            {match.label}
                            {match.status ? ` (${match.status})` : ''}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-amber-800">
                        É apenas um aviso informativo e não impede o salvamento.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="plan-theme" className="block text-xs font-semibold text-[#2D2926] mb-1">
                    Tema ou título (opcional)
                  </label>
                  <input
                    id="plan-theme"
                    type="text"
                    value={formState.themeOrTitle}
                    onChange={(e) => setFormState((prev) => ({ ...prev, themeOrTitle: e.target.value }))}
                    placeholder="Ex.: O culto racional da consagração"
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                </div>

                <div>
                  <label htmlFor="plan-series" className="block text-xs font-semibold text-[#2D2926] mb-1">
                    Série (opcional)
                  </label>
                  <input
                    id="plan-series"
                    type="text"
                    list="planner-series-suggestions"
                    value={formState.seriesName}
                    onChange={(e) => setFormState((prev) => ({ ...prev, seriesName: e.target.value }))}
                    placeholder="Ex.: Carta aos Romanos"
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                  <datalist id="planner-series-suggestions">
                    {seriesOptions.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label htmlFor="plan-preacher" className="block text-xs font-semibold text-[#2D2926] mb-1">
                  Pregador
                </label>
                <input
                  id="plan-preacher"
                  type="text"
                  value={formState.preacher}
                  onChange={(e) => setFormState((prev) => ({ ...prev, preacher: e.target.value }))}
                  placeholder="Ex.: Pr. Fernando Veiga"
                  className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
              </div>

              {/* Vincular a um sermão da Biblioteca */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="plan-sermon-search" className="block text-xs font-semibold text-[#2D2926]">
                    Vincular a um sermão da Biblioteca (opcional)
                  </label>
                  {formState.linkedSermonId && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((prev) => ({ ...prev, linkedSermonId: '', linkedSermonTitle: '' }))
                      }
                      className="text-[11px] font-semibold text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      Remover vínculo
                    </button>
                  )}
                </div>

                {formState.linkedSermonId && (
                  <div className="p-2.5 rounded-lg bg-[#F2F1EA] border border-[#D6D3C4] flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[11px] text-[#5A5A40] font-semibold block">Sermão vinculado</span>
                      <span className="font-bold text-[#2D2926] truncate block">
                        {sermonMap.get(formState.linkedSermonId)?.title ||
                          formState.linkedSermonTitle ||
                          formState.linkedSermonId}
                      </span>
                    </div>
                    <Check className="w-4 h-4 text-[#5A5A40] shrink-0" />
                  </div>
                )}

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="plan-sermon-search"
                    type="search"
                    value={sermonSearchQuery}
                    onChange={(e) => setSermonSearchQuery(e.target.value)}
                    placeholder="Buscar sermão salvo por título, texto bíblico ou tema..."
                    className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg pl-9 pr-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E6E2DA] divide-y divide-[#F0ECE4] bg-white">
                  {searchableSermons.length > 0 ? (
                    searchableSermons.map((sermon) => {
                      const isLinked = formState.linkedSermonId === sermon.id;
                      return (
                        <button
                          key={sermon.id}
                          type="button"
                          onClick={() => handleLinkSermonInForm(sermon)}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isLinked ? 'bg-[#F2F1EA] text-[#2D2926]' : 'hover:bg-[#FAF8F5] text-[#2D2926]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{sermon.title}</p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {sermon.scripture}
                              {sermon.seriesName ? ` · ${sermon.seriesName}` : ''}
                            </p>
                          </div>
                          {isLinked && <Check className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-3 text-xs text-gray-400 text-center">
                      Nenhum sermão encontrado na Biblioteca.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="plan-notes" className="block text-xs font-semibold text-[#2D2926] mb-1">
                  Observações
                </label>
                <textarea
                  id="plan-notes"
                  rows={3}
                  value={formState.notes}
                  onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Anotações sobre hinos, ceia, visitantes, ocasiões especiais..."
                  className="w-full bg-[#FAF8F5] border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6E2DA]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:text-[#2D2926] bg-[#FAF8F5] border border-[#E6E2DA] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white transition-colors cursor-pointer"
                >
                  {editingPlan ? 'Salvar alterações' : 'Salvar planejamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
