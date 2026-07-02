/**
 * Parsed integration message structure
 * Used across all integration event listeners (Kafka, Redis, etc.)
 */
export interface ParsedIntegrationMessage extends Record<string, unknown> {
  id: string;
  name: string;
  metadata?: {
    traceId?: string;
    spanId?: string;
  };
}
