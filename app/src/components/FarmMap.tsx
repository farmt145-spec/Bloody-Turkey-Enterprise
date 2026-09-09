import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { feature } from "topojson-client";
import countriesTopo from "world-atlas/countries-110m.json";
import { fmtNum, countryFlag, num } from "@/lib/geo";

const EUROPE_NUM = new Set([
  250, 276, 620, 616, 724, 380, 528, 826, 208, 203, 348, 40, 756, 752, 578, 372, 300, 642, 100, 703,
  705, 191, 246, 233, 428, 440, 804, 112, 498, 807, 70, 8, 499, 688, 400, 352, 492, 438, 56, 20, 470, 674, 31,
]);

const geographies = (feature as any)(countriesTopo as any, (countriesTopo as any).objects.countries).features.filter(
  (f: any) => EUROPE_NUM.has(Number(f.id)),
);

export type FarmMapPoint = { id: number; countryCode: string; lat: string; lng: string; activeBirds: number };

export default function FarmMap({ farms, maxBirds }: { farms: FarmMapPoint[]; maxBirds: number }) {
  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [12, 52], scale: 620 }}
      width={800}
      height={520}
      style={{ width: "100%", height: "auto" }}
    >
      <ZoomableGroup>
        <Geographies geography={geographies}>
          {({ geographies: geos }: any) =>
            geos.map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#1f2937"
                stroke="#374151"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#374151", outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>
        {farms.map((f) => {
          const r = 4 + (f.activeBirds / maxBirds) * 12;
          return (
            <Marker key={f.id} coordinates={[num(f.lng), num(f.lat)]}>
              <circle r={r + 4} fill="#ef4444" opacity={0.15} />
              <circle r={r} fill="#ef4444" opacity={0.75} stroke="#fecaca" strokeWidth={1} />
              <text
                y={-r - 6}
                textAnchor="middle"
                className="fill-zinc-300"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {countryFlag(f.countryCode)} {fmtNum(f.activeBirds / 1000, 0)}k
              </text>
            </Marker>
          );
        })}
      </ZoomableGroup>
    </ComposableMap>
  );
}
