/**
 * Error handling utilities
 * Standardizes error handling across actions and API routes
 * Wyshkit 2026: Zero data mismatch, proper type safety
 */

import { NextResponse } from 'next/server';

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unexpected error occurred';
}

/**
 * Handle errors in server actions
 * Returns consistent error format
 * Wyshkit 2026: Clear error messages for debugging
 */
export function handleActionError(error: unknown): { error: string } {
  const message = getErrorMessage(error);
  
  // In development, include more details
  if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
    console.error('[Action Error]', error.stack);
  }
  
  return { error: message };
}

/**
 * Handle errors in API routes
 * Returns NextResponse with consistent error format
 */
export function handleAPIError(error: unknown, statusCode: number = 500): NextResponse {
  const errorMessage = getErrorMessage(error);

  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', error);
  }

  return NextResponse.json(
    { error: errorMessage },
    { status: statusCode }
  );
}

/**
 * Log error in development mode only
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    const prefix = context ? `[${context}]` : '[Error]';
    console.error(prefix, error);
  }
}
