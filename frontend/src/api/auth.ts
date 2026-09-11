import api from './client';
import type { User, TokenResponse } from '../types';

export const signup = (data: { email: string; full_name: string; password: string }) =>
  api.post<User>('/auth/signup', data).then((r) => r.data);

export const login = (data: { email: string; password: string }) =>
  api.post<TokenResponse>('/auth/login', data).then((r) => r.data);

export const getMe = () => api.get<User>('/auth/me').then((r) => r.data);
