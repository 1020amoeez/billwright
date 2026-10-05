/**
 * Cloudflare Pages Function: turns a plain-English request about how the
 * document should look ("make it navy with a serif font") into the generator's
 * look settings.
 *
 * It receives the request and the current settings — colours, a font name, a
 * template id and the logo's size and visibility, never the logo image — and
 * nothing from the document itself.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { apiFailure, checkQuota, json, NOT_CONFIGURED, readText, type Env } from '../_lib/ai';
import { defaultLook, isHex, lookFonts, normaliseLook, type Look } from '../../src/scripts/look';

const MAX_INPUT = 300;
const TEMPLATE_IDS = ['classic', 'bold-header', 'compact', 'minimal', 'ledger', 'contractor'] as const;
const LOGO_SIZES = ['small', 'medium', 'large'] as const;

const Style = z.object({
  accent: z.string().describe('Accent colour as #RRGGBB.'),
  heading: z.string().describe('Heading colour as #RRGGBB. Must be dark: white text sits on it.'),
  font: z.enum(['sans', 'serif', 'mono']),
  template: z.enum(TEMPLATE_IDS),
  logoSize: z.enum(LOGO_SIZES),
  showLogo: z.boolean(),
  watermark: z.boolean().describe('A large faint copy of the logo behind the invoice.'),
  note: z
    .string()
    .describe('One short sentence, under 80 characters, saying what changed or what is not possible.'),
});

const SYSTEM = `You set the look of an invoice from a short request.

Settings:
- accent (#RRGGBB): the logo square and decorative rules. Can be any colour, including bright ones.
- heading (#RRGGBB): the title, table rule and grand total, and a filled band behind white text
  in some templates. It must be dark enough to read on white. For "make it blue", pick a deep
  blue heading and a brighter blue accent from the same family.
- font: sans (modern), serif (traditional, elegant), mono (typewriter, technical).
- template: classic (default), bold-header (dark band across the top), compact (small type,
  many rows), minimal (few rules, no logo square), ledger (boxed table, for tax invoices),
  contractor (accent strip at the top, dark total bar).
- logoSize: small, medium or large. showLogo: whether the mark in the top corner shows at all.
  The mark is the uploaded logo if "uploaded" is true, otherwise the business's initials on
  the accent colour. You never see the logo image and cannot edit it.
- watermark: a large faint copy of the uploaded logo behind the invoice. Only possible when
  "uploaded" is true; otherwise keep it false and say a logo is needed.

Rules:
- Start from the current settings and change only what the request asks for. "Darker",
  "softer" and similar are relative to the current colours.
- Named brands or moods are fine: "like Coca-Cola" is red, "calm" might be a muted teal.
- The request may be half-typed. Act on what is clear so far.
- Things you cannot change (the logo image itself, other images, layouts beyond the templates, extra fields):
  keep the settings and say so briefly in the note.`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) return json({ error: NOT_CONFIGURED }, 503);

  const read = await readText(request, MAX_INPUT);
  if (read instanceof Response) return read;
  const { text, body } = read;

  const current = normaliseLook(body.look as Partial<Look> | undefined, defaultLook);
  const currentTemplate = TEMPLATE_IDS.includes(body.template as (typeof TEMPLATE_IDS)[number])
    ? (body.template as string)
    : 'classic';

  const logoIn = (body.logo ?? {}) as {
    size?: unknown;
    show?: unknown;
    uploaded?: unknown;
    watermark?: unknown;
  };
  const currentLogo = {
    size: LOGO_SIZES.includes(logoIn.size as (typeof LOGO_SIZES)[number]) ? logoIn.size : 'medium',
    show: logoIn.show !== false,
    uploaded: logoIn.uploaded === true,
    watermark: logoIn.watermark === true,
  };

  const blocked = await checkQuota(request, env);
  if (blocked) return blocked;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Current: ${JSON.stringify({ ...current, template: currentTemplate, logo: currentLogo })}\nRequest: ${text}`,
        },
      ],
      output_config: { format: zodOutputFormat(Style) },
    });

    const parsed = response.parsed_output;
    if (!parsed) return json({ error: 'Could not read that. Try "make it navy".' }, 422);

    // The model's colours are checked here too: a light heading is darkened
    // until it reads on white, whatever was asked for.
    const look = normaliseLook(
      {
        accent: isHex(parsed.accent) ? parsed.accent : current.accent,
        heading: isHex(parsed.heading) ? parsed.heading : current.heading,
        font: lookFonts.includes(parsed.font) ? parsed.font : current.font,
      },
      current,
    );

    return json({
      look,
      template: parsed.template,
      logoSize: parsed.logoSize,
      showLogo: parsed.showLogo,
      watermark: currentLogo.uploaded && parsed.watermark,
      note: parsed.note.slice(0, 120),
    });
  } catch (error) {
    return apiFailure(error, 'style');
  }
};
