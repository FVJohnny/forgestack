'use client';

/**
 * Error Handler Utility
 * Handles API errors and displays toast notifications
 */

import { toast } from 'sonner';
import { APIError } from './client';

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
  statusCode?: number;
}

/**
 * Handles API errors and displays a toast notification
 * @param error - The error object to handle
 * @param fallbackMessage - Optional fallback message if error details are unavailable
 */
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

export function handleAPIError(error: unknown, fallbackMessage = 'An error occurred'): void {
  if (error instanceof APIError) {
    const errorData = error.data as ErrorResponse | undefined;

    // Try to extract error code and message from response.error.code and response.error.message
    const errorCode =
      errorData?.error?.code || errorData?.code || errorData?.statusCode || error.status;
    const errorMessage = errorData?.error?.message || errorData?.message || error.message;

    // Format the toast message with error code and message
    const toastMessage = errorCode ? `Error ${errorCode}: ${errorMessage}` : errorMessage;

    toast.error(toastMessage);
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error(fallbackMessage);
  }
}
