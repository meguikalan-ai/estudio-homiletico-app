import { Sermon, VisualIllustration } from '../types';
import { 
  smartMergeSermons, 
  areSermonListsEqual,
  getDeletedSermonIds,
  isSermonBlank,
  saveSermonToCloud,
  deleteSermonFromCloud,
  fetchUserSermonsFromCloud,
  syncAllLocalSermonsToCloud,
  subscribeToUserSermons,
  syncTombstonesFromCloud,
  recordSyncLog,
  saveIllustrationToCloud,
  deleteIllustrationFromCloud,
  fetchIllustrationsFromCloud,
  syncAllLocalIllustrationsToCloud
} from './sermonStorage';
import type { Unsubscribe } from '../firebase';

export interface DeviceSyncPackage {
  version: number;
  appId: 'estudio-homiletico';
  exportedAt: number;
  deviceInfo?: string;
  sermons: Sermon[];
  illustrations: VisualIllustration[];
  deletedSermonIds?: string[];
}

/**
 * Creates a compact Base64 sync code containing the full sermon library and visual illustrations.
 */
export function createSyncCode(sermons: Sermon[], illustrations: VisualIllustration[]): string {
  const cleanSermons = (sermons || []).filter(s => !isSermonBlank(s));
  const cleanIllustrations = illustrations || [];
  const deletedIds = Array.from(getDeletedSermonIds());

  const pkg: DeviceSyncPackage = {
    version: 1,
    appId: 'estudio-homiletico',
    exportedAt: Date.now(),
    deviceInfo: typeof navigator !== 'undefined' 
      ? (navigator.userAgent.includes('Mobile') ? 'Dispositivo Móvel' : 'Computador') 
      : 'Dispositivo Web',
    sermons: cleanSermons,
    illustrations: cleanIllustrations,
    deletedSermonIds: deletedIds
  };

  const jsonString = JSON.stringify(pkg);
  // Safe UTF-8 Base64 encoding
  const base64 = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (_, p1) => 
    String.fromCharCode(parseInt(p1, 16))
  ));

  return `ESTUDIO_SYNC_v1:${base64}`;
}

/**
 * Parses and verifies a Base64 sync code string.
 */
export function parseSyncCode(code: string): DeviceSyncPackage {
  const clean = code.trim();
  let base64 = clean;
  if (clean.startsWith('ESTUDIO_SYNC_v1:')) {
    base64 = clean.replace('ESTUDIO_SYNC_v1:', '').trim();
  }

  // Safe UTF-8 Base64 decoding
  const jsonString = decodeURIComponent(
    Array.prototype.map.call(atob(base64), (c: string) => 
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  );

  const parsed = JSON.parse(jsonString) as DeviceSyncPackage;
  if (!parsed || parsed.appId !== 'estudio-homiletico' || !Array.isArray(parsed.sermons)) {
    throw new Error('Código de sincronização inválido ou incompatível.');
  }
  return parsed;
}

/**
 * Merges an incoming sync package with the current device's local state without data loss.
 */
export function mergeSyncPackage(
  pkg: DeviceSyncPackage,
  currentSermons: Sermon[],
  currentIllustrations: VisualIllustration[]
): {
  mergedSermons: Sermon[];
  mergedIllustrations: VisualIllustration[];
  sermonsAddedCount: number;
  illustrationsAddedCount: number;
} {
  // 1. Merge sermons using smartMergeSermons
  const mergedSermons = smartMergeSermons(currentSermons, pkg.sermons);
  const currentSermonIds = new Set(currentSermons.map(s => s.id));
  const sermonsAddedCount = mergedSermons.filter(s => !currentSermonIds.has(s.id)).length;

  // 2. Merge illustrations
  const illMap = new Map<string, VisualIllustration>();
  (currentIllustrations || []).forEach(ill => {
    const key = ill.id || ill.title;
    illMap.set(key, ill);
  });

  let illustrationsAddedCount = 0;
  (pkg.illustrations || []).forEach(incoming => {
    const key = incoming.id || incoming.title;
    if (!illMap.has(key)) {
      illMap.set(key, incoming);
      illustrationsAddedCount++;
    } else {
      const existing = illMap.get(key)!;
      if ((incoming.createdAt || 0) > (existing.createdAt || 0)) {
        illMap.set(key, incoming);
      }
    }
  });

  const mergedIllustrations = Array.from(illMap.values());
  return {
    mergedSermons,
    mergedIllustrations,
    sermonsAddedCount,
    illustrationsAddedCount
  };
}

/**
 * Exports a full backup file in formatted JSON.
 */
export function exportBackupJSON(sermons: Sermon[], illustrations: VisualIllustration[]): void {
  const pkg: DeviceSyncPackage = {
    version: 1,
    appId: 'estudio-homiletico',
    exportedAt: Date.now(),
    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web',
    sermons: sermons.filter(s => !isSermonBlank(s)),
    illustrations: illustrations || [],
    deletedSermonIds: Array.from(getDeletedSermonIds())
  };
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `estudio-homiletico-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses an uploaded JSON backup file.
 */
export async function parseBackupFile(file: File): Promise<DeviceSyncPackage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as DeviceSyncPackage;
        if (!parsed || parsed.appId !== 'estudio-homiletico' || !Array.isArray(parsed.sermons)) {
          throw new Error('O arquivo selecionado não é um backup válido do Estúdio Homilético.');
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de backup.'));
    reader.readAsText(file);
  });
}

/**
 * Saves a sermon to Firestore cloud persistence and records telemetry
 */
export async function syncSermonToCloud(sermon: Sermon, userId?: string): Promise<boolean> {
  return saveSermonToCloud(sermon, userId);
}

/**
 * Permanently deletes a sermon and propagates tombstone across all devices
 */
export async function deleteSermonFromCloudSync(sermonId: string, userId?: string): Promise<boolean> {
  return deleteSermonFromCloud(sermonId, userId);
}

/**
 * Fetches all sermons from Firestore
 */
export async function fetchSermonsFromCloudSync(userId?: string): Promise<Sermon[]> {
  return fetchUserSermonsFromCloud(userId);
}

/**
 * Pushes all pending local sermons to Firestore
 */
export async function syncAllLocalSermonsToCloudSync(
  sermons?: Sermon[],
  userId?: string
): Promise<{ syncedCount: number; error?: string }> {
  return syncAllLocalSermonsToCloud(sermons, userId);
}

/**
 * Establishes real-time listener for sermons on Firestore
 */
export function subscribeToSermonsRealtime(
  onUpdate: (sermons: Sermon[]) => void,
  onError?: (error: unknown) => void,
  userId?: string
): Unsubscribe | null {
  return subscribeToUserSermons(userId, onUpdate, onError);
}

/**
 * Performs full automatic Smart Merge initialization:
 * Reconciles local sermons with cloud sermons, resolves conflicts by latest timestamp,
 * updates localStorage, pushes missing items to cloud, and returns consolidated state.
 * Crucial: NEVER deletes local sermons during merge.
 */
export async function performInitialSermonSmartSync(
  currentLocalSermons: Sermon[],
  userId?: string
): Promise<{
  mergedSermons: Sermon[];
  hasRemoteChanges: boolean;
  addedFromCloudCount: number;
  syncedToCloudCount: number;
}> {
  try {
    let localList = currentLocalSermons;
    const saved = localStorage.getItem('pastoral_sermons');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localList = smartMergeSermons(currentLocalSermons, parsed);
        }
      } catch {}
    }

    const pushResult = await syncAllLocalSermonsToCloud(localList, userId);
    const merged = smartMergeSermons(localList, pushResult.cloudSermons || []);
    const localIds = new Set(localList.map(s => s.id));
    const addedFromCloudCount = merged.filter(s => !localIds.has(s.id)).length;
    const hasRemoteChanges = !areSermonListsEqual(localList, merged);

    try {
      localStorage.setItem('pastoral_sermons', JSON.stringify(merged));
    } catch (err) {
      console.warn('[SyncService] Erro ao persistir sermões mesclados:', err);
    }

    return {
      mergedSermons: merged,
      hasRemoteChanges,
      addedFromCloudCount,
      syncedToCloudCount: pushResult.syncedCount
    };
  } catch (err) {
    console.warn('[SyncService] Falha ao executar Smart Merge inicial:', err);
    return {
      mergedSermons: currentLocalSermons,
      hasRemoteChanges: false,
      addedFromCloudCount: 0,
      syncedToCloudCount: 0
    };
  }
}
