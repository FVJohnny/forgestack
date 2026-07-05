/**
 * A single tracked identity signal (an IP or a user-agent) with first/last-seen
 * timestamps and a hit count. Shared by the User aggregate and the list-users
 * read model, so it lives in one place instead of being redeclared per file.
 */
export interface IdentityEntry {
  value: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}
