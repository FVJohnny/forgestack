import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka, Producer } from 'kafkajs';

import { createKafkaConfig, createKafkaConsumerConfig } from './kafka-config.helper';

/**
 * Generic Kafka service that provides both consumer and publisher functionality.
 * Can be used by any NestJS service that needs Kafka integration.
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer;
  private producer: Producer;

  constructor() {
    // Use shared configuration helper
    const kafkaConfig = createKafkaConfig();
    const kafka = new Kafka(kafkaConfig);

    const consumerConfig = createKafkaConsumerConfig(kafkaConfig.clientId || 'default-group');
    this.consumer = kafka.consumer(consumerConfig);
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await Promise.all([this.consumer.connect(), this.producer.connect()]);
  }

  async onModuleDestroy() {
    await Promise.all([this.consumer.disconnect(), this.producer.disconnect()]);
  }

  getConsumer(): Consumer {
    return this.consumer;
  }

  getProducer(): Producer {
    return this.producer;
  }
}
