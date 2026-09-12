import { useState } from "react";
import { Mail, Trash2, Shield, User, Send, AlertCircle, CheckCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { getWorkspace } from "@/lib/workspace";

export default function AdminPanel() {
  const w = getWorkspace();
  const companyId = w?.companyId;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"worker" | "manager" | "admin">("worker");
  const [message, setMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const usersQuery = trpc.admin.users.useQuery({ companyId });
  const invitesQuery = trpc.admin.userInvites.useQuery({ companyId });

  const sendInvite = trpc.admin.sendInvite.useMutation({
    onSuccess: () => {
      setEmail("");
      setMessage("");
      setRole("worker");
      setInviteSuccess(`Zaproszenie wysłane do ${email}`);
      setTimeout(() => setInviteSuccess(""), 5000);
      invitesQuery.refetch();
    },
    onError: (err) => {
      setInviteError(err.message);
      setTimeout(() => setInviteError(""), 5000);
    },
  });

  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
    },
  });

  const cancelInvite = trpc.admin.cancelInvite.useMutation({
    onSuccess: () => {
      invitesQuery.refetch();
    },
  });

  const removeUser = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
    },
  });

  if (!companyId) return <div className="text-zinc-400">Brak wybranej firmy</div>;

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sendInvite.mutate({ companyId, email, role, message });
  };

  const roleLabel: Record<string, string> = {
    worker: "Pracownik",
    manager: "Kierownik",
    admin: "Administrator",
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
          <Mail className="h-5 w-5 text-emerald-400" /> Zaproś pracownika
        </h2>
        <form onSubmit={handleSendInvite} className="space-y-4">
          {inviteError && (
            <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-200">{inviteError}</span>
            </div>
          )}
          {inviteSuccess && (
            <div className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-emerald-200">{inviteSuccess}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              type="email"
              placeholder="Email pracownika"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="worker">Pracownik</option>
              <option value="manager">Kierownik</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <textarea
            placeholder="Wiadomość (opcjonalna)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
            rows={2}
          />
          <button
            type="submit"
            disabled={!email || sendInvite.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Wyślij zaproszenie
          </button>
        </form>
      </div>

      {/* Oczekujące zaproszenia */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
          <Mail className="h-5 w-5 text-amber-400" /> Oczekujące zaproszenia ({invitesQuery.data?.filter((i) => i.status === "pending").length ?? 0})
        </h2>
        <div className="space-y-2">
          {(invitesQuery.data ?? []).filter((i) => i.status === "pending").map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="flex-1">
                <div className="font-medium text-zinc-100">{inv.email}</div>
                <div className="text-xs text-zinc-500">{roleLabel[inv.role]} • wysłane {new Date(inv.sentAt!).toLocaleString()}</div>
              </div>
              <button
                onClick={() => cancelInvite.mutate({ inviteId: inv.id })}
                className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {(invitesQuery.data?.filter((i) => i.status === "pending").length ?? 0) === 0 && (
            <div className="text-center text-sm text-zinc-500 py-4">Brak oczekujących zaproszeń</div>
          )}
        </div>
      </div>

      {/* Użytkownicy w firmie */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
          <User className="h-5 w-5 text-sky-400" /> Pracownicy ({usersQuery.data?.length ?? 0})
        </h2>
        <div className="space-y-2">
          {(usersQuery.data ?? []).map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
              <div className="flex-1">
                <div className="font-medium text-zinc-100">{user.name || user.email}</div>
                <div className="text-xs text-zinc-500">{user.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={user.role === "admin" ? "admin" : "worker"}
                  onChange={(e) =>
                    updateRole.mutate({
                      userId: user.id,
                      role: (e.target.value === "admin" ? "admin" : "worker") as any,
                    })
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
                >
                  <option value="worker">Pracownik</option>
                  <option value="manager">Kierownik</option>
                  <option value="admin">Administrator</option>
                </select>
                <button
                  onClick={() => removeUser.mutate({ userId: user.id })}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {(usersQuery.data?.length ?? 0) === 0 && (
            <div className="text-center text-sm text-zinc-500 py-4">Brak pracowników</div>
          )}
        </div>
      </div>
    </div>
  );
}

