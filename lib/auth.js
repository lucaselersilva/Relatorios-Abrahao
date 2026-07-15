import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET não configurado (.env)");
}

export const COOKIE_NAME = "portal_session";
const TOKEN_TTL = "7d";

export function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signSession(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifySession(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token && verifySession(token);
  if (!payload) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}
