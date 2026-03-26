import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";
import { cookieNames, verifyAccessToken } from "./auth.js";
import { isAdminRole } from "./roles.js";

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const cookieToken = request.cookies?.[cookieNames.access] as string | undefined;
    const bearer = request.headers.authorization?.replace("Bearer ", "");
    const token = cookieToken ?? bearer;

    if (!token) {
      response.status(401).json({ message: "Not authenticated" });
      return;
    }

    const payload = verifyAccessToken(token);
    if (payload.type !== "access") {
      response.status(401).json({ message: "Invalid token type" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      response.status(401).json({ message: "User not found" });
      return;
    }

    request.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roleLabel: user.roleLabel,
      isGuest: user.isGuest
    };
    next();
  } catch {
    response.status(401).json({ message: "Invalid token" });
  }
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (!request.user) {
    response.status(401).json({ message: "Not authenticated" });
    return;
  }

  if (!isAdminRole(request.user.roleLabel)) {
    response.status(403).json({ message: "Forbidden" });
    return;
  }

  next();
}
