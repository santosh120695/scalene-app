import { api } from "./client";
import type { User } from "@/types";

interface AuthResponse {
  access_token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/register", {
    email,
    password,
    fullName,
  });
  return data;
}

export async function me(): Promise<User> {
  const { data } = await api.get<{ user: User }>("/auth/me");
  return data.user;
}
