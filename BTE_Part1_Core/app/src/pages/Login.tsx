import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    companyName: "",
    createCompany: false,
  });
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: () => navigate("/"),
    onError: (e) => setError(e.message),
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: () => navigate("/"),
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      register.mutate({
        email: form.email,
        password: form.password,
        name: form.name,
        companyName: form.createCompany ? form.companyName : undefined,
        createCompany: form.createCompany,
      });
    } else {
      login.mutate({ email: form.email, password: form.password });
    }
  };

  const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-100">
            {isRegister ? "Rejestracja" : "Logowanie"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Bloody Turkey Enterprise
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-900/50 border border-red-700 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                className={inputCls}
                placeholder="Imię i nazwisko"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.createCompany}
                  onChange={(e) => setForm({ ...form, createCompany: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
                />
                Utwórz nową firmę
              </label>

              {form.createCompany && (
                <input
                  className={inputCls}
                  placeholder="Nazwa firmy"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                />
              )}
            </>
          )}

          <input
            className={inputCls}
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <input
            className={inputCls}
            type="password"
            placeholder="Hasło (min. 8 znaków)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={isRegister ? 8 : 1}
          />

          <button
            type="submit"
            disabled={login.isPending || register.isPending}
            className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {login.isPending || register.isPending
              ? "Przetwarzanie…"
              : isRegister
              ? "Zarejestruj się"
              : "Zaloguj się"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="text-sm text-zinc-400 hover:text-zinc-300"
          >
            {isRegister
              ? "Masz już konto? Zaloguj się"
              : "Nie masz konta? Zarejestruj się"}
          </button>
        </div>

        {/* Szybki dostęp do demo bez logowania */}
        <div className="mt-8 border-t border-zinc-800 pt-6 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            → Przejdź do demo bez logowania
          </button>
        </div>
      </div>
    </div>
  );
}
