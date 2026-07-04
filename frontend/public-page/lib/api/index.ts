/**
 * API Module
 * Central export point for all API-related functionality
 */

export * from './client';
export * from './config';
export * from './types';
export * from './error-handler';
// The auth service lives in lib/contexts/auth-service (imported directly).
export { analyticsService } from './services/analytics.service';
