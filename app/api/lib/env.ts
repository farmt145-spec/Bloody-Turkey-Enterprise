import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    console.warn(`[env] Brak zmiennej ${name} — funkcja powiązana będzie nieaktywna`);
  }
  return value ?? fallback;
}

export const env = {
  // Kimi OAuth — opcjonalne poza platformą Kimi; bez nich logowanie OAuth jest nieaktywne, reszta systemu działa
  appId: optional("APP_ID"),
  appSecret: optional("APP_SECRET", process.env.JWT_SECRET || "bloody-turkey-dev-secret"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: optional("KIMI_AUTH_URL"),
  kimiOpenUrl: optional("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "/mnt/agents/output/uploads",
};
