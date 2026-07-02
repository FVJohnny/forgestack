import { Injectable, Inject } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { User } from '@bc/notifications/domain/aggregates/user/user.aggregate';
import { User_Repository } from '@bc/notifications/domain/aggregates/user/user.repository';
import { UserDTO } from '@bc/notifications/domain/aggregates/user/user.dto';
import { MONGO_CLIENT_TOKEN, Base_MongoRepository, IndexSpec } from '@libs/nestjs-mongodb';

@Injectable()
export class User_MongodbRepository
  extends Base_MongoRepository<User, UserDTO>
  implements User_Repository
{
  static readonly CollectionName = 'notifications_users';

  constructor(@Inject(MONGO_CLIENT_TOKEN) mongoClient: MongoClient) {
    super(mongoClient, User_MongodbRepository.CollectionName);
  }

  protected toEntity(dto: UserDTO): User {
    return User.fromValue(dto);
  }

  protected defineIndexes(): IndexSpec[] {
    return [
      {
        fields: { id: 1 },
        options: { unique: true, name: 'ux_aggregate_id' },
      },
    ];
  }
}
