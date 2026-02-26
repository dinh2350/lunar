import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // LLM
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Database
  DATABASE_PATH: z.string().default('./data/lunar.db'),

  // Channels
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),

  // Security
  API_SECRET: z.string().min(32, 'API_SECRET must be at least 32 chars').optional(),
  RATE_LIMIT_RPM: z.coerce.number().default(60),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}

/**
 * Rate limiter configuration for Fastify
 */
export function rateLimitConfig() {
  const config = getConfig();
  return {
    max: config.RATE_LIMIT_RPM,
    timeWindow: 60_000,
    keyGenerator: (req: any) => req.headers['x-user-id'] || req.ip,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Please slow down. Try again in a minute.',
    }),
  };
}

/**
 * CORS configuration
 */
export function corsConfig() {
  const config = getConfig();
  return {
    origin: config.CORS_ORIGINS.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  };
}

/**
 * API key authentication hook for production
 */
export function authHook() {
  const config = getConfig();

  return async (request: any, reply: any) => {
    // Skip auth for health check
    if (request.url === '/api/metrics/health') return;

    // Skip in development
    if (config.NODE_ENV === 'development') return;

    // Skip if no API_SECRET configured
    if (!config.API_SECRET) return;

    const apiKey =
      request.headers['x-api-key'] || request.headers.authorization?.replace('Bearer ', '');

    if (apiKey !== config.API_SECRET) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  };
}
