/* content.js — conteúdo doutrinal. Sem rede, sem fetch. */
const EXAM_CONTENT = {
  completo: {
    id: "completo",
    label: "Exame completo",
    kicker: "Preparação para a Confissão",
    sections: [
      {
        id: "relacao-deus",
        title: "Minha relação com Deus",
        desc: "O primeiro mandamento e a vida de oração. Examine com serenidade — sem escrúpulo — seu amor a Deus acima de todas as coisas.",
        questions: [
          "Tenho colocado Deus em primeiro lugar em minha vida, ou tenho preferido outras coisas a Ele?",
          "Tenho negligenciado deliberadamente a oração pessoal diária?",
          "Tenho deixado de rezar por preguiça, pressa ou indiferença, mesmo podendo fazê-lo?",
          "Tenho participado da Missa dominical com reverência ou a tenho omitido sem motivo grave?",
          "Tenho recebido a Comunhão sem estar em estado de graça ou sem o devido respeito?",
          "Tenho usado o nome de Deus em vão, com leviandade ou para mentir?",
          "Tenho feito juramentos desnecessários ou não tenho cumprido promessas feitas a Deus?",
          "Tenho dado crédito a superstições, horóscopos, ou práticas incompatíveis com a fé católica?",
          "Tenho duvidado voluntariamente de verdades da fé ou deixado de buscar esclarecimento?",
          "Tenho tido vergonha de professar ou defender a fé quando era oportuno fazê-lo?",
          "Tenho sido grato a Deus pelos benefícios recebidos?",
          "Tenho confiado em Deus nas dificuldades ou tenho cedido ao desespero e à murmuração?"
        ]
      },
      {
        id: "proximo",
        title: "Minha relação com o próximo",
        desc: "Caridade, justiça e misericórdia para com os outros. Pense em família, amigos, colegas e desconhecidos.",
        questions: [
          "Tenho tratado meus pais, familiares ou pessoas próximas com falta de caridade, respeito ou paciência?",
          "Tenho desobedecido ou desonrado meus pais ou superiores legítimos em matéria justa?",
          "Tenho negligenciado o cuidado com filhos, cônjuge ou dependentes que estão sob minha responsabilidade?",
          "Tenho nutrido ódio, rancor ou desejo de vingança contra alguém?",
          "Tenho falado mal de outros, revelado faltas ocultas ou espalhado calúnias?",
          "Tenho sido desonesto em palavras ou ações — mentindo, enganando ou omitindo a verdade quando devia dizê-la?",
          "Tenho prejudicado alguém em seus bens, roubado, retido o alheio ou causado dano injusto?",
          "Tenho deixado de restituir o que devo ou de reparar um dano que causei?",
          "Tenho sido injusto no trabalho, nos estudos ou nas responsabilidades que me foram confiadas?",
          "Tenho julgado temerariamente as intenções alheias?",
          "Tenho semeado discórdia, fomentado brigas ou recusado reconciliar-me?",
          "Tenho sido indiferente ao sofrimento do próximo quando podia ajudar?",
          "Tenho usado as pessoas como meio para meus interesses, sem respeito à sua dignidade?"
        ]
      },
      {
        id: "vida-pessoal",
        title: "Minha vida pessoal",
        desc: "Pureza, temperança, honestidade e domínio de si. Deus vê o coração.",
        questions: [
          "Tenho alimentado voluntariamente pensamentos, desejos ou imaginações contrários à pureza ou à caridade?",
          "Tenho consentido em olhares, conversas ou entretenimentos que me levam ao pecado?",
          "Tenho usado de forma desordenada a sexualidade, fora do matrimônio ou contra a fidelidade conjugal?",
          "Tenho sido intemperante na comida, na bebida ou no uso de outras substâncias?",
          "Tenho cultivado a preguiça, adiando deveres importantes sem razão suficiente?",
          "Tenho sido vaidoso, buscando chamar atenção, elogios ou superioridade sobre os outros?",
          "Tenho cedido à ira, com palavras ou gestos desmedidos?",
          "Tenho cultivado inveja dos bens, qualidades ou êxitos alheios?",
          "Tenho usado mal a língua — com palavrões, grosserias, sarcasmo que fere ou humor que humilha?",
          "Tenho sido honesto no uso do dinheiro, do tempo e dos recursos que Deus me confiou?",
          "Tenho cuidado da minha saúde e dos dons que recebi com responsabilidade?",
          "Tenho buscado crescer em virtudes ou tenho me acomodado nos mesmos defeitos?"
        ]
      },
      {
        id: "deveres",
        title: "Meus deveres de estado",
        desc: "Cada um tem deveres próprios segundo sua vocação — família, trabalho, estudo e Igreja.",
        questions: [
          "Tenho cumprido com diligência meus deveres de trabalho ou estudo?",
          "Tenho sido justo e honesto com colegas, clientes, alunos ou subordinados?",
          "Tenho usado o tempo de trabalho de forma responsável ou o tenho desperdiçado deliberadamente?",
          "Tenho respeitado os bens da empresa, da escola ou da comunidade?",
          "No matrimônio, tenho sido fiel, respeitoso e colaborativo com meu cônjuge?",
          "Como pai/mãe, tenho educado meus filhos na fé e no bom exemplo, com paciência?",
          "Como filho, tenho honrado e auxiliado meus pais, especialmente quando precisam?",
          "Tenho observado os Mandamentos da Igreja — Missa dominical, confissão anual, jejum e abstinência quando prescritos?",
          "Tenho contribuído, conforme minhas possibilidades, para as necessidades da Igreja e dos pobres?",
          "Tenho buscado formar minha consciência, lendo e aprendendo sobre a fé, ou tenho permanecido na ignorância por comodidade?",
          "Tenho dado bom testemunho cristão no ambiente onde vivo?",
          "Tenho assumido minhas responsabilidades civis e sociais com honestidade?"
        ]
      },
      {
        id: "omissoes",
        title: "Pecados de omissão",
        desc: "Nem só o que fizemos, mas o bem que deixamos de fazer. A omissão também pesa diante de Deus.",
        questions: [
          "Tenho deixado de fazer o bem que estava ao meu alcance, por comodidade ou medo?",
          "Tenho deixado de corrigir com caridade alguém que errava, quando me cabia fazê-lo?",
          "Tenho deixado de perdoar quem me ofendeu, mesmo quando o outro procurou reconciliar-se?",
          "Tenho deixado de ajudar alguém em necessidade, podendo fazê-lo sem grave prejuízo?",
          "Tenho deixado de defender a verdade ou a justiça quando meu silêncio prejudicou alguém?",
          "Tenho deixado de dedicar tempo à família, aos amigos ou a quem precisa de minha presença?",
          "Tenho deixado de rezar por vivos e falecidos que precisam de oração?",
          "Tenho deixado de agradecer o bem que recebo?",
          "Tenho deixado de usar meus talentos e dons para servir a Deus e ao próximo?",
          "Tenho deixado de procurar os sacramentos por negligência?",
          "Tenho deixado de reparar uma injustiça que causei, mesmo pequena?",
          "Tenho silenciado diante de conversas ou atitudes que ofendem a Deus ou prejudicam alguém, quando deveria manifestar-me com prudência?"
        ]
      },
      {
        id: "virtudes",
        title: "Virtudes que preciso cultivar",
        desc: "Não para atribuir nota, mas para reconhecer onde Deus o chama a crescer. Escolha com honestidade.",
        questions: [
          "Tenho vivido a fé com confiança ou deixo-me dominar por medo e desânimo?",
          "Tenho cultivado a esperança cristã, mesmo nas provações?",
          "Tenho praticado a caridade concreta — esmola, serviço, paciência, perdão?",
          "Tenho sido justo, dando a cada um o que lhe é devido?",
          "Tenho vivido a prudência, pensando antes de decidir e agir?",
          "Tenho exercitado a fortaleza para fazer o bem mesmo quando custa?",
          "Tenho vivido a temperança, moderando desejos e impulsos?",
          "Tenho sido humilde para reconhecer meus erros e pedir perdão?",
          "Tenho sido misericordioso como o Pai é misericordioso?",
          "Tenho buscado a paz, sendo instrumento de reconciliação?",
          "Tenho sido responsável no uso dos bens materiais e do meio ambiente que Deus confiou à humanidade?",
          "Tenho desejado sinceramente converter-me e recomeçar, confiando na graça de Deus?"
        ]
      },
      {
        id: "revisao",
        title: "Revisão final",
        desc: "Retorne com calma ao que tocou seu coração. Leve à Confissão o que sua consciência indicar, sem escrúpulo.",
        questions: [
          "Há algum pecado grave que ainda não examinei com sinceridade diante de Deus?",
          "Há alguma pessoa a quem preciso pedir perdão ou com quem preciso reconciliar-me?",
          "Há algum bem que Deus me pede concretamente nos próximos dias e que tenho adiado?",
          "Há alguma dúvida sobre matéria grave que preciso levar ao sacerdote, em vez de decidir sozinho?",
          "Estou disposto, com a graça de Deus, a evitar as ocasiões próximas de pecado?",
          "Que propósito concreto de emenda posso assumir a partir deste exame?"
        ]
      }
    ]
  },

  rapido: {
    id: "rapido",
    label: "Exame rápido",
    kicker: "Revisão breve",
    sections: [
      {
        id: "rapido-unico",
        title: "Exame rápido",
        desc: "Poucos minutos de revisão. Não substitui o exame completo antes da Confissão.",
        questions: [
          "Tenho negligenciado deliberadamente minha vida de oração hoje?",
          "Tenho colocado outras coisas acima de Deus?",
          "Tenho tratado alguém com falta de caridade em pensamentos, palavras ou ações?",
          "Tenho sido desonesto, mesmo em pequenas coisas?",
          "Tenho deixado de cumprir um dever importante que me cabia hoje?",
          "Tenho alimentado voluntariamente algum pensamento ou desejo desordenado?",
          "Tenho deixado de fazer o bem que pude fazer?",
          "Pelo que devo agradecer a Deus hoje?"
        ]
      }
    ]
  },

  diario: {
    id: "diario",
    label: "Exame diário",
    kicker: "Revisão do dia",
    sections: [
      {
        id: "diario-unico",
        title: "Exame diário",
        desc: "Ao fim do dia, diante de Deus, em poucos minutos de silêncio.",
        questions: [
          "Onde reconheci a graça de Deus hoje?",
          "Onde pequei — em pensamentos, palavras, ações ou omissões?",
          "Onde deixei de fazer o bem que estava ao meu alcance?",
          "A quem feri ou magoei hoje, e como posso reparar?",
          "O que preciso pedir perdão a Deus e, se necessário, ao próximo?",
          "Pelo que devo agradecer hoje?",
          "O que quero fazer diferente amanhã, com a ajuda de Deus?"
        ]
      }
    ]
  }
};

const PRAYERS = {
  contricao: {
    pt: `Meu Deus, porque sois infinitamente bom e porque Vos amo sobre todas as coisas, pesa-me de todo o meu coração de Vos ter ofendido. E proponho firmemente, com o auxílio da vossa santa graça, fazer penitência, não Vos tornar a ofender e fugir às ocasiões de pecado. Amém.`,
    la: `Deus meus, ex toto corde pænitet me omnium meorum peccatorum, eaque detestor, quia peccando, non solum pœnas a Te iuste statutas promeritus sum, sed præsertim quia offendi Te, summum bonum, ac dignum qui super omnia diligaris. Ideo firmiter propono, adiuvante gratia Tua, de cetero me non peccaturum peccandique occasiones proximas fugiturum. Amen.`
  },
  espirito: {
    pt: `Vinde, Espírito Santo, enchei os corações dos vossos fiéis e acendei neles o fogo do vosso amor. Enviai o vosso Espírito e tudo será criado, e renovareis a face da terra.\n\nOremos: Ó Deus, que instruístes os corações dos vossos fiéis com a luz do Espírito Santo, fazei que apreciemos retamente todas as coisas segundo o mesmo Espírito e gozemos sempre da sua consolação. Por Cristo, nosso Senhor. Amém.`,
    la: `Veni, Sancte Spiritus, reple tuorum corda fidelium et tui amoris in eis ignem accende. Emitte Spiritum tuum et creabuntur, et renovabis faciem terræ.\n\nOremus: Deus, qui corda fidelium Sancti Spiritus illustratione docuisti, da nobis in eodem Spiritu recta sapere et de eius semper consolatione gaudere. Per Christum Dominum nostrum. Amen.`
  },
  confiteor: {
    pt: `Confesso a Deus todo-poderoso e a vós, irmãos, que pequei muitas vezes por pensamentos e palavras, atos e omissões, por minha culpa, minha tão grande culpa. E peço à Virgem Maria, aos Anjos e Santos, e a vós, irmãos, que rogueis por mim a Deus, nosso Senhor.`,
    la: `Confiteor Deo omnipotenti et vobis, fratres, quia peccavi nimis cogitatione, verbo, opere et omissione: mea culpa, mea culpa, mea maxima culpa. Ideo precor beatam Mariam semper Virginem, omnes Angelos et Sanctos, et vos, fratres, orare pro me ad Dominum Deum nostrum.`
  }
};
