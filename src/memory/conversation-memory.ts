/**
 * Conversation memory — manages message history for multi-turn Claude conversations.
 *
 * Features:
 * - Sliding window to prevent context overflow
 * - System message handling
 * - Tool result injection
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';

export interface ConversationMemoryOptions {
  maxMessages?: number; // Max messages to keep (default: 50, ~25 turns)
}

/** A user message carrying tool_result blocks is only valid directly after the
 *  assistant message whose tool_use blocks it answers. */
function startsWithToolResult(message: MessageParam): boolean {
  return (
    message.role === 'user' &&
    Array.isArray(message.content) &&
    message.content.some((block) => (block as { type?: string }).type === 'tool_result')
  );
}

export class ConversationMemory {
  private messages: MessageParam[] = [];
  private readonly maxMessages: number;

  constructor(options: ConversationMemoryOptions = {}) {
    this.maxMessages = options.maxMessages ?? 50;
  }

  addUserMessage(content: string) {
    this.messages.push({ role: 'user', content });
    this.trim();
  }

  addAssistantMessage(content: Anthropic.Messages.ContentBlock[]) {
    this.messages.push({ role: 'assistant', content });
    this.trim();
  }

  addToolResults(results: Anthropic.Messages.ToolResultBlockParam[]) {
    this.messages.push({ role: 'user', content: results });
    this.trim();
  }

  getMessages(): MessageParam[] {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
  }

  get length() {
    return this.messages.length;
  }

  /**
   * Trim to maxMessages by dropping the oldest messages.
   *
   * The window can never open on a tool_result: the matching tool_use block
   * lives in the assistant message immediately before it, so if that message
   * gets dropped the API rejects the request with "unexpected tool_result".
   * Keep discarding from the front until the leading message is safe.
   */
  private trim() {
    if (this.messages.length <= this.maxMessages) return;

    this.messages.splice(0, this.messages.length - this.maxMessages);

    while (this.messages.length > 0 && startsWithToolResult(this.messages[0])) {
      this.messages.shift();
    }
  }

  /**
   * Export conversation to JSON for persistence
   */
  toJSON() {
    return JSON.stringify(this.messages);
  }

  /**
   * Import conversation from JSON
   */
  static fromJSON(json: string, options?: ConversationMemoryOptions): ConversationMemory {
    const memory = new ConversationMemory(options);
    memory.messages = JSON.parse(json) as MessageParam[];
    return memory;
  }
}
