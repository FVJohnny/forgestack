export interface ListTasks_TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListTasks_QueryResponse {
  tasks: ListTasks_TaskItem[];
  total: number;
}
