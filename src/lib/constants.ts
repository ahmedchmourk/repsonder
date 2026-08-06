/**
 * Shared vocabulary for the routing pipeline. SQLite has no enums, so these
 * string unions are the single source of truth for the values stored in the DB.
 */

export const STATUS = {
  /** Ingested from Google, not yet run through the pipeline. */
  NEW: 'NEW',
  /** 4.0–5.0: draft generated, waiting for the 24h delay to elapse. */
  SCHEDULED: 'SCHEDULED',
  /** 3.0–3.9: draft generated, a human must approve it. */
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  /** 1.0–2.9 or sensitive: no public draft, human must write the reply. */
  NEEDS_HUMAN_ATTENTION: 'NEEDS_HUMAN_ATTENTION',
  /** Reply successfully sent to Google. */
  PUBLISHED: 'PUBLISHED',
  /** Human decided not to reply. */
  DISMISSED: 'DISMISSED',
  /** Publish attempt failed repeatedly. */
  FAILED: 'FAILED',
} as const;

export type ReviewStatus = (typeof STATUS)[keyof typeof STATUS];

export const ROUTE = {
  AUTO_REPLY: 'AUTO_REPLY',
  APPROVAL: 'APPROVAL',
  ESCALATION: 'ESCALATION',
} as const;

export type ReviewRoute = (typeof ROUTE)[keyof typeof ROUTE];

/** Statuses that surface in the "Auto-Replied" view. */
export const AUTO_REPLIED_STATUSES: ReviewStatus[] = [
  STATUS.SCHEDULED,
  STATUS.PUBLISHED,
];

export const MAX_PUBLISH_ATTEMPTS = 5;

/**
 * `approvedBy` marker for reviews that already carried a reply on Google when
 * Responder first saw them. Recorded so the pipeline never replies twice.
 */
export const EXTERNAL_REPLY_MARKER = 'GOOGLE_EXISTING';

/**
 * Keyword pre-filter for sensitive content. This runs before the LLM check so
 * that legal/safety topics are caught even if the LLM is unavailable.
 */
export const SENSITIVE_KEYWORDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(lawyer|attorney|solicitor|lawsuit|sue|suing|sued|litigat\w*|legal action|small claims)\b/i, reason: 'Legal threat' },
  { pattern: /\b(discriminat\w*|racist|racism|sexist|sexism|homophob\w*|transphob\w*|antisemit\w*|islamophob\w*|slur)\b/i, reason: 'Discrimination allegation' },
  { pattern: /\b(harass\w*|assault\w*|abuse|abusive|threaten\w*|violent|violence|groped|stalk\w*)\b/i, reason: 'Harassment or violence' },
  { pattern: /\b(food poisoning|poisoned|salmonella|e\.?\s?coli|listeria|norovirus|hospital|emergency room|\ber\b|ambulance|allergic reaction|anaphyla\w*)\b/i, reason: 'Health or safety incident' },
  { pattern: /\b(injur\w*|hurt myself|broke my|bleeding|burned|burnt me|fell|slip and fall)\b/i, reason: 'Physical injury' },
  { pattern: /\b(steal|stole|stolen|theft|fraud|scam|scamm\w*|rip off|ripped me off|overcharg\w*|unauthori[sz]ed charge|chargeback)\b/i, reason: 'Fraud or theft allegation' },
  { pattern: /\b(health department|health inspector|food safety|fda|osha|police|reported (you|them) to)\b/i, reason: 'Regulatory complaint' },
  { pattern: /\b(data breach|privacy|gdpr|personal (data|information) )\b/i, reason: 'Privacy concern' },
  { pattern: /\b(died|death|passed away|fatal|overdose|suicide)\b/i, reason: 'Death or self-harm reference' },
  { pattern: /\b(refund|money back|compensation)\b.{0,40}\b(demand|owed|entitled|immediately)\b/i, reason: 'Escalated refund demand' },
];

/** Google's star ratings arrive as enum names on the API. */
export const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  STAR_RATING_UNSPECIFIED: 0,
};

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/business.manage'];
