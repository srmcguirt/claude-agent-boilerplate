/**
 * Tool-use loop and memory window tests.
 *
 * The Anthropic client is mocked at the module boundary, so these run with no
 * API key and no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock, stream: vi.fn() };
  },
}));

const { BaseAgent } = await import('./base-agent.js');
const { ConversationMemory } = await import('../memory/conversation-memory.js');

/** Minimal stand-ins for the SDK response shapes the loop actually reads. */
const textReply = (text: string) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
  usage: { input_tokens: 10, output_tokens: 5 },
});

const toolReply = (name: string, input: unknown, id = 'toolu_1') => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name, input }],
  usage: { input_tokens: 20, output_tokens: 8 },
});

const echoTool = {
  name: 'echo',
  description: 'Echo the input back',
  inputSchema: { type: 'object' as const, properties: { value: { type: 'string' } } },
  // Signature must match AgentTool.execute, which receives an unvalidated
  // Record straight from the model.
  execute: vi.fn(async (input: Record<string, unknown>) => String(input.value)),
};

beforeEach(() => {
  createMock.mockReset();
  echoTool.execute.mockClear();
});

describe('BaseAgent tool-use loop', () => {
  it('returns assistant text and stops after one round when no tool is called', async () => {
    createMock.mockResolvedValueOnce(textReply('hello there'));

    const result = await new BaseAgent([], { systemPrompt: 'test' }).run('hi');

    expect(result.text).toBe('hello there');
    expect(result.rounds).toBe(1);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('executes a tool then continues to a final answer', async () => {
    createMock
      .mockResolvedValueOnce(toolReply('echo', { value: 'ping' }))
      .mockResolvedValueOnce(textReply('done: ping'));

    const result = await new BaseAgent([echoTool]).run('echo ping');

    expect(echoTool.execute).toHaveBeenCalledWith({ value: 'ping' });
    expect(result.text).toBe('done: ping');
    expect(result.rounds).toBe(2);
  });

  it('accumulates token usage across every round', async () => {
    createMock
      .mockResolvedValueOnce(toolReply('echo', { value: 'x' }))
      .mockResolvedValueOnce(textReply('ok'));

    const result = await new BaseAgent([echoTool]).run('go');

    // 20 + 10 in, 8 + 5 out
    expect(result.usage.inputTokens).toBe(30);
    expect(result.usage.outputTokens).toBe(13);
  });

  it('throws rather than looping forever when maxToolRounds is exhausted', async () => {
    createMock.mockResolvedValue(toolReply('echo', { value: 'again' }));

    await expect(
      new BaseAgent([echoTool], { maxToolRounds: 3 }).run('loop')
    ).rejects.toThrow(/exceeded max tool rounds \(3\)/);

    expect(createMock).toHaveBeenCalledTimes(3);
  });
});

describe('ConversationMemory sliding window', () => {
  it('keeps only the most recent maxMessages entries', () => {
    const memory = new ConversationMemory({ maxMessages: 4 });
    for (let i = 0; i < 10; i++) memory.addUserMessage(`m${i}`);

    expect(memory.length).toBe(4);
    expect(memory.getMessages()[0]).toEqual({ role: 'user', content: 'm6' });
  });

  it('never leaves an orphaned tool_result at the window start', () => {
    // Regression: trimming used to strip the assistant tool_use message while
    // keeping the user tool_result that answered it, which the API rejects.
    // The orphan only appears once the window slides past the pair, so this
    // needs the fourth message to push it over.
    const memory = new ConversationMemory({ maxMessages: 2 });

    memory.addUserMessage('do the thing');
    memory.addAssistantMessage([
      { type: 'tool_use', id: 'toolu_1', name: 'echo', input: {} },
    ] as never);
    memory.addToolResults([
      { type: 'tool_result', tool_use_id: 'toolu_1', content: 'result' },
    ] as never);
    memory.addAssistantMessage([{ type: 'text', text: 'all done' }] as never);

    const first = memory.getMessages()[0] as MessageParam | undefined;
    const leadsWithToolResult =
      first?.role === 'user' &&
      Array.isArray(first.content) &&
      first.content.some((b) => (b as { type?: string }).type === 'tool_result');

    expect(leadsWithToolResult).toBe(false);
  });

  it('round-trips through JSON', () => {
    const memory = new ConversationMemory();
    memory.addUserMessage('remember me');

    const restored = ConversationMemory.fromJSON(memory.toJSON());

    expect(restored.getMessages()).toEqual(memory.getMessages());
  });

  it('clear() empties the window', () => {
    const memory = new ConversationMemory();
    memory.addUserMessage('a');
    memory.clear();
    expect(memory.length).toBe(0);
  });
});
