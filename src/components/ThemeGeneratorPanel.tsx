import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trash2,
  AlertCircle
} from 'lucide-react';
import {
  GeneratedHomileticTheme,
  GenerateThemesRequest,
  ThemeApproach,
  ThemeGenerationMode
} from '../types';
import { safeApiPost } from '../services/apiClient';
import {
  CUSTOM_CATEGORY_OPTION,
  formatCustomCategoryName,
  normalizeThemeCategory
} from '../utils/themeCategory';

interface ThemeGeneratorPanelProps {
  categories: string[];
  savedThemes: GeneratedHomileticTheme[];
  onSaveTheme: (theme: GeneratedHomileticTheme) => Promise<boolean>;
  onUseTheme: (theme: GeneratedHomileticTheme) => void;
}

const APPROACH_OPTIONS: ThemeApproach[] = [
  'Expositivo',
  'Temático',
  'Pastoral',
  'Devocional'
];

interface GenerateThemesApiResponse {
  themes?: GeneratedHomileticTheme[];
  error?: string;
  fallbackActive?: boolean;
  fallbackReason?: string;
}

function formatCategoryLabel(cat: string): string {
  if (!cat) return '';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export const ThemeGeneratorPanel: React.FC<ThemeGeneratorPanelProps> = ({
  categories,
  savedThemes,
  onSaveTheme,
  onUseTheme
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [generationMode, setGenerationMode] = useState<ThemeGenerationMode>('scripture');
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'família');
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [selectedApproach, setSelectedApproach] = useState<ThemeApproach>('Expositivo');
  const [generatedThemes, setGeneratedThemes] = useState<GeneratedHomileticTheme[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [lastRetryWasVariation, setLastRetryWasVariation] = useState<boolean>(false);
  const [savingThemeId, setSavingThemeId] = useState<string | null>(null);

  const isCustomCategorySelected =
    generationMode === 'category' && selectedCategory === CUSTOM_CATEGORY_OPTION;

  const savedSignatureSet = useMemo(() => {
    const keys = new Set<string>();
    savedThemes.forEach((t) => {
      if (t.id) keys.add(t.id);
      const normTitle = (t.title || '').trim().toLowerCase();
      const normRef = (t.scripture || '').trim().toLowerCase();
      if (normTitle) keys.add(`${normTitle}::${normRef}`);
    });
    return keys;
  }, [savedThemes]);

  const isThemeSaved = (theme: GeneratedHomileticTheme): boolean => {
    if (theme.isSaved) return true;
    if (savedSignatureSet.has(theme.id)) return true;
    const sig = `${(theme.title || '').trim().toLowerCase()}::${(theme.scripture || '').trim().toLowerCase()}`;
    return savedSignatureSet.has(sig);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setGenerationError(null);
    if (value !== CUSTOM_CATEGORY_OPTION) {
      setCustomCategoryInput('');
    }
  };

  const handleGenerate = async (isVariation = false) => {
    setGenerationError(null);
    setFallbackNotice(null);

    const trimmed = inputValue.trim();
    if (generationMode === 'scripture' && !trimmed) {
      setGenerationError('Informe uma referência ou trecho bíblico (ex.: Romanos 8:28-39 ou Salmo 23).');
      return;
    }
    if (generationMode === 'topic' && !trimmed) {
      setGenerationError('Informe um assunto, ocasião ou necessidade pastoral (ex.: luto e esperança).');
      return;
    }

    let formattedCustomCategory: string | undefined;
    if (generationMode === 'category' && selectedCategory === CUSTOM_CATEGORY_OPTION) {
      formattedCustomCategory = formatCustomCategoryName(customCategoryInput);
      if (
        !formattedCustomCategory ||
        formattedCustomCategory.toLowerCase() === CUSTOM_CATEGORY_OPTION ||
        formattedCustomCategory.toLowerCase() === 'nova categoria'
      ) {
        setGenerationError('Informe o nome da nova categoria para gerar os temas (ex.: Casais em Missão).');
        return;
      }
    }

    setIsGenerating(true);

    try {
      const existingTitles = isVariation
        ? Array.from(
            new Set([
              ...generatedThemes.map((t) => t.title),
              ...savedThemes.slice(0, 8).map((t) => t.title)
            ])
          )
        : [];

      const payload: GenerateThemesRequest = {
        mode: generationMode,
        inputValue: trimmed,
        category: generationMode === 'category' ? selectedCategory : undefined,
        customCategory: formattedCustomCategory,
        approach: selectedApproach,
        variationSeed: isVariation ? String(Date.now()) : undefined,
        existingTitles
      };

      const data = await safeApiPost<GenerateThemesApiResponse>(
        '/api/gemini/generate-themes',
        payload,
        { retries: 1, timeoutMs: 165000 }
      );

      if (data?.error) {
        setGenerationError(data.error);
        return;
      }

      const list = Array.isArray(data?.themes) ? data.themes : [];
      if (list.length === 0) {
        setGenerationError('Não foi possível gerar temas para os parâmetros informados.');
        return;
      }

      if (data?.fallbackActive) {
        setLastRetryWasVariation(isVariation);
        setFallbackNotice(
          data.fallbackReason ||
            'Sugestões geradas pelo modo local de contingência devido à indisponibilidade momentânea da API.'
        );
      }

      setGeneratedThemes(list);
      if (!isExpanded) setIsExpanded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha de comunicação ao gerar temas.';
      setLastRetryWasVariation(isVariation);
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCard = async (theme: GeneratedHomileticTheme) => {
    if (isThemeSaved(theme)) return;
    const cleanedCategory = normalizeThemeCategory(theme.category, '');
    if (!cleanedCategory) {
      setGenerationError('Defina uma categoria válida antes de salvar este tema no banco.');
      return;
    }

    setSavingThemeId(theme.id);
    try {
      const ok = await onSaveTheme({
        ...theme,
        category: cleanedCategory,
        isSaved: true,
        updatedAt: Date.now()
      });
      if (ok) {
        setGeneratedThemes((prev) =>
          prev.map((item) =>
            item.id === theme.id ? { ...item, category: cleanedCategory, isSaved: true } : item
          )
        );
      }
    } finally {
      setSavingThemeId(null);
    }
  };

  const handleDiscardCard = (themeId: string) => {
    setGeneratedThemes((prev) => prev.filter((item) => item.id !== themeId));
  };

  const handleModeSwitch = (mode: ThemeGenerationMode) => {
    setGenerationMode(mode);
    setGenerationError(null);
  };

  return (
    <div className="bg-[#FAF8F4] border border-[#E6E2DA] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#5A5A40]" />
            <h4 className="font-serif font-bold text-[#2D2926] text-base">
              Gerador de Temas Homiléticos
            </h4>
          </div>
          <p className="text-xs text-gray-500">
            Crie propostas pregáveis a partir de uma passagem bíblica, categoria do banco ou necessidade pastoral.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A5A40] hover:text-[#2D2926] px-2.5 py-1.5 rounded-lg border border-[#E6E2DA] bg-white transition-colors whitespace-nowrap"
        >
          {isExpanded ? (
            <>
              <span>Recolher</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>Abrir Gerador</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-1">
          {/* Mode Tabs */}
          <div className="inline-flex flex-wrap gap-1.5 bg-white p-1 rounded-lg border border-[#E6E2DA]">
            <button
              type="button"
              onClick={() => handleModeSwitch('scripture')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                generationMode === 'scripture'
                  ? 'bg-[#5A5A40] text-white'
                  : 'text-[#2D2926] hover:bg-[#F5F2ED]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Texto Bíblico</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('category')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                generationMode === 'category'
                  ? 'bg-[#5A5A40] text-white'
                  : 'text-[#2D2926] hover:bg-[#F5F2ED]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Categoria</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('topic')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                generationMode === 'topic'
                  ? 'bg-[#5A5A40] text-white'
                  : 'text-[#2D2926] hover:bg-[#F5F2ED]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Assunto</span>
            </button>
          </div>

          {/* Form Inputs */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate(false);
            }}
            className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            {generationMode === 'scripture' && (
              <>
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Passagem ou Trecho Bíblico
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ex.: Romanos 8:28-39, Salmo 23, Lucas 15:11-32"
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Abordagem (opcional)
                  </label>
                  <select
                    value={selectedApproach}
                    onChange={(e) => setSelectedApproach(e.target.value as ThemeApproach)}
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  >
                    {APPROACH_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {generationMode === 'category' && (
              <>
                <div className={`${isCustomCategorySelected ? 'md:col-span-3' : 'md:col-span-4'} space-y-1`}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Categoria do Banco
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {formatCategoryLabel(cat)}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_OPTION}>+ Nova categoria...</option>
                  </select>
                </div>

                {isCustomCategorySelected && (
                  <div className="md:col-span-3 space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Nova Categoria *
                    </label>
                    <input
                      type="text"
                      value={customCategoryInput}
                      onChange={(e) => {
                        setCustomCategoryInput(e.target.value);
                        if (generationError) setGenerationError(null);
                      }}
                      maxLength={60}
                      placeholder="Ex.: Casais, Ceia e Comunhão"
                      className="w-full bg-white border border-[#5A5A40]/50 rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                )}

                <div className={`${isCustomCategorySelected ? 'md:col-span-3' : 'md:col-span-5'} space-y-1`}>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Recorte ou Ênfase (opcional)
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ex.: reconciliação no lar, perseverança na prova"
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  />
                </div>
              </>
            )}

            {generationMode === 'topic' && (
              <>
                <div className="md:col-span-6 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Assunto, Ocasião ou Necessidade Pastoral
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ex.: luto e esperança, ansiedade, unidade na igreja, ética no trabalho"
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                    Abordagem (opcional)
                  </label>
                  <select
                    value={selectedApproach}
                    onChange={(e) => setSelectedApproach(e.target.value as ThemeApproach)}
                    className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:outline-none focus:border-[#5A5A40]"
                  >
                    {APPROACH_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="md:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#5A5A40] hover:bg-[#2D2926] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Temas</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {generationError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3.5 py-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generationError}</span>
            </div>
          )}

          {fallbackNotice && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3.5 py-2.5 text-xs">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <span className="break-words">{fallbackNotice}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void handleGenerate(lastRetryWasVariation)}
                  className="inline-flex items-center gap-1.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-60 text-white font-bold px-2.5 py-1 rounded-md transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Tentando...' : 'Tentar novamente'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFallbackNotice(null)}
                  className="text-amber-800 hover:text-amber-950 font-bold px-2 py-1 rounded-md hover:bg-amber-500/10 border border-amber-500/20 transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
                >
                  ENTENDI
                </button>
              </div>
            </div>
          )}

          {/* Generated Drafts Preview */}
          {generatedThemes.length > 0 && (
            <div className="pt-3 border-t border-[#E6E2DA] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h5 className="font-serif font-bold text-sm text-[#2D2926]">
                    Propostas Geradas
                  </h5>
                  <span className="text-[11px] text-gray-500 font-medium">
                    ({generatedThemes.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6E2DA] bg-white hover:bg-[#F5F2ED] text-[#2D2926] text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Gerar Variações</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratedThemes([])}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-[#2D2926] text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    <span>Limpar rascunhos</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {generatedThemes.map((item) => {
                  const alreadySaved = isThemeSaved(item);
                  const isSavingThis = savingThemeId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-[#D8D2C5] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#5A5A40]">
                            {item.approach} · {formatCategoryLabel(item.category)} · Gerado por IA
                          </span>
                          <span className="text-xs font-mono font-medium text-gray-500 text-right shrink-0">
                            {item.scripture}
                          </span>
                        </div>

                        <h4 className="font-serif font-bold text-[#2D2926] text-base leading-snug">
                          {item.title}
                        </h4>

                        <p className="text-xs text-gray-600 leading-relaxed">
                          {item.summary}
                        </p>

                        {item.outlineHints && item.outlineHints.length > 0 && (
                          <div className="pt-2 border-t border-black/5 space-y-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Sugestão de Divisões
                            </span>
                            <ul className="space-y-0.5 text-[11px] text-gray-600">
                              {item.outlineHints.map((hint, hIdx) => (
                                <li key={hIdx} className="leading-snug">
                                  {hIdx + 1}. {hint}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="pt-2 border-t border-black/5 text-[11px] text-gray-500 italic">
                          <strong className="not-italic text-gray-600">Aplicação:</strong>{' '}
                          {item.application}
                        </div>
                      </div>

                      <div className="pt-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => onUseTheme(item)}
                          className="w-full bg-[#5A5A40] hover:bg-[#2D2926] text-white py-2 px-3 rounded-lg text-xs font-bold tracking-wide transition-colors whitespace-nowrap"
                        >
                          Usar Tema de Estudo
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveCard(item)}
                            disabled={alreadySaved || isSavingThis}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                              alreadySaved
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-default'
                                : 'bg-[#FAF8F4] hover:bg-[#F5F2ED] border-[#E6E2DA] text-[#2D2926]'
                            }`}
                          >
                            {alreadySaved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Salvo no Banco</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-3.5 h-3.5" />
                                <span>{isSavingThis ? 'Salvando...' : 'Salvar no Banco'}</span>
                              </>
                            )}
                          </button>

                          {!alreadySaved && (
                            <button
                              type="button"
                              onClick={() => handleDiscardCard(item.id)}
                              title="Descartar rascunho"
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-[#E6E2DA] text-gray-400 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
