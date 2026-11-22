import React from 'react';
import { Music, Check, Copy, Maximize2, ArrowRightLeft } from 'lucide-react';
import { DetailedHymn, HinarioType, SermonHymns } from '../types';
import { hydrateHymnsIfLegacy } from '../hymnsData';

interface SermonHymnsSectionProps {
  hymns?: Partial<SermonHymns>;
  activeHinario: HinarioType;
  onChangeHinario: (hinario: HinarioType) => void;
  copiedId: string | null;
  onCopyHymn: (hymn: DetailedHymn, copyKey: string) => void;
  onOpenLyricsModal: (hymn: DetailedHymn) => void;
}

const OCCASION_ORDER = ['abertura', 'antesMensagem', 'apelo', 'encerramento'] as const;

const OCCASION_LABELS: Record<(typeof OCCASION_ORDER)[number], string> = {
  abertura: '1. Abertura / Louvor e Adoração',
  antesMensagem: '2. Antes da Mensagem / Preparação',
  apelo: '3. Apelo Pastoral / Consagração',
  encerramento: '4. Encerramento / Poslúdio e Bênção'
};

export const SermonHymnsSection: React.FC<SermonHymnsSectionProps> = ({
  hymns,
  activeHinario,
  onChangeHinario,
  copiedId,
  onCopyHymn,
  onOpenLyricsModal
}) => {
  const activeHymnsRecord = hydrateHymnsIfLegacy(hymns);

  const renderHymnCard = (
    occ: (typeof OCCASION_ORDER)[number],
    hymn: DetailedHymn | undefined,
    subtitleTag?: string
  ) => {
    if (!hymn) return null;
    const copyKey = `${occ}_${hymn.hinario}_${hymn.number}`;
    const isCopied = copiedId === copyKey;

    return (
      <div
        key={`${occ}_${hymn.id}_${hymn.hinario}`}
        className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          occ === 'apelo' ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-[#E6E2DA]'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                    hymn.hinario === 'CC' ? 'bg-[#5A5A40] text-white' : 'bg-amber-800 text-white'
                  }`}
                >
                  {hymn.hinario} {hymn.number}
                </span>
                <span className="text-[10px] font-medium text-gray-500">
                  {subtitleTag || hymn.hinarioName}
                </span>
              </div>
              <h4 className="font-serif text-base font-bold text-gray-900 mt-1">
                {hymn.title}
              </h4>
              <p className="text-[11px] text-gray-500 italic mt-0.5">
                {hymn.author} &bull; <span className="font-medium text-gray-700">{hymn.theme}</span>
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyHymn(hymn, copyKey);
                }}
                title="Copiar letra completa deste hino"
                className="px-2.5 py-1 text-[11px] font-sans font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                    <span>Copiar Letra</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenLyricsModal(hymn)}
                title="Visualizar letra completa em tela cheia (projeção / leitura)"
                className="p-1 rounded-md text-gray-500 hover:text-black bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-3 font-serif text-xs leading-relaxed text-gray-800 max-h-64 overflow-y-auto pr-1">
            {hymn.stanzas.map((stanza, sIdx) => (
              <div key={sIdx} className="space-y-0.5">
                <span className="text-[9px] font-sans font-bold text-[#5A5A40] uppercase tracking-wider block">
                  Estrofe {sIdx + 1}
                </span>
                <p className="whitespace-pre-line pl-2 border-l-2 border-[#5A5A40]/30 text-gray-900">
                  {stanza}
                </p>
                {sIdx === 0 && hymn.chorus && (
                  <div className="my-2 p-2 rounded bg-amber-50/80 border-l-2 border-amber-500 text-amber-950 font-sans italic text-[11px]">
                    <span className="text-[9px] uppercase font-bold text-amber-800 block not-italic tracking-wider">
                      [Coro / Refrão]
                    </span>
                    <p className="whitespace-pre-line mt-0.5 font-serif">
                      {hymn.chorus}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {hymn.crossReference && (
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-sans text-gray-500 gap-2">
            <span>
              Correspondente no {hymn.crossReference.hinario}:{' '}
              <strong>
                {hymn.crossReference.number} — {hymn.crossReference.title}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onChangeHinario(hymn.crossReference!.hinario)}
              className="text-[#5A5A40] font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>Ver no {hymn.crossReference.hinario}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#5A5A40]/25">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Music className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-sans uppercase text-xs font-extrabold tracking-widest text-[#5A5A40]">
                Hinos Selecionados para o Culto (JUERP)
              </h3>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">
                Letras Integrais Oficiais
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-sans mt-0.5">
              Cantor Cristão e Hinário para o Culto Cristão (JUERP) • Copie ou projete em tela cheia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E6E2DA] shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onChangeHinario('CC')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              activeHinario === 'CC'
                ? 'bg-[#5A5A40] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
            title="Cantor Cristão (Edição Oficial JUERP)"
          >
            Cantor Cristão (CC)
          </button>
          <button
            type="button"
            onClick={() => onChangeHinario('HCC')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              activeHinario === 'HCC'
                ? 'bg-[#5A5A40] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
            title="Hinário para o Culto Cristão (Edição Oficial JUERP)"
          >
            HCC (JUERP)
          </button>
          <button
            type="button"
            onClick={() => onChangeHinario('AMBOS')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              activeHinario === 'AMBOS'
                ? 'bg-[#5A5A40] text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
            title="Comparar ambos os hinários lado a lado"
          >
            Comparar Ambos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OCCASION_ORDER.map((occ) => {
          const primary = activeHymnsRecord.details?.[occ];
          const alternate = activeHymnsRecord.alternateDetails?.[occ];

          if (activeHinario === 'AMBOS') {
            return (
              <div
                key={occ}
                className="md:col-span-2 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E6E2DA] space-y-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                    {OCCASION_LABELS[occ]}
                  </span>
                  <span className="text-[10px] text-gray-500 font-sans">
                    Comparação Cantor Cristão vs HCC
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderHymnCard(
                    occ,
                    primary?.hinario === 'CC' ? primary : alternate,
                    'Cantor Cristão (JUERP)'
                  )}
                  {renderHymnCard(
                    occ,
                    primary?.hinario === 'HCC' ? primary : alternate,
                    'Hinário para o Culto Cristão (JUERP)'
                  )}
                </div>
              </div>
            );
          }

          const chosenHymn =
            (primary?.hinario === activeHinario
              ? primary
              : alternate?.hinario === activeHinario
              ? alternate
              : primary) || primary;

          return (
            <div key={occ} className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] px-1 block">
                {OCCASION_LABELS[occ]}
              </span>
              {renderHymnCard(occ, chosenHymn)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
