import { api } from "./client";
import type { Todo } from "@/types";

export async function listTodos(filters: {
  completed?: boolean;
  boardId?: string;
} = {}): Promise<Todo[]> {
  const { data } = await api.get<{ todos: Todo[]; total: number }>("/todos", {
    params: { completed: filters.completed, boardId: filters.boardId },
  });
  return data.todos;
}

export async function toggleTodo(id: string, isCompleted: boolean): Promise<void> {
  await api.patch(`/todos/${id}`, { isCompleted });
}

export async function createTodo(text: string): Promise<Todo> {
  const { data } = await api.post<Todo>("/todos", { text });
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  await api.delete(`/todos/${id}`);
}
