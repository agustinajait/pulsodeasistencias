import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/** Attaches req.auth when a valid Bearer token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.auth = verifyToken(header.slice(7));
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
}

/** Rejects requests that don't carry a valid token. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/**
 * Enforces that the token's centerId matches the provided centerId,
 * unless the token belongs to a superadmin.
 */
export function requireCenterAccess(centerId: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.auth.role === "superadmin" || req.auth.centerId === centerId) {
      next();
    } else {
      res.status(403).json({ error: "Forbidden" });
    }
  };
}
