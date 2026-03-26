import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { env } from "./config.js";
import type { JwtPayload } from "./types.js";
import type { SignOptions } from "jsonwebtoken";

const ACCESS_COOKIE_NAME = "rtu_access_token";
const REFRESH_COOKIE_NAME = "rtu_refresh_token";

export const cookieNames = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME
};

function cookieConfig(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeMs
  };
}

function parseExpiryToMs(ttl: string): number {
  if (ttl.endsWith("d")) {
    return Number(ttl.replace("d", "")) * 24 * 60 * 60 * 1000;
  }
  if (ttl.endsWith("h")) {
    return Number(ttl.replace("h", "")) * 60 * 60 * 1000;
  }
  if (ttl.endsWith("m")) {
    return Number(ttl.replace("m", "")) * 60 * 1000;
  }
  return 15 * 60 * 1000;
}

export function signAccessToken(sub: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"]
  };
  return jwt.sign({ sub, email, type: "access" } satisfies JwtPayload, env.JWT_ACCESS_SECRET, {
    ...options
  });
}

export function signRefreshToken(sub: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"]
  };
  return jwt.sign({ sub, email, type: "refresh" } satisfies JwtPayload, env.JWT_REFRESH_SECRET, {
    ...options
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

export async function compareSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
  response.cookie(
    cookieNames.access,
    accessToken,
    cookieConfig(parseExpiryToMs(env.ACCESS_TOKEN_TTL))
  );
  response.cookie(
    cookieNames.refresh,
    refreshToken,
    cookieConfig(parseExpiryToMs(env.REFRESH_TOKEN_TTL))
  );
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(cookieNames.access, { path: "/" });
  response.clearCookie(cookieNames.refresh, { path: "/" });
}
