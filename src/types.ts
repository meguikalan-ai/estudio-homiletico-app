export interface SermonEvaluation {
  faithfulnessScore: number; // 0-100
  faithfulnessComment: string;
  homileticalCoherenceScore: number; // 0-100
  coherenceComment: string;
  christocentrismScore: number; // 0-100
  christocentrismComment: string;
  pastoralClarityScore: number; // 0-100
  clarityComment: string;
  clichesDetected: string[];
  clichesWithSuggestions?: { cliche: string; suggestion: string; section?: string }[];
  artificialityWarning?: string;
  moralismWarning?: string;
  suggestedImprovements: string[];
}

export interface ExpositorySeriesUnit {
  number: number;
  title: string;
  scripture: string;
  coreIdea: string;
  keyPoints: string[];
  pastoralApplication: string;
}

export interface ExpositorySeries {
  id: string;
  userId?: string;
  title: string;
  book: string;
  generalTheme: string;
  campaign?: string;
  sermons: ExpositorySeriesUnit[];
  updatedAt?: number;
}

export type HinarioType = 'CC' | 'HCC' | 'AMBOS';

export interface DetailedHymn {
  id: string;
  hinario: 'CC' | 'HCC';
  hinarioName: string; // 'Cantor Cristão (JUERP)' | 'Hinário para o Culto Cristão (JUERP)'
  number: number;
  title: string;
  author: string;
  theme: string;
  subtheme: string;
  occasion: 'abertura' | 'antesMensagem' | 'apelo' | 'encerramento';
  emotionalTone: 'solene' | 'vibrante' | 'contemplativo' | 'alegre' | 'restaurador' | 'decisivo';
  stanzas: string[];
  chorus?: string;
  fullLyrics: string;
  crossReference?: {
    hinario: 'CC' | 'HCC';
    number: number;
    title: string;
  };
  keywords: string[];
}

export interface SermonHymns {
  abertura: string;
  antesMensagem: string;
  apelo: string;
  encerramento: string;
  preferredHinario?: HinarioType;
  details?: {
    abertura?: DetailedHymn;
    antesMensagem?: DetailedHymn;
    apelo?: DetailedHymn;
    encerramento?: DetailedHymn;
  };
  alternateDetails?: {
    abertura?: DetailedHymn;
    antesMensagem?: DetailedHymn;
    apelo?: DetailedHymn;
    encerramento?: DetailedHymn;
  };
}

export interface ExpositoryPoint {
  title: string;
  precedingTransition?: string;
  explanation: string;
  illustration?: {
    type: 'bíblica' | 'cotidiano';
    description: string;
  };
  application: string;
}

export interface SermonHistoryEntry {
  id: string;
  date: string;
  location: string;
  event: string;
  notes?: string;
}

export interface Sermon {
  id: string;
  userId?: string;
  title: string;
  theme: string;
  scripture: string;
  introduction: string;
  biblicalContext: string;
  expositoryPoints: ExpositoryPoint[];
  illustrations?: { type: 'bíblica' | 'cotidiano'; description: string }[];
  applications?: string[];
  conclusion: string;
  pastoralAppeal: string;
  
  // Metadata
  date: string;
  style: 'original' | 'isaltino' | 'billy' | 'biblico' | 'conviccional';
  churchProfile: 'tradicional' | 'contemporanea' | 'reformada' | 'renovada' | 'jovem' | 'plantacao' | 'revitalizacao' | 'neutro';
  audience: string;
  bibleVersion: string;
  isOutline: boolean;
  duration?: '20' | '30' | '40' | '60';
  tags: string[];
  seriesName?: string;
  hymns: SermonHymns;
  isFavorite: boolean;
  isArchived: boolean;
  
  evaluation?: SermonEvaluation;
  history?: SermonHistoryEntry[];
  updatedAt?: number;
}

export interface ThemeSuggestion {
  theme: string;
  scripture: string;
  coreIdea: string;
  pastoralApplication: string;
}

export interface IllustrationSuggestion {
  title: string;
  type: 'bíblica' | 'cotidiano' | 'histórica' | 'pastoral' | 'evangelística';
  story: string;
  moral: string;
}

export interface VisualIllustration extends IllustrationSuggestion {
  id?: string;
  scripture?: string;
  visualPrompt?: string;
  visualStyle?: string;
  aspectRatio?: '16:9' | '1:1' | '4:3' | '9:16';
  colorTone?: string;
  createdAt?: number;
}

export interface CalendarCelebration {
  id: string;
  title: string;
  description: string;
  dateSuggestion: string;
  suggestedTheme: string;
  scripture: string;
  hymnSuggestion: string;
}

export interface CompareVersionText {
  version: string;
  text: string;
}

export interface ExegesisResponse {
  passageReference?: string;
  historicalContext?: string;
  philologicalNotes?: string; // key words in greek/hebrew
  theologicalCore?: string;
  homileticalSeeds?: string[];
  answeringText: string;
  comparedVerses?: CompareVersionText[];
}

export interface TheologicalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  exegesisData?: ExegesisResponse;
}

export interface PericopePossibility {
  themeName: string;
  category: string; // e.g. "Tema Principal", "Secundário", "Pastoral", "Evangelístico", "Cristocêntrico", "Doutrinário", "Devocional", "Apologético", "Datas Especiais"
  strength: 'Muito Forte' | 'Forte' | 'Possível' | 'Não sustentado';
  textualBase: string;
  hermeneuticalRisk: string;
  observation: string; // O que o texto permite, por que permite, e o que o texto NÃO está ensinando
}

export interface PericopeAnalysis {
  scripture: string;
  identification: {
    mainSubject: string;
    mainVerb: string;
    narrativeTension: string;
    textMovement: string;
    climax: string;
    authorPurpose: string;
  };
  possibilities: PericopePossibility[];
}

export interface TheologicalSieveLayer {
  title: string;
  summary: string;
  keyPoints: string[];
  scripturalWarning: string;
  historicalOrCulturalReferences?: string[];
}

export interface TheologicalSieveResult {
  id: string;
  sermonTitle: string;
  scripture: string;
  centralTheme: string;
  createdAt: number;
  classicHistoricalObjections: TheologicalSieveLayer;
  newCulturalTrends: TheologicalSieveLayer;
  falseReligiousTolerance: TheologicalSieveLayer;
  magisterialPeroration: {
    title: string;
    text: string;
    theologicalAnchors: string[];
    pastoralCharge: string;
  };
}


