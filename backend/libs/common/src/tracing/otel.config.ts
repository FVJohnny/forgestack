import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export function initializeOpenTelemetry() {
  const tracesEnabled = process.env.OTEL_TRACES_ENABLED === 'true';
  const metricsEnabled = process.env.OTEL_METRICS_ENABLED === 'true';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  const serviceName = process.env.SERVICE_NAME ?? 'nestjs-service';

  console.log('🔭 Initializing OpenTelemetry SDK...');
  console.log(`  - Service: ${serviceName}`);
  console.log(`  - Traces: ${tracesEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  - Metrics: ${metricsEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  - Endpoint: ${otlpEndpoint}`);

  // Set resource attributes via environment variables (NodeSDK will pick them up)
  process.env.OTEL_RESOURCE_ATTRIBUTES = [
    `${ATTR_SERVICE_NAME}=${serviceName}`,
    `${ATTR_SERVICE_VERSION}=${process.env.npm_package_version ?? '1.0.0'}`,
  ].join(',');

  const sdk = new NodeSDK({
    traceExporter: tracesEnabled
      ? new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        })
      : undefined,
    metricReader: metricsEnabled
      ? new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${otlpEndpoint}/v1/metrics`,
          }),
          exportIntervalMillis: 60000, // Export every 60 seconds
        })
      : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable instrumentations that might cause issues
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check endpoints
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
        },
        // Configure Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // Configure NestJS instrumentation
        '@opentelemetry/instrumentation-nestjs-core': {
          enabled: true,
        },
        // Database instrumentations
        '@opentelemetry/instrumentation-mongodb': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        // Kafka instrumentation
        '@opentelemetry/instrumentation-kafkajs': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();
  console.log('✅ OpenTelemetry SDK started successfully');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OpenTelemetry SDK shut down successfully'))
      .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
