import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectorId } from '@/ai/connectors';
import type { Effort, ModelId, ModelInfo } from '@/ai/models';
import type { DatePreset } from '@/lib/format';
import { DEFAULT_LIMITS, type BranchLimits } from '@/ai/branchLimits';

/**
 * Microsoft Advertising's budget and limits – a local mirror of the shared branch limits
 * (src/ai/branchLimits.ts, Indstillinger → Budget og grænser), so the guardrails, the
 * budget watch and the insights keep working offline. Every change needs the user's
 * approval on an approval card – there is no mode where the assistant acts on its own.
 */
export type SpendRules = BranchLimits;

export interface AiSettings {
  model: ModelId;
  effort: Effort;
  showThinking: boolean;
  /** Monthly cap for Claude API usage in USD; sending is blocked when reached. */
  monthlyAiBudgetUsd: number | null;
  usdToDkk: number;
  maxToolRounds: number;
  /** Models users may pick (set by the admin). Empty = all. */
  enabledModels: ModelId[];
  /** Gemini models added by the admin (with their prices). */
  customModels: ModelInfo[];
  /** Connectors switched on/off in the chat field. */
  connectors: Partial<Record<ConnectorId, boolean>>;
  /** Offer a follow-up (planning card + Outlook reminder) after the assistant changes something. */
  followUps: boolean;
  /** Also add follow-ups to the Outlook calendar (pre-ticked on the follow-up card). */
  followUpOutlook: boolean;
  /** Also mail follow-ups to the signed-in user (pre-ticked on the follow-up card). */
  followUpMail: boolean;
}

export interface BusinessProfile {
  companyName: string;
  website: string;
  description: string;
  targetCpa: number | null;
  targetRoas: number | null;
  grossMarginPct: number | null;
  toneOfVoice: string;
  instructions: string;
}

export interface Appearance {
  animations: 'system' | 'full' | 'reduced';
  clickSpark: boolean;
  insightsPanel: boolean;
  /** Which sections of the insights panel are expanded. */
  insightSections: Record<string, boolean>;
  sidebarCollapsed: boolean;
  /** Closing the window keeps the app running in the system tray. */
  closeToTray: boolean;
  /** Dashboard sidebar: collapsed categories. */
  navCollapsed: Record<string, boolean>;
  /** Dashboard sidebar: categories hidden with the eye (e.g. Paid for the SEO team). */
  navHidden: string[];
  /** Planning board cards: compact (text and icons) or detailed (description, checklist, people). */
  boardCards: 'simple' | 'detailed';
}

export const DEFAULT_SPEND_RULES: SpendRules = DEFAULT_LIMITS;

interface SettingsState {
  spend: SpendRules;
  ai: AiSettings;
  business: BusinessProfile;
  appearance: Appearance;
  datePreset: DatePreset;
  onboarded: boolean;
  setSpend: (patch: Partial<SpendRules>) => void;
  setAi: (patch: Partial<AiSettings>) => void;
  setBusiness: (patch: Partial<BusinessProfile>) => void;
  setAppearance: (patch: Partial<Appearance>) => void;
  setDatePreset: (p: DatePreset) => void;
  setOnboarded: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      spend: DEFAULT_SPEND_RULES,
      ai: { model: 'claude-opus-5-5', effort: 'medium', showThinking: true, monthlyAiBudgetUsd: 25, usdToDkk: 6.9, maxToolRounds: 30, enabledModels: [], customModels: [], connectors: {}, followUps: true, followUpOutlook: true, followUpMail: true },
      business: {
        companyName: '',
        website: '',
        description: '',
        targetCpa: null,
        targetRoas: null,
        grossMarginPct: null,
        toneOfVoice: '',
        instructions: '',
      },
      appearance: {
        animations: 'full',
        clickSpark: false,
        insightsPanel: true,
        insightSections: { kpis: true, budget: true, alerts: true, campaigns: false },
        sidebarCollapsed: false,
        closeToTray: true,
        navCollapsed: {},
        navHidden: [],
        boardCards: 'detailed',
      },
      datePreset: 'last30',
      onboarded: false,
      setSpend: (patch) => set((s) => ({ spend: { ...s.spend, ...patch } })),
      setAi: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),
      setBusiness: (patch) => set((s) => ({ business: { ...s.business, ...patch } })),
      setAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),
      setDatePreset: (datePreset) => set({ datePreset }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    {
      name: 'bac.settings',
      version: 3,
      // v2: simpler design – click sparks are opt-in.
      // v3: the aurora background is gone, and animations no longer follow Windows by
      //     default (with Windows' animation effects off the orb and ASCII stood still).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2 && p.appearance) p.appearance = { ...p.appearance, clickSpark: false };
        if (version < 3 && p.appearance) {
          const { auroraBackground: _removed, ...appearance } = p.appearance as SettingsState['appearance'] & { auroraBackground?: boolean };
          p.appearance = { ...appearance, animations: appearance.animations === 'reduced' ? 'reduced' : 'full' };
        }
        return p as SettingsState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          spend: { ...current.spend, ...p.spend },
          ai: { ...current.ai, ...p.ai },
          business: { ...current.business, ...p.business },
          appearance: { ...current.appearance, ...p.appearance },
        };
      },
    },
  ),
);
