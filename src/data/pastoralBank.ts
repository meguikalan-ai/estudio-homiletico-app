import { ThemeSuggestion, CalendarCelebration, Sermon } from "../types";

export const BIBLICAL_THEMES_BANK: Record<string, ThemeSuggestion[]> = {
  "família": [
    {
      theme: "O Lar sobre a Rocha",
      scripture: "Mateus 7:24-27",
      coreIdea: "A família cristã subsiste apenas quando edificada sob a obediência ativa à Palavra de Cristo.",
      pastoralApplication: "Avaliar se as decisões do lar glorificam a Deus ou seguem o pragmatismo contemporâneo."
    },
    {
      theme: "Crise Familiar e Misericórdia",
      scripture: "Gênesis 50:15-21",
      coreIdea: "José perdoa seus irmãos mostrando que a soberania de Deus cura as feridas familiares mais profundas.",
      pastoralApplication: "Promover reconciliação familiar e exercitar o perdão como mandato do Senhor."
    }
  ],
  "discipulado": [
    {
      theme: "O Custo do Discipulado",
      scripture: "Lucas 14:25-33",
      coreIdea: "Seguir a Cristo exige renúncia sincera e priorização absoluta do Reino acima de qualquer afeição terrena.",
      pastoralApplication: "Doutrinar a congregação contra o evangelho fácil e pregar o compromisso da cruz."
    },
    {
      theme: "Discipulado na Era Digital",
      scripture: "Romanos 12:1-2",
      coreIdea: "O crente deve evitar a conformidade com os algoritmos deste mundo, renovando sua mente em Cristo.",
      pastoralApplication: "Práticas de jejum digital, silêncio reflexivo e uso missionário de redes sociais."
    }
  ],
  "oração": [
    {
      theme: "A Oração Fervente do Justo",
      scripture: "Tiago 5:16-18",
      coreIdea: "A oração não é um amuleto, mas um privilégio de comunhão íntima que move a vontade soberana do Pai.",
      pastoralApplication: "Reorganizar reuniões de oração na igreja e instituir clamores diários por avivamento."
    }
  ],
  "santidade": [
    {
      theme: "A Santidade sem a qual ninguém verá o Senhor",
      scripture: "Hebreus 12:14",
      coreIdea: "Santificação é um processo contínuo de separação do pecado e consagração ao serviço divino.",
      pastoralApplication: "Promover integridade moral na vida pública e pureza doutrinária no seio da igreja local."
    }
  ],
  "sofrimento": [
    {
      theme: "Burnout, Fadiga e Descanso do Púlpito",
      scripture: "1 Reis 19:1-8",
      coreIdea: "Diante da exaustão de Elias, Deus não o condena, mas provê descanso, alimento e renovação pastoral silenciosa.",
      pastoralApplication: "Reconhecer limites humanos e descansar na providência física e espiritual de Deus."
    },
    {
      theme: "Depressão, Luto e a Esperança Viva",
      scripture: "Salmo 42:1-11",
      coreIdea: "A alma aflita derrama suas queixas diante de Deus, encontrando consolo na certeza de Sua salvação perpétua.",
      pastoralApplication: "Aconselhamento pastoral integrado para tratar a dor emocional sem julgamento moralista."
    }
  ],
  "evangelismo": [
    {
      theme: "O Clamor pelas Almas Perdidas",
      scripture: "Romanos 10:13-15",
      coreIdea: "A igreja local existe para proclamar a salvação salvadora mediante o envio e pregação da palavra.",
      pastoralApplication: "Treinamentos práticos de evangelismo pessoal e investimentos maciços em missões."
    }
  ],
  "liderança": [
    {
      theme: "Liderança de Serviço",
      scripture: "Marcos 10:42-45",
      coreIdea: "No Reino de Deus, a verdadeira liderança não repousa no autoritarismo, mas na pia do serviço abnegado.",
      pastoralApplication: "Capacitar diáconos e líderes ministeriais focando em humildade e pastoreio voluntário."
    }
  ],
  "juventude": [
    {
      theme: "Identidade e as Redes Sociais",
      scripture: "Salmo 119:9",
      coreIdea: "O jovem purifica o seu caminho guardando a mente com as Escrituras contra a ilusão virtual do pertencimento.",
      pastoralApplication: "Criação de grupos de mentoria de juventude para resgatar a autoimagem baseada unicamente na cruz."
    }
  ],
  "missões": [
    {
      theme: "O Mandato da Grande Comissão",
      scripture: "Mateus 28:18-20",
      coreIdea: "Nossa autoridade repousa em Cristo para fazer discípulos de todas as nações, batizando e ensinando.",
      pastoralApplication: "Plantar novas igrejas locais independentes e enviar vocacionados para os campos necessitados."
    }
  ],
  "esperança": [
    {
      theme: "Vencendo a Ansiedade do Amanhã",
      scripture: "Mateus 6:25-34",
      coreIdea: "A ansiedade sufoca a alma. Buscar primeiro o Reino resolve a angústia sobre o sustento físico.",
      pastoralApplication: "Exercitar gratidão pelas pequenas provisões diárias e descansar sob a soberana mão do Pai."
    }
  ],
  "avivamento": [
    {
      theme: "Arrependimento e Novo Renovo",
      scripture: "2 Crônicas 7:14",
      coreIdea: "O verdadeiro avivamento nasce da humilhação, arrependimento sincero, oração constante e busca da face de Deus.",
      pastoralApplication: "Convocação geral da igreja local para um dia de humilhação e confissão pública de pecados."
    }
  ]
};

export const CHRISTIAN_THEMATIC_CALENDAR: CalendarCelebration[] = [
  {
    id: "natal",
    title: "Natal do Senhor",
    description: "Celebração do milagre da Encarnação de Verbo Divino.",
    dateSuggestion: "Dezembro",
    suggestedTheme: "E o Verbo se Fez Carne",
    scripture: "João 1:14",
    hymnSuggestion: "Hino 42: Noite de Paz"
  },
  {
    id: "pascoa",
    title: "Páscoa da Ressurreição",
    description: "Vitória definitiva de Cristo sobre o pecado, o túmulo e a morte.",
    dateSuggestion: "Março / Abril",
    suggestedTheme: "Ele Ressurgiu, como Havia Dito",
    scripture: "Mateus 28:6",
    hymnSuggestion: "Hino 102: Cristo Já Ressurgiu!"
  },
  {
    id: "pentecostes",
    title: "Domingo de Pentecostes",
    description: "Capacitação capacitadora do Espírito Santo para a proclamação universal.",
    dateSuggestion: "Maio / Junho",
    suggestedTheme: "Cheios do Espírito Santo",
    scripture: "Atos 2:1-4",
    hymnSuggestion: "Hino 310: Vem, Visita Tua Igreja"
  },
  {
    id: "familia",
    title: "Semana Nacional da Família",
    description: "Fortalecimento das bases matrimoniais e filiais sob a ótica bíblica.",
    dateSuggestion: "Agosto",
    suggestedTheme: "Famílias alinhadas ao Evangelho",
    scripture: "Josué 24:15",
    hymnSuggestion: "Hino 15: Tu és Fiel, Senhor"
  },
  {
    id: "aniversario",
    title: "Aniversário da Igreja Local",
    description: "Festa de gratidão pela jornada e estabilidade da assembleia local.",
    dateSuggestion: "Variável",
    suggestedTheme: "Até Aqui nos Ajudou o Senhor",
    scripture: "1 Samuel 7:12",
    hymnSuggestion: "Hino 3: Castelo Forte é Nosso Deus"
  },
  {
    id: "ceia",
    title: "Celebração da Ceia do Senhor",
    description: "Memorial solene do corpo e do sangue vertido de Cristo até que Ele venha.",
    dateSuggestion: "Mensal",
    suggestedTheme: "Em Memória de Mim",
    scripture: "1 Coríntios 11:23-26",
    hymnSuggestion: "Hino 112: Rude Cruz"
  }
];

export const MOCK_STARTER_SERMONS: Sermon[] = [];

