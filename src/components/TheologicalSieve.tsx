import React, { useState, useEffect } from 'react';
import { 
  Scale, ShieldAlert, Sparkles, BookOpen, History, Copy, Check, 
  ArrowRight, RefreshCw, AlertTriangle, Flame, Globe, Bookmark, 
  Trash2, Feather, CheckCircle2, ChevronRight, FileText, ChevronDown, 
  ExternalLink
} from 'lucide-react';
import { Sermon, TheologicalSieveResult } from '../types';

interface TheologicalSieveProps {
  sermons: Sermon[];
  currentSermon?: Sermon | null;
  onInjectPeroration?: (perorationText: string, scripture: string) => void;
  onNavigateToWorkspace?: () => void;
}

const STORAGE_KEY = 'theological_sieve_history';

export interface ParsedSermonDraft {
  scripture: string;
  title: string;
  theme: string;
  outlineText: string;
}

export function parsePastedSermonText(text: string): ParsedSermonDraft {
  const trimmed = text.trim();
  if (!trimmed) {
    return { scripture: '', title: '', theme: '', outlineText: '' };
  }

  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);

  let detectedScripture = '';
  let detectedTitle = '';
  let detectedTheme = '';

  // 1. Detect explicit labels (case-insensitive)
  const scriptureLabelMatch = trimmed.match(/(?:texto(?:\s+b[íi]blico)?|passagem|refer[êe]ncia|b[íi]blia|leitura)\s*[:\-]\s*([^\n\r]+)/i);
  if (scriptureLabelMatch) {
    detectedScripture = scriptureLabelMatch[1].trim();
  }

  // If no explicit label, search for common Bible books and chapter:verse patterns
  if (!detectedScripture) {
    const bibleRefPattern = /\b(?:[123]\s*(?:João|Jo|Co|Coríntios|Corintios|Pedro|Pe|Tm|Timóteo|Timoteo|Tessalonicenses|Ts|Crônicas|Cronicas|Reis|Samuel|Sm)|Gênesis|Genesis|Gn|Êxodo|Exodo|Ex|Levítico|Levitico|Lv|Números|Numeros|Nm|Deuteronômio|Deuteronomio|Dt|Josué|Josue|Js|Juízes|Juizes|Jz|Rute|Rt|Esdras|Ed|Neemias|Ne|Ester|Et|Jó|Salmos?|Sl|Provérbios|Proverbios|Pv|Eclesiastes|Ec|Cânticos|Cantares|Ct|Isaías|Isaias|Is|Jeremias|Jr|Lamentações|Lamentacoes|Lm|Ezequiel|Ez|Daniel|Dn|Oséias|Oseias|Os|Joel|Jl|Amós|Amos|Am|Obadias|Ob|Jonas|Jn|Miquéias|Miqueias|Mq|Naum|Na|Habacuque|Hc|Sofonias|Sf|Ageu|Ag|Zacarias|Zc|Malaquias|Ml|Mateus|Mt|Marcos|Mc|Lucas|Lc|João|Joao|Atos|At|Romanos|Rm|Gálatas|Galatas|Gl|Efésios|Efesios|Ef|Filipenses|Fp|Colossenses|Cl|Tito|Tt|Filemom|Fm|Hebreus|Hb|Tiago|Tg|Judas|Jd|Apocalipse|Ap)\s+\d+(?:[\s:,]\s*\d+(?:[\-\–]\d+)?)?/i;
    const refMatch = trimmed.match(bibleRefPattern);
    if (refMatch) {
      detectedScripture = refMatch[0].trim();
    }
  }

  // 2. Detect Title
  const titleLabelMatch = trimmed.match(/(?:t[íi]tulo(?:\s+do\s+serm[ãa]o)?|mensagem|serm[ãa]o)\s*[:\-]\s*([^\n\r]+)/i);
  if (titleLabelMatch) {
    detectedTitle = titleLabelMatch[1].trim();
  } else {
    // If first line isn't a biblical reference or label, it might be the title
    if (lines.length > 0) {
      const firstLine = lines[0];
      const isLabel = /^(?:texto|passagem|tema|leitura|b[íi]blia|refer[êe]ncia)\s*[:\-]/i.test(firstLine);
      if (!isLabel) {
        const firstLineClean = firstLine.replace(/^[#* \t]+|[#* \t]+$/g, '').trim();
        if (firstLineClean.length > 3 && firstLineClean.length <= 110 && firstLineClean !== detectedScripture) {
          detectedTitle = firstLineClean;
        }
      }
    }
  }

  // 3. Detect Theme
  const themeLabelMatch = trimmed.match(/(?:tema(?:\s+central)?|ideia(?:\s+central)?|tese)\s*[:\-]\s*([^\n\r]+)/i);
  if (themeLabelMatch) {
    detectedTheme = themeLabelMatch[1].trim();
  }

  // 4. Fallback defaults if not found so AI still has context
  if (!detectedTitle) {
    detectedTitle = detectedTheme || (detectedScripture ? `Exposição de ${detectedScripture}` : 'Sermão em Análise');
  }
  if (!detectedTheme) {
    detectedTheme = detectedTitle || (detectedScripture ? `Mensagem bíblica em ${detectedScripture}` : 'Proclamação Bíblica');
  }

  return {
    scripture: detectedScripture,
    title: detectedTitle,
    theme: detectedTheme,
    outlineText: trimmed
  };
}

export const TheologicalSieve: React.FC<TheologicalSieveProps> = ({
  sermons,
  currentSermon,
  onInjectPeroration,
  onNavigateToWorkspace
}) => {
  // Input mode: 'current' (active workspace sermon), 'library' (pick from library), 'manual' (type/paste)
  const [inputMode, setInputMode] = useState<'current' | 'library' | 'manual'>('current');
  const [selectedLibrarySermonId, setSelectedLibrarySermonId] = useState<string>('');
  
  // Form fields (structured for 'current' & 'library')
  const [titleInput, setTitleInput] = useState<string>('');
  const [scriptureInput, setScriptureInput] = useState<string>('');
  const [themeInput, setThemeInput] = useState<string>('');
  const [pointsInput, setPointsInput] = useState<string>('');

  // Single flexible draft for 'manual'
  const [manualTextInput, setManualTextInput] = useState<string>('');

  // Execution state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [activeResult, setActiveResult] = useState<TheologicalSieveResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedType, setCopiedType] = useState<'peroration' | 'report' | null>(null);
  const [injectedSuccess, setInjectedSuccess] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<TheologicalSieveResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Sync with currentSermon or selectedLibrarySermon
  useEffect(() => {
    if (inputMode === 'current' && currentSermon) {
      setTitleInput(currentSermon.title || '');
      setScriptureInput(currentSermon.scripture || '');
      setThemeInput(currentSermon.theme || '');
      const pts = (currentSermon.expositoryPoints || [])
        .map((p, i) => `${i + 1}. ${p.title}\n   Explicação: ${p.explanation || ''}\n   Aplicação: ${p.application || ''}`)
        .join('\n\n');
      setPointsInput(pts);
    }
  }, [inputMode, currentSermon]);

  const handleSelectLibrarySermon = (id: string) => {
    setSelectedLibrarySermonId(id);
    const target = sermons.find(s => s.id === id);
    if (target) {
      setTitleInput(target.title || '');
      setScriptureInput(target.scripture || '');
      setThemeInput(target.theme || '');
      const pts = (target.expositoryPoints || [])
        .map((p, i) => `${i + 1}. ${p.title}\n   Explicação: ${p.explanation || ''}\n   Aplicação: ${p.application || ''}`)
        .join('\n\n');
      setPointsInput(pts);
    }
  };

  const handleSwitchToCurrent = () => {
    setInputMode('current');
    if (currentSermon) {
      setTitleInput(currentSermon.title || '');
      setScriptureInput(currentSermon.scripture || '');
      setThemeInput(currentSermon.theme || '');
      const pts = (currentSermon.expositoryPoints || [])
        .map((p, i) => `${i + 1}. ${p.title}\n   Explicação: ${p.explanation || ''}\n   Aplicação: ${p.application || ''}`)
        .join('\n\n');
      setPointsInput(pts);
    }
  };

  // Run the 3-layer sieve analysis
  const handleRunTheologicalSieve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let payloadTitle = titleInput.trim();
    let payloadScripture = scriptureInput.trim();
    let payloadTheme = themeInput.trim();
    let payloadPoints = pointsInput.trim();

    if (inputMode === 'manual') {
      if (!manualTextInput.trim()) {
        setErrorMessage("Por favor, cole o esboço ou texto corrido do sermão para submeter ao Crivo.");
        return;
      }
      const parsed = parsePastedSermonText(manualTextInput);
      payloadTitle = parsed.title;
      payloadScripture = parsed.scripture;
      payloadTheme = parsed.theme;
      payloadPoints = manualTextInput.trim();
    } else {
      if (!payloadScripture && !payloadTheme && !payloadTitle) {
        setErrorMessage("Por favor, informe ao menos a Passagem Bíblica ou o Tema Central da mensagem.");
        return;
      }
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setFallbackNotice(null);

    // Sequence of thoughtful step indicators
    const steps = [
      "Invocando os alicerces da Segunda Confissão de Londres de 1689 e a Catolicidade Histórica...",
      "Camada 1: Mapeando heresias, racionalismo iluminista e desvios clássicos sobre a perícope...",
      "Camada 2: Diagnosticando as pressões do secularismo pós-moderno e individualismo expressivo...",
      "Camada 3: Filtrando o sincretismo, a tibieza e a falsa tolerância complacente...",
      "Forjando a Saída Teológica Magistral (A Peroração Homilética de Púlpito)..."
    ];

    let stepIndex = 0;
    setAnalysisStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setAnalysisStep(steps[stepIndex]);
    }, 1800);

    try {
      const response = await fetch('/api/gemini/theological-sieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payloadTitle,
          scripture: payloadScripture,
          theme: payloadTheme,
          mainPoints: payloadPoints,
          outlineText: payloadPoints
        })
      });

      if (!response.ok) {
        throw new Error("Erro na comunicação com o motor do Crivo Teológico.");
      }

      const data: TheologicalSieveResult & { fallbackActive?: boolean; fallbackReason?: string } = await response.json();
      
      if (data.fallbackActive) {
        setFallbackNotice(data.fallbackReason || "Modo de contingência ativado.");
      }

      setActiveResult(data);

      // Save to local history
      const updatedHistory = [data, ...history.filter(h => h.id !== data.id)].slice(0, 20);
      setHistory(updatedHistory);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
      } catch {}

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Falha ao processar o Crivo Teológico.");
    } finally {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const handleCopyPeroration = async () => {
    if (!activeResult?.magisterialPeroration?.text) return;
    try {
      await navigator.clipboard.writeText(activeResult.magisterialPeroration.text);
      setCopiedType('peroration');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = activeResult.magisterialPeroration.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopiedType('peroration');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handleCopyFullReport = async () => {
    if (!activeResult) return;
    const reportText = `=== RELATÓRIO DO CRIVO TEOLÓGICO ===
Sermão: ${activeResult.sermonTitle}
Texto Bíblico: ${activeResult.scripture}
Tema: ${activeResult.centralTheme}
Data: ${new Date(activeResult.createdAt).toLocaleDateString('pt-BR')}

--- CAMADA 1: OBJEÇÕES CLÁSSICAS E HISTÓRICAS ---
${activeResult.classicHistoricalObjections.summary}

Pontos Principais:
${activeResult.classicHistoricalObjections.keyPoints.map(p => `• ${p}`).join('\n')}

Alerta Escriturístico:
${activeResult.classicHistoricalObjections.scripturalWarning}

Referências:
${(activeResult.classicHistoricalObjections.historicalOrCulturalReferences || []).join(', ')}

--- CAMADA 2: NOVAS TENDÊNCIAS CULTURAIS & PÓS-MODERNIDADE ---
${activeResult.newCulturalTrends.summary}

Pontos Principais:
${activeResult.newCulturalTrends.keyPoints.map(p => `• ${p}`).join('\n')}

Alerta Escriturístico:
${activeResult.newCulturalTrends.scripturalWarning}

Referências:
${(activeResult.newCulturalTrends.historicalOrCulturalReferences || []).join(', ')}

--- CAMADA 3: A FALSA TOLERÂNCIA "RELIGIOSA" & SINCRETISMO ---
${activeResult.falseReligiousTolerance.summary}

Pontos Principais:
${activeResult.falseReligiousTolerance.keyPoints.map(p => `• ${p}`).join('\n')}

Alerta Escriturístico:
${activeResult.falseReligiousTolerance.scripturalWarning}

Referências:
${(activeResult.falseReligiousTolerance.historicalOrCulturalReferences || []).join(', ')}

--- PERORAÇÃO & APELO APOLOGÉTICO COMPLETO PARA O PÚLPITO ---
${activeResult.magisterialPeroration.text}

Âncoras Teológicas:
${activeResult.magisterialPeroration.theologicalAnchors.join(' | ')}

Exortação Pastoral:
${activeResult.magisterialPeroration.pastoralCharge}
`;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedType('report');
      setTimeout(() => setCopiedType(null), 2500);
    } catch {}
  };

  const handleInjectToWorkspace = () => {
    if (!activeResult?.magisterialPeroration?.text) return;
    if (onInjectPeroration) {
      onInjectPeroration(activeResult.magisterialPeroration.text, activeResult.scripture);
      setInjectedSuccess(true);
      setTimeout(() => setInjectedSuccess(false), 3000);
    }
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto w-full text-left">
      
      {/* Top Banner & Header */}
      <div className="bg-white/80 p-6 rounded-2xl border border-[#E6E2DA] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif text-[#2D2926] font-bold flex items-center gap-2">
            Crivo Teológico
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="bg-white border border-[#E6E2DA] hover:border-[#5A5A40] text-[#2D2926] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <History className="w-4 h-4 text-[#5A5A40]" />
              <span>Histórico do Crivo ({history.length})</span>
            </button>
          )}
        </div>
      </div>

      {fallbackNotice && (
        <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-950 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{fallbackNotice}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFallbackNotice(null)} 
            className="text-amber-800 hover:text-amber-950 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-red-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setErrorMessage(null)} 
            className="text-red-700 hover:text-red-950 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {injectedSuccess && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
            <span className="font-semibold">Peroração e subsídios injetados com sucesso no Sermão em Elaboração!</span>
          </div>
          {onNavigateToWorkspace && (
            <button
              type="button"
              onClick={onNavigateToWorkspace}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer"
            >
              Ir para Oficina de Sermões →
            </button>
          )}
        </div>
      )}

      {/* Grid: Left Column = Input & Configuration; Right Column = Active Sieve Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Select / Input Sermon to Screen (5 / 12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E6E2DA] p-6 shadow-sm space-y-5">
            
            <div className="border-b border-gray-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Etapa 1: Objeto de Avaliação</span>
              <h2 className="text-base font-serif font-bold text-gray-900 mt-0.5">Selecione ou Cole a Mensagem</h2>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-[#F5F2ED] p-1 rounded-xl border border-[#E6E2DA]">
              <button
                type="button"
                onClick={handleSwitchToCurrent}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer ${inputMode === 'current' ? 'bg-[#5A5A40] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Sermão Atual
              </button>
              <button
                type="button"
                onClick={() => setInputMode('library')}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer ${inputMode === 'library' ? 'bg-[#5A5A40] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Da Biblioteca
              </button>
              <button
                type="button"
                onClick={() => setInputMode('manual')}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all text-center cursor-pointer ${inputMode === 'manual' ? 'bg-[#5A5A40] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Colar Manual
              </button>
            </div>

            {/* Current Sermon Notice */}
            {inputMode === 'current' && (
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#5A5A40]/20 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block">Sermão Ativo no Laboratório</span>
                <p className="font-serif font-bold text-gray-900">{currentSermon?.title || 'Nenhum sermão com título definido'}</p>
                <p className="text-[11px] font-mono text-gray-500">{currentSermon?.scripture || 'Sem texto selecionado'}</p>
              </div>
            )}

            {/* Library Selector */}
            {inputMode === 'library' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">Escolha um sermão salvo</label>
                <select
                  value={selectedLibrarySermonId}
                  onChange={(e) => handleSelectLibrarySermon(e.target.value)}
                  className="w-full bg-white border border-[#E6E2DA] rounded-xl p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                >
                  <option value="">Selecione um sermão da biblioteca...</option>
                  {sermons.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.scripture})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleRunTheologicalSieve} className="space-y-4">
              {inputMode === 'manual' ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                      Cole o Esboço ou Texto Corrido do Sermão *
                    </label>
                    {manualTextInput && (
                      <button
                        type="button"
                        onClick={() => setManualTextInput('')}
                        className="text-[10px] text-red-600 hover:underline font-medium cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={12}
                    required
                    value={manualTextInput}
                    onChange={(e) => setManualTextInput(e.target.value)}
                    placeholder="Cole aqui o esboço, texto corrido, anotações ou rascunho completo do sermão...&#10;&#10;Exemplo:&#10;Texto Bíblico: Romanos 12:1-2&#10;Título: O Culto Racional no Altar da Graça&#10;Tema: A consagração integral diante das misericórdias de Deus&#10;1. A apresentação do corpo no altar vivo da graça&#10;2. A recusa radical em tomar a fôrma deste século&#10;3. A renovação contínua da mente pelo Espírito Santo"
                    className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-3 text-xs leading-relaxed focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none resize-y font-sans"
                  />
                  
                  {/* Parsing Feedback Preview */}
                  {manualTextInput.trim() && (
                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#5A5A40]/15 space-y-1.5 text-[11px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40] block">
                        Reconhecimento Automático Inteligente:
                      </span>
                      {(() => {
                        const parsed = parsePastedSermonText(manualTextInput);
                        return (
                          <>
                            <div className="flex flex-wrap gap-1.5">
                              {parsed.scripture ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-200">
                                  📖 Passagem: <strong>{parsed.scripture}</strong>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[10px] border border-amber-200">
                                  📖 Passagem: Inferida do texto
                                </span>
                              )}
                              {parsed.title && (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[10px] font-medium border border-gray-200">
                                  🖋 Título: <strong>{parsed.title}</strong>
                                </span>
                              )}
                              {parsed.theme && (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[10px] font-medium border border-gray-200">
                                  🎯 Tema: <strong>{parsed.theme}</strong>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 italic">
                              Todo o conteúdo inserido será transmitido integralmente ao Crivo para avaliação minuciosa das Três Camadas.
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Passagem Bíblica Principal *
                    </label>
                    <input
                      type="text"
                      required
                      value={scriptureInput}
                      onChange={(e) => setScriptureInput(e.target.value)}
                      placeholder="Ex: Romanos 12:1-2 ou Efésios 2:1-10"
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-2.5 text-xs font-mono focus:ring-[#5A5A40] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Título do Sermão
                    </label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="Ex: A Fôrma do Mundo ou o Altar de Deus"
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-2.5 text-xs focus:ring-[#5A5A40] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Tema Central / Tese da Mensagem
                    </label>
                    <input
                      type="text"
                      value={themeInput}
                      onChange={(e) => setThemeInput(e.target.value)}
                      placeholder="Ex: A consagração integral como culto racional à luz das misericórdias divinas"
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-2.5 text-xs focus:ring-[#5A5A40] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                      Pontos Expositivos / Rascunho do Esboço
                    </label>
                    <textarea
                      rows={4}
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      placeholder="1. O Altar das Misericórdias&#10;2. A Não-Conformação com o Presente Século&#10;3. A Renovação Espiritual da Mente"
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-2.5 text-xs leading-relaxed focus:ring-[#5A5A40] focus:outline-none resize-y"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isAnalyzing}
                className={`w-full py-3.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all shadow-md text-white flex items-center justify-center gap-2 cursor-pointer ${
                  isAnalyzing 
                    ? 'bg-[#5A5A40]/60 cursor-not-allowed' 
                    : 'bg-[#5A5A40] hover:bg-[#2D2926] active:scale-99'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>PROCESSANDO O CRIVO...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4 text-[#D4AF37]" />
                    <span>SUBMETER AO CRIVO TEOLÓGICO</span>
                  </>
                )}
              </button>
            </form>

            {/* Theological Pillars Badge */}
            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E6E2DA] space-y-1.5 text-[11px] text-gray-600">
              <span className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#5A5A40]" />
                Padrão Hermenêutico do Crivo:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-gray-500">
                <li>Segunda Confissão Batista de Londres de 1689;</li>
                <li>Hermenêutica histórico-gramatical nos textos originais;</li>
                <li>Confrontação à contemporização secular e pós-moderna;</li>
                <li>Suficiência de Cristo e Apelo Pastoral sóbrio (estilo Isaltino Gomes).</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Right Column: Sieve Screen & Analysis Results (7 / 12) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Analyzing Loading Card */}
          {isAnalyzing && (
            <div className="bg-white rounded-2xl border border-[#E6E2DA] p-10 shadow-sm flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
              <div className="w-14 h-14 bg-[#FAF8F5] border-2 border-[#5A5A40] rounded-2xl flex items-center justify-center text-[#5A5A40] shadow-inner">
                <Scale className="w-7 h-7 animate-bounce" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="font-serif font-bold text-gray-900 text-base">Passando a Mensagem pelo Crivo de Fogo...</h3>
                <p className="text-xs text-[#5A5A40] font-medium leading-relaxed font-sans">{analysisStep}</p>
              </div>
              <div className="flex gap-2 pt-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40] animate-ping"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40] animate-ping" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#5A5A40] animate-ping" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}

          {/* Empty State when no analysis */}
          {!isAnalyzing && !activeResult && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-[#E6E2DA] p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mx-auto text-gray-400">
                <Scale className="w-6 h-6 text-[#5A5A40]/40" />
              </div>
              <h3 className="font-serif font-bold text-gray-700 text-sm">Nenhuma Análise em Exibição</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Selecione um sermão ao lado ou preencha a passagem bíblica e os pontos para submeter o esboço às 3 camadas de purificação teológica.
              </p>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveResult(history[0])}
                  className="mt-2 text-xs text-[#5A5A40] font-bold hover:underline cursor-pointer"
                >
                  Carregar última análise realizada ({history[0].sermonTitle}) →
                </button>
              )}
            </div>
          )}

          {/* Active Result View */}
          {!isAnalyzing && activeResult && (
            <div className="space-y-6">

              {/* Header Card of the Result */}
              <div className="bg-white rounded-2xl border border-[#E6E2DA] p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {activeResult.scripture}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(activeResult.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-gray-900 text-lg leading-tight">
                    {activeResult.sermonTitle}
                  </h3>
                  <p className="text-xs text-gray-500">{activeResult.centralTheme}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyFullReport}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Copiar relatório completo com as 3 camadas e a peroração"
                  >
                    {copiedType === 'report' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Relatório Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-600" />
                        <span>Copiar Relatório</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Camada 1: Objeções Clássicas e Históricas */}
              <div className="bg-white rounded-2xl border border-[#E6E2DA] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center text-amber-800 border border-amber-200">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">Camada 1 do Crivo</span>
                      <h4 className="font-serif font-bold text-gray-900 text-sm">
                        {activeResult.classicHistoricalObjections.title}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    Raízes Históricas & Heresias
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  {activeResult.classicHistoricalObjections.summary}
                </p>

                {/* Key Points */}
                <div className="space-y-2 bg-[#FAF8F5] p-3.5 rounded-xl border border-amber-900/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block">
                    Ataques Doutrinários Mapeados:
                  </span>
                  <div className="space-y-1.5">
                    {activeResult.classicHistoricalObjections.keyPoints.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-amber-700 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scriptural Warning */}
                {activeResult.classicHistoricalObjections.scripturalWarning && (
                  <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-950 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-red-800">Alerta Hermenêutico:</strong>
                      <span className="leading-relaxed">{activeResult.classicHistoricalObjections.scripturalWarning}</span>
                    </div>
                  </div>
                )}

                {/* References */}
                {activeResult.classicHistoricalObjections.historicalOrCulturalReferences && activeResult.classicHistoricalObjections.historicalOrCulturalReferences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeResult.classicHistoricalObjections.historicalOrCulturalReferences.map((ref, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Camada 2: Novas Tendências Culturais & Pós-Modernidade */}
              <div className="bg-white rounded-2xl border border-[#E6E2DA] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-800 border border-indigo-200">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-800 block">Camada 2 do Crivo</span>
                      <h4 className="font-serif font-bold text-gray-900 text-sm">
                        {activeResult.newCulturalTrends.title}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-900 font-bold px-2 py-0.5 rounded-full">
                    Pós-Modernidade & Secularismo
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  {activeResult.newCulturalTrends.summary}
                </p>

                {/* Key Points */}
                <div className="space-y-2 bg-[#FAF8F5] p-3.5 rounded-xl border border-indigo-900/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block">
                    Pressões Contemporâneas sobre a Perícope:
                  </span>
                  <div className="space-y-1.5">
                    {activeResult.newCulturalTrends.keyPoints.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-indigo-700 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scriptural Warning */}
                {activeResult.newCulturalTrends.scripturalWarning && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-indigo-800">Defesa Contra a Fôrma do Século:</strong>
                      <span className="leading-relaxed">{activeResult.newCulturalTrends.scripturalWarning}</span>
                    </div>
                  </div>
                )}

                {/* References */}
                {activeResult.newCulturalTrends.historicalOrCulturalReferences && activeResult.newCulturalTrends.historicalOrCulturalReferences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeResult.newCulturalTrends.historicalOrCulturalReferences.map((ref, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Camada 3: A Falsa Tolerância "Religiosa" & Sincretismo */}
              <div className="bg-white rounded-2xl border border-[#E6E2DA] p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center text-red-800 border border-red-200">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-red-800 block">Camada 3 do Crivo</span>
                      <h4 className="font-serif font-bold text-gray-900 text-sm">
                        {activeResult.falseReligiousTolerance.title}
                      </h4>
                    </div>
                  </div>
                  <span className="text-[10px] bg-red-100 text-red-900 font-bold px-2 py-0.5 rounded-full">
                    Sincretismo & Tibieza
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed font-sans">
                  {activeResult.falseReligiousTolerance.summary}
                </p>

                {/* Key Points */}
                <div className="space-y-2 bg-[#FAF8F5] p-3.5 rounded-xl border border-red-900/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700 block">
                    Pontos Críticos de Transigência a Evitar:
                  </span>
                  <div className="space-y-1.5">
                    {activeResult.falseReligiousTolerance.keyPoints.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-red-700 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scriptural Warning */}
                {activeResult.falseReligiousTolerance.scripturalWarning && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-amber-900">Perigo de Concessão Pastoral:</strong>
                      <span className="leading-relaxed">{activeResult.falseReligiousTolerance.scripturalWarning}</span>
                    </div>
                  </div>
                )}

                {/* References */}
                {activeResult.falseReligiousTolerance.historicalOrCulturalReferences && activeResult.falseReligiousTolerance.historicalOrCulturalReferences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeResult.falseReligiousTolerance.historicalOrCulturalReferences.map((ref, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {ref}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* PERORAÇÃO & APELO APOLOGÉTICO COMPLETO PARA O PÚLPITO   */}
              {/* ======================================================== */}
              <div className="bg-[#FAF8F5] rounded-2xl border-2 border-[#5A5A40]/45 p-6 md:p-8 shadow-md space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4AF37]/15 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>

                {/* Section Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3.5 border-b border-[#5A5A40]/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#5A5A40] text-white rounded-xl flex items-center justify-center shadow-xs shrink-0">
                      <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                        Fecho Homilético de Ouro • Apelo & Saída Teológica
                      </span>
                      <h4 className="font-serif font-bold text-gray-900 text-base md:text-lg">
                        Peroração & Apelo Apologético Completo para o Púlpito
                      </h4>
                      <p className="text-xs text-gray-500 font-sans mt-0.5">
                        Sermão de fechamento encorpado sintetizando as 3 camadas do Crivo com apelo pastoral e evangelístico direto
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPeroration}
                      className="bg-white border border-[#5A5A40]/40 hover:border-[#5A5A40] text-[#2D2926] hover:bg-[#5A5A40]/5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      title="Copiar texto completo da peroração para uso imediato"
                    >
                      {copiedType === 'peroration' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Peroração Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#5A5A40]" />
                          <span>Copiar Peroração Completa</span>
                        </>
                      )}
                    </button>

                    {onInjectPeroration && (
                      <button
                        type="button"
                        onClick={handleInjectToWorkspace}
                        className="bg-[#5A5A40] hover:bg-[#2D2926] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        title="Injeta este fecho de ouro na conclusão do sermão em elaboração"
                      >
                        {injectedSuccess ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Injetado no Laboratório!</span>
                          </>
                        ) : (
                          <>
                            <Feather className="w-3.5 h-3.5 text-[#D4AF37]" />
                            <span>Injetar no Sermão em Elaboração</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Peroration Pulpit Text (Structured Multi-Paragraph Manuscript) */}
                <div className="p-6 md:p-8 bg-white rounded-2xl border border-[#5A5A40]/30 shadow-inner relative space-y-4">
                  <div className="absolute top-3 right-4 text-[10px] font-mono font-semibold uppercase tracking-wider text-[#5A5A40]/60 bg-[#FAF8F5] px-2.5 py-0.5 rounded border border-[#5A5A40]/20">
                    Manuscrito Oral para Púlpito
                  </div>

                  <div className="space-y-4 pt-2">
                    {activeResult.magisterialPeroration.text
                      .split(/\n\s*\n/)
                      .map((paragraph, pIdx) => (
                        <p 
                          key={pIdx} 
                          className="font-serif text-[15px] md:text-[16px] text-[#2D2926] leading-relaxed text-justify first-letter:text-2xl first-letter:font-bold first-letter:text-[#5A5A40] first-letter:mr-0.5"
                        >
                          {paragraph.trim()}
                        </p>
                      ))}
                  </div>
                </div>

                {/* Theological Anchors */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 block">
                    Âncoras Teológicas Irrevogáveis:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeResult.magisterialPeroration.theologicalAnchors.map((anchor, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-3 py-1 rounded-lg border border-[#5A5A40]/25 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-[#5A5A40]" />
                        <span>{anchor}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pastoral Charge */}
                {activeResult.magisterialPeroration.pastoralCharge && (
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[10px] uppercase font-bold text-emerald-800">
                        Exortação ao Pregador para a Proclamação:
                      </strong>
                      <span className="leading-relaxed font-sans text-xs">
                        {activeResult.magisterialPeroration.pastoralCharge}
                      </span>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-[#2D2926]/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E6E2DA] rounded-2xl max-w-3xl w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-left max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#5A5A40]" />
                <h3 className="font-serif font-bold text-gray-900 text-base">Histórico de Análises do Crivo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-xl cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Consulte ou reative qualquer análise teológica processada anteriormente neste dispositivo.
            </p>

            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveResult(item);
                    setShowHistoryModal(false);
                  }}
                  className="p-4 bg-gray-50 hover:bg-[#FAF8F5] rounded-xl border border-gray-200 hover:border-[#5A5A40]/40 transition-all cursor-pointer flex justify-between items-start gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded">
                        {item.scripture}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString('pt-BR')} às {new Date(item.createdAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <h4 className="font-serif font-bold text-gray-900 text-sm group-hover:text-[#5A5A40] transition-colors">
                      {item.sermonTitle}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-1">{item.centralTheme}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                      title="Excluir do histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
