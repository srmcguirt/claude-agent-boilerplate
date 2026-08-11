# 🤖 Claude Agent Boilerplate

**Production-ready Claude agent starter** — tool calling, streaming, multi-turn memory, and MCP client wiring. Ship a working AI agent in minutes.

[![npm version](https://img.shields.io/npm/v/@aipackages/claude-agent-boilerplate.svg)](https://www.npmjs.com/package/@aipackages/claude-agent-boilerplate)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 💎 **Premium edition** with multi-agent orchestration, MCP client integration, FastAPI wrapper, and 6 real-world examples → [Get it on Gumroad →](https://gumroad.com)

---

## Features

| Feature | Status |
|---------|--------|
| Tool use loop (handles multi-turn tool calling automatically) | ✅ |
| Streaming responses | ✅ |
| Conversation memory with sliding window | ✅ |
| Input validation (Zod) | ✅ |
| Token usage tracking | ✅ |
| Structured logging | ✅ |
| Example tool: web search | ✅ |
| Multi-agent orchestration (supervisor/worker) | 💎 Premium |
| MCP client integration | 💎 Premium |
| FastAPI/Express HTTP wrapper | 💎 Premium |
| Long-term memory with vector search | 💎 Premium |
| Agent observability (traces, spans) | 💎 Premium |
| 6 real-world example agents | 💎 Premium |

---

## Quick start

```bash
# Clone and install
git clone https://github.com/ai-packages/claude-agent-boilerplate my-agent
cd my-agent && npm install

# Add your Anthropic API key
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY=your-key

# Run the example
npm run example
```

---

## Build your own agent

```typescript
import 'dotenv/config';
import { BaseAgent } from '@aipackages/claude-agent-boilerplate';

// Define a tool
const calculatorTool = {
  name: 'calculate',
  description: 'Perform a mathematical calculation. Use for any math operations.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      expression: { type: 'string', description: 'Math expression to evaluate, e.g. "2 + 2 * 10"' },
    },
    required: ['expression'],
  },
  async execute(input: Record<string, unknown>) {
    const expr = String(input.expression);
    // WARNING: Never use eval() in production — use a safe math library
    const result = Function(`"use strict"; return (${expr})`)();
    return `${expr} = ${result}`;
  },
};

// Create and run the agent
const agent = new BaseAgent(
  [calculatorTool],
  {
    model: 'claude-opus-4-5',
    systemPrompt: 'You are a helpful math tutor. Use the calculator tool for any calculations.',
    maxToolRounds: 5,
  }
);

const result = await agent.run('What is 15% tip on a $87.50 dinner for 4 people?');
console.log(result.text);
// → "The 15% tip on $87.50 is $13.13, so each person owes $25.16"
```

---

## Streaming

```typescript
const agent = new BaseAgent([myTool], { systemPrompt: '...' });

process.stdout.write('Agent: ');
for await (const chunk of agent.stream('Tell me about TypeScript')) {
  process.stdout.write(chunk);
}
console.log(); // newline
```

---

## Multi-turn conversations

```typescript
const agent = new BaseAgent([myTool], { systemPrompt: '...' });

// Turn 1
await agent.run('My name is Alice');

// Turn 2 — agent remembers Alice
const result = await agent.run('What did I just tell you?');
console.log(result.text); // "You told me your name is Alice"

// Reset memory when done
agent.reset();
```

---

## Project structure

```
claude-agent-boilerplate/
├── src/
│   ├── agents/
│   │   └── base-agent.ts        # Core agent class — tool loop, streaming, memory
│   ├── memory/
│   │   └── conversation-memory.ts  # Sliding window message history
│   ├── tools/
│   │   └── web-search.ts        # Example tool: web search
│   ├── examples/
│   │   └── basic-agent.ts       # Runnable example
│   ├── lib/
│   │   └── logger.ts            # Winston logger
│   └── types.ts                 # AgentTool, AgentConfig, AgentRunResult
├── .env.example
└── package.json
```

---

## 💎 Premium Edition — $39

The open source version gives you a working agent core. The **premium edition** adds:

- ✅ Multi-agent orchestration (supervisor routes tasks to specialized workers)
- ✅ MCP client integration (connect your agent to any MCP server)
- ✅ HTTP API wrapper (deploy as a REST API with Express or FastAPI)
- ✅ Long-term memory with vector search (remember across sessions)
- ✅ Agent observability (Langfuse/Helicone integration for traces and costs)
- ✅ 6 real-world example agents:
  - 🔍 Research agent (search + summarize)
  - 💻 Code review agent (GitHub integration)
  - 📧 Email drafting agent
  - 🗄️ Database query agent (natural language → SQL)
  - 📊 Data analysis agent (CSV → insights)
  - 🤝 Customer support agent (with escalation)
- ✅ Production deployment guide (Railway, Render, Fly.io)
- ✅ Commercial license

**[Get the premium edition →](https://gumroad.com)**

---

## License

MIT — free for personal and open source use.  
Commercial license included in the [Premium Edition](https://gumroad.com).
