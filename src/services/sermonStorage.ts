import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocFromServer,
  getDocs, 
  getDocsFromServer,
  deleteDoc, 
  query,
  where,
  orderBy,
  onSnapshot, 
  writeBatch,
  firestoreDatabaseId,
  firebaseProjectId,
  type Unsubscribe,
  type DocumentReference,
  type DocumentData,
  type QuerySnapshot
} from '../firebase';
import { Sermon, ExpositorySeries, VisualIllustration, TheologicalChatMessage, TheologicalChatTopic, TheologicalSieveResult, GeneratedHomileticTheme, ThemeApproach, ThemeGenerationMode, PreachingPlan, PreachingPlanStatus } from '../types';
import { PREACHING_SERVICE_TYPES, PREACHING_PLAN_STATUSES } from '../config/preachingPlanningConfig';
import { normalizeThemeCategory } from '../utils/themeCategory';

export const PASTORAL_SERMONS_COLLECTION = 'pastoral_sermons';
export const SERMONS_COLLECTION = 'sermons';
export const SERIES_COLLECTION = 'series';
export const TOMBSTONES_COLLECTION = 'tombstones';
export const ILLUSTRATIONS_COLLECTION = 'illustrations';
export const THEOLOGICAL_TOPICS_COLLECTION = 'theological_topics';
export const THEOLOGICAL_CHAT_COLLECTION = 'theological_chat';
export const THEOLOGICAL_SIEVE_COLLECTION = 'theological_sieve';
export const BIBLICAL_THEMES_COLLECTION = 'biblical_themes';
export const PREACHING_PLANS_COLLECTION = 'preaching_plans';
export const CHAT_META_COLLECTION = 'chat_meta';
export const LOCAL_STORAGE_KEY = 'pastoral_sermons';
export const LOCAL_STORAGE_DELETED_KEY = 'pastoral_deleted_sermon_ids';
export const LOCAL_STORAGE_ILLUSTRATIONS_KEY = 'pastoral_visual_illustrations';
export const LOCAL_STORAGE_DELETED_ILL_KEY = 'pastoral_deleted_illustration_ids';
export const LOCAL_STORAGE_CHAT_KEY = 'pastoral_theological_chat';
export const LOCAL_STORAGE_CHAT_TOPICS_KEY = 'pastoral_theological_chat_topics';
export const LOCAL_STORAGE_DELETED_TOPICS_KEY = 'pastoral_deleted_topic_ids';
export const LOCAL_STORAGE_SIEVE_KEY = 'theological_sieve_history';
export const LOCAL_STORAGE_DELETED_SIEVE_KEY = 'pastoral_deleted_sieve_ids';
export const LOCAL_STORAGE_SAVED_THEMES_KEY = 'pastoral_saved_biblical_themes';
export const LOCAL_STORAGE_DELETED_THEMES_KEY = 'pastoral_deleted_theme_ids';
export const LOCAL_STORAGE_PREACHING_PLANS_KEY = 'pastoral_preaching_plans';
export const LOCAL_STORAGE_DELETED_PLANS_KEY = 'pastoral_deleted_preaching_plan_ids';
export const LEGACY_CHAT_TOPIC_ID = 'topic-geral';

// Rastreamento do último erro do Firestore para diagnósticos na UI
let lastFirestoreError: string | null = null;

export function getLastFirestoreError(): string | null {
  return lastFirestoreError;
}

export function setLastFirestoreError(err: string | null): void {
  lastFirestoreError = err;
}

export interface FirestoreErrorInfo {
  code: string;
  message: string;
  sermonTitle?: string;
  sermonId?: string;
  path?: string;
  timestamp: number;
}

let firestoreErrorListeners: ((info: FirestoreErrorInfo) => void)[] = [];

/**
 * Registra um ouvinte para falhas de gravação com o Firestore,
 * permitindo que a interface apresente alertas em tempo real.
 */
export function onFirestoreError(listener: (info: FirestoreErrorInfo) => void): () => void {
  firestoreErrorListeners.push(listener);
  return () => {
    firestoreErrorListeners = firestoreErrorListeners.filter(l => l !== listener);
  };
}

/**
 * Notifica erro de gravação para a interface gráfica e log detalhado no console.
 * NUNCA esconde erros.
 */
export function notifyFirestoreError(info: FirestoreErrorInfo): void {
  console.error(`🚨 [FIRESTORE ERRO NA GRAVAÇÃO]:`, {
    codigo: info.code,
    mensagem: info.message,
    sermão: info.sermonTitle,
    id: info.sermonId,
    caminho: info.path,
    hora: new Date(info.timestamp).toLocaleTimeString()
  });

  setLastFirestoreError(`[${info.code}] ${info.message}`);

  firestoreErrorListeners.forEach(fn => {
    try { fn(info); } catch {}
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pastoral-firestore-error', { detail: info }));
  }
}

/**
 * UID fixo único do pastor para sincronização direta sem autenticação
 */
export const FIXED_PASTORAL_UID = '2PG5uxWMgeg3eE10yQbQVFDpHUu1';

/**
 * Retorna o UID efetivo do pastor para armazenamento em users/{uid}/...
 */
export function getEffectiveUid(overrideUid?: string): string {
  if (overrideUid && overrideUid.trim()) return overrideUid.trim();
  return FIXED_PASTORAL_UID;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  type: 'upload' | 'download' | 'delete' | 'realtime' | 'status' | 'error';
  message: string;
  details?: string;
}

// In-memory sync log of events for UI rendering
const syncEventLogs: SyncLogEntry[] = [
  {
    id: 'init_log',
    timestamp: Date.now(),
    type: 'status',
    message: 'Mecanismo de sincronização Firestore inicializado',
    details: `Banco: ${firestoreDatabaseId} | Projeto: ${firebaseProjectId}`
  }
];

type SyncListener = (logs: SyncLogEntry[]) => void;
const syncListeners = new Set<SyncListener>();

export function getSyncLogs(): SyncLogEntry[] {
  return [...syncEventLogs];
}

export function subscribeToSyncLogs(listener: SyncListener): () => void {
  syncListeners.add(listener);
  listener(getSyncLogs());
  return () => syncListeners.delete(listener);
}

export function recordSyncLog(
  type: SyncLogEntry['type'], 
  message: string, 
  details?: string
): void {
  const entry: SyncLogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    type,
    message,
    details
  };
  syncEventLogs.unshift(entry);
  if (syncEventLogs.length > 50) {
    syncEventLogs.pop();
  }
  syncListeners.forEach(fn => {
    try { fn(getSyncLogs()); } catch {}
  });
}

/**
 * Deep sanitize helper: remove ou limpa qualquer valor `undefined`.
 * O Firestore rejeita completamente `undefined` com a exceção:
 * "Unsupported field value: undefined".
 * - Chaves de objeto com valor `undefined` são completamente excluídas.
 * - Elementos de array com valor `undefined` são filtrados.
 * - Strings e outros valores permanecem íntegros.
 */
export function cleanUndefinedRecursively<T>(obj: T): T {
  if (obj === undefined) {
    return '' as unknown as T;
  }
  if (obj === null) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => cleanUndefinedRecursively(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (val !== undefined) {
        res[key] = cleanUndefinedRecursively(val);
      }
    }
    return res as T;
  }
  return obj;
}

// Alias retrocompatível
export const removeUndefinedFields = cleanUndefinedRecursively;

/**
 * Get the set of IDs of sermons explicitly deleted by the user
 */
export function getDeletedSermonIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Mark a sermon ID as permanently deleted
 */
export function markSermonAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedSermonIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)));
  } catch (err) {
    console.warn("Erro ao marcar sermão como excluído:", err);
  }
}

/**
 * Unmark a sermon ID (e.g. if newly created/restored)
 */
export function unmarkSermonAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedSermonIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (err) {
    console.warn("Erro ao desmarcar sermão excluído:", err);
  }
}

/**
 * Check if sermon is empty or completely blank
 */
export function isSermonBlank(s: Sermon): boolean {
  if (!s) return true;

  const rawTitle = (s.title || '').trim().toLowerCase();
  // Strip common prefix decorators like "Título:", "Sermão:", etc.
  const cleanTitle = rawTitle.replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim();

  const isBlankTitle = 
    !cleanTitle || 
    cleanTitle === 'sermão em branco' || 
    cleanTitle === 'sermao em branco' || 
    cleanTitle === 'sermão sem título' || 
    cleanTitle === 'sermao sem titulo' ||
    cleanTitle === 'sem título' ||
    cleanTitle === 'sem titulo' ||
    cleanTitle === 'novo sermão' ||
    cleanTitle === 'novo sermao' ||
    cleanTitle === 'rascunho em branco';

  const isBlankId = typeof s.id === 'string' && (s.id.startsWith('ser_empty_') || s.id.startsWith('blank_'));

  const hasScripture = Boolean(s.scripture && s.scripture.trim().length > 0);
  const hasIntro = Boolean(s.introduction && s.introduction.trim().length > 0);
  const hasContext = Boolean(s.biblicalContext && s.biblicalContext.trim().length > 0);
  const hasConclusion = Boolean(s.conclusion && s.conclusion.trim().length > 0);
  const hasAppeal = Boolean(s.pastoralAppeal && s.pastoralAppeal.trim().length > 0);
  const hasTheme = Boolean(s.theme && s.theme.trim().length > 0);

  // Expository points check: does any point have actual explanation, application, or non-default title?
  const hasRealPoints = Boolean(
    s.expositoryPoints &&
    s.expositoryPoints.length > 0 &&
    s.expositoryPoints.some(p => {
      const explanation = (p.explanation || '').trim();
      const application = (p.application || '').trim();
      const ptTitle = (p.title || '').trim().toLowerCase();
      const isDefaultTitle = 
        !ptTitle || 
        ptTitle === 'i. ponto expositivo' || 
        ptTitle === 'ponto expositivo' || 
        ptTitle === 'i. ponto expositivo inicial' ||
        ptTitle === 'i. ponto';
      
      return explanation.length > 0 || application.length > 0 || (!isDefaultTitle && ptTitle.length > 0);
    })
  );

  const hasSubstantialContent = hasScripture || hasIntro || hasContext || hasConclusion || hasAppeal || hasTheme || hasRealPoints;

  // 1. If it has a blank-style title or blank ID and no substantial content, it is blank
  if ((isBlankTitle || isBlankId) && !hasSubstantialContent) {
    return true;
  }

  // 2. If it is titled "sermão em branco" or "sermao em branco"
  if (cleanTitle === 'sermão em branco' || cleanTitle === 'sermao em branco') {
    if (!hasScripture && !hasIntro && !hasConclusion) {
      return true;
    }
  }

  // 3. If there is literally no title and no substantial content
  if (!cleanTitle && !hasSubstantialContent) {
    return true;
  }

  // 4. If ID is ser_empty_ and scripture is empty
  if (isBlankId && !hasScripture) {
    return true;
  }

  return false;
}

/**
 * Cleans up any blank sermons from Firestore and localStorage permanently
 */
export async function purgeBlankSermonsFromStorage(userId?: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const cleaned = list.filter((s: Sermon) => !isSermonBlank(s) && !isModelSermon(s));
        if (cleaned.length !== list.length) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
        }
      }
    }
  } catch {}

  // Purgar também modelos publicados pré-definidos
  await purgeModelSermonsFromStorage(userId);

  if (!db) return;
  const uid = getEffectiveUid(userId);
  if (!uid) return;

  try {
    const collectionsToClean = [
      collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION),
      collection(db, 'users', uid, SERMONS_COLLECTION)
    ];

    for (const col of collectionsToClean) {
      try {
        const snapshot = await getDocs(col);
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data() as Sermon;
          if (data && (isSermonBlank(data) || isModelSermon(data))) {
            try {
              await deleteDoc(docSnap.ref);
              markSermonAsDeleted(data.id || docSnap.id);
            } catch {}
          }
        });
      } catch {}
    }
  } catch (err: unknown) {
    console.warn("Aviso ao purgar sermões em branco do Firestore:", err);
  }
}

export const MODEL_SERMON_IDS = new Set(['star_01', 'ser_joao_5_1_15']);

/**
 * Identifica se um sermão é um modelo de exemplo pré-publicado pelo app
 */
export function isModelSermon(s: { id?: string; title?: string } | null | undefined): boolean {
  if (!s) return false;
  const id = s.id || '';
  if (MODEL_SERMON_IDS.has(id) || id.startsWith('star_')) return true;
  const rawTitle = (s.title || '').trim().toLowerCase().replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim();
  if (
    rawTitle === 'o padrão eterno do discipulado' || 
    rawTitle === 'o padrao eterno do discipulado' ||
    rawTitle === 'a graça soberana no tanque de betesda' ||
    rawTitle === 'a graca soberana no tanque de betesda'
  ) {
    return true;
  }
  return false;
}

/**
 * Remove permanentemente todos os modelos de sermão de exemplo (star_01, ser_joao_5_1_15)
 * tanto do localStorage quanto do Firestore e propaga o tombstone para todos os aparelhos conectados.
 */
export async function purgeModelSermonsFromStorage(userId?: string): Promise<void> {
  // 1. Marca os IDs dos modelos como excluídos no registro local de exclusões
  MODEL_SERMON_IDS.forEach(id => markSermonAsDeleted(id));

  // 2. Limpa modelos do localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const cleaned = list.filter((s: Sermon) => s && !isModelSermon(s));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
      }
    }
  } catch {}

  // 3. Se Firestore estiver ativo, purga de pastoral_sermons, sermons e gera tombstones
  if (!db) return;
  const uid = getEffectiveUid(userId);
  if (!uid) return;

  try {
    // Purgar os IDs fixos dos modelos prévios
    for (const modelId of MODEL_SERMON_IDS) {
      try {
        await Promise.allSettled([
          deleteDoc(doc(db, 'users', uid, PASTORAL_SERMONS_COLLECTION, modelId)),
          deleteDoc(doc(db, PASTORAL_SERMONS_COLLECTION, modelId)),
          deleteDoc(doc(db, 'users', uid, SERMONS_COLLECTION, modelId))
        ]);
        const tombRef = doc(db, 'users', uid, TOMBSTONES_COLLECTION, modelId);
        await setDoc(tombRef, { id: modelId, deletedAt: Date.now() });
      } catch {}
    }

    // Varrer as coleções do usuário para remover qualquer modelo restante pelo título ou ID
    const collectionsToClean = [
      collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION),
      collection(db, 'users', uid, SERMONS_COLLECTION)
    ];

    for (const col of collectionsToClean) {
      try {
        const snapshot = await getDocs(col);
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data() as Sermon;
          if (data && isModelSermon(data)) {
            try {
              await deleteDoc(docSnap.ref);
              const targetId = data.id || docSnap.id;
              markSermonAsDeleted(targetId);
              const tombRef = doc(db, 'users', uid, TOMBSTONES_COLLECTION, targetId);
              await setDoc(tombRef, { id: targetId, deletedAt: Date.now() });
            } catch {}
          }
        });
      } catch {}
    }

    recordSyncLog('delete', 'Todos os modelos de sermão publicados foram removidos da nuvem com sucesso.');
  } catch (err: unknown) {
    console.warn("Aviso ao purgar modelos de sermão do Firestore:", err);
  }
}

/**
 * Clean and normalize a sermon object for Firestore storage (avoid undefined fields)
 * O Firestore rejeita expressamente qualquer campo cujo valor seja `undefined`.
 * Esta função assegura que strings fiquem como `""`, arrays como `[]` e chaves indefinidas sejam eliminadas.
 */
export function sanitizeSermonForFirestore(sermon: Sermon, userId?: string): Record<string, unknown> {
  const uid = getEffectiveUid(userId);
  const sanitized: Record<string, unknown> = {
    id: sermon.id || ('ser_' + Date.now()),
    userId: uid || FIXED_PASTORAL_UID,
    title: (sermon.title || '').trim(),
    theme: (sermon.theme || '').trim(),
    scripture: (sermon.scripture || '').trim(),
    introduction: (sermon.introduction || '').trim(),
    biblicalContext: (sermon.biblicalContext || '').trim(),
    expositoryPoints: (sermon.expositoryPoints || []).map(p => ({
      title: (p.title || '').trim(),
      precedingTransition: (p.precedingTransition || '').trim(),
      explanation: (p.explanation || '').trim(),
      illustration: p.illustration ? {
        type: p.illustration.type || 'cotidiano',
        description: (p.illustration.description || '').trim()
      } : null,
      application: (p.application || '').trim()
    })),
    illustrations: (sermon.illustrations || []).map(i => ({
      type: i.type || 'cotidiano',
      description: (i.description || '').trim()
    })),
    applications: (sermon.applications || []).filter((a): a is string => typeof a === 'string' && a.trim().length > 0),
    conclusion: (sermon.conclusion || '').trim(),
    pastoralAppeal: (sermon.pastoralAppeal || '').trim(),
    date: sermon.date || new Date().toISOString(),
    style: sermon.style || 'original',
    churchProfile: sermon.churchProfile || 'tradicional',
    audience: (sermon.audience || '').trim(),
    bibleVersion: sermon.bibleVersion || 'ACF',
    isOutline: Boolean(sermon.isOutline),
    duration: sermon.duration || '30',
    tags: (sermon.tags || []).filter((t): t is string => typeof t === 'string' && t.trim().length > 0),
    seriesName: (sermon.seriesName || '').trim(),
    hymns: {
      abertura: (sermon.hymns?.abertura || '').trim(),
      antesMensagem: (sermon.hymns?.antesMensagem || '').trim(),
      apelo: (sermon.hymns?.apelo || '').trim(),
      encerramento: (sermon.hymns?.encerramento || '').trim(),
      preferredHinario: sermon.hymns?.preferredHinario || 'CC',
      details: sermon.hymns?.details ? cleanUndefinedRecursively(sermon.hymns.details) : null,
      alternateDetails: sermon.hymns?.alternateDetails ? cleanUndefinedRecursively(sermon.hymns.alternateDetails) : null
    },
    isFavorite: Boolean(sermon.isFavorite),
    isArchived: Boolean(sermon.isArchived),
    updatedAt: Number(sermon.updatedAt) || Date.now()
  };

  if (sermon.evaluation) {
    sanitized.evaluation = {
      faithfulnessScore: Number(sermon.evaluation.faithfulnessScore) || 0,
      faithfulnessComment: sermon.evaluation.faithfulnessComment || '',
      homileticalCoherenceScore: Number(sermon.evaluation.homileticalCoherenceScore) || 0,
      coherenceComment: sermon.evaluation.coherenceComment || '',
      christocentrismScore: Number(sermon.evaluation.christocentrismScore) || 0,
      christocentrismComment: sermon.evaluation.christocentrismComment || '',
      pastoralClarityScore: Number(sermon.evaluation.pastoralClarityScore) || 0,
      clarityComment: sermon.evaluation.clarityComment || '',
      clichesDetected: (sermon.evaluation.clichesDetected || []).filter((c): c is string => typeof c === 'string'),
      clichesWithSuggestions: (sermon.evaluation.clichesWithSuggestions || []).map(c => ({
        cliche: c.cliche || '',
        suggestion: c.suggestion || '',
        section: c.section || ''
      })),
      artificialityWarning: sermon.evaluation.artificialityWarning || '',
      moralismWarning: sermon.evaluation.moralismWarning || '',
      suggestedImprovements: (sermon.evaluation.suggestedImprovements || []).filter((s): s is string => typeof s === 'string')
    };
  }

  if (sermon.history && sermon.history.length > 0) {
    sanitized.history = sermon.history.map(h => ({
      id: h.id || ('hist_' + Date.now()),
      date: h.date || '',
      location: h.location || '',
      event: h.event || '',
      notes: h.notes || ''
    }));
  }

  if (sermon.derivation) {
    sanitized.derivation = cleanUndefinedRecursively({
      mode: sermon.derivation.mode,
      duration: sermon.derivation.duration,
      sourceSermonId: (sermon.derivation.sourceSermonId || '').trim(),
      sourceTitle: (sermon.derivation.sourceTitle || '').trim(),
      sourceScripture: (sermon.derivation.sourceScripture || '').trim(),
      audience: (sermon.derivation.audience || '').trim(),
      derivedAt: Number(sermon.derivation.derivedAt) || Number(sermon.updatedAt) || Date.now()
    });
  }

  return cleanUndefinedRecursively(sanitized);
}

/**
 * Diagnostic helper: Tests live connectivity to Firestore, measures round-trip latency,
 * and counts current documents in pastoral_sermons.
 */
export async function testFirestoreConnection(overrideUid?: string): Promise<{
  connected: boolean;
  latencyMs: number;
  cloudSermonCount: number;
  databaseId: string;
  projectId: string;
  uid: string | null;
  userEmail: string | null;
  error?: string;
}> {
  const uid = getEffectiveUid(overrideUid);
  const userEmail = "meguikalan@gmail.com";
  const result = {
    connected: false,
    latencyMs: 0,
    cloudSermonCount: 0,
    databaseId: firestoreDatabaseId,
    projectId: firebaseProjectId,
    uid,
    userEmail,
    error: undefined as string | undefined
  };

  if (!db) {
    result.error = "Instância do Firestore não está inicializada no cliente.";
    setLastFirestoreError(result.error);
    return result;
  }

  if (!uid) {
    result.error = "Nenhum usuário logado. Faça login com sua conta para acessar pastoral_sermons.";
    setLastFirestoreError(result.error);
    recordSyncLog('status', 'Diagnóstico Firestore: Aguardando login do usuário', 'UID não definido');
    return result;
  }

  const start = performance.now();
  try {
    const colRef = collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION);
    const snapshot = await getDocsFromServer(colRef);
    result.latencyMs = Math.round(performance.now() - start);
    result.connected = true;
    result.cloudSermonCount = snapshot.docs.length;
    setLastFirestoreError(null);
    recordSyncLog('status', `Diagnóstico de conexão com Firestore OK (${result.latencyMs}ms)`, `${result.cloudSermonCount} sermões encontrados em users/${uid}/pastoral_sermons`);
    return result;
  } catch (err: unknown) {
    result.latencyMs = Math.round(performance.now() - start);
    const errMsg = (err instanceof Error) ? err.message : String(err);
    result.error = errMsg;
    setLastFirestoreError(errMsg);
    recordSyncLog('error', `Falha ao testar conexão Firestore (users/${uid}/pastoral_sermons): ${errMsg}`);
    return result;
  }
}

/**
 * Save or Update a single sermon in Firestore across pastoral_sermons collections.
 * Automatically synchronizes changes immediately to other devices.
 * NUNCA ESCONDE ERROS: qualquer falha na gravação é registrada com detalhes e reportada visualmente.
 */
export async function saveSermonToCloud(sermon: Sermon, userId?: string): Promise<boolean> {
  const sermonTitle = sermon?.title || sermon?.scripture || 'Sem título';
  const sermonId = sermon?.id || 'id_indefinido';

  if (!db) {
    const errInfo: FirestoreErrorInfo = {
      code: 'firestore/unavailable',
      message: 'Instância do banco de dados Firestore não foi inicializada no navegador.',
      sermonTitle,
      sermonId,
      timestamp: Date.now()
    };
    notifyFirestoreError(errInfo);
    return false;
  }

  if (!sermon || isSermonBlank(sermon)) {
    console.warn(`[Firestore] Sermão em branco não gravado na nuvem: ${sermonId}`);
    return false;
  }

  const uid = getEffectiveUid(userId);
  if (!uid) {
    const errInfo: FirestoreErrorInfo = {
      code: 'auth/no-user-id',
      message: 'Identificador do pastor (UID) não definido para salvar no Firestore.',
      sermonTitle,
      sermonId,
      timestamp: Date.now()
    };
    notifyFirestoreError(errInfo);
    return false;
  }

  const targetPath = `users/${uid}/${PASTORAL_SERMONS_COLLECTION}/${sermon.id}`;

  try {
    unmarkSermonAsDeleted(sermon.id);
    const updatedTimestamp = sermon.updatedAt || Date.now();
    const data = sanitizeSermonForFirestore({ ...sermon, updatedAt: updatedTimestamp }, uid);

    // 1. Gravação PRINCIPAL OBRIGATÓRIA em users/{uid}/pastoral_sermons/{id}
    // Não utilizamos Promise.allSettled aqui para não mascarar rejeições!
    await setDoc(doc(db, 'users', uid, PASTORAL_SERMONS_COLLECTION, sermon.id), data, { merge: true });

    // 2. Gravações secundárias para compatibilidade de consultas
    try {
      await setDoc(doc(db, 'users', uid, SERMONS_COLLECTION, sermon.id), data, { merge: true });
    } catch (secErr) {
      console.warn(`[Firestore] Aviso não impeditivo na coleção secundária users/${uid}/sermons:`, secErr);
    }

    try {
      await setDoc(doc(db, PASTORAL_SERMONS_COLLECTION, sermon.id), data, { merge: true });
    } catch (secErr) {
      console.warn(`[Firestore] Aviso não impeditivo na coleção raiz pastoral_sermons:`, secErr);
    }

    // 3. Limpeza de tombstones (excluídos prévios com mesmo ID)
    try {
      await deleteDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, sermon.id));
      await deleteDoc(doc(db, TOMBSTONES_COLLECTION, sermon.id));
    } catch {}

    setLastFirestoreError(null);
    recordSyncLog('upload', `Sermão salvo em pastoral_sermons: "${sermonTitle}"`, `ID: ${sermon.id}`);
    return true;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string; name?: string };
    const errorCode = errorObj.code || errorObj.name || 'firestore/save-error';
    const errorMessage = errorObj.message || (err instanceof Error ? err.message : String(err));

    const errInfo: FirestoreErrorInfo = {
      code: errorCode,
      message: errorMessage,
      sermonTitle,
      sermonId,
      path: targetPath,
      timestamp: Date.now()
    };

    // Notifica ativamente a interface gráfica e o console, sem esconder erros
    notifyFirestoreError(errInfo);
    recordSyncLog('error', `Falha ao salvar sermão "${sermonTitle}" no Firestore: [${errorCode}] ${errorMessage}`);
    return false;
  }
}

/**
 * Delete a sermon from Cloud Firestore across pastoral_sermons and propagate tombstone.
 */
export async function deleteSermonFromCloud(sermonId: string, userId?: string): Promise<boolean> {
  if (!sermonId) return false;
  markSermonAsDeleted(sermonId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  try {
    const deleteOps: Promise<void>[] = [
      deleteDoc(doc(db, 'users', uid, PASTORAL_SERMONS_COLLECTION, sermonId)),
      deleteDoc(doc(db, PASTORAL_SERMONS_COLLECTION, sermonId)),
      deleteDoc(doc(db, 'users', uid, SERMONS_COLLECTION, sermonId))
    ];

    const tombstoneOps: Promise<void>[] = [
      setDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, sermonId), {
        id: sermonId,
        deletedAt: Date.now()
      }),
      setDoc(doc(db, TOMBSTONES_COLLECTION, sermonId), {
        id: sermonId,
        userId: uid,
        deletedAt: Date.now()
      }).catch(() => {})
    ];

    await Promise.allSettled([...deleteOps, ...tombstoneOps]);

    setLastFirestoreError(null);
    recordSyncLog('delete', `Sermão excluído de pastoral_sermons (propagado para todos os aparelhos)`, `ID: ${sermonId}`);
    return true;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.error(`[Firestore] Erro ao excluir sermão ${sermonId}:`, err);
    recordSyncLog('error', `Erro ao excluir sermão ${sermonId} no Firestore: ${errMsg}`);
    return false;
  }
}

/**
 * Fetch tombstones (deleted IDs) from users/{uid}/tombstones to keep local deleted cache in sync
 */
export async function syncTombstonesFromCloud(userId?: string): Promise<Set<string>> {
  const localDeleted = getDeletedSermonIds();
  if (!db) return localDeleted;
  const uid = getEffectiveUid(userId);
  if (!uid) return localDeleted;

  try {
    const snapshot = await getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION));
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as { id?: string; entityType?: string };
      if (
        docSnap.id.startsWith('ill_') ||
        docSnap.id.startsWith('sieve_') ||
        docSnap.id.startsWith('topic_') ||
        docSnap.id.startsWith('theme_') ||
        docSnap.id.startsWith('plan_') ||
        data?.entityType === 'illustration' ||
        data?.entityType === 'sieve' ||
        data?.entityType === 'theological_topic' ||
        data?.entityType === 'biblical_theme' ||
        data?.entityType === 'preaching_plan'
      ) {
        return;
      }
      localDeleted.add(data?.id || docSnap.id);
    });
    localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(localDeleted)));
    setLastFirestoreError(null);
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn("[Firestore] Erro ao sincronizar tombstones:", err);
  }
  return localDeleted;
}

/**
 * Fetch all sermons from Cloud Firestore from pastoral_sermons (and legacy collections).
 */
export async function fetchUserSermonsFromCloud(userId?: string): Promise<Sermon[]> {
  if (!db) return [];
  const uid = getEffectiveUid(userId);
  if (!uid) {
    setLastFirestoreError("Usuário não autenticado: faça login para acessar pastoral_sermons.");
    return [];
  }

  try {
    const deletedIds = await syncTombstonesFromCloud(uid);

    // Busca paralela em users/{uid}/pastoral_sermons, pastoral_sermons (where userId == uid) e users/{uid}/sermons
    const [userPastoralSnap, topPastoralSnap, userSermonsSnap] = await Promise.allSettled([
      getDocs(collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION)),
      getDocs(query(collection(db, PASTORAL_SERMONS_COLLECTION), where('userId', '==', uid))),
      getDocs(collection(db, 'users', uid, SERMONS_COLLECTION))
    ]);

    const sermonMap = new Map<string, Sermon>();

    const processSnapshot = (snapRes: PromiseSettledResult<QuerySnapshot<DocumentData>>) => {
      if (snapRes.status === 'fulfilled' && snapRes.value && typeof snapRes.value.forEach === 'function') {
        snapRes.value.forEach((docSnap) => {
          const data = docSnap.data() as Sermon;
          const sermonId = data?.id || docSnap.id;
          if (data && !isSermonBlank(data) && !isModelSermon(data) && !deletedIds.has(sermonId)) {
            const currentItem = sermonMap.get(sermonId);
            const docTime = data.updatedAt || new Date(data.date).getTime() || 0;
            const existingTime = currentItem ? (currentItem.updatedAt || new Date(currentItem.date).getTime() || 0) : -1;
            if (!currentItem || docTime > existingTime) {
              sermonMap.set(sermonId, { ...data, id: sermonId });
            }
          }
        });
      }
    };

    processSnapshot(userPastoralSnap);
    processSnapshot(topPastoralSnap);
    processSnapshot(userSermonsSnap);

    const sermons = Array.from(sermonMap.values());
    sermons.sort((a, b) => {
      const timeA = a.updatedAt || new Date(a.date).getTime() || 0;
      const timeB = b.updatedAt || new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });

    setLastFirestoreError(null);
    recordSyncLog('download', `Acervo baixado de pastoral_sermons (${sermons.length} sermões)`);
    return sermons;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.error(`[Firestore] Erro ao buscar sermões da nuvem:`, err);
    recordSyncLog('error', `Erro ao buscar sermões de pastoral_sermons: ${errMsg}`);
    return [];
  }
}

/**
 * Real-time subscription to sermons & tombstones on Firestore at pastoral_sermons.
 * Automatically synchronizes and mirrors changes across all devices in real-time via onSnapshot.
 */
export function subscribeToUserSermons(
  userId: string | undefined,
  onUpdate: (sermons: Sermon[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) {
    const msg = "Aguardando login do usuário para conectar onSnapshot em pastoral_sermons";
    setLastFirestoreError(msg);
    return null;
  }

  try {
    const cloudTombstones = new Map<string, number>();
    const userPastoralMap = new Map<string, Sermon>();
    const rootPastoralMap = new Map<string, Sermon>();
    const legacySermonsMap = new Map<string, Sermon>();

    const isTombstoned = (id: string, sermon?: Sermon): boolean => {
      if (id.startsWith('ill_') || id.startsWith('sieve_') || id.startsWith('topic_') || id.startsWith('theme_') || id.startsWith('plan_')) return true;
      const deletedAt = cloudTombstones.get(id);
      if (deletedAt === undefined) return false;
      if (!sermon) return true;
      const sermonTime = sermon.updatedAt || new Date(sermon.date).getTime() || 0;
      return deletedAt >= sermonTime;
    };

    const emitAggregatedSermons = () => {
      const consolidatedMap = new Map<string, Sermon>();

      const mergeMapIntoConsolidated = (sourceMap: Map<string, Sermon>) => {
        sourceMap.forEach((sermon, id) => {
          if (!sermon || isSermonBlank(sermon) || isModelSermon(sermon) || isTombstoned(id, sermon)) {
            return;
          }
          const existing = consolidatedMap.get(id);
          if (!existing) {
            consolidatedMap.set(id, sermon);
          } else {
            const existingTime = existing.updatedAt || new Date(existing.date).getTime() || 0;
            const sourceTime = sermon.updatedAt || new Date(sermon.date).getTime() || 0;
            if (sourceTime >= existingTime) {
              consolidatedMap.set(id, sermon);
            }
          }
        });
      };

      mergeMapIntoConsolidated(userPastoralMap);
      mergeMapIntoConsolidated(rootPastoralMap);
      mergeMapIntoConsolidated(legacySermonsMap);

      const consolidatedList = Array.from(consolidatedMap.values());
      consolidatedList.sort((a, b) => {
        const timeA = a.updatedAt || new Date(a.date).getTime() || 0;
        const timeB = b.updatedAt || new Date(b.date).getTime() || 0;
        return timeB - timeA;
      });

      setLastFirestoreError(null);
      recordSyncLog(
        'realtime', 
        `Espelhamento onSnapshot ativo: ${consolidatedList.length} sermões sincronizados em pastoral_sermons`,
        `UID: ${uid}`
      );

      onUpdate(consolidatedList);
    };

    const reportListenerError = (source: string, error: unknown) => {
      const errObj = error as { code?: string; message?: string };
      const code = errObj?.code || 'firestore/listener-error';
      const errMsg = errObj?.message || (error instanceof Error ? error.message : String(error));
      console.error(`[Firestore ${source} Listener]:`, error);
      setLastFirestoreError(`[${code}] ${errMsg}`);
      recordSyncLog('error', `Falha no listener ${source}: [${code}] ${errMsg}`);
      notifyFirestoreError({
        code,
        message: errMsg,
        path: `users/${uid}/${source}`,
        timestamp: Date.now()
      });
      if (onError) onError(error);
    };

    // 1. Ouvinte para tombstones em tempo real
    const tombstoneUnsub = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (tombstoneSnap) => {
        cloudTombstones.clear();
        const localDeleted = getDeletedSermonIds();
        tombstoneSnap.forEach((docSnap) => {
          const data = docSnap.data() as { id?: string; deletedAt?: number; entityType?: string };
          if (
            docSnap.id.startsWith('ill_') ||
            docSnap.id.startsWith('sieve_') ||
            docSnap.id.startsWith('topic_') ||
            docSnap.id.startsWith('theme_') ||
            docSnap.id.startsWith('plan_') ||
            data?.entityType === 'illustration' ||
            data?.entityType === 'sieve' ||
            data?.entityType === 'topic' ||
            data?.entityType === 'theme' ||
            data?.entityType === 'preaching_plan'
          ) {
            return;
          }
          const targetId = data?.id || docSnap.id;
          cloudTombstones.set(targetId, Number(data?.deletedAt) || Date.now());
          localDeleted.add(targetId);
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(localDeleted)));
        } catch {}
        emitAggregatedSermons();
      },
      (err: unknown) => {
        reportListenerError(TOMBSTONES_COLLECTION, err);
      }
    );

    // 2. Ouvinte primário em users/{uid}/pastoral_sermons
    const userPastoralUnsub = onSnapshot(
      collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION),
      (snapshot) => {
        userPastoralMap.clear();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Sermon;
          const sermonId = data?.id || docSnap.id;
          if (data && !isSermonBlank(data) && !isModelSermon(data) && !isTombstoned(sermonId, data)) {
            userPastoralMap.set(sermonId, { ...data, id: sermonId });
          }
        });
        emitAggregatedSermons();
      },
      (error: unknown) => {
        reportListenerError(PASTORAL_SERMONS_COLLECTION, error);
      }
    );

    // 3. Ouvinte em pastoral_sermons top-level filtrado pelo userId
    let rootPastoralUnsub: Unsubscribe = () => {};
    try {
      rootPastoralUnsub = onSnapshot(
        query(collection(db, PASTORAL_SERMONS_COLLECTION), where('userId', '==', uid)),
        (snapshot) => {
          rootPastoralMap.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Sermon;
            const sermonId = data?.id || docSnap.id;
            if (data && !isSermonBlank(data) && !isModelSermon(data) && !isTombstoned(sermonId, data)) {
              rootPastoralMap.set(sermonId, { ...data, id: sermonId });
            }
          });
          emitAggregatedSermons();
        },
        (error: unknown) => {
          console.warn("[Firestore root pastoral_sermons query listener]:", error);
        }
      );
    } catch {}

    // 4. Ouvinte em users/{uid}/sermons (compatibilidade regressiva)
    const legacySermonsUnsub = onSnapshot(
      collection(db, 'users', uid, SERMONS_COLLECTION),
      (snapshot) => {
        legacySermonsMap.clear();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Sermon;
          const sermonId = data?.id || docSnap.id;
          if (data && !isSermonBlank(data) && !isModelSermon(data) && !isTombstoned(sermonId, data)) {
            legacySermonsMap.set(sermonId, { ...data, id: sermonId });
          }
        });
        emitAggregatedSermons();
      },
      (error: unknown) => {
        console.warn("[Firestore legacy sermons listener]:", error);
      }
    );

    return () => {
      try {
        tombstoneUnsub();
        userPastoralUnsub();
        rootPastoralUnsub();
        legacySermonsUnsub();
      } catch {}
    };
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn("[Firestore Real-Time] Falha ao iniciar listener:", err);
    recordSyncLog('error', `Falha ao conectar listener Firestore: ${errMsg}`);
    if (onError) onError(err);
    return null;
  }
}

/**
 * Compare two sermon lists to check if they have identical items and timestamps
 */
export function areSermonListsEqual(listA: Sermon[], listB: Sermon[]): boolean {
  if (listA === listB) return true;
  if (!listA || !listB) return false;
  if (listA.length !== listB.length) return false;

  for (let i = 0; i < listA.length; i++) {
    const a = listA[i];
    const b = listB[i];
    if (a.id !== b.id) return false;
    const timeA = a.updatedAt || new Date(a.date).getTime() || 0;
    const timeB = b.updatedAt || new Date(b.date).getTime() || 0;
    if (timeA !== timeB) return false;
    if (a.title !== b.title) return false;
    if ((a.duration || '') !== (b.duration || '')) return false;
    if ((a.derivation?.mode || '') !== (b.derivation?.mode || '')) return false;
    if ((a.derivation?.duration || '') !== (b.derivation?.duration || '')) return false;
    if (a.isFavorite !== b.isFavorite) return false;
    if (a.isArchived !== b.isArchived) return false;
  }
  return true;
}

/**
 * Smart merge function combining cloud sermons with local sermons.
 * Rule: Preservação da Biblioteca de Sermões.
 * Ensures no local or cloud work is lost across devices while respecting deletions.
 */
export function smartMergeSermons(localSermons: Sermon[], cloudSermons: Sermon[]): Sermon[] {
  const map = new Map<string, Sermon>();
  const deletedIds = getDeletedSermonIds();

  // 1. Inserir todos os sermões locais não excluídos (NUNCA apaga sermões locais válidos)
  for (const localSermon of localSermons) {
    if (!localSermon || isSermonBlank(localSermon) || isModelSermon(localSermon) || deletedIds.has(localSermon.id)) continue;
    map.set(localSermon.id, localSermon);
  }

  // 2. Mesclar sermões da nuvem:
  // - Se não existir localmente e não estiver na lista de deletados, adiciona
  // - Em conflito (mesmo ID), prevalece o sermão com updatedAt mais recente
  for (const cloudSermon of cloudSermons) {
    if (!cloudSermon || isSermonBlank(cloudSermon) || isModelSermon(cloudSermon) || deletedIds.has(cloudSermon.id)) continue;
    
    if (!map.has(cloudSermon.id)) {
      map.set(cloudSermon.id, cloudSermon);
    } else {
      const existingLocal = map.get(cloudSermon.id)!;
      const localTime = existingLocal.updatedAt || new Date(existingLocal.date).getTime() || 0;
      const cloudTime = cloudSermon.updatedAt || new Date(cloudSermon.date).getTime() || 0;
      if (cloudTime > localTime) {
        map.set(cloudSermon.id, cloudSermon);
      }
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    const timeA = a.updatedAt || new Date(a.date).getTime() || 0;
    const timeB = b.updatedAt || new Date(b.date).getTime() || 0;
    return timeB - timeA;
  });

  return merged;
}

/**
 * Save or update an Expository Series in Cloud Firestore at users/{uid}/series/{seriesId}
 */
export async function saveSeriesToCloud(series: ExpositorySeries, userId?: string): Promise<boolean> {
  if (!db || !series) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  try {
    const seriesId = (series.id && series.id.trim()) ? series.id.trim() : `series_${Date.now()}`;
    const docRef = doc(db, 'users', uid, SERIES_COLLECTION, seriesId);
    const data = removeUndefinedFields({
      ...series,
      id: seriesId,
      userId: uid,
      updatedAt: Date.now()
    });
    await setDoc(docRef, data, { merge: true });
    setLastFirestoreError(null);
    recordSyncLog('upload', `Série expositiva salva em users/${uid}/series: "${series.title}"`);
    return true;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.error(`[Firestore] Erro ao salvar série "${series.title}":`, err);
    recordSyncLog('error', `Erro ao salvar série: ${errMsg}`);
    return false;
  }
}

/**
 * Fetch all series from Cloud Firestore at users/{uid}/series
 */
export async function fetchUserSeriesFromCloud(userId?: string): Promise<ExpositorySeries[]> {
  if (!db) return [];
  const uid = getEffectiveUid(userId);
  if (!uid) return [];

  try {
    const snapshot = await getDocs(collection(db, 'users', uid, SERIES_COLLECTION));
    const seriesList: ExpositorySeries[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as ExpositorySeries;
      if (data) seriesList.push(data);
    });
    setLastFirestoreError(null);
    return seriesList;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.error(`[Firestore] Erro ao buscar séries de users/${uid}/series:`, err);
    return [];
  }
}

/**
 * Real-time subscription to series on Firestore at users/{uid}/series
 */
export function subscribeToUserSeries(
  onUpdate: (seriesList: ExpositorySeries[]) => void,
  userId?: string
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    return onSnapshot(
      collection(db, 'users', uid, SERIES_COLLECTION),
      (snapshot) => {
        const seriesList: ExpositorySeries[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ExpositorySeries;
          if (data) seriesList.push(data);
        });
        setLastFirestoreError(null);
        onUpdate(seriesList);
      },
      (err: unknown) => {
        const errMsg = (err instanceof Error) ? err.message : String(err);
        setLastFirestoreError(errMsg);
        console.warn(`[Firestore Real-Time Series Listener users/${uid}/series]:`, err);
      }
    );
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn("[Firestore Real-Time Series Listener] Falha ao iniciar:", err);
    return null;
  }
}

/**
 * Guaranteed synchronization of ALL local sermons to Cloud Firestore at pastoral_sermons.
 * Ensures any sermons present locally but missing in Firestore (or newer) are safely pushed.
 */
export async function syncAllLocalSermonsToCloud(
  providedSermons?: Sermon[], 
  userId?: string
): Promise<{ syncedCount: number; cloudSermons: Sermon[]; cloudCount: number; error?: string }> {
  if (!db) {
    return { syncedCount: 0, cloudSermons: [], cloudCount: 0, error: 'Firestore não inicializado' };
  }
  const uid = getEffectiveUid(userId);
  if (!uid) {
    const errMsg = 'Usuário não autenticado no Firebase: faça login com sua conta para sincronizar sermões com a nuvem.';
    setLastFirestoreError(errMsg);
    return { syncedCount: 0, cloudSermons: [], cloudCount: 0, error: errMsg };
  }

  try {
    let targetList: Sermon[] = providedSermons || [];
    if (targetList.length === 0) {
      const rawSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (rawSaved) {
        try { targetList = JSON.parse(rawSaved); } catch {}
      }
    }

    // 1. Executa busca paralela em alta velocidade (1 único roundtrip)
    const [tombstonesSnap, pastoralSnap, legacySnap] = await Promise.allSettled([
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION)),
      getDocs(collection(db, 'users', uid, PASTORAL_SERMONS_COLLECTION)),
      getDocs(collection(db, 'users', uid, SERMONS_COLLECTION))
    ]);

    if (pastoralSnap.status === 'rejected') {
      const reason = pastoralSnap.reason as { code?: string; message?: string };
      const errMsg = reason?.message || String(pastoralSnap.reason || 'Falha ao consultar Firestore');
      setLastFirestoreError(errMsg);
      recordSyncLog('error', `Falha ao ler acervo na nuvem: ${errMsg}`);
      return { syncedCount: 0, cloudSermons: [], cloudCount: 0, error: errMsg };
    }

    // Reconciliar lista de tombstones (nuvem é autoritativa para exclusões)
    const deletedIds = getDeletedSermonIds();
    const cloudTombstoneTimes = new Map<string, number>();
    if (tombstonesSnap.status === 'fulfilled' && tombstonesSnap.value) {
      tombstonesSnap.value.forEach(docSnap => {
        const data = docSnap.data() as { id?: string; deletedAt?: number; entityType?: string };
        if (
          docSnap.id.startsWith('ill_') ||
          docSnap.id.startsWith('sieve_') ||
          docSnap.id.startsWith('topic_') ||
          docSnap.id.startsWith('theme_') ||
          docSnap.id.startsWith('plan_') ||
          data?.entityType === 'illustration' ||
          data?.entityType === 'sieve' ||
          data?.entityType === 'theological_topic' ||
          data?.entityType === 'biblical_theme' ||
          data?.entityType === 'preaching_plan'
        ) {
          return;
        }
        const targetId = data?.id || docSnap.id;
        deletedIds.add(targetId);
        cloudTombstoneTimes.set(targetId, Number(data?.deletedAt) || Date.now());
      });
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(deletedIds)));
    } catch {}

    // Mapear sermões existentes na nuvem
    const cloudMap = new Map<string, number>();
    const cloudSermonsMap = new Map<string, Sermon>();

    const processSnapshotDocs = (snapRes: PromiseSettledResult<QuerySnapshot<DocumentData>>) => {
      if (snapRes.status === 'fulfilled' && snapRes.value && typeof snapRes.value.forEach === 'function') {
        snapRes.value.forEach(docSnap => {
          const data = docSnap.data() as Sermon;
          if (data) {
            const sermonId = data.id || docSnap.id;
            const docTime = data.updatedAt || new Date(data.date).getTime() || 0;
            const tombTime = cloudTombstoneTimes.get(sermonId);
            if (tombTime !== undefined && tombTime >= docTime) {
              return;
            }
            const prevTime = cloudMap.get(sermonId) || 0;
            if (docTime >= prevTime) {
              cloudMap.set(sermonId, docTime);
              if (!isSermonBlank(data) && !isModelSermon(data) && !deletedIds.has(sermonId)) {
                cloudSermonsMap.set(sermonId, { ...data, id: sermonId });
              }
            }
          }
        });
      }
    };

    processSnapshotDocs(pastoralSnap);
    processSnapshotDocs(legacySnap);

    // Respeita estritamente tombstones (locais e da nuvem) para nunca ressuscitar sermões excluídos
    const validSermons = targetList.filter(s => s && !isSermonBlank(s) && !isModelSermon(s) && !deletedIds.has(s.id));
    const toUpload: { docRef: DocumentReference; data: Record<string, unknown> }[] = [];

    for (const s of validSermons) {
      const localTime = s.updatedAt || new Date(s.date).getTime() || 0;
      const cloudTime = cloudMap.get(s.id) || 0;

      // Upload if doesn't exist in cloud OR local is newer
      if (!cloudMap.has(s.id) || localTime > cloudTime) {
        const data = sanitizeSermonForFirestore(s, uid);
        toUpload.push({ docRef: doc(db, 'users', uid, PASTORAL_SERMONS_COLLECTION, s.id), data });
        toUpload.push({ docRef: doc(db, PASTORAL_SERMONS_COLLECTION, s.id), data });
        toUpload.push({ docRef: doc(db, 'users', uid, SERMONS_COLLECTION, s.id), data });
      }
    }

    if (toUpload.length > 0) {
      const chunkSize = 400;
      for (let i = 0; i < toUpload.length; i += chunkSize) {
        const chunk = toUpload.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const item of chunk) {
          batch.set(item.docRef, item.data, { merge: true });
        }
        await batch.commit();
      }
      setLastFirestoreError(null);
      const uniqueUploaded = Math.round(toUpload.length / 3);
      recordSyncLog('upload', `Sincronização concluída: ${uniqueUploaded} sermões gravados em pastoral_sermons`);
    } else {
      setLastFirestoreError(null);
      recordSyncLog('status', `Acervo local e nuvem em perfeita sincronia (${validSermons.length} locais, ${cloudSermonsMap.size} na nuvem)`);
    }

    const cloudSermons = Array.from(cloudSermonsMap.values());
    cloudSermons.sort((a, b) => {
      const timeA = a.updatedAt || new Date(a.date).getTime() || 0;
      const timeB = b.updatedAt || new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });

    return { 
      syncedCount: Math.round(toUpload.length / 3), 
      cloudSermons, 
      cloudCount: cloudSermons.length 
    };
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.error(`[Firestore SyncAll] Erro ao sincronizar acervo em pastoral_sermons:`, err);
    recordSyncLog('error', `Falha ao sincronizar com o Firestore: ${errMsg}`);
    return { syncedCount: 0, cloudSermons: [], cloudCount: 0, error: errMsg };
  }
}

/**
 * Migration & Fallback: Upload existing localStorage sermons to Firestore on initial boot.
 * Keeps backward compatibility with pastoral_sermons.
 */
export async function migrateLocalSermonsToCloud(userId?: string): Promise<{ migratedCount: number }> {
  const res = await syncAllLocalSermonsToCloud(undefined, userId);
  return { migratedCount: res.syncedCount || 0 };
}

// ==================== ILUSTRAÇÕES HOMILÉTICAS (REAL-TIME SYNC + TOMBSTONES) ====================

export function getDeletedIllustrationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_ILL_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markIllustrationAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedIllustrationIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_ILL_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkIllustrationAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedIllustrationIds();
    if (set.delete(id)) {
      localStorage.setItem(LOCAL_STORAGE_DELETED_ILL_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

/**
 * Save an illustration to Firestore at users/{uid}/illustrations/{id}
 */
export async function saveIllustrationToCloud(illustration: VisualIllustration, userId?: string): Promise<boolean> {
  if (!db) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  try {
    const id = illustration.id || `ill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    unmarkIllustrationAsDeleted(id);
    const docRef = doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, id);
    const sanitized = removeUndefinedFields({
      ...illustration,
      id,
      userId: uid,
      updatedAt: Date.now()
    });
    await setDoc(docRef, sanitized, { merge: true });
    try {
      await deleteDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `ill_${id}`));
    } catch {}
    setLastFirestoreError(null);
    recordSyncLog('upload', `Ilustração gravada em users/${uid}/illustrations: "${illustration.title}"`);
    return true;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn(`[Firestore] Erro ao salvar ilustração em users/${uid}/illustrations:`, err);
    recordSyncLog('error', `Falha ao espelhar ilustração na nuvem: ${errMsg}`);
    return false;
  }
}

/**
 * Delete an illustration from Firestore at users/{uid}/illustrations/{id} with cross-device tombstone
 */
export async function deleteIllustrationFromCloud(illustrationId: string, userId?: string): Promise<boolean> {
  if (!illustrationId) return false;
  markIllustrationAsDeleted(illustrationId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  try {
    await Promise.allSettled([
      deleteDoc(doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, illustrationId)),
      setDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `ill_${illustrationId}`), {
        id: illustrationId,
        entityType: 'illustration',
        deletedAt: Date.now()
      })
    ]);
    setLastFirestoreError(null);
    recordSyncLog('delete', `Ilustração removida em todos os dispositivos: ${illustrationId}`);
    return true;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn(`[Firestore] Erro ao excluir ilustração em users/${uid}/illustrations:`, err);
    return false;
  }
}

/**
 * Fetch all illustrations from Firestore at users/{uid}/illustrations
 */
export async function fetchIllustrationsFromCloud(userId?: string): Promise<VisualIllustration[]> {
  if (!db) return [];
  const uid = getEffectiveUid(userId);
  if (!uid) return [];

  try {
    const [snapshot, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, ILLUSTRATIONS_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);
    const deletedIllIds = getDeletedIllustrationIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('ill_') || data?.entityType === 'illustration') {
        const targetId = data?.id || d.id.replace(/^ill_/, '');
        deletedIllIds.add(targetId);
      }
    });
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_ILL_KEY, JSON.stringify(Array.from(deletedIllIds)));
    } catch {}

    const list: VisualIllustration[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as VisualIllustration;
      if (data && data.title && !deletedIllIds.has(docSnap.id)) {
        list.push({ ...data, id: docSnap.id });
      }
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setLastFirestoreError(null);
    return list;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn(`[Firestore] Erro ao buscar ilustrações de users/${uid}/illustrations:`, err);
    return [];
  }
}

/**
 * Real-time subscription to illustrations and illustration tombstones on Firestore
 */
export function subscribeToIllustrations(
  userId: string | undefined,
  onUpdate: (illustrations: VisualIllustration[], deletedIds: Set<string>) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    const cloudMap = new Map<string, VisualIllustration>();
    const tombstones = new Set<string>(getDeletedIllustrationIds());

    const emit = () => {
      const list = Array.from(cloudMap.values()).filter(item => item.id && !tombstones.has(item.id));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(list, new Set(tombstones));
    };

    const unsubTomb = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (snap) => {
        const localDeleted = getDeletedIllustrationIds();
        tombstones.clear();
        localDeleted.forEach(id => tombstones.add(id));
        snap.forEach(d => {
          const data = d.data() as { id?: string; entityType?: string };
          if (d.id.startsWith('ill_') || data?.entityType === 'illustration') {
            const targetId = data?.id || d.id.replace(/^ill_/, '');
            tombstones.add(targetId);
          }
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_ILL_KEY, JSON.stringify(Array.from(tombstones)));
        } catch {}
        emit();
      },
      (err) => {
        console.warn('[Firestore Illustrations Tombstones Listener]:', err);
      }
    );

    const unsubIll = onSnapshot(
      collection(db, 'users', uid, ILLUSTRATIONS_COLLECTION),
      (snap) => {
        cloudMap.clear();
        snap.forEach(d => {
          const data = d.data() as VisualIllustration;
          if (data && data.title && !tombstones.has(d.id)) {
            cloudMap.set(d.id, { ...data, id: d.id });
          }
        });
        emit();
      },
      (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        setLastFirestoreError(errMsg);
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubTomb(); unsubIll(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Sync all local illustrations to Firestore at users/{uid}/illustrations (respecting deleted tombstones)
 */
export async function syncAllLocalIllustrationsToCloud(localList?: VisualIllustration[], userId?: string): Promise<number> {
  if (!db) return 0;
  const uid = getEffectiveUid(userId);
  if (!uid) return 0;

  try {
    let list = localList;
    if (!list) {
      const raw = localStorage.getItem(LOCAL_STORAGE_ILLUSTRATIONS_KEY);
      list = raw ? JSON.parse(raw) : [];
    }
    if (!list || list.length === 0) return 0;

    const [snapshot, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, ILLUSTRATIONS_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);

    const deletedIllIds = getDeletedIllustrationIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('ill_') || data?.entityType === 'illustration') {
        deletedIllIds.add(data?.id || d.id.replace(/^ill_/, ''));
      }
    });

    const cloudIds = new Set<string>();
    snapshot.forEach(docSnap => cloudIds.add(docSnap.id));

    let uploaded = 0;
    const batch = writeBatch(db);
    for (const ill of list) {
      const id = ill.id || `ill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (!cloudIds.has(id) && !deletedIllIds.has(id)) {
        const docRef = doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, id);
        batch.set(docRef, removeUndefinedFields({ ...ill, id, userId: uid, updatedAt: Date.now() }), { merge: true });
        uploaded++;
      }
    }
    if (uploaded > 0) {
      await batch.commit();
      setLastFirestoreError(null);
      recordSyncLog('upload', `${uploaded} ilustrações gravadas em users/${uid}/illustrations`);
    }
    return uploaded;
  } catch (err: unknown) {
    const errMsg = (err instanceof Error) ? err.message : String(err);
    setLastFirestoreError(errMsg);
    console.warn(`[Firestore] Erro ao sincronizar ilustrações em users/${uid}/illustrations:`, err);
    return 0;
  }
}

// ==================== CONSULTOR BÍBLICO E TEOLÓGICO (ASSUNTOS + REAL-TIME SYNC) ====================

export function getDeletedTopicIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_TOPICS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markTopicAsDeleted(topicId: string): void {
  if (!topicId) return;
  try {
    const set = getDeletedTopicIds();
    set.add(topicId);
    localStorage.setItem(LOCAL_STORAGE_DELETED_TOPICS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function sanitizeChatTopicPayload(topic: TheologicalChatTopic, uid: string): TheologicalChatTopic {
  const safeId = (topic.id || `topic-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const safeTitle = (topic.title || 'Novo Assunto').trim().slice(0, 160) || 'Novo Assunto';
  const payload: TheologicalChatTopic = {
    id: safeId,
    userId: uid,
    title: safeTitle,
    createdAt: Number(topic.createdAt) || Date.now(),
    updatedAt: Number(topic.updatedAt) || Date.now()
  };
  if (topic.passageReference && topic.passageReference.trim()) {
    payload.passageReference = topic.passageReference.trim().slice(0, 120);
  }
  if (topic.lastMessagePreview && topic.lastMessagePreview.trim()) {
    payload.lastMessagePreview = topic.lastMessagePreview.trim().slice(0, 240);
  }
  return payload;
}

export async function saveChatTopicToCloud(topic: TheologicalChatTopic, userId?: string): Promise<boolean> {
  if (!db || !topic || !topic.id) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  const targetPath = `users/${uid}/${THEOLOGICAL_TOPICS_COLLECTION}/${topic.id}`;
  try {
    const payload = sanitizeChatTopicPayload(topic, uid);
    await setDoc(doc(db, 'users', uid, THEOLOGICAL_TOPICS_COLLECTION, payload.id), payload, { merge: true });
    setLastFirestoreError(null);
    recordSyncLog('upload', `Assunto sincronizado no Consultor Bíblico: "${payload.title}"`, `ID: ${payload.id}`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyFirestoreError({
      code: (err as { code?: string })?.code || 'firestore/topic-save-error',
      message: errMsg,
      path: targetPath,
      timestamp: Date.now()
    });
    recordSyncLog('error', `Falha ao salvar assunto do Consultor Bíblico: ${errMsg}`);
    return false;
  }
}

export async function deleteChatTopicFromCloud(topicId: string, userId?: string): Promise<boolean> {
  if (!topicId) return false;
  markTopicAsDeleted(topicId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  const targetPath = `users/${uid}/${THEOLOGICAL_TOPICS_COLLECTION}/${topicId}`;
  try {
    const chatSnap = await getDocs(collection(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION));
    const docsToDelete: DocumentReference<DocumentData>[] = [];
    chatSnap.forEach(d => {
      const data = d.data() as TheologicalChatMessage;
      const effectiveTopicId = data?.topicId || LEGACY_CHAT_TOPIC_ID;
      if (effectiveTopicId === topicId) {
        docsToDelete.push(d.ref);
      }
    });

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, THEOLOGICAL_TOPICS_COLLECTION, topicId));
    batch.set(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `topic_${topicId}`), {
      id: topicId,
      entityType: 'topic',
      deletedAt: Date.now()
    });
    docsToDelete.slice(0, 450).forEach(ref => batch.delete(ref));
    await batch.commit();

    // Se houver mais de 450 mensagens associadas ao assunto, limpa o restante em lotes
    for (let i = 450; i < docsToDelete.length; i += 450) {
      const extraBatch = writeBatch(db);
      docsToDelete.slice(i, i + 450).forEach(ref => extraBatch.delete(ref));
      await extraBatch.commit();
    }

    setLastFirestoreError(null);
    recordSyncLog('delete', `Assunto removido do Consultor Bíblico em todos os dispositivos`, `ID: ${topicId}`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyFirestoreError({
      code: (err as { code?: string })?.code || 'firestore/topic-delete-error',
      message: errMsg,
      path: targetPath,
      timestamp: Date.now()
    });
    recordSyncLog('error', `Erro ao excluir assunto do Consultor Bíblico: ${errMsg}`);
    return false;
  }
}

export async function syncAllLocalTopicsToCloud(topics: TheologicalChatTopic[], userId?: string): Promise<number> {
  if (!db || !topics || topics.length === 0) return 0;
  const uid = getEffectiveUid(userId);
  if (!uid) return 0;

  try {
    const [topicsSnap, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, THEOLOGICAL_TOPICS_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);

    const deletedIds = getDeletedTopicIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('topic_') || data?.entityType === 'topic') {
        deletedIds.add(data?.id || d.id.replace(/^topic_/, ''));
      }
    });

    const cloudMap = new Map<string, number>();
    topicsSnap.forEach(d => {
      const data = d.data() as TheologicalChatTopic;
      cloudMap.set(d.id, Number(data?.updatedAt || 0));
    });

    const toUpload = topics.filter(t => {
      if (!t || !t.id || deletedIds.has(t.id)) return false;
      const cloudUpdatedAt = cloudMap.get(t.id);
      return cloudUpdatedAt === undefined || (t.updatedAt || 0) > cloudUpdatedAt;
    });
    if (toUpload.length === 0) return 0;

    const batch = writeBatch(db);
    for (const topic of toUpload) {
      const payload = sanitizeChatTopicPayload(topic, uid);
      batch.set(doc(db, 'users', uid, THEOLOGICAL_TOPICS_COLLECTION, payload.id), payload, { merge: true });
    }
    await batch.commit();
    setLastFirestoreError(null);
    return toUpload.length;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    return 0;
  }
}

export function subscribeToTheologicalTopics(
  userId: string | undefined,
  onUpdate: (topics: TheologicalChatTopic[], deletedTopicIds: Set<string>) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    const cloudMap = new Map<string, TheologicalChatTopic>();
    const deletedMap = new Map<string, number>();
    getDeletedTopicIds().forEach(id => deletedMap.set(id, Date.now()));

    const isTopicTombstoned = (topicId: string): boolean => {
      return deletedMap.has(topicId);
    };

    const emit = () => {
      const list = Array.from(cloudMap.values()).filter(item => item.id && !isTopicTombstoned(item.id));
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const deletedSet = new Set<string>(deletedMap.keys());
      onUpdate(list, deletedSet);
    };

    const unsubTomb = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (snap) => {
        const localDeleted = getDeletedTopicIds();
        deletedMap.clear();
        localDeleted.forEach(id => deletedMap.set(id, Date.now()));
        snap.forEach(d => {
          const data = d.data() as { id?: string; entityType?: string; deletedAt?: number };
          if (d.id.startsWith('topic_') || data?.entityType === 'topic') {
            const targetId = data?.id || d.id.replace(/^topic_/, '');
            deletedMap.set(targetId, Number(data?.deletedAt) || Date.now());
            localDeleted.add(targetId);
          }
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_TOPICS_KEY, JSON.stringify(Array.from(localDeleted)));
        } catch {}
        emit();
      },
      (err) => {
        console.warn('[Firestore Chat Topics Tombstones Listener]:', err);
      }
    );

    const unsubTopics = onSnapshot(
      query(collection(db, 'users', uid, THEOLOGICAL_TOPICS_COLLECTION), orderBy('updatedAt', 'desc')),
      (snap) => {
        cloudMap.clear();
        snap.forEach(d => {
          const data = d.data() as TheologicalChatTopic;
          if (data && data.title) {
            cloudMap.set(d.id, { ...data, id: data.id || d.id });
          }
        });
        setLastFirestoreError(null);
        emit();
      },
      (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        notifyFirestoreError({
          code: (err as { code?: string })?.code || 'firestore/topics-listener-error',
          message: errMsg,
          path: `users/${uid}/${THEOLOGICAL_TOPICS_COLLECTION}`,
          timestamp: Date.now()
        });
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubTomb(); unsubTopics(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

export async function saveChatMessageToCloud(msg: TheologicalChatMessage, userId?: string): Promise<boolean> {
  if (!db || !msg || msg.id === 'welcome-msg') return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  try {
    const docRef = doc(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION, msg.id);
    const payload = cleanUndefinedRecursively({
      ...msg,
      topicId: msg.topicId || LEGACY_CHAT_TOPIC_ID,
      userId: uid,
      updatedAt: msg.timestamp || Date.now()
    });
    await setDoc(docRef, payload, { merge: true });
    setLastFirestoreError(null);
    recordSyncLog('upload', `Consulta teológica sincronizada em todos os dispositivos`, `ID: ${msg.id}`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    recordSyncLog('error', `Falha ao sincronizar mensagem do Consultor Bíblico: ${errMsg}`);
    return false;
  }
}

export async function clearChatHistoryInCloud(userId?: string): Promise<boolean> {
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  try {
    const clearedAt = Date.now();
    const snapshot = await getDocs(collection(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION));
    const batch = writeBatch(db);
    snapshot.forEach(d => batch.delete(d.ref));
    batch.set(doc(db, 'users', uid, CHAT_META_COLLECTION, 'state'), { clearedAt, updatedAt: clearedAt }, { merge: true });
    await batch.commit();
    setLastFirestoreError(null);
    recordSyncLog('delete', 'Histórico do Consultor Bíblico limpo em todos os dispositivos');
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    recordSyncLog('error', `Erro ao limpar histórico do Consultor Bíblico na nuvem: ${errMsg}`);
    return false;
  }
}

export async function syncAllLocalChatToCloud(messages: TheologicalChatMessage[], userId?: string): Promise<number> {
  if (!db || !messages || messages.length === 0) return 0;
  const uid = getEffectiveUid(userId);
  if (!uid) return 0;

  try {
    const [chatSnap, metaSnap, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION)),
      getDoc(doc(db, 'users', uid, CHAT_META_COLLECTION, 'state')),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);
    const clearedAt = metaSnap.exists() ? Number((metaSnap.data() as { clearedAt?: number })?.clearedAt || 0) : 0;
    const deletedTopics = getDeletedTopicIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('topic_') || data?.entityType === 'topic') {
        deletedTopics.add(data?.id || d.id.replace(/^topic_/, ''));
      }
    });

    const existingIds = new Set<string>();
    chatSnap.forEach(d => existingIds.add(d.id));

    const toUpload = messages.filter(
      m =>
        m &&
        m.id &&
        m.id !== 'welcome-msg' &&
        !existingIds.has(m.id) &&
        (m.timestamp || 0) > clearedAt &&
        !deletedTopics.has(m.topicId || LEGACY_CHAT_TOPIC_ID)
    );
    if (toUpload.length === 0) return 0;

    const batch = writeBatch(db);
    for (const msg of toUpload) {
      const ref = doc(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION, msg.id);
      batch.set(
        ref,
        cleanUndefinedRecursively({
          ...msg,
          topicId: msg.topicId || LEGACY_CHAT_TOPIC_ID,
          userId: uid,
          updatedAt: msg.timestamp || Date.now()
        }),
        { merge: true }
      );
    }
    await batch.commit();
    setLastFirestoreError(null);
    return toUpload.length;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    return 0;
  }
}

export function subscribeToTheologicalChat(
  userId: string | undefined,
  onUpdate: (messages: TheologicalChatMessage[], clearedAt: number) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    let currentMessages: TheologicalChatMessage[] = [];
    let currentClearedAt = 0;

    const emit = () => {
      const filtered = currentMessages
        .filter(m => m && m.id !== 'welcome-msg' && (m.timestamp || 0) > currentClearedAt)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      onUpdate(filtered, currentClearedAt);
    };

    const unsubMeta = onSnapshot(
      doc(db, 'users', uid, CHAT_META_COLLECTION, 'state'),
      (snap) => {
        if (snap.exists()) {
          currentClearedAt = Number((snap.data() as { clearedAt?: number })?.clearedAt || 0);
        }
        emit();
      },
      (err) => {
        console.warn('[Firestore Chat Meta Listener]:', err);
      }
    );

    const unsubChat = onSnapshot(
      query(collection(db, 'users', uid, THEOLOGICAL_CHAT_COLLECTION), orderBy('timestamp', 'asc')),
      (snap) => {
        const list: TheologicalChatMessage[] = [];
        snap.forEach(d => {
          const data = d.data() as TheologicalChatMessage;
          if (data && data.content) {
            list.push({ ...data, id: data.id || d.id, topicId: data.topicId || LEGACY_CHAT_TOPIC_ID });
          }
        });
        currentMessages = list;
        setLastFirestoreError(null);
        emit();
      },
      (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        setLastFirestoreError(errMsg);
        recordSyncLog('error', `Erro no listener do Consultor Bíblico: ${errMsg}`);
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubMeta(); unsubChat(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

// ==================== CRIVO TEOLÓGICO (REAL-TIME SYNC + TOMBSTONES) ====================

export function getDeletedSieveIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_SIEVE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markSieveAsDeleted(id: string): void {
  if (!id) return;
  try {
    const set = getDeletedSieveIds();
    set.add(id);
    localStorage.setItem(LOCAL_STORAGE_DELETED_SIEVE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export async function saveSieveResultToCloud(entry: TheologicalSieveResult, userId?: string): Promise<boolean> {
  if (!db || !entry) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  try {
    const id = entry.id || `sieve-${Date.now()}`;
    const docRef = doc(db, 'users', uid, THEOLOGICAL_SIEVE_COLLECTION, id);
    await setDoc(docRef, cleanUndefinedRecursively({ ...entry, id, userId: uid, updatedAt: entry.createdAt || Date.now() }), { merge: true });
    setLastFirestoreError(null);
    recordSyncLog('upload', `Crivo Teológico sincronizado na nuvem: "${entry.sermonTitle}"`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    return false;
  }
}

export async function deleteSieveResultFromCloud(sieveId: string, userId?: string): Promise<boolean> {
  if (!sieveId) return false;
  markSieveAsDeleted(sieveId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  try {
    await Promise.allSettled([
      deleteDoc(doc(db, 'users', uid, THEOLOGICAL_SIEVE_COLLECTION, sieveId)),
      setDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `sieve_${sieveId}`), {
        id: sieveId,
        entityType: 'sieve',
        deletedAt: Date.now()
      })
    ]);
    setLastFirestoreError(null);
    return true;
  } catch {
    return false;
  }
}

export async function syncAllLocalSieveToCloud(entries: TheologicalSieveResult[], userId?: string): Promise<number> {
  if (!db || !entries || entries.length === 0) return 0;
  const uid = getEffectiveUid(userId);
  if (!uid) return 0;

  try {
    const [snap, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, THEOLOGICAL_SIEVE_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);

    const deletedIds = getDeletedSieveIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('sieve_') || data?.entityType === 'sieve') {
        deletedIds.add(data?.id || d.id.replace(/^sieve_/, ''));
      }
    });

    const cloudIds = new Set<string>();
    snap.forEach(d => cloudIds.add(d.id));

    const toUpload = entries.filter(e => e && e.id && !cloudIds.has(e.id) && !deletedIds.has(e.id));
    if (toUpload.length === 0) return 0;

    const batch = writeBatch(db);
    for (const item of toUpload) {
      batch.set(
        doc(db, 'users', uid, THEOLOGICAL_SIEVE_COLLECTION, item.id),
        cleanUndefinedRecursively({ ...item, userId: uid, updatedAt: item.createdAt || Date.now() }),
        { merge: true }
      );
    }
    await batch.commit();
    return toUpload.length;
  } catch {
    return 0;
  }
}

export function subscribeToTheologicalSieve(
  userId: string | undefined,
  onUpdate: (entries: TheologicalSieveResult[], deletedIds: Set<string>) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    const cloudMap = new Map<string, TheologicalSieveResult>();
    const tombstones = new Set<string>(getDeletedSieveIds());

    const emit = () => {
      const list = Array.from(cloudMap.values()).filter(item => item.id && !tombstones.has(item.id));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(list, new Set(tombstones));
    };

    const unsubTomb = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (snap) => {
        const localDeleted = getDeletedSieveIds();
        tombstones.clear();
        localDeleted.forEach(id => tombstones.add(id));
        snap.forEach(d => {
          const data = d.data() as { id?: string; entityType?: string };
          if (d.id.startsWith('sieve_') || data?.entityType === 'sieve') {
            tombstones.add(data?.id || d.id.replace(/^sieve_/, ''));
          }
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_SIEVE_KEY, JSON.stringify(Array.from(tombstones)));
        } catch {}
        emit();
      },
      (err) => {
        console.warn('[Firestore Sieve Tombstones Listener]:', err);
      }
    );

    const unsubSieve = onSnapshot(
      collection(db, 'users', uid, THEOLOGICAL_SIEVE_COLLECTION),
      (snap) => {
        cloudMap.clear();
        snap.forEach(d => {
          const data = d.data() as TheologicalSieveResult;
          if (data && data.sermonTitle && !tombstones.has(d.id)) {
            cloudMap.set(d.id, { ...data, id: data.id || d.id });
          }
        });
        emit();
      },
      (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        setLastFirestoreError(errMsg);
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubTomb(); unsubSieve(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

// ==================== BANCO DE TEMAS BÍBLICOS GERADOS (REAL-TIME SYNC + TOMBSTONES) ====================

export function getDeletedThemeIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_THEMES_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markThemeAsDeleted(themeId: string): void {
  if (!themeId) return;
  try {
    const set = getDeletedThemeIds();
    set.add(themeId);
    localStorage.setItem(LOCAL_STORAGE_DELETED_THEMES_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkThemeAsDeleted(themeId: string): void {
  if (!themeId) return;
  try {
    const set = getDeletedThemeIds();
    if (set.has(themeId)) {
      set.delete(themeId);
      localStorage.setItem(LOCAL_STORAGE_DELETED_THEMES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

const VALID_THEME_APPROACHES: ThemeApproach[] = ['Expositivo', 'Temático', 'Pastoral', 'Devocional'];
const VALID_THEME_MODES: ThemeGenerationMode[] = ['scripture', 'category', 'topic'];

function sanitizeGeneratedThemePayload(theme: GeneratedHomileticTheme, uid: string): GeneratedHomileticTheme {
  const safeId = (theme.id || `theme_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const safeApproach: ThemeApproach = VALID_THEME_APPROACHES.includes(theme.approach)
    ? theme.approach
    : 'Expositivo';
  const safeMode: ThemeGenerationMode = VALID_THEME_MODES.includes(theme.sourceMode)
    ? theme.sourceMode
    : 'topic';

  const payload: GeneratedHomileticTheme = {
    id: safeId,
    userId: uid,
    title: (theme.title || 'Tema Homilético').trim().slice(0, 200) || 'Tema Homilético',
    scripture: (theme.scripture || 'Salmos 119:105').trim().slice(0, 140) || 'Salmos 119:105',
    approach: safeApproach,
    category: normalizeThemeCategory(theme.category, 'esperança'),
    summary: (theme.summary || '').trim().slice(0, 800) || 'Exposição bíblica e edificação congregacional.',
    application: (theme.application || '').trim().slice(0, 800) || 'Aplicar os princípios bíblicos no cotidiano da igreja.',
    isGenerated: Boolean(theme.isGenerated ?? true),
    isSaved: true,
    sourceMode: safeMode,
    createdAt: Number(theme.createdAt) || Date.now(),
    updatedAt: Number(theme.updatedAt) || Date.now()
  };

  if (theme.sourceInput && theme.sourceInput.trim()) {
    payload.sourceInput = theme.sourceInput.trim().slice(0, 200);
  }
  if (Array.isArray(theme.outlineHints) && theme.outlineHints.length > 0) {
    const cleanedHints = theme.outlineHints
      .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
      .map(h => h.trim().slice(0, 240))
      .slice(0, 8);
    if (cleanedHints.length > 0) {
      payload.outlineHints = cleanedHints;
    }
  }

  return payload;
}

export async function saveGeneratedThemeToCloud(theme: GeneratedHomileticTheme, userId?: string): Promise<boolean> {
  if (!db || !theme) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  const payload = sanitizeGeneratedThemePayload(theme, uid);
  const targetPath = `users/${uid}/${BIBLICAL_THEMES_COLLECTION}/${payload.id}`;

  try {
    unmarkThemeAsDeleted(payload.id);
    await setDoc(doc(db, 'users', uid, BIBLICAL_THEMES_COLLECTION, payload.id), payload, { merge: true });
    try {
      await deleteDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `theme_${payload.id}`));
    } catch {}
    setLastFirestoreError(null);
    recordSyncLog('upload', `Tema bíblico salvo na nuvem: "${payload.title}"`, `ID: ${payload.id}`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyFirestoreError({
      code: (err as { code?: string })?.code || 'firestore/theme-save-error',
      message: errMsg,
      path: targetPath,
      timestamp: Date.now()
    });
    recordSyncLog('error', `Falha ao salvar tema bíblico no Firestore: ${errMsg}`);
    return false;
  }
}

export async function deleteGeneratedThemeFromCloud(themeId: string, userId?: string): Promise<boolean> {
  if (!themeId) return false;
  markThemeAsDeleted(themeId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  const targetPath = `users/${uid}/${BIBLICAL_THEMES_COLLECTION}/${themeId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, BIBLICAL_THEMES_COLLECTION, themeId));
    batch.set(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `theme_${themeId}`), {
      id: themeId,
      entityType: 'theme',
      deletedAt: Date.now()
    });
    await batch.commit();
    setLastFirestoreError(null);
    recordSyncLog('delete', `Tema bíblico removido de todos os dispositivos`, `ID: ${themeId}`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    notifyFirestoreError({
      code: (err as { code?: string })?.code || 'firestore/theme-delete-error',
      message: errMsg,
      path: targetPath,
      timestamp: Date.now()
    });
    return false;
  }
}

export async function syncAllLocalThemesToCloud(themes: GeneratedHomileticTheme[], userId?: string): Promise<number> {
  if (!db || !themes || themes.length === 0) return 0;
  const uid = getEffectiveUid(userId);
  if (!uid) return 0;

  try {
    const [themesSnap, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, BIBLICAL_THEMES_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);

    const deletedIds = getDeletedThemeIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('theme_') || data?.entityType === 'theme') {
        deletedIds.add(data?.id || d.id.replace(/^theme_/, ''));
      }
    });

    const cloudMap = new Map<string, number>();
    themesSnap.forEach(d => {
      const data = d.data() as GeneratedHomileticTheme;
      cloudMap.set(d.id, Number(data?.updatedAt || data?.createdAt || 0));
    });

    const toUpload = themes.filter(t => {
      if (!t || !t.id || deletedIds.has(t.id)) return false;
      const cloudTs = cloudMap.get(t.id);
      return cloudTs === undefined || (t.updatedAt || t.createdAt || 0) > cloudTs;
    });
    if (toUpload.length === 0) return 0;

    const batch = writeBatch(db);
    for (const theme of toUpload) {
      const payload = sanitizeGeneratedThemePayload(theme, uid);
      batch.set(doc(db, 'users', uid, BIBLICAL_THEMES_COLLECTION, payload.id), payload, { merge: true });
    }
    await batch.commit();
    setLastFirestoreError(null);
    return toUpload.length;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setLastFirestoreError(errMsg);
    return 0;
  }
}

export function subscribeToSavedThemes(
  userId: string | undefined,
  onUpdate: (themes: GeneratedHomileticTheme[], deletedThemeIds: Set<string>) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  try {
    const cloudMap = new Map<string, GeneratedHomileticTheme>();
    const tombstones = new Set<string>(getDeletedThemeIds());

    const emit = () => {
      const list = Array.from(cloudMap.values()).filter(item => item.id && !tombstones.has(item.id));
      list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      onUpdate(list, new Set(tombstones));
    };

    const unsubTomb = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (snap) => {
        const localDeleted = getDeletedThemeIds();
        tombstones.clear();
        localDeleted.forEach(id => tombstones.add(id));
        snap.forEach(d => {
          const data = d.data() as { id?: string; entityType?: string };
          if (d.id.startsWith('theme_') || data?.entityType === 'theme') {
            tombstones.add(data?.id || d.id.replace(/^theme_/, ''));
          }
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_THEMES_KEY, JSON.stringify(Array.from(tombstones)));
        } catch {}
        emit();
      },
      (err) => {
        console.warn('[Firestore Themes Tombstones Listener]:', err);
      }
    );

    const unsubThemes = onSnapshot(
      collection(db, 'users', uid, BIBLICAL_THEMES_COLLECTION),
      (snap) => {
        cloudMap.clear();
        snap.forEach(d => {
          const data = d.data() as GeneratedHomileticTheme;
          if (data && data.title && !tombstones.has(d.id)) {
            cloudMap.set(d.id, { ...data, id: data.id || d.id, isSaved: true });
          }
        });
        setLastFirestoreError(null);
        emit();
      },
      (err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        notifyFirestoreError({
          code: (err as { code?: string })?.code || 'firestore/themes-listener-error',
          message: errMsg,
          path: `users/${uid}/${BIBLICAL_THEMES_COLLECTION}`,
          timestamp: Date.now()
        });
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubTomb(); unsubThemes(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

// ==================== PLANEJAMENTO DE PREGAÇÕES (REAL-TIME SYNC + TOMBSTONES) ====================

export enum PreachingFirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function logStructuredPlanFirestoreError(
  error: unknown,
  operationType: PreachingFirestoreOperationType,
  path: string | null
): void {
  const errObj = error as { code?: string; message?: string };
  const errInfo = {
    error: errObj?.message || (error instanceof Error ? error.message : String(error)),
    operationType,
    path,
    authInfo: {
      userId: FIXED_PASTORAL_UID,
      email: 'meguikalan@gmail.com',
      emailVerified: true,
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  notifyFirestoreError({
    code: errObj?.code || `firestore/${operationType}-error`,
    message: errInfo.error,
    path: path || undefined,
    timestamp: Date.now(),
  });
}

export async function testPreachingPlanConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Cliente offline ao verificar conexão.');
    }
  }
}

export function getDeletedPreachingPlanIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_PLANS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markPreachingPlanAsDeleted(planId: string): void {
  if (!planId) return;
  try {
    const set = getDeletedPreachingPlanIds();
    set.add(planId);
    localStorage.setItem(LOCAL_STORAGE_DELETED_PLANS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unmarkPreachingPlanAsDeleted(planId: string): void {
  if (!planId) return;
  try {
    const set = getDeletedPreachingPlanIds();
    if (set.has(planId)) {
      set.delete(planId);
      localStorage.setItem(LOCAL_STORAGE_DELETED_PLANS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

function sanitizePreachingPlanPayload(plan: PreachingPlan, uid: string): PreachingPlan {
  const safeId = (plan.id || `plan_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const rawDate = (plan.date || '').trim();
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().slice(0, 10);
  const safeStatus: PreachingPlanStatus = PREACHING_PLAN_STATUSES.includes(plan.status)
    ? plan.status
    : 'Planejado';
  const safeServiceType = (plan.serviceType || PREACHING_SERVICE_TYPES[0]).trim().slice(0, 80) || PREACHING_SERVICE_TYPES[0];
  const safePreacher = (plan.preacher || '').trim().slice(0, 120);

  const payload: PreachingPlan = {
    id: safeId,
    userId: uid,
    date: safeDate,
    serviceType: safeServiceType,
    preacher: safePreacher,
    status: safeStatus,
    createdAt: Number(plan.createdAt) || Date.now(),
    updatedAt: Number(plan.updatedAt) || Date.now(),
  };

  if (plan.scripture && plan.scripture.trim()) {
    payload.scripture = plan.scripture.trim().slice(0, 180);
  }
  if (plan.themeOrTitle && plan.themeOrTitle.trim()) {
    payload.themeOrTitle = plan.themeOrTitle.trim().slice(0, 200);
  }
  if (plan.seriesName && plan.seriesName.trim()) {
    payload.seriesName = plan.seriesName.trim().slice(0, 140);
  }
  if (plan.linkedSermonId && plan.linkedSermonId.trim()) {
    payload.linkedSermonId = plan.linkedSermonId.trim().slice(0, 128);
  }
  if (plan.linkedSermonTitle && plan.linkedSermonTitle.trim()) {
    payload.linkedSermonTitle = plan.linkedSermonTitle.trim().slice(0, 200);
  }
  if (plan.notes && plan.notes.trim()) {
    payload.notes = plan.notes.trim().slice(0, 2000);
  }

  return cleanUndefinedRecursively(payload);
}

export function smartMergePreachingPlans(
  localPlans: PreachingPlan[],
  cloudPlans: PreachingPlan[],
  deletedIdsOverride?: Set<string>
): PreachingPlan[] {
  const deletedIds = deletedIdsOverride || getDeletedPreachingPlanIds();
  const map = new Map<string, PreachingPlan>();

  for (const localPlan of localPlans) {
    if (!localPlan || !localPlan.id || deletedIds.has(localPlan.id)) continue;
    map.set(localPlan.id, localPlan);
  }

  for (const cloudPlan of cloudPlans) {
    if (!cloudPlan || !cloudPlan.id || deletedIds.has(cloudPlan.id)) continue;
    const existing = map.get(cloudPlan.id);
    if (!existing) {
      map.set(cloudPlan.id, cloudPlan);
    } else {
      const localTs = existing.updatedAt || existing.createdAt || 0;
      const cloudTs = cloudPlan.updatedAt || cloudPlan.createdAt || 0;
      if (cloudTs > localTs) {
        map.set(cloudPlan.id, cloudPlan);
      }
    }
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  return merged;
}

export function arePreachingPlanListsEqual(listA: PreachingPlan[], listB: PreachingPlan[]): boolean {
  if (listA === listB) return true;
  if (!listA || !listB || listA.length !== listB.length) return false;
  for (let i = 0; i < listA.length; i++) {
    const a = listA[i];
    const b = listB[i];
    if (
      a.id !== b.id ||
      a.date !== b.date ||
      a.serviceType !== b.serviceType ||
      a.status !== b.status ||
      a.preacher !== b.preacher ||
      (a.scripture || '') !== (b.scripture || '') ||
      (a.themeOrTitle || '') !== (b.themeOrTitle || '') ||
      (a.seriesName || '') !== (b.seriesName || '') ||
      (a.linkedSermonId || '') !== (b.linkedSermonId || '') ||
      (a.notes || '') !== (b.notes || '') ||
      (a.updatedAt || 0) !== (b.updatedAt || 0)
    ) {
      return false;
    }
  }
  return true;
}

export async function savePreachingPlanToCloud(plan: PreachingPlan, userId?: string): Promise<boolean> {
  if (!db || !plan) return false;
  const uid = getEffectiveUid(userId);
  if (!uid) return false;

  const payload = sanitizePreachingPlanPayload(plan, uid);
  const targetPath = `users/${uid}/${PREACHING_PLANS_COLLECTION}/${payload.id}`;

  try {
    unmarkPreachingPlanAsDeleted(payload.id);
    await setDoc(doc(db, 'users', uid, PREACHING_PLANS_COLLECTION, payload.id), payload);
    try {
      await deleteDoc(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `plan_${payload.id}`));
    } catch {}
    setLastFirestoreError(null);
    recordSyncLog('upload', `Planejamento salvo na nuvem: ${payload.date} (${payload.serviceType})`, `ID: ${payload.id}`);
    return true;
  } catch (err: unknown) {
    logStructuredPlanFirestoreError(err, PreachingFirestoreOperationType.WRITE, targetPath);
    recordSyncLog('error', `Falha ao salvar planejamento no Firestore: ${targetPath}`);
    return false;
  }
}

export async function deletePreachingPlanFromCloud(planId: string, userId?: string): Promise<boolean> {
  if (!planId) return false;
  markPreachingPlanAsDeleted(planId);
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  const targetPath = `users/${uid}/${PREACHING_PLANS_COLLECTION}/${planId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, PREACHING_PLANS_COLLECTION, planId));
    batch.set(doc(db, 'users', uid, TOMBSTONES_COLLECTION, `plan_${planId}`), {
      id: planId,
      entityType: 'preaching_plan',
      deletedAt: Date.now()
    });
    await batch.commit();
    setLastFirestoreError(null);
    recordSyncLog('delete', `Planejamento removido de todos os dispositivos`, `ID: ${planId}`);
    return true;
  } catch (err: unknown) {
    logStructuredPlanFirestoreError(err, PreachingFirestoreOperationType.DELETE, targetPath);
    return false;
  }
}

export async function syncAllLocalPreachingPlansToCloud(
  plans: PreachingPlan[],
  userId?: string
): Promise<{ syncedCount: number; cloudPlans: PreachingPlan[] }> {
  if (!db) return { syncedCount: 0, cloudPlans: [] };
  const uid = getEffectiveUid(userId);
  if (!uid) return { syncedCount: 0, cloudPlans: [] };

  const targetPath = `users/${uid}/${PREACHING_PLANS_COLLECTION}`;
  try {
    const [plansSnap, tombSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, PREACHING_PLANS_COLLECTION)),
      getDocs(collection(db, 'users', uid, TOMBSTONES_COLLECTION))
    ]);

    const deletedIds = getDeletedPreachingPlanIds();
    tombSnap.forEach(d => {
      const data = d.data() as { id?: string; entityType?: string };
      if (d.id.startsWith('plan_') || data?.entityType === 'preaching_plan') {
        deletedIds.add(data?.id || d.id.replace(/^plan_/, ''));
      }
    });
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_PLANS_KEY, JSON.stringify(Array.from(deletedIds)));
    } catch {}

    const cloudPlans: PreachingPlan[] = [];
    const cloudTimestamps = new Map<string, number>();
    plansSnap.forEach(d => {
      const data = d.data() as PreachingPlan;
      const planId = data?.id || d.id;
      if (data && data.date && !deletedIds.has(planId)) {
        cloudPlans.push({ ...data, id: planId });
        cloudTimestamps.set(planId, Number(data.updatedAt || data.createdAt || 0));
      }
    });

    const toUpload = (plans || []).filter(p => {
      if (!p || !p.id || deletedIds.has(p.id)) return false;
      const cloudTs = cloudTimestamps.get(p.id);
      return cloudTs === undefined || (p.updatedAt || p.createdAt || 0) > cloudTs;
    });

    if (toUpload.length > 0) {
      const batch = writeBatch(db);
      for (const plan of toUpload) {
        const payload = sanitizePreachingPlanPayload(plan, uid);
        batch.set(doc(db, 'users', uid, PREACHING_PLANS_COLLECTION, payload.id), payload);
      }
      await batch.commit();
      recordSyncLog('upload', `${toUpload.length} planejamento(s) sincronizado(s) para a nuvem`);
    }

    setLastFirestoreError(null);
    return { syncedCount: toUpload.length, cloudPlans };
  } catch (err: unknown) {
    logStructuredPlanFirestoreError(err, PreachingFirestoreOperationType.LIST, targetPath);
    return { syncedCount: 0, cloudPlans: [] };
  }
}

export function subscribeToPreachingPlans(
  userId: string | undefined,
  onUpdate: (plans: PreachingPlan[], deletedPlanIds: Set<string>) => void,
  onError?: (error: unknown) => void
): Unsubscribe | null {
  if (!db) return null;
  const uid = getEffectiveUid(userId);
  if (!uid) return null;

  const targetPath = `users/${uid}/${PREACHING_PLANS_COLLECTION}`;
  try {
    const cloudMap = new Map<string, PreachingPlan>();
    const tombstones = new Set<string>(getDeletedPreachingPlanIds());

    const emit = () => {
      const list = Array.from(cloudMap.values()).filter(item => item.id && !tombstones.has(item.id));
      list.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
      onUpdate(list, new Set(tombstones));
    };

    const unsubTomb = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (snap) => {
        const localDeleted = getDeletedPreachingPlanIds();
        tombstones.clear();
        localDeleted.forEach(id => tombstones.add(id));
        snap.forEach(d => {
          const data = d.data() as { id?: string; entityType?: string };
          if (d.id.startsWith('plan_') || data?.entityType === 'preaching_plan') {
            tombstones.add(data?.id || d.id.replace(/^plan_/, ''));
          }
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_PLANS_KEY, JSON.stringify(Array.from(tombstones)));
        } catch {}
        emit();
      },
      (err) => {
        console.warn('[Firestore Plans Tombstones Listener]:', err);
      }
    );

    const unsubPlans = onSnapshot(
      collection(db, 'users', uid, PREACHING_PLANS_COLLECTION),
      (snap) => {
        cloudMap.clear();
        snap.forEach(d => {
          const data = d.data() as PreachingPlan;
          const planId = data?.id || d.id;
          if (data && data.date && !tombstones.has(planId)) {
            cloudMap.set(planId, { ...data, id: planId });
          }
        });
        setLastFirestoreError(null);
        recordSyncLog('realtime', `Planejamento sincronizado (${cloudMap.size} registro(s))`, `UID: ${uid}`);
        emit();
      },
      (err) => {
        logStructuredPlanFirestoreError(err, PreachingFirestoreOperationType.LIST, targetPath);
        if (onError) onError(err);
      }
    );

    return () => {
      try { unsubTomb(); unsubPlans(); } catch {}
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}


