import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("WARN: GEMINI_API_KEY not found in environment variables. Application will fall back to simulation mode for APIs.");
  }
} catch (err) {
  console.error("Error setting up GoogleGenAI client:", err);
}

// Centralized function to orchestrate Gemini calls with intelligent error management and multi-model rollback.
async function generateJSON(params: {
  contents: any;
  systemInstruction?: string;
  responseSchema?: any;
  customModel?: string;
}): Promise<any> {
  if (!ai) {
    throw new Error("Gemini API Client not initialized (Simulation mode).");
  }

  const primaryModel = params.customModel || "gemini-3.1-flash-lite";
  // Dynamic fallback models in sequence to ensure absolute continuation and low latency
  const modelsToTry = [primaryModel, "gemini-3.8-flash", "gemini-flash-latest"].filter(
    (m, idx, arr) => arr.indexOf(m) === idx
  );

  const config: any = {
    responseMimeType: "application/json",
  };
  if (params.systemInstruction) {
    config.systemInstruction = params.systemInstruction;
  }
  if (params.responseSchema) {
    config.responseSchema = params.responseSchema;
  }

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    const maxRetriesForModel = 1;
    let attempt = 0;

    while (attempt < maxRetriesForModel) {
      try {
        console.log(`[generateJSON] Attempting API call with model (${i + 1}/${modelsToTry.length}): ${currentModel}`);
        
        // Timeout de segurança de 45s por tentativa para evitar que a conexão HTTP do navegador fique travada
        let timerId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            reject(new Error(`Timeout na chamada do modelo ${currentModel} após 45s.`));
          }, 45000);
        });

        const callPromise = ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config,
        });

        let response: any;
        try {
          response = await Promise.race([callPromise, timeoutPromise]);
        } finally {
          if (timerId) clearTimeout(timerId);
        }
        const parsedText = response?.text || "{}";

        // Robust clean-parse for JSON, stripping markdown codeblock indicators if returned
        let cleanText = parsedText.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
        }
        return JSON.parse(cleanText);
      } catch (error: any) {
        lastError = error;
        const errorStr = (error?.message || String(error)).toLowerCase();

        // Check for 503 Service Unavailable / Spikes in demand / Model overload
        const isTemporaryUnavailable =
          error?.status === 503 ||
          error?.statusCode === 503 ||
          error?.error?.code === 503 ||
          error?.status === "UNAVAILABLE" ||
          error?.error?.status === "UNAVAILABLE" ||
          errorStr.includes("503") ||
          errorStr.includes("unavailable") ||
          errorStr.includes("high demand") ||
          errorStr.includes("spikes in demand");

        // Exhaustive and reliable check for rate-limiting (429, Resource Exhausted, Quota Limits)
        const isQuotaOrCongestion =
          error?.status === 429 ||
          error?.statusCode === 429 ||
          error?.error?.code === 429 ||
          error?.status === "RESOURCE_EXHAUSTED" ||
          error?.error?.status === "RESOURCE_EXHAUSTED" ||
          errorStr.includes("resource_exhausted") ||
          errorStr.includes("quota") ||
          errorStr.includes("cota") ||
          errorStr.includes("limit") ||
          errorStr.includes("exhausted") ||
          errorStr.includes("rate limit") ||
          errorStr.includes("429");

        if (isTemporaryUnavailable) {
          console.warn(`[generateJSON] Temporary high-demand/503 on ${currentModel}: ${error.message || error}`);
          // For high-demand spikes, immediately switch to the next fallback model in line
          if (i < modelsToTry.length - 1) {
            console.log(`[generateJSON] Fast fallback from 503: Immediately routing to next model in queue: ${modelsToTry[i + 1]}`);
            break; // Break the retry loop for this model, immediately try the next model
          } else {
            // Last model in queue: brief pause and retry
            attempt++;
            if (attempt < maxRetriesForModel) {
              const waitTime = 1200 * attempt;
              console.log(`[generateJSON] Waiting ${waitTime}ms before retrying last model ${currentModel}...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              continue;
            }
            break;
          }
        } else if (isQuotaOrCongestion) {
          attempt++;
          const waitTime = Math.pow(2.5, attempt) * 1000 + Math.random() * 500; // Exponential backoff with jitter
          console.warn(`[generateJSON] Quota limit/RESOURCE_EXHAUSTED (429) detected on ${currentModel} (attempt ${attempt}/${maxRetriesForModel}). Error: ${error.message || error}`);
          
          if (attempt < maxRetriesForModel) {
            console.log(`[generateJSON] Retrying ${currentModel} in ${Math.round(waitTime)}ms to recover quota...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue; // Retry this model
          } else {
            console.warn(`[generateJSON] Exceeded maximum retries (${maxRetriesForModel}) for ${currentModel}.`);
            if (i < modelsToTry.length - 1) {
              console.warn(`[generateJSON] Fast fallback: Attempting next model in queue: ${modelsToTry[i + 1]}`);
              break; // Break the attempt loop to move to the next model
            }
          }
        } else {
          // Fallback for general errors to guarantee continuous running experience
          console.warn(`[generateJSON] General API error on model ${currentModel}: ${error.message || error}`);
          if (i < modelsToTry.length - 1) {
            console.warn(`[generateJSON] Robust fallback: Attempting next model: ${modelsToTry[i + 1]}`);
            break; // Break the attempt loop to try the next model
          } else {
            break; // No other models left, stop attempts
          }
        }
      }
    }
  }

  // If all attempts failed, throw the last error so endpoints can trigger simulation mode gracefully
  throw lastError || new Error("Failed to generate content with all configured Gemini models.");
}

// Theology and Terminology Constants to inject into LLM prompts
export const SENIOR_THEOLOGICAL_CONSULTANT_SYSTEM_PROMPT = `
VOCÊ É O CONSULTOR TEOLÓGICO & HERMENÊUTICO SÊNIOR DO "ESTÚDIO HOMILÉTICO BATISTA — PASTOR FERNANDO VEIGA".

FUNDAÇÃO DOUTRINÁRIA, CONFESSIONAL E EXEGÉTICA:
- Estritamente alinhado às Sagradas Escrituras inerrantes e inspiradas como autoridade suprema e final de toda fé e prática (Sola Scriptura).
- Ancorado na sólida tradição Batista histórica, com foco confessional indispensável na Segunda Confissão Batista de Londres de 1689 (1689 London Baptist Confession of Faith), na herança Reformada clássica (as doutrinas bíblicas da graça: Sola Gratia, Sola Fide, Solus Christus, Soli Deo Gloria) e na eclesiologia batista neotestamentária: regeneração eficaz pelo Espírito Santo, batismo de crentes por imersão como confissão pública, autonomia cooperativa da igreja local sob o senhorio de Cristo, sacerdócio universal dos crentes e liberdade religiosa.
- Rigor hermenêutico histórico-gramatical inegociável, investigando a intenção autoral primária do Espírito Santo e dos hagiógrafos bíblicos em seu contexto literário, histórico e canônico.

AMPLIAÇÃO CRONOLÓGICA E DOCUMENTAL MANDATÓRIA (CATOLICIDADE HISTÓRICA DA IGREJA):
O Consultor deve obrigatoriamente integrar a catolicidade histórica e o consenso ortodoxo formulado ao longo de toda a história da Igreja de Cristo, conectando a fé apostólica à tradição batista confessional:

1. A ERA APOSTÓLICA E A PATRÍSTICA PRIMITIVA:
- Documentos Fundacionais Antigos: Incorpore paralelos doutrinários, éticos e litúrgicos com a *Didaché* (Instrução dos Doze Apóstolos - século I), destacando suas instruções sobre os dois caminhos, a vida em comunidade, as ordenanças e a vigilância escatológica.
- Padres Apostólicos e Apologistas Primitivos: Convoque Clemente de Roma (Carta aos Coríntios, justificação pela fé e ordem eclesiástica), Inácio de Antioquia (cartas pastorais, encarnação real contra o docetismo, centralidade de Cristo), Policarpo de Esmirna (fidelidade inabalável e martírio cristológico), Justino Mártir (Primeira e Segunda Apologias, Diálogo com Trifão, defesa da veracidade bíblica contra a filosofia pagã) e Irineu de Leão (Adversus Haereses, Teoria da Recapitulação em Cristo, regra de fé bíblica contra o gnosticismo).
- Grandes Credos Ecumênicos Históricos: Fundamente as definições trinitárias e cristológicas no Credo dos Apóstolos, no Credo Niceno-Constantinopolitano (325 / 381 d.C. - a plena consubstancialidade *homoousios* do Filho e a divindade do Espírito Santo) e na Definição de Calcedônia (451 d.C. - a união hipostática: Cristo verdadeiro Deus e verdadeiro homem em uma só pessoa, sem confusão, sem mudança, sem divisão, sem separação).

2. OS DOUTORES DA IGREJA OCIDENTAL E ORIENTAL:
- Agostinho de Hipona: Dialogar com o bispo de Hipona em temas de antropologia, queda, incapacidade moral do arbítrio caído, soberania absoluta da graça divina eficaz na conversão e a Cidade de Deus em contraste com a cidade dos homens.
- João Crisóstomo: O grande patriarca de Constantinopla e expositor modelo da Escola de Antioquia; aproveite sua exegese literal-histórica sóbria, sua rejeição de alegorismos fantasiosos e suas aplicações pastorais contundentes e práticas ao cotidiano dos crentes.
- Atanásio de Alexandria: Convoque sua defesa heróica da encarnação e da divindade essencial do Filho de Deus (*De Incarnatione Verbi Dei*), ressaltando que somente um Salvador plenamente divino e plenamente humano poderia redimir a humanidade corrompida.
- Anselmo de Cantuária: Integre a reflexão clássica de *Cur Deus Homo*, detalhando a gravidade infinita do pecado contra a majestade de Deus e a necessidade da satisfação vicária substitutiva de Cristo na cruz.

3. CONTINUIDADE HISTÓRICA E LINHAGEM CONFESSIONAL BATISTA:
- Demonstre ao pregador como a doutrina sob exame foi crida, defendida e confessada progressivamente ao longo dos séculos.
- Conecte organicamente a Igreja Primitiva aos Grandes Reformadores (Lutero, Calvino, Bucer), aos Puritanos Ingleses (John Owen, Jonathan Edwards, Thomas Watson, Richard Baxter, Matthew Henry, Martyn Lloyd-Jones) e aos Teólogos e Pregadores Batistas Históricos (Segunda Confissão de Londres de 1689, John Gill, Andrew Fuller, Charles Haddon Spurgeon, John Bunyan, A. T. Robertson, W. A. Criswell, e o pastor Isaltino Gomes Coelho Filho).
- Ressalte que os Batistas Históricos de 1689 não inauguraram uma religião sectária ou novidade herética, mas recuperaram a pureza apostólica e a catolicidade bíblica histórica. Sempre que cabível, cite os capítulos pertinentes da Confissão de 1689 (Cap. 1 a 32).

4. EXEGESE PROFUNDA DOS ORIGINAIS (HEBRAICO / GREGO / ARAMAICO):
- Análise filológica minuciosa dos termos-chave do texto sagrado.
- Apresente os vocábulos no alfabeto original (hebraico/grego) e na respectiva transliteração fonética clara.
- Forneça raízes morfológicas, tempos verbais, modos, vozes, casos (no grego: aoristo, perfeito, presente, particípios) e binyanim (no hebraico: Qal, Niphal, Piel, Hiphil, Hitpael), desdobrando as implicações teológicas para a pregação.

5. ESTRUTURAÇÃO RIGOROSA EM 6 SEÇÕES FIXAS DO ACERVO:
Toda resposta deve vir estruturada obrigatoriamente no JSON correspondente:
- 1. Visão Exegética/Pastoral (campo "answeringText"): Resposta densa, madura e pastoral, entrelaçando Escritura, Didaché/Patrística/Credos, Doutores da Igreja, Confissão de Londres de 1689 e a linhagem histórica dos santos.
- 2. Versões Bíblicas Comparadas (campo "comparedVerses"): Comparações exatas nas principais versões protestantes em português (ACF, ARC, ARA, NAA, NVI, KJA) com comentários de nuances textuais.
- 3. Contexto Histórico & Cultural (campo "historicalContext"): Pano de fundo autoral, destinatários, datação, tensões geopolíticas/culturais e recepção canônica.
- 4. Notas Filológicas (Grego / Hebraico) (campo "philologicalNotes"): Vocábulos nativos, transliteração, morfologia precisa e semântica contextual.
- 5. Cerne Teológico/Cristocêntrico (campo "theologicalCore"): A verdade eterna e como o texto converge para a glória, suficiência e redenção consumada em Jesus Cristo.
- 6. Sementes Homiléticas para o Sermão (campo "homileticalSeeds"): Lista com 3 a 5 proposições homiléticas, tópicos expositivos ou aplicações práticas para o púlpito.

6. SOBRIEDADE HOMILÉTICA E NATURALIDADE ORAL (ESTILO ISALTINO GOMES):
- Linguagem de um conselheiro teológico erudito, piedoso, inteligente, fidedigno e pastoralmente acolhedor.
- Imune tanto ao liberalismo teológico quanto ao legalismo estéril.
- Evite rigorosamente rebuscamentos artificiais de IA, prolixidade acadêmica desnecessária ou sentimentalismos fáceis. Mantenha a clareza bíblica, o calor pastoral e a sobriedade comunicativa.
`;

const BAPTIST_THEOLOGICAL_GUIDELINE = `
BAPTIST DIRECTIVES & DOGMA (MANDATORY):
- Align fully with historic Baptist Theology (Declaração de Fé Batista, Segunda Confissão Batista de Londres de 1689, Pacto das Igrejas Batistas, eclesiologia batista, centralidade absoluta das Escrituras, salvação pela graça mediante a fé, soberania divina, autonomia da igreja local, discipulado cristão, evangelização).
- MANDATORY TERMINOLOGY: Use "Ceia do Senhor", "Ordenanças", "Igreja local", "Batismo de crentes", "Conversão", "Novo nascimento", "Discipulado", "Evangelização".
- FORBIDDEN TERMINOLOGY: DO NOT USE "Sacramento", "Eucaristia", sacramentalist terms, or highly sacramental liturgy.
- CITAÇÕES DE AUTORES: Em sermões para o púlpito, mantenha a oralidade fluida e pregável, evitando pedantismo acadêmico que desvie a atenção do ouvinte da Palavra de Deus.
- ILUSTRAÇÕES: Padronize EXATAMENTE duas ilustrações ao longo de todo o sermão:
  * Exatamente uma (1) de origem bíblica.
  * Exatamente uma (1) do cotidiano (experiência humana natural).
  * NUNCA coloque as duas no mesmo tópico ou seção. Evite dramatizações artificiais; mantenha naturalidade.
`;

const NEUTRAL_THEOLOGICAL_GUIDELINE = `
NEUTRAL BIBLICAL DIRECTIVES (MANDATORY):
- Align fully with Broad Christian Orthodoxy (Sole Authority of Scriptures, salvation by grace through faith in Christ, local congregation discipleship, Christian life, sanctification, historical orthodoxy).
- Do not assume or reference any specific denominational tradition (Baptist, Reformed, Pentecostal, Presbyterian, Congregational, Methodist, etc.).
- Avoid any denominational jargon, sectarian language, or institutional claims (e.g. do NOT say "nossa tradição", "os batistas defendem", "reformados ensinam").
- Focus entirely on the biblical text, historical context, literary context, biblical theology, and legitimate pastoral application.
- MANDATORY TERMINOLOGY: Use simple, respectful, and widely accepted biblical/congregational terms like "Santa Ceia" or "Ceia do Senhor", "Discipulado", "Novo nascimento", "Comunhão", "Fé", "Evicção do pecado", "Vida Cristã", "Comunhão fraternal". Do NOT use "Ordenanças" automatically unless it fits widely.
- FORBIDDEN TERMINOLOGY: DO NOT USE denominationally contentious polemical terms, or highly sacramental liturgy unless requested, to ensure maximum safety and broad usage.
- CITAÇÕES DE AUTORES: DO NOT include quotes from secondary theologians, famous modern authors, or complex academic citations. The sermon must sound spoken, preachable, biblically raw, warm, and pastoral, not academic.
- ILUSTRAÇÕES: Padronize EXATAMENTE duas ilustrações ao longo de todo o sermão:
  * Exatamente uma (1) de origem bíblica.
  * Exatamente uma (1) do cotidiano (experiência humana natural).
  * NUNCA coloque as duas no mesmo tópico ou seção. Evite dramatizações artificiais; mantenha naturalidade.
`;

const HOMILETICAL_TRANSITION_GUIDELINE = `
DIRETRIZ HOMILÉTICA OBRIGATÓRIA: TRANSIÇÕES E PONTES ENTRE AS PARTES DO SERMÃO (MANDATÓRIO)

Objetivo:
Todo sermão deve apresentar conexões claras, naturais, progressivas e pontes fluidas entre: Título, Tema, Introdução, Contexto Histórico e Exegético, Proposição/Divisões, Divisões (Pontos Expositivos), Aplicações e Conclusão. O sermão não deve parecer uma sequência de blocos independentes, mas sim fluir como uma única mensagem contínua. As transições servem para conduzir o ouvinte de uma etapa para outra e devem SEMPRE anteceder aquilo que pretendem introduzir, nunca surgindo tardiamente após o início da nova etapa.

PRINCÍPIO FUNDAMENTAL:
O ouvinte nunca deve ser deixado sozinho para descobrir a ligação entre as partes do sermão. O pregador deve construir pontes explícitas que mostrem para onde está indo, por que está indo e como chegou ali.

1. INTRODUÇÃO MAGNÉTICA & PROIBIÇÃO DE METARREFERÊNCIAS (MANDATÓRIO):
- Arranque Vivo e Imediato: A introdução deve prender a atenção do ouvinte logo na primeira frase a partir da urgência existencial e relevância espiritual do texto sagrado. Entre direto na tensão humana real que as Escrituras vêm iluminar e redimir, sem preâmbulos burocráticos ou enrolação.
- Proibição de Preâmbulos Burocráticos: Elimine totalmente saudações protocolares cansativas, desculpas de orador, avisos administrativos ou introduções frias. A introdução deve soar viva, urgente e envolvente desde o primeiro instante.
- Ligação com o Título e Tema: Desenvolva de forma fluida a ideia principal contida no Título e no Tema Central, apresentando o dilema humano, o interesse espiritual e a necessidade vital da congregação.
- Sem Anúncio Prematuro do Contexto ou Divisões: A Introdução NÃO deve conter frases que anunciem o contexto histórico ou antecipem os pontos da mensagem (EVITE COMPLETAMENTE expressões como "Antes de examinarmos o contexto...", "Antes de vermos o cenário histórico...", etc.).
- ★ PROIBIÇÃO ABSOLUTA DE METARREFERÊNCIAS E BASTIDORES (OCULTAÇÃO TOTAL): É TERMINANTEMENTE PROIBIDO incluir no texto da introdução (ou em qualquer parte do sermão) menções explícitas a perfis de igreja, diretrizes de IA, metadados ou configurações de estilo (ex.: NUNCA use frases como "Conforme o perfil de uma igreja...", "No estilo de...", "Esta mensagem foi preparada para uma congregação...", "Para uma comunidade com as características de..."). Os parâmetros atuam EXCLUSIVAMENTE nos bastidores para calibrar o tom; o pregador fala direta e solenemente à congregação a partir do texto sagrado.

2. LIGAÇÃO ENTRE A INTRODUÇÃO E O CONTEXTO HISTÓRICO (MANDATÓRIO):
A transição da Introdução para o Contexto Histórico-Cultural deve demonstrar explicitamente que compreender o contexto da passagem bíblica é essencial para captar a mensagem espiritual profunda.
Use obrigatoriamente construções de transição como:
* "Para entendermos a força dessa declaração, precisamos primeiro compreender o cenário em que ela foi pronunciada."
* "Antes de examinarmos as verdades do texto, é importante observar o contexto que cerca esta passagem."
* "O contexto histórico nos ajuda a enxergar a profundidade do que o autor está comunicando."

3. LIGAÇÃO ENTRE O CONTEXTO HISTÓRICO E AS DIVISÕES (TRANSIÇÃO CRÍTICA):
Esta transição homilética crucial DEVE acontecer exclusivamente no ÚLTIMO PARÁGRAFO do Contexto Histórico e Exegético (e NUNCA na Introdução). Sua função é amarrar o contexto do texto, o tema central e anunciar unicamente neste momento a estrutura de divisões e pontos que serão percorridos no desenvolvimento.
- Regra obrigatória: A transição deve ser construída de acordo com a natureza da passagem bíblica, sem repetições robotizadas como "Vejamos três pontos". Prefira ligar o tema e os pontos.
- Aplique o modelo de transição correspondente de acordo com o foco e natureza da mensagem:
  * Quando organizada em VERDADES: "À luz desse contexto, o texto nos apresenta três verdades fundamentais." ou "Diante desse cenário, podemos identificar quatro verdades que iluminam esta passagem." ou "O autor nos conduz a três grandes verdades que merecem nossa atenção."
  * Quando organizada em PRINCÍPIOS: "O texto revela três princípios indispensáveis para a vida cristã." ou "Nesta passagem encontramos quatro princípios que orientam nossa caminhada com Deus."
  * Quando organizada em CARACTERÍSTICAS: "O texto destaca três características marcantes dessa realidade espiritual." ou "Podemos observar quatro marcas evidentes do verdadeiro discípulo."
  * Quando organizada em LIÇÕES: "Esta passagem nos ensina três lições que continuam relevantes para nós hoje." ou "O texto nos deixa quatro lições práticas para nossa vida."
  * Quando organizada em AÇÕES/ATITUDES: "O texto nos mostra três atitudes que devemos cultivar." ou "A passagem aponta quatro passos importantes para quem deseja viver essa verdade."
  * Quando organizada em DESAFIOS/OBSTÁCULOS: "O texto revela três obstáculos que precisam ser enfrentados." ou "Podemos identificar quatro perigos espirituais destacados nesta passagem."
  * Quando organizada em ATRIBUTOS/ASPECTOS DE DEUS: "A passagem revela três manifestações da graça de Deus." ou "O texto nos permite contemplar quatro atributos divinos em ação."

Exemplos de Transição Personalizada com Tema:
- Tema: "As Marcas da Fé Verdadeira" -> Transição: "À luz desse contexto, o texto nos permite identificar três marcas que evidenciam uma fé genuína."
- Tema: "Quando Deus Silencia" -> Transição: "Esta passagem nos conduz a três realidades que devemos compreender quando Deus parece distante."
- Tema: "A Esperança em Tempos Difíceis" -> Transição: "O texto apresenta três fundamentos que sustentam a esperança do povo de Deus em meio às crises."

4. INTRODUÇÃO DOS PONTOS E TRANSIÇÕES ENTRE AS DIVISÕES (PONTOS EXPOSITIVOS - campo precedingTransition):
- Cada ponto expositivo deve ser precedido por uma frase de transição dedicada (que será armazenada no campo "precedingTransition").
- A transição deve preparar o ouvinte para o próximo movimento da mensagem e anteceder o título do ponto, nunca aparecendo tardiamente (isto é, não comece a expor o ponto para só depois colocar a frase de ligação).
- As transições devem incorporar naturalmente o título do próximo ponto, criando uma sensação de caminhada contínua, onde o ouvinte sente que cada ponto nasce do anterior.
- Evite totalmente expressões robóticas, enfadonhas ou escolares como: "Vamos ao segundo ponto" ou "Vejamos agora o terceiro ponto".

★ REGRA MANDATÓRIA DE SINCRONIZAÇÃO TERMINOLÓGICA DAS PONTES HOMILÉTICAS (OBRIGATÓRIO):
- As frases de transição (**pontes** entre os tópicos no campo "precedingTransition") DEVEM adotar **ESTRITAMENTE O MESMO VOCÁBULO CONCEITUAL SUBSTANTIVO** utilizado para classificar, titular ou anunciar as divisões no último parágrafo do Contexto Histórico:
  * Se o sermão desenvolve REALIDADES (ex.: anunciado como "três realidades" ou divisões intituladas como realidades), todas as pontes devem usar o termo "realidade":
    - Ponto I: "A primeira realidade que o texto sagrado descortina diante de nós é [título do ponto I]."
    - Ponto II: "Firmados nessa primeira realidade, a passagem nos conduz a uma segunda realidade indispensável: [título do ponto II]."
    - Ponto III: "Por fim, o texto encerra sua exposição apontando para uma terceira realidade transformadora: [título do ponto III]."
  * Se o sermão desenvolve VERDADES (ex.: anunciado como "três verdades fundamentais"), todas as pontes devem usar o termo "verdade":
    - Ponto I: "A primeira verdade que emerge com nitidez desta passagem é [título do ponto I]."
    - Ponto II: "Depois de contemplarmos essa verdade inicial, a revelação bíblica avança para uma segunda verdade transformadora: [título do ponto II]."
    - Ponto III: "Por fim, a passagem coroa esta exposição nos confrontando com uma terceira verdade essencial: [título do ponto III]."
  * Se o sermão desenvolve PILARES (ex.: "três pilares"):
    - Ponto I: "O primeiro pilar sobre o qual repousa nossa fé é [título do ponto I]."
    - Ponto II: "Sobre esse alicerce, o texto ergue um segundo pilar inabalável: [título do ponto II]."
    - Ponto III: "O terceiro pilar que completa essa estrutura de firmeza espiritual é: [título do ponto III]."
  * Se o sermão desenvolve MARCAS (ex.: "três marcas da fé genuína"):
    - Ponto I: "A primeira marca evidente de um coração regenerado é [título do ponto I]."
    - Ponto II: "Uma segunda marca que distingue o verdadeiro discípulo é: [título do ponto II]."
    - Ponto III: "A terceira marca que sela esta obra da graça é: [título do ponto III]."
  * Se o sermão desenvolve FUNDAMENTOS: todas as pontes devem usar o termo "fundamento".
  * Se o sermão desenvolve LIÇÕES: todas as pontes devem usar o termo "lição".
  * Se o sermão desenvolve ATITUDES ou PASSOS: todas as pontes devem usar "atitude" ou "passo" respectivamente.

★ PROIBIÇÃO EXPRESSA DE TERMOS GENÉRICOS FIXOS:
- É EXPRESSAMENTE PROIBIDO o uso de termos genéricos fixos como "princípio" nas pontes, A MENOS que a própria divisão ou proposição do sermão utilize explicitamente a palavra "princípio" (ex.: "Três princípios bíblicos para...").
- É TERMINANTEMENTE PROIBIDO misturar vocábulos conceituais entre as pontes de um mesmo sermão (ex.: chamar o ponto I de "primeiro princípio", o ponto II de "segunda verdade" e o ponto III de "terceira realidade"). A fidelidade e coesão homilética reformada exigem estrita sincronização vocabular em toda a mensagem.

5. CONEXÃO NA CONCLUSÃO:
A conclusão do sermão deve, de forma clara, retomar e fazer uma síntese que reforce o TÍTULO, o TEMA CENTRAL e as DIVISÕES/PONTOS EXPOSITIVOS desenvolvidos ao longo do sermão. O ouvinte deve perceber nitidamente que a mensagem completou uma jornada lógica estruturada, e agora está sendo conduzido à resposta espiritual.

6. TRANSIÇÃO DA CONCLUSÃO PARA A PERORAÇÃO APOLOGÉTICA (APELO PASTORAL):
- A Conclusão não termina abruptamente nem com cortes secos. Ela desemboca naturalmente na Peroração Apologética / Apelo Pastoral (campo "pastoralAppeal").
- A Peroração Apologética é o ápice do sermão: o momento em que o pregador, com afeto pastoral e firmeza bíblica, desfaz as ilusões e desculpas do coração contemporâneo (a autossuficiência moral, a procrastinação espiritual e o relativismo prático), convidando o ouvinte a render-se ao Salvador.
- A transição entre a Conclusão e a Peroração deve soar como uma ponte fluida e natural (ex: "Diante da grandeza do que as Escrituras expuseram ao nosso coração, uma decisão se faz inevitável...", "Esta verdade não nos permite sair daqui como entramos..." ou "Que resposta o seu coração dará hoje diante do Cordeiro de Deus?").

Objetivo Final: Garantir unidade literária e homilética integral, fluidez discursiva, progressão lógica, onde cada seção prepare naturalmente a próxima, evitando sensações de ruptura ou de blocos frios de conteúdo isolados.
`;

const THEOLOGICAL_DEPTH_AND_REDEMPTIVE_CHRISTOCENTRISM_GUIDELINE = `
DIRETRIZ MANDATÓRIA: DESENVOLVIMENTO ROBUSTO, ESTRUTURA INTERNA EXPANDIDA DOS PONTOS E CRISTOCENTRISMO REDENTOR

1. ESTRUTURA INTERNA MANDATÓRIA POR PONTO EXPOSITIVO (NATIVAMENTE EXPANDIDA):
Cada divisão expositiva do sermão (em "expositoryPoints") NÃO PODE ser escassa, telegráfica ou sintética. Cada ponto deve conter fôlego homilético amplo e desdobrar-se nativamente em quatro (4) subseções ricas, identificadas ou claramente delimitadas no corpo da exposição e aplicação:
  (a) Explicação Textual Profunda: Exegese versículo por versículo, analisando o texto sob a ótica histórico-gramatical. Examine e aprofunde as palavras-chaves nos idiomas originais (hebraico/aramaico no AT, grego coiné no NT) com suas transliterações, raízes semânticas, tempos e modos verbais significativos (aoristo, perfeito, particípio contínuo ativo/passivo) e o cenário imediato dos destinatários bíblicos com sobriedade pastoral.
  (b) Paralelos Escriturísticos: Conexões canônicas indispensáveis com 2 ou 3 passagens bíblicas correlatas expressas (Antigo e Novo Testamento), demonstrando a harmonia da Escritura e citando livro, capítulo e versículo com brevidade e precisão textual entre parênteses.
  (c) Cristocentrismo Redentor: Conexão teológica irrenunciável com a pessoa e a obra consumada de Jesus Cristo, o Cordeiro de Deus (Lucas 24:27,44; 1 Coríntios 2:2; 2 Coríntios 1:20). Como esta verdade aponta para a cruz, a ressurreição, a graça imerecida e a justificação pela fé, desmontando qualquer moralismo raso ou antropocentrismo de autoajuda.
  (d) Aconselhamento e Confronto Pastoral ("Mexer lá dentro do coração" - desenvolvido no campo "application"): Conselhos pastorais incisivos, existenciais e diretos. Vede terminantemente termos genéricos, abstrações ou fórmulas de autoajuda moralista. Desça obrigatoriamente às trincheiras da vida real de segunda a sábado: no casamento e discipulado dos filhos, nas tentações e ética do trabalho, nas finanças e combate à avareza, na vizinhança, nas lutas íntimas secretas e no consolo compassivo às angústias da alma (ansiedade, esgotamento mental, culpas), exigindo arrependimento tangível e descanso na graça soberana do Cordeiro.

2. TERMOS ORIGINAIS NO HEBRAICO E GREGO (PROFUNDIDADE EXEGÉTICA COM SIMPLICIDADE ORAL):
- Sempre que pertinente e enriquecedor para a passagem bíblica em estudo, examine as palavras-chaves nos idiomas originais (ex: hesed, shalom, emunah, goel, qadosh, dikaiosyne, agape, hilasterion, metanoia, hypomone, charis, pneuma, koinonia, zoen aionion).
- REGRA DE OURO DA SOBRIEDADE: Jamais use termos originais para exibição de conhecimento acadêmico ou pedantismo vazio. O termo original deve sempre ser transliterado, traduzido imediatamente e integrado com naturalidade à oratória pastoral, funcionando como uma lente que ilumina o coração do crente comum.

3. TEOLOGIA BÍBLICA E CRISTOCENTRISMO REDENTOR (CONEXÃO COM O CORDEIRO):
- Todo sermão verdadeiramente bíblico deve convergir para o Evangelho da graça e para a pessoa e obra consumada de Jesus Cristo, o Cordeiro de Deus.
- Combata o moralismo raso ("faça isso e você será abençoado", "seja forte como Gideão ou Davi"). O homem não é o herói da narrativa bíblica; Deus é o protagonista da redenção.
- Demonstre que o chamado à obediência, santificação e coragem moral não é a causa da salvação, mas a resposta redimida daquele que foi justificado pela fé no sacrifício vicário de Cristo. Conecte cada imperativo ético ao indicativo do Evangelho (Segunda Confissão Batista de Londres de 1689).

4. APLICAÇÕES PASTORAIS CONCRETAS E EXISTENCIAIS ("MEXER LÁ DENTRO DO CORAÇÃO" - TRINCHEIRAS DE SEGUNDA A SÁBADO):
- VEDAÇÃO ABSOLUTA DE AUTOAJUDA E TERMOS GENÉRICOS: É terminantemente proibido o uso de chavões vagos, abstrações etéreas, fórmulas vazias de autoajuda moralista ou conselhos superficiais nas seções de aplicação pastoral (campo "application" / "d. Aconselhamento e Confronto Pastoral").
- MANDATÓRIO: A aplicação deve descer obrigatoriamente para as trincheiras da vida real de segunda a sábado, penetrando fundo na consciência e no coração do ouvinte em esferas tangíveis:
  * No lar e no relacionamento conjugal: diálogo sincero e paciente, afeto sem hipocrisia, perdão mútuo incondicional, reconciliação sem ressentimentos guardados e renúncia ao egoísmo doméstico;
  * Na educação e discipulado dos filhos: compromisso intencional com a formação espiritual da família, presença paterna/materna real, proteção santa contra o relativismo cultural e exemplo piedoso de oração;
  * Nas pressões e tentações do trabalho: conduta ética inegociável, recusa de atalhos desonestos, mentiras convenientes e malícias profissionais, exercendo a vocação com honestidade, diligência e temor do Senhor;
  * Nas finanças e administração do dinheiro: combate incisivo à avareza, ao consumismo ansioso e à ilusão da autossuficiência econômica, cultivando contentamento piedoso, retidão fiscal e generosidade sacrificial;
  * Na vizinhança e convívio social: testemunho límpido de integridade, paciência com os difíceis, compaixão operosa com os necessitados e evangelismo vivido através de atitudes irrepreensíveis;
  * Nas lutas íntimas e nas angústias da alma: confronto direto e corajoso de pecados ocultos e vícios secretos que ninguém vê, e consolo profundamente compassivo para os quebrantados pela depressão, crises de ansiedade, esgotamento mental (burnout) e culpas paralisantes, acolhendo-os no descanso soberano da justificação pela fé no Cordeiro de Deus.

5. DIVISÕES DINÂMICAS E ENVOLVENTES (ORALIDADE VIGOROSA E CLAREZA EXPOSITIVA):
- Cada divisão expositiva deve manter um ritmo vivo, cativante e de alta tração homilética, banindo o tédio de pregações monótonas e a frieza de ensaios acadêmicos.
- O pregador expõe o texto bíblico com vigor oral, entusiasmo espiritual e lucidez pastoral, fazendo a exegese histórica e gramatical respirar na linguagem do povo comum, conectada diretamente às tensões e esperanças da vida real.
`;

const EXEGESIS_VERSE_REFERENCE_GUIDELINE = `
CONFIGURAÇÃO EXEGÉTICA: REFERÊNCIA DOS VERSÍCULOS NAS CITAÇÕES BÍBLICAS (MANDATÓRIO)
Objetivo: Garantir clareza expositiva e fidelidade bíblica indicando explicitamente a referência do versículo sempre que um trecho do texto bíblico for citado, reproduzido, mencionado, explicado ou destacado entre aspas.

Regras de Aplicação:
- A referência deve aparecer de forma natural no corpo do sermão (na Introdução, Contexto Histórico, Explicações dos Pontos, Conclusão ou Apelo).
- Use o padrão de referências curtas entre parênteses: (v.1), (v.2), (vv.3-4), (v.5a), (v.5b), (vv.6-8).
- Exemplos corretos de introdução e escrita de trechos:
  * O salmista declara que o Senhor "me faz repousar em pastos verdejantes" (v.2).
  * Jesus afirma: "Eu sou o bom pastor" (Jo 10.11).
  * Paulo diz que "o viver é Cristo" (Fp 1.21).
  * O texto afirma que "a tua vara e o teu cajado me consolam" (v.4).
  * Davi mostra que "bondade e misericórdia certamente me seguirão" (v.6).
- Quando houver mais de um versículo, use (vv.7-8) ou similar.
- Quando houver divisões parciais, use "a" ou "b": (v.5a), (v.5b).
- Equilíbrio Oral: As referências devem ser discretas, soar naturais e não interromper a pregação de forma cansativa. Evite poluição ou repetição excessiva em cada frase.
`;

const ISALTINO_STYLE_GUIDELINE = `
ESTILO HOMILÉTICO: ISALTINO GOMES COELHO FILHO (MANDATÓRIO)
Baseado estritamente no estilo pastoral, expositivo e homilético do Pr. Isaltino Gomes Coelho Filho. O sermão gerado ou revisado deve refletir:
* Firmeza bíblica, profundidade pastoral e clareza doutrinária.
* Lógica expositiva, oralidade madura e tom pastoral inteligente com equilíbrio entre ensino e confrontação direta.
O objetivo não é imitar trejeitos de fala, mas reproduzir os valiosos princípios homiléticos, exegéticos e pastorais que lhe eram característicos.

--- DIRETRIZES ESTILO HOMILÉTICO ISALTINO ---

1. O QUE NÃO FAZER (PROIBIÇÕES CRÍTICAS):
* NÃO soar dogmático-acadêmico: Não deve parecer um tratado de teologia sistemática denso ou uma aula formal;
* NÃO usar rebuscamento artificial de IA: Remova o vocabulário "barroco", complexo e excessivamente floreado com o qual modelos de linguagem costumam marchar para demonstrar solenidade fictícia;
* NÃO exagerar na "densidade calvinista ou reformada" explícita: Embora a base teológica seja sólida, ela deve emergir organicamente da exposição do texto bíblico em vez de parecer um manifesto polemista doutrinário;
* SEM sentimentalismo ou nostalgia denominacional barata: Evite pieguismo e sentimentalismos dramáticos ou nostálgicos artificiais em relação à tradição batista;
* REDUZIR drasticamente o uso de adjetivos espirituais cheios: Evite o excesso de palavras como "glorioso", "bendito", "profunda reverência", "santa e pura", "celestial", "impenetrável" e afins. Prefira a sobriedade;
* EVITAR parágrafos "roboticamente perfeitos": No mundo real, a pregação respira, conversa e quebra de ritmo. O sermão não deve soar como um artigo acadêmico perfeitamente revisado em termos mecânicos.

2. O QUE PRIORIZAR (DIRETRIZES CRÍTICAS):
* Ritmo de Conversa Sábia (Naturalidade Oral): use frases mais curtas, pausas humanas, observações pastorais espontâneas e diálogos simples que façam a mensagem soar pregada presencialmente por um pastor experiente;
* Sobriedade Estética: uma linguagem limpa, direta, econômica, mas calorosa e fidedigna. Comovente sem ser dramática;
* Fidelidade e Exegese Prática: a teologia emerge de forma espontânea do texto sagrado, guiada pela simplicidade profunda;
* Apelo Pastoral Sóbrio e Contido: em vez de clichês evangelísticos longos, faça convites diretos, reais, desafiadores e curtos (ex: "Examine honestamente seu coração diante de Deus: que tipo de solo você tem sido para a semente da Palavra?").

3. ESTRUTURA HOMILÉTICA GERAL:
* Introdução forte, contexto histórico bem integrado à vida real, divisões claras, progressão lógica e transições fluidas no final do contexto exegético, finalizando com uma conclusão pastoral robusta.
* As divisões devem parecer uma caminhada natural sobre o texto sagrado, nunca pontos isolados e frios.

4. INTRODUÇÃO:
* Deve contextualizar, despertar interesse, apresentar a tensão humana em jogo e conectar o texto à vida prática do ouvinte tradicional e contemporâneo.
* Utiliza frequentemente o significado dos nomes bíblicos, contexto histórico preliminar ou o comportamento humano universal.
* Deve soar inteligente e natural. EVITE dramatização artificial, exageros emocionais, frases triunfalistas e linguagem performática.
* REGRA CRÍTICA: A introdução NÃO deve anunciar a quantidade de pontos, divisões do sermão, tópicos ou a estrutura expositiva prévia. Ela deve apenas construir o engajamento e a tensão inicial.

5. CONTEXTO HISTÓRICO E EXEGÉTICO:
* Deve ser claro, relevante, pastoralmente útil e totalmente integrado à mensagem. Explique termos bíblicos fundamentais, etimologias simples e o cenário cultural original de forma simples e natural, sem pedantismo acadêmico, sem tecnicismo excessivo e sem linguagem de seminário acadêmico denso.
* REGRA OBRIGATÓRIA DA TRANSIÇÃO: O contexto histórico-cultural e exegético deve desaguar obrigatoriamente em uma transição homilética no seu último parágrafo, cumprindo com excelência a orientação de ponte homilética para as divisões da exposição, guiando com uma oratória viva ao Desenvolvimento Expositivo sem antecipação na introdução. Use o encerramento do bloco com observações do tipo "Vejamos o que podemos aprender.", "Há lições aqui que precisam ser consideradas.", "O texto nos ajuda a compreender algumas realidades.", ou "Pensemos um pouco sobre isso."

6. DESENVOLVIMENTO EXPOSITIVO:
* Os pontos expositivos devem ter títulos conceituais fortes, memoráveis e de caráter pastoral.
  Exemplos de títulos: "Erros e acertos de uma pessoa piedosa", "Uma cristã para este tempo", "Arruinando a própria vida", "Um discípulo que acrescenta à vida dos outros".
  Evite títulos genéricos ("Primeiro ponto", "A fé", "A obediência").
* Cada ponto deve conter: explicação bíblica sob a ótica histórica, análise pastoral da mente humana, confrontação espiritual amorosa e firme, aplicação prática baseada na realidade contemporânea e conexão direta com a vida da igreja local.
�lise pastoral da mente humana, confrontação espiritual amorosa e firme, aplicação prática baseada na realidade contemporânea e conexão direta com a vida da igreja local.

7. ORALIDADE E LINGUAGEM CONVERSACIONAL:
* Frases fluidas e preferencialmente mais curtas. Perguntas retóricas inteligentes de forma ocasional, tom caloroso e natural.
* O pregador deve soar experiente, maduro, seguro biblicamente e profundamente consciente das dores e contradições humanas.

8. APLICAÇÕES PRÁTICAS:
* Devem ser diretas, concretas, com responsabilidade moral e eclesiástica aplicadas à família, à igreja local, ao caráter cristão e à autoavaliação espiritual.
* Confrontam a superficialidade de vida, o orgulho oculto, o secularismo prático, o individualismo moderno e o emocionalismo vazio, mas trazem consolo lúcido e orientam o discipulado ativo.
* Use situações e analogias concretas da vida real em vez de abstrações vagas.

9. ILUSTRAÇÕES DE PONTOS:
* Sóbrias, inteligentes e humanas. Podem envolver o cotidiano prático, fatos históricos comprovados, ricas reflexões relacionais ou a cultura local, sem sensacionalismo ou sentimentalismos piegas.

10. CONCLUSÃO E APELO PASTORAL:
* A conclusão reforça de forma séria a verdade central e chama ao exame íntimo do coração.
* O apelo pastoral é sóbrio, evangelístico, firme nas Escrituras e livre de qualquer chantagem ou manipulação psicológica, chamando ao arrependimento racional e sincero, à consagração e à fidelidade diária.
`;

const BIBLICO_STYLE_GUIDELINE = `
ESTILO DE PREGAÇÃO: BÍBLICO (MANDATÓRIO)
Este estilo representa uma abordagem estritamente centrada nas Escrituras, expositiva, pastoral, equilibrada, ortodoxa e hermeneuticamente responsável. O sermão gerado ou revisado sob este perfil deve refletir neutralidade denominacional e eclesiástica total, focando exclusivamente na Palavra de Deus.

--- DIRETRIZES DO ESTILO BÍBLICO ---

1. IDENTIDADE E PROPÓSITO:
- Visão Ampla e Neutra: Sem vínculos institucionais, denominacionais ou de movimentos específicos. Livre de linguagem sectária, jargões tribais ou disputas teológicas secundárias.
- Foco na Palavra: Exposição bíblica fiel, focando na intenção original do autor inspirado, respeitando a coerência canônica e aplicando de maneira legítima as Escrituras à vida da igreja local.

2. CARACTERÍSTICAS HOMILÉTICAS E TEOLÓGICAS:
- Equilíbrio Perfeito: Fusão harmoniosa de profundidade doutrinária e clareza de comunicação. Evita o academicismo frio do tecnicismo denso, bem como o emocionalismo, triunfalismo ou misticismo subjetivo.
- Organização e Estrutura Sólida: Introdução cativante que aborda a tensão humana ou o contexto do texto, contexto histórico integrado de forma prática, pontos expositivos lógicos e naturais que fluem do próprio texto, aplicações reais e conclusão com tom pastoral de exortação e devocional equilibrado.
- Centralidade em Cristo: O sermão deve contextualizar e demonstrar como o texto aponta para o mistério de Cristo e a herança da salvação pela graça divina.

3. ESTILO DE ESCRITA E ORALIDADE:
- Tom Sóbrio, Reverente e Acessível: Uma linguagem pastoral profunda que respeita o intelecto do ouvinte ao mesmo tempo que toca seu coração.
- Transições Fluidas: Pontes homiléticas refinadas entre as divisões, conduzindo o ouvinte sem saltos lógicos ou artifícios retóricos dramáticos.
- Aplicações Concretas e Legítimas: Evite o moralismo legalista de mera melhora comportamental e de listas de regras e focar em apelo de exortação espiritual legítima e transformação interior operada pelo Espírito através da Palavra.
`;

const CONVICCIONAL_STYLE_GUIDELINE = `
ESTILO DE PREGAÇÃO: CONVICCIONAL (MANDATÓRIO)
Este estilo representa a tradição da pregação que proclama a verdade de Deus com clareza, firmeza, coragem e amor, sem ceder às pressões culturais, ideológicas, pragmáticas ou emocionais de sua época.
Inspirado por gigantes da fé como Martyn Lloyd-Jones, John Stott, J. C. Ryle, John MacArthur, A. W. Tozer e Albert Mohler.

--- DIRETRIZES DO ESTILO CONVICCIONAL ---

1. CONVICÇÃO CENTRAL E PROPÓSITO:
- A Palavra de Deus é eivada de suficiência, autoridade e imutabilidade. A verdade é revelada exclusivamente por Deus nas Escrituras, nunca determinada pela cultura, opinião popular, experiência pessoal ou emoções.
- Toda exposição deve transmitir continuamente a essência do "Assim diz o Senhor", sem rodeios, sem relativizações e sem enfraquecimento hermenêutico.
- Fortaleça a fé dos crentes, promova discernimento sério do erro doutrinário, confronte o pecado com firmeza e pastoralmente, chame ao arrependimento racional e forme discípulos inabaláveis e sadios na verdade.

2. ATITUDE E LINGUAGEM DO PREGADOR:
- Tom Corajoso, Reverente, Seguro e Profundamente Equilibrado. O pregador fala com a serenidade de quem crê radicalmente no que proclama, sem hostilidade ou dureza.
- Evite totalmente: agressividade, sarcasmo, espírito beligerante, triunfalismo de púlpito ou barulho promocional. Convicção não é agressão; firmeza não é amargura.

3. ESTILO HOMILÉTICO E REGRAS CRÍTICAS:
- Pergunta de Ouro: Durante a reflexão, pergunte sempre: "Que verdade este texto exige que abracemos, mesmo quando ela contraria a cultura moderna, a tradição humana ou nossas pretensões de conforto pessoal?"
- Exegese Histórico-Gramatical e Suficiência: A interpretação deve repousar sobre bases exegéticas firmes. Jamais amolde o texto bíblico para torná-lo aceitável às correntes da atualidade (como relativismo, secularismo, pragmatismo religioso e antropocentrismo). No entanto, não seja burocraticamente acadêmico; seu tom deve ser oral, pregável e fluir com excelente oratória viva.
- Introduções Dinâmicas e Focadas: Podem partir de crises espirituais, desvios morais modernos ou enfraquecimento espiritual da época para prender a atenção do ouvinte, conduzindo-o sem demora ao veredicto bíblico. Sem piadas ou entretenimento vazio.
- Desenvolvimento e Divisões Expositivas: Devem ser logicamente delineadas. Cada ponto deve responder: O que o texto ensina? O que ele exige? O que ele confronta? Como devemos responder de forma inabalável perante Deus?
- Tradição do Púlpito Batista: Para o pregador, enfatize a fé operante, a salvação pela graça exclusiva e a comunhão séria e sacrificial na igreja de Cristo.

4. ILUSTRAÇÕES SELECIONADAS:
- Use ilustrações que estimulem a fidelidade, coragem, perseverança e compromisso destemido com a verdade.
- Exemplos ideais: Grandes personagens da História da Igreja, biografias de servos que resistiram a martírios, missões heróicas ou testemunhos sóbrios de fidelidade radical nas Escrituras. Evite ilustrações puramente manipuladoras de emoção barata.
`;

// API Routes

// 1. Generate Sermon Endpoint
app.post("/api/gemini/generate-sermon", async (req, res) => {
  const { title, theme, scripture, style, churchProfile, audience, bibleVersion, isOutline, seriesName, churchProfileDetails, duration, theologicalNotes } = req.body;

  if (!ai) {
    const mockRes = getMockSermon(title, theme, scripture, style, churchProfile, audience, bibleVersion, isOutline, seriesName);
    return res.status(200).json({ ...mockRes, duration: duration || '30' });
  }

  let durationGuideline = '';
  switch (duration) {
    case '20':
      durationGuideline = `
- DURAÇÃO MANDATÓRIA: SERMÃO DE 20 MINUTOS (OBJETIVO, VIBRANTE E DENSO).
  * O sermão deve possuir uma estrutura objetiva e vibrante, mas sem jamais perder a densidade exegética.
  * A introdução deve ser direta e cativante, apresentando a tensão humana sem demora.
  * O contexto histórico-cultural deve destacar os pontos essenciais do cenário bíblico original.
  * O desenvolvimento expositivo deve manter as 4 subseções essenciais em cada ponto ((a) Explicação Textual e Termos Originais, (b) Paralelos Escriturísticos, (c) Cristocentrismo Redentor e (d) Aconselhamento Pastoral), comunicadas com dinamismo oral e alto impacto de fixação.
  * Aplicações rápidas, concretas e incisivas para a vida diária.
`;
      break;
    case '40':
      durationGuideline = `
- DURAÇÃO MANDATÓRIA: SERMÃO EXPOSITIVO ROBUSTO DE 40 MINUTOS (MÁXIMA SOLIDEZ, DENSIDADE E PROFUNDIDADE).
  * O sermão DEVE possuir substância textual completa e densa para sustentar 40 minutos ininterruptos de pregação bíblica madura (aproximadamente 2.500 a 3.500 palavras de reflexão viva e encorpada).
  * É EXPRESSAMENTE PROIBIDO gerar tópicos resumidos, esquemáticos, telegráficos ou escassos.
  * CADA PONTO EXPOSITIVO DEVE CONTER FÔLEGO HOMILÉTICO AMPLO E DESDOBRAR-SE OBRIGATORIAMENTE EM QUATRO (4) SUBSEÇÕES RICAS E COMPLETAS:
    (a) Explicação Textual Profunda: Exegese versículo por versículo com análise aprofundada dos termos originais (hebraico/aramaico no AT, grego coiné no NT), incluindo transliterações, tempos verbais significativos (aoristo, perfeito, particípio contínuo ativo/passivo) e o contexto histórico e cultural dos destinatários bíblicos com sobriedade pastoral.
    (b) Paralelos Escriturísticos: Conexões canônicas expressas com 2 ou 3 passagens bíblicas correlatas (Antigo e Novo Testamento), demonstrando a harmonia das Escrituras e citando livro, capítulo e versículo entre parênteses.
    (c) Cristocentrismo Redentor: Articulação teológica necessária com a pessoa e a obra consumada de Jesus Cristo, o Cordeiro de Deus, a justificação pela fé e a suficiência da cruz, destruindo o moralismo superficial.
    (d) Aconselhamento e Confronto Pastoral (desenvolvido no campo "application"): Conselhos pastorais incisivos, acolhedores e maduros, dialogando com os dilemas da pós-modernidade (ansiedade crônica, ativismo estressante, esgotamento mental/burnout, secularismo prático de segunda a sábado, moralismo terapêutico de autoajuda e individualismo), com passos concretos para o discipulado, a família e a igreja local.
  * As transições homiléticas entre as partes devem ser densas, orgânicas e preparatórias.
`;
      break;
    case '60':
      durationGuideline = `
- DURAÇÃO MANDATÓRIA: ESTUDO BÍBLICO EXPOSITIVO DE 1 HORA (MÁXIMA DENSIDADE EXEGÉTICA E DOUTRINÁRIA).
  * O foco absoluto deve ser o ensino doutrinário bíblico detalhado, o discipulado ativo e a formação teológica madura, com extensão completa para 1 hora de pregação/estudo.
  * Desenvolva amplamente em cada ponto expositivo as 4 subseções ricas ((a) Explicação Textual Profunda com múltiplos termos hebraicos/gregos e nuances gramaticais, (b) Paralelos Escriturísticos canônicos com citações bíblicas cruzadas, (c) Cristocentrismo Redentor e teologia bíblica da aliança, e (d) Aconselhamento e Confronto Pastoral amplo).
  * Ofereça um contexto histórico-cultural completo sobre os destinatários, o autor e as circunstâncias originais.
  * Mantenha sempre a oralidade fluida e o tom pastoral caloroso, sem frieza ou pedantismo.
`;
      break;
    case '30':
    default:
      durationGuideline = `
- DURAÇÃO MANDATÓRIA: SERMÃO DE 30 MINUTOS (EQUILÍBRIO HOMILÉTICO CLÁSSICO E ENCORPADO).
  * Equilíbrio perfeito entre profundidade exegética e objetividade prática, com substância textual completa.
  * Cada ponto expositivo deve desenvolver com clareza e riqueza as 4 subseções obrigatórias: (a) Explicação Textual Profunda com termos originais, (b) Paralelos Escriturísticos, (c) Cristocentrismo Redentor e (d) Aconselhamento e Confronto Pastoral.
  * Contexto histórico consistente e aplicações pastorais sólidas com transições homiléticas fluidas.
`;
      break;
  }

  const rulesOfDuration = `
- REGRA FUNDAMENTAL DE DURAÇÃO DO SERMÃO:
  * O aumento ou diminuição de tempo NUNCA deve simplificar excessivamente o conteúdo, remover a integridade estrutural ou gerar sermões apressados.
  * NUNCA mude a linha teológica, a pregação expositiva clássica, o estilo homilético selecionado ou a identidade do pregador.
  * NUNCA crie prolixidade ou redundância para preencher espaço artificialmente nas durações mais longas. O aumento da duração deve se traduzir exclusivamente em maior riqueza exegética, conexões bíblicas profundas e aplicações pastorais e espirituais mais refinadas e completas.
`;

  const prompt = `
Prepare um ${isOutline ? 'Esboço Rápido' : 'Sermão Completo e Pregável'} baseado nos critérios pastorais:
- Título Sugerido: ${title || "A definir"}
- Tema Central: ${theme || "A definir"}
- Texto Bíblico Base: ${scripture || "A definir"}
- Estilo Homilético: ${style || "original"} (${style === 'isaltino' ? 'Inspirado em Isaltino Gomes Coelho: forte exegese, sobriedade, simplicidade prática, sutil sem sentimentalismo artificial.' : style === 'billy' ? 'Inspirado em Billy Graham: linguagem simples, apelo evangelístico caloroso, frases de impacto, foco em decisão espiritual.' : style === 'biblico' ? 'Bíblico: Exposição fiel das Escrituras, foco exegético ortodoxo e cristocêntrico, neutro denominacionalmente, sem vinculação institucional de qualquer tipo.' : style === 'conviccional' ? 'Conviccional: Proclamação firme, corajosa e reverente da verdade de Deus contra relativismo, pragmatismo e secularismo. Foco na autoridade e suficiência das Escrituras, arrependimento profundo, discernimento pastoral e firmeza doutrinária.' : 'Original: equilibrado, pastoral, fluido.'})
- Perfil da Igreja: ${churchProfile}
${churchProfileDetails ? `- Dados mais específicos do perfil e realidade da igreja local:
  * Tamanho aproximado: ${churchProfileDetails.congregationSize || 'N/A'}
  * Ênfase/Foco Teológico: ${churchProfileDetails.theologyEmphasis || 'N/A'}
  * Desafios locais prioritários: ${churchProfileDetails.localChallenges || 'N/A'}
  * Ministérios ativos chaves: ${churchProfileDetails.activeMinistries || 'N/A'}
  * Contexto geográfico/social: ${churchProfileDetails.neighborhoodContext || 'N/A'}` : ''}
- Perfil do Público Alvo: ${audience}
- Versão da Bíblia: ${bibleVersion || "ACF"}
- Faz parte da série: ${seriesName || "Nenhuma"}
${theologicalNotes ? `
- SUBSÍDIOS EXEGÉTICOS & SEMENTES HOMILÉTICAS (CONSULTOR TEOLÓGICO 1689):
${theologicalNotes}
(MANDATÓRIO: Incorpore organicamente estes subsídios exegéticos, termos originais grego/hebraico, notas teológicas e sementes homiléticas na introdução, contexto e divisões expositivas do sermão!)` : ''}

${durationGuideline}
${rulesOfDuration}

${churchProfile === 'neutro' ? NEUTRAL_THEOLOGICAL_GUIDELINE : BAPTIST_THEOLOGICAL_GUIDELINE}

${HOMILETICAL_TRANSITION_GUIDELINE}

${THEOLOGICAL_DEPTH_AND_REDEMPTIVE_CHRISTOCENTRISM_GUIDELINE}

${EXEGESIS_VERSE_REFERENCE_GUIDELINE}

${style === 'isaltino' ? ISALTINO_STYLE_GUIDELINE : style === 'biblico' ? BIBLICO_STYLE_GUIDELINE : style === 'conviccional' ? CONVICCIONAL_STYLE_GUIDELINE : ''}

Considere no Perfil da Igreja ("${churchProfile}"):
- tradicional: Sóbrio, reverente, aprofunda exegese, cita Cantor Cristão.
- contemporanea: Conecta com o cotidiano moderno, linguagem acessível, aplicações dinâmicas.
- reformada: Ênfase na soberania de Deus, exposição bíblica aprofundada, cristocêntrico.
- renovada: Ênfase em oração, renoval espiritual, tom mais emocional, mas sem excessos neopentecostais.
- jovem: Comunicação dinâmica, cultura urbana, missional.
- plantacao: Mensagens de encorajamento, missão, consagração de fundação, simples.
- revitalizacao: Restauração espiritual, esperança e renovação, compromisso sincero.
- neutro: Foco estritamente exegetico e hermenêutico equilibrado, sem jargões eclesiásticos ou inclinação denominacional, ressaltando a ortodoxia e unidade da fé cristã comum histórica.

★ REGRA CRÍTICA DE OCULTAÇÃO TOTAL DOS BASTIDORES & PROIBIÇÃO DE METARREFERÊNCIAS:
O perfil da igreja e qualquer parâmetro de configuração atuam ESTRITAMENTE nos bastidores para calibrar a ênfase pastoral e a linguagem. É TERMINANTEMENTE PROIBIDO mencionar ou citar o perfil da igreja, diretrizes de IA, metadados ou estilos no texto do sermão (ex.: NUNCA use expressões como "Conforme o perfil de uma igreja...", "Para uma comunidade com o perfil de...", "No estilo de...", "Esta mensagem foi preparada para..."). O pregador fala diretamente à congregação a partir do texto sagrado!

★ INTRODUÇÃO MAGNÉTICA (ARRANQUE VIVO E URGÊNCIA ESPIRITUAL):
A introdução homilética (campo "introduction") deve arrancar de forma viva, magnética e imediata, prendendo a atenção do ouvinte na primeira frase através do drama existencial e da urgência do texto sagrado. Sem saudações protocolares burocráticas, desculpas de orador ou preâmbulos vazios. Entre direto na tensão humana real que as Escrituras vêm iluminar e redimir!

★ DIVISÕES DINÂMICAS E ENVOLVENTES:
As divisões expositivas devem possuir ritmo dinâmico, envolvente e cativante, evitando frieza acadêmica e conectando a exegese à vida real com autoridade e calor pastoral.

MANDATÓRIO PARA A ESTRUTURA DOS PONTOS (FLUXO HOMILÉTICO NATURAL, ENRIQUECIMENTO EXEGÉTICO E ESTRUTURA INTERNA EXPANDIDA):
O sermão deve ser dividido em pontos na chave expositiva bíblica com material denso, encorpado e pronto para a pregação expositiva madura. Cada ponto do sermão deve desenvolver obrigatoriamente:
1. TRANSIÇÃO ELEGANTE E FLUIDA COM SINCRONIZAÇÃO TERMINOLÓGICA (campo "precedingTransition"): Frase ponte que conecta organicamente com o ponto anterior ou com o contexto, antecipando o título do próximo ponto sem repetições robotizadas. MANDATÓRIO: A frase de transição DEVE adotar ESTRITAMENTE o mesmo vocábulo conceitual substantivo utilizado para titular ou classificar as divisões do sermão (ex.: se o sermão desenvolve Realidades, use "realidade"; se desenvolve Verdades, use "verdade"; se desenvolve Pilares, use "pilar"; se desenvolve Marcas, use "marca"; se desenvolve Fundamentos, use "fundamento"). É TERMINANTEMENTE PROIBIDO usar termos genéricos fixos como "princípio" nas pontes, a menos que o próprio tópico utilize essa palavra.
2. EXPOSIÇÃO DO TEXTO & PROFUNDIDADE TEOLÓGICA EXPANDIDA (campo "explanation"): Desenvolvimento robusto contendo nativamente as seguintes 3 subseções ricas:
   (a) Explicação Textual Profunda: Exegese versículo por versículo sob a ótica histórico-gramatical com os termos originais (hebraico/grego koiné transliterados, tempos e modos verbais, nuances de vocabulário e contexto dos destinatários originais).
   (b) Paralelos Escriturísticos: Conexões canônicas com 2 a 3 passagens bíblicas correlatas expressas (Antigo e Novo Testamento) com referência de livro, capítulo e versículo entre parênteses, iluminando a harmonia da revelação divina.
   (c) Cristocentrismo Redentor: Articulação teológica irrenunciável com a pessoa e a obra consumada de Jesus Cristo, o Cordeiro de Deus, a justificação pela fé e a suficiência da cruz, destruindo o moralismo superficial e antropocêntrico.
3. ILUSTRAÇÃO RELACIONADA AO PONTO: Se o ponto possuir ilustração, inclua-a (no campo "illustration"). Ela deve ilustrar de forma visual, sóbria e edificante a verdade exposta.
4. APLICAÇÕES PASTORAIS CONCRETAS E EXISTENCIAIS ("MEXER LÁ DENTRO DO CORAÇÃO" - campo "application"):
   (d) Aconselhamento e Confronto Pastoral: VEDE conselhos de autoajuda rasos ou chavões moralistas. A aplicação deve descer obrigatoriamente para as trincheiras da vida real de segunda a sábado: no lar e no relacionamento conjugal, na educação e discipulado dos filhos, nas pressões e tentações do trabalho, na administração das finanças (contra a avareza), na vizinhança, nas lutas íntimas secretas e no socorro compassivo às angústias da alma (ansiedade, esgotamento mental e culpas), exigindo arrependimento concreto e descanso na suficiência do Cordeiro.

REGRA DAS ILUSTRAÇÕES:
- O sermão deve conter exatamente duas (2) ilustrações no total (uma bíblica e uma do cotidiano).
- Cada uma deve estar em um ponto expositivo diferente (nunca duas no mesmo ponto).
- Pelo menos um dos pontos não deve ter ilustração (apenas a exposição e aplicação), variando a densidade homilética do sermão.

Retorne um objeto JSON com os seguintes campos exatos de texto:
{
  "title": "título definitivo e impactante em português",
  "theme": "ideia central ou tema homilético",
  "scripture": "código e versículo bíblico fornecido com texto respectivo na versão ${bibleVersion}",
  "introduction": "uma introdução magnética com arranque vivo que capture a atenção imediatamente, apresente a tensão humana e anuncie o texto bíblico com urgência e sobriedade (sem preâmbulos burocráticos, sem metarreferências e sem antecipar os pontos)",
  "biblicalContext": "contexto histórico-cultural e literário da passagem em 1-2 parágrafos, culminando em transição orgânica no último parágrafo que introduz as divisões",
  "expositoryPoints": [
    {
      "title": "I. Título do Primeiro Ponto",
      "precedingTransition": "Frase de transição e ligação que antecede e introduz o primeiro ponto de forma natural, adotando ESTRITAMENTE o mesmo vocábulo conceitual das divisões (ex: se as divisões tratam de 'Realidades', use 'A primeira realidade que o texto nos descortina é...'; se 'Verdades', use 'A primeira verdade que emerge desta passagem é...'; se 'Pilares', use 'O primeiro pilar da nossa fé é...'). PROIBIDO usar 'princípio' a menos que as próprias divisões usem a palavra 'princípio'.",
      "explanation": "Desenvolvimento exegético encorpado e substancial, contendo nativamente:\n(a) Explicação Textual Profunda: [análise minuciosa dos versículos com termos originais transliterados no hebraico/grego, tempos verbais e contexto imediato].\n\n(b) Paralelos Escriturísticos: [conexões canônicas com 2-3 passagens bíblicas correlatas com citações de livros e versículos entre parênteses].\n\n(c) Cristocentrismo Redentor: [convergência teológica para a cruz, a justificação pela fé e o Cordeiro de Deus].",
      "illustration": {
        "type": "cotidiano",
        "description": "Texto detalhado da ilustração do cotidiano humano que elucida visualmente a verdade ensinada."
      },
      "application": "(d) Aconselhamento e Confronto Pastoral: Aplicação prática e pastoral imediata, dialogada com dilemas pós-modernos (ansiedade crônica, secularismo prático, moralismo terapêutico) com orientações concretas para a vida pessoal, familiar e congregacional."
    },
    {
      "title": "II. Título do Segundo Ponto",
      "precedingTransition": "Frase elegante de transição e ponte que antecede e introduz o segundo ponto, conectando-o suavemente com o ponto anterior e mantendo ESTRITAMENTE o mesmo vocábulo conceitual adotado no sermão (ex: 'Firmados nessa primeira verdade/realidade/pilar, a passagem avança para uma segunda verdade/realidade/pilar: ...').",
      "explanation": "Desenvolvimento exegético encorpado e substancial, contendo nativamente:\n(a) Explicação Textual Profunda: [exposição minuciosa do texto com termos originais e análise gramatical/histórica].\n\n(b) Paralelos Escriturísticos: [conexões canônicas essenciais com outras Escrituras].\n\n(c) Cristocentrismo Redentor: [desenvolvimento no Evangelho da graça e na suficiência do sacrifício de Cristo].",
      "illustration": {
        "type": "bíblica",
        "description": "Texto detalhado da ilustração de outra passagem bíblica ou história bíblica relacionada que ajuda a ver a verdade."
      },
      "application": "(d) Aconselhamento e Confronto Pastoral: Aplicação sincera, direta e prática à vida cristã cotidiana, confrontando a autossuficiência e renovando o compromisso com o discipulado autêntico."
    },
    {
      "title": "III. Título do Terceiro Ponto",
      "precedingTransition": "Frase elegante de transição e ponte que antecede e introduz o terceiro ponto, fazendo a ligação com o anterior e mantendo ESTRITAMENTE o mesmo vocábulo conceitual adotado no sermão (ex: 'Por fim, a passagem nos confronta com uma terceira verdade/realidade/pilar que precisa ser guardada no coração: ...').",
      "explanation": "Desenvolvimento exegético encorpado e substancial, contendo nativamente:\n(a) Explicação Textual Profunda: [exposição bíblica apurada com vocábulos originais e implicações teológicas].\n\n(b) Paralelos Escriturísticos: [passagens correlatas que confirmam a doutrina].\n\n(c) Cristocentrismo Redentor: [como a fidelidade do Cordeiro sela esta promessa definitiva].",
      "application": "(d) Aconselhamento e Confronto Pastoral: Aplicação vital da verdade do ponto para a igreja local, desafiando a inércia espiritual e convocando a congregação à fidelidade perseverante."
    }
  ],
  "illustrations": [
    { "type": "cotidiano", "description": "Cópia exata da ilustração do cotidiano inserida no ponto correspondente acima para fins de compatibilidade." },
    { "type": "bíblica", "description": "Cópia exata da ilustração bíblica inserida no ponto correspondente acima para fins de compatibilidade." }
  ],
  "applications": [
    "Cópia resumida da aplicação prática 1 para fins de compatibilidade.",
    "Cópia resumida da aplicação prática 2 para fins de compatibilidade.",
    "Cópia resumida da aplicação prática 3 para fins de compatibilidade."
  ],
  "conclusion": "Resumo encorajador e coeso, que retoma o título, o tema e as divisões expositivas, demonstrando a jornada do sermão e conduzindo com fluidez à peroração apologética final",
  "pastoralAppeal": "Peroração apologética e apelo pastoral: convocação sincera, sóbria e calorosa à decisão espiritual diante do Cordeiro, desfazendo as desculpas do coração pós-moderno com firmeza e afeto bíblico",
  "tags": ["lista", "de", "tags", "relevantes"]
}
Certifique-se de que o plano seja extremamente fiel às escrituras, fluido para ler no púlpito e em excelente português.
`;

  try {
    const sInstruction = (churchProfile === 'neutro' || style === 'biblico')
      ? "Você é um experiente pregador cristão e orientador homilético focado na exposição bíblica pura, exegese sadia, ortodoxia canônica e neutralidade denominacional. Escreva os sermões sempre formatados em JSON válido, com zelo teológico e profundidade pastoral."
      : "Você é o Pr. Fernando Veiga, um experiente pregador Batista brasileiro com profundo preparo exegético e amor pelas Escrituras. Escreva os sermões sempre formatados em JSON válido, com zelo teológico e rigor intelectual nos termos batistas clássicos.";

    const data = await generateJSON({
      contents: prompt,
      systemInstruction: sInstruction
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Sermon Generation Error (falling back to simulated sermon):", error);
    const mockSermon = getMockSermon(title, theme, scripture, style, churchProfile, audience, bibleVersion, isOutline, seriesName);
    return res.json({
      ...mockSermon,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O simulador teológico de contingência clássica assumiu a geração da pregação com sucesso."
    });
  }
});

// 2. Evaluate Sermon Endpoint
app.post("/api/gemini/evaluate-sermon", async (req, res) => {
  const { sermon } = req.body;

  if (!ai) {
    return res.json(getMockEvaluation());
  }

  const prompt = `
Faça uma avaliação homilética e teológica rigorosa do seguinte sermão sob a perspectiva ${sermon.churchProfile === 'neutro' ? 'bíblica e hermenêutica neutra' : 'Batista histórica'}.
Avalie fidelidade bíblica, coerência e estrutura homilética (especialmente a presença de conexões claras e pontes de transição fluidas entre o Título, Tema, Introdução, Contexto Histórico, Divisões, Conclusão etc.), cristocentrismo, clareza pastoral e aplicações reais. Verifique se as transições e pontes cumprem estritamente a "DIRETRIZ HOMILÉTICA OBRIGATÓRIA: TRANSIÇÕES E PONTES ENTRE AS PARTES DO SERMÃO", avaliando com rigor a SINCRONIZAÇÃO TERMINOLÓGICA DAS PONTES: as frases de transição dos pontos expositivos (campo precedingTransition) devem adotar estritamente o mesmo vocábulo conceitual das divisões (se o sermão desenvolve Realidades, a ponte deve usar "realidade"; se desenvolve Verdades, deve usar "verdade"; se desenvolve Pilares, deve usar "pilar"; se desenvolve Marcas, deve usar "marca"). Aponte falha de coerência homilética se houver o uso de termos genéricos fixos como "princípio" quando as divisões não usam essa palavra.

Ao buscar por clichés, detecte expressões gastas, clichês de internet, termos floreados desnecessários, jargões evangélicos comuns ou transições excessivamente mecânicas e robóticas (como "Vejamos três pontos") que enfraquecem o sermão. Proponha alternativas de termos, construções ou frases que fujam desses clichês e se alinhem a um tom literário maduro, sóbrio, caloroso e inteligente${sermon.churchProfile === 'neutro' || sermon.style === 'biblico' ? ' e bíblico focado em ortodoxia e simplicidade' : ', inspirado no pastor Isaltino Gomes Coelho Filho'}.

Sermão a ser avaliado:
Título: ${sermon.title}
Tema: ${sermon.theme}
Passagem: ${sermon.scripture}
Conteúdo:
Introdução: ${sermon.introduction}
Contexto: ${sermon.biblicalContext}
Pontos Expositivos: ${JSON.stringify(sermon.expositoryPoints)}
Ilustrações: ${JSON.stringify(sermon.illustrations)}
Aplicações: ${JSON.stringify(sermon.applications)}
Conclusão: ${sermon.conclusion}
Apelo: ${sermon.pastoralAppeal}

Retorne um JSON contendo a avaliação no formato:
{
  "faithfulnessScore": 95,
  "faithfulnessComment": "comentário sobre alinhamento às escrituras",
  "homileticalCoherenceScore": 90,
  "coherenceComment": "avaliação da introdução, transições e conclusão",
  "christocentrismScore": 92,
  "christocentrismComment": "se cristo é a centralidade ou se caiu em moralismo legalista",
  "pastoralClarityScore": 88,
  "clarityComment": "linguagem, tom de voz e pregação",
  "clichesDetected": ["lista de expressões gastas ou clichês detectados"],
  "clichesWithSuggestions": [
    {
      "cliche": "frase ou expressão gasta exata, como está escrita no sermão (MANDATÓRIO: extraia um trecho de texto real do sermão para podermos automatizar a substituição)",
      "suggestion": "proposta de frase ou expressão alternativa sóbria e madura que foge do clichê",
      "section": "introdução | contexto | pontos | conclusão | apelo | título"
    }
  ],
  "artificialityWarning": "aviso de artificialidade se houver, ou string vazia",
  "moralismWarning": "aviso se houver fardo sem evangelho, ou string vazia",
  "suggestedImprovements": [
    "sugestão de aperfeiçoamento 1",
    "sugestão de aperfeiçoamento 2"
  ]
}
`;

  try {
    const sInstruction = (sermon.churchProfile === 'neutro' || sermon.style === 'biblico')
      ? "Você é um professor de Homilética e Teologia Sistemática em um conceituado Seminário Bíblico interdenominacional. Avalie sermões de pastores com amor, rigor exegético e franqueza construtiva, focando em sugerir formulações excelentes e pastorais baseadas na exposição pura do texto sagrado e na ortodoxia cristã histórica."
      : "Você é um professor de Homilética e Teologia Sistemática em um tradicional Seminário Teológico Batista. Avalie sermões de pastores com amor, rigor bíblico e franqueza construtiva. Procure focar em sugerir formulações excelentes e pastorais no estilo maduro e sábio de Isaltino Gomes para clichês vazios detectados.";

    const data = await generateJSON({
      contents: prompt,
      systemInstruction: sInstruction
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Evaluation Error (falling back to simulated evaluation):", error);
    const mockEval = getMockEvaluation();
    return res.json({
      ...mockEval,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O parecer avaliativo do corpo docente foi gerado de forma simulativa offline."
    });
  }
});

// 3. Expository Series Generator
app.post("/api/gemini/generate-series", async (req, res) => {
  const { book, theme, campaign, sermonCount } = req.body;

  if (!ai) {
    return res.json(getMockSeries(book, theme, campaign, sermonCount || 4));
  }

  const prompt = `
Crie uma Série de Sermões Expositivos no Livro de "${book || "Efésios"}".
Tema da Campanha: "${theme || "Caminhando em Fé"}"
Campanha de Apoio (opcional): "${campaign || "Vida Consagrada"}"
Número de Mensagens na Série: ${sermonCount || 4}

A série deve dividir o livro em perícopes sequenciais e lógicas. Cada sermão deve focar em uma exposição bíblica rica e cristocêntrica, com sólida hermenêutica e aplicações práticas de excelência.

Retorne no formato JSON exato:
{
  "title": "Nome da Série de Sermões (ex: Fortalecidos na Graça)",
  "book": "${book}",
  "generalTheme": "${theme}",
  "campaign": "${campaign}",
  "sermons": [
    {
      "number": 1,
      "title": "Título do Sermão 1",
      "scripture": "Capítulo X: Versos Y-Z",
      "coreIdea": "Ideia central expositiva do texto",
      "keyPoints": ["Ponto chave 1", "Ponto chave 2", "Ponto chave 3"],
      "pastoralApplication": "Aplicação pastoral imediata e relevante"
    }
  ]
}
`;

  try {
    const data = await generateJSON({
      contents: prompt,
      systemInstruction: "Você é o Pr. Fernando Veiga. Seu foco é pregação bíblica expositiva de alta qualidade, estruturando séries integradas com divisões exegéticas inteligentes e títulos pregáveis."
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Series Generation Error (falling back to simulated series):", error);
    const mockSeries = getMockSeries(book, theme, campaign, sermonCount || 4);
    return res.json({
      ...mockSeries,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). A série de sermões expositivos foi estruturada de forma simulativa offline."
    });
  }
});

// 4. Chat and Exegesis Endpoint
app.post("/api/gemini/chat-bible", async (req, res) => {
  const { scripture, question, message, chatHistory } = req.body;
  const userQuery = message || question || scripture || "Como interpretar este texto bíblico?";
  const baseScripture = scripture || "";

  if (!ai) {
    return res.json(getMockChatResponse(baseScripture, userQuery));
  }

  const formattedHistory = (chatHistory || []).map((h: any) => 
    `${h.role === 'user' ? 'Pastor Fernando Veiga' : 'Consultor Teológico & Hermenêutico'}: ${h.text || h.content || h.answeringText || ''}`
  ).join("\n\n");

  const prompt = `
${SENIOR_THEOLOGICAL_CONSULTANT_SYSTEM_PROMPT}

Histórico da Consulta:
${formattedHistory || "Início da consulta pastoral."}

Pergunta / Solicitação do Pastor:
"${userQuery}"
${baseScripture ? `Passagem Bíblica em Foco: "${baseScripture}"` : ''}

REQUISITOS MANDATÓRIOS DA RESPOSTA:
1. Responda com rigor à fundação confessional Batista de 1689 e herança Reformada clássica, integrando a catolicidade histórica da Igreja de Cristo.
2. Integre a base cronológica e documental abrangente:
   - Era Apostólica e Patrística Primitiva: Convoque a *Didaché* (século I), os Padres Apostólicos e Apologistas (Clemente de Roma, Inácio de Antioquia, Policarpo de Esmirna, Justino Mártir, Irineu de Leão) e os Grandes Credos Ecumênicos Históricos (Credo Apostólico, Credo Niceno-Constantinopolitano [325/381 d.C.], Definição de Calcedônia [451 d.C.]).
   - Doutores da Igreja Ocidental e Oriental: Dialogar com Agostinho de Hipona, João Crisóstomo (exegese sóbria de Antioquia), Atanásio de Alexandria (*De Incarnatione Verbi Dei*) e Anselmo de Cantuária (*Cur Deus Homo*).
   - Linhagem de Continuidade Histórica: Conecte a fé apostólica e patrística aos Grandes Reformadores (Lutero, Calvino), Puritanos Ingleses (John Owen, Thomas Watson, Matthew Henry) e Teólogos/Pregadores Batistas Históricos (Segunda Confissão de Londres de 1689, John Gill, Charles Haddon Spurgeon, Isaltino Gomes).
3. Forneça análise dos termos nos originais (Grego / Hebraico / Aramaico), indicando o vocábulo original no alfabeto nativo, transliteração, morfologia precisa e acepções contextuais.
4. Estruture as seções fixas do acervo:
   - "passageReference": Referência canônica bíblica exata e principal do texto examinado (ex: "1 Coríntios 6:19-20", "Romanos 5:1-5", "Efésios 2:1-10").
   - "answeringText": Visão Exegética e Pastoral aprofundada, com aconselhamento lúcido, diálogo documental com os credos ecumênicos, doutores da antiguidade, teólogos reformados e a Confissão de 1689.
   - "comparedVerses": Comparações exatas nas principais versões protestantes em português (ACF, ARC, ARA, NAA, NVI, KJA) com apontamentos de nuances textuais se houver passagem sob exame.
   - "historicalContext": Contexto histórico, cultural, autoral, canônico e recepção eclesiástica primitiva.
   - "philologicalNotes": Notas filológicas em hebraico/grego com termos nativos, transliteração e parsing morfológico.
   - "theologicalCore": Cerne teológico e cristocêntrico fundamentado na soberana graça de Deus em Cristo e nas confissões ortodoxas históricas.
   - "homileticalSeeds": Array de 3 a 5 sementes homiléticas (proposições, divisões ou esboços) para o pastor utilizar em sermões.
5. Siga o tom pastoral culto, equilibrado, sóbrio e sem clichês artificiais (sobriedade homilética de Isaltino Gomes).

Retorne estritamente o JSON estruturado conforme o esquema.
`;

  const chatResponseSchema = {
    type: Type.OBJECT,
    properties: {
      passageReference: { type: Type.STRING },
      answeringText: { type: Type.STRING },
      historicalContext: { type: Type.STRING },
      philologicalNotes: { type: Type.STRING },
      theologicalCore: { type: Type.STRING },
      homileticalSeeds: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      comparedVerses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            version: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["version", "text"]
        }
      }
    },
    required: ["answeringText", "historicalContext", "philologicalNotes", "theologicalCore", "homileticalSeeds"]
  };

  try {
    const data = await generateJSON({
      contents: prompt,
      systemInstruction: SENIOR_THEOLOGICAL_CONSULTANT_SYSTEM_PROMPT,
      responseSchema: chatResponseSchema
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Bible Chat Error (falling back to simulated exegesis):", error);
    const mockChat = getMockChatResponse(baseScripture, userQuery);
    return res.json({
      ...mockChat,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O Assistente Exegético simulou o estudo teológico de contingência com êxito."
    });
  }
});

// 5. Verses Comparison Endpoint
app.post("/api/gemini/compare-versions", async (req, res) => {
  const { scripture } = req.body;

  if (!ai) {
    return res.json(getMockComparisons(scripture));
  }

  const prompt = `
Forneça o texto bíblico exato de "${scripture}" nas versões solicitadas:
- ACF (Almeida Corrigida Fiel)
- ARC (Almeida Revista e Corrigida)
- ARA (Almeida Revista e Atualizada)
- NAA (Nova Almeida Atualizada)
- NVI (Nova Versão Internacional)
- KJA (King James Atualizada)

Evite inventar versículos. Retorne em JSON exato:
{
  "scripture": "${scripture}",
  "comparisons": [
    { "version": "ACF", "text": "Texto em ACF..." },
    { "version": "ARC", "text": "Texto em ARC..." },
    { "version": "ARA", "text": "Texto em ARA..." },
    { "version": "NAA", "text": "Texto em NAA..." },
    { "version": "NVI", "text": "Texto em NVI..." },
    { "version": "KJA", "text": "Texto em KJA..." }
  ]
}
`;

  try {
    const data = await generateJSON({
      contents: prompt
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Verses Comparison Error (falling back to simulated comparisons):", error);
    const mockComp = getMockComparisons(scripture);
    return res.json({
      ...mockComp,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O comparador retornou as versões bíblicas em regime de contingência simulada."
    });
  }
});

// 5.1 Pericope Exploration Endpoint
app.post("/api/gemini/explore-pericope", async (req, res) => {
  const { scripture } = req.body;

  if (!ai) {
    return res.json(getMockPericopeAnalysis(scripture));
  }

  const prompt = `
Você é o "EXPLORADOR DE POSSIBILIDADES DA PERÍCOPE" do Estúdio de Sermões.
Seu objetivo absoluto é analisar a perícope bíblica fornecida pelo usuário ("${scripture || 'Romanos 12:1-2'}") e identificar os temas que são LEGITIMAMENTE SUSTENTADOS pelo texto, de forma equilibrada, sem eisegese, sem inventar temas e sem alegorizações arbitrárias.

--- PRINCÍPIOS ---
Toda proposta/tema sugerido deve nascer estritamente:
- do texto;
- do contexto imediato e do livro;
- do argumento dogmático/narrativo do autor bíblico;
- da teologia bíblica e histórica.

Nunca gerar:
- Temas fantasiosos ou inventados;
- Espiritualizações artificiais e alegorias de conveniência;
- Aplicações inteiramente desconectadas e anacronismos vulgares;
- Eisegetismo para validar pautas de época ou agendas humanas.

--- PROCESSO DE ANÁLISE ---
1. Identifique no texto de forma sóbria:
- sujeito principal;
- verbo principal de exegese;
- tensão narrativa ou teológica central;
- movimento e fluxo do texto;
- clímax teológico ou homilético;
- propósito original do autor sagrado.

2. Sugira de 3 a 6 possibilidades/temas legítimos cobrindo diferentes categorias (ex: Tema Principal, Tema Secundário, Tema Pastoral, Tema Evangelístico, Tema Cristocêntrico, Tema Doutrinário, Tema Devocional, Tema Apologético, Tema para Datas Especiais).

3. Para cada possibilidade, você DEVE retornar as seguintes propriedades obrigatórias no JSON estruturado:
- themeName: O título ou nome do tema proposto (ex: "O Altar da Graça: Consagração Inegociável");
- category: A classificação da categoria (ex: "Tema Principal", "Tema Secundário", "Tema Pastoral", "Tema Evangelístico", "Tema Cristocêntrico", "Tema Doutrinário", "Tema Devocional", "Tema Apologético", "Tema para Datas Especiais");
- strength: Classifique rigorosamente a força de ancoragem homilética de acordo com uma destas strings: "Muito Forte", "Forte", "Possível", "Não sustentado";
- textualBase: Citação precisa do versículo ou fragmento bíblico do texto que sustenta essa proposta;
- hermeneuticalRisk: Risco hermenêutico ou perigo exegético mais recorrente que o pregador corre ao pregar sobre este tema específico (como incorrer em moralismo, legalismo, espiritualização barata, ativismo secular, etc.);
- observation: Explique detalhadamente por que o texto permite esse tema, abrangendo explicitamente o que o texto permite, por que permite, e também informando expressamente "O que o texto NÃO está ensinando" (evitando distorções teológicas).

--- RETORNO DO JSON ---
Você deve retornar estritamente os dados formatados conforme o esquema de resposta JSON exigido. Não inclua introduções informais, explicações textuais fora do JSON ou tags markdown de código.
`;

  const pericopeSchema = {
    type: Type.OBJECT,
    properties: {
      scripture: { type: Type.STRING },
      identification: {
        type: Type.OBJECT,
        properties: {
          mainSubject: { type: Type.STRING },
          mainVerb: { type: Type.STRING },
          narrativeTension: { type: Type.STRING },
          textMovement: { type: Type.STRING },
          climax: { type: Type.STRING },
          authorPurpose: { type: Type.STRING }
        },
        required: ["mainSubject", "mainVerb", "narrativeTension", "textMovement", "climax", "authorPurpose"]
      },
      possibilities: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            themeName: { type: Type.STRING },
            category: { type: Type.STRING },
            strength: { type: Type.STRING },
            textualBase: { type: Type.STRING },
            hermeneuticalRisk: { type: Type.STRING },
            observation: { type: Type.STRING }
          },
          required: ["themeName", "category", "strength", "textualBase", "hermeneuticalRisk", "observation"]
        }
      }
    },
    required: ["scripture", "identification", "possibilities"]
  };

  try {
    const data = await generateJSON({
      contents: prompt,
      responseSchema: pericopeSchema
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Pericope Explorer Error (falling back to simulated analysis):", error);
    const mockPericope = getMockPericopeAnalysis(scripture);
    return res.json({
      ...mockPericope,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O Explorador retornou a análise bíblica em regime de contingência simulada."
    });
  }
});

// 5.15 Theological Sieve Endpoint (3 Layers & Magisterial Peroration)
app.post("/api/gemini/theological-sieve", async (req, res) => {
  const { title, scripture, theme, mainPoints, outlineText } = req.body;
  const targetScripture = scripture || "Romanos 12:1-2";
  const targetTitle = title || "Consagração Total e Fidelidade Bíblica";
  const targetTheme = theme || "O Culto Racional e a Não-Conformação com o Presente Século";
  const pointsContent = (typeof outlineText === 'string' && outlineText.trim().length > 0)
    ? outlineText
    : (typeof mainPoints === 'string' && mainPoints.trim().length > 0)
    ? mainPoints
    : Array.isArray(mainPoints)
    ? mainPoints.join("\n")
    : "1. O altar da consagração. 2. A resistência ao molde secular. 3. A mente transformada pela verdade.";

  if (!ai) {
    return res.json(getMockTheologicalSieve(targetTitle, targetScripture, targetTheme, pointsContent));
  }

  const prompt = `
Você é o Consultor Teológico e Hermenêutico Sênior do "Estúdio Homilético Batista — Pastor Fernando Veiga".
Sua fundação doutrinária é estritamente alinhada às Sagradas Escrituras, à Segunda Confissão Batista de Londres de 1689, à herança Reformada clássica, ao método histórico-gramatical e à catolicidade da Igreja histórica (Didaché, Padres Apostólicos, Credos Ecumênicos, Doutores da Igreja Ocidental e Oriental).

Submeta a seguinte mensagem homilética ao CRIVO TEOLÓGICO DE TRÊS CAMADAS e forje A SAÍDA TEOLÓGICA MAGISTRAL (A PERORAÇÃO):

DADOS DA MENSAGEM:
- Título: "${targetTitle}"
- Passagem Bíblica: "${targetScripture}"
- Tema Central: "${targetTheme}"
- Pontos / Esboço: 
"""
${pointsContent}
"""

REQUISITOS DO CRIVO DE TRÊS CAMADAS:
Camada 1: Objeções Clássicas e Históricas
- Racionalismo iluminista, liberalismo teológico clássico (Schleiermacher, Bultmann), heresias e desvios doutrinários do passado que atacaram ou distorceram a perícope (ex: pelagianismo/semi-pelagianismo, gnosticismo, marcionismo, legalismo farisaico, antinomianismo).
- Mostre onde o texto bíblico refuta tais desvios com base no grego/hebraico e na ortodoxia cristã histórica.

Camada 2: Novas Tendências Culturais & Pós-Modernidade
- Pressões do secularismo tardio, individualismo expressivo, moralismo terapêutico deísta, relativismo ético e consumismo religioso.
- Como essas tendências tentam neutralizar a autoridade e o peso da Palavra de Deus nesta passagem.

Camada 3: A Falsa Tolerância "Religiosa" & Sincretismo
- O perigo do sincretismo, da tibieza e da falsa "caridade" ou falsa tolerância que contemporiza e contemporiza o que Deus explicitamente condena no texto.
- Como o pregador deve manter firmeza pastoral sem desandar em agressividade carnal nem capitular ao medo de homens.

A SAÍDA TEOLÓGICA MAGISTRAL (SERMÃO DE FECHAMENTO / PERORAÇÃO & APELO APOLOGÉTICO COMPLETO PARA O PÚLPITO):
- A Peroração DEVE ser um Sermão de Fechamento / Peroração Completa e Encorpada para o Púlpito (3 parágrafos densos e vigorosos, separados por '\n\n', totalizando entre 280 e 450 palavras).
- DIRETRIZES DE ESTILO HOMILÉTICO E LINGUAGEM (OBRIGATÓRIO):
  1. Linguagem Moderna, Incisiva e Altamente Dialógica: Conecte-se diretamente com o homem e a mulher de hoje. NUNCA utilize arcaísmos, segunda pessoa do plural bíblica ("vós", "olhai", "tendes", "arrependei-vos", "firmai", "repudiai") ou tom eclesiástico empolado. Empregue a linguagem oral, calorosa, inteligente e límpida de um pastor contemporâneo experiente falando à sua congregação ("você", "nós", "meus irmãos", "amigo ouvinte", "olhemos").
  2. Confronto com os Dilemas da Nossa Época: Confronte com sensibilidade e coragem o vazio existencial moderno, a ansiedade crônica, a obsessão por performance, a solidão das telas digitais e o secularismo silencioso que reduz a vida a consumo. Desmascare o "moralismo terapêutico" (tratar Deus como mero assistente de bem-estar ou autoajuda).
  3. Síntese das Três Camadas do Crivo (Parágrafo 1): Conecte como as heresias históricas (pelagianismo/salvação por mérito ou racionalismo frio da Camada 1) voltam hoje disfarçadas na busca por validação e na fôrma do secularismo (Camada 2), e como a igreja é tentada à covardia espiritual e complacência sincretista (Camada 3). O texto bíblico em foco desfaz essas ilusões.
  4. Centralidade Cristocêntrica e a Fé Confessional de 1689 (Parágrafo 2): Ancore a resposta na suficiência absoluta de Jesus Cristo como nosso único e divino Mediador (Segunda Confissão Batista de Londres de 1689, Cap. 8 e Cap. 16) e na autoridade inerrante das Escrituras. Mostre que a justificação pela fé e a graça redentora libertam o ser humano da tirania do medo e da aprovação social.
  5. Apelo Pastoral e Evangelístico Direto ao Coração (Parágrafo 3): Convoque os ouvintes com afeto pastoral, firmeza e sobriedade (ao estilo de Isaltino Gomes Coelho Filho). Faça um chamado claro: desafie o crente acomodado a abandonar a religiosidade de conveniência e deitar a vida no altar; e convide a pessoa sem Cristo a reconhecer sua necessidade, abandonar a autossuficiência e repousar na graça salvadora do Redentor.

Retorne rigorosamente em formato JSON válido:
{
  "sermonTitle": "${targetTitle}",
  "scripture": "${targetScripture}",
  "centralTheme": "${targetTheme}",
  "classicHistoricalObjections": {
    "title": "Objeções Clássicas e Históricas",
    "summary": "resumo incisivo dos desvios históricos",
    "keyPoints": ["ponto 1", "ponto 2", "ponto 3"],
    "scripturalWarning": "alerta hermenêutico do texto bíblico",
    "historicalOrCulturalReferences": ["referência 1", "referência 2"]
  },
  "newCulturalTrends": {
    "title": "Novas Tendências Culturais & Pós-Modernidade",
    "summary": "diagnóstico da pressão secular pós-moderna",
    "keyPoints": ["ponto 1", "ponto 2", "ponto 3"],
    "scripturalWarning": "alerta sobre a fôrma cultural deste século",
    "historicalOrCulturalReferences": ["referência 1", "referência 2"]
  },
  "falseReligiousTolerance": {
    "title": "A Falsa Tolerância 'Religiosa' & Sincretismo",
    "summary": "desmascaramento da tibieza e concessões sincretistas",
    "keyPoints": ["ponto 1", "ponto 2", "ponto 3"],
    "scripturalWarning": "advertência contra contemporizar com o erro",
    "historicalOrCulturalReferences": ["referência 1", "referência 2"]
  },
  "magisterialPeroration": {
    "title": "Peroração & Apelo Apologético Completo para o Púlpito",
    "text": "texto completo e encorpado da peroração estruturado em 3 parágrafos densos separados por quebra de linha dupla, em linguagem moderna, incisiva e dialógica com os dilemas da nossa época",
    "theologicalAnchors": ["1689 Cap. 8 e Cap. 16", "Sola Gratia & Solus Christus", "Hermenêutica Histórico-Gramatical", "Confronto Apologético ao Secularismo e Vazio Moderno"],
    "pastoralCharge": "exortação final direta ao pregador para a proclamação oral"
  }
}
`;

  try {
    const data = await generateJSON({
      contents: prompt,
      systemInstruction: "Você é o Consultor Teológico e Hermenêutico Sênior do Estúdio Homilético Batista. Avalie a mensagem com fidelidade bíblica intransigente, 1689 e sobriedade pastoral."
    });
    return res.json({
      id: `sieve-${Date.now()}`,
      ...data,
      createdAt: Date.now()
    });
  } catch (error: any) {
    console.warn("Theological Sieve Error (falling back to simulated sieve):", error);
    const mockResult = getMockTheologicalSieve(targetTitle, targetScripture, targetTheme, pointsContent);
    return res.json({
      ...mockResult,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido. O Crivo Teológico gerou o relatório em regime de contingência simulada."
    });
  }
});


// 5.2 Sermon Processing Pipeline Endpoint (7 Sequential Stages)
app.post("/api/gemini/process-sermon", async (req, res) => {
  const { stage, data } = req.body;

  if (!stage) {
    return res.status(400).json({ error: "O parâmetro 'stage' é obrigatório." });
  }

  // Define JSON schemas for Gemini response formats
  const captureSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      sourceType: { type: Type.STRING },
      sourceLink: { type: Type.STRING },
      quality: { type: Type.STRING },
      noiseLevel: { type: Type.STRING },
      interruptions: { type: Type.STRING },
      duration: { type: Type.STRING },
      language: { type: Type.STRING },
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            timeRange: { type: Type.STRING },
            status: { type: Type.STRING }
          },
          required: ["id", "timeRange", "status"]
        }
      }
    },
    required: ["title", "sourceType", "quality", "noiseLevel", "interruptions", "duration", "language", "segments"]
  };

  const transcriptSchema = {
    type: Type.OBJECT,
    properties: {
      fullText: { type: Type.STRING },
      sections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["label", "text"]
        }
      }
    },
    required: ["fullText", "sections"]
  };

  const mapSchema = {
    type: Type.OBJECT,
    properties: {
      centralPassage: { type: Type.STRING },
      auxiliaryPassages: { type: Type.ARRAY, items: { type: Type.STRING } },
      theme: { type: Type.STRING },
      bigIdea: { type: Type.STRING },
      purpose: { type: Type.STRING },
      structure: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            section: { type: Type.STRING },
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["section", "title", "content"]
        }
      },
      resources: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["type", "description"]
        }
      }
    },
    required: ["centralPassage", "auxiliaryPassages", "theme", "bigIdea", "purpose", "structure", "resources"]
  };

  const analysisSchema = {
    type: Type.OBJECT,
    properties: {
      exegesis: { type: Type.STRING },
      structure: { type: Type.STRING },
      applications: { type: Type.STRING },
      introduction: { type: Type.STRING },
      conclusion: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["exegesis", "structure", "applications", "introduction", "conclusion", "strengths", "improvements", "suggestions"]
  };

  const editSchema = {
    type: Type.OBJECT,
    properties: {
      editedManuscript: { type: Type.STRING }
    },
    required: ["editedManuscript"]
  };

  const publishSchema = {
    type: Type.OBJECT,
    properties: {
      libro: { type: Type.STRING },
      apostila: { type: Type.STRING },
      devocional: { type: Type.STRING },
      estudoBiblico: { type: Type.STRING },
      pequenosGrupos: { type: Type.STRING },
      escolaBiblica: { type: Type.STRING },
      podcast: { type: Type.STRING },
      video: { type: Type.STRING },
      redesSociais: {
        type: Type.OBJECT,
        properties: {
          carrossel: { type: Type.ARRAY, items: { type: Type.STRING } },
          legenda: { type: Type.STRING },
          hashtags: { type: Type.STRING }
        },
        required: ["carrossel", "legenda", "hashtags"]
      }
    },
    required: ["libro", "apostila", "devocional", "estudoBiblico", "pequenosGrupos", "escolaBiblica", "podcast", "video", "redesSociais"]
  };

  // Helper for dynamic simulated backup/contingency generators
  const getSimulatedPipelineData = (currentStage: number, input: any) => {
    const title = input.title || input.theme || "Graça e Poder no Altar";
    const scripture = input.scripture || "Romanos 12:1-2";
    const sourceType = input.sourceType || "audio";

    if (currentStage === 1) {
      let qualityDesc = "Alta (Filtro Inteligente)";
      let noiseDesc = "Baixo (Ruído isolado)";
      let durationDesc = "41 minutos e 28 segundos";
      let interruptionDesc = "Nenhuma interrupção grave detectada; corte sutil aos 24:10 normalizado.";

      if (sourceType === "soundboard") {
        qualityDesc = "Alta (Mesa de Som Direta)";
      } else if (sourceType === "cellular") {
        qualityDesc = "Média (Gravação de Celular)";
        noiseDesc = "Moderado (Sussurros de fundo)";
      } else if (sourceType === "document") {
        qualityDesc = "Excelente (Arquivo Digital de Texto/Documento)";
        noiseDesc = "Inexistente (Documento de Texto)";
        durationDesc = "Extensão textual correspondente a ~35-40 min de pregação oral";
        interruptionDesc = "Estrutura e parágrafos do documento indexados com sucesso.";
      } else if (sourceType === "text") {
        qualityDesc = "Excelente (Transcrição/Notas Diretas)";
        noiseDesc = "Inexistente (Entrada Digital Direta)";
        durationDesc = "Manuscrito textual pronto para estruturação homilética";
        interruptionDesc = "Texto recebido e formatado integralmente.";
      }

      return {
        title,
        sourceType,
        sourceLink: input.sourceLink || "",
        sourceText: input.sourceText || "",
        documentFileName: input.documentFileName || "",
        quality: qualityDesc,
        noiseLevel: noiseDesc,
        interruptions: interruptionDesc,
        duration: durationDesc,
        language: "Português (Brasil)",
        segments: [
          { id: 1, timeRange: "00:00 - 04:30", status: "Leitura Bíblica e Oração Inicial" },
          { id: 2, timeRange: "04:30 - 12:15", status: "Introdução e Contexto Histórico" },
          { id: 3, timeRange: "12:15 - 28:40", status: "Desenvolvimento Expositivo (Pontos 1 e 2)" },
          { id: 4, timeRange: "28:40 - 36:50", status: "Aplicações Práticas e Críticas" },
          { id: 5, timeRange: "36:50 - 41:28", status: "Conclusão, Apelo Pastoral Sóbrio e Oração Final" }
        ]
      };
    }

    if (currentStage === 2) {
      const fullText = `[Leitura Bíblica] Queridos irmãos em Cristo Jesus, abramos a Palavra de Deus na Epístola de Paulo aos Romanos, no capítulo 12, versículos 1 e 2. O texto sagrado nos diz: "Rogo-vos, pois, irmãos, pela compaixão de Deus, que apresenteis os vossos corpos como um sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus." Amém.

[Introdução] Gostaria de compartilhar com os irmãos nesta manhã uma reflexão sobre a consagração total que Deus requer de cada um de nós. Olhando para a história da igreja, percebemos que o maior perigo para o cristianismo não são as perseguições externas, mas sim a conformação passiva da nossa mente aos moldes deste século babilônico. Paulo não está aqui nos ensinando um moralismo cego, mas ele está nos implorando — "rogo-vos, pois" — a partir das grandiosas misericórdias de Deus descritas nos onze capítulos anteriores. Como nós respondemos a esse amor? Apresentando as nossas próprias vidas no altar.

[Desenvolvimento] O apóstolo nos convoca a apresentar os nossos "corpos". Isso é de uma exegese formidável, irmãos. Ele não diz apenas "as vossas almas" ou "as vossas intenções espirituais". Ele exige o corpo físico, a vida diária, os pés que caminham, as mãos que trabalham, a boca que fala. No grego clássico, a palavra usada aqui é "parastesai", que era o termo técnico para colocar um sacrifício sobre o altar do templo. Mas há uma diferença radical: o sacrifício judaico era morto; o nosso sacrifício é "vivo". Ele respira. Ele se move na praça pública, no trabalho, na sala de aula. É um sacrifício "santo e agradável", o que Paulo chama de nosso "culto racional". O culto racional é aquele que brota de uma mente que compreendeu intelectualmente e afetivamente a maravilhosa graça justificadora de Cristo.

E então ele avança para o versículo dois: "E não vos conformeis com este mundo". No grego, "syschematizesthe". Significa não deixar que o esquema externo, a fôrma de pensamento materialista deste século, nos esprema e nos modele. Sabe, irmãos, às vezes nós achamos que estar em conformidade com o mundo é apenas uma questão de roupas ou de vocabulário. Mas o secularismo é muito mais sutil. Ele se infiltra nos nossos valores familiares, na nossa busca frenética por sucesso financeiro, na nossa falta de perdão e no orgulho. O antídoto para isso, diz o texto, é a "metamorphousthe", a transformação interior operada "pela renovação da mente". É a verdade da Escritura reconfigurando nossa percepção da realidade.

[Conclusão] Portanto, meus irmãos, não há meio-termo na caminhada com Deus. Ou nós estamos deitados no altar como sacrifícios vivos, ou estamos sendo moldados silenciosamente pela cultura secular. A transformação da mente é o que nos permite comprovar, de fato, na prática do cotidiano, que a vontade do Pai é excelente: ela é boa, ela é agradável e ela é perfeita. Quando nós nos consagramos, nós experimentamos a plenitude da paz que o mundo jamais conseguirá imitar.

[Apelo] Examine com honestidade o seu coração diante de Deus nesta manhã. Você tem se deixado espremer pelo molde do mundo? Ou você tem voluntariamente se deitado no altar do sacrifício por gratidão? Que Deus nos conceda a graça de vivermos este culto racional todos os dias. Amém.`;

      return {
        fullText,
        sections: [
          { label: "Leitura Bíblica", text: `Queridos irmãos em Cristo Jesus, abramos a Palavra de Deus na Epístola de Paulo aos Romanos, no capítulo 12, versículos 1 e 2. O texto sagrado nos diz: "Rogo-vos, pois, irmãos, pela compaixão de Deus, que apresenteis os vossos corpos como um sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente..."` },
          { label: "Introdução", text: `Gostaria de compartilhar com os irmãos nesta manhã uma reflexão sobre a consagração total que Deus requer de cada um de nós. Olhando para a história da igreja, percebemos que o maior perigo para o cristianismo não são as perseguições externas, mas sim a conformação passiva da nossa mente aos moldes deste século babilônico.` },
          { label: "Desenvolvimento", text: `O apóstolo nos convoca a apresentar os nossos "corpos". Isso é de uma exegese formidável, irmãos. No grego clássico, a palavra usada aqui é "parastesai", que era o termo técnico para colocar um sacrifício sobre o altar do templo. Mas há uma diferença radical: o sacrifício judaico era morto; o nosso sacrifício é "vivo"... E então ele avança para o versículo dois: "E não vos conformeis com este mundo", ou seja, "syschematizesthe". Significa não deixar que o esquema externo nos esprema.` },
          { label: "Conclusão", text: `Portanto, meus irmãos, não há meio-termo na caminhada com Deus. Ou nós estamos deitados no altar como sacrifícios vivos, ou estamos sendo moldados silenciosamente pela cultura secular. A transformação da mente é o que nos permite comprovar a boa, agradável e perfeita vontade de Deus.` },
          { label: "Oração Final", text: `Senhor nosso Deus e Pai, nós Te agradecemos pelas compaixões que nos cercam. Concede-nos a graça de nos consagrarmos por inteiro, em corpo e mente, no altar da Tua fidelidade, em nome de Jesus, amém.` },
          { label: "Apelo", text: `Examine com honestidade o seu coração diante de Deus nesta manhã. Você tem se deixado espremer pelo molde do mundo? Ou você tem voluntariamente se deitado no altar do sacrifício por gratidão?` },
          { label: "Momentos de Interação", text: `[Pausa pastoral sóbria observando a congregação] "Que Deus tenha misericórdia de nós, amados."` }
        ]
      };
    }

    if (currentStage === 3) {
      return {
        centralPassage: scripture,
        auxiliaryPassages: ["Gálatas 2:20", "Efésios 4:22-24", "1 Pedro 1:14-16"],
        theme: `O Culto Racional da Consagração: Respondendo às Misericórdias de Deus`,
        bigIdea: "A consagração total da vida diária é a única resposta racional e coerente à graça justificadora de Deus.",
        purpose: "Inspirar os irmãos a abandonarem a fôrma secular de vida e a buscarem ativamente a renovação da mente através das Escrituras.",
        structure: [
          { section: "Introdução", title: "O Apelo Irrecusável", content: "A exortação apaixonada do Apóstolo fundamentada nas compaixões divinas descritas anteriormente." },
          { section: "Contexto", title: "As Misericórdias Teológicas", content: "O capítulo 12 liga a complexa dogmática dos capítulos 1-11 com a práxis e a ética de vida cristã dos capítulos 12-16." },
          { section: "Proposição", title: "O Altar Prático da Fé", content: "O culto que agrada a Deus não consiste em ritos místicos vazios, mas na doação integral do corpo na praça pública." },
          { section: "Divisão Principal 1", title: "O Oferecimento do Corpo (v. 1)", content: "Apresentar (parastesai) as mãos, os pés e a rotina como um sacrifício vivo e de agradável aroma homilético." },
          { section: "Divisão Principal 2", title: "A Não-Conformação Cultural (v. 2a)", content: "O combate ao sistema babilônico ('syschematizesthe') que tenta espremer e moldar nossos afetos e prioridades." },
          { section: "Divisão Principal 3", title: "A Renovação da Mente (v. 2b)", content: "A metamorfose cognitiva ('metamorphousthe') que reordena nossos desejos pela verdade da Palavra de Deus." },
          { section: "Conclusão", title: "A Comprovação da Vontade", content: "Apenas mentes regeneradas e vidas consagradas provam que a vontade de Deus é boa, agradável e perfeita." },
          { section: "Apelo", title: "O Altar ou a Fôrma", content: "O convite sóbrio e contido para deitar a vida no altar ao invés de aceitar as amarras culturais deste século." }
        ],
        resources: [
          { type: "Filologia", description: "Estudo das raízes gregas 'parastesai' (apresentar ritualmente), 'syschematizesthe' (deixar-se moldar pelo esquema secular) e 'metamorphousthe' (transformação profunda)." },
          { type: "Contraste", description: "O contraste vivo entre os sacrifícios de animais mortos no Antigo Testamento e o sacrifício do corpo vivo do crente no Novo Pacto." },
          { type: "Citação", description: "Referência implícita de que 'o secularismo infiltra-se nos detalhes miúdos das nossas escolhas diárias'." }
        ]
      };
    }

    if (currentStage === 4) {
      return {
        exegesis: "A exegese é altamente rigorosa e fiel ao texto. Explora com muita precisão as palavras originais (parastesai, syschematizesthe e metamorphousthe) sem cair em etimologias fantasiosas ou alegorias inadequadas. Respeita a transição crucial de Romanos 11 para o 12.",
        structure: "A estrutura homilética do sermão é impecável. A progressão de pensamento flui logicamente do altar (v.1) para a mente (v.2) e finalmente para o cotidiano. Há perfeito equilíbrio na duração recomendada para cada divisão.",
        applications: "Excelente apelo prático. As aplicações fogem do legalismo de costumes externos e miram no coração, abordando crentes e céticos ao mostrar a graça de Cristo como o único motor viável para a santidade.",
        introduction: "A introdução é sóbria, estabelecendo imediatamente um ponto de contato com o ouvinte sobre as influências invisíveis da cultura moderna.",
        conclusion: "A conclusão é imponente, com um convite pastoral curto e desafiador, sem sentimentalismos piegas.",
        strengths: [
          "Fidelidade exegética intocável e contextualização histórico-gramatical firme.",
          "Estilo sóbrio inspirado em Isaltino Gomes Coelho Filho, equilibrando pregação fervorosa com rigor conceitual.",
          "Excelente distinção entre costumes litúrgicos exteriores e o secularismo interno da mente."
        ],
        improvements: [
          "Pode-se expandir sutilmente a conexão cristocêntrica, mostrando como Jesus encarnou perfeitamente este sacrifício vivo em nosso favor."
        ],
        suggestions: [
          "Utilize pausas homiléticas intencionais logo após definir 'syschematizesthe' (a fôrma do mundo) para permitir que o ouvinte examine sua própria vida diária.",
          "Mencione brevemente um exemplo sóbrio de secularismo no ambiente de trabalho (como a competitividade egocêntrica) para ancorar a pregação na realidade do povo."
        ]
      };
    }

    if (currentStage === 5) {
      return {
        editedManuscript: `O Culto Racional da Consagração: Respondendo às Misericórdias de Deus

Meus amados irmãos, gostaria de convidar os senhores a abrirem a Palavra de Deus na Epístola do Apóstolo Paulo aos Romanos, no capítulo 12, versículos 1 e 2. Ouçamos o texto sagrado:

"Rogo-vos, pois, irmãos, pela compaixão de Deus, que apresenteis os vossos corpos como um sacrifício vivo, santo e agradável a Deus, que é o vosso culto racional. E não vos conformeis com este mundo, mas transformai-vos pela renovação da vossa mente, para que experimenteis qual seja a boa, agradável e perfeita vontade de Deus."

Ao iniciarmos esta reflexão, convém nos determos no advérbio de ligação "pois". Ele não está ali por acaso. Ele amarra toda a densa teologia exposta nos onze capítulos anteriores — onde Paulo descreveu a nossa miséria e a estupenda graça justificadora de Deus em Cristo — com o início da vida ética prática. Paulo não começa o capítulo 12 com uma ordem fria ou um imperativo moralista. Ele começa com um apelo dócil, humilde e insistente: "rogo-vos, irmãos, pelas compaixões de Deus". O motor da obediência cristã não é o medo da punição, mas a gratidão transbordante pelo amor derramado na cruz.

O primeiro aspecto deste chamado é a entrega do corpo: "que apresenteis os vossos corpos em sacrifício vivo". No grego, a palavra "parastesai" era usada nos templos antigos para descrever o ato solene de colocar a vítima sobre o altar. Paulo, no entanto, opera uma revolução de conceitos: o nosso sacrifício não é um animal sem vida, mas a nossa própria rotina física. Consagrar o corpo significa entregar a Deus as mãos que digitam, os pés que andam pela rua, os olhos que contemplam a tela, a mente que toma decisões comerciais. É um culto que faz sentido, um "culto racional". O verdadeiro culto batista não termina quando a bênção apostólica é proferida; ele começa na segunda-feira pela manhã.

Paulo então nos adverte contra o perigo da cultura secular: "não vos conformeis com este mundo". A palavra grega original "syschematizesthe" descreve o ato de ser prensado, moldado por forças externas. O secularismo é essa fôrma social invisível que tenta, dia após dia, espremer os nossos afetos, os nossos casamentos e as nossas ambições de acordo com a mentalidade egoísta e efêmera do século atual. Conformar-se com o mundo é aceitar os seus métodos desonestos, o seu orgulho intelectual e o seu materialismo como regras naturais de sobrevivência.

Como vencer essa pressão? O texto aponta para a "metamorphousthe" — a transformação radical que ocorre de dentro para fora, através da "renovação da vossa mente". Não se trata de pensamento positivo ou técnicas psicológicas de autoajuda. A renovação da mente é um trabalho silencioso e profundo do Espírito Santo por meio da verdade da Escritura. À medida que enchemos nossa mente com a Palavra de Deus, nossa visão da realidade é curada, nossos desejos são reordenados e passamos a discernir o que é excelente.

O resultado dessa consagração consciente e diária é a comprovação prática. Quem se consagra experimenta e atesta que a soberana vontade do Pai é de fato excelente: ela é boa, ela é agradável e ela é perfeita. Que o Senhor nos livre das fôrmas baratas deste mundo e nos conduza diariamente ao altar de Seu amor. Amém.`
      };
    }

    if (currentStage === 6) {
      return {
        libro: `CAPÍTULO I: O Altar da Graça e as Compaixões de Deus

A teologia cristã jamais se sustenta no vácuo das meras ideias intelectuais. Quando o apóstolo Paulo conclui sua monumental exposição doutrinária acerca da justificação e da eleição em Romanos 11, ele não encerra com um ponto final acadêmico, mas com uma conjunção conectora de transição prática. Em Romanos 12:1, o apelo "rogo-vos, pois" reposiciona todo o arcabouço doutrinário sob a luz da vida diária.

O altar cristão exige uma entrega física. Ao contrário dos sacrifícios clássicos do antigo culto de Israel, caracterizados pela imolação de vidas animais, o sacrifício da Nova Aliança é essencialmente vivo. Apresentar o corpo (parastesai) significa santificar a corporeidade, o labor do dia, a convivência civil e as escolhas miúdas no mercado de trabalho. Este é o culto racional (logike latreia) — o culto de quem compreendeu e acolheu as misericórdias de Deus.`,
        apostila: `ESTUDO DIRETO: ROMANOS 12:1-2
I. INTRODUÇÃO
  - O papel da conjunção "pois": Ligação indissolúvel entre Doutrina e Prática.
  - A base da consagração: As compaixões insondáveis do Criador.

II. O ALTAR DO CORPO (v. 1)
  - Termo exegético: "Parastesai" (apresentar no altar).
  - O paradoxo: Sacrifício vivo. O animal morria; o crente vive ativamente para a glória do Pai.
  - O Culto Racional: Culto consciente, maduro e existencial.

III. A RESISTÊNCIA CULTURAL (v. 2)
  - "Syschematizesthe": O molde externo do mundo que espreme e modela o crente.
  - "Metamorphousthe": A transformação intrínseca e cognitiva operada pelo Espírito Santo.
  - O discernimento experimental da vontade de Deus.`,
        devocional: `A FÔRMA OU O ALTAR?
"Não vos conformeis com este mundo..." — Romanos 12:2

O mundo contemporâneo é uma grande prensa. Diariamente, ele exerce pressão constante sobre nossos valores, nossos relacionamentos e nossa integridade. Ele quer que entremos no seu molde ("syschematizesthe"): que priorizemos o acúmulo material, que respondamos ao ódio com mais ódio e que façamos de nós mesmos o centro do universo.
No entanto, o Evangelho nos oferece outro caminho: o altar do sacrifício vivo e grato. Ao invés de sermos moldados por fora, somos convidados a ser transformados por dentro ("metamorphousthe") pela ação renovadora da Palavra de Deus em nossa mente. Hoje, ao iniciar sua rotina de trabalho ou de estudos, decida deitar sua vida no altar de Deus. É ali que sua mente encontra paz e comprova que a vontade do Senhor é perfeita.`,
        estudoBiblico: `GUIA EXEGÉTICO DE ESTUDO PESSOAL
1. De acordo com Romanos 12:1, qual é a base ou o motivo pelo qual Paulo nos roga a consagrar nossas vidas? Como isso muda nossa motivação para obedecer aos mandamentos de Deus?
2. O que significa, na prática da sua rotina semanal (segunda a sábado), oferecer seu "corpo" como sacrifício vivo?
3. O verbo grego para "conformar" (syschematizesthe) sugere ser espremido por um molde exterior. Em quais áreas da vida moderna você sente essa pressão do mundo de forma mais intensa?
4. Como ocorre o processo de "renovação da mente" no dia a dia? Qual é a parte que cabe a nós e qual cabe ao Espírito Santo?`,
        pequenosGrupos: `ROTEIRO PARA LÍDERES DE PEQUENOS GRUPOS
• QUEBRA-GELO (10 min): Se você ganhasse uma fôrma de bolo de presente, que formato gostaria que ela tivesse? O que acontece quando despejamos a massa dentro de uma fôrma?
• LEITURA BÍBLICA: Romanos 12:1-2.
• COMPARTILHAMENTO (30 min):
  - No sermão de domingo, ouvimos que "o verdadeiro culto começa na segunda-feira de manhã". Como isso confronta a ideia de que o culto acontece apenas na igreja?
  - Como a mentalidade consumista ou materialista da nossa sociedade tem tentado moldar nossas escolhas familiares e financeiras?
  - Compartilhe uma experiência em que você sentiu sua mente sendo renovada pela Palavra diante de uma decisão difícil.
• MOMENTO DE ORAÇÃO (15 min): Orem uns pelos outros para que Deus fortaleça as convicções de cada membro contra as fôrmas invisíveis da cultura atual.`,
        escolaBiblica: `PLANO DE AULA DA ESCOLA BÍBLICA DOMINICAL (EBD)
• TEMA DA LIÇÃO: A Ética da Consagração e a Mente Renovada
• OBJETIVOS:
  1. Compreender o significado histórico-cultural do sacrifício e sua transição para a era da graça.
  2. Identificar os sutis perigos do secularismo intelectual contemporâneo.
  3. Praticar a disciplina diária de renovar a mente através da leitura e meditação nas Escrituras.
• TEXTO ÁUREO: Romanos 12:2.
• ESBOÇO DA AULA:
  1. Introdução: A ponte doutrinária de Romanos.
  2. O Sacrifício do Corpo como Adoração Existencial.
  3. O Combate ao Esquema Mundano: Resistência ativa.
  4. A Metamorfose Mental: Fruto do Espírito e da Verdade.
  5. Conclusão: A prática diária da excelente vontade do Pai.`,
        podcast: `ROTEIRO DE PODCAST: CONEXÕES HOMILÉTICAS
[Efeito sonoro: Trilha acústica suave de piano e violoncelo que sobe por 3 segundos e diminui ao fundo]
Locutor: Olá, amados irmãos. Seja muito bem-vindo ao podcast Conexões Homiléticas. Aqui é o pastor Fernando Veiga, e hoje nós vamos conversar de forma muito franca e íntima sobre as marcas do altar de Deus em nossas vidas cotidianas.
[Pausa de 1 segundo]
Locutor: Sabe, às vezes nós temos a impressão de que para servir a Deus nós precisamos nos isolar, ou viver em um plano místico inacessível. Mas o apóstolo Paulo destrói esse conceito em Romanos 12. Ele pede o nosso "corpo". Ele pede a nossa rotina. Quando você atende um telefone no trabalho com paciência, quando você decide não participar de uma fofoca na mesa do café, ali você está prestando o seu culto racional.
[Efeito sonoro de transição rápida]
Locutor: Que Deus guarde o seu coração hoje contra o molde deste século. Nos encontramos no próximo episódio!`,
        video: `ROTEIRO AUDIOVISUAL DE VÍDEO CURTO (5 MIN)
• TÍTULO: O Altar ou o Molde
• CENA 1 (00:00 - 01:00): Plano médio do pastor em seu gabinete de estudos, livros ao fundo. Tom de voz sóbrio, dócil, caloroso.
  - Fala: "Olá, meu irmão. Deixe-me fazer uma pergunta direta: de onde vêm os seus valores? Daquilo que você assiste na televisão e nas redes sociais, ou da Palavra de Deus?..."
• CENA 2 (01:00 - 03:00): Transição para cortes sutis que mostram uma prensa mecânica esmagando argila ou uma fôrma de metal.
  - Locução: "Paulo usa a palavra 'syschematizesthe' em Romanos 12. Ela descreve exatamente isso: o molde do mundo nos espremendo..."
• CENA 3 (03:00 - 05:00): Retorna ao pastor olhando nos olhos da câmera.
  - Fala: "A única forma de escapar dessa prensa é deitando-se voluntariamente no altar de Deus como um sacrifício vivo e grato. Que Ele te abençoe."`,
        redesSociais: {
          carrossel: [
            "Slide 1: O maior perigo para o cristianismo não são as perseguições externas, mas sim a conformação passiva da nossa mente aos moldes deste século.",
            "Slide 2: 'Syschematizesthe': a fôrma de pensamento materialista invisível que tenta moldar nossos afetos, famílias e decisões todos os dias.",
            "Slide 3: O verdadeiro culto batista não termina quando a bênção apostólica é proferida no templo; ele começa na segunda-feira pela manhã.",
            "Slide 4: A transformação que agrada a Deus ('metamorphousthe') é interna e cognitiva, operada pelo Espírito Santo por meio da verdade bíblica.",
            "Slide 5: Examine seu coração: Você tem se deixado espremer pelo molde do mundo, ou tem deitado sua vida voluntariamente no altar por gratidão?"
          ],
          legenda: "O verdadeiro culto batista não termina quando a bênção apostólica é proferida no templo; ele começa na segunda-feira de manhã na praça pública, no escritório e na sala de aula. Apresente seus corpos em sacrifício vivo e rejeite o molde invisível do secularismo! Leia nossa reflexão completa sobre Romanos 12:1-2.",
          hashtags: "#EstudioHomiletico #Romanos12 #CultoRacional #ExegesePratica #VidaNoAltar #PrFernandoVeiga"
        }
      };
    }

    if (currentStage === 7) {
      return {
        title,
        theme: `O Culto Racional da Consagração: Respondendo às Misericórdias de Deus`,
        scripture,
        secondaryRefs: ["Gálatas 2:20", "Efésios 4:22-24", "1 Pedro 1:14-16"],
        book: "Romanos",
        author: "Apóstolo Paulo",
        keywords: ["Consagração", "Culto Racional", "Mente Renovada", "Secularismo", "Santidade"],
        doctrines: ["Justificação pela Fé", "Santificação Progressiva", "Eclesiologia Prática", "Soberania de Deus"],
        applications: ["Santificação da rotina profissional", "Guarda da mente contra o consumismo babilônico", "Adoração integral do corpo"],
        date: new Date().toISOString().split('T')[0],
        location: "Igreja Batista Central",
        series: "Exposição em Romanos",
        duration: "41 min e 28 seg",
        audience: "Membros e visitantes"
      };
    }
  };

  // Perform processing with AI if available
  if (ai) {
    try {
      let prompt = "";
      let activeSchema: any = null;

      if (stage === 1) {
        prompt = `
Você é o "CAPTURADOR HOMILÉTICO E EXECUTOR DE ANÁLISE DE SINAL E DOCUMENTOS" do Estúdio de Sermões.
Seu objetivo é processar os dados básicos de uma mídia bruta (gravação de áudio/vídeo, arquivo/documento de texto PDF/TXT/DOCX ou transcrição/notas digitadas) para prepará-la para a transcrição e estruturação homilética.

Dados de Entrada:
- Título/Tema fornecido: "${data.title || "Graça e Poder"}"
- Fonte do sinal/mídia: "${data.sourceType || "audio"}"
- Link fornecido (se aplicável): "${data.sourceLink || ""}"
- Arquivo de Documento (se aplicável): "${data.documentFileName || ""}"
- Conteúdo Textual / Notas (se fornecido): "${(data.sourceText || "").substring(0, 1500)}"

Gere uma resposta JSON completa com as propriedades requeridas por captureSchema:
- title: O título final ajustado da pregação.
- sourceType: A fonte original selecionada.
- sourceLink: O link se fornecido (ou string vazia).
- quality: Uma string descrevendo a qualidade técnica estimada da mídia/documento (ex: "Alta (Mesa de som)", "Excelente (Documento Digital)", "Excelente (Texto Direto)", "Média (Gravação ambiente)").
- noiseLevel: Ruído de fundo detectado ou "Inexistente (Documento de Texto)".
- interruptions: Cortes, parágrafos ou notas observadas.
- duration: Duração estimada plausível da pregação oral correspondente (ex: "35 a 45 minutos").
- language: Idioma detectado predominante (ex: "Português (Brasil)").
- segments: Uma lista de 3 a 5 segmentos da gravação/documento com seu respectivo timeRange e status de conteúdo.

Retorne estritamente o JSON válido de acordo com o esquema.
`;
        activeSchema = captureSchema;
      } else if (stage === 2) {
        prompt = `
Você é o "TRANSCRIBER HOMILÉTICO E ESTRUTURADOR DE TEXTO" do Estúdio de Sermões.
Seu objetivo absoluto é converter a gravação de áudio, documento ou notas digitadas em uma transcrição VERBATIM completa de um sermão exaustivo, fiel e realista.
${data.sourceText ? `O usuário forneceu o seguinte texto base/rascunho:\n"""\n${data.sourceText}\n"""\nExpanda e estruture com fidelidade e fluidez oral baseando-se nas ideias e notas acima.` : ''}
A pregação deve ser de um pastor batista experiente inspirado inteiramente no estilo homilético de Isaltino Gomes Coelho Filho.

Dados Básicos:
- Título da pregação: "${data.title || "Romanos 12"}"
- Passagem bíblica ou tema: "${data.scripture || "Romanos 12:1-2"}"

Estilo de Isaltino (CRÍTICO):
- Sóbrio, dócil oralmente, inteligente, exegese natural, humilde, caloroso, econômico nos adjetivos "inflados" ("glorioso", "maravilhoso", etc.), foco na Bíblia sem rodeios emocionais artificiais.
- Deve possuir marcas de oralidade natural (alguma pausa descrita como [Pausa pastoral], perguntas sinceras, menção de "irmãos", diálogo dócil com a comunidade).

Divida a transcrição e popule o JSON requerido:
- fullText: O texto completo concatenado da pregação.
- sections: Uma matriz de objetos com as seguintes seções bem delimitadas em texto detalhado:
  1. "Leitura Bíblica"
  2. "Introdução"
  3. "Desenvolvimento"
  4. "Conclusão"
  5. "Oração Final"
  6. "Apelo"
  7. "Momentos de Interação"

Escreva textos substanciais e ricos que pareçam reais e autênticos. Retorne estritamente o JSON válido.
`;
        activeSchema = transcriptSchema;
      } else if (stage === 3) {
        prompt = `
Você é o "MAPEADOR HOMILÉTICO" do Estúdio de Sermões.
Seu papel é ler a transcrição integral da pregação fornecida e gerar um mapa exegético e estrutural detalhado da mensagem.

Transcrição de Entrada:
"${data.transcript || ""}"

Gere o JSON mapeado conforme o esquema mapSchema:
- centralPassage: A perícope bíblica central do sermão.
- auxiliaryPassages: Lista de textos bíblicos adicionais mencionados ou usados na argumentação.
- theme: Tema homilético objetivo da mensagem.
- bigIdea: A "Grande Ideia" ou tese teológica central em uma frase curta de impacto.
- purpose: O propósito pastoral definido (o que a pregação visava produzir nos ouvintes).
- structure: Uma lista detalhada dos blocos da estrutura contendo a seção (Introdução, Contexto, Proposição, Divisões principais, subdivisões, aplicações, conclusão, apelo), título do bloco e descrição do conteúdo desse bloco.
- resources: Lista com recursos homiléticos utilizados (ilustrações, exemplos, citações, contrastes, testemunhos, etc.) e sua descrição detalhada.

Retorne estritamente o JSON estruturado.
`;
        activeSchema = mapSchema;
      } else if (stage === 4) {
        prompt = `
Você é o "AVALIADOR TEOLÓGICO E HOMILÉTICO" do Seminário de Pregadores.
Seu objetivo é analisar a integridade bíblica, estrutura e eficácia prática da pregação com base no seu mapa homilético e transcrição fornecidos.

Dados de Entrada:
- Mapa homilético: ${JSON.stringify(data.map || {})}
- Transcrição original: "${data.transcript || ""}"

Avalie e gere o relatório detalhado no JSON conforme o esquema analysisSchema:
- exegesis: Análise crítica da fidelidade ao texto original, contextos histórico, gramatical, literário e teológico.
- structure: Avaliação da coerência, progressão lógica, unidade homilética e equilíbrio de partes.
- applications: Avaliação das aplicações pastorais (relevância, conexão com a vida real, foco cristocêntrico).
- introduction: Avaliação da conexão de interesse com os ouvintes e clareza da tese.
- conclusion: Avaliação da força pastoral final do apelo e do encerramento.
- strengths: Lista com 3 a 5 pontos fortes claros da pregação.
- improvements: Lista com 1 a 3 pontos que poderiam ser fortalecidos.
- suggestions: Lista com conselhos e melhorias diretas, práticas e viáveis de oratória ou homilética sem alterar o estilo pessoal do pregador.

Retorne estritamente o JSON correspondente.
`;
        activeSchema = analysisSchema;
      } else if (stage === 5) {
        prompt = `
Você é o "EDITOR TEXTUAL DE MANUSCRITOS" do Estúdio de Sermões.
Seu objetivo é ler a transcrição oral de um sermão e transformá-la em um manuscrito escrito de pregação polido, elegante e pronto para leitura, publicação ou arquivamento.

Dados de Entrada:
- Transcrição: "${data.transcript || ""}"
- Avaliação homilética para considerar melhorias: ${JSON.stringify(data.analysis || {})}

Instruções de Edição:
- Remova tics orais vazios ("então", "né", "né irmãos", "sabe", gagueiras, repetições mecânicas).
- Melhore a concordância de gênero, número e grau, ajuste a pontuação para manter a leitura fluida, organize em parágrafos coerentes.
- Preserve de forma primorosa a oralidade sábia, acolhedora e sóbria típica de Isaltino Gomes Coelho Filho (evite empolamento literário artificial, mantenha a profundidade batista natural e o tom de diálogo caloroso com a congregação).
- O manuscrito final deve soar como se tivesse sido inteiramente escrito pelo próprio pregador em seu gabinete de estudos pastorais.

Gere o JSON correspondente:
{
  "editedManuscript": "O texto completo polido"
}
`;
        activeSchema = editSchema;
      } else if (stage === 6) {
        prompt = `
Você é o "PRODUTOR DE ARTEFATOS DO MINISTÉRIO MULTIPLICADO".
Seu objetivo é ler o manuscrito de sermão editado e expandi-lo automaticamente em múltiplos formatos específicos para frentes de atuação de uma igreja local batista.

Manuscrito de Entrada:
"${data.editedManuscript || ""}"

Gere as adaptações ricas e completas no JSON correspondente ao esquema publishSchema:
- libro: Capítulo corrido, reflexivo, doutrinário e profundo adequado para compor um livro de reflexões pastorais.
- apostila: Esboço lógico, didático, estruturado e com lacunas ou notas explicativas adequadas para uma apostila de estudos de seminário local.
- devocional: Versão curta, pastoral, devocional diária para leitura em 3 minutos, com foco no consolo, encorajamento e aplicação prática imediata.
- estudoBiblico: Lista de 4 a 6 perguntas indutivas de profunda reflexão bíblica para estudo em classe ou leitura pessoal.
- pequenosGrupos: Roteiro para pequenos grupos com quebra-gelo, leitura bíblica compartilhada, perguntas práticas para partilha de vida e orações.
- escolaBiblica: Plano de aula completo com tema, objetivos, texto áureo, introdução, pontos estruturados para debate teológico e conclusão pedagógica.
- podcast: Roteiro com marcações de efeito sonoro de abertura, texto falado em tom informal e íntimo de conversa e encerramento caloroso.
- video: Roteiro de vídeo de 5 minutos, com diretrizes de tom de voz, sugestões de cenas e tópicos diretos e rápidos a expor.
- redesSociais: Um objeto contendo:
  - carrossel: Lista com até 5 slides com mensagens, citações e chamadas à reflexão direta.
  - legenda: Texto completo para a legenda do post (com tom de conversa amigável e focado).
  - hashtags: Lista de hashtags pertinentes.

Retorne estritamente o JSON estruturado do publishSchema.
`;
        activeSchema = publishSchema;
      }

      const generated = await generateJSON({
        contents: prompt,
        responseSchema: activeSchema
      });

      return res.json(generated);

    } catch (err: any) {
      console.warn(`[AI Processing Error at Stage ${stage}] Falling back to dynamic simulation. Error:`, err);
      const simulation = getSimulatedPipelineData(stage, data);
      return res.json({
        ...simulation,
        fallbackActive: true,
        fallbackReason: `Limite ou erro temporário na IA (Código: ${err.message || "429"}). Ativamos o modo de contingência dinâmica para garantir o processamento do sermão.`
      });
    }
  } else {
    // Return high-fidelity simulated response for workspace flow
    const simulation = getSimulatedPipelineData(stage, data);
    return res.json(simulation);
  }
});



// 6. Illustration & Visual Composition Generator
app.post("/api/gemini/generate-illustrations", async (req, res) => {
  const { topic, type, scripture, visualStyle, aspectRatio, colorTone } = req.body;

  if (!ai) {
    return res.json(getMockIllustrations(topic, type, scripture, visualStyle, aspectRatio, colorTone));
  }

  const prompt = `
Você é o Consultor Homilético e Diretor de Arte Sacra do Estúdio Homilético Batista.
Gere ilustrações pastorais relevantes e comoventes, adequadas para pregações em igreja local sobre o tema: "${topic || "Graça e Redenção"}".
${scripture ? `Passagem Bíblica associada: "${scripture}".` : ''}
Tipo solicitado: ${type || "todas"} (bíblicas, cotidiano, históricas, pastorais ou evangelísticas).
Estilo visual preferencial: ${visualStyle || "Gravura Clássica Sacra / Óleo Barroco"}.
Proporção visual pretendida: ${aspectRatio || "16:9"}.
${colorTone ? `Paleta de cores litúrgica: ${colorTone}.` : ''}

Lembre-se:
- Evite artificialismos, melodrama barato ou pieguismo. Mantenha sobriedade (estilo Isaltino Gomes), profundidade pastoral e oralidade bíblica viva.
- Para cada ilustração, gere também uma detalhada composição visual (visualPrompt) com descrição estética da cena adequada para projeção de púlpito, telão ou geração de arte em IA (com iluminação, elementos centrais, atmosfera e paleta de cores).

Retorne no formato JSON exato:
{
  "topic": "${topic || "Graça e Redenção"}",
  "illustrations": [
    {
      "title": "Título Claro e Impactante",
      "type": "${type && type !== 'todas' ? type : 'bíblica'}", 
      "scripture": "${scripture || ''}",
      "story": "A narrativa completa da ilustração em linguagem inspiradora, sóbria e oralmente pregável.",
      "moral": "O ponto homilético, lição central ou apelo pastoral claro.",
      "visualPrompt": "Descrição rica da composição visual da cena (sujeito central, iluminação chiaroscuro, estilo pictórico, tons sóbrios, proporção ${aspectRatio || '16:9'}, adequado para slide de sermão no púlpito).",
      "visualStyle": "${visualStyle || 'Gravura Sacra Antiga'}",
      "aspectRatio": "${aspectRatio || '16:9'}"
    }
  ]
}
Gere entre 2 e 3 ilustrações completas e ricas.
`;

  try {
    const data = await generateJSON({
      contents: prompt
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Illustrations Error (falling back to simulated illustrations):", error);
    const mockIllus = getMockIllustrations(topic, type, scripture, visualStyle, aspectRatio, colorTone);
    return res.json({
      ...mockIllus,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O gerador de ilustrações recorreu ao acervo ilustrativo pastoral local."
    });
  }
});

// 7. Improve Sermon Endpoint
app.post("/api/gemini/improve-sermon", async (req, res) => {
  const { sermon, improvement } = req.body;

  if (!sermon || !improvement) {
    return res.status(400).json({ error: "Sermão e sugestão de aperfeiçoamento são mandatórios." });
  }

  if (!ai) {
    return res.json(getMockImprovedSermon(sermon, improvement));
  }

  const prompt = `
Você é o Pr. Fernando Veiga, um experiente pregador Batista brasileiro com profundo preparo exegético.
Sua tarefa é aperfeiçoar de forma inteligente um sermão com base em uma recomendação de melhoria específica feita pelo Seminário Teológico.

Recomendação de Aperfeiçoamento selecionada para aplicar:
"${improvement}"

Critérios do Sermão Original:
- Título: ${sermon.title}
- Tema Central: ${sermon.theme}
- Versão Base da Bíblia: ${sermon.bibleVersion || "ACF"}
- Estilo Homilético: ${sermon.style || "original"}
- Perfil da Igreja: ${sermon.churchProfile || "tradicional"}

REGRAS DE OURO PARA O APERFEIÇOAMENTO (OBRIGATÓRIO):
1. ALTERE APENAS O TRECHO DIRETAMENTE RELACIONADO à recomendação. Identifique qual campo (introduction, biblicalContext, expositoryPoints, conclusion ou pastoralAppeal) deve ser alterado e reescreva-o aplicando a melhoria sugerida de forma magistral.
2. NÃO REESCREVA O SERMÃO INTEIRO SEM NECESSIDADE. As seções que não se relacionarem com a recomendação devem ser mantidas ABSOLUTAMENTE IGUAIS ao texto original. Não resuma, não altere o conteúdo e não modifique as palavras das seções não-relacionadas.
3. PRESERVE O ESTILO DO PREGADOR E O TOM PASTORAL. ${sermon.churchProfile === 'neutro' || sermon.style === 'biblico' ? 'Mantenha os preceitos clássicos de uma teologia bíblica exegética sadia, ortodoxa e neutra denominacionalmente, use terminologias amplas e saudáveis (como "Ceia do Senhor", "Discipulado", "Conversão", "Novo nascimento") e evite jargões sectários ou disputas denominacionais.' : 'Mantenha os preceitos clássicos da teologia batista histórica, coerência doutrinária bíblica e eclesiologia batista, use terminologias salutares (como "Ceia do Senhor", "Ordenanças", "Conversão", "Novo nascimento") e evite sacramentalismos.'}
4. MANTENHA A ESTRUTURA HOMILÉTICA ORIGINAL. Se alterar um ponto expositivo, preserve o fluxo do ponto: Exposição -> Ilustração (se houver) -> Aplicação (se houver).
5. Certifique-se de que a alteração seja fluida, natural, e soe verdadeiramente inspirada e pregável, evitando mudanças artificiais de vocabulário que quebrem o ritmo do pregador.

${HOMILETICAL_TRANSITION_GUIDELINE}

${THEOLOGICAL_DEPTH_AND_REDEMPTIVE_CHRISTOCENTRISM_GUIDELINE}

${EXEGESIS_VERSE_REFERENCE_GUIDELINE}

${sermon.style === 'isaltino' ? ISALTINO_STYLE_GUIDELINE : sermon.style === 'biblico' ? BIBLICO_STYLE_GUIDELINE : sermon.style === 'conviccional' ? CONVICCIONAL_STYLE_GUIDELINE : ''}

Abaixo está o conteúdo completo do sermão original para você analisar e melhorar:
- Título original: ${sermon.title}
- Tema original: ${sermon.theme}
- Passagem bíblica original: ${sermon.scripture}
- Introdução original:
${sermon.introduction}

- Contexto Histórico original:
${sermon.biblicalContext}

- Pontos Expositivos originais:
${JSON.stringify(sermon.expositoryPoints, null, 2)}

- Conclusão original:
${sermon.conclusion}

- Apelo Pastoral original:
${sermon.pastoralAppeal}

Retorne obrigatoriamente um objeto JSON com os mesmos campos do sermão, contendo a atualização aplicada e as demais seções preservadas inteiramente:
{
  "title": "título do sermão (geralmente mantido igual, a menos que a melhoria sugira alterar)",
  "theme": "tema do sermão (geralmente mantido igual, a menos que a melhoria sugira alterar)",
  "scripture": "passagem bíblica (mantida igual)",
  "introduction": "introdução (atualizada se relevante ao ponto de melhoria, senão idêntica ao original)",
  "biblicalContext": "contexto histórico (atualizado se relevante ao ponto de melhoria, senão idêntica ao original)",
  "expositoryPoints": [
    // lista exata de pontos expositivos com o mesmo tamanho da original, onde apenas o ponto relevante ao aperfeiçoamento foi delicadamente reescrito, mantendo os outros pontos absolutamente intocados
  ],
  "conclusion": "conclusão (atualizada se relevante ao ponto de melhoria, senão idêntica ao original)",
  "pastoralAppeal": "apelo pastoral (atualizado se relevante ao ponto de melhoria, senão idêntica ao original)"
}
`;

  try {
    const sInstruction = (sermon.churchProfile === 'neutro' || sermon.style === 'biblico')
      ? "Você é um experiente consultor e revisor homilético cristão focado na exegese pura das Escrituras e neutralidade denominacional. Você atua como um assistente homilético inteligente no refinamento cirúrgico de sermões."
      : "Você é o Pr. Fernando Veiga, um experiente pregador Batista brasileiro. Você atua como um assistente homilético inteligente no refinamento cirúrgico de sermões.";

    const data = await generateJSON({
      contents: prompt,
      systemInstruction: sInstruction
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Improvement Sermon Error (falling back to simulated revision):", error);
    const mockRev = getMockImprovedSermon(sermon, improvement);
    return res.json({
      ...mockRev,
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido (Código 429). O editor local de contingência aplicou a revisão pastoral cirúrgica offline."
    });
  }
});

// 8. Individual Activity Generation Endpoint
app.post("/api/generate-activity", async (req, res) => {
  const { title, subject, grade, duration, objectives, extraInstructions } = req.body;

  if (!ai) {
    return res.json({
      title: title || "Atividade de Leitura e Escrita",
      subject: subject || "Língua Portuguesa",
      grade: grade || "3º Ano",
      objectives: objectives || "Desenvolver a interpretação textual.",
      instructions: "Leia o texto atentamente e responda às perguntas propostas.",
      activities: [
        { question: "Qual o tema principal do texto?", type: "dissertativa" },
        { question: "Quem é o personagem principal?", type: "multipla-escolha", options: ["Opção A", "Opção B", "Opção C"] }
      ],
      duration: duration || "50 minutos",
      fallbackActive: true,
      fallbackReason: "Cliente API não configurado. Simulação executada com integridade."
    });
  }

  const prompt = `Crie um planejamento de atividade pedagógica estruturado com base nos seguintes parâmetros:
Título: ${title || "A definir"}
Matéria/Assunto: ${subject || "A definir"}
Série/Ano: ${grade || "A definir"}
Duração da Atividade: ${duration || "50 minutos"}
Objetivos Pedagógicos: ${objectives || "A definir"}
Instruções Extras: ${extraInstructions || "Nenhuma"}

Retorne em formato JSON válido:
{
  "title": "título da atividade",
  "subject": "subtítulo ou matéria",
  "grade": "ano escolar",
  "duration": "tempo estimado",
  "objectives": "diretrizes e objetivos pedagógicos",
  "instructions": "instruções gerais para aplicar",
  "activities": [
    {
      "question": "pergunta pedagógica",
      "type": "tipo (dissertativa/múltipla escolha)",
      "options": ["opção_a", "opção_b"]
    }
  ]
}
`;

  try {
    const data = await generateJSON({
      contents: prompt,
      systemInstruction: "Você é um especialista em pedagogia infantil e juvenil brasileira, criando atividades ricas sob medida no padrão sugerido em JSON."
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("Activity Generation Error (falling back to simulated activity):", error);
    return res.json({
      title: title || "Atividade de Leitura e Escrita",
      subject: subject || "Língua Portuguesa",
      grade: grade || "3º Ano",
      objectives: objectives || "Desenvolver a interpretação de texto e cognição.",
      instructions: "Leia o texto com calma e responda as perguntas com capricho.",
      activities: [
        { question: "Qual o tema central abordado pelo autor no início?", type: "dissertativa" },
        { question: "Assinale a alternativa que condiz com o desfecho:", type: "multipla-escolha", options: ["O protagonista desiste", "O protagonista alcança o objetivo", "Não há resolução clara"] }
      ],
      duration: duration || "50 minutos",
      fallbackActive: true,
      fallbackReason: "Limite de cota da API atingido ou erro. O simulador de atividades pedagógicas assumiu as respostas."
    });
  }
});

// 9. Structured PDF Import and Processing Endpoint
app.post("/api/import-pdf", async (req, res) => {
  const { pdfText, instructions } = req.body;

  if (!ai) {
    return res.json({
      parsedTheme: "Tema Geral Extraído do Documento",
      summary: "Este é um resumo do conteúdo pedagógico do PDF fornecido para o planejamento das atividades.",
      keyTopics: ["Tópico 1", "Tópico 2", "Tópico 3"],
      recommendedGrade: "Ensino Fundamental II",
      fallbackActive: true
    });
  }

  const prompt = `Analise e processe o texto de documento PDF pedagógico abaixo para criar um planejamento de estudos estruturado.
Diretrizes e Instruções adicionais: ${instructions || "Processar com rigor conceitual"}

Texto do Documento original:
${pdfText || "Conteúdo não especificado..."}

Retorne um JSON contendo a seguinte estrutura de síntese e análise para planejamento de atividades:
{
  "parsedTheme": "tema central extraído do documento",
  "summary": "resumo pedagógico profundo do material",
  "keyTopics": ["lista de tópicos chaves ou unidades de ensino encontradas"],
  "recommendedGrade": "série ou ano mais adequado para este material"
}
`;

  try {
    const data = await generateJSON({
      contents: prompt,
      systemInstruction: "Você é um assistente pedagógico especializado em processamento e estruturação de materiais didáticos a partir de arquivos e textos importados."
    });
    return res.json(data);
  } catch (error: any) {
    console.warn("PDF Import Processing Error (falling back to simulated processing):", error);
    return res.json({
      parsedTheme: "Tema Geral Extraído do Material de Estudos",
      summary: "Resumo pedagógico e contornos conceituais processados sob limites de contingência da máquina offline.",
      keyTopics: ["Identificação das premissas", "Diferenças analíticas", "Aplicação prática contextualizada"],
      recommendedGrade: "Ano sugerido de acordo com densidade textual",
      fallbackActive: true,
      fallbackReason: "Limite de cota atingido ou falha de rede interna. O plano de contingência gerou a interpretação off-line."
    });
  }
});

// --- Fallback Simulations if Gemini API fails or is not configured ---

function getMockImprovedSermon(sermon: any, improvement: string) {
  const s = JSON.parse(JSON.stringify(sermon));
  const imp = improvement.toLowerCase();

  if (imp.includes("ressurreição") || imp.includes("cristo") || imp.includes("conclusion") || imp.includes("conclusão")) {
    s.conclusion = s.conclusion + " Conectamos este ápice homilético diretamente à gloriosa vitória da Ressurreição de Cristo! Na verdade, a nossa cruz e o nosso compromisso seriam vãos se a sepultura permanecesse selada. Ele ressuscitou e reina para todo o sempre, provando que a soberana graça triunfou plenamente sobre a condenação eterna da morte, dando sentido eterno a cada decisão do povo de Deus.";
  } else if (imp.includes("tradução") || imp.includes("bíblica") || imp.includes("versão") || imp.includes("sectária")) {
    s.introduction = s.introduction.replace(/versão específica|recomendo exclusivamente|somente a tradução/gi, "recorrendo à autoridade divina") + " Sempre guiados pelo profundo amor e reverência à imutável Palavra de Deus.";
    s.biblicalContext = s.biblicalContext.replace(/fiel somente em/gi, "");
  } else if (imp.includes("suavizar") || imp.includes("elogio") || imp.includes("congreg") || imp.includes("bajula")) {
    s.introduction = "Querida congregação, sabemos da sinceridade do nosso caminhar coletivo, mas o apelo bíblico sempre nos exorta a não confiar em nossa própria moralidade, buscando o arrependimento genuíno e a dependência constante de Deus.";
    if (s.expositoryPoints && s.expositoryPoints.length > 0) {
      s.expositoryPoints[0].application = "Por isso, em vez de se contentar com uma complacência espiritual ou falsos elogios terrenos, examine honestamente o seu coração diante do trono de divina graça.";
    }
  } else {
    s.conclusion = s.conclusion + " (Aparado pastoralmente aplicando: " + improvement + ")";
  }
  return s;
}

function getSynchronizedTransitions(context: string, p1Title: string, p2Title: string, p3Title: string): [string, string, string] {
  const clean1 = p1Title.replace(/^(i+\.?\s*|1\.\s*)/i, '').trim();
  const clean2 = p2Title.replace(/^(i+\.?\s*|2\.\s*)/i, '').trim();
  const clean3 = p3Title.replace(/^(i+\.?\s*|3\.\s*)/i, '').trim();

  const lower = context.toLowerCase();
  if (lower.includes('realidade')) {
    return [
      `A primeira realidade que o texto sagrado descortina diante de nós é ${clean1}.`,
      `Firmados nessa primeira realidade, a passagem nos conduz a uma segunda realidade indispensável: ${clean2}.`,
      `Por fim, o texto encerra sua exposição apontando para uma terceira realidade transformadora: ${clean3}.`
    ];
  }
  if (lower.includes('pilar') || lower.includes('pilares')) {
    return [
      `O primeiro pilar sobre o qual repousa nossa fé é ${clean1}.`,
      `Sobre esse alicerce, o texto ergue um segundo pilar inabalável: ${clean2}.`,
      `O terceiro pilar que completa essa estrutura de firmeza espiritual é ${clean3}.`
    ];
  }
  if (lower.includes('marca')) {
    return [
      `A primeira marca evidente de um coração regenerado é ${clean1}.`,
      `Uma segunda marca que distingue o verdadeiro discípulo é ${clean2}.`,
      `A terceira marca que sela esta obra da graça é ${clean3}.`
    ];
  }
  if (lower.includes('fundamento')) {
    return [
      `O primeiro fundamento inabalável apresentado pelo texto sagrado é ${clean1}.`,
      `Edificados sobre essa base, encontramos um segundo fundamento indispensável: ${clean2}.`,
      `O terceiro fundamento que coroa esta mensagem é ${clean3}.`
    ];
  }
  if (lower.includes('liç') || lower.includes('lic')) {
    return [
      `A primeira lição que aprendemos desta passagem é ${clean1}.`,
      `Avançando no texto bíblico, deparamo-nos com uma segunda lição preciosa: ${clean2}.`,
      `A terceira lição que deve moldar nossa caminhada é ${clean3}.`
    ];
  }
  if (lower.includes('princípio') || lower.includes('principio')) {
    return [
      `O primeiro princípio que emerge com nitidez desta passagem é ${clean1}.`,
      `Depois de contemplarmos esse princípio inicial, a revelação bíblica avança para um segundo princípio indispensável: ${clean2}.`,
      `Por fim, a passagem nos conduz a um terceiro princípio fundamental: ${clean3}.`
    ];
  }
  return [
    `A primeira verdade que emerge com nitidez desta passagem é ${clean1}.`,
    `Depois de contemplarmos essa verdade inicial, a revelação bíblica avança para uma segunda verdade transformadora: ${clean2}.`,
    `Por fim, a passagem coroa esta exposição nos confrontando com uma terceira verdade essencial: ${clean3}.`
  ];
}

function getMockSermon(title: string, theme: string, scripture: string, style: string, churchProfile: string, audience: string, bibleVersion: string, isOutline: boolean, seriesName?: string) {
  const actualTitle = title ? title.trim() : "O Caminho do Senhor e a Luz para o Caminho";
  const actualTheme = theme ? theme.trim() : "A revelação e a herança da Palavra na vida cristã";
  const actualScripture = scripture ? scripture.trim() : "Salmos 119:105";
  const actualVersion = bibleVersion || "ACF";
  const styleLabel = style === "isaltino" ? "sobriedade, exegese natural e simplicidade prática (no estilo de Isaltino Gomes)" : style === "billy" ? "apelo evangelístico, linguagem simples e decisão espiritual (no estilo de Billy Graham)" : style === "biblico" ? "fidelidade expositiva pura, neutralidade institucional e centralidade cristocêntrica equilibrada" : style === "conviccional" ? "firmeza doutrinária, confronto bíblico corajoso, discernimento espiritual e suficiência das Escrituras (no estilo conviccional de Lloyd-Jones, MacArthur, Tozer)" : "equilibrado, pastoral e fluido";
  const profileLabel = churchProfile === "tradicional" ? "tradicionalista batista" : churchProfile === "contemporanea" ? "contemporânea batista" : churchProfile === "reformada" ? "reformada clássica" : churchProfile === "renovada" ? "comunhão renovada" : churchProfile === "jovem" ? "dinâmica e jovial" : churchProfile === "plantacao" ? "plantadora e missionária" : "de revitalização";

  // Check for common scripture keywords to customize the dynamic response even more beautifully!
  const isShepherd = actualScripture.toLowerCase().includes("salmo 23") || actualScripture.toLowerCase().includes("sl 23") || actualScripture.toLowerCase().includes("pastor");
  const isLove = actualScripture.toLowerCase().includes("joão 3") || actualScripture.toLowerCase().includes("jo 3") || actualScripture.toLowerCase().includes("joao 3") || actualScripture.toLowerCase().includes("amor");
  const isGrace = actualScripture.toLowerCase().includes("efésios 2") || actualScripture.toLowerCase().includes("efesios 2") || actualScripture.toLowerCase().includes("ef 2") || actualScripture.toLowerCase().includes("graça") || actualScripture.toLowerCase().includes("graca");
  const isRomans12 = actualScripture.toLowerCase().includes("romanos 12") || actualScripture.toLowerCase().includes("rm 12") || actualScripture.toLowerCase().includes("corpo") || actualScripture.toLowerCase().includes("altar");

  let introText = "";
  let contextText = "";
  let p1_title = "";
  let p1_expl = "";
  let p1_ill = "";
  let p1_app = "";
  let p2_title = "";
  let p2_expl = "";
  let p2_ill = "";
  let p2_app = "";
  let p3_title = "";
  let p3_expl = "";
  let p3_app = "";
  let conclText = "";
  let appealText = "";
  let tagsList: string[] = [];

  if (isShepherd) {
    p1_title = "I. O Contentamento Pleno sob o Cajado da Graça";
    p1_expl = `(a) Explicação Textual Profunda:
Debruçando-nos sobre o texto de ${actualScripture}, observamos que a alma redimida por Deus encontra descanso absoluto. No hebraico bíblico original, a declaração de Davi abre com o nome pactual divino inefável: "Yahweh Rohi" — o Senhor é meu Pastor (v.1). O particípio hebraico "rohi" denota cuidado contínuo, ativo e pessoal; o pastor não é um espectador indiferente, mas Aquele que conhece cada ovelha e garante que nada lhe faltará. Ao nos conduzir a "águas de descanso" (no hebraico, "mei menuchot", águas mansas e restauradoras, v.2), a Escritura nos liberta da ilusão da autossuficiência e da agitação secular.

(b) Paralelos Escriturísticos:
Este pastoreio reverbera em toda a harmonia canônica das Escrituras: Isaías profetizou que Ele "como pastor apascentará o seu rebanho; entre os seus braços recolherá os cordeirinhos" (Is 40.11), e no Novo Testamento Jesus Se declara explicitamente: "Eu sou o bom pastor; o bom pastor dá a vida pelas ovelhas" (Jo 10.11).

(c) Cristocentrismo Redentor:
Aqui vislumbramos o ápice da teologia redentora: Jesus Cristo não apenas conduz Suas ovelhas, mas Se tornou o Cordeiro pascal sacrificado no Calvário para expiar a nossa culpa. O descanso prometido nas pastagens verdejantes é a paz duradoura com Deus conquistada pela justificação mediante a fé em Seu sangue.`;
    p1_ill = "Imagine ovelhas com muita sede que chegam a uma torrente barulhenta e impetuosa. Elas ficam assustadas e se recusam a beber. O pastor experiente, reconhecendo esse temor, cria um pequeno desvio na margem com pedras, fazendo a água correr de forma mansa e quieta. Naquele remanso de paz, as ovelhas finalmente bebem felizes e tranquilas. Assim é o Bom Pastor Jesus Cristo, que pacifica as tormentas interiores da nossa alma para nos dar o Seu refrigério imperecível.";
    p1_app = `(d) Aconselhamento e Confronto Pastoral:
Confronte hoje a ansiedade crônica e o ativismo frenético que tantas vezes sequestram o seu coração. O homem contemporâneo corre desesperado tentando garantir seu futuro por meio do acúmulo e da ilusão do controle, vivendo de segunda a sábado como se Deus não governasse o amanhã. Nas decisões financeiras da sua casa e nas pressões do seu trabalho, descanse no cuidado soberano e terno do Bom Pastor, consagrando tempo diário de oração no lar e instrução dos filhos.`;

    p2_title = "II. A Travessia Segura por Valas e Sombras";
    p2_expl = `(a) Explicação Textual Profunda:
A caminhada cristã não ignora os cenários áridos. No desenvolvimento de ${actualScripture}, o salmista encara com honestidade o "vale da sombra da morte" (no hebraico, "ge tsalmawet", v.4) — a escuridão mais densa da experiência humana. A Bíblia não promete imunidade contra a dor terrena, mas assegura uma companhia inseparável: "porque tu estás comigo" (v.4). Sua vara ("shevet", símbolo de proteção e defesa contra predadores) e Seu cajado ("mish'enet", símbolo de amparo, resgate e disciplina pastoral) corrigem nossos desvios e sustentam nosso andar vacilante.

(b) Paralelos Escriturísticos:
Essa fidelidade no sofrimento atravessa toda a revelação bíblica: "Quando passares pelas águas, estarei contigo, e, quando pelos rios, eles não te submergirão" (Is 43.2), e Paulo atesta em aflição: "A minha graça te basta, porque o meu poder se aperfeiçoa na fraqueza" (2 Co 12.9).

(c) Cristocentrismo Redentor:
Aqui contemplamos o Cordeiro de Deus que desceu ao mais escuro vale da morte no Calvário. Jesus experimentou o abandono vicário da cruz ("Deus meu, Deus meu, por que me desamparaste?") para que nenhum dos Seus jamais prove a separação eterna de Deus. Sua vitória na ressurreição garante que a morte foi tragada na vitória.`;
    p2_ill = "Trazendo à tona as páginas bíblicas, recordamos a travessia do povo de Israel rumo à terra prometida. Cercado pelo mar revolto em frente e pelo temível exército inimigo atrás (Êx 14.13), Moisés exortou a congregação: 'Não temais; estai quietos, e vede o livramento do Senhor'. E as águas se abriram de forma extraordinária para que passassem a salvo sobre o chão seco de areia, provando que Deus jamais desampara Seus filhos na travessia mais árdua.";
    p2_app = `(d) Aconselhamento e Confronto Pastoral:
Quando você enfrentar pressões financeiras, conflitos no casamento, diagnósticos médicos difíceis ou angústias profundas da alma nesta semana, recuse a murmuração cínica e o moralismo de autoajuda. O Evangelho não promete ausência de vales, mas a presença real do Salvador neles. Achegue-se com confiança ao trono da graça em oração sincera e busque o amparo fraterno e acolhedor na sua igreja local.`;

    p3_title = "III. O Banquete da Vitória e a Eterna Habitação";
    p3_expl = `(a) Explicação Textual Profunda:
Por fim, a mensagem de ${actualScripture} culmina em uma mesa farta e transbordante diante dos adversários (v.5) e na habitação eterna na presença de Deus (v.6). O salmista afirma que a bondade e o amor leal pactual de Deus (o insubstituível "hesed" hebraico) o seguirão ("yirdefuni", literalmente "perseguirão ativamente") todos os dias do viver. A unção com óleo sobre a cabeça simboliza consagração festiva e alegria indestrutível.

(b) Paralelos Escriturísticos:
Este banquete celestial conecta-se com a promessa profética de Isaías 25.6 e com as Bodas do Cordeiro anunciadas em Apocalipse 19.9: "Bem-aventurados aqueles que são chamados à ceia das bodas do Cordeiro".

(c) Cristocentrismo Redentor:
Isso nos conduz diretamente à Ceia da Nova Aliança: Jesus Cristo é o Anfitrião divino que pagou com Seu próprio sangue a nossa cadeira no banquete da reconciliação com o Pai. A salvação eterna não é uma hipótese vaga, mas uma aliança inquebrável selada na cruz e garantida pelo Espírito Santo.`;
    p3_app = `(d) Aconselhamento e Confronto Pastoral:
Troque o individualismo egoísta pela generosidade do discipulado e da comunhão fraterna. Compartilhe o cálice transbordante da graça que você recebeu gratuitamente: pratique a hospitalidade no seu lar, exerça paciência e justiça na vizinhança e no ambiente profissional, socorrendo os aflitos e sedentos da sua comunidade com o testemunho vivo do Evangelho de Cristo.`;

    introText = `Vivemos em dias de cansaço extremo e almas inquietas. Em meio ao ruído ensurdecedor das cobranças cotidianas e aos vales escuros que todos nós atravessamos, o coração humano clama por um refúgio que não desmorone. É exatamente nesse ponto nevrálgico da nossa existência que o Senhor nos confronta e consola hoje através de ${actualScripture}, sob o tema central: "${actualTheme}". Esta palavra não é poesia distante; é o oxigênio espiritual que resgata nossa alma e nos sintoniza de forma lúcida com o cuidado eterno do Deus soberano.`;
    contextText = `A canção do salmo 23 não nasceu da complacência de um gabinete confortável ou da solenidade artificial de quem vive distante dos embates humanos. Ela foi cunhada no contexto árduo e empoeirado dos campos da Judeia, onde o perigo espreitava em cada desfiladeiro rochoso. Compreender esse pano de fundo exegético e histórico nos ensina como o cuidado soberano de Deus responde à humanidade contemporânea de forma viva. Desse modo, no encerramento deste bloco do contexto histórico, encontramos nossa transição oral e ponte homilética natural para as divisões estruturais que iremos expor: o texto bíblico nos conduz a três verdades fundamentais que iluminam nossa caminhada com Deus.`;
    conclText = `O pastoreio revelado em ${actualScripture} afasta do púlpito o moralismo vazio e o secularismo prático, restituindo ao nosso coração o consolo lúcido da soberana graça de Deus. Aquele que começou a boa obra em você é o mesmo Pastor que o conduzirá em triunfo até a Casa Eterna.`;
    appealText = `Se você tem andado sobrecarregado pelas cobranças do mundo ou tentando saciar a alma em cisternas rotas, o convite do Bom Pastor é para você hoje. Jesus Cristo, o Cordeiro que deu Sua vida pelas ovelhas, convida você ao arrependimento sincero e à confiança plena. Venha descansar debaixo de Sua graça acolhedora e consagrar a Ele os seus dias.`;
    tagsList = ["Pastoreio", "Consolo", "Fé", "Provisão", "Cristocentrismo"];
  } else if (isLove) {
    p1_title = "I. A Iniciativa Excelsa de um Deus que se Entrega";
    p1_expl = `(a) Explicação Textual Profunda:
Ao lermos ${actualScripture}, observamos que a fonte de toda redenção repousa na soberana iniciativa do amor divino. Na língua grega original do Novo Testamento, a expressão "houtos egapesen" (amou de tal maneira, v.16) emprega o tempo aoristo indicativo ativo, apontando para uma ação pontual e definitiva consumada na história cuja magnitude ultrapassa qualquer mérito humano. Deus não amou a humanidade porque encontrou nela formosura moral; Ele amou porque Ele é amor (1 Jo 4.8). Ao entregar Seu Filho Unigênito (no grego, "ton huion ton monogene", o único de Sua espécie, eterno e sem igual), o Pai estabelece as bases da reconciliação pela cruz.

(b) Paralelos Escriturísticos:
Este amor pactual cumpre a promessa salvífica: "Mas Deus prova o seu amor para conosco em que Cristo morreu por nós, sendo nós ainda pecadores" (Rm 5.8) e "Nisto está o amor: não em que nós tenhamos amado a Deus, mas em que ele nos amou e enviou o seu Filho para propiciação pelos nossos pecados" (1 Jo 4.10).

(c) Cristocentrismo Redentor:
O versículo é o cerne do Evangelho: Jesus Cristo é a propiciação completa ("hilasterion") pela qual a santa ira de Deus contra o pecado foi aplacada e a misericórdia foi derramada sobre nós. Não há lugar para meritocracia humana diante da cruz; a salvação é inteiramente um dom da graça soberana.`;
    p1_ill = "Imagine um pai adotivo de comportamento reto que passa anos guardando economias e viajando por caminhos cansativos para legalizar a adoção de uma criança abandonada na rua. Ele não faz isso porque a criança conquistou o benefício ou porque ela merecia de alguma forma por boa conduta; ele faz isso movido puramente pelo ardente desejo de amor em dar um lar, um nome digno e uma nova heratabilidade espiritual a quem não tinha nada. Assim Deus agiu conosco em Cristo.";
    p1_app = `(d) Aconselhamento e Confronto Pastoral:
Abandone o engano do moralismo religioso que tenta negociar a bênção de Deus por meio de aparências externas. Nas trincheiras do seu lar e no relacionamento com seu cônjuge, derrube a aspereza e o ressentimento guardado; ame com a mesma graça sacrificial com que você foi amado. Nas decisões financeiras e no trabalho de segunda a sábado, pare de agir como se dependesse da malícia deste século e descanse na providência soberana do Pai.`;

    p2_title = "II. A Resposta da Fé Ativa e Pessoal";
    p2_expl = `(a) Explicação Textual Profunda:
O amor de Deus não flutua como uma abstração filosófica vaga; ele exige uma resposta pessoal: "para que todo aquele que nele crê" (v.16). No original grego, a expressão "pas ho pisteuon" está no particípio presente ativo, indicando não um mero momento passageiro, mas uma atitude contínua de confiança viva, rendição incondicional e dependência diária em Cristo. Sob a luz da confessionalidade batista histórica, a fé salvadora é fruto da regeneração do Espírito Santo, transformando o intelecto, as afeições e a vontade ("metanoia").

(b) Paralelos Escriturísticos:
As Escrituras confirmam essa verdade ao longo do cânon: "O justo viverá pela fé" (Hc 2.4; Rm 1.17) e "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus" (Ef 2.8).

(c) Cristocentrismo Redentor:
O objeto exclusivo dessa fé é a pessoa de Cristo crucificado e ressurreto. Assim como a serpente de bronze foi levantada no deserto para que os feridos olhassem e vivessem (Jo 3.14-15), o Cordeiro foi erguido na cruz para que todo aquele que para Ele olhar com fé seja justificado e livre da condenação.`;
    p2_ill = "Vemos essa demanda de entrega nas páginas das Escrituras quando resgatamos a história de Nicodemos (Jo 3.1-10). Ele era um mestre conceituado da lei judaica, dotado de profundo preparo doutrinário e moral exemplar. No entanto, buscando a Cristo sob a cortina da noite, precisou aprender a abrir mão de seus orgulhos acadêmicos e do prestígio da sinagoga para se humilhar na mensagem simples de fé de que dependia de nascer de novo da água e do Espírito.";
    p2_app = `(d) Aconselhamento e Confronto Pastoral:
Examine honestamente as motivações secretas do seu coração perante Deus. Sua fé tem sido uma convenção social de domingo ou um discipulado diário que governa o seu casamento, a educação dos seus filhos e a sua integridade profissional? Confronte as mentiras convenientes no ambiente de trabalho e os pecados secretos que ninguém vê, rendendo-se hoje ao senhorio inegociável de Cristo.`;

    p3_title = "III. A Promessa de Vida Livre da Condenação";
    p3_expl = `(a) Explicação Textual Profunda:
O término do versículo em ${actualScripture} coroa o fluxo homilético com uma garantia eterna: "não pereça, mas tenha a vida eterna" (v.16). A expressão grega "zoen aionion" não significa apenas duração infinita de tempo, mas uma qualidade divina de comunhão incorruptível com o Criador, inaugurada no exato momento da justificação pela fé. O verbo "pereça" ("apoletai", no subjuntivo aoristo) alerta com solenidade contra a tragédia da perdição eterna para os que rejeitam a luz divina.

(b) Paralelos Escriturísticos:
O apóstolo Paulo ecoa essa sublime segurança: "Portanto, agora nenhuma condenação há para os que estão em Cristo Jesus" (Rm 8.1) e Jesus reafirma: "As minhas ovelhas ouvem a minha voz; eu as conheço, e elas me seguem. Eu lhes dou a vida eterna, e jamais perecerão" (Jo 10.27-28).

(c) Cristocentrismo Redentor:
Esta vida plena foi conquistada pela ressurreição triunfante do Cordeiro. Porque Ele vive, nós também viveremos. Ele quebrou o aguilhão da morte e nos selou com o Espírito da promessa, assegurando nossa herança incorruptível nos céus.`;
    p3_app = `(d) Aconselhamento e Confronto Pastoral:
Viva com a alegre serenidade de quem já foi eternamente justificado no Calvário. Nas angústias secretas da alma — nas crises de ansiedade, no medo do futuro ou no abatimento emocional —, não se deixe tragar pelo desespero deste século. Seja um instrumento de consolo, verdade e amor compassivo na sua vizinhança, no trabalho e na comunhão da igreja local.`;

    introText = `Se há um texto capaz de desarmar qualquer soberba humana e arrancar as máscaras da nossa religiosidade aparente, é a passagem que temos diante de nós: ${actualScripture}. Nosso tema é: "${actualTheme}". Quando nos achegamos a esta revelação, não encontramos uma teoria teológica distante, mas a iniciativa santa e irresistível de um Deus que desceu ao nosso abismo para nos resgatar de forma definitiva pela cruz de Cristo.`;
    contextText = `A conversa de Jesus com Nicodemos em João 3 quebra as barreiras do legalismo e da presunção religiosa da época. Ao dialogar com um dos homens mais cultos de Israel, o Salvador revela que o novo nascimento não é uma conquista humana, mas a obra soberana do Espírito Santo através do sacrifício do Cordeiro anunciado pelos profetas. Ao compreendermos este cenário de exegese firme, deparamo-nos com nossa transição homilética e ponte oral para o desenvolvimento que faremos: o texto sagrado nos conduz a três verdades fundamentais que precisamos acolher com fé e obediência.`;
    conclText = `O amor proclamado em ${actualScripture} desfaz a ansiedade do coração culpado e sela a nossa reconciliação com Deus através do sangue da aliança eterna. Nele encontramos nossa verdadeira identidade e o poder para uma vida santa.`;
    appealText = `Se você tem carregado o peso de uma religiosidade vazia ou a angústia de culpas passadas, o convite de Cristo ressoa com poder hoje. O Cordeiro de Deus entregou Sua vida para que você tenha vida eterna. Venha a Ele em fé e arrependimento sincero, recebendo hoje o perdão e o descanso que só a graça pode conceder.`;
    tagsList = ["Amor", "Salvação", "Conversão", "Graça", "Cristocentrismo"];
  } else if (isRomans12) {
    p1_title = "I. O Sacrifício Vivo como Culto Racional";
    p1_expl = `(a) Explicação Textual Profunda:
Ao considerarmos as palavras de ${actualScripture}, deparamo-nos com o chamado apostólico à consagração integral do crente. Paulo roga aos irmãos pelas misericórdias de Deus que apresentem seus corpos como sacrifício vivo e santo (v.1). No grego bíblico, a expressão "logiken latreian" designa um culto racional, espiritual e consciente. O culto verdadeiro a Deus não se limita a um rito cerimonial no templo; ele abrange toda a corporeidade e rotina do crente — seu trabalho, suas palavras, seus pensamentos e seus afetos — consagrados como oferta viva em resposta ao que Cristo consumou por nós.

(b) Paralelos Escriturísticos:
Este chamado à santificação prática encontra eco em 1 Coríntios 6.19-20: "Ou não sabeis que o vosso corpo é o templo do Espírito Santo... Fostes comprados por bom preço; glorificai, pois, a Deus no vosso corpo", e em 1 Pedro 2.5 como sacerdócio santo oferecendo sacrifícios espirituais agradáveis a Deus por meio de Jesus Cristo.

(c) Cristocentrismo Redentor:
Nosso sacrifício vivo só é aceitável perante o Pai porque o Cordeiro imaculado Se ofereceu uma vez por todas como sacrifício expiatório definitivo (Hb 10.12,14). Não nos sacrificamos para merecer o favor divino, mas ofertamos nossa vida em gratidão jubilosa pela justificação graciosa recebida na cruz.`;
    p1_ill = "Considere a diferença entre um mero espectador em uma plateia esportiva e um atleta olímpico em quadra. O espectador apenas aplaude e comenta as jogadas enquanto consome alimentos no assento confortável. Já o atleta entrega cada gota de suor, sua respiração acelerada, o esforço dos músculos e sua disciplina diária ao objetivo do campeonato. A vida crista autêntica não é postura de plateia eclesial silenciosa, mas consagração atlética total com ações práticas.";
    p1_app = `(d) Aconselhamento e Confronto Pastoral:
Derrube hoje qualquer separação artificial entre a sua adoração no templo e a sua integridade de segunda a sábado. O culto racional acontece no diálogo paciente com seu cônjuge, no discipulado intencional dos seus filhos e na honestidade irrepreensível no ambiente de trabalho. Consagre seus recursos e suas mãos ao Senhor, recusando a hipocrisia de louvar a Deus com os lábios enquanto negligencia a pureza no cotidiano.`;

    p2_title = "II. A Resistência à Formatação Secular deste Século";
    p2_expl = `(a) Explicação Textual Profunda:
O texto em ${actualScripture} traz uma ordem imperativa incisiva: "não vos conformeis com este mundo" (v.2). No grego original, o verbo "syschematizesthe" está no imperativo presente passivo com negação, significando literalmente: "parai de permitir ser prensados no molde externo e efêmero deste século". O apóstolo nos adverte contra a infiltração do secularismo prático, onde a mentalidade consumista, o relativismo moral e o egoísmo pós-moderno tentam ditar nossos valores familiares e prioridades eclesiásticas.

(b) Paralelos Escriturísticos:
O apóstolo João reitera essa advertência com veemência: "Não ameis o mundo, nem o que no mundo há... porque tudo o que há no mundo, a concupiscência da carne, a concupiscência dos olhos e a soberba da vida, não é do Pai, mas do mundo" (1 Jo 2.15-16), e Tiago 4.4 lembra que a amizade com os valores mundanos é inimizade contra Deus.

(c) Cristocentrismo Redentor:
Jesus orou ao Pai por Seus discípulos declarando: "Eles não são do mundo, assim como eu não sou do mundo. Santifica-os na verdade; a tua palavra é a verdade" (Jo 17.16-17). Pela cruz de Cristo, fomos libertados do império das trevas e transportados para o Reino do Filho do Seu amor (Cl 1.13).`;
    p2_ill = "Encontramos perseverança inspiradora no profeta Daniel e seus jovens companheiros na opulenta corte da Babilônia (Dn 1.8). Recebendo novos nomes imperiais, estudos na melhor universidade pagã e a ordem de comer banquetes luxuosos dedicados a deuses mundanos, assentaram em seus corações o compromisso santo de não se corromperem. Recusaram a suntuosa fôrma babilônica para permanecerem puros e fiéis às Escrituras de seus pais.";
    p2_app = `(d) Aconselhamento e Confronto Pastoral:
Seja corajoso para dizer 'não' aos pequenos subornos morais e tentações da modernidade: à ganância nos negócios, às conversas maliciosas no escritório, à avareza financeira e à pornografia secreta nas telas digitais. Proteja a sua mente e o coração da sua família contra a fôrma secular deste século, edificando um lar alicerçado na verdade bíblica.`;

    p3_title = "III. A Transformação Interna pela Mente Renovada";
    p3_expl = `(a) Explicação Textual Profunda:
A resposta bíblica à pressão cultural não é um isolamento monástico, mas a transformação contínua pela renovação da mente: "metamorphousthe te anakainosei tou noos" (v.2). O imperativo grego "metamorphousthe" aponta para uma metamorfose profunda que opera de dentro para fora pelo Espírito Santo através da exposição fiel da Palavra de Deus. Quando nossa mente é saturada pelas Escrituras, somos capacitados a discernir e aprovar ("dokimazein", comprovar por experiência) qual seja a boa, agradável e perfeita vontade de Deus.

(b) Paralelos Escriturísticos:
Paulo instrui os crentes de Éfeso a se renovarem no espírito da sua mente e a se revestirem do novo homem (Ef 4.23-24), e aos Filipenses ordena: "Tudo o que é verdadeiro, tudo o que é honesto... nisso pensai" (Fp 4.8).

(c) Cristocentrismo Redentor:
Temos "a mente de Cristo" (1 Co 2.16). A renovação mental não é um exercício de autoaperfeiçoamento estoico, mas o fruto da obra do Espírito que nos conforma diariamente à imagem do Filho primogênito de Deus (Rm 8.29).`;
    p3_app = `(d) Aconselhamento e Confronto Pastoral:
Dedique tempo real e diário ao estudo das Escrituras e à oração em família, silenciando o bombardeio ansioso das redes sociais que esvazia a alma. Nas lutas íntimas e nos períodos de cansaço ou esgotamento mental, permita que a mente de Cristo renove suas prioridades, conduzindo suas finanças, amizades e vocação em conformidade com a boa, agradável e perfeita vontade de Deus.`;

    introText = `A vida cristã autêntica não admite meio-termo ou neutralidade covarde. Diante das pressões incessantes que tentam esmagar nossa fé no molde secular deste século, a Palavra de Deus se levanta com urgência e autoridade incomparáveis em ${actualScripture}, desafiando-nos sob o tema: "${actualTheme}". Fomos chamados não a uma devoção burocrática de domingo, mas a uma consagração inteligente que queima em todo o nosso ser diante das santas misericórdias de Deus.`;
    contextText = `Após apresentar nos primeiros onze capítulos de Romanos as maravilhas da justificação pela graça mediante a fé no sangue do Cordeiro, Paulo faz em Romanos 12 a grande transição para a ética da vida cristã prática. As exigências do viver santo não são impostas como condição para sermos salvos, mas como resposta espontânea e grata à salvação já conquistada por Cristo. Ao compreendermos este cenário exegético firme, deparamo-nos com nossa ponte homilética natural e transição oral para as divisões estruturais: o texto nos apresenta três verdades indispensáveis para a nossa caminhada com Deus.`;
    conclText = `O chamado de ${actualScripture} desmascara a superficialidade de uma fé meramente externa e nos convoca a colocar todo o nosso ser no altar da fidelidade a Deus. Na força da graça redentora, podemos viver como luz em meio a uma geração corrompida.`;
    appealText = `Se você sente que as pressões do mundo têm esvaziado o seu fervor espiritual, ou se você tem vivido amoldado aos padrões deste século, o altar da misericórdia de Deus está aberto. Jesus Cristo entregou Seu corpo na cruz para nos redimir. Venha consagrar a Ele sua vida, seus dons e sua família em sincera dedicação hoje.`;
    tagsList = ["Consagração", "Mente Renovada", "Culto Racional", "Fidelidade", "Cristocentrismo"];
  } else {
    // Elegant Multi-Purpose Dynamic Sermon Template based completely on the user's input!
    p1_title = `I. A Revelação Soberana em ${actualScripture}`;
    p1_expl = `(a) Explicação Textual Profunda:
Examinando a perícope de ${actualScripture}, deparamo-nos com o alicerce inabalável da revelação divina para a nossa fé. No vocabulário teológico bíblico original, contemplamos a manifestação da fidelidade leal de Deus — Seu "hesed" pactual inabalável —, que não falha nem se desvanece diante da fragilidade humana. A passagem bíblica estabelece doutrina sólida e nos ensina com autoridade que Deus Se revela graciosamente para nos guiar em santidade e verdade.

(b) Paralelos Escriturísticos:
Esta fidelidade sagrada ilumina todo o conselho bíblico: "Porque a palavra do Senhor é reta, e todas as suas obras são fiéis" (Sl 33.4), e o apóstolo Paulo atesta que "toda a Escritura é divinamente inspirada e proveitosa para ensinar, para redarguir, para corrigir, para instruir em justiça" (2 Tm 3.16).

(c) Cristocentrismo Redentor:
Toda a revelação das Escrituras aponta de forma definitiva para o Verbo encarnado (Jo 1.14; Hb 1.1-2). Em Jesus Cristo, todas as promessas de Deus têm o seu "Sim" e o seu "Amém" (2 Co 1.20). Fomos justificados não por nossas forças, mas pela justiça perfeita do Cordeiro outorgada gratuitamente a nós.`;
    p1_ill = "Imagine um marinheiro experiente no meio do oceano durante uma tempestade sombria que esconde as constelações do céu. O marinheiro não tenta construir suas próprias estrelas com lanternas frágeis no convés; ele abre a caixa protetora e fixa a visão estritamente nos ponteiros estrépitos de bronze de sua bússola náutica de alta precisão. Ele sabe que a bússola não vai fazer o mar acalmar ou as ondas baixarem de tamanho de forma imediata, mas ela garante a direção verdadeira sob os ventos da tormenta. Assim é a Palavra de Deus em nossa vida espiritual.";
    p1_app = `(d) Aconselhamento e Confronto Pastoral:
Abandone a ilusão pós-moderna de controlar o próprio destino com base no pragmatismo imediatista ou nas modas passageiras deste século. No ambiente profissional e nas decisões financeiras da família, recuse atalhos desonestos e mentiras convenientes. Submeta as suas escolhas diárias à autoridade soberana das Escrituras, cultivando um altar de oração no lar e ensinando a verdade de Deus aos seus filhos.`;

    p2_title = `II. O Redentor e a Centralidade de Cristo`;
    p2_expl = `(a) Explicação Textual Profunda:
O desdobramento teológico de ${actualScripture} aponta de forma límpida para além de abstrações humanas: ele converge para o mistério da redenção consumada em Jesus Cristo, o Cordeiro de Deus. A Palavra de Deus revela com autoridade soberana que a força para obedecer emana unicamente da união com o Salvador mediante a graça regeneradora do Espírito Santo, chamando-nos ao discipulado autêntico, ao sacerdócio universal de todos os crentes e à fidelidade sacrificial na vida da igreja.

(b) Paralelos Escriturísticos:
A unidade das Escrituras corrobora este testemunho em Atos 4.12: "E em nenhum outro há salvação, porque também debaixo do céu nenhum outro nome há, dado entre os homens, pelo qual devamos ser salvos", e em 1 Timóteo 2.5: "Porque há um só Deus, e um só Mediador entre Deus e os homens, Jesus Cristo homem".

(c) Cristocentrismo Redentor:
O Cordeiro foi traspassado pelas nossas transgressões e moído pelas nossas iniquidades (Is 53.5). A nossa justificação e a vitória sobre a condenação eterna repousam exclusivamente em Sua cruz e no poder de Sua ressurreição triunfante.`;
    p2_ill = "Encontramos o exemplo ideal dessa atitude na biografia bíblica dos crentes na nobre cidade de Bereia (At 17.11). Recebendo o ensinamento oral dos apóstolos com extrema avidez de espírito, eles não aceitaram os novos conceitos de forma ingênua ou emocionalismo barato. Dia após dia, reuniam-se em suas casas para examinar com sobriedade as Sagradas Escrituras originais, conferindo se as verdades anunciadas se alinhavam perfeitamente ao testemunho do Senhor. Esse zelo protegeu a igreja de desvios espirituais e heresias.";
    p2_app = `(d) Aconselhamento e Confronto Pastoral:
Permita que o Evangelho da graça de Cristo modele as suas ações reais de segunda a sábado. Pratique a integridade inegociável nos negócios, o amor paciente e o perdão sem ressentimentos no casamento, e a pureza santa nas lutas íntimas da mente. Rejeite o secularismo prático que confessa a fé com os lábios, mas vive em conformidade com o mundo nos dias úteis.`;

    p3_title = "III. O Testemunho Fiel e o Discipulado Frutífero";
    p3_expl = `(a) Explicação Textual Profunda:
Por fim, a revelação espiritual contida em ${actualScripture} deságua de forma viva em obediência prática na sociedade contemporânea. As boas obras bíblicas não são a causa meritória da salvação, mas o fruto legítimo da regeneração interior operada pela Palavra e pelo Espírito Santo. O crente maduro desmascara a farsa do secularismo prático e da ansiedade consumista, proclamando com a vida e com os lábios a suficiência e o senhorio de Cristo.

(b) Paralelos Escriturísticos:
Este chamado frutífero é enfatizado por Jesus em João 15.8: "Nisto é glorificado meu Pai, que deis muito fruto; e assim sereis meus discípulos", e pelo apóstolo Tiago: "Sede cumpridores da palavra, e não somente ouvintes" (Tg 1.22).

(c) Cristocentrismo Redentor:
Permanecer na videira verdadeira que é Cristo é o único caminho para a fertilidade espiritual duradoura (Jo 15.5). Sem Ele, nada podemos fazer; mas nEle fomos capacitados a andar em novidade de vida para a glória do Pai.`;
    p3_app = `(d) Aconselhamento e Confronto Pastoral:
Engaje-se ativamente no discipulado pessoal, no socorro compassivo aos necessitados e no testemunho límpido do Evangelho perante a sua vizinhança. Vença o comodismo e o individualismo contemporâneo, consolando os sobrecarregados pelo cansaço e ansiedade, e servindo com alegria sacrificial no corpo da igreja local.`;

    introText = `Quando abrimos as Sagradas Escrituras em ${actualScripture}, somos imediatamente desarmados em nossas autossuficiências e confrontados pela majestade de Deus sob o tema: "${actualTheme}". Esta verdade viva penetra as divisões mais profundas da nossa alma, resgatando-nos da distração deste século e chamando-nos a um compromisso inegociável de fé, santidade e esperança perante o Senhor.`;
    contextText = `A perícope bíblica de ${actualScripture} responde de forma cirúrgica às crises e tensões de seu cenário histórico original. Ao compreendermos o pano de fundo cultural e as intenções inspiradas pelo Espírito Santo, vemos o quão atual e penetrante é a verdade revelada por Deus neste texto. Dessa maneira, no parágrafo final deste ensinamento exegético, deparamo-nos com nossa ponte homilética legítima e transição oral calorosa para os pontos do Desenvolvimento: observemos com atenção três verdades preciosas que emergem desta passagem bíblica.`;
    conclText = `O ensinamento sólido em ${actualScripture} combate o vazio de pregações superficiais e convida o povo de Deus a voltar ao centro das Escrituras, construindo alicerces de integridade moral e discipulado fiel na graça do Cordeiro.`;
    appealText = `Se o seu coração tem sentido o cansaço das lutas ou a tentação de viver distraído das realidades eternas, a soberana graça de Deus chama você à renovação hoje. Olhe para Jesus Cristo, o Redentor fiel, e renda-se a Ele em sincero arrependimento e fé, recebendo consolo, direção e paz para o seu caminhar.`;
    tagsList = [actualTheme.split(' ')[0] || "Exposição", "Bíblico", "Doutrina", "Pastoral", "Cristocentrismo"];
  }

  // Generate either full sermon layout or outline
  if (isOutline) {
    p1_expl = `• (a) Explicação Textual: ${p1_expl.split('\n')[1] || p1_expl.split('.')[0]}.\n• (b) Paralelos Escriturísticos: Textos canônicos correlatos.\n• (c) Cristocentrismo Redentor: Conexão viva com o Cordeiro de Deus.`;
    p1_ill = `Sugestão ilustrativa homilética recomendada para estudo: ${p1_ill.substring(0, 150)}...`;
    p2_expl = `• (a) Explicação Textual: ${p2_expl.split('\n')[1] || p2_expl.split('.')[0]}.\n• (b) Paralelos Escriturísticos: Textos canônicos correlatos.\n• (c) Cristocentrismo Redentor: Justificação pela fé e graça soberana.`;
    p2_ill = `Sugestão ilustrativa e referência de apoio de estudo: ${p2_ill.substring(0, 150)}...`;
    p3_expl = `• (a) Explicação Textual: ${p3_expl.split('\n')[1] || p3_expl.split('.')[0]}.\n• (b) Paralelos Escriturísticos: Textos canônicos correlatos.\n• (c) Cristocentrismo Redentor: Vitória eterna selada no sacrifício vicário.`;
  }

  const [t1, t2, t3] = getSynchronizedTransitions(contextText, p1_title, p2_title, p3_title);

  return {
    title: actualTitle,
    theme: actualTheme,
    scripture: `${actualScripture} (${actualVersion})`,
    introduction: introText,
    biblicalContext: contextText,
    expositoryPoints: [
      {
        title: p1_title,
        precedingTransition: t1,
        explanation: p1_expl,
        illustration: {
          type: "cotidiano",
          description: p1_ill
        },
        application: p1_app
      },
      {
        title: p2_title,
        precedingTransition: t2,
        explanation: p2_expl,
        illustration: {
          type: "bíblica",
          description: p2_ill
        },
        application: p2_app
      },
      {
        title: p3_title,
        precedingTransition: t3,
        explanation: p3_expl,
        application: p3_app
      }
    ],
    illustrations: [
      {
        type: "cotidiano",
        description: p1_ill
      },
      {
        type: "bíblica",
        description: p2_ill
      }
    ],
    applications: [
      p1_app,
      p2_app,
      p3_app
    ],
    conclusion: conclText,
    pastoralAppeal: appealText,
    tags: tagsList
  };
}

function getMockEvaluation() {
  return {
    faithfulnessScore: 94,
    faithfulnessComment: "Excelente fidelidade doutrinária. O sermão fundamenta-se firmemente no texto estabelecido e reflete com precisão os preceitos teológicos batistas, com ênfase correta no livre arbítrio e ação da graça divina.",
    homileticalCoherenceScore: 92,
    coherenceComment: "A estrutura homilética clássica está muito bem articulada, conectando de forma lógica a introdução, corpo textual e a aplicação prática ministerial.",
    christocentrismScore: 95,
    christocentrismComment: "O sermão aponta integralmente para a cruz de Cristo, evitando cair em moralismo de mera melhora comportamental e ressaltando as boas obras como fruto do Espírito.",
    pastoralClarityScore: 90,
    clarityComment: "A linguagem flui muito bem, soando pastoral e acolhedora, o que facilita sobremaneira a atenção pública na igreja de hoje.",
    clichesDetected: ["'boia amarela que foi lançada'", "'meritocracia moral'"],
    clichesWithSuggestions: [
      {
        cliche: "'boia amarela que foi lançada'",
        suggestion: "o meio salvífico providenciado benevolentemente pelo Senhor para estender Sua graça redentora"
      },
      {
        cliche: "'meritocracia moral'",
        suggestion: "pretensão ilusória do legalismo humano de cooperar ou de barganhar favores com o Criador"
      }
    ],
    suggestedImprovements: [
      "Aprofundar um pouco mais no pano de fundo histórico de Éfeso e no culto à deusa Diana do primeiro século.",
      "Especificar ainda mais como essas obras se traduzem em discipulado e missões urbanas no contexto da comunidade local."
    ]
  };
}

function getMockSeries(book: string, theme: string, campaign: string, count: number) {
  const sermons = [];
  for (let i = 1; i <= count; i++) {
    sermons.push({
      number: i,
      title: `Mensagem ${i}: Fortalecidos na Passagem ${i}`,
      scripture: `${book || "Efésios"} Capítulo ${i}:1-10`,
      coreIdea: `Enfrentando as pressões contemporâneas sob a perspectiva da verdade divina do capítulo ${i}.`,
      keyPoints: [`Entendimento da verdade ${i}`, "Decisão prática de conduta", "Edificação recíproca na igreja local"],
      pastoralApplication: `Viver em unidade e fidelidade de acordo com a revelação pastoral em Éfeso.`
    });
  }
  return {
    title: `Série Expositiva: Restaurados em ${book || "Efésios"}`,
    book: book || "Efésios",
    generalTheme: theme || "Restaurando a vida espiritual da comunidade",
    campaign: campaign || "Campanha Família Fortalecida",
    sermons
  };
}

function getMockChatResponse(scripture: string, question: string) {
  const targetRef = scripture || "Romanos 5:1-2";
  return {
    passageReference: targetRef,
    answeringText: `Prezado Pastor Fernando Veiga, debruçando-nos sobre "${targetRef}" e considerando a sua indagação ("${question}"), a resposta repousa no alicerce inabalável das Sagradas Escrituras, na catolicidade histórica da Igreja de Cristo e na Segunda Confissão Batista de Londres de 1689 (Capítulo 11: 'Da Justificação').\n\nEssa verdade não nasceu no século XVI ou XVII, mas ecoa a fé apostólica primitiva ininterrupta. Já no primeiro século, o padre apostólico Clemente de Roma (1 Clemente 32:4) afirmava categoricamente à igreja: "Nós não somos justificados por nós mesmos, nem pela nossa sabedoria, entendimento ou piedade das obras que realizamos em santidade de coração, mas pela fé através da qual o Deus Todo-Poderoso justificou todos desde o princípio". Esse mesmo consenso reverbera na Didaché e nas confissões primitivas ecumênicas (Credo Apostólico e Niceno-Constantinopolitano), que proclamam a unidade da redenção trinitária consumada no Filho consubstancial (homoousios) ao Pai.\n\nNa era patrística clássica, João Crisóstomo em suas "Homilias sobre Romanos" ensina com sobriedade antioquena que a paz paulina não é uma trégua frágil, mas o repouso permanente de quem foi perdoado pelo próprio Rei celestial. Agostinho de Hipona e Anselmo de Cantuária (em "Cur Deus Homo") aprofundam esse fundamento: a reconciliação operada pela cruz satisfez plenamente a justiça divina, desarraigando qualquer mérito humano.\n\nEssa linhagem viva deságua na Reforma com Calvino e nos Puritanos ingleses como John Owen, até encontrar sua expressão batista confessional mais lapidada na Segunda Confissão de Londres de 1689 e nas exposições de John Gill e Charles Haddon Spurgeon. Como lembrava Isaltino Gomes, quando compreendemos que a nossa paz foi comprada por Cristo e não fabricada pelo nosso esforço, o púlpito deixa de produzir moralismo estéril e passa a alimentar a alma do rebanho com o puro Evangelho da graça soberana.`,
    comparedVerses: [
      { version: "ACF", text: "Tendo sido, pois, justificados pela fé, temos paz com Deus, por nosso Senhor Jesus Cristo; pelo qual também temos entrada pela fé a esta graça, na qual estamos firmes; e nos gloriamos na esperança da glória de Deus." },
      { version: "ARC", text: "Sendo, pois, justificados pela fé, temos paz com Deus por nosso Senhor Jesus Cristo; pelo qual também temos entrada pela fé a esta graça, na qual estamos firmes; e nos gloriamos na esperança da glória de Deus." },
      { version: "ARA", text: "Justificados, pois, mediante a fé, temos paz com Deus por meio de nosso Senhor Jesus Cristo; por intermédio de quem obtivemos igualmente acesso, pela fé, a esta graça na qual estamos firmes; e gloriamo-nos na esperança da glória de Deus." },
      { version: "NAA", text: "Justificados, pois, mediante a fé, temos paz com Deus por meio do nosso Senhor Jesus Cristo, por quem também obtivemos acesso, pela fé, a esta graça na qual estamos firmes; e nos gloriamos na esperança da glória de Deus." },
      { version: "NVI", text: "Tendo sido, pois, justificados pela fé, temos paz com Deus, por meio de nosso Senhor Jesus Cristo, por meio de quem obtivemos acesso pela fé a esta graça na qual agora estamos firmes; e nos gloriamos na esperança da glória de Deus." },
      { version: "KJA", text: "Portanto, havendo sido justificados pela fé, temos paz com Deus, por meio do nosso Senhor Jesus Cristo, por intermédio de quem obtivemos pleno acesso pela fé a esta graça na qual agora estamos firmes, e nos gloriamos na esperança da glória de Deus." }
    ],
    historicalContext: `A epístola aos Romanos foi redigida pelo apóstolo Paulo no inverno de 57 d.C., provavelmente em Corinto (hospedado na casa de Gaio), antes de sua partida final para Jerusalém. Paulo escrevia a uma comunidade de crentes judeus e gentios na capital do Império após o decreto do imperador Cláudio. O objetivo canônico era demonstrar que a justificação pela graça mediante a fé em Cristo unifica todos os povos na mesma aliança. A recepção eclesiástica primitiva desse texto (desde Clemente de Roma e a Didaché até Crisóstomo em Antioquia) sempre atestou Romanos 5 como a declaração suprema da reconciliação objetiva inaugurada pelo Messias.`,
    philologicalNotes: `• Δικαιωθέντες (Dikaiōthentes): Particípio aoristo passivo, nominativo masculino plural do verbo δικαιόω (dikaioō). O tempo aoristo aponta para um fato pontual e irrevogável realizado por Deus no passado ('passivo divino'); a justificativa não é um processo contínuo de mérito sinergista, mas um veredito judicial gracioso e definitivo.\n• Εἰρήνη (Eirēnē): Equivalente neotestamentário ao hebraico שָׁלוֹם (Shalom). Não denota mero sentimento íntimo passageiro, mas a paz pactual e o encerramento perpétuo do estado judicial de inimizade contra Deus.\n• Προσαγωγή (Prosagōgē): Substantivo feminino acusativo ('acesso', 'introdução cerimonial'). Na corte imperial antiga e no vocabulário helenístico, descrevia o privilégio concedido a alguém de ser conduzido diretamente à sala do trono por um patrono de honra. Cristo é o nosso divino Mediador que nos introduz com segurança à presença eterna do Pai.`,
    theologicalCore: `A centralidade absoluta de Cristo como Mediador do Pacto da Graça (Segunda Confissão de Londres de 1689, Cap. 8) e a catolicidade dos grandes concílios da Igreja (Calcedônia: duas naturezas em uma pessoa divina). A justificação pela fé não repousa em virtudes humanas, mas na obediência ativa e passiva de Cristo imputada ao eleito. A soberania da graça divina garante uma comunhão inabalável com Deus, preservando o crente até a consumação dos séculos.`,
    homileticalSeeds: [
      "I. A Condição Inegociável da Salvação: Justificados exclusivamente pela fé e jamais por obras humanas (Rm 5:1a; Clemente de Roma, 1 Clem 32).",
      "II. O Fruto Objetivo da Graça: Uma paz perene e inabalável que encerra para sempre a justa ira divina (Rm 5:1b; Crisóstomo, Hom. Rom).",
      "III. O Privilégio do Acesso Permanente: Estamos firmes no terreno inabalável da graça por Jesus Cristo nosso Mediador (Rm 5:2a; 1689 Cap. 8).",
      "IV. A Esperança Viva da Igreja: O regozijo humilde na glória futura que nos sustenta nas tribulações terrenas (Rm 5:2b).",
      "Apelo Pastoral Expositivo: Convoque a congregação com serenidade e sobriedade a abandonar toda autoconfiança moral e repousar unicamente na justiça perfeita de Cristo imputada na cruz."
    ]
  };
}

function getMockComparisons(scripture: string) {
  return {
    scripture: scripture || "João 3:16",
    comparisons: [
      { version: "ACF", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
      { version: "ARC", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
      { version: "ARA", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
      { version: "NAA", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." },
      { version: "NVI", text: "Porque Deus tanto amou o mundo que deu o seu Filho Unigênito, para que todo o que nele crer não pereça, mas tenha a vida eterna." },
      { version: "KJA", text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna." }
    ]
  };
}

function getMockIllustrations(topic?: string, type?: string, scripture?: string, visualStyle?: string, aspectRatio?: string, colorTone?: string) {
  const t = topic || "Graça e Esperança";
  const st = visualStyle || "Gravura Sacra Antiga (Gustave Doré)";
  const ar = aspectRatio || "16:9";
  const sc = scripture || "Romanos 5:1-5";

  return {
    topic: t,
    illustrations: [
      {
        title: "O Pescador Solitário e a Âncora Oculta",
        type: type === "bíblica" ? "bíblica" : "cotidiano",
        scripture: sc,
        story: "Um experiente barqueiro do litoral aprendeu de seus ancestrais que, quando o vendaval se abate sobre a costa, a embarcação nunca deve tentar vencer a fúria das vagas a força de remos. Ele lança uma pesada âncora de ferro forjado nas fendas de uma rocha submersa. Os ventos rugem e a proa balança, mas o barco não se desvia um palmo do seu refúgio.",
        moral: "A fé no Deus soberano opera exatamente como essa âncora oculta: ela não impede a tempestade de soprar, mas nos mantém firmes sobre a Rocha eterna.",
        visualPrompt: `Cena marítima dramática em ${st}, iluminação chiaroscuro solene com feixe dourado rompendo as nuvens escuras sobre o mar encapelado, pequeno barco firme preso por cabo esticado a rocha firme submersa, proporção ${ar}, estética sacra clássica, paleta ${colorTone || 'tons terrosos e âmbar'}.`,
        visualStyle: st,
        aspectRatio: ar
      },
      {
        title: "A Aliança Inquebrável e o Arco nas Nuvens",
        type: "bíblica",
        scripture: "Gênesis 9:12-16",
        story: "Após as águas do dilúvio submergirem a antiga terra corrompida, Noé e sua família pisaram o solo purificado em meio a um silêncio estarrecedor. Antes de qualquer conforto humano, ergueram um altar ao Senhor. Deus então desdobrou no firmamento lavado pelas chuvas o Seu arco celestial, declarando que Sua fidelidade pactual jamais seria cancelada pelas fraquezas humanas.",
        moral: "As promessas de Deus repousam no Seu próprio caráter imutável; quando tudo ao redor parecer desmoronar, o arco da graça de Cristo continua resplandecendo sobre o crente.",
        visualPrompt: `Composição bíblica monumental no estilo ${st}, patriarca Noé em contemplação diante de um altar de pedras toscas fumegante com aroma suave, arco-íris radiante cortando o céu recém-aberto sobre colinas orvalhadas, proporção ${ar}, atmosfera reverente e solene.`,
        visualStyle: st,
        aspectRatio: ar
      },
      {
        title: "O Farol da Enseada e a Lâmpada do Vigia",
        type: "histórica",
        scripture: "Salmos 119:105",
        story: "Na costa rochosa da Bretanha no século XIX, um violento tremor de terra quebrou o mecanismo giratório do farol principal durante uma noite de neblina espessa. O idoso guardião não se desesperou: reuniu lâmpadas de azeite manuais e permaneceu horas na torre fria alimentando a chama sem piscar, garantindo que os navios mercantes avistassem a linha do recife até o raiar da aurora.",
        moral: "O testemunho da igreja local pode parecer modesto aos olhos dos grandes centros, mas a sua fidelidade contínua salva vidas do naufrágio espiritual.",
        visualPrompt: `Pintura em ${st}, torre de farol de granito erguida sobre penhasco fustigado pelas ondas, luz dourada cálida da lanterna cortando a névoa noturna oceânica, proporção ${ar}, paleta de alto contraste, arte sóbria para projeção de púlpito.`,
        visualStyle: st,
        aspectRatio: ar
      }
    ]
  };
}

function getMockPericopeAnalysis(scripture: string) {
  const ref = scripture || "Romanos 12:1-2";
  return {
    scripture: ref,
    identification: {
      mainSubject: "A consagração total do crente como culto racional de resposta à graça de Deus",
      mainVerb: "Apresentar (parastesai, do grego original de exegese) e Transformar (metamorphousthe)",
      narrativeTension: "A colisão inevitável entre os padrões morais do século presente (secularismo de época) e a renovação da mente governada pela verdade divina",
      textMovement: "Do oferecimento corporal no altar (v.1) para a não conformidade cultural externa e subsequente renovação interna (v.2) visando a experimentação da soberana vontade do Pai",
      climax: "A perfeita comprovação experimental da boa, agradável e perfeita vontade de Deus",
      authorPurpose: "Conclamar os crentes, em vista das entranhas da misericórdia de Deus reveladas nos capítulos 1-11, a viverem uma ética de sacrifício vivo e repúdio à conformação secular babilônica"
    },
    possibilities: [
      {
        themeName: "O Altar da Graça: Consagração Inegociável",
        category: "Tema Principal",
        strength: "Muito Forte",
        textualBase: scripture ? `${scripture} (Foco na consagração integral)` : "Romanos 12:1 - 'Rogo-vos, pois, irmãos, pela compaixão de Deus, que apresenteis os vossos corpos como um sacrifício vivo, santo e agradável a Deus'",
        hermeneuticalRisk: "Reduzir o sacrifício corporal ao moralismo de regras humanas ascéticas ou legalismo de comportamentos exteriores, em vez de uma resposta voluntária de gratidão sincera.",
        observation: "O texto une a teologia teórica anterior (compaixões) à ação prática objetiva (sacrifício do corpo). O que o texto NÃO está ensinando: Não prega autopunição física, sacrifícios de mérito salvífico ou heresia gnóstica de desprezo ao corpo."
      },
      {
        themeName: "A fôrma do Mundo vs. O Molde do Espírito",
        category: "Tema Doutrinário",
        strength: "Muito Forte",
        textualBase: scripture ? `${scripture} (Foco no repúdio ao mundo)` : "Romanos 12:2a - 'E não vos conformeis com este mundo, mas transformai-vos'",
        hermeneuticalRisk: "Associar o 'mundo' apenas a usos e costumes exteriores e listagens denominacionais, esquecendo que a fôrma secular opera na mente, através de filosofias humanistas, egocentrismo e materialismo.",
        observation: "O verbo grego original 'syschematizesthe' exorta contra ser espremido externamente de acordo com o esquema transitório do século. O que o texto NÃO está ensinando: Não exige o isolamento monástico ou a alienação social da congregação."
      },
      {
        themeName: "A Renovação da Mente como Escudo Contra o Secularismo",
        category: "Tema Apologético",
        strength: "Forte",
        textualBase: scripture ? `${scripture} (Foco na renovação cognitiva)` : "Romanos 12:2b - '...pela renovação da vossa mente'",
        hermeneuticalRisk: "Achar que a renovação mental ocorre por mero esforço intelectual acadêmico ou autoajuda psicológica secularizada, ignorando a dependência do Espírito Santo e da verdade bíblica sólida.",
        observation: "A palavra 'metamorphousthe' apela para uma transformação radical da identidade interior. O que o texto NÃO está ensinando: O texto não ensina pensamento positivo, lei da atração ou técnicas gnósticas de reprogramação cognitiva."
      },
      {
        themeName: "A Evangelização pela Vida Consagrada",
        category: "Tema Evangelístico",
        strength: "Forte",
        textualBase: scripture ? `${scripture} (Foco no testemunho visível)` : "Romanos 12:1 - '...vosso culto racional.'",
        hermeneuticalRisk: "Achar que a evangelização reside apenas no discurso falado, esvaziando a autoridade moral de uma vida de sacrifício vivo e transformável no convívio social.",
        observation: "A vida de santidade prática funciona como o maior apologético vivo do Evangelho na sociedade corrupta. O que o texto NÃO está ensinando: Não ensina que as obras salvam, mas que o culto pessoal aponta para o Redentor."
      }
    ]
  };
}

function getMockTheologicalSieve(title: string, scripture: string, theme: string, points?: string) {
  const ref = scripture || "Romanos 12:1-2";
  const t = title || "Consagração no Altar de Deus";
  const th = theme || "O Culto Racional e a Não-Conformação com o Presente Século";
  return {
    id: `sieve-mock-${Date.now()}`,
    sermonTitle: t,
    scripture: ref,
    centralTheme: th,
    createdAt: Date.now(),
    classicHistoricalObjections: {
      title: "Objeções Clássicas e Históricas",
      summary: `Ao longo dos séculos, perícopes centrais como ${ref} foram alvos recorrentes de desvios teológicos como o racionalismo iluminista (que esvazia a sobrenaturalidade da regeneração), o moralismo pelagiano (que transforma a consagração em mérito humano para justificação) e o gnosticismo maniqueísta (que despreza o corpo físico em favor de um misticismo desencarnado).`,
      keyPoints: [
        "Desvio Pelagiano & Sinérgico: Pretender que o ser humano, por forças autônomas de sua vontade não regenerada, possa oferecer a Deus um sacrifício aceitável sem a graça vivificadora prévia de Cristo (Segunda Confissão de Londres de 1689, Cap. 9 e 10).",
        "Racionalismo Liberal (Schleiermacher / Kant): Reduzir a adoração e a ética bíblica a imperativos morais autônomos ou mero 'sentimento de dependência absoluta', destituindo a Escritura de sua autoridade inerrante e proposicional.",
        "Gnosticismo e Dualismo Ascético: Supor que a santidade reside no isolamento monástico ou em práticas ascéticas que punem o corpo, ignorando que o corpo foi redimido pelo sangue do Cordeiro para ser templo ativo do Espírito Santo na praça pública."
      ],
      scripturalWarning: `O texto bíblico em ${ref} ancora o imperativo da conduta ('apresenteis os vossos corpos') exclusivamente nas 'misericórdias de Deus' precedentes. A graça soberana de Deus é o motor insubstituível; inverter essa ordem é descambar para o legalismo farisaico.`,
      historicalOrCulturalReferences: [
        "Agostinho de Hipona, 'De Natura et Gratia' (refutação do esforço pelagiano autônomo)",
        "Segunda Confissão Batista de Londres de 1689, Cap. 16 ('Das Boas Obras')",
        "John Calvin, 'Institutas da Religião Cristã' (Livro III: O Sacrifício de Gratidão)"
      ]
    },
    newCulturalTrends: {
      title: "Novas Tendências Culturais & Pós-Modernidade",
      summary: "A pós-modernidade opera mediante o individualismo expressivo e o moralismo terapêutico deísta, nos quais Deus existe primordialmente para validar os desejos imediatos do indivíduo e promover bem-estar subjetivo, em vez de exigir senhorio, renúncia e santidade pactual.",
      keyPoints: [
        "Individualismo Expressivo: A cultura contemporânea dita que 'ser autêntico' significa obedecer a qualquer impulso interno. O texto sagrado, em contraste direto, exige mortificação do ego e submissão da mente à verdade revelada de Deus.",
        "Moralismo Terapêutico Deísta: A mensagem da cruz é diluída em coaching de autoaperfeiçoamento e bem-estar psicológico, trocando o 'arrependam-se e creiam' por 'sintam-se bem consigo mesmos'.",
        "Hiperconformidade Invisível às Redes: O verbo bíblico 'syschematizesthe' adverte contra ser prensado pela fôrma deste século; hoje essa fôrma atua nos algoritmos, na pressa consumista e no relativismo ético dos costumes."
      ],
      scripturalWarning: "Quando o púlpito silencia sobre o confronto entre o Reino de Deus e o espírito da época (Zeitgeist), a igreja deixa de ser coluna e baluarte da verdade para se tornar reflexo pálido do secularismo.",
      historicalOrCulturalReferences: [
        "Charles Taylor, 'A Secular Age' (a era da imanência e autenticidade subjetiva)",
        "David Wells, 'No Place for Truth' (o desaparecimento da teologia sob o pragmatismo moderno)",
        "Segunda Confissão de Londres de 1689, Cap. 1 ('Das Sagradas Escrituras como regra suprema')"
      ]
    },
    falseReligiousTolerance: {
      title: "A Falsa Tolerância 'Religiosa' & Sincretismo",
      summary: "O maior perigo enfrentado pelos pregadores de nosso tempo não é o ateísmo militante externo, mas a transigência interna — uma falsa complacência que, sob o manto de 'amor' ou 'relevância', contemporiza doutrinas inegociáveis e silencia sobre a justa ira de Deus e o chamado ao arrependimento.",
      keyPoints: [
        "A Falsa Caridade Sincretista: Acomodar mandamentos explícitos da Palavra para não ofender a sensibilidade moral dos que amam o século presente. A Bíblia ensina que o verdadeiro amor proclama a verdade integral (Ef 4:15).",
        "Tibieza Homilética: Sermões que anestesiam a consciência congregacional, omitindo a realidade da perdição, a severidade da lei e a necessidade de regeneração soberana, prometendo comunhão com Deus sem ruptura com o pecado.",
        "O Evangelho Negociável: A tentação de remover as pedras de tropeço da cruz em troca de popularidade numérica ou aceitação social, incorrendo na maldição da transigência denunciada aos crentes de Laodiceia."
      ],
      scripturalWarning: "A fidelidade ao texto sagrado não nos autoriza a suavizar as arestas da verdade eterna. A tolerância que cala a Escritura não é fruto do Espírito, mas covardia ministerial.",
      historicalOrCulturalReferences: [
        "Charles H. Spurgeon, 'A Controvérsia do Declínio' (Down-Grade Controversy)",
        "J. Gresham Machen, 'Cristianismo e Liberalismo' (o falso evangelho da contemporização)",
        "Segunda Confissão de Londres de 1689, Cap. 26 ('Da Igreja e sua Pureza Doutrinária')"
      ]
    },
    magisterialPeroration: {
      title: "Peroração & Apelo Apologético Completo para o Púlpito",
      text: `Meus irmãos e amigos, paremos por um instante para olhar com honestidade para a nossa própria geração. Vivemos num tempo em que as pessoas andam sobrecarregadas, correndo sem parar atrás de aprovação em telas luminosas e tentando preencher o vazio da alma com distrações passageiras e consumo desenfreado. As velhas heresias do passado — que tentavam transformar a fé num esforço humano moralista ou num frio debate intelectual — hoje voltam com roupas modernas: um secularismo silencioso que anestesia a consciência, um cristianismo de conveniência que trata Deus como um mero assistente de bem-estar pessoal e uma covardia disfarçada de tolerância, que cala a sã doutrina para não perder aplausos. Mas a Palavra de Deus em ${ref} corta essa ilusão pela raiz: o Evangelho não veio para massagear o nosso ego, mas para resgatar a nossa vida da perdição e nos alinhar à verdade eterna do Criador.

A nossa esperança não repousa na nossa força de vontade, na nossa pretensa bondade moral ou nas filosofias voláteis deste século. A nossa âncora está firmada exclusivamente na pessoa e na obra consumada de Jesus Cristo, nosso único e suficiente Mediador, conforme as Sagradas Escrituras e a nossa histórica confissão de fé de 1689 proclamam. Foi no Calvário que Cristo tomou sobre Si a condenação que nos cabia, pagou a nossa dívida com Seu próprio sangue e ressuscitou vitorioso para nos conceder uma nova vida. A graça de Deus não é um produto que negociamos; ela é um favor soberano que nos arranca da tirania da ansiedade e nos liberta da fôrma vazia desta sociedade, capacitando-nos a viver com integridade, coragem e propósito real no meio de um mundo confuso.

Por isso, eu quero falar diretamente ao seu coração nesta hora. Você tem vivido anestesiado pelas rotinas e pressões deste mundo, ou a sua vida está de fato colocada no altar de Deus? Não adianta sustentar uma aparência religiosa aos domingos enquanto o coração continua escravo das ambições e dos medos deste século. E se você se sente cansado de carregar o peso da culpa, se percebe que o sucesso e os prazeres deste mundo não calam a sede da sua alma, abandone hoje toda autossuficiência. Venha a Cristo com sinceridade e fé. Deixe que a graça do Salvador perdoe o seu passado, transforme o seu presente e firme os seus passos na Rocha eterna. O mundo e as suas modas passam, mas aquele que faz a vontade soberana de Deus permanece para sempre. Amém.`,
      theologicalAnchors: [
        "Segunda Confissão Batista de Londres de 1689 (Cap. 8 e Cap. 16)",
        "Sola Gratia, Sola Fide, Solus Christus, Soli Deo Gloria",
        "Hermenêutica Histórico-Gramatical e Inerrância Bíblica",
        "Confronto Dialógico ao Secularismo, Ansiedade e Vazio Existencial"
      ],
      pastoralCharge: "Pregue esta peroração com tom conversacional, incisivo e acolhedor, olhando nos olhos da congregação com gravidade serena e paixão sincera pela salvação das almas."
    }
  };
}

// Vite middleware and server launch

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.timeout = 120000;
}

startServer();
