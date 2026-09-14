import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { trpc } from "@/providers/trpc";

/**
 * AuthGuard — opakowuje chronione strony.
 * Jeśli user nie jest zalogowany → przekierowanie na /login.
 * Jeśli jest zalogowany ale bez firmy → może tylko demo.
 */
export function AuthGuard({ children, requireAuth = false }: { 
  children: React.ReactNode; 
  requireAuth?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minut cache
  });

  useEffect(() => {
    if (requireAuth && !isLoading && !user) {
      navigate("/login", { state: { from: location.pathname } });
    }
  }, [user, isLoading, requireAuth, navigate, location]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Ładowanie…</div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return null; // Przekierowanie w useEffect
  }

  return <>{children}</>;
}
