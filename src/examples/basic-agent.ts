/**
 * Basic agent example — demonstrates the core agent run loop.
 *
 * Run: npm run example
 */

import 'dotenv/config';
import { BaseAgent } from '../agents/base-agent.js';
import { webSearchTool } from '../tools/web-search.js';

async function main() {
  const agent = new BaseAgent(
    [webSearchTool],
    {
      model: 'claude-opus-5',
      systemPrompt: `You are a helpful research assistant.
When asked questions, use the web_search tool to find current information.
Always cite your sources and be clear about what you found vs what you know.`,
      maxToolRounds: 5,
    }
  );

  console.log('🤖 Agent ready. Type your message:\n');

  // Single-turn example
  const result = await agent.run(
    'What are the top 3 trending AI libraries on npm right now?'
  );

  console.log('Agent response:');
  console.log(result.text);
  console.log('\n---');
  console.log(`Used ${result.usage.inputTokens} input tokens, ${result.usage.outputTokens} output tokens`);
  console.log(`Completed in ${result.rounds} tool round(s)`);
}

main().catch(console.error);
