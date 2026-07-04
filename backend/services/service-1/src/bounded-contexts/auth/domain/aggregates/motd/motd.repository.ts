import type { Repository } from '@libs/nestjs-common';
import type { Motd } from './motd.aggregate';
import type { Id } from '@libs/nestjs-common';

export const MOTD_REPOSITORY = Symbol('Motd_Repository');

export interface Motd_Repository extends Repository<Motd, Id> {
  findCurrent(): Promise<Motd | null>;
  deleteCurrent(): Promise<void>;
}
