import type { Repository } from '@libs/nestjs-common';
import type { User } from './user.aggregate';
import type { Id } from '@libs/nestjs-common';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface User_Repository extends Repository<User, Id> {}
