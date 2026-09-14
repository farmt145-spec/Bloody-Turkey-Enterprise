import { useState, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";

/**
 * DIGITAL TWIN — 3D wizualizacja kurnika.
 * 
 * Funkcje:
 * - Rotacja, zoom, pan
 * - Wizualizacja ptaków (punkty)
 * - Wyposażenie: karmniki, poidła, wentylatory, ogrzewanie
 * - Strefy: karmienie, pojenie, odpoczynek
 * - Symulacja: rozmieszczenie karmników, wentylacja
 * - Heatmap gęstości
 */
export default function DigitalTwin() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"3d" | "top" | "side">("3d");
  const [showZones, setShowZones] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);
  const [showBirds, setShowBirds] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [rotation, setRotation] = useState({ x: -30, y: 45 });
  const [zoom, setZoom] = useState(1);
  const [simulationMode, setSimulationMode] = useState<"none" | "feeders" | "ventilation">("none");
  const [feederConfig, setFeederConfig] = useState({ type: "pan" as "pan" | "chain" | "tube", count: 10 });

  // Pobierz model kurnika
  const { data: model, isLoading } = trpc.digitalTwin.getModel.useQuery(
    { houseId: selectedHouseId! },
    { enabled: selectedHouseId != null }
  );

  // Symulacja karmników
  const { data: feederSim } = trpc.digitalTwin.simulateFeeders.useQuery(
    { houseId: selectedHouseId!, feederType: feederConfig.type, feederCount: feederConfig.count },
    { enabled: selectedHouseId != null && simulationMode === "feeders" }
  );

  // Symulacja wentylacji
  const { data: ventSim } = trpc.digitalTwin.simulateVentilation.useQuery(
    { houseId: selectedHouseId!, targetTempC: 22, outsideTempC: 20, outsideHumidityPct: 60 },
    { enabled: selectedHouseId != null && simulationMode === "ventilation" }
  );

  // Renderowanie canvas
  useEffect(() => {
    if (!canvasRef.current || !model) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Parametry kurnika
    const houseW = model.house.dimensions.lengthM * 20; // skala
    const houseH = model.house.dimensions.widthM * 20;
    const houseD = model.house.dimensions.heightM * 20;

    const cx = width / 2;
    const cy = height / 2;

    // Transformacja 3D → 2D
    const project3D = (x: number, y: number, z: number) => {
      const radX = (rotation.x * Math.PI) / 180;
      const radY = (rotation.y * Math.PI) / 180;

      // Rotacja Y
      const x1 = x * Math.cos(radY) - z * Math.sin(radY);
      const z1 = x * Math.sin(radY) + z * Math.cos(radY);

      // Rotacja X
      const y1 = y * Math.cos(radX) - z1 * Math.sin(radX);
      const z2 = y * Math.sin(radX) + z1 * Math.cos(radX);

      // Perspektywa
      const perspective = 400 / (400 + z2);
      const px = cx + x1 * perspective * zoom;
      const py = cy + y1 * perspective * zoom;

      return { x: px, y: py, scale: perspective };
    };

    // Rysuj ściany kurnika (szkielet)
    const drawHouse = () => {
      const corners = [
        // Dół
        project3D(-houseW/2, houseH/2, -houseD/2),
        project3D(houseW/2, houseH/2, -houseD/2),
        project3D(houseW/2, houseH/2, houseD/2),
        project3D(-houseW/2, houseH/2, houseD/2),
        // Góra
        project3D(-houseW/2, -houseH/2, -houseD/2),
        project3D(houseW/2, -houseH/2, -houseD/2),
        project3D(houseW/2, -houseH/2, houseD/2),
        project3D(-houseW/2, -houseH/2, houseD/2),
      ];

      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 2;

      // Ściany dolne
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.stroke();

      // Ściany górne
      ctx.beginPath();
      ctx.moveTo(corners[4].x, corners[4].y);
      ctx.lineTo(corners[5].x, corners[5].y);
      ctx.lineTo(corners[6].x, corners[6].y);
      ctx.lineTo(corners[7].x, corners[7].y);
      ctx.closePath();
      ctx.stroke();

      // Krawędzie pionowe
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(corners[i].x, corners[i].y);
        ctx.lineTo(corners[i + 4].x, corners[i + 4].y);
        ctx.stroke();
      }

      // Podłoga (przezroczysta)
      ctx.fillStyle = "rgba(63, 63, 70, 0.2)";
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill();
    };

    // Rysuj strefy
    const drawZones = () => {
      if (!showZones || !model.zones) return;

      const colors = ["rgba(16, 185, 129, 0.15)", "rgba(59, 130, 246, 0.15)", "rgba(245, 158, 11, 0.15)"];

      model.zones.forEach((zone: any, idx: number) => {
        const x = (zone.bounds.x - model.house.dimensions.lengthM/2) * 20;
        const y = (zone.bounds.y - model.house.dimensions.widthM/2) * 20;
        const w = zone.bounds.width * 20;
        const h = zone.bounds.height * 20;

        const p1 = project3D(x, y, 0);
        const p2 = project3D(x + w, y, 0);
        const p3 = project3D(x + w, y + h, 0);
        const p4 = project3D(x, y + h, 0);

        ctx.fillStyle = colors[idx % colors.length];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();

        // Etykieta
        const center = project3D(x + w/2, y + h/2, 0);
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(zone.name, center.x, center.y);
      });
    };

    // Rysuj wyposażenie
    const drawEquipment = () => {
      if (!showEquipment || !model.equipment) return;

      const equipmentColors: Record<string, string> = {
        feeder: "#10b981",
        drinker: "#3b82f6",
        fan: "#8b5cf6",
        heater: "#ef4444",
      };

      const equipmentIcons: Record<string, string> = {
        feeder: "●",
        drinker: "○",
        fan: "◉",
        heater: "▲",
      };

      model.equipment.forEach((eq: any) => {
        const x = (eq.position.x - model.house.dimensions.lengthM/2) * 20;
        const y = (eq.position.y - model.house.dimensions.widthM/2) * 20;

        const p = project3D(x, y, 0);

        ctx.fillStyle = equipmentColors[eq.type] ?? "#6b7280";
        ctx.font = `${12 * p.scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(equipmentIcons[eq.type] ?? "■", p.x, p.y);
      });
    };

    // Rysuj ptaki
    const drawBirds = () => {
      if (!showBirds || !model.batch) return;

      const birdCount = Math.min(model.batch.birdCount, 200); // max 200 punktów
      const birdsPerRow = Math.ceil(Math.sqrt(birdCount));
      const spacing = Math.min(houseW, houseH) / birdsPerRow * 0.8;

      ctx.fillStyle = "rgba(234, 179, 8, 0.6)";

      for (let i = 0; i < birdCount; i++) {
        const row = Math.floor(i / birdsPerRow);
        const col = i % birdsPerRow;

        const x = (col * spacing - houseW/2 * 0.8) + (Math.random() - 0.5) * 5;
        const y = (row * spacing - houseH/2 * 0.8) + (Math.random() - 0.5) * 5;

        const p = project3D(x, y, 0);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 * p.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // Licznik
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`🐔 ${model.batch.birdCount.toLocaleString()} ptaków`, 10, 20);
    };

    // Rysuj heatmap gęstości
    const drawHeatmap = () => {
      if (!showHeatmap || !model.batch) return;

      const density = Number(model.batch.density);
      const maxDensity = model.house.maxDensityKgM2;
      const densityRatio = density / maxDensity;

      // Gradient ciepła
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(houseW, houseH) / 2);

      if (densityRatio > 0.9) {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.3)");
        gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
      } else if (densityRatio > 0.7) {
        gradient.addColorStop(0, "rgba(245, 158, 11, 0.3)");
        gradient.addColorStop(1, "rgba(245, 158, 11, 0)");
      } else {
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.2)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0)");
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    };

    // Rysuj symulację karmników
    const drawFeederSimulation = () => {
      if (!feederSim) return;

      feederSim.positions.forEach((pos: any, idx: number) => {
        const x = (pos.x - model.house.dimensions.lengthM/2) * 20;
        const y = (pos.y - model.house.dimensions.widthM/2) * 20;

        const p = project3D(x, y, 0);

        // Zasięg karmnika
        const range = 3 * 20; // 3 metry
        const rangeP1 = project3D(x - range, y, 0);
        const rangeP2 = project3D(x + range, y, 0);
        const rangeRadius = Math.abs(rangeP2.x - rangeP1.x) / 2;

        ctx.fillStyle = "rgba(16, 185, 129, 0.2)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, rangeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#10b981";
        ctx.font = `${14 * p.scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🍽️", p.x, p.y);
      });

      // Statystyki
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Pokrycie: ${feederSim.coverage}% ${feederSim.isSufficient ? "✓" : "⚠️"}`, 10, 40);
    };

    // Rysuj symulację wentylacji
    const drawVentilationSimulation = () => {
      if (!ventSim) return;

      // Strzałki przepływu powietrza
      ctx.strokeStyle = "rgba(139, 92, 246, 0.5)";
      ctx.lineWidth = 2;

      for (let i = 0; i < 5; i++) {
        const y = (i - 2) * houseH / 6;
        const p1 = project3D(-houseW/2 + 20, y, 0);
        const p2 = project3D(houseW/2 - 20, y, 0);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        // Grot strzałki
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLen = 8;
        ctx.lineTo(
          p2.x - headLen * Math.cos(angle - Math.PI/6),
          p2.y - headLen * Math.sin(angle - Math.PI/6)
        );
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
          p2.x - headLen * Math.cos(angle + Math.PI/6),
          p2.y - headLen * Math.sin(angle + Math.PI/6)
        );
        ctx.stroke();
      }

      // Statystyki
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Wentylacja: ${ventSim.calculations.requiredVentilation} m³/h`, 10, 40);
      ctx.fillText(`Wentylatory: ${ventSim.recommendation.fansNeeded} szt.`, 10, 60);
    };

    // Rysuj wszystko
    drawHeatmap();
    drawHouse();
    drawZones();
    drawEquipment();
    drawBirds();

    if (simulationMode === "feeders") drawFeederSimulation();
    if (simulationMode === "ventilation") drawVentilationSimulation();

    // Informacje
    if (model.batch) {
      ctx.fillStyle = "#e4e4e7";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(model.house.name, 10, height - 60);

      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(`Gęstość: ${model.batch.density} kg/m² (max: ${model.house.maxDensityKgM2})`, 10, height - 40);
      ctx.fillText(`Wiek: ${model.batch.ageDays} dni | Śr. waga: ${model.batch.avgWeightKg} kg`, 10, height - 20);

      // Status gęstości
      const densityStatus = model.batch.densityStatus;
      ctx.fillStyle = densityStatus === "ok" ? "#10b981" : densityStatus === "warning" ? "#f59e0b" : "#ef4444";
      ctx.fillText(
        densityStatus === "ok" ? "✓ Gęstość OK" : 
        densityStatus === "warning" ? "⚠️ Gęstość wysoka" : 
        "🔴 Przekroczona gęstość!",
        10, height - 80
      );
    }

  }, [model, rotation, zoom, showZones, showEquipment, showBirds, showHeatmap, simulationMode, feederSim, ventSim]);

  // Obsługa myszy
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;

      setRotation(prev => ({
        x: Math.max(-90, Math.min(90, prev.x - dy * 0.5)),
        y: prev.y + dx * 0.5,
      }));

      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prev => Math.max(0.5, Math.min(3, prev - e.deltaY * 0.001)));
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Ładowanie modelu 3D...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-zinc-100">Digital Twin — Kurnik 3D</h1>
          <p className="mt-2 text-zinc-400">
            Wirtualny model kurnika — symulacja wyposażenia, wentylacji, gęstości
          </p>
        </div>

        {/* Kontrolki */}
        <div className="mb-6 flex flex-wrap gap-4">
          {/* Wybór kurnika */}
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100"
            value={selectedHouseId ?? ""}
            onChange={(e) => setSelectedHouseId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Wybierz kurnik...</option>
            {/* TODO: lista kurników */}
          </select>

          {/* Tryb widoku */}
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
            {(["3d", "top", "side"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm ${
                  viewMode === mode
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {mode === "3d" ? "3D" : mode === "top" ? "Z góry" : "Z boku"}
              </button>
            ))}
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-400 hover:bg-zinc-800"
            >
              -
            </button>
            <span className="text-zinc-400 text-sm w-12 text-center">{zoom.toFixed(1)}x</span>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.2))}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-400 hover:bg-zinc-800"
            >
              +
            </button>
          </div>
        </div>

        {/* Opcje wyświetlania */}
        <div className="mb-6 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showZones}
              onChange={(e) => setShowZones(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Strefy
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showEquipment}
              onChange={(e) => setShowEquipment(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Wyposażenie
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showBirds}
              onChange={(e) => setShowBirds(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Ptaki
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            Heatmap gęstości
          </label>
        </div>

        {/* Symulacje */}
        <div className="mb-6 flex flex-wrap gap-4">
          <button
            onClick={() => setSimulationMode(simulationMode === "feeders" ? "none" : "feeders")}
            className={`rounded-lg px-4 py-2 text-sm ${
              simulationMode === "feeders"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            🍽️ Symulacja karmników
          </button>

          <button
            onClick={() => setSimulationMode(simulationMode === "ventilation" ? "none" : "ventilation")}
            className={`rounded-lg px-4 py-2 text-sm ${
              simulationMode === "ventilation"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            🌬️ Symulacja wentylacji
          </button>
        </div>

        {/* Konfiguracja symulacji karmników */}
        {simulationMode === "feeders" && (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 text-lg font-semibold text-zinc-200">Konfiguracja karmników</h3>

            <div className="flex gap-4">
              <select
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-100"
                value={feederConfig.type}
                onChange={(e) => setFeederConfig({ ...feederConfig, type: e.target.value as any })}
              >
                <option value="pan">Karmnik talerzowy (12 ptaków/szt.)</option>
                <option value="chain">Łańcuchowy (50 ptaków/m)</option>
                <option value="tube">Rura (16 ptaków/szt.)</option>
              </select>

              <input
                type="number"
                min="1"
                max="100"
                value={feederConfig.count}
                onChange={(e) => setFeederConfig({ ...feederConfig, count: Number(e.target.value) })}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-zinc-100"
              />

              {feederSim && (
                <div className={`ml-4 px-4 py-2 rounded-lg ${
                  feederSim.isSufficient ? "bg-emerald-900/50 text-emerald-300" : "bg-red-900/50 text-red-300"
                }`}>
                  {feederSim.isSufficient 
                    ? `✓ Pokrycie: ${feederSim.coverage}%` 
                    : `⚠️ Brakuje ${feederSim.deficit} karmników`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas 3D */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full cursor-move"
            style={{ maxHeight: "600px" }}
          />
        </div>

        {/* Legenda */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-sm text-zinc-500 mb-2">Karmniki</div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">●</span>
              <span className="text-zinc-300 text-sm">Talerzowe</span>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-sm text-zinc-500 mb-2">Poidła</div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">○</span>
              <span className="text-zinc-300 text-sm">Nipple</span>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-sm text-zinc-500 mb-2">Wentylatory</div>
            <div className="flex items-center gap-2">
              <span className="text-purple-400">◉</span>
              <span className="text-zinc-300 text-sm">Ścienne</span>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <div className="text-sm text-zinc-500 mb-2">Ogrzewanie</div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">▲</span>
              <span className="text-zinc-300 text-sm">Promienniki</span>
            </div>
          </div>
        </div>

        {/* Statystyki */}
        {model?.batch && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Liczba ptaków</div>
              <div className="mt-1 text-2xl font-bold text-zinc-100">
                {model.batch.birdCount.toLocaleString()}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Śr. waga</div>
              <div className="mt-1 text-2xl font-bold text-zinc-100">
                {model.batch.avgWeightKg} kg
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Gęstość</div>
              <div className={`mt-1 text-2xl font-bold ${
                model.batch.densityStatus === "ok" ? "text-emerald-400" :
                model.batch.densityStatus === "warning" ? "text-amber-400" : "text-red-400"
              }`}>
                {model.batch.density} kg/m²
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-500">Wiek</div>
              <div className="mt-1 text-2xl font-bold text-zinc-100">
                {model.batch.ageDays} dni
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
