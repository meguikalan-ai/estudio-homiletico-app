import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Layers,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Feather,
  Cloud,
  AlertTriangle,
  Plus,
  Search,
  Pencil,
  X,
  MessageSquare,
  PanelLeft
} from 'lucide-react';
import { TheologicalChatMessage, TheologicalChatTopic, ExegesisResponse } from '../types';
import {
  FIXED_PASTORAL_UID,
  LEGACY_CHAT_TOPIC_ID,
  LOCAL_STORAGE_CHAT_KEY,
  LOCAL_STORAGE_CHAT_TOPICS_KEY,
  saveChatMessageToCloud,
  saveChatTopicToCloud,
  deleteChatTopicFromCloud,
  syncAllLocalChatToCloud,
  syncAllLocalTopicsToCloud,
  subscribeToTheologicalChat,
  subscribeToTheologicalTopics,
  getDeletedTopicIds
} from '../services/sermonStorage';
import { safeApiPost } from '../services/apiClient';

interface TheologicalChatProps {
  onSendToLaboratory?: (content: string, exegesisData?: ExegesisResponse, passage?: string) => void;
  onInsertToSermon?: (text: string, passage?: string) => void;
}

const LOCAL_STORAGE_ACTIVE_TOPIC_KEY = 'pastoral_active_chat_topic_id';

const WELCOME_MESSAGE: TheologicalChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content:
    'A paz do Senhor, pastor! Sou o seu Consultor Bíblico e Teológico no "Estúdio Homilético Batista — Pastor Fernando Veiga". Minha fundação doutrinária e exegética é estritamente alinhada às Sagradas Escrituras, à Segunda Confissão Batista de Londres de 1689, à herança Reformada clássica e à catolicidade histórica da Igreja de Cristo — desde a Didaché, os Padres Apostólicos, os Credos Ecumênicos e os grandes Doutores da Antiguidade até os Reformadores, Puritanos e Batistas Históricos.\n\nComo posso auxiliá-lo hoje em suas pesquisas exegéticas, análise minuciosa dos originais em grego e hebraico, consulta aos grandes mestres da história da igreja ou na resolução de dilemas teológicos e contemporâneos?',
  timestamp: Date.now(),
  exegesisData: {
    passageReference: 'Romanos 5:1',
    answeringText:
      'Você pode solicitar análises exegéticas detalhadas de perícopes bíblicas, paralelos doutrinários com a Didaché e Padres Apostólicos (Clemente de Roma, Inácio de Antioquia, Irineu de Leão), conexões com os Credos Ecumênicos (Apostólico, Niceno, Calcedônia), Doutores da Igreja (Agostinho, Crisóstomo, Atanásio, Anselmo), cruzamento com teólogos reformados e puritanos, exame filológico nos originais e sementes homiléticas expositivas.',
    comparedVerses: [
      { version: 'ACF', text: 'Tendo sido, pois, justificados pela fé, temos paz com Deus, por nosso Senhor Jesus Cristo;' },
      { version: 'ARA', text: 'Justificados, pois, mediante a fé, temos paz com Deus por meio de nosso Senhor Jesus Cristo;' },
      { version: 'NAA', text: 'Justificados, pois, mediante a fé, temos paz com Deus por meio do nosso Senhor Jesus Cristo,' },
      { version: 'NVI', text: 'Tendo sido, pois, justificados pela fé, temos paz com Deus, por meio nosso Senhor Jesus Cristo,' }
    ],
    historicalContext:
      'Contexto eclesiástico, geográfico e canônico rigoroso, alinhado ao pano de fundo original dos autores inspirados e à recepção histórica primitiva da igreja.',
    philologicalNotes:
      'Δικαιωθέντες (Dikaiōthentes - Particípio Aoristo Passivo) e Εἰρήνη (Eirēnē / Shalom) — justificação como ato forense irrevogável de Deus.',
    theologicalCore:
      'Sola Fide, Sola Gratia, a união hipostática de Cristo (Calcedônia) e a centralidade de Cristo Mediador (Segunda Confissão Batista de Londres de 1689, Cap. 8 e 11).',
    homileticalSeeds: [
      'A justificação não é uma conquista moral humana, mas a imputação graciosa da justiça de Cristo (Clemente de Roma, 1 Clem 32).',
      'A paz com Deus é objetiva e eterna, cancelando para sempre a condenação do pecado.',
      'O acesso confiante à presença de Deus como fundamento da perseverança e consolação da igreja.'
    ]
  }
};

const SUGGESTED_QUESTIONS = [
  'Didaché e Mateus 28:19: ordenanças e santidade na Era Apostólica e na eclesiologia batista de 1689',
  'João 1:1,14 e a defesa de Atanásio (De Incarnatione) e do Credo Niceno contra o arianismo moderno',
  'Exegese de Romanos 5:1 (Dikaiothentes, Paz com Deus) à luz de Clemente de Roma, Crisóstomo e John Gill',
  'Antropologia e graça soberana em Efésios 2:1-10: diálogo entre Agostinho de Hipona e a Confissão de 1689'
];

const getFullMessageText = (msg: TheologicalChatMessage): string => {
  const parts: string[] = [];
  const ex = msg.exegesisData;

  if (msg.content?.trim()) {
    parts.push(`=== 1. VISÃO EXEGÉTICA & PASTORAL ===\n${msg.content.trim()}`);
  }

  if (ex) {
    if (ex.comparedVerses && ex.comparedVerses.length > 0) {
      const versesText = ex.comparedVerses.map(v => `[${v.version}] "${v.text}"`).join('\n');
      parts.push(`=== 2. VERSÕES BÍBLICAS COMPARADAS ===\n${versesText}`);
    }

    if (ex.historicalContext?.trim()) {
      parts.push(`=== 3. CONTEXTO HISTÓRICO & CULTURAL ===\n${ex.historicalContext.trim()}`);
    }

    if (ex.philologicalNotes?.trim()) {
      parts.push(`=== 4. NOTAS FILOLÓGICAS (GREGO / HEBRAICO) ===\n${ex.philologicalNotes.trim()}`);
    }

    if (ex.theologicalCore?.trim()) {
      parts.push(`=== 5. CERNE TEOLÓGICO & CRISTOCÊNTRICO ===\n${ex.theologicalCore.trim()}`);
    }

    if (ex.homileticalSeeds && ex.homileticalSeeds.length > 0) {
      const seedsText = ex.homileticalSeeds.map(s => `• ${s}`).join('\n');
      parts.push(`=== 6. SEMENTES HOMILÉTICAS PARA O SERMÃO ===\n${seedsText}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : (msg.content || '');
};

const BIBLE_BOOKS_REGEX =
  /(?:(?:[123]|I{1,3})\s*)?(?:Gênesis|Gên|Gn|Êxodo|Êx|Ex|Levítico|Lev|Lv|Números|Núm|Nm|Deuteronômio|Deut|Dt|Josué|Jos|Js|Juízes|Jz|Rute|Rt|Samuel|Sm|Reis|Rs|Crônicas|Cr|Esdras|Esd|Neemias|Ne|Ester|Est|Jó|Salmos?|Sl|Provérbios|Prov|Pv|Eclesiastes|Ecl|Ec|Cantares|Cânticos|Ct|Isaías|Is|Jeremias|Jr|Lamentações|Lm|Ezequiel|Ez|Daniel|Dan|Dn|Oseias|Oséias|Os|Joel|Jl|Amós|Am|Obadias|Ob|Jonas|Jn|Miqueias|Miquéias|Mq|Naum|Na|Habacuque|Hab|Hc|Sofonias|Sf|Ageu|Ag|Zacarias|Zac|Zc|Malaquias|Mal|Ml|Mateus|Mat|Mt|Marcos|Mc|Lucas|Luc|Lc|João|Jo|Atos|At|Romanos|Rom|Rm|Coríntios|Cor|Co|Gálatas|Gál|Gl|Efésios|Ef|Filipenses|Fil|Fp|Colossenses|Col|Cl|Tessalonicenses|Tess|Ts|Timóteo|Tim|Tm|Tito|Tt|Filemom|Filem|Fm|Fl|Hebreus|Heb|Hb|Tiago|Tg|Pedro|Pe|Judas|Jd|Apocalipse|Apoc|Ap)\s+\d+(?:[:.]\d+(?:[-–—]\d+)?)?(?:,\s*\d+(?:[-–—]\d+)?)*/i;

export const extractScriptureFromStudy = (
  msg: TheologicalChatMessage,
  relatedUserQuery?: string
): string => {
  const cleanMatch = (raw: string): string => {
    return raw.trim().replace(/^[\(\[\s"“”']+|[\)\]\s\:\."“”',]+$/g, '').trim();
  };

  if (msg.exegesisData?.passageReference?.trim()) {
    return cleanMatch(msg.exegesisData.passageReference);
  }

  if (relatedUserQuery) {
    const match = relatedUserQuery.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) return cleanMatch(match[0]);
  }

  if (msg.content) {
    const match = msg.content.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) return cleanMatch(match[0]);
  }

  if (msg.exegesisData?.answeringText) {
    const match = msg.exegesisData.answeringText.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) return cleanMatch(match[0]);
  }

  if (msg.exegesisData?.comparedVerses && msg.exegesisData.comparedVerses.length > 0) {
    for (const v of msg.exegesisData.comparedVerses) {
      if (v.text) {
        const match = v.text.match(BIBLE_BOOKS_REGEX);
        if (match && match[0]) return cleanMatch(match[0]);
      }
    }
  }

  if (msg.exegesisData?.historicalContext) {
    const match = msg.exegesisData.historicalContext.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) return cleanMatch(match[0]);
  }

  return '';
};

function deriveTopicTitle(queryText: string, passageRef?: string): string {
  const cleaned = queryText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return passageRef ? `Estudo em ${passageRef}` : 'Estudo Bíblico';
  }
  const maxLen = 54;
  if (cleaned.length <= maxLen) return cleaned;
  const sliced = cleaned.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > 24 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[,:;.\-]+$/, '').trim()}…`;
}

function formatTopicTimestamp(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getTopicTimeBucket(ts: number): 'Hoje' | 'Últimos 7 dias' | 'Anteriores' {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  if (ts >= startOfToday) return 'Hoje';
  if (ts >= sevenDaysAgo) return 'Últimos 7 dias';
  return 'Anteriores';
}

function loadInitialMessages(): TheologicalChatMessage[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CHAT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((m): m is TheologicalChatMessage => Boolean(m && m.id && m.id !== 'welcome-msg' && m.content))
          .map(m => ({ ...m, topicId: m.topicId || LEGACY_CHAT_TOPIC_ID }));
      }
    }
  } catch {}
  return [];
}

function loadInitialTopics(initialMessages: TheologicalChatMessage[]): TheologicalChatTopic[] {
  const deleted = getDeletedTopicIds();
  const topicMap = new Map<string, TheologicalChatTopic>();
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CHAT_TOPICS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((t: TheologicalChatTopic) => {
          if (t && t.id && t.title && !deleted.has(t.id)) {
            topicMap.set(t.id, t);
          }
        });
      }
    }
  } catch {}

  // Ensure any pre-existing messages without a matching topic are grouped into a topic
  const byTopic = new Map<string, TheologicalChatMessage[]>();
  initialMessages.forEach(m => {
    const tid = m.topicId || LEGACY_CHAT_TOPIC_ID;
    if (deleted.has(tid)) return;
    const arr = byTopic.get(tid) || [];
    arr.push(m);
    byTopic.set(tid, arr);
  });

  byTopic.forEach((msgs, tid) => {
    if (!topicMap.has(tid) && msgs.length > 0) {
      const sorted = [...msgs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const firstUser = sorted.find(m => m.role === 'user');
      const firstAssistant = sorted.find(m => m.role === 'assistant');
      const passage = firstAssistant
        ? extractScriptureFromStudy(firstAssistant, firstUser?.content)
        : firstUser?.content.match(BIBLE_BOOKS_REGEX)?.[0] || '';
      const lastMsg = sorted[sorted.length - 1];
      topicMap.set(tid, {
        id: tid,
        title: firstUser
          ? deriveTopicTitle(firstUser.content, passage)
          : tid === LEGACY_CHAT_TOPIC_ID
          ? 'Estudos Bíblicos Anteriores'
          : 'Estudo Bíblico',
        passageReference: passage || undefined,
        lastMessagePreview: lastMsg?.content?.slice(0, 140),
        createdAt: sorted[0].timestamp || Date.now(),
        updatedAt: lastMsg.timestamp || Date.now()
      });
    }
  });

  return Array.from(topicMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export const TheologicalChat: React.FC<TheologicalChatProps> = ({ onSendToLaboratory, onInsertToSermon }) => {
  const [allMessages, setAllMessages] = useState<TheologicalChatMessage[]>(() => loadInitialMessages());
  const [topics, setTopics] = useState<TheologicalChatTopic[]>(() => loadInitialTopics(loadInitialMessages()));
  const [activeTopicId, setActiveTopicId] = useState<string | null>(() => {
    const initialMsgs = loadInitialMessages();
    const initialTopics = loadInitialTopics(initialMsgs);
    try {
      const savedActive = localStorage.getItem(LOCAL_STORAGE_ACTIVE_TOPIC_KEY);
      if (savedActive && initialTopics.some(t => t.id === savedActive)) {
        return savedActive;
      }
    } catch {}
    return initialTopics.length > 0 ? initialTopics[0].id : null;
  });

  const [topicSearch, setTopicSearch] = useState('');
  const [isTopicsDrawerOpen, setIsTopicsDrawerOpen] = useState(false);
  const [renamingTopicId, setRenamingTopicId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<string | null>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [loadingTopicId, setLoadingTopicId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'error'>('syncing');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deletedTopicIdsRef = useRef<Set<string>>(getDeletedTopicIds());

  // Persist active topic selection locally
  useEffect(() => {
    try {
      if (activeTopicId) {
        localStorage.setItem(LOCAL_STORAGE_ACTIVE_TOPIC_KEY, activeTopicId);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_ACTIVE_TOPIC_KEY);
      }
    } catch {}
  }, [activeTopicId]);

  // Persist messages locally
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CHAT_KEY, JSON.stringify(allMessages));
    } catch {}
  }, [allMessages]);

  // Persist topics locally
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CHAT_TOPICS_KEY, JSON.stringify(topics));
    } catch {}
  }, [topics]);

  // Real-time Firestore synchronization for Topics and Messages across all devices
  useEffect(() => {
    let isMounted = true;

    const unsubTopics = subscribeToTheologicalTopics(
      FIXED_PASTORAL_UID,
      (cloudTopics, deletedIds) => {
        if (!isMounted) return;
        deletedTopicIdsRef.current = deletedIds;
        setSyncState('synced');

        setTopics(prev => {
          const merged = new Map<string, TheologicalChatTopic>();
          prev.forEach(t => {
            if (t && t.id && !deletedIds.has(t.id)) {
              merged.set(t.id, t);
            }
          });
          cloudTopics.forEach(ct => {
            if (ct && ct.id && !deletedIds.has(ct.id)) {
              const existing = merged.get(ct.id);
              if (!existing || (ct.updatedAt || 0) >= (existing.updatedAt || 0)) {
                merged.set(ct.id, ct);
              }
            }
          });
          return Array.from(merged.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        });

        setAllMessages(prev => prev.filter(m => !deletedIds.has(m.topicId || LEGACY_CHAT_TOPIC_ID)));

        setActiveTopicId(prevActive => {
          if (prevActive && deletedIds.has(prevActive)) {
            return null;
          }
          return prevActive;
        });
      },
      () => {
        if (isMounted) setSyncState('error');
      }
    );

    const unsubChat = subscribeToTheologicalChat(
      FIXED_PASTORAL_UID,
      (cloudMessages, clearedAt) => {
        if (!isMounted) return;
        setSyncState('synced');
        const deletedIds = deletedTopicIdsRef.current;

        setAllMessages(prev => {
          const mergedMap = new Map<string, TheologicalChatMessage>();
          prev.forEach(m => {
            const tid = m.topicId || LEGACY_CHAT_TOPIC_ID;
            if (m && m.id !== 'welcome-msg' && (m.timestamp || 0) > clearedAt && !deletedIds.has(tid)) {
              mergedMap.set(m.id, { ...m, topicId: tid });
            }
          });
          cloudMessages.forEach(cm => {
            const tid = cm.topicId || LEGACY_CHAT_TOPIC_ID;
            if (cm && cm.id && cm.id !== 'welcome-msg' && !deletedIds.has(tid)) {
              mergedMap.set(cm.id, { ...cm, topicId: tid });
            }
          });
          return Array.from(mergedMap.values()).sort(
            (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
          );
        });

        // Ensure every cloud message topicId (including legacy messages) has a topic card
        const byTopic = new Map<string, TheologicalChatMessage[]>();
        cloudMessages.forEach(cm => {
          const tid = cm.topicId || LEGACY_CHAT_TOPIC_ID;
          if (!cm || cm.id === 'welcome-msg' || (cm.timestamp || 0) <= clearedAt || deletedIds.has(tid)) return;
          const list = byTopic.get(tid) || [];
          list.push(cm);
          byTopic.set(tid, list);
        });

        if (byTopic.size > 0) {
          const legacyMsgs = byTopic.get(LEGACY_CHAT_TOPIC_ID);
          setTopics(prevTopics => {
            const topicMap = new Map<string, TheologicalChatTopic>();
            prevTopics.forEach(t => {
              if (t && t.id && !deletedIds.has(t.id)) {
                topicMap.set(t.id, t);
              }
            });

            let changed = false;
            byTopic.forEach((msgs, tid) => {
              if (!topicMap.has(tid) && msgs.length > 0) {
                const sorted = [...msgs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                const firstUser = sorted.find(m => m.role === 'user');
                const firstAssistant = sorted.find(m => m.role === 'assistant');
                const passage = firstAssistant
                  ? extractScriptureFromStudy(firstAssistant, firstUser?.content)
                  : firstUser?.content.match(BIBLE_BOOKS_REGEX)?.[0] || '';
                const lastMsg = sorted[sorted.length - 1];
                topicMap.set(tid, {
                  id: tid,
                  title: firstUser
                    ? deriveTopicTitle(firstUser.content, passage)
                    : tid === LEGACY_CHAT_TOPIC_ID
                    ? 'Estudos Bíblicos Anteriores'
                    : 'Estudo Bíblico',
                  passageReference: passage || undefined,
                  lastMessagePreview: lastMsg?.content?.slice(0, 140),
                  createdAt: sorted[0].timestamp || Date.now(),
                  updatedAt: lastMsg.timestamp || Date.now()
                });
                changed = true;
              }
            });

            if (!changed) return prevTopics;
            return Array.from(topicMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          });

          if (legacyMsgs && legacyMsgs.length > 0) {
            const sorted = [...legacyMsgs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const firstUser = sorted.find(m => m.role === 'user');
            const firstAssistant = sorted.find(m => m.role === 'assistant');
            const passage = firstAssistant
              ? extractScriptureFromStudy(firstAssistant, firstUser?.content)
              : firstUser?.content.match(BIBLE_BOOKS_REGEX)?.[0] || '';
            const lastMsg = sorted[sorted.length - 1];
            syncAllLocalTopicsToCloud(
              [
                {
                  id: LEGACY_CHAT_TOPIC_ID,
                  title: firstUser ? deriveTopicTitle(firstUser.content, passage) : 'Estudos Bíblicos Anteriores',
                  passageReference: passage || undefined,
                  lastMessagePreview: lastMsg?.content?.slice(0, 140),
                  createdAt: sorted[0].timestamp || Date.now(),
                  updatedAt: lastMsg.timestamp || Date.now()
                }
              ],
              FIXED_PASTORAL_UID
            ).catch(() => {});
          }
        }
      },
      () => {
        if (isMounted) setSyncState('error');
      }
    );

    syncAllLocalTopicsToCloud(topics, FIXED_PASTORAL_UID).catch(() => {});
    syncAllLocalChatToCloud(allMessages, FIXED_PASTORAL_UID).catch(() => {});

    return () => {
      isMounted = false;
      if (unsubTopics) {
        try {
          unsubTopics();
        } catch {}
      }
      if (unsubChat) {
        try {
          unsubChat();
        } catch {}
      }
    };
    // Run subscription once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus rename input when renaming begins
  useEffect(() => {
    if (renamingTopicId) {
      setTimeout(() => renameInputRef.current?.select(), 30);
    }
  }, [renamingTopicId]);

  const activeTopic = useMemo(
    () => (activeTopicId ? topics.find(t => t.id === activeTopicId) || null : null),
    [topics, activeTopicId]
  );

  // Messages belonging strictly to the currently selected Assunto
  const activeTopicMessages = useMemo(() => {
    if (!activeTopicId) return [];
    return allMessages
      .filter(m => (m.topicId || LEGACY_CHAT_TOPIC_ID) === activeTopicId)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [allMessages, activeTopicId]);

  // Display welcome card when creating a "Novo Assunto" (or empty topic)
  const displayedMessages = useMemo(() => {
    if (activeTopicMessages.length === 0) {
      return [WELCOME_MESSAGE];
    }
    return activeTopicMessages;
  }, [activeTopicMessages]);

  const messageCountsByTopic = useMemo(() => {
    const counts = new Map<string, number>();
    allMessages.forEach(m => {
      const tid = m.topicId || LEGACY_CHAT_TOPIC_ID;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });
    return counts;
  }, [allMessages]);

  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(t => {
      const hay = `${t.title} ${t.passageReference || ''} ${t.lastMessagePreview || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [topics, topicSearch]);

  const groupedTopics = useMemo(() => {
    const groups: Record<'Hoje' | 'Últimos 7 dias' | 'Anteriores', TheologicalChatTopic[]> = {
      Hoje: [],
      'Últimos 7 dias': [],
      Anteriores: []
    };
    filteredTopics.forEach(t => {
      groups[getTopicTimeBucket(t.updatedAt || t.createdAt)].push(t);
    });
    return (['Hoje', 'Últimos 7 dias', 'Anteriores'] as const)
      .filter(label => groups[label].length > 0)
      .map(label => ({ label, items: groups[label] }));
  }, [filteredTopics]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeTopicId, activeTopicMessages.length, loadingTopicId]);

  const isLoading = loadingTopicId !== null;
  const isCurrentTopicLoading =
    loadingTopicId !== null && (activeTopicId === loadingTopicId || (!activeTopicId && loadingTopicId === '__draft__'));

  const handleCreateNewTopic = () => {
    setActiveTopicId(null);
    setErrorNotice(null);
    setFallbackNotice(null);
    setConfirmDeleteTopicId(null);
    setRenamingTopicId(null);
    setIsTopicsDrawerOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 60);
  };

  const handleSelectTopic = (topicId: string) => {
    setActiveTopicId(topicId);
    setErrorNotice(null);
    setConfirmDeleteTopicId(null);
    setIsTopicsDrawerOpen(false);
  };

  const handleStartRename = (topic: TheologicalChatTopic, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteTopicId(null);
    setRenamingTopicId(topic.id);
    setRenameDraft(topic.title);
  };

  const handleCommitRename = (topicId: string) => {
    const trimmed = renameDraft.trim();
    setRenamingTopicId(null);
    if (!trimmed) return;

    const existing = topics.find(t => t.id === topicId);
    if (!existing) return;

    const now = Date.now();
    const updatedTopic: TheologicalChatTopic = {
      ...existing,
      title: trimmed.slice(0, 160),
      updatedAt: now
    };
    setTopics(prev =>
      prev
        .map(t => (t.id === topicId ? updatedTopic : t))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    );

    saveChatTopicToCloud(updatedTopic, FIXED_PASTORAL_UID).catch(() => {});
  };

  const handleRequestDeleteTopic = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingTopicId(null);
    setConfirmDeleteTopicId(prev => (prev === topicId ? null : topicId));
  };

  const handleConfirmDeleteTopic = (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteTopicId(null);
    deletedTopicIdsRef.current.add(topicId);

    setTopics(prev => {
      const remaining = prev.filter(t => t.id !== topicId);
      setActiveTopicId(curr => {
        if (curr !== topicId) return curr;
        return remaining.length > 0 ? remaining[0].id : null;
      });
      return remaining;
    });

    setAllMessages(prev => prev.filter(m => (m.topicId || LEGACY_CHAT_TOPIC_ID) !== topicId));
    deleteChatTopicFromCloud(topicId, FIXED_PASTORAL_UID).catch(() => {});
  };

  const handleSendToLaboratoryAction = (msg: TheologicalChatMessage) => {
    const fullText = getFullMessageText(msg);
    const msgIndex = displayedMessages.findIndex(m => m.id === msg.id);
    const relatedUserQuery =
      msgIndex > 0
        ? displayedMessages
            .slice(0, msgIndex)
            .reverse()
            .find(m => m.role === 'user')?.content
        : undefined;
    const extractedPassage = extractScriptureFromStudy(msg, relatedUserQuery);

    if (onSendToLaboratory) {
      onSendToLaboratory(fullText, msg.exegesisData, extractedPassage);
    } else if (onInsertToSermon) {
      onInsertToSermon(fullText, extractedPassage);
    }
    setSentMessageId(msg.id);
    setTimeout(() => {
      setSentMessageId(prev => (prev === msg.id ? null : prev));
    }, 2500);
  };

  const handleCopyMessage = async (msg: TheologicalChatMessage) => {
    const textToCopy = getFullMessageText(msg);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedMessageId(msg.id);
      setTimeout(() => {
        setCopiedMessageId(prev => (prev === msg.id ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Falha ao copiar resposta:', err);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    setErrorNotice(null);
    setFallbackNotice(null);

    const now = Date.now();
    let targetTopicId = activeTopicId;
    let topicToPersist: TheologicalChatTopic | null = null;

    if (!targetTopicId) {
      const newTopicId = `topic-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const passageFromQuery = textToSend.match(BIBLE_BOOKS_REGEX)?.[0]?.trim();
      const newTopic: TheologicalChatTopic = {
        id: newTopicId,
        title: deriveTopicTitle(textToSend, passageFromQuery),
        passageReference: passageFromQuery || undefined,
        lastMessagePreview: textToSend.slice(0, 140),
        createdAt: now,
        updatedAt: now
      };
      targetTopicId = newTopicId;
      topicToPersist = newTopic;
      setTopics(prev => [newTopic, ...prev]);
      setActiveTopicId(newTopicId);
    } else {
      const existingTopic = topics.find(t => t.id === targetTopicId);
      if (existingTopic) {
        const updated: TheologicalChatTopic = {
          ...existingTopic,
          lastMessagePreview: textToSend.slice(0, 140),
          updatedAt: now
        };
        topicToPersist = updated;
        setTopics(prev =>
          [updated, ...prev.filter(t => t.id !== targetTopicId)].sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
          )
        );
      }
    }

    const userMsgId = `user-${now}`;
    const userMessage: TheologicalChatMessage = {
      id: userMsgId,
      topicId: targetTopicId,
      role: 'user',
      content: textToSend,
      timestamp: now
    };

    const currentTopicHistory = [
      ...allMessages.filter(m => (m.topicId || LEGACY_CHAT_TOPIC_ID) === targetTopicId),
      userMessage
    ];

    setAllMessages(prev => [...prev, userMessage]);
    if (topicToPersist) {
      saveChatTopicToCloud(topicToPersist, FIXED_PASTORAL_UID).catch(() => {});
    }
    saveChatMessageToCloud(userMessage, FIXED_PASTORAL_UID).catch(() => {});

    if (!customText) setInputMessage('');
    setLoadingTopicId(targetTopicId);

    try {
      const chatHistory = currentTopicHistory.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      const data = await safeApiPost<ExegesisResponse & { fallbackActive?: boolean; fallbackReason?: string }>(
        '/api/gemini/chat-bible',
        {
          message: textToSend,
          chatHistory
        },
        { retries: 1, timeoutMs: 85000 }
      );

      if (data.fallbackActive) {
        setFallbackNotice(data.fallbackReason || 'Consulta processada em regime de contingência.');
      }

      const replyTs = Date.now();
      const assistantMessage: TheologicalChatMessage = {
        id: `assistant-${replyTs}`,
        topicId: targetTopicId,
        role: 'assistant',
        content: data.answeringText || 'Estudo concluído com sucesso.',
        timestamp: replyTs,
        exegesisData: data
      };

      const extractedPassage = extractScriptureFromStudy(assistantMessage, textToSend);

      setAllMessages(prev => [...prev, assistantMessage]);
      saveChatMessageToCloud(assistantMessage, FIXED_PASTORAL_UID).catch(() => {});

      // Update topic metadata (passageReference, preview, updatedAt)
      const baseTopic = topicToPersist || topics.find(t => t.id === targetTopicId);
      const refreshedTopic: TheologicalChatTopic | null = baseTopic
        ? {
            ...baseTopic,
            passageReference: baseTopic.passageReference || extractedPassage || undefined,
            lastMessagePreview: (assistantMessage.content || '').slice(0, 140),
            updatedAt: replyTs
          }
        : null;

      if (refreshedTopic) {
        setTopics(prev =>
          prev
            .map(t => (t.id === targetTopicId ? refreshedTopic : t))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        );
        saveChatTopicToCloud(refreshedTopic, FIXED_PASTORAL_UID).catch(() => {});
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Não foi possível obter resposta no momento.';
      setErrorNotice(`Falha ao consultar o assistente: ${errMsg}. Verifique a conexão com o servidor.`);
    } finally {
      setLoadingTopicId(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderTopicsSidebarContent = () => (
    <div className="flex flex-col h-full bg-[#FAF8F5]">
      {/* Sidebar Header + Novo Assunto CTA */}
      <div className="p-4 border-b border-[#E6E2DA] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-[#5A5A40] tracking-wide uppercase">Assuntos</span>
            <span className="text-xs font-mono tabular-nums text-gray-500">({topics.length})</span>
          </div>
          <button
            type="button"
            onClick={() => setIsTopicsDrawerOpen(false)}
            className="lg:hidden p-1.5 text-gray-500 hover:text-[#2D2926] rounded-lg hover:bg-[#EFECE6] cursor-pointer"
            aria-label="Fechar lista de assuntos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCreateNewTopic}
          className="w-full py-2 px-3 bg-[#5A5A40] hover:bg-[#2D2926] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Novo Assunto</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
            placeholder="Buscar assunto ou passagem..."
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-[#E6E2DA] rounded-lg text-xs text-[#2D2926] placeholder:text-gray-400 focus:outline-none focus:border-[#5A5A40]"
          />
          {topicSearch && (
            <button
              type="button"
              onClick={() => setTopicSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Topics List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
        {topics.length === 0 ? (
          <div className="px-3 py-8 text-center space-y-2">
            <MessageSquare className="w-7 h-7 text-[#5A5A40]/40 mx-auto" />
            <p className="text-xs font-medium text-[#2D2926]">Nenhum assunto salvo ainda</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Envie uma pergunta bíblica ou exegética para criar automaticamente o primeiro assunto.
            </p>
          </div>
        ) : groupedTopics.length === 0 ? (
          <div className="px-3 py-8 text-center space-y-2.5">
            <p className="text-xs text-gray-500">Nenhum assunto encontrado para "{topicSearch}".</p>
            <button
              type="button"
              onClick={() => setTopicSearch('')}
              className="text-xs font-semibold text-[#5A5A40] hover:underline cursor-pointer"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          groupedTopics.map(group => (
            <div key={group.label} className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-[#5A5A40]/80">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map(topic => {
                  const isActive = activeTopicId === topic.id;
                  const isRenaming = renamingTopicId === topic.id;
                  const isConfirmingDelete = confirmDeleteTopicId === topic.id;
                  const msgCount = messageCountsByTopic.get(topic.id) || 0;

                  return (
                    <div
                      key={topic.id}
                      onClick={() => {
                        if (!isRenaming && !isConfirmingDelete) {
                          handleSelectTopic(topic.id);
                        }
                      }}
                      className={`group rounded-xl px-2.5 py-2 border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white border-[#D6D0C4] shadow-2xs'
                          : 'bg-transparent border-transparent hover:bg-white/75 hover:border-[#E6E2DA]'
                      }`}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRename(topic.id);
                              if (e.key === 'Escape') setRenamingTopicId(null);
                            }}
                            maxLength={160}
                            className="flex-1 min-w-0 px-2 py-1 text-xs bg-[#FAF8F5] border border-[#5A5A40] rounded-md text-[#2D2926] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitRename(topic.id)}
                            className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer shrink-0"
                            title="Salvar nome"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingTopicId(null)}
                            className="p-1 text-gray-500 hover:bg-gray-100 rounded cursor-pointer shrink-0"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isConfirmingDelete ? (
                        <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                          <p className="text-[11px] font-semibold text-red-700">
                            Excluir este assunto em todos os dispositivos?
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDeleteTopic(topic.id, e)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[11px] font-semibold cursor-pointer"
                            >
                              Excluir
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTopicId(null)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-[11px] font-medium cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-1.5">
                            <span
                              className={`text-xs leading-snug line-clamp-2 flex-1 min-w-0 ${
                                isActive ? 'font-semibold text-[#2D2926]' : 'font-medium text-[#2D2926]/90'
                              }`}
                            >
                              {topic.title}
                            </span>

                            <div
                              className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(topic, e)}
                                className="p-1 text-gray-400 hover:text-[#5A5A40] hover:bg-[#FAF8F5] rounded cursor-pointer"
                                title="Renomear assunto"
                                aria-label="Renomear assunto"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleRequestDeleteTopic(topic.id, e)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Excluir assunto"
                                aria-label="Excluir assunto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Clean unboxed typographic metadata (no pill enclosures) */}
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 tabular-nums truncate">
                            {topic.passageReference && (
                              <>
                                <span className="text-[#5A5A40] font-medium truncate max-w-[110px]">
                                  {topic.passageReference}
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span>{msgCount} {msgCount === 1 ? 'msg' : 'msgs'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatTopicTimestamp(topic.updatedAt || topic.createdAt)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-[calc(100vh-140px)] min-h-[600px] max-w-6xl mx-auto w-full bg-white rounded-2xl border border-[#E6E2DA] shadow-sm overflow-hidden">
      {/* Desktop Persistent Sidebar: Assuntos */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-[#E6E2DA] flex-col">
        {renderTopicsSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay for Assuntos */}
      {isTopicsDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setIsTopicsDrawerOpen(false)}
          />
          <aside className="relative z-10 w-80 max-w-[85vw] h-full bg-[#FAF8F5] border-r border-[#E6E2DA] shadow-xl flex flex-col">
            {renderTopicsSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Chat Conversation Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Top Header */}
        <div className="bg-[#FAF8F5] px-4 sm:px-6 py-3.5 border-b border-[#E6E2DA] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsTopicsDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 text-[#2D2926] hover:bg-[#EFECE6] rounded-lg border border-[#E6E2DA] bg-white cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-semibold"
              title="Abrir lista de assuntos"
            >
              <PanelLeft className="w-4 h-4 text-[#5A5A40]" />
              <span className="tabular-nums">{topics.length}</span>
            </button>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shadow-xs shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-serif font-bold text-[#2D2926] truncate">
                Consultor Bíblico e Teológico
              </h2>
              <p className="text-[11px] text-gray-500 truncate">
                {activeTopic
                  ? `${activeTopic.title}${activeTopic.passageReference ? ` · ${activeTopic.passageReference}` : ''}`
                  : 'Novo assunto'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              title={
                syncState === 'synced'
                  ? 'Sincronizado em tempo real com todos os dispositivos'
                  : syncState === 'syncing'
                  ? 'Conectando à nuvem...'
                  : 'Erro ao sincronizar com o Firestore'
              }
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 px-1.5 py-1"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncState === 'synced'
                    ? 'bg-emerald-500 animate-pulse'
                    : syncState === 'syncing'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <Cloud className="w-3.5 h-3.5 text-[#5A5A40]" />
            </span>

            <button
              type="button"
              onClick={handleCreateNewTopic}
              title="Iniciar um novo assunto de estudo"
              className="px-3 py-1.5 bg-white hover:bg-[#5A5A40] text-[#2D2926] hover:text-white border border-[#E6E2DA] hover:border-[#5A5A40] rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Novo Assunto</span>
            </button>
          </div>
        </div>

        {fallbackNotice && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{fallbackNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFallbackNotice(null)}
              className="font-bold px-2 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Chat Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#FDFBF7]/40">
          {displayedMessages.map(msg => {
            const isUser = msg.role === 'user';
            const exData = msg.exegesisData;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`flex flex-col max-w-[90%] sm:max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-[#2D2926] text-white rounded-br-xs'
                        : 'bg-white text-[#2D2926] border border-[#E6E2DA] rounded-bl-xs space-y-3.5 relative group'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#E6E2DA]/60 -mt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5A40]">
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span>Consultor Bíblico e Teológico</span>
                          </div>
                          {(() => {
                            const msgIdx = displayedMessages.findIndex(m => m.id === msg.id);
                            const userQ =
                              msgIdx > 0
                                ? displayedMessages
                                    .slice(0, msgIdx)
                                    .reverse()
                                    .find(m => m.role === 'user')?.content
                                : undefined;
                            const passRef = extractScriptureFromStudy(msg, userQ);
                            return passRef ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#5A5A40] bg-[#5A5A40]/10 border border-[#5A5A40]/20 px-2 py-0.5 rounded-md">
                                <span>{passRef}</span>
                              </span>
                            ) : null;
                          })()}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                          {(onSendToLaboratory || onInsertToSermon) && (
                            <button
                              type="button"
                              onClick={() => handleSendToLaboratoryAction(msg)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer shadow-2xs whitespace-nowrap ${
                                sentMessageId === msg.id
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200'
                                  : 'bg-[#FAF8F5] hover:bg-[#EFECE6] text-[#5A5A40] hover:text-[#2D2926] border border-[#5A5A40]/30 hover:border-[#5A5A40]'
                              }`}
                              title={(() => {
                                const msgIdx = displayedMessages.findIndex(m => m.id === msg.id);
                                const userQ =
                                  msgIdx > 0
                                    ? displayedMessages
                                        .slice(0, msgIdx)
                                        .reverse()
                                        .find(m => m.role === 'user')?.content
                                    : undefined;
                                const passRef = extractScriptureFromStudy(msg, userQ);
                                return passRef
                                  ? `Transferir passagem (${passRef}) e subsídios para a Oficina de Sermões`
                                  : 'Transferir exegese e sementes homiléticas diretamente para a Oficina de Sermões';
                              })()}
                              aria-label="Usar no Sermão"
                            >
                              {sentMessageId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in duration-150" />
                                  <span className="font-semibold text-emerald-700">Enviado!</span>
                                </>
                              ) : (
                                <>
                                  <Feather className="w-3.5 h-3.5 text-[#5A5A40]" />
                                  <span>Usar no Sermão</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer shadow-2xs whitespace-nowrap ${
                              copiedMessageId === msg.id
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200'
                                : 'bg-[#FAF8F5] hover:bg-[#EFECE6] text-gray-600 hover:text-[#2D2926] border border-[#E6E2DA]'
                            }`}
                            title={copiedMessageId === msg.id ? 'Copiado para a área de transferência!' : 'Copiar resposta'}
                            aria-label="Copiar resposta"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 animate-in zoom-in duration-150" />
                                <span className="font-semibold text-emerald-700">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-700" />
                                <span>Copiar Resposta</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 1. Visão Exegética & Pastoral */}
                    <div className="space-y-1.5 font-sans">
                      {!isUser && exData && (
                        <div className="flex items-center gap-1.5 text-[#5A5A40] font-bold text-[11px] uppercase tracking-wider border-b border-[#E6E2DA]/50 pb-1 mb-2">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>1. Visão Exegética & Pastoral</span>
                        </div>
                      )}
                      <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                    </div>

                    {/* Structured Exegetical Cards (Sections 2 to 6) */}
                    {!isUser && exData && (
                      <div className="space-y-3 pt-2 text-xs">
                        {exData.comparedVerses && exData.comparedVerses.length > 0 && (
                          <div className="space-y-2 bg-[#FAF8F5] p-3 rounded-xl border border-[#E6E2DA]">
                            <div className="flex items-center gap-1.5 text-[#5A5A40] font-bold text-[11px] uppercase tracking-wider">
                              <Layers className="w-3.5 h-3.5" />
                              <span>2. Versões Bíblicas Comparadas</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 pt-1">
                              {exData.comparedVerses.map((cv, vIdx) => (
                                <div key={vIdx} className="p-2.5 bg-white rounded-lg border border-[#E6E2DA] space-y-1">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                      cv.version === 'ACF' ? 'bg-[#5A5A40] text-white' : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {cv.version}
                                  </span>
                                  <p className="font-serif italic text-gray-800 text-xs leading-relaxed">"{cv.text}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {exData.historicalContext && exData.historicalContext.trim() && (
                          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100/90 text-emerald-950">
                            <span className="font-bold text-emerald-900 block mb-1 text-[11px] tracking-wide uppercase">
                              3. Contexto Histórico & Cultural:
                            </span>
                            <p className="text-gray-700 leading-relaxed">{exData.historicalContext}</p>
                          </div>
                        )}

                        {exData.philologicalNotes && exData.philologicalNotes.trim() && (
                          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-100/90 text-amber-950">
                            <span className="font-bold text-amber-900 block mb-1 text-[11px] tracking-wide uppercase">
                              4. Notas Filológicas (Grego / Hebraico):
                            </span>
                            <p className="font-mono text-gray-800 italic leading-relaxed">{exData.philologicalNotes}</p>
                          </div>
                        )}

                        {exData.theologicalCore && exData.theologicalCore.trim() && (
                          <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100/90 text-purple-950">
                            <span className="font-bold text-purple-900 block mb-1 text-[11px] tracking-wide uppercase">
                              5. Cerne Teológico & Cristocêntrico:
                            </span>
                            <p className="text-gray-700 font-medium leading-relaxed">{exData.theologicalCore}</p>
                          </div>
                        )}

                        {exData.homileticalSeeds && exData.homileticalSeeds.length > 0 && (
                          <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E6E2DA] space-y-1.5">
                            <span className="font-bold text-[#5A5A40] block text-[11px] uppercase tracking-wide">
                              6. Sementes Homiléticas para o Sermão:
                            </span>
                            <ul className="list-disc list-inside space-y-1 text-gray-700 pl-1">
                              {exData.homileticalSeeds.map((seed, sIdx) => (
                                <li key={sIdx} className="leading-snug">
                                  {seed}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-400 mt-1 px-1 tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-[#2D2926] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isCurrentTopicLoading && (
            <div className="flex gap-3 items-center text-xs text-gray-500 italic bg-white p-3 rounded-xl border border-[#E6E2DA] w-fit shadow-2xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5A5A40]" />
              <span>Consultando acervo bíblico e exegético...</span>
            </div>
          )}

          {errorNotice && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{errorNotice}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts (shown when starting a Novo Assunto) */}
        {activeTopicMessages.length === 0 && (
          <div className="px-4 sm:px-6 py-2.5 bg-[#FAF8F5] border-t border-[#E6E2DA]/60 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#5A5A40]" /> Sugestões:
            </span>
            {SUGGESTED_QUESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(sug)}
                className="text-[11px] bg-white hover:bg-[#5A5A40] text-[#2D2926] hover:text-white px-2.5 py-1 rounded-full border border-[#E6E2DA] transition-all cursor-pointer shadow-2xs font-medium text-left"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <div className="p-4 bg-white border-t border-[#E6E2DA] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2 bg-[#FAF8F5] border border-[#E6E2DA] rounded-xl p-2 focus-within:border-[#5A5A40] focus-within:ring-1 focus-within:ring-[#5A5A40] transition-all"
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Faça uma consulta doutrinária, exegese em grego/hebraico, análise confessional (1689) ou peça: 'Compare Romanos 8:28 em ACF, ARC e NVI'..."
              className="flex-1 bg-transparent border-0 focus:ring-0 resize-none text-xs sm:text-sm text-[#2D2926] placeholder:text-gray-400 p-1.5 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2.5 bg-[#5A5A40] hover:bg-[#2D2926] disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer shrink-0 shadow-xs flex items-center justify-center"
              title="Enviar mensagem (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-gray-400 gap-2">
            <span>
              Pressione <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para nova linha.
            </span>
            <span className="hidden sm:inline truncate">
              Sola Scriptura • 1689 London Confession • Herança Reformada Clássica
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
