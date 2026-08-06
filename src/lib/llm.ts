import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Business } from '@prisma/client';
import { credentialsFor } from './business';
import { SENSITIVE_KEYWORDS } from './constants';

/**
 * LLM layer. Two capabilities are exposed:
 *   analyzeReview()  → sensitivity + a one-line summary (always runs)
 *   generateReply()  → a public reply draft (only for 3.0★ and above)
 *
 * Every call is scoped to a Business, so it uses that business's provider, key,
 * model, and — importantly — its written context. The context is the only source
 * of facts the model is allowed to draw on.
 */

export class LLMNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`No API key configured for the "${provider}" LLM provider. Add one in Settings.`);
    this.name = 'LLMNotConfiguredError';
  }
}

export const PROMPT_VERSION = 'v2-business-context';

type CompletionOpts = { system: string; user: string; json?: boolean; maxTokens?: number };

/**
 * Current Gemini "flash-latest" models are *thinking* models: internal reasoning
 * tokens are billed against `maxOutputTokens`. Measured on gemini-flash-latest, a
 * short review reply spends ~680 tokens thinking before writing ~70 visible ones,
 * so a small budget returns a reply truncated mid-sentence. (`thinkingConfig` is
 * rejected with 400 by v1beta, so the budget cannot simply be turned off.)
 *
 * Hence a roomy default, plus a hard failure on truncation so a half-written
 * reply is never stored or published.
 */
const DEFAULT_MAX_TOKENS = 3072;

class TruncatedResponseError extends Error {
  constructor(provider: string) {
    super(
      `The ${provider} model hit its output limit before finishing. The reply was discarded rather than saved half-written.`,
    );
    this.name = 'TruncatedResponseError';
  }
}

async function complete(
  business: Business,
  opts: CompletionOpts,
): Promise<{ text: string; model: string; provider: string }> {
  const { llmProvider, llmModel, llmApiKey } = credentialsFor(business);
  if (!llmApiKey) throw new LLMNotConfiguredError(llmProvider);
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  if (llmProvider === 'gemini') {
    const genAI = new GoogleGenerativeAI(llmApiKey);
    const model = genAI.getGenerativeModel({
      model: llmModel,
      systemInstruction: opts.system,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: maxTokens,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    });

    const res = await model.generateContent(opts.user);
    const finish = res.response.candidates?.[0]?.finishReason;
    const text = res.response.text().trim();

    if (finish === 'MAX_TOKENS' && !text) throw new TruncatedResponseError('gemini');
    if (finish && finish !== 'STOP' && finish !== 'MAX_TOKENS') {
      throw new Error(`Gemini stopped early (${finish}) — no usable reply was produced.`);
    }
    if (finish === 'MAX_TOKENS') throw new TruncatedResponseError('gemini');

    return { text, model: llmModel, provider: 'gemini' };
  }

  const client = new OpenAI({ apiKey: llmApiKey });
  const res = await client.chat.completions.create({
    model: llmModel,
    temperature: 0.6,
    max_tokens: maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });

  const choice = res.choices[0];
  if (choice?.finish_reason === 'length') throw new TruncatedResponseError('openai');

  return {
    text: choice?.message?.content?.trim() ?? '',
    model: llmModel,
    provider: 'openai',
  };
}

/** Strips ```json fences some models add despite JSON mode. */
function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

// ---------------------------------------------------------------------------
// Sensitivity analysis
// ---------------------------------------------------------------------------

export type ReviewAnalysis = {
  sensitive: boolean;
  reasons: string[];
  summary: string;
  source: 'keyword' | 'llm' | 'keyword+llm' | 'none';
};

/** Cheap, deterministic pre-filter. Runs even when the LLM is unreachable. */
export function keywordSensitivityCheck(text: string | null | undefined): string[] {
  if (!text) return [];
  const reasons = new Set<string>();
  for (const { pattern, reason } of SENSITIVE_KEYWORDS) {
    if (pattern.test(text)) reasons.add(reason);
  }
  return [...reasons];
}

const ANALYSIS_SYSTEM = `You are a risk triage assistant for a business that replies to public Google reviews.

Decide whether a review is SENSITIVE. A review is sensitive when a public, AI-written reply could cause legal, regulatory, safety or reputational harm — for example:
- legal threats, lawyers, lawsuits, regulators, police
- allegations of discrimination, harassment, assault or abuse
- health & safety incidents: illness, food poisoning, injury, allergic reactions, hospital visits
- accusations of fraud, theft, or unauthorised charges
- privacy or data-protection complaints
- references to death, self-harm, or minors being endangered
- naming a specific employee in a serious accusation

A review is NOT sensitive merely because it is negative, rude, or complains about price, waiting time, quality or service.

Respond with JSON only:
{"sensitive": boolean, "reasons": string[], "summary": string}

"reasons" holds short noun phrases (max 6 words each), empty when not sensitive.
"summary" is one neutral sentence (max 22 words) describing what the reviewer is saying.`;

export async function analyzeReview(
  business: Business,
  input: { starRating: number; comment: string | null; reviewerName: string },
): Promise<ReviewAnalysis> {
  const keywordReasons = keywordSensitivityCheck(input.comment);

  const fallbackSummary = input.comment
    ? input.comment.replace(/\s+/g, ' ').slice(0, 160)
    : `${input.starRating}-star rating with no written comment.`;

  if (!input.comment || !input.comment.trim()) {
    return {
      sensitive: keywordReasons.length > 0,
      reasons: keywordReasons,
      summary: fallbackSummary,
      source: keywordReasons.length ? 'keyword' : 'none',
    };
  }

  try {
    const { text } = await complete(business, {
      system: ANALYSIS_SYSTEM,
      user: `Star rating: ${input.starRating} / 5\nReviewer: ${input.reviewerName}\nReview text:\n"""\n${input.comment}\n"""`,
      json: true,
    });

    const parsed = parseJsonLoose(text) as {
      sensitive?: boolean;
      reasons?: unknown;
      summary?: unknown;
    };

    const llmReasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === 'string').slice(0, 6)
      : [];
    const reasons = [...new Set([...keywordReasons, ...llmReasons])];

    return {
      // Either signal escalates — we fail safe towards a human.
      sensitive: Boolean(parsed.sensitive) || keywordReasons.length > 0,
      reasons,
      summary:
        typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : fallbackSummary,
      source: keywordReasons.length ? 'keyword+llm' : 'llm',
    };
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) throw err;
    return {
      sensitive: keywordReasons.length > 0,
      reasons: keywordReasons,
      summary: fallbackSummary,
      source: keywordReasons.length ? 'keyword' : 'none',
    };
  }
}

// ---------------------------------------------------------------------------
// Reply generation
// ---------------------------------------------------------------------------

function replySystemPrompt(business: Business, tier: 'positive' | 'mixed'): string {
  const shared = `You write public replies to Google reviews on behalf of ${business.name}.

=== BUSINESS CONTEXT (the ONLY facts you may use) ===
${business.context}
=== END BUSINESS CONTEXT ===
${business.brandTone ? `\nTone guidance from the owner: ${business.brandTone}\n` : ''}
Hard rules:
- Reply in the same language as the review.
- 2 to 4 sentences. Under 70 words.
- You may reference services, prices, hours or policies ONLY if they appear in the business context above. If the reviewer asks about something absent from the context, respond warmly without inventing an answer.
- Never invent facts, promotions, discounts, refunds, dates, names, or policies.
- Address the reviewer by first name only if their name is a normal personal name; otherwise no name.
- Never mention AI, automation, templates, or that this is a generated reply.
- No hashtags, no emoji, no ALL-CAPS, no exclamation-mark stacking.
- Do not ask the reviewer to edit or remove their review.
- Output the reply text only — no quotes, no preamble, no subject line.`;

  if (tier === 'positive') {
    return `${shared}
- This is a positive review. Thank them warmly and specifically, referencing one concrete detail they mentioned. Keep it short and genuine. Invite them back once, plainly.`;
  }

  return `${shared}
- This is a middling review: the reviewer had a partly good, partly disappointing experience.
- Acknowledge the specific shortcoming they raised without making excuses and without admitting legal fault.
- Thank them for the constructive feedback and say the point has been passed to the team.
- Offer to continue the conversation privately in one short clause, but do NOT invent an email address or phone number unless one appears in the business context.`;
}

export type GeneratedReply = {
  content: string;
  model: string;
  provider: string;
  promptVersion: string;
};

export async function generateReply(
  business: Business,
  input: {
    starRating: number;
    comment: string | null;
    reviewerName: string;
    locationTitle: string;
  },
): Promise<GeneratedReply> {
  const tier = input.starRating >= 4 ? 'positive' : 'mixed';

  const { text, model, provider } = await complete(business, {
    system: replySystemPrompt(business, tier),
    user: [
      `Location: ${input.locationTitle}`,
      `Star rating: ${input.starRating} / 5`,
      `Reviewer name: ${input.reviewerName}`,
      input.comment
        ? `Review text:\n"""\n${input.comment}\n"""`
        : 'The reviewer left a star rating with no written comment. Write a brief, gracious thank-you that does not pretend to know details.',
    ].join('\n'),
  });

  let content = text.replace(/^["'“]|["'”]$/g, '').trim();
  if (!content) throw new Error('The LLM returned an empty reply.');
  if (business.signature) content = `${content}\n\n${business.signature}`;

  return { content, model, provider, promptVersion: PROMPT_VERSION };
}

/** Used by the Settings "Test connection" button. */
export async function testLLMConnection(
  business: Business,
): Promise<{ ok: true; model: string; provider: string; sample: string }> {
  const { text, model, provider } = await complete(business, {
    system: 'You are a health check. Reply with exactly: OK',
    user: 'Health check.',
  });
  return { ok: true, model, provider, sample: text.slice(0, 40) };
}
