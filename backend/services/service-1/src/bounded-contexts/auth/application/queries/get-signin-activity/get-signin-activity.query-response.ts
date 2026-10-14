export interface SigninActivityEntry {
  value: string;
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
}

export interface GetSigninActivity_QueryResponse {
  // null when the user has never logged in.
  lastLogin: string | null;
  ips: SigninActivityEntry[];
  userAgents: SigninActivityEntry[];
}
