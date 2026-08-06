import api from "./api";

export const login = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

export const signup = (name: string, email: string, password: string) =>
  api.post("/auth/signup", { name, email, password });
