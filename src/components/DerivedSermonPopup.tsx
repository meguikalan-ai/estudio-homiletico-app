import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  BookOpenCheck,
  Check,
  CheckCircle2,
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
  Minimize2,
  Music,
  Plus,
  Printer,
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

export type DerivationLayoutVariant =
  | 'pg'
  | 'devotional'
  | 'pulpit-card'
  | 'ebd'
  | 'catechetical'
  | 'evangelistic'
  | 'counseling'
  | 'post-service'
  | 'default';

export type DerivationWindowSize = 'narrow' | 'compact' | 'medium' | 'wide';

export interface DerivationLayoutConfig {
  variant: DerivationLayoutVariant;
  size: DerivationWindowSize;
  /** Largura e altura no desktop/tablet (em mobile sempre ocupa a tela inteira) */
  dialogSizeClass: string;
  /** Largura do conteúdo interno de leitura */
  articleWidthClass: string;
  /** Barra discreta de destaque no topo do cabeçalho */
  headerTopAccentClass: string;
  /** Fundo sutil do cabeçalho */
  headerSurfaceClass: string;
  /** Paleta do selo de versão no cabeçalho */
  badgePaletteClass: string;
  /** Paleta da caixa de aviso/orientação do formato */
  bannerPaletteClass: string;
  bannerIconColorClass: string;
  bannerEyebrowClass: string;
  /** Cor do acento para títulos de seção */
  sectionDotClass: string;
  sectionHeadingClass: string;
  /** Se permite alternar entre 20/30/40 min no cabeçalho */
  supportsDurationSwitch: boolean;
  /** Botão dedicado de impressão no rodapé/cabeçalho */
  printButtonLabel?: string;
  /** Permite alternar tela cheia (ex.: Cartão de Púlpito) */
  allowFullscreen?: boolean;
  /** Título e descrição exibidos no cartão explicativo do formato */
  bannerTitle?: string;
  bannerDescription?: string;
}

/**
 * CONFIGURAÇÃO CENTRAL DE LAYOUT DA JANELA DE DERIVAÇÃO
 * Ajuste tamanhos, cores, ícones e comportamento por tipo em um único lugar.
 */
export const DEFAULT_DERIVATION_LAYOUT_CONFIG: DerivationLayoutConfig = {
  variant: 'default',
  size: 'medium',
  dialogSizeClass: 'sm:max-w-4xl sm:h-[90vh]',
  articleWidthClass: 'max-w-3xl',
  headerTopAccentClass: 'border-t-4 border-t-[#5A5A40]',
  headerSurfaceClass: 'bg-white',
  badgePaletteClass: 'bg-amber-50 text-amber-900 border-amber-200',
  bannerPaletteClass: 'bg-amber-50/70 border-amber-200 text-amber-950',
  bannerIconColorClass: 'text-amber-700',
  bannerEyebrowClass: 'text-amber-800',
  sectionDotClass: 'bg-[#5A5A40]',
  sectionHeadingClass: 'text-[#5A5A40]',
  supportsDurationSwitch: true
};

export const DERIVATION_LAYOUT_CONFIG: Record<string, DerivationLayoutConfig> = {
  'bible-study': {
    variant: 'pg',
    size: 'medium',
    dialogSizeClass: 'sm:max-w-3xl sm:h-[90vh]',
    articleWidthClass: 'max-w-3xl',
    headerTopAccentClass: 'border-t-4 border-t-emerald-600',
    headerSurfaceClass: 'bg-gradient-to-b from-emerald-50/45 to-white',
    badgePaletteClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    bannerPaletteClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-950',
    bannerIconColorClass: 'text-emerald-700',
    bannerEyebrowClass: 'text-emerald-800',
    sectionDotClass: 'bg-emerald-600',
    sectionHeadingClass: 'text-emerald-800',
    supportsDurationSwitch: true,
    printButtonLabel: 'Imprimir para o grupo',
    bannerTitle: 'Roteiro de Estudo Bíblico Participativo (PG / Célula)',
    bannerDescription:
      'Organizado em Quebra-gelo, Leitura, Perguntas numeradas para o grupo, Aplicação e Oração.'
  },
  devotional: {
    variant: 'devotional',
    size: 'compact',
    dialogSizeClass: 'sm:max-w-xl sm:h-[84vh]',
    articleWidthClass: 'max-w-xl',
    headerTopAccentClass: 'border-t-4 border-t-rose-500',
    headerSurfaceClass: 'bg-gradient-to-b from-rose-50/45 to-white',
    badgePaletteClass: 'bg-rose-50 text-rose-900 border-rose-200',
    bannerPaletteClass: 'bg-rose-50/70 border-rose-200 text-rose-950',
    bannerIconColorClass: 'text-rose-700',
    bannerEyebrowClass: 'text-rose-800',
    sectionDotClass: 'bg-rose-600',
    sectionHeadingClass: 'text-rose-800',
    supportsDurationSwitch: false,
    bannerTitle: 'Devocional Pastoral Breve (5–10 min)',
    bannerDescription:
      'Leitura confortável com versículo em destaque no topo, meditação concisa e oração final separada.'
  },
  'pulpit-card': {
    variant: 'pulpit-card',
    size: 'narrow',
    dialogSizeClass: 'sm:max-w-lg sm:h-[92vh]',
    articleWidthClass: 'max-w-lg',
    headerTopAccentClass: 'border-t-4 border-t-slate-800',
    headerSurfaceClass: 'bg-gradient-to-b from-slate-100/70 to-white',
    badgePaletteClass: 'bg-slate-100 text-slate-900 border-slate-300',
    bannerPaletteClass: 'bg-slate-100 border-slate-300 text-slate-900',
    bannerIconColorClass: 'text-slate-700',
    bannerEyebrowClass: 'text-slate-800',
    sectionDotClass: 'bg-slate-800',
    sectionHeadingClass: 'text-slate-800',
    supportsDurationSwitch: false,
    printButtonLabel: 'Imprimir cartão',
    allowFullscreen: true,
    bannerTitle: 'Cartão de Púlpito • Tópicos de Alto Contraste',
    bannerDescription:
      'Cartão vertical com fonte ampliada e leitura escaneável em tópicos para uso direto no púlpito.'
  },
  ebd: {
    variant: 'ebd',
    size: 'wide',
    dialogSizeClass: 'sm:max-w-6xl sm:h-[92vh]',
    articleWidthClass: 'max-w-none',
    headerTopAccentClass: 'border-t-4 border-t-sky-600',
    headerSurfaceClass: 'bg-gradient-to-b from-sky-50/45 to-white',
    badgePaletteClass: 'bg-sky-50 text-sky-900 border-sky-200',
    bannerPaletteClass: 'bg-sky-50/70 border-sky-200 text-sky-950',
    bannerIconColorClass: 'text-sky-700',
    bannerEyebrowClass: 'text-sky-800',
    sectionDotClass: 'bg-sky-600',
    sectionHeadingClass: 'text-sky-800',
    supportsDurationSwitch: true,
    bannerTitle: 'Lição de Escola Bíblica Dominical (EBD)',
    bannerDescription:
      'Dividida em Material do Aluno e Guia do Professor (duas colunas em telas maiores ou abas no celular).'
  },
  catechetical: {
    variant: 'catechetical',
    size: 'medium',
    dialogSizeClass: 'sm:max-w-3xl sm:h-[90vh]',
    articleWidthClass: 'max-w-3xl',
    headerTopAccentClass: 'border-t-4 border-t-cyan-600',
    headerSurfaceClass: 'bg-gradient-to-b from-cyan-50/45 to-white',
    badgePaletteClass: 'bg-cyan-50 text-cyan-900 border-cyan-200',
    bannerPaletteClass: 'bg-cyan-50/70 border-cyan-200 text-cyan-950',
    bannerIconColorClass: 'text-cyan-700',
    bannerEyebrowClass: 'text-cyan-800',
    sectionDotClass: 'bg-cyan-600',
    sectionHeadingClass: 'text-cyan-800',
    supportsDurationSwitch: true,
    bannerTitle: 'Estudo Catequético • Perguntas & Respostas Doutrinárias',
    bannerDescription:
      'Texto-base destacado, blocos estruturados de Pergunta e Resposta e declarações de fé para memorizar.'
  },
  evangelistic: {
    variant: 'evangelistic',
    size: 'medium',
    dialogSizeClass: 'sm:max-w-3xl sm:h-[90vh]',
    articleWidthClass: 'max-w-3xl',
    headerTopAccentClass: 'border-t-4 border-t-orange-500',
    headerSurfaceClass: 'bg-gradient-to-b from-orange-50/45 to-white',
    badgePaletteClass: 'bg-orange-50 text-orange-900 border-orange-200',
    bannerPaletteClass: 'bg-orange-50/70 border-orange-200 text-orange-950',
    bannerIconColorClass: 'text-orange-700',
    bannerEyebrowClass: 'text-orange-800',
    sectionDotClass: 'bg-orange-600',
    sectionHeadingClass: 'text-orange-800',
    supportsDurationSwitch: true,
    bannerTitle: 'Roteiro Evangelístico • Abertura, Mensagem e Convite',
    bannerDescription:
      'Fluxo progressivo sem jargões internos, conduzindo à cruz de Cristo com convite final em destaque.'
  },
  counseling: {
    variant: 'counseling',
    size: 'medium',
    dialogSizeClass: 'sm:max-w-3xl sm:h-[90vh]',
    articleWidthClass: 'max-w-3xl',
    headerTopAccentClass: 'border-t-4 border-t-teal-600',
    headerSurfaceClass: 'bg-gradient-to-b from-teal-50/45 to-white',
    badgePaletteClass: 'bg-teal-50 text-teal-900 border-teal-200',
    bannerPaletteClass: 'bg-teal-50/70 border-teal-200 text-teal-950',
    bannerIconColorClass: 'text-teal-700',
    bannerEyebrowClass: 'text-teal-800',
    sectionDotClass: 'bg-teal-600',
    sectionHeadingClass: 'text-teal-800',
    supportsDurationSwitch: false,
    bannerTitle: 'Guia de Discipulado & Aconselhamento (1-a-1)',
    bannerDescription:
      'Cuidado pastoral individual articulando verdade consoladora, diagnóstico bíblico e passos da semana.'
  },
  'post-service': {
    variant: 'post-service',
    size: 'medium',
    dialogSizeClass: 'sm:max-w-3xl sm:h-[90vh]',
    articleWidthClass: 'max-w-3xl',
    headerTopAccentClass: 'border-t-4 border-t-purple-600',
    headerSurfaceClass: 'bg-gradient-to-b from-purple-50/45 to-white',
    badgePaletteClass: 'bg-purple-50 text-purple-900 border-purple-200',
    bannerPaletteClass: 'bg-purple-50/70 border-purple-200 text-purple-950',
    bannerIconColorClass: 'text-purple-700',
    bannerEyebrowClass: 'text-purple-800',
    sectionDotClass: 'bg-purple-600',
    sectionHeadingClass: 'text-purple-800',
    supportsDurationSwitch: false,
    bannerTitle: 'Resumo Pós-Culto • Boletim & WhatsApp da Igreja',
    bannerDescription:
      'Síntese pronta para enviar à congregação com os pontos centrais e guia semanal de leitura e oração.'
  },
  duration: {
    ...DEFAULT_DERIVATION_LAYOUT_CONFIG
  },
  custom: {
    ...DEFAULT_DERIVATION_LAYOUT_CONFIG
  }
};

export function getDerivationLayoutConfig(mode: string | undefined): DerivationLayoutConfig {
  if (!mode) return DEFAULT_DERIVATION_LAYOUT_CONFIG;
  return DERIVATION_LAYOUT_CONFIG[mode] || DEFAULT_DERIVATION_LAYOUT_CONFIG;
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
      if (/^(?:como|qual|quais|por\s+que|onde|de\s+que\s+forma|o\s+que)\b/i.test(trimmed) && trimmed.endsWith('?')) {
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
    const qaMatch =
      block.match(
        /^(?:Pergunta(?:\s*\d+)?|P\.?\s*\d*)\s*[:\-–—]\s*([\s\S]+?)\n+\s*(?:Resposta(?:\s*\d+)?|R\.?\s*\d*)\s*[:\-–—]\s*([\s\S]+)$/i
      ) ||
      block.match(
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

function extractBulletLines(rawText: string): string[] {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const explicitLines = normalized
    .split('\n')
    .map((line) => line.replace(/^\s*[•\-–—*]\s*/, '').trim())
    .filter(Boolean);

  if (explicitLines.length > 1) {
    return explicitLines;
  }

  // Caso venha em texto corrido, quebra em sentenças curtas para formato cartão de púlpito
  return normalized
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function printHtmlThroughHiddenIframe(html: string, fallbackFilename: string) {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      throw new Error('Documento de impressão indisponível');
    }

    doc.open();
    doc.write(html);
    doc.close();

    window.setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fallbackFilename;
        link.click();
      } finally {
        window.setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }
    }, 180);
  } catch {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fallbackFilename;
    link.click();
  }
}

function buildGroupStudyPrintHtml(
  sermon: Sermon,
  reference: string,
  version: string,
  questions: Array<{ num: number; topic: string; question: string; context?: string }>,
  appItems: string[]
): string {
  const safeTitle = escapeHtml(sermon.title);
  const safeRef = escapeHtml(`${reference} (${version})`);
  const safeTheme = escapeHtml(sermon.theme || '');
  const safeIntro = escapeHtml(sermon.introduction || '').replace(/\n/g, '<br/>');
  const safeScriptureFull = escapeHtml(sermon.scripture || reference).replace(/\n/g, '<br/>');
  const safeConclusion = escapeHtml(sermon.conclusion || '').replace(/\n/g, '<br/>');
  const safePrayer = escapeHtml(sermon.pastoralAppeal || '').replace(/\n/g, '<br/>');

  const questionsHtml = questions
    .map(
      (q) => `
      <div class="q-card">
        <div class="q-num">${q.num}</div>
        <div class="q-body">
          <div class="q-topic">${escapeHtml(q.topic)}</div>
          <div class="q-text">${escapeHtml(q.question)}</div>
          ${q.context ? `<div class="q-note">${escapeHtml(q.context)}</div>` : ''}
          <div class="q-lines"></div>
          <div class="q-lines"></div>
        </div>
      </div>`
    )
    .join('');

  const appsHtml =
    appItems.length > 0
      ? `<ul>${appItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — Roteiro para Pequeno Grupo</title>
  <style>
    @page { margin: 1.5cm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #1f1d1b; line-height: 1.5; margin: 0; font-size: 11.5pt; }
    .header { border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 16px; }
    .eyebrow { font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #065f46; }
    h1 { font-size: 18pt; margin: 4px 0; color: #111827; }
    .meta { font-family: Arial, sans-serif; font-size: 9.5pt; color: #4b5563; }
    .section { margin-bottom: 16px; }
    .section-title { font-family: Arial, sans-serif; font-size: 9.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #065f46; margin-bottom: 6px; border-left: 3px solid #059669; padding-left: 8px; }
    .box { background: #f8faf9; border: 1px solid #d1fae5; border-radius: 6px; padding: 10px 12px; }
    .q-card { display: flex; gap: 10px; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
    .q-num { font-family: Arial, sans-serif; width: 24px; height: 24px; border-radius: 999px; background: #059669; color: #fff; font-weight: bold; font-size: 10pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .q-body { flex: 1; }
    .q-topic { font-family: Arial, sans-serif; font-size: 8.5pt; font-weight: bold; text-transform: uppercase; color: #4b5563; margin-bottom: 2px; }
    .q-text { font-weight: bold; font-size: 11pt; margin-bottom: 4px; }
    .q-note { font-size: 10pt; color: #374151; margin-bottom: 6px; }
    .q-lines { border-bottom: 1px dashed #d1d5db; height: 16px; }
    ul { margin: 4px 0 0 18px; padding: 0; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="eyebrow">Estudo Bíblico Participativo (Pequeno Grupo)</div>
    <h1>${safeTitle}</h1>
    <div class="meta"><strong>Texto:</strong> ${safeRef}${safeTheme ? ` &bull; <strong>Tema:</strong> ${safeTheme}` : ''}</div>
  </div>
  <div class="section">
    <div class="section-title">1. Quebra-gelo & Acolhimento</div>
    <p>${safeIntro}</p>
  </div>
  <div class="section">
    <div class="section-title">2. Leitura Bíblica</div>
    <div class="box">${safeScriptureFull}</div>
  </div>
  <div class="section">
    <div class="section-title">3. Perguntas para o Grupo</div>
    ${questionsHtml}
  </div>
  ${appsHtml || safeConclusion ? `
  <div class="section">
    <div class="section-title">4. Aplicação</div>
    ${safeConclusion ? `<p>${safeConclusion}</p>` : ''}
    ${appsHtml}
  </div>` : ''}
  ${safePrayer ? `
  <div class="section">
    <div class="section-title">5. Oração</div>
    <div class="box">${safePrayer}</div>
  </div>` : ''}
</body>
</html>`;
}

function buildPulpitCardPrintHtml(
  sermon: Sermon,
  reference: string,
  version: string
): string {
  const safeTitle = escapeHtml(sermon.title);
  const safeRef = escapeHtml(`${reference} (${version})`);
  const introBullets = extractBulletLines(sermon.introduction || '').slice(0, 3);
  const pointsHtml = (sermon.expositoryPoints || [])
    .map((pt, idx) => {
      const structured = structureExpositoryPoint(pt, idx);
      const bullets = extractBulletLines(pt.explanation || structured.fullExplanation);
      const appBullets = extractBulletLines(pt.application || '');
      return `
      <div class="card-point">
        <div class="point-title">${escapeHtml(structured.romanTitle)}</div>
        ${pt.precedingTransition ? `<div class="transition">${escapeHtml(pt.precedingTransition)}</div>` : ''}
        <ul>
          ${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
        ${appBullets.length > 0 ? `<div class="app-box"><strong>APLICAÇÃO:</strong> ${escapeHtml(appBullets.join(' • '))}</div>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — Cartão de Púlpito</title>
  <style>
    @page { margin: 1.2cm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000000; background: #ffffff; max-width: 12.5cm; margin: 0 auto; line-height: 1.45; }
    .top { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
    .ref { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.06em; }
    h1 { font-size: 17pt; margin: 4px 0 0 0; line-height: 1.2; }
    .intro { border: 2px solid #000; padding: 8px 10px; margin-bottom: 14px; font-size: 11pt; }
    .card-point { border-left: 4px solid #000; padding-left: 10px; margin-bottom: 16px; page-break-inside: avoid; }
    .point-title { font-size: 13.5pt; font-weight: bold; margin-bottom: 6px; }
    .transition { font-style: italic; font-size: 10.5pt; margin-bottom: 6px; }
    ul { margin: 0 0 6px 18px; padding: 0; font-size: 11.5pt; }
    li { margin-bottom: 4px; }
    .app-box { background: #f3f4f6; border: 1px solid #000; padding: 6px 8px; font-size: 11pt; margin-top: 6px; }
    .appeal { border-top: 3px solid #000; padding-top: 10px; margin-top: 14px; font-size: 11.5pt; font-weight: bold; }
  </style>
</head>
<body>
  <div class="top">
    <div class="ref">Cartão de Púlpito &bull; ${safeRef}</div>
    <h1>${safeTitle}</h1>
  </div>
  ${introBullets.length > 0 ? `<div class="intro"><strong>ABERTURA:</strong> ${introBullets.map(escapeHtml).join(' • ')}</div>` : ''}
  ${pointsHtml}
  ${sermon.pastoralAppeal ? `<div class="appeal">CONVITE: ${escapeHtml(sermon.pastoralAppeal)}</div>` : ''}
</body>
</html>`;
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
  lines.push(
    forWhatsApp
      ? `📖 ${sermon.scripture} (${sermon.bibleVersion})`
      : `[${badgeLabel}] • ${sermon.scripture} (${sermon.bibleVersion})`
  );
  if (sermon.theme) lines.push(`${b('Tema:')} ${sermon.theme}`);
  if (!forWhatsApp && sermon.audience) lines.push(`Público: ${sermon.audience}`);
  lines.push('');

  if (sermon.introduction) {
    const introHeading =
      mode === 'bible-study'
        ? '1. Quebra-gelo & Abertura'
        : mode === 'ebd'
        ? 'Objetivo Pedagógico & Introdução'
        : mode === 'catechetical'
        ? 'Propósito Catequético & Síntese Doutrinária'
        : mode === 'evangelistic'
        ? '1. Abertura'
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
        : mode === 'bible-study'
        ? '2. Leitura & Contexto'
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
        ? '3. Perguntas para o Grupo'
        : mode === 'catechetical'
        ? 'Perguntas & Respostas Doutrinárias'
        : mode === 'pulpit-card'
        ? 'Tópicos do Cartão de Púlpito'
        : mode === 'evangelistic'
        ? '2. Mensagem'
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
      if (pt.illustration?.description && !forWhatsApp && mode !== 'pulpit-card') {
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

  if (
    sermon.applications &&
    sermon.applications.length > 0 &&
    (mode === 'post-service' || mode === 'bible-study' || mode === 'ebd' || mode === 'catechetical' || mode === 'counseling')
  ) {
    const listTitle =
      mode === 'post-service'
        ? 'Guia de Leitura & Oração da Semana'
        : mode === 'ebd'
        ? 'Pontos de Fixação da Lição'
        : mode === 'catechetical'
        ? 'Declarações de Fé para Memorizar'
        : mode === 'counseling'
        ? 'Práticas da Semana'
        : '4. Aplicação do Grupo';
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
        ? '5. Oração'
        : mode === 'catechetical'
        ? 'Confissão & Firmeza Doutrinária'
        : mode === 'evangelistic'
        ? '3. Convite Final'
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ebdMobileTab, setEbdMobileTab] = useState<'student' | 'teacher'>('student');
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedHymnKey, setCopiedHymnKey] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setConfirmDiscard(false);
    setIsEditing(false);
    setIsFullscreen(false);
    setEbdMobileTab('student');
  }, [isOpen, sermon?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeriving && !isBlockedByOverlay) {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeriving, isBlockedByOverlay, isFullscreen, onClose]);

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
  const layoutConfig = getDerivationLayoutConfig(effectiveMode);
  const effectiveDuration = (sermon.derivation?.duration || meta?.duration || sermon.duration || '30') as SermonDerivationDuration;

  const isBibleStudy = layoutConfig.variant === 'pg';
  const isDevotional = layoutConfig.variant === 'devotional';
  const isPulpitCard = layoutConfig.variant === 'pulpit-card';
  const isEbd = layoutConfig.variant === 'ebd';
  const isCatechetical = layoutConfig.variant === 'catechetical';
  const isEvangelistic = layoutConfig.variant === 'evangelistic';
  const isCounseling = layoutConfig.variant === 'counseling';
  const isPostService = layoutConfig.variant === 'post-service';

  const sourceTitle = sermon.derivation?.sourceTitle || meta?.sourceTitle || sourceSermon?.title || '';
  const { reference, version } = normalizeCardBibleMetadata(sermon.scripture, sermon.bibleVersion);

  const introParagraphs = splitFluentParagraphs(sermon.introduction || '');
  const contextParagraphs = splitFluentParagraphs(sermon.biblicalContext || '');
  const conclusionParagraphs = splitFluentParagraphs(sermon.conclusion || '');
  const appealParagraphs = splitFluentParagraphs(sermon.pastoralAppeal || '');

  // Dados agregados para Estudo Bíblico (PG): perguntas numeradas em cartões
  const pgQuestions = (() => {
    if (!isBibleStudy) return [];
    const list: Array<{ num: number; topic: string; question: string; context?: string }> = [];
    structuredPoints.forEach(({ raw, structured }) => {
      const cues = extractSectionCues(structured.applicationParagraphs, 'bible-study');
      if (cues.groupQuestions.length > 0) {
        cues.groupQuestions.forEach((q) => {
          list.push({
            num: list.length + 1,
            topic: structured.romanTitle,
            question: q,
            context: structured.explanationParagraphs[0]
          });
        });
      } else {
        const fallbackQ =
          cues.applications[0] ||
          raw.application ||
          `Como aplicar o ensino de "${structured.romanTitle}" na vida prática do grupo esta semana?`;
        list.push({
          num: list.length + 1,
          topic: structured.romanTitle,
          question: fallbackQ,
          context: structured.explanationParagraphs[0]
        });
      }
    });
    return list;
  })();

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

  const handlePrintDerived = () => {
    const slug = (sermon.title || 'derivacao')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '');

    if (isBibleStudy) {
      const pgApps = [
        ...(sermon.applications || []),
        ...structuredPoints.flatMap(({ structured }) => extractSectionCues(structured.applicationParagraphs, 'bible-study').applications)
      ];
      const html = buildGroupStudyPrintHtml(sermon, reference, version, pgQuestions, pgApps);
      printHtmlThroughHiddenIframe(html, `${slug}_estudo_pg.html`);
      return;
    }

    if (isPulpitCard) {
      const html = buildPulpitCardPrintHtml(sermon, reference, version);
      printHtmlThroughHiddenIframe(html, `${slug}_cartao_pulpito.html`);
    }
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

  const renderModeIcon = (className = 'w-3.5 h-3.5 shrink-0') => {
    switch (layoutConfig.variant) {
      case 'pg':
        return <BookOpen className={className} />;
      case 'devotional':
        return <Sun className={className} />;
      case 'pulpit-card':
        return <LayoutList className={className} />;
      case 'ebd':
        return <GraduationCap className={className} />;
      case 'catechetical':
        return <BookOpenCheck className={className} />;
      case 'evangelistic':
        return <Megaphone className={className} />;
      case 'counseling':
        return <HeartHandshake className={className} />;
      case 'post-service':
        return <Share2 className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  const renderModeBanner = () => {
    if (!layoutConfig.bannerTitle || !layoutConfig.bannerDescription) return null;
    return (
      <div className={`mt-2 p-3 rounded-xl border flex items-start gap-2.5 text-xs ${layoutConfig.bannerPaletteClass}`}>
        {renderModeIcon(`w-4 h-4 ${layoutConfig.bannerIconColorClass} shrink-0 mt-0.5`)}
        <div>
          <span className={`font-bold uppercase tracking-wider text-[10px] block ${layoutConfig.bannerEyebrowClass}`}>
            {layoutConfig.bannerTitle}
          </span>
          <span className="leading-relaxed opacity-90">{layoutConfig.bannerDescription}</span>
        </div>
      </div>
    );
  };

  const activeDialogSizeClass =
    layoutConfig.allowFullscreen && isFullscreen
      ? 'sm:max-w-5xl sm:h-[96vh]'
      : layoutConfig.dialogSizeClass;

  const activeArticleWidthClass =
    layoutConfig.allowFullscreen && isFullscreen
      ? 'max-w-3xl'
      : layoutConfig.articleWidthClass;

  const renderHymnsSection = () => {
    if (!hymnSlots.some((slot) => Boolean(slot.hymn))) return null;
    return (
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
                    <span className="text-[10px] font-bold uppercase text-gray-500">{label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        hymn.hinario === 'CC' ? 'bg-[#5A5A40] text-white' : 'bg-amber-800 text-white'
                      }`}
                    >
                      {hymn.hinario} {hymn.number}
                    </span>
                  </div>
                  <p className="font-serif font-bold text-sm text-[#2D2926] truncate mt-0.5">{hymn.title}</p>
                  <p className="text-[11px] text-gray-500 truncate">{hymn.theme}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyHymn(hymn, copyKey)}
                    className="p-1.5 rounded-lg bg-white border border-[#E6E2DA] text-gray-600 hover:text-[#2D2926] cursor-pointer"
                    title="Copiar letra do hino"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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
    );
  };

  const renderManuscriptHeader = () => (
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
        className={`font-serif font-bold leading-tight ${
          isPulpitCard ? 'text-2xl sm:text-3xl text-black' : 'text-2xl sm:text-3xl text-[#2D2926]'
        }`}
      >
        {sermon.title}
      </h1>

      {sermon.theme && !isPulpitCard && (
        <p className="text-sm sm:text-base font-serif italic text-[#5A5A40] leading-relaxed">
          {sermon.theme}
        </p>
      )}

      {!isDevotional && !isCatechetical && !isBibleStudy && sermon.scripture && sermon.scripture.trim() !== reference && (
        <blockquote className="mt-2 p-3.5 rounded-xl bg-[#FDFBF7] border-l-3 border-[#5A5A40] text-sm font-serif text-gray-800 leading-relaxed">
          {sermon.scripture}
        </blockquote>
      )}

      {renderModeBanner()}
    </div>
  );

  // =========================================================================
  // RENDERIZADORES ESPECIALIZADOS POR VERSÃO DERIVADA
  // =========================================================================

  const renderBibleStudyPGView = () => {
    const pgPointApps = structuredPoints.flatMap(({ structured }) =>
      extractSectionCues(structured.applicationParagraphs, 'bible-study').applications
    );
    const allApplications = [...(sermon.applications || []), ...pgPointApps];

    return (
      <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-8 space-y-6 mx-auto ${activeArticleWidthClass}`}>
        {renderManuscriptHeader()}

        {/* 1. Quebra-gelo */}
        {introParagraphs.length > 0 && (
          <section className="p-4 sm:p-5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>1. Quebra-gelo & Acolhimento</span>
            </h2>
            <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-emerald-950">
              {introParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* 2. Leitura */}
        <section className="p-4 sm:p-5 rounded-xl bg-[#FDFBF7] border border-[#E6E2DA] space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>2. Leitura Bíblica</span>
            </h2>
            <span className="text-xs font-serif font-bold text-[#5A5A40] bg-white px-2.5 py-0.5 rounded-md border border-[#E6E2DA]">
              {reference} ({version})
            </span>
          </div>
          {sermon.scripture && (
            <blockquote className="p-3.5 rounded-lg bg-white border-l-3 border-emerald-600 font-serif text-[15px] text-gray-900 leading-relaxed">
              {sermon.scripture}
            </blockquote>
          )}
          {contextParagraphs.length > 0 && (
            <div className="space-y-2 font-serif text-sm sm:text-[15px] leading-relaxed text-gray-700 pt-1">
              {contextParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </section>

        {/* 3. Perguntas Numeradas em Cartões */}
        {pgQuestions.length > 0 && (
          <section className="space-y-3.5">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>3. Perguntas para o Grupo</span>
            </h2>
            <div className="space-y-3">
              {pgQuestions.map((item) => (
                <div
                  key={item.num}
                  className="p-4 rounded-xl border border-emerald-200 bg-white shadow-2xs flex items-start gap-3.5"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {item.num}
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      {item.topic}
                    </span>
                    <p className="font-serif font-bold text-[15px] sm:text-base text-[#2D2926] leading-snug">
                      {item.question}
                    </p>
                    {item.context && (
                      <p className="text-xs sm:text-sm font-serif text-gray-600 leading-relaxed pt-1 border-t border-[#F4F1EA]">
                        {item.context}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Aplicação */}
        {(allApplications.length > 0 || conclusionParagraphs.length > 0) && (
          <section className="p-4 sm:p-5 rounded-xl bg-[#F5F2ED]/80 border border-[#DCD6C8] space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>4. Aplicação Prática</span>
            </h2>
            {conclusionParagraphs.length > 0 && (
              <div className="space-y-2 font-serif text-[15px] leading-relaxed text-gray-800">
                {conclusionParagraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            )}
            {allApplications.length > 0 && (
              <ul className="space-y-1.5 text-sm font-serif text-gray-900 list-disc pl-5">
                {allApplications.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* 5. Oração */}
        {appealParagraphs.length > 0 && (
          <section className="p-4 sm:p-5 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-700" />
              <span>5. Oração</span>
            </h2>
            <div className="space-y-2 font-serif text-[15px] leading-relaxed text-emerald-950">
              {appealParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {renderHymnsSection()}
      </article>
    );
  };

  const renderDevotionalView = () => (
    <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-7 space-y-6 mx-auto ${activeArticleWidthClass}`}>
      {renderManuscriptHeader()}

      {/* Versículo em destaque no topo */}
      <section className="p-4 sm:p-5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-800 block">
          Texto Bíblico do Dia • {reference} ({version})
        </span>
        <p className="font-serif text-base sm:text-[17px] italic text-rose-950 leading-[1.7]">
          {sermon.scripture || reference}
        </p>
      </section>

      {/* Corpo com tipografia de leitura confortável */}
      {introParagraphs.length > 0 && (
        <section className="space-y-3 font-serif text-base sm:text-[17px] leading-[1.78] text-gray-800">
          {introParagraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}

      {contextParagraphs.length > 0 && (
        <section className="space-y-3 font-serif text-[15px] sm:text-base leading-[1.75] text-gray-700 pt-2 border-t border-[#F4F1EA]">
          {contextParagraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}

      {structuredPoints.length > 0 && (
        <section className="space-y-5 pt-2 border-t border-[#F4F1EA]">
          {structuredPoints.map(({ structured }, idx) => (
            <div key={idx} className="space-y-2.5">
              <h3 className="text-lg font-serif font-bold text-[#2D2926]">
                {structured.romanTitle}
              </h3>
              <div className="space-y-3 font-serif text-base sm:text-[17px] leading-[1.78] text-gray-800">
                {structured.explanationParagraphs.map((para, pIdx) => (
                  <p key={pIdx}>{para}</p>
                ))}
              </div>
              {structured.applicationParagraphs.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E6E2DA] space-y-2 font-serif text-[15px] leading-[1.7] text-gray-800">
                  {structured.applicationParagraphs.map((aPara, aIdx) => (
                    <p key={aIdx}>{aPara}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {conclusionParagraphs.length > 0 && (
        <section className="space-y-2.5 pt-2 border-t border-[#F4F1EA] font-serif text-base sm:text-[17px] leading-[1.78] text-gray-800">
          {conclusionParagraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </section>
      )}

      {/* Oração final em bloco separado no rodapé do conteúdo */}
      {appealParagraphs.length > 0 && (
        <section className="p-5 rounded-xl bg-rose-50/80 border-2 border-rose-200 space-y-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-rose-900 flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-rose-700" />
            <span>Oração Final</span>
          </h2>
          <div className="space-y-2 font-serif text-base leading-[1.75] text-rose-950 italic">
            {appealParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}
    </article>
  );

  const renderPulpitCardView = () => {
    const introBullets = extractBulletLines(sermon.introduction || '').slice(0, 3);
    const conclusionBullets = extractBulletLines(sermon.conclusion || '').slice(0, 2);

    return (
      <article className={`bg-white rounded-2xl border-2 border-slate-900 shadow-sm p-5 sm:p-7 space-y-6 mx-auto ${activeArticleWidthClass}`}>
        <div className="border-b-2 border-slate-900 pb-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
              {reference} ({version})
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cartão de Púlpito • {effectiveDuration} min
            </span>
          </div>
          <h1 id="derived-popup-title" className="text-2xl sm:text-3xl font-sans font-extrabold text-black leading-tight">
            {sermon.title}
          </h1>
          {renderModeBanner()}
        </div>

        {introBullets.length > 0 && (
          <section className="p-4 rounded-xl bg-slate-100 border-2 border-slate-900 space-y-2">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-black">
              Abertura & Tese
            </h2>
            <ul className="space-y-2 text-base sm:text-lg font-sans font-semibold text-black leading-snug list-disc pl-5">
              {introBullets.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {structuredPoints.length > 0 && (
          <section className="space-y-5">
            {structuredPoints.map(({ raw, structured }, idx) => {
              const bullets = extractBulletLines(raw.explanation || structured.fullExplanation);
              const appBullets = extractBulletLines(raw.application || structured.applicationParagraphs.join('\n'));
              return (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-xl border-2 border-slate-800 bg-white space-y-3"
                >
                  <h3 className="text-xl sm:text-2xl font-sans font-extrabold text-black leading-snug border-b border-slate-300 pb-2">
                    {structured.romanTitle}
                  </h3>
                  {raw.precedingTransition && (
                    <p className="text-sm sm:text-base font-sans italic font-medium text-slate-800">
                      → {raw.precedingTransition}
                    </p>
                  )}
                  {bullets.length > 0 && (
                    <ul className="space-y-2.5 text-base sm:text-lg font-sans font-medium text-black leading-relaxed list-disc pl-5">
                      {bullets.map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {appBullets.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-900 text-white space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 block">
                        Direcionamento Direto
                      </span>
                      <ul className="space-y-1 text-sm sm:text-base font-sans font-semibold leading-snug list-disc pl-4">
                        {appBullets.map((ab, aIdx) => (
                          <li key={aIdx}>{ab}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {(conclusionBullets.length > 0 || appealParagraphs.length > 0) && (
          <section className="p-4 rounded-xl bg-amber-100 border-2 border-slate-900 space-y-2">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-black">
              Fechamento & Apelo
            </h2>
            {conclusionBullets.length > 0 && (
              <ul className="space-y-1.5 text-base font-sans font-semibold text-black list-disc pl-5">
                {conclusionBullets.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            )}
            {appealParagraphs.length > 0 && (
              <p className="text-base sm:text-lg font-sans font-bold text-black leading-snug pt-1">
                {appealParagraphs.join(' ')}
              </p>
            )}
          </section>
        )}
      </article>
    );
  };

  const renderEbdView = () => {
    const ebdPointDetails = structuredPoints.map(({ raw, structured }) => ({
      raw,
      structured,
      cues: extractSectionCues(structured.applicationParagraphs, 'ebd')
    }));

    const studentColumn = (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-sky-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-sky-900 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-sky-700" />
            <span>Material do Aluno</span>
          </h2>
          <span className="text-[11px] font-semibold text-sky-800">{reference} ({version})</span>
        </div>

        {introParagraphs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
              1. Objetivo Pedagógico & Abertura
            </h3>
            <div className="space-y-2.5 font-serif text-[15px] leading-relaxed text-gray-800">
              {introParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {contextParagraphs.length > 0 && (
          <section className="space-y-2 pt-3 border-t border-[#F4F1EA]">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
              2. Panorama Histórico-Doutrinário
            </h3>
            <div className="space-y-2.5 font-serif text-[15px] leading-relaxed text-gray-800">
              {contextParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {ebdPointDetails.length > 0 && (
          <section className="space-y-5 pt-3 border-t border-[#F4F1EA]">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
              3. Exposição da Lição
            </h3>
            {ebdPointDetails.map(({ raw, structured, cues }, idx) => (
              <div key={idx} className="pl-3.5 border-l-2 border-sky-200 space-y-2.5">
                <h4 className="text-lg font-serif font-bold text-[#2D2926]">
                  {structured.romanTitle}
                </h4>
                <div className="space-y-2 font-serif text-[15px] leading-relaxed text-gray-800">
                  {structured.explanationParagraphs.map((para, pIdx) => (
                    <p key={pIdx}>{para}</p>
                  ))}
                </div>
                {raw.illustration?.description && (
                  <div className="p-3 rounded-lg bg-[#FDFBF7] border border-[#E6E2DA] text-xs sm:text-sm font-serif text-gray-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block mb-1">
                      Ilustração ({raw.illustration.type})
                    </span>
                    {raw.illustration.description}
                  </div>
                )}
                {cues.classQuestions.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-sky-50/80 border border-sky-200 text-sky-950 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-sky-800 flex items-center gap-1.5">
                      <MessageCircleQuestion className="w-3.5 h-3.5" />
                      <span>Pergunta para a Classe</span>
                    </span>
                    {cues.classQuestions.map((q, qIdx) => (
                      <p key={qIdx} className="text-sm font-serif font-medium leading-relaxed">
                        {q}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {sermon.applications && sermon.applications.length > 0 && (
          <section className="p-4 rounded-xl bg-sky-50/50 border border-sky-200 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-sky-900">
              Pontos de Fixação da Lição
            </h3>
            <ul className="space-y-1.5 text-sm font-serif text-gray-800 list-disc pl-5">
              {sermon.applications.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {conclusionParagraphs.length > 0 && (
          <section className="space-y-2 pt-3 border-t border-[#F4F1EA]">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
              Conclusão da Lição
            </h3>
            <div className="space-y-2 font-serif text-[15px] leading-relaxed text-gray-800">
              {conclusionParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}
      </div>
    );

    const teacherColumn = (
      <div className="space-y-5 md:bg-[#F8FAFC] md:p-5 md:rounded-xl md:border md:border-sky-200/80">
        <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-900 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-700" />
            <span>Guia do Professor</span>
          </h2>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
            Orientação Didática
          </span>
        </div>

        <div className="space-y-3.5">
          {ebdPointDetails.map(({ structured, cues }, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-white border border-indigo-200/90 space-y-2 shadow-2xs"
            >
              <span className="text-[11px] font-bold text-indigo-900 block">
                {structured.romanTitle}
              </span>
              {cues.teacherGuides.length > 0 ? (
                <div className="space-y-1.5 text-xs sm:text-sm font-serif text-indigo-950 leading-relaxed">
                  {cues.teacherGuides.map((g, gIdx) => (
                    <p key={gIdx}>{g}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs sm:text-sm font-serif text-gray-700 leading-relaxed">
                  Conduza a turma a conectar este tópico ao texto bíblico base ({reference}) e enfatize a aplicação prática.
                </p>
              )}
              {cues.applications.length > 0 && (
                <div className="pt-2 border-t border-indigo-100 text-xs font-serif text-gray-700 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#5A5A40] block">
                    Aplicação em Classe
                  </span>
                  {cues.applications.map((appText, aIdx) => (
                    <p key={aIdx}>{appText}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {appealParagraphs.length > 0 && (
          <section className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-900">
              Desafio Semanal & Encerramento
            </h3>
            <div className="space-y-2 text-xs sm:text-sm font-serif text-indigo-950 leading-relaxed">
              {appealParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {renderHymnsSection()}
      </div>
    );

    return (
      <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-4 sm:p-7 space-y-6 mx-auto ${activeArticleWidthClass}`}>
        {renderManuscriptHeader()}

        {/* Abas em telas pequenas (< md) */}
        <div className="flex md:hidden items-center bg-sky-50 border border-sky-200 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setEbdMobileTab('student')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              ebdMobileTab === 'student'
                ? 'bg-sky-700 text-white shadow-2xs'
                : 'text-sky-900 hover:bg-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Material do Aluno</span>
          </button>
          <button
            type="button"
            onClick={() => setEbdMobileTab('teacher')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              ebdMobileTab === 'teacher'
                ? 'bg-indigo-700 text-white shadow-2xs'
                : 'text-indigo-900 hover:bg-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Guia do Professor</span>
          </button>
        </div>

        {/* Mobile tab content */}
        <div className="md:hidden">
          {ebdMobileTab === 'student' ? studentColumn : teacherColumn}
        </div>

        {/* Desktop 2-column layout */}
        <div className="hidden md:grid md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7">{studentColumn}</div>
          <div className="md:col-span-5">{teacherColumn}</div>
        </div>
      </article>
    );
  };

  const renderCatecheticalView = () => {
    const declarations =
      sermon.applications && sermon.applications.length > 0
        ? sermon.applications
        : structuredPoints.map(({ structured }) => structured.romanTitle);

    return (
      <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-8 space-y-6 mx-auto ${activeArticleWidthClass}`}>
        {renderManuscriptHeader()}

        {/* Texto-base em destaque */}
        <section className="p-4 sm:p-5 rounded-xl bg-cyan-50/70 border border-cyan-200 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-800">
              Texto-Base Doutrinário • {reference} ({version})
            </span>
          </div>
          {sermon.scripture && (
            <blockquote className="p-3 rounded-lg bg-white border-l-3 border-cyan-600 font-serif text-[15px] text-cyan-950 leading-relaxed">
              {sermon.scripture}
            </blockquote>
          )}
          {introParagraphs.length > 0 && (
            <div className="space-y-2 font-serif text-sm sm:text-[15px] leading-relaxed text-cyan-950 pt-1">
              {introParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </section>

        {contextParagraphs.length > 0 && (
          <section className="space-y-2 pt-2 border-t border-[#F4F1EA]">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              <span>Fundamento Bíblico & Canônico</span>
            </h2>
            <div className="space-y-2.5 font-serif text-[15px] leading-relaxed text-gray-800">
              {contextParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* Blocos de Pergunta e Resposta */}
        {structuredPoints.length > 0 && (
          <section className="space-y-6 pt-2 border-t border-[#F4F1EA]">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              <span>Perguntas & Respostas Doutrinárias</span>
            </h2>

            <div className="space-y-6">
              {structuredPoints.map(({ raw, structured }, idx) => {
                const catecheticalData = extractCatecheticalQA(raw.explanation || structured.fullExplanation);
                const cues = extractSectionCues(structured.applicationParagraphs, 'catechetical');

                return (
                  <div key={idx} className="pl-3.5 sm:pl-5 border-l-2 border-cyan-200 space-y-3.5">
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D2926]">
                      {structured.romanTitle}
                    </h3>

                    {catecheticalData.pairs.length > 0 ? (
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
                      </div>
                    ) : (
                      <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                        {structured.explanationParagraphs.map((para, pIdx) => (
                          <p key={pIdx}>{para}</p>
                        ))}
                      </div>
                    )}

                    {cues.applications.length > 0 && (
                      <div className="p-3.5 rounded-xl border bg-[#F5F2ED]/80 border-[#DCD6C8] text-[#2D2926] space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                          Uso Doutrinário & Prático
                        </span>
                        <div className="space-y-1.5 text-sm font-serif leading-relaxed">
                          {cues.applications.map((appPara, aIdx) => (
                            <p key={aIdx}>{appPara}</p>
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

        {/* Caixa Declarações de fé para memorizar */}
        {declarations.length > 0 && (
          <section className="p-4 sm:p-5 rounded-xl border-2 border-cyan-300 bg-cyan-50/60 space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-700" />
              <span>Declarações de fé para memorizar</span>
            </h2>
            <ol className="space-y-2 text-sm sm:text-[15px] font-serif text-cyan-950 list-decimal pl-5">
              {declarations.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ol>
          </section>
        )}

        {conclusionParagraphs.length > 0 && (
          <section className="space-y-2 pt-2 border-t border-[#F4F1EA]">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-800 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
              <span>Síntese Final</span>
            </h2>
            <div className="space-y-2.5 font-serif text-[15px] leading-relaxed text-gray-800">
              {conclusionParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {appealParagraphs.length > 0 && (
          <section className="p-4 sm:p-5 rounded-xl border border-cyan-200 bg-[#FDFBF7] space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-900">
              Confissão & Firmeza Doutrinária
            </h2>
            <div className="space-y-2 font-serif text-[15px] leading-relaxed text-gray-900">
              {appealParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {renderHymnsSection()}
      </article>
    );
  };

  const renderEvangelisticView = () => (
    <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-8 space-y-7 mx-auto ${activeArticleWidthClass}`}>
      {renderManuscriptHeader()}

      {/* 1. Abertura */}
      {(introParagraphs.length > 0 || contextParagraphs.length > 0) && (
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[11px] font-bold uppercase tracking-widest text-orange-800">
            <span>1. Abertura • Ponte com o Ouvinte</span>
          </div>
          <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
            {introParagraphs.map((para, i) => (
              <p key={`intro-${i}`}>{para}</p>
            ))}
            {contextParagraphs.map((para, i) => (
              <p key={`ctx-${i}`} className="text-gray-700">
                {para}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* 2. Mensagem */}
      {structuredPoints.length > 0 && (
        <section className="space-y-6 pt-3 border-t border-[#F4F1EA]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[11px] font-bold uppercase tracking-widest text-orange-800">
            <span>2. Mensagem • Do Coração Humano à Cruz de Cristo</span>
          </div>

          <div className="space-y-6">
            {structuredPoints.map(({ raw, structured }, idx) => (
              <div key={idx} className="pl-3.5 sm:pl-5 border-l-2 border-orange-200 space-y-3">
                {raw.precedingTransition && (
                  <p className="text-xs sm:text-sm italic text-orange-900/90 bg-orange-50/40 px-3 py-2 rounded-lg border border-orange-100">
                    {raw.precedingTransition}
                  </p>
                )}
                <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D2926]">
                  {structured.romanTitle}
                </h3>
                <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                  {structured.explanationParagraphs.map((para, pIdx) => (
                    <p key={pIdx}>{para}</p>
                  ))}
                </div>
                {raw.illustration?.description && (
                  <div className="p-4 rounded-xl border bg-amber-50/60 border-amber-200 text-amber-950 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 block">
                      {raw.illustration.type === 'bíblica' ? 'Ilustração Bíblica' : 'Ilustração Cotidiano'}
                    </span>
                    <p className="text-sm font-serif leading-relaxed">{raw.illustration.description}</p>
                  </div>
                )}
                {structured.applicationParagraphs.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FDFBF7] border border-[#E6E2DA] space-y-1.5 text-sm font-serif leading-relaxed text-gray-800">
                    {structured.applicationParagraphs.map((appPara, aIdx) => (
                      <p key={aIdx}>{appPara}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {conclusionParagraphs.length > 0 && (
            <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800 pt-2">
              {conclusionParagraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Convite Final em Destaque */}
      {appealParagraphs.length > 0 && (
        <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-300 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-900">
            <Megaphone className="w-4 h-4 text-orange-700" />
            <span>3. Convite Final</span>
          </div>
          <div className="space-y-2.5 font-serif text-base sm:text-[17px] leading-relaxed text-orange-950 font-medium">
            {appealParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {renderHymnsSection()}
    </article>
  );

  const renderDefaultAndCompanionView = () => (
    <article className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-5 sm:p-8 space-y-7 mx-auto ${activeArticleWidthClass}`}>
      {renderManuscriptHeader()}

      {/* 1. Introdução */}
      {introParagraphs.length > 0 && (
        <section className="space-y-2.5">
          <h2 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${layoutConfig.sectionHeadingClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${layoutConfig.sectionDotClass}`} />
            <span>
              {isPostService
                ? '1. Resumo da Pregação'
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

      {/* 2. Contexto Bíblico */}
      {contextParagraphs.length > 0 && !isPostService && (
        <section className="space-y-2.5 pt-2 border-t border-[#F4F1EA]">
          <h2 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${layoutConfig.sectionHeadingClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${layoutConfig.sectionDotClass}`} />
            <span>Contexto Histórico-Bíblico</span>
          </h2>
          <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
            {contextParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {/* 3. Desenvolvimento */}
      {structuredPoints.length > 0 && (
        <section className="space-y-6 pt-2 border-t border-[#F4F1EA]">
          <h2 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${layoutConfig.sectionHeadingClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${layoutConfig.sectionDotClass}`} />
            <span>
              {isCounseling
                ? '2. Verdade Consoladora & Passos Bíblicos'
                : isPostService
                ? '2. Pontos-Chave para Relembrar'
                : 'Desenvolvimento Expositivo'}
            </span>
          </h2>

          <div className="space-y-7">
            {structuredPoints.map(({ raw, structured }, idx) => (
              <div key={idx} className="pl-3.5 sm:pl-5 border-l-2 border-[#E6E2DA] space-y-3.5">
                {raw.precedingTransition && (
                  <p className="text-xs sm:text-sm italic text-[#5A5A40]/90 bg-[#FDFBF7] px-3 py-2 rounded-lg border border-[#EFECE4]">
                    {raw.precedingTransition}
                  </p>
                )}

                <h3 className="text-lg sm:text-xl font-serif font-bold text-[#2D2926]">
                  {structured.romanTitle}
                </h3>

                {structured.explanationParagraphs.length > 0 && (
                  <div className="space-y-2.5 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
                    {structured.explanationParagraphs.map((para, pIdx) => (
                      <p key={pIdx}>{para}</p>
                    ))}
                  </div>
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
                      {raw.illustration.type === 'bíblica' ? 'Ilustração Bíblica' : 'Ilustração Cotidiano'}
                    </span>
                    <p className="text-sm font-serif leading-relaxed">{raw.illustration.description}</p>
                  </div>
                )}

                {structured.applicationParagraphs.length > 0 && (
                  <div className="p-4 rounded-xl border bg-[#F5F2ED]/80 border-[#DCD6C8] text-[#2D2926] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                      {isCounseling
                        ? 'Passos Bíblicos de Obediência'
                        : isPostService
                        ? 'Meditação para a Semana'
                        : 'Aplicação'}
                    </span>
                    <div className="space-y-2 text-sm font-serif leading-relaxed">
                      {structured.applicationParagraphs.map((appPara, aIdx) => (
                        <p key={aIdx}>{appPara}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Guia Semanal / Práticas */}
      {(isCounseling || isPostService) && sermon.applications && sermon.applications.length > 0 && (
        <section
          className={`p-4 rounded-xl border space-y-2.5 ${
            isPostService ? 'bg-purple-50/50 border-purple-200' : 'bg-teal-50/50 border-teal-200'
          }`}
        >
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#5A5A40]">
            {isPostService ? 'Guia de Leitura e Oração da Semana (Seg a Sex)' : 'Práticas Espirituais da Semana'}
          </h2>
          <ul className="space-y-1.5 text-sm font-serif text-gray-800 list-disc pl-5">
            {sermon.applications.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Conclusão */}
      {conclusionParagraphs.length > 0 && (
        <section className="space-y-2.5 pt-2 border-t border-[#F4F1EA]">
          <h2 className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${layoutConfig.sectionHeadingClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${layoutConfig.sectionDotClass}`} />
            <span>Conclusão</span>
          </h2>
          <div className="space-y-3 font-serif text-[15px] sm:text-base leading-relaxed text-gray-800">
            {conclusionParagraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {/* Apelo / Oração */}
      {appealParagraphs.length > 0 && (
        <section
          className={`p-4 sm:p-5 rounded-xl border space-y-2.5 ${
            isCounseling ? 'bg-teal-50/50 border-teal-200' : 'bg-amber-50/50 border-amber-200'
          }`}
        >
          <h2 className={`text-[11px] font-bold uppercase tracking-widest ${isCounseling ? 'text-teal-900' : 'text-amber-900'}`}>
            {isCounseling
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

      {renderHymnsSection()}
    </article>
  );

  const renderFormattedContent = () => {
    switch (layoutConfig.variant) {
      case 'pg':
        return renderBibleStudyPGView();
      case 'devotional':
        return renderDevotionalView();
      case 'pulpit-card':
        return renderPulpitCardView();
      case 'ebd':
        return renderEbdView();
      case 'catechetical':
        return renderCatecheticalView();
      case 'evangelistic':
        return renderEvangelisticView();
      default:
        return renderDefaultAndCompanionView();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] bg-[#1E1B18]/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="derived-popup-title"
      onClick={() => {
        if (!isDeriving && !isBlockedByOverlay) onClose();
      }}
    >
      <div
        className={`bg-[#FDFBF7] border border-[#E6E2DA] ${layoutConfig.headerTopAccentClass} rounded-none sm:rounded-2xl w-full h-[100dvh] ${activeDialogSizeClass} shadow-2xl flex flex-col overflow-hidden text-left transition-[max-width,width,height] duration-300 ease-out animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Bar */}
        <header className={`shrink-0 ${layoutConfig.headerSurfaceClass} border-b border-[#E6E2DA] px-4 sm:px-6 py-3 flex flex-col gap-2`}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center flex-wrap gap-1.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${layoutConfig.badgePaletteClass}`}>
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
                  <span className="hidden sm:inline">Visualizar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isEditing ? 'bg-[#5A5A40] text-white shadow-2xs' : 'text-[#5A5A40] hover:bg-white'
                  }`}
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
              </div>

              {layoutConfig.allowFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
                  title={isFullscreen ? 'Restaurar cartão vertical' : 'Expandir para tela cheia'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden md:inline">{isFullscreen ? 'Cartão' : 'Tela cheia'}</span>
                </button>
              )}

              {onSwitchDuration && sourceSermon && layoutConfig.supportsDurationSwitch && (
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
                title="Fechar janela (mantém o rascunho pronto)"
                aria-label="Fechar janela de derivação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile quick duration switcher */}
          {onSwitchDuration && sourceSermon && layoutConfig.supportsDurationSwitch && (
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
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-5 relative">
          {isDeriving && (
            <div className={`bg-[#5A5A40] text-white px-4 py-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold shadow-sm mx-auto ${activeArticleWidthClass}`}>
              <Loader2 className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
              <span>Gerando nova variação... o sermão original permanece preservado na Biblioteca.</span>
            </div>
          )}

          {fallbackNotice && (
            <div className={`bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 mx-auto ${activeArticleWidthClass}`}>
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
            <div className={`bg-white rounded-2xl border border-[#E6E2DA] shadow-xs p-4 sm:p-7 space-y-6 mx-auto ${activeArticleWidthClass}`}>
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
                    ? 'Quebra-gelo & Acolhimento'
                    : isEbd
                    ? 'Objetivo Pedagógico & Introdução'
                    : isEvangelistic
                    ? 'Abertura'
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
                  {isEbd
                    ? 'Panorama Histórico-Doutrinário'
                    : isCatechetical
                    ? 'Fundamento Bíblico & Canônico'
                    : 'Contexto Histórico-Bíblico'}
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
                            ? 'Tópicos, Exegese & Referências'
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
                    ? 'Oração do Grupo'
                    : isCatechetical
                    ? 'Confissão & Firmeza Doutrinária'
                    : isEvangelistic
                    ? 'Convite Final'
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
            renderFormattedContent()
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

            {layoutConfig.printButtonLabel && (
              <button
                type="button"
                onClick={handlePrintDerived}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isPulpitCard
                    ? 'bg-slate-900 hover:bg-black text-white border-slate-900'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{layoutConfig.printButtonLabel}</span>
              </button>
            )}

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

            <button
              type="button"
              onClick={onClose}
              disabled={isDeriving}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-stone-100 hover:bg-stone-200 text-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
