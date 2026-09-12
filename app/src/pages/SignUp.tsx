import { useState } from "react";
import { useNavigate } from "react-router";
import { Bird, Mail, Lock, Building2, Home } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/providers/auth";
import { toast } from "sonner";

export default function SignUp() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<"form" | "success">("form");
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    farmName: "",
  });

  const signup = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      toast.success("Konto założone! Zalogowano.");
      login(data);
      setStep("success");
      setTimeout(() => nav("/wybierz-gospodarstwo"), 2000);
    },
    onError: (err) => {
      toast.error(err.message || "Błąd przy rejestracji");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.passwordConfirm) {
      toast.error("Hasła się nie zgadzają");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Hasło musi mieć co najmniej 8 znaków");
      return;
    }
    signup.mutate({
      companyName: form.companyName,
      email: form.email,
      password: form.password,
      farmName: form.farmName,
    });
  };

  if (step === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-500">
            <Bird className="h-8 w-8" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-100">Gotowe!</h1>
          <p className="mb-6 text-zinc-400">
            Konto zostało założone. Za chwilę przejdziesz do logowania...
          </p>
        </div>
      </div>
    );
  }

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
          <h2 className="mb-6 text-lg font-semibold text-zinc-200">Nowe konto</h2>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Building2 className="h-4 w-4 text-zinc-500" />
              Nazwa firmy
            </label>
            <input
              type="text"
              placeholder="np. Farma Kowalski sp. z o.o."
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Home className="h-4 w-4 text-zinc-500" />
              Nazwa gospodarstwa
            </label>
            <input
              type="text"
              placeholder="np. Filia nr 1 - Drób"
              value={form.farmName}
              onChange={(e) => setForm({ ...form, farmName: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Mail className="h-4 w-4 text-zinc-500" />
              Email (login)
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
              placeholder="Min 8 znaków"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Lock className="h-4 w-4 text-zinc-500" />
              Powtórz hasło
            </label>
            <input
              type="password"
              placeholder="Potwierdź hasło"
              value={form.passwordConfirm}
              onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              required
            />
          </div>

          <button
            type="submit"
            disabled={signup.isPending}
            className="w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-700"
          >
            {signup.isPending ? "Tworzenie konta..." : "Załóż konto"}
          </button>

          <div className="text-center text-sm text-zinc-500">
            Już masz konto?{" "}
            <button
              type="button"
              onClick={() => nav("/login")}
              className="text-emerald-400 hover:underline"
            >
              Zaloguj się
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Zakładając konto akceptujesz nasze Warunki Usługi
        </p>
      </div>
    </div>
  );
}

