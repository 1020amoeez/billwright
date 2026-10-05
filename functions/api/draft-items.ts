/**
 * Cloudflare Pages Function: turns a plain-English description of work into
 * structured invoice line items.
 *
 * The generator calls it when someone pauses while typing in the "Describe the
 * work" box. It receives that text and nothing else — no client name, no
 * business details, no totals.
 * Amounts are still added up locally by the app's own computeTotals.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { apiFailure, checkQuota, json, NOT_CONFIGURED, readText, type Env } from '../_lib/ai';

const MAX_INPUT = 600;
const MAX_ITEMS = 12;

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: NOT_CONFIGURED }, 503);
  }

  const read = await readText(request, MAX_INPUT);
  if (read instanceof Response) return read;
  const { text } = read;

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
    return apiFailure(error, 'draft-items');
  }
};
