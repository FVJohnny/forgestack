import type { IdentityEntry } from '@bc/auth/domain/identity-entry.type';

export type { IdentityEntry };

export interface ListUsers_QueryResponse {
  users: {
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    ips: string[]; // Array of unique IP addresses
    userAgents: string[]; // Array of unique User Agents
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
