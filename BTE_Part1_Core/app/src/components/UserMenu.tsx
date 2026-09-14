import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

export function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      navigate("/login");
    },
  });

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    owner: "Właściciel",
    admin: "Administrator",
    user: "Pracownik",
    viewer: "Podgląd",
  };

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-medium text-zinc-200">{user.name}</div>
        <div className="text-xs text-zinc-500">{roleLabels[user.role] ?? user.role}</div>
      </div>

      <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-semibold">
        {user.name?.charAt(0).toUpperCase() ?? "?"}
      </div>

      <button
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        {logout.isPending ? "…" : "Wyloguj"}
      </button>
    </div>
  );
}
