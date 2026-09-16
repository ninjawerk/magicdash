/** Starts the MCP server over stdio, lists tools and calls get_health. Used by CI and `npm run mcp:test`. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/server.ts'], env: { ...process.env, MAGICDASH_URL: process.env.MAGICDASH_URL ?? 'http://localhost:3210' } as Record<string, string> });
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);
const tools = await client.listTools();
console.log(`${tools.tools.length} tools:`, tools.tools.map((t) => t.name).join(', '));
const health = await client.callTool({ name: 'get_health', arguments: {} });
console.log('get_health →', JSON.stringify(health.content).slice(0, 200));
const dash = await client.callTool({ name: 'get_dashboard', arguments: {} });
const text = (dash.content as Array<{ type: string; text: string }>)[0].text;
console.log('get_dashboard → screens:', JSON.parse(text).screens.map((s: { name: string; widgets: unknown[] }) => `${s.name} (${s.widgets.length})`).join(', '));
await client.close();
