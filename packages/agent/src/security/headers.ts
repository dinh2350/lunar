/**
 * Security headers configuration (Helmet-style)
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Apply security headers to Fastify
 */
export function securityHeadersHook() {
  return async (_request: any, reply: any) => {
    for (const [key, value] of Object.entries(securityHeaders)) {
      reply.header(key, value);
    }
  };
}

/**
 * Input sanitizer — strip dangerous characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars
    .trim();
}

/**
 * Validate request body size
 */
export function validateBodySize(body: string, maxBytes = 50_000): boolean {
  return Buffer.byteLength(body, 'utf-8') <= maxBytes;
}
