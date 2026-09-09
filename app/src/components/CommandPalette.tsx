import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Network, Scale, Wheat, HeartPulse, Coins, Truck, CalendarDays,
  Database, Workflow, BarChart3, BrainCircuit, Boxes, Plus, Bird,
} from "lucide-react";
import { ERP_MODULES } from "@/lib/erp-modules";

const PAGES = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/struktura", label: "Struktura organizacji", icon: Network },
  { to: "/produkcja", label: "Produkcja — rzuty", icon: Scale },
  { to: "/transfery", label: "Transfery", icon: Truck },
  { to: "/harmonogram", label: "Harmonogram produkcji", icon: CalendarDays },
  { to: "/zywienie", label: "Żywienie i receptury", icon: Wheat },
  { to: "/magazyn", label: "Magazyn i silosy", icon: Database },
  { to: "/zdrowie", label: "Zdrowie stada", icon: HeartPulse },
  { to: "/ekonomia", label: "Ekonomia", icon: Coins },
  { to: "/analityka", label: "Centrum analityczne", icon: BarChart3 },
  { to: "/ai", label: "AI Advisor", icon: BrainCircuit },
  { to: "/erd", label: "Model danych (ERD)", icon: Workflow },
];

const ACTIONS = [
  { to: "/produkcja?new=1", label: "Szybka akcja: nowy rzut", icon: Plus },
  { to: "/erp/tasks?new=1", label: "Szybka akcja: nowe zadanie", icon: Plus },
  { to: "/erp/maintenanceTickets?new=1", label: "Szybka akcja: zgłoszenie awarii", icon: Plus },
  { to: "/produkcja", label: "Szybka akcja: wpis do dziennika stada", icon: Bird },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    nav(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Szukaj strony, modułu lub akcji…" />
      <CommandList>
        <CommandEmpty>Brak wyników.</CommandEmpty>
        <CommandGroup heading="Nawigacja">
          {PAGES.map((p) => (
            <CommandItem key={p.to} onSelect={() => go(p.to)}>
              <p.icon className="mr-2 h-4 w-4 text-emerald-500" /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Szybkie akcje">
          {ACTIONS.map((a) => (
            <CommandItem key={a.label} onSelect={() => go(a.to)}>
              <a.icon className="mr-2 h-4 w-4 text-red-500" /> {a.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Moduły ERP">
          {ERP_MODULES.map((m) => (
            <CommandItem key={m.key} onSelect={() => go(`/erp/${m.key}`)}>
              <Boxes className="mr-2 h-4 w-4 text-zinc-400" /> {m.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
