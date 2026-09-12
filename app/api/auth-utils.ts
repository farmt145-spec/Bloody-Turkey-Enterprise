import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number, companyId: number): string {
  return jwt.sign(
    { userId, companyId, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

export function verifyToken(token: string): { userId: number; companyId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; companyId: number };
    return decoded;
  } catch {
    return null;
  }
}

