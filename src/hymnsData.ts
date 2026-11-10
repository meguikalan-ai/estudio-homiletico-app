import { DetailedHymn, HinarioType, SermonHymns } from './types';

// ============================================================================
// HINÁRIOS OFICIAIS DA JUERP (Convenção Batista Brasileira)
// 1. Cantor Cristão (CC - JUERP) - Adotado em 1891, hinário histórico batista
// 2. Hinário para o Culto Cristão (HCC - JUERP) - Publicado em 1991 pela JUERP
// ============================================================================

export interface HymnSearchMatch {
  hymn: DetailedHymn;
  alternate?: DetailedHymn;
}

export const CANTOR_CRISTAO_HYMNS: DetailedHymn[] = [
  {
    id: 'cc_44',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 44,
    title: 'Tu és Fiel, Senhor',
    author: 'Thomas O. Chisholm / Trad. Joan Larie Sutton',
    theme: 'Fidelidade de Deus',
    subtheme: 'Provisão, Cuidado e Promessas',
    occasion: 'abertura',
    emotionalTone: 'solene',
    stanzas: [
      'Tu és fiel, Senhor, meu Pai celeste,\nPleno poder aos teus filhos darás.\nNunca mudaste, tu nunca faltaste;\nTal como eras, tu sempre serás.',
      'Flores e frutos, montanhas e mares,\nSol, lua, estrelas brilhando no céu,\nTudo criaste na terra e nos ares,\nPara louvar-te, Senhor, Deus fiel.',
      'Pleno perdão tu dás, paz, segurança,\nCada momento me guias, Senhor,\nE no porvir, oh! que doce esperança,\nDesfrutarei do teu rico favor!'
    ],
    chorus: 'Tu és fiel, Senhor! Tu és fiel, Senhor!\nDia após dia, com bênçãos sem fim!\nTua mercê me sustenta e me guarda;\nTu és fiel, Senhor, fiel a mim!',
    fullLyrics: `1. Tu és fiel, Senhor, meu Pai celeste,
Pleno poder aos teus filhos darás.
Nunca mudaste, tu nunca faltaste;
Tal como eras, tu sempre serás.

[Coro]
Tu és fiel, Senhor! Tu és fiel, Senhor!
Dia após dia, com bênçãos sem fim!
Tua mercê me sustenta e me guarda;
Tu és fiel, Senhor, fiel a mim!

2. Flores e frutos, montanhas e mares,
Sol, lua, estrelas brilhando no céu,
Tudo criaste na terra e nos ares,
Para louvar-te, Senhor, Deus fiel.

3. Pleno perdão tu dás, paz, segurança,
Cada momento me guias, Senhor,
E no porvir, oh! que doce esperança,
Desfrutarei do teu rico favor!`,
    crossReference: {
      hinario: 'HCC',
      number: 32,
      title: 'Tu és Fiel, Senhor'
    },
    keywords: ['fidelidade', 'provisão', 'cuidado', 'promessas', 'pai celeste', 'segurança', 'paz', 'confiança']
  },
  {
    id: 'cc_17',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 17,
    title: 'A Deus Demos Glória',
    author: 'Fanny J. Crosby / William H. Doane',
    theme: 'Adoração e Louvor',
    subtheme: 'A Redenção em Cristo',
    occasion: 'abertura',
    emotionalTone: 'vibrante',
    stanzas: [
      'A Deus demos glória, com grande fervor,\nSeu Filho bendito por nós entregou;\nA graça concede ao mais vil pecador,\nAbrindo-lhe a porta de entrada no céu.',
      'Oh! graça real, foi por sangue comprada\nA bênção que a todo fiel é outorgada!\nO vil pecador que em Jesus confiar,\nPerdão no momento do céu vai ganhar.',
      'Grande obra de Deus, grande consolação,\nMaior regozijo teremos em Sião,\nAo ver face a face o bom Redentor,\nE ali contemplar Seu sublime esplendor!'
    ],
    chorus: 'Exultai! Exultai! Vinde todos louvar!\nExultai! Exultai! Vinde a Deus adorar!\nAo Pai demos glória por Cristo Jesus,\nQue a todos convida com graça e com luz!',
    fullLyrics: `1. A Deus demos glória, com grande fervor,
Seu Filho bendito por nós entregou;
A graça concede ao mais vil pecador,
Abrindo-lhe a porta de entrada no céu.

[Coro]
Exultai! Exultai! Vinde todos louvar!
Exultai! Exultai! Vinde a Deus adorar!
Ao Pai demos glória por Cristo Jesus,
Que a todos convida com graça e com luz!

2. Oh! graça real, foi por sangue comprada
A bênção que a todo fiel é outorgada!
O vil pecador que em Jesus confiar,
Perdão no momento do céu vai ganhar.

3. Grande obra de Deus, grande consolação,
Maior regozijo teremos em Sião,
Ao ver face a face o bom Redentor,
E ali contemplar Seu sublime esplendor!`,
    crossReference: {
      hinario: 'HCC',
      number: 15,
      title: 'A Deus Demos Glória'
    },
    keywords: ['glória', 'louvor', 'redenção', 'exultai', 'adoração', 'salvação', 'filho bendito']
  },
  {
    id: 'cc_15',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 15,
    title: 'Ao Deus de Abraão Louvai',
    author: 'Daniel ben Judah / Thomas Olivers',
    theme: 'Soberania e Majestade',
    subtheme: 'Aliança Eterna',
    occasion: 'abertura',
    emotionalTone: 'solene',
    stanzas: [
      'Ao Deus de Abraão louvai, supremo Rei e Deus!\nPor céus e terra adorai o soberano dos céus!\nEterno é o Seu amor, do mundo Criador;\nAo Deus bendito proclamai a glória e o louvor!',
      'Ao Deus de Abraão louvai! Por Sua forte mão\nLivrou o crente em aflição, concede a salvação.\nSe o mundo me deixar, Deus há de me amparar;\nÀ glória eterna vou subir e com Jesus cantar!',
      'Louvai ao grande Deus, com hinos de poder;\nAo Pai celeste, ao santo Filho e ao Consolador render\nA glória triunfal, ao Deus celestial;\nEm todo o tempo e sem cessar, louvor universal!'
    ],
    fullLyrics: `1. Ao Deus de Abraão louvai, supremo Rei e Deus!
Por céus e terra adorai o soberano dos céus!
Eterno é o Seu amor, do mundo Criador;
Ao Deus bendito proclamai a glória e o louvor!

2. Ao Deus de Abraão louvai! Por Sua forte mão
Livrou o crente em aflição, concede a salvação.
Se o mundo me deixar, Deus há de me amparar;
À glória eterna vou subir e com Jesus cantar!

3. Louvai ao grande Deus, com hinos de poder;
Ao Pai celeste, ao santo Filho e ao Consolador render
A glória triunfal, ao Deus celestial;
Em todo o tempo e sem cessar, louvor universal!`,
    crossReference: {
      hinario: 'HCC',
      number: 12,
      title: 'Ao Deus de Abraão Louvai'
    },
    keywords: ['abraão', 'soberano', 'majestade', 'eterno', 'criador', 'louvor', 'aliança']
  },
  {
    id: 'cc_323',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 323,
    title: 'Castelo Forte',
    author: 'Martinho Lutero',
    theme: 'Soberania e Proteção de Deus',
    subtheme: 'Vitória e Firmeza na Palavra',
    occasion: 'abertura',
    emotionalTone: 'vibrante',
    stanzas: [
      'Castelo forte é nosso Deus, refúgio e fortaleza;\nNão nos abala o mal feroz, na dor ou na incerteza.\nO nosso antigo algoz nos quer subjugar;\nCom fúria e com poder, no mundo quer vencer;\nIgual não há na terra.',
      'A nossa força é vã, sem par, depressa sucumbimos;\nMas por nós luta o Salvador, que com fervor seguimos.\nSabeis vós quem Ele é? O Filho de Davi,\nSenhor dos altos céus, o próprio eterno Deus;\nTriunfará na guerra.',
      'Se nos quisessem devorar demônios pertinazes,\nNão tremeríamos, pois Deus nos faz viver em pazes.\nO príncipe do mal, com todo o seu furor,\nNão nos pode abalar; um sopro o vai prostrar,\nPor Deus determinado.',
      'O Verbo permanece em pé, por Ele resistimos;\nCom suas armas e poder a tudo destruímos.\nSe temos de perder os bens, honra e mulher,\nOs filhos e a mansão, na morte vencerão:\nDe Deus é o reino eterno!'
    ],
    fullLyrics: `1. Castelo forte é nosso Deus, refúgio e fortaleza;
Não nos abala o mal feroz, na dor ou na incerteza.
O nosso antigo algoz nos quer subjugar;
Com fúria e com poder, no mundo quer vencer;
Igual não há na terra.

2. A nossa força é vã, sem par, depressa sucumbimos;
Mas por nós luta o Salvador, que com fervor seguimos.
Sabeis vós quem Ele é? O Filho de Davi,
Senhor dos altos céus, o próprio eterno Deus;
Triunfará na guerra.

3. Se nos quisessem devorar demônios pertinazes,
Não tremeríamos, pois Deus nos faz viver em pazes.
O príncipe do mal, com todo o seu furor,
Não nos pode abalar; um sopro o vai prostrar,
Por Deus determinado.

4. O Verbo permanece em pé, por Ele resistimos;
Com suas armas e poder a tudo destruímos.
Se temos de perder os bens, honra e mulher,
Os filhos e a mansão, na morte vencerão:
De Deus é o reino eterno!`,
    crossReference: {
      hinario: 'HCC',
      number: 379,
      title: 'Castelo Forte é Nosso Deus'
    },
    keywords: ['castelo forte', 'lutero', 'fortaleza', 'refúgio', 'reforma', 'palavra', 'soberano']
  },
  {
    id: 'cc_283',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 283,
    title: 'Mais Perto Quero Estar',
    author: 'Sarah F. Adams / Lowell Mason',
    theme: 'Vida Cristã e Comunhão',
    subtheme: 'Proximidade com Deus e Consolação',
    occasion: 'antesMensagem',
    emotionalTone: 'contemplativo',
    stanzas: [
      'Mais perto quero estar, meu Deus, de ti!\nInda que seja a dor que me una a ti,\nSempre hei de suplicar: mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'Andando triste aqui, na solidão,\nPaz e descanso a mim teus braços dão;\nNas trevas vou sonhar, mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'Minha alma cantará a ti, Senhor!\nE em Betel alçará padrão de amor;\nEu sempre hei de rogar: mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'E quando a morte, enfim, me vier chamar,\nNos céus, com meu Jesus, irei morar.\nEntão me alegrarei perto de ti, meu Rei,\nPerto de ti, meu Rei, meu Deus, de ti!'
    ],
    fullLyrics: `1. Mais perto quero estar, meu Deus, de ti!
Inda que seja a dor que me una a ti,
Sempre hei de suplicar: mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

2. Andando triste aqui, na solidão,
Paz e descanso a mim teus braços dão;
Nas trevas vou sonhar, mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

3. Minha alma cantará a ti, Senhor!
E em Betel alçará padrão de amor;
Eu sempre hei de rogar: mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

4. E quando a morte, enfim, me vier chamar,
Nos céus, com meu Jesus, irei morar.
Então me alegrarei perto de ti, meu Rei,
Perto de ti, meu Rei, meu Deus, de ti!`,
    crossReference: {
      hinario: 'HCC',
      number: 370,
      title: 'Mais Perto Quero Estar'
    },
    keywords: ['mais perto', 'comunhão', 'deus', 'oração', 'presença', 'betel', 'dor', 'consolo']
  },
  {
    id: 'cc_398',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 398,
    title: 'Sou Feliz com Jesus',
    author: 'Horatio G. Spafford / Philip P. Bliss',
    theme: 'Paz e Segurança em Cristo',
    subtheme: 'Consolação na Aflição e Soberania',
    occasion: 'antesMensagem',
    emotionalTone: 'restaurador',
    stanzas: [
      'Se paz a mais doce me deres gozar,\nSe as ondas de dor me inundar,\nSeja o que for, tu me fazes saber:\nSou feliz, com Jesus, sou feliz!',
      'Embora me assalte o cruel tentador,\nE ataque com fúria e furor,\nNão hei de temer, pois Jesus meu Senhor\nSeu amor já me deu com favor.',
      'Meu triste pecado, por meu Salvador,\nFoi pago na cruz com amor;\nNão resta mais nada que eu deva temer,\nPois Jesus já me fez reviver.',
      'A vinda eu anelo do meu Redentor,\nNas nuvens com grande esplendor;\nA trombeta soará, e o clarim se ouvirá,\nSou feliz, com Jesus, vou reinar!'
    ],
    chorus: 'Sou feliz com Jesus,\nSou feliz com Jesus, meu Senhor!',
    fullLyrics: `1. Se paz a mais doce me deres gozar,
Se as ondas de dor me inundar,
Seja o que for, tu me fazes saber:
Sou feliz, com Jesus, sou feliz!

[Coro]
Sou feliz com Jesus,
Sou feliz com Jesus, meu Senhor!

2. Embora me assalte o cruel tentador,
E ataque com fúria e furor,
Não hei de temer, pois Jesus meu Senhor
Seu amor já me deu com favor.

3. Meu triste pecado, por meu Salvador,
Foi pago na cruz com amor;
Não resta mais nada que eu deva temer,
Pois Jesus já me fez reviver.

4. A vinda eu anelo do meu Redentor,
Nas nuvens com grande esplendor;
A trombeta soará, e o clarim se ouvirá,
Sou feliz, com Jesus, vou reinar!`,
    crossReference: {
      hinario: 'HCC',
      number: 405,
      title: 'Sou Feliz com Jesus'
    },
    keywords: ['sou feliz', 'paz', 'segurança', 'tempestade', 'aflição', 'consolo', 'cruz', 'perdão']
  },
  {
    id: 'cc_169',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 169,
    title: 'Chuvas de Bênçãos',
    author: 'Daniel W. Whittle / James McGranahan',
    theme: 'Vida Cristã e Refrigério',
    subtheme: 'Avivamento e Promessa',
    occasion: 'antesMensagem',
    emotionalTone: 'alegre',
    stanzas: [
      'Chuvas de bênçãos teremos, é a promessa de Deus;\nTempos benditos veremos, chuvas mandadas dos céus.',
      'Chuvas de bênçãos teremos, vida de paz e vigor;\nSobre os montes e vales cai o orvalho de amor.',
      'Chuvas de bênçãos teremos, manda-nos já, ó Senhor!\nVem hoje mesmo e concede teu refrigério e vigor.'
    ],
    chorus: 'Chuvas de bênçãos, chuvas de bênçãos dos céus!\nGotas benditas já temos, mas nós queremos é chuvas de Deus.',
    fullLyrics: `1. Chuvas de bênçãos teremos, é a promessa de Deus;
Tempos benditos veremos, chuvas mandadas dos céus.

[Coro]
Chuvas de bênçãos, chuvas de bênçãos dos céus!
Gotas benditas já temos, mas nós queremos é chuvas de Deus.

2. Chuvas de bênçãos teremos, vida de paz e vigor;
Sobre os montes e vales cai o orvalho de amor.

3. Chuvas de bênçãos teremos, manda-nos já, ó Senhor!
Vem hoje mesmo e concede teu refrigério e vigor.`,
    crossReference: {
      hinario: 'HCC',
      number: 156,
      title: 'Chuvas de Bênçãos'
    },
    keywords: ['chuvas', 'bênçãos', 'refrigério', 'avivamento', 'promessa', 'espírito', 'vigor']
  },
  {
    id: 'cc_240',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 240,
    title: 'Que Segurança!',
    author: 'Fanny J. Crosby / Phoebe P. Knapp',
    theme: 'Segurança da Salvação',
    subtheme: 'Testemunho e Certeza da Graça',
    occasion: 'antesMensagem',
    emotionalTone: 'restaurador',
    stanzas: [
      'Que segurança! Sou de Jesus!\nEu já desfruto o gozo da luz!\nSou por Jesus herdeiro de Deus;\nEle me leva à glória dos céus.',
      'Inteiramente me consagrei;\nGozo supremo já desfrutei.\nAnjos descendo trazem dos céus\nEcos da graça que vem de Deus.',
      'Sempre submisso, sempre leal,\nAcho descanso no amor celestial;\nVigio e oro com fé e amor,\nEsperançoso no meu Senhor.'
    ],
    chorus: 'Canto esta história, cantando assim,\nLouvo a meu Salvador, sem ter um fim!\nCanto esta história, cantando assim,\nLouvo a meu Salvador, sem ter um fim!',
    fullLyrics: `1. Que segurança! Sou de Jesus!
Eu já desfruto o gozo da luz!
Sou por Jesus herdeiro de Deus;
Ele me leva à glória dos céus.

[Coro]
Canto esta história, cantando assim,
Louvo a meu Salvador, sem ter um fim!
Canto esta história, cantando assim,
Louvo a meu Salvador, sem ter um fim!

2. Inteiramente me consagrei;
Gozo supremo já desfrutei.
Anjos descendo trazem dos céus
Ecos da graça que vem de Deus.

3. Sempre submisso, sempre leal,
Acho descanso no amor celestial;
Vigio e oro com fé e amor,
Esperançoso no meu Senhor.`,
    crossReference: {
      hinario: 'HCC',
      number: 400,
      title: 'Bendita a Segurança'
    },
    keywords: ['segurança', 'certeza', 'herdeiro', 'salvação', 'fanny crosby', 'descanso', 'graça']
  },
  {
    id: 'cc_366',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 366,
    title: 'Quão Firme Fundação',
    author: 'John Rippon / George Keith',
    theme: 'A Palavra de Deus e a Fé',
    subtheme: 'Firmeza nas Tribulações',
    occasion: 'antesMensagem',
    emotionalTone: 'solene',
    stanzas: [
      'Quão firme alicerce à fé do cristão\nNas santas Escrituras se dá com amplidão!\nQue mais te diria o bom Salvador,\nDo que Ele já disse no Seu grande amor?',
      '"Não temas, pois sou teu auxílio fiel;\nTeu Deus sou, te guardo no dia cruel;\nTe dou fortaleza e amparo eficaz,\nSustento tua alma na graça e na paz."',
      '"Nas águas profundas de dor ou aflição,\nOs rios de mágoas jamais te afogarão;\nPois sempre contigo nas lutas serei,\nE as bênçãos celestes a ti suprirei."',
      '"A alma que busca em Jesus descansar,\nJamais ao perigo a deixo tombar;\nInda que o inferno a queira tragar,\nEu não a hei de desamparar!"'
    ],
    fullLyrics: `1. Quão firme alicerce à fé do cristão
Nas santas Escrituras se dá com amplidão!
Que mais te diria o bom Salvador,
Do que Ele já disse no Seu grande amor?

2. "Não temas, pois sou teu auxílio fiel;
Teu Deus sou, te guardo no dia cruel;
Te dou fortaleza e amparo eficaz,
Sustento tua alma na graça e na paz."

3. "Nas águas profundas de dor ou aflição,
Os rios de mágoas jamais te afogarão;
Pois sempre contigo nas lutas serei,
E as bênçãos celestes a ti suprirei."

4. "A alma que busca em Jesus descansar,
Jamais ao perigo a deixo tombar;
Inda que o inferno a queira tragar,
Eu não a hei de desamparar!"`,
    crossReference: {
      hinario: 'HCC',
      number: 365,
      title: 'Quão Firme Fundação'
    },
    keywords: ['firme fundação', 'palavra', 'escrituras', 'promessas', 'tribulação', 'socorro', 'confiança']
  },
  {
    id: 'cc_291',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 291,
    title: 'A Mensagem da Cruz (Rude Cruz)',
    author: 'George Bennard',
    theme: 'Crucificação e Expiação',
    subtheme: 'Sacrifício de Cristo e Apelo ao Pecador',
    occasion: 'apelo',
    emotionalTone: 'contemplativo',
    stanzas: [
      'Rude cruz se erigiu, dela o dia fugiu,\nComo emblema de vergonha e dor;\nMas contemplo essa cruz, porque nela Jesus\nDeu a vida por mim, pecador.',
      'Desde a glória dos céus, o Cordeiro de Deus\nAo Calvário humilhante baixou;\nEssa cruz tem pra mim atrativos sem fim,\nPorque nela Jesus me salvou.',
      'Nessa cruz padeceu e por mim já morreu\nMeu Jesus, para dar-me o perdão;\nE eu me alegro na cruz, dela vem linda luz,\nPara a minha perfeita redenção.',
      'Eu aqui com Jesus a vergonha da cruz\nQuero sempre e alegre levar,\nE por fim vou gozar, na celeste mansão,\nDa vitória que a cruz me dá lá.'
    ],
    chorus: 'Sim, eu amo a mensagem da cruz,\nTé morrer eu a vou proclamar;\nLevarei eu também minha cruz,\nTé por uma coroa trocar.',
    fullLyrics: `1. Rude cruz se erigiu, dela o dia fugiu,
Como emblema de vergonha e dor;
Mas contemplo essa cruz, porque nela Jesus
Deu a vida por mim, pecador.

[Coro]
Sim, eu amo a mensagem da cruz,
Té morrer eu a vou proclamar;
Levarei eu também minha cruz,
Té por uma coroa trocar.

2. Desde a glória dos céus, o Cordeiro de Deus
Ao Calvário humilhante baixou;
Essa cruz tem pra mim atrativos sem fim,
Porque nela Jesus me salvou.

3. Nessa cruz padeceu e por mim já morreu
Meu Jesus, para dar-me o perdão;
E eu me alegro na cruz, dela vem linda luz,
Para a minha perfeita redenção.

4. Eu aqui com Jesus a vergonha da cruz
Quero sempre e alegre levar,
E por fim vou gozar, na celeste mansão,
Da vitória que a cruz me dá lá.`,
    crossReference: {
      hinario: 'HCC',
      number: 112,
      title: 'A Mensagem da Cruz'
    },
    keywords: ['rude cruz', 'mensagem da cruz', 'calvário', 'sacrifício', 'perdão', 'redenção', 'pecador']
  },
  {
    id: 'cc_70',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 70,
    title: 'Alvo Mais que a Neve',
    author: 'Eden R. Latta / H. S. Perkins',
    theme: 'Purificação e Perdão',
    subtheme: 'O Sangue de Jesus e Regeneração',
    occasion: 'apelo',
    emotionalTone: 'decisivo',
    stanzas: [
      'Se tu minh\'alma a pureza queres ter,\nVolta-te a Cristo e tu hás de vencer;\nEle no sangue que verteu na cruz,\nTe purifica e te dá santa luz.',
      'Quão doloroso e manchado é o pecar,\nMas para a fonte tu deves olhar!\nO sangue puro que Jesus verteu,\nPara salvar-te e levar-te ao céu.',
      'Tu, que te sentes tão fraco e sem luz,\nOlha com fé para o meigo Jesus;\nEle perdoa ao vil pecador,\nNele confia, ó alma, no amor!'
    ],
    chorus: 'Alvo mais que a neve! Alvo mais que a neve!\nSim, nesse sangue lavado,\nMais alvo que a neve serei.',
    fullLyrics: `1. Se tu minh'alma a pureza queres ter,
Volta-te a Cristo e tu hás de vencer;
Ele no sangue que verteu na cruz,
Te purifica e te dá santa luz.

[Coro]
Alvo mais que a neve! Alvo mais que a neve!
Sim, nesse sangue lavado,
Mais alvo que a neve serei.

2. Quão doloroso e manchado é o pecar,
Mas para a fonte tu deves olhar!
O sangue puro que Jesus verteu,
Para salvar-te e levar-te ao céu.

3. Tu, que te sentes tão fraco e sem luz,
Olha com fé para o meigo Jesus;
Ele perdoa ao vil pecador,
Nele confia, ó alma, no amor!`,
    crossReference: {
      hinario: 'HCC',
      number: 300,
      title: 'Alvo Mais que a Neve'
    },
    keywords: ['alvo mais que a neve', 'sangue', 'purificação', 'perdão', 'lavado', 'conversão', 'apelo']
  },
  {
    id: 'cc_268',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 268,
    title: 'Tal Como Sou',
    author: 'Charlotte Elliott / William B. Bradbury',
    theme: 'Convite e Entrega',
    subtheme: 'Graça Incondicional e Arrependimento',
    occasion: 'apelo',
    emotionalTone: 'decisivo',
    stanzas: [
      'Tal como sou, sem ter que dizer,\nA não ser que morreste por meu viver,\nE que me mandas a ti acolher,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, sem vacilar,\nDas faltas a alma purificar;\nA ti, cujo sangue me pode lavar,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, bem fraco e vil,\nManchado de faltas em número mil,\nNa treva buscando teu santo redil,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, tu vais aceitar,\nPerdoar, aliviar e me confortar;\nPois na tua promessa eu posso apoiar:\nCordeiro de Deus, eu venho a ti!'
    ],
    fullLyrics: `1. Tal como sou, sem ter que dizer,
A não ser que morreste por meu viver,
E que me mandas a ti acolher,
Cordeiro de Deus, eu venho a ti!

2. Tal como sou, sem vacilar,
Das faltas a alma purificar;
A ti, cujo sangue me pode lavar,
Cordeiro de Deus, eu venho a ti!

3. Tal como sou, bem fraco e vil,
Manchado de faltas em número mil,
Na treva buscando teu santo redil,
Cordeiro de Deus, eu venho a ti!

4. Tal como sou, tu vais aceitar,
Perdoar, aliviar e me confortar;
Pois na tua promessa eu posso apoiar:
Cordeiro de Deus, eu venho a ti!`,
    crossReference: {
      hinario: 'HCC',
      number: 280,
      title: 'Tal Como Sou'
    },
    keywords: ['tal como sou', 'cordeiro de deus', 'entrega', 'apelo', 'arrependimento', 'graça', 'perdão']
  },
  {
    id: 'cc_193',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 193,
    title: 'Maravilhosa Graça',
    author: 'Haldor Lillenas',
    theme: 'Graça Soberana',
    subtheme: 'Perdão e Salvação dos Pecados',
    occasion: 'apelo',
    emotionalTone: 'alegre',
    stanzas: [
      'Maravilhosa graça! Graça de Deus, sem fim!\nMaior que o meu pecado, foi revelada a mim.\nEm Cristo achei perdão, gozo e consolação;\nA graça libertou meu coração.',
      'Maravilhosa graça! Traz salvação e paz;\nAlivia o fardo e vida nova traz.\nQuebrando as prisões da culpa e da dor,\nRenova o pecador no Seu amor.',
      'Maravilhosa graça! O que Jesus me deu!\nFez-me herdeiro santo da glória lá do céu.\nCantarei sem cessar louvores ao Senhor,\nProclamando a grandeza do Seu amor.'
    ],
    chorus: 'Maravilhosa, infinita, graça de Deus,\nQue me alcançou e me fez filho Seu!\nMaior que todo o meu pecar,\nÉ a graça do Senhor,\nQue me salvou por Seu imenso amor!',
    fullLyrics: `1. Maravilhosa graça! Graça de Deus, sem fim!
Maior que o meu pecado, foi revelada a mim.
Em Cristo achei perdão, gozo e consolação;
A graça libertou meu coração.

[Coro]
Maravilhosa, infinita, graça de Deus,
Que me alcançou e me fez filho Seu!
Maior que todo o meu pecar,
É a graça do Senhor,
Que me salvou por Seu imenso amor!

2. Maravilhosa graça! Traz salvação e paz;
Alivia o fardo e vida nova traz.
Quebrando as prisões da culpa e da dor,
Renova o pecador no Seu amor.

3. Maravilhosa graça! O que Jesus me deu!
Fez-me herdeiro santo da glória lá do céu.
Cantarei sem cessar louvores ao Senhor,
Proclamando a grandeza do Seu amor.`,
    crossReference: {
      hinario: 'HCC',
      number: 206,
      title: 'Maravilhosa Graça'
    },
    keywords: ['maravilhosa graça', 'graça', 'infinita', 'perdão', 'salvação', 'pecado', 'amor']
  },
  {
    id: 'cc_222',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 222,
    title: 'Conversão (Oh, Que Feliz Dia!)',
    author: 'Philip Doddridge / Edward F. Rimbault',
    theme: 'Novo Nascimento e Conversão',
    subtheme: 'Testemunho Pessoal e Alegria da Salvação',
    occasion: 'apelo',
    emotionalTone: 'decisivo',
    stanzas: [
      'Oh, que feliz e santo dia, quando em Jesus me entreguei!\nO meu penhor e alegria para sempre nele achei!',
      'Feito o concerto com meu Deus, vivo agora em louvor;\nEle me abriu as portas dos céus com o Seu eterno favor.',
      'Descansa, ó alma, no Salvador, tem paz em Seu coração;\nSegue a Cristo, o bom Redentor, na estrada da salvação!'
    ],
    chorus: 'Feliz dia! Feliz dia! Quando Jesus me lavou!\nEnsinou-me a orar e a vigiar sem cessar,\nE viver com Jesus cada dia em amor!',
    fullLyrics: `1. Oh, que feliz e santo dia, quando em Jesus me entreguei!
O meu penhor e alegria para sempre nele achei!

[Coro]
Feliz dia! Feliz dia! Quando Jesus me lavou!
Ensinou-me a orar e a vigiar sem cessar,
E viver com Jesus cada dia em amor!

2. Feito o concerto com meu Deus, vivo agora em louvor;
Ele me abriu as portas dos céus com o Seu eterno favor.

3. Descansa, ó alma, no Salvador, tem paz em Seu coração;
Segue a Cristo, o bom Redentor, na estrada da salvação!`,
    crossReference: {
      hinario: 'HCC',
      number: 350,
      title: 'Oh, Que Feliz Dia!'
    },
    keywords: ['conversão', 'feliz dia', 'lavou', 'novo nascimento', 'testemunho', 'batismo']
  },
  {
    id: 'cc_112',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 112,
    title: 'Vencendo Vem Jesus',
    author: 'Julia Ward Howe',
    theme: 'Escatologia e Vitória de Cristo',
    subtheme: 'O Retorno Triunfante do Rei',
    occasion: 'encerramento',
    emotionalTone: 'vibrante',
    stanzas: [
      'Já refulge a glória eterna de Jesus, o Rei dos reis;\nBreve os reinos deste mundo seguirão as suas leis!\nOs sinais dos tempos mostram que, no céu, em santidade,\nVencendo vem Jesus!',
      'O clarim que chama os crentes à batalha já soou;\nCristo, à frente do seu povo, multidões já conquistou!\nO inimigo em retirada seu poder já derribou,\nVencendo vem Jesus!',
      'Eis que em glória refulgente sobre as nuvens descerá,\nE as nações da terra inteira com poder governará!\nQuem com fé serviu a Cristo glória eterna receberá,\nVencendo vem Jesus!'
    ],
    chorus: 'Glória, glória! Aleluia!\nGlória, glória! Aleluia!\nGlória, glória! Aleluia!\nVencendo vem Jesus!',
    fullLyrics: `1. Já refulge a glória eterna de Jesus, o Rei dos reis;
Breve os reinos deste mundo seguirão as suas leis!
Os sinais dos tempos mostram que, no céu, em santidade,
Vencendo vem Jesus!

[Coro]
Glória, glória! Aleluia!
Glória, glória! Aleluia!
Glória, glória! Aleluia!
Vencendo vem Jesus!

2. O clarim que chama os crentes à batalha já soou;
Cristo, à frente do seu povo, multidões já conquistou!
O inimigo em retirada seu poder já derribou,
Vencendo vem Jesus!

3. Eis que em glória refulgente sobre as nuvens descerá,
E as nações da terra inteira com poder governará!
Quem com fé serviu a Cristo glória eterna receberá,
Vencendo vem Jesus!`,
    crossReference: {
      hinario: 'HCC',
      number: 148,
      title: 'Vencendo Vem Jesus'
    },
    keywords: ['vencendo vem jesus', 'segunda vinda', 'triunfo', 'vitória', 'glória aleluia', 'escatologia']
  },
  {
    id: 'cc_440',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 440,
    title: 'Eis-me Aqui, Senhor',
    author: 'Daniel S. Warner',
    theme: 'Missões e Consagração',
    subtheme: 'Envio e Serviço Pastoral',
    occasion: 'encerramento',
    emotionalTone: 'decisivo',
    stanzas: [
      'A voz de Cristo escuto a me chamar:\n"Quem irá por mim a seara ceifar?"\nCom zelo e amor eu quero responder:\nEis-me aqui, Senhor, para te obedecer!',
      'As almas perdidas sofrem em escuridão,\nClamam com urgência por consolação;\nA luz do evangelho eu vou proclamar,\nTé que todo o mundo venha a Cristo amar.',
      'Seja em terras longas ou no meu país,\nFazer tua vontade é o que me faz feliz;\nDeixo tudo e sigo o teu caminhar,\nTé na glória eterna contigo reinar.'
    ],
    chorus: 'Eis-me aqui, Senhor! Eis-me aqui, Senhor!\nManda-me a mim, pronto estou, meu Salvador!',
    fullLyrics: `1. A voz de Cristo escuto a me chamar:
"Quem irá por mim a seara ceifar?"
Com zelo e amor eu quero responder:
Eis-me aqui, Senhor, para te obedecer!

[Coro]
Eis-me aqui, Senhor! Eis-me aqui, Senhor!
Manda-me a mim, pronto estou, meu Salvador!

2. As almas perdidas sofrem em escuridão,
Clamam com urgência por consolação;
A luz do evangelho eu vou proclamar,
Té que todo o mundo venha a Cristo amar.

3. Seja em terras longas ou no meu país,
Fazer tua vontade é o que me faz feliz;
Deixo tudo e sigo o teu caminhar,
Té na glória eterna contigo reinar.`,
    crossReference: {
      hinario: 'HCC',
      number: 460,
      title: 'Eis-me Aqui, Senhor'
    },
    keywords: ['eis-me aqui', 'missões', 'envio', 'seara', 'serviço', 'chamado', 'evangelho']
  },
  {
    id: 'cc_460',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 460,
    title: 'Trabalhai e Orai',
    author: 'Charles H. Gabriel',
    theme: 'Discipulado e Serviço',
    subtheme: 'Fidelidade Diária e Vigilância',
    occasion: 'encerramento',
    emotionalTone: 'vibrante',
    stanzas: [
      'Quereis saber o segredo de vencer na oração?\nTrabalhai e orai!\nQuereis guardar a seara contra a vil corrupção?\nTrabalhai com fervor e orai!',
      'Não olheis para trás, nem temais o perigo;\nTrabalhai e orai!\nCristo guia seus servos no bom combate;\nTrabalhai com vigor e orai!',
      'Quando a tarde cair e a colheita findar,\nTrabalhai e orai!\nPara os braços de Cristo havemos de voar;\nE o descanso celeste gozar!'
    ],
    chorus: 'Trabalhai e orai, na seara do Senhor!\nTrabalhai e orai, com fervor e santo amor!\nO Mestre nos chama à grande labuta,\nTrabalhai e orai sem cessar!',
    fullLyrics: `1. Quereis saber o segredo de vencer na oração?
Trabalhai e orai!
Quereis guardar a seara contra a vil corrupção?
Trabalhai com fervor e orai!

[Coro]
Trabalhai e orai, na seara do Senhor!
Trabalhai e orai, com fervor e santo amor!
O Mestre nos chama à grande labuta,
Trabalhai e orai sem cessar!

2. Não olheis para trás, nem temais o perigo;
Trabalhai e orai!
Cristo guia seus servos no bom combate;
Trabalhai com vigor e orai!

3. Quando a tarde cair e a colheita findar,
Trabalhai e orai!
Para os braços de Cristo havemos de voar;
E o descanso celeste gozar!`,
    crossReference: {
      hinario: 'HCC',
      number: 450,
      title: 'Trabalhai e Orai'
    },
    keywords: ['trabalhai e orai', 'oração', 'vigilância', 'seara', 'combate', 'fidelidade', 'discipulado']
  },
  {
    id: 'cc_147',
    hinario: 'CC',
    hinarioName: 'Cantor Cristão (JUERP)',
    number: 147,
    title: 'Vem, Visita a Tua Igreja',
    author: 'William H. Bathurst',
    theme: 'Edificação e Avivamento da Igreja',
    subtheme: 'Derramamento do Espírito Santo',
    occasion: 'abertura',
    emotionalTone: 'restaurador',
    stanzas: [
      'Vem, visita a tua igreja, ó bendito Salvador!\nDá-nos hoje tua graça, manifesta o teu amor.\nVem, derrama o teu Espírito com poder e comunhão,\nE desperta a todo o crente com fervor no coração.',
      'Purifica os corações, faz o fogo do amor queimar;\nTira o orgulho e o egoísmo, vem a paz restaurar.\nEm oração nos unimos diante do teu altar,\nPara ver a tua glória neste templo transbordar.'
    ],
    chorus: 'Vem, visita a tua igreja! Ó Senhor Jesus, vem já!\nTeu poder e tua graça a este povo outorgará!',
    fullLyrics: `1. Vem, visita a tua igreja, ó bendito Salvador!
Dá-nos hoje tua graça, manifesta o teu amor.
Vem, derrama o teu Espírito com poder e comunhão,
E desperta a todo o crente com fervor no coração.

[Coro]
Vem, visita a tua igreja! Ó Senhor Jesus, vem já!
Teu poder e tua graça a este povo outorgará!

2. Purifica os corações, faz o fogo do amor queimar;
Tira o orgulho e o egoísmo, vem a paz restaurar.
Em oração nos unimos diante do teu altar,
Para ver a tua glória neste templo transbordar.`,
    crossReference: {
      hinario: 'HCC',
      number: 242,
      title: 'Vem, Visita a Tua Igreja'
    },
    keywords: ['visita', 'igreja', 'avivamento', 'espírito santo', 'fogo', 'graça', 'despertamento']
  }
];

export const HCC_HYMNS: DetailedHymn[] = [
  {
    id: 'hcc_32',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 32,
    title: 'Tu és Fiel, Senhor',
    author: 'Thomas O. Chisholm / William M. Runyan / Trad. Joan Larie Sutton',
    theme: 'Fidelidade de Deus',
    subtheme: 'Cuidado Contínuo e Graça Diária',
    occasion: 'abertura',
    emotionalTone: 'solene',
    stanzas: [
      'Tu és fiel, Senhor, meu Pai celeste,\nPleno poder aos teus filhos darás.\nNunca mudaste, tu nunca faltaste;\nTal como eras, tu sempre serás.',
      'Flores e frutos, montanhas e mares,\nSol, lua, estrelas brilhando no céu,\nTudo criaste na terra e nos ares,\nPara louvar-te, Senhor, Deus fiel.',
      'Pleno perdão tu dás, paz, segurança,\nCada momento me guias, Senhor,\nE no porvir, oh! que doce esperança,\nDesfrutarei do teu rico favor!'
    ],
    chorus: 'Tu és fiel, Senhor! Tu és fiel, Senhor!\nDia após dia, com bênçãos sem fim!\nTua mercê me sustenta e me guarda;\nTu és fiel, Senhor, fiel a mim!',
    fullLyrics: `1. Tu és fiel, Senhor, meu Pai celeste,
Pleno poder aos teus filhos darás.
Nunca mudaste, tu nunca faltaste;
Tal como eras, tu sempre serás.

[Coro]
Tu és fiel, Senhor! Tu és fiel, Senhor!
Dia após dia, com bênçãos sem fim!
Tua mercê me sustenta e me guarda;
Tu és fiel, Senhor, fiel a mim!

2. Flores e frutos, montanhas e mares,
Sol, lua, estrelas brilhando no céu,
Tudo criaste na terra e nos ares,
Para louvar-te, Senhor, Deus fiel.

3. Pleno perdão tu dás, paz, segurança,
Cada momento me guias, Senhor,
E no porvir, oh! que doce esperança,
Desfrutarei do teu rico favor!`,
    crossReference: {
      hinario: 'CC',
      number: 44,
      title: 'Tu és Fiel, Senhor'
    },
    keywords: ['fidelidade', 'provisão', 'cuidado', 'promessas', 'pai celeste', 'segurança', 'paz', 'confiança']
  },
  {
    id: 'hcc_25',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 25,
    title: 'Grandioso és Tu',
    author: 'Carl Boberg / Stuart K. Hine / Trad. Rolando de Nassau',
    theme: 'Grandeza e Majestade de Deus',
    subtheme: 'A Criação e o Calvário',
    occasion: 'abertura',
    emotionalTone: 'vibrante',
    stanzas: [
      'Senhor meu Deus, quando eu maravilhado\nFico a pensar nas obras de tuas mãos,\nNo céu azul de estrelas pontilhado,\nO teu poder mostrando aos corações.',
      'Quando a vagar por bosques e campinas\nAves ouço a cantar em doce som;\nOlhando as montanhas e as colinas,\nSinto o frescor do vento brando e bom.',
      'E quando penso que tu não poupaste\nTeu Filho amado por amor de mim,\nE sobre a cruz, sofrendo, o entregaste,\nMinh\'alma chora de amor sem fim.',
      'E quando enfim Jesus vier na glória\nE ao lar celeste me transportar,\nEu cantarei com júbilo a vitória:\nGrandioso és tu, meu Deus, hei de adorar!'
    ],
    chorus: 'Então minh\'alma canta a ti, Senhor:\nGrandioso és tu! Grandioso és tu!\nEntão minh\'alma canta a ti, Senhor:\nGrandioso és tu! Grandioso és tu!',
    fullLyrics: `1. Senhor meu Deus, quando eu maravilhado
Fico a pensar nas obras de tuas mãos,
No céu azul de estrelas pontilhado,
O teu poder mostrando aos corações.

[Coro]
Então minh'alma canta a ti, Senhor:
Grandioso és tu! Grandioso és tu!
Então minh'alma canta a ti, Senhor:
Grandioso és tu! Grandioso és tu!

2. Quando a vagar por bosques e campinas
Aves ouço a cantar em doce som;
Olhando as montanhas e as colinas,
Sinto o frescor do vento brando e bom.

3. E quando penso que tu não poupaste
Teu Filho amado por amor de mim,
E sobre a cruz, sofrendo, o entregaste,
Minh'alma chora de amor sem fim.

4. E quando enfim Jesus vier na glória
E ao lar celeste me transportar,
Eu cantarei com júbilo a vitória:
Grandioso és tu, meu Deus, hei de adorar!`,
    crossReference: {
      hinario: 'CC',
      number: 52,
      title: 'Grandioso és Tu'
    },
    keywords: ['grandioso és tu', 'criação', 'calvário', 'universo', 'majestade', 'senhor meu deus']
  },
  {
    id: 'hcc_15',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 15,
    title: 'A Deus Demos Glória',
    author: 'Fanny J. Crosby / William H. Doane',
    theme: 'Adoração e Louvor',
    subtheme: 'Gratidão pela Redenção Eterna',
    occasion: 'abertura',
    emotionalTone: 'vibrante',
    stanzas: [
      'A Deus demos glória, com grande fervor,\nSeu Filho bendito por nós entregou;\nA graça concede ao mais vil pecador,\nAbrindo-lhe a porta de entrada no céu.',
      'Oh! graça real, foi por sangue comprada\nA bênção que a todo fiel é outorgada!\nO vil pecador que em Jesus confiar,\nPerdão no momento do céu vai ganhar.',
      'Grande obra de Deus, grande consolação,\nMaior regozijo teremos em Sião,\nAo ver face a face o bom Redentor,\nE ali contemplar Seu sublime esplendor!'
    ],
    chorus: 'Exultai! Exultai! Vinde todos louvar!\nExultai! Exultai! Vinde a Deus adorar!\nAo Pai demos glória por Cristo Jesus,\nQue a todos convida com graça e com luz!',
    fullLyrics: `1. A Deus demos glória, com grande fervor,
Seu Filho bendito por nós entregou;
A graça concede ao mais vil pecador,
Abrindo-lhe a porta de entrada no céu.

[Coro]
Exultai! Exultai! Vinde todos louvar!
Exultai! Exultai! Vinde a Deus adorar!
Ao Pai demos glória por Cristo Jesus,
Que a todos convida com graça e com luz!

2. Oh! graça real, foi por sangue comprada
A bênção que a todo fiel é outorgada!
O vil pecador que em Jesus confiar,
Perdão no momento do céu vai ganhar.

3. Grande obra de Deus, grande consolação,
Maior regozijo teremos em Sião,
Ao ver face a face o bom Redentor,
E ali contemplar Seu sublime esplendor!`,
    crossReference: {
      hinario: 'CC',
      number: 17,
      title: 'A Deus Demos Glória'
    },
    keywords: ['glória', 'louvor', 'redenção', 'exultai', 'adoração', 'salvação']
  },
  {
    id: 'hcc_12',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 12,
    title: 'Ao Deus de Abraão Louvai',
    author: 'Daniel ben Judah / Thomas Olivers',
    theme: 'Soberania e Aliança',
    subtheme: 'O Deus dos Pais e Criador Eterno',
    occasion: 'abertura',
    emotionalTone: 'solene',
    stanzas: [
      'Ao Deus de Abraão louvai, supremo Rei e Deus!\nPor céus e terra adorai o soberano dos céus!\nEterno é o Seu amor, do mundo Criador;\nAo Deus bendito proclamai a glória e o louvor!',
      'Ao Deus de Abraão louvai! Por Sua forte mão\nLivrou o crente em aflição, concede a salvação.\nSe o mundo me deixar, Deus há de me amparar;\nÀ glória eterna vou subir e com Jesus cantar!',
      'Louvai ao grande Deus, com hinos de poder;\nAo Pai celeste, ao santo Filho e ao Consolador render\nA glória triunfal, ao Deus celestial;\nEm todo o tempo e sem cessar, louvor universal!'
    ],
    fullLyrics: `1. Ao Deus de Abraão louvai, supremo Rei e Deus!
Por céus e terra adorai o soberano dos céus!
Eterno é o Seu amor, do mundo Criador;
Ao Deus bendito proclamai a glória e o louvor!

2. Ao Deus de Abraão louvai! Por Sua forte mão
Livrou o crente em aflição, concede a salvação.
Se o mundo me deixar, Deus há de me amparar;
À glória eterna vou subir e com Jesus cantar!

3. Louvai ao grande Deus, com hinos de poder;
Ao Pai celeste, ao santo Filho e ao Consolador render
A glória triunfal, ao Deus celestial;
Em todo o tempo e sem cessar, louvor universal!`,
    crossReference: {
      hinario: 'CC',
      number: 15,
      title: 'Ao Deus de Abraão Louvai'
    },
    keywords: ['abraão', 'soberano', 'majestade', 'eterno', 'criador', 'louvor']
  },
  {
    id: 'hcc_379',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 379,
    title: 'Castelo Forte é Nosso Deus',
    author: 'Martinho Lutero / Melodia: Martinho Lutero',
    theme: 'Soberania e Segurança',
    subtheme: 'Vitória pela Palavra de Cristo',
    occasion: 'abertura',
    emotionalTone: 'vibrante',
    stanzas: [
      'Castelo forte é nosso Deus, refúgio e fortaleza;\nNão nos abala o mal feroz, na dor ou na incerteza.\nO nosso antigo algoz nos quer subjugar;\nCom fúria e com poder, no mundo quer vencer;\nIgual não há na terra.',
      'A nossa força é vã, sem par, depressa sucumbimos;\nMas por nós luta o Salvador, que com fervor seguimos.\nSabeis vós quem Ele é? O Filho de Davi,\nSenhor dos altos céus, o próprio eterno Deus;\nTriunfará na guerra.',
      'Se nos quisessem devorar demônios pertinazes,\nNão tremeríamos, pois Deus nos faz viver em pazes.\nO príncipe do mal, com todo o seu furor,\nNão nos pode abalar; um sopro o vai prostrar,\nPor Deus determinado.',
      'O Verbo permanece em pé, por Ele resistimos;\nCom suas armas e poder a tudo destruímos.\nSe temos de perder os bens, honra e mulher,\nOs filhos e a mansão, na morte vencerão:\nDe Deus é o reino eterno!'
    ],
    fullLyrics: `1. Castelo forte é nosso Deus, refúgio e fortaleza;
Não nos abala o mal feroz, na dor ou na incerteza.
O nosso antigo algoz nos quer subjugar;
Com fúria e com poder, no mundo quer vencer;
Igual não há na terra.

2. A nossa força é vã, sem par, depressa sucumbimos;
Mas por nós luta o Salvador, que com fervor seguimos.
Sabeis vós quem Ele é? O Filho de Davi,
Senhor dos altos céus, o próprio eterno Deus;
Triunfará na guerra.

3. Se nos quisessem devorar demônios pertinazes,
Não tremeríamos, pois Deus nos faz viver em pazes.
O príncipe do mal, com todo o seu furor,
Não nos pode abalar; um sopro o vai prostrar,
Por Deus determinado.

4. O Verbo permanece em pé, por Ele resistimos;
Com suas armas e poder a tudo destruímos.
Se temos de perder os bens, honra e mulher,
Os filhos e a mansão, na morte vencerão:
De Deus é o reino eterno!`,
    crossReference: {
      hinario: 'CC',
      number: 323,
      title: 'Castelo Forte'
    },
    keywords: ['castelo forte', 'lutero', 'fortaleza', 'reforma', 'palavra', 'soberania']
  },
  {
    id: 'hcc_370',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 370,
    title: 'Mais Perto Quero Estar',
    author: 'Sarah F. Adams / Lowell Mason',
    theme: 'Comunhão com Deus',
    subtheme: 'Oração, Consolação e Submissão',
    occasion: 'antesMensagem',
    emotionalTone: 'contemplativo',
    stanzas: [
      'Mais perto quero estar, meu Deus, de ti!\nInda que seja a dor que me una a ti,\nSempre hei de suplicar: mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'Andando triste aqui, na solidão,\nPaz e descanso a mim teus braços dão;\nNas trevas vou sonhar, mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'Minha alma cantará a ti, Senhor!\nE em Betel alçará padrão de amor;\nEu sempre hei de rogar: mais perto quero estar,\nMais perto quero estar, meu Deus, de ti!',
      'E quando a morte, enfim, me vier chamar,\nNos céus, com meu Jesus, irei morar.\nEntão me alegrarei perto de ti, meu Rei,\nPerto de ti, meu Rei, meu Deus, de ti!'
    ],
    fullLyrics: `1. Mais perto quero estar, meu Deus, de ti!
Inda que seja a dor que me una a ti,
Sempre hei de suplicar: mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

2. Andando triste aqui, na solidão,
Paz e descanso a mim teus braços dão;
Nas trevas vou sonhar, mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

3. Minha alma cantará a ti, Senhor!
E em Betel alçará padrão de amor;
Eu sempre hei de rogar: mais perto quero estar,
Mais perto quero estar, meu Deus, de ti!

4. E quando a morte, enfim, me vier chamar,
Nos céus, com meu Jesus, irei morar.
Então me alegrarei perto de ti, meu Rei,
Perto de ti, meu Rei, meu Deus, de ti!`,
    crossReference: {
      hinario: 'CC',
      number: 283,
      title: 'Mais Perto Quero Estar'
    },
    keywords: ['mais perto', 'comunhão', 'deus', 'oração', 'betel', 'consolo']
  },
  {
    id: 'hcc_405',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 405,
    title: 'Sou Feliz com Jesus',
    author: 'Horatio G. Spafford / Philip P. Bliss',
    theme: 'Paz e Segurança',
    subtheme: 'Consolação Soberana e Fé Vencedora',
    occasion: 'antesMensagem',
    emotionalTone: 'restaurador',
    stanzas: [
      'Se paz a mais doce me deres gozar,\nSe as ondas de dor me inundar,\nSeja o que for, tu me fazes saber:\nSou feliz, com Jesus, sou feliz!',
      'Embora me assalte o cruel tentador,\nE ataque com fúria e furor,\nNão hei de temer, pois Jesus meu Senhor\nSeu amor já me deu com favor.',
      'Meu triste pecado, por meu Salvador,\nFoi pago na cruz com amor;\nNão resta mais nada que eu deva temer,\nPois Jesus já me fez reviver.',
      'A vinda eu anelo do meu Redentor,\nNas nuvens com grande esplendor;\nA trombeta soará, e o clarim se ouvirá,\nSou feliz, com Jesus, vou reinar!'
    ],
    chorus: 'Sou feliz com Jesus,\nSou feliz com Jesus, meu Senhor!',
    fullLyrics: `1. Se paz a mais doce me deres gozar,
Se as ondas de dor me inundar,
Seja o que for, tu me fazes saber:
Sou feliz, com Jesus, sou feliz!

[Coro]
Sou feliz com Jesus,
Sou feliz com Jesus, meu Senhor!

2. Embora me assalte o cruel tentador,
E ataque com fúria e furor,
Não hei de temer, pois Jesus meu Senhor
Seu amor já me deu com favor.

3. Meu triste pecado, por meu Salvador,
Foi pago na cruz com amor;
Não resta mais nada que eu deva temer,
Pois Jesus já me fez reviver.

4. A vinda eu anelo do meu Redentor,
Nas nuvens com grande esplendor;
A trombeta soará, e o clarim se ouvirá,
Sou feliz, com Jesus, vou reinar!`,
    crossReference: {
      hinario: 'CC',
      number: 398,
      title: 'Sou Feliz com Jesus'
    },
    keywords: ['sou feliz', 'paz', 'segurança', 'consolo', 'aflição', 'cruz', 'perdão']
  },
  {
    id: 'hcc_314',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 314,
    title: 'Preciosa Graça (Amazing Grace)',
    author: 'John Newton',
    theme: 'A Maravilhosa Graça',
    subtheme: 'Misericórdia aos Pecadores',
    occasion: 'antesMensagem',
    emotionalTone: 'contemplativo',
    stanzas: [
      'Preciosa graça de Jesus, que a um perdido achou!\nEu cego estava, agora vejo; na treva me encontrou.',
      'Foi essa graça que livrou meu coração do temor;\nE quão preciosa foi a graça no dia do Senhor!',
      'Através de perigos, de aflições, eu já passei aqui;\nA graça sempre me guiou e vai guiar-me a mim.',
      'Quando dez mil anos nós vivermos na eterna luz,\nCantaremos mais a Sua graça e glória de Jesus.'
    ],
    fullLyrics: `1. Preciosa graça de Jesus, que a um perdido achou!
Eu cego estava, agora vejo; na treva me encontrou.

2. Foi essa graça que livrou meu coração do temor;
E quão preciosa foi a graça no dia do Senhor!

3. Através de perigos, de aflições, eu já passei aqui;
A graça sempre me guiou e vai guiar-me a mim.

4. Quando dez mil anos nós vivermos na eterna luz,
Cantaremos mais a Sua graça e glória de Jesus.`,
    crossReference: {
      hinario: 'CC',
      number: 204,
      title: 'Preciosa Graça'
    },
    keywords: ['preciosa graça', 'amazing grace', 'john newton', 'perdido', 'cego', 'misericórdia']
  },
  {
    id: 'hcc_400',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 400,
    title: 'Bendita a Segurança',
    author: 'Fanny J. Crosby / Phoebe P. Knapp',
    theme: 'Certeza da Salvação',
    subtheme: 'Gozo e Testemunho em Cristo',
    occasion: 'antesMensagem',
    emotionalTone: 'restaurador',
    stanzas: [
      'Que segurança! Sou de Jesus!\nEu já desfruto o gozo da luz!\nSou por Jesus herdeiro de Deus;\nEle me leva à glória dos céus.',
      'Inteiramente me consagrei;\nGozo supremo já desfrutei.\nAnjos descendo trazem dos céus\nEcos da graça que vem de Deus.',
      'Sempre submisso, sempre leal,\nAcho descanso no amor celestial;\nVigio e oro com fé e amor,\nEsperançoso no meu Senhor.'
    ],
    chorus: 'Canto esta história, cantando assim,\nLouvo a meu Salvador, sem ter um fim!\nCanto esta história, cantando assim,\nLouvo a meu Salvador, sem ter um fim!',
    fullLyrics: `1. Que segurança! Sou de Jesus!
Eu já desfruto o gozo da luz!
Sou por Jesus herdeiro de Deus;
Ele me leva à glória dos céus.

[Coro]
Canto esta história, cantando assim,
Louvo a meu Salvador, sem ter um fim!
Canto esta história, cantando assim,
Louvo a meu Salvador, sem ter um fim!

2. Inteiramente me consagrei;
Gozo supremo já desfrutei.
Anjos descendo trazem dos céus
Ecos da graça que vem de Deus.

3. Sempre submisso, sempre leal,
Acho descanso no amor celestial;
Vigio e oro com fé e amor,
Esperançoso no meu Senhor.`,
    crossReference: {
      hinario: 'CC',
      number: 240,
      title: 'Que Segurança!'
    },
    keywords: ['bendita segurança', 'que segurança', 'certeza', 'fanny crosby', 'herdeiro', 'salvação']
  },
  {
    id: 'hcc_365',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 365,
    title: 'Quão Firme Fundação',
    author: 'John Rippon / George Keith',
    theme: 'Fidelidade às Escrituras',
    subtheme: 'Sustento Divino nas Provações',
    occasion: 'antesMensagem',
    emotionalTone: 'solene',
    stanzas: [
      'Quão firme alicerce à fé do cristão\nNas santas Escrituras se dá com amplidão!\nQue mais te diria o bom Salvador,\nDo que Ele já disse no Seu grande amor?',
      '"Não temas, pois sou teu auxílio fiel;\nTeu Deus sou, te guardo no dia cruel;\nTe dou fortaleza e amparo eficaz,\nSustento tua alma na graça e na paz."',
      '"Nas águas profundas de dor ou aflição,\nOs rios de mágoas jamais te afogarão;\nPois sempre contigo nas lutas serei,\nE as bênçãos celestes a ti suprirei."',
      '"A alma que busca em Jesus descansar,\nJamais ao perigo a deixo tombar;\nInda que o inferno a queira tragar,\nEu não a hei de desamparar!"'
    ],
    fullLyrics: `1. Quão firme alicerce à fé do cristão
Nas santas Escrituras se dá com amplidão!
Que mais te diria o bom Salvador,
Do que Ele já disse no Seu grande amor?

2. "Não temas, pois sou teu auxílio fiel;
Teu Deus sou, te guardo no dia cruel;
Te dou fortaleza e amparo eficaz,
Sustento tua alma na graça e na paz."

3. "Nas águas profundas de dor ou aflição,
Os rios de mágoas jamais te afogarão;
Pois sempre contigo nas lutas serei,
E as bênçãos celestes a ti suprirei."

4. "A alma que busca em Jesus descansar,
Jamais ao perigo a deixo tombar;
Inda que o inferno a queira tragar,
Eu não a hei de desamparar!"`,
    crossReference: {
      hinario: 'CC',
      number: 366,
      title: 'Quão Firme Fundação'
    },
    keywords: ['firme fundação', 'palavra', 'escrituras', 'promessas', 'tribulação', 'socorro']
  },
  {
    id: 'hcc_112',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 112,
    title: 'A Mensagem da Cruz',
    author: 'George Bennard',
    theme: 'Crucificação e Sacrifício',
    subtheme: 'O Valor Inestimável da Cruz',
    occasion: 'apelo',
    emotionalTone: 'contemplativo',
    stanzas: [
      'Rude cruz se erigiu, dela o dia fugiu,\nComo emblema de vergonha e dor;\nMas contemplo essa cruz, porque nela Jesus\nDeu a vida por mim, pecador.',
      'Desde a glória dos céus, o Cordeiro de Deus\nAo Calvário humilhante baixou;\nEssa cruz tem pra mim atrativos sem fim,\nPorque nela Jesus me salvou.',
      'Nessa cruz padeceu e por mim já morreu\nMeu Jesus, para dar-me o perdão;\nE eu me alegro na cruz, dela vem linda luz,\nPara a minha perfeita redenção.',
      'Eu aqui com Jesus a vergonha da cruz\nQuero sempre e alegre levar,\nE por fim vou gozar, na celeste mansão,\nDa vitória que a cruz me dá lá.'
    ],
    chorus: 'Sim, eu amo a mensagem da cruz,\nTé morrer eu a vou proclamar;\nLevarei eu também minha cruz,\nTé por uma coroa trocar.',
    fullLyrics: `1. Rude cruz se erigiu, dela o dia fugiu,
Como emblema de vergonha e dor;
Mas contemplo essa cruz, porque nela Jesus
Deu a vida por mim, pecador.

[Coro]
Sim, eu amo a mensagem da cruz,
Té morrer eu a vou proclamar;
Levarei eu também minha cruz,
Té por uma coroa trocar.

2. Desde a glória dos céus, o Cordeiro de Deus
Ao Calvário humilhante baixou;
Essa cruz tem pra mim atrativos sem fim,
Porque nela Jesus me salvou.

3. Nessa cruz padeceu e por mim já morreu
Meu Jesus, para dar-me o perdão;
E eu me alegro na cruz, dela vem linda luz,
Para a minha perfeita redenção.

4. Eu aqui com Jesus a vergonha da cruz
Quero sempre e alegre levar,
E por fim vou gozar, na celeste mansão,
Da vitória que a cruz me dá lá.`,
    crossReference: {
      hinario: 'CC',
      number: 291,
      title: 'A Mensagem da Cruz (Rude Cruz)'
    },
    keywords: ['mensagem da cruz', 'rude cruz', 'calvário', 'sacrifício', 'perdão', 'coroa']
  },
  {
    id: 'hcc_300',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 300,
    title: 'Alvo Mais que a Neve',
    author: 'Eden R. Latta / H. S. Perkins',
    theme: 'Perdão e Regeneração',
    subtheme: 'Purificação pelo Sangue do Redentor',
    occasion: 'apelo',
    emotionalTone: 'decisivo',
    stanzas: [
      'Se tu minh\'alma a pureza queres ter,\nVolta-te a Cristo e tu hás de vencer;\nEle no sangue que verteu na cruz,\nTe purifica e te dá santa luz.',
      'Quão doloroso e manchado é o pecar,\nMas para a fonte tu deves olhar!\nO sangue puro que Jesus verteu,\nPara salvar-te e levar-te ao céu.',
      'Tu, que te sentes tão fraco e sem luz,\nOlha com fé para o meigo Jesus;\nEle perdoa ao vil pecador,\nNele confia, ó alma, no amor!'
    ],
    chorus: 'Alvo mais que a neve! Alvo mais que a neve!\nSim, nesse sangue lavado,\nMais alvo que a neve serei.',
    fullLyrics: `1. Se tu minh'alma a pureza queres ter,
Volta-te a Cristo e tu hás de vencer;
Ele no sangue que verteu na cruz,
Te purifica e te dá santa luz.

[Coro]
Alvo mais que a neve! Alvo mais que a neve!
Sim, nesse sangue lavado,
Mais alvo que a neve serei.

2. Quão doloroso e manchado é o pecar,
Mas para a fonte tu deves olhar!
O sangue puro que Jesus verteu,
Para salvar-te e levar-te ao céu.

3. Tu, que te sentes tão fraco e sem luz,
Olha com fé para o meigo Jesus;
Ele perdoa ao vil pecador,
Nele confia, ó alma, no amor!`,
    crossReference: {
      hinario: 'CC',
      number: 70,
      title: 'Alvo Mais que a Neve'
    },
    keywords: ['alvo mais que a neve', 'purificação', 'sangue', 'perdão', 'regeneração', 'lavado']
  },
  {
    id: 'hcc_280',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 280,
    title: 'Tal Como Sou',
    author: 'Charlotte Elliott / William B. Bradbury',
    theme: 'Convite e Consagração',
    subtheme: 'Achegar-se a Cristo pela Fé',
    occasion: 'apelo',
    emotionalTone: 'decisivo',
    stanzas: [
      'Tal como sou, sem ter que dizer,\nA não ser que morreste por meu viver,\nE que me mandas a ti acolher,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, sem vacilar,\nDas faltas a alma purificar;\nA ti, cujo sangue me pode lavar,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, bem fraco e vil,\nManchado de faltas em número mil,\nNa treva buscando teu santo redil,\nCordeiro de Deus, eu venho a ti!',
      'Tal como sou, tu vais aceitar,\nPerdoar, aliviar e me confortar;\nPois na tua promessa eu posso apoiar:\nCordeiro de Deus, eu venho a ti!'
    ],
    fullLyrics: `1. Tal como sou, sem ter que dizer,
A não ser que morreste por meu viver,
E que me mandas a ti acolher,
Cordeiro de Deus, eu venho a ti!

2. Tal como sou, sem vacilar,
Das faltas a alma purificar;
A ti, cujo sangue me pode lavar,
Cordeiro de Deus, eu venho a ti!

3. Tal como sou, bem fraco e vil,
Manchado de faltas em número mil,
Na treva buscando teu santo redil,
Cordeiro de Deus, eu venho a ti!

4. Tal como sou, tu vais aceitar,
Perdoar, aliviar e me confortar;
Pois na tua promessa eu posso apoiar:
Cordeiro de Deus, eu venho a ti!`,
    crossReference: {
      hinario: 'CC',
      number: 268,
      title: 'Tal Como Sou'
    },
    keywords: ['tal como sou', 'cordeiro de deus', 'entrega', 'apelo', 'perdão', 'acolhimento']
  },
  {
    id: 'hcc_206',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 206,
    title: 'Maravilhosa Graça',
    author: 'Haldor Lillenas',
    theme: 'Graça Soberana',
    subtheme: 'Amor Incomparável de Deus',
    occasion: 'apelo',
    emotionalTone: 'alegre',
    stanzas: [
      'Maravilhosa graça! Graça de Deus, sem fim!\nMaior que o meu pecado, foi revelada a mim.\nEm Cristo achei perdão, gozo e consolação;\nA graça libertou meu coração.',
      'Maravilhosa graça! Traz salvação e paz;\nAlivia o fardo e vida nova traz.\nQuebrando as prisões da culpa e da dor,\nRenova o pecador no Seu amor.',
      'Maravilhosa graça! O que Jesus me deu!\nFez-me herdeiro santo da glória lá do céu.\nCantarei sem cessar louvores ao Senhor,\nProclamando a grandeza do Seu amor.'
    ],
    chorus: 'Maravilhosa, infinita, graça de Deus,\nQue me alcançou e me fez filho Seu!\nMaior que todo o meu pecar,\nÉ a graça do Senhor,\nQue me salvou por Seu imenso amor!',
    fullLyrics: `1. Maravilhosa graça! Graça de Deus, sem fim!
Maior que o meu pecado, foi revelada a mim.
Em Cristo achei perdão, gozo e consolação;
A graça libertou meu coração.

[Coro]
Maravilhosa, infinita, graça de Deus,
Que me alcançou e me fez filho Seu!
Maior que todo o meu pecar,
É a graça do Senhor,
Que me salvou por Seu imenso amor!

2. Maravilhosa graça! Traz salvação e paz;
Alivia o fardo e vida nova traz.
Quebrando as prisões da culpa e da dor,
Renova o pecador no Seu amor.

3. Maravilhosa graça! O que Jesus me deu!
Fez-me herdeiro santo da glória lá do céu.
Cantarei sem cessar louvores ao Senhor,
Proclamando a grandeza do Seu amor.`,
    crossReference: {
      hinario: 'CC',
      number: 193,
      title: 'Maravilhosa Graça'
    },
    keywords: ['maravilhosa graça', 'graça', 'infinita', 'perdão', 'salvação', 'pecado', 'amor']
  },
  {
    id: 'hcc_148',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 148,
    title: 'Vencendo Vem Jesus',
    author: 'Julia Ward Howe',
    theme: 'Escatologia e Triunfo',
    subtheme: 'O Retorno Triunfante do Cordeiro',
    occasion: 'encerramento',
    emotionalTone: 'vibrante',
    stanzas: [
      'Já refulge a glória eterna de Jesus, o Rei dos reis;\nBreve os reinos deste mundo seguirão as suas leis!\nOs sinais dos tempos mostram que, no céu, em santidade,\nVencendo vem Jesus!',
      'O clarim que chama os crentes à batalha já soou;\nCristo, à frente do seu povo, multidões já conquistou!\nO inimigo em retirada seu poder já derribou,\nVencendo vem Jesus!',
      'Eis que em glória refulgente sobre as nuvens descerá,\nE as nações da terra inteira com poder governará!\nQuem com fé serviu a Cristo glória eterna receberá,\nVencendo vem Jesus!'
    ],
    chorus: 'Glória, glória! Aleluia!\nGlória, glória! Aleluia!\nGlória, glória! Aleluia!\nVencendo vem Jesus!',
    fullLyrics: `1. Já refulge a glória eterna de Jesus, o Rei dos reis;
Breve os reinos deste mundo seguirão as suas leis!
Os sinais dos tempos mostram que, no céu, em santidade,
Vencendo vem Jesus!

[Coro]
Glória, glória! Aleluia!
Glória, glória! Aleluia!
Glória, glória! Aleluia!
Vencendo vem Jesus!

2. O clarim que chama os crentes à batalha já soou;
Cristo, à frente do seu povo, multidões já conquistou!
O inimigo em retirada seu poder já derribou,
Vencendo vem Jesus!

3. Eis que em glória refulgente sobre as nuvens descerá,
E as nações da terra inteira com poder governará!
Quem com fé serviu a Cristo glória eterna receberá,
Vencendo vem Jesus!`,
    crossReference: {
      hinario: 'CC',
      number: 112,
      title: 'Vencendo Vem Jesus'
    },
    keywords: ['vencendo vem jesus', 'glória aleluia', 'vitória', 'escatologia', 'retorno']
  },
  {
    id: 'hcc_460',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 460,
    title: 'Eis-me Aqui, Senhor',
    author: 'Daniel S. Warner',
    theme: 'Missões e Envio',
    subtheme: 'Obediência e Amor aos Perdidos',
    occasion: 'encerramento',
    emotionalTone: 'decisivo',
    stanzas: [
      'A voz de Cristo escuto a me chamar:\n"Quem irá por mim a seara ceifar?"\nCom zelo e amor eu quero responder:\nEis-me aqui, Senhor, para te obedecer!',
      'As almas perdidas sofrem em escuridão,\nClamam com urgência por consolação;\nA luz do evangelho eu vou proclamar,\nTé que todo o mundo venha a Cristo amar.',
      'Seja em terras longas ou no meu país,\nFazer tua vontade é o que me faz feliz;\nDeixo tudo e sigo o teu caminhar,\nTé na glória eterna contigo reinar.'
    ],
    chorus: 'Eis-me aqui, Senhor! Eis-me aqui, Senhor!\nManda-me a mim, pronto estou, meu Salvador!',
    fullLyrics: `1. A voz de Cristo escuto a me chamar:
"Quem irá por mim a seara ceifar?"
Com zelo e amor eu quero responder:
Eis-me aqui, Senhor, para te obedecer!

[Coro]
Eis-me aqui, Senhor! Eis-me aqui, Senhor!
Manda-me a mim, pronto estou, meu Salvador!

2. As almas perdidas sofrem em escuridão,
Clamam com urgência por consolação;
A luz do evangelho eu vou proclamar,
Té que todo o mundo venha a Cristo amar.

3. Seja em terras longas ou no meu país,
Fazer tua vontade é o que me faz feliz;
Deixo tudo e sigo o teu caminhar,
Té na glória eterna contigo reinar.`,
    crossReference: {
      hinario: 'CC',
      number: 440,
      title: 'Eis-me Aqui, Senhor'
    },
    keywords: ['eis-me aqui', 'missões', 'envio', 'seara', 'serviço', 'chamado']
  },
  {
    id: 'hcc_450',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 450,
    title: 'Trabalhai e Orai',
    author: 'Charles H. Gabriel',
    theme: 'Serviço e Fidelidade',
    subtheme: 'Vigilância até o Fim',
    occasion: 'encerramento',
    emotionalTone: 'vibrante',
    stanzas: [
      'Quereis saber o segredo de vencer na oração?\nTrabalhai e orai!\nQuereis guardar a seara contra a vil corrupção?\nTrabalhai com fervor e orai!',
      'Não olheis para trás, nem temais o perigo;\nTrabalhai e orai!\nCristo guia seus servos no bom combate;\nTrabalhai com vigor e orai!',
      'Quando a tarde cair e a colheita findar,\nTrabalhai e orai!\nPara os braços de Cristo havemos de voar;\nE o descanso celeste gozar!'
    ],
    chorus: 'Trabalhai e orai, na seara do Senhor!\nTrabalhai e orai, com fervor e santo amor!\nO Mestre nos chama à grande labuta,\nTrabalhai e orai sem cessar!',
    fullLyrics: `1. Quereis saber o segredo de vencer na oração?
Trabalhai e orai!
Quereis guardar a seara contra a vil corrupção?
Trabalhai com fervor e orai!

[Coro]
Trabalhai e orai, na seara do Senhor!
Trabalhai e orai, com fervor e santo amor!
O Mestre nos chama à grande labuta,
Trabalhai e orai sem cessar!

2. Não olheis para trás, nem temais o perigo;
Trabalhai e orai!
Cristo guia seus servos no bom combate;
Trabalhai com vigor e orai!

3. Quando a tarde cair e a colheita findar,
Trabalhai e orai!
Para os braços de Cristo havemos de voar;
E o descanso celeste gozar!`,
    crossReference: {
      hinario: 'CC',
      number: 460,
      title: 'Trabalhai e Orai'
    },
    keywords: ['trabalhai e orai', 'oração', 'vigilância', 'seara', 'combate', 'fidelidade']
  },
  {
    id: 'hcc_242',
    hinario: 'HCC',
    hinarioName: 'Hinário para o Culto Cristão (JUERP)',
    number: 242,
    title: 'Vem, Visita a Tua Igreja',
    author: 'William H. Bathurst',
    theme: 'A Igreja e o Espírito Santo',
    subtheme: 'Avivamento Espiritual',
    occasion: 'abertura',
    emotionalTone: 'restaurador',
    stanzas: [
      'Vem, visita a tua igreja, ó bendito Salvador!\nDá-nos hoje tua graça, manifesta o teu amor.\nVem, derrama o teu Espírito com poder e comunhão,\nE desperta a todo o crente com fervor no coração.',
      'Purifica os corações, faz o fogo do amor queimar;\nTira o orgulho e o egoísmo, vem a paz restaurar.\nEm oração nos unimos diante do teu altar,\nPara ver a tua glória neste templo transbordar.'
    ],
    chorus: 'Vem, visita a tua igreja! Ó Senhor Jesus, vem já!\nTeu poder e tua graça a este povo outorgará!',
    fullLyrics: `1. Vem, visita a tua igreja, ó bendito Salvador!
Dá-nos hoje tua graça, manifesta o teu amor.
Vem, derrama o teu Espírito com poder e comunhão,
E desperta a todo o crente com fervor no coração.

[Coro]
Vem, visita a tua igreja! Ó Senhor Jesus, vem já!
Teu poder e tua graça a este povo outorgará!

2. Purifica os corações, faz o fogo do amor queimar;
Tira o orgulho e o egoísmo, vem a paz restaurar.
Em oração nos unimos diante do teu altar,
Para ver a tua glória neste templo transbordar.`,
    crossReference: {
      hinario: 'CC',
      number: 147,
      title: 'Vem, Visita a Tua Igreja'
    },
    keywords: ['visita', 'igreja', 'avivamento', 'espírito santo', 'graça', 'fogo']
  }
];

export const ALL_JUERP_HYMNS: DetailedHymn[] = [
  ...CANTOR_CRISTAO_HYMNS,
  ...HCC_HYMNS
];

// Helper retrocompatível para componentes legados que ainda esperem o tipo simples
export interface Hymn {
  number: number;
  title: string;
  theme: string;
  subtheme: string;
  occasion: string;
  emotionalTone: 'solene' | 'vibrante' | 'contemplativo' | 'alegre' | 'restaurador' | 'decisivo';
  keywords: string[];
}

export const BAPTIST_HYMNS: Hymn[] = CANTOR_CRISTAO_HYMNS.map(h => ({
  number: h.number,
  title: h.title,
  theme: h.theme,
  subtheme: h.subtheme,
  occasion: h.occasion === 'abertura' ? 'Abertura' :
            h.occasion === 'antesMensagem' ? 'Antes da Mensagem' :
            h.occasion === 'apelo' ? 'Apelo' : 'Encerramento',
  emotionalTone: h.emotionalTone,
  keywords: h.keywords
}));

/**
 * Encontra a contraparte direta do hino no outro hinário da JUERP (CC <-> HCC)
 */
export function findCrossReferenceHymn(hymn: DetailedHymn): DetailedHymn | undefined {
  if (!hymn.crossReference) return undefined;
  const targetHinario = hymn.crossReference.hinario;
  const targetNumber = hymn.crossReference.number;

  const pool = targetHinario === 'CC' ? CANTOR_CRISTAO_HYMNS : HCC_HYMNS;
  return pool.find(h => h.number === targetNumber) ||
         pool.find(h => h.title.toLowerCase() === hymn.crossReference?.title.toLowerCase());
}

/**
 * Seleciona os 4 hinos do culto batista para as 4 ocasiões:
 * 1. Abertura / Prelúdio / Adoração
 * 2. Antes da Mensagem / Preparação
 * 3. Apelo / Decisão / Consagração
 * 4. Encerramento / Poslúdio / Envio
 * 
 * Nutre-se EXCLUSIVAMENTE de dois hinários da JUERP:
 * - Cantor Cristão (CC - JUERP)
 * - Hinário para o Culto Cristão (HCC - JUERP)
 */
export function selectHymnsForSermon(
  text: string, 
  category: string, 
  churchProfile: string,
  preferredHinario: HinarioType = 'CC'
): {
  abertura: DetailedHymn;
  antesMensagem: DetailedHymn;
  apelo: DetailedHymn;
  encerramento: DetailedHymn;
  alternateAbertura?: DetailedHymn;
  alternateAntesMensagem?: DetailedHymn;
  alternateApelo?: DetailedHymn;
  alternateEncerramento?: DetailedHymn;
} {
  const normText = (text + ' ' + category + ' ' + churchProfile).toLowerCase();

  // Selecionar conjunto primário com base na preferência do usuário (como versões da Bíblia)
  const primaryPool = preferredHinario === 'HCC' ? HCC_HYMNS : CANTOR_CRISTAO_HYMNS;
  const alternatePool = preferredHinario === 'HCC' ? CANTOR_CRISTAO_HYMNS : HCC_HYMNS;

  const scoreHymn = (h: DetailedHymn) => {
    let score = 0;
    h.keywords.forEach(kw => {
      if (normText.includes(kw.toLowerCase())) score += 4;
    });
    if (normText.includes(h.theme.toLowerCase())) score += 6;
    if (normText.includes(h.subtheme.toLowerCase())) score += 5;
    return score;
  };

  const getBestHymnForOccasion = (
    pool: DetailedHymn[], 
    occasion: 'abertura' | 'antesMensagem' | 'apelo' | 'encerramento'
  ): DetailedHymn => {
    const list = pool.filter(h => h.occasion === occasion);
    const candidates = list.length > 0 ? list : pool;
    let best = candidates[0];
    let maxScore = -1;
    candidates.forEach(h => {
      const s = scoreHymn(h);
      if (s > maxScore) {
        maxScore = s;
        best = h;
      }
    });
    return best;
  };

  const abertura = getBestHymnForOccasion(primaryPool, 'abertura');
  const antesMensagem = getBestHymnForOccasion(primaryPool, 'antesMensagem');
  const apelo = getBestHymnForOccasion(primaryPool, 'apelo');
  const encerramento = getBestHymnForOccasion(primaryPool, 'encerramento');

  // Contrapartes automáticas (como alternar entre versões bíblicas ACF e ARA)
  const alternateAbertura = findCrossReferenceHymn(abertura) || getBestHymnForOccasion(alternatePool, 'abertura');
  const alternateAntesMensagem = findCrossReferenceHymn(antesMensagem) || getBestHymnForOccasion(alternatePool, 'antesMensagem');
  const alternateApelo = findCrossReferenceHymn(apelo) || getBestHymnForOccasion(alternatePool, 'apelo');
  const alternateEncerramento = findCrossReferenceHymn(encerramento) || getBestHymnForOccasion(alternatePool, 'encerramento');

  return {
    abertura,
    antesMensagem,
    apelo,
    encerramento,
    alternateAbertura,
    alternateAntesMensagem,
    alternateApelo,
    alternateEncerramento
  };
}

/**
 * Constrói o objeto SermonHymns com títulos formatados, detalhes completos de estrofes/coro
 * e compatibilidade regressiva perfeita para strings legadas.
 */
export function buildSermonHymnsRecord(
  selection: ReturnType<typeof selectHymnsForSermon>,
  preferredHinario: HinarioType = 'CC'
): SermonHymns {
  const { abertura, antesMensagem, apelo, encerramento,
          alternateAbertura, alternateAntesMensagem, alternateApelo, alternateEncerramento } = selection;

  const hinarioPrefix = (h: DetailedHymn) => `${h.hinario} ${h.number}`;

  return {
    preferredHinario,
    abertura: `${hinarioPrefix(abertura)} — ${abertura.title} (${abertura.hinarioName})`,
    antesMensagem: `${hinarioPrefix(antesMensagem)} — ${antesMensagem.title} (${antesMensagem.hinarioName})`,
    apelo: `${hinarioPrefix(apelo)} — ${apelo.title} (${apelo.hinarioName})`,
    encerramento: `${hinarioPrefix(encerramento)} — ${encerramento.title} (${encerramento.hinarioName})`,
    details: {
      abertura,
      antesMensagem,
      apelo,
      encerramento
    },
    alternateDetails: {
      abertura: alternateAbertura,
      antesMensagem: alternateAntesMensagem,
      apelo: alternateApelo,
      encerramento: alternateEncerramento
    }
  };
}

/**
 * Hidrata automaticamente sermões legados da biblioteca que tenham apenas as strings antigas,
 * anexando a letra oficial completa e permitindo alternância instantânea entre CC e HCC.
 */
export function hydrateHymnsIfLegacy(hymns?: Partial<SermonHymns>): SermonHymns {
  if (!hymns) {
    const defaultSelection = selectHymnsForSermon('adoração graça louvor', 'Geral', 'tradicional', 'CC');
    return buildSermonHymnsRecord(defaultSelection, 'CC');
  }

  // Se já tiver details completos com estrofes, retorna preservando
  if (hymns.details?.abertura?.stanzas && hymns.details?.antesMensagem?.stanzas &&
      hymns.details?.apelo?.stanzas && hymns.details?.encerramento?.stanzas) {
    return {
      abertura: hymns.abertura || `${hymns.details.abertura.hinario} ${hymns.details.abertura.number} — ${hymns.details.abertura.title}`,
      antesMensagem: hymns.antesMensagem || `${hymns.details.antesMensagem.hinario} ${hymns.details.antesMensagem.number} — ${hymns.details.antesMensagem.title}`,
      apelo: hymns.apelo || `${hymns.details.apelo.hinario} ${hymns.details.apelo.number} — ${hymns.details.apelo.title}`,
      encerramento: hymns.encerramento || `${hymns.details.encerramento.hinario} ${hymns.details.encerramento.number} — ${hymns.details.encerramento.title}`,
      preferredHinario: hymns.preferredHinario || 'CC',
      details: hymns.details,
      alternateDetails: hymns.alternateDetails
    };
  }

  // Tenta encontrar pelo número ou título na base oficial
  const findMatch = (rawStr?: string, defaultOccasion: 'abertura' | 'antesMensagem' | 'apelo' | 'encerramento' = 'abertura'): DetailedHymn => {
    if (!rawStr) {
      return CANTOR_CRISTAO_HYMNS.find(h => h.occasion === defaultOccasion) || CANTOR_CRISTAO_HYMNS[0];
    }
    const cleanStr = rawStr.toLowerCase();
    
    // Tenta encontrar por correspondência de título ou palavra-chave
    for (const h of ALL_JUERP_HYMNS) {
      if (cleanStr.includes(h.title.toLowerCase())) return h;
    }
    
    // Tenta encontrar por número se coincidir
    const numMatch = rawStr.match(/\b(\d{1,3})\b/);
    if (numMatch) {
      const parsedNum = parseInt(numMatch[1], 10);
      const byNum = ALL_JUERP_HYMNS.find(h => h.number === parsedNum);
      if (byNum) return byNum;
    }

    // Fallback gracioso para um hino daquela ocasião
    return ALL_JUERP_HYMNS.find(h => h.occasion === defaultOccasion) || CANTOR_CRISTAO_HYMNS[0];
  };

  const ab = findMatch(hymns.abertura, 'abertura');
  const am = findMatch(hymns.antesMensagem, 'antesMensagem');
  const ap = findMatch(hymns.apelo, 'apelo');
  const en = findMatch(hymns.encerramento, 'encerramento');

  const pref = hymns.preferredHinario || (ab.hinario as HinarioType) || 'CC';
  const altAb = findCrossReferenceHymn(ab);
  const altAm = findCrossReferenceHymn(am);
  const altAp = findCrossReferenceHymn(ap);
  const altEn = findCrossReferenceHymn(en);

  return {
    abertura: hymns.abertura || `${ab.hinario} ${ab.number} — ${ab.title}`,
    antesMensagem: hymns.antesMensagem || `${am.hinario} ${am.number} — ${am.title}`,
    apelo: hymns.apelo || `${ap.hinario} ${ap.number} — ${ap.title}`,
    encerramento: hymns.encerramento || `${en.hinario} ${en.number} — ${en.title}`,
    preferredHinario: pref,
    details: {
      abertura: ab,
      antesMensagem: am,
      apelo: ap,
      encerramento: en
    },
    alternateDetails: {
      abertura: altAb,
      antesMensagem: altAm,
      apelo: altAp,
      encerramento: altEn
    }
  };
}
