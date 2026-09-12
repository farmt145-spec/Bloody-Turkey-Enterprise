import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, Network, Scale, Wheat, HeartPulse, Coins, Bird,
  Truck, CalendarDays, Database, Menu, X, Workflow, BarChart3, BrainCircuit,
  Boxes, Search, Bell, ChevronRight, FlaskConical, Command, Crown, FileCheck, Cable, Factory, ClipboardList, BookOpen, FileText, RefreshCw, Users,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import ErrorBoundary from "./ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import { trpc } from "@/providers/trpc";
import { tierDef, TIERS, setTier } from "@/lib/editions";
import { getWorkspace } from "@/lib/workspace";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/centrum-decyzji", label: "Centrum Decyzji", icon: Command },
  { to: "/analityka", label: "Analityka", icon: BarChart3 },
  { to: "/raporty", label: "Raporty", icon: FileText },
  { to: "/admin", label: "Panel Admina", icon: Users },
  { to: "/ai", label: "AI Advisor", icon: BrainCircuit },
  { to: "/struktura", label: "Struktura", icon: Network },
  { to: "/obchod", label: "Obchód dnia", icon: ClipboardList },
  { to: "/produkcja", label: "Produkcja", icon: Scale },
  { to: "/transfery", label: "Transfery", icon: Truck },
  { to: "/harmonogram", label: "Harmonogram", icon: CalendarDays },
  { to: "/zywienie", label: "Żywienie", icon: Wheat },
  { to: "/laboratorium-zywienia", label: "AI Nutrition Lab", icon: FlaskConical },
  { to: "/normy", label: "Normy", icon: BookOpen },
  { to: "/magazyn", label: "Magazyn", icon: Database },
  { to: "/zdrowie", label: "Zdrowie", icon: HeartPulse },
  { to: "/ekonomia", label: "Ekonomia", icon: Coins },
  { to: "/erp/suppliers", label: "Moduły ERP", icon: Boxes },
  { to: "/erd", label: "Model danych (ERD)", icon: Workflow },
  { to: "/ubojnia", label: "Ubojnia", icon: Factory },
  { to: "/integracje", label: "Integracje", icon: Cable },
  { to: "/wersje", label: "Wersje produktu", icon: Crown },
  { to: "/raport-architektury", label: "Pokrycie architektury", icon: FileCheck },
];

const LABELS: Record<string, string> = {
  "": "Dashboard", "centrum-decyzji": "Centrum Decyzji", wersje: "Wersje produktu", "raport-architektury": "Pokrycie architektury", analityka: "Analityka", ai: "AI Advisor", struktura: "Struktura",
  produkcja: "Produkcja", obchod: "Obchód dnia", transfery: "Transfery", harmonogram: "Harmonogram", zywienie: "Żywienie", "laboratorium-zywienia": "AI Nutrition Lab", normy: "Normy",
  magazyn: "Magazyn", zdrowie: "Zdrowie", ekonomia: "Ekonomia", erp: "Moduły ERP", erd: "Model danych", integracje: "Integracje", ubojnia: "Ubojnia", raporty: "Raporty", admin: "Panel Admina"
};

function Breadcrumbs() {
  const loc = useLocation();
  const parts = loc.pathname.split("/").filter(Boolean);
  return (
    <nav className="hidden items-center gap-1 text-sm text-zinc-500 md:flex">
      <Link to="/" className="hover:text-zinc-300">Bloody Turkey</Link>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
          <span className={i === parts.length - 1 ? "font-medium text-zinc-200" : ""}>{LABELS[p] ?? p}</span>
        </span>
      ))}
    </nav>
  );
}


function TierSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = tierDef();
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${cur.badge}`}>
        <Crown className="h-3.5 w-3.5" /> {cur.name}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="border-b border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400">Wersja licencji (demo)</div>
          {TIERS.map((t) => (
            <button key={t.key} onClick={() => setTier(t.key)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-zinc-800 ${t.key === cur.key ? "bg-zinc-800/60" : ""}`}>
              <span className={t.color}>{t.name}</span>
              {t.key === cur.key && <span className="text-[10px] font-bold text-emerald-400">AKTYWNA</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FarmBadge() {
  const w = getWorkspace();
  if (!w) return null;
  return (
    <Link to="/wybierz-gospodarstwo" title="Zmień gospodarstwo"
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
        w.isDemo ? "border-amber-500/40 text-amber-400" : "border-emerald-700/50 text-emerald-400"
      }`}>
      {w.isDemo ? "DEMO · DANE TESTOWE · " : ""}{w.companyName} / {w.farmName}
    </Link>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const q = trpc.notifications.list.useQuery(undefined, { refetchInterval: 30000 });
  const markAll = trpc.notifications.markAllRead.useMutation({ onSuccess: () => q.refetch() });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => q.refetch() });
  const utils = trpc.useUtils();
  const scan = trpc.reports.generateAlerts.useMutation({
    onSuccess: (r) => {
      if (r.created.length > 0) utils.notifications.list.invalidate();
    },
  });
  const unread = (q.data ?? []).filter((n) => !n.read).length;

  /* Skan reguł alertowych — przy wejściu i co 5 min */
  useEffect(() => {
    scan.mutate();
    const t = setInterval(() => scan.mutate(), 5 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const sevCls = { info: "border-sky-500/30 text-sky-400", warning: "border-amber-500/30 text-amber-400", critical: "border-red-500/30 text-red-400" } as const;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <span className="text-sm font-semibold">Powiadomienia</span>
            <div className="flex items-center gap-3">
              <button onClick={() => scan.mutate()} disabled={scan.isPending}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${scan.isPending ? "animate-spin" : ""}`} /> Skanuj
              </button>
              {unread > 0 && <button onClick={() => markAll.mutate()} className="text-xs text-emerald-400 hover:underline">Oznacz wszystkie</button>}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(q.data ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm text-zinc-500">Brak powiadomień</div>}
            {(q.data ?? []).map((n) => (
              <button key={n.id} onClick={() => { markRead.mutate({ id: n.id }); setOpen(false); if (n.link) nav(n.link); }}
                className={`block w-full border-b border-zinc-800/60 px-4 py-3 text-left hover:bg-zinc-800/60 ${n.read ? "opacity-50" : ""}`}>
                <span className={`mr-2 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${sevCls[n.severity]}`}>{n.severity}</span>
                <span className="text-sm font-medium text-zinc-200">{n.title}</span>
                {n.body && <div className="mt-0.5 text-xs text-zinc-500">{n.body}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-zinc-900/95">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-red-500">
          <Bird className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide">BLOODY TURKEY</div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">ERP · {tierDef().name}</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}>
          <X className="h-5 w-5 text-zinc-400" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.filter((n) => {
        if (n.to === "/admin") return userRole === "admin" || userRole === "manager";
        return tierDef().routes.some((r) => (r === "/" ? n.to === "/" : n.to.startsWith(r)));
      }).map((n) => {
          const active = n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to) || (n.to.startsWith("/erp") && loc.pathname.startsWith("/erp"));
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-emerald-600/15 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 px-5 py-4 text-[11px] leading-relaxed text-zinc-500">
        Bloody Turkey Group S.A.
        <br />
        Intelligent Poultry Production OS v3.0
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Toaster position="top-right" richColors />
      <CommandPalette />

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/95 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
        <span className="text-sm font-bold">BLOODY TURKEY <span className="text-zinc-500">ERP</span></span>
        <div className="ml-auto flex items-center gap-2"><FarmBadge /><NotificationBell /></div>
      </div>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-zinc-800 lg:block">
        {sidebar}
      </aside>

      {/* desktop top bar: breadcrumb + search + bell */}
      <div className="sticky top-0 z-20 hidden items-center gap-4 border-b border-zinc-800 bg-zinc-950/90 px-8 py-3 backdrop-blur lg:ml-60 lg:flex">
        <Breadcrumbs />
        <div className="ml-auto flex items-center gap-2">
          <FarmBadge />
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          >
            <Search className="h-3.5 w-3.5" /> Szybkie wyszukiwanie
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 text-[10px] text-zinc-400">Ctrl K</kbd>
          </button>
          <TierSwitcher />
          <NotificationBell />
        </div>
      </div>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-zinc-800">{sidebar}</div>
        </div>
      )}

      <main className="p-4 sm:p-6 lg:ml-60 lg:p-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
