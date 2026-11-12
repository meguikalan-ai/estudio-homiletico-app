import React, { useState, useEffect } from 'react';
import { 
  Palette, Copy, Check, Feather, Trash2, 
  Search, Monitor, Image as ImageIcon, Sparkles, X, Loader2, BookOpen
} from 'lucide-react';
import { VisualIllustration } from '../types';
import { 
  saveIllustrationToCloud,
  deleteIllustrationFromCloud, 
  fetchIllustrationsFromCloud, 
  syncAllLocalIllustrationsToCloud 
} from '../services/sermonStorage';

interface IllustrationGeneratorProps {
  onSendToLaboratory?: (illustration: {
    title: string;
    story: string;
    moral: string;
    scripture?: string;
    visualPrompt?: string;
  }) => void;
}

const STARTER_ILLUSTRATIONS: VisualIllustration[] = [
  {
    id: 'starter-1',
    title: 'O Pescador Solitário e a Âncora Oculta',
    type: 'cotidiano',
    scripture: 'Hebreus 6:19',
    story: 'Um experiente barqueiro do litoral aprendeu de seus ancestrais que, quando o vendaval se abate sobre a costa, a embarcação nunca deve tentar vencer a fúria das vagas na força dos remos. Ele lança uma pesada âncora de ferro forjado nas fendas de uma rocha submersa. Os ventos rugem e a proa balança, mas o barco não se desvia um palmo do seu refúgio.',
    moral: 'A fé no Deus soberano opera exatamente como essa âncora oculta: ela não impede a tempestade de soprar, mas nos mantém firmes sobre a Rocha eterna.',
    visualPrompt: 'Cena marítima dramática em estilo de pintura a óleo barroca chiaroscuro. Um feixe de luz dourada solene rompe as nuvens tempestuosas sobre o mar revolto, iluminando um pequeno barco de madeira firme ancorado a uma rocha invisível sob a superfície. Proporção 16:9, iluminação inspirada em Rembrandt, tons terrosos, azul profundo e âmbar.',
    visualStyle: 'Óleo Barroco Solene (Rembrandt)',
    aspectRatio: '16:9',
    colorTone: 'Tons Terrosos & Âmbar Sacro',
    createdAt: Date.now() - 3600000 * 24
  },
  {
    id: 'starter-2',
    title: 'A Aliança Inquebrável e o Arco nas Nuvens',
    type: 'bíblica',
    scripture: 'Gênesis 9:12-16',
    story: 'Após as águas do dilúvio submergirem a antiga terra corrompida, Noé e sua família pisaram o solo purificado em meio a um silêncio solene. Antes de qualquer conforto humano, ergueram um altar de pedras ao Senhor. Deus então desdobrou no firmamento lavado pelas chuvas o Seu arco celestial, declarando que Sua fidelidade pactual jamais seria cancelada pelas fraquezas humanas.',
    moral: 'As promessas de Deus repousam no Seu próprio caráter imutável; quando tudo ao redor parecer desmoronar, o arco da graça de Cristo continua resplandecendo sobre o crente.',
    visualPrompt: 'Composição bíblica monumental no estilo clássico de gravura sacra de Gustave Doré. O patriarca Noé em contemplação reverente diante de um altar de pedras fumegante em colina orvalhada, enquanto um arco-íris translúcido e majestoso atravessa o céu recém-aberto após a tormenta. Proporção 16:9, atmosfera sagrada, linhas ricas e solenes.',
    visualStyle: 'Gravura Sacra Antiga (Gustave Doré)',
    aspectRatio: '16:9',
    colorTone: 'Preto & Branco Solene / Tons Antigos',
    createdAt: Date.now() - 3600000 * 12
  },
  {
    id: 'starter-3',
    title: 'O Farol da Enseada e a Lâmpada do Vigia',
    type: 'histórica',
    scripture: 'Salmos 119:105',
    story: 'Na costa rochosa da Bretanha no século XIX, um violento tremor de terra quebrou o mecanismo giratório do farol principal durante uma noite de neblina espessa. O idoso guardião não se desesperou: reuniu lâmpadas de azeite manuais e permaneceu horas na torre fria alimentando a chama sem piscar, garantindo que os navios mercantes avistassem a linha do recife até o raiar da aurora.',
    moral: 'O testemunho da igreja local pode parecer modesto aos olhos dos grandes centros, mas a sua fidelidade contínua salva vidas do naufrágio espiritual.',
    visualPrompt: 'Pintura cinematográfica no estilo minimalismo editorial para projeção em púlpito. Uma torre de farol de granito escuro erguida sobre penhasco fustigado pelas ondas, com feixe de luz cálida e concentrada cortando a bruma noturna. Proporção 16:9, contraste alto, estética sóbria para telão de igreja.',
    visualStyle: 'Minimalismo Editorial & Púlpito',
    aspectRatio: '16:9',
    colorTone: 'Azul Noturno & Dourado Celestial',
    createdAt: Date.now() - 3600000 * 4
  },
  {
    id: 'starter-4',
    title: 'A Fortaleza dos Dois Portões',
    type: 'parabólica',
    scripture: 'Mateus 7:13-14',
    story: 'Em tempos remotos, um arquiteto real ergueu uma fortaleza inexpugnável no alto de uma escarpa com dois portões distintos: o Portão da Ostentação, largo e folheado a ouro reluzente, e o Portão da Humildade, estreito e talhado em rocha bruta. Durante o cerco inimigo, os nobres correram apressados para o portão dourado carregando seus baús de riqueza, apenas para descobrirem que sua largura facilitara a invasão das catapultas. Os peregrinos e simples que entraram pelo portão estreito e abandonaram suas cargas encontraram refúgio protegido nas câmaras mais profundas da rocha.',
    moral: 'O Reino de Deus não se abre aos que chegam inflados por sua justiça própria ou méritos terrenos. Apenas os que se despojam da soberba e entram pela porta estreita da cruz encontram segurança eterna sob o amparo do Rei.',
    visualPrompt: 'Composição alegórica monumental no estilo Gravura Sacra Antiga. Cidadela de pedra antiga no cume de monte escarpado, portão estreito de rocha talhada banhado por luz dourada suave, contraste límpido de atmosfera atemporal, proporção 16:9.',
    visualStyle: 'Gravura Sacra Antiga (Gustave Doré)',
    aspectRatio: '16:9',
    colorTone: 'Tons Terrosos & Âmbar Sacro',
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: 'starter-5',
    title: 'O Voo do Falcão e a Lei Invisível',
    type: 'natureza',
    scripture: 'Isaías 40:28-31',
    story: 'Na vastidão das estepes, os ornitólogos observam há séculos o voo soberano do falcão-peregrino, ave que atinge velocidades espantosas em mergulho sem quebrar suas asas delgadas. Mas o maior prodígio não está no bater vigoroso de suas penas, e sim na submissão instintiva às correntes térmicas invisíveis que sobem dos desfiladeiros: se a ave tentar subir na força de seus próprios músculos, ela despenca de cansaço. Ela foi desenhada para repousar no sopro do vento que não vê.',
    moral: 'Se o Criador governa as forças invisíveis da atmosfera para sustentar as aves do céu em seu voo arrojado, quanto mais sustentará os Seus filhos nas tempestades da existência? O crente não vive pela ansiedade do que vê, mas descansa no governo soberano do Deus que sustenta todas as coisas.',
    visualPrompt: 'Cena da natureza no estilo minimalista. Falcão majestoso de asas abertas planando em céu aberto sobre cânions dourados pela luz solar da tarde, sensação de grandeza cósmica e equilíbrio natural, proporção 16:9.',
    visualStyle: 'Minimalismo Editorial & Púlpito',
    aspectRatio: '16:9',
    colorTone: 'Tons Terrosos & Âmbar Sacro',
    createdAt: Date.now() - 3600000 * 1
  }
];

export const IllustrationGenerator: React.FC<IllustrationGeneratorProps> = ({ onSendToLaboratory }) => {
  // UI feedback and filter states
  const [filterType, setFilterType] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal & Generation states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    topic: string;
    type: VisualIllustration['type'];
    scripture: string;
    pastoralFocus: string;
    visualStyle: string;
    aspectRatio: '16:9' | '1:1' | '4:3' | '9:16';
  }>({
    topic: '',
    type: 'histórica',
    scripture: '',
    pastoralFocus: 'Fé e Confiança',
    visualStyle: 'Gravura Sacra Antiga (Gustave Doré)',
    aspectRatio: '16:9'
  });

  // Gallery state loaded from localStorage (safeguarded)
  const [illustrations, setIllustrations] = useState<VisualIllustration[]>(() => {
    try {
      const saved = localStorage.getItem('pastoral_visual_illustrations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler galeria de ilustrações:', e);
    }
    return STARTER_ILLUSTRATIONS;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pastoral_visual_illustrations', JSON.stringify(illustrations));
    } catch (e) {
      console.warn('Erro ao persistir galeria de ilustrações:', e);
    }
  }, [illustrations]);

  // Initial cloud synchronization (merge and backup)
  useEffect(() => {
    let isMounted = true;
    const initCloud = async () => {
      try {
        const cloudItems = await fetchIllustrationsFromCloud();
        if (isMounted && cloudItems.length > 0) {
          setIllustrations(prevLocal => {
            const localMap = new Map(prevLocal.map(item => [item.id || item.title, item]));
            let hasNew = false;
            cloudItems.forEach(cloudItem => {
              const key = cloudItem.id || cloudItem.title;
              if (!localMap.has(key)) {
                localMap.set(key, cloudItem);
                hasNew = true;
              }
            });
            if (hasNew) {
              return Array.from(localMap.values());
            }
            return prevLocal;
          });
        }
        // Mirror local illustrations to cloud
        await syncAllLocalIllustrationsToCloud(illustrations);
      } catch (err) {
        console.warn('Sincronização de ilustrações com Firestore offline ou indisponível:', err);
      }
    };
    initCloud();
    return () => { isMounted = false; };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2800);
  };

  const handleCopyStory = (item: VisualIllustration) => {
    const textToCopy = `*${item.title}*${item.scripture ? ` (${item.scripture})` : ''}\n\n${item.story}\n\n*Moral Pastoral:* ${item.moral}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedItemId(item.id || item.title);
    showToast('História da ilustração copiada com sucesso!');
    setTimeout(() => {
      setCopiedItemId(prev => prev === (item.id || item.title) ? null : prev);
    }, 2000);
  };

  const handleCopyPrompt = (item: VisualIllustration) => {
    const promptText = item.visualPrompt || `Cena homilética para pregação sobre "${item.title}". ${item.story} Estilo: ${item.visualStyle || 'Clássico'}. Proporção: ${item.aspectRatio || '16:9'}.`;
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(item.id || item.title);
    showToast('Prompt visual copiado para uso em projeção / IA!');
    setTimeout(() => {
      setCopiedPromptId(prev => prev === (item.id || item.title) ? null : prev);
    }, 2000);
  };

  const handleDelete = (id?: string, itemTitle?: string) => {
    if (!window.confirm(`Deseja realmente remover esta ilustração do acervo?`)) return;
    setIllustrations(prev => prev.filter(item => (item.id ? item.id !== id : item.title !== itemTitle)));
    if (id) {
      deleteIllustrationFromCloud(id).catch(err => {
        console.warn('[Cloud Delete Illustration] Falha ao excluir do Firestore:', err);
      });
    }
    showToast('Ilustração removida do acervo.');
  };

  // SOBER HOMILETICAL FALLBACK GENERATOR (Strictly adheres to oral sobriety, pulpit storytelling & Baptist theology)
  const generateFallback = (params: {
    topic: string;
    type: VisualIllustration['type'];
    scripture?: string;
    pastoralFocus?: string;
    visualStyle?: string;
    aspectRatio?: '16:9' | '1:1' | '4:3' | '9:16';
  }): VisualIllustration => {
    const { topic, type, scripture, pastoralFocus, visualStyle, aspectRatio } = params;
    const style = visualStyle || 'Gravura Sacra Antiga (Gustave Doré)';
    const ratio = aspectRatio || '16:9';
    const sc = scripture || (type === 'bíblica' ? 'Gênesis 12:1-4' : 'Salmos 37:5');

    let title = topic;
    let story = '';
    let moral = '';
    let visualPrompt = '';

    if (type === 'histórica') {
      title = `${topic}: A Chama que Não se Apaga`;
      story = `Numa pequena oficina gráfica clandestina do século XVI na Europa, um impressor artesanal passava as madrugadas compondo tipos móveis de chumbo para imprimir o texto bíblico na linguagem do povo comum. Sabia que a descoberta de sua prensa significaria a perda de seus bens e a condenação. Ao ser questionado sobre por que arriscava a vida por meras folhas de papel, ele apenas apontou para o texto aberto e respondeu: 'Os homens deste século passarão; a Palavra do nosso Deus permanece para sempre'.`;
      moral = `O testemunho e o sacrifício de servos fiéis do passado nos lembram de que a verdade do Evangelho não é herança negociável, mas tesouro sagrado a ser guardado e proclamado com santa coragem no púlpito e na vida.`;
      visualPrompt = `Cena de oficina antiga no estilo ${style}. Uma mesa de carvalho rústica iluminada pela luz dourada de uma lamparina de azeite, tipos de imprensa móveis e fólios com texto bíblico antigo, contraste de sombras profundas, atmosfera solene, proporção ${ratio}.`;
    } else if (type === 'parabólica') {
      title = `${topic}: A Fortaleza dos Dois Portões`;
      story = `Em tempos remotos, um arquiteto real ergueu uma fortaleza inexpugnável no alto de uma escarpa com dois portões distintos: o Portão da Ostentação, largo e folheado a ouro reluzente, e o Portão da Humildade, estreito e talhado em rocha bruta. Durante o cerco inimigo, os nobres correram apressados para o portão dourado carregando seus baús de riqueza, apenas para descobrirem que sua largura facilitara a invasão das catapultas. Os peregrinos e simples que entraram pelo portão estreito e abandonaram suas cargas encontraram refúgio protegido nas câmaras mais profundas da rocha.`;
      moral = `O Reino de Deus não se abre aos que chegam inflados por sua justiça própria ou méritos terrenos. Apenas os que se despojam da soberba e entram pela porta estreita da cruz encontram segurança eterna sob o amparo do Rei.`;
      visualPrompt = `Composição alegórica monumental no estilo ${style}. Cidadela de pedra antiga no cume de monte escarpado, portão estreito de rocha talhada banhado por luz dourada suave, contraste límpido de atmosfera atemporal, proporção ${ratio}.`;
    } else if (type === 'natureza') {
      title = `${topic}: O Voo do Falcão e a Lei Invisível`;
      story = `Na vastidão das estepes, os ornitólogos observam há séculos o voo do falcão-peregrino, ave capaz de despencar dos céus a mais de trezentos quilômetros por hora em busca de seu alvo sem perder a precisão milimétrica de suas asas. Mas o mistério não reside na velocidade vertiginosa, e sim na obediência instintiva às correntes térmicas invisíveis que o sustentam: se a ave tentar voar contra o fluxo de sustentação unicamente na força de suas penas, seus músculos entram em colapso. Ela é desenhada para repousar no vento que não vê.`;
      moral = `Se o Criador governa as forças invisíveis da atmosfera para sustentar as aves do céu em seu voo arrojado, quanto mais sustentará os Seus filhos nas tempestades da existência? O crente não vive pela ansiedade do que vê, mas descansa no governo soberano do Deus que sustenta todas as coisas.`;
      visualPrompt = `Cena da natureza no estilo ${style}. Falcão majestoso de asas abertas planando em céu aberto sobre cânions dourados pela luz solar da tarde, sensação de grandeza cósmica e equilíbrio natural, proporção ${ratio}.`;
    } else if (type === 'bíblica') {
      title = topic.toLowerCase().includes('fé') ? topic : `${topic}: A Jornada da Fé e da Promessa`;
      story = `Quando o patriarca ouviu a voz de Deus ordenando que deixasse a segurança de sua parentela rumo a uma terra desconhecida (${sc}), ele não possuía mapas ou alianças humanas de proteção. Tinha unicamente a palavra do Criador. Sob as noites caladas do deserto, contemplando a imensidão do firmamento estrelado, ele aprendeu que o solo mais firme para os passos do crente é a fidelidade daquele que prometeu.`;
      moral = `A mensagem bíblica não nos convoca a decifrar todas as curvas do amanhã com ansiedade, mas a repousar o coração na soberania de quem governa a história. A fé caminha com os olhos postos na promessa de Deus.`;
      visualPrompt = `Composição bíblica monumental no estilo ${style}. Figura solitária em manto sóbrio de peregrino contemplando um céu noturno límpido salpicado de estrelas no deserto pedregoso da Antiguidade, iluminação solene chiaroscuro com tons de âmbar e azul profundo, proporção ${ratio}.`;
    } else if (type === 'pastoral') {
      title = `${topic}: O Resgate do Bom Pastor`;
      story = `Nas montanhas escarpadas do Oriente, quando uma ovelha se desgarra e cai em uma fenda de espinhos entre as rochas, seus movimentos desesperados só aumentam a dor e o sangramento. O pastor que conhece cada membro do rebanho não se aproxima com gritos ásperos ou cajadadas de ira. Ele apoia o cajado firme na pedra, dobra os joelhos na poeira, desenlaça com dedos firmes e pacientes as pontas agudas e deita a ovelha machucada sobre os próprios ombros para o retorno ao aprisco.`;
      moral = `O Senhor Jesus não nos acolhe com acusação moralista fria, mas com a graça curadora de Sua compaixão. Onde abundou a nossa fraqueza, muito mais superabunda a ternura do Seu cuidado pastoral.`;
      visualPrompt = `Cena pastoral solene no estilo ${style}. O Bom Pastor inclinado com afeto sobre rocha escarpada no crepúsculo, resgatando com cuidado paciente uma ovelha cansada com seu cajado de madeira rústica, proporção ${ratio}, iluminação suave e tons terrosos acolhedores.`;
    } else if (type === 'evangelística') {
      title = `${topic}: O Farol e a Mão Estendida`;
      story = `Num vilarejo costeiro açoitado por ventos gelados, um pescador veterano percebeu que uma embarcação desgovernada rumava diretamente para os recifes submersos na escuridão. Sem hesitar, ele reuniu dois companheiros, lançou uma baleeira leve nas águas violentas e alcançou os tripulantes a poucos metros do desastre. Ao alcançarem a areia da praia, um dos náufragos, trêmulo de frio, perguntou por que ele arriscara a própria integridade por homens que sequer conhecia. O velho marinheiro limitou-se a dizer: 'Nenhum irmão deve afundar quando há uma mão pronta para segurar'.`;
      moral = `O Filho de Deus desceu à tempestade do mundo para resgatar quem estava irremediavelmente perdido. O apelo do Evangelho é direto: abandone a ilusão de autossuficiência e acolha hoje o abraço do Salvador.`;
      visualPrompt = `Cena marítima de alto impacto no estilo ${style}. Barco de salvamento enfrentando águas revoltas na penumbra costeira, lanterna náutica de latão projetando luz cálida sobre a proa e feixe celestial rompendo nuvens tempestuosas, proporção ${ratio}.`;
    } else {
      // cotidiano
      title = `${topic}: A Semeadura Silenciosa e a Paciência do Lavrador`;
      story = `Um agricultor experiente deposita sementes no solo escuro da lavoura antes das primeiras chuvas da estação. Durante semanas a fio, quem olha para a superfície não enxerga nenhuma alteração. Mas ele não remove a terra todos os dias para conferir se a raiz brotou; ele sabe que o milagre da vida acontece em silêncio nas profundezas antes de romper a crosta e desabrochar em espigas verdes de trigo ao sol.`;
      moral = `Na economia da graça, Deus opera com paciência sábia e invisível. O labor honesto da oração, da integridade e do discipulado no lar e no trabalho nem sempre oferece resultados imediatos para os olhos humanos, mas a colheita virá no tempo perfeito do Pai.`;
      visualPrompt = `Cena campestre contemplativa no estilo ${style}. Campo arado sob a luz suave de uma alvorada dourada, mãos calejadas de lavrador soltando grãos de semente sobre a terra preta fértil, linhas de perspectiva limpas, proporção ${ratio}.`;
    }

    return {
      id: `ill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      type,
      scripture: sc,
      story,
      moral,
      visualPrompt,
      visualStyle: style,
      aspectRatio: ratio,
      colorTone: 'Tons Terrosos & Âmbar Sacro',
      createdAt: Date.now()
    };
  };

  // Submissão do modal de criação
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic.trim()) {
      showToast('Por favor, informe o tema ou assunto da ilustração.');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/gemini/generate-illustrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: formData.topic.trim(),
          type: formData.type,
          scripture: formData.scripture.trim() || undefined,
          pastoralFocus: formData.pastoralFocus,
          visualStyle: formData.visualStyle,
          aspectRatio: formData.aspectRatio
        })
      });

      let createdIll: VisualIllustration | null = null;

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.illustrations) && data.illustrations.length > 0) {
          const first = data.illustrations[0];
          createdIll = {
            id: `ill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: first.title || formData.topic.trim(),
            type: (first.type || formData.type) as VisualIllustration['type'],
            scripture: first.scripture || formData.scripture.trim() || undefined,
            story: first.story,
            moral: first.moral,
            visualPrompt: first.visualPrompt,
            visualStyle: first.visualStyle || formData.visualStyle,
            aspectRatio: (first.aspectRatio || formData.aspectRatio) as VisualIllustration['aspectRatio'],
            colorTone: 'Tons Terrosos & Âmbar Sacro',
            createdAt: Date.now()
          };
        }
      }

      if (!createdIll) {
        createdIll = generateFallback({
          topic: formData.topic.trim(),
          type: formData.type,
          scripture: formData.scripture.trim() || undefined,
          pastoralFocus: formData.pastoralFocus,
          visualStyle: formData.visualStyle,
          aspectRatio: formData.aspectRatio
        });
      }

      // Prepend to illustrations list
      setIllustrations(prev => [createdIll!, ...prev]);

      // Mirror to Firestore
      saveIllustrationToCloud(createdIll).catch(err => {
        console.warn('[Firestore] Falha ao espelhar nova ilustração na nuvem:', err);
      });

      showToast('Nova ilustração criada e adicionada ao acervo!');
      setIsCreateModalOpen(false);
      // Reset form fields
      setFormData({
        topic: '',
        type: 'bíblica',
        scripture: '',
        pastoralFocus: 'Fé e Confiança',
        visualStyle: 'Gravura Sacra Antiga (Gustave Doré)',
        aspectRatio: '16:9'
      });
    } catch (err) {
      console.warn('Erro ao conectar com API de ilustrações, acionando contingência local:', err);
      const fallbackIll = generateFallback({
        topic: formData.topic.trim(),
        type: formData.type,
        scripture: formData.scripture.trim() || undefined,
        pastoralFocus: formData.pastoralFocus,
        visualStyle: formData.visualStyle,
        aspectRatio: formData.aspectRatio
      });
      setIllustrations(prev => [fallbackIll, ...prev]);
      saveIllustrationToCloud(fallbackIll).catch(() => {});
      showToast('Ilustração gerada com sucesso via contingência homilética!');
      setIsCreateModalOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered list
  const filteredList = illustrations.filter(item => {
    const matchesCategory = filterType === 'todos' || item.type === filterType;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      item.title.toLowerCase().includes(q) || 
      item.story.toLowerCase().includes(q) || 
      item.moral.toLowerCase().includes(q) ||
      Boolean(item.scripture && item.scripture.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-16 text-left">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2D2926] text-white px-4 py-3 rounded-xl shadow-xl border border-[#5A5A40]/40 flex items-center gap-2.5 animate-fade-in text-xs font-medium">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal: Criar Nova Ilustração Narrativa para Púlpito */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E6E2DA] shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-scale-in text-left my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E6E2DA]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#E6E2DA] text-[#5A5A40]">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#2D2926] leading-snug">
                    Criar Nova Ilustração Narrativa para Púlpito
                  </h3>
                  <p className="text-xs text-gray-500">
                    Componha histórias, metáforas e prompts visuais prontos para o púlpito
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isGenerating && setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-[#2D2926] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              {/* Tema ou Assunto */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2D2926]">
                  Assunto ou Tema da Mensagem <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.topic}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="Ex: A Fiel Provisão de Deus no Deserto, O Peso da Culpa e o Perdão..."
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2D2926]"
                />
              </div>

              {/* Grid 2 colunas: Categoria & Passagem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Categoria Homilética */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2D2926]">
                    Categoria Homilética
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      type: e.target.value as VisualIllustration['type'] 
                    }))}
                    className="w-full px-3 py-2 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2D2926] capitalize"
                  >
                    <option value="histórica">Histórica (Mártires, Reforma, Biografias)</option>
                    <option value="cotidiano">Cotidiana (Lar, Trabalho, Vida Moderna)</option>
                    <option value="parabólica">Ficção / Parabólica (Alegorias & Parábolas)</option>
                    <option value="natureza">Científica / Natureza (Criação & Leis Naturais)</option>
                    <option value="bíblica">Bíblica (Alianças & Narrativas)</option>
                    <option value="pastoral">Pastoral (Cuidado & Consolo)</option>
                    <option value="evangelística">Evangelística (Resgate & Chamado)</option>
                  </select>
                </div>

                {/* Passagem Bíblica de Apoio */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2D2926] flex items-center justify-between">
                    <span>Passagem Bíblica</span>
                    <span className="text-[10px] text-gray-400 font-normal">Opcional</span>
                  </label>
                  <div className="relative">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={formData.scripture}
                      onChange={(e) => setFormData(prev => ({ ...prev, scripture: e.target.value }))}
                      placeholder="Ex: Êxodo 16:1-36, Rm 8:28..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2D2926]"
                    />
                  </div>
                </div>

              </div>

              {/* Foco Pastoral / Aplicação */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2D2926]">
                  Foco Pastoral / Aplicação Principal
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Consolo', 
                    'Fé e Confiança', 
                    'Exortação', 
                    'Perseverança', 
                    'Arrependimento', 
                    'Gratidão'
                  ].map(foco => (
                    <button
                      type="button"
                      key={foco}
                      onClick={() => setFormData(prev => ({ ...prev, pastoralFocus: foco }))}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                        formData.pastoralFocus === foco 
                          ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                          : 'bg-[#FAF6EE] text-gray-600 border-[#E6E2DA] hover:bg-white'
                      }`}
                    >
                      {foco}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estilo Visual da Cena & Proporção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2D2926]">
                    Estilo Visual para Telão / IA
                  </label>
                  <select
                    value={formData.visualStyle}
                    onChange={(e) => setFormData(prev => ({ ...prev, visualStyle: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2D2926]"
                  >
                    <option value="Gravura Sacra Antiga (Gustave Doré)">Gravura Sacra Antiga (Gustave Doré)</option>
                    <option value="Óleo Barroco Solene (Rembrandt)">Óleo Barroco Solene (Rembrandt)</option>
                    <option value="Minimalismo Editorial & Púlpito">Minimalismo Editorial & Púlpito</option>
                    <option value="Aquarela Sacra Clássica">Aquarela Sacra Clássica</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2D2926]">
                    Proporção de Imagem
                  </label>
                  <select
                    value={formData.aspectRatio}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      aspectRatio: e.target.value as VisualIllustration['aspectRatio'] 
                    }))}
                    className="w-full px-3 py-2 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2D2926]"
                  >
                    <option value="16:9">16:9 (Widescreen / Telão Padrão)</option>
                    <option value="4:3">4:3 (Projeção Clássica)</option>
                    <option value="1:1">1:1 (Quadrado / Boletim)</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-[#E6E2DA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 border border-[#E6E2DA] rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !formData.topic.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#5A5A40] hover:bg-[#2D2926] disabled:opacity-50 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                      <span>Compondo Ilustração...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Gerar Nova Ilustração</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Protagonist: Gallery Section */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#E6E2DA] shadow-sm space-y-6">
        
        {/* Gallery Controls Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-[#E6E2DA]">
          
          {/* Title on single line, count badge & prominent creation button */}
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif font-bold text-xl text-[#2D2926] whitespace-nowrap flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#5A5A40] shrink-0" />
              <span className="whitespace-nowrap">Galeria de Ilustrações Homiléticas</span>
            </h2>
            <span className="px-3 py-1 bg-[#FAF6EE] border border-[#E6E2DA] rounded-lg text-xs font-mono font-semibold text-[#5A5A40] whitespace-nowrap">
              {illustrations.length} no Acervo
            </span>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-[#5A5A40] hover:bg-[#2D2926] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap"
              title="Criar nova história ou argumento homilético"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Gerar Nova Ilustração</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por tema, texto..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF6EE] border border-[#E6E2DA] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5A5A40] w-full sm:w-48 text-[#2D2926]"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {(['todos', 'histórica', 'cotidiano', 'parabólica', 'natureza', 'bíblica', 'pastoral', 'evangelística'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterType(cat)}
                  className={`text-[11px] px-3 py-1 rounded-full capitalize whitespace-nowrap transition-all border font-medium cursor-pointer ${
                    filterType === cat 
                      ? 'bg-[#5A5A40] text-white border-[#5A5A40]' 
                      : 'bg-white text-gray-600 hover:bg-gray-50 border-[#E6E2DA]'
                  }`}
                >
                  {cat === 'cotidiano' ? 'Cotidiana' : cat === 'parabólica' ? 'Parabólica' : cat === 'natureza' ? 'Natureza/Ciência' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredList.length === 0 ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-[#E6E2DA] rounded-xl space-y-3">
            <Palette className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-serif font-semibold text-gray-600">Nenhuma ilustração encontrada com os filtros selecionados.</p>
            <p className="text-xs text-gray-400">Tente ajustar o termo de busca ou selecionar outra categoria acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredList.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="bg-[#FAF6EE]/70 rounded-2xl border border-[#E6E2DA] p-6 space-y-4 flex flex-col justify-between hover:shadow-md transition-all relative group"
              >
                <div className="space-y-3.5">
                  
                  {/* Card Badges & Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-[#5A5A40] text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {item.type}
                      </span>
                      {item.scripture && (
                        <span className="bg-white text-[#5A5A40] border border-[#E6E2DA] px-2 py-0.5 rounded-md font-mono font-semibold">
                          {item.scripture}
                        </span>
                      )}
                      <span className="bg-white/80 text-gray-500 border border-[#E6E2DA] px-2 py-0.5 rounded-md font-sans">
                        {item.aspectRatio || '16:9'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                      title="Remover do acervo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif font-bold text-lg text-[#2D2926] leading-snug">
                    {item.title}
                  </h3>

                  {/* Card Action Buttons - Reallocated directly below the title */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-1">
                    <button
                      onClick={() => handleCopyStory(item)}
                      className="bg-white hover:bg-gray-100 text-[#2D2926] border border-[#E6E2DA] py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="Copiar a narrativa oral e lição pastoral"
                    >
                      {copiedItemId === (item.id || item.title) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Narrativa Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-gray-500" />
                          <span>Copiar Narrativa Oral</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCopyPrompt(item)}
                      className="bg-[#2D2926] hover:bg-black text-[#FAF6EE] py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      title="Copiar prompt visual para projeção em telão / IA"
                    >
                      {copiedPromptId === (item.id || item.title) ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Prompt Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Monitor className="w-3.5 h-3.5 text-amber-300" />
                          <span>Copiar Prompt Visual</span>
                        </>
                      )}
                    </button>

                    {onSendToLaboratory && (
                      <button
                        onClick={() => onSendToLaboratory({
                          title: item.title,
                          story: item.story,
                          moral: item.moral,
                          scripture: item.scripture,
                          visualPrompt: item.visualPrompt
                        })}
                        className="bg-[#5A5A40] hover:bg-[#2D2926] text-white py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Injeta esta ilustração no sermão do Laboratório"
                      >
                        <Feather className="w-3.5 h-3.5 text-amber-300" />
                        <span>Usar no Laboratório</span>
                      </button>
                    )}
                  </div>

                  {/* Visual Scene Preview Box */}
                  <div className="bg-[#2D2926] text-[#E6E2DA] rounded-xl p-3.5 border border-[#5A5A40]/30 space-y-1.5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[10px] text-[#E6E2DA]/70 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Monitor className="w-3 h-3 text-amber-400" />
                        Composição para Projeção ({item.visualStyle || 'Estilo Clássico'})
                      </span>
                      <span className="text-amber-300 font-semibold">{item.aspectRatio || '16:9'}</span>
                    </div>

                    <p className="text-xs text-gray-300 font-sans italic leading-relaxed line-clamp-3">
                      "{item.visualPrompt || `Cena homilética para pregação sobre ${item.title}. Iluminação solene e estética sacra.`}"
                    </p>
                  </div>

                  {/* Oral Narrative Story */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-sans">
                      Narrativa Oral para o Púlpito:
                    </span>
                    <p className="text-xs text-[#2D2926] leading-relaxed font-serif text-justify bg-white/70 p-3.5 rounded-xl border border-[#E6E2DA]/60">
                      "{item.story}"
                    </p>
                  </div>

                  {/* Moral / Pastoral Lesson */}
                  <div className="bg-amber-500/10 border-l-3 border-[#5A5A40] p-3 rounded-r-lg text-xs text-[#2D2926] space-y-0.5">
                    <strong className="block text-[10px] font-bold uppercase tracking-wider text-[#5A5A40]">
                      Moral & Lição Homilética:
                    </strong>
                    <p className="italic text-gray-700 leading-snug">{item.moral}</p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
};

