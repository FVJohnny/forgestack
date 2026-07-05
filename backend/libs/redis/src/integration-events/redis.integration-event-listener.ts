import {
  Base_IntegrationEventListener,
  InboxService,
  type ParsedIntegrationMessage,
} from '@libs/nestjs-common';
import { Inject, Injectable, Optional } from '@nestjs/common';

import { RedisService } from '../redis.service';

/**
 * Redis implementation of EventListener
 * Provides event listening through Redis pub/sub
 */
@Injectable()
export class RedisIntegrationEventListener extends Base_IntegrationEventListener {
  constructor(
    @Inject() private readonly redisService: RedisService,
    @Inject() @Optional() inboxService?: InboxService,
  ) {
    super(inboxService);
  }

  protected async subscribeToTopic(topicName: string) {
    const client = this.redisService.getSubscriberClient();
    if (!client) {
      this.logger.warn(`No Redis subscriber client available, cannot subscribe to ${topicName}`);
      return;
    }

    try {
      // Subscribe to the Redis channel
      await client.subscribe(topicName);

      // Set up message handler (only once, not for each topic)
      if (!client.listenerCount('message')) {
        client.on('message', (channel: string, message: string) => {
          // Redis pub/sub has no redelivery, so a malformed message can only
          // be logged and skipped. Parse inside the try: a synchronous throw
          // in an ioredis event handler would otherwise escape as an
          // uncaught exception.
          let parsed: ParsedIntegrationMessage;
          try {
            parsed = this.parseMessage(message);
          } catch (error) {
            this.logger.error(
              `Skipping malformed Redis message on channel '${channel}': ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return;
          }
          this.handleMessage(channel, parsed).catch((error: Error) => this.logger.error(error));
        });
      }

      this.logger.log(`Subscribed to Redis topic/channel: ${topicName}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to Redis topic/channel ${topicName}:`, error as Error);
      throw error;
    }
  }

  protected async unsubscribeFromTopic(topicName: string) {
    const client = this.redisService.getSubscriberClient();
    if (!client) {
      this.logger.warn(
        `No Redis subscriber client available, cannot unsubscribe from ${topicName}`,
      );
      return;
    }

    try {
      await client.unsubscribe(topicName);
      this.logger.log(`Unsubscribed from Redis channel: ${topicName}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from Redis channel ${topicName}:`, error as Error);
    }
  }

  protected parseMessage(rawMessage: string): ParsedIntegrationMessage {
    let parsedMessage: Record<string, unknown>;
    try {
      parsedMessage = JSON.parse(rawMessage);
    } catch (error) {
      throw new Error(
        `Unparseable Redis message JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // The id is what the inbox dedupes on, so it must be stable. Redis
    // pub/sub has no message key, so the payload id is the only source.
    // Never fabricate one (e.g. a timestamp) — that would silently break
    // idempotency by making every redelivery look like a new message.
    const id = parsedMessage.id as string;
    if (!id) {
      throw new Error('Redis message has no payload id; cannot dedupe it in the inbox.');
    }

    return { ...parsedMessage, id, name: parsedMessage.name as string };
  }
}
