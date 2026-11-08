import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query,
  where,
  onSnapshot, 
  writeBatch,
  firestoreDatabaseId,
  firebaseProjectId,
  type Unsubscribe,
  type DocumentReference,
  type DocumentData,
  type QuerySnapshot
} from '../firebase';
import { Sermon, ExpositorySeries, VisualIllustration } from '../types';

export const PASTORAL_SERMONS_COLLECTION = 'pastoral_sermons';
export const SERMONS_COLLECTION = 'sermons';
export const SERIES_COLLECTION = 'series';
export const TOMBSTONES_COLLECTION = 'tombstones';
export const ILLUSTRATIONS_COLLECTION = 'illustrations';
export const LOCAL_STORAGE_KEY = 'pastoral_sermons';
export const LOCAL_STORAGE_DELETED_KEY = 'pastoral_deleted_sermon_ids';
export const LOCAL_STORAGE_ILLUSTRATIONS_KEY = 'pastoral_visual_illustrations';

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
      encerramento: (sermon.hymns?.encerramento || '').trim()
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
    const snapshot = await getDocs(colRef);
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
      localDeleted.add(docSnap.id);
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
    const cloudTombstoneIds = new Set<string>();
    const userPastoralMap = new Map<string, Sermon>();
    const rootPastoralMap = new Map<string, Sermon>();
    const legacySermonsMap = new Map<string, Sermon>();

    const emitAggregatedSermons = () => {
      const consolidatedMap = new Map<string, Sermon>();

      const mergeMapIntoConsolidated = (sourceMap: Map<string, Sermon>) => {
        sourceMap.forEach((sermon, id) => {
          if (!sermon || isSermonBlank(sermon) || isModelSermon(sermon) || cloudTombstoneIds.has(id)) {
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

    // 1. Ouvinte para tombstones em tempo real
    const tombstoneUnsub = onSnapshot(
      collection(db, 'users', uid, TOMBSTONES_COLLECTION),
      (tombstoneSnap) => {
        cloudTombstoneIds.clear();
        const localDeleted = getDeletedSermonIds();
        tombstoneSnap.forEach((docSnap) => {
          cloudTombstoneIds.add(docSnap.id);
          localDeleted.add(docSnap.id);
        });
        try {
          localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(localDeleted)));
        } catch {}
        emitAggregatedSermons();
      },
      (err: unknown) => {
        const errMsg = (err instanceof Error) ? err.message : String(err);
        setLastFirestoreError(errMsg);
        console.warn("[Firestore Tombstones Listener]:", err);
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
          if (data && !isSermonBlank(data) && !isModelSermon(data)) {
            unmarkSermonAsDeleted(sermonId);
            userPastoralMap.set(sermonId, { ...data, id: sermonId });
          }
        });
        emitAggregatedSermons();
      },
      (error: unknown) => {
        console.warn("[Firestore user pastoral_sermons listener]:", error);
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
            if (data && !isSermonBlank(data) && !isModelSermon(data)) {
              unmarkSermonAsDeleted(sermonId);
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
          if (data && !isSermonBlank(data) && !isModelSermon(data)) {
            unmarkSermonAsDeleted(sermonId);
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

  // 1. Inserir todos os sermões locais primeiro (NUNCA apaga sermões locais)
  for (const localSermon of localSermons) {
    if (!localSermon || isSermonBlank(localSermon) || isModelSermon(localSermon)) continue;
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
    const docRef = doc(db, 'users', uid, SERIES_COLLECTION, series.id);
    const data = removeUndefinedFields({
      ...series,
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

    // Reconciliar lista de tombstones
    const deletedIds = getDeletedSermonIds();
    if (tombstonesSnap.status === 'fulfilled' && tombstonesSnap.value) {
      tombstonesSnap.value.forEach(docSnap => deletedIds.add(docSnap.id));
    }

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

    // Se um sermão local tiver conteúdo real, desmarca qualquer deletedId residual
    for (const s of targetList) {
      if (s && !isSermonBlank(s) && !isModelSermon(s)) {
        if (deletedIds.has(s.id)) {
          deletedIds.delete(s.id);
          unmarkSermonAsDeleted(s.id);
        }
      }
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_DELETED_KEY, JSON.stringify(Array.from(deletedIds)));
    } catch {}

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
  return (await syncAllLocalSermonsToCloud(undefined, userId)).syncedCount !== undefined 
    ? { migratedCount: (await syncAllLocalSermonsToCloud(undefined, userId)).syncedCount }
    : { migratedCount: 0 };
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
    const docRef = doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, id);
    const sanitized = removeUndefinedFields({
      ...illustration,
      id,
      updatedAt: Date.now()
    });
    await setDoc(docRef, sanitized, { merge: true });
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
 * Delete an illustration from Firestore at users/{uid}/illustrations/{id}
 */
export async function deleteIllustrationFromCloud(illustrationId: string, userId?: string): Promise<boolean> {
  if (!db) return true;
  const uid = getEffectiveUid(userId);
  if (!uid) return true;

  try {
    const docRef = doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, illustrationId);
    await deleteDoc(docRef);
    setLastFirestoreError(null);
    recordSyncLog('delete', `Ilustração removida de users/${uid}/illustrations: ${illustrationId}`);
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
    const snapshot = await getDocs(collection(db, 'users', uid, ILLUSTRATIONS_COLLECTION));
    const list: VisualIllustration[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as VisualIllustration;
      if (data && data.title) {
        list.push({ ...data, id: docSnap.id });
      }
    });
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
 * Sync all local illustrations to Firestore at users/{uid}/illustrations
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

    const snapshot = await getDocs(collection(db, 'users', uid, ILLUSTRATIONS_COLLECTION));
    const cloudIds = new Set<string>();
    snapshot.forEach(docSnap => cloudIds.add(docSnap.id));

    let uploaded = 0;
    const batch = writeBatch(db);
    for (const ill of list) {
      const id = ill.id || `ill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (!cloudIds.has(id)) {
        const docRef = doc(db, 'users', uid, ILLUSTRATIONS_COLLECTION, id);
        batch.set(docRef, removeUndefinedFields({ ...ill, id, updatedAt: Date.now() }), { merge: true });
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
