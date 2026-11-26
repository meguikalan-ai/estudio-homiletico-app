/**
 * Utilitário de requisições de API resiliente para o AI Studio / Cloud Run.
 * - Suporta retry automático com backoff exponencial para falhas de rede transitórias ('Failed to fetch').
 * - Timeout configurável via AbortController para evitar requisições presas.
 * - Não usa window.alert.
 */

export interface SafeApiOptions {
  retries?: number;
  timeoutMs?: number;
  delayMs?: number;
}

/**
 * Executa uma chamada POST para endpoints locais do Express (/api/...)
 * com proteção contra falhas momentâneas de rede ou reinício de dev server.
 */
export async function safeApiPost<T = unknown>(
  url: string,
  payload: unknown,
  options: SafeApiOptions = {}
): Promise<T> {
  const { retries = 1, timeoutMs = 165000, delayMs = 1200 } = options;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 0) {
        console.warn(`[safeApiPost] Retentando conexão com ${url} (tentativa ${attempt + 1}/${retries + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {}
        const httpErr = new Error(`HTTP ${response.status}: ${errBody || response.statusText}`) as Error & {
          status?: number;
        };
        httpErr.status = response.status;
        throw httpErr;
      }

      const data = await response.json();
      return data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) {
        const timeoutSeconds = Math.round(timeoutMs / 1000);
        const timeoutErr = new Error(
          `Tempo limite de conexão atingido após ${timeoutSeconds}s.`
        );
        timeoutErr.name = 'TimeoutError';
        console.warn(`[safeApiPost] Timeout na chamada para ${url} após ${timeoutSeconds}s (sem retentativa automática).`);
        throw timeoutErr;
      }

      lastError = err;
      console.warn(`[safeApiPost] Falha na tentativa ${attempt + 1} para ${url}:`, err);

      const status = (err as { status?: number })?.status;
      const errMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      const isTransientHttp = status === 502 || status === 503 || status === 504;
      const isTransientNetwork =
        (err instanceof TypeError && (errMsg.includes('fetch') || errMsg.includes('network'))) ||
        errMsg.includes('failed to fetch') ||
        errMsg.includes('networkerror') ||
        errMsg.includes('econnreset');

      if (!isTransientHttp && !isTransientNetwork) {
        break;
      }
    }
  }

  throw lastError || new Error(`Falha de conexão com ${url}`);
}

/**
 * Gerador de emergência local para contingência offline.
 * Se a rede ou o servidor de IA estiverem completamente inacessíveis,
 * gera um sermão expositivo estruturado sem travar a aplicação.
 */
export function buildClientFallbackSermon(params: {
  title?: string;
  theme?: string;
  scripture: string;
  style?: string;
  churchProfile?: string;
  audience?: string;
  bibleVersion?: string;
  duration?: string;
  seriesName?: string;
  derivationMode?:
    | 'duration'
    | 'bible-study'
    | 'devotional'
    | 'pulpit-card'
    | 'ebd'
    | 'catechetical'
    | 'evangelistic'
    | 'counseling'
    | 'post-service'
    | 'custom';
}) {
  const cleanScripture = params.scripture || 'Passagem Bíblica';
  const rawBaseTitle = (params.title || `A Glória da Graça em ${cleanScripture}`)
    .replace(/^(título|titulo|title|sermão|sermao|devocional|cartão de púlpito|lição ebd|estudo catequético|roteiro evangelístico|aconselhamento|discipulado|resumo pós-culto|estudo bíblico)\s*[:\-]?\s*/i, '')
    .trim();
  const mode = params.derivationMode || 'duration';
  const isBibleStudy = mode === 'bible-study';

  const prefixByMode: Record<string, string> = {
    'bible-study': 'Estudo Bíblico: ',
    devotional: 'Devocional: ',
    'pulpit-card': 'Cartão de Púlpito: ',
    ebd: 'Lição EBD: ',
    catechetical: 'Estudo Catequético: ',
    evangelistic: 'Mensagem Evangelística: ',
    counseling: 'Aconselhamento 1-a-1: ',
    'post-service': 'Resumo Pós-Culto: '
  };

  const modePrefix = prefixByMode[mode] || '';
  const cleanTitle = modePrefix && !rawBaseTitle.toLowerCase().startsWith(modePrefix.toLowerCase().replace(':', ''))
    ? `${modePrefix}${rawBaseTitle}`
    : rawBaseTitle;
  const cleanTheme = params.theme || 'Fidelidade e Soberania de Deus';

  const pointAppSuffix =
    mode === 'bible-study'
      ? '\n\nPergunta para Discussão em Grupo: Como esta verdade bíblica confronta nossa rotina semanal e de que forma podemos apoiar uns aos outros em oração nesta área?'
      : mode === 'ebd'
      ? '\n\nPergunta para a Classe: De que maneira este ensino bíblico corrige visões distorcidas de hoje?\n\nGuia de Resposta para o Professor: Conduza a turma a identificar a autoridade do texto e a dependência prática da graça de Cristo.'
      : mode === 'counseling'
      ? '\n\nPasso Prático da Semana: Anote uma situação concreta em que esta verdade precisa substituir a ansiedade ou a autossuficiência nesta semana e ore sobre ela diariamente.'
      : mode === 'post-service'
      ? '\n\nMeditação da Semana: Releia este texto em casa e agradeça a Deus por Sua fidelidade concreta neste ponto.'
      : '';

  const introByMode: Record<string, string> = {
    'bible-study': `Ao nos reunirmos como grupo para estudar ${cleanScripture}, somos convidados a ir além de uma leitura superficial e permitir que a Palavra de Deus molde nossas conversas, decisões e comunhão cristã. Que este roteiro desperte diálogo honesto, arrependimento sincero e encorajamento mútuo na graça do Senhor.`,
    devotional: `Em meio à correria dos dias, ${cleanScripture} nos chama a parar por alguns minutos e alinhar o coração diante do Deus vivo. Uma única verdade deste texto basta para sustentar nossa mente e renovar nossa esperança hoje.`,
    'pulpit-card': `Tese central em ${cleanScripture}: Deus sustenta, confronta e redime o coração humano pela suficiência da Sua Palavra e da obra de Cristo.`,
    ebd: `Objetivo Pedagógico da Lição: Compreender o ensino central de ${cleanScripture}, discernir seu contexto histórico-doutrinário e aplicar seus princípios à maturidade cristã da igreja local.`,
    catechetical: `Propósito Catequético: Instruir a igreja de forma clara e memorizável nas doutrinas bíblicas que emergem de ${cleanScripture}, firmando a fé cristã por meio de perguntas e respostas fundamentadas nas Escrituras.`,
    evangelistic: `Todo ser humano busca descanso para a consciência e sentido para a própria existência, mas frequentemente procura em fontes que não sustentam o peso da alma. Em ${cleanScripture}, o próprio Deus vem ao nosso encontro com verdade, perdão e vida nova em Jesus Cristo.`,
    counseling: `Quando o coração enfrenta cansaço, culpa ou incerteza, não precisamos de frases vazias, mas do consolo firme e honesto das Escrituras. Em ${cleanScripture}, o Senhor nos acolhe com verdade para diagnosticar nossas lutas e restaurar nossa esperança.`,
    'post-service': `Neste último encontro, meditamos em ${cleanScripture} sob o tema "${cleanTheme}". Este resumo reúne os pontos centrais da mensagem para fortalecer sua caminhada devocional de segunda a sábado.`
  };

  const appealByMode: Record<string, string> = {
    'bible-study': `Encerrem este momento em oração mútua, compartilhando brevemente um pedido concreto ligado à mensagem de ${cleanScripture} e encorajando uns aos outros na graça de Cristo.`,
    devotional: `Oração Final: Senhor, grava a verdade de ${cleanScripture} em nosso coração hoje. Livra-nos da pressa vazia, ensina-nos a confiar em Tua graça e conduz nossos passos em fidelidade. Em nome de Jesus, amém.`,
    'pulpit-card': `Convite final direto: Confronto com a suficiência da graça • Chamado ao arrependimento sincero • Descanso na fidelidade do Cordeiro.`,
    ebd: `Desafio da Classe: Durante a semana, releia ${cleanScripture} em família e observe uma oportunidade prática de viver a doutrina estudada hoje.`,
    catechetical: `Confissão e Firmeza Doutrinária: Que a sã doutrina de ${cleanScripture} não permaneça apenas no intelecto, mas molde a nossa adoração, firme a nossa esperança em Cristo e guarde a igreja de todo erro.`,
    evangelistic: `Hoje você não precisa carregar suas culpas sozinho nem tentar merecer o favor de Deus por esforço próprio. Volte-se para Jesus Cristo com sinceridade, reconheça Sua graça e receba hoje o perdão e a vida eterna que Ele oferece.`,
    counseling: `Oração de Acompanhamento: Peça a Deus lucidez para enxergar o coração sem máscaras e coragem para dar o próximo passo de obediência nesta semana, sabendo que Cristo caminha com você.`,
    'post-service': `Leve esta palavra para sua casa e seu trabalho nesta semana: Aquele que prometeu em ${cleanScripture} é fiel para sustentar cada passo da sua jornada.`
  };

  const applicationsByMode: Record<string, string[]> = {
    'bible-study': [
      'Compartilhar no grupo uma área prática em que esta verdade bíblica traz alívio ou confronto esta semana.',
      'Orar uns pelos outros buscando obediência sincera à Palavra.',
      'Reler a passagem em casa com a família antes do próximo encontro.'
    ],
    ebd: [
      'Fixar a ideia central e os termos-chave expostos na lição.',
      'Relacionar a passagem com o conjunto das Escrituras (AT e NT).',
      'Praticar no lar e na igreja local o princípio bíblico ensinado.'
    ],
    catechetical: [
      'A revelação das Escrituras é suficiente, clara e normativa para toda fé e prática cristã (2 Tm 3.16-17).',
      'A salvação procede inteiramente da graça soberana de Deus mediante a fé em Jesus Cristo (Ef 2.8-9).',
      'A verdadeira fé persevera em santidade, amor e fidelidade à igreja local até o fim (Fp 1.6).'
    ],
    counseling: [
      'Identificar pensamentos ou reações que precisam ser confrontados pela Palavra nesta semana.',
      'Praticar diariamente um tempo breve de leitura e oração sincera sobre esta passagem.',
      'Retomar na próxima conversa os avanços e desafios observados.'
    ],
    'post-service': [
      'Segunda-feira: Releia o texto bíblico completo com calma e ore pedindo discernimento.',
      'Terça-feira: Identifique uma atitude no lar ou no trabalho que precisa refletir esta verdade.',
      'Quarta-feira: Ore por um irmão da igreja e por alguém que ainda não conhece a Cristo.',
      'Quinta-feira: Substitua uma preocupação recorrente por uma promessa desta passagem.',
      'Sexta-feira: Prepare seu coração em gratidão para adorar com a igreja no domingo.'
    ]
  };

  const tagsByMode: Record<string, string[]> = {
    'bible-study': ['Estudo Bíblico', 'Pequeno Grupo', 'Exposição Bíblica', 'Discipulado'],
    devotional: ['Devocional', 'Meditação Bíblica', 'Vida Cristã'],
    'pulpit-card': ['Cartão de Púlpito', 'Esboço', 'Pregação Expositiva'],
    ebd: ['EBD', 'Ensino Bíblico', 'Doutrina', 'Discipulado'],
    catechetical: ['Estudo Catequético', 'Perguntas e Respostas', 'Doutrina Bíblica'],
    evangelistic: ['Evangelístico', 'Boas Novas', 'Graça Soberana'],
    counseling: ['Aconselhamento', 'Discipulado', 'Cuidado Pastoral'],
    'post-service': ['Pós-Culto', 'Boletim', 'Meditação Semanal']
  };

  const allPoints = [
    {
      title: 'I. A Soberania da Revelação Divina',
      precedingTransition: 'A primeira verdade que emerge com nitidez desta passagem bíblica é a soberania da revelação divina sobre as incertezas humanas.',
      explanation: mode === 'pulpit-card'
        ? '• Âncora: Deus toma a iniciativa de falar com clareza pela Sua Palavra.\n• Referências: Salmos 119.105 • 2 Timóteo 3.16-17 • João 1.14 (Verbo encarnado).'
        : mode === 'catechetical'
        ? 'Pergunta: Como Deus se dá a conhecer ao Seu povo segundo o ensino das Escrituras?\nResposta: Deus toma a iniciativa soberana de revelar Sua vontade e Seu caráter por meio das Sagradas Escrituras, que são inspiradas, infalíveis e suficientes para toda a vida cristã (Salmos 119.105; 2 Timóteo 3.16-17).\n\nPergunta: Quem é o centro e a plenitude de toda a revelação bíblica?\nResposta: Jesus Cristo, o Verbo encarnado (João 1.14), em quem todas as promessas de Deus encontram o seu cumprimento perfeito.'
        : 'A passagem nos convoca a uma escuta reverente da autoridade das Escrituras, ressaltando que Deus toma a iniciativa de se comunicar com a Sua criação através da verdade eterna e infalível.\n\nEssa verdade é confirmada em Salmos 119.105 e 2 Timóteo 3.16-17, que atestam a suficiência e a clareza da revelação bíblica. Toda a revelação divina converge e se cumpre na pessoa de Jesus Cristo, o Verbo encarnado (João 1.14), nosso supremo Pastor e Senhor.',
      illustration: mode === 'devotional' || mode === 'pulpit-card' || mode === 'catechetical'
        ? undefined
        : {
            type: 'cotidiano' as const,
            description: 'Assim como um viajante em noite escura precisa de um farol seguro para não naufragar nos recifes, a alma humana encontra na verdade bíblica o rumo fixo e imutável que nenhuma bússola terrena pode oferecer.'
          },
      application: mode === 'catechetical'
        ? 'Uso Doutrinário e Prático: Esta doutrina protege a igreja do subjetivismo e das opiniões passageiras, firmando nossa consciência na autoridade final da Palavra de Deus.'
        : `Em meio aos ruídos da rotina e às pressões do trabalho ou do lar, onde você tem buscado direção? Reserve espaço real para ouvir a voz soberana de Deus nas Escrituras com sinceridade.${pointAppSuffix}`
    },
    {
      title: 'II. O Resgate Redentor e a Suficiência da Graça',
      precedingTransition: 'Firmados nessa primeira verdade, a revelação bíblica avança para o resgate redentor e a suficiência da graça.',
      explanation: mode === 'pulpit-card'
        ? '• Âncora: O perdão não nasce do mérito humano, mas da graça na cruz.\n• Referências: Romanos 5.8 • Efésios 2.8-9 • Números 21 / João 3.'
        : mode === 'catechetical'
        ? 'Pergunta: Pode o ser humano alcançar o perdão de Deus por suas próprias obras ou méritos?\nResposta: Não. Por causa do pecado, todos carecemos da glória de Deus e somos totalmente incapazes de justificar a nós mesmos diante da Sua santidade (Efésios 2.8-9).\n\nPergunta: De que maneira Deus providenciou a nossa redenção?\nResposta: Pela morte substitutiva de Jesus Cristo na cruz, que satisfez perfeitamente a justiça divina e garantiu a justificação gratuita aos que nEle creem (Romanos 5.8; João 3.14-16).'
        : 'O texto evidencia a incapacidade humana de salvar a si mesma por obras ou ritos externos, demonstrando que o perdão e a reconciliação brotam do favor soberano e gracioso do Senhor.\n\nEssa proclamação ecoa com força em Romanos 5.8 e Efésios 2.8-9 sobre o dom imerecido da vida eterna. É na cruz do Calvário que o Cordeiro de Deus tomou sobre Si a nossa condenação, satisfazendo a justiça do Pai e nos declarando justificados.',
      illustration: mode === 'devotional' || mode === 'pulpit-card' || mode === 'catechetical'
        ? undefined
        : {
            type: 'bíblica' as const,
            description: 'Recordamos a narrativa da serpente de bronze no deserto (Números 21), resgatada por Jesus em João 3: os feridos pelo pecado não podiam curar a si mesmos; bastava olhar com fé para o socorro levantado por Deus.'
          },
      application: mode === 'catechetical'
        ? 'Uso Doutrinário e Prático: Ao firmar o coração na suficiência da cruz, o crente abandona o orgulho legalista e o desespero da culpa, descansando na obra consumada de Cristo.'
        : `A cruz de Cristo expõe a falência da nossa justiça própria. Descanse na justificação imerecida de Jesus, confesse o pecado oculto e receba o refrigério da graça.${pointAppSuffix}`
    },
    {
      title: 'III. O Fruto da Obediência e a Esperança Eterna',
      precedingTransition: 'Por fim, a passagem bíblica coroa esta exposição com o fruto da obediência perseverante e a esperança eterna.',
      explanation: mode === 'pulpit-card'
        ? '• Âncora: Fé viva se traduz em fidelidade prática de segunda a sábado.\n• Referências: Tiago 2.17 • Filipenses 1.6.'
        : mode === 'catechetical'
        ? 'Pergunta: Qual é o fruto necessário da fé salvadora na vida do cristão?\nResposta: A fé verdadeira nunca permanece ociosa, mas produz arrependimento contínuo, obediência alegre aos mandamentos de Deus e amor prático ao próximo (Tiago 2.17).\n\nPergunta: O que assegura a perseverança final do povo de Deus?\nResposta: A fidelidade imutável do Senhor e a ressurreição de Cristo, que garantem que Aquele que começou a boa obra há de completá-la até o Dia de Cristo (Filipenses 1.6).'
        : 'A fé verdadeira sempre se manifesta em discipulado perseverante, fidelidade na comunidade dos crentes e testemunho corajoso no mundo.\n\nEsse testemunho é confirmado em Tiago 2.17 e Filipenses 1.6, que assegura que Aquele que começou a boa obra haverá de completá-la. A ressurreição de Cristo é a garantia inviolável da nossa vitória final sobre o desânimo e a aflição presente.',
      illustration: mode === 'devotional' || mode === 'pulpit-card' || mode === 'catechetical'
        ? undefined
        : {
            type: 'cotidiano' as const,
            description: 'Assim como a árvore plantada junto a ribeiros não depende das tempestades sazonais para permanecer firme, o discípulo enraizado na esperança eterna sustenta o seu testemunho mesmo em dias áridos.'
          },
      application: mode === 'catechetical'
        ? 'Uso Doutrinário e Prático: A doutrina bíblica da perseverança não produz acomodação, mas coragem para servir a Deus com integridade no lar, no trabalho e na igreja local.'
        : `O Evangelho transforma a conduta no lar, no trabalho e na vizinhança. Seja fiel nas pequenas coisas de segunda a sábado e testemunhe de Cristo com integridade.${pointAppSuffix}`
    }
  ];

  const selectedPoints = mode === 'devotional' ? allPoints.slice(0, 2) : allPoints;

  return {
    title: cleanTitle,
    theme: cleanTheme,
    scripture: cleanScripture,
    introduction: introByMode[mode] || `Há momentos em que a Palavra de Deus não apenas nos instrui, mas desfaz as nossas ilusões mais seguras para nos colocar diante da realidade inegociável da eternidade. Ao abrirmos as Sagradas Escrituras em ${cleanScripture}, deparamo-nos com a voz do próprio Deus vivo convocando o nosso coração a um confronto santo, urgente e transformador com a Sua verdade.`,
    biblicalContext: mode === 'devotional'
      ? `Em ${cleanScripture}, o autor sagrado dirige uma palavra direta ao povo de Deus para lembrá-lo da fidelidade do Senhor em meio às pressões concretas da vida.`
      : `O texto sagrado de ${cleanScripture} foi registrado em um contexto histórico em que o povo de Deus enfrentava desafios cruciais de fidelidade, perseverança e compreensão da aliança divina. Longe de ser um conselho moralista abstrato, esta passagem anuncia a soberania e o cuidado redentor do Todo-Poderoso, conduzindo o coração à esperança viva.`,
    expositoryPoints: selectedPoints,
    illustrations: mode === 'devotional' || mode === 'pulpit-card'
      ? []
      : [
          {
            type: 'cotidiano' as const,
            description: 'Assim como um viajante em noite escura precisa de um farol seguro para não naufragar nos recifes, a alma humana encontra na verdade bíblica o rumo fixo e imutável que nenhuma bússola terrena pode oferecer.'
          },
          {
            type: 'bíblica' as const,
            description: 'Recordamos a narrativa da serpente de bronze no deserto (Números 21): os feridos pelo pecado não podiam curar a si mesmos; bastava olhar com fé para o socorro provido por Deus.'
          }
        ],
    applications: applicationsByMode[mode] || [
      'Ancorar as decisões diárias e a vida familiar na Palavra de Deus em vez de ceder à ansiedade secular.',
      'Descansar plenamente na justificação pela graça mediante a fé em Jesus Cristo, confessando pecados e abandonando a culpa.',
      'Viver em santidade ativa, ética inegociável no trabalho e amor sacrificial no lar de segunda a sábado.'
    ],
    conclusion: `A mensagem de ${cleanScripture} nos desafia a abandonar as ilusões da autossuficiência e a depositar toda a nossa confiança no Senhor. Sua Palavra é soberana, o Seu resgate é completo e a Sua promessa permanece para sempre.`,
    pastoralAppeal: appealByMode[mode] || `Se você tem andado cansado ou sobrecarregado pelas pressões deste mundo, não endureça o seu coração hoje. Aproxime-se de Cristo com sinceridade, arrependa-se e receba o renovo da Sua graça soberana. Amém.`,
    tags: tagsByMode[mode] || (isBibleStudy ? ['Estudo Bíblico', 'Pequeno Grupo'] : ['Exposição Bíblica', 'Graça Soberana']),
    duration: params.duration || '30',
    fallbackActive: true,
    fallbackReason: 'A conexão com o servidor de IA oscilou temporariamente. O conteúdo foi gerado pelo motor de contingência estruturada para visualização e edição na janela (sem alterar o original).'
  };
}
