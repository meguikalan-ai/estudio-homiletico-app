import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, BookOpen, Layers, RefreshCw, Trash2, ArrowDown, Copy, Check, Feather } from 'lucide-react';
import { TheologicalChatMessage, ExegesisResponse } from '../types';

interface TheologicalChatProps {
  onSendToLaboratory?: (content: string, exegesisData?: ExegesisResponse, passage?: string) => void;
  onInsertToSermon?: (text: string, passage?: string) => void;
}

const INITIAL_MESSAGES: TheologicalChatMessage[] = [
  {
    id: 'welcome-msg',
    role: 'assistant',
    content: 'A paz do Senhor, pastor! Sou o seu Consultor Teológico & Hermenêutico Sênior no "Estúdio Homilético Batista — Pastor Fernando Veiga". Minha fundação doutrinária e exegética é estritamente alinhada às Sagradas Escrituras, à Segunda Confissão Batista de Londres de 1689, à herança Reformada clássica e à catolicidade histórica da Igreja de Cristo — desde a Didaché, os Padres Apostólicos, os Credos Ecumênicos e os grandes Doutores da Antiguidade até os Reformadores, Puritanos e Batistas Históricos.\n\nComo posso auxiliá-lo hoje em suas pesquisas exegéticas, análise minuciosa dos originais em grego e hebraico, consulta aos grandes mestres da história da igreja ou na resolução de dilemas teológicos e contemporâneos?',
    timestamp: Date.now(),
    exegesisData: {
      passageReference: 'Romanos 5:1',
      answeringText: 'Você pode solicitar análises exegéticas detalhadas de perícopes bíblicas, paralelos doutrinários com a Didaché e Padres Apostólicos (Clemente de Roma, Inácio de Antioquia, Irineu de Leão), conexões com os Credos Ecumênicos (Apostólico, Niceno, Calcedônia), Doutores da Igreja (Agostinho, Crisóstomo, Atanásio, Anselmo), cruzamento com teólogos reformados e puritanos, exame filológico nos originais e sementes homiléticas expositivas.',
      comparedVerses: [
        { version: 'ACF', text: 'Tendo sido, pois, justificados pela fé, temos paz com Deus, por nosso Senhor Jesus Cristo;' },
        { version: 'ARA', text: 'Justificados, pois, mediante a fé, temos paz com Deus por meio de nosso Senhor Jesus Cristo;' },
        { version: 'NAA', text: 'Justificados, pois, mediante a fé, temos paz com Deus por meio do nosso Senhor Jesus Cristo,' },
        { version: 'NVI', text: 'Tendo sido, pois, justificados pela fé, temos paz com Deus, por meio de nosso Senhor Jesus Cristo,' }
      ],
      historicalContext: 'Contexto eclesiástico, geográfico e canônico rigoroso, alinhado ao pano de fundo original dos autores inspirados e à recepção histórica primitiva da igreja.',
      philologicalNotes: 'Δικαιωθέντες (Dikaiōthentes - Particípio Aoristo Passivo) e Εἰρήνη (Eirēnē / Shalom) — justificação como ato forense irrevogável de Deus.',
      theologicalCore: 'Sola Fide, Sola Gratia, a união hipostática de Cristo (Calcedônia) e a centralidade de Cristo Mediador (Segunda Confissão Batista de Londres de 1689, Cap. 8 e 11).',
      homileticalSeeds: [
        'A justificação não é uma conquista moral humana, mas a imputação graciosa da justiça de Cristo (Clemente de Roma, 1 Clem 32).',
        'A paz com Deus é objetiva e eterna, cancelando para sempre a condenação do pecado.',
        'O acesso confiante à presença de Deus como fundamento da perseverança e consolação da igreja.'
      ]
    }
  }
];

const SUGGESTED_QUESTIONS = [
  'Didaché e Mateus 28:19: ordenanças e santidade na Era Apostólica e na eclesiologia batista de 1689',
  'João 1:1,14 e a defesa de Atanásio (De Incarnatione) e do Credo Niceno contra o arianismo moderno',
  'Exegese de Romanos 5:1 (Dikaiothentes, Paz com Deus) à luz de Clemente de Roma, Crisóstomo e John Gill',
  'Antropologia e graça soberana em Efésios 2:1-10: diálogo entre Agostinho de Hipona e a Confissão de 1689'
];

const getFullMessageText = (msg: TheologicalChatMessage): string => {
  const parts: string[] = [];
  const ex = msg.exegesisData;

  // 1. Visão Exegética & Pastoral
  if (msg.content?.trim()) {
    parts.push(`=== 1. VISÃO EXEGÉTICA & PASTORAL ===\n${msg.content.trim()}`);
  }

  if (ex) {
    // 2. Versões Bíblicas Comparadas
    if (ex.comparedVerses && ex.comparedVerses.length > 0) {
      const versesText = ex.comparedVerses
        .map(v => `[${v.version}] "${v.text}"`)
        .join('\n');
      parts.push(`=== 2. VERSÕES BÍBLICAS COMPARADAS ===\n${versesText}`);
    }

    // 3. Contexto Histórico & Cultural
    if (ex.historicalContext?.trim()) {
      parts.push(`=== 3. CONTEXTO HISTÓRICO & CULTURAL ===\n${ex.historicalContext.trim()}`);
    }

    // 4. Notas Filológicas (Grego / Hebraico)
    if (ex.philologicalNotes?.trim()) {
      parts.push(`=== 4. NOTAS FILOLÓGICAS (GREGO / HEBRAICO) ===\n${ex.philologicalNotes.trim()}`);
    }

    // 5. Cerne Teológico & Cristocêntrico
    if (ex.theologicalCore?.trim()) {
      parts.push(`=== 5. CERNE TEOLÓGICO & CRISTOCÊNTRICO ===\n${ex.theologicalCore.trim()}`);
    }

    // 6. Sementes Homiléticas para o Sermão
    if (ex.homileticalSeeds && ex.homileticalSeeds.length > 0) {
      const seedsText = ex.homileticalSeeds.map(s => `• ${s}`).join('\n');
      parts.push(`=== 6. SEMENTES HOMILÉTICAS PARA O SERMÃO ===\n${seedsText}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : (msg.content || '');
};

// Comprehensive regex pattern for Portuguese canonical biblical book references
const BIBLE_BOOKS_REGEX = /(?:(?:[123]|I{1,3})\s*)?(?:Gênesis|Gên|Gn|Êxodo|Êx|Ex|Levítico|Lev|Lv|Números|Núm|Nm|Deuteronômio|Deut|Dt|Josué|Jos|Js|Juízes|Jz|Rute|Rt|Samuel|Sm|Reis|Rs|Crônicas|Cr|Esdras|Esd|Neemias|Ne|Ester|Est|Jó|Salmos?|Sl|Provérbios|Prov|Pv|Eclesiastes|Ecl|Ec|Cantares|Cânticos|Ct|Isaías|Is|Jeremias|Jr|Lamentações|Lm|Ezequiel|Ez|Daniel|Dan|Dn|Oseias|Oséias|Os|Joel|Jl|Amós|Am|Obadias|Ob|Jonas|Jn|Miqueias|Miquéias|Mq|Naum|Na|Habacuque|Hab|Hc|Sofonias|Sf|Ageu|Ag|Zacarias|Zac|Zc|Malaquias|Mal|Ml|Mateus|Mat|Mt|Marcos|Mc|Lucas|Luc|Lc|João|Jo|Atos|At|Romanos|Rom|Rm|Coríntios|Cor|Co|Gálatas|Gál|Gl|Efésios|Ef|Filipenses|Fil|Fp|Colossenses|Col|Cl|Tessalonicenses|Tess|Ts|Timóteo|Tim|Tm|Tito|Tt|Filemom|Filem|Fm|Fl|Hebreus|Heb|Hb|Tiago|Tg|Pedro|Pe|Judas|Jd|Apocalipse|Apoc|Ap)\s+\d+(?:[:.]\d+(?:[-–—]\d+)?)?(?:,\s*\d+(?:[-–—]\d+)?)*/i;

export const extractScriptureFromStudy = (
  msg: TheologicalChatMessage,
  relatedUserQuery?: string
): string => {
  const cleanMatch = (raw: string): string => {
    return raw.trim().replace(/^[\(\[\s"“”']+|[\)\]\s\:\."“”',]+$/g, '').trim();
  };

  // 1. Explicit passageReference if present in exegesisData
  if (msg.exegesisData?.passageReference?.trim()) {
    return cleanMatch(msg.exegesisData.passageReference);
  }

  // 2. Check user query first (most intentional reference requested by the pastor)
  if (relatedUserQuery) {
    const match = relatedUserQuery.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) {
      return cleanMatch(match[0]);
    }
  }

  // 3. Check assistant main text
  if (msg.content) {
    const match = msg.content.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) {
      return cleanMatch(match[0]);
    }
  }

  // 4. Check answeringText in exegesisData
  if (msg.exegesisData?.answeringText) {
    const match = msg.exegesisData.answeringText.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) {
      return cleanMatch(match[0]);
    }
  }

  // 5. Check comparedVerses
  if (msg.exegesisData?.comparedVerses && msg.exegesisData.comparedVerses.length > 0) {
    for (const v of msg.exegesisData.comparedVerses) {
      if (v.text) {
        const match = v.text.match(BIBLE_BOOKS_REGEX);
        if (match && match[0]) {
          return cleanMatch(match[0]);
        }
      }
    }
  }

  // 6. Check historicalContext
  if (msg.exegesisData?.historicalContext) {
    const match = msg.exegesisData.historicalContext.match(BIBLE_BOOKS_REGEX);
    if (match && match[0]) {
      return cleanMatch(match[0]);
    }
  }

  return '';
};

export const TheologicalChat: React.FC<TheologicalChatProps> = ({ onSendToLaboratory, onInsertToSermon }) => {
  const [messages, setMessages] = useState<TheologicalChatMessage[]>(() => {
    const saved = localStorage.getItem('pastoral_theological_chat');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_MESSAGES;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sentMessageId, setSentMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendToLaboratoryAction = (msg: TheologicalChatMessage) => {
    const fullText = getFullMessageText(msg);
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    const relatedUserQuery = msgIndex > 0
      ? messages.slice(0, msgIndex).reverse().find(m => m.role === 'user')?.content
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

  // Auto-save chat history locally
  useEffect(() => {
    try {
      localStorage.setItem('pastoral_theological_chat', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    setErrorNotice(null);
    const userMsgId = `user-${Date.now()}`;
    const userMessage: TheologicalChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!customText) setInputMessage('');
    setIsLoading(true);

    try {
      // Build brief history for context
      const chatHistory = updatedMessages.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/gemini/chat-bible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          chatHistory
        })
      });

      if (!response.ok) {
        throw new Error('Falha de comunicação com o assistente.');
      }

      const data: ExegesisResponse = await response.json();
      
      const assistantMessage: TheologicalChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answeringText || 'Estudo concluído com sucesso.',
        timestamp: Date.now(),
        exegesisData: data
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setErrorNotice('Não foi possível obter resposta no momento. Verifique a conexão com o servidor.');
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja limpar todo o histórico desta conversa de estudo?')) {
      setMessages(INITIAL_MESSAGES);
      localStorage.removeItem('pastoral_theological_chat');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] max-w-5xl mx-auto w-full bg-white rounded-2xl border border-[#E6E2DA] shadow-sm overflow-hidden">
      
      {/* Chat Top Header */}
      <div className="bg-[#FAF8F5] px-6 py-4 border-b border-[#E6E2DA] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-serif font-bold text-[#2D2926] flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span>Consultor Teológico & Hermenêutico Sênior</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-sans px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                1689 Confession • Patrística • Credos
              </span>
            </h2>
            <p className="text-xs text-gray-500 font-sans">
              Pr. Fernando Veiga • Escrituras Sagradas, Catolicidade Histórica (Didaché, Padres Apostólicos, Credos Ecumênicos e Doutores da Igreja), 2ª Confissão Batista de Londres de 1689 e Hermenêutica Histórico-Gramatical.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleClearHistory}
              title="Limpar histórico da conversa"
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Limpar Conversa</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#FDFBF7]/40">
        
        {messages.map((msg) => {
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

              <div className={`flex flex-col max-w-[88%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                
                {/* Message Bubble */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-[#2D2926] text-white rounded-br-xs'
                      : 'bg-white text-[#2D2926] border border-[#E6E2DA] rounded-bl-xs space-y-3.5 relative group'
                  }`}
                >
                  {/* Top Bar for Assistant Message with Discrete & Elegant Copy Button */}
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#E6E2DA]/60 -mt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5A40]">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>Consultor Teológico & Hermenêutico Sênior</span>
                        </div>
                        {(() => {
                          const msgIdx = messages.findIndex(m => m.id === msg.id);
                          const userQ = msgIdx > 0
                            ? messages.slice(0, msgIdx).reverse().find(m => m.role === 'user')?.content
                            : undefined;
                          const passRef = extractScriptureFromStudy(msg, userQ);
                          return passRef ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#5A5A40] bg-[#5A5A40]/10 border border-[#5A5A40]/20 px-2 py-0.5 rounded-md">
                              <span>📖</span>
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer shadow-2xs ${
                              sentMessageId === msg.id
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200'
                                : 'bg-[#FAF8F5] hover:bg-[#EFECE6] text-[#5A5A40] hover:text-[#2D2926] border border-[#5A5A40]/30 hover:border-[#5A5A40]'
                            }`}
                            title={(() => {
                              const msgIdx = messages.findIndex(m => m.id === msg.id);
                              const userQ = msgIdx > 0
                                ? messages.slice(0, msgIdx).reverse().find(m => m.role === 'user')?.content
                                : undefined;
                              const passRef = extractScriptureFromStudy(msg, userQ);
                              return passRef
                                ? `Transferir passagem (${passRef}) e subsídios para o Laboratório de Sermões`
                                : "Transferir exegese e sementes homiléticas diretamente para o Laboratório de Sermões";
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
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 cursor-pointer shadow-2xs ${
                            copiedMessageId === msg.id
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200'
                              : 'bg-[#FAF8F5] hover:bg-[#EFECE6] text-gray-600 hover:text-[#2D2926] border border-[#E6E2DA]'
                          }`}
                          title={copiedMessageId === msg.id ? "Copiado para a área de transferência!" : "Copiar resposta"}
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
                    <div className="whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </div>
                  </div>

                  {/* Structured Exegetical Cards (Sections 2 to 6) */}
                  {!isUser && exData && (
                    <div className="space-y-3 pt-2 text-xs">
                      
                      {/* 2. Compared Verses Box */}
                      {exData.comparedVerses && exData.comparedVerses.length > 0 && (
                        <div className="space-y-2 bg-[#FAF8F5] p-3 rounded-xl border border-[#E6E2DA]">
                          <div className="flex items-center gap-1.5 text-[#5A5A40] font-bold text-[11px] uppercase tracking-wider">
                            <Layers className="w-3.5 h-3.5" />
                            <span>2. Versões Bíblicas Comparadas</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 pt-1">
                            {exData.comparedVerses.map((cv, vIdx) => (
                              <div key={vIdx} className="p-2.5 bg-white rounded-lg border border-[#E6E2DA] space-y-1">
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider ${cv.version === 'ACF' ? 'bg-[#5A5A40] text-white' : 'bg-gray-100 text-gray-700'}`}>
                                  {cv.version}
                                </span>
                                <p className="font-serif italic text-gray-800 text-xs leading-relaxed">
                                  "{cv.text}"
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Historical Context */}
                      {exData.historicalContext && exData.historicalContext.trim() && (
                        <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100/90 text-emerald-950">
                          <span className="font-bold text-emerald-900 block mb-1 text-[11px] tracking-wide uppercase">
                            3. Contexto Histórico & Cultural:
                          </span>
                          <p className="text-gray-700 leading-relaxed">{exData.historicalContext}</p>
                        </div>
                      )}

                      {/* 4. Philological Notes */}
                      {exData.philologicalNotes && exData.philologicalNotes.trim() && (
                        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-100/90 text-amber-950">
                          <span className="font-bold text-amber-900 block mb-1 text-[11px] tracking-wide uppercase">
                            4. Notas Filológicas (Grego / Hebraico):
                          </span>
                          <p className="font-mono text-gray-800 italic leading-relaxed">{exData.philologicalNotes}</p>
                        </div>
                      )}

                      {/* 5. Theological Core */}
                      {exData.theologicalCore && exData.theologicalCore.trim() && (
                        <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100/90 text-purple-950">
                          <span className="font-bold text-purple-900 block mb-1 text-[11px] tracking-wide uppercase">
                            5. Cerne Teológico & Cristocêntrico:
                          </span>
                          <p className="text-gray-700 font-medium leading-relaxed">{exData.theologicalCore}</p>
                        </div>
                      )}

                      {/* 6. Homiletical Seeds */}
                      {exData.homileticalSeeds && exData.homileticalSeeds.length > 0 && (
                        <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#E6E2DA] space-y-1.5">
                          <span className="font-bold text-[#5A5A40] block text-[11px] uppercase tracking-wide">
                            6. Sementes Homiléticas para o Sermão:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-gray-700 pl-1">
                            {exData.homileticalSeeds.map((seed, sIdx) => (
                              <li key={sIdx} className="leading-snug">{seed}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>
                  )}

                </div>

                <span className="text-[10px] text-gray-400 mt-1 px-1">
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

        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-gray-500 italic bg-white p-3 rounded-xl border border-[#E6E2DA] w-fit shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5A5A40]" />
            <span>Consultando acervo bíblico e exegético...</span>
          </div>
        )}

        {errorNotice && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {errorNotice}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Pills (shown when short conversation) */}
      {messages.length <= 2 && (
        <div className="px-6 py-2.5 bg-[#FAF8F5] border-t border-[#E6E2DA]/60 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#5A5A40]" /> Sugestões:
          </span>
          {SUGGESTED_QUESTIONS.map((sug, idx) => (
            <button
              key={idx}
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
        <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-gray-400">
          <span>Pressione <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para nova linha.</span>
          <span>Sola Scriptura • 1689 London Confession • Herança Reformada Clássica</span>
        </div>
      </div>

    </div>
  );
};
