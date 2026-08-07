import 'server-only';
import { prisma } from './prisma';
import { createBusiness } from './business';
import { logEvent } from './logger';

/**
 * First-run organisation, so a fresh deployment comes up looking like the
 * development machine instead of an empty onboarding form.
 *
 * The description lives here because it is not secret — it is the same public
 * information the AI is allowed to quote. The three credentials come from the
 * environment so they never enter the repository.
 *
 * Seeding is skipped entirely once *any* organisation exists, so deleting or
 * renaming this one is permanent rather than being undone on the next restart.
 */

export const OCTIGROWTH_CONTEXT = `OctiGrowth is a digital growth agency based in Morocco, working with small and mid-sized businesses across Europe and North Africa.

Services:
- Lead generation and B2B prospecting (scraping, enrichment, outbound campaigns)
- Google Business Profile management and local SEO
- Paid acquisition on Google Ads and Meta Ads
- Website and landing page development (Next.js)
- Marketing automation and CRM setup (HubSpot)

Engagement model: monthly retainers starting at 4,500 MAD/month for local SEO,
and 8,000 MAD/month for full growth packages. One-off website projects start at
15,000 MAD. First consultation call is free, 30 minutes.

Hours: Monday to Friday, 9:00-18:00 (GMT+1). Closed weekends and Moroccan public holidays.
Contact: hello@octigrowth.com
Policy: no long lock-in contracts, 30 days notice to cancel. We do not guarantee
specific ranking positions or revenue figures.`;

export async function ensureSeedBusiness(): Promise<void> {
  // Only ever seeds an empty installation.
  if ((await prisma.business.count()) > 0) return;

  const googleClientId = process.env.SEED_GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.SEED_GOOGLE_CLIENT_SECRET?.trim();
  const llmApiKey = process.env.SEED_LLM_API_KEY?.trim();

  if (!googleClientId || !googleClientSecret || !llmApiKey) {
    // Nothing to seed with — the onboarding form handles it instead.
    return;
  }

  try {
    const business = await createBusiness({
      name: process.env.SEED_BUSINESS_NAME?.trim() || 'OctiGrowth',
      context: process.env.SEED_BUSINESS_CONTEXT?.trim() || OCTIGROWTH_CONTEXT,
      googleClientId,
      googleClientSecret,
      llmProvider: process.env.SEED_LLM_PROVIDER === 'openai' ? 'openai' : 'gemini',
      llmApiKey,
      llmModel: process.env.SEED_LLM_MODEL?.trim() || undefined,
    });

    await logEvent({
      event: 'business.seeded',
      message: `Created "${business.name}" from the seed configuration`,
      businessId: business.id,
    });
  } catch (err) {
    // A failed seed must never block sign-in; the form is still available.
    console.error('[responder] could not seed the initial organisation', err);
  }
}
