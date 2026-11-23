import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, Loader2, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react';
import {
  Sermon,
  SermonDerivationConfig,
  SermonDerivationDuration,
  SermonDerivationMode
} from '../types';
import { normalizeCardBibleMetadata } from './SermonLibraryModal';

export interface DeriveSermonModalProps {
  isOpen: boolean;
  sourceSermon: Sermon | null;
  initialMode?: SermonDerivationMode;
  initialDuration?: SermonDerivationDuration;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (sourceSermon: Sermon, config: SermonDerivationConfig) => void;
}

const DURATION_OPTIONS: Array<{
  value: SermonDerivationDuration;
  label: string;
  hint: string;
}> = [
  { value: '20', label: '20 min', hint: 'Direto e dinâmico' },
  { value: '30', label: '30 min', hint: 'Equilíbrio clássico' },
  { value: '40', label: '40 min', hint: 'Exposição aprofundada' }
];

const AUDIENCE_PRESETS = [
  'Igreja Local (Culto Dominical)',
  'Pequeno Grupo / Célula (PG)',
  'Jovens e Universitários',
  'Casais e Famílias',
  'Evangelístico / Visitantes',
  'Culto de Oração / Meio de Semana'
];

const STYLE_OPTIONS: Array<{ value: Sermon['style']; label: string }> = [
  { value: 'original', label: 'Pastoral Equilibrado (Original)' },
  { value: 'isaltino', label: 'Isaltino Gomes (Sóbrio, Oral e Prático)' },
  { value: 'biblico', label: 'Expositivo Bíblico Clássico' },
  { value: 'conviccional', label: 'Conviccional (Firmeza Doutrinária)' },
  { value: 'billy', label: 'Evangelístico Direto (Billy Graham)' }
];

function resolveInitialDuration(duration?: Sermon['duration']): SermonDerivationDuration {
  if (duration === '20' || duration === '30' || duration === '40') {
    return duration;
  }
  return '30';
}

export const DeriveSermonModal: React.FC<DeriveSermonModalProps> = ({
  isOpen,
  sourceSermon,
  initialMode = 'custom',
  initialDuration,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit
}) => {
  const [formatMode, setFormatMode] = useState<SermonDerivationMode>(initialMode);
  const [duration, setDuration] = useState<SermonDerivationDuration>('30');
  const [audience, setAudience] = useState<string>('');
  const [style, setStyle] = useState<Sermon['style']>('original');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !sourceSermon) return;
    setFormatMode(initialMode);
    setDuration(initialDuration ?? resolveInitialDuration(sourceSermon.duration));
    setAudience(
      initialMode === 'bible-study'
        ? 'Pequeno Grupo / Célula (PG)'
        : sourceSermon.audience || 'Igreja Local (Culto Dominical)'
    );
    setStyle(sourceSermon.style || 'original');
    setNotes('');
  }, [isOpen, sourceSermon, initialMode, initialDuration]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !sourceSermon) return null;

  const { reference, version } = normalizeCardBibleMetadata(
    sourceSermon.scripture,
    sourceSermon.bibleVersion
  );

  const handleModeSwitch = (nextMode: SermonDerivationMode) => {
    setFormatMode(nextMode);
    if (nextMode === 'bible-study' && (!audience.trim() || audience === sourceSermon.audience)) {
      setAudience('Pequeno Grupo / Célula (PG)');
    } else if (nextMode !== 'bible-study' && audience === 'Pequeno Grupo / Célula (PG)' && sourceSermon.audience) {
      setAudience(sourceSermon.audience);
    }
  };

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    onSubmit(sourceSermon, {
      mode: formatMode,
      duration,
      audience: audience.trim() || sourceSermon.audience || 'Igreja Local',
      style,
      notes: notes.trim()
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#2D2926]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="derive-sermon-modal-title"
    >
      <div
        className="bg-[#FDFBF7] border border-[#E6E2DA] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-[#E6E2DA] px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center shrink-0 mt-0.5">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="derive-sermon-modal-title"
                className="text-base sm:text-lg font-serif font-bold text-[#2D2926]"
              >
                Personalizar & Derivar Mensagem
              </h2>
              <p className="text-xs text-gray-500">
                Gere uma nova adaptação na Oficina sem alterar o sermão original da Biblioteca.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Base Sermon Summary */}
          <div className="bg-[#F5F2ED] border border-[#E6E2DA] rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A5A40]">
                Mensagem Base Selecionada
              </span>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-[#5A5A40] border border-[#E6E2DA]">
                  {reference} ({version})
                </span>
                {sourceSermon.duration && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                    Original: {sourceSermon.duration} min
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm font-serif font-bold text-[#2D2926] leading-snug">
              {sourceSermon.title}
            </p>
            {sourceSermon.theme && (
              <p className="text-xs text-gray-600 italic line-clamp-2">
                {sourceSermon.theme}
              </p>
            )}
          </div>

          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block">
              Objetivo da Derivação
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleModeSwitch('custom')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                  formatMode !== 'bible-study'
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs'
                    : 'bg-white text-[#2D2926] border-[#E6E2DA] hover:bg-stone-50'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Adaptação de Sermão</div>
                  <div className={`text-[10px] ${formatMode !== 'bible-study' ? 'text-white/80' : 'text-gray-500'}`}>
                    Ajusta ritmo, público e duração
                  </div>
                </div>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleModeSwitch('bible-study')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2 ${
                  formatMode === 'bible-study'
                    ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs'
                    : 'bg-white text-[#2D2926] border-[#E6E2DA] hover:bg-stone-50'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Estudo Bíblico (PG)</div>
                  <div className={`text-[10px] ${formatMode === 'bible-study' ? 'text-white/80' : 'text-gray-500'}`}>
                    Roteiro participativo com perguntas
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Explicit 20 / 30 / 40 min Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Duração da Nova Versão</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((opt) => {
                const isActive = duration === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setDuration(opt.value)}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs'
                        : 'bg-white text-[#2D2926] border-[#E6E2DA] hover:border-[#5A5A40]/50 hover:bg-stone-50'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className={`text-[10px] ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                      {opt.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audience / Occasion */}
          <div className="space-y-1.5">
            <label
              htmlFor="derive-audience-input"
              className="text-[11px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>Público / Ocasião</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {AUDIENCE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setAudience(preset)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                    audience === preset
                      ? 'bg-[#5A5A40]/15 border-[#5A5A40] text-[#2D2926]'
                      : 'bg-white border-[#E6E2DA] text-gray-600 hover:bg-stone-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="derive-audience-input"
              type="text"
              value={audience}
              disabled={isSubmitting}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Ex.: Culto de Jovens, Encontro de Casais, Célula no Lar..."
              className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:border-[#5A5A40] focus:outline-none"
            />
          </div>

          {/* Tone / Approach */}
          <div className="space-y-1.5">
            <label
              htmlFor="derive-style-select"
              className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block"
            >
              Tom / Abordagem Homilética
            </label>
            <select
              id="derive-style-select"
              value={style}
              disabled={isSubmitting}
              onChange={(e) => setStyle(e.target.value as Sermon['style'])}
              className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:border-[#5A5A40] focus:outline-none"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="derive-notes-textarea"
              className="text-[11px] font-bold uppercase tracking-wider text-gray-600 block"
            >
              Observação Adicional (Opcional)
            </label>
            <textarea
              id="derive-notes-textarea"
              rows={3}
              value={notes}
              disabled={isSubmitting}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Enfatizar consolo para famílias enlutadas, incluir perguntas de discussão para PG, simplificar transições para visitantes..."
              className="w-full bg-white border border-[#E6E2DA] rounded-lg px-3 py-2 text-xs text-[#2D2926] focus:border-[#5A5A40] focus:outline-none resize-y"
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-[#E6E2DA] flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold border border-[#E6E2DA] bg-white hover:bg-gray-50 text-gray-700 cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando na Oficina ({duration} min)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {formatMode === 'bible-study'
                      ? `Gerar Estudo Bíblico (${duration} min)`
                      : `Gerar Versão de ${duration} min`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
