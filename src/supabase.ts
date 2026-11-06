import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Sermon } from './types';
import { recordSyncLog } from './services/sermonStorage';

const STORAGE_KEY_URL = 'pastoral_supabase_url';
const STORAGE_KEY_ANON = 'pastoral_supabase_anon_key';
const STORAGE_KEY_PROVIDER = 'pastoral_sync_provider'; // 'firestore' | 'supabase' | 'both'

export type SyncProvider = 'firestore' | 'supabase' | 'both';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getActiveSyncProvider(): SyncProvider {
  try {
    const val = localStorage.getItem(STORAGE_KEY_PROVIDER) as SyncProvider;
    if (val === 'supabase' || val === 'both' || val === 'firestore') return val;
  } catch {}
  return 'firestore'; // Padrão seguro inicial
}

export function setActiveSyncProvider(provider: SyncProvider): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  } catch {}
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = '';
  let anonKey = '';

  try {
    url = localStorage.getItem(STORAGE_KEY_URL) || (import.meta.env.VITE_SUPABASE_URL as string) || '';
    anonKey = localStorage.getItem(STORAGE_KEY_ANON) || (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
  } catch {}

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isConfigured: Boolean(url && anonKey)
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
  } catch (err) {
    console.error('Erro ao salvar credenciais do Supabase:', err);
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_ANON);
  } catch {}
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    cachedUrl = config.url;
    cachedKey = config.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

/**
 * Testa a conexão com o Supabase e verifica acesso à tabela 'sermons'
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  sermonCount: number;
  tableExists: boolean;
  error?: string;
}> {
  const startTime = Date.now();
  const client = getSupabaseClient();

  if (!client) {
    return {
      connected: false,
      latencyMs: 0,
      sermonCount: 0,
      tableExists: false,
      error: 'URL ou Chave Anon do Supabase não configuradas.'
    };
  }

  try {
    // Tenta consultar a tabela sermons
    const { data, error, count } = await client
      .from('sermons')
      .select('id', { count: 'exact', head: true });

    const latencyMs = Date.now() - startTime;

    if (error) {
      // Se o erro for de tabela inexistente (código 42P01 em Postgres)
      if (error.code === '42P01' || error.message?.includes('relation "sermons" does not exist')) {
        recordSyncLog('status', 'Conectado ao Supabase, mas a tabela "sermons" ainda não foi criada', error.message);
        return {
          connected: true,
          latencyMs,
          sermonCount: 0,
          tableExists: false,
          error: 'Tabela "sermons" ainda não existe no seu projeto Supabase.'
        };
      }

      recordSyncLog('error', 'Falha ao consultar tabela no Supabase', error.message);
      return {
        connected: false,
        latencyMs,
        sermonCount: 0,
        tableExists: false,
        error: error.message
      };
    }

    recordSyncLog('status', 'Conexão Supabase estabelecida com sucesso', `Latência: ${latencyMs}ms | Registros: ${count ?? 0}`);
    return {
      connected: true,
      latencyMs,
      sermonCount: count ?? 0,
      tableExists: true
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    recordSyncLog('error', 'Exceção ao conectar com Supabase', err.message || String(err));
    return {
      connected: false,
      latencyMs,
      sermonCount: 0,
      tableExists: false,
      error: err.message || 'Erro desconhecido ao conectar com Supabase'
    };
  }
}

/**
 * Busca sermões armazenados no Supabase
 */
export async function fetchSermonsFromSupabase(): Promise<Sermon[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('sermons')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar sermões do Supabase:', error);
      return [];
    }

    if (!data || !Array.isArray(data)) return [];

    return data.map((row: any) => {
      // Se o conteúdo completo do sermão foi salvo como JSON ou campos mapeados
      if (row.payload && typeof row.payload === 'object') {
        return row.payload as Sermon;
      }
      return {
        id: row.id,
        title: row.title || 'Sem título',
        theme: row.theme || '',
        scripture: row.main_passage || row.mainPassage || row.scripture || '',
        introduction: row.introduction || row.content || '',
        biblicalContext: row.biblicalContext || '',
        expositoryPoints: row.expositoryPoints || [],
        illustrations: row.illustrations || [],
        applications: row.applications || [],
        conclusion: row.conclusion || '',
        pastoralAppeal: row.pastoralAppeal || '',
        date: row.date || row.created_at || row.createdAt || new Date().toISOString(),
        style: row.style || 'original',
        churchProfile: row.churchProfile || 'tradicional',
        audience: row.audience || '',
        bibleVersion: row.bibleVersion || 'ACF',
        isOutline: Boolean(row.isOutline),
        duration: String(row.estimated_duration_minutes || row.estimatedDurationMinutes || row.duration || '30'),
        tags: row.tags || [],
        seriesName: row.series_title || row.seriesTitle || row.seriesName,
        isFavorite: Boolean(row.isFavorite),
        isArchived: Boolean(row.isArchived),
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
      } as unknown as Sermon;
    });
  } catch (err) {
    console.error('Falha ao processar sermões do Supabase:', err);
    return [];
  }
}

/**
 * Salva ou atualiza um sermão no Supabase
 */
export async function saveSermonToSupabase(sermon: Sermon): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const row = {
      id: sermon.id,
      title: sermon.title,
      theme: sermon.theme || '',
      main_passage: sermon.scripture || (sermon as any).mainPassage || '',
      content: sermon.introduction || (sermon as any).content || '',
      series_title: sermon.seriesName || (sermon as any).seriesTitle || null,
      estimated_duration_minutes: parseInt(sermon.duration || '30', 10) || 30,
      updated_at: new Date().toISOString(),
      payload: sermon
    };

    const { error } = await client
      .from('sermons')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      recordSyncLog('error', `Falha ao salvar sermão "${sermon.title}" no Supabase`, error.message);
      return false;
    }

    recordSyncLog('upload', `Sermão "${sermon.title}" sincronizado no Supabase`);
    return true;
  } catch (err: any) {
    recordSyncLog('error', `Exceção ao salvar no Supabase`, err.message || String(err));
    return false;
  }
}

/**
 * Remove um sermão do Supabase
 */
export async function deleteSermonFromSupabase(sermonId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('sermons')
      .delete()
      .eq('id', sermonId);

    if (error) {
      recordSyncLog('error', `Erro ao remover sermão ${sermonId} do Supabase`, error.message);
      return false;
    }

    recordSyncLog('delete', `Sermão ${sermonId} excluído no Supabase`);
    return true;
  } catch (err: any) {
    recordSyncLog('error', `Falha ao deletar no Supabase`, err.message);
    return false;
  }
}

/**
 * Sincroniza todos os sermões locais para o Supabase
 */
export async function syncAllLocalSermonsToSupabase(sermonsToUpload: Sermon[]): Promise<{
  successCount: number;
  totalCount: number;
}> {
  const client = getSupabaseClient();
  if (!client) return { successCount: 0, totalCount: sermonsToUpload.length };

  let successCount = 0;
  for (const sermon of sermonsToUpload) {
    const ok = await saveSermonToSupabase(sermon);
    if (ok) successCount++;
  }

  return {
    successCount,
    totalCount: sermonsToUpload.length
  };
}

/**
 * Inscrição em tempo real para alterações na tabela 'sermons' do Supabase
 */
export function subscribeToSupabaseSermons(
  onUpdate: (sermons: Sermon[]) => void
): (() => void) | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('public:sermons')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sermons' },
        async (payload) => {
          recordSyncLog('realtime', `Evento Supabase em tempo real: ${payload.eventType}`);
          const freshSermons = await fetchSermonsFromSupabase();
          onUpdate(freshSermons);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          recordSyncLog('status', 'Canal em tempo real do Supabase ativo (WebSocket postgres_changes)');
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.error('Erro ao subscrever em tempo real no Supabase:', err);
    return null;
  }
}
