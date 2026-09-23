/**
 * Cloudflare Pages Function: turns a plain-English description of work into
 * structured invoice line items.
 *
 * This is the only part of Billwright that leaves the browser, and it is only
 * reached when someone presses the button. It receives the sentence the user
 * typed and nothing else — no client name, no business details, no totals.
 * Amounts are still added up locally by the app's own computeTotals.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

interface Env {
  ANTHROPIC_API_KEY?: string;
  /** KV namespace used for per-IP daily quota. Required unless AI_ALLOW_UNLIMITED is set. */
  AI_LIMITS?: KVNamespace;
  /** Escape hatch for local development only. */
  AI_ALLOW_UNLIMITED?: string;
  AI_DAILY_LIMIT?: string;
}

const MAX_INPUT = 600;
const MAX_ITEMS = 12;
const DEFAULT_DAILY_LIMIT = 20;

const LineItem = z.object({
  description: z
    .string()
    .describe('Short, professional description of the work. Under 60 characters.'),
  qty: z.number().describe('Quantity, hours or units. Use 1 when not stated.'),
  unitPrice: z
    .number()
    .describe('Price per unit if the text states or implies one, otherwise 0.'),
});

const Draft = z.object({
  items: z.array(LineItem).describe('One entry per distinct billable thing. Never empty.'),
});

const SYSTEM = `You turn a freelancer's rough description of work into invoice line items.

Rules:
- One line item per distinct billable thing. Split combined work; merge duplicates.
- Descriptions are short, specific and professional. Fix spelling and capitalisation.
  "fixd their wordpress" becomes "WordPress maintenance and bug fixes".
- Never invent a price. If the text does not state or clearly imply a unit price, use 0
  and let the person fill it in.
- "40 hours at 3500" means qty 40, unitPrice 3500. "5 pages for 90000" means qty 1,
  unitPrice 90000 unless a per-page price is stated.
- Quantity defaults to 1.
- Do not add tax, discounts, totals or subtotals. Those are calculated elsewhere.
- Do not add line items the description does not mention.
- If the description is too vague to itemise, return a single item using the description
  itself, quantity 1 and price 0.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** Per-IP daily quota. Fails closed: a missing binding disables the feature
 *  rather than leaving the API key billable without a ceiling. */
async function checkQuota(request: Request, env: Env): Promise<Response | null> {
  if (env.AI_ALLOW_UNLIMITED === 'true') return null;

  if (!env.AI_LIMITS) {
    return json(
      { error: 'AI assist is not configured on this deployment.' },
      503,
    );
  }

  const limit = Number(env.AI_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const key = `draft:${new Date().toISOString().slice(0, 10)}:${ip}`;

  const used = Number((await env.AI_LIMITS.get(key)) ?? '0');
  if (used >= limit) {
    return json(
      { error: `That is ${limit} drafts today. Add the items by hand, or come back tomorrow.` },
      429,
    );
  }

  await env.AI_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  return null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'AI assist is not configured on this deployment.' }, 503);
  }

  let text: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === 'string' ? body.text.trim() : '';
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }

  if (text.length < 3) {
    return json({ error: 'Describe the work in a sentence or two first.' }, 400);
  }
  if (text.length > MAX_INPUT) {
    return json({ error: `Keep the description under ${MAX_INPUT} characters.` }, 400);
  }

  const blocked = await checkQuota(request, env);
  if (blocked) return blocked;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      // The instructions are identical on every call, so they cache and the
      // billed input drops to roughly the length of the user's sentence.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: text }],
      output_config: { format: zodOutputFormat(Draft) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return json({ error: 'Could not turn that into line items. Try rewording it.' }, 422);
    }

    const items = parsed.items.slice(0, MAX_ITEMS).map((item) => ({
      description: item.description.slice(0, 120),
      qty: Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1,
      unitPrice: Number.isFinite(item.unitPrice) && item.unitPrice > 0 ? item.unitPrice : 0,
    }));

    if (items.length === 0) {
      return json({ error: 'Could not turn that into line items. Try rewording it.' }, 422);
    }

    return json({ items });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'Busy right now. Try again in a moment.' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic auth failed');
      return json({ error: 'AI assist is not configured on this deployment.' }, 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error', error.status, error.message);
      return json({ error: 'The drafting service failed. Add the items by hand.' }, 502);
    }
    console.error('draft-items failed', error);
    return json({ error: 'Something went wrong. Add the items by hand.' }, 500);
  }
};
