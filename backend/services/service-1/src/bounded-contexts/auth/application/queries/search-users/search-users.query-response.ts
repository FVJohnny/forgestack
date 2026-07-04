export interface SearchUserResult {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}

export class SearchUsers_QueryResponse {
  users: SearchUserResult[];
}
