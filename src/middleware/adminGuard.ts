import { NextFunction, Request, Response } from "express";
import { env } from "../utils/env";

export function adminGuard(req: Request, res: Response, next: NextFunction): void {
  if (!env.ragAdminToken) {
    next();
    return;
  }

  const providedToken = String(
    req.header("x-rag-admin-token")
    || req.header("authorization")?.replace(/^Bearer\s+/i, "")
    || ""
  ).trim();

  if (!providedToken || providedToken !== env.ragAdminToken) {
    res.status(401).json({ error: "Token administrativo invalido ou ausente" });
    return;
  }

  next();
}
