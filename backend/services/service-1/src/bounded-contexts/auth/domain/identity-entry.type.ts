/**
 * A single tracked identity signal (an IP, a user-agent, a device id, ...)
 * with first/last-seen timestamps and a hit count. Shared by the User and
 * UserIdentityMarker aggregates and the list-users read model, so it lives in
 * one place instead of being redeclared per file.
 */
export interface IdentityEntry {
  value: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}
