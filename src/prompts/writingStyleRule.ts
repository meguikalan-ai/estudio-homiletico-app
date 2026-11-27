/**
 * Regra centralizada de estilo de escrita para todos os textos gerados pela IA
 * (sermões, esboços, versões derivadas, séries, temas, ilustrações, análises e estudos).
 *
 * Para ajustar o estilo de escrita de todo o aplicativo em um só lugar,
 * edite apenas o texto de CLEAR_WRITING_STYLE_RULE abaixo.
 */
export const CLEAR_WRITING_STYLE_RULE = `Escreva em português claro, bem articulado e de fácil compreensão, para pessoas de qualquer nível de escolaridade. Use linguagem direta e literal. Cada frase deve dizer o que quer dizer, sem exigir que o leitor interprete o que está nas entrelinhas.

Evite:

metáforas, alegorias e figuras de linguagem criadas pelo autor (por exemplo: 'Há um cheiro de perfume caro no ar, mas ninguém quer olhar para o relógio da sala');
frases sugestivas, enigmáticas ou poéticas demais, que deixam a ideia apenas insinuada;
aberturas dramáticas, cenas inventadas para criar clima e finais misteriosos;
palavras raras, jargão acadêmico sem explicação e frases muito longas ou com muitas orações encadeadas.

Prefira:

frases curtas e médias, com uma ideia principal em cada uma;
afirmações diretas: diga primeiro a ideia e depois explique;
palavras do dia a dia; quando um termo teológico for necessário (justificação, propiciação, santificação), explique-o em uma frase simples;
exemplos concretos e reais da vida comum, descritos de forma objetiva;
ligações claras entre as ideias ('por isso', 'porque', 'além disso').

Uso da Bíblia: quando o texto bíblico usar uma figura (por exemplo, 'Eu sou a videira'), explique o seu significado em linguagem simples, mas não crie novas figuras. Mantenha o texto bíblico como está na versão escolhida.

Exemplo:

Evitar: 'Há um cheiro de perfume caro no ar, mas ninguém quer olhar para o relógio da sala.'
Preferir: 'Muitas pessoas vivem bem na aparência, mas evitam pensar que o tempo da vida é limitado.'`;

export const CLEAR_WRITING_STYLE_SECTION = `DIRETRIZ OBRIGATÓRIA DE CLAREZA E ESTILO DE ESCRITA (APLICAR A TODO O CONTEÚDO GERADO):
${CLEAR_WRITING_STYLE_RULE}`;

export function withWritingStyleSystemInstruction(baseInstruction: string): string {
  return `${baseInstruction.trim()}\n\n${CLEAR_WRITING_STYLE_SECTION}`;
}
