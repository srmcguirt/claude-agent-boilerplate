/**
 * Web search tool — example agent tool that searches the web.
 * Replace the implementation with your actual search API.
 */

import { z } from 'zod';
import type { AgentTool } from '../types.js';

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  num_results: z.number().int().positive().max(10).default(5),
});

export const webSearchTool: AgentTool = {
  name: 'web_search',
  description:
    'Search the web for current information. Use when you need facts, recent events, ' +
    'or information that might not be in your training data.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return (1-10, default 5)',
        default: 5,
      },
    },
    required: ['query'],
  },
  async execute(input) {
    const { query, num_results } = SearchSchema.parse(input);

    // Replace with your actual search API (Serper, Tavily, Brave Search, etc.)
    // Example with Serper:
    // const response = await fetch('https://google.serper.dev/search', {
    //   method: 'POST',
    //   headers: { 'X-API-KEY': process.env.SERPER_API_KEY!, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ q: query, num: num_results }),
    // });
    // const data = await response.json();
    // return data.organic.map(r => `${r.title}\n${r.link}\n${r.snippet}`).join('\n\n');

    // Placeholder implementation:
    return `[Web search results for "${query}" would appear here. Configure a search API to enable this tool.]`;
  },
};
