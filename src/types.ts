import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (input: Record<string, unknown>) => Promise<string | object>;
}

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  maxToolRounds?: number;
  systemPrompt?: string;
  temperature?: number;
}

export interface AgentRunResult {
  text: string;
  messages: MessageParam[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  rounds: number;
}
