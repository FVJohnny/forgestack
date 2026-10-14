import { Injectable } from '@nestjs/common';
import { Base_InMemoryRepository } from '@libs/nestjs-common';
import { User } from '@bc/tasks/domain/aggregates/user/user.aggregate';
import type { User_Repository } from '@bc/tasks/domain/aggregates/user/user.repository';
import type { UserDTO } from '@bc/tasks/domain/aggregates/user/user.dto';

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
