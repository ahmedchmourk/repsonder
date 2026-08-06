import 'server-only';
import { cookies } from 'next/headers';
import type { Business } from '@prisma/client';
import { prisma } from './prisma';
import { decrypt, encrypt, maskSecret } from './crypto';
import { logEvent } from './logger';
import { defaultRedirectUri, normalizeRedirectUri } from './redirect-uri';

/**
 * Businesses own their own credentials. Nothing about Google or the LLM comes
 * from the environment any more — only DATABASE_URL, ENCRYPTION_KEY, CRON_SECRET
 * and APP_BASE_URL are global.
 */

export const BUSINESS_COOKIE = 'responder_business_id';

export const DEFAULT_MODELS = {
  // gemini-2.0-flash has a zero free-tier quota on new keys; -latest works.
  gemini: 'gemini-flash-latest',
  openai: 'gpt-4o-mini',
} as const;

export type BusinessCredentials = {
  googleClientId: string;
  googleClientSecret: string;
  llmProvider: 'openai' | 'gemini';
  llmModel: string;
  llmApiKey: string;
};

/** Safe shape for the browser — secrets are masked, never sent in plaintext. */
export type BusinessDTO = {
  id: string;
  name: string;
  slug: string;
  context: string;
  brandTone: string | null;
  signature: string | null;
  googleClientId: string;
  googleClientSecretMasked: string;
  googleRedirectUri: string;
  llmProvider: string;
  llmModel: string;
  llmApiKeyMasked: string;
  minReplyDelayHours: number;
  autoPublishEnabled: boolean;
  active: boolean;
  createdAt: string;
  connected: boolean;
  locationCount: number;
  reviewCount: number;
};

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'business'
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listBusinesses(): Promise<BusinessDTO[]> {
  const rows = await prisma.business.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      oauth: { select: { id: true } },
      _count: { select: { locations: true, reviews: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    context: row.context,
    brandTone: row.brandTone,
    signature: row.signature,
    googleClientId: row.googleClientId,
    googleClientSecretMasked: maskSecret(safeDecrypt(row.googleClientSecret)),
    googleRedirectUri: row.googleRedirectUri?.trim() || defaultRedirectUri(),
    llmProvider: row.llmProvider,
    llmModel: row.llmModel,
    llmApiKeyMasked: maskSecret(safeDecrypt(row.llmApiKey)),
    minReplyDelayHours: row.minReplyDelayHours,
    autoPublishEnabled: row.autoPublishEnabled,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    connected: Boolean(row.oauth),
    locationCount: row._count.locations,
    reviewCount: row._count.reviews,
  }));
}

function safeDecrypt(value: string): string {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch {
    return '';
  }
}

export async function countBusinesses(): Promise<number> {
  return prisma.business.count();
}

/**
 * The business the dashboard is currently pointed at: the cookie selection if it
 * still exists, otherwise the oldest business. Returns null when none exist yet.
 */
export async function getCurrentBusiness(): Promise<Business | null> {
  const jar = await cookies();
  const selectedId = jar.get(BUSINESS_COOKIE)?.value;

  if (selectedId) {
    const found = await prisma.business.findUnique({ where: { id: selectedId } });
    if (found) return found;
  }
  return prisma.business.findFirst({ orderBy: { createdAt: 'asc' } });
}

export async function getBusinessOrThrow(id: string): Promise<Business> {
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) throw new Error('Business not found');
  return business;
}

/** Decrypted credentials. Server-only — never return this to the browser. */
export function credentialsFor(business: Business): BusinessCredentials {
  return {
    googleClientId: business.googleClientId,
    googleClientSecret: decrypt(business.googleClientSecret),
    llmProvider: business.llmProvider === 'openai' ? 'openai' : 'gemini',
    llmModel: business.llmModel,
    llmApiKey: decrypt(business.llmApiKey),
  };
}

/** Businesses the cron jobs should process: active and connected to Google. */
export async function listProcessableBusinesses(): Promise<Business[]> {
  return prisma.business.findMany({
    where: { active: true, oauth: { isNot: null } },
    orderBy: { createdAt: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type CreateBusinessInput = {
  name: string;
  context: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri?: string;
  llmProvider: 'openai' | 'gemini';
  llmApiKey: string;
  llmModel?: string;
  brandTone?: string;
  signature?: string;
  minReplyDelayHours?: number;
};

export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const name = input.name.trim();
  const context = input.context.trim();

  if (!name) throw new Error('The business name is required.');
  if (context.length < 40) {
    throw new Error(
      'The business context is required, and needs to be at least 40 characters — it is what stops the AI inventing services and prices.',
    );
  }
  if (!input.googleClientId.trim()) throw new Error('The Google client ID is required.');
  if (!input.googleClientSecret.trim()) throw new Error('The Google client secret is required.');
  if (!input.llmApiKey.trim()) throw new Error('An LLM API key is required.');

  const provider = input.llmProvider === 'openai' ? 'openai' : 'gemini';
  const delay = Math.max(24, Number(input.minReplyDelayHours ?? 24) || 24);

  const business = await prisma.business.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      context,
      brandTone: input.brandTone?.trim() || null,
      signature: input.signature?.trim() || null,
      googleClientId: input.googleClientId.trim(),
      googleClientSecret: encrypt(input.googleClientSecret.trim()),
      googleRedirectUri: input.googleRedirectUri
        ? normalizeRedirectUri(input.googleRedirectUri)
        : null,
      llmProvider: provider,
      llmModel: input.llmModel?.trim() || DEFAULT_MODELS[provider],
      llmApiKey: encrypt(input.llmApiKey.trim()),
      minReplyDelayHours: delay,
    },
  });

  await logEvent({
    event: 'business.created',
    message: `Created business "${business.name}"`,
    businessId: business.id,
  });

  return business;
}

export type UpdateBusinessInput = Partial<{
  name: string;
  context: string;
  brandTone: string;
  signature: string;
  googleClientId: string;
  /** Blank or masked means "keep the stored value". */
  googleClientSecret: string;
  /** Blank resets it to the app default. */
  googleRedirectUri: string;
  llmProvider: 'openai' | 'gemini';
  llmModel: string;
  /** Blank or masked means "keep the stored value". */
  llmApiKey: string;
  minReplyDelayHours: number;
  autoPublishEnabled: boolean;
  active: boolean;
}>;

/** A value the browser echoed back from a masked field must not overwrite it. */
function isMasked(value: string): boolean {
  return value.includes('•');
}

export async function updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business> {
  await getBusinessOrThrow(id);

  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('The business name cannot be empty.');
    data.name = name;
  }
  if (input.context !== undefined) {
    const context = input.context.trim();
    if (context.length < 40) {
      throw new Error('The business context needs to be at least 40 characters.');
    }
    data.context = context;
  }
  if (input.brandTone !== undefined) data.brandTone = input.brandTone.trim() || null;
  if (input.signature !== undefined) data.signature = input.signature.trim() || null;
  if (input.googleClientId !== undefined && input.googleClientId.trim()) {
    data.googleClientId = input.googleClientId.trim();
  }
  if (input.googleClientSecret !== undefined) {
    const secret = input.googleClientSecret.trim();
    if (secret && !isMasked(secret)) data.googleClientSecret = encrypt(secret);
  }
  if (input.googleRedirectUri !== undefined) {
    // Throws InvalidRedirectUriError for a path this app cannot serve.
    data.googleRedirectUri = normalizeRedirectUri(input.googleRedirectUri) || null;
  }
  if (input.llmProvider !== undefined) {
    data.llmProvider = input.llmProvider === 'openai' ? 'openai' : 'gemini';
  }
  if (input.llmModel !== undefined && input.llmModel.trim()) data.llmModel = input.llmModel.trim();
  if (input.llmApiKey !== undefined) {
    const key = input.llmApiKey.trim();
    if (key && !isMasked(key)) data.llmApiKey = encrypt(key);
  }
  if (input.minReplyDelayHours !== undefined) {
    const hours = Number(input.minReplyDelayHours);
    if (!Number.isFinite(hours) || hours < 24) {
      throw new Error('The minimum reply delay cannot be less than 24 hours.');
    }
    data.minReplyDelayHours = hours;
  }
  if (input.autoPublishEnabled !== undefined) data.autoPublishEnabled = input.autoPublishEnabled;
  if (input.active !== undefined) data.active = input.active;

  const business = await prisma.business.update({ where: { id }, data });

  await logEvent({
    event: 'business.updated',
    message: `Updated ${Object.keys(data).join(', ') || 'nothing'}`,
    businessId: id,
  });

  return business;
}

export async function deleteBusiness(id: string): Promise<void> {
  const business = await getBusinessOrThrow(id);
  // Cascades to oauth, locations, reviews, drafts, cron runs and logs.
  await prisma.business.delete({ where: { id } });
  await logEvent({
    event: 'business.deleted',
    message: `Deleted business "${business.name}" and all of its reviews`,
    level: 'WARN',
  });
}

export async function selectBusiness(id: string): Promise<Business> {
  const business = await getBusinessOrThrow(id);
  const jar = await cookies();
  jar.set(BUSINESS_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return business;
}
