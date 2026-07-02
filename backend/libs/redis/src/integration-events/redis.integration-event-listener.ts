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
          this.handleMessage(channel, this.parseMessage(message)).catch(this.logger.error);
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
    try {
      const parsedMessage = JSON.parse(rawMessage);

      const messageId =
        (parsedMessage.messageId as string) ||
        (parsedMessage.eventId as string) ||
        `redis-${Date.now()}`;

      return { id: messageId, name: parsedMessage.name, ...parsedMessage };
    } catch (error) {
      this.logger.error(`Error parsing Redis message: ${error}`);
      throw error;
    }
  }
}
