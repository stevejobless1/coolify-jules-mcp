#!/usr/bin/env node

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CoolifyMcpServer } from './lib/mcp-server.js';
import type { CoolifyConfig } from './types/coolify.js';

async function main(): Promise<void> {
  // 1. Keep his original config logic
  const config: CoolifyConfig = {
    baseUrl: process.env.COOLIFY_BASE_URL || 'http://localhost:3000',
    accessToken: process.env.COOLIFY_ACCESS_TOKEN || '',
  };

  if (!config.accessToken) {
    throw new Error('COOLIFY_ACCESS_TOKEN environment variable is required');
  }

  // Initialize his optimized server
  const server = new CoolifyMcpServer(config);

  // 2. Build the Express Wrapper
  const app = express();
  app.use(express.json());

  // 3. Security: Lock it down so only Jules can access it
  const API_KEY = process.env.JULES_SECRET_KEY || 'default-secret-change-me';

  app.use((req, res, next) => {
    const providedKey = req.headers['x-api-key'] || req.query.key;
    if (providedKey !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
  });

  let transport: SSEServerTransport | null = null;

  // 4. The SSE Endpoint (Jules establishes the connection here)
  app.get('/sse', async (req, res) => {
    console.log('Jules established a new SSE connection.');
    transport = new SSEServerTransport('/messages', res);
    await server.connect(transport);
  });

  // 5. The Messages Endpoint (Jules posts infrastructure commands here)
  app.post('/messages', async (req, res) => {
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('SSE connection must be established first at /sse');
    }
  });

  // 6. Start listening
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Coolify MCP (SSE Edition) successfully listening on port ${PORT}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
