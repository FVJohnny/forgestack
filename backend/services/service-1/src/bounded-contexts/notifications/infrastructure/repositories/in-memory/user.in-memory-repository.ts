import { Injectable } from '@nestjs/common';
import { User } from '@bc/notifications/domain/aggregates/user/user.aggregate';
import type { User_Repository } from '@bc/notifications/domain/aggregates/user/user.repository';
import { Base_InMemoryRepository } from '@libs/nestjs-common';
import type { UserDTO } from '@bc/notifications/domain/aggregates/user/user.dto';

@Injectable()
export class User_InMemoryRepository
  extends Base_InMemoryRepository<User, UserDTO>
  implements User_Repository
{
  constructor(shouldFail: boolean = false) {
    super(shouldFail);
  }

  protected toEntity(dto: UserDTO): User {
    return User.fromValue(dto);
  }
}
