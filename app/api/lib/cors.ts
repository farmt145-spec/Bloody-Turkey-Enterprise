const DEV_CORS_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export function parseAllowedOrigins(value: string | undefined): string[] {
  return [...new Set((value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean))];
}

export function resolveCorsOrigin(
  origin: string,
  allowedOrigins: string[],
  isProduction: boolean,
): string | null {
  if (!origin) return null;
  if (allowedOrigins.includes(origin)) return origin;
  if (!isProduction && DEV_CORS_ORIGINS.has(origin)) return origin;
  return null;
}
