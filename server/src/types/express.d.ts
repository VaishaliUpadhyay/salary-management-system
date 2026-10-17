import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      now: Date;
      auth?: { sessionId: number; csrfToken: string; expiresAt: Date; user: { id: number; email: string } };
    }
  }
}
