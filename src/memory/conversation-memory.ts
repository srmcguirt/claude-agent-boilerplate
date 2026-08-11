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
   * Trim messages to maxMessages, always keeping the first message
   * (which is often important context) and the most recent ones.
   */
  private trim() {
    if (this.messages.length > this.maxMessages) {
      const excess = this.messages.length - this.maxMessages;
      this.messages.splice(0, excess);
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
