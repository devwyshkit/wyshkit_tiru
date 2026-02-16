"use server"

import { createClient } from '@/lib/supabase/server';
import { resolveUserPermissionsServer } from '@/lib/auth/server';
import type { UserPermissions } from '@/lib/auth/core';
import { getRedirectPath } from '@/lib/auth';
import { logger } from '@/lib/logging/logger';

/**
 * Gets the current user's permissions from the database.
 * Following the Wyshkit 2026 Unified Identity model.
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return {
        isAdmin: false,
        isPartner: false,
        isCustomer: false,
        partnerIds: [],
      };
    }

    return await resolveUserPermissionsServer(user.id);
  } catch (err) {
    logger.error('Unexpected error in getCurrentUserPermissions', err);
    return {
      isAdmin: false,
      isPartner: false,
      isCustomer: false,
      partnerIds: [],
    };
  }
}

/**
 * Server Action to verify OTP and handle redirect
 * WYSHKIT 2026: Supports multiple phone formats for test OTP compatibility
 */
export async function verifyOTPServerAction(phone: string, token: string, returnUrl?: string) {
  try {
    const supabase = await createClient();
    
    // WYSHKIT 2026: Try multiple formats for test OTP compatibility
    // Supabase test OTP config may use different formats:
    // 1. +91XXXXXXXXXX (E.164 format - standard)
    // 2. 91XXXXXXXXXX (without + prefix)
    // 3. XXXXXXXXXX (10 digits only - for India test numbers)
    const formatsToTry = [
      `+91${phone}`, // +91XXXXXXXXXX
      `91${phone}`, // 91XXXXXXXXXX
      phone, // XXXXXXXXXX (10 digits)
    ];

    let lastError: Error | null = null;
    
    for (const phoneFormat of formatsToTry) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneFormat,
        token,
        type: 'sms',
      });

      if (!error && data.user) {
        // Success - format matched Supabase config
        const permissions = await resolveUserPermissionsServer(data.user.id);
        const redirectPath = getRedirectPath(permissions, returnUrl);
        
        return { 
          success: true, 
          redirectPath,
          hasMultipleOutlets: permissions.partnerIds.length > 1,
          partnerIds: permissions.partnerIds
        };
      }

      if (error) {
        lastError = error;
        // Continue to next format if this one failed
        continue;
      }

      if (!data.user) {
        lastError = new Error('No user returned');
        continue;
      }
    }

    // All formats failed - return detailed error
    if (lastError) {
      const errorMsg = lastError.message.includes("expired") || lastError.message.includes("invalid")
        ? `Invalid or expired OTP. For test numbers, ensure: 1) Phone format matches Supabase config (tried: ${formatsToTry.join(", ")}), 2) OTP code matches configured test OTP. Current phone: ${phone}`
        : lastError.message;
      logger.error('OTP verification failed for all formats', lastError, { phone, formatsTried: formatsToTry });
      return { success: false, error: errorMsg };
    }

    logger.error('OTP verification failed - no error returned', { phone });
    return { success: false, error: 'OTP verification failed for all formats' };
  } catch (err) {
    logger.error('Unexpected error in verifyOTPServerAction', err, { phone });
    return { success: false, error: 'An unexpected error occurred' };
  }
}
