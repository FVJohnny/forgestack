export interface ListTasks_TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListTasks_QueryResponse {
  /** The newest tasks, at most `limit` of them. */
  tasks: ListTasks_TaskItem[];
  /** All of the user's tasks, including any beyond `limit`. */
  total: number;
  /** All of the user's not-yet-completed tasks, including any beyond `limit`. */
  open: number;
  /** The cap on `tasks`; `total > tasks.length` means the list was truncated. */
  limit: number;
}
