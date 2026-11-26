import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  BookOpenCheck,
  Check,
  Clock,
  Copy,
  Eye,
  FileEdit,
  GraduationCap,
  HeartHandshake,
  LayoutList,
  Loader2,
  Maximize2,
  Megaphone,
  MessageCircleQuestion,
  Music,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Users,
  X
} from 'lucide-react';
import {
  DetailedHymn,
  ExpositoryPoint,
  Sermon,
  SermonDerivationDuration,
  SermonDerivationDraftMeta,
  SermonDerivationMode
} from '../types';
import { getCardDerivationBadge, normalizeCardBibleMetadata } from './SermonLibraryModal';
import { splitFluentParagraphs, structureExpositoryPoint } from '../utils/sermonPointFormatting';
import { hydrateHymnsIfLegacy } from '../hymnsData';

export interface DerivedSermonPopupProps {
  isOpen: boolean;
  sermon: Sermon | null;
  meta: SermonDerivationDraftMeta | null;
  sourceSermon?: Sermon | null;
  isDeriving?: boolean;
  isBlockedByOverlay?: boolean;
  fallbackNotice?: string | null;
  canRetryFallback?: boolean;
  isRetryingFallback?: boolean;
  onRetryFallback?: () => void;
  onDismissFallback?: () => void;
  onSwitchDuration?: (duration: '20' | '30' | '40') => void;
  onUpdateSermon: (updated: Sermon) => void;
  onSaveToLibrary: () => void;
  onOpenPulpit: (sermon: Sermon) => void;
  onDiscard: () => void;
  onClose: () => void;
  onOpenLyricsModal?: (hymn: DetailedHymn) => void;
}

const STYLE_LABELS: Record<Sermon['style'], string> = {
  original: 'Pastoral Equilibrado',
  isaltino: 'Isaltino Gomes',
  billy: 'Billy Graham',
  biblico: 'Expositivo Clássico',
  conviccional: 'Conviccional'
};

function extractSectionCues(
  paragraphs: string[],
  mode: SermonDerivationMode
): {
  classQuestions: string[];
  teacherGuides: string[];
  groupQuestions: string[];
  applications: string[];
} {
  const classQuestions: string[] = [];
  const teacherGuides: string[] = [];
  const groupQuestions: string[] = [];
  const applications: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (mode === 'ebd') {
      const classMatch = trimmed.match(/Pergunta\s+para\s+a\s+Classe\s*[:\-–—]\s*([\s\S]+?)(?=Guia\s+de\s+Resposta|$)/i);
      const guideMatch = trimmed.match(/Guia\s+de\s+Resposta(?:\s+para\s+o\s+Professor)?\s*[:\-–—]\s*([\s\S]+)$/i);

      if (classMatch || guideMatch) {
        const prefixText = trimmed
          .split(/Pergunta\s+para\s+a\s+Classe|Guia\s+de\s+Resposta/i)[0]
          ?.trim();
        if (prefixText) applications.push(prefixText);
        if (classMatch?.[1]) classQuestions.push(classMatch[1].trim());
        if (guideMatch?.[1]) teacherGuides.push(guideMatch[1].trim());
        continue;
      }
    }

    if (mode === 'bible-study') {
      const inlineMatch = trimmed.match(
        /^(.*?)(?:\s*)(Pergunta(?:\s+para\s+(?:Discuss[ãa]o|o\s+Grupo|Reflex[ãa]o))?(?:\s*\(PG\))?\s*[:\-–—]\s*[\s\S]+)$/i
      );
      if (inlineMatch) {
        const before = (inlineMatch[1] || '').trim();
        const questionPart = (inlineMatch[2] || '')
          .replace(/^Pergunta(?:\s+para\s+(?:Discuss[ãa]o|o\s+Grupo|Reflex[ãa]o))?(?:\s*\(PG\))?\s*[:\-–—]\s*/i, '')
          .trim();
        if (before) applications.push(before);
        if (questionPart) groupQuestions.push(questionPart);
        continue;
      }
      if (/^como\s+podemos|o\s+que\s+esta\s+verdade|de\s+que\s+forma/i.test(trimmed) && trimmed.endsWith('?')) {
        groupQuestions.push(trimmed);
        continue;
      }
    }

    applications.push(trimmed);
  }

  return { classQuestions, teacherGuides, groupQuestions, applications };
}

interface CatecheticalQAPair {
  question: string;
  answer: string;
}

function extractCatecheticalQA(rawText: string): {
  pairs: CatecheticalQAPair[];
  extraParagraphs: string[];
} {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return { pairs: [], extraParagraphs: [] };

  const blocks = normalized
    .split(/(?=(?:^|\n)\s*(?:Pergunta(?:\s*\d+)?|P\.?\s*\d*)\s*[:\-–—])/i)
    .map((b) => b.trim())
    .filter(Boolean);

  const pairs: CatecheticalQAPair[] = [];
  const extraParagraphs: string[] = [];

  for (const block of blocks) {
    const qaMatch = block.match(
      /^(?:Pergunta(?:\s*\d+)?|P\.?\s*\d*)\s*[:\-–—]\s*([\s\S]+?)\n+\s*(?:Resposta(?:\s*\d+)?|R\.?\s*\d*)\s*[:\-–—]\s*([\s\S]+)$/i
    ) || block.match(
      /^(?:Pergunta(?:\s*\d+)?|P\.?\s*\d*)\s*[:\-–—]\s*([^\n]+?)\s+(?:Resposta(?:\s*\d+)?|R\.?\s*\d*)\s*[:\-–—]\s*([\s\S]+)$/i
    );

    if (qaMatch) {
      pairs.push({
        question: qaMatch[1].trim(),
        answer: qaMatch[2].trim()
      });
    } else {
      splitFluentParagraphs(block).forEach((p) => extraParagraphs.push(p));
    }
  }

  return { pairs, extraParagraphs };
}

function buildFormattedPlainText(
  sermon: Sermon,
  mode: SermonDerivationMode,
  badgeLabel: string,
  forWhatsApp = false
): string {
  const b = (txt: string) => (forWhatsApp ? `*${txt}*` : txt);
  const lines: string[] = [];

  lines.push(b(sermon.title));
  lines.push(`${forWhatsApp ? `📖 ${sermon.scripture} (${sermon.bibleVersion})` : `[${badgeLabel}] • ${sermon.scripture} (${sermon.bibleVersion})`}`);
  if (sermon.theme) lines.push(`${b('Tema:')} ${sermon.theme}`);
  if (!forWhatsApp && sermon.audience) lines.push(`Público: ${sermon.audience}`);
  lines.push('');

  if (sermon.introduction) {
    const introHeading =
      mode === 'bible-study'
        ? '1. Abertura & Acolhimento'
        : mode === 'ebd'
        ? 'Objetivo Pedagógico & Introdução'
        : mode === 'catechetical'
        ? 'Propósito Catequético & Síntese Doutrinária'
        : mode === 'post-service'
        ? 'Resumo da Mensagem'
        : mode === 'devotional'
        ? 'Meditação Inicial'
        : 'Introdução';
    lines.push(b(forWhatsApp ? introHeading : `=== ${introHeading.toUpperCase()} ===`));
    lines.push(sermon.introduction);
    lines.push('');
  }

  if (sermon.biblicalContext && mode !== 'post-service') {
    const ctxHeading =
      mode === 'ebd'
        ? 'Panorama Histórico-Doutrinário'
        : mode === 'catechetical'
        ? 'Fundamento Bíblico & Canônico'
        : 'Contexto Bíblico';
    lines.push(b(forWhatsApp ? ctxHeading : `=== ${ctxHeading.toUpperCase()} ===`));
    lines.push(sermon.biblicalContext);
    lines.push('');
  }

  if (sermon.expositoryPoints && sermon.expositoryPoints.length > 0) {
    const ptsHeading =
      mode === 'post-service'
        ? 'Pontos-Chave para Relembrar'
        : mode === 'bible-study'
        ? 'Roteiro Expositivo & Diálogo'
        : mode === 'catechetical'
        ? 'Perguntas & Respostas Doutrinárias'
        : mode === 'pulpit-card'
        ? 'Esboço de Púlpito'
        : 'Desenvolvimento Expositivo';
    lines.push(b(forWhatsApp ? ptsHeading : `=== ${ptsHeading.toUpperCase()} ===`));
    lines.push('');

    sermon.expositoryPoints.forEach((pt, idx) => {
      const structured = structureExpositoryPoint(pt, idx);
      lines.push(b(structured.romanTitle));
      if (pt.precedingTransition && !forWhatsApp) {
        lines.push(`(${pt.precedingTransition})`);
      }
      if (structured.fullExplanation) {
        lines.push(structured.fullExplanation);
      }
      if (pt.illustration?.description && !forWhatsApp) {
        const illTag = pt.illustration.type === 'bíblica' ? 'ILUSTRAÇÃO BÍBLICA' : 'ILUSTRAÇÃO COTIDIANO';
        lines.push(`[${illTag}] ${pt.illustration.description}`);
      }
      const cues = extractSectionCues(structured.applicationParagraphs, mode);
      if (cues.applications.length > 0) {
        lines.push(forWhatsApp ? `• ${cues.applications.join(' ')}` : `[APLICAÇÃO] ${cues.applications.join('\n\n')}`);
      }
      if (cues.groupQuestions.length > 0) {
        lines.push(`[PERGUNTA PARA O GRUPO] ${cues.groupQuestions.join('\n\n')}`);
      }
      if (cues.classQuestions.length > 0) {
        lines.push(`[PERGUNTA PARA A CLASSE] ${cues.classQuestions.join('\n\n')}`);
      }
      if (cues.teacherGuides.length > 0) {
        lines.push(`[GUIA DO PROFESSOR] ${cues.teacherGuides.join('\n\n')}`);
      }
      lines.push('');
    });
  }

  if (sermon.applications && sermon.applications.length > 0 && (mode === 'post-service' || mode === 'bible-study' || mode === 'ebd' || mode === 'catechetical' || mode === 'counseling')) {
    const listTitle =
      mode === 'post-service'
        ? 'Guia de Leitura & Oração da Semana'
        : mode === 'ebd'
        ? 'Pontos de Fixação da Lição'
        : mode === 'catechetical'
        ? 'Declarações de Fé para Memorizar'
        : mode === 'counseling'
        ? 'Práticas da Semana'
        : 'Passos Práticos do Grupo';
    lines.push(b(forWhatsApp ? listTitle : `=== ${listTitle.toUpperCase()} ===`));
    sermon.applications.forEach((item) => {
      lines.push(`• ${item}`);
    });
    lines.push('');
  }

  if (sermon.conclusion) {
    lines.push(b(forWhatsApp ? 'Conclusão' : '=== CONCLUSÃO ==='));
    lines.push(sermon.conclusion);
    lines.push('');
  }

  if (sermon.pastoralAppeal) {
    const appealHeading =
      mode === 'devotional'
        ? 'Oração Final'
        : mode === 'bible-study'
        ? 'Oração & Comunhão'
        : mode === 'catechetical'
        ? 'Confissão & Firmeza Doutrinária'
        : mode === 'evangelistic'
        ? 'Convite Pastoral'
        : 'Apelo Pastoral';
    lines.push(b(forWhatsApp ? appealHeading : `=== ${appealHeading.toUpperCase()} ===`));
    lines.push(sermon.pastoralAppeal);
  }

  return lines.join('\n').trim();
}

export const DerivedSermonPopup: React.FC<DerivedSermonPopupProps> = ({
  isOpen,
  sermon,
  meta,
  sourceSermon,
  isDeriving = false,
  isBlockedByOverlay = false,
  fallbackNotice,
  canRetryFallback = false,
  isRetryingFallback = false,
  onRetryFallback,
  onDismissFallback,
  onSwitchDuration,
  onUpdateSermon,
  onSaveToLibrary,
  onOpenPulpit,
  onDiscard,
  onClose,
  onOpenLyricsModal
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedHymnKey, setCopiedHymnKey] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setConfirmDiscard(false);
    setIsEditing(false);
  }, [isOpen, sermon?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeriving && !isBlockedByOverlay) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeriving, isBlockedByOverlay, onClose]);

  const structuredPoints = useMemo(() => {
    if (!sermon?.expositoryPoints) return [];
    return sermon.expositoryPoints.map((pt, idx) => ({
      raw: pt,
      structured: structureExpositoryPoint(pt, idx)
    }));
  }, [sermon]);

  const hydratedHymns = useMemo(() => {
    if (!sermon?.hymns) return null;
    return hydrateHymnsIfLegacy(sermon.hymns);
  }, [sermon?.hymns]);

  if (!isOpen || !sermon) return null;

  const badge = getCardDerivationBadge(sermon);
  const effectiveMode: SermonDerivationMode = sermon.derivation?.mode || meta?.mode || 'duration';
  const effectiveDuration = (sermon.derivation?.duration || meta?.duration || sermon.duration || '30') as SermonDerivationDuration;
  const isBibleStudy = effectiveMode === 'bible-study';
  const isDevotional = effectiveMode === 'devotional';
  const isPulpitCard = effectiveMode === 'pulpit-card';
  const isEbd = effectiveMode === 'ebd';
  const isCatechetical = effectiveMode === 'catechetical';
  const isEvangelistic = effectiveMode === 'evangelistic';
  const isCounseling = effectiveMode === 'counseling';
  const isPostService = effectiveMode === 'post-service';
  const supportsDurationSwitch =
    effectiveMode === 'duration' ||
    effectiveMode === 'bible-study' ||
    effectiveMode === 'ebd' ||
    effectiveMode === 'catechetical' ||
    effectiveMode === 'evangelistic';

  const sourceTitle = sermon.derivation?.sourceTitle || meta?.sourceTitle || sourceSermon?.title || '';
  const { reference, version } = normalizeCardBibleMetadata(sermon.scripture, sermon.bibleVersion);

  const badgePalette =
    isBibleStudy
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : isDevotional
      ? 'bg-rose-50 text-rose-900 border-rose-200'
      : isPulpitCard
      ? 'bg-slate-100 text-slate-800 border-slate-300'
      : isEbd
      ? 'bg-sky-50 text-sky-900 border-sky-200'
      : isCatechetical
      ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
      : isEvangelistic
      ? 'bg-orange-50 text-orange-900 border-orange-200'
      : isCounseling
      ? 'bg-teal-50 text-teal-900 border-teal-200'
      : isPostService
      ? 'bg-purple-50 text-purple-900 border-purple-200'
      : 'bg-amber-50 text-amber-900 border-amber-200';

  const introParagraphs = splitFluentParagraphs(sermon.introduction || '');
  const contextParagraphs = splitFluentParagraphs(sermon.biblicalContext || '');
  const conclusionParagraphs = splitFluentParagraphs(sermon.conclusion || '');
  const appealParagraphs = splitFluentParagraphs(sermon.pastoralAppeal || '');

  const handleCopyAll = (forWhatsApp = false) => {
    const text = buildFormattedPlainText(sermon, effectiveMode, badge.label, forWhatsApp);
    navigator.clipboard.writeText(text);
    if (forWhatsApp) {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } else {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    }
  };

  const handleCopyHymn = (hymn: DetailedHymn, key: string) => {
    const text = `${hymn.hinario} ${hymn.number} — ${hymn.title}\nAutor: ${hymn.author}\n\n${hymn.fullLyrics}`;
    navigator.clipboard.writeText(text);
    setCopiedHymnKey(key);
    setTimeout(() => setCopiedHymnKey(null), 2200);
  };

  const updateField = <K extends keyof Sermon>(key: K, value: Sermon[K]) => {
    onUpdateSermon({
      ...sermon,
      [key]: value,
      updatedAt: Date.now()
    });
  };

  const updatePoint = (index: number, patch: Partial<ExpositoryPoint>) => {
    const nextPoints = (sermon.expositoryPoints || []).map((pt, idx) =>
      idx === index ? { ...pt, ...patch } : pt
    );
    updateField('expositoryPoints', nextPoints);
  };

  const addPoint = () => {
    const nextIdx = (sermon.expositoryPoints || []).length + 1;
    const nextPoints: ExpositoryPoint[] = [
      ...(sermon.expositoryPoints || []),
      {
        title: `${nextIdx}. Novo Tópico`,
        precedingTransition: '',
        explanation: '',
        application: ''
      }
    ];
    updateField('expositoryPoints', nextPoints);
  };

  const removePoint = (index: number) => {
    const nextPoints = (sermon.expositoryPoints || []).filter((_, idx) => idx !== index);
    updateField('expositoryPoints', nextPoints);
  };

  const updateApplicationListItem = (index: number, value: string) => {
    const current = [...(sermon.applications || [])];
    current[index] = value;
    updateField('applications', current);
  };

  const addApplicationListItem = () => {
    updateField('applications', [...(sermon.applications || []), 'Novo passo prático']);
  };

  const removeApplicationListItem = (index: number) => {
    updateField(
      'applications',
      (sermon.applications || []).filter((_, idx) => idx !== index)
    );
  };

  const hymnSlots: Array<{ key: 'abertura' | 'antesMensagem' | 'apelo' | 'encerramento'; label: string; hymn?: DetailedHymn }> =
    hydratedHymns
      ? [
          { key: 'abertura', label: '1. Abertura', hymn: hydratedHymns.details?.abertura },
          { key: 'antesMensagem', label: '2. Antes da Mensagem', hymn: hydratedHymns.details?.antesMensagem },
          { key: 'apelo', label: '3. Apelo / Consagração', hymn: hydratedHymns.details?.apelo },
          { key: 'encerramento', label: '4. Encerramento', hymn: hydratedHymns.details?.encerramento }
        ]
      : [];

  const renderModeIcon = () => {
    if (isBibleStudy) return <BookOpen className="w-3.5 h-3.5 shrink-0" />;
    if (isDevotional) return <Sun className="w-3.5 h-3.5 shrink-0" />;
    if (isPulpitCard) return <LayoutList className="w-3.5 h-3.5 shrink-0" />;
    if (isEbd) return <GraduationCap className="w-3.5 h-3.5 shrink-0" />;
    if (isCatechetical) return <BookOpenCheck className="w-3.5 h-3.5 shrink-0" />;
    if (isEvangelistic) return <Megaphone className="w-3.5 h-3.5 shrink-0" />;
    if (isCounseling) return <HeartHandshake className="w-3.5 h-3.5 shrink-0" />;
    if (isPostService) return <Share2 className="w-3.5 h-3.5 shrink-0" />;
    return <Sparkles className="w-3.5 h-3.5 shrink-0" />;
  };

  const renderModeBanner = () => {
    if (isBibleStudy) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-950">
          <BookOpen className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-800 block">
              Roteiro de Estudo Bíblico Participativo (PG / Célula)
            </span>
            <span className="text-emerald-900/90 leading-relaxed">
              Estruturado para diálogo em grupo com caixas destacadas de <strong>Pergunta para Discussão em Grupo</strong> e encaminhamento final de oração.
            </span>
          </div>
        </div>
      );
    }
    if (isDevotional) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-950">
          <Sun className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-rose-800 block">
              Devocional Pastoral Breve (5–10 min)
            </span>
            <span className="text-rose-900/90 leading-relaxed">
              Formato conciso para visitas, reuniões ou culto doméstico, focado em uma verdade luminosa e encerrado em oração.
            </span>
          </div>
        </div>
      );
    }
    if (isPulpitCard) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-slate-100 border border-slate-300 flex items-start gap-2.5 text-xs text-slate-900">
          <LayoutList className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-700 block">
              Cartão de Púlpito • Esboço Condensado
            </span>
            <span className="text-slate-700 leading-relaxed">
              Estrutura escaneável para pregação dinâmica: frases-âncora, referências de apoio e direcionamento objetivo sem texto corrido longo.
            </span>
          </div>
        </div>
      );
    }
    if (isEbd) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-sky-50/70 border border-sky-200 flex items-start gap-2.5 text-xs text-sky-950">
          <GraduationCap className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-sky-800 block">
              Lição de Escola Bíblica Dominical (EBD)
            </span>
            <span className="text-sky-900/90 leading-relaxed">
              Roteiro didático de aula com objetivo pedagógico, exposição doutrinária, <strong>Pergunta para a Classe</strong> e <strong>Guia para o Professor</strong>.
            </span>
          </div>
        </div>
      );
    }
    if (isCatechetical) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 flex items-start gap-2.5 text-xs text-cyan-950">
          <BookOpenCheck className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-cyan-800 block">
              Estudo Catequético • Perguntas & Respostas Doutrinárias
            </span>
            <span className="text-cyan-900/90 leading-relaxed">
              Ensino bíblico organizado em <strong>Pergunta</strong> e <strong>Resposta</strong> para instruir, esclarecer e firmar o conhecimento doutrinário da igreja.
            </span>
          </div>
        </div>
      );
    }
    if (isEvangelistic) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-orange-50/70 border border-orange-200 flex items-start gap-2.5 text-xs text-orange-950">
          <Megaphone className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-orange-800 block">
              Roteiro Evangelístico • Visitantes & Ocasiões Especiais
            </span>
            <span className="text-orange-900/90 leading-relaxed">
              Linguagem acessível sem jargões internos, conduzindo da tensão humana à proclamação clara da cruz e ao convite ao arrependimento.
            </span>
          </div>
        </div>
      );
    }
    if (isCounseling) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-teal-50/70 border border-teal-200 flex items-start gap-2.5 text-xs text-teal-950">
          <HeartHandshake className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-teal-800 block">
              Guia de Discipulado & Aconselhamento (1-a-1)
            </span>
            <span className="text-teal-900/90 leading-relaxed">
              Roteiro de cuidado pastoral individual articulando verdade consoladora, diagnóstico bíblico do coração e passos práticos da semana.
            </span>
          </div>
        </div>
      );
    }
    if (isPostService) {
      return (
        <div className="mt-2 p-3 rounded-xl bg-purple-50/70 border border-purple-200 flex items-start gap-2.5 text-xs text-purple-950">
          <Share2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-purple-800 block">
              Resumo Pós-Culto • Boletim & WhatsApp da Igreja
            </span>
            <span className="text-purple-900/90 leading-relaxed">
              Síntese pronta para enviar à congregação com os pontos centrais da pregação e guia semanal de leitura e oração.
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[9000] bg-[#1E1B18]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="derived-popup-title"
      onClick={() => {
        if (!isDeriving && !isBlockedByOverlay) onClose();
      }}
    >
      <div
        className="bg-[#FDFBF7] border border-[#E6E2DA] rounded-2xl w-full max-w-4xl h-[94vh] sm:h-[90vh] shadow-2xl flex flex-col overflow-hidden text-left animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Bar */}
        <header className="shrink-0 bg-white border-b border-[#E6E2DA] px-4 sm:px-6 py-3 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${badgePalette}`}>
                  {renderModeIcon()}
                  <span>{badge.label}</span>
                </span>
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-50/70 border border-amber-200/80 px-2 py-0.5 rounded-md">
                  Original preservado na Biblioteca
                </span>
              </div>
              {sourceTitle && (
                <p className="text-xs text-gray-500 truncate">
                  Derivado de <strong className="text-[#2D2926]">"{sourceTitle}"</strong>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Segmented Visualizar / Editar toggle */}
              <div className="inline-flex items-center bg-[#F5F2ED] border border-[#E6E2DA] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    !isEditing ? 'bg-[#5A5A40] text-white shadow-2xs' : 'text-[#5A5A40] hover:bg-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Visualizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isEditing ? 'bg-[#5A5A40] text-white shadow-2xs' : 'text-[#5A5A40] hover:bg-white'
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
              </div>

              {onSwitchDuration && sourceSermon && supportsDurationSwitch && (
                <div className="hidden md:flex items-center bg-[#F5F2ED] border border-[#E6E2DA] rounded-lg p-0.5">
                  {(['20', '30', '40'] as const).map((dur) => {
                    const activeDur = effectiveDuration === dur;
                    return (
                      <button
                        key={dur}
                        type="button"
                        disabled={isDeriving}
                        onClick={() => {
                          if (!activeDur) onSwitchDuration(dur);
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                          activeDur
                            ? 'bg-[#5A5A40] text-white shadow-2xs'
                            : 'text-[#5A5A40] hover:bg-white'
                        }`}
                        title={`Gerar variação de ${dur} minutos`}
                      >
                        {dur}m
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={isDeriving}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#2D2926] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
                title="Minimizar janela (mantém o rascunho pronto)"
                aria-label="Fechar janela de derivação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile quick duration switcher */}
          {onSwitchDuration && sourceSermon && supportsDurationSwitch && (
            <div className="flex md:hidden items-center justify-between gap-2 pt-1 border-t border-[#F0ECE1]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Duração:</span>
              <div className="flex items-center gap-1 bg-[#F5F2ED] border border-[#E6E2DA] rounded-lg p-0.5">
                {(['20', '30', '40'] as const).map((dur) => {
                  const activeDur = effectiveDuration === dur;
                  return (
                    <button
                      key={dur}
                      type="button"
                      disabled={isDeriving}
                      onClick={() => {
                        if (!activeDur) onSwitchDuration(dur);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                        activeDur ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]'
                      }`}
                    >
                      {dur} min
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-5 sm:py-6 space-y-5 relative">
          {isDeriving && (
            <div className="bg-[#5A5A40] text-white px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold shadow-sm max-w-3xl mx-auto">
              <Loader2 className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
              <span>Gerando nova variação... o sermão original permanece preservado na Biblioteca.</span>
            </div>
          )}

          {fallbackNotice && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 max-w-3xl mx-auto">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Modo de Contingência Utilizado</p>
                  <p className="text-amber-900/90 mt-0.5 leading-relaxed">{fallbackNotice}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canRetryFallback && onRetryFallback && (
                  <button
                    type="button"
                    disabled={isRetryingFallback || isDeriving}
                    onClick={onRetryFallback}
                    className="px-3 py-1.5 rounded-lg bg-[#5A5A40] hover:bg-[#2D2926] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingFallback ? 'animate-spin' : ''}`} />
                    <span>Tentar novamente</span>
                  </button>
                )}
                {onDismissFallback && (
                  <button
                    type="button"
                    onClick={onDismissFallback}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-950 font-bold hover:bg-amber-100 cursor-pointer"
                  >
                    ENTENDI
                  </button>
                )}
              </div>
            </div>
          )}

          {isEditing ? (
            /* Direct In-Popup Editor */
            <div className="bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-4 sm:p-7 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EFECE4]">
                <div>
                  <h2 id="derived-popup-title" className="text-base sm:text-lg font-serif font-bold text-[#2D2926]">
                    Editar Mensagem na Janela
                  </h2>
                  <p className="text-xs text-gray-500">
                    Todas as alterações atualizam o rascunho instantaneamente e serão gravadas ao salvar na Biblioteca.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#5A5A40] text-white hover:bg-[#2D2926] transition-colors cursor-pointer shrink-0"
                >
                  Concluir Edição
                </button>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    Título da Mensagem
                  </label>
                  <input
                    type="text"
                    value={sermon.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-sm font-serif font-bold text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    Tema Central
                  </label>
                  <input
                    type="text"
                    value={sermon.theme}
                    onChange={(e) => updateField('theme', e.target.value)}
                    className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    Texto Bíblico / Passagem
                  </label>
                  <input
                    type="text"
                    value={sermon.scripture}
                    onChange={(e) => updateField('scripture', e.target.value)}
                    className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
                    Público-Alvo
                  </label>
                  <input
                    type="text"
                    value={sermon.audience}
                    onChange={(e) => updateField('audience', e.target.value)}
                    className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                  />
                </div>
              </div>

              {/* Introdução */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
                  {isBibleStudy
                    ? 'Abertura & Acolhimento'
                    : isEbd
                    ? 'Objetivo Pedagógico & Introdução'
                    : isPostService
                    ? 'Resumo da Mensagem'
                    : 'Introdução'}
                </label>
                <textarea
                  rows={4}
                  value={sermon.introduction}
                  onChange={(e) => updateField('introduction', e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                />
              </div>

              {/* Contexto */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
                  {isEbd ? 'Panorama Histórico-Doutrinário' : 'Contexto Histórico-Bíblico'}
                </label>
                <textarea
                  rows={3}
                  value={sermon.biblicalContext}
                  onChange={(e) => updateField('biblicalContext', e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                />
              </div>

              {/* Divisões / Tópicos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]">
                    Tópicos / Divisões ({sermon.expositoryPoints.length})
                  </label>
                  <button
                    type="button"
                    onClick={addPoint}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F5F2ED] hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#E6E2DA] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Tópico</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {sermon.expositoryPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#E6E2DA] bg-[#FDFBF7]/70 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Divisão {idx + 1}
                        </span>
                        {sermon.expositoryPoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePoint(idx)}
                            className="text-[11px] font-bold text-red-600 hover:text-red-800 cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">
                          Título do Tópico
                        </label>
                        <input
                          type="text"
                          value={pt.title}
                          onChange={(e) => updatePoint(idx, { title: e.target.value })}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-1.5 text-sm font-serif font-bold text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">
                          Frase de Transição (opcional)
                        </label>
                        <input
                          type="text"
                          value={pt.precedingTransition || ''}
                          onChange={(e) => updatePoint(idx, { precedingTransition: e.target.value })}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-1.5 text-xs italic text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">
                          {isPulpitCard
                            ? 'Âncoras, Exegese & Referências'
                            : isCatechetical
                            ? 'Perguntas & Respostas Doutrinárias (use "Pergunta:" e "Resposta:")'
                            : 'Exposição do Texto'}
                        </label>
                        <textarea
                          rows={5}
                          value={pt.explanation}
                          onChange={(e) => updatePoint(idx, { explanation: e.target.value })}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                        />
                      </div>

                      {pt.illustration ? (
                        <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-amber-800">
                                Ilustração
                              </span>
                              <select
                                value={pt.illustration.type}
                                onChange={(e) =>
                                  updatePoint(idx, {
                                    illustration: {
                                      type: e.target.value === 'bíblica' ? 'bíblica' : 'cotidiano',
                                      description: pt.illustration?.description || ''
                                    }
                                  })
                                }
                                className="text-[11px] font-bold bg-[#FDFBF7] border border-[#E6E2DA] rounded px-2 py-0.5 text-[#2D2926]"
                              >
                                <option value="cotidiano">Cotidiano</option>
                                <option value="bíblica">Bíblica</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => updatePoint(idx, { illustration: undefined })}
                              className="text-[11px] font-bold text-gray-500 hover:text-red-700 cursor-pointer"
                            >
                              Remover ilustração
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={pt.illustration.description}
                            onChange={(e) =>
                              updatePoint(idx, {
                                illustration: {
                                  type: pt.illustration?.type || 'cotidiano',
                                  description: e.target.value
                                }
                              })
                            }
                            className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-lg px-3 py-1.5 text-xs font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updatePoint(idx, {
                              illustration: { type: 'cotidiano', description: '' }
                            })
                          }
                          className="text-[11px] font-bold text-[#5A5A40] hover:underline cursor-pointer"
                        >
                          + Incluir ilustração neste tópico
                        </button>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">
                          {isBibleStudy
                            ? 'Aplicação & Pergunta para Discussão em Grupo'
                            : isEbd
                            ? 'Aplicação, Pergunta para a Classe & Guia do Professor'
                            : isCatechetical
                            ? 'Uso Doutrinário e Prático'
                            : 'Aplicação'}
                        </label>
                        <textarea
                          rows={3}
                          value={pt.application}
                          onChange={(e) => updatePoint(idx, { application: e.target.value })}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de Aplicações / Roteiro Semanal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40]">
                    {isPostService
                      ? 'Guia de Leitura e Oração da Semana'
                      : isEbd
                      ? 'Pontos de Fixação da Lição'
                      : isCatechetical
                      ? 'Declarações de Fé para Memorizar'
                      : 'Aplicações / Passos Práticos'}
                  </label>
                  <button
                    type="button"
                    onClick={addApplicationListItem}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-[#F5F2ED] hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white border border-[#E6E2DA] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar item</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {(sermon.applications || []).map((item, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateApplicationListItem(aIdx, e.target.value)}
                        className="flex-1 bg-[#FDFBF7] border border-[#E6E2DA] rounded-lg px-3 py-1.5 text-xs font-serif text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                      />
                      <button
                        type="button"
                        onClick={() => removeApplicationListItem(aIdx)}
                        className="px-2 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Remover item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conclusão */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
                  Conclusão
                </label>
                <textarea
                  rows={3}
                  value={sermon.conclusion}
                  onChange={(e) => updateField('conclusion', e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                />
              </div>

              {/* Apelo / Oração */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] block">
                  {isDevotional
                    ? 'Oração Final'
                    : isBibleStudy
                    ? 'Encaminhamento de Oração & Comunhão'
                    : isCatechetical
                    ? 'Confissão & Firmeza Doutrinária'
                    : isEvangelistic
                    ? 'Convite Evangelístico'
                    : 'Apelo Pastoral'}
                </label>
                <textarea
                  rows={3}
                  value={sermon.pastoralAppeal}
                  onChange={(e) => updateField('pastoralAppeal', e.target.value)}
                  className="w-full bg-[#FDFBF7] border border-[#E6E2DA] rounded-xl px-3.5 py-2.5 text-sm font-serif leading-relaxed text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/40"
                />
              </div>
            </div>
          ) : (
            /* Manuscript / Formatted View */
            <article className="bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-8 space-y-7 max-w-3xl mx-auto">
              {/* Manuscript Header */}
              <div className="border-b border-[#EFECE4] pb-5 space-y-3">
                <div className="flex items-center flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F5F2ED] text-[#5A5A40] font-serif font-bold border border-[#E6E2DA]">
                    {reference} ({version})
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-50 text-gray-700 font-medium border border-stone-200">
                    <Clock className="w-3 h-3 text-[#5A5A40]" />
                    <span>{effectiveDuration === '10' ? '5–10 min' : `${effectiveDuration} min`}</span>
                  </span>
                  {sermon.audience && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-50 text-gray-700 font-medium border border-stone-200">
                      <Users className="w-3 h-3 text-[#5A5A40]" />
                      <span>{sermon.audience}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-stone-50 text-gray-600 font-medium border border-stone-200">
                    Estilo: {STYLE_LABELS[sermon.style] || sermon.style}
                  </span>
                </div>

                <h1
                  id="derived-popup-title"
                  className="text-2xl sm:text-3xl font-serif font-bold text-[#2D2926] leading-tight"
                >
                  {sermon.title}
                </h1>

                {sermon.theme && (
                  <p className="text-sm sm:text-base font-serif italic text-[#5A5A40] leading-relaxed">
                    {sermon.theme}
                  </p>
                )}

                {sermon.scripture && sermon.scripture.trim() !== reference && (
                  <blockquote className="mt-2 p-3.5 rounded-xl bg-[#FDFBF7] border-l-3 border-[#5A5A40] text-sm font-serif text-gray-800 leading-relaxed">
                    {sermon.scripture}
                  </blockquote>
                )}

                {renderModeBanner()}
              </div>

              {/* 1. Introdução / Abertura */}
              {introParagraphs.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                    <span>
                      {isBibleStudy
                        ? '1. Abertura & Acolhimento do Grupo'
                        : isEbd
                        ? '1. Objetivo Pedagógico & Abertura'
                        : isCatechetical
                        ? '1. Propósito Catequético & Síntese Doutrinária'
                        : isPostService
                        ? '1. Resumo da Pregação'
                        : isDevotional
                        ? 'Meditação Inicial'
                        : isPulpitCard
                        ? 'Tese Central & Gancho Inicial'
                        : isCounseling
                        ? '1. Acolhimento Bíblico'
                        : 'Introdução'}
                    </span>
                  </h2>
                  <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {introParagraphs.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* 2. Contexto Bíblico / Panorama */}
              {contextParagraphs.length > 0 && !isPostService && (
                <section className="space-y-2.5 pt-2 border-t border-[#F4F1EA]">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                    <span>
                      {isBibleStudy
                        ? '2. Panorama do Texto Sagrado'
                        : isEbd
                        ? '2. Panorama Histórico-Doutrinário'
                        : isCatechetical
                        ? '2. Fundamento Bíblico & Canônico'
                        : isPulpitCard
                        ? 'Panorama Rápido'
                        : 'Contexto Histórico-Bíblico'}
                    </span>
                  </h2>
                  <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {contextParagraphs.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Desenvolvimento Expositivo / Formato Específico */}
              {structuredPoints.length > 0 && (
                <section className="space-y-6 pt-2 border-t border-[#F4F1EA]">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                    <span>
                      {isBibleStudy
                        ? '3. Roteiro Expositivo & Diálogo em Grupo'
                        : isPulpitCard
                        ? 'Cartão de Tópicos para Púlpito'
                        : isEbd
                        ? '3. Tópicos de Ensino & Perguntas'
                        : isCatechetical
                        ? '3. Perguntas & Respostas Doutrinárias'
                        : isCounseling
                        ? '2. Verdade Consoladora & Passos Bíblicos'
                        : isPostService
                        ? '2. Pontos-Chave para Relembrar'
                        : isDevotional
                        ? 'Desenvolvimento Devocional'
                        : 'Desenvolvimento Expositivo'}
                    </span>
                  </h2>

                  <div className={isPulpitCard ? 'grid grid-cols-1 gap-4' : 'space-y-7'}>
                    {structuredPoints.map(({ raw, structured }, idx) => {
                      const cues = extractSectionCues(structured.applicationParagraphs, effectiveMode);
                      const catecheticalData = isCatechetical
                        ? extractCatecheticalQA(raw.explanation || structured.fullExplanation)
                        : null;

                      return (
                        <div
                          key={idx}
                          className={
                            isPulpitCard
                              ? 'p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5'
                              : 'pl-3.5 sm:pl-5 border-l-2 border-[#E6E2DA] space-y-3.5'
                          }
                        >
                          {raw.precedingTransition && (
                            <p className="text-xs sm:text-sm italic text-[#5A5A40]/90 bg-[#FDFBF7] px-3 py-2 rounded-lg border border-[#EFECE4]">
                              {raw.precedingTransition}
                            </p>
                          )}

                          <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D2926]">
                            {structured.romanTitle}
                          </h3>

                          {isCatechetical && catecheticalData && catecheticalData.pairs.length > 0 ? (
                            <div className="space-y-3">
                              {catecheticalData.pairs.map((pair, qIdx) => (
                                <div
                                  key={qIdx}
                                  className="rounded-xl border border-cyan-200 bg-white shadow-2xs overflow-hidden"
                                >
                                  <div className="px-4 py-2.5 bg-cyan-50/80 border-b border-cyan-100 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-800 block">
                                      Pergunta {idx + 1}.{qIdx + 1}
                                    </span>
                                    <p className="font-serif font-bold text-sm sm:text-base text-cyan-950 leading-snug">
                                      {pair.question}
                                    </p>
                                  </div>
                                  <div className="px-4 py-3 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                                      Resposta Doutrinária
                                    </span>
                                    <p className="font-serif text-[15px] sm:text-base leading-relaxed text-gray-800 whitespace-pre-line">
                                      {pair.answer}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {catecheticalData.extraParagraphs.length > 0 && (
                                <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                                  {catecheticalData.extraParagraphs.map((para, pIdx) => (
                                    <p key={pIdx}>{para}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            structured.explanationParagraphs.length > 0 && (
                              <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                                {structured.explanationParagraphs.map((para, pIdx) => (
                                  <p key={pIdx} className={isPulpitCard ? 'text-sm sm:text-[15px]' : ''}>
                                    {para}
                                  </p>
                                ))}
                              </div>
                            )
                          )}

                          {raw.illustration?.description && (
                            <div
                              className={`p-4 rounded-xl border space-y-1.5 ${
                                raw.illustration.type === 'bíblica'
                                  ? 'bg-sky-50/60 border-sky-200 text-sky-950'
                                  : 'bg-amber-50/60 border-amber-200 text-amber-950'
                              }`}
                            >
                              <span
                                className={`text-[10px] font-bold uppercase tracking-widest block ${
                                  raw.illustration.type === 'bíblica' ? 'text-sky-800' : 'text-amber-800'
                                }`}
                              >
                                {raw.illustration.type === 'bíblica'
                                  ? 'Ilustração Bíblica'
                                  : 'Ilustração Cotidiano'}
                              </span>
                              <p className="text-sm font-serif leading-relaxed">
                                {raw.illustration.description}
                              </p>
                            </div>
                          )}

                          {cues.applications.length > 0 && (
                            <div className="p-4 rounded-xl border bg-[#F5F2ED]/80 border-[#DCD6C8] text-[#2D2926] space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                                {isPulpitCard
                                  ? 'Direcionamento Rápido'
                                  : isCatechetical
                                  ? 'Uso Doutrinário & Prático'
                                  : isCounseling
                                  ? 'Passos Bíblicos de Obediência'
                                  : isPostService
                                  ? 'Meditação para a Semana'
                                  : isBibleStudy
                                  ? 'Aplicação Prática'
                                  : 'Aplicação'}
                              </span>
                              <div className="space-y-2 text-sm font-serif leading-relaxed">
                                {cues.applications.map((appPara, aIdx) => (
                                  <p key={aIdx}>{appPara}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {cues.groupQuestions.length > 0 && (
                            <div className="p-4 rounded-xl border bg-emerald-50/70 border-emerald-200 text-emerald-950 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                                <MessageCircleQuestion className="w-3.5 h-3.5" />
                                <span>Pergunta para Discussão em Grupo (PG)</span>
                              </span>
                              <div className="space-y-2 text-sm font-serif font-medium leading-relaxed">
                                {cues.groupQuestions.map((qPara, qIdx) => (
                                  <p key={qIdx}>{qPara}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {cues.classQuestions.length > 0 && (
                            <div className="p-4 rounded-xl border bg-sky-50/70 border-sky-200 text-sky-950 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-800 flex items-center gap-1.5">
                                <MessageCircleQuestion className="w-3.5 h-3.5" />
                                <span>Pergunta para a Classe (EBD)</span>
                              </span>
                              <div className="space-y-2 text-sm font-serif font-medium leading-relaxed">
                                {cues.classQuestions.map((qPara, qIdx) => (
                                  <p key={qIdx}>{qPara}</p>
                                ))}
                              </div>
                            </div>
                          )}

                          {cues.teacherGuides.length > 0 && (
                            <div className="p-4 rounded-xl border bg-indigo-50/60 border-indigo-200 text-indigo-950 space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-800 flex items-center gap-1.5">
                                <GraduationCap className="w-3.5 h-3.5" />
                                <span>Guia de Resposta para o Professor</span>
                              </span>
                              <div className="space-y-2 text-sm font-serif leading-relaxed">
                                {cues.teacherGuides.map((gPara, gIdx) => (
                                  <p key={gIdx}>{gPara}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Checklist / Guia Semanal / Fixação */}
              {(isBibleStudy || isEbd || isCatechetical || isCounseling || isPostService) &&
                sermon.applications &&
                sermon.applications.length > 0 && (
                  <section
                    className={`p-4 rounded-xl border space-y-2.5 ${
                      isPostService
                        ? 'bg-purple-50/50 border-purple-200'
                        : isEbd
                        ? 'bg-sky-50/50 border-sky-200'
                        : isCatechetical
                        ? 'bg-cyan-50/50 border-cyan-200'
                        : isCounseling
                        ? 'bg-teal-50/50 border-teal-200'
                        : 'bg-[#FDFBF7] border-[#E6E2DA]'
                    }`}
                  >
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40]">
                      {isPostService
                        ? 'Guia de Leitura e Oração da Semana (Seg a Sex)'
                        : isEbd
                        ? 'Pontos de Fixação da Lição'
                        : isCatechetical
                        ? 'Declarações de Fé para Memorizar'
                        : isCounseling
                        ? 'Práticas Espirituais da Semana'
                        : 'Passos Práticos da Semana (Grupo)'}
                    </h2>
                    <ul className="space-y-1.5 text-sm font-serif text-gray-800 list-disc pl-5">
                      {sermon.applications.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </section>
                )}

              {/* 4. Síntese / Conclusão */}
              {conclusionParagraphs.length > 0 && (
                <section className="space-y-2.5 pt-2 border-t border-[#F4F1EA]">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]" />
                    <span>{isBibleStudy ? '4. Síntese do Encontro' : 'Conclusão'}</span>
                  </h2>
                  <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {conclusionParagraphs.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* 5. Compromissos / Oração / Apelo */}
              {appealParagraphs.length > 0 && (
                <section
                  className={`p-4 sm:p-5 rounded-xl border space-y-2.5 ${
                    isBibleStudy
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : isDevotional
                      ? 'bg-rose-50/50 border-rose-200'
                      : isCatechetical
                      ? 'bg-cyan-50/50 border-cyan-200'
                      : isEvangelistic
                      ? 'bg-orange-50/60 border-orange-200'
                      : isCounseling
                      ? 'bg-teal-50/50 border-teal-200'
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <h2
                    className={`text-[11px] font-bold uppercase tracking-widest ${
                      isBibleStudy
                        ? 'text-emerald-900'
                        : isDevotional
                        ? 'text-rose-900'
                        : isCatechetical
                        ? 'text-cyan-900'
                        : isEvangelistic
                        ? 'text-orange-900'
                        : isCounseling
                        ? 'text-teal-900'
                        : 'text-amber-900'
                    }`}
                  >
                    {isBibleStudy
                      ? 'Encaminhamento de Oração & Comunhão'
                      : isDevotional
                      ? 'Oração Pastoral Final'
                      : isCatechetical
                      ? 'Confissão & Firmeza Doutrinária'
                      : isEvangelistic
                      ? 'Convite Evangelístico'
                      : isCounseling
                      ? 'Oração de Acompanhamento'
                      : isPostService
                      ? 'Palavra Final para a Semana'
                      : 'Apelo Pastoral'}
                  </h2>
                  <div className="space-y-2.5 font-serif text-[15px] leading-relaxed text-gray-900">
                    {appealParagraphs.map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* Hinos Selecionados */}
              {hymnSlots.some((slot) => Boolean(slot.hymn)) && (
                <section className="pt-4 border-t border-[#EFECE4] space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#5A5A40]">
                    <Music className="w-3.5 h-3.5" />
                    <span>Hinos Selecionados para esta Versão</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {hymnSlots.map(({ key, label, hymn }) => {
                      if (!hymn) return null;
                      const copyKey = `${key}_${hymn.hinario}_${hymn.number}`;
                      const isCopied = copiedHymnKey === copyKey;
                      return (
                        <div
                          key={copyKey}
                          className="p-3 rounded-xl border border-[#E6E2DA] bg-[#FDFBF7] flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase text-gray-500">
                                {label}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  hymn.hinario === 'CC'
                                    ? 'bg-[#5A5A40] text-white'
                                    : 'bg-amber-800 text-white'
                                }`}
                              >
                                {hymn.hinario} {hymn.number}
                              </span>
                            </div>
                            <p className="font-serif font-bold text-sm text-[#2D2926] truncate mt-0.5">
                              {hymn.title}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{hymn.theme}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyHymn(hymn, copyKey)}
                              className="p-1.5 rounded-lg bg-white border border-[#E6E2DA] text-gray-600 hover:text-[#2D2926] cursor-pointer"
                              title="Copiar letra do hino"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {onOpenLyricsModal && (
                              <button
                                type="button"
                                onClick={() => onOpenLyricsModal(hymn)}
                                className="p-1.5 rounded-lg bg-white border border-[#E6E2DA] text-gray-600 hover:text-[#2D2926] cursor-pointer"
                                title="Ver letra completa do hino"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </article>
          )}
        </div>

        {/* Sticky Footer Bar */}
        <footer className="shrink-0 bg-white border-t border-[#E6E2DA] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCopyAll(false)}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-stone-100 hover:bg-stone-200 text-[#2D2926] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copiedFull ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-600" />
                  <span>Copiar Texto</span>
                </>
              )}
            </button>

            {isPostService && (
              <button
                type="button"
                onClick={() => handleCopyAll(true)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedWhatsApp ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Pronto p/ WhatsApp!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copiar p/ WhatsApp</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenPulpit(sermon)}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>📖 Modo Púlpito</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                isEditing
                  ? 'bg-[#5A5A40]/15 text-[#2D2926] border-[#5A5A40]'
                  : 'bg-white hover:bg-[#F5F2ED] text-[#5A5A40] border-[#E6E2DA]'
              }`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <FileEdit className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Ver Formatado' : 'Editar na Janela'}</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            {confirmDiscard ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                <span className="text-[11px] font-bold text-red-900">Descartar?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDiscard(false);
                    onDiscard();
                  }}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 text-[11px] font-bold cursor-pointer"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-red-50 text-gray-600 hover:text-red-700 border border-[#E6E2DA] hover:border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSaveToLibrary}
              disabled={isDeriving}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Salvar na Biblioteca</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
