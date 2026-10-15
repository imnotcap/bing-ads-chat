/**
 * Connectors: the data sources and abilities the assistant may use in a chat.
 * Switched on/off in the chat field (like Claude's "Search and tools"); a disabled
 * connector's tools are left out of the request entirely, and the assistant is told
 * so it can say what to switch on.
 */
import { BarChart3, Globe, PenLine, Search, Terminal, type LucideIcon } from 'lucide-react';
import type { AnyTool } from './tools/context';
import { ALL_TOOLS } from './tools';

export type ConnectorId = 'msads_read' | 'msads_write' | 'msads_api' | 'visuals' | 'web';

export interface Connector {
  id: ConnectorId;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultOn: boolean;
  /** Only some AI providers can do it (web search is a Claude server tool). */
  providers?: ('anthropic' | 'google')[];
}

export const CONNECTORS: Connector[] = [
  { id: 'msads_read', label: 'Microsoft Advertising · data', description: 'Kampagner, søgeord, rapporter og forbrug', icon: Search, defaultOn: true },
  { id: 'msads_write', label: 'Microsoft Advertising · ændringer', description: 'Budgetter, bud, søgeord, annoncer – efter dine forbrugsregler', icon: PenLine, defaultOn: true },
  { id: 'msads_api', label: 'Avanceret API-adgang', description: 'Direkte kald til Microsoft Advertising REST API (kræver altid godkendelse)', icon: Terminal, defaultOn: true },
  { id: 'visuals', label: 'Grafer og tabeller', description: 'Nøgletal, grafer og tabeller i svarene', icon: BarChart3, defaultOn: true },
  { id: 'web', label: 'Websøgning', description: 'Søg på nettet, fx konkurrenter og trends (koster ekstra pr. søgning)', icon: Globe, defaultOn: false, providers: ['anthropic'] },
];

const DISPLAY_ALWAYS = new Set(['suggest_next_steps']);

/** Which connector a tool belongs to (null = always available). */
export function connectorOf(tool: AnyTool): ConnectorId | null {
  if (tool.name === 'microsoft_ads_api') return 'msads_api';
  if (tool.kind === 'write') return 'msads_write';
  if (tool.kind === 'display') return DISPLAY_ALWAYS.has(tool.name) ? null : 'visuals';
  return 'msads_read';
}

export function isConnectorOn(state: Partial<Record<ConnectorId, boolean>>, id: ConnectorId): boolean {
  return state[id] ?? CONNECTORS.find((c) => c.id === id)!.defaultOn;
}

export function enabledTools(state: Partial<Record<ConnectorId, boolean>>): AnyTool[] {
  return ALL_TOOLS.filter((t) => {
    const c = connectorOf(t);
    return c === null || isConnectorOn(state, c);
  });
}

/** Line for the context block, so the assistant knows what is switched off. */
export function connectorContext(state: Partial<Record<ConnectorId, boolean>>, provider: 'anthropic' | 'google'): string {
  const off = CONNECTORS.filter((c) => !isConnectorOn(state, c.id) || (c.providers && !c.providers.includes(provider)));
  if (!off.length) return 'Connectors: all on.';
  return `Connectors switched OFF by the user (their tools are unavailable – don't try to work around it; if one is needed, say which to switch on under the connectors button in the chat field): ${off.map((c) => c.label).join('; ')}.`;
}
