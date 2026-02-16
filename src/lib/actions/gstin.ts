'use server';

import { validateGSTIN } from '@/lib/utils/gstin';

export type GSTINValidationResult =
  | { valid: false; error: string }
  | { valid: true; verified?: boolean; businessName?: string };

/**
 * Validates GSTIN format (regex) and optionally verifies via Idfy API.
 * Non-blocking: validation is for B2B users who want input tax credit.
 */
export async function validateGSTINAction(gstin: string): Promise<GSTINValidationResult> {
  const trimmed = gstin.trim();
  if (!trimmed) {
    return { valid: true };
  }
  if (trimmed.length !== 15) {
    return { valid: false, error: 'GSTIN must be 15 characters' };
  }
  if (!validateGSTIN(trimmed)) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }
  // WYSHKIT 2026: External KYC (IDfy) is deferred to partner-specific flow.
  // We proceed as valid as long as the initial regex/length check passed.
  return { valid: true };
}
