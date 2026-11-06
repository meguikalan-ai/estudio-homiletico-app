import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Sun, 
  Moon, 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Timer, 
  Type, 
  BookOpen, 
  Sparkles, 
  Flame, 
  Music, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  Lightbulb, 
  Menu, 
  AlignLeft,
  ListOrdered
} from 'lucide-react';
import { Sermon } from '../types';

interface PulpitModeProps {
  sermon: Sermon;
  onClose: () => void;
}

export function PulpitMode({ sermon, onClose }: PulpitModeProps) {
  // Screen Wake Lock State
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [wakeLockSupported, setWakeLockSupported] = useState<boolean>(true);
  const wakeLockSentinelRef = useRef<any>(null);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Appearance & Typography
  const [fontSize, setFontSize] = useState<number>(24); // 18 to 40px
  const [lineHeight, setLineHeight] = useState<number>(1.8); // 1.5, 1.8, 2.2
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [themeMode, setThemeMode] = useState<'oled' | 'warm' | 'slate'>('oled');
  const [viewDensity, setViewDensity] = useState<'full' | 'outline'>('full');

  // Clock & Stopwatch / Countdown Timer
  const [currentTime, setCurrentTime] = useState<string>('');
  const [timerMode, setTimerMode] = useState<'stopwatch' | 'countdown'>('countdown');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(() => {
    if (sermon.duration === '20') return 20;
    if (sermon.duration === '40') return 40;
    if (sermon.duration === '60') return 60;
    return 30;
  });
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // UI state
  const [showQuickIndex, setShowQuickIndex] = useState<boolean>(false);
  const [showHymns, setShowHymns] = useState<boolean>(false);
  const [showControlsBar, setShowControlsBar] = useState<boolean>(true);

  // 1. Clock updates every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Timer / Stopwatch logic
  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  // 3. Screen Wake Lock API
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
        setWakeLockSupported(true);

        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err: any) {
        console.warn('[PulpitMode] Erro ao requisitar Wake Lock:', err);
        setWakeLockActive(false);
      }
    } else {
      setWakeLockSupported(false);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockSentinelRef.current) {
      try {
        await wakeLockSentinelRef.current.release();
        wakeLockSentinelRef.current = null;
      } catch (err) {
        console.warn('[PulpitMode] Erro ao liberar Wake Lock:', err);
      }
    }
    setWakeLockActive(false);
  };

  useEffect(() => {
    requestWakeLock();

    // Re-acquire wake lock if page visibility changes (e.g. user tab switches back)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Escape key listener to exit
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      releaseWakeLock();
    };
  }, [onClose]);

  // 4. Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.warn('[PulpitMode] Fullscreen não suportado ou bloqueado:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  // Timer calculations
  const totalTargetSeconds = targetDurationMinutes * 60;
  const remainingSeconds = Math.max(0, totalTargetSeconds - secondsElapsed);
  const isOvertime = timerMode === 'countdown' && secondsElapsed > totalTargetSeconds;
  const overtimeSeconds = secondsElapsed - totalTargetSeconds;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Background and Text Colors by Theme
  const themeStyles = {
    oled: {
      bg: 'bg-[#0A0A0A]',
      headerBg: 'bg-[#121212]/95 border-b border-[#262626]',
      text: 'text-[#F3EFE6]',
      textMuted: 'text-[#9E9789]',
      cardBg: 'bg-[#141414] border border-[#262626]',
      accentColor: 'text-[#D4AF37]',
      accentBg: 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]',
      transitionBg: 'bg-[#1C1811] border-[#4A3D22] text-[#F3EFE6]'
    },
    warm: {
      bg: 'bg-[#141210]',
      headerBg: 'bg-[#1E1B18]/95 border-b border-[#35302A]',
      text: 'text-[#FAF5E8]',
      textMuted: 'text-[#A89F91]',
      cardBg: 'bg-[#211E1A] border border-[#38332D]',
      accentColor: 'text-[#E5B566]',
      accentBg: 'bg-[#E5B566]/15 border-[#E5B566]/30 text-[#E5B566]',
      transitionBg: 'bg-[#29221B] border-[#57432E] text-[#FAF5E8]'
    },
    slate: {
      bg: 'bg-[#0F172A]',
      headerBg: 'bg-[#1E293B]/95 border-b border-[#334155]',
      text: 'text-[#F1F5F9]',
      textMuted: 'text-[#94A3B8]',
      cardBg: 'bg-[#1E293B] border border-[#334155]',
      accentColor: 'text-[#38BDF8]',
      accentBg: 'bg-[#38BDF8]/15 border-[#38BDF8]/30 text-[#38BDF8]',
      transitionBg: 'bg-[#1E293B] border-[#0284C7]/50 text-[#F1F5F9]'
    }
  }[themeMode];

  // Helper to scroll to section
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowQuickIndex(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col ${themeStyles.bg} ${themeStyles.text} select-none overflow-hidden animate-fade-in`}>
      
      {/* 1. TOP PULPIT DOCK / CONTROL BAR */}
      <header className={`sticky top-0 z-50 ${themeStyles.headerBg} backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg transition-all`}>
        
        {/* Left: Clock, Timer Controls & Wake Lock Status */}
        <div className="flex items-center gap-3">
          
          {/* Relógio em Tempo Real */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 font-mono text-sm tracking-wider">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <span className="font-bold">{currentTime}</span>
          </div>

          {/* Cronômetro / Timer */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border transition-all ${
            isOvertime 
              ? 'bg-red-950/60 border-red-500/80 text-red-300 animate-pulse' 
              : timerRunning 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-black/40 border-white/10 text-gray-200'
          }`}>
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              className="p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              title={timerRunning ? "Pausar Cronômetro" : "Iniciar Cronômetro"}
            >
              {timerRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>

            <div className="font-mono text-sm font-bold tracking-wider">
              {timerMode === 'stopwatch' ? (
                formatTimer(secondsElapsed)
              ) : isOvertime ? (
                <span>+{formatTimer(overtimeSeconds)}</span>
              ) : (
                formatTimer(remainingSeconds)
              )}
            </div>

            {/* Mode Switch & Reset */}
            <button
              onClick={() => setTimerMode(timerMode === 'countdown' ? 'stopwatch' : 'countdown')}
              className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
              title="Alternar entre contagem regressiva e progressiva"
            >
              {timerMode === 'countdown' ? `${targetDurationMinutes}m` : 'Prog'}
            </button>

            <button
              onClick={() => {
                setSecondsElapsed(0);
                setTimerRunning(false);
              }}
              className="p-1 text-gray-400 hover:text-white cursor-pointer"
              title="Zerar Cronômetro"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset buttons when timer paused */}
          {!timerRunning && timerMode === 'countdown' && (
            <div className="hidden sm:flex items-center gap-1">
              {[20, 30, 40, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setTargetDurationMinutes(m);
                    setSecondsElapsed(0);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                    targetDurationMinutes === m
                      ? 'bg-[#D4AF37] text-black font-bold'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          )}

          {/* Wake Lock Status Indicator */}
          <div 
            onClick={wakeLockActive ? releaseWakeLock : requestWakeLock}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer select-none transition-all ${
              wakeLockActive 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-xs' 
                : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title={wakeLockSupported ? "Clique para alternar o bloqueio de desligamento de tela" : "Wake Lock não suportado pelo navegador"}
          >
            <Lightbulb className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="hidden md:inline">{wakeLockActive ? 'Tela Sempre Ativa' : 'Tela Padrão'}</span>
          </div>

        </div>

        {/* Right: Typography, Theme, Navigation Index & Fullscreen/Exit */}
        <div className="flex items-center gap-2">
          
          {/* Quick Section Index Trigger */}
          <button
            onClick={() => setShowQuickIndex(!showQuickIndex)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Índice e Navegação Rápida"
          >
            <ListOrdered className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden sm:inline">Navegar Tópicos</span>
          </button>

          {/* View Density Toggle (Full vs Outline) */}
          <button
            onClick={() => setViewDensity(viewDensity === 'full' ? 'outline' : 'full')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Alternar entre Manuscrito Completo e Esboço Condensado"
          >
            <AlignLeft className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="hidden sm:inline">{viewDensity === 'full' ? 'Completo' : 'Esboço'}</span>
          </button>

          {/* Font Controls (A- / A+) */}
          <div className="flex items-center bg-black/40 rounded-xl border border-white/10 p-0.5">
            <button
              onClick={() => setFontSize((prev) => Math.max(18, prev - 2))}
              disabled={fontSize <= 18}
              className="px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Diminuir Fonte (A-)"
            >
              A-
            </button>
            <span className="text-[11px] font-mono text-gray-400 px-1">{fontSize}px</span>
            <button
              onClick={() => setFontSize((prev) => Math.min(40, prev + 2))}
              disabled={fontSize >= 40}
              className="px-2.5 py-1 text-xs font-bold text-gray-300 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Aumentar Fonte (A+)"
            >
              A+
            </button>
          </div>

          {/* Line Height & Font Family dropdown */}
          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 cursor-pointer"
              title="Alternar Tipografia (Serifada / Sem Serifa)"
            >
              {fontFamily === 'serif' ? 'Serifa' : 'Sans'}
            </button>

            <button
              onClick={() => setLineHeight(lineHeight === 1.8 ? 2.2 : lineHeight === 2.2 ? 1.5 : 1.8)}
              className="px-2 py-1 text-xs font-mono rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 cursor-pointer"
              title="Espaçamento entre Linhas"
            >
              {lineHeight}x
            </button>
          </div>

          {/* OLED / Warm / Slate Theme Switch */}
          <div className="flex items-center bg-black/40 rounded-xl border border-white/10 p-0.5">
            {(['oled', 'warm', 'slate'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setThemeMode(t)}
                className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  themeMode === t 
                    ? 'bg-[#D4AF37] text-black font-extrabold' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title={`Tema ${t.toUpperCase()}`}
              >
                {t === 'oled' ? 'OLED' : t === 'warm' ? 'Calmo' : 'Azul'}
              </button>
            ))}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? "Sair da Tela Cheia" : "Modo Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Pulpit Mode */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-red-100 rounded-xl border border-red-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs ml-1"
            title="Sair do Modo Púlpito (ESC)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>

        </div>
      </header>

      {/* 2. FLOATING QUICK SECTION NAVIGATION POPUP */}
      {showQuickIndex && (
        <div className="absolute top-16 right-4 z-50 w-80 bg-[#161616] border border-[#333] rounded-2xl shadow-2xl p-4 text-xs space-y-2 animate-fade-in">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ListOrdered className="w-4 h-4" />
              Sumário da Mensagem
            </span>
            <button onClick={() => setShowQuickIndex(false)} className="text-gray-400 hover:text-white p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 pr-1 font-sans">
            <button
              onClick={() => scrollToSection('pulpit-title')}
              className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-gray-200 transition-all font-medium"
            >
              1. Título & Perícope Bíblica
            </button>
            <button
              onClick={() => scrollToSection('pulpit-intro')}
              className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-gray-200 transition-all font-medium"
            >
              2. Introdução Homilética
            </button>
            {sermon.biblicalContext && (
              <button
                onClick={() => scrollToSection('pulpit-context')}
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-gray-200 transition-all font-medium"
              >
                3. Contexto & Pano de Fundo
              </button>
            )}
            {sermon.expositoryPoints.map((pt, idx) => (
              <button
                key={idx}
                onClick={() => scrollToSection(`pulpit-point-${idx}`)}
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-[#D4AF37] transition-all font-semibold"
              >
                Tópico {idx + 1}: {pt.title || `Ponto ${idx + 1}`}
              </button>
            ))}
            <button
              onClick={() => scrollToSection('pulpit-conclusion')}
              className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-gray-200 transition-all font-medium"
            >
              Conclusão & Apelo Pastoral
            </button>
            {sermon.hymns && (
              <button
                onClick={() => scrollToSection('pulpit-hymns')}
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-amber-300 transition-all font-medium"
              >
                Hinos Batistas Sugeridos
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. MAIN SERMON READING CONTAINER (CENTERED, GENEROUS MARGINS, HIGH CONTRAST) */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12 flex justify-center">
        <div 
          className="w-full max-w-[850px] space-y-12 pb-32"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            fontFamily: fontFamily === 'serif' ? 'Georgia, Cambria, "Times New Roman", Times, serif' : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >

          {/* Section: Sermon Header */}
          <div id="pulpit-title" className="space-y-4 border-b border-white/15 pb-8 text-center sm:text-left">
            
            {/* Metadata Tags */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-sans">
              <span className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider ${themeStyles.accentBg}`}>
                {sermon.scripture}
              </span>
              {sermon.churchProfile && (
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-gray-300 uppercase tracking-wider text-[10px]">
                  {sermon.churchProfile}
                </span>
              )}
              {sermon.bibleVersion && (
                <span className="px-2 py-1 rounded-full bg-white/10 text-gray-400 font-mono text-[10px]">
                  {sermon.bibleVersion}
                </span>
              )}
              {sermon.seriesName && (
                <span className="px-2.5 py-1 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-semibold text-[11px]">
                  Série: {sermon.seriesName}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className={`font-serif font-extrabold tracking-tight ${themeStyles.accentColor}`} style={{ fontSize: `${Math.round(fontSize * 1.5)}px`, lineHeight: 1.25 }}>
              {sermon.title}
            </h1>

            {/* Theme / Core Idea */}
            {sermon.theme && (
              <p className={`font-medium italic leading-relaxed ${themeStyles.textMuted}`} style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}>
                « {sermon.theme} »
              </p>
            )}

          </div>

          {/* Section: Introduction */}
          {sermon.introduction && (
            <section id="pulpit-intro" className="space-y-4">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
                <h2 className="font-bold uppercase tracking-widest text-xs font-sans text-gray-400">
                  Introdução Homilética
                </h2>
              </div>

              <div className="whitespace-pre-line leading-relaxed font-normal">
                {sermon.introduction}
              </div>
            </section>
          )}

          {/* Section: Biblical Context */}
          {sermon.biblicalContext && (
            <section id="pulpit-context" className={`p-6 rounded-2xl ${themeStyles.cardBg} space-y-3`}>
              <h3 className="text-xs font-bold uppercase tracking-widest font-sans text-[#D4AF37] flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Pano de Fundo Exegético & Histórico
              </h3>
              <div className="whitespace-pre-line text-[0.9em] leading-relaxed text-gray-300">
                {sermon.biblicalContext}
              </div>
            </section>
          )}

          {/* Section: Expository Points */}
          <div className="space-y-16">
            {sermon.expositoryPoints.map((point, index) => (
              <section 
                key={index} 
                id={`pulpit-point-${index}`}
                className="space-y-6 pt-4"
              >
                {/* Preceding Transition Bridge (Crucial for Pulpit Delivery) */}
                {point.precedingTransition && (
                  <div className={`p-4 rounded-xl ${themeStyles.transitionBg} border flex items-start gap-3`}>
                    <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-black/40 text-[#D4AF37] shrink-0 mt-0.5">
                      Ponte
                    </span>
                    <p className="text-[0.85em] italic font-sans leading-relaxed text-gray-200">
                      "{point.precedingTransition}"
                    </p>
                  </div>
                )}

                {/* Point Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-[#D4AF37] text-black font-extrabold text-sm flex items-center justify-center font-mono shrink-0 shadow-md">
                      {index + 1}
                    </span>
                    <h2 
                      className={`font-serif font-bold ${themeStyles.accentColor}`}
                      style={{ fontSize: `${Math.round(fontSize * 1.25)}px`, lineHeight: 1.3 }}
                    >
                      {point.title}
                    </h2>
                  </div>
                </div>

                {/* Explanation / Exegesis (Shown in full view density) */}
                {viewDensity === 'full' && point.explanation && (
                  <div className="space-y-4 whitespace-pre-line leading-relaxed pl-2 border-l-2 border-white/10 sm:pl-4">
                    {point.explanation}
                  </div>
                )}

                {/* Illustration Block (Highlighted) */}
                {point.illustration && point.illustration.description && (
                  <div className="p-5 rounded-2xl bg-amber-950/25 border border-amber-500/30 text-amber-100 space-y-2 font-sans">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        Ilustração {point.illustration.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[0.9em] leading-relaxed text-amber-50/90 font-serif">
                      {point.illustration.description}
                    </p>
                  </div>
                )}

                {/* Application Block */}
                {point.application && (
                  <div className="p-5 rounded-2xl bg-emerald-950/25 border border-emerald-500/30 text-emerald-100 space-y-2 font-sans">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        Aplicação Pastoral Direta
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-[0.9em] leading-relaxed text-emerald-50/90 font-serif">
                      {point.application}
                    </p>
                  </div>
                )}

              </section>
            ))}
          </div>

          {/* Section: Conclusion & Appeal */}
          <section id="pulpit-conclusion" className="space-y-8 pt-8 border-t border-white/20">
            
            {/* Conclusion */}
            {sermon.conclusion && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <h2 className="font-bold uppercase tracking-widest text-xs font-sans text-gray-400">
                    Conclusão do Sermão
                  </h2>
                </div>
                <div className="whitespace-pre-line leading-relaxed">
                  {sermon.conclusion}
                </div>
              </div>
            )}

            {/* Pastoral Appeal / Call to Decision */}
            {sermon.pastoralAppeal && (
              <div className="p-6 rounded-2xl bg-[#1C1811] border-2 border-[#D4AF37]/50 space-y-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="font-bold uppercase tracking-widest text-xs font-sans text-[#D4AF37]">
                    Apelo Pastoral & Desafio Final
                  </h3>
                </div>
                <div className="whitespace-pre-line leading-relaxed text-white font-medium">
                  {sermon.pastoralAppeal}
                </div>
              </div>
            )}

          </section>

          {/* Section: Hymns Drawer (Hinos Recomendados para o Culto) */}
          {sermon.hymns && (
            <section id="pulpit-hymns" className={`p-6 rounded-2xl ${themeStyles.cardBg} space-y-4`}>
              <div 
                onClick={() => setShowHymns(!showHymns)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 text-amber-400">
                  <Music className="w-5 h-5" />
                  <h3 className="font-bold uppercase tracking-widest text-xs font-sans">
                    Hinos do Cantor Cristão Recomendados
                  </h3>
                </div>
                <button className="text-gray-400 hover:text-white">
                  {showHymns ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {showHymns && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans pt-2 border-t border-white/10 animate-fade-in">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Abertura / Louvor</span>
                    <p className="font-semibold text-gray-200">{sermon.hymns.abertura}</p>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Antes da Mensagem</span>
                    <p className="font-semibold text-gray-200">{sermon.hymns.antesMensagem}</p>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-amber-300 block">Apelo / Decisão</span>
                    <p className="font-semibold text-amber-100">{sermon.hymns.apelo}</p>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Encerramento</span>
                    <p className="font-semibold text-gray-200">{sermon.hymns.encerramento}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Pulpit End Footer Note */}
          <div className="text-center pt-8 border-t border-white/10 text-xs font-sans text-gray-500 space-y-1">
            <p>« Prega a palavra, insta a tempo e fora de tempo » — 2 Timóteo 4:2</p>
            <p className="text-[10px] text-gray-600">Estúdio Homilético • Modo Púlpito</p>
          </div>

        </div>
      </main>

    </div>
  );
}
