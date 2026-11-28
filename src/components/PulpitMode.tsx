import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Play,
  Pause,
  RotateCcw,
  Timer,
  BookOpen,
  Sparkles,
  Flame,
  Music,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ListOrdered,
  Copy,
  Check,
  ChevronsDown,
  Minus,
  Plus,
  Bookmark
} from 'lucide-react';
import { Sermon, DetailedHymn } from '../types';
import { hydrateHymnsIfLegacy } from '../hymnsData';
import { BIBLE_REF_PATTERN, getCardDerivationBadge } from './SermonLibraryModal';
import {
  formatRomanPointTitle,
  structureExpositoryPoint,
  sanitizePulpitPortuguese,
  splitFluentParagraphs
} from '../utils/sermonPointFormatting';

interface PulpitModeProps {
  sermon: Sermon;
  onClose: () => void;
}

type PulpitTheme = 'light' | 'dark';
type ScrollSpeed = 'slow' | 'medium' | 'fast';

const FONT_SIZES = [18, 20, 23, 26, 30, 34, 38] as const;

const SCROLL_SPEED_PX_PER_SEC: Record<ScrollSpeed, number> = {
  slow: 16,
  medium: 30,
  fast: 48
};

const SCROLL_SPEED_LABELS: Record<ScrollSpeed, string> = {
  slow: 'Lenta',
  medium: 'Média',
  fast: 'Rápida'
};

const STORAGE_THEME_KEY = 'pulpit_mode_theme';
const STORAGE_FONT_INDEX_KEY = 'pulpit_mode_font_size_index';
const STORAGE_FONT_FAMILY_KEY = 'pulpit_mode_font_family';
const STORAGE_GUIDE_ENABLED_KEY = 'pulpit_mode_guide_enabled';
const STORAGE_GUIDE_Y_KEY = 'pulpit_mode_guide_y_percent';
const STORAGE_SCROLL_SPEED_KEY = 'pulpit_mode_scroll_speed';

function resolveInitialDurationMinutes(sermon: Sermon): number {
  const derivationDur = sermon.derivation?.duration;
  if (derivationDur === '10') return 10;
  if (derivationDur === '20') return 20;
  if (derivationDur === '30') return 30;
  if (derivationDur === '40') return 40;
  if (sermon.duration === '10') return 10;
  if (sermon.duration === '20') return 20;
  if (sermon.duration === '40') return 40;
  if (sermon.duration === '60') return 60;
  return 30;
}

function formatTimer(totalSecs: number): string {
  const safe = Math.max(0, Math.floor(totalSecs));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isBiblicalQuoteParagraph(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  if (!trimmed) return false;
  if (/^(?:📖|\[(?:texto|vers[íi]culo)\s*b[íi]blico\]|(?:leitura|texto|vers[íi]culo)\s+(?:b[íi]blico|chave|base)\s*[:\-–—])/i.test(trimmed)) {
    return true;
  }
  const hasRef = BIBLE_REF_PATTERN.test(trimmed);
  if (!hasRef) return false;
  const hasQuotes = /[«»"“”]/.test(trimmed);
  const startsWithRef = new RegExp(`^\\s*\\(?${BIBLE_REF_PATTERN.source}\\)?\\s*[:\\-–—]`, 'i').test(trimmed);
  return hasQuotes || startsWithRef;
}

interface QuickSectionItem {
  id: string;
  label: string;
  emphasis?: boolean;
}

export function PulpitMode({ sermon, onClose }: PulpitModeProps) {
  // Referências de DOM e rolagem
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const floatScrollYRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const hideBarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barInteractingRef = useRef<boolean>(false);
  const wakeLockSentinelRef = useRef<any>(null);
  const wakeLockWarnedRef = useRef<boolean>(false);
  const draggingGuideRef = useRef<boolean>(false);

  // Wake Lock
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [showWakeLockNotice, setShowWakeLockNotice] = useState<boolean>(false);

  // Tela cheia
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));

  // Tema (claro/escuro) com memória
  const [theme, setTheme] = useState<PulpitTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  // Tamanho da fonte (7 tamanhos) e família com memória
  const [fontSizeIndex, setFontSizeIndex] = useState<number>(() => {
    try {
      const raw = Number(localStorage.getItem(STORAGE_FONT_INDEX_KEY));
      if (!Number.isNaN(raw) && raw >= 0 && raw < FONT_SIZES.length) return raw;
    } catch {}
    return 3; // 26px padrão
  });

  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FONT_FAMILY_KEY);
      if (saved === 'sans' || saved === 'serif') return saved;
    } catch {}
    return 'sans';
  });

  // Barra discreta com auto-ocultação
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [showQuickIndex, setShowQuickIndex] = useState<boolean>(false);
  const [showTimerAdjust, setShowTimerAdjust] = useState<boolean>(false);
  const [pausedTapHint, setPausedTapHint] = useState<boolean>(false);

  // Rolagem automática suave
  const [autoScrollRunning, setAutoScrollRunning] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<ScrollSpeed>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCROLL_SPEED_KEY);
      if (saved === 'slow' || saved === 'medium' || saved === 'fast') return saved;
    } catch {}
    return 'slow';
  });

  // Marcador de posição (linha discreta horizontal)
  const [guideEnabled, setGuideEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GUIDE_ENABLED_KEY);
      if (saved === 'false') return false;
    } catch {}
    return true;
  });
  const [guideYPercent, setGuideYPercent] = useState<number>(() => {
    try {
      const raw = Number(localStorage.getItem(STORAGE_GUIDE_Y_KEY));
      if (!Number.isNaN(raw) && raw >= 18 && raw <= 75) return raw;
    } catch {}
    return 34;
  });

  // Cronômetro (tempo decorrido + tempo restante)
  const [targetMinutes, setTargetMinutes] = useState<number>(() => resolveInitialDurationMinutes(sermon));
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Hinos (somente leitura)
  const [showHymns, setShowHymns] = useState<boolean>(false);
  const hydratedHymns = useMemo(() => hydrateHymnsIfLegacy(sermon.hymns), [sermon.hymns]);
  const [activePulpitHinario, setActivePulpitHinario] = useState<'CC' | 'HCC'>(
    hydratedHymns.preferredHinario === 'HCC' ? 'HCC' : 'CC'
  );
  const [expandedOccasion, setExpandedOccasion] = useState<string | null>(null);
  const [copiedHymn, setCopiedHymn] = useState<string | null>(null);

  const fontSize = FONT_SIZES[fontSizeIndex] ?? 26;

  // Persistência das preferências visuais
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT_INDEX_KEY, String(fontSizeIndex));
    } catch {}
  }, [fontSizeIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FONT_FAMILY_KEY, fontFamily);
    } catch {}
  }, [fontFamily]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GUIDE_ENABLED_KEY, String(guideEnabled));
    } catch {}
  }, [guideEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GUIDE_Y_KEY, String(Math.round(guideYPercent)));
    } catch {}
  }, [guideYPercent]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCROLL_SPEED_KEY, scrollSpeed);
    } catch {}
  }, [scrollSpeed]);

  // Reinicia tempo padrão se outro sermão for aberto
  useEffect(() => {
    setTargetMinutes(resolveInitialDurationMinutes(sermon));
    setSecondsElapsed(0);
    setTimerRunning(false);
    setAutoScrollRunning(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      floatScrollYRef.current = 0;
    }
  }, [sermon.id, sermon.duration, sermon.derivation?.duration]);

  // Auto-ocultação da barra de controles após 4,5s sem uso
  const scheduleHideBar = useCallback(() => {
    if (hideBarTimeoutRef.current) {
      clearTimeout(hideBarTimeoutRef.current);
      hideBarTimeoutRef.current = null;
    }
    if (showQuickIndex || showTimerAdjust || barInteractingRef.current) return;
    hideBarTimeoutRef.current = setTimeout(() => {
      if (!showQuickIndex && !showTimerAdjust && !barInteractingRef.current) {
        setControlsVisible(false);
      }
    }, 4500);
  }, [showQuickIndex, showTimerAdjust]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideBar();
  }, [scheduleHideBar]);

  useEffect(() => {
    if (controlsVisible) {
      scheduleHideBar();
    }
    return () => {
      if (hideBarTimeoutRef.current) {
        clearTimeout(hideBarTimeoutRef.current);
      }
    };
  }, [controlsVisible, scheduleHideBar]);

  // Cronômetro (1 segundo)
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Screen Wake Lock (impede a tela de apagar; se não permitir, mostra aviso discreto uma vez)
  const triggerWakeLockWarningOnce = useCallback(() => {
    if (wakeLockWarnedRef.current) return;
    wakeLockWarnedRef.current = true;
    setShowWakeLockNotice(true);
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      setWakeLockActive(false);
      triggerWakeLockWarningOnce();
      return;
    }
    try {
      const sentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinelRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
      triggerWakeLockWarningOnce();
    }
  }, [triggerWakeLockWarningOnce]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
    }
    setWakeLockActive(false);
  }, []);

  const handleExitPulpit = useCallback(() => {
    setAutoScrollRunning(false);
    void releaseWakeLock();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose, releaseWakeLock]);

  useEffect(() => {
    void requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQuickIndex) {
          setShowQuickIndex(false);
        } else if (showTimerAdjust) {
          setShowTimerAdjust(false);
        } else {
          handleExitPulpit();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      void releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock, showQuickIndex, showTimerAdjust, handleExitPulpit]);

  // Rolagem automática contínua e suave via requestAnimationFrame
  useEffect(() => {
    if (!autoScrollRunning) {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      lastFrameTimeRef.current = null;
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    floatScrollYRef.current = container.scrollTop;
    lastFrameTimeRef.current = null;

    const step = (timestamp: number) => {
      const el = scrollContainerRef.current;
      if (!el) return;

      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
        autoScrollRafRef.current = requestAnimationFrame(step);
        return;
      }

      const deltaMs = Math.min(64, Math.max(0, timestamp - lastFrameTimeRef.current));
      lastFrameTimeRef.current = timestamp;

      // Se o usuário rolou manualmente, acompanha sem salto
      if (Math.abs(el.scrollTop - floatScrollYRef.current) > 4) {
        floatScrollYRef.current = el.scrollTop;
      }

      const speed = SCROLL_SPEED_PX_PER_SEC[scrollSpeed];
      floatScrollYRef.current += (speed * deltaMs) / 1000;
      el.scrollTop = floatScrollYRef.current;

      const maxScroll = el.scrollHeight - el.clientHeight;
      if (floatScrollYRef.current >= maxScroll - 1) {
        setAutoScrollRunning(false);
        return;
      }

      autoScrollRafRef.current = requestAnimationFrame(step);
    };

    autoScrollRafRef.current = requestAnimationFrame(step);

    return () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      lastFrameTimeRef.current = null;
    };
  }, [autoScrollRunning, scrollSpeed]);

  // Tocar na área de leitura: pausa a rolagem se ativa; alterna barra discreta
  const handleReadingSurfaceTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [data-pulpit-interactive="true"]')) {
      return;
    }

    if (showQuickIndex || showTimerAdjust) {
      setShowQuickIndex(false);
      setShowTimerAdjust(false);
      scheduleHideBar();
      return;
    }

    if (autoScrollRunning) {
      setAutoScrollRunning(false);
      setPausedTapHint(true);
      setTimeout(() => setPausedTapHint(false), 1800);
      revealControls();
      return;
    }

    if (controlsVisible) {
      setControlsVisible(false);
    } else {
      revealControls();
    }
  };

  // Arrastar marcador de posição verticalmente
  useEffect(() => {
    const updateFromClientY = (clientY: number) => {
      if (!draggingGuideRef.current) return;
      const vh = window.innerHeight || 800;
      const pct = Math.min(75, Math.max(18, (clientY / vh) * 100));
      setGuideYPercent(pct);
    };

    const handleMouseMove = (e: MouseEvent) => updateFromClientY(e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (draggingGuideRef.current && e.touches[0]) {
        updateFromClientY(e.touches[0].clientY);
      }
    };
    const handleEnd = () => {
      draggingGuideRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const toggleFullscreen = () => {
    revealControls();
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  // Cálculos do cronômetro
  const totalTargetSeconds = Math.max(60, targetMinutes * 60);
  const rawRemaining = totalTargetSeconds - secondsElapsed;
  const isOvertime = rawRemaining < 0;
  const remainingSeconds = Math.max(0, rawRemaining);
  const overtimeSeconds = isOvertime ? Math.abs(rawRemaining) : 0;
  const isWarningFiveMin = !isOvertime && remainingSeconds <= 300;

  // Paletas Claro e Escuro
  const isDark = theme === 'dark';
  const palette = isDark
    ? {
        rootBg: 'bg-[#0A0B0D]',
        text: 'text-[#F4EFE6]',
        textMuted: 'text-[#A29C90]',
        barSurface: 'bg-[#13151A]/95 border-b border-[#272B35] text-[#F4EFE6]',
        barButton: 'bg-[#1D2028] hover:bg-[#282C37] border border-[#2F3441] text-[#EFECE4]',
        barButtonActive: 'bg-[#D9B45C] text-[#111215] border border-[#D9B45C] font-bold',
        popoverSurface: 'bg-[#161920] border border-[#2E3442] text-[#F4EFE6]',
        sectionBorder: 'border-[#252831]',
        sectionHeading: 'text-[#E5BE66]',
        sectionEyebrow: 'text-[#A89F8D]',
        verseBlock: 'bg-[#151820] border border-[#2E3545] text-[#FBF7EE]',
        verseLabel: 'text-[#E5BE66]',
        cardSurface: 'bg-[#13161C] border border-[#262A34] text-[#EAE4D7]',
        bridgeSurface: 'bg-[#1A1711] border border-[#3E3422] text-[#F2EBDC]',
        illustrationSurface: 'bg-[#1B160E] border border-[#45371E] text-[#FAF1DF]',
        illustrationLabel: 'text-[#E5BE66]',
        applicationSurface: 'bg-[#101C16] border border-[#234333] text-[#E6F4EC]',
        applicationLabel: 'text-emerald-300',
        appealSurface: 'bg-[#18140E] border border-[#5B4926] text-[#FBF6EA]',
        guideLine: 'border-[#E5BE66]/35',
        guideHandle: 'bg-[#E5BE66]/90 text-[#111215]',
        timerNormal: 'bg-[#1B1E26] border-[#2E3340] text-[#F4EFE6]',
        timerRunning: 'bg-emerald-950/50 border-emerald-700/50 text-emerald-200',
        timerWarning: 'bg-amber-950/60 border-amber-500/60 text-amber-200',
        timerOvertime: 'bg-rose-950/60 border-rose-500/60 text-rose-200'
      }
    : {
        rootBg: 'bg-[#FAF7F2]',
        text: 'text-[#1C1917]',
        textMuted: 'text-[#57534E]',
        barSurface: 'bg-[#F5F1EA]/95 border-b border-[#DCD5C8] text-[#1C1917]',
        barButton: 'bg-white hover:bg-[#EFEAE0] border border-[#D6CFC2] text-[#292524]',
        barButtonActive: 'bg-[#4D4D36] text-white border border-[#4D4D36] font-bold',
        popoverSurface: 'bg-white border border-[#D6CFC2] text-[#1C1917]',
        sectionBorder: 'border-[#E3DDD2]',
        sectionHeading: 'text-[#4A4A35]',
        sectionEyebrow: 'text-[#6B655D]',
        verseBlock: 'bg-[#EFEAE0] border border-[#D5CCBC] text-[#1C1917]',
        verseLabel: 'text-[#5A5A40]',
        cardSurface: 'bg-[#F2EFE8] border border-[#DFD8CA] text-[#292524]',
        bridgeSurface: 'bg-[#F5F0E6] border border-[#DDD2BE] text-[#2D261D]',
        illustrationSurface: 'bg-[#F7F1E3] border border-[#E2D2AF] text-[#2B200E]',
        illustrationLabel: 'text-[#8A611C]',
        applicationSurface: 'bg-[#ECF4EF] border border-[#C1DACA] text-[#162C20]',
        applicationLabel: 'text-emerald-800',
        appealSurface: 'bg-[#F3ECE0] border border-[#CBB994] text-[#241C11]',
        guideLine: 'border-[#5A5A40]/35',
        guideHandle: 'bg-[#5A5A40]/90 text-white',
        timerNormal: 'bg-white border-[#D6CFC2] text-[#1C1917]',
        timerRunning: 'bg-emerald-50 border-emerald-300 text-emerald-900',
        timerWarning: 'bg-amber-100/90 border-amber-400 text-amber-950',
        timerOvertime: 'bg-rose-100/90 border-rose-400 text-rose-950'
      };

  const timerColorClass = isOvertime
    ? palette.timerOvertime
    : isWarningFiveMin
    ? palette.timerWarning
    : timerRunning
    ? palette.timerRunning
    : palette.timerNormal;

  // Lista de seções para o Índice Rápido
  const quickSections = useMemo<QuickSectionItem[]>(() => {
    const items: QuickSectionItem[] = [{ id: 'pulpit-title', label: 'Título e Texto-Base' }];
    if (sermon.introduction && sermon.introduction.trim()) {
      items.push({ id: 'pulpit-intro', label: 'Introdução' });
    }
    if (sermon.biblicalContext && sermon.biblicalContext.trim()) {
      items.push({ id: 'pulpit-context', label: 'Contexto Bíblico' });
    }
    sermon.expositoryPoints.forEach((pt, idx) => {
      items.push({
        id: `pulpit-point-${idx}`,
        label: formatRomanPointTitle(pt.title, idx),
        emphasis: true
      });
    });
    if (sermon.applications && sermon.applications.length > 0) {
      items.push({ id: 'pulpit-applications', label: 'Aplicações Práticas' });
    }
    if (sermon.conclusion && sermon.conclusion.trim()) {
      items.push({ id: 'pulpit-conclusion', label: 'Conclusão' });
    }
    if (sermon.pastoralAppeal && sermon.pastoralAppeal.trim()) {
      items.push({ id: 'pulpit-appeal', label: 'Apelo Pastoral' });
    }
    if (sermon.hymns) {
      items.push({ id: 'pulpit-hymns', label: 'Hinos Sugeridos' });
    }
    return items;
  }, [sermon]);

  const scrollToSection = (id: string) => {
    const container = scrollContainerRef.current;
    const el = document.getElementById(id);
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 72;
      const clampedTop = Math.max(0, nextTop);
      container.scrollTo({ top: clampedTop, behavior: 'smooth' });
      floatScrollYRef.current = clampedTop;
    } else if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setShowQuickIndex(false);
    revealControls();
  };

  // Renderizador de parágrafos que destaca automaticamente citações bíblicas
  const renderRichParagraphs = (rawText: string, keyPrefix: string) => {
    const paragraphs = splitFluentParagraphs(sanitizePulpitPortuguese(rawText));
    return paragraphs.map((para, idx) => {
      if (isBiblicalQuoteParagraph(para)) {
        return (
          <blockquote
            key={`${keyPrefix}-verse-${idx}`}
            className={`my-4 px-5 py-4 rounded-2xl ${palette.verseBlock} shadow-2xs`}
          >
            <div className="flex items-center gap-2 mb-1.5 font-sans">
              <BookOpen className={`w-4 h-4 shrink-0 ${palette.verseLabel}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${palette.verseLabel}`}>
                Texto Bíblico
              </span>
            </div>
            <p className="font-serif italic leading-[1.7] whitespace-pre-line">
              {para}
            </p>
          </blockquote>
        );
      }
      return (
        <p key={`${keyPrefix}-p-${idx}`} className="whitespace-pre-line">
          {para}
        </p>
      );
    });
  };

  const adjustDuration = (deltaMinutes: number) => {
    setTargetMinutes((prev) => Math.min(120, Math.max(5, prev + deltaMinutes)));
    revealControls();
  };

  const introParagraphs = useMemo(
    () => (sermon.introduction ? sermon.introduction.trim() : ''),
    [sermon.introduction]
  );

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col ${palette.rootBg} ${palette.text} select-none overflow-hidden transition-colors duration-200`}
      role="dialog"
      aria-modal="true"
      aria-label="Modo Púlpito"
    >
      {/* 1. BARRA DISCRETA DE CONTROLES (auto-oculta após alguns segundos, volta ao toque) */}
      <header
        data-pulpit-interactive="true"
        onMouseEnter={() => {
          barInteractingRef.current = true;
          if (hideBarTimeoutRef.current) clearTimeout(hideBarTimeoutRef.current);
        }}
        onMouseLeave={() => {
          barInteractingRef.current = false;
          scheduleHideBar();
        }}
        onTouchStart={() => {
          barInteractingRef.current = true;
          if (hideBarTimeoutRef.current) clearTimeout(hideBarTimeoutRef.current);
        }}
        onTouchEnd={() => {
          barInteractingRef.current = false;
          scheduleHideBar();
        }}
        className={`fixed top-0 left-0 right-0 z-50 ${palette.barSurface} backdrop-blur-md shadow-sm transition-all duration-200 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 px-3 sm:px-5 ${
          controlsVisible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Bloco Esquerdo: Cronômetro (Falta + Decorrido + Iniciar/Pausar/Zerar + Ajustar) */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-colors ${timerColorClass}`}
            >
              <button
                type="button"
                onClick={() => {
                  setTimerRunning((prev) => !prev);
                  revealControls();
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-black/10 active:scale-95 transition cursor-pointer"
                title={timerRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
                aria-label={timerRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
              >
                {timerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTimerAdjust((prev) => !prev);
                  setShowQuickIndex(false);
                }}
                className="min-h-[40px] px-2 flex flex-col items-start justify-center text-left rounded-lg hover:bg-black/5 cursor-pointer"
                title="Ajustar duração do cronômetro"
              >
                <span className="font-mono tabular-nums text-sm sm:text-base font-bold leading-tight whitespace-nowrap">
                  {isOvertime
                    ? `Excedido +${formatTimer(overtimeSeconds)}`
                    : `Falta ${formatTimer(remainingSeconds)}`}
                </span>
                <span className="font-mono tabular-nums text-[11px] opacity-80 leading-tight whitespace-nowrap">
                  Decorrido {formatTimer(secondsElapsed)} · Meta {targetMinutes}m
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSecondsElapsed(0);
                  setTimerRunning(false);
                  revealControls();
                }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-black/10 active:scale-95 transition cursor-pointer"
                title="Zerar cronômetro"
                aria-label="Zerar cronômetro"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bloco Direito: Fonte, Tema, Rolagem, Marcador, Índice, Tela Cheia e Sair */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            {/* Tamanho da letra (7 tamanhos: A− / A+) */}
            <div className={`flex items-center rounded-xl border ${palette.barButton} p-0.5`}>
              <button
                type="button"
                onClick={() => {
                  setFontSizeIndex((prev) => Math.max(0, prev - 1));
                  revealControls();
                }}
                disabled={fontSizeIndex <= 0}
                className="min-h-[40px] min-w-[42px] px-2 flex items-center justify-center rounded-lg text-sm font-bold disabled:opacity-30 hover:bg-black/5 cursor-pointer"
                title="Diminuir letra"
                aria-label="Diminuir letra"
              >
                A−
              </button>
              <span className="text-xs font-mono tabular-nums px-1.5 opacity-80 whitespace-nowrap">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => {
                  setFontSizeIndex((prev) => Math.min(FONT_SIZES.length - 1, prev + 1));
                  revealControls();
                }}
                disabled={fontSizeIndex >= FONT_SIZES.length - 1}
                className="min-h-[40px] min-w-[42px] px-2 flex items-center justify-center rounded-lg text-sm font-bold disabled:opacity-30 hover:bg-black/5 cursor-pointer"
                title="Aumentar letra"
                aria-label="Aumentar letra"
              >
                A+
              </button>
            </div>

            {/* Fonte Sans / Serifa */}
            <button
              type="button"
              onClick={() => {
                setFontFamily((prev) => (prev === 'sans' ? 'serif' : 'sans'));
                revealControls();
              }}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${palette.barButton}`}
              title="Alternar estilo da fonte"
            >
              <span>{fontFamily === 'sans' ? 'Sans' : 'Serifa'}</span>
            </button>

            {/* Tema Claro / Escuro */}
            <button
              type="button"
              onClick={() => {
                setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
                revealControls();
              }}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${palette.barButton}`}
              title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Claro' : 'Escuro'}</span>
            </button>

            {/* Rolagem automática + Velocidade */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setAutoScrollRunning((prev) => !prev);
                  revealControls();
                }}
                className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                  autoScrollRunning ? palette.barButtonActive : palette.barButton
                }`}
                title={autoScrollRunning ? 'Pausar rolagem automática' : 'Iniciar rolagem automática'}
              >
                {autoScrollRunning ? <Pause className="w-4 h-4" /> : <ChevronsDown className="w-4 h-4" />}
                <span>{autoScrollRunning ? 'Pausar rolagem' : 'Rolar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const order: ScrollSpeed[] = ['slow', 'medium', 'fast'];
                  const next = order[(order.indexOf(scrollSpeed) + 1) % order.length];
                  setScrollSpeed(next);
                  revealControls();
                }}
                className={`min-h-[44px] px-2.5 rounded-xl text-xs font-semibold cursor-pointer transition whitespace-nowrap ${palette.barButton}`}
                title="Alterar velocidade da rolagem automática"
              >
                {SCROLL_SPEED_LABELS[scrollSpeed]}
              </button>
            </div>

            {/* Marcador de posição */}
            <button
              type="button"
              onClick={() => {
                setGuideEnabled((prev) => !prev);
                revealControls();
              }}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                guideEnabled ? palette.barButtonActive : palette.barButton
              }`}
              title="Mostrar ou ocultar linha marcadora de posição"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden md:inline">Marcador</span>
            </button>

            {/* Índice rápido */}
            <button
              type="button"
              onClick={() => {
                setShowQuickIndex((prev) => !prev);
                setShowTimerAdjust(false);
                setControlsVisible(true);
              }}
              className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                showQuickIndex ? palette.barButtonActive : palette.barButton
              }`}
              title="Abrir índice das partes do sermão"
            >
              <ListOrdered className="w-4 h-4" />
              <span>Índice</span>
            </button>

            {/* Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl cursor-pointer transition ${palette.barButton}`}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Sair */}
            <button
              type="button"
              onClick={handleExitPulpit}
              className="min-h-[44px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap shadow-xs"
              title="Sair do Modo Púlpito"
            >
              <X className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* INDICADOR ULTRA-DISCRETO QUANDO A BARRA ESTÁ OCULTA */}
      {!controlsVisible && (
        <button
          type="button"
          data-pulpit-interactive="true"
          onClick={revealControls}
          className={`fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 sm:right-5 z-40 min-h-[40px] px-3 py-1.5 rounded-full border backdrop-blur-sm text-xs font-mono tabular-nums font-bold shadow-sm transition-opacity cursor-pointer opacity-80 hover:opacity-100 ${
            timerRunning || isWarningFiveMin || isOvertime ? timerColorClass : palette.barButton
          }`}
          title="Toque para mostrar os controles"
        >
          {timerRunning || isWarningFiveMin || isOvertime
            ? isOvertime
              ? `+${formatTimer(overtimeSeconds)}`
              : formatTimer(remainingSeconds)
            : 'Controles'}
        </button>
      )}

      {/* FEEDBACK BREVE AO PAUSAR ROLAGEM POR TOQUE */}
      {pausedTapHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/80 text-white text-xs font-sans font-semibold shadow-lg pointer-events-none">
          Rolagem pausada
        </div>
      )}

      {/* AVISO ÚNICO E DISCRETO SE WAKE LOCK NÃO FOR PERMITIDO */}
      {showWakeLockNotice && (
        <div
          data-pulpit-interactive="true"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 px-4 py-3 rounded-2xl border shadow-lg text-xs font-sans flex items-start justify-between gap-3 ${palette.popoverSurface}`}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <p className="leading-relaxed">
              Este aparelho não permitiu manter a tela ligada automaticamente. Se precisar, ajuste o tempo de bloqueio de tela nas configurações do aparelho.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWakeLockNotice(false)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg font-bold underline shrink-0 cursor-pointer"
          >
            Entendi
          </button>
        </div>
      )}

      {/* PAINEL DE AJUSTE DO CRONÔMETRO */}
      {showTimerAdjust && (
        <div
          data-pulpit-interactive="true"
          className={`fixed top-20 left-3 right-3 sm:left-6 sm:right-auto sm:w-80 z-50 rounded-2xl border shadow-2xl p-4 space-y-3 font-sans ${palette.popoverSurface}`}
        >
          <div className="flex items-center justify-between border-b border-current/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Timer className="w-4 h-4" />
              Ajustar duração da pregação
            </span>
            <button
              type="button"
              onClick={() => {
                setShowTimerAdjust(false);
                scheduleHideBar();
              }}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-black/10 cursor-pointer"
              aria-label="Fechar ajuste de tempo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => adjustDuration(-5)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold cursor-pointer ${palette.barButton}`}
            >
              −5 min
            </button>
            <button
              type="button"
              onClick={() => adjustDuration(-1)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs font-bold cursor-pointer ${palette.barButton}`}
              aria-label="Diminuir 1 minuto"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono tabular-nums text-base font-bold px-2">
              {targetMinutes} min
            </span>
            <button
              type="button"
              onClick={() => adjustDuration(1)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs font-bold cursor-pointer ${palette.barButton}`}
              aria-label="Aumentar 1 minuto"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustDuration(5)}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold cursor-pointer ${palette.barButton}`}
            >
              +5 min
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[10, 20, 30, 40, 50, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTargetMinutes(mins);
                  setSecondsElapsed(0);
                  revealControls();
                }}
                className={`min-h-[42px] rounded-xl text-xs font-mono font-bold cursor-pointer transition ${
                  targetMinutes === mins ? palette.barButtonActive : palette.barButton
                }`}
              >
                {mins} min
              </button>
            ))}
          </div>

          <div className="text-[11px] opacity-75 leading-snug pt-1">
            Quando faltarem 5 minutos, o cronômetro muda de cor de forma discreta, sem som.
          </div>
        </div>
      )}

      {/* ÍNDICE RÁPIDO DAS PARTES DO SERMÃO */}
      {showQuickIndex && (
        <div
          data-pulpit-interactive="true"
          className={`fixed top-20 left-3 right-3 sm:left-auto sm:right-6 sm:w-88 z-50 rounded-2xl border shadow-2xl p-4 space-y-2 font-sans ${palette.popoverSurface}`}
        >
          <div className="flex items-center justify-between border-b border-current/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ListOrdered className="w-4 h-4" />
              Índice rápido
            </span>
            <button
              type="button"
              onClick={() => {
                setShowQuickIndex(false);
                scheduleHideBar();
              }}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-black/10 cursor-pointer"
              aria-label="Fechar índice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
            {quickSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => scrollToSection(sec.id)}
                className={`w-full min-h-[44px] text-left px-3 py-2 rounded-xl text-sm transition cursor-pointer hover:bg-black/10 ${
                  sec.emphasis ? `font-bold ${palette.sectionHeading}` : 'font-medium'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MARCADOR DE POSIÇÃO (LINHA DISCRETA AJUSTÁVEL) */}
      {guideEnabled && (
        <div
          aria-hidden="true"
          className="fixed left-0 right-0 z-30 pointer-events-none"
          style={{ top: `${guideYPercent}%` }}
        >
          <div className={`w-full border-t border-dashed ${palette.guideLine}`} />
          <button
            type="button"
            data-pulpit-interactive="true"
            onMouseDown={(e) => {
              e.stopPropagation();
              draggingGuideRef.current = true;
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              draggingGuideRef.current = true;
            }}
            className={`pointer-events-auto absolute left-2 sm:left-4 -translate-y-1/2 min-h-[32px] min-w-[32px] px-2 rounded-full text-[11px] font-sans font-bold shadow-xs flex items-center justify-center cursor-ns-resize opacity-85 hover:opacity-100 ${palette.guideHandle}`}
            title="Arraste para cima ou para baixo para posicionar o marcador de leitura"
            aria-label="Mover marcador de posição"
          >
            ▸
          </button>
        </div>
      )}

      {/* ÁREA PRINCIPAL DE LEITURA (SOMENTE LEITURA, LARGURA CONFORTÁVEL) */}
      <main
        ref={scrollContainerRef}
        onClick={handleReadingSurfaceTap}
        className="flex-1 overflow-y-auto px-6 sm:px-10 md:px-14 pt-24 pb-44 flex justify-center"
      >
        <article
          className="w-full max-w-[68ch] space-y-12"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.78,
            fontFamily:
              fontFamily === 'serif'
                ? 'Georgia, Cambria, "Times New Roman", Times, serif'
                : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {/* Cabeçalho do Sermão + Bloco do Texto Bíblico Base */}
          <header id="pulpit-title" className={`space-y-5 pb-8 border-b ${palette.sectionBorder}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans font-semibold opacity-80">
              {sermon.bibleVersion && <span>Versão {sermon.bibleVersion}</span>}
              {sermon.seriesName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Série: {sermon.seriesName}</span>
                </>
              )}
              {(() => {
                const badge = getCardDerivationBadge(sermon);
                if (!badge) return null;
                return (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{badge.label}</span>
                  </>
                );
              })()}
            </div>

            <h1
              className={`font-serif font-extrabold tracking-tight ${palette.sectionHeading}`}
              style={{ fontSize: `${Math.round(fontSize * 1.45)}px`, lineHeight: 1.25 }}
            >
              {sanitizePulpitPortuguese(sermon.title)}
            </h1>

            {sermon.theme && (
              <p
                className={`italic leading-relaxed ${palette.textMuted}`}
                style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}
              >
                {sanitizePulpitPortuguese(sermon.theme)}
              </p>
            )}

            {sermon.scripture && (
              <div className={`p-5 rounded-2xl ${palette.verseBlock}`}>
                <div className="flex items-center gap-2 mb-1.5 font-sans">
                  <BookOpen className={`w-4 h-4 shrink-0 ${palette.verseLabel}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${palette.verseLabel}`}>
                    Texto Bíblico Base {sermon.bibleVersion ? `(${sermon.bibleVersion})` : ''}
                  </span>
                </div>
                <p className="font-serif font-semibold leading-relaxed whitespace-pre-line">
                  {sanitizePulpitPortuguese(sermon.scripture)}
                </p>
              </div>
            )}
          </header>

          {/* Introdução */}
          {introParagraphs && (
            <section id="pulpit-intro" className="space-y-4">
              <div className={`pb-2 border-b ${palette.sectionBorder}`}>
                <h2
                  className={`font-sans font-extrabold uppercase tracking-wider ${palette.sectionHeading}`}
                  style={{ fontSize: `${Math.max(15, Math.round(fontSize * 0.68))}px` }}
                >
                  Introdução
                </h2>
              </div>
              <div className="space-y-4">
                {renderRichParagraphs(introParagraphs, 'intro')}
              </div>
            </section>
          )}

          {/* Contexto Bíblico */}
          {sermon.biblicalContext && sermon.biblicalContext.trim() && (
            <section id="pulpit-context" className={`p-6 rounded-2xl ${palette.cardSurface} space-y-3`}>
              <h2
                className={`font-sans font-extrabold uppercase tracking-wider flex items-center gap-2 ${palette.sectionHeading}`}
                style={{ fontSize: `${Math.max(15, Math.round(fontSize * 0.65))}px` }}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                Contexto Bíblico
              </h2>
              <div className="space-y-3 text-[0.92em]">
                {renderRichParagraphs(sermon.biblicalContext, 'context')}
              </div>
            </section>
          )}

          {/* Pontos Expositivos / Seções da Mensagem */}
          {sermon.expositoryPoints.length > 0 && (
            <div className="space-y-14">
              {sermon.expositoryPoints.map((point, index) => {
                const { romanTitle, explanationParagraphs, applicationParagraphs } =
                  structureExpositoryPoint(point, index);

                return (
                  <section
                    key={index}
                    id={`pulpit-point-${index}`}
                    className={`space-y-5 pt-6 border-t ${palette.sectionBorder}`}
                  >
                    {point.precedingTransition && (
                      <div className={`p-4 rounded-xl ${palette.bridgeSurface} text-[0.88em] italic`}>
                        <span className={`font-sans text-xs font-bold uppercase tracking-wider block mb-1 not-italic ${palette.sectionHeading}`}>
                          Transição
                        </span>
                        <p>{sanitizePulpitPortuguese(point.precedingTransition)}</p>
                      </div>
                    )}

                    <h2
                      className={`font-serif font-extrabold ${palette.sectionHeading}`}
                      style={{ fontSize: `${Math.round(fontSize * 1.18)}px`, lineHeight: 1.32 }}
                    >
                      {romanTitle}
                    </h2>

                    <div className="space-y-4">
                      {explanationParagraphs.map((para, pIdx) =>
                        isBiblicalQuoteParagraph(para) ? (
                          <blockquote
                            key={`pt-${index}-v-${pIdx}`}
                            className={`my-4 px-5 py-4 rounded-2xl ${palette.verseBlock}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5 font-sans">
                              <BookOpen className={`w-4 h-4 shrink-0 ${palette.verseLabel}`} />
                              <span className={`text-xs font-bold uppercase tracking-wider ${palette.verseLabel}`}>
                                Texto Bíblico
                              </span>
                            </div>
                            <p className="font-serif italic leading-[1.7] whitespace-pre-line">{para}</p>
                          </blockquote>
                        ) : (
                          <p key={`pt-${index}-p-${pIdx}`} className="whitespace-pre-line">
                            {para}
                          </p>
                        )
                      )}
                    </div>

                    {point.illustration && point.illustration.description && (
                      <div className={`p-5 rounded-2xl ${palette.illustrationSurface} space-y-2`}>
                        <div className="flex items-center gap-2 font-sans">
                          <Sparkles className={`w-4 h-4 shrink-0 ${palette.illustrationLabel}`} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${palette.illustrationLabel}`}>
                            Ilustração ({point.illustration.type})
                          </span>
                        </div>
                        <p className="text-[0.92em] whitespace-pre-line">
                          {sanitizePulpitPortuguese(point.illustration.description)}
                        </p>
                      </div>
                    )}

                    {applicationParagraphs.length > 0 && (
                      <div className={`p-5 rounded-2xl ${palette.applicationSurface} space-y-2.5`}>
                        <div className="flex items-center gap-2 font-sans">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${palette.applicationLabel}`} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${palette.applicationLabel}`}>
                            Aplicação
                          </span>
                        </div>
                        <div className="space-y-2.5 text-[0.92em]">
                          {applicationParagraphs.map((appPara, aIdx) => (
                            <p key={`pt-${index}-app-${aIdx}`} className="whitespace-pre-line">
                              {appPara}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* Aplicações Gerais (quando presentes) */}
          {sermon.applications && sermon.applications.length > 0 && (
            <section id="pulpit-applications" className={`p-6 rounded-2xl ${palette.applicationSurface} space-y-3`}>
              <h2
                className={`font-sans font-extrabold uppercase tracking-wider flex items-center gap-2 ${palette.applicationLabel}`}
                style={{ fontSize: `${Math.max(15, Math.round(fontSize * 0.68))}px` }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Aplicações Práticas
              </h2>
              <ul className="space-y-3 list-disc pl-6">
                {sermon.applications.map((item, idx) => (
                  <li key={idx} className="whitespace-pre-line">
                    {sanitizePulpitPortuguese(item)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Conclusão */}
          {sermon.conclusion && sermon.conclusion.trim() && (
            <section id="pulpit-conclusion" className={`space-y-4 pt-6 border-t ${palette.sectionBorder}`}>
              <div className={`pb-2 border-b ${palette.sectionBorder}`}>
                <h2
                  className={`font-sans font-extrabold uppercase tracking-wider ${palette.sectionHeading}`}
                  style={{ fontSize: `${Math.max(15, Math.round(fontSize * 0.68))}px` }}
                >
                  Conclusão
                </h2>
              </div>
              <div className="space-y-4">
                {renderRichParagraphs(sermon.conclusion, 'conclusion')}
              </div>
            </section>
          )}

          {/* Apelo Pastoral */}
          {sermon.pastoralAppeal && sermon.pastoralAppeal.trim() && (
            <section id="pulpit-appeal" className={`p-6 rounded-2xl ${palette.appealSurface} space-y-3`}>
              <div className="flex items-center gap-2 font-sans">
                <Flame className={`w-5 h-5 shrink-0 ${palette.sectionHeading}`} />
                <h2
                  className={`font-extrabold uppercase tracking-wider ${palette.sectionHeading}`}
                  style={{ fontSize: `${Math.max(15, Math.round(fontSize * 0.68))}px` }}
                >
                  Apelo Pastoral
                </h2>
              </div>
              <div className="space-y-4 font-medium">
                {renderRichParagraphs(sermon.pastoralAppeal, 'appeal')}
              </div>
            </section>
          )}

          {/* Hinos Sugeridos (somente leitura) */}
          {sermon.hymns && (
            <section
              id="pulpit-hymns"
              data-pulpit-interactive="true"
              className={`p-5 rounded-2xl ${palette.cardSurface} space-y-4 font-sans`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowHymns((prev) => !prev)}
                  className="flex items-center gap-2 text-left cursor-pointer min-h-[44px]"
                >
                  <Music className={`w-5 h-5 shrink-0 ${palette.sectionHeading}`} />
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${palette.sectionHeading}`}>
                      Hinos Recomendados para o Culto
                    </h3>
                    <p className={`text-xs ${palette.textMuted}`}>
                      Cantor Cristão e Hinário para o Culto Cristão
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <div className={`flex items-center p-1 rounded-xl border ${palette.barButton} text-xs font-bold`}>
                    <button
                      type="button"
                      onClick={() => setActivePulpitHinario('CC')}
                      className={`min-h-[36px] px-3 rounded-lg cursor-pointer ${
                        activePulpitHinario === 'CC' ? palette.barButtonActive : ''
                      }`}
                    >
                      CC
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePulpitHinario('HCC')}
                      className={`min-h-[36px] px-3 rounded-lg cursor-pointer ${
                        activePulpitHinario === 'HCC' ? palette.barButtonActive : ''
                      }`}
                    >
                      HCC
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHymns((prev) => !prev)}
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer ${palette.barButton}`}
                    aria-label={showHymns ? 'Ocultar hinos' : 'Mostrar hinos'}
                  >
                    {showHymns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {showHymns && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-current/10">
                  {(['abertura', 'antesMensagem', 'apelo', 'encerramento'] as const).map((occ) => {
                    const primary = hydratedHymns.details?.[occ];
                    const alternate = hydratedHymns.alternateDetails?.[occ];
                    const hymn: DetailedHymn | undefined =
                      (primary?.hinario === activePulpitHinario
                        ? primary
                        : alternate?.hinario === activePulpitHinario
                        ? alternate
                        : primary) || primary;

                    const occTitles = {
                      abertura: 'Abertura',
                      antesMensagem: 'Antes da Mensagem',
                      apelo: 'Apelo',
                      encerramento: 'Encerramento'
                    };

                    const isExpanded = expandedOccasion === occ;
                    const hasCopied = copiedHymn === occ;

                    return (
                      <div key={occ} className={`p-4 rounded-xl border ${palette.verseBlock} space-y-2`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`text-[11px] uppercase font-bold tracking-wider block ${palette.textMuted}`}>
                              {occTitles[occ]}
                            </span>
                            <h4 className="text-sm font-bold mt-0.5">
                              {hymn ? `${hymn.hinario} ${hymn.number} — ${hymn.title}` : 'Hino'}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {hymn && (
                              <button
                                type="button"
                                onClick={() => {
                                  const payload = `${hymn.hinario} ${hymn.number} — ${hymn.title}\n\n${hymn.fullLyrics}`;
                                  navigator.clipboard.writeText(payload);
                                  setCopiedHymn(occ);
                                  setTimeout(() => setCopiedHymn(null), 2000);
                                }}
                                className={`min-h-[36px] px-2.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer ${palette.barButton}`}
                                title="Copiar letra"
                              >
                                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedOccasion(isExpanded ? null : occ)}
                              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg cursor-pointer ${palette.barButton}`}
                              title={isExpanded ? 'Recolher letra' : 'Ver letra'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && hymn && (
                          <div className="pt-2 border-t border-current/10 space-y-2 font-serif text-sm max-h-64 overflow-y-auto">
                            {hymn.stanzas.map((stanza, idx) => (
                              <p key={idx} className="whitespace-pre-line">
                                {stanza}
                              </p>
                            ))}
                            {hymn.chorus && (
                              <p className="whitespace-pre-line italic opacity-90 pt-1">
                                Coro: {hymn.chorus}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Nota de encerramento discreta */}
          <footer className={`text-center pt-8 border-t ${palette.sectionBorder} text-xs font-sans ${palette.textMuted}`}>
            2 Timóteo 4:2 · Modo Púlpito
          </footer>
        </article>
      </main>
    </div>
  );
}
