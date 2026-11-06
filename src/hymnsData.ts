export interface Hymn {
  number: number;
  title: string;
  theme: string;
  subtheme: string;
  occasion: string;
  emotionalTone: 'solene' | 'vibrante' | 'contemplativo' | 'alegre' | 'restaurador' | 'decisivo';
  keywords: string[];
}

export const BAPTIST_HYMNS: Hymn[] = [
  {
    number: 15,
    title: "Tu és Fiel, Senhor",
    theme: "Fidelidade de Deus",
    subtheme: "Provisão e Cuidado",
    occasion: "Abertura / Gratidão",
    emotionalTone: "solene",
    keywords: ["fidelidade", "provisão", "cuidado", "estabilidade", "promessa", "amanhã", "paz"]
  },
  {
    number: 52,
    title: "Grandioso és Tu",
    theme: "Adoração",
    subtheme: "Criação e Redenção",
    occasion: "Abertura",
    emotionalTone: "vibrante",
    keywords: ["criação", "universo", "grandioso", "glória", "majestade", "poder", "salvação"]
  },
  {
    number: 112,
    title: "Rude Cruz",
    theme: "Crucificação e Morte de Cristo",
    subtheme: "Redenção e Sacrifício",
    occasion: "Ceia do Senhor / Apelo",
    emotionalTone: "contemplativo",
    keywords: ["cruz", "sacrifício", "sangue", "perdão", "amor", "redenção", "calvário"]
  },
  {
    number: 290,
    title: "Alvo Mais que a Neve",
    theme: "Conversão e Salvação",
    subtheme: "Purificação",
    occasion: "Apelo / Batismo",
    emotionalTone: "decisivo",
    keywords: ["sangue", "neve", "purificação", "perdão", "conversão", "pecado", "salvação"]
  },
  {
    number: 370,
    title: "Mais Perto Quero Estar",
    theme: "Vida Cristã",
    subtheme: "Comunhão e Consagração",
    occasion: "Antes da Mensagem",
    emotionalTone: "contemplativo",
    keywords: ["comunhão", "proximidade", "oração", "presença", "dor", "consagração", "deus"]
  },
  {
    number: 175,
    title: "Vencendo Vem Jesus",
    theme: "Segunda Vinda e Escatologia",
    subtheme: "Vitória Final",
    occasion: "Encerramento",
    emotionalTone: "vibrante",
    keywords: ["vinda", "vitória", "justiça", "glória", "triunfo", "combate", "esperança"]
  },
  {
    number: 84,
    title: "Sou Feliz com Jesus",
    theme: "Paz e Confiança",
    subtheme: "Consolação e Segurança",
    occasion: "Antes da Mensagem / Testemunho",
    emotionalTone: "restaurador",
    keywords: ["paz", "feliz", "tempestade", "segurança", "consolação", "graça", "alma"]
  },
  {
    number: 120,
    title: "Maravilhosa Graça",
    theme: "Salvação e Graça",
    subtheme: "Redenção imerecida",
    occasion: "Ceia do Senhor / Abertura",
    emotionalTone: "alegre",
    keywords: ["graça", "perdão", "maravilhosa", "misericórdia", "salvação", "paz", "vida"]
  },
  {
    number: 210,
    title: "Preciosa Graça (Amazing Grace)",
    theme: "Graça de Deus",
    subtheme: "Misericórdia e Perdão",
    occasion: "Apelo / Gratidão",
    emotionalTone: "contemplativo",
    keywords: ["graça", "perdido", "cegor", "salvo", "misericórdia", "esperança", "promessa"]
  },
  {
    number: 310,
    title: "Vem, Visita Tua Igreja",
    theme: "Edificação e Vida da Igreja",
    subtheme: "Avivamento",
    occasion: "Abertura / Oração",
    emotionalTone: "restaurador",
    keywords: ["avivamento", "visita", "igreja", "fogo", "renovo", "espírito", "santo", "poder"]
  },
  {
    number: 405,
    title: "Eis-me Aqui, Senhor",
    theme: "Consagração e Serviço",
    subtheme: "Missões e Evangelismo",
    occasion: "Encerramento / Apelo",
    emotionalTone: "decisivo",
    keywords: ["missões", "chamado", "senhor", "serviço", "proclamação", "campo", "seara"]
  },
  {
    number: 3,
    title: "Castelo Forte é Nosso Deus",
    theme: "Soberania e Proteção de Deus",
    subtheme: "Confiança e Vitória",
    occasion: "Abertura",
    emotionalTone: "vibrante",
    keywords: ["fortaleza", "proteção", "luta", "vencer", "soberano", "palavra", "fé"]
  },
  {
    number: 147,
    title: "Chuvas de Bênçãos",
    theme: "Vida Cristã",
    subtheme: "Bênçãos e Refrigério",
    occasion: "Antes da Mensagem",
    emotionalTone: "alegre",
    keywords: ["bênçãos", "chuvas", "refrigério", "renovo", "promessa", "refrigério", "graça"]
  },
  {
    number: 275,
    title: "Segurança em Jesus",
    theme: "Vida Cristã",
    subtheme: "Paz e Confiança",
    occasion: "Antes da Mensagem",
    emotionalTone: "restaurador",
    keywords: ["segurança", "paz", "abrigo", "descanso", "salvador", "guarda", "confiança"]
  },
  {
    number: 345,
    title: "A Mensagem da Cruz",
    theme: "Evangelismo e Proclamação",
    subtheme: "Testemunho Pessoal",
    occasion: "Encerramento / Apelo",
    emotionalTone: "decisivo",
    keywords: ["mensagem", "cruz", "proclamar", "salvar", "testemunho", "fidelidade", "glória"]
  },
  {
    number: 92,
    title: "Ao Deus de Abrão Louvai",
    theme: "Adoração e Glória",
    subtheme: "Sexta e Sábado",
    occasion: "Abertura",
    emotionalTone: "solene",
    keywords: ["louvor", "abrão", "eterno", "soberano", "rei", "aliança", "fé"]
  },
  {
    number: 182,
    title: "Sublime Graça",
    theme: "Gratidão e Reconhecimento",
    subtheme: "Salvação",
    occasion: "Encerramento",
    emotionalTone: "contemplativo",
    keywords: ["sublime", "graça", "misericórdia", "conversão", "amor", "deus", "salvação"]
  },
  {
    number: 450,
    title: "Trabalhai e Orai",
    theme: "Vida Cristã",
    subtheme: "Discipulado e Serviço",
    occasion: "Encerramento",
    emotionalTone: "vibrante",
    keywords: ["trabalho", "oração", "servir", "discipulado", "seara", "batalha", "fidelidade"]
  },
  {
    number: 100,
    title: "Ó Vinde, Crentes, Com Amor",
    theme: "Adoração e Louvor",
    subtheme: "Glória de Cristo",
    occasion: "Abertura / Ceia do Senhor",
    emotionalTone: "solene",
    keywords: ["culto", "comunhão", "adoração", "salvador", "amor", "louvor", "ceia"]
  },
  {
    number: 160,
    title: "Conversão (Oh, Que Feliz Dia!)",
    theme: "Conversão e Salvação",
    subtheme: "Regeneração",
    occasion: "Apelo / Batismo",
    emotionalTone: "decisivo",
    keywords: ["feliz", "conversão", "novo nascimento", "testemunho", "salvo", "alegria", "deus"]
  }
];

// Helper to recommend hymns based on text parsing or tags
export function selectHymnsForSermon(text: string, category: string, churchProfile: string): {
  abertura: Hymn;
  antesMensagem: Hymn;
  apelo: Hymn;
  encerramento: Hymn;
} {
  const normText = (text + " " + category).toLowerCase();
  
  // Find match helper
  const scoreHymn = (h: Hymn) => {
    let score = 0;
    // Check keywords
    h.keywords.forEach(kw => {
      if (normText.includes(kw)) score += 3;
    });
    // Check theme
    if (normText.includes(h.theme.toLowerCase())) score += 5;
    if (normText.includes(h.subtheme.toLowerCase())) score += 4;
    return score;
  };

  const scored = BAPTIST_HYMNS.map(h => ({ hymn: h, score: scoreHymn(h) }));
  
  // Group by ideal occasion preference
  const aberturas = BAPTIST_HYMNS.filter(h => h.occasion.includes("Abertura"));
  const antesSermao = BAPTIST_HYMNS.filter(h => h.occasion.includes("Antes da Mensagem") || h.occasion.includes("Confiança"));
  const apelos = BAPTIST_HYMNS.filter(h => h.occasion.includes("Apelo") || h.occasion.includes("Decisivo") || h.occasion.includes("Batismo"));
  const encerramento = BAPTIST_HYMNS.filter(h => h.occasion.includes("Encerramento") || h.occasion.includes("Vitória"));

  const getBest = (list: Hymn[]) => {
    let best = list[0];
    let maxS = -1;
    list.forEach(h => {
      const s = scoreHymn(h);
      if (s > maxS) {
        maxS = s;
        best = h;
      }
    });
    return best;
  };

  return {
    abertura: getBest(aberturas.length ? aberturas : BAPTIST_HYMNS),
    antesMensagem: getBest(antesSermao.length ? antesSermao : BAPTIST_HYMNS),
    apelo: getBest(apelos.length ? apelos : BAPTIST_HYMNS),
    encerramento: getBest(encerramento.length ? encerramento : BAPTIST_HYMNS)
  };
}
