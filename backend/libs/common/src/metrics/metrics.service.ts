import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client';

type HttpLabelValues = {
  method: string;
  route: string;
  status_code: number | string;
  service: string;
};

type CqrsLabelValues = {
  name: string;
  status: 'success' | 'error';
  service: string;
};

type OutboxLabelValues = {
  topic: string;
  event_name: string;
  status: 'published' | 'failed' | 'retry';
  service: string;
};

type InboxLabelValues = {
  topic: string;
  event_name: string;
  status: 'received' | 'processed' | 'failed' | 'duplicate';
  service: string;
};

// Global CQRS metrics for access from base handlers (singleton pattern)
let globalCqrsMetrics: CqrsMetricsInstance | null = null;
let globalInboxOutboxMetrics: InboxOutboxMetricsInstance | null = null;

export interface CqrsMetricsInstance {
  observeCommand(name: string, durationSeconds: number, status: 'success' | 'error'): void;
  observeQuery(name: string, durationSeconds: number, status: 'success' | 'error'): void;
  observeDomainEvent(name: string, durationSeconds: number, status: 'success' | 'error'): void;
}

export interface InboxOutboxMetricsInstance {
  // Outbox metrics
  observeOutboxEvent(
    topic: string,
    eventName: string,
    durationSeconds: number,
    status: 'published' | 'failed' | 'retry',
  ): void;
  setOutboxQueueSize(size: number): void;
  // Inbox metrics
  observeInboxEvent(
    topic: string,
    eventName: string,
    durationSeconds: number,
    status: 'received' | 'processed' | 'failed' | 'duplicate',
  ): void;
  setInboxQueueSize(size: number): void;
}

/**
 * Get the global CQRS metrics instance for recording metrics from base handlers.
 * Returns null if MetricsService hasn't been initialized yet.
 */
export function getCqrsMetrics(): CqrsMetricsInstance | null {
  return globalCqrsMetrics;
}

/**
 * Get the global inbox/outbox metrics instance.
 * Returns null if MetricsService hasn't been initialized yet.
 */
export function getInboxOutboxMetrics(): InboxOutboxMetricsInstance | null {
  return globalInboxOutboxMetrics;
}

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  readonly contentType: string;

  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;

  // CQRS Metrics
  private readonly commandsTotal: Counter<string>;
  private readonly commandDuration: Histogram<string>;
  private readonly queriesTotal: Counter<string>;
  private readonly queryDuration: Histogram<string>;
  private readonly domainEventsTotal: Counter<string>;
  private readonly domainEventDuration: Histogram<string>;

  // Outbox Metrics
  private readonly outboxEventsTotal: Counter<string>;
  private readonly outboxEventDuration: Histogram<string>;
  private readonly outboxQueueSize: Gauge<string>;

  // Inbox Metrics
  private readonly inboxEventsTotal: Counter<string>;
  private readonly inboxEventDuration: Histogram<string>;
  private readonly inboxQueueSize: Gauge<string>;

  private readonly serviceName: string;

  constructor() {
    this.registry = new Registry();
    this.serviceName = process.env.SERVICE_NAME ?? process.env.KAFKA_SERVICE_ID ?? 'service-1';
    this.registry.setDefaultLabels({ service: this.serviceName });

    collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'] as const,
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // CQRS Command Metrics
    this.commandsTotal = new Counter({
      name: 'cqrs_commands_total',
      help: 'Total number of CQRS commands executed',
      labelNames: ['name', 'status', 'service'] as const,
      registers: [this.registry],
    });

    this.commandDuration = new Histogram({
      name: 'cqrs_command_duration_seconds',
      help: 'CQRS command execution duration in seconds',
      labelNames: ['name', 'status', 'service'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // CQRS Query Metrics
    this.queriesTotal = new Counter({
      name: 'cqrs_queries_total',
      help: 'Total number of CQRS queries executed',
      labelNames: ['name', 'status', 'service'] as const,
      registers: [this.registry],
    });

    this.queryDuration = new Histogram({
      name: 'cqrs_query_duration_seconds',
      help: 'CQRS query execution duration in seconds',
      labelNames: ['name', 'status', 'service'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // Domain Event Metrics
    this.domainEventsTotal = new Counter({
      name: 'cqrs_domain_events_total',
      help: 'Total number of domain events handled',
      labelNames: ['name', 'status', 'service'] as const,
      registers: [this.registry],
    });

    this.domainEventDuration = new Histogram({
      name: 'cqrs_domain_event_duration_seconds',
      help: 'Domain event handling duration in seconds',
      labelNames: ['name', 'status', 'service'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // Outbox Metrics
    this.outboxEventsTotal = new Counter({
      name: 'outbox_events_total',
      help: 'Total number of outbox events processed',
      labelNames: ['topic', 'event_name', 'status', 'service'] as const,
      registers: [this.registry],
    });

    this.outboxEventDuration = new Histogram({
      name: 'outbox_event_duration_seconds',
      help: 'Outbox event publish duration in seconds',
      labelNames: ['topic', 'event_name', 'status', 'service'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.outboxQueueSize = new Gauge({
      name: 'outbox_queue_size',
      help: 'Number of pending outbox events',
      labelNames: ['service'] as const,
      registers: [this.registry],
    });

    // Inbox Metrics
    this.inboxEventsTotal = new Counter({
      name: 'inbox_events_total',
      help: 'Total number of inbox events processed',
      labelNames: ['topic', 'event_name', 'status', 'service'] as const,
      registers: [this.registry],
    });

    this.inboxEventDuration = new Histogram({
      name: 'inbox_event_duration_seconds',
      help: 'Inbox event processing duration in seconds',
      labelNames: ['topic', 'event_name', 'status', 'service'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.inboxQueueSize = new Gauge({
      name: 'inbox_queue_size',
      help: 'Number of pending inbox events',
      labelNames: ['service'] as const,
      registers: [this.registry],
    });

    this.contentType = this.registry.contentType;

    // Set global CQRS metrics instance for access from base handlers
    globalCqrsMetrics = {
      observeCommand: this.observeCommand.bind(this),
      observeQuery: this.observeQuery.bind(this),
      observeDomainEvent: this.observeDomainEvent.bind(this),
    };

    // Set global inbox/outbox metrics instance
    globalInboxOutboxMetrics = {
      observeOutboxEvent: this.observeOutboxEvent.bind(this),
      setOutboxQueueSize: this.setOutboxQueueSize.bind(this),
      observeInboxEvent: this.observeInboxEvent.bind(this),
      setInboxQueueSize: this.setInboxQueueSize.bind(this),
    };
  }

  // CQRS Metric Methods
  observeCommand(name: string, durationSeconds: number, status: 'success' | 'error') {
    const labels: CqrsLabelValues = { name, status, service: this.serviceName };
    this.commandsTotal.inc(labels);
    this.commandDuration.observe(labels, durationSeconds);
  }

  observeQuery(name: string, durationSeconds: number, status: 'success' | 'error') {
    const labels: CqrsLabelValues = { name, status, service: this.serviceName };
    this.queriesTotal.inc(labels);
    this.queryDuration.observe(labels, durationSeconds);
  }

  observeDomainEvent(name: string, durationSeconds: number, status: 'success' | 'error') {
    const labels: CqrsLabelValues = { name, status, service: this.serviceName };
    this.domainEventsTotal.inc(labels);
    this.domainEventDuration.observe(labels, durationSeconds);
  }

  // Outbox Metric Methods
  observeOutboxEvent(
    topic: string,
    eventName: string,
    durationSeconds: number,
    status: 'published' | 'failed' | 'retry',
  ) {
    const labels: OutboxLabelValues = {
      topic,
      event_name: eventName,
      status,
      service: this.serviceName,
    };
    this.outboxEventsTotal.inc(labels);
    this.outboxEventDuration.observe(labels, durationSeconds);
  }

  setOutboxQueueSize(size: number) {
    this.outboxQueueSize.set({ service: this.serviceName }, size);
  }

  // Inbox Metric Methods
  observeInboxEvent(
    topic: string,
    eventName: string,
    durationSeconds: number,
    status: 'received' | 'processed' | 'failed' | 'duplicate',
  ) {
    const labels: InboxLabelValues = {
      topic,
      event_name: eventName,
      status,
      service: this.serviceName,
    };
    this.inboxEventsTotal.inc(labels);
    this.inboxEventDuration.observe(labels, durationSeconds);
  }

  setInboxQueueSize(size: number) {
    this.inboxQueueSize.set({ service: this.serviceName }, size);
  }

  startHttpRequestTimer(labels: Partial<HttpLabelValues>) {
    const fullLabels = {
      method: labels.method || 'GET',
      route: labels.route || 'unknown',
      status_code: (labels.status_code ?? '200').toString(),
      service: this.serviceName,
    } as const;
    return this.httpRequestDuration.startTimer(fullLabels);
  }

  observeHttpRequest(labels: Partial<HttpLabelValues>, durationSeconds: number) {
    const fullLabels = {
      method: labels.method || 'GET',
      route: labels.route || 'unknown',
      status_code: (labels.status_code ?? 200).toString(),
      service: this.serviceName,
    } as const;
    this.httpRequestsTotal.inc(fullLabels);
    this.httpRequestDuration.observe(fullLabels, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}
