/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_BASE_URL?: string;
  /** Built-in Microsoft Advertising app credentials (optional, see src/bing/credentials.ts). */
  readonly VITE_MS_CLIENT_ID?: string;
  readonly VITE_MS_DEVELOPER_TOKEN?: string;
}
