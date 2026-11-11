import React, { useState, useMemo } from 'react';
import { Trash2, Search, X, RefreshCw } from 'lucide-react';
import { Sermon } from '../types';

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

export interface SermonCardProps {
  sermon: Sermon;
  isSelected?: boolean;
  isDeleting?: boolean;
  onSelect: (sermon: Sermon) => void;
  onOpenPulpit: (sermon: Sermon) => void;
  onDuplicate: (sermon: Sermon) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

/**
 * Card de Sermão na Biblioteca - Estrutura Compacta (Modelo 3):
 * - Linha Principal (Cabeçalho): Título em destaque com botão de favorito (★) no topo.
 * - Linha de Metadados: Texto bíblico limpo (ex: "Lucas 18:1-8") com badge da versão (ex: "AEC"), data e série.
 * - Subtítulo / Tema Central: Padronizado em linha única concisa (line-clamp-1).
 * - Divisor Sutil: Separa o bloco de texto da barra de ações rápidas.
 * - Rodapé de Ações: Botões agrupados (Carregar Estudo, Púlpito, Copiar, Arquivar e Apagar).
 */
export const SermonLibraryCard: React.FC<SermonCardProps> = ({
  sermon: s,
  isSelected = false,
  isDeleting = false,
  onSelect,
  onOpenPulpit,
  onDuplicate,
  onToggleFavorite,
  onToggleArchive,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete
}) => {
  const { reference, version } = normalizeCardBibleMetadata(s.scripture, s.bibleVersion);
  const cleanTheme = normalizeCardTheme(s.theme);
  const formattedDate = new Date(s.date).toLocaleDateString('pt-BR');

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
          {s.seriesName && (
            <>
              <span className="text-gray-300 text-[10px]">•</span>
              <span className="text-[9px] font-bold uppercase text-[#5A5A40] bg-[#5A5A40]/10 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={`Série: ${s.seriesName}`}>
                {s.seriesName}
              </span>
            </>
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
          {/* Ações principais (Estudo & Púlpito) */}
          <div className="flex items-center gap-2">
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
              className="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-xs transition-colors shadow-2xs"
              title="Abrir diretamente no Modo Púlpito"
            >
              <span>📖 Púlpito</span>
            </button>
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
  onSelectSermon: (sermon: Sermon) => void;
  onOpenPulpit: (sermon: Sermon) => void;
  onDuplicateSermon: (sermon: Sermon) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onDeleteSermon: (id: string) => void;
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
  onSelectSermon,
  onOpenPulpit,
  onDuplicateSermon,
  onToggleFavorite,
  onToggleArchive,
  onDeleteSermon,
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
        return (
          s.title.toLowerCase().includes(q) ||
          s.scripture.toLowerCase().includes(q) ||
          s.theme.toLowerCase().includes(q) ||
          (s.seriesName && s.seriesName.toLowerCase().includes(q)) ||
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
