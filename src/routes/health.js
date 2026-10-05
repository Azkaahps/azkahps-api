import { Hono } from 'hono';
import { cache } from '../cache.js';
import { getProvidersSummary } from '../providers/registry.js';

export const healthRouter = new Hono();

healthRouter.get('/health', (c) => {
  const mem = process.memoryUsage();
  return c.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`
    },
    cache: cache.getStats(),
    providers: getProvidersSummary()
  });
});
