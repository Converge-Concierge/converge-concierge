import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "admin" | "manager";
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId || req.session?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }
  next();
}

export function stripPassword<T extends { password?: string; username?: string }>(
  user: T
): Omit<T, "password" | "username"> {
  const { password: _, username: __, ...safe } = user;
  return safe;
}
