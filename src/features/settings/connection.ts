/** The shared Claude key (stored in the workspace on Cloudflare, used by everyone in the app). */
import Anthropic from '@anthropic-ai/sdk';
import { friendlyError } from '@/ai/agent';
import { useSettings } from '@/stores/settings';
import { saveSharedKey, sharedKey } from '@/workspace/shared';

export async function saveAnthropicKey(key: string): Promise<void> {
  const k = key.trim();
  if (!k.startsWith('sk-ant-')) throw new Error('Nøglen ser forkert ud – en Claude API-nøgle starter med "sk-ant-".');
  await testAnthropicKey(k);
  await saveSharedKey('anthropic', k);
}

export async function testAnthropicKey(key?: string): Promise<string> {
  const apiKey = key ?? (await sharedKey('anthropic'));
  if (!apiKey) throw new Error('Der er ingen nøgle at teste.');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const model = await client.models.retrieve(useSettings.getState().ai.model);
    return model.display_name;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function removeAnthropicKey() {
  await saveSharedKey('anthropic', null);
}
