/**
 * BaseAgent — the foundation for all Claude agents in this boilerplate.
 *
 * Features:
 * - Automatic tool use loop (handles multi-turn tool calling)
 * - Streaming support (optional)
 * - Conversation memory
 * - Token usage tracking
 * - Configurable models and parameters
 * - Proper error handling
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import { logger } from '../lib/logger.js';
import { ConversationMemory } from '../memory/conversation-memory.js';
import type { AgentTool, AgentConfig, AgentRunResult } from '../types.js';

const DEFAULT_CONFIG: Required<AgentConfig> = {
  model: 'claude-opus-5',
  maxTokens: 4096,
  maxToolRounds: 10,
  systemPrompt: 'You are a helpful AI assistant.',
  temperature: 1, // Anthropic recommends 1 for tool use
};

export class BaseAgent {
  protected readonly client: Anthropic;
  protected readonly config: Required<AgentConfig>;
  protected readonly tools: AgentTool[];
  protected readonly memory: ConversationMemory;

  constructor(
    tools: AgentTool[] = [],
    config: AgentConfig = {},
    memory?: ConversationMemory
  ) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tools = tools;
    this.memory = memory ?? new ConversationMemory();
  }

  /**
   * Run the agent with a user message.
   * Handles the full tool-use loop automatically.
   */
  async run(userMessage: string): Promise<AgentRunResult> {
    logger.info('Agent run started', { model: this.config.model });

    // Add user message to memory
    this.memory.addUserMessage(userMessage);

    const anthropicTools: Tool[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let rounds = 0;

    while (rounds < this.config.maxToolRounds) {
      rounds++;

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: this.config.systemPrompt,
        messages: this.memory.getMessages(),
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        temperature: this.config.temperature,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      logger.debug('API response', {
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      // Add assistant response to memory
      this.memory.addAssistantMessage(response.content);

      // Done — no more tool calls
      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('\n');

        logger.info('Agent run complete', {
          rounds,
          totalInputTokens,
          totalOutputTokens,
        });

        return {
          text,
          messages: this.memory.getMessages(),
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          rounds,
        };
      }

      // Handle tool use
      if (response.stop_reason === 'tool_use') {
        const toolResults = await this.executeTools(response.content);
        this.memory.addToolResults(toolResults);
        continue;
      }

      // Unexpected stop reason
      logger.warn('Unexpected stop reason', { stopReason: response.stop_reason });
      break;
    }

    throw new Error(
      `Agent exceeded max tool rounds (${this.config.maxToolRounds}). ` +
        'Consider increasing maxToolRounds or simplifying the task.'
    );
  }

  /**
   * Run with streaming — yields text chunks as they arrive.
   */
  async *stream(userMessage: string): AsyncGenerator<string> {
    this.memory.addUserMessage(userMessage);

    const anthropicTools: Tool[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const stream = await this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: this.config.systemPrompt,
      messages: this.memory.getMessages(),
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }

    const finalMessage = await stream.finalMessage();
    this.memory.addAssistantMessage(finalMessage.content);
  }

  /**
   * Execute all tool calls in a response.
   */
  private async executeTools(
    content: Anthropic.Messages.ContentBlock[]
  ): Promise<Anthropic.Messages.ToolResultBlockParam[]> {
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[];

    return Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        logger.info(`Executing tool: ${toolUse.name}`, { input: toolUse.input });

        const tool = this.tools.find((t) => t.name === toolUse.name);
        if (!tool) {
          logger.error(`Unknown tool called: ${toolUse.name}`);
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: `Error: Unknown tool "${toolUse.name}"`,
            is_error: true,
          };
        }

        try {
          const result = await tool.execute(toolUse.input as Record<string, unknown>);
          logger.debug(`Tool ${toolUse.name} completed`, { result: String(result).slice(0, 200) });
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`Tool ${toolUse.name} failed`, { error: message });
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: `Error executing ${toolUse.name}: ${message}`,
            is_error: true,
          };
        }
      })
    );
  }

  /** Reset conversation memory */
  reset() {
    this.memory.clear();
  }

  /** Get current memory state */
  getHistory() {
    return this.memory.getMessages();
  }
}
