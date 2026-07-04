import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { Motd } from '@bc/auth/domain/aggregates/motd/motd.aggregate';
import { Motd_Repository } from '@bc/auth/domain/aggregates/motd/motd.repository';
import { MotdDTO } from '@bc/auth/domain/aggregates/motd/motd.dto';
import { type RepositoryContext } from '@libs/nestjs-common';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class Motd_MongodbRepository
  extends Base_MongoRepository<Motd, MotdDTO>
  implements Motd_Repository
{
  static readonly CollectionName = 'auth_motd';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, Motd_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: MotdDTO): Motd {
    return Motd.fromValue(dto);
  }

  async findCurrent(context?: RepositoryContext): Promise<Motd | null> {
    try {
      const session = this.getTransactionSession(context);
      const document = await this.collection.findOne(
        { id: '86586c15-3a09-427d-99ba-0c1a8b6fc2a1' },
        { session },
      );

      if (!document) {
        return null;
      }

      return Motd.fromValue(document);
    } catch (error: unknown) {
      this.handleDatabaseError('findCurrent', '86586c15-3a09-427d-99ba-0c1a8b6fc2a1', error);
    }
  }

  async deleteCurrent(context?: RepositoryContext): Promise<void> {
    try {
      const session = this.getTransactionSession(context);
      await this.collection.deleteOne({ id: '86586c15-3a09-427d-99ba-0c1a8b6fc2a1' }, { session });
    } catch (error: unknown) {
      this.handleDatabaseError('deleteCurrent', '86586c15-3a09-427d-99ba-0c1a8b6fc2a1', error);
    }
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: {
          unique: true,
          name: 'idx_motd_id',
        },
      },
    ];
  }
}
