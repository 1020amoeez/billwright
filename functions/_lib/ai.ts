/**
 * Shared by the AI endpoints: responses, the per-IP daily quota and the
 * mapping from SDK errors to messages the generator can show as they are.
 * Not a route — Pages only routes files that export onRequest handlers.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  ANTHROPIC_API_KEY?: string;
  /** KV namespace used for per-IP daily quota. Required unless AI_ALLOW_UNLIMITED is set. */
  AI_LIMITS?: KVNamespace;
  /** Escape hatch for local development only. */
  AI_ALLOW_UNLIMITED?: string;
  AI_DAILY_LIMIT?: string;
}

/**
 * Drafting runs as people type, so one invoice can take a dozen calls. At
 * roughly $0.0014 each this caps any one visitor near $0.14 a day.
 */
const DEFAULT_DAILY_LIMIT = 100;

export const NOT_CONFIGURED = 'AI assist is not configured on this deployment.';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** Per-IP daily quota, shared by every AI endpoint. Fails closed: a missing
 *  binding disables the feature rather than leaving the key without a ceiling. */
export async function checkQuota(request: Request, env: Env): Promise<Response | null> {
  if (env.AI_ALLOW_UNLIMITED === 'true') return null;

  if (!env.AI_LIMITS) return json({ error: NOT_CONFIGURED }, 503);

  const limit = Number(env.AI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `ai:${new Date().toISOString().slice(0, 10)}:${ip}`;

  const used = Number((await env.AI_LIMITS.get(key)) ?? '0');
  if (used >= limit) {
    return json(
      { error: `That is the AI limit for today. Carry on by hand, or come back tomorrow.` },
      429,
    );
  }

  await env.AI_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  return null;
}

/** Reads `{ text }` (plus any extra fields) from the body, with the length rules applied. */
export async function readText(
  request: Request,
  maxLength: number,
): Promise<{ text: string; body: Record<string, unknown> } | Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 3) return json({ error: 'Write a few words first.' }, 400);
  if (text.length > maxLength) {
    return json({ error: `Keep it under ${maxLength} characters.` }, 400);
  }
  return { text, body };
}

export function apiFailure(error: unknown, label: string): Response {
  if (error instanceof Anthropic.RateLimitError) {
    return json({ error: 'Busy right now. Try again in a moment.' }, 429);
  }
  if (error instanceof Anthropic.AuthenticationError) {
    console.error('Anthropic auth failed');
    return json({ error: NOT_CONFIGURED }, 503);
  }
  if (error instanceof Anthropic.APIError) {
    console.error('Anthropic API error', error.status, error.message);
    return json({ error: 'The AI service failed. Try again, or carry on by hand.' }, 502);
  }
  console.error(`${label} failed`, error);
  return json({ error: 'Something went wrong. Try again, or carry on by hand.' }, 500);
}
