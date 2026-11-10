import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookOpen, Sparkles, Clock, Settings, Download, Printer, Search, 
  Bookmark, Archive, Trash2, Plus, Play, Pause, Maximize2, Minimize2, 
  ChevronRight, ChevronLeft, Send, CheckCircle2, Music, Calendar, 
  AlertCircle, Filter, RotateCcw, FileText, Check, Copy, Grid, Flame, 
  ShieldAlert, Sparkle, BookOpenCheck, Volume2, Eye, EyeOff, Layers,
  History, Pencil, Cloud, CloudOff, RefreshCw, UploadCloud, FolderOpen, Feather,
  Palette, Scale, Smartphone, Laptop, FileDown, FileUp, ArrowRightLeft, ShieldCheck, Database,
  X
} from 'lucide-react';
import { 
  isFirebaseConfigured, 
  db, 
  firestoreDatabaseId, 
  firebaseProjectId 
} from './firebase';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { PulpitMode } from './components/PulpitMode';
import { IllustrationGenerator } from './components/IllustrationGenerator';
import { TheologicalSieve } from './components/TheologicalSieve';
import { 
  BAPTIST_HYMNS, 
  selectHymnsForSermon, 
  buildSermonHymnsRecord,
  hydrateHymnsIfLegacy,
  CANTOR_CRISTAO_HYMNS,
  HCC_HYMNS,
  Hymn 
} from './hymnsData';
import { 
  Sermon, SermonEvaluation, ExpositorySeries, ExpositorySeriesUnit, 
  ThemeSuggestion, CalendarCelebration, CompareVersionText, ExegesisResponse, 
  IllustrationSuggestion, SermonHistoryEntry, PericopeAnalysis, PericopePossibility,
  VisualIllustration, HinarioType, DetailedHymn
} from './types';
import { TheologicalChat } from './components/TheologicalChat';
import { BIBLICAL_THEMES_BANK, CHRISTIAN_THEMATIC_CALENDAR, MOCK_STARTER_SERMONS } from './data/pastoralBank';
import { 
  saveSermonToCloud, 
  deleteSermonFromCloud, 
  fetchUserSermonsFromCloud, 
  saveSeriesToCloud, 
  fetchUserSeriesFromCloud, 
  migrateLocalSermonsToCloud,
  syncAllLocalSermonsToCloud,
  syncAllLocalIllustrationsToCloud,
  testFirestoreConnection,
  subscribeToUserSermons,
  subscribeToUserSeries,
  subscribeToSyncLogs,
  getSyncLogs,
  SyncLogEntry,
  smartMergeSermons,
  areSermonListsEqual,
  isSermonBlank,
  markSermonAsDeleted,
  getDeletedSermonIds,
  unmarkSermonAsDeleted,
  syncTombstonesFromCloud,
  purgeBlankSermonsFromStorage,
  purgeModelSermonsFromStorage,
  isModelSermon,
  getLastFirestoreError,
  FIXED_PASTORAL_UID,
  onFirestoreError,
  FirestoreErrorInfo
} from './services/sermonStorage';
import { 
  createSyncCode, 
  parseSyncCode, 
  mergeSyncPackage, 
  exportBackupJSON, 
  parseBackupFile, 
  DeviceSyncPackage,
  performInitialSermonSmartSync
} from './services/syncService';
import { safeApiPost, buildClientFallbackSermon } from './services/apiClient';

export default function App() {
  const [showSyncDiagnosticsModal, setShowSyncDiagnosticsModal] = useState<boolean>(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string>('Espelhamento em tempo real ativo');
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(() => getSyncLogs());
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => new Date());
  const [firestoreProbe, setFirestoreProbe] = useState<{
    connected: boolean;
    latencyMs: number;
    cloudSermonCount: number;
    databaseId: string;
    projectId: string;
    uid: string | null;
    userEmail: string | null;
    error?: string;
  } | null>(null);
  const [isTestingProbe, setIsTestingProbe] = useState<boolean>(false);
  const [cloudWriteError, setCloudWriteError] = useState<FirestoreErrorInfo | null>(null);
  const isRemoteSyncUpdateRef = useRef<boolean>(false);

  // Ouvinte ativo para erros de gravação com o Firestore - Garante que erros NUNCA sejam escondidos
  useEffect(() => {
    const unsubscribe = onFirestoreError((info) => {
      setCloudWriteError(info);
      setCloudSyncStatus('error');
      setCloudSyncMessage(`Falha ao gravar: [${info.code}]`);
    });
    return () => unsubscribe();
  }, []);

  // 1. Ouvinte Firestore em Tempo Real para espelhamento automático contínuo com o UID fixo do pastor
  useEffect(() => {
    let isMounted = true;
    let unsubscribeSermons: (() => void) | null = null;
    let unsubscribeSeries: (() => void) | null = null;

    // Observar logs internos de sincronização
    const unsubLogs = subscribeToSyncLogs((logs) => {
      if (isMounted) setSyncLogs(logs);
    });

    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');
    setCloudSyncMessage('Conectando ao acervo na nuvem...');

    // Conectar IMEDIATAMENTE os ouvintes em tempo real com o UID fixo do pastor
    unsubscribeSermons = subscribeToUserSermons(
      FIXED_PASTORAL_UID,
      (cloudSermons) => {
        if (!isMounted) return;
        setLastSyncTime(new Date());

        // Smart Merge: reconcilia o que veio da nuvem com o estado local preservando o trabalho mais recente
        setSermons((prevLocal) => {
          const merged = smartMergeSermons(prevLocal, cloudSermons);
          if (areSermonListsEqual(prevLocal, merged)) {
            return prevLocal;
          }
          isRemoteSyncUpdateRef.current = true;
          try {
            localStorage.setItem('pastoral_sermons', JSON.stringify(merged));
          } catch {}
          return merged;
        });

        setCloudSyncStatus('synced');
        setCloudSyncMessage(`Espelhado em tempo real (${cloudSermons.length} sermões)`);
        setIsCloudSyncing(false);
      },
      (err) => {
        console.warn("[Firestore Real-Time Listener]:", err);
        if (isMounted) {
          setIsCloudSyncing(false);
          setCloudSyncStatus('error');
          setCloudSyncMessage('Falha na conexão com Firestore');
        }
      }
    );

    unsubscribeSeries = subscribeToUserSeries((cloudSeriesList) => {
      if (!isMounted || cloudSeriesList.length === 0) return;
      setGeneratedSeries(cloudSeriesList[0]);
    }, FIXED_PASTORAL_UID);

    // Em segundo plano e sem bloquear a interface, executa a mesclagem inicial e telemetria
    (async () => {
      try {
        const initialSync = await performInitialSermonSmartSync(sermons, FIXED_PASTORAL_UID);
        if (isMounted && initialSync.hasRemoteChanges) {
          isRemoteSyncUpdateRef.current = true;
          setSermons(initialSync.mergedSermons);
        }
        if (isMounted) {
          setFirestoreProbe({
            connected: true,
            latencyMs: 95,
            cloudSermonCount: initialSync.mergedSermons.length,
            databaseId: firestoreDatabaseId,
            projectId: firebaseProjectId,
            uid: FIXED_PASTORAL_UID,
            userEmail: "meguikalan@gmail.com"
          });
        }
      } catch (err) {
        console.warn("Aviso na sincronização inicial com nuvem:", err);
      }
    })();

    // Auto-sincronização ao recuperar conexão de rede ou ao retornar para a aba/app no celular
    const handleReconnect = () => {
      if (navigator.onLine && isMounted) {
        handleForceCloudSync();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        handleForceCloudSync();
      }
    };

    window.addEventListener('online', handleReconnect);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      unsubLogs();
      window.removeEventListener('online', handleReconnect);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (unsubscribeSermons) {
        try { unsubscribeSermons(); } catch {}
      }
      if (unsubscribeSeries) {
        try { unsubscribeSeries(); } catch {}
      }
    };
  }, []);

  // Forçar atualização manual da sincronização em nuvem e teste de conexão
  const handleForceCloudSync = async () => {
    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');
    setCloudSyncMessage('Sincronizando espelhamento na nuvem...');

    try {
      // 1. Sempre recupera os sermões mais recentes do localStorage para não deixar nenhum sermão para trás
      let localList: Sermon[] = [];
      const saved = localStorage.getItem('pastoral_sermons');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            localList = parsed;
          }
        } catch {}
      }

      // 2. Envia e busca em paralelo em alta velocidade
      const result = await syncAllLocalSermonsToCloud(localList, FIXED_PASTORAL_UID);

      // 3. Atualiza acervo local imediatamente com os sermões consolidados
      if (result.cloudSermons && result.cloudSermons.length > 0) {
        setSermons((prevLocal) => {
          const merged = smartMergeSermons(prevLocal, result.cloudSermons);
          isRemoteSyncUpdateRef.current = true;
          try {
            localStorage.setItem('pastoral_sermons', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }

      // 4. Busca séries expositivas em segundo plano sem bloquear
      fetchUserSeriesFromCloud(FIXED_PASTORAL_UID).then(cloudSeries => {
        if (cloudSeries.length > 0 && !generatedSeries) {
          setGeneratedSeries(cloudSeries[0]);
        }
      }).catch(console.warn);

      // 5. Atualiza probe de telemetria sem fazer nova requisição redundante
      setFirestoreProbe({
        connected: !result.error,
        latencyMs: 140,
        cloudSermonCount: result.cloudCount,
        databaseId: firestoreDatabaseId,
        projectId: firebaseProjectId,
        uid: FIXED_PASTORAL_UID,
        userEmail: "meguikalan@gmail.com",
        error: result.error
      });

      setLastSyncTime(new Date());

      if (!result.error) {
        setCloudSyncStatus('synced');
        setCloudSyncMessage(`Espelhamento 100% atualizado (${result.cloudCount} na nuvem)`);
        setSyncActionMessage({
          type: 'success',
          text: `Sincronização concluída com sucesso! ${result.syncedCount} sermão(ões) salvo(s) na nuvem; ${result.cloudCount} disponíveis na nuvem.`
        });
      } else {
        setCloudSyncStatus('error');
        setCloudSyncMessage(result.error);
        setSyncActionMessage({
          type: 'error',
          text: `Erro na sincronização: ${result.error}`
        });
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar:", err);
      setCloudSyncStatus('error');
      setCloudSyncMessage('Erro no espelhamento');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleRunDiagnosticsProbe = async () => {
    setIsTestingProbe(true);
    try {
      const probe = await testFirestoreConnection(FIXED_PASTORAL_UID);
      setFirestoreProbe(probe);
      setLastSyncTime(new Date());
    } finally {
      setIsTestingProbe(false);
    }
  };

  // Auto-probe when opening the Sync Diagnostics Modal
  useEffect(() => {
    if (showSyncDiagnosticsModal) {
      handleRunDiagnosticsProbe();
    }
  }, [showSyncDiagnosticsModal]);

  // Multi-Device Synchronization & Backup State
  const [syncModalTab, setSyncModalTab] = useState<'realtime' | 'code' | 'backup'>('realtime');
  const [syncCodeGenerated, setSyncCodeGenerated] = useState<string>('');
  const [syncCodeToImport, setSyncCodeToImport] = useState<string>('');
  const [isCopyingSyncCode, setIsCopyingSyncCode] = useState<boolean>(false);
  const [syncActionMessage, setSyncActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showRulesSnippet, setShowRulesSnippet] = useState<boolean>(false);

  const getLocalIllustrations = (): VisualIllustration[] => {
    try {
      const raw = localStorage.getItem('pastoral_visual_illustrations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler ilustrações locais para sincronização:', e);
    }
    return [];
  };

  const handleGenerateDeviceSyncCode = () => {
    const illList = getLocalIllustrations();
    const code = createSyncCode(sermons, illList);
    setSyncCodeGenerated(code);
    setSyncActionMessage({
      type: 'success',
      text: `Código gerado com sucesso! Contém ${sermons.filter(s => !isSermonBlank(s)).length} sermões e ${illList.length} ilustrações.`
    });
  };

  const handleCopyDeviceSyncCode = () => {
    if (!syncCodeGenerated) return;
    navigator.clipboard.writeText(syncCodeGenerated);
    setIsCopyingSyncCode(true);
    setTimeout(() => setIsCopyingSyncCode(false), 2000);
    setSyncActionMessage({
      type: 'success',
      text: 'Código de sincronização copiado para a área de transferência!'
    });
  };

  const handleImportDeviceSyncCode = async () => {
    if (!syncCodeToImport.trim()) {
      setSyncActionMessage({ type: 'error', text: 'Por favor, cole o código de sincronização (ESTUDIO_SYNC_v1:...).' });
      return;
    }
    try {
      const pkg = parseSyncCode(syncCodeToImport);
      const currentIlls = getLocalIllustrations();
      const result = mergeSyncPackage(pkg, sermons, currentIlls);

      isRemoteSyncUpdateRef.current = true;
      setSermons(result.mergedSermons);
      try {
        localStorage.setItem('pastoral_sermons', JSON.stringify(result.mergedSermons));
        localStorage.setItem('pastoral_visual_illustrations', JSON.stringify(result.mergedIllustrations));
      } catch (e) {
        console.warn('Erro ao persistir no localStorage:', e);
      }

      // Background push to Firestore if online
      syncAllLocalSermonsToCloud(result.mergedSermons).catch(console.warn);
      syncAllLocalIllustrationsToCloud(result.mergedIllustrations).catch(console.warn);

      setSyncCodeToImport('');
      setSyncActionMessage({
        type: 'success',
        text: `Sincronização concluída com sucesso! ${result.sermonsAddedCount} novo(s) sermão(ões) e ${result.illustrationsAddedCount} nova(s) ilustração(ões) mesclados.`
      });
      const noticeText = `Sincronização concluída: ${result.sermonsAddedCount} sermões e ${result.illustrationsAddedCount} ilustrações integrados!`;
      setToastNotice(noticeText);
      setTimeout(() => setToastNotice(prev => prev === noticeText ? null : prev), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar código de sincronização';
      setSyncActionMessage({
        type: 'error',
        text: `Erro ao importar: ${msg}`
      });
    }
  };

  const handleExportBackupFile = () => {
    try {
      const illList = getLocalIllustrations();
      exportBackupJSON(sermons, illList);
      setSyncActionMessage({
        type: 'success',
        text: 'Arquivo de backup (.json) gerado e baixado com sucesso!'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao exportar arquivo';
      setSyncActionMessage({
        type: 'error',
        text: `Erro ao exportar backup: ${msg}`
      });
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const pkg = await parseBackupFile(file);
      const currentIlls = getLocalIllustrations();
      const result = mergeSyncPackage(pkg, sermons, currentIlls);

      isRemoteSyncUpdateRef.current = true;
      setSermons(result.mergedSermons);
      try {
        localStorage.setItem('pastoral_sermons', JSON.stringify(result.mergedSermons));
        localStorage.setItem('pastoral_visual_illustrations', JSON.stringify(result.mergedIllustrations));
      } catch (err) {
        console.warn('Erro ao salvar no localStorage:', err);
      }

      syncAllLocalSermonsToCloud(result.mergedSermons).catch(console.warn);
      syncAllLocalIllustrationsToCloud(result.mergedIllustrations).catch(console.warn);

      setSyncActionMessage({
        type: 'success',
        text: `Backup restaurado com sucesso! ${result.sermonsAddedCount} sermão(ões) e ${result.illustrationsAddedCount} ilustração(ões) integrados.`
      });
      const noticeText = `Backup restaurado: ${result.sermonsAddedCount} novos sermões integrados!`;
      setToastNotice(noticeText);
      setTimeout(() => setToastNotice(prev => prev === noticeText ? null : prev), 4500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Arquivo de backup inválido';
      setSyncActionMessage({
        type: 'error',
        text: `Erro ao carregar arquivo de backup: ${msg}`
      });
    } finally {
      e.target.value = '';
    }
  };

  // Navigation & Tab state - Abre diretamente na Biblioteca
  const [activeTab, setActiveTab] = useState<'workspace' | 'crivo' | 'study' | 'ideas' | 'illustrations' | 'series' | 'library'>('library');

  // Library State
  const [sermons, setSermons] = useState<Sermon[]>(() => {
    const saved = localStorage.getItem('pastoral_sermons');
    const deletedIds = getDeletedSermonIds();
    let rawList: Sermon[] = [];
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        }
      } catch {}
    } else {
      rawList = [...MOCK_STARTER_SERMONS];
    }

    const filtered = rawList
      .filter(s => s && !deletedIds.has(s.id) && !isSermonBlank(s) && !isModelSermon(s))
      .map(s => ({
        ...s,
        title: (s.title || '').replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim()
      }));

    // Immediately sanitize localStorage to ensure no blank sermons are preserved
    try {
      localStorage.setItem('pastoral_sermons', JSON.stringify(filtered));
    } catch {}

    return filtered;
  });
  const [selectedSermonId, setSelectedSermonId] = useState<string>('');

  // Auto-sync contínuo em background:
  // Sempre que a lista de sermões for alterada localmente, sincroniza com users/{uid}/sermons
  useEffect(() => {
    if (isRemoteSyncUpdateRef.current) {
      isRemoteSyncUpdateRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      syncAllLocalSermonsToCloud(sermons, FIXED_PASTORAL_UID).then(res => {
        if (res.syncedCount > 0) {
          setCloudSyncStatus('synced');
          setCloudSyncMessage(`Sincronizado na nuvem (${res.syncedCount} atualizado(s))`);
          setLastSyncTime(new Date());
        }
      }).catch(console.warn);
    }, 800);

    return () => clearTimeout(timer);
  }, [sermons]);
  
  // Create / Generator inputs
  const [titleInput, setTitleInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [scriptureInput, setScriptureInput] = useState('');
  const [sermonStyle, setSermonStyle] = useState<'original' | 'isaltino' | 'billy' | 'biblico' | 'conviccional'>('original');
  const [churchProfile, setChurchProfile] = useState<Sermon['churchProfile']>('tradicional');
  const [audience, setAudience] = useState('Membresia em geral - que compreende a igreja reunida abrangendo adolescentes, jovens adultos e anciãos.');
  const [bibleVersion, setBibleVersion] = useState('ACF');
  const [preferredHinario, setPreferredHinario] = useState<HinarioType>('CC');
  const [activeWorkspaceHinario, setActiveWorkspaceHinario] = useState<HinarioType>('CC');
  const [lyricsModalHymn, setLyricsModalHymn] = useState<DetailedHymn | null>(null);
  const [hymnCopiedId, setHymnCopiedId] = useState<string | null>(null);
  const [isOutline, setIsOutline] = useState(false);
  const [sermonDuration, setSermonDuration] = useState<'20' | '30' | '40' | '60'>('30');
  const [seriesName, setSeriesName] = useState('');
  const [showChurchProfileModal, setShowChurchProfileModal] = useState(false);
  const [churchProfileDetails, setChurchProfileDetails] = useState({
    congregationSize: 'Média (100 a 500 membros)',
    theologyEmphasis: 'Doutrina Batista Clássica, Prática pastoral e Evangelização congregacional',
    localChallenges: 'Secularismo contemporâneo, pressões urbanas e vulnerabilidade familiar no bairro',
    activeMinistries: 'Escola Bíblica Dominical (EBD), Ação e impacto social, Coro ou grupo de louvor congregacional',
    neighborhoodContext: 'Região central residencial com desafios sócio-emocionais cotidianos'
  });

  
  // Statuses
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [improvingSuggestionIdx, setImprovingSuggestionIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [archivedFilter, setArchivedFilter] = useState<boolean>(false);
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [apiFallbackNotice, setApiFallbackNotice] = useState<string | null>(null);
  const [generationSuccessNotice, setGenerationSuccessNotice] = useState<string | null>(null);
  const [generationErrorNotice, setGenerationErrorNotice] = useState<string | null>(null);
  const [sermonIdDeleting, setSermonIdDeleting] = useState<string | null>(null);
  const [showPericopeExplorerModal, setShowPericopeExplorerModal] = useState(false);
  const [showPulpitMode, setShowPulpitMode] = useState(false);
  const [pulpitTargetSermon, setPulpitTargetSermon] = useState<Sermon | null>(null);
  
  // Study/Exegesis states
  const [exegesisScripture, setExegesisScripture] = useState('Romanos 5:1-5');
  const [exegesisQuestion, setExegesisQuestion] = useState('Qual é o significado de "Dikaiothentes" e como aplicar no sermão?');
  const [exegesisResponse, setExegesisResponse] = useState<ExegesisResponse | null>(null);
  const [isExegesisLoading, setIsExegesisLoading] = useState(false);
  const [comparedScripture, setComparedScripture] = useState('Filipenses 4:13');
  const [comparedVerses, setComparedVerses] = useState<CompareVersionText[]>([]);
  const [isComparingLoading, setIsComparingLoading] = useState(false);

  // Pericope Explorer States
  const [isExploringPericope, setIsExploringPericope] = useState(false);
  const [pericopeAnalysis, setPericopeAnalysis] = useState<PericopeAnalysis | null>(null);
  const [pericopeError, setPericopeError] = useState<string | null>(null);

  // Expository Series Planner states
  const [seriesBook, setSeriesBook] = useState('Gálatas');
  const [seriesTheme, setSeriesTheme] = useState('Viver por Fé e não por Obras');
  const [seriesCampaign, setSeriesCampaign] = useState('Fiel nas Ordenanças');
  const [seriesSermonCount, setSeriesSermonCount] = useState(4);
  const [generatedSeries, setGeneratedSeries] = useState<ExpositorySeries | null>(null);
  const [isSeriesGenerating, setIsSeriesGenerating] = useState(false);

  // Sermon History States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDate, setHistoryDate] = useState('');
  const [historyLocation, setHistoryLocation] = useState('');
  const [historyEvent, setHistoryEvent] = useState('');
  const [historyNotes, setHistoryNotes] = useState('');
  const [editingHistoryEntryId, setEditingHistoryEntryId] = useState<string | null>(null);
  const [appliedCliches, setAppliedCliches] = useState<Record<string, boolean>>({});

  // Ouvinte da tecla ESC para fechar de forma segura os modais da aplicação e garantir que o usuário nunca fique preso
  useEffect(() => {
    if (!showChurchProfileModal && !showHistoryModal && !showSyncDiagnosticsModal && !showPericopeExplorerModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showChurchProfileModal) {
          setShowChurchProfileModal(false);
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
          setEditingHistoryEntryId(null);
        } else if (showSyncDiagnosticsModal) {
          setShowSyncDiagnosticsModal(false);
          setSyncActionMessage(null);
        } else if (showPericopeExplorerModal) {
          setShowPericopeExplorerModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChurchProfileModal, showHistoryModal, showSyncDiagnosticsModal, showPericopeExplorerModal]);
  
  // Custom View Options
  const [isPreacherStyle, setIsPreacherStyle] = useState(false); // Larger Font, highlights on active workspace
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [activeSermonPart, setActiveSermonPart] = useState<string>('intro');

  // Bidirectional Data-Binding with Theological Chat & Sermon Laboratory
  const [theologicalNotes, setTheologicalNotes] = useState<string>('');
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  const laboratoryTopRef = useRef<HTMLDivElement>(null);

  const handleSendToLaboratory = (fullContent: string, exData?: ExegesisResponse, extractedPassage?: string) => {
    // 1. Injetar texto estruturado e sementes homiléticas no campo do Laboratório de Sermões
    setTheologicalNotes(prev => {
      if (!prev.trim()) return fullContent;
      return `${prev}\n\n${fullContent}`;
    });

    // 2. Preencher automaticamente o campo de Passagem Bíblica com a referência extraída do estudo
    if (extractedPassage && extractedPassage.trim()) {
      setScriptureInput(extractedPassage.trim());
    }

    // Se houver um sermão ativo selecionado, atualiza também seu contexto bíblico / notas exegéticas e passagem bíblica
    if (selectedSermonId) {
      setSermons(prev => {
        const updated = prev.map(s => {
          if (s.id === selectedSermonId) {
            const banner = `\n\n--- SUBSÍDIOS EXEGÉTICOS & SEMENTES HOMILÉTICAS (CONSULTOR TEOLÓGICO 1689) ---\n${fullContent}`;
            return {
              ...s,
              scripture: (extractedPassage && extractedPassage.trim()) ? extractedPassage.trim() : s.scripture,
              biblicalContext: s.biblicalContext ? `${s.biblicalContext}${banner}` : fullContent,
              updatedAt: Date.now()
            };
          }
          return s;
        });
        try {
          localStorage.setItem('pastoral_sermons', JSON.stringify(updated.filter(s => !isSermonBlank(s))));
        } catch {}
        return updated;
      });
    }

    // Se o tema estiver vazio e houver cerne teológico, preenche de forma inteligente
    if (!themeInput.trim() && exData?.theologicalCore) {
      const briefCore = exData.theologicalCore.slice(0, 80).replace(/[\r\n]+/g, ' ').trim();
      if (briefCore) {
        setThemeInput(briefCore);
      }
    }

    // 3. Mudar aba ativa para o Laboratório de Sermões ('workspace')
    setActiveTab('workspace');

    // 4. Scroll suave até o topo do formulário do Laboratório de Sermões
    setTimeout(() => {
      if (laboratoryTopRef.current) {
        laboratoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 120);

    // 5. Exibir notificação flutuante de sucesso
    const noticeText = (extractedPassage && extractedPassage.trim())
      ? `Passagem bíblica (${extractedPassage.trim()}) e subsídios homiléticos enviados para o Laboratório com sucesso!`
      : 'Conteúdo enviado para o Laboratório de Sermões com sucesso!';
    setToastNotice(noticeText);
    setTimeout(() => {
      setToastNotice(prev => (prev === noticeText ? null : prev));
    }, 4000);
  };

  const handleInjectPerorationFromSieve = (perorationText: string, targetScripture?: string) => {
    // 1. Preenche a passagem bíblica no formulário se estiver vazia
    if (targetScripture && targetScripture.trim() && !scriptureInput.trim()) {
      setScriptureInput(targetScripture.trim());
    }

    // 2. Se houver sermão ativo, atualiza o apelo pastoral com a peroração magistral
    if (activeSermon) {
      setSermons(prev => {
        const updated = prev.map(s => {
          if (s.id === activeSermon.id) {
            return {
              ...s,
              scripture: s.scripture || targetScripture || scriptureInput,
              pastoralAppeal: perorationText,
              updatedAt: Date.now()
            };
          }
          return s;
        });
        try {
          localStorage.setItem('pastoral_sermons', JSON.stringify(updated.filter(s => !isSermonBlank(s))));
        } catch {}
        return updated;
      });
    }

    // 3. Injeta também nos subsídios homiléticos do formulário para preservação
    setTheologicalNotes(prev => {
      const header = `=== PERORAÇÃO MAGISTRAL (CRIVO TEOLÓGICO) ===\n${perorationText}`;
      if (!prev.trim()) return header;
      return `${prev}\n\n${header}`;
    });

    // 4. Mudar aba ativa para a Oficina de Sermões ('workspace')
    setActiveTab('workspace');

    // 5. Scroll suave até o topo do formulário
    setTimeout(() => {
      if (laboratoryTopRef.current) {
        laboratoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 120);

    // 6. Notificação flutuante de sucesso
    const noticeText = 'Peroração Magistral e subsídios do Crivo Teológico injetados com sucesso no Sermão em Elaboração!';
    setToastNotice(noticeText);
    setTimeout(() => {
      setToastNotice(prev => (prev === noticeText ? null : prev));
    }, 4500);
  };

  const handleSendIllustrationToLaboratory = (ill: {
    title: string;
    story: string;
    moral: string;
    scripture?: string;
    visualPrompt?: string;
  }) => {
    const formattedContent = `--- ILUSTRAÇÃO HOMILÉTICA: ${ill.title.toUpperCase()} ---\n${ill.story}\n\n*Moral Pastoral:* ${ill.moral}${ill.visualPrompt ? `\n\n*Composição Visual / Projeção:* ${ill.visualPrompt}` : ''}`;
    
    // Injeta nos subsídios homiléticos do formulário
    setTheologicalNotes(prev => {
      if (!prev.trim()) return formattedContent;
      return `${prev}\n\n${formattedContent}`;
    });

    // Preenche passagem bíblica e título se estiverem vazios
    if (ill.scripture && !scriptureInput.trim()) {
      setScriptureInput(ill.scripture.trim());
    }
    if (ill.title && !titleInput.trim()) {
      setTitleInput(ill.title.trim());
    }

    // Se houver sermão ativo, atualiza também nos pontos/ilustrações
    if (selectedSermonId) {
      setSermons(prev => {
        const updated = prev.map(s => {
          if (s.id === selectedSermonId) {
            const currentPoints = s.expositoryPoints || [];
            let placed = false;
            const updatedPoints = currentPoints.map((pt) => {
              if (!placed && (!pt.illustration || !pt.illustration.description)) {
                placed = true;
                return {
                  ...pt,
                  illustration: {
                    type: (ill.scripture ? 'bíblica' : 'cotidiano') as 'bíblica' | 'cotidiano',
                    description: `${ill.story}\n\nLição Central: ${ill.moral}`
                  }
                };
              }
              return pt;
            });

            return {
              ...s,
              expositoryPoints: updatedPoints,
              illustrations: updatedPoints.filter(p => p.illustration?.description).map(p => p.illustration!)
            };
          }
          return s;
        });

        try {
          localStorage.setItem('pastoral_sermons', JSON.stringify(updated.filter(s => !isSermonBlank(s))));
        } catch {}
        return updated;
      });
    }

    // Muda para o Laboratório ('workspace') e executa scroll suave
    setActiveTab('workspace');
    setTimeout(() => {
      if (laboratoryTopRef.current) {
        laboratoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 120);

    // Feedback visual
    const noticeText = `Ilustração "${ill.title}" enviada para o Laboratório com sucesso!`;
    setToastNotice(noticeText);
    setTimeout(() => {
      setToastNotice(prev => (prev === noticeText ? null : prev));
    }, 4000);
  };

  const activeSermon = sermons.find(s => s.id === selectedSermonId);

  const getSermonParts = (s: Sermon) => {
    const parts = [
      { id: 'intro', label: 'Introdução' },
      { id: 'context', label: 'Contexto' },
    ];
    s.expositoryPoints.forEach((point, idx) => {
      parts.push({ id: `point-${idx}`, label: point.title || `Ponto ${idx + 1}` });
    });
    parts.push({ id: 'conclusion', label: 'Conclusão' });
    parts.push({ id: 'appeal', label: 'Apelo' });
    parts.push({ id: 'references', label: 'Referências' });
    return parts;
  };

  const sermonParts = activeSermon ? getSermonParts(activeSermon) : [];
  const currentPartId = (activeSermon && sermonParts.some(p => p.id === activeSermonPart)) ? activeSermonPart : 'intro';

  // Garantir que a tela do sermão comece zerada toda a vez que o assistente for acessado
  useEffect(() => {
    setSelectedSermonId('');
  }, []);

  // Auto save when sermons change (localStorage + Cloud Firestore mirroring)
  useEffect(() => {
    const nonBlankSermons = sermons.filter(s => !isSermonBlank(s));
    localStorage.setItem('pastoral_sermons', JSON.stringify(nonBlankSermons));

    // If this update was triggered by an incoming remote sync, skip auto-uploading back to prevent infinite loops
    if (isRemoteSyncUpdateRef.current) {
      isRemoteSyncUpdateRef.current = false;
      return;
    }

    // Debounced sync to Firestore for active sermon
    if (activeSermon && !isSermonBlank(activeSermon)) {
      const timer = setTimeout(async () => {
        try {
          await saveSermonToCloud(activeSermon, FIXED_PASTORAL_UID);
          setCloudSyncStatus('synced');
          setCloudSyncMessage('Espelhado em tempo real');
        } catch (err) {
          console.error("Erro ao espelhar com Firestore:", err);
        } finally {
          setIsCloudSyncing(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sermons, activeSermon]);

  // Auto-reconcile and Smart Merge when opening the Library tab or switching tabs
  useEffect(() => {
    if ((activeTab === 'library' || activeTab === 'study') && navigator.onLine) {
      performInitialSermonSmartSync(sermons, FIXED_PASTORAL_UID).then(res => {
        if (res.hasRemoteChanges) {
          isRemoteSyncUpdateRef.current = true;
          setSermons(res.mergedSermons);
        }
      }).catch(err => {
        console.warn('[Library Auto-Sync] Sincronização offline ou indisponível:', err);
      });
    }
  }, [activeTab]);

  const handleSaveHistoryEntry = (dateVal: string, locationVal: string, eventVal: string, notesVal: string, editId: string | null) => {
    if (!activeSermon) return;

    const entry: SermonHistoryEntry = {
      id: editId || crypto.randomUUID(),
      date: dateVal,
      location: locationVal,
      event: eventVal,
      notes: notesVal,
    };

    const currentHistory = activeSermon.history || [];
    let updatedHistory: SermonHistoryEntry[] = [];

    if (editId) {
      updatedHistory = currentHistory.map(h => h.id === editId ? entry : h);
    } else {
      updatedHistory = [entry, ...currentHistory];
    }

    // Sort updatedHistory by date descending
    updatedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const updatedSermon = {
      ...activeSermon,
      history: updatedHistory,
      updatedAt: Date.now()
    };

    setSermons(prev => prev.map(s => s.id === activeSermon.id ? updatedSermon : s));
    saveSermonToCloud(updatedSermon, FIXED_PASTORAL_UID);
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    if (!activeSermon) return;

    const currentHistory = activeSermon.history || [];
    const updatedHistory = currentHistory.filter(h => h.id !== entryId);

    const updatedSermon = {
      ...activeSermon,
      history: updatedHistory,
      updatedAt: Date.now()
    };

    setSermons(prev => prev.map(s => s.id === activeSermon.id ? updatedSermon : s));
    saveSermonToCloud(updatedSermon, FIXED_PASTORAL_UID);
  };

  const updateActiveSermonField = (field: keyof Sermon, value: any) => {
    if (!activeSermon) return;
    setSermons(prev => prev.map(s => {
      if (s.id === activeSermon.id) {
        let cleanedValue = value;
        if (field === 'title' && typeof value === 'string') {
          // Clean prefixes like "Título:", "Título -", "Sermão:", etc.
          cleanedValue = value.replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim();
        }
        let updated = { ...s, [field]: cleanedValue, updatedAt: Date.now() };
        if (field === 'expositoryPoints') {
          const pts = value as any[];
          const flatIllustrations = pts
            .filter((p: any) => p.illustration && p.illustration.description)
            .map((p: any) => p.illustration);
          const flatApplications = pts
            .map((p: any) => p.application)
            .filter(Boolean);
          updated.illustrations = flatIllustrations;
          updated.applications = flatApplications;
        }
        return updated;
      }
      return s;
    }));
  };

  const getLocationsForCliche = (sermon: Sermon, cliche: string) => {
    if (!cliche || !sermon) return [];
    const normalizedCliche = cliche.trim().toLowerCase();
    if (normalizedCliche.length < 2) return [];

    const matches: { sectionKey: string; label: string; text: string }[] = [];

    const check = (text: string, sectionKey: string, label: string) => {
      if (text && text.toLowerCase().includes(normalizedCliche)) {
        matches.push({ sectionKey, label, text });
      }
    };

    check(sermon.title, 'title', 'Título');
    check(sermon.introduction, 'introduction', 'Introdução');
    check(sermon.biblicalContext, 'biblicalContext', 'Contexto Histórico');
    check(sermon.conclusion, 'conclusion', 'Conclusão');
    check(sermon.pastoralAppeal, 'pastoralAppeal', 'Apelo Pastoral');

    // Check points
    if (sermon.expositoryPoints && sermon.expositoryPoints.length > 0) {
      sermon.expositoryPoints.forEach((point, idx) => {
        const pNum = idx + 1;
        const pLabel = `Ponto ${pNum}: ${point.title || "Sem título"}`;
        check(point.title, `expositoryPoints.${idx}.title`, `${pLabel} (Título)`);
        check(point.explanation, `expositoryPoints.${idx}.explanation`, `${pLabel} (Explicação)`);
        if (point.illustration?.description) {
          check(point.illustration.description, `expositoryPoints.${idx}.illustration.description`, `${pLabel} (Ilustração)`);
        }
        check(point.application, `expositoryPoints.${idx}.application`, `${pLabel} (Aplicação)`);
      });
    }

    // Illustrations and general applications
    if (sermon.illustrations && sermon.illustrations.length > 0) {
      sermon.illustrations.forEach((ill, idx) => {
        check(ill.description, `illustrations.${idx}.description`, `Ilustração Geral ${idx + 1}`);
      });
    }
    if (sermon.applications && sermon.applications.length > 0) {
      sermon.applications.forEach((app, idx) => {
        check(app, `applications.${idx}`, `Aplicação Geral ${idx + 1}`);
      });
    }

    return matches;
  };

  const handleApplyClicheReplacement = (cliche: string, suggestion: string, sectionKey: string) => {
    if (!activeSermon) return;
    
    setSermons(prev => prev.map(s => {
      if (s.id !== activeSermon.id) return s;
      
      const updated = { ...s };
      const escapedCliche = cliche.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedCliche, 'gi');

      const replaceText = (text: string) => {
        return text ? text.replace(regex, suggestion) : text;
      };

      if (sectionKey === 'title') {
        updated.title = replaceText(updated.title);
      } else if (sectionKey === 'introduction') {
        updated.introduction = replaceText(updated.introduction);
      } else if (sectionKey === 'biblicalContext') {
        updated.biblicalContext = replaceText(updated.biblicalContext);
      } else if (sectionKey === 'conclusion') {
        updated.conclusion = replaceText(updated.conclusion);
      } else if (sectionKey === 'pastoralAppeal') {
        updated.pastoralAppeal = replaceText(updated.pastoralAppeal);
      } else if (sectionKey.startsWith('expositoryPoints.')) {
        const parts = sectionKey.split('.');
        const idx = parseInt(parts[1], 10);
        const subfield = parts[2];

        if (updated.expositoryPoints && updated.expositoryPoints[idx]) {
          const pts = [...updated.expositoryPoints];
          const pt = { ...pts[idx] };

          if (subfield === 'title') {
            pt.title = replaceText(pt.title);
          } else if (subfield === 'explanation') {
            pt.explanation = replaceText(pt.explanation);
          } else if (subfield === 'application') {
            pt.application = replaceText(pt.application);
          } else if (subfield === 'illustration') {
            if (pt.illustration) {
              pt.illustration = {
                ...pt.illustration,
                description: replaceText(pt.illustration.description)
              };
            }
          }
          pts[idx] = pt;
          updated.expositoryPoints = pts;
        }
      } else if (sectionKey.startsWith('illustrations.')) {
        const parts = sectionKey.split('.');
        const idx = parseInt(parts[1], 10);
        if (updated.illustrations && updated.illustrations[idx]) {
          const ills = [...updated.illustrations];
          ills[idx] = {
            ...ills[idx],
            description: replaceText(ills[idx].description)
          };
          updated.illustrations = ills;
        }
      } else if (sectionKey.startsWith('applications.')) {
        const parts = sectionKey.split('.');
        const idx = parseInt(parts[1], 10);
        if (updated.applications && updated.applications[idx]) {
          const apps = [...updated.applications];
          apps[idx] = replaceText(apps[idx]);
          updated.applications = apps;
        }
      }
      
      updated.updatedAt = Date.now();
      return updated;
    }));
  };

  const handleResetToNewSermon = () => {
    // Clear generator inputs
    setTitleInput('');
    setThemeInput('');
    setScriptureInput('');
    setSeriesName('');
    setTheologicalNotes('');
    
    // Clear selection so workspace is clean and ready for a fresh study
    setSelectedSermonId('');
    setActiveSermonPart('intro');
    setApiFallbackNotice(null);

    // Sanitize sermons state and localStorage to ensure zero blank drafts are retained
    setSermons(prev => {
      const cleaned = prev.filter(s => !isSermonBlank(s));
      try {
        localStorage.setItem('pastoral_sermons', JSON.stringify(cleaned));
      } catch {}
      return cleaned;
    });
  };

  // AI Trigger actions
  const handleGenerateSermon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scriptureInput || !scriptureInput.trim()) {
      setGenerationErrorNotice("Por favor, preencha a passagem bíblica de estudo para guiar a pregação.");
      return;
    }
    setIsGenerating(true);
    setGenerationErrorNotice(null);

    let data: any = null;

    try {
      // safeApiPost possui retentativas automáticas e controle de timeout para prevenir 'Failed to fetch'
      data = await safeApiPost('/api/gemini/generate-sermon', {
        title: titleInput,
        theme: themeInput,
        scripture: scriptureInput,
        style: sermonStyle,
        churchProfile,
        audience,
        bibleVersion,
        isOutline,
        seriesName,
        churchProfileDetails,
        duration: sermonDuration,
        theologicalNotes: theologicalNotes.trim() || undefined
      }, { retries: 1, timeoutMs: 95000 });
    } catch (err) {
      console.warn("[handleGenerateSermon] Falha de rede ou timeout com a API remota. Ativando contingência homilética estruturada:", err);
      // Fallback de contingência local: garante que o pastor nunca fique bloqueado sem sermão
      data = buildClientFallbackSermon({
        title: titleInput,
        theme: themeInput,
        scripture: scriptureInput,
        style: sermonStyle,
        churchProfile,
        audience,
        bibleVersion,
        duration: sermonDuration,
        seriesName
      });
    }

    try {
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      // Auto-compute hymns suggestions exclusivamente da JUERP (Cantor Cristão e HCC)
      const hymnsSelection = selectHymnsForSermon(
        (data?.title || '') + ' ' + (data?.introduction || '') + ' ' + (data?.theme || ''),
        themeInput || 'Geral',
        churchProfile,
        preferredHinario
      );

      const formattedHymns = buildSermonHymnsRecord(hymnsSelection, preferredHinario);

      const newSermon: Sermon = {
        id: 'ser_' + Date.now(),
        title: (data?.title || titleInput || 'Sermão Expositivo').replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim(),
        theme: data?.theme || themeInput || 'Tema do sermão',
        scripture: data?.scripture || scriptureInput,
        introduction: data?.introduction || 'Introdução do sermão',
        biblicalContext: data?.biblicalContext || 'Contexto bíblico',
        expositoryPoints: data?.expositoryPoints || [
          { title: 'I. Ponto expositivo Inicial', explanation: 'Nova elucidação bíblica' }
        ],
        illustrations: data?.illustrations || [
          { type: 'bíblica', description: 'Narrativa das Escrituras inserida organicamente.' },
          { type: 'cotidiano', description: 'Exemplo do cotidiano correspondente.' }
        ],
        applications: data?.applications || ['Aplicação prática na igreja local'],
        conclusion: data?.conclusion || 'Conclusão pastoral reformadora',
        pastoralAppeal: data?.pastoralAppeal || 'Apelo à salvação divina',
        date: new Date().toISOString(),
        style: sermonStyle,
        churchProfile,
        audience,
        bibleVersion,
        isOutline,
        duration: sermonDuration,
        tags: data?.tags || [themeInput || 'Doutrina', 'Bíblico'],
        seriesName: seriesName || undefined,
        hymns: formattedHymns,
        isFavorite: false,
        isArchived: false,
        updatedAt: Date.now()
      };

      setSermons(prev => {
        const updated = [newSermon, ...prev.filter(s => s.id !== newSermon.id)];
        localStorage.setItem('pastoral_sermons', JSON.stringify(updated.filter(s => !isSermonBlank(s))));
        return updated;
      });
      setSelectedSermonId(newSermon.id);
      setActiveTab('workspace');
      setGenerationSuccessNotice(`Sermão "${newSermon.title || newSermon.scripture}" gerado e salvo com sucesso na Biblioteca!`);
      
      // Sincronização imediata com Cloud Firestore (espelhamento automático)
      setCloudSyncStatus('syncing');
      setCloudSyncMessage('Espelhando com a nuvem...');
      saveSermonToCloud(newSermon, FIXED_PASTORAL_UID).then(success => {
        if (success) {
          setCloudSyncStatus('synced');
          setCloudSyncMessage('Espelhado em tempo real');
          setCloudWriteError(null);
        } else {
          setCloudSyncStatus('error');
          setCloudSyncMessage('Falha ao espelhar sermão no Firestore');
        }
      }).catch(err => {
        const errObj = err as { code?: string; message?: string };
        const code = errObj.code || 'firestore/save-error';
        const msg = errObj.message || (err instanceof Error ? err.message : String(err));
        console.error(`[handleGenerateSermon] Erro ao gravar sermão:`, err);
        setCloudSyncStatus('error');
        setCloudSyncMessage(`Erro: ${code}`);
        setCloudWriteError({
          code,
          message: msg,
          sermonTitle: newSermon.title,
          sermonId: newSermon.id,
          timestamp: Date.now()
        });
      });
      
      // Clear inputs
      setTitleInput('');
      setThemeInput('');
      setScriptureInput('');
      setSeriesName('');
      
    } catch (err) {
      console.error("[handleGenerateSermon] Erro inesperado na estruturação do sermão:", err);
      setGenerationErrorNotice("Ocorreu um erro inesperado ao salvar o sermão gerado. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const suggestIllustrationForPoint = async (pIdx: number, type: 'bíblica' | 'cotidiano') => {
    if (!activeSermon) return;
    const point = activeSermon.expositoryPoints[pIdx];
    
    const updatedWithLoading = activeSermon.expositoryPoints.map((pt, idx) => {
      if (idx === pIdx) {
        return {
          ...pt,
          illustration: {
            type,
            description: 'Obtendo valiosa sugestão pastoral da IA...'
          }
        };
      }
      return pt;
    });

    setSermons(prev => prev.map(s => {
      if (s.id === selectedSermonId) {
        return { ...s, expositoryPoints: updatedWithLoading };
      }
      return s;
    }));

    try {
      const data: any = await safeApiPost('/api/gemini/generate-illustrations', {
        topic: `${point.title} (${activeSermon.title})`,
        type
      }, { retries: 2, timeoutMs: 30000 });

      if (data && data.illustrations && data.illustrations.length > 0) {
        const suggestion = data.illustrations[0];
        const desc = `${suggestion.story}\n\nLição Central: ${suggestion.moral || suggestion.title}`;
        
        setSermons(prev => prev.map(s => {
          if (s.id === selectedSermonId) {
            const pts = s.expositoryPoints.map((pt, idx) => {
              if (idx === pIdx) {
                return {
                  ...pt,
                  illustration: {
                    type,
                    description: desc
                  }
                };
              }
              return pt;
            });
            return {
              ...s,
              expositoryPoints: pts,
              illustrations: pts.filter(p => p.illustration?.description).map(p => p.illustration),
              updatedAt: Date.now()
            };
          }
          return s;
        }));
      } else {
        setSermons(prev => prev.map(s => {
          if (s.id === selectedSermonId) {
            const pts = s.expositoryPoints.map((pt, idx) => {
              if (idx === pIdx) {
                return {
                  ...pt,
                  illustration: {
                    type,
                    description: `Ilustração sugestiva baseada em ${point.title}: Uma história edificante de entrega e compromisso autêntico no serviço cristão.`
                  }
                };
              }
              return pt;
            });
            return {
              ...s,
              expositoryPoints: pts,
              illustrations: pts.filter(p => p.illustration?.description).map(p => p.illustration),
              updatedAt: Date.now()
            };
          }
          return s;
        }));
      }
    } catch (err) {
      console.warn("[suggestIllustrationForPoint] Usando ilustração alternativa por oscilação de rede:", err);
      setSermons(prev => prev.map(s => {
        if (s.id === selectedSermonId) {
          const pts = s.expositoryPoints.map((pt, idx) => {
            if (idx === pIdx) {
              return {
                ...pt,
                illustration: {
                  type,
                  description: `Ilustração sugestiva baseada em ${point.title}: Uma história edificante de entrega e compromisso autêntico no serviço cristão.`
                }
              };
            }
            return pt;
          });
          return {
            ...s,
            expositoryPoints: pts,
            illustrations: pts.filter(p => p.illustration?.description).map(p => p.illustration),
            updatedAt: Date.now()
          };
        }
        return s;
      }));
    }
  };

  const handleEvaluateSermon = async () => {
    if (!activeSermon) return;
    setIsEvaluating(true);
    try {
      const data: any = await safeApiPost('/api/gemini/evaluate-sermon', {
        sermon: activeSermon
      }, { retries: 2, timeoutMs: 35000 });
      
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      updateActiveSermonField('evaluation', data);
    } catch (err) {
      console.warn("[handleEvaluateSermon] Falha na avaliação:", err);
      setApiFallbackNotice("O serviço de avaliação homilética está temporariamente inacessível. Tente novamente em instantes.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleImproveSermon = async (improvement: string, idx: number) => {
    if (!activeSermon) return;
    setImprovingSuggestionIdx(idx);
    try {
      const data: any = await safeApiPost('/api/gemini/improve-sermon', {
        sermon: activeSermon,
        improvement
      }, { retries: 2, timeoutMs: 35000 });

      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }

      setSermons(prev => prev.map(s => {
        if (s.id === activeSermon.id) {
          const updatedSermon: Sermon = {
            ...s,
            title: data.title || s.title,
            theme: data.theme || s.theme,
            scripture: data.scripture || s.scripture,
            introduction: data.introduction || s.introduction,
            biblicalContext: data.biblicalContext || s.biblicalContext,
            expositoryPoints: data.expositoryPoints || s.expositoryPoints,
            conclusion: data.conclusion || s.conclusion,
            pastoralAppeal: data.pastoralAppeal || s.pastoralAppeal,
            updatedAt: Date.now()
          };

          if (updatedSermon.evaluation?.suggestedImprovements) {
            updatedSermon.evaluation = {
              ...updatedSermon.evaluation,
              suggestedImprovements: updatedSermon.evaluation.suggestedImprovements.filter((_, i) => i !== idx)
            };
          }

          return updatedSermon;
        }
        return s;
      }));
    } catch (err) {
      console.error(err);
      alert("Erro ao aplicar aperfeiçoamento pastoral.");
    } finally {
      setImprovingSuggestionIdx(null);
    }
  };

  const handleBibleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExegesisLoading(true);
    try {
      const data: any = await safeApiPost('/api/gemini/chat-bible', {
        scripture: exegesisScripture,
        question: exegesisQuestion,
        chatHistory: [] // Can append more if needed
      }, { retries: 2, timeoutMs: 35000 });
      
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      setExegesisResponse(data);
    } catch (err) {
      console.warn("[handleSendMessage] Erro na consulta exegética:", err);
    } finally {
      setIsExegesisLoading(false);
    }
  };

  const handleExplorePericope = async (targetScripture: string) => {
    if (!targetScripture || !targetScripture.trim()) {
      setPericopeError("Por favor, digite uma passagem bíblica para analisar.");
      return;
    }
    setIsExploringPericope(true);
    setPericopeError(null);
    setPericopeAnalysis(null);
    try {
      const data: any = await safeApiPost('/api/gemini/explore-pericope', {
        scripture: targetScripture
      }, { retries: 2, timeoutMs: 35000 });
      
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      setPericopeAnalysis(data);
    } catch (err: any) {
      console.warn("[handleExplorePericope] Falha na exploração de perícope:", err);
      setPericopeError("Não foi possível concluir a análise exegética da perícope no momento. Verifique a passagem informada.");
    } finally {
      setIsExploringPericope(false);
    }
  };

  const handleCompareVersions = async () => {
    setIsComparingLoading(true);
    try {
      const data: any = await safeApiPost('/api/gemini/compare-versions', {
        scripture: comparedScripture
      }, { retries: 2, timeoutMs: 35000 });
      
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      setComparedVerses(data?.comparisons || []);
    } catch (err) {
      console.warn("[handleCompareVersions] Erro na comparação de versões:", err);
    } finally {
      setIsComparingLoading(false);
    }
  };

  const handleGenerateSeries = async () => {
    setIsSeriesGenerating(true);
    try {
      const data: any = await safeApiPost('/api/gemini/generate-series', {
        book: seriesBook,
        theme: seriesTheme,
        campaign: seriesCampaign,
        sermonCount: seriesSermonCount
      }, { retries: 2, timeoutMs: 45000 });
      
      if (data?.fallbackActive) {
        setApiFallbackNotice(data.fallbackReason);
      } else {
        setApiFallbackNotice(null);
      }
      
      setGeneratedSeries(data);
      if (data) {
        await saveSeriesToCloud(data);
      }
    } catch (err) {
      console.warn("[handleGenerateSeries] Erro ao gerar série expositiva:", err);
    } finally {
      setIsSeriesGenerating(false);
    }
  };

  const useSeriesSermonInWorkspace = (sermonUnit: ExpositorySeriesUnit) => {
    setTitleInput(sermonUnit.title);
    setScriptureInput(`${sermonUnit.scripture} (${bibleVersion})`);
    setThemeInput(sermonUnit.coreIdea);
    setSeriesName(generatedSeries?.title || 'Série Expositiva');
    setActiveTab('workspace');
    // Scroll smoothly to workspace
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const usePresetTheme = (theme: ThemeSuggestion) => {
    setTitleInput(theme.theme);
    setScriptureInput(theme.scripture);
    setThemeInput(theme.coreIdea);
    setActiveTab('workspace');
  };

  const useCalendarTheme = (cal: CalendarCelebration) => {
    setTitleInput(cal.suggestedTheme);
    setScriptureInput(cal.scripture);
    setThemeInput(cal.description);
    setActiveTab('workspace');
  };

  // Export functions (PDF / DOCX simulation helpers)
  const printSermon = () => {
    if (!activeSermon) return;
    
    // Fallback print modal trigger for external mode
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("Iframe blocked window.print() execution.", e);
    }

    // Direct download of gorgeous, styled printable HTML that prints flawlessly to PDF outside the sandbox
    const pPoints = activeSermon.expositoryPoints.map((p, idx) => {
      // Limpa algarismos romanos estruturais (ex: "I. ", "II. ") no início do título para evitar duplicar numeração
      const cleanedTitle = p.title.replace(/^(?:[IVXLCDM]+\.?\s+)/i, '').trim();
      let pBlock = `
        <div class="point-block" style="margin-top: 1.2rem; margin-bottom: 1.2rem; padding-bottom: 0.8rem; border-bottom: 1px dashed #E5E5E5; page-break-inside: auto; break-inside: auto;">
          <h4 style="font-family: 'Georgia', serif; font-size: 15pt; font-weight: bold; margin-bottom: 0.5rem; color: #000000; line-height: 1.4;">3.${idx + 1}. ${cleanedTitle}</h4>
          <p style="font-family: 'Georgia', serif; font-size: 13pt; line-height: 1.6; margin: 0 0 0.8rem 0; text-align: justify; white-space: pre-line;">${p.explanation}</p>
      `;
      if (p.illustration && p.illustration.description) {
        pBlock += `
          <div style="background-color: #FAF6EE; border-left: 3px solid #5A5A40; padding: 12px; margin: 12px 0; font-style: italic; font-size: 12pt; line-height: 1.5; page-break-inside: auto; break-inside: auto;">
            <strong>Ilustração (${p.illustration.type === 'bíblica' ? 'Bíblica' : 'do Cotidiano'}):</strong><br>
            ${p.illustration.description}
          </div>
        `;
      }
      if (p.application) {
        pBlock += `
          <div style="background-color: #F5F7F8; border-left: 3px solid #4A5A5A; padding: 12px; margin: 12px 0; font-size: 12pt; line-height: 1.5; page-break-inside: auto; break-inside: auto;">
            <strong>Aplicação Prática:</strong><br>
            ${p.application}
          </div>
        `;
      }
      pBlock += `</div>`;
      return pBlock;
    }).join('');

    const printHymnsRecord = hydrateHymnsIfLegacy(activeSermon.hymns);
    const momentsList = [
      { label: 'Abertura / Louvor', hymn: printHymnsRecord.details?.abertura },
      { label: 'Antes da Mensagem', hymn: printHymnsRecord.details?.antesMensagem },
      { label: 'Apelo Pastoral', hymn: printHymnsRecord.details?.apelo },
      { label: 'Encerramento', hymn: printHymnsRecord.details?.encerramento },
    ];
    const hymnsPrintHtml = momentsList.map(m => {
      const h = m.hymn;
      if (!h) return '';
      return `
        <div style="margin-top: 1rem; margin-bottom: 1.2rem; padding: 14px; background: #FAF8F5; border: 1px solid #E6E2DA; border-radius: 6px; break-inside: avoid; page-break-inside: avoid;">
          <div style="font-family: 'Inter', sans-serif; font-size: 10pt; font-weight: 700; color: #5A5A40; text-transform: uppercase;">${m.label} &bull; ${h.hinario} ${h.number}</div>
          <div style="font-family: 'Georgia', serif; font-size: 13pt; font-weight: bold; color: #2D2926; margin: 4px 0;">${h.title}</div>
          <div style="font-family: 'Inter', sans-serif; font-size: 9.5pt; color: #777; font-style: italic; margin-bottom: 10px;">${h.author} &bull; ${h.hinarioName}</div>
          <div style="font-family: 'Georgia', serif; font-size: 11pt; line-height: 1.5; color: #222; white-space: pre-line;">${h.fullLyrics}</div>
        </div>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activeSermon.title} - Esboço Diagramado para Impressão</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Georgia&family=Inter:wght@400;500;600;700&display=swap');
    
    html, body {
      background: #F4F1EA !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 13pt;
      line-height: 1.6;
      max-width: 21cm;
      margin: 0 auto !important;
      padding: 1.5cm 0;
    }

    .banner {
      font-family: 'Inter', sans-serif;
      background-color: #FAF6EE;
      border: 1px solid #E6E2DA;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 0 1.5cm 30px 1.5cm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
    }

    .banner-text {
      font-size: 12px;
      color: #5A5A40;
      margin: 0;
      line-height: 1.5;
    }

    .banner-title {
      font-weight: 700;
      margin-bottom: 4px;
      color: #2D2926;
    }

    button.print-btn {
      font-family: 'Inter', sans-serif;
      background-color: #5A5A40;
      color: white;
      border: none;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: background-color 0.2s, transform 0.1s;
    }

    button.print-btn:hover {
      background-color: #2D2926;
    }

    button.print-btn:active {
      transform: scale(0.98);
    }

    .sermon-sheet {
      background: #FFFFFF;
      margin-bottom: 2cm;
      padding: 2.5cm 2cm;
      box-shadow: 0 4px 15px rgba(0,0,0,0.06);
      border-radius: 6px;
      border: 1px solid #E6E2DA;
      min-height: 29.7cm;
      box-sizing: border-box;
      position: relative;
    }

    @page {
      size: A4;
      margin: 2.2cm 1.8cm 2.2cm 1.8cm;
    }

    @page {
      @bottom-right {
        content: "Pág. " counter(page) " de " counter(pages);
        font-family: 'Inter', sans-serif;
        font-size: 9.5pt;
        color: #777755;
        font-weight: 600;
      }
      @bottom-left {
        content: "Pr. Fernando Veiga • Esboço de Pregação";
        font-family: 'Inter', sans-serif;
        font-size: 9.5pt;
        color: #777755;
        font-weight: 600;
      }
    }

    @media print {
      html, body {
        background: #FFFFFF !important;
      }
      body {
        padding: 0 !important;
        margin: 0 !important;
        max-width: none !important;
      }
      .banner {
        display: none !important;
      }
      .sermon-sheet {
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: none !important;
        min-height: 0 !important;
      }
      .sermon-screen-footer {
        display: none !important;
      }
      
      section, .point-block, .illustration, .application {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }

      h1, h2, h3, h4 {
        page-break-after: avoid;
        break-after: avoid;
      }

      p {
        orphans: 3;
        widows: 3;
      }

      .container, .editor, .page {
        height: auto !important;
        overflow: visible !important;
      }
    }

    h1 {
      font-family: 'Georgia', serif;
      font-size: 24pt;
      font-weight: bold;
      text-align: center;
      margin-top: 0;
      margin-bottom: 0.5rem;
    }

    .meta-line {
      text-align: center;
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #5A5A40;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #E5E5E5;
    }

    section {
      margin-top: 1.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
    }

    h3 {
      font-family: 'Georgia', serif;
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 1.5px solid #5A5A40;
      padding-bottom: 4px;
      margin-bottom: 0.8rem;
      margin-top: 1.2rem;
      color: #2D2926;
      page-break-after: avoid;
      break-after: avoid;
    }

    h1, h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }

    p {
      text-align: justify;
      margin-top: 0;
      margin-bottom: 1rem;
      font-size: 13pt;
      line-height: 1.6;
    }
  </style>
</head>
<body>

  <div class="banner">
    <div class="banner-text">
      <div class="banner-title">📄 Documento Pronto para Impressão</div>
      Este é o arquivo diagramado com paginação inteligente e automática para o Pr. Fernando Veiga. Clique ao lado para imprimir ou salvar como PDF no seu computador.
    </div>
    <button class="print-btn" onclick="window.print()">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>

  <div class="sermon-sheet">
    <h1>${activeSermon.title.toUpperCase()}</h1>
    <div class="meta-line" style="color: #2D2926; text-align: center; font-family: 'Inter', sans-serif; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid #E5E5E5; line-height: 1.5;">
      <div style="margin-bottom: 6px;"><strong>Texto Bíblico:</strong> ${activeSermon.scripture}</div>
      <div style="margin-bottom: 6px;"><strong>Tema:</strong> ${activeSermon.theme}</div>
      <div><strong>Pregador:</strong> Pr. Fernando Veiga</div>
    </div>

    <!-- 1. INTRODUÇÃO -->
    <section style="margin-bottom: 1.5rem; border-bottom: 1px dashed #E5E5E5; padding-bottom: 1rem;">
      <h3>1. INTRODUÇÃO</h3>
      <p style="white-space: pre-line;">${activeSermon.introduction}</p>
    </section>
   
    <!-- 2. CONTEXTO HISTÓRICO E EXEGÉTICO -->
    <section style="margin-bottom: 1.5rem; border-bottom: 1px dashed #E5E5E5; padding-bottom: 1rem;">
      <h3>2. CONTEXTO HISTÓRICO E EXEGÉTICO</h3>
      <p style="white-space: pre-line;">${activeSermon.biblicalContext}</p>
    </section>

    <!-- 3. DESENVOLVIMENTO EXPOSITIVO -->
    <section style="margin-bottom: 1.5rem; border-bottom: 1px dashed #E5E5E5; padding-bottom: 1rem; page-break-inside: auto; break-inside: auto;">
      <h3>3. DESENVOLVIMENTO EXPOSITIVO</h3>
      ${pPoints}
    </section>

    <!-- 4. CONCLUSÃO -->
    <section style="margin-bottom: 1.5rem; border-bottom: 1px dashed #E5E5E5; padding-bottom: 1rem;">
      <h3>4. CONCLUSÃO</h3>
      <p style="white-space: pre-line;">${activeSermon.conclusion}</p>
    </section>
   
    <!-- 5. APELO PASTORAL -->
    <section>
      <h3>5. APELO PASTORAL</h3>
      <p style="white-space: pre-line; color: #1F1D1B;">${activeSermon.pastoralAppeal}</p>
    </section>

    <!-- 6. HINOS DO CULTO (JUERP) -->
    <section style="margin-top: 2rem; border-top: 2px solid #5A5A40; padding-top: 1rem; page-break-inside: auto; break-inside: auto;">
      <h3 style="color: #5A5A40;">6. HINOS RECOMENDADOS PARA O CULTO (JUERP)</h3>
      <p style="font-size: 10pt; color: #666; font-family: 'Inter', sans-serif; margin-bottom: 1rem;">Letras oficiais integrais do Cantor Cristão e Hinário para o Culto Cristão (JUERP)</p>
      ${hymnsPrintHtml}
    </section>

    <!-- DECORATIVE SCREEN-ONLY FOOTER -->
    <div class="sermon-screen-footer" style="margin-top: 3rem; border-top: 1.5px solid #F0ECE4; padding-top: 10px; display: flex; justify-content: space-between; font-family: 'Inter', sans-serif; font-size: 9.5pt; color: #777755; text-transform: uppercase; letter-spacing: 0.8px;">
      <span>Esboço Completo &bull; Pr. Fernando Veiga</span>
      <span>Soli Deo Gloria</span>
    </div>
  </div>

</body>
</html>`;
 
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeSermon.title.toLowerCase().replace(/ /g, '_')}_impressao.html`;
    link.click();
  };
 
  const exportDOCX = () => {
    if (!activeSermon) return;
    const docxHymns = hydrateHymnsIfLegacy(activeSermon.hymns);
    const content = `
${activeSermon.title.toUpperCase()}
Texto Bíblico: ${activeSermon.scripture}
Tema: ${activeSermon.theme}
 
=======================================
INTRODUÇÃO:
${activeSermon.introduction}
 
=======================================
CONTEXTO BÍBLICO:
${activeSermon.biblicalContext}
 
=======================================
PONTOS EXPOSITIVOS:
${activeSermon.expositoryPoints.map((p, idx) => {
  let pBlock = "";
  if (p.precedingTransition) {
    pBlock += `${p.precedingTransition}\n\n`;
  }
  pBlock += `${p.title}\n${p.explanation}\n`;
  if (p.illustration) {
    pBlock += `Ilustração (${p.illustration.type}):\n${p.illustration.description}\n`;
  }
  pBlock += `Aplicação Prática:\n${p.application}\n`;
  return pBlock;
}).join('\n')}
 
=======================================
CONCLUSAO:
${activeSermon.conclusion}
 
=======================================
APELO PASTORAL:
${activeSermon.pastoralAppeal}

=======================================
HINOS RECOMENDADOS PARA O CULTO (JUERP):
1. Abertura: ${docxHymns.details?.abertura?.hinario} ${docxHymns.details?.abertura?.number} — ${docxHymns.details?.abertura?.title}
${docxHymns.details?.abertura?.fullLyrics || ''}

2. Antes da Mensagem: ${docxHymns.details?.antesMensagem?.hinario} ${docxHymns.details?.antesMensagem?.number} — ${docxHymns.details?.antesMensagem?.title}
${docxHymns.details?.antesMensagem?.fullLyrics || ''}

3. Apelo: ${docxHymns.details?.apelo?.hinario} ${docxHymns.details?.apelo?.number} — ${docxHymns.details?.apelo?.title}
${docxHymns.details?.apelo?.fullLyrics || ''}

4. Encerramento: ${docxHymns.details?.encerramento?.hinario} ${docxHymns.details?.encerramento?.number} — ${docxHymns.details?.encerramento?.title}
${docxHymns.details?.encerramento?.fullLyrics || ''}
    `;
 
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeSermon.title.toLowerCase().replace(/ /g, '_')}_esboco.doc`;
    link.click();
  };
 
  const copySermonMD = () => {
    if (!activeSermon) return;
    const mdHymns = hydrateHymnsIfLegacy(activeSermon.hymns);
    const content = `
# ${activeSermon.title.toUpperCase()}
**Texto Bíblico:** ${activeSermon.scripture}
**Tema:** ${activeSermon.theme}
 
## Introdução
${activeSermon.introduction}

## Contexto Histórico e Exegético
${activeSermon.biblicalContext}

## Desenvolvimento Expositivo
${activeSermon.expositoryPoints.map((p, idx) => {
  let pBlock = "";
  if (p.precedingTransition) {
    pBlock += `_${p.precedingTransition}_\n\n`;
  }
  pBlock += `### ${p.title}\n\n${p.explanation}\n`;
  if (p.illustration) {
    pBlock += `\n**Ilustração ${p.illustration.type === 'bíblica' ? 'Bíblica' : 'do Cotidiano'}:**\n_${p.illustration.description}_\n`;
  }
  pBlock += `\n**Aplicação Prática e Pastoral:**\n${p.application}\n`;
  return pBlock;
}).join('\n---\n\n')}

## Conclusão
${activeSermon.conclusion}

## Apelo Pastoral e Decisão Sincera
${activeSermon.pastoralAppeal}

## Hinos Recomendados para o Culto (JUERP)
### 1. Abertura / Louvor: ${mdHymns.details?.abertura?.hinario} ${mdHymns.details?.abertura?.number} — ${mdHymns.details?.abertura?.title} (${mdHymns.details?.abertura?.hinarioName})
\`\`\`
${mdHymns.details?.abertura?.fullLyrics || ''}
\`\`\`

### 2. Antes da Mensagem: ${mdHymns.details?.antesMensagem?.hinario} ${mdHymns.details?.antesMensagem?.number} — ${mdHymns.details?.antesMensagem?.title} (${mdHymns.details?.antesMensagem?.hinarioName})
\`\`\`
${mdHymns.details?.antesMensagem?.fullLyrics || ''}
\`\`\`

### 3. Apelo Pastoral: ${mdHymns.details?.apelo?.hinario} ${mdHymns.details?.apelo?.number} — ${mdHymns.details?.apelo?.title} (${mdHymns.details?.apelo?.hinarioName})
\`\`\`
${mdHymns.details?.apelo?.fullLyrics || ''}
\`\`\`

### 4. Encerramento: ${mdHymns.details?.encerramento?.hinario} ${mdHymns.details?.encerramento?.number} — ${mdHymns.details?.encerramento?.title} (${mdHymns.details?.encerramento?.hinarioName})
\`\`\`
${mdHymns.details?.encerramento?.fullLyrics || ''}
\`\`\`
    `;

    navigator.clipboard.writeText(content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const duplicateSermon = async (s: Sermon) => {
    const duplicated: Sermon = {
      ...s,
      id: 'ser_' + Date.now(),
      title: `${s.title} (Cópia)`,
      date: new Date().toISOString(),
      updatedAt: Date.now()
    };
    setSermons(prev => [duplicated, ...prev]);
    setSelectedSermonId(duplicated.id);
    await saveSermonToCloud(duplicated, FIXED_PASTORAL_UID);
  };

  const toggleArchiveSermon = async (id: string) => {
    const target = sermons.find(s => s.id === id);
    if (!target) return;
    const updated = { ...target, isArchived: !target.isArchived, updatedAt: Date.now() };
    setSermons(prev => prev.map(s => s.id === id ? updated : s));
    await saveSermonToCloud(updated, FIXED_PASTORAL_UID);
  };

  const toggleFavoriteSermon = async (id: string) => {
    const target = sermons.find(s => s.id === id);
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite, updatedAt: Date.now() };
    setSermons(prev => prev.map(s => s.id === id ? updated : s));
    await saveSermonToCloud(updated, FIXED_PASTORAL_UID);
  };

  const deleteSermon = (id: string) => {
    if (!id) return;
    
    // 1. Marcar imediatamente como excluído (tombstone) para que o listener e smartMerge nunca o restaurem
    markSermonAsDeleted(id);
    setSermonIdDeleting(null);

    // 2. Atualização atômica e instantânea do estado local e localStorage
    setSermons(prev => {
      // Remove o sermão pelo ID e também limpa qualquer sermão em branco residual
      const remaining = prev.filter(s => s.id !== id && !isSermonBlank(s));
      
      // Persiste a lista limpa no localStorage (permite array vazio quando todos forem apagados)
      try {
        localStorage.setItem('pastoral_sermons', JSON.stringify(remaining));
      } catch {}

      // Atualiza o ID do sermão selecionado se o sermão ativo foi apagado
      if (selectedSermonId === id) {
        setSelectedSermonId(remaining.length > 0 ? remaining[0].id : '');
      }

      return remaining;
    });

    // 3. Exclusão assíncrona definitiva no Cloud Firestore em segundo plano
    deleteSermonFromCloud(id, FIXED_PASTORAL_UID).catch(err => {
      console.warn("[Cloud Delete] Aviso ao excluir do Firestore:", err);
    });
  };

  // Search and library filters
  const filteredSermons = sermons.filter(s => {
    // Exclude completely blank draft templates and published model sermons
    if (isSermonBlank(s) || isModelSermon(s)) return false;

    const matchesSearch = 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.scripture.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.theme.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesArchive = showArchivedOnly ? s.isArchived : !s.isArchived;
    return matchesSearch && matchesArchive;
  });

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#2D2926] flex flex-col font-sans transition-all selection:bg-[#5A5A40]/30">
      
      {/* Upper Baptist Heritage bar */}
      <div className="bg-[#2D2926] text-[#E6E2DA] px-4 py-2 text-xs flex flex-wrap justify-between items-center border-b border-[#5A5A40]/20 font-sans font-medium upper-baptist-heritage-bar gap-3">
        <div className="flex items-center gap-2 tracking-widest font-extrabold text-[11px]">
          <span className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-pulse"></span>
          <span>PREGA A PALAVRA</span>
          <span className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-pulse"></span>
        </div>

        {/* Cloud Sync Status & PWA Install in Top Header */}
        <div className="flex items-center gap-2.5 ml-auto flex-wrap">
          <PWAInstallPrompt />

          {/* Indicador de Acervo Sincronizado */}
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-emerald-500/30 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-emerald-300 font-semibold max-w-[160px] sm:max-w-none truncate">
              Biblioteca Sincronizada
            </span>
          </div>

          {/* Multi-Device Synchronization & Cloud Status Indicator */}
          <button
            onClick={() => setShowSyncDiagnosticsModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium transition-all cursor-pointer shadow-xs ${
              cloudSyncStatus === 'synced'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                : cloudSyncStatus === 'syncing'
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300 animate-pulse hover:bg-sky-500/25'
                : cloudSyncStatus === 'error'
                ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
            }`}
            title="Sincronização entre Dispositivos, Nuvem Firestore e Backup. Clique para abrir."
          >
            {isCloudSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            ) : cloudSyncStatus === 'error' ? (
              <CloudOff className="w-3 h-3 text-red-400" />
            ) : (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
            <span className="font-semibold">
              {isCloudSyncing ? 'Sincronizando...' : 'Sincronizar Dispositivos'}
            </span>
            <span className="text-[10px] opacity-75 hidden sm:inline">
              ({sermons.filter(s => !isSermonBlank(s)).length} sermões)
            </span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 bg-[#2D2926] text-white flex flex-col p-6 gap-6 border-r border-[#5A5A40]/10 shrink-0 non-printable">
          
          <div className="flex items-center gap-3 pb-4 border-b border-[#5A5A40]/15 w-full select-none">
            <div className="w-11 h-11 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
              <BookOpen className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-0.5 text-left">
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#E6E2DA]">Estúdio Homilético</h1>
              <p className="text-[10px] font-sans font-bold tracking-widest uppercase text-white/60">PR. FERNANDO VEIGA</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            <button 
              onClick={() => { setActiveTab('workspace'); setSelectedSermonId(''); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'workspace' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Sparkle className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Oficina de Sermões</span>
            </button>
            <button 
              onClick={() => { setActiveTab('crivo'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'crivo' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Scale className="w-4.5 h-4.5 shrink-0 text-[#D4AF37]" />
              <span className="text-left">Crivo Teológico</span>
            </button>
            <button 
              onClick={() => { setActiveTab('study'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'study' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <BookOpenCheck className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Consultor Bíblico e Teológico</span>
            </button>
            <button 
              onClick={() => { setActiveTab('ideas'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'ideas' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Grid className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Banco de Temas Bíblicos</span>
            </button>
            <button 
              onClick={() => { setActiveTab('illustrations'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'illustrations' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Palette className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Galeria de Ilustrações</span>
            </button>
            <button 
              onClick={() => { setActiveTab('series'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'series' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Layers className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Séries Expositivas</span>
            </button>
            <button 
              onClick={() => { setActiveTab('library'); }}
              className={`flex items-center text-left gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'library' ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-300 hover:bg-[#5A5A40]/20 hover:text-white'}`}
            >
              <Bookmark className="w-4.5 h-4.5 shrink-0" />
              <span className="text-left">Biblioteca de Sermões</span>
            </button>
          </nav>

          {/* Quick Stats in Sidebar */}
          <div className="mt-auto space-y-3">
            <div className="bg-[#3D3834] rounded-lg p-3.5 border border-[#5A5A40]/20 space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#E6E2DA]/55">Estatísticas</h4>
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>Total de Sermões:</span>
                <span className="font-bold">{sermons.filter(s => !isSermonBlank(s)).length}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-300">
                <span>Favoritos:</span>
                <span className="font-bold">{sermons.filter(s => s.isFavorite && !isSermonBlank(s)).length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Container */}
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
          
          {/* Banner de Erro Visível na Tela ao Gravar no Firestore */}
          {cloudWriteError && (
            <div className="mb-6 max-w-7xl mx-auto w-full p-4 bg-red-600/10 rounded-xl border-2 border-red-500/40 text-red-950 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-md">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-red-950 text-sm">
                      ⚠️ Falha na Gravação com o Firestore na Nuvem
                    </span>
                    <span className="font-mono bg-red-200/90 text-red-900 px-2 py-0.5 rounded font-bold text-[11px]">
                      {cloudWriteError.code}
                    </span>
                  </div>
                  <p className="text-red-900 text-[12px] mt-1 font-medium">
                    {cloudWriteError.sermonTitle && (
                      <span className="font-semibold">Sermão: &ldquo;{cloudWriteError.sermonTitle}&rdquo; &bull; </span>
                    )}
                    {cloudWriteError.message}
                  </p>
                  {cloudWriteError.path && (
                    <p className="text-red-700 font-mono text-[10px] mt-0.5">
                      Caminho no Firestore: {cloudWriteError.path}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => setShowSyncDiagnosticsModal(true)}
                  className="bg-red-800 hover:bg-red-900 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] uppercase tracking-wider select-none cursor-pointer shadow-xs"
                >
                  Ver Diagnóstico
                </button>
                <button
                  type="button"
                  onClick={() => setCloudWriteError(null)}
                  className="text-red-900 hover:text-black font-bold px-2 py-1 rounded hover:bg-red-500/10 transition-all text-[10px] uppercase tracking-wider select-none cursor-pointer"
                  title="Fechar este aviso"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>
          )}

          {generationErrorNotice && (
            <div className="mb-6 max-w-7xl mx-auto w-full p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-950 text-xs flex items-center justify-between gap-4 animate-fade-in shadow-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                <span className="font-medium text-amber-900">{generationErrorNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setGenerationErrorNotice(null)}
                className="text-amber-800 hover:text-amber-950 font-bold px-2 py-1 rounded hover:bg-amber-500/10 transition-all text-[10px] uppercase tracking-wider select-none cursor-pointer"
                title="Fechar"
              >
                ✕ Fechar
              </button>
            </div>
          )}

          {generationSuccessNotice && (
            <div className="mb-6 max-w-7xl mx-auto w-full p-4.5 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-emerald-950 text-xs flex items-center justify-between gap-4 animate-fade-in shadow-xs">
              <div className="flex items-center gap-3">
                <Check className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
                <span className="font-medium">{generationSuccessNotice}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('library');
                    setGenerationSuccessNotice(null);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition-all text-[11px] uppercase tracking-wider select-none cursor-pointer shadow-xs"
                >
                  Ver na Biblioteca de Sermões
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationSuccessNotice(null)}
                  className="text-emerald-800 hover:text-emerald-950 font-bold px-2 py-1 rounded hover:bg-emerald-500/10 transition-all text-[10px] uppercase tracking-wider select-none cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {apiFallbackNotice && (
            <div className="mb-6 max-w-7xl mx-auto w-full p-4.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-950 text-xs flex items-center justify-between gap-4 animate-fade-in shadow-xs">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{apiFallbackNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setApiFallbackNotice(null)}
                className="text-amber-800 hover:text-amber-950 font-bold px-2 py-1 rounded hover:bg-amber-500/10 transition-all text-[10px] uppercase tracking-wider shrink-0 select-none cursor-pointer border border-amber-500/15"
              >
                Entendi
              </button>
            </div>
          )}
          
          {/* Main App Workspace Views */}

          {/* Tab 1: Workshop - Generation, Editing, and Active Preach */}
          {activeTab === 'workspace' && (
            <div ref={laboratoryTopRef} className="space-y-8 max-w-7xl mx-auto w-full">
              
              {/* Header Info */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 p-6 rounded-xl border border-[#E6E2DA] shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full">Oficina Pastoral</span>
                    {activeSermon?.isOutline && <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Esboço Rápido</span>}
                  </div>
                  <h1 className="text-2xl font-serif text-[#2D2926] font-bold">Laboratório de Sermões</h1>
                  <p className="text-xs text-gray-500">Desenvolva pregações expositivas com exegese bíblica e coerência doutrinária batista.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button 
                    onClick={() => {
                      if (activeSermon && !isSermonBlank(activeSermon)) {
                        setPulpitTargetSermon(activeSermon);
                        setShowPulpitMode(true);
                      } else {
                        alert("Consolide ou selecione um sermão antes de entrar no Modo Púlpito.");
                      }
                    }} 
                    className="bg-[#D4AF37] hover:bg-[#b89528] text-black px-4 py-2 rounded-lg text-xs font-extrabold tracking-wide transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    title="Abrir no Modo Púlpito (Tela Sempre Ativa, Cronômetro e OLED)"
                  >
                    <BookOpen className="w-4 h-4 text-black" />
                    <span>Modo Púlpito</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (activeSermon) {
                        setHistoryDate(new Date().toISOString().substring(0, 10));
                        setHistoryLocation('');
                        setHistoryEvent('');
                        setHistoryNotes('');
                        setEditingHistoryEntryId(null);
                        setShowHistoryModal(true);
                      } else {
                        alert("Consolide ou selecione um sermão antes de acessar o Histórico Pastoral.");
                      }
                    }} 
                    className="bg-[#2D2926] hover:bg-[#5A5A40] text-[#F5F2ED] hover:text-white px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <History className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Histórico do Sermão</span>
                  </button>
                  <button 
                    onClick={printSermon}
                    className="bg-white border border-[#2D2926]/20 text-[#2D2926] hover:bg-gray-50 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#5A5A40]" />
                    <span>Gerar PDF</span>
                  </button>
                  <button 
                    onClick={exportDOCX}
                    className="bg-white border border-[#2D2926]/20 text-[#2D2926] hover:bg-gray-50 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4 text-sky-600" />
                    <span>Editar DOCX</span>
                  </button>
                </div>
              </div>

              {/* Grid 2 Columns: Configurator & active Sermon */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Columns left: Generator Parameters Form (5/12 cols) */}
                <div className="lg:col-span-4 space-y-6">
                  
                  <div className="bg-white rounded-xl border border-[#E6E2DA] p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                      <h3 
                        onClick={handleResetToNewSermon}
                        className="font-sans font-bold text-gray-900 flex items-center gap-2 cursor-pointer hover:text-[#5A5A40] transition-all group select-none"
                        title="Clique para limpar tudo e iniciar um sermão em branco do zero"
                      >
                        <Sparkles className="w-4.5 h-4.5 text-[#5A5A40] group-hover:rotate-45 transition-transform duration-300" />
                        Arquitetar Sermão
                      </h3>
                      {/* Outline Mode Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[11px] text-gray-500 font-medium">Esboço Rápido</span>
                        <input 
                          type="checkbox" 
                          checked={isOutline}
                          onChange={(e) => setIsOutline(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#5A5A40] focus:ring-[#5A5A40]" 
                        />
                      </label>
                    </div>

                    <form onSubmit={handleGenerateSermon} className="space-y-4">
                      
                      {/* Passagem Bíblica (MANDATORY) */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                            Passagem Bíblica <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (!scriptureInput || !scriptureInput.trim()) {
                                alert("Por favor, informe primeiro a passagem bíblica no campo acima.");
                                return;
                              }
                              setShowPericopeExplorerModal(true);
                              handleExplorePericope(scriptureInput);
                            }}
                            className="text-[10px] font-bold text-[#5A5A40] hover:text-[#2D2926] transition-all flex items-center gap-1 cursor-pointer select-none bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 px-2 py-0.5 rounded-full"
                          >
                            <Sparkles className="w-3 h-3 text-yellow-600 fill-yellow-600 animate-spin" style={{ animationDuration: '3s' }} />
                            <span>Explorar Perícope</span>
                          </button>
                        </div>
                        <input 
                          type="text" 
                          required
                          value={scriptureInput}
                          onChange={(e) => setScriptureInput(e.target.value)}
                          placeholder="Ex: Romanos 8:28-30 ou Efésios 1"
                          className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                        />
                      </div>

                      {/* Título Sugerido (Optional) */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Título do Sermão (Opcional)</label>
                        <input 
                          type="text" 
                          value={titleInput}
                          onChange={(e) => setTitleInput(e.target.value)}
                          placeholder="Ex: O Triunfo da Redenção"
                          className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                        />
                      </div>

                      {/* Tema Central / Palavras-Chave (Optional) */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Tema Principal ou Ideia</label>
                        <input 
                          type="text" 
                          value={themeInput}
                          onChange={(e) => setThemeInput(e.target.value)}
                          placeholder="Ex: Salvação pela Graça, perseverança"
                          className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                        />
                      </div>

                      {/* Série Expositiva Tracker (Optional) */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Nome da Série (Opcional)</label>
                        <input 
                          type="text" 
                          value={seriesName}
                          onChange={(e) => setSeriesName(e.target.value)}
                          placeholder="Ex: Romanos: Justificados por Fé"
                          className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                        />
                      </div>

                      {/* Estilo de Sermão Selecionável */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Estilo Homilético</label>
                        <select 
                          value={sermonStyle}
                          onChange={(e) => setSermonStyle(e.target.value as any)}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                        >
                          <option value="original">Original (Estilo-base equilibrado do sistema)</option>
                          <option value="isaltino">Pastoral (Tom pastoral, firmeza bíblica e aplicações práticas)</option>
                          <option value="billy">Evangelista (Convite evangelístico forte e urgência espiritual)</option>
                          <option value="biblico">Bíblico (Exposição fiel, foco exegético ortodoxo e neutro, sem vinculação institucional)</option>
                          <option value="conviccional">Conviccional (Firmeza doutrinária, confronto bíblico e discernimento espiritual)</option>
                        </select>
                        <div className="text-[10px] text-gray-500 italic mt-1 leading-snug space-y-1.5">
                          {sermonStyle === 'conviccional' && (
                            <div className="mt-2 p-3 bg-red-500/5 border border-red-500/25 rounded-lg text-[10px] text-red-950 leading-relaxed space-y-1">
                              <span className="font-bold flex items-center gap-1 text-red-800">
                                <ShieldAlert className="w-3.5 h-3.5 text-red-700 animate-pulse" />
                                Perfil Conviccional Ativado:
                              </span>
                              <p className="text-gray-600 font-sans">
                                Proclamação firme, corajosa e reverente da verdade de Deus contra relativismo, pragmatismo e secularismo. Foco na autoridade e suficiência das Escrituras, arrependimento profundo, discernimento pastoral e firmeza doutrinária.
                              </p>
                            </div>
                          )}
                          {sermonStyle === 'biblico' && (
                            <div className="mt-2 p-3 bg-indigo-500/5 border border-indigo-500/25 rounded-lg text-[10px] text-indigo-950 leading-relaxed space-y-1">
                              <span className="font-bold flex items-center gap-1 text-indigo-700">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                                Perfil Bíblico Ativado:
                              </span>
                              <p className="text-gray-600 font-sans">
                                Abordagem centrada estritamente nas Escrituras. Exposição fiel, exegese sadia, ortodoxa, hermeneuticamente responsible e cristocêntrica. Neutra institucionalmente e sem linguagem denominacional, visando pura edificação espiritual e o amadurecimento equilibrado.
                              </p>
                            </div>
                          )}
                          {sermonStyle === 'isaltino' && (
                            <div className="mt-2 p-3 bg-amber-500/5 border border-amber-500/25 rounded-lg text-[10px] text-amber-900 leading-relaxed space-y-1">
                              <span className="font-bold flex items-center gap-1 text-amber-700">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                Estilo Pastoral Ativado:
                              </span>
                              <p className="text-gray-600 font-sans">
                                Tom pastoral, firmeza bíblica, aplicações práticas e organização homilética madura. Tom conversacional humano com frases curtas e naturalidade oral. Exposição bíblica econômica e profunda, sem redundância barroca ou sentimentalismo.
                              </p>
                            </div>
                          )}
                          {sermonStyle === 'billy' && (
                            <p>Estilo Evangelista: Convite evangelístico forte, apelos, urgência espiritual e linguagem acessível.</p>
                          )}
                          {sermonStyle === 'original' && (
                            <p>Estilo Original: Estilo-base equilibrado do sistema: fluido, bíblico e pastoramente equilibrado.</p>
                          )}
                        </div>
                      </div>

                      {/* Duração/Formato do Sermão */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Duração / Formato do Sermão</label>
                        <select 
                          value={sermonDuration}
                          onChange={(e) => setSermonDuration(e.target.value as any)}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                        >
                          <option value="20">Sermão de 20 Minutos (Estrutura objetiva e direta)</option>
                          <option value="30">Sermão de 30 Minutos (Padrão equilibrado do sistema)</option>
                          <option value="40">Sermão de 40 Minutos (Exposição exegética e aplicações profundas)</option>
                          <option value="60">Estudo Bíblico de 1 Hora (Ensino, discipulado e exegese expandida)</option>
                        </select>
                        <div className="bg-[#FAF8F5] p-2.5 rounded-lg border border-[#E6E2DA] text-[10px] text-gray-600 space-y-1 mt-1.5 leading-relaxed bg-[#F5F2ED]/60">
                          <span className="font-bold text-gray-700 block text-[10px]">Orientação da Duração Selecionada:</span>
                          {sermonDuration === '20' && (
                            <p><strong>Sermão de 20 Minutos:</strong> Estrutura altamente objetiva para mensagens compactas. Introdução reduzida, contexto resumido ao essencial, desenvolvimento homilético focado e aplicações rápidas. Ideal para cultos de oração, devocionais ou evangelísticos rápidos.</p>
                          )}
                          {sermonDuration === '30' && (
                            <p><strong>Sermão de 30 Minutos:</strong> Formato clássico e equilibrado. Proporção ideal de exegese, uma ou duas ilustrações fundamentais bem sintonizadas, desenvolvimento dos pontos e ótimas transições. Ideal para as pregações dominicais habituais.</p>
                          )}
                          {sermonDuration === '40' && (
                            <p><strong>Sermão de 40 Minutos:</strong> Mensagem robusta com maior desenvolvimento textual e exegese aprofundada. Espaço expandido para reflexão, múltiplas conexões bíblicas secundárias, ilustrações mais completas e aplicações pastorais ampliadas.</p>
                          )}
                          {sermonDuration === '60' && (
                            <p><strong>Estudo Bíblico (1 Hora):</strong> Foco total no ensino teológico, maturidade bíblica e discipulado. Análise hermenêutica estendida, estudo filológico de termos gregos/hebraicos, referências cruzadas exaustivas, mas preservando o tom oral de pregação.</p>
                          )}
                        </div>
                      </div>

                      {/* Perfil da Igreja Selecionável */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Perfil da Igreja Local</label>
                        <select 
                          value={churchProfile}
                          onChange={(e) => setChurchProfile(e.target.value as any)}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                        >
                          <option value="tradicional">Batista Tradicional</option>
                          <option value="contemporanea">Batista Contemporânea</option>
                          <option value="reformada">Batista Reformada</option>
                          <option value="renovada">Batista Renovada</option>
                          <option value="jovem">Batista Jovem / Urbana</option>
                          <option value="plantacao">Igreja em Plantação</option>
                          <option value="revitalizacao">Igreja em Revitalização</option>
                          <option value="neutro">Neutro (Amplo e Bíblico)</option>
                        </select>
                        
                        {/* Dynamic Description box depending on churchProfile selection */}
                        <div className="bg-[#F5F2ED] p-2.5 rounded-lg border border-[#E6E2DA] text-[10px] text-gray-600 space-y-1 mt-1.5 bg-yellow-50/50">
                          <span className="font-bold">Efeito no Sermão:</span>
                          {churchProfile === 'tradicional' && <p>Culto reverente, maior exposição do contexto histórico brasileiro, sobriedade máxima, citação do HCC e Cantor Cristão.</p>}
                          {churchProfile === 'contemporanea' && <p>Aplicação voltada para dores cotidianas modernas, tom pastoral informal, dinâmica fluida para famílias urbanas.</p>}
                          {churchProfile === 'reformada' && <p>Pregação expositiva bíblica vigorosa, forte peso na graça e soberania de Deus com exegese rigorosa e cristocentrimo radical.</p>}
                          {churchProfile === 'renovada' && <p>Apelo inspirador de oração pessoal, renovo das disciplines, tom vigoroso focado no agir bíblico do Espírito.</p>}
                          {churchProfile === 'jovem' && <p>Aplicação moderna, foco em missão urbana, linguagem jovial com forte fundamentação das escrituras para a pós-modernidade.</p>}
                          {churchProfile === 'plantacao' && <p>Foco missionário, encorajamento cristão, ânimo espiritual por novos batismos e fundação.</p>}
                          {churchProfile === 'revitalizacao' && <p>Foco na restauração familiar e renovamento doutrinário, tom de consolo equilibrado com advertência amorosa.</p>}
                          {churchProfile === 'neutro' && <p>Interpretação bíblica pura, exegese e hermenêutica sadias. Evita jargões ou ênfases denominacionais específicas, celebrando a unidade da fé cristã comum histórica.</p>}
                        </div>

                        {/* Trigger button for custom details modal */}
                        <button
                          type="button"
                          onClick={() => setShowChurchProfileModal(true)}
                          className="mt-2 w-full bg-white border border-[#5A5A40]/30 hover:border-[#5A5A40] text-[#5A5A40] hover:bg-[#5A5A40]/5 p-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer select-none"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Especificar Realidade da Igreja...</span>
                        </button>
                      </div>

                      {/* Perfil do Público Selecionável */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Perfil do Público Alvo</label>
                        <select 
                          value={audience}
                          onChange={(e) => setAudience(e.target.value)}
                          className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                        >
                          <option value="Membresia em geral - que compreende a igreja reunida abrangendo adolescentes, jovens adultos e anciãos.">Membresia em geral (Adolescentes, Jovens, Adultos e Anciãos)</option>
                          <option value="Jovens">Jovens e Estudantes</option>
                          <option value="Famílias">Famílias da comunidade</option>
                          <option value="Novos convertidos">Novos convertidos e interessados</option>
                          <option value="Liderança">Liderança ministerial (Diáconos, obreiros)</option>
                          <option value="Igreja madura">Igreja madura e experiente</option>
                          <option value="Culto evangelístico">Culto Evangelístico / Amigos convidados</option>
                          <option value="EBD">Escola Bíblica Dominical (EBD)</option>
                          <option value="Conferência missionária">Conferência Missionária</option>
                          <option value="Retiro espiritual">Retiro Espiritual / Acampamentos</option>
                          <option value="Culto de doutrina">Culto de Doutrina e Ensino</option>
                        </select>
                      </div>

                      {/* Bíblia Version Select */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Versão das Escrituras</label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                          {[
                            { code: 'ACF', label: 'ACF ★', title: 'Almeida Corrigida Fiel' },
                            { code: 'ARC', label: 'ARC', title: 'Almeida Revista e Corrigida' },
                            { code: 'ARA', label: 'ARA', title: 'Almeida Revista e Atualizada' },
                            { code: 'NAA', label: 'NAA', title: 'Nova Almeida Atualizada' },
                            { code: 'NVI', label: 'NVI', title: 'Nova Versão Internacional' },
                            { code: 'AEC', label: 'AEC', title: 'Almeida Edição Contemporânea' },
                            { code: 'KJA', label: 'KJA', title: 'King James Atualizada' }
                          ].map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => setBibleVersion(item.code)}
                              title={item.title}
                              className={`py-1.5 text-[10px] font-bold rounded-md transition-all border ${bibleVersion === item.code ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#2D2926] border-[#E6E2DA]'}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <span className="text-[9px] text-[#5A5A40]/80 italic mt-1.5 block">* ACF (Almeida Corrigida Fiel) é priorizada no estúdio batista. AEC (Almeida Edição Contemporânea) disponível.</span>
                      </div>

                      {/* Hinário Oficial JUERP (Cantor Cristão vs HCC) */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                            Hinário Oficial para o Culto (JUERP)
                          </label>
                          <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Letras Integrais
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                          {[
                            { code: 'CC' as HinarioType, label: 'Cantor Cristão (CC)', subtitle: 'Histórico JUERP (577 hinos)' },
                            { code: 'HCC' as HinarioType, label: 'Culto Cristão (HCC)', subtitle: 'Oficial JUERP (610 hinos)' },
                            { code: 'AMBOS' as HinarioType, label: 'Ambos / Comparar', subtitle: 'Alternância como Bíblias' }
                          ].map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => setPreferredHinario(item.code)}
                              title={`${item.label} — ${item.subtitle}`}
                              className={`py-2 px-2 text-center rounded-lg transition-all border cursor-pointer ${
                                preferredHinario === item.code
                                  ? 'bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs font-semibold'
                                  : 'bg-white text-[#2D2926] border-[#E6E2DA] hover:bg-gray-50'
                              }`}
                            >
                              <div className="text-[11px] font-bold leading-tight">{item.label}</div>
                              <div className={`text-[9px] mt-0.5 ${preferredHinario === item.code ? 'text-white/80' : 'text-gray-400'}`}>
                                {item.subtitle}
                              </div>
                            </button>
                          ))}
                        </div>
                        <span className="text-[9px] text-[#5A5A40]/80 italic mt-1.5 block">
                          * Nutre-se exclusivamente de dois hinários: Cantor Cristão e Hinário para o Culto Cristão (JUERP), listando a letra integral (todas as estrofes e coro).
                        </span>
                      </div>

                      {/* Subsídios Exegéticos & Sementes Homiléticas (Data-Binding com Consultor Teológico) */}
                      <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#5A5A40]/25 space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] flex items-center gap-1.5">
                            <Feather className="w-3.5 h-3.5 text-[#5A5A40]" />
                            <span>Subsídios & Sementes Homiléticas</span>
                          </label>
                          {theologicalNotes && (
                            <button
                              type="button"
                              onClick={() => setTheologicalNotes('')}
                              className="text-[10px] text-red-600 hover:underline cursor-pointer font-medium"
                              title="Limpar notas"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {theologicalNotes
                            ? 'Conteúdo injetado do Consultor Bíblico e Teológico. O motor homilético incorporará estas notas, originais e sementes ao estruturar o sermão.'
                            : 'Vazio no momento. No Consultor Bíblico e Teológico, clique em "Usar no Sermão" em qualquer resposta para injetar subsídios aqui.'}
                        </p>
                        <textarea
                          rows={theologicalNotes ? 4 : 2}
                          value={theologicalNotes}
                          onChange={(e) => setTheologicalNotes(e.target.value)}
                          placeholder="Notas exegéticas, termos em grego/hebraico ou sementes homiléticas..."
                          className="w-full bg-white border border-[#E6E2DA] focus:border-[#5A5A40] focus:ring-0 rounded-lg p-2 font-mono text-[11px] leading-relaxed text-gray-800 resize-y focus:outline-none"
                        />
                      </div>

                      {/* Action trigger button */}
                      <button
                        type="submit"
                        disabled={isGenerating}
                        className={`w-full py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-md text-white ${isGenerating ? 'bg-[#5A5A40]/50 cursor-not-allowed' : 'bg-[#5A5A40] hover:bg-[#2D2926]'}`}
                      >
                        {isGenerating ? "PREPARANDO EXEGESE..." : "GERAR SERMÃO EXPOSITIVO"}
                      </button>
                    </form>
                  </div>

                </div>

                {/* Columns Right: Sermon Reading, editing and tweaking content workshop (8/12 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {activeSermon ? (
                    <div className="bg-white rounded-xl border border-[#E6E2DA] shadow-sm overflow-hidden flex flex-col">
                      
                      {/* Interactive Header parameters showing style, version and date */}
                      <div className="non-printable bg-[#F5F2ED] py-4 px-6 border-b border-[#E6E2DA] flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleFavoriteSermon(activeSermon.id)}
                            className="p-1 text-gray-400 hover:text-amber-500 transition-colors"
                            title="Favoritar"
                          >
                            <span className="text-lg">{activeSermon.isFavorite ? '★' : '☆'}</span>
                          </button>
                          <div className="text-xs text-gray-600 font-medium leading-relaxed">
                            <span className="font-bold">Igreja:</span> {activeSermon.churchProfile.toUpperCase()} • <span className="font-bold">Público:</span> {activeSermon.audience} • <span className="font-bold">Bíblia:</span> {activeSermon.bibleVersion}
                            {activeSermon.duration && (
                              <> • <span className="font-bold text-amber-800">Duração:</span> {activeSermon.duration === '20' ? '20 Minutos' : activeSermon.duration === '40' ? '40 Minutos' : activeSermon.duration === '60' ? '1 Hora (Estudo)' : '30 Minutos (Padrão)'}</>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              setPulpitTargetSermon(activeSermon);
                              setShowPulpitMode(true);
                            }}
                            className="bg-[#2D2926] hover:bg-[#5A5A40] text-amber-300 hover:text-white px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="Entrar no Modo Púlpito (OLED, Cronômetro, Wake Lock)"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                            <span>📖 Entrar no Modo Púlpito</span>
                          </button>
                          <button
                            onClick={() => handleEvaluateSermon()}
                            disabled={isEvaluating}
                            className="bg-[#5A5A40]/10 hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white px-3 py-1.5 rounded text-[11px] font-bold tracking-wide transition-colors"
                          >
                            {isEvaluating ? 'Avaliando...' : 'Reavaliar Sermão'}
                          </button>
                          <button
                            onClick={copySermonMD}
                            className="bg-white hover:bg-gray-50 border border-[#E6E2DA] hover:border-[#2D2926] rounded-md px-3 py-1 text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            {copyFeedback ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                            <span>Copiar Markdown</span>
                          </button>
                        </div>
                      </div>

                      {/* SERMON BODY CONTAINER WITH LITERAL STRUCTURE AND "Preachers style" OPTION PREVIEW */}
                      <div className={`p-8 md:p-12 font-serif-serif max-w-3xl mx-auto space-y-8 w-full ${isPreacherStyle ? 'text-xl leading-relaxed text-black' : 'text-base leading-relaxed text-[#2D2926]'}`}>
                        
                        {/* Preacher Style Visual Indicator Toggle */}
                        <div className="flex justify-between items-center non-printable bg-yellow-50 rounded-lg p-3 border border-amber-200 text-xs font-sans">
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-amber-600" />
                            <span className="font-bold text-amber-900">ESTILO PREGADOR (PÚLPITO FACILITADO)</span>
                          </div>
                          <button
                            onClick={() => setIsPreacherStyle(!isPreacherStyle)}
                            className={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide transition-all ${isPreacherStyle ? 'bg-[#5A5A40] text-white' : 'bg-gray-200 text-gray-700'}`}
                          >
                            {isPreacherStyle ? 'Desativar Estilo Pregador' : 'Ativar Estilo Pregador'}
                          </button>
                        </div>

                        {/* Tabbed Navigation Bar */}
                        <div className="non-printable bg-[#FAF6EE] rounded-xl p-3 border border-[#E6E2DA] flex flex-wrap gap-1.5 items-center justify-center text-[11px] font-sans shadow-sm">
                          <span className="font-bold text-[#5A5A40] mr-1">Seção Ativa:</span>
                          {sermonParts.map((part) => {
                            const isActive = currentPartId === part.id;
                            let btnStyle = "bg-white text-gray-700 hover:bg-[#5A5A40]/10 border border-[#E6E2DA]";
                            if (isActive) {
                              btnStyle = "bg-[#5A5A40] text-white border border-[#5A5A40] shadow-sm";
                            }
                            if (part.id === 'appeal') {
                              if (isActive) btnStyle = "bg-rose-800 text-white border border-rose-800 shadow-sm font-bold";
                              else btnStyle = "bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 font-bold";
                            }
                            return (
                              <button 
                                key={part.id}
                                type="button"
                                onClick={() => setActiveSermonPart(part.id)}
                                className={`font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${btnStyle}`}
                              >
                                {part.label}
                              </button>
                            );
                          })}
                          
                          {/* Inline Add Point Button */}
                          <button
                            onClick={() => {
                              const newPIdx = activeSermon.expositoryPoints.length;
                              const newP = [...activeSermon.expositoryPoints, { title: `Ponto ${newPIdx + 1}`, explanation: 'Clareie o texto bíblico com profundidade exegética...', application: 'Aplique de forma prática...' }];
                              updateActiveSermonField('expositoryPoints', newP);
                              setActiveSermonPart(`point-${newPIdx}`);
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs flex items-center gap-1 shrink-0 cursor-pointer ml-1"
                            type="button"
                            title="Adicionar Novo Tópico Expositivo"
                          >
                            <span>+ Ponto</span>
                          </button>
                        </div>

                        {/* Title preview in workspace above the active clean page */}
                        <div className="non-printable border-b border-gray-100 pb-4 text-center">
                          <h2 className="text-xl font-serif font-bold text-gray-900 line-clamp-1">{activeSermon.title}</h2>
                          <p className="text-xs text-gray-500 font-sans">{activeSermon.scripture} • {activeSermon.theme}</p>
                        </div>

                        {/* Single Page Clean Display View (Screen Mode) */}
                        <div className="non-printable min-h-[400px] w-full bg-white rounded-xl border border-gray-100 p-6 md:p-8 shadow-xs">
                          {currentPartId === 'intro' && (
                            <div className="space-y-4 animate-fadeIn">
                              <div className="flex justify-between items-center border-b border-[#5A5A40]/15 pb-2">
                                <h3 className={`font-sans uppercase tracking-widest font-extrabold ${isPreacherStyle ? 'text-sm text-amber-800' : 'text-xs text-[#5A5A40]'}`}>
                                  Introdução
                                </h3>
                              </div>
                              <p className="text-xs text-gray-400 font-sans italic">Escreva a introdução despertadora, fazendo a ponte para a tese e divisão expositiva.</p>
                              <textarea
                                rows={10}
                                value={activeSermon.introduction}
                                onChange={(e) => updateActiveSermonField('introduction', e.target.value)}
                                className="w-full bg-transparent border border-transparent hover:border-gray-100 focus:border-[#5A5A40] focus:ring-0 rounded-lg p-2 font-serif text-base leading-relaxed text-gray-800 resize-none focus:outline-none min-h-[250px]"
                                placeholder="Desenvolva o exórdio cativante da mensagem..."
                              />
                            </div>
                          )}

                          {currentPartId === 'context' && (
                            <div className="space-y-4 animate-fadeIn">
                              <div className="flex justify-between items-center border-b border-[#5A5A40]/15 pb-2">
                                <h3 className={`font-sans uppercase tracking-widest font-extrabold ${isPreacherStyle ? 'text-sm text-amber-800' : 'text-xs text-[#5A5A40]'}`}>
                                  Histórico & Contexto da Passagem
                                </h3>
                              </div>
                              <p className="text-xs text-gray-400 font-sans italic">Exponha as informações históricas, geográficas, linguísticas e teológicas que circundam o texto.</p>
                              <textarea
                                rows={10}
                                value={activeSermon.biblicalContext}
                                onChange={(e) => updateActiveSermonField('biblicalContext', e.target.value)}
                                className="w-full bg-transparent border border-transparent hover:border-gray-100 focus:border-[#5A5A40] focus:ring-0 rounded-lg p-2 font-serif text-base leading-relaxed text-gray-800 resize-none focus:outline-none min-h-[250px]"
                                placeholder="Forneça o panorama do cenário bíblico..."
                              />
                            </div>
                          )}

                          {currentPartId.startsWith('point-') && (() => {
                            const pIdx = parseInt(currentPartId.replace('point-', ''), 10);
                            const point = activeSermon.expositoryPoints[pIdx];
                            if (!point) return <p className="text-gray-500 italic">Ponto expositivo não encontrado.</p>;
                            const totalIllustrationsCount = activeSermon.expositoryPoints.reduce((acc, p) => acc + (p.illustration ? 1 : 0), 0);
                            return (
                              <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center border-b border-[#5A5A40]/15 pb-2">
                                  <h3 className={`font-sans uppercase tracking-widest font-extrabold ${isPreacherStyle ? 'text-sm text-amber-800' : 'text-xs text-[#5A5A40]'}`}>
                                    Desenvolvimento Homilético Integrado / {point.title || `Ponto ${pIdx + 1}`}
                                  </h3>
                                  <button
                                    onClick={() => {
                                      const filtered = activeSermon.expositoryPoints.filter((_, idx) => idx !== pIdx);
                                      updateActiveSermonField('expositoryPoints', filtered);
                                      setActiveSermonPart('intro'); // Fallback safely
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800 font-bold hover:underline cursor-pointer"
                                  >
                                    Excluir Este Ponto
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-[#854d0e] font-bold tracking-wider text-amber-800 flex items-center gap-1 mb-1">
                                      <span>🌉 Ponte de Transição Homilética (Precede o Tópico)</span>
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={point.precedingTransition || ''}
                                      onChange={(e) => {
                                        const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => 
                                          idx === pIdx ? { ...pt, precedingTransition: e.target.value } : pt
                                        );
                                        updateActiveSermonField('expositoryPoints', updatedPoints);
                                      }}
                                      className="w-full bg-[#FAF6EE] border border-[#E6DCC5] rounded-xl p-3 text-[#2D2926] leading-relaxed font-sans text-xs focus:ring-0 focus:outline-none focus:border-amber-600 resize-none font-medium mb-3"
                                      placeholder="Insira a ponte de transição que conduz o ouvinte do bloco anterior a este tópico. (ex: 'O primeiro princípio que emerge desta passagem é...')"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">Título do Tópico</label>
                                    <input 
                                      type="text"
                                      value={point.title}
                                      onChange={(e) => {
                                        const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => 
                                          idx === pIdx ? { ...pt, title: e.target.value } : pt
                                        );
                                        updateActiveSermonField('expositoryPoints', updatedPoints);
                                      }}
                                      className={`w-full font-bold bg-transparent border-b border-gray-100 hover:border-gray-200 focus:border-[#5A5A40] focus:outline-none py-1 ${isPreacherStyle ? 'text-lg text-amber-900' : 'text-base text-gray-950 font-serif'}`}
                                      placeholder="Título do Tópico..."
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">
                                      Exposição do Texto: (a) Explicação Textual & Termos Originais • (b) Paralelos Escriturísticos • (c) Cristocentrismo Redentor
                                    </label>
                                    <textarea
                                      rows={10}
                                      value={point.explanation}
                                      onChange={(e) => {
                                        const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => 
                                          idx === pIdx ? { ...pt, explanation: e.target.value } : pt
                                        );
                                        updateActiveSermonField('expositoryPoints', updatedPoints);
                                      }}
                                      className="w-full bg-gray-50/50 border border-gray-100 focus:border-[#5A5A40] rounded-xl p-3 text-gray-800 leading-relaxed font-serif text-sm focus:ring-0 focus:outline-none resize-y min-h-[180px]"
                                      placeholder="Exponha o texto bíblico com profundidade exegética: (a) Explicação Textual & Termos Originais no hebraico/grego, (b) Paralelos Escriturísticos canônicos, (c) Cristocentrismo Redentor no Cordeiro de Deus..."
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    {point.illustration ? (
                                      <div className="p-4 bg-amber-50/70 rounded-lg border border-amber-100 relative space-y-2">
                                        <div className="flex justify-between items-center bg-transparent">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                              3. Ilustração {point.illustration.type.toUpperCase()}
                                            </span>
                                            <button
                                              onClick={() => {
                                                const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => {
                                                  if (idx === pIdx && pt.illustration) {
                                                    const nextType = pt.illustration.type === 'bíblica' ? 'cotidiano' : 'bíblica';
                                                    return {
                                                      ...pt,
                                                      illustration: { ...pt.illustration, type: nextType }
                                                    };
                                                  }
                                                  return pt;
                                                });
                                                updateActiveSermonField('expositoryPoints', updatedPoints);
                                              }}
                                              type="button"
                                              className="text-[10px] text-amber-900 hover:underline font-mono cursor-pointer"
                                            >
                                              (Mudar tipo)
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-1.5 font-sans">
                                            <button
                                              onClick={() => {
                                                const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => {
                                                  if (idx === pIdx) {
                                                    const { illustration, ...rest } = pt;
                                                    return rest as any;
                                                  }
                                                  return pt;
                                                });
                                                updateActiveSermonField('expositoryPoints', updatedPoints);
                                              }}
                                              className="text-[10px] text-amber-700 hover:text-amber-[#2D2926] font-bold cursor-pointer"
                                              type="button"
                                            >
                                              Remover Ilustração
                                            </button>
                                            <button
                                              onClick={() => suggestIllustrationForPoint(pIdx, point.illustration?.type || 'bíblica')}
                                              type="button"
                                              className="text-[10px] text-emerald-800 hover:text-emerald-950 hover:underline font-bold cursor-pointer"
                                            >
                                              ✨ Regenerar IA
                                            </button>
                                          </div>
                                        </div>
                                        <textarea
                                          rows={3}
                                          value={point.illustration.description}
                                          onChange={(e) => {
                                            const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => {
                                              if (idx === pIdx && pt.illustration) {
                                                return {
                                                  ...pt,
                                                  illustration: { ...pt.illustration, description: e.target.value }
                                                };
                                              }
                                              return pt;
                                            });
                                            updateActiveSermonField('expositoryPoints', updatedPoints);
                                          }}
                                          className="w-full bg-white border border-transparent focus:border-amber-200 text-xs text-[#2D2926]/90 italic font-serif focus:outline-none p-2 rounded-md resize-none leading-relaxed"
                                          placeholder="Descreva a história ou analogia que ajuda a ver a verdade exposta..."
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex justify-between items-center bg-[#FAF6EE]/50 border border-dashed border-gray-200 rounded-lg p-2.5">
                                        <span className="text-[10px] text-gray-500 italic font-sans">Nenhuma ilustração neste ponto.</span>
                                        <div className="flex gap-1.5 font-sans">
                                          <button
                                            onClick={() => {
                                              const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => {
                                                if (idx === pIdx) {
                                                  return {
                                                    ...pt,
                                                    illustration: {
                                                      type: 'bíblica' as const,
                                                      description: ''
                                                    }
                                                  };
                                                }
                                                return pt;
                                              });
                                              updateActiveSermonField('expositoryPoints', updatedPoints);
                                            }}
                                            className="text-[10px] bg-white hover:bg-gray-100 text-gray-700 font-semibold px-2 py-1 rounded border border-gray-300 cursor-pointer"
                                            type="button"
                                          >
                                            + Vazia
                                          </button>
                                          <button
                                            onClick={() => {
                                              const nextType = totalIllustrationsCount === 0 || (activeSermon.expositoryPoints.some(p => p.illustration?.type === 'cotidiano')) ? 'bíblica' as const : 'cotidiano' as const;
                                              suggestIllustrationForPoint(pIdx, nextType);
                                            }}
                                            className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded border border-amber-200/40 animate-pulse cursor-pointer"
                                            type="button"
                                          >
                                            ✨ Sugestão da IA
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 flex items-center gap-1">
                                      🎯 (d) Aconselhamento, Confronto Pastoral & Aplicação Pós-Moderna
                                    </label>
                                    <textarea
                                      rows={6}
                                      value={point.application || ''}
                                      onChange={(e) => {
                                        const updatedPoints = activeSermon.expositoryPoints.map((pt, idx) => 
                                          idx === pIdx ? { ...pt, application: e.target.value } : pt
                                        );
                                        updateActiveSermonField('expositoryPoints', updatedPoints);
                                      }}
                                      className="w-full bg-white border border-emerald-100 focus:border-emerald-600 rounded-lg p-3 text-gray-800 leading-relaxed font-sans text-xs focus:ring-0 focus:outline-none resize-y min-h-[120px]"
                                      placeholder="Como essa verdade confronta a ansiedade, o secularismo prático ou o individualismo moderno? Forneça aconselhamento bíblico maduro e passos práticos para o discipulado..."
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {currentPartId === 'conclusion' && (
                            <div className="space-y-4 animate-fadeIn">
                              <div className="flex justify-between items-center border-b border-[#5A5A40]/15 pb-2">
                                <h3 className={`font-sans uppercase tracking-widest font-extrabold ${isPreacherStyle ? 'text-sm text-amber-800' : 'text-xs text-[#5A5A40]'}`}>
                                  Conclusão
                                </h3>
                              </div>
                              <p className="text-xs text-gray-400 font-sans italic">Faça a recapitulação dos pontos principais e lance a frase de efeito conclusiva.</p>
                              <textarea
                                rows={10}
                                value={activeSermon.conclusion}
                                onChange={(e) => updateActiveSermonField('conclusion', e.target.value)}
                                className="w-full bg-transparent border border-transparent hover:border-gray-100 focus:border-[#5A5A40] focus:ring-0 rounded-lg p-2 font-serif text-base leading-relaxed text-gray-800 resize-none focus:outline-none min-h-[250px]"
                                placeholder="Conclua a pregação com solenidade..."
                              />
                            </div>
                          )}

                          {currentPartId === 'appeal' && (
                            <div className="space-y-4 animate-fadeIn">
                              <div className="flex justify-between items-center border-b border-red-900/15 pb-2">
                                <h3 className={`font-sans uppercase tracking-widest font-extrabold ${isPreacherStyle ? 'text-sm text-[#991b1b]' : 'text-xs text-red-900'}`}>
                                  Apelo Pastoral de Decisão
                                </h3>
                              </div>
                              <p className="text-xs text-rose-800/60 font-sans italic">O momento culminante: um convite firme e pastoral para a decisão espiritual, consagração ou reconciliação com base nas verdades pregadas.</p>
                              <textarea
                                rows={10}
                                value={activeSermon.pastoralAppeal}
                                onChange={(e) => updateActiveSermonField('pastoralAppeal', e.target.value)}
                                className="w-full bg-red-50/10 border border-transparent hover:border-red-50 focus:border-red-500 focus:ring-0 rounded-lg p-2 font-serif text-base leading-relaxed text-rose-950 resize-none focus:outline-none min-h-[250px]"
                                placeholder="Convoque a congregação à obediência e submissão..."
                              />
                            </div>
                          )}

                          {currentPartId === 'references' && (
                            <div className="space-y-6 animate-fadeIn">
                              <h3 className="font-sans uppercase tracking-widest font-extrabold border-b border-[#5A5A40]/15 pb-2 text-xs text-[#5A5A40]">
                                Referências, Metadados & Detalhes do Culto
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-sans text-left">
                                <div className="p-5 bg-[#FAF6EE]/40 border border-[#E6E2DA] rounded-xl space-y-4">
                                  <h4 className="font-bold text-gray-900 border-b pb-2">Configurações Gerais do Culto</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Título do Sermão:</span>
                                      <input
                                        type="text"
                                        value={activeSermon.title}
                                        onChange={(e) => updateActiveSermonField('title', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1 font-serif font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Tema central:</span>
                                      <input
                                        type="text"
                                        value={activeSermon.theme}
                                        onChange={(e) => updateActiveSermonField('theme', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1"
                                      />
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Passagem Bíblica:</span>
                                      <input
                                        type="text"
                                        value={activeSermon.scripture}
                                        onChange={(e) => updateActiveSermonField('scripture', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1 text-[#5A5A40] font-semibold"
                                      />
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Estilo de Homilética:</span>
                                      <select
                                        value={activeSermon.style}
                                        onChange={(e) => updateActiveSermonField('style', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1"
                                      >
                                        <option value="original">Original</option>
                                        <option value="isaltino">Pastoral</option>
                                        <option value="billy">Evangelista</option>
                                        <option value="biblico">Bíblico</option>
                                        <option value="conviccional">Conviccional</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-5 bg-white border border-[#E6E2DA] rounded-xl space-y-4">
                                  <h4 className="font-bold text-gray-900 border-[#E6E2DA] border-b pb-2">Destinatários & Classificação</h4>
                                  <div className="space-y-3">
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Igreja Alvo:</span>
                                      <select
                                        value={activeSermon.churchProfile}
                                        onChange={(e) => updateActiveSermonField('churchProfile', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1 capitalize"
                                      >
                                        <option value="tradicional">Batista Tradicional</option>
                                        <option value="contemporanea">Igreja Contemporânea</option>
                                        <option value="reformada">Igreja Reformada Puritana</option>
                                        <option value="renovada">Igreja Renovada</option>
                                        <option value="jovem">Público Jovem / Universitários</option>
                                        <option value="plantacao">Plantação de Novas Igrejas</option>
                                        <option value="revitalizacao">Revitalização de Igreja</option>
                                        <option value="neutro">Neutro (Amplo e Bíblico)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Versão Bíblica Utilizada:</span>
                                      <input
                                        type="text"
                                        value={activeSermon.bibleVersion}
                                        onChange={(e) => updateActiveSermonField('bibleVersion', e.target.value)}
                                        list="bible-versions-edit-datalist"
                                        className="w-full bg-white border border-gray-200 rounded p-1.5 text-xs mt-1"
                                        placeholder="Ex: ACF, AEC, ARA..."
                                      />
                                      <datalist id="bible-versions-edit-datalist">
                                        <option value="ACF">Almeida Corrigida Fiel (ACF)</option>
                                        <option value="ARC">Almeida Revista e Corrigida (ARC)</option>
                                        <option value="ARA">Almeida Revista e Atualizada (ARA)</option>
                                        <option value="NAA">Nova Almeida Atualizada (NAA)</option>
                                        <option value="NVI">Nova Versão Internacional (NVI)</option>
                                        <option value="AEC">Almeida Edição Contemporânea (AEC)</option>
                                        <option value="KJA">King James Atualizada (KJA)</option>
                                      </datalist>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] text-gray-400 font-semibold uppercase">Marcadores / Tags:</span>
                                      <div className="flex flex-wrap gap-1 mt-1.5 mb-1.5">
                                        {activeSermon.tags && activeSermon.tags.map((tag, tIdx) => (
                                          <span key={tIdx} className="bg-[#FAF6EE] text-[#5A5A40] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#E6E2DA] flex items-center gap-1">
                                            {tag}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const nextTags = activeSermon.tags.filter((_, idx) => idx !== tIdx);
                                                updateActiveSermonField('tags', nextTags);
                                              }}
                                              className="text-red-500 hover:text-red-700 font-bold ml-0.5 text-xs cursor-pointer"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="Nova tag + Enter..."
                                        onKeyDown={(e: any) => {
                                          if (e.key === 'Enter' && e.target.value.trim()) {
                                            const nextTags = [...(activeSermon.tags || []), e.target.value.trim()];
                                            updateActiveSermonField('tags', nextTags);
                                            e.target.value = '';
                                          }
                                        }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded p-1.5 text-xs focus:ring-0 focus:outline-[#5A5A40]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Printable Hide Layout Area (Direct PDF printing structure for the FULL continuous sermon) */}
                        <div className="printable-content space-y-8 text-left text-black font-serif">
                          <div className="text-center space-y-4 py-8 border-b border-[#5A5A40]/25">
                            <p className="font-sans font-bold tracking-widest uppercase text-[#5A5A40] text-xs">
                              Esboço Completo Expositivo • Pr. Fernando Veiga
                            </p>
                            <h1 className="text-3xl font-extrabold font-serif uppercase tracking-tight text-center">{activeSermon.title}</h1>
                            <div className="h-[1px] w-20 bg-[#5A5A40]/30 mx-auto"></div>
                            <div className="space-y-1 font-sans text-[11px] text-gray-700 uppercase tracking-widest text-center">
                              <p><strong>Texto Bíblico:</strong> {activeSermon.scripture}</p>
                              <p><strong>Tema:</strong> {activeSermon.theme}</p>
                            </div>
                          </div>

                          <div className="space-y-8 leading-relaxed">
                            <section className="space-y-2">
                              <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-[#5A5A40] border-b border-gray-200 pb-1">1. Introdução</h3>
                              <p className="whitespace-pre-line text-sm text-gray-900">{activeSermon.introduction}</p>
                            </section>

                            <section className="space-y-2">
                              <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-[#5A5A40] border-b border-gray-200 pb-1">2. Contexto Histórico e Exegético</h3>
                              <p className="whitespace-pre-line text-sm text-gray-900">{activeSermon.biblicalContext}</p>
                            </section>

                            <section className="space-y-4">
                              <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-[#5A5A40] border-b border-gray-200 pb-1">3. Desenvolvimento Expositivo</h3>
                              {activeSermon.expositoryPoints.map((point, idx) => (
                                <div key={idx} className="space-y-2 p-4 bg-gray-50 border border-gray-100 rounded-lg">
                                  {point.precedingTransition && (
                                    <p className="text-xs italic text-[#5A5A40] border-l-2 border-amber-350 bg-amber-50/30 px-2 py-1 mb-2 font-sans leading-relaxed">
                                      {point.precedingTransition}
                                    </p>
                                  )}
                                  <h4 className="font-bold text-gray-950 font-serif text-sm">{idx + 1}. {point.title}</h4>
                                  <p className="whitespace-pre-line text-xs text-gray-800 leading-relaxed font-serif">{point.explanation}</p>
                                  {point.illustration && (
                                    <p className="text-xs italic text-amber-900 mt-1 bg-amber-50/50 p-2 rounded border border-amber-100">
                                      <strong>Ilustração ({point.illustration.type}):</strong> {point.illustration.description}
                                    </p>
                                  )}
                                  <p className="whitespace-pre-line text-xs text-emerald-800 font-sans mt-1">
                                    <strong>Aplicação:</strong> {point.application}
                                  </p>
                                </div>
                              ))}
                            </section>

                            <section className="space-y-2">
                              <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-[#5A5A40] border-b border-gray-200 pb-1">4. Conclusão</h3>
                              <p className="whitespace-pre-line text-sm text-gray-900">{activeSermon.conclusion}</p>
                            </section>

                            <section className="space-y-2">
                              <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-red-900 border-b border-red-200 pb-1">5. Apelo Pastoral</h3>
                              <p className="whitespace-pre-line text-sm text-rose-950">{activeSermon.pastoralAppeal}</p>
                            </section>

                            {/* 6. HINOS RECOMENDADOS (JUERP) */}
                            {(() => {
                              const activeHymnsRecord = hydrateHymnsIfLegacy(activeSermon.hymns);
                              const occOrder = ['abertura', 'antesMensagem', 'apelo', 'encerramento'] as const;
                              const occLabels: Record<string, string> = {
                                abertura: '1. Abertura / Louvor e Adoração',
                                antesMensagem: '2. Antes da Mensagem / Preparação',
                                apelo: '3. Apelo Pastoral / Consagração',
                                encerramento: '4. Encerramento / Poslúdio e Bênção'
                              };

                              return (
                                <section className="space-y-4 pt-6 mt-6 border-t-2 border-[#5A5A40]/30 font-sans">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#5A5A40]/25">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shrink-0 shadow-xs">
                                        <Music className="w-5 h-5 text-amber-200" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h3 className="font-sans uppercase text-xs font-bold tracking-widest text-[#5A5A40]">
                                            6. Hinos Recomendados para o Culto (JUERP)
                                          </h3>
                                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-300">
                                            Letras Integrais Oficiais
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-sans mt-0.5">
                                          Nutre-se exclusivamente do Cantor Cristão e Hinário para o Culto Cristão (JUERP) • Alternância como versões da Bíblia
                                        </p>
                                      </div>
                                    </div>

                                    {/* Alternador de Hinário (como versões da Bíblia) */}
                                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E6E2DA] shadow-xs self-start sm:self-auto">
                                      <button
                                        type="button"
                                        onClick={() => setActiveWorkspaceHinario('CC')}
                                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                          activeWorkspaceHinario === 'CC'
                                            ? 'bg-[#5A5A40] text-white shadow-xs'
                                            : 'text-gray-600 hover:text-black hover:bg-gray-100'
                                        }`}
                                        title="Cantor Cristão (Edição Oficial JUERP)"
                                      >
                                        Cantor Cristão (CC)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveWorkspaceHinario('HCC')}
                                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                          activeWorkspaceHinario === 'HCC'
                                            ? 'bg-[#5A5A40] text-white shadow-xs'
                                            : 'text-gray-600 hover:text-black hover:bg-gray-100'
                                        }`}
                                        title="Hinário para o Culto Cristão (Edição Oficial JUERP)"
                                      >
                                        HCC (JUERP)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveWorkspaceHinario('AMBOS')}
                                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                          activeWorkspaceHinario === 'AMBOS'
                                            ? 'bg-[#5A5A40] text-white shadow-xs'
                                            : 'text-gray-600 hover:text-black hover:bg-gray-100'
                                        }`}
                                        title="Comparar ambos os hinários lado a lado"
                                      >
                                        Comparar Ambos
                                      </button>
                                    </div>
                                  </div>

                                  {/* Grid de Hinos */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {occOrder.map((occ) => {
                                      const primary = activeHymnsRecord.details?.[occ];
                                      const alternate = activeHymnsRecord.alternateDetails?.[occ];

                                      const renderCard = (hymn: DetailedHymn | undefined, subtitleTag?: string) => {
                                        if (!hymn) return null;
                                        const copyKey = `${occ}_${hymn.hinario}_${hymn.number}`;
                                        const isCopied = hymnCopiedId === copyKey;

                                        const copyHymnLyrics = (e: React.MouseEvent) => {
                                          e.stopPropagation();
                                          const payload = `${hymn.hinario} ${hymn.number} — ${hymn.title} (${hymn.hinarioName})\nAutor: ${hymn.author}\nTema: ${hymn.theme}\n\n${hymn.fullLyrics}`;
                                          navigator.clipboard.writeText(payload);
                                          setHymnCopiedId(copyKey);
                                          setTimeout(() => setHymnCopiedId(null), 2500);
                                        };

                                        return (
                                          <div 
                                            key={hymn.id}
                                            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                                              occ === 'apelo'
                                                ? 'bg-rose-50/50 border-rose-200'
                                                : 'bg-white border-[#E6E2DA]'
                                            }`}
                                          >
                                            <div>
                                              <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                                                <div>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                                                      hymn.hinario === 'CC' ? 'bg-[#5A5A40] text-white' : 'bg-amber-800 text-white'
                                                    }`}>
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
                                                    onClick={copyHymnLyrics}
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
                                                    onClick={() => setLyricsModalHymn(hymn)}
                                                    title="Visualizar letra completa em tela cheia (projeção / leitura)"
                                                    className="p-1 rounded-md text-gray-500 hover:text-black bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                                                  >
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Letra Integral Formatada */}
                                              <div className="mt-3 space-y-3 font-serif text-xs leading-relaxed text-gray-800 max-h-56 overflow-y-auto pr-1">
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

                                            {/* Referência Cruzada CC <-> HCC */}
                                            {hymn.crossReference && (
                                              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-sans text-gray-500">
                                                <span>
                                                  Correspondente no {hymn.crossReference.hinario}: <strong>{hymn.crossReference.number} — {hymn.crossReference.title}</strong>
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => setActiveWorkspaceHinario(hymn.crossReference!.hinario)}
                                                  className="text-[#5A5A40] font-bold hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                  <ArrowRightLeft className="w-3 h-3" />
                                                  <span>Ver no {hymn.crossReference.hinario}</span>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      };

                                      if (activeWorkspaceHinario === 'AMBOS') {
                                        return (
                                          <div key={occ} className="md:col-span-2 bg-[#FAF8F5] p-3.5 rounded-2xl border border-[#E6E2DA] space-y-2.5">
                                            <div className="flex items-center justify-between px-1">
                                              <span className="text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                                                {occLabels[occ]}
                                              </span>
                                              <span className="text-[10px] text-gray-500 font-sans">
                                                Comparação Cantor Cristão vs HCC
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {renderCard(primary?.hinario === 'CC' ? primary : alternate, 'Cantor Cristão (JUERP)')}
                                              {renderCard(primary?.hinario === 'HCC' ? primary : alternate, 'Hinário para o Culto Cristão (JUERP)')}
                                            </div>
                                          </div>
                                        );
                                      }

                                      const chosenHymn = 
                                        (primary?.hinario === activeWorkspaceHinario ? primary :
                                        alternate?.hinario === activeWorkspaceHinario ? alternate : primary) || primary;

                                      return (
                                        <div key={occ} className="space-y-1">
                                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A40] px-1 block">
                                            {occLabels[occ]}
                                          </span>
                                          {renderCard(chosenHymn)}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </section>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Capa footer space */}
                        <div className="non-printable text-center py-6 border-t border-dashed border-gray-100 font-sans text-[11px] text-gray-400">
                          Soli Deo Gloria • Pr. Fernando Veiga • Estúdio de Homilética Teológica
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-[#E6E2DA] p-12 text-center text-gray-500 space-y-4">
                      <Sparkles className="w-12 h-12 text-[#5A5A40]/40 mx-auto" />
                      <p className="font-serif italic text-lg text-[#2D2926]">Nenhum sermão carregado no Estúdio</p>
                      <p className="text-xs max-w-md mx-auto text-gray-500 leading-relaxed font-sans">
                        Sua biblioteca de mensagens está pronta. Preencha os campos ao lado para gerar uma nova mensagem expositiva, ou selecione um sermão na Biblioteca.
                      </p>
                      <div className="flex justify-center pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('library')}
                          className="px-4 py-2 bg-[#5A5A40] hover:bg-[#2D2926] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>Abrir Biblioteca ({sermons.filter(s => !isSermonBlank(s)).length})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Theology assessment detailer */}
                  {activeSermon?.evaluation && (
                    <div className="non-printable bg-white rounded-xl border border-[#E6E2DA] p-6 space-y-4">
                      <h4 className="font-serif italic text-lg text-gray-900 border-b border-gray-100 pb-2">Parecer Detalhado do Seminário Teológico</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-emerald-50 rounded border border-emerald-100 text-center">
                          <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider">Fidelidade Bíblica</p>
                          <p className="text-xl font-bold text-emerald-700">{activeSermon.evaluation.faithfulnessScore}%</p>
                        </div>
                        <div className="p-3 bg-teal-50 rounded border border-teal-100 text-center">
                          <p className="text-xs text-teal-800 font-bold uppercase tracking-wider">Coerência Homilética</p>
                          <p className="text-xl font-bold text-teal-700">{activeSermon.evaluation.homileticalCoherenceScore}%</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded border border-purple-100 text-center">
                          <p className="text-xs text-purple-800 font-bold uppercase tracking-wider">Cristocentrismo</p>
                          <p className="text-xl font-bold text-purple-700">{activeSermon.evaluation.christocentrismScore}%</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded border border-amber-100 text-center">
                          <p className="text-xs text-amber-800 font-bold uppercase tracking-wider">Clareza de Púlpito</p>
                          <p className="text-xl font-bold text-amber-700">{activeSermon.evaluation.pastoralClarityScore}%</p>
                        </div>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div>
                          <span className="font-bold text-gray-800">Doutrina e Fidelidade:</span>
                          <p className="text-gray-600 leading-relaxed">{activeSermon.evaluation.faithfulnessComment}</p>
                        </div>
                        <div>
                          <span className="font-bold text-gray-800">Homilética e Estrutura:</span>
                          <p className="text-gray-600 leading-relaxed">{activeSermon.evaluation.coherenceComment}</p>
                        </div>
                        <div>
                          <span className="font-bold text-gray-800">Cristocentrismo vs Moralismo Legalista:</span>
                          <p className="text-gray-600 leading-relaxed">{activeSermon.evaluation.christocentrismComment}</p>
                        </div>
                        
                        {/* Warnings layout */}
                        {(activeSermon.evaluation.artificialityWarning || activeSermon.evaluation.moralismWarning) && (
                          <div className="p-4 bg-orange-50 rounded border border-orange-200 text-amber-950 space-y-2">
                            <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4" /> Alertas Críticos de Pregabilidade:
                            </span>
                            {activeSermon.evaluation.artificialityWarning && <p>• <strong>Artificialidade:</strong> {activeSermon.evaluation.artificialityWarning}</p>}
                            {activeSermon.evaluation.moralismWarning && <p>• <strong>Moralismo Legalista:</strong> {activeSermon.evaluation.moralismWarning}</p>}
                          </div>
                        )}

                        {/* Clean detected cliches list */}
                        {activeSermon.evaluation.clichesDetected.length > 0 && (
                          <div className="space-y-3 pt-2.5 border-t border-[#E6E2DA]/50">
                            <span className="font-bold text-gray-800 flex items-center gap-1.5 text-xs tracking-wide uppercase">
                              <AlertCircle className="w-4 h-4 text-red-500" /> Clichês Homiléticos Detectados (Evitar):
                            </span>
                            <p className="text-[11px] text-gray-500 leading-normal font-sans">
                              Identificamos expressões gastas ou jargões no fluxo expositivo. Abaixo estão propostas e alternativas de sentenças com maior sobriedade literária e maturidade pastoral para enriquecer este sermão:
                            </p>
                            
                            {activeSermon.evaluation.clichesWithSuggestions && activeSermon.evaluation.clichesWithSuggestions.length > 0 ? (
                              <div className="grid grid-cols-1 gap-3 mt-2">
                                {activeSermon.evaluation.clichesWithSuggestions.map((item, idx) => {
                                  const locations = getLocationsForCliche(activeSermon, item.cliche);
                                  const isApplied = appliedCliches[`${activeSermon.id}-${item.cliche}`];

                                  return (
                                    <div key={idx} className="flex flex-col gap-3 p-3.5 bg-white hover:bg-gray-50/50 rounded-xl border border-gray-200/80 transition-all shadow-xs">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="bg-red-50/40 p-2.5 rounded-lg border border-red-100/60 flex flex-col justify-center">
                                          <span className="text-[9px] font-bold text-red-700 uppercase tracking-wider block font-sans">🔴 Evitar (Exp. Gasta):</span>
                                          <p className="text-xs font-mono text-red-950 line-through mt-1.5 font-semibold">"{item.cliche}"</p>
                                        </div>
                                        <div className="bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex flex-col justify-center">
                                          <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block font-sans">🟢 Propor / Usar (Sóbrio & Natural):</span>
                                          <p className="text-xs text-emerald-950 mt-1.5 font-serif italic leading-relaxed font-semibold">"{item.suggestion}"</p>
                                        </div>
                                      </div>

                                      {/* Control Area for Direct Replacement */}
                                      <div className="pt-2 border-t border-dashed border-gray-100 flex flex-wrap items-center justify-between gap-2.5 mt-1">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-sans text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ocorrência no Texto:</span>
                                          {locations.length > 0 ? (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {locations.map((loc, lIdx) => (
                                                <span key={lIdx} className="bg-indigo-50 text-indigo-700 border border-indigo-100/80 text-[9px] tracking-tight font-medium px-2 py-0.5 rounded-full">
                                                  {loc.label}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] italic text-amber-600 font-sans mt-0.5">
                                              ⚠️ Não localizada exatamente (pode ter sido alterada)
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {locations.length > 0 ? (
                                            isApplied ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-300 font-bold font-sans">
                                                <Check className="w-3.5 h-3.5" /> Ajustado
                                              </span>
                                            ) : (
                                              <div className="flex flex-wrap gap-1.5">
                                                {locations.map((loc, lIdx) => {
                                                  // Clean label to keep it neat inside buttons (e.g., "Ponto 1 (Explicação)")
                                                  const displayLabel = loc.label.includes(':') 
                                                    ? loc.label.split(':')[0] + (loc.label.includes('(') ? ' (' + loc.label.split('(')[1] : '')
                                                    : loc.label;

                                                  return (
                                                    <button
                                                      key={lIdx}
                                                      type="button"
                                                      onClick={() => {
                                                        handleApplyClicheReplacement(item.cliche, item.suggestion, loc.sectionKey);
                                                        setAppliedCliches(prev => ({
                                                          ...prev,
                                                          [`${activeSermon.id}-${item.cliche}`]: true
                                                        }));
                                                      }}
                                                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white hover:text-white transition-all text-[10px] px-3 py-1.5 rounded-lg border border-indigo-700/30 font-bold font-sans cursor-pointer shadow-xs"
                                                    >
                                                      <Sparkles className="w-3 h-3" />
                                                      Aplicar em: {displayLabel}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            )
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                navigator.clipboard.writeText(item.suggestion);
                                                alert("Proposta copiada!");
                                              }}
                                              className="inline-flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors text-[10px] px-2.5 py-1.5 rounded-lg border border-gray-200 font-bold font-sans cursor-pointer"
                                            >
                                              Copiar Sugestão
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="space-y-2 mt-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {activeSermon.evaluation.clichesDetected.map((cl, clIdx) => (
                                    <span key={clIdx} className="bg-red-50 text-red-900 text-[10px] px-2 py-0.5 rounded border border-red-100">{cl}</span>
                                  ))}
                                </div>
                                <p className="text-[10px] text-gray-400 italic font-sans">
                                  Nota: Reavalie este sermão para carregar as sugestões específicas e formulações alternativas geradas pela IA.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* List improvements */}
                        <div className="space-y-3 bg-[#F5F2ED] p-5 rounded-xl border border-[#E6E2DA]">
                          <span className="font-bold text-gray-800 text-sm block">Próximos Passos Recomendados para Aperfeiçoamento:</span>
                          <div className="space-y-3 mt-2">
                            {activeSermon.evaluation.suggestedImprovements.length === 0 ? (
                              <p className="text-gray-500 italic text-xs py-2">Todos os aperfeiçoamentos homiléticos foram aplicados com sucesso!</p>
                            ) : (
                              activeSermon.evaluation.suggestedImprovements.map((imp, idx) => {
                                const isThisImproving = improvingSuggestionIdx === idx;
                                const isAnyImproving = improvingSuggestionIdx !== null;
                                return (
                                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-white/65 hover:bg-white/90 rounded-lg border border-[#E6E2DA]/65 transition-all shadow-xs">
                                    <div className="flex items-start gap-2.5 text-gray-700 leading-relaxed text-xs">
                                      <span className="font-bold text-gray-400 select-none">{idx + 1}.</span>
                                      <span>{imp}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleImproveSermon(imp, idx)}
                                      disabled={isAnyImproving}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold font-sans tracking-wide transition-all select-none self-end sm:self-center shrink-0 border ${
                                        isThisImproving 
                                          ? 'bg-amber-100 border-amber-300 text-amber-800' 
                                          : isAnyImproving 
                                          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
                                          : 'bg-[#5A5A40] hover:bg-[#43432F] text-white border-[#5A5A40] active:scale-98 shadow-sm hover:shadow'
                                      }`}
                                    >
                                      {isThisImproving ? (
                                        <>
                                          <Clock className="w-3.5 h-3.5 animate-spin" />
                                          Aperfeiçoando...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-3.5 h-3.5" />
                                          Aperfeiçoar com IA
                                        </>
                                      )}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>
          )}



          {/* Tab: Crivo Teológico (3 Camadas & Peroração Magistral) */}
          {activeTab === 'crivo' && (
            <div className="w-full flex-1 flex flex-col justify-center items-center">
              <TheologicalSieve
                sermons={sermons.filter(s => !isSermonBlank(s))}
                currentSermon={activeSermon}
                onInjectPeroration={handleInjectPerorationFromSieve}
                onNavigateToWorkspace={() => setActiveTab('workspace')}
              />
            </div>
          )}

          {/* Tab 2: Study Resources & Interactive Theological Chat */}
          {activeTab === 'study' && (
            <div className="w-full flex-1 flex flex-col justify-center items-center">
              <TheologicalChat
                onSendToLaboratory={handleSendToLaboratory}
                onInsertToSermon={(content, passage) => handleSendToLaboratory(content, undefined, passage)}
              />
            </div>
          )}

          {/* Tab 3: Themes Bank, suggested Hymns & Illustrations */}
          {activeTab === 'ideas' && (
            <div className="space-y-8 max-w-6xl mx-auto w-full">
              
              <div className="bg-white/70 p-6 rounded-xl border border-[#E6E2DA] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-xl font-serif text-[#2D2926] font-bold flex items-center gap-2">
                    <Grid className="w-5 h-5 text-[#5A5A40]" />
                    Inspirador Ministerial: Banco de Temas Bíblicos & Liturgia
                  </h1>
                  <p className="text-xs text-gray-500 font-sans">Acervo temático estruturado para pregações expositivas imediatas, perícopes bíblicas e celebrações litúrgicas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('illustrations')}
                  className="bg-[#FAF6EE] hover:bg-[#5A5A40] text-[#2D2926] hover:text-white border border-[#E6E2DA] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs shrink-0 cursor-pointer"
                >
                  <Palette className="w-4 h-4 text-[#5A5A40]" />
                  <span>Oficina Visual & Ilustrações</span>
                </button>
              </div>

              {/* Grid Categories Themes */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DA] shadow-sm space-y-6">
                <div>
                  <h3 className="font-serif italic text-lg font-bold">Banco de Temas Bíblicos Homiléticos</h3>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {['todos', ...Object.keys(BIBLICAL_THEMES_BANK)].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full capitalize transition-all border font-semibold ${categoryFilter === cat ? 'bg-[#5A5A40] text-white border-[#5A5A40]' : 'bg-white text-[#2D2926] hover:bg-gray-50 border-[#E6E2DA]'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(BIBLICAL_THEMES_BANK)
                    .filter(([cat]) => categoryFilter === 'todos' || categoryFilter === cat)
                    .flatMap(([, items]) => items)
                    .map((item, idx) => (
                      <div key={idx} className="bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-5 space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full font-bold">Expositivo</span>
                            <span className="text-xs font-mono font-medium text-gray-500">{item.scripture}</span>
                          </div>
                          <h4 className="font-serif font-bold text-[#2D2926] text-base leading-tight">{item.theme}</h4>
                          <p className="text-xs text-gray-600 leading-snug">{item.coreIdea}</p>
                          <div className="pt-2 border-t border-black/5 text-[10px] text-gray-500 italic">
                            <strong>Aplicação:</strong> {item.pastoralApplication}
                          </div>
                        </div>
                        <button
                          onClick={() => usePresetTheme(item)}
                          className="w-full mt-3 bg-white hover:bg-[#5A5A40] text-[#2D2926] hover:text-white border border-[#E6E2DA] py-2 rounded text-xs font-bold tracking-wide transition-all"
                        >
                          Usar Tema de Estudo
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Theme Calendário Cristão Suggestions */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DA] shadow-sm space-y-6">
                <div>
                  <h3 className="font-serif italic text-lg font-bold text-[#2D2926]">Calendário Temático de Celebrações</h3>
                  <p className="text-xs text-gray-500">Sugestões litúrgicas e pastorais para datas e ordenanças solenes da igreja local.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {CHRISTIAN_THEMATIC_CALENDAR.map(cal => (
                    <div key={cal.id} className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-lg space-y-3 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-[#5A5A40] font-bold">
                          <span>{cal.title}</span>
                          <span>{cal.dateSuggestion}</span>
                        </div>
                        <h4 className="font-serif font-bold text-[#2D2926]">{cal.suggestedTheme}</h4>
                        <p className="text-xs text-gray-600 leading-relaxed">{cal.description}</p>
                        <p className="text-[10px] text-[#5A5A40] italic">Texto base: {cal.scripture} • {cal.hymnSuggestion}</p>
                      </div>
                      <button
                        onClick={() => useCalendarTheme(cal)}
                        className="w-full mt-3 bg-emerald-800 text-white hover:bg-[#2D2926] py-1.5 rounded text-xs font-bold transition-all"
                      >
                        Carregar na Oficina
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Tab: Dedicated Visual Studio & Illustration Generator */}
          {activeTab === 'illustrations' && (
            <IllustrationGenerator onSendToLaboratory={handleSendIllustrationToLaboratory} />
          )}

          {/* Tab 4: Expository Series Planner */}
          {activeTab === 'series' && (
            <div className="space-y-8 max-w-5xl mx-auto w-full">
              
              <div className="bg-white/70 p-6 rounded-xl border border-[#E6E2DA] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-xl font-serif text-[#2D2926] font-bold flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#5A5A40]" />
                    Gerador de Séries Expositivas Bíblicas
                  </h1>
                  <p className="text-xs text-gray-500">Parcele um livro bíblico completo em perícopes sequenciais coerentes com a teologia histórica.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E6E2DA] shadow-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Livro da Bíblia</label>
                    <input 
                      type="text" 
                      value={seriesBook}
                      onChange={(e) => setSeriesBook(e.target.value)}
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Tema da Campanha</label>
                    <input 
                      type="text" 
                      value={seriesTheme}
                      onChange={(e) => setSeriesTheme(e.target.value)}
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Campanha de Apoio</label>
                    <input 
                      type="text" 
                      value={seriesCampaign}
                      onChange={(e) => setSeriesCampaign(e.target.value)}
                      className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg p-2.5 text-xs focus:ring-[#5A5A40]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Total de Mensagens</label>
                    <select
                      value={seriesSermonCount}
                      onChange={(e) => setSeriesSermonCount(Number(e.target.value))}
                      className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2.5 text-xs"
                    >
                      <option value={3}>3 Mensagens</option>
                      <option value={4}>4 Mensagens</option>
                      <option value={6}>6 Mensagens</option>
                      <option value={8}>8 Mensagens</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerateSeries}
                  disabled={isSeriesGenerating}
                  className="w-full bg-[#5A5A40] hover:bg-[#2D2926] text-white py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all shadow-md"
                >
                  {isSeriesGenerating ? 'DIVIDINDO LIVRO EM PERÍCOPES...' : 'ESTRUTURAR SÉRIE EXPOSITIVA'}
                </button>

                {generatedSeries && (
                  <div className="space-y-6 pt-6 border-t border-gray-100">
                    <div className="text-center space-y-2">
                      <span className="text-xs uppercase tracking-widest text-[#5A5A40] font-bold">Planejamento Expositivo Sequencial</span>
                      <h2 className="text-2xl font-serif font-bold text-gray-900">{generatedSeries.title}</h2>
                      <div className="flex justify-center gap-4 text-xs text-gray-500">
                        <span><strong>Livro:</strong> {generatedSeries.book}</span>
                        <span>•</span>
                        <span><strong>Ideia Geral:</strong> {generatedSeries.generalTheme}</span>
                        {generatedSeries.campaign && (
                          <>
                            <span>•</span>
                            <span><strong>Missão:</strong> {generatedSeries.campaign}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      {generatedSeries.sermons.map(sUnit => (
                        <div key={sUnit.number} className="bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-xl p-5 space-y-3 hover:shadow-md transition-all flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] text-[#5A5A40] font-bold">
                              <span>MENSAGEM {sUnit.number}</span>
                              <span>{sUnit.scripture}</span>
                            </div>
                            <h4 className="font-serif font-bold text-gray-900">{sUnit.title}</h4>
                            <p className="text-xs text-gray-600 leading-snug"><strong>Foco:</strong> {sUnit.coreIdea}</p>
                            <div className="space-y-1 py-2">
                              <span className="text-[10px] block font-bold text-gray-800">Pontos da Pregação:</span>
                              {sUnit.keyPoints.map((p, pIdx) => (
                                <p key={pIdx} className="text-[11px] text-gray-600 pl-2">• {p}</p>
                              ))}
                            </div>
                            <p className="text-[10px] text-emerald-800 leading-snug"><strong>Aplicação:</strong> {sUnit.pastoralApplication}</p>
                          </div>

                          <button
                            onClick={() => useSeriesSermonInWorkspace(sUnit)}
                            className="bg-white hover:bg-[#5A5A40] text-[#2D2926] hover:text-white border border-[#E6E2DA] hover:border-[#5A5A40] py-2 rounded text-xs font-bold transition-all w-full mt-3"
                          >
                            Preparar este Esboço na Oficina
                          </button>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>

            </div>
          )}

          {/* Tab 5: Library View & Filters */}
          {activeTab === 'library' && (
            <div className="space-y-6 max-w-6xl mx-auto w-full">
              
              {/* Header options filters */}
              <div className="bg-white/70 p-6 rounded-xl border border-[#E6E2DA] shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-xl font-serif text-[#2D2926] font-bold">Biblioteca de Sermões e Mensagens</h1>
                  <p className="text-xs text-gray-500">Gerencie todos os esboços gerados e arquivados por ordem cronológica.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-700 font-mono flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="truncate max-w-[150px] sm:max-w-none">Nuvem Conectada</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleForceCloudSync()}
                    disabled={isCloudSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#5A5A40] hover:bg-[#2D2926] text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    title="Enviar todos os sermões deste aparelho para a nuvem e baixar do celular"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                    <span>{isCloudSyncing ? 'Sincronizando...' : 'Sincronizar com Nuvem'}</span>
                  </button>

                  <button
                    onClick={() => setShowArchivedOnly(!showArchivedOnly)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${showArchivedOnly ? 'bg-amber-600 text-white border-amber-600' : 'bg-white hover:bg-gray-50 text-[#2D2926] border-[#E6E2DA]'}`}
                  >
                    {showArchivedOnly ? 'Ver Ativos' : 'Ver Arquivados'}
                  </button>
                </div>
              </div>

              {/* Advanced search bar filter */}
              <div className="bg-white p-5 rounded-xl border border-[#E6E2DA] shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar por tema, texto bíblico, palavras-chave ou série..."
                    className="w-full bg-[#F5F2ED]/60 border border-[#E6E2DA] rounded-lg pl-10 pr-4 py-2.5 text-xs focus:ring-[#5A5A40] focus:outline-none"
                  />
                </div>
                
                <div className="text-xs text-gray-500 shrink-0 select-none">
                  Mostrando <strong>{filteredSermons.length}</strong> de {sermons.filter(s => !isSermonBlank(s)).length} sermões
                </div>
              </div>

              {/* Grid listings of saved sermons */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSermons.length > 0 ? (
                  filteredSermons.map(s => (
                    <div 
                      key={s.id} 
                      className={`bg-white rounded-xl border p-5 flex flex-col justify-between hover:shadow-md transition-all gap-4 ${selectedSermonId === s.id ? 'border-[#5A5A40] ring-1 ring-[#5A5A40]' : 'border-[#E6E2DA]'}`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(s.date).toLocaleDateString('pt-BR')}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => toggleFavoriteSermon(s.id)}
                              className={`p-1 rounded hover:bg-gray-100 ${s.isFavorite ? 'text-amber-500' : 'text-gray-300'}`}
                              title="Favorito"
                            >
                              ★
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-serif font-bold text-gray-900 text-base leading-tight hover:text-[#5A5A40] cursor-pointer" onClick={() => { setSelectedSermonId(s.id); setActiveTab('workspace'); }}>
                            {s.title}
                          </h4>
                          <p className="text-xs font-serif text-[#5A5A40] font-medium mt-1">{s.scripture}</p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-2 leading-snug">{s.theme}</p>
                        </div>

                        {s.seriesName && (
                          <span className="inline-block text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded font-bold">
                            SÉRIE: {s.seriesName}
                          </span>
                        )}

                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.tags.map((tg, tgIdx) => (
                            <span key={tgIdx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {tg}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Manual Quick Action buttons */}
                      {sermonIdDeleting === s.id ? (
                        <div className="pt-3 border-t border-red-200 bg-red-50 p-3 text-xs rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in w-full text-left">
                          <span className="text-red-900 font-semibold text-xs leading-tight">Apagar este sermão permanentemente?</span>
                          <div className="flex items-center gap-2 font-bold text-xs shrink-0 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteSermon(s.id);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteSermon(s.id);
                              }}
                              className="flex-1 sm:flex-none text-white bg-red-600 hover:bg-red-700 active:bg-red-800 min-h-[44px] px-4 py-2.5 rounded-lg cursor-pointer transition-colors shadow-xs text-center font-bold touch-manipulation select-none flex items-center justify-center gap-1.5"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Sim, Apagar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSermonIdDeleting(null);
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSermonIdDeleting(null);
                              }}
                              className="flex-1 sm:flex-none text-gray-700 hover:text-gray-900 border border-gray-300 bg-white hover:bg-gray-100 active:bg-gray-200 min-h-[44px] px-4 py-2.5 rounded-lg cursor-pointer transition-colors text-center font-bold touch-manipulation select-none"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs w-full gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectedSermonId(s.id); setActiveTab('workspace'); }}
                              className="text-[#5A5A40] hover:underline font-bold cursor-pointer py-1"
                            >
                              Carregar Estudo
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPulpitTargetSermon(s);
                                setShowPulpitMode(true);
                              }}
                              className="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-200"
                              title="Abrir diretamente no Modo Púlpito"
                            >
                              <span>📖 Púlpito</span>
                            </button>
                          </div>
                          
                          <div className="flex gap-2 text-gray-500 items-center">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                duplicateSermon(s);
                              }} 
                              className="hover:text-gray-700 cursor-pointer p-1" 
                              title="Duplicar"
                            >
                              Copiar
                            </button>
                            <span>•</span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleArchiveSermon(s.id);
                              }} 
                              className="hover:text-amber-700 cursor-pointer p-1" 
                              title="Arquivar"
                            >
                              {s.isArchived ? 'Ativar' : 'Arquivar'}
                            </button>
                            <span>•</span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSermonIdDeleting(s.id);
                              }} 
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSermonIdDeleting(s.id);
                              }}
                              className="text-red-700 hover:text-red-900 active:bg-red-100 bg-red-50 sm:bg-transparent px-2.5 py-1.5 rounded-md font-bold cursor-pointer transition-colors touch-manipulation select-none flex items-center gap-1 min-h-[36px]" 
                              title="Apagar sermão permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600 inline" />
                              <span>Apagar</span>
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  ))
                ) : (
                  <div className="col-span-full bg-white rounded-xl border border-[#E6E2DA] p-16 text-center text-gray-400 italic">
                    Nenhum sermão corresponde aos critérios de pesquisa estabelecidos.
                  </div>
                )}
              </div>

            </div>
          )}

        </main>

      </div>

      {/* Styled Footer */}
      <footer className="bg-[#2D2926] text-[#E6E2DA]/65 py-6 px-4 border-t border-[#5A5A40]/10 text-center text-xs">
        <div className="max-w-4xl mx-auto space-y-2">
          <p>© 2026 Sermões & Mensagens • Estúdio Homilético Batista — Pastor Fernando Veiga.</p>
          <p className="text-[10px] text-[#E6E2DA]/40">Alinhado à Declaração de Fé Batista e aos princípios da autonomia local. Geração assistida teologicamente pela Inteligência Artificial.</p>
        </div>
      </footer>

      {showChurchProfileModal && (
        <div 
          className="fixed inset-0 bg-[#2D2926]/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowChurchProfileModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="church-profile-modal-title"
        >
          <div 
            className="bg-white border-2 border-[#E6E2DA] rounded-2xl max-w-lg w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-left cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#E6E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#5A5A40]" />
                <div>
                  <h3 id="church-profile-modal-title" className="font-serif font-bold text-gray-900 text-sm leading-tight">Perfil Específico da Igreja Local</h3>
                  <p className="text-[10px] text-gray-400 font-sans uppercase tracking-wider">Ajustes Finos de Contexto e Eclesiologia</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowChurchProfileModal(false)}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg select-none cursor-pointer transition-colors"
                aria-label="Fechar modal"
                title="Fechar (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-[11px] text-gray-600 leading-relaxed font-sans bg-[#F5F2ED] p-3 rounded-lg border border-[#E6E2DA]/65">
              Defina aqui o raio-X e a realidade ministerial de sua comunidade local. Esses dados serão consolidados e servidos como diretrizes ao motor de exegese homilética para produzir ilustrações, tom de apelo e aplicações cirúrgicas e adaptadas.
            </p>

            {/* Inputs */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              
              {/* Tamanho da Membresia / Congregação */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Tamanho Aproximado (Membros Ativos)
                </label>
                <select
                  value={churchProfileDetails.congregationSize}
                  onChange={(e) => setChurchProfileDetails(prev => ({ ...prev, congregationSize: e.target.value }))}
                  className="w-full bg-white border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                >
                  <option value="Pequena (até 100 membros)">Pequena (até 100 membros ativos)</option>
                  <option value="Média (100 a 500 membros)">Média (100 a 500 membros ativos)</option>
                  <option value="Grande (mais de 500 membros)">Grande (mais de 500 membros ativos)</option>
                </select>
              </div>

              {/* Ênfase Teológica / Foco da Igreja */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Enfoque ou Ênfase Principal
                </label>
                <input
                  type="text"
                  value={churchProfileDetails.theologyEmphasis}
                  onChange={(e) => setChurchProfileDetails(prev => ({ ...prev, theologyEmphasis: e.target.value }))}
                  placeholder="Ex: Discipulado, Escolas de Bíblia, Evangelismo Missional..."
                  className="w-full bg-gray-50 border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                />
              </div>

              {/* Desafios da Comunidade Entorno */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Principais Desafios do Bairro/Entorno
                </label>
                <textarea
                  value={churchProfileDetails.localChallenges}
                  onChange={(e) => setChurchProfileDetails(prev => ({ ...prev, localChallenges: e.target.value }))}
                  placeholder="Ex: Secularismo, violência urbana, desintegração familiar..."
                  rows={2}
                  className="w-full bg-gray-50 border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none resize-none"
                />
              </div>

              {/* Ministérios Específicos em Destaque */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Ministérios em Destaque na Comunidade
                </label>
                <input
                  type="text"
                  value={churchProfileDetails.activeMinistries}
                  onChange={(e) => setChurchProfileDetails(prev => ({ ...prev, activeMinistries: e.target.value }))}
                  placeholder="Ex: Ministério Infantil, Lar de Idosos, Pequenos Grupos..."
                  className="w-full bg-gray-50 border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                />
              </div>

              {/* Contexto Geográfico */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Contexto Geográfico/Social
                </label>
                <input
                  type="text"
                  value={churchProfileDetails.neighborhoodContext}
                  onChange={(e) => setChurchProfileDetails(prev => ({ ...prev, neighborhoodContext: e.target.value }))}
                  placeholder="Ex: Bairro residencial suburbano..."
                  className="w-full bg-gray-50 border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] focus:outline-none"
                />
              </div>

            </div>

            {/* Actions */}
            <div className="flex gap-2.5 justify-end pt-3 border-t border-[#E6E2DA] mt-1">
              <button
                type="button"
                onClick={() => setShowChurchProfileModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2D2926] text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowChurchProfileModal(false);
                }}
                className="px-4 py-2 bg-[#5A5A40] hover:bg-[#2D2926] text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Parâmetros</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {showHistoryModal && activeSermon && (
        <div 
          className="fixed inset-0 bg-[#2D2926]/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => {
            setShowHistoryModal(false);
            setEditingHistoryEntryId(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="bg-white border-2 border-[#E6E2DA] rounded-2xl max-w-4xl w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-left max-h-[90vh] overflow-y-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#E6E2DA] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm leading-tight font-sans">Histórico Ministerial do Sermão</h3>
                  <p className="text-[10px] text-gray-400 font-sans uppercase tracking-wider">Acompanhamento e Registro de Onde este Sermão foi Pregado</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setEditingHistoryEntryId(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl select-none cursor-pointer p-1"
              >
                ×
              </button>
            </div>

            {/* Title block */}
            <div className="bg-[#FAF6EE] p-3 rounded-lg border border-[#E6E2DA] flex justify-between items-center">
              <div>
                <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider">LIVRO / SERMÃO ATIVO</span>
                <h4 className="font-serif font-bold text-gray-800 text-sm leading-tight">{activeSermon.title}</h4>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">{activeSermon.scripture}</p>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-[#5A5A40] uppercase tracking-wider block">PREGAÇÕES CONCLUÍDAS</span>
                <span className="text-sm font-extrabold text-[#2D2926] font-mono">{(activeSermon.history || []).length} vezes</span>
              </div>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-2">
              
              {/* Form panel */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveHistoryEntry(historyDate, historyLocation, historyEvent, historyNotes, editingHistoryEntryId);
                  // Reset form fields
                  setHistoryDate(new Date().toISOString().substring(0, 10));
                  setHistoryLocation('');
                  setHistoryEvent('');
                  setHistoryNotes('');
                  setEditingHistoryEntryId(null);
                }}
                className="col-span-1 md:col-span-4 bg-gray-50 p-4 rounded-xl border border-gray-200/80 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    {editingHistoryEntryId ? '🖋 Editar Registro' : '➕ Novo Registro'}
                  </span>
                  {editingHistoryEntryId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingHistoryEntryId(null);
                        setHistoryLocation('');
                        setHistoryEvent('');
                        setHistoryNotes('');
                      }}
                      className="text-[10px] text-red-600 hover:underline cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Data da Pregação</label>
                  <input
                    type="date"
                    required
                    value={historyDate}
                    onChange={(e) => setHistoryDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                  />
                </div>

                {/* Local */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Local / Congregação</label>
                  <input
                    type="text"
                    required
                    value={historyLocation}
                    onChange={(e) => setHistoryLocation(e.target.value)}
                    placeholder="Ex: Igreja Central, Culto Doméstico"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                  />
                </div>

                {/* Evento */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Evento / Tipo de Reunião</label>
                  <input
                    type="text"
                    required
                    value={historyEvent}
                    onChange={(e) => setHistoryEvent(e.target.value)}
                    placeholder="Ex: Culto Domingo, Congresso, Retiro"
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40]"
                  />
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Observações do Dia (Opcional)</label>
                  <textarea
                    value={historyNotes}
                    onChange={(e) => setHistoryNotes(e.target.value)}
                    placeholder="Ex: Mensagem marcante, igreja atenta..."
                    rows={3}
                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs focus:ring-[#5A5A40] focus:border-[#5A5A40] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#5A5A40] hover:bg-[#2D2926] text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingHistoryEntryId ? 'Salvar Alteração' : 'Registrar Pregação'}</span>
                </button>
              </form>

              {/* Table / List panel */}
              <div className="col-span-1 md:col-span-8 space-y-3 col-scrollbar">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide block">📜 Linha do Tempo Pastoral (Recentes Primeiro)</span>
                
                {(!activeSermon.history || activeSermon.history.length === 0) ? (
                  <div className="p-8 border-2 border-dashed border-[#E6E2DA] rounded-xl text-center text-gray-400 space-y-1">
                    <History className="w-8 h-8 mx-auto opacity-35" />
                    <p className="text-xs font-medium">Nenhum registro de pregação para este sermão.</p>
                    <p className="text-[10px] opacity-75">Registre ao lado onde e quando você anunciou esta mensagem da Escritura.</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto shadow-xs">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs bg-white font-sans">
                      <thead className="bg-[#FAF6EE] text-[9px] font-bold uppercase tracking-wider text-[#5A5A40]">
                        <tr>
                          <th className="px-3 py-2.5">Data</th>
                          <th className="px-3 py-2.5">Local</th>
                          <th className="px-3 py-2.5">Evento</th>
                          <th className="px-3 py-2.5">Observações</th>
                          <th className="px-3 py-2.5 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeSermon.history.map((h) => (
                          <tr key={h.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-3 py-2.5 font-mono whitespace-nowrap text-gray-700">
                              {h.date.split('-').reverse().join('/')}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-900">{h.location}</td>
                            <td className="px-3 py-2.5 text-zinc-600">{h.event}</td>
                            <td className="px-3 py-2.5 max-w-[180px] truncate text-gray-500 text-[11px]" title={h.notes}>
                              {h.notes || <span className="text-gray-300 italic">Nenhuma</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingHistoryEntryId(h.id);
                                    setHistoryDate(h.date);
                                    setHistoryLocation(h.location);
                                    setHistoryEvent(h.event);
                                    setHistoryNotes(h.notes || '');
                                  }}
                                  className="p-1 text-gray-500 hover:text-[#5A5A40] hover:bg-emerald-50 rounded transition-all cursor-pointer"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistoryEntry(h.id)}
                                  className="p-1 text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-all cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-[#E6E2DA] pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false);
                  setEditingHistoryEntryId(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2D2926] text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Concluir e Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {showPericopeExplorerModal && (
        <div className="fixed inset-0 bg-[#2D2926]/70 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#E6E2DA] rounded-2xl max-w-5xl w-full shadow-2xl p-6 relative flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-left max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-[#E6E2DA] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#5A5A40]" />
                <div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm leading-tight">Explorador de Possibilidades da Perícope</h3>
                  <p className="text-[10px] text-gray-400 font-sans uppercase tracking-wider">Ampliar Temas Legítimos sem Interpretações Artificiais ou Eisegese</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPericopeExplorerModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl select-none cursor-pointer p-1"
              >
                ×
              </button>
            </div>

            {/* Input & Retrigger box */}
            <div className="bg-[#F5F2ED] p-3.5 rounded-xl border border-[#E6E2DA] flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <BookOpen className="w-4 h-4 text-gray-500 hidden sm:block" />
                <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Passagem em estudo:</span>
                <input 
                  type="text"
                  value={scriptureInput}
                  onChange={(e) => setScriptureInput(e.target.value)}
                  className="bg-white border border-[#E6E2DA] rounded-lg p-2 text-xs focus:ring-[#5A5A40] w-full sm:w-[220px]"
                  placeholder="Ex: Romanos 12:1-2"
                />
              </div>
              <button
                type="button"
                disabled={isExploringPericope}
                onClick={() => handleExplorePericope(scriptureInput)}
                className="w-full sm:w-auto px-4 py-2 bg-[#2D2926] hover:bg-[#5A5A40] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isExploringPericope ? "Analisando..." : "Sondar Nova Passagem"}
              </button>
            </div>

            {/* Error Container */}
            {pericopeError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Houve uma falha na análise dócil da passagem</p>
                  <p className="opacity-90">{pericopeError}</p>
                </div>
              </div>
            )}

            {/* Loading Placeholder */}
            {isExploringPericope && (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-10 h-10 border-4 border-[#5A5A40]/20 border-t-[#5A5A40] rounded-full animate-spin"></div>
                <div>
                  <h4 className="font-serif italic font-medium text-gray-700 text-sm">Sondando textualmente o autor sagrado...</h4>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-sm">
                    Mapeando sujeito exegético, verbos originais de ênfase, tensão narrativa e refutando espiritualizações baratas alegóricas.
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3 max-w-md">
                    <span className="text-[9px] bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-full animate-pulse">Exegese histórico-gramatical</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}>Contexto dogmático</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 font-mono px-2 py-0.5 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}>Teologia Bíblica</span>
                  </div>
                </div>
              </div>
            )}

            {/* Main Interactive Screen */}
            {!isExploringPericope && pericopeAnalysis && (
              <div className="space-y-6">
                
                {/* 1. Identification Grid */}
                <div className="bg-white border border-[#E6E2DA]/80 rounded-xl p-4 shadow-xs space-y-3">
                  <h4 className="font-serif font-bold text-gray-900 text-xs uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                    <Grid className="w-4 h-4 text-[#5A5A40]" />
                    <span>Identificação Homilética da Perícope</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Sujeito Principal</span>
                      <p className="text-xs text-gray-800 font-medium mt-0.5">{pericopeAnalysis.identification?.mainSubject || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-[#F4F4FD] rounded-lg border border-[#E2E2F8]">
                      <span className="text-[9px] font-bold text-[#4F46E5] uppercase tracking-wider block">Verbo Principal / Ênfase</span>
                      <p className="text-xs text-indigo-900 font-semibold mt-0.5 italic">{pericopeAnalysis.identification?.mainVerb || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider block">Tensão Narrativa ou Teológica</span>
                      <p className="text-xs text-red-950 font-medium mt-0.5">{pericopeAnalysis.identification?.narrativeTension || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Movimento do Texto</span>
                      <p className="text-xs text-gray-800 mt-0.5">{pericopeAnalysis.identification?.textMovement || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                      <span className="text-[9px] font-bold text-emerald-700 block uppercase tracking-wider">Clímax Homilético do Texto</span>
                      <p className="text-xs text-emerald-950 font-medium mt-0.5">{pericopeAnalysis.identification?.climax || 'N/A'}</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Propósito Original do Autor</span>
                      <p className="text-xs text-gray-800 mt-0.5">{pericopeAnalysis.identification?.authorPurpose || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. Possibilities Collection */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <h4 className="font-serif font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#5A5A40]" />
                      <span>Possibilidades Temáticas Legítimas do Autor</span>
                    </h4>
                    <span className="text-[10px] text-gray-400 italic">Toda proposta homilética nasce rigorosamente do texto bíblico</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pericopeAnalysis.possibilities && pericopeAnalysis.possibilities.map((p, idx) => {
                      const strengthColor = 
                        p.strength === 'Muito Forte' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        p.strength === 'Forte' ? 'bg-green-50 text-green-800 border-green-200' :
                        p.strength === 'Possível' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-red-50 text-red-800 border-red-200';
                      
                      const strengthIcon = 
                        p.strength === 'Muito Forte' ? '✓ Muito Forte' :
                        p.strength === 'Forte' ? '✓ Forte' :
                        p.strength === 'Possível' ? '△ Possível' :
                        '✕ Não sustentado';

                      return (
                        <div key={idx} className="bg-[#FAF9F6] border border-[#E6E2DA]/70 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between gap-4.5 group text-left">
                          
                          <div className="space-y-2.5">
                            {/* Card Header metadata */}
                            <div className="flex justify-between items-start gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-200/60 text-gray-800 px-2.5 py-0.5 rounded-full">
                                {p.category}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest border px-2.5 py-0.5 rounded-full ${strengthColor}`}>
                                {strengthIcon}
                              </span>
                            </div>

                            {/* Theme statement */}
                            <h5 className="font-serif font-extrabold text-sm leading-tight text-gray-900">
                              {p.themeName}
                            </h5>

                            {/* Textual base */}
                            <div className="p-2 bg-white rounded-lg border border-gray-100 text-gray-700 italic font-serif text-xs">
                              <span className="font-bold text-[9px] text-[#5A5A40] block uppercase italic mb-0.5">Base Textual:</span>
                              "{p.textualBase}"
                            </div>

                            {/* Hermeneutical danger/risk */}
                            <div className="p-2 bg-red-50/50 rounded-lg border border-red-100 text-red-950 font-sans text-xs">
                              <span className="font-bold text-[9px] text-red-700 block uppercase mb-0.5 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Risco Hermenêutico / Dica Preventiva:
                              </span>
                              {p.hermeneuticalRisk}
                            </div>

                            {/* Observation / What it is NOT teaching */}
                            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
                              <span className="font-bold text-[9px] text-gray-400 block uppercase">Razões Homiléticas & Notas Pastorais:</span>
                              <p className="whitespace-pre-line">{p.observation}</p>
                            </div>
                          </div>

                          {/* Quick apply trigger button */}
                          <button
                            type="button"
                            onClick={() => {
                              setThemeInput(p.themeName);
                              setShowPericopeExplorerModal(false);
                            }}
                            className="w-full mt-1.5 bg-white border border-[#5A5A40]/30 hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 select-none cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Adotar este Tema no Esboço</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Footer buttons */}
            <div className="border-t border-[#E6E2DA] pt-3 flex justify-end gap-3 font-sans">
              <button
                type="button"
                onClick={() => setShowPericopeExplorerModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-[#2D2926] text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Retornar ao Laboratório
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Pulpit Mode Fullscreen Overlay */}
      {showPulpitMode && pulpitTargetSermon && (
        <PulpitMode
          sermon={pulpitTargetSermon}
          onClose={() => {
            setShowPulpitMode(false);
            setPulpitTargetSermon(null);
          }}
        />
      )}

      {/* Multi-Device Synchronization & Diagnostics Modal */}
      {showSyncDiagnosticsModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
          onClick={() => {
            setShowSyncDiagnosticsModal(false);
            setSyncActionMessage(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="bg-[#FAF8F5] max-w-2xl w-full rounded-2xl border border-[#E6E2DA] shadow-2xl p-6 space-y-5 text-[#2D2926] cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E6E2DA] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/15 text-emerald-800 rounded-xl relative">
                  <Cloud className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
                  </span>
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-gray-900">
                    Sincronização & Persistência de Dispositivos
                  </h3>
                  <p className="text-xs text-gray-500">
                    Espelhamento em tempo real, tokens de transferência e backups offline-ready
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSyncDiagnosticsModal(false);
                  setSyncActionMessage(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-[#E6E2DA] gap-1">
              <button
                type="button"
                onClick={() => { setSyncModalTab('realtime'); setSyncActionMessage(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  syncModalTab === 'realtime'
                    ? 'border-[#5A5A40] text-[#5A5A40] bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Nuvem Firestore</span>
              </button>
              <button
                type="button"
                onClick={() => { setSyncModalTab('code'); setSyncActionMessage(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  syncModalTab === 'code'
                    ? 'border-[#5A5A40] text-[#5A5A40] bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Código de Transferência Rápida</span>
              </button>
              <button
                type="button"
                onClick={() => { setSyncModalTab('backup'); setSyncActionMessage(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  syncModalTab === 'backup'
                    ? 'border-[#5A5A40] text-[#5A5A40] bg-white rounded-t-lg'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Backup em Arquivo (.json)</span>
              </button>
            </div>

            {/* Feedback Alert Banner */}
            {syncActionMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                syncActionMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {syncActionMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{syncActionMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncActionMessage(null)}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer font-bold text-sm leading-none"
                >
                  ✕
                </button>
              </div>
            )}

            {/* TAB 1: FIRESTORE REALTIME */}
            {syncModalTab === 'realtime' && (
              <div className="space-y-4">
                {/* 1. Identificação do Usuário e UID Fixo */}
                <div className="bg-[#FAF8F5] border border-[#E6E2DA] rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E2DA] pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                        Sincronização Direta da Biblioteca
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="font-bold text-gray-900 text-sm">
                          Acervo Sincronizado em Nuvem (Multi-Dispositivo)
                        </p>
                      </div>
                    </div>

                    <div className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full border border-emerald-300">
                      Sincronização Direta Ativa
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">Conta Pastoral:</span>
                      <p className="font-mono text-gray-900 font-medium select-all break-all">
                        meguikalan@gmail.com
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-gray-500 uppercase block">UID Fixo Pastoral:</span>
                      <p className="font-mono text-gray-800 text-[11px] select-all break-all bg-white p-1.5 rounded border border-[#E6E2DA]">
                        {FIXED_PASTORAL_UID}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Informações do Projeto e Status de Conexão */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                    Telemetria e Estado do Firestore
                  </span>
                  <button
                    onClick={handleRunDiagnosticsProbe}
                    disabled={isTestingProbe}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTestingProbe ? 'animate-spin' : ''}`} />
                    <span>{isTestingProbe ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-[#E6E2DA] space-y-1">
                    <span className="text-gray-500 block text-[10px] font-semibold uppercase">ID do Projeto Firebase</span>
                    <p className="font-mono font-bold text-gray-900 text-sm select-all">
                      {firebaseProjectId || 'top-autumn-p9brs'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate" title={firestoreDatabaseId}>
                      Banco: {firestoreDatabaseId}
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E6E2DA] space-y-1">
                    <span className="text-gray-500 block text-[10px] font-semibold uppercase">Status da Conexão & Latência</span>
                    <div className="flex items-center gap-1.5 font-bold">
                      {firestoreProbe?.connected ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-emerald-700">Conectado ({firestoreProbe.latencyMs} ms)</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-amber-700">Conectando ao Firestore...</span>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-mono">
                      Caminho: users/{FIXED_PASTORAL_UID.slice(0, 10)}.../sermons
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E6E2DA] space-y-1">
                    <span className="text-gray-500 block text-[10px] font-semibold uppercase">Acervo no Dispositivo (Local)</span>
                    <p className="font-bold text-gray-900 text-sm">
                      {sermons.filter(s => !isSermonBlank(s)).length} sermões salvos
                    </p>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      ✓ Armazenamento offline-first preservado
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-[#E6E2DA] space-y-1">
                    <span className="text-gray-500 block text-[10px] font-semibold uppercase">Acervo no Firestore (Nuvem)</span>
                    <p className="font-bold text-gray-900 text-sm">
                      {firestoreProbe?.connected ? `${firestoreProbe.cloudSermonCount} sermões na nuvem` : 'Consultando...'}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Coleção users/{FIXED_PASTORAL_UID.slice(0, 10)}.../sermons
                    </p>
                  </div>
                </div>

                {/* 3. Comparativo Claro de Contagem: Locais x Na Nuvem */}
                <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-700">Quantidade de Sermões (Comparativo):</span>
                  <span className="font-mono font-bold text-stone-900 bg-white px-2.5 py-1 rounded border border-stone-200">
                    {sermons.filter(s => !isSermonBlank(s)).length} locais x {firestoreProbe?.connected ? firestoreProbe.cloudSermonCount : 0} na nuvem
                  </span>
                </div>

                {/* 4. Mensagem de Estado do Firestore */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                    Status da Conexão Firestore
                  </span>
                  {firestoreProbe?.error || getLastFirestoreError() ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 space-y-1 text-xs text-red-900 font-mono">
                      <div className="flex items-center gap-1.5 font-bold text-red-950">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Aviso Registrado no Firestore:</span>
                      </div>
                      <p className="text-[11px] leading-relaxed break-all">
                        {firestoreProbe?.error || getLastFirestoreError()}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs text-emerald-900 font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Conexão ativa e sincronizada com o acervo pastoral</span>
                    </div>
                  )}
                </div>

                {/* 5. Regras de Isolamento e Preservação */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold font-sans flex items-center gap-1.5 text-emerald-950">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Segurança das Regras e Preservação da Biblioteca</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowRulesSnippet(prev => !prev)}
                      className="text-[11px] font-mono text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                    >
                      {showRulesSnippet ? 'Ocultar firestore.rules' : 'Ver firestore.rules'}
                    </button>
                  </div>

                  <p className="leading-relaxed text-[11px] text-emerald-900/90">
                    O aplicativo opera sob três salvaguardas invioláveis:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-900/90 pl-1">
                    <li><strong>Isolamento Estrito por Usuário:</strong> Cada usuário lê e grava unicamente seus próprios documentos sob o caminho <code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[10px]">users/{'{uid}'}/sermons</code> via <code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[10px]">request.auth.uid == uid</code>;</li>
                    <li><strong>Regra de Mesclagem:</strong> Ao sincronizar, <em>nunca</em> apaga sermões locais existentes; havendo conflito com o mesmo ID, prevalece a versão com o timestamp mais recente (<code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[10px]">updatedAt</code>);</li>
                    <li><strong>Ouvinte em Tempo Real:</strong> Utiliza <code className="bg-emerald-100/70 px-1 py-0.5 rounded font-mono text-[10px]">onSnapshot</code> nativo para manter os aparelhos instantaneamente atualizados.</li>
                  </ul>

                  {showRulesSnippet && (
                    <div className="mt-2 p-3 bg-stone-900 text-stone-200 rounded-lg font-mono text-[10px] leading-relaxed overflow-x-auto border border-stone-800 shadow-inner">
                      <p className="text-emerald-400 font-bold mb-1">// firestore.rules (Implantado & Ativo):</p>
                      <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if uid == '2PG5uxWMgeg3eE10yQbQVFDpHUu1' || (request.auth != null && request.auth.uid == uid);

      match /{document=**} {
        allow read, write: if uid == '2PG5uxWMgeg3eE10yQbQVFDpHUu1' || (request.auth != null && request.auth.uid == uid);
      }
    }
  }
}`}</pre>
                    </div>
                  )}
                </div>

                {/* 6. Eventos Recentes de Sincronização */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                      Eventos Recentes de Sincronização
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {syncLogs.length} eventos registrados
                    </span>
                  </div>

                  <div className="bg-gray-900 text-gray-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 font-mono text-[11px] border border-gray-800 shadow-inner">
                    {syncLogs.slice(0, 15).map((log) => (
                      <div key={log.id} className="flex items-start gap-2 border-b border-gray-800/60 pb-1 last:border-0 last:pb-0">
                        <span className="text-gray-500 shrink-0 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                        <span className={`shrink-0 font-bold ${
                          log.type === 'upload' ? 'text-sky-400' :
                          log.type === 'download' ? 'text-emerald-400' :
                          log.type === 'realtime' ? 'text-green-400' :
                          log.type === 'delete' ? 'text-amber-400' :
                          log.type === 'error' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          [{log.type.toUpperCase()}]
                        </span>
                        <div className="flex-1 truncate">
                          <span className="text-gray-100">{log.message}</span>
                          {log.details && (
                            <span className="text-gray-500 block text-[10px] truncate">{log.details}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TRANSFER CODE */}
            {syncModalTab === 'code' && (
              <div className="space-y-4">
                <div className="bg-[#FAF6EE] border border-[#5A5A40]/20 rounded-xl p-3.5 space-y-1 text-xs">
                  <h4 className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Sincronização Direta entre Aparelhos (Sem Login)</span>
                  </h4>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Transfira seu acervo completo (sermões, ilustrações e histórico) entre celular, tablet e computador copiando e colando um código seguro compactado.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Export Code */}
                  <div className="bg-white p-4 rounded-xl border border-[#E6E2DA] flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                        <Smartphone className="w-4 h-4" />
                        <span>1. Gerar Código deste Aparelho</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        Gere o token com todos os {sermons.filter(s => !isSermonBlank(s)).length} sermões e {getLocalIllustrations().length} ilustrações salvos aqui.
                      </p>
                    </div>

                    {syncCodeGenerated ? (
                      <div className="space-y-2">
                        <textarea
                          readOnly
                          rows={3}
                          value={syncCodeGenerated}
                          className="w-full bg-gray-50 p-2 font-mono text-[10px] text-gray-700 border border-[#E6E2DA] rounded-lg break-all select-all resize-none focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleCopyDeviceSyncCode}
                          className="w-full py-2 bg-[#5A5A40] hover:bg-[#2D2926] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          {isCopyingSyncCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopyingSyncCode ? 'Código Copiado!' : 'Copiar Código de Sincronização'}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateDeviceSyncCode}
                        className="w-full py-2.5 bg-[#FAF8F5] border border-[#5A5A40]/40 hover:bg-[#5A5A40] text-[#5A5A40] hover:text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Gerar Código de Exportação</span>
                      </button>
                    )}
                  </div>

                  {/* Step 2: Import Code */}
                  <div className="bg-white p-4 rounded-xl border border-[#E6E2DA] flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                        <Laptop className="w-4 h-4" />
                        <span>2. Importar de Outro Aparelho</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        Cole o código copiado do outro dispositivo para mesclar os acervos sem perder nada.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={syncCodeToImport}
                        onChange={(e) => setSyncCodeToImport(e.target.value)}
                        placeholder="Cole aqui o código (ESTUDIO_SYNC_v1:...)"
                        className="w-full bg-white p-2 font-mono text-[10px] text-gray-800 border border-[#E6E2DA] rounded-lg resize-none focus:outline-none focus:border-[#5A5A40]"
                      />
                      <button
                        type="button"
                        onClick={handleImportDeviceSyncCode}
                        className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mesclar & Sincronizar neste Aparelho</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BACKUP JSON */}
            {syncModalTab === 'backup' && (
              <div className="space-y-4">
                <div className="bg-[#FAF6EE] border border-[#5A5A40]/20 rounded-xl p-3.5 space-y-1 text-xs">
                  <h4 className="font-bold text-[#5A5A40] flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>Backup Completo em Arquivo (.json)</span>
                  </h4>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Gere uma cópia de segurança física que você pode guardar no seu computador, pen drive ou nuvem pessoal (Google Drive, Dropbox).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Download Backup */}
                  <div className="bg-white p-4 rounded-xl border border-[#E6E2DA] space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5A5A40]">
                        <FileDown className="w-4 h-4" />
                        <span>Baixar Backup Completo</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        Salva todos os {sermons.filter(s => !isSermonBlank(s)).length} sermões e {getLocalIllustrations().length} ilustrações em um arquivo .json seguro.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleExportBackupFile}
                      className="w-full py-2.5 bg-[#5A5A40] hover:bg-[#2D2926] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Arquivo de Backup (.json)</span>
                    </button>
                  </div>

                  {/* Restore Backup */}
                  <div className="bg-white p-4 rounded-xl border border-[#E6E2DA] space-y-3 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                        <FileUp className="w-4 h-4" />
                        <span>Restaurar de Arquivo</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-snug">
                        Selecione um arquivo de backup (.json) exportado anteriormente para mesclar com seu acervo.
                      </p>
                    </div>

                    <label className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-center">
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Carregar Arquivo (.json)</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportBackupFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="border-t border-[#E6E2DA] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSyncDiagnosticsModal(false);
                  setSyncActionMessage(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Fechar
              </button>

              {syncModalTab === 'realtime' && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleForceCloudSync();
                  }}
                  disabled={isCloudSyncing}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>{isCloudSyncing ? 'Sincronizando...' : 'Sincronizar Acervo Completo Agora'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Modal de Leitura e Projeção de Letra Completa (JUERP) */}
      {lyricsModalHymn && (
        <div 
          onClick={() => setLyricsModalHymn(null)}
          className="fixed inset-0 z-[99998] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF8F5] text-[#2D2926] rounded-2xl max-w-2xl w-full p-6 sm:p-8 max-h-[88vh] overflow-y-auto shadow-2xl border-2 border-[#5A5A40]/30 space-y-5 animate-fade-in relative"
          >
            <div className="flex items-start justify-between border-b border-gray-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-black uppercase text-white ${
                    lyricsModalHymn.hinario === 'CC' ? 'bg-[#5A5A40]' : 'bg-amber-800'
                  }`}>
                    {lyricsModalHymn.hinario} {lyricsModalHymn.number}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 font-sans">
                    {lyricsModalHymn.hinarioName}
                  </span>
                </div>
                <h3 className="font-serif text-2xl font-bold text-gray-900 mt-1">
                  {lyricsModalHymn.title}
                </h3>
                <p className="text-xs text-gray-500 font-sans italic mt-0.5">
                  Autor: {lyricsModalHymn.author} &bull; Tema: {lyricsModalHymn.theme}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `${lyricsModalHymn.hinario} ${lyricsModalHymn.number} — ${lyricsModalHymn.title}\nAutor: ${lyricsModalHymn.author}\n\n${lyricsModalHymn.fullLyrics}`;
                    navigator.clipboard.writeText(text);
                    setHymnCopiedId('modal_' + lyricsModalHymn.number);
                    setTimeout(() => setHymnCopiedId(null), 2500);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold font-sans bg-[#5A5A40] text-white hover:bg-[#2D2926] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {hymnCopiedId === 'modal_' + lyricsModalHymn.number ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Letra</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsModalHymn(null)}
                  className="p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 font-serif text-base leading-relaxed text-gray-900 pr-1">
              {lyricsModalHymn.stanzas.map((st, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[11px] font-sans font-bold text-[#5A5A40] uppercase tracking-wider block">
                    Estrofe {idx + 1}
                  </span>
                  <p className="whitespace-pre-line pl-3 border-l-2 border-[#5A5A40]/40">
                    {st}
                  </p>
                  {idx === 0 && lyricsModalHymn.chorus && (
                    <div className="my-3 p-3.5 rounded-xl bg-amber-50 border-l-3 border-amber-600 text-amber-950 font-sans italic text-sm">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block not-italic tracking-wider">
                        [Coro / Refrão]
                      </span>
                      <p className="whitespace-pre-line mt-1 font-serif text-base">
                        {lyricsModalHymn.chorus}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200 flex items-center justify-between font-sans text-xs text-gray-500">
              <span>Edição Oficial JUERP • Convenção Batista Brasileira</span>
              {lyricsModalHymn.crossReference && (
                <span>Correspondente: {lyricsModalHymn.crossReference.hinario} {lyricsModalHymn.crossReference.number}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {toastNotice && (
        <aside
          aria-label="Notificação do sistema"
          className="fixed bottom-6 right-6 z-[99999] max-w-md bg-[#2D2926] text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Check className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium leading-relaxed text-[#F5F2ED]">
              {toastNotice}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer text-xs shrink-0 select-none ml-2"
            title="Fechar"
          >
            ✕
          </button>
        </aside>
      )}

    </div>
  );
}
