/**
 * The blog. Each post is data rather than markup, so the same post renders into the page,
 * into the prerendered HTML and into the JSON-LD a search engine reads, from one source.
 *
 * `body` is a short list of blocks. There is no markdown parser on purpose: the set of
 * things a post may contain is small and fixed, and every one of them is styled once in
 * BlogPost.tsx.
 */

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string; id: string }
  | { t: 'h3'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'note'; title: string; text: string }
  /** A short question and answer. Search engines read these as an FAQ. */
  | { t: 'faq'; items: { q: string; a: string }[] };

export interface Post {
  slug: string;
  title: string;
  /** The meta description and the summary on the index – one sentence, under 160 characters. */
  description: string;
  /** ISO date. */
  date: string;
  updated?: string;
  category: 'AI' | 'Connectors' | 'Markedsføring' | 'Microsoft Ads';
  tags: string[];
  /** The opening paragraph, shown under the title. */
  lead: string;
  body: Block[];
}

/** The post's own words – shown as a reading time and given to search engines as a count. */
export function wordCount(post: Post): number {
  return post.body.reduce((n, b) => {
    if ('text' in b) return n + b.text.split(/\s+/).length;
    if ('items' in b) return n + b.items.reduce((m, i) => m + (typeof i === 'string' ? i : `${i.q} ${i.a}`).split(/\s+/).length, 0);
    return n;
  }, post.lead.split(/\s+/).length);
}

export const readingMinutes = (post: Post) => Math.max(2, Math.round(wordCount(post) / 200));

export const POSTS: Post[] = [
  {
    slug: 'ai-til-microsoft-ads',
    title: 'AI til Microsoft Ads: sådan får du hjælpen uden at give kontrollen fra dig',
    description:
      'AI kan læse en annoncekonto hurtigere end noget menneske. Her er, hvad den skal have lov til, hvad den ikke skal, og hvordan du bygger en arbejdsgang, der holder.',
    date: '2026-01-14',
    category: 'AI',
    tags: ['AI', 'Microsoft Advertising', 'Automatisering', 'Godkendelse'],
    lead: 'De fleste, der prøver AI på deres annoncekonto, lander et af to steder: enten gør den ingenting brugbart, eller også gør den alt for meget. Forskellen ligger sjældent i modellen. Den ligger i, hvad man har givet den adgang til, og hvem der siger ja.',
    body: [
      { t: 'h2', id: 'hvad-ai-er-god-til', text: 'Hvad AI faktisk er god til i en annoncekonto' },
      {
        t: 'p',
        text: 'En sprogmodel er ikke en bedre budgiver end Microsofts egne algoritmer. Den skal ikke sættes til at justere bud hvert kvarter – det taber den. Den er til gengæld markant bedre end os til arbejde, der kræver at læse meget og holde mange ting i hovedet på én gang.',
      },
      {
        t: 'ul',
        items: [
          'Læse flere tusind søgetermer igennem og finde dem, der koster penge uden at konvertere.',
          'Sammenholde annoncegrupper på tværs af kampagner og se, hvor det samme søgeord konkurrerer med sig selv.',
          'Forklare, hvorfor en kampagne faldt i sidste uge, ved at se på impression share, budget og auktionsindsigt samtidig.',
          'Skrive de tyve annoncevarianter, du aldrig fik testet, i den tone I allerede bruger.',
          'Holde øje med, at en ændring, I lavede for tre uger siden, faktisk virkede.',
        ],
      },
      {
        t: 'p',
        text: 'Det er alt sammen opgaver, hvor flaskehalsen er tid og tålmodighed, ikke indsigt. Du ved godt, at der ligger spild i søgetermerne. Du har bare ikke lyst til at læse 4.000 rækker igennem en fredag eftermiddag.',
      },

      { t: 'h2', id: 'hvor-det-gaar-galt', text: 'Hvor det går galt' },
      {
        t: 'p',
        text: 'Problemet opstår i det øjeblik, AI’en får lov til at skrive til kontoen uden et menneske imellem. Ikke fordi den er dum, men fordi den er selvsikker. En model, der har misforstået, hvad en kampagne er til for, skriver den forkerte ændring med præcis samme rolige tone som den rigtige.',
      },
      {
        t: 'p',
        text: 'Og den fejl opdages sjældent med det samme. Et negativt søgeord, der er sat for bredt, slukker stille og roligt for trafik, der konverterede. Det ser ikke ud som en fejl i rapporten – det ser ud som en uge med færre klik.',
      },
      { t: 'quote', text: 'Den farligste automatisering er ikke den, der fejler højlydt. Det er den, der fejler diskret og bliver ved i tre uger.' },

      { t: 'h2', id: 'godkendelse', text: 'Godkendelse som arkitektur, ikke som indstilling' },
      {
        t: 'p',
        text: 'Den arbejdsgang, der holder i praksis, har et menneske som sidste led – men kun som sidste led. AI’en må gerne gøre alt forarbejdet: finde problemet, hente tallene, regne konsekvensen ud og formulere den præcise ændring. Den må bare ikke sende den.',
      },
      {
        t: 'ol',
        items: [
          'AI’en læser kontoen og finder noget, der er værd at ændre.',
          'Den forbereder ændringen konkret: hvilke søgeord, hvilken match type, hvilken annoncegruppe, hvad det koster i dag.',
          'Den viser den som et forslag med en begrundelse og en advarsel, hvis den er stor.',
          'Du fravælger det, der ikke skal med, og godkender resten.',
          'Først dér sendes den – og bagefter læses den tilbage fra Microsoft, så »gennemført« betyder gennemført.',
        ],
      },
      {
        t: 'p',
        text: 'Det sidste punkt er vigtigere, end det lyder. En API kan svare 200 OK på noget, der ikke blev til noget. Hvis værktøjet siger »færdig« ud fra sit eget svar og ikke ud fra kontoen, har du ikke en log – du har en hensigtserklæring.',
      },
      {
        t: 'note',
        title: 'Et godt værktøj kan fortrydes',
        text: 'Hvis en ændring ikke kan rulles tilbage med ét klik, og du ikke kan se hvem der godkendte den og hvornår, så er det ikke klar til en konto med rigtige penge på.',
      },

      { t: 'h2', id: 'de-fem-opgaver', text: 'De fem opgaver, hvor det betaler sig først' },
      {
        t: 'p',
        text: 'Hvis du kun skal vælge nogle få steder at begynde, så er det her dem, der oftest giver noget tilbage med det samme. De har det til fælles, at resultatet kan vurderes af et menneske på under et minut.',
      },
      { t: 'h3', text: 'Søgetermer uden konverteringer' },
      {
        t: 'p',
        text: 'Den klassiske. Du beder om de søgetermer, der har kostet mest over 30 dage uden at konvertere, grupperet efter mønster i stedet for som en liste. Svaret er typisk fire-fem kategorier frem for fyrre løse ord, og det er langt hurtigere at tage stilling til.',
      },
      { t: 'h3', text: 'Kampagner, der konkurrerer med sig selv' },
      {
        t: 'p',
        text: 'Det samme søgeord i to annoncegrupper betyder, at du byder mod dig selv og betaler for det. Det er trivielt at finde maskinelt og kedeligt at finde i hånden, fordi det kræver at holde hele kontoens struktur i hovedet samtidig.',
      },
      { t: 'h3', text: 'Budgetter, der løber tørt' },
      {
        t: 'p',
        text: 'En kampagne, der rammer sit dagsbudget klokken 14 hver dag, taber hele eftermiddagen. Det står i impression share tabt på budget, men ingen kigger på det tal dagligt. En AI, der har adgang til kontoen, kan nævne det, uden at nogen har spurgt.',
      },
      { t: 'h3', text: 'Annoncetekster, der aldrig blev testet' },
      {
        t: 'p',
        text: 'De fleste annoncegrupper har tre overskrifter, fordi nogen skrev tre og aldrig kom tilbage. Femten varianter i jeres eget sprog tager to minutter at få og en halv time at gennemlæse – og gennemlæsningen er den vigtige del.',
      },
      { t: 'h3', text: 'Opfølgning på det, I allerede har ændret' },
      {
        t: 'p',
        text: 'Den mest oversete. Ændringer bliver lavet og aldrig evalueret, fordi det kræver at huske dem tre uger senere. Et værktøj, der fører log over, hvad der blev ændret hvornår, kan selv komme tilbage og sige, om det virkede.',
      },

      { t: 'h2', id: 'kom-i-gang', text: 'Sådan kommer du i gang uden at vædde kontoen' },
      {
        t: 'ol',
        items: [
          'Start med at læse, ikke at skrive. Lad AI’en analysere i en uge, uden at den har lov til at ændre noget. Du opdager hurtigt, om den forstår jeres konto.',
          'Tag den billigste optimering først: negative søgeord. Den er nem at vurdere, nem at fortryde, og den betaler sig selv.',
          'Sæt grænser, før du får brug for dem. En øvre grænse for, hvor meget et budget må stige ad gangen, fanger de forslag, der er rigtige i princippet og for store i praksis.',
          'Kig på ændringsloggen hver fredag i starten. Ikke for at fange fejl – for at finde ud af, hvad du egentlig vil have den til.',
        ],
      },
      { t: 'h2', id: 'hvad-du-skal-spoerge-om', text: 'Spørgsmål, du bør stille en leverandør' },
      {
        t: 'ul',
        items: [
          'Hvad sker der konkret, når modellen tager fejl – og hvordan opdager jeg det?',
          'Hvilke ændringer kan værktøjet lave uden at spørge mig? Hvis svaret er »ingen«, hvordan er det så håndhævet?',
          'Læses ændringen tilbage fra platformen bagefter, eller stoler I på jeres eget API-svar?',
          'Kan jeg se en fuld log over, hvem der godkendte hvad hvornår – og kan jeg fortryde?',
          'Hvor sendes vores kontodata hen, og bruges de til at træne modeller?',
          'Hvad sker der med vores adgange, hvis vi stopper i morgen?',
        ],
      },
      {
        t: 'p',
        text: 'Svarene er mere afslørende end nogen demo. Et værktøj, der er bygget af folk, som har haft ansvaret for en konto, kan svare præcist på dem alle sammen uden at slå op.',
      },

      {
        t: 'faq',
        items: [
          {
            q: 'Kan AI overtage den daglige drift af Microsoft Ads?',
            a: 'Den kan overtage forarbejdet – analysen, udkastene, opfølgningen. Selve beslutningen om at ændre noget på en konto med rigtige penge bør blive hos et menneske, både fordi modellen kan tage fejl, og fordi ansvaret skal kunne placeres.',
          },
          {
            q: 'Hvor meget tid sparer man reelt?',
            a: 'Mest på det arbejde, der kræver at læse meget: søgetermsrapporter, afvigelser på tværs af kampagner og opfølgning på tidligere ændringer. Det er typisk dér, timerne forsvinder i forvejen.',
          },
          {
            q: 'Hvad med data og fortrolighed?',
            a: 'Spørg altid, hvor kontodata sendes hen, og om de bruges til at træne modeller. Et værktøj, der ikke kan svare præcist på det, skal ikke have adgang til jeres konto.',
          },
        ],
      },
    ],
  },

  {
    slug: 'connectors-forklaret',
    title: 'Connectors forklaret: det er adgangen, ikke modellen, der afgør hvad AI kan gøre for dig',
    description:
      'En connector er den konkrete adgang, en AI får til et system. Her er hvad de er, hvorfor de er den egentlige forskel mellem værktøjer – og hvad du skal kigge efter.',
    date: '2026-01-28',
    category: 'Connectors',
    tags: ['Connectors', 'AI', 'Integration', 'API'],
    lead: 'Når to AI-værktøjer føles vidt forskellige, er det næsten aldrig fordi det ene bruger en klogere model. Det er fordi det ene kan se jeres data, og det andet kun kan se det, I husker at indsætte i et chatfelt.',
    body: [
      { t: 'h2', id: 'hvad-er-en-connector', text: 'Hvad en connector er' },
      {
        t: 'p',
        text: 'En connector er en afgrænset adgang mellem AI’en og et system, I bruger i forvejen: annoncekontoen, mailen, webshoppen, kalenderen. Den består af tre ting – en måde at logge ind på, en liste over hvad der må læses, og en liste over hvad der må skrives.',
      },
      {
        t: 'p',
        text: 'Den sidste liste er den, der betyder noget. Forskellen på en connector, der kun må læse, og en, der også må skrive, er forskellen på et værktøj, der giver råd, og et værktøj, der handler. Begge dele kan være rigtige – men du skal vide, hvilken du har.',
      },

      { t: 'h2', id: 'hvorfor-det-afgoer-alt', text: 'Hvorfor adgangen afgør resultatet' },
      {
        t: 'p',
        text: 'Prøv at stille det samme spørgsmål til to systemer: »Hvorfor faldt vores salg i sidste uge?«',
      },
      {
        t: 'ul',
        items: [
          'Uden connectors får du et generelt svar om sæsonudsving, konkurrence og tracking. Rigtigt nok, og ubrugeligt.',
          'Med adgang til annoncekontoen får du: budgettet på to kampagner løb tørt onsdag, og impression share faldt fra 71 % til 44 %.',
          'Med adgang til både annoncer og webshop får du: trafikken var den samme, men konverteringsraten faldt på én produktside, fordi varen var udsolgt.',
        ],
      },
      {
        t: 'p',
        text: 'Det er det samme spørgsmål og den samme model. Forskellen er udelukkende, hvad den har fået lov til at kigge på.',
      },
      { t: 'quote', text: 'En AI uden connectors er en meget velformuleret kollega, der aldrig har set jeres tal.' },

      { t: 'h2', id: 'hvad-du-skal-kigge-efter', text: 'Fem ting, du skal kigge efter' },
      { t: 'h3', text: '1. Hvem ejer forbindelsen?' },
      {
        t: 'p',
        text: 'Hvis hver medarbejder forbinder sin egen konto, mister I adgangen den dag, de holder op – og I kan ikke se, hvem der gjorde hvad. En forbindelse, der hører til virksomheden og ikke til personen, er mere værd end den lyder.',
      },
      { t: 'h3', text: '2. Hvad må den skrive?' },
      {
        t: 'p',
        text: 'Læseadgang er lavrisiko. Skriveadgang skal være eksplicit, afgrænset og synlig. Du skal kunne få et svar på »hvad er det præcis, den har lov til at ændre?« uden at skulle læse dokumentation.',
      },
      { t: 'h3', text: '3. Bekræfter den sig selv?' },
      {
        t: 'p',
        text: 'Et kald, der lykkes, er ikke det samme som en ændring, der er sket. Gode connectors læser tilbage fra systemet bagefter og siger først »gennemført«, når systemet selv viser det.',
      },
      { t: 'h3', text: '4. Hvad sker der, når den ikke kan?' },
      {
        t: 'p',
        text: 'Nogle ting kan ikke lade sig gøre via et API – en kampagnetype, der ikke kan oprettes, et felt, der ikke kan redigeres. Et ærligt værktøj siger »det kan jeg ikke, her er hvad du selv skal gøre«. Et dårligt et finder på en omvej og laver noget andet, end du bad om.',
      },
      { t: 'h3', text: '5. Kan den slås fra midt i en samtale?' },
      {
        t: 'p',
        text: 'Nogle gange vil man gerne tænke højt uden at værktøjet går i gang. At kunne slukke for adgangen for en enkelt samtale er en lille ting, der viser, at nogen har tænkt over brugen.',
      },

      {
        t: 'note',
        title: 'Connectors er også et sikkerhedsspørgsmål',
        text: 'Hver connector er en nøgle. Hold styr på, hvem der kan oprette dem, hvor nøglerne opbevares, og hvordan de tilbagekaldes. Det er kedeligt lige indtil den dag, det ikke er.',
      },

      { t: 'h2', id: 'laes-og-skriv', text: 'Forskellen på at læse og at skrive' },
      {
        t: 'p',
        text: 'Det er værd at bruge et øjeblik på, fordi det er den beslutning, der afgør, hvor meget der kan gå galt.',
      },
      {
        t: 'p',
        text: 'En læseforbindelse kan højst føre til et dårligt råd, og et dårligt råd kan du afvise. En skriveforbindelse kan føre til en ændring i et system, der koster penge mens den er der. Risikoen er ikke bare lidt større – den er af en anden slags.',
      },
      {
        t: 'p',
        text: 'Derfor giver det mening at behandle dem forskelligt. Læseadgang kan man give bredt og tidligt. Skriveadgang bør være snæver, synlig og altid gå gennem et menneske, indtil I har set værktøjet gøre det rigtige nok gange til at kende dets grænser.',
      },

      { t: 'h2', id: 'mcp', text: 'Et ord om standarder' },
      {
        t: 'p',
        text: 'Indtil for nylig blev hver eneste forbindelse bygget forfra. Det er på vej til at ændre sig: der er ved at danne sig fælles måder at beskrive, hvilke handlinger et system stiller til rådighed for en AI, og hvad de kræver – på samme måde som en API-dokumentation, bare skrevet til at blive læst af en model.',
      },
      {
        t: 'p',
        text: 'Det betyder i praksis, at antallet af systemer, jeres værktøj kan nå, vokser hurtigere, end nogen leverandør selv kan bygge. Det gør også spørgsmålet om rettigheder vigtigere, ikke mindre vigtigt: jo lettere det bliver at tilføje en forbindelse, jo mere betyder det, at nogen holder styr på, hvilke der findes.',
      },

      { t: 'h2', id: 'typiske-connectors', text: 'De connectors, der giver mest i markedsføring' },
      {
        t: 'ul',
        items: [
          'Annonceplatformen (Microsoft Advertising, Google Ads): kontoens struktur, forbrug, søgetermer og resultater.',
          'Mail og kalender: hvad der er aftalt med kunden, og hvornår der skal følges op.',
          'Webshop eller produktdata: lagerstatus, priser og marginer – dét der afgør, om mere trafik overhovedet er en god idé.',
          'Websøgning: hvad konkurrenterne gør lige nu, og hvad markedet taler om.',
        ],
      },
      {
        t: 'p',
        text: 'Man behøver ikke dem alle fra dag ét. Men rækkefølgen betyder noget: start med den, der svarer på de spørgsmål, I stiller oftest.',
      },
      { t: 'h2', id: 'raekkefoelge', text: 'Rækkefølgen, der virker' },
      {
        t: 'ol',
        items: [
          'Giv læseadgang til annoncekontoen, og brug den i to uger uden at ændre noget. I finder hurtigt ud af, om svarene er brugbare.',
          'Tilføj den datakilde, der oftest mangler i svarene. For de fleste webshops er det lagerstatus og marginer.',
          'Giv skriveadgang til én type ændring – typisk negative søgeord – med godkendelse på hver enkelt.',
          'Udvid først, når ændringsloggen fra den første type ser ud, som I ville have gjort det selv.',
        ],
      },
      {
        t: 'p',
        text: 'Fristelsen er at forbinde alt på én gang, fordi opsætningen er sjov og hurtig. Men værdien ligger ikke i antallet af forbindelser – den ligger i, at I stoler nok på svarene til at handle på dem.',
      },

      {
        t: 'faq',
        items: [
          {
            q: 'Hvad er forskellen på en connector og en integration?',
            a: 'I praksis det samme. »Connector« bruges typisk om en adgang, der er bygget til at blive brugt af en AI – altså hvor der også er beskrevet, hvad modellen må gøre med den, og ikke kun hvordan data flyttes.',
          },
          {
            q: 'Skal AI’en have skriveadgang for at være nyttig?',
            a: 'Nej. Meget af værdien ligger i analysen. Skriveadgang sparer tid på udførelsen, men bør altid kombineres med et godkendelsestrin.',
          },
        ],
      },
    ],
  },

  {
    slug: 'negative-soegeord-guide',
    title: 'Negative søgeord: den billigste optimering i Microsoft Advertising',
    description:
      'Negative søgeord er den hurtigste vej til lavere spild i Microsoft Ads. Her er hvordan du finder dem, hvilken match type du skal vælge, og de fejl der koster trafik.',
    date: '2026-02-11',
    category: 'Microsoft Ads',
    tags: ['Microsoft Advertising', 'Søgeord', 'Optimering', 'Budget'],
    lead: 'De fleste konti, jeg har set indefra, bruger mellem 8 og 20 % af budgettet på søgninger, der aldrig kunne være blevet til et salg. Det er ikke et strategiproblem. Det er en rapport, ingen har haft tid til at læse.',
    body: [
      { t: 'h2', id: 'hvad-de-goer', text: 'Hvad et negativt søgeord gør' },
      {
        t: 'p',
        text: 'Et negativt søgeord fortæller Microsoft Advertising, at din annonce ikke skal vises, når søgningen indeholder et bestemt ord. Det koster ikke noget at tilføje, det virker med det samme, og det kan fjernes igen.',
      },
      {
        t: 'p',
        text: 'Det er med andre ord den eneste optimering, hvor nedsiden er lille og målbar, og opsiden lander direkte på bundlinjen. Derfor er det altid dér, man skal starte.',
      },

      { t: 'h2', id: 'find-dem', text: 'Sådan finder du dem' },
      {
        t: 'p',
        text: 'Kilden er søgetermsrapporten – ikke søgeordsrapporten. Søgeord er det, du har budt på. Søgetermer er det, folk faktisk skrev. Forskellen mellem de to er der, pengene ligger.',
      },
      {
        t: 'ol',
        items: [
          'Vælg en periode på mindst 30 dage, så tallene ikke er støj.',
          'Sortér efter forbrug, faldende.',
          'Filtrér til søgetermer med 0 konverteringer.',
          'Læs ovenfra. De øverste tyve rækker er typisk halvdelen af spildet.',
        ],
      },
      {
        t: 'p',
        text: 'Du leder efter mønstre, ikke enkeltord. Hvis »brugt«, »reservedele« og »reparation« alle dukker op, sælger du nyt til nogen, der leder efter noget andet. Det er ét mønster, ikke tre fund.',
      },

      { t: 'h2', id: 'de-fire-kategorier', text: 'De fire kategorier, der går igen' },
      {
        t: 'ul',
        items: [
          'Forkert hensigt: »gratis«, »billig«, »DIY«, »selv« – nogen, der ikke vil betale for din løsning.',
          'Forkert produkt: »brugt«, »reservedele«, »leje«, »reparation« – nogen, der vil have noget andet end det, du sælger.',
          'Forkert person: »job«, »løn«, »praktik«, »uddannelse« – nogen, der leder efter arbejde, ikke en vare.',
          'Forkert fase: »hvad er«, »betyder«, »wikipedia« – nogen, der læser op på et emne og ikke er i markedet endnu.',
        ],
      },
      {
        t: 'note',
        title: 'Den sidste kategori er en fælde',
        text: 'Informationssøgninger kan være rigtig gode i toppen af tragten, hvis I rent faktisk har indhold at sende dem til. Udeluk dem i salgskampagner – ikke nødvendigvis i det hele taget.',
      },

      { t: 'h2', id: 'match-type', text: 'Hvilken match type skal du vælge?' },
      {
        t: 'p',
        text: 'Negative søgeord har tre match types, og valget mellem dem er, hvor de fleste skærer for dybt.',
      },
      {
        t: 'ul',
        items: [
          'Bredt match (broad): udelukker søgninger, der indeholder alle ordene i vilkårlig rækkefølge. Bredest, farligst.',
          'Sætningsmatch (phrase): udelukker søgninger, der indeholder ordene i den rækkefølge. Det rigtige valg i de fleste tilfælde.',
          'Eksakt match (exact): udelukker kun præcis den søgning. Brug det, når ordet også optræder i søgninger, du gerne vil have.',
        ],
      },
      {
        t: 'p',
        text: 'Tommelfingerregel: et ord, der altid er forkert for jer – fx »job« – kan stå i sætningsmatch. Et ord, der kun er forkert i en bestemt sammenhæng – fx »service«, hvis I både sælger produkter og service – skal stå i eksakt match på den konkrete søgning.',
      },

      { t: 'h2', id: 'hvor-skal-de-ligge', text: 'På kampagne- eller annoncegruppeniveau?' },
      {
        t: 'p',
        text: 'Et negativt søgeord kan ligge tre steder, og valget handler om, hvor bredt det skal gælde.',
      },
      {
        t: 'ul',
        items: [
          'På kontoen via delte lister: til ord, der aldrig er relevante for virksomheden overhovedet – »job«, »wikipedia«, konkurrenters navne I ikke må byde på.',
          'På kampagnen: til ord, der er forkerte for netop det produktområde, men fine andre steder i kontoen.',
          'På annoncegruppen: til at styre, hvilken annoncegruppe der vinder en søgning, når to grupper overlapper.',
        ],
      },
      {
        t: 'p',
        text: 'Den sidste bruges for lidt. Hvis du har en annoncegruppe for »kontorstol« og en for »ergonomisk kontorstol«, så tilføj »ergonomisk« som negativt i den generiske gruppe. Så ryger søgningen det rigtige sted hen, og du får den annoncetekst, der passer.',
      },

      { t: 'h2', id: 'maal-effekten', text: 'Mål effekten, så du ved om det virkede' },
      {
        t: 'p',
        text: 'Det er fristende at tilføje og gå videre. Men uden et tal før og efter ved du ikke, om du fjernede spild eller trafik.',
      },
      {
        t: 'ol',
        items: [
          'Notér forbrug, klik, konverteringer og konverteringsrate for de 30 dage før.',
          'Tilføj dine negative søgeord på én dag, så der er et klart skæringspunkt.',
          'Vent 14 dage, og sammenlign de samme fire tal.',
          'Det gode resultat er: forbruget falder, konverteringerne står stille eller stiger, og konverteringsraten stiger tydeligt.',
          'Hvis konverteringerne faldt mere end forbruget, har du skåret for dybt. Find ud af hvilket ord, og sæt det i eksakt match i stedet.',
        ],
      },
      {
        t: 'p',
        text: 'Det tager ti minutter at skrive tallene ned, og det er forskellen på at optimere og at håbe.',
      },

      { t: 'h2', id: 'lister', text: 'Brug lister, ikke løse ord' },
      {
        t: 'p',
        text: 'Microsoft Advertising har delte lister med negative søgeord, som kan knyttes til flere kampagner på én gang. Byg to: én med de ord, der aldrig nogensinde er relevante for virksomheden, og én pr. produktområde. Så slipper du for at vedligeholde det samme ord tolv steder.',
      },

      { t: 'h2', id: 'fejlene', text: 'De fejl, der koster trafik' },
      {
        t: 'ul',
        items: [
          'At udelukke et ord, der også står i dine egne gode søgeord. Tjek altid for overlap, før du tilføjer.',
          'At bruge bredt match på et almindeligt ord. »Pris« i bredt match kan slukke for halvdelen af dine købsklare søgninger.',
          'At tilføje hundrede ord på én gang og aldrig måle effekten. Tag tyve, se en uge, tag tyve mere.',
          'At glemme at kigge igen. Nye søgetermer dukker op hele tiden – en gang om måneden er nok, men det skal ske.',
        ],
      },
      {
        t: 'p',
        text: 'Og den vigtigste: skær ikke dybere, fordi det føles effektivt. Målet er ikke færrest mulige klik. Målet er, at de klik, du betaler for, kunne være blevet til noget.',
      },
      { t: 'h2', id: 'rytmen', text: 'En rytme, der kan holdes' },
      {
        t: 'p',
        text: 'Den største fejl er ikke en forkert match type. Det er, at det bliver gjort grundigt én gang og aldrig igen. Søgetermer er levende: nye produkter, nye konkurrenter og nye måder at formulere sig på dukker op hele tiden.',
      },
      {
        t: 'ul',
        items: [
          'En gang om måneden: læs de tyve dyreste søgetermer uden konverteringer igennem. Tager et kvarter.',
          'En gang i kvartalet: gennemgå dine delte lister for ord, der er blevet forkerte, fordi sortimentet har ændret sig.',
          'Efter hver ny kampagne: kig efter de første to uger, hvor der altid dukker overraskelser op.',
        ],
      },
      {
        t: 'p',
        text: 'Det er dét, der gør den til den billigste optimering: ikke at den er stor, men at den kan gentages uden at koste nævneværdigt.',
      },

      {
        t: 'faq',
        items: [
          {
            q: 'Hvor mange negative søgeord bør en konto have?',
            a: 'Der findes ikke et rigtigt tal. En konto med bred trafik kan have flere hundrede, en meget snæver niche kan klare sig med tyve. Kig på, hvor stor en del af forbruget der går til søgetermer uden konverteringer – det tal siger mere.',
          },
          {
            q: 'Hvor hurtigt virker det?',
            a: 'Med det samme. Udelukkelsen gælder fra næste auktion. Effekten på forbrug og konverteringsrate kan du typisk se inden for en uge.',
          },
          {
            q: 'Kan negative søgeord skade kvalitetsscoren?',
            a: 'Indirekte, og i den gode retning: ved at fjerne visninger på irrelevante søgninger stiger den gennemsnitlige klikrate, og det er en af faktorerne bag kvalitetsscoren.',
          },
        ],
      },
    ],
  },

  {
    slug: 'budget-og-roas',
    title: 'Budget og ROAS: hvornår skal du skrue op – og hvornår er det en fælde?',
    description:
      'En høj ROAS er ikke altid et signal om at skrue op. Her er de tal, der afgør det, og den rækkefølge du bør tage beslutningen i.',
    date: '2026-02-25',
    category: 'Markedsføring',
    tags: ['ROAS', 'Budget', 'Strategi', 'Måling'],
    lead: '»Kampagnen kører med ROAS 8 – skru op.« Det er det råd, alle giver, og det er rigtigt omkring halvdelen af tiden. Den anden halvdel koster penge, fordi ROAS ikke fortæller, hvad der sker med den næste krone.',
    body: [
      { t: 'h2', id: 'hvad-roas-ikke-siger', text: 'Hvad ROAS ikke siger' },
      {
        t: 'p',
        text: 'ROAS er et gennemsnit over alt, du allerede har brugt. Den siger noget om fortiden. Beslutningen om at hæve budgettet handler om fremtiden – og specifikt om den sidste krone, ikke den gennemsnitlige.',
      },
      {
        t: 'p',
        text: 'De to kan pege i hver sin retning. En kampagne med ROAS 8 kan være fuldstændig mættet: den rammer allerede alle, der søger, og den næste krone går til dårligere placeringer eller bredere søgninger. En kampagne med ROAS 3 kan have masser af uindfriet efterspørgsel.',
      },
      { t: 'quote', text: 'ROAS fortæller dig, hvad du har tjent. Impression share fortæller dig, om der er mere at hente.' },

      { t: 'h2', id: 'de-tre-tal', text: 'De tre tal, der afgør det' },
      { t: 'h3', text: '1. Impression share tabt på budget' },
      {
        t: 'p',
        text: 'Det er det tal, der direkte svarer på spørgsmålet. Hvis du taber 40 % af dine visninger, fordi budgettet løber tørt, så findes der efterspørgsel, du betaler for at ignorere. Hvis du taber 2 %, er der ikke mere at komme efter – uanset hvor flot din ROAS er.',
      },
      { t: 'h3', text: '2. Impression share tabt på rang' },
      {
        t: 'p',
        text: 'Taber du visninger på rang, er problemet ikke budgettet, men bud, kvalitetsscore eller relevans. Mere budget løser det ikke; det bruger bare de samme penge på de samme dårlige placeringer.',
      },
      { t: 'h3', text: '3. Din dækningsbidrag, ikke din omsætning' },
      {
        t: 'p',
        text: 'ROAS regnes på omsætning. Hvis dine marginer er forskellige på tværs af produkter, kan en kampagne med høj ROAS tjene færre penge end en med lav. Regn på dækningsbidrag, hvis du overhovedet kan skaffe tallene.',
      },

      { t: 'h2', id: 'raekkefoelgen', text: 'Rækkefølgen, du bør tage det i' },
      {
        t: 'ol',
        items: [
          'Fjern spildet først. Negative søgeord og pausede tabere frigør budget, du allerede har betalt for.',
          'Se på impression share tabt på budget. Er den under 10 %, så skru ikke op – flyt pengene til en anden kampagne.',
          'Hæv i spring på 15–25 %, ikke 100 %. Store spring sender algoritmen i en ny læringsfase og gør resultatet umuligt at aflæse.',
          'Vent to uger. Konverteringer kommer med forsinkelse, og den første uge efter en budgetændring lyver næsten altid.',
          'Sammenlign på samme antal dage og samme ugedage. Weekender og måneder er ikke sammenlignelige enheder.',
        ],
      },
      {
        t: 'note',
        title: 'Den skjulte omkostning ved store spring',
        text: 'En budgetstigning på over 20 % får typisk de automatiske budstrategier til at genberegne. Du betaler for læringen med et par dårlige dage – det er fint én gang, men ikke hver uge.',
      },

      { t: 'h2', id: 'marginal-roas', text: 'Den marginale ROAS – tallet, de færreste regner på' },
      {
        t: 'p',
        text: 'Du kan komme tættere på svaret med et regnestykke, der kun kræver to perioder. Tag forbrug og omsætning i den måned, hvor budgettet var lavt, og i den måned, hvor det var højere. Træk dem fra hinanden.',
      },
      {
        t: 'ul',
        items: [
          'Ekstra forbrug: 20.000 kr. − 15.000 kr. = 5.000 kr.',
          'Ekstra omsætning: 128.000 kr. − 110.000 kr. = 18.000 kr.',
          'Marginal ROAS: 18.000 / 5.000 = 3,6.',
        ],
      },
      {
        t: 'p',
        text: 'Den samlede ROAS i eksemplet er 6,4. Den marginale er 3,6. Det er den sidste, der fortæller dig, hvad den næste stigning er værd – og i det her tilfælde kan den sagtens stadig være en god forretning, men den er ikke så god, som gennemsnittet får det til at se ud.',
      },
      {
        t: 'note',
        title: 'Forbehold',
        text: 'Regnestykket forudsætter, at intet andet ændrede sig mellem de to perioder – ikke sæson, ikke priser, ikke konkurrenter. Det gør der altid. Brug det som en indikation, ikke som et facit.',
      },

      { t: 'h2', id: 'hvornaar-ned', text: 'Hvornår du skal skrue ned' },
      {
        t: 'p',
        text: 'Mindre omtalt, og mindst lige så værdifuldt. Skru ned, når impression share tabt på rang stiger samtidig med forbruget – det betyder, du køber dyrere og dårligere placeringer. Og skru ned på kampagner, der leverer konverteringer, I ikke kan honorere: udsolgte varer, services med ventetid, geografier I ikke dækker.',
      },
      {
        t: 'p',
        text: 'Det sidste fanges næsten aldrig i annonceværktøjet, fordi det kræver viden fra webshoppen eller lageret. Det er typisk dér, en connector til produktdata tjener sig hjem første gang.',
      },
      { t: 'h2', id: 'fordeling', text: 'Hvor pengene skal hen i stedet' },
      {
        t: 'p',
        text: 'Hvis en kampagne er mættet, er det ikke et argument for at bruge færre penge – det er et argument for at bruge dem et andet sted. Og der er næsten altid et andet sted.',
      },
      {
        t: 'ul',
        items: [
          'Kampagner, der taber visninger på budget, men har acceptabel ROAS. Den direkte vej.',
          'Søgeord, I har pauset for længe siden, fordi de var dyre på et tidspunkt, hvor konverteringssporingen var dårligere.',
          'Nye annoncegrupper for søgninger, I allerede får via bredt match, men ikke har en målrettet annonce til.',
          'Tidspunkter og geografier, I har skåret væk uden at måle efter.',
        ],
      },
      {
        t: 'p',
        text: 'Det er mindre tilfredsstillende end at hæve ét tal, og det tjener som regel mere.',
      },

      {
        t: 'faq',
        items: [
          {
            q: 'Hvad er en god ROAS?',
            a: 'Den, der ligger over jeres break-even. Den afhænger af dækningsbidrag og gentagne køb, ikke af et branchetal. En webshop med 20 % margin skal have ROAS over 5 for at tjene penge; en med 70 % margin kan tjene på 1,5.',
          },
          {
            q: 'Hvor længe skal jeg vente efter en budgetændring?',
            a: 'Mindst to uger, og længere hvis I har lang beslutningstid. Sammenlign først, når antallet af konverteringer i perioden er stort nok til, at tilfældigheder ikke dominerer.',
          },
        ],
      },
    ],
  },

  {
    slug: 'ai-i-markedsfoering',
    title: 'AI i markedsføring: hvad der virker i praksis, og hvad der stadig er løfter',
    description:
      'En nøgtern gennemgang af hvor AI reelt flytter noget i markedsføring i dag – og hvilke opgaver den stadig ikke bør have alene.',
    date: '2026-03-10',
    category: 'Markedsføring',
    tags: ['AI', 'Markedsføring', 'Indhold', 'Workflow'],
    lead: 'Der er to slags artikler om AI i markedsføring: dem der siger, alt bliver anderledes, og dem der siger, intet gør. Begge dele er forkerte på en måde, der ikke hjælper nogen med at beslutte, hvad de skal gøre på mandag.',
    body: [
      { t: 'h2', id: 'virker-nu', text: 'Det, der virker nu' },
      { t: 'h3', text: 'Alt, hvor opgaven er at læse meget' },
      {
        t: 'p',
        text: 'Søgetermsrapporter, anmeldelser, supporthenvendelser, konkurrenters landingssider, tre års kampagnehistorik. Mennesker er dårlige til at læse 500 sider og huske mønstret. Modeller er gode til det, og det er den mest undervurderede anvendelse i branchen.',
      },
      { t: 'h3', text: 'Varianter af noget, der allerede findes' },
      {
        t: 'p',
        text: 'Femten overskrifter til en annonce, ti versioner af en produkttekst, den samme mail i tre toner. Ikke fordi teksterne er bedre end dine – men fordi du faktisk får testet, i stedet for at skrive én og håbe.',
      },
      { t: 'h3', text: 'Oversættelse og lokalisering' },
      {
        t: 'p',
        text: 'Markant bedre end for to år siden, og god nok til annoncetekster og produktbeskrivelser med et gennemlæsning af en, der kan sproget.',
      },
      { t: 'h3', text: 'Det første udkast til en analyse' },
      {
        t: 'p',
        text: 'Ikke den færdige konklusion – men »her er de fem ting, der skiller sig ud i tallene« sparer den halve time, hvor du stirrer på et regneark og ikke ved, hvor du skal begynde.',
      },

      { t: 'h2', id: 'virker-ikke', text: 'Det, der stadig ikke virker godt nok' },
      {
        t: 'ul',
        items: [
          'Strategi. Modeller er gode til at formulere en strategi og dårlige til at vælge den, fordi de ikke kender jeres økonomi, jeres lager eller jeres tålmodighed.',
          'Budstyring i realtid. Platformenes egne algoritmer ser auktionsdata, en sprogmodel aldrig får adgang til.',
          'Indhold, der skal bære et brand. Det bliver sagligt korrekt og fuldstændig anonymt. Brug det til udkast, ikke til afsendelse.',
          'Tal, der skal være rigtige. En model, der regner i hovedet, tager fejl. Den skal hente tallet fra systemet – ikke huske det.',
        ],
      },
      {
        t: 'note',
        title: 'Den praktiske skillelinje',
        text: 'Hvis en fejl kan opdages ved at kigge på resultatet, er opgaven god til AI. Hvis en fejl først viser sig om tre uger som en lidt dårligere måned, skal der et menneske ind over.',
      },

      { t: 'h2', id: 'saadan-bygger-du-det-ind', text: 'Sådan bygger du det ind i ugen' },
      {
        t: 'ol',
        items: [
          'Vælg én tilbagevendende opgave, der tager mere end en time, og som I ikke gider. Det er næsten altid rapportlæsning.',
          'Giv AI’en adgang til de data, opgaven kræver – ikke til alt. En connector ad gangen.',
          'Lad den køre uden skriveadgang i to uger, og læs med.',
          'Giv den derefter lov til at forberede ændringer, som I godkender. Ikke til at sende dem selv.',
          'Mål én ting: hvor lang tid opgaven tager nu. Hvis den ikke er kortere, var det den forkerte opgave.',
        ],
      },

      { t: 'h2', id: 'maal-det', text: 'Hvordan du ved, om det virker' },
      {
        t: 'p',
        text: 'Det er her, de fleste AI-initiativer løber ud i sandet: der er ingen, der har besluttet, hvad succes var. »Vi bruger AI nu« er ikke et resultat.',
      },
      {
        t: 'ul',
        items: [
          'Tid: hvor lang tid tog opgaven før, og hvor lang tid tager den nu? Det eneste tal, alle kan blive enige om.',
          'Dækning: hvor stor en del af kontoen bliver nu gennemgået hver måned, mod før?',
          'Frekvens: hvor ofte bliver spørgsmålet stillet nu? Hvis det er gået fra kvartalsvis til ugentligt, er der sket noget.',
          'Fejlrate: hvor stor en andel af forslagene afviser I? Over 30 % betyder, at værktøjet mangler kontekst – ikke nødvendigvis at det er dårligt.',
        ],
      },
      {
        t: 'p',
        text: 'Den sidste er den mest nyttige i starten. En høj afvisningsrate er ikke et nederlag; det er information om, hvad værktøjet ikke ved om jeres forretning, og det kan der som regel gøres noget ved.',
      },

      { t: 'h2', id: 'faldgruber', text: 'Tre faldgruber, der går igen' },
      { t: 'h3', text: 'At starte med indhold' },
      {
        t: 'p',
        text: 'Det er det første, alle prøver, og det er det sværeste at vurdere. Du ved ikke, om en tekst er god, før den har kørt i en måned. Start med analyse, hvor svaret enten passer med tallene eller ikke gør.',
      },
      { t: 'h3', text: 'At give adgang til alt på én gang' },
      {
        t: 'p',
        text: 'Flere forbindelser gør ikke svarene bedre, hvis I ikke ved, hvilken der bidrog med hvad. Én ad gangen, og mærk efter.',
      },
      { t: 'h3', text: 'At lade værktøjet handle, før I kender dets grænser' },
      {
        t: 'p',
        text: 'Den dyre. Giv det lov til at forberede alt og udføre ingenting, indtil I har set nok forslag til at vide, hvornår det tager fejl – og hvordan det ser ud, når det gør.',
      },

      { t: 'h2', id: 'det-der-aendrer-sig', text: 'Det, der reelt ændrer sig' },
      {
        t: 'p',
        text: 'Den største forskel er ikke, at arbejdet bliver gjort af en maskine. Det er, at afstanden mellem et spørgsmål og et svar bliver kort nok til, at man begynder at spørge om ting, man før lod være med.',
      },
      {
        t: 'p',
        text: '»Hvilke søgetermer koster os penge uden at konvertere?« var altid et godt spørgsmål. Det blev bare sjældent stillet, fordi svaret tog halvanden time. Når det tager tyve sekunder, bliver det stillet hver uge – og dét er, hvor pengene ligger.',
      },
      { t: 'quote', text: 'Den store gevinst er ikke hastighed på det, du allerede gør. Det er de spørgsmål, du begynder at stille, fordi de pludselig er gratis.' },
      {
        t: 'faq',
        items: [
          {
            q: 'Erstatter AI marketingfolk?',
            a: 'Den erstatter en del af det arbejde, der aldrig blev gjort alligevel, fordi der ikke var tid. Beslutningerne, prioriteringen og ansvaret flytter sig ikke.',
          },
          {
            q: 'Hvor skal man starte, hvis man aldrig har brugt AI i markedsføring?',
            a: 'Med analyse frem for indhold. Det er lettere at vurdere, om et svar er rigtigt, end om en tekst er god – og man lærer hurtigere, hvad værktøjet kan.',
          },
        ],
      },
    ],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

/** Newest first – the order the index shows them in. */
export const postsByDate = () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
