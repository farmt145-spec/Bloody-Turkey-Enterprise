export function getNetlifyBuildError(
  env: NodeJS.ProcessEnv,
  command: string,
): string | null {
  if (command !== "build" || env.NETLIFY !== "true") {
    return null;
  }

  if (env.VITE_API_URL?.trim()) {
    return null;
  }

  return "Missing required environment variable VITE_API_URL for Netlify builds. Set it to your deployed backend /api/trpc endpoint in Netlify site settings.";
}

export function assertNetlifyBuildEnv(
  env: NodeJS.ProcessEnv,
  command: string,
): void {
  const error = getNetlifyBuildError(env, command);

  if (error) {
    throw new Error(error);
  }
}
