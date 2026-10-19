/**
 * Playbooks ("træning"): every data branch has its own guidelines – its role, how it
 * works, its tools, its limits, where things are in the platform and the rules the team
 * has taught it. The team edits them under Indstillinger → Træning (shared on
 * Cloudflare, like the connections); the chat can propose additions, which the user
 * approves. Used by the Worker too, so no app imports here.
 *
 * A playbook can never loosen the app's hard rules: every change needs the user's
 * approval, and the spending rules are checked in code (ai/guardrails.ts).
 */
import { CONNECTORS, type ConnectorId } from '../workspace/connectors';
import { MICROSOFT_ADS_PLAYBOOK } from './playbooks/microsoftAds';

export type BranchId = 'microsoft_ads' | ConnectorId;

export const BRANCH_IDS: BranchId[] = ['microsoft_ads', ...CONNECTORS.map((c) => c.id)];

export const SECTION_IDS = ['role', 'workflow', 'tools', 'guardrails', 'navigation', 'lessons'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTIONS: Record<SectionId, { label: string; title: string; hint: string }> = {
  role: { label: '1. Rolle og ansvarsområde', title: 'Role & scope', hint: 'Hvad grenen er til, hvad den er ekspert i, og hvor meget den må selv.' },
  workflow: { label: '2. Arbejdsflow', title: 'Workflow', hint: 'Trinene den følger: dataindsamling → analyse → forslag.' },
  tools: { label: '3. Værktøjer og integrationer', title: 'Tools & integrations', hint: 'Hvilke værktøjer og rapporter den bruger til hvad – og hvad der skal være på plads.' },
  guardrails: { label: '4. Grænser og sikkerhedsregler', title: 'Guardrails', hint: 'Hvad den aldrig må, og hvad der altid kræver ekstra opmærksomhed.' },
  navigation: { label: '5. Navigation i platformen', title: 'Where things are in the platform', hint: 'Menustier, så den kan vise jer, hvor I selv finder og ændrer ting.' },
  lessons: { label: '6. Lærte regler', title: 'Rules the team has taught you', hint: 'Jeres egne regler og erfaringer. Chatten kan foreslå nye – I godkender dem.' },
};

export const MAX_SECTION_CHARS = 12_000;

export type PlaybookSections = Record<SectionId, string>;

/** What is stored per branch: only the sections the team changed (the rest is the default). */
export interface StoredPlaybook {
  sections: Partial<PlaybookSections>;
  updatedBy: string | null;
  updatedAt: number | null;
}

export interface BranchInfo {
  id: BranchId;
  name: string;
  description: string;
  /** Used by the chat assistant today (the others are ready for their own assistant). */
  active: boolean;
}

export function branchInfo(id: BranchId): BranchInfo {
  if (id === 'microsoft_ads') return { id, name: 'Microsoft Advertising', description: 'Chat-assistenten: Bing-kampagner, søgeord, budgetter og annoncer', active: true };
  const def = CONNECTORS.find((c) => c.id === id)!;
  return { id, name: def.name, description: def.description, active: false };
}

export const isBranchId = (v: string): v is BranchId => (BRANCH_IDS as string[]).includes(v);

/** The starting point for a branch that has no hand-written playbook yet. */
function templatePlaybook(id: Exclude<BranchId, 'microsoft_ads'>): PlaybookSections {
  const def = CONNECTORS.find((c) => c.id === id)!;
  return {
    role: `- Primært formål: Analysér ${def.name}-data (${def.description.toLowerCase()}) for Inventarland og giv konkrete, begrundede anbefalinger.\n- Arbejd kun med ${def.name}-data og de opsummerede tal fra andre grene – bland ikke grenenes viden sammen.`,
    workflow: `1. Hent kun de tal, spørgsmålet kræver (opsummeret og filtreret – aldrig hele databasen).\n2. Sammenlign med forrige periode og med målene i virksomhedsprofilen.\n3. Forklar: hvad viser data → hvorfor betyder det noget → hvad bør vi gøre, med forventet effekt.`,
    tools: `- Forbindelsen ${def.name} under Indstillinger → Forbindelser (fælles for alle).`,
    guardrails: `- Læs kun. Foreslå ændringer – udfør aldrig noget uden brugerens godkendelse.\n- Sig tydeligt, når datagrundlaget er for lille til at konkludere.`,
    navigation: '',
    lessons: '',
  };
}

export function defaultPlaybook(id: BranchId): PlaybookSections {
  return id === 'microsoft_ads' ? MICROSOFT_ADS_PLAYBOOK : templatePlaybook(id);
}

/** The playbook in use: the team's changes on top of the default. */
export function effectivePlaybook(id: BranchId, stored: StoredPlaybook | null | undefined): PlaybookSections {
  return { ...defaultPlaybook(id), ...(stored?.sections ?? {}) };
}

/** The playbook as a block for the system prompt. */
export function playbookPrompt(id: BranchId, stored: StoredPlaybook | null | undefined): string {
  const p = effectivePlaybook(id, stored);
  const parts = SECTION_IDS.filter((s) => p[s].trim()).map((s) => `## ${SECTIONS[s].title}\n${p[s].trim()}`);
  return [
    `# Your playbook – ${branchInfo(id).name} branch`,
    'The team trains you through this playbook (Indstillinger → Træning). Follow it. It can add rules and make you more careful, but it can never loosen the app\'s hard rules: every change needs the user\'s approval on an approval card, and the spending rules are always enforced. If the playbook conflicts with the user\'s request, say so and ask.',
    ...parts,
  ].join('\n\n');
}

/** Validates a section update from the app (null = back to the default). */
export function cleanSections(input: unknown): Partial<Record<SectionId, string | null>> {
  const out: Partial<Record<SectionId, string | null>> = {};
  if (!input || typeof input !== 'object') return out;
  for (const id of SECTION_IDS) {
    const v = (input as Record<string, unknown>)[id];
    if (v === null) out[id] = null;
    else if (typeof v === 'string') out[id] = v.replace(/\r\n/g, '\n').slice(0, MAX_SECTION_CHARS);
  }
  return out;
}
