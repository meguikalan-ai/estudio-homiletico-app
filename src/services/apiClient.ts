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
export async function safeApiPost<T = any>(
  url: string,
  payload: unknown,
  options: SafeApiOptions = {}
): Promise<T> {
  const { retries = 2, timeoutMs = 95000, delayMs = 1200 } = options;

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
        throw new Error(`HTTP ${response.status}: ${errBody || response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err;

      const isAbort = (err as Error)?.name === 'AbortError';
      const isFailedToFetch = err instanceof TypeError && String(err.message).includes('fetch');

      console.warn(`[safeApiPost] Falha na tentativa ${attempt + 1} para ${url}:`, err);

      // Se não for erro de rede transitório e não for timeout, talvez não compense insistir
      if (!isAbort && !isFailedToFetch && attempt >= retries) {
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
}) {
  const cleanScripture = params.scripture || 'Passagem Bíblica';
  const cleanTitle = (params.title || `A Glória da Graça em ${cleanScripture}`).replace(/^(título|titulo|title|sermão|sermao)\s*[:\-]?\s*/i, '').trim();
  const cleanTheme = params.theme || 'Fidelidade e Soberania de Deus';

  return {
    title: cleanTitle,
    theme: cleanTheme,
    scripture: cleanScripture,
    introduction: `Há momentos em que a Palavra de Deus não apenas nos instrui, mas desfaz as nossas ilusões mais seguras para nos colocar diante da realidade inegociável da eternidade. Ao abrirmos as Sagradas Escrituras em ${cleanScripture}, não estamos diante de conselhos humanos ou filosofias passageiras: deparamo-nos com a voz do próprio Deus vivo convocando o nosso coração a um confronto santo, urgente e transformador com a Sua verdade.`,
    biblicalContext: `O texto sagrado de ${cleanScripture} foi registrado em um contexto histórico em que o povo de Deus enfrentava desafios cruciais de fidelidade, perseverança e compreensão da aliança divina. Longe de ser um conselho moralista abstrato, esta passagem anuncia a soberania e o cuidado redentor do Todo-Poderoso, guiando o coração do crente à esperança viva. À luz desse cenário, o texto bíblico nos conduz a três verdades fundamentais que transformam a nossa caminhada com Deus.`,
    expositoryPoints: [
      {
        title: 'I. A Soberania da Revelação Divina',
        precedingTransition: 'A primeira verdade que emerge com nitidez desta passagem bíblica é a soberania da revelação divina sobre as incertezas humanas.',
        explanation: '(a) Explicação Textual Profunda: A passagem nos convoca a uma escuta reverente da autoridade das Escrituras, ressaltando que Deus toma a iniciativa de se comunicar com a Sua criação através da verdade eterna e infalível.\n\n(b) Paralelos Escriturísticos: Confirmado em Salmos 119.105 e 2 Timóteo 3.16-17, que atestam a suficiência e a clareza da revelação bíblica.\n\n(c) Cristocentrismo Redentor: Toda a revelação divina converge e se cumpre na pessoa de Jesus Cristo, o Verbo encarnado (João 1.14), nosso supremo Pastor e Senhor.',
        illustration: {
          type: 'cotidiano' as const,
          description: 'Assim como um viajante em noite escura precisa de um farol seguro para não naufragar nos recifes, a alma humana encontra na verdade bíblica o rumo fixo e imutável que nenhuma bússola terrena pode oferecer.'
        },
        application: '(d) Aconselhamento e Confronto Pastoral: Em meio à enxurrada de ruídos das redes sociais, às pressões e dilemas éticos no ambiente de trabalho e aos desgastes velados no casamento, onde você tem buscado refúgio? Pare de tentar governar sua vida pelo desespero da hora presente. Reúna sua família ao redor das Escrituras, converse com honestidade e afeto com seu cônjuge, proteja seus filhos do relativismo cultural e silencie as vozes do secularismo prático para ouvir a voz soberana de Deus.'
      },
      {
        title: 'II. O Resgate Redentor e a Suficiência da Graça',
        precedingTransition: 'Firmados nessa primeira verdade, a revelação bíblica avança para uma segunda verdade transformadora: o resgate redentor e a suficiência da graça.',
        explanation: '(a) Explicação Textual Profunda: O texto evidencia a incapacidade humana de salvar a si mesma por obras ou ritos externos, demonstrando que o perdão e a reconciliação brotam do favor soberano e gracioso do Senhor.\n\n(b) Paralelos Escriturísticos: Ecoa com força a proclamação paulina de Romanos 5.8 e Efésios 2.8-9 sobre o dom imerecido da vida eterna.\n\n(c) Cristocentrismo Redentor: É na cruz do Calvário que o Cordeiro de Deus tomou sobre Si a nossa condenação, satisfazendo a justiça do Pai e nos declarando justificados.',
        illustration: {
          type: 'bíblica' as const,
          description: 'Recordamos a narrativa da serpente de bronze no deserto (Números 21), resgatada por Jesus em João 3: os feridos pelo pecado não podiam curar a si mesmos; bastava olhar com fé para o socorro levantado por Deus.'
        },
        application: '(d) Aconselhamento e Confronto Pastoral: Quantos aqui carregam culpas secretas e angústias profundas na alma, ou convivem com a ansiedade esmagadora do trabalho e das contas a pagar, tentando comprar a própria paz por meio do ativismo religioso? A cruz de Cristo expõe a falência da nossa justiça própria. Rasgue as máscaras: descanse na justificação imerecida de Jesus, confesse o pecado oculto, libere o perdão que você tem negado ao seu irmão ou vizinho e receba o refrigério da graça.'
      },
      {
        title: 'III. O Fruto da Obediência e a Esperança Eterna',
        precedingTransition: 'Por fim, a passagem bíblica coroa esta exposição nos confrontando com uma terceira verdade essencial: o fruto da obediência perseverante e a esperança eterna.',
        explanation: '(a) Explicação Textual Profunda: A fé verdadeira sempre se manifesta em discipulado perseverante, fidelidade na comunidade dos crentes e testemunho corajoso no mundo.\n\n(b) Paralelos Escriturísticos: Confirmado em Tiago 2.17 e Filipenses 1.6, que assegura que Aquele que começou a boa obra haverá de completá-la.\n\n(c) Cristocentrismo Redentor: A ressurreição de Cristo é a garantia inviolável da nossa vitória final sobre a morte, o desânimo e a aflição presente.',
        application: '(d) Aconselhamento e Confronto Pastoral: O Evangelho não tolera piedade de fachada ou displicência de domingo a domingo. Como está sua conduta quando ninguém está olhando? Na sua empresa ou comércio, você tem sido justo e honesto com seus colegas, ou cede aos atalhos e à cobiça do dinheiro fácil? No seu lar, você tem sido paciente ou tem despejado aspereza sobre quem ama? Seja fiel nas pequenas coisas de segunda a sábado e testemunhe de Cristo com integridade inegociável.'
      }
    ],
    illustrations: [
      {
        type: 'cotidiano' as const,
        description: 'Assim como um viajante em noite escura precisa de um farol seguro para não naufragar nos recifes, a alma humana encontra na verdade bíblica o rumo fixo e imutável que nenhuma bússola terrena pode oferecer.'
      },
      {
        type: 'bíblica' as const,
        description: 'Recordamos a narrativa da serpente de bronze no deserto (Números 21): os feridos pelo pecado não podiam curar a si mesmos; bastava olhar com fé para o socorro provido por Deus.'
      }
    ],
    applications: [
      'Ancorar as decisões diárias e a vida familiar na Palavra de Deus em vez de ceder à ansiedade secular.',
      'Descansar plenamente na justificação pela graça mediante a fé em Jesus Cristo, confessando pecados e abandonando a culpa.',
      'Viver em santidade ativa, ética inegociável no trabalho e amor sacrificial no lar de segunda a sábado.'
    ],
    conclusion: `A mensagem de ${cleanScripture} nos desafia a abandonar as ilusões da autossuficiência e a depositar toda a nossa confiança no Senhor. Vimos que a Sua Palavra é soberana, o Seu resgate é completo e a Sua promessa de fidelidade permanece para sempre. Que o Espírito Santo grave estas verdades em nossos corações.`,
    pastoralAppeal: `Se você tem andado cansado, sobrecarregado pelas pressões deste mundo ou distante da comunhão com o Pai, não endureça o seu coração hoje. Aproxime-se de Cristo com sinceridade, arrependa-se e receba o renovo da Sua graça soberana. O Senhor está pronto a acolhê-lo e conduzir os seus passos. Amém.`,
    tags: ['Exposição Bíblica', 'Graça Soberana', 'Cristocentrismo', 'Esperança'],
    duration: params.duration || '30',
    fallbackActive: true,
    fallbackReason: 'A conexão com o servidor de IA oscilou temporariamente. O sermão foi gerado pelo motor homilético de contingência estruturada com base no texto bíblico e salvo normalmente na sua Biblioteca!'
  };
}
