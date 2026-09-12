import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, Mail, Lock, ArrowRight } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/providers/auth";
import { toast } from "sonner";

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });

  const loginMutation = trpc.auth.login.useQuery(form, {
    enabled: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Uzupełnij wszystkie pola");
      return;
    }
    
    try {
      const result = await loginMutation.refetch();
      if (result.data) {
        login(result.data);
        toast.success("Zalogowano!");
        setTimeout(() => nav("/wybierz-gospodarstwo"), 500);
      }
    } catch (err: any) {
      toast.error(err.message || "Błąd przy logowaniu");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/20 text-red-500">
              <Bird className="h-7 w-7" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-wide text-zinc-100">BLOODY TURKEY</h1>
          <p className="mt-1 text-sm text-zinc-500">Intelligent Poultry Production OS</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h2 className="mb-6 text-lg font-semibold text-zinc-200">Zaloguj się</h2>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Mail className="h-4 w-4 text-zinc-500" />
              Email
            </label>
            <input
              type="email"
              placeholder="admin@farmakowalski.pl"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Lock className="h-4 w-4 text-zinc-500" />
              Hasło
            </label>
            <input
              type="password"
              placeholder="Twoje hasło"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-700"
          >
            {loginMutation.isPending ? "Logowanie..." : "Zaloguj się"}
            {!loginMutation.isPending && <ArrowRight className="h-4 w-4" />}
          </button>

          <div className="text-center text-sm text-zinc-500">
            Nie masz konta?{" "}
            <button
              type="button"
              onClick={() => nav("/signup")}
              className="text-emerald-400 hover:underline"
            >
              Załóż teraz
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Demo: admin@demo.pl / demo123456
        </p>
      </div>
    </div>
  );
}

