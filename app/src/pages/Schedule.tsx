import { trpc } from "@/providers/trpc";
import { Circle, CalendarDays } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  placement: "text-emerald-400", vaccination: "text-red-400", weighing: "text-sky-400",
  feedChange: "text-amber-400", litter: "text-orange-400", treatment: "text-pink-400",
  sampling: "text-violet-400", washing: "text-cyan-400", disinfection: "text-teal-400",
  housePrep: "text-lime-400", sale: "text-emerald-300",
};
const TYPE_LABELS: Record<string, string> = {
  placement: "Przyjęcie", vaccination: "Szczepienie", weighing: "Ważenie",
  feedChange: "Zmiana paszy", litter: "Ściółka", treatment: "Leczenie",
  sampling: "Próby", washing: "Mycie", disinfection: "Dezynfekcja",
  housePrep: "Przygotowanie", sale: "Sprzedaż",
};

export default function Schedule() {
  const upcoming = trpc.org.upcomingSchedule.useQuery();
  const utils = trpc.useUtils();
  const toggle = trpc.org.toggleScheduleEvent.useMutation({
    onSuccess: () => utils.org.upcomingSchedule.invalidate(),
  });

  const rows = upcoming.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Harmonogram produkcji</h1>
        <p className="text-sm text-zinc-500">
          Generowany automatycznie przez Workflow Engine przy każdym przyjęciu piskląt · {rows.length} zadań otwartych
        </p>
      </div>

      <div className="space-y-1.5">
        {rows.map((e) => {
          const overdue = e.day < today;
          return (
            <div
              key={e.id}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
                overdue ? "border-red-900/50 bg-red-950/20" : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <button onClick={() => toggle.mutate({ id: e.id, done: true })} className="shrink-0 text-zinc-500 hover:text-emerald-400">
                <Circle className="h-5 w-5" />
              </button>
              <span className={`font-mono text-xs ${overdue ? "text-red-400" : "text-zinc-400"}`}>{e.day}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TYPE_COLORS[e.eventType] ?? "text-zinc-400"} bg-zinc-800`}>
                {TYPE_LABELS[e.eventType] ?? e.eventType}
              </span>
              <span className="flex-1 text-sm">{e.title}</span>
              <span className="font-mono text-xs text-zinc-500">{e.batchCode}</span>
              {overdue && <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-bold text-red-300">PO TERMINIE</span>}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-500">
            <CalendarDays className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
            Brak otwartych zadań — wszystko wykonane.
          </div>
        )}
      </div>
    </div>
  );
}
