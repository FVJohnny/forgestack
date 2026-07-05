'use client';

/**
 * Error Handler Utility
 */

import { APIError } from './client';

/**
 * Message for an error caught in a form. API failures always use the
 * caller's translated message, so users in non-English locales never see a
 * raw English backend string; `error.message` is reserved for unexpected
 * non-API errors, where debuggability beats translation.
 */
export function formErrorMessage(error: unknown, translatedMessage: string): string {
  if (error instanceof APIError) return translatedMessage;
  return error instanceof Error ? error.message : translatedMessage;
}
