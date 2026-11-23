import { ExpositoryPoint } from '../types';

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function toRomanNumeral(num: number): string {
  if (num >= 1 && num <= ROMAN_NUMERALS.length) {
    return ROMAN_NUMERALS[num - 1];
  }
  return String(num);
}

export function stripRomanOrNumericPrefix(title: string): string {
  return (title || '')
    .replace(/^(?:[IVXLCDM]+|\d+)\s*[.)\-–—:]\s*/i, '')
    .trim();
}

export function formatRomanPointTitle(title: string, index: number): string {
  const cleanTitle = stripRomanOrNumericPrefix(title) || `Tópico ${index + 1}`;
  return `${toRomanNumeral(index + 1)}. ${cleanTitle}`;
}

/**
 * Remove marcações explícitas (a), (b), (c), (d) e subtítulos/rótulos soltos
 * (incluindo cabeçalhos em caixa alta), preservando separação entre parágrafos.
 */
export function stripLooseSubLabels(text: string): string {
  if (!text) return '';

  return text
    // Remove marcadores com rótulos detalhados em início de linha ou após marcador de lista
    .replace(
      /(?:^|\n)\s*(?:[•\-*]\s*)?(?:\([a-dA-D]\)|[a-dA-D][.)])\s*(?:Explica[çc][ãa]o\s+Textual(?:\s+Profunda)?(?:\s*(?:e|&)\s*Termos\s+Originais)?|Exposi[çc][ãa]o\s+do\s+Texto|Paralelos\s+Escritur[íi]sticos(?:\s+Can[ôo]nicos)?|Cristocentrismo\s+Redentor|Aconselhamento(?:\s*,?\s*(?:e|&)?\s*Confronto)?\s+Pastoral(?:\s*(?:e|&)\s*Aplica[çc][ãa]o(?:\s+P[óo]s-Moderna)?)?|Aplica[çc][ãa]o\s+Pastoral(?:\s+Direta)?|Aplica[çc][ãa]o\s+Pr[áa]tica|Aplica[çc][ãa]o)\s*[:\-–—]?\s*/gi,
      '\n\n'
    )
    // Remove ocorrências inline residuais no meio do texto
    .replace(
      /(?:\([a-dA-D]\))\s*(?:Explica[çc][ãa]o\s+Textual(?:\s+Profunda)?|Paralelos\s+Escritur[íi]sticos|Cristocentrismo\s+Redentor|Aconselhamento(?:\s*,?\s*(?:e|&)?\s*Confronto)?\s+Pastoral|Aplica[çc][ãa]o\s+(?:Pastoral(?:\s+Direta)?|Pr[áa]tica))\s*[:\-–—]?\s*/gi,
      '\n\n'
    )
    // Remove cabeçalhos em caixa alta ou títulos isolados repetindo o nome das seções
    .replace(
      /(?:^|\n)\s*(?:[•\-*]\s*)?(?:EXPLICA[ÇC][ÃA]O\s+TEXTUAL(?:\s+PROFUNDA)?|EXPOSI[ÇC][ÃA]O\s+DO\s+TEXTO|PARALELOS\s+ESCRITUR[ÍI]STICOS|CRISTOCENTRISMO\s+REDENTOR|ACONSELHAMENTO(?:\s+E\s+CONFRONTO)?\s+PASTORAL|APLICA[ÇC][ÃA]O(?:\s+(?:PASTORAL(?:\s+DIRETA)?|PR[ÁA]TICA))?)\s*[:\-–—]?\s*(?:\n|$)/g,
      '\n\n'
    )
    // Remove prefixo inicial "Aplicação Pastoral:" / "Aplicação Prática:" / "Aplicação:" quando já exibido na caixa APLICAÇÃO
    .replace(
      /^\s*(?:Aconselhamento(?:\s*,?\s*(?:e|&)?\s*Confronto)?\s+Pastoral|Aplica[çc][ãa]o\s+(?:Pastoral(?:\s+Direta)?|Pr[áa]tica)|Aplica[çc][ãa]o)\s*[:\-–—]\s*/i,
      ''
    )
    // Remove marcadores isolados (a), (b), (c), (d) no início de linha (com ou sem bullet)
    .replace(/(?:^|\n)\s*(?:[•\-*]\s*)?\([a-dA-D]\)\s*/g, '\n\n')
    // Normaliza quebras de linha preservando separação limpa entre parágrafos
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const EMBEDDED_APPLICATION_REGEX =
  /(?:^|\n|\.\s+|\s{2,})(?:[•\-*]\s*)?(?:(?:\([dD]\)|[dD][.)])\s*(?:Aconselhamento(?:\s*,?\s*(?:e|&)?\s*Confronto)?\s+Pastoral(?:\s*(?:e|&)\s*Aplica[çc][ãa]o(?:\s+P[óo]s-Moderna)?)?|Aplica[çc][ãa]o\s+(?:Pastoral(?:\s+Direta)?|Pr[áa]tica)|Aplica[çc][ãa]o)?(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"'(]|\s*[:\-–—])|(?:Aconselhamento(?:\s*,?\s*(?:e|&)?\s*Confronto)?\s+Pastoral(?:\s*(?:e|&)\s*Aplica[çc][ãa]o(?:\s+P[óo]s-Moderna)?)?|Aplica[çc][ãa]o\s+(?:Pastoral(?:\s+Direta)?|Pr[áa]tica)|ACONSELHAMENTO(?:\s+E\s+CONFRONTO)?\s+PASTORAL|APLICA[ÇC][ÃA]O(?:\s+(?:PASTORAL(?:\s+DIRETA)?|PR[ÁA]TICA))?)\s*[:\-–—])/;

/**
 * Se uma mensagem legada ou gerada tiver o bloco `(d)` / `Aplicação` embutido
 * dentro de `explanation`, separa-o antes de limpar os rótulos.
 */
export function splitEmbeddedApplication(rawExplanation: string): {
  explanationBody: string;
  extractedApplication: string;
} {
  const source = (rawExplanation || '').trim();
  if (!source) {
    return { explanationBody: '', extractedApplication: '' };
  }

  const match = EMBEDDED_APPLICATION_REGEX.exec(source);
  if (!match || match.index === undefined) {
    return { explanationBody: source, extractedApplication: '' };
  }

  const startsWithPeriod = match[0].startsWith('.');
  const splitIdx = startsWithPeriod ? match.index + 1 : match.index;
  const explanationBody = source.slice(0, splitIdx).trim();
  const extractedApplication = stripLooseSubLabels(source.slice(splitIdx));

  return {
    explanationBody,
    extractedApplication
  };
}

const ABBREVIATIONS_REGEX =
  /(?:^|\s)(?:v|vv|cap|cf|ex|p\.ex|etc|obs|art|dr|pr|sr|sra|sl|jo|mt|mc|lc|at|rm|co|gl|ef|fp|cl|ts|tm|tt|fm|hb|tg|pe|jd|ap|gn|êx|lv|nm|dt|js|jz|rt|sm|rs|cr|ed|ne|et|pv|ec|ct|is|jr|lm|ez|dn|os|jl|am|ob|jn|mq|na|hc|sf|ag|zc|ml|\d+|[ivxlcdm]+)\.\s*$/i;

const TRANSITION_CUE_REGEX =
  /^(?:Esse|Essa|Este|Esta|Estes|Estas|Tal|Assim|Nesse|Nessa|Neste|Nesta|No Novo Testamento|Em toda a Escritura|Nas Escrituras|As Escrituras|O apóstolo|Aqui|Na cruz|Em Cristo|Jesus Cristo|Portanto|Desse modo|Por fim|Confronte|Examine|Hoje|Na prática|No seu lar)\b/;

/**
 * Divide o texto expositivo em parágrafos fluidos e legíveis.
 * Preserva quebras de parágrafo existentes (`\n` ou `\n\n`) e, apenas quando
 * um bloco único excede 680 caracteres sem quebras, reparte em fronteiras de frase naturais.
 */
export function splitFluentParagraphs(text: string): string[] {
  const initial = (text || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (initial.length === 0) return [];
  if (initial.length > 1) return initial;

  const single = initial[0];
  if (single.length <= 520) return initial;

  const candidatePositions: number[] = [];
  const sentenceEndRegex = /[.!?]["”’)]?\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“"‘])/g;
  let m: RegExpExecArray | null;

  while ((m = sentenceEndRegex.exec(single)) !== null) {
    const beforeSlice = single.slice(Math.max(0, m.index - 12), m.index + 1);
    if (ABBREVIATIONS_REGEX.test(beforeSlice)) continue;
    const nextStart = m.index + m[0].length;
    if (nextStart >= 180 && single.length - nextStart >= 150) {
      candidatePositions.push(nextStart);
    }
  }

  if (candidatePositions.length === 0) return initial;

  const targetCount = single.length > 1250 ? 3 : 2;
  const chosenSplits: number[] = [];

  for (let i = 1; i < targetCount; i++) {
    const targetRatio = (single.length * i) / targetCount;
    const prevSplit = chosenSplits[chosenSplits.length - 1] || 0;

    let bestPos: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const pos of candidatePositions) {
      if (pos - prevSplit < 180) continue;
      if (single.length - pos < 150) continue;
      const distance = Math.abs(pos - targetRatio);
      const upcoming = single.slice(pos, pos + 40);
      const cueBonus = TRANSITION_CUE_REGEX.test(upcoming) ? 140 : 0;
      const score = distance - cueBonus;
      if (score < bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }

    if (bestPos !== null) {
      chosenSplits.push(bestPos);
    }
  }

  if (chosenSplits.length === 0) return initial;

  const result: string[] = [];
  let cursor = 0;
  for (const splitPos of chosenSplits) {
    const chunk = single.slice(cursor, splitPos).trim();
    if (chunk) result.push(chunk);
    cursor = splitPos;
  }
  const tail = single.slice(cursor).trim();
  if (tail) result.push(tail);

  return result.length > 0 ? result : initial;
}

function normalizeForComparison(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasHighTextOverlap(a: string, b: string): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (!normA || !normB) return false;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  const wordsA = normA.split(' ').filter((w) => w.length > 3);
  const wordsB = normB.split(' ').filter((w) => w.length > 3);
  if (wordsA.length < 5 || wordsB.length < 5) return false;

  const setB = new Set(wordsB);
  const shared = wordsA.filter((w) => setB.has(w)).length;
  const ratio = shared / Math.min(wordsA.length, wordsB.length);
  return ratio >= 0.72;
}

function looksLikePastoralApplication(paragraph: string): boolean {
  if (!paragraph || paragraph.length < 35) return false;

  const hortatoryVerbs =
    /\b(confronte|examine|aplique|pratique|descanse|arrependa-se|abandone|busque|entregue|cultive|guarde|ore|vigie|renuncie|reconcilie|perdoe|reflita|pergunte|pare de|não ceda|não viva|não permita|achegue-se|receba|derrube|troque|compartilhe|dedique|seja corajoso|seja fiel|engaje-se|viva como)\b/i;
  const dailyArenas =
    /\b(de segunda a sábado|no seu lar|no lar|no casamento|seu cônjuge|seus filhos|ambiente de trabalho|ambiente profissional|nas finanças|na vizinhança|na igreja local|nesta semana|hoje mesmo|seu coração|sua casa|sua família|sua rotina|redes sociais|secularismo prático|ansiedade|individualismo|autoajuda|quando ninguém está olhando)\b/i;
  const secondPersonPrompt =
    /\b(você|vocês|seu|sua|seus|suas)\b/i.test(paragraph) &&
    (/[?]|hoje|nesta semana|diário|diária|cotidiano|aplicamos|na prática/i.test(paragraph));

  let score = 0;
  if (hortatoryVerbs.test(paragraph)) score += 1;
  if (dailyArenas.test(paragraph)) score += 1;
  if (secondPersonPrompt) score += 1;

  return score >= 2;
}

export interface StructuredExpositoryPoint {
  romanTitle: string;
  fullExplanation: string;
  explanationParagraphs: string[];
  application: string;
  applicationParagraphs: string[];
}

/**
 * Estrutura completa de um ponto expositivo:
 * - Limpa marcadores (a)-(d) e rótulos soltos;
 * - Integra `I. Título - Primeiro parágrafo...` sem duplicar cabeçalhos;
 * - Mantém o corpo expositivo em parágrafos fluidos;
 * - Extrai / isola a aplicação pastoral para exibição na caixa destacada `APLICAÇÃO`
 *   sem duplicá-la no corpo corrido.
 */
export function structureExpositoryPoint(
  point: ExpositoryPoint,
  index: number
): StructuredExpositoryPoint {
  const romanTitle = formatRomanPointTitle(point.title, index);
  const coreTitle = stripRomanOrNumericPrefix(romanTitle);

  const { explanationBody, extractedApplication } = splitEmbeddedApplication(point.explanation || '');
  const cleanedExpl = stripLooseSubLabels(explanationBody);
  const cleanedExplicitApp = stripLooseSubLabels(point.application || '');

  let combinedApp = cleanedExplicitApp;
  if (extractedApplication) {
    if (!combinedApp) {
      combinedApp = extractedApplication;
    } else if (!hasHighTextOverlap(combinedApp, extractedApplication)) {
      combinedApp = `${extractedApplication}\n\n${combinedApp}`;
    } else if (extractedApplication.length > combinedApp.length) {
      combinedApp = extractedApplication;
    }
  }

  let bodyWithoutLeadingTitle = cleanedExpl;
  if (bodyWithoutLeadingTitle) {
    const escapedCore = coreTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingHeaderRegex = new RegExp(
      `^(?:(?:[IVXLCDM]+|\\d+)\\s*[.)\\-–—:]\\s*)?${escapedCore}\\s*(?:[-–—:]\\s*|\\n+)`,
      'i'
    );

    if (existingHeaderRegex.test(bodyWithoutLeadingTitle)) {
      bodyWithoutLeadingTitle = bodyWithoutLeadingTitle.replace(existingHeaderRegex, '').trim();
    } else {
      const genericRomanPrefixRegex = /^(?:[IVXLCDM]+)\.\s+[^\n]{4,110}?\s+[-–—]\s+/;
      const match = bodyWithoutLeadingTitle.match(genericRomanPrefixRegex);
      if (match) {
        const candidateTitle = match[0]
          .replace(/^(?:[IVXLCDM]+)\.\s+/, '')
          .replace(/\s+[-–—]\s+$/, '')
          .trim()
          .toLowerCase();
        if (
          candidateTitle === coreTitle.toLowerCase() ||
          coreTitle.toLowerCase().includes(candidateTitle) ||
          candidateTitle.includes(coreTitle.toLowerCase())
        ) {
          bodyWithoutLeadingTitle = bodyWithoutLeadingTitle.slice(match[0].length).trim();
        }
      }
    }
  }

  const normalizedBody = bodyWithoutLeadingTitle.replace(/^\n+/, '');
  const rawFullExplanation = normalizedBody ? `${romanTitle} - ${normalizedBody}` : romanTitle;
  const explanationParagraphs = splitFluentParagraphs(rawFullExplanation);

  // Evita duplicação caso o último parágrafo da exposição repita a aplicação
  if (combinedApp && explanationParagraphs.length >= 2) {
    const lastExplPara = explanationParagraphs[explanationParagraphs.length - 1];
    if (hasHighTextOverlap(lastExplPara, combinedApp)) {
      explanationParagraphs.pop();
    }
  }

  // Isola o parágrafo final de aplicação/exortação pastoral quando `application` vier vazio
  if ((!combinedApp || combinedApp.length < 25) && explanationParagraphs.length >= 2) {
    const lastExplPara = explanationParagraphs[explanationParagraphs.length - 1];
    if (looksLikePastoralApplication(lastExplPara)) {
      explanationParagraphs.pop();
      combinedApp = combinedApp ? `${lastExplPara}\n\n${combinedApp}` : lastExplPara;
    }
  }

  const applicationParagraphs = splitFluentParagraphs(combinedApp);
  const fullExplanation = explanationParagraphs.join('\n\n') || romanTitle;
  const application = applicationParagraphs.join('\n\n');

  return {
    romanTitle,
    fullExplanation,
    explanationParagraphs: explanationParagraphs.length > 0 ? explanationParagraphs : [romanTitle],
    application,
    applicationParagraphs
  };
}

/**
 * Integra o título romano seguido de hífen diretamente ao primeiro parágrafo
 * do texto expositivo (`I. Título - Primeiro parágrafo...`), evitando duplicações
 * caso o conteúdo já venha formatado nesse padrão.
 */
export function formatIntegratedExplanation(
  title: string,
  explanation: string,
  index: number
): {
  romanTitle: string;
  fullText: string;
  paragraphs: string[];
} {
  const structured = structureExpositoryPoint({ title, explanation, application: '' }, index);
  return {
    romanTitle: structured.romanTitle,
    fullText: structured.fullExplanation,
    paragraphs: structured.explanationParagraphs
  };
}

export function formatCleanApplication(application?: string): string {
  return stripLooseSubLabels(application || '');
}

/**
 * Separa o prefixo `I. Título - ` do restante do primeiro parágrafo para permitir
 * destaque tipográfico inline sem reintroduzir cabeçalhos separados.
 */
export function splitInlineRomanLead(paragraph: string): {
  leadTitle: string | null;
  separator: string;
  body: string;
} {
  const match = paragraph.match(/^([IVXLCDM]+\.\s+[^\n]{2,140}?)\s+([-–—])\s+([\s\S]+)$/);
  if (!match) {
    return { leadTitle: null, separator: '', body: paragraph };
  }
  return {
    leadTitle: match[1],
    separator: ` ${match[2]} `,
    body: match[3]
  };
}

/**
 * Normaliza um ExpositoryPoint recém-gerado ou carregado para remover (a)-(d),
 * estruturar os parágrafos fluidos e isolar o bloco de aplicação pastoral.
 */
export function normalizeExpositoryPoint(point: ExpositoryPoint, index: number): ExpositoryPoint {
  const structured = structureExpositoryPoint(point, index);
  return {
    ...point,
    title: structured.romanTitle,
    explanation: structured.fullExplanation,
    application: structured.application
  };
}
