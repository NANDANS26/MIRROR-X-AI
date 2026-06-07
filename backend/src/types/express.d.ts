import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string; // Or whatever custom properties your auth middleware injects
  user?: {
    id: string;
    role?: string;
  };
}