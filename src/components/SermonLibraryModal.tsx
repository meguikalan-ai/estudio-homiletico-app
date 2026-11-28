import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Trash2,
  Search,
  X,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Clock,
  BookOpen,
  SlidersHorizontal,
  Loader2,
  FileText,
  Sun,
  LayoutList,
  GraduationCap,
  Megaphone,
  HeartHandshake,
  Share2,
  BookOpenCheck
} from 'lucide-react';
import { Sermon, SermonDerivationDuration, SermonDerivationMode } from '../types';

/**
 * Expressão regular canônica para identificar referências bíblicas
 * (Livro, capítulo e versículos) sem carregar o texto ou versículo completo.
 */
export const BIBLE_REF_PATTERN = /\b(?:[123]\s*(?:João|Jo|Co|Coríntios|Corintios|Pedro|Pe|Tm|Timóteo|Timoteo|Tessalonicenses|Ts|Crônicas|Cronicas|Reis|Samuel|Sm)|Gênesis|Genesis|Gn|Êxodo|Exodo|Ex|Levítico|Levitico|Lv|Números|Numeros|Nm|Deuteronômio|Deuteronomio|Dt|Josué|Josue|Js|Juízes|Juizes|Jz|Rute|Rt|Esdras|Ed|Neemias|Ne|Ester|Et|Jó|Salmos?|Sl|Provérbios|Proverbios|Pv|Eclesiastes|Ec|Cânticos|Cantares|Ct|Isaías|Isaias|Is|Jeremias|Jr|Lamentações|Lamentacoes|Lm|Ezequiel|Ez|Daniel|Dn|Oséias|Oseias|Os|Joel|Jl|Amós|Amos|Am|Obadias|Ob|Jonas|Jn|Miquéias|Miqueias|Mq|Naum|Na|Habacuque|Hc|Sofonias|Sf|Ageu|Ag|Zacarias|Zc|Malaquias|Ml|Mateus|Mt|Marcos|Mc|Lucas|Lc|João|Joao|Atos|At|Romanos|Rm|Gálatas|Galatas|Gl|Efésios|Efesios|Ef|Filipenses|Fp|Colossenses|Cl|Tito|Tt|Filemom|Fm|Hebreus|Hb|Tiago|Tg|Judas|Jd|Apocalipse|Ap)\s+\d+(?:[\s:,v.]+\d*(?:[\-\–—]\d+)?)?/i;

/**
 * Normaliza e limpa a referência bíblica e versão para exibição elegante no card.
 * Garante que apenas a referência principal (ex: "Lucas 18:1-8") seja exibida,
 * descartando trechos longos, quebras de linha ou versículos inteiros.
 */
export function normalizeCardBibleMetadata(rawScripture: string, rawVersion?: string): { reference: string; version: string } {
  const scriptureStr = (rawScripture || '').trim();

  // 1. Detecta versão entre parênteses (ex: "(AEC)", "(NVI)", "(ACF)")
  const versionMatch = scriptureStr.match(/\(([A-Za-z0-9]+)\)/);
  const detectedVersion = (rawVersion || (versionMatch ? versionMatch[1] : '') || 'ACF').trim().toUpperCase();

  // 2. Extrai a referência principal via regex canônica
  const refMatch = scriptureStr.match(BIBLE_REF_PATTERN);
  if (refMatch && refMatch[0]) {
    return {
      reference: refMatch[0].trim(),
      version: detectedVersion
    };
  }

  // 3. Fallback defensivo caso o livro fuja da lista léxica padrão
  const firstLine = scriptureStr.split(/[\r\n]+/)[0] || scriptureStr;
  const withoutPrefix = firstLine.replace(/^(?:texto(?:\s+b[íi]blico)?|passagem|refer[êe]ncia|b[íi]blia|leitura)\s*[:\-]\s*/i, '');
  const cleanRef = withoutPrefix
    .split(/\s*[\-–—]\s*|:\s*["'“]/)[0]
    .replace(/\s*\([A-Za-z0-9]+\)\s*$/, '')
    .trim();

  return {
    reference: cleanRef || 'Passagem Bíblica',
    version: detectedVersion
  };
}

/**
 * Normaliza o tema ou subtítulo central do sermão para exibição em linha única concisa (line-clamp-1).
 * Remove prefixos repetitivos ("Tema:", "Tema Central:"), quebras de linha e múltiplos espaços.
 */
export function normalizeCardTheme(rawTheme?: string): string {
  if (!rawTheme) return '';
  return rawTheme
    .replace(/[\r\n]+/g, ' ')
    .replace(/^(?:tema(?:\s+central)?|ideia(?:\s+central)?|tese|subt[íi]tulo)\s*[:\-]\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type CardDerivationVariant =
  | 'original'
  | 'outline'
  | 'duration'
  | 'bible-study'
  | 'devotional'
  | 'pulpit-card'
  | 'ebd'
  | 'catechetical'
  | 'evangelistic'
  | 'counseling'
  | 'post-service'
  | 'custom';

export interface CardDerivationBadgeInfo {
  label: string;
  tooltip: string;
  variant: CardDerivationVariant;
  isDerived: boolean;
  sourceTitle?: string;
}

/**
 * Determina o selo visual de versão/derivação do sermão para identificação imediata no card.
 * Mantém retrocompatibilidade integral com sermões antigos armazenados sem `derivation`.
 */
export function getCardDerivationBadge(s: Sermon): CardDerivationBadgeInfo {
  const rawDuration = s.derivation?.duration || s.duration || '30';
  const durationLabel = rawDuration === '60' ? '1h' : rawDuration === '10' ? '5–10 min' : `${rawDuration} min`;
  const tags = Array.isArray(s.tags) ? s.tags : [];

  if (s.derivation) {
    const sourceTitle = (s.derivation.sourceTitle || '').trim();
    const sourceHint = sourceTitle ? `Derivado de "${sourceTitle}"` : 'Versão derivada';

    switch (s.derivation.mode) {
      case 'bible-study':
        return {
          label: `Estudo Bíblico • ${durationLabel}`,
          tooltip: `${sourceHint} — Estudo Bíblico / PG (${durationLabel})`,
          variant: 'bible-study',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'devotional':
        return {
          label: 'Devocional • 5–10 min',
          tooltip: `${sourceHint} — Devocional Pastoral Breve (5–10 min)`,
          variant: 'devotional',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'pulpit-card':
        return {
          label: 'Cartão de Púlpito',
          tooltip: `${sourceHint} — Esboço Condensado para Púlpito`,
          variant: 'pulpit-card',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'ebd':
        return {
          label: `Lição EBD • ${durationLabel}`,
          tooltip: `${sourceHint} — Lição de Escola Bíblica Dominical (${durationLabel})`,
          variant: 'ebd',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'catechetical':
        return {
          label: `Catequético • ${durationLabel}`,
          tooltip: `${sourceHint} — Estudo Catequético em Perguntas e Respostas (${durationLabel})`,
          variant: 'catechetical',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'evangelistic':
        return {
          label: `Evangelístico • ${durationLabel}`,
          tooltip: `${sourceHint} — Roteiro Evangelístico (${durationLabel})`,
          variant: 'evangelistic',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'counseling':
        return {
          label: 'Aconselhamento 1-a-1',
          tooltip: `${sourceHint} — Guia de Discipulado & Aconselhamento`,
          variant: 'counseling',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'post-service':
        return {
          label: 'Resumo Pós-Culto',
          tooltip: `${sourceHint} — Resumo para Boletim / WhatsApp`,
          variant: 'post-service',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      case 'custom': {
        const audienceHint = s.derivation.audience ? ` • Público: ${s.derivation.audience}` : '';
        return {
          label: `Personalizado • ${durationLabel}`,
          tooltip: `${sourceHint}${audienceHint} (${durationLabel})`,
          variant: 'custom',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
      }
      default:
        return {
          label: `Derivado • ${durationLabel}`,
          tooltip: `${sourceHint} — Versão adaptada (${durationLabel})`,
          variant: 'duration',
          isDerived: true,
          sourceTitle: sourceTitle || undefined
        };
    }
  }

  // Retrocompatibilidade para variações antigas salvas antes da persistência de `derivation`
  const hasBibleStudyTitle = /^estudo\s+b[íi]blico\s*[:\-]/i.test(s.title || '');
  const hasBibleStudyTag = tags.some(t => /^estudo\s+b[íi]blico$/i.test(t.trim()) || /^pg$/i.test(t.trim()));
  if (hasBibleStudyTitle || hasBibleStudyTag) {
    return {
      label: `Estudo Bíblico • ${durationLabel}`,
      tooltip: `Estudo Bíblico / PG (${durationLabel})`,
      variant: 'bible-study',
      isDerived: true
    };
  }

  const hasCustomTag = tags.some(t => /^personalizado$/i.test(t.trim()));
  const hasDerivedTag = tags.some(t => /^derivado$/i.test(t.trim()));
  const hasDurationTitleSuffix = /\(\s*(?:20|30|40)\s*min\s*\)$/i.test((s.title || '').trim());
  if (hasCustomTag || hasDerivedTag || hasDurationTitleSuffix) {
    return {
      label: `${hasCustomTag ? 'Personalizado' : 'Derivado'} • ${durationLabel}`,
      tooltip: `${hasCustomTag ? 'Mensagem personalizada' : 'Versão derivada'} (${durationLabel})`,
      variant: hasCustomTag ? 'custom' : 'duration',
      isDerived: true
    };
  }

  if (s.isOutline) {
    return {
      label: `Esboço • ${durationLabel}`,
      tooltip: `Esboço homilético (${durationLabel})`,
      variant: 'outline',
      isDerived: false
    };
  }

  return {
    label: `Original • ${durationLabel}`,
    tooltip: `Sermão original (${durationLabel})`,
    variant: 'original',
    isDerived: false
  };
}

export interface SermonCardProps {
  sermon: Sermon;
  isSelected?: boolean;
  isDeleting?: boolean;
  isDeriving?: boolean;
  isAnyDeriving?: boolean;
  onSelect: (sermon: Sermon) => void;
  onOpenPulpit: (sermon: Sermon) => void;
  onDuplicate: (sermon: Sermon) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDeriveDuration?: (sermon: Sermon, duration: SermonDerivationDuration) => void;
  onDeriveMode?: (sermon: Sermon, mode: SermonDerivationMode) => void;
}

const DERIVATION_MENU_MODES: Array<{
  mode: SermonDerivationMode;
  label: string;
  hint: string;
}> = [
  { mode: 'bible-study', label: 'Estudo Bíblico (PG)', hint: 'Roteiro com perguntas para grupo' },
  { mode: 'devotional', label: 'Devocional (5–10 min)', hint: 'Reflexão breve e oração final' },
  { mode: 'pulpit-card', label: 'Cartão de Púlpito', hint: 'Esboço condensado em tópicos' },
  { mode: 'ebd', label: 'Lição de EBD', hint: 'Aula com guia para professor' },
  { mode: 'catechetical', label: 'Estudo Catequético', hint: 'Perguntas e respostas doutrinárias' },
  { mode: 'evangelistic', label: 'Roteiro Evangelístico', hint: 'Linguagem acessível e convite' },
  { mode: 'counseling', label: 'Aconselhamento (1-a-1)', hint: 'Discipulado e cuidado pessoal' },
  { mode: 'post-service', label: 'Resumo Pós-Culto', hint: 'Pronto para boletim e WhatsApp' }
];

/**
 * Card de Sermão na Biblioteca - Estrutura Compacta (Modelo 3):
 * - Linha Principal (Cabeçalho): Título em destaque com botão de favorito (★) no topo.
 * - Linha de Metadados: Texto bíblico limpo (ex: "Lucas 18:1-8") com badge da versão (ex: "AEC"), data e série.
 * - Subtítulo / Tema Central: Padronizado em linha única concisa (line-clamp-1).
 * - Divisor Sutil: Separa o bloco de texto da barra de ações rápidas.
 * - Rodapé de Ações: Botões agrupados (Carregar Estudo, Púlpito, Derivar, Copiar, Arquivar e Apagar).
 */
export const SermonLibraryCard: React.FC<SermonCardProps> = ({
  sermon: s,
  isSelected = false,
  isDeleting = false,
  isDeriving = false,
  isAnyDeriving = false,
  onSelect,
  onOpenPulpit,
  onDuplicate,
  onToggleFavorite,
  onToggleArchive,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onDeriveDuration,
  onDeriveMode
}) => {
  const { reference, version } = normalizeCardBibleMetadata(s.scripture, s.bibleVersion);
  const cleanTheme = normalizeCardTheme(s.theme);
  const derivationBadge = getCardDerivationBadge(s);
  const formattedDate = new Date(s.date).toLocaleDateString('pt-BR');
  const [deriveMenuOpen, setDeriveMenuOpen] = useState(false);
  const deriveMenuRef = useRef<HTMLDivElement>(null);

  const hasDeriveActions = Boolean(onDeriveDuration || onDeriveMode);

  const badgeStyleClass =
    derivationBadge.variant === 'bible-study'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : derivationBadge.variant === 'devotional'
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : derivationBadge.variant === 'pulpit-card'
      ? 'bg-slate-100 text-slate-800 border-slate-300'
      : derivationBadge.variant === 'ebd'
      ? 'bg-sky-50 text-sky-800 border-sky-200'
      : derivationBadge.variant === 'catechetical'
      ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
      : derivationBadge.variant === 'evangelistic'
      ? 'bg-orange-50 text-orange-800 border-orange-200'
      : derivationBadge.variant === 'counseling'
      ? 'bg-teal-50 text-teal-800 border-teal-200'
      : derivationBadge.variant === 'post-service'
      ? 'bg-purple-50 text-purple-800 border-purple-200'
      : derivationBadge.variant === 'custom'
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
      : derivationBadge.variant === 'duration'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : derivationBadge.variant === 'outline'
      ? 'bg-stone-100 text-stone-700 border-stone-200'
      : 'bg-[#F5F2ED] text-[#5A5A40] border-[#E6E2DA]';

  useEffect(() => {
    if (!deriveMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (deriveMenuRef.current && !deriveMenuRef.current.contains(event.target as Node)) {
        setDeriveMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDeriveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [deriveMenuOpen]);

  return (
    <div 
      className={`bg-white rounded-xl border p-4 flex flex-col justify-between hover:shadow-md transition-all gap-3 ${isSelected ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]' : 'border-[#E6E2DA]'}`}
    >
      {/* Conteúdo textual superior compacto */}
      <div className="space-y-2">
        {/* Linha Principal (Cabeçalho): Título em destaque com botão de favorito (★) no topo */}
        <div className="flex items-start justify-between gap-2">
          <h4 
            onClick={() => onSelect(s)}
            className="font-serif font-bold text-gray-900 text-sm sm:text-base leading-snug hover:text-[#5A5A40] cursor-pointer transition-colors line-clamp-1 flex-1 text-left"
            title={s.title}
          >
            {s.title}
          </h4>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(s.id);
            }}
            className={`p-1 -mr-1 -mt-0.5 rounded transition-all text-base leading-none shrink-0 cursor-pointer hover:bg-amber-50 ${s.isFavorite ? 'text-amber-500 scale-110' : 'text-gray-300 hover:text-amber-400'}`}
            title={s.isFavorite ? "Remover dos favoritos" : "Marcar como favorito"}
          >
            ★
          </button>
        </div>

        {/* Linha de Metadados: Texto bíblico limpo e versão da Bíblia de forma integrada */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          <span className="font-serif text-[#5A5A40] font-semibold text-xs truncate max-w-[200px] sm:max-w-[250px]" title={reference}>
            {reference}
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-stone-100 text-stone-700 border border-stone-200 shrink-0">
            {version}
          </span>
          <span className="text-gray-300 text-[10px]">•</span>
          <span className="text-[10px] text-gray-400 font-mono shrink-0">
            {formattedDate}
          </span>
        </div>

        {/* Linha de Versão / Derivação e Série */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-tight shrink-0 ${badgeStyleClass}`}
            title={derivationBadge.tooltip}
          >
            {derivationBadge.variant === 'bible-study' ? (
              <BookOpen className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'devotional' ? (
              <Sun className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'pulpit-card' ? (
              <LayoutList className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'ebd' ? (
              <GraduationCap className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'catechetical' ? (
              <BookOpenCheck className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'evangelistic' ? (
              <Megaphone className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'counseling' ? (
              <HeartHandshake className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'post-service' ? (
              <Share2 className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'custom' ? (
              <SlidersHorizontal className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'duration' ? (
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
            ) : derivationBadge.variant === 'outline' ? (
              <FileText className="w-2.5 h-2.5 shrink-0" />
            ) : (
              <Clock className="w-2.5 h-2.5 shrink-0" />
            )}
            <span>{derivationBadge.label}</span>
          </span>
          {derivationBadge.sourceTitle && (
            <span
              className="text-[10px] text-gray-500 truncate max-w-[170px]"
              title={derivationBadge.tooltip}
            >
              de "{derivationBadge.sourceTitle}"
            </span>
          )}
          {s.seriesName && (
            <span className="text-[9px] font-bold uppercase text-[#5A5A40] bg-[#5A5A40]/10 px-1.5 py-0.5 rounded truncate max-w-[130px]" title={`Série: ${s.seriesName}`}>
              {s.seriesName}
            </span>
          )}
        </div>

        {/* Padronização do Subtítulo / Tema Central: Linha única concisa (line-clamp-1) */}
        {cleanTheme && (
          <p className="text-[11px] text-gray-500 line-clamp-1 leading-normal italic text-left truncate" title={cleanTheme}>
            {cleanTheme}
          </p>
        )}
      </div>

      {/* Divisor Sutil & Rodapé de Ações */}
      {isDeleting ? (
        <div className="pt-2.5 border-t border-red-200 bg-red-50 p-2.5 text-xs rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 animate-fade-in w-full text-left">
          <span className="text-red-900 font-semibold text-xs leading-tight">Apagar este sermão permanentemente?</span>
          <div className="flex items-center gap-2 font-bold text-xs shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirmDelete(s.id);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirmDelete(s.id);
              }}
              className="flex-1 sm:flex-none text-white bg-red-600 hover:bg-red-700 active:bg-red-800 min-h-[36px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs text-center font-bold touch-manipulation select-none flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Sim, Apagar</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancelDelete();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancelDelete();
              }}
              className="flex-1 sm:flex-none text-gray-700 hover:text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 active:bg-gray-200 min-h-[36px] px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-center font-bold touch-manipulation select-none"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2.5 border-t border-[#F0ECE1] flex flex-wrap justify-between items-center text-xs w-full gap-2">
          {/* Ações principais (Estudo, Púlpito & Derivar) */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="text-[#5A5A40] hover:text-[#2D2926] hover:underline font-bold cursor-pointer py-0.5 text-xs transition-colors"
            >
              Carregar Estudo
            </button>
            <span className="text-gray-300 text-[10px]">•</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenPulpit(s);
              }}
              className="text-amber-900 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-xs transition-colors shadow-2xs"
              title="Abrir diretamente no Modo Púlpito"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>Modo Púlpito</span>
            </button>

            {hasDeriveActions && (
              <div className="relative" ref={deriveMenuRef}>
                <button
                  type="button"
                  disabled={isAnyDeriving}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeriveMenuOpen(prev => !prev);
                  }}
                  aria-expanded={deriveMenuOpen}
                  aria-haspopup="menu"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    isDeriving
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]'
                      : deriveMenuOpen
                      ? 'bg-[#5A5A40]/15 text-[#2D2926] border-[#5A5A40]'
                      : 'bg-stone-50 hover:bg-[#5A5A40]/10 text-[#5A5A40] border-[#E6E2DA]'
                  }`}
                  title="Derivar versão por duração ou modelo ministerial"
                >
                  {isDeriving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Derivando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>Derivar</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${deriveMenuOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {deriveMenuOpen && (
                  <div
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 sm:left-0 bottom-full mb-1.5 z-40 w-64 max-w-[calc(100vw-2rem)] max-h-[340px] overflow-y-auto bg-white border border-[#E6E2DA] rounded-xl shadow-xl p-2 space-y-1.5 text-left"
                  >
                    {onDeriveDuration && (
                      <div className="px-1.5 pt-0.5 pb-1.5 border-b border-[#F0ECE1]">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                          <Clock className="w-3 h-3 text-[#5A5A40]" />
                          <span>Gerar versão por duração</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(['20', '30', '40'] as SermonDerivationDuration[]).map((dur) => {
                            const isCurrent = s.duration === dur;
                            return (
                              <button
                                key={dur}
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeriveMenuOpen(false);
                                  onDeriveDuration(s, dur);
                                }}
                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                                  isCurrent
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                    : 'bg-[#FDFBF7] border-[#E6E2DA] text-[#2D2926] hover:bg-[#5A5A40] hover:text-white hover:border-[#5A5A40]'
                                }`}
                                title={`Gerar versão de ${dur} minutos sem alterar o original`}
                              >
                                {dur} min
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {onDeriveMode && (
                      <div className="space-y-0.5">
                        <div className="px-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Modelos de Derivação
                        </div>
                        {DERIVATION_MENU_MODES.map((item) => (
                          <button
                            key={item.mode}
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeriveMenuOpen(false);
                              onDeriveMode(s, item.mode);
                            }}
                            className="w-full px-2 py-1.5 rounded-lg text-left hover:bg-[#5A5A40]/10 flex items-start gap-2 transition-colors cursor-pointer"
                            title={item.hint}
                          >
                            {item.mode === 'bible-study' ? (
                              <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'devotional' ? (
                              <Sun className="w-3.5 h-3.5 text-rose-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'pulpit-card' ? (
                              <LayoutList className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'ebd' ? (
                              <GraduationCap className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'catechetical' ? (
                              <BookOpenCheck className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'evangelistic' ? (
                              <Megaphone className="w-3.5 h-3.5 text-orange-700 shrink-0 mt-0.5" />
                            ) : item.mode === 'counseling' ? (
                              <HeartHandshake className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                            ) : (
                              <Share2 className="w-3.5 h-3.5 text-purple-700 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#2D2926] leading-tight">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-gray-500 leading-tight">
                                {item.hint}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Ações utilitárias discretas */}
          <div className="flex gap-2 text-gray-500 items-center">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDuplicate(s);
              }} 
              className="hover:text-gray-700 cursor-pointer p-0.5 text-xs transition-colors" 
              title="Duplicar"
            >
              Copiar
            </button>
            <span className="text-gray-300 text-[10px]">•</span>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleArchive(s.id);
              }} 
              className="hover:text-amber-700 cursor-pointer p-0.5 text-xs transition-colors" 
              title="Arquivar"
            >
              {s.isArchived ? 'Ativar' : 'Arquivar'}
            </button>
            <span className="text-gray-300 text-[10px]">•</span>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestDelete(s.id);
              }} 
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestDelete(s.id);
              }}
              className="text-red-700 hover:text-red-900 active:bg-red-100 bg-red-50 sm:bg-transparent px-2 py-1 rounded-md font-bold cursor-pointer transition-colors touch-manipulation select-none flex items-center gap-1 text-xs" 
              title="Apagar sermão permanentemente"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600 inline" />
              <span>Apagar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export interface SermonLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sermons: Sermon[];
  selectedSermonId?: string | null;
  derivingSermonId?: string | null;
  onSelectSermon: (sermon: Sermon) => void;
  onOpenPulpit: (sermon: Sermon) => void;
  onDuplicateSermon: (sermon: Sermon) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteSermon: (id: string) => void;
  onDeriveDuration?: (sermon: Sermon, duration: SermonDerivationDuration) => void;
  onDeriveMode?: (sermon: Sermon, mode: SermonDerivationMode) => void;
  onForceCloudSync?: () => void;
  isCloudSyncing?: boolean;
}

/**
 * Modal / Visualizador Completo da Biblioteca de Sermões
 */
export const SermonLibraryModal: React.FC<SermonLibraryModalProps> = ({
  isOpen,
  onClose,
  sermons,
  selectedSermonId,
  derivingSermonId = null,
  onSelectSermon,
  onOpenPulpit,
  onDuplicateSermon,
  onToggleFavorite,
  onToggleArchive,
  onDeleteSermon,
  onDeriveDuration,
  onDeriveMode,
  onForceCloudSync,
  isCloudSyncing = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sermons
      .filter(s => Boolean(s.title || s.scripture))
      .filter(s => (showArchivedOnly ? s.isArchived : !s.isArchived))
      .filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const badge = getCardDerivationBadge(s);
        return (
          s.title.toLowerCase().includes(q) ||
          s.scripture.toLowerCase().includes(q) ||
          s.theme.toLowerCase().includes(q) ||
          (s.seriesName && s.seriesName.toLowerCase().includes(q)) ||
          badge.label.toLowerCase().includes(q) ||
          (badge.sourceTitle && badge.sourceTitle.toLowerCase().includes(q)) ||
          s.tags.some(t => t.toLowerCase().includes(q))
        );
      });
  }, [sermons, showArchivedOnly, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FDFBF7] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E6E2DA] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E6E2DA] bg-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#2D2926]">Biblioteca de Sermões</h2>
            <p className="text-xs text-gray-500">Selecione ou gerencie seus estudos bíblicos</p>
          </div>
          <div className="flex items-center gap-2">
            {onForceCloudSync && (
              <button
                type="button"
                onClick={onForceCloudSync}
                disabled={isCloudSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                <span>{isCloudSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-stone-50/70 border-b border-[#E6E2DA] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full bg-white border border-[#E6E2DA] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-[#5A5A40] focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowArchivedOnly(!showArchivedOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${showArchivedOnly ? 'bg-amber-600 text-white border-amber-600' : 'bg-white hover:bg-gray-50 text-[#2D2926] border-[#E6E2DA]'}`}
          >
            {showArchivedOnly ? 'Ver Ativos' : 'Ver Arquivados'}
          </button>
        </div>

        {/* Cards Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(sermon => (
                <SermonLibraryCard
                  key={sermon.id}
                  sermon={sermon}
                  isSelected={selectedSermonId === sermon.id}
                  isDeleting={deletingId === sermon.id}
                  isDeriving={derivingSermonId === sermon.id}
                  isAnyDeriving={Boolean(derivingSermonId)}
                  onSelect={onSelectSermon}
                  onOpenPulpit={onOpenPulpit}
                  onDuplicate={onDuplicateSermon}
                  onToggleFavorite={onToggleFavorite}
                  onToggleArchive={onToggleArchive}
                  onRequestDelete={(id) => setDeletingId(id)}
                  onConfirmDelete={(id) => {
                    onDeleteSermon(id);
                    setDeletingId(null);
                  }}
                  onCancelDelete={() => setDeletingId(null)}
                  onDeriveDuration={onDeriveDuration}
                  onDeriveMode={onDeriveMode}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-400 italic text-sm">
              Nenhum sermão encontrado com os filtros atuais.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
