import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AnyTool } from './context';
import { displayTools } from './display';
export { TERMINAL_TOOLS } from './display';
import { readTools } from './read';
import { writeTools } from './write';

export const ALL_TOOLS: AnyTool[] = [...readTools, ...writeTools, ...displayTools];

const byName = new Map(ALL_TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): AnyTool | undefined {
  return byName.get(name);
}

/** Tool definitions for the Messages API (stable order keeps the prompt cache warm). */
export function toolDefinitions(tools: AnyTool[] = ALL_TOOLS): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(t.schema, { io: 'input' }) as Record<string, unknown>;
    void _ignored;
    return {
      name: t.name,
      description: t.description,
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      // Streaming request: tool input streams as it is generated; the agent validates it with zod.
      eager_input_streaming: true,
    };
  });
}

export type { AnyTool, ToolContext, ToolOutput, PlannedChange } from './context';
