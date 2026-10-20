#!/usr/bin/env node
/**
 * A scripted stand-in for the Claude API on :8790, used only by scripts/record-site-media.mjs
 * to record the website's clips: each scenario is a list of turns (text streamed word by
 * word, then optionally one tool call that the app runs against its demo data).
 * MOCK_MS = delay between words.
 */
import http from 'node:http';
const MS = Number(process.env.MOCK_MS ?? 38);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const FOLLOW_UP = {
    match: /opfølgning|følg op/i,
    turns: [
      {
        text: 'Det sætter jeg op til om 14 dage, med en tjekliste til gennemgangen.',
        tool: [
          'schedule_follow_up',
          {
            title: 'Tjek effekten af negative søgeord – Konkurrenter',
            description: 'Sammenlign forbrug, CPA og konverteringer med ugen før ændringen.',
            date: day(14),
            time: '09:00',
            checklist: ['Sammenlign CPA før/efter', 'Gennemgå nye søgetermer', 'Justér budgettet'],
          },
        ],
      },
      { text: 'Opfølgningen er klar – klik **Opret opfølgning**, så lægger jeg den i din planlægning.' },
      { text: 'Klaret. Påmindelsen ligger i din Outlook, og kortet er i din planlægning.' },
    ],
  };

const SCENARIOS = [
  FOLLOW_UP,
  {
    match: /hvordan går/i,
    turns: [
      { text: 'Jeg henter tallene for de sidste 30 dage og sammenligner med perioden før.', tool: ['get_performance_overview', { period: 'last30' }] },
      {
        text: `**Kort fortalt:** Kontoen leverer flere konverteringer til en lavere pris – men to kampagner trækker ned.

| Kampagne | Udvikling | Hvad jeg ser |
|---|---|---|
| Kontorstole – Generisk | ▲ 18 % konv. | Bedste ROAS – begrænset af budget efter kl. 15 |
| Hæve-sænkeborde | ▲ 9 % konv. | Stabil, CPA under målet på 350 kr. |
| Konkurrenter | ▼ 31 % konv. | Dyre klik på brede søgetermer uden køb |

**Mit forslag:** Flyt 150 kr. om dagen fra *Konkurrenter* til *Kontorstole – Generisk*, og tilføj negative søgeord på de brede søgetermer.`,
        tool: [
          'suggest_next_steps',
          {
            question: 'Skal jeg gå videre med det?',
            suggestions: [
              { label: 'Hæv budgettet på Kontorstole med 150 kr.', prompt: 'Hæv dagsbudgettet på Kontorstole – Generisk med 150 kr.', primary: true },
              { label: 'Find negative søgeord i Konkurrenter', prompt: 'Find negative søgeord i Konkurrenter' },
              { label: 'Vis søgetermerne', prompt: 'Vis søgetermerne for Konkurrenter' },
            ],
          },
        ],
      },
      { text: '' },
    ],
  },
  {
    match: /negativ/i,
    turns: [
      { text: 'Jeg kigger søgetermerne fra de sidste 30 dage igennem for kampagnen.', tool: ['run_report', { kind: 'searchterm', period: 'last30', onlyWithoutConversions: true, limit: 40 }] },
      { proposeNegatives: true },
      { text: 'Negative søgeord er tilføjet. Jeg følger op på forbruget om en uge.' },
    ],
  },
  {
    match: /annonce/i,
    turns: [
      {
        text: 'Jeg skriver en ny responsiv søgeannonce til **Ergonomiske kontorstole** med søgeordet som første overskrift.',
        tool: [
          'create_responsive_search_ad',
          {
            campaignId: '102',
            adGroupId: '1020',
            keywordHeadline: '{KeyWord:Ergonomiske kontorstole}',
            headlines: ['Kontorstole med 5 års garanti', 'Fri fragt over 500 kr.', 'Lagerregal og kontorstole', 'Prøv stolen i 30 dage'],
            headlinePins: ['', '2'],
            descriptions: ['Find den ergonomiske kontorstol, der passer til din arbejdsdag.', 'Levering på 1–3 dage og 30 dages returret.'],
            finalUrl: 'https://nordlys-interior.dk/kontorstole',
            reason: 'Ny annonce med søgeordet som overskrift 1 og garantien fastgjort som nr. 2.',
          },
        ],
      },
      { text: 'Annoncen er oprettet og sendt til godkendelse hos Microsoft.' },
    ],
  },
  {
    match: /budget/i,
    turns: [
      {
        text: 'Kontorstole – Generisk har ramt budgettet før kl. 15 hver dag i to uger. Jeg foreslår at hæve dagsbudgettet fra 1.200 til 1.350 kr.',
        tool: ['update_campaigns', { changes: [{ campaignId: '102', dailyBudget: 1350 }], reason: 'Kampagnen er begrænset af budget og har kontoens bedste ROAS.' }],
      },
      { text: 'Budgettet er hævet til 1.350 kr. om dagen. Jeg holder øje med CPA de næste dage.' },
    ],
  },
];

function rowsOf(results) {
  const raw = results[0]?.content;
  const txt = typeof raw === 'string' ? raw : (raw ?? []).map((b) => b.text ?? '').join('');
  try {
    return JSON.parse(txt).rows ?? [];
  } catch {
    return [];
  }
}

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.end();
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const j = JSON.parse(body || '{}');
      // The proofreader (structured output, not streamed): the fixed word list is enough here.
      if (j.output_config?.format || !j.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: 'msg_p', type: 'message', role: 'assistant', model: j.model, content: [{ type: 'text', text: '{"issues":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
      }
      const msgs = j.messages ?? [];
      const textOf = (m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === 'text').map((b) => b.text).join(' ') : String(m.content));
      // The newest typed message starts the scenario; count assistant turns since then.
      let start = msgs.length - 1;
      while (start > 0 && !(msgs[start].role === 'user' && textOf(msgs[start]).trim())) start--;
      const first = textOf(msgs[start] ?? { content: '' });
      const step = msgs.slice(start).filter((m) => m.role === 'assistant').length;
      const last = msgs.at(-1);
      const results = Array.isArray(last?.content) ? last.content.filter((b) => b.type === 'tool_result') : [];
      const scenario = SCENARIOS.find((s) => s.match.test(first));
      let turn = scenario?.turns[Math.min(step, scenario.turns.length - 1)] ?? { text: 'Det kan jeg hjælpe med.' };
      if (turn.proposeNegatives) {
        const all = rowsOf(results);
        const rows = all.filter((r) => r.campaignId === all[0]?.campaignId).slice(0, 9);
        const whys = ['Jobsøgning – ikke købsintention', 'Leder efter gratis/brugt', 'Forbrug uden konverteringer', 'Gør-det-selv – ikke kunde', 'Forkert produkt'];
        turn = {
          text: `Jeg har fundet **${rows.length} søgetermer** med forbrug, men uden et eneste køb. Vælg dem, du vil udelukke:`,
          tool: ['propose_negative_keywords', { reason: 'Søgetermer fra de sidste 30 dage med forbrug, men ingen konverteringer.', campaignId: rows[0]?.campaignId, candidates: rows.map((r, i) => ({ text: r.searchTerm, matchType: i % 3 ? 'Exact' : 'Phrase', clicks: r.clicks, spend: r.spend, conversions: r.conversions ?? 0, why: whys[i % whys.length] })) }],
        };
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      send('message_start', { type: 'message_start', message: { id: 'msg_' + Date.now(), type: 'message', role: 'assistant', model: j.model, content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 1 } } });
      const words = (turn.text ?? '').split(/(?<= )/).filter(Boolean);
      let i = 0;
      let index = 0;
      if (words.length) send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      const finish = () => {
        if (words.length) send('content_block_stop', { type: 'content_block_stop', index: index++ });
        if (turn.tool) {
          send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: 'toolu_' + Date.now(), name: turn.tool[0], input: {} } });
          send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(turn.tool[1]) } });
          send('content_block_stop', { type: 'content_block_stop', index });
        }
        send('message_delta', { type: 'message_delta', delta: { stop_reason: turn.tool ? 'tool_use' : 'end_turn' }, usage: { output_tokens: 50 } });
        send('message_stop', { type: 'message_stop' });
        res.end();
      };
      const t = setInterval(() => {
        if (res.destroyed) return clearInterval(t);
        if (i < words.length) send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: words[i++] } });
        else {
          clearInterval(t);
          setTimeout(finish, 250);
        }
      }, MS);
      res.on('close', () => clearInterval(t));
    });
  })
  .listen(8790, () => console.log('site mock on 8790'));
