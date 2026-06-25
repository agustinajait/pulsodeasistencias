import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Search, FileText, ChevronRight, X, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type HitoVal = "L" | "P" | "N" | null;

type Report = {
  id: number;
  childId: number;
  nombre: string;
  apellido: string;
  period: string;
  ecoNumber?: number;
  lider?: string;
  facilitadora?: string;
  hitos: Record<string, HitoVal>;
  textos: Record<string, string>;
  observaciones?: string;
  createdAt: string;
};

// ── ECO templates (same as child-sheet) ───────────────────────────────────
const ECO_TEMPLATES: Record<number, { eje: string; hitos: string[] }[]> = {
  0: [
    { eje: "Motricidad gruesa", hitos: ["Camina y corre solo","Se sube a su silla","Patea y lanza la pelota","Levanta objetos del suelo en cuclillas","Se agacha y se levanta sin apoyo","Empuja y arrastra objetos"] },
    { eje: "Motricidad fina", hitos: ["Manipula objetos pequeños (como cubos por ejemplo)","Come con cuchara","Pasa las páginas del libro","Apila 2 a 4 cubos","Usa ambas manos para jugar"] },
    { eje: "Cognitivo", hitos: ["Busca juguetes escondidos","Trasvasado"] },
    { eje: "Socio-emocional", hitos: ["Muestra curiosidad","Coopera en los momentos de guardado","Se interesa por sus compañeros/as","Puede expresar necesidades básicas con llanto o gestos","Logra almorzar sentado en la mesa"] },
    { eje: "Lenguaje", hitos: ["Dice su propio nombre","Expresa lo quiere alcanzar o pedir","Señala personas conocidas",'Usa gestos como "chau" "no" "mano"'] },
  ],
  1: [
    { eje: "Motricidad gruesa", hitos: ["Camina, corre y escala sin dificultad","Patea pelotas","Sube y baja escaleras sin ayuda","Salta con ambos pies","Se agacha sin dificultad","Camina para atrás"] },
    { eje: "Motricidad fina", hitos: ["Pasa páginas del libro","Realiza trazos o garabatos","Puede comer usando cubiertos y vaso"] },
    { eje: "Cognitivo", hitos: ["Reconoce objetos","Cuenta hasta 5","Sigue instrucciones dobles","Hace preguntas","Imita animales","Juega de manera simbólica","Reconoce colores"] },
    { eje: "Socio-emocional", hitos: ["Avisa si quiere ir al baño","Colabora con el guardado de los juguetes","Se saca algunas prendas"] },
    { eje: "Autonomía", hitos: ["Acepta las propuestas de la líder","Muestra interés por compartir con sus pares","Respeta la rutina","Imita comportamientos de adultos","Busca aprobación del adulto"] },
    { eje: "Emocional", hitos: ["Expresa emociones como enojo, alegría o frustración"] },
    { eje: "Lenguaje", hitos: ["Nombra objetos o personas conocidas","Forma frases de 2 palabras o más"] },
  ],
  2: [
    { eje: "Motricidad gruesa", hitos: ["Corre con mayor coordinación","Salta con ambos pies","Lanza, atrapa y patea pelotas","Evita obstáculos","Se viste con ayuda"] },
    { eje: "Motricidad fina", hitos: ["Sostiene el lápiz con más control","Dibuja líneas, círculos","Empieza a pintar dentro de los límites","Come de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "Cognitivo", hitos: ["Reconoce colores, formas y algunos números","Resuelve problemas simples (ej: alcanzar objetos)","Arma torres con 8 o más bloques","Reconoce su nombre","Entiende cuentos simples y sigue la conversación"] },
    { eje: "Socio-emocional", hitos: ["Juega con sus compañeros","Juego simbólico","Entiende reglas de juego y de convivencia","Participa de las actividades grupales propuestas por la líder"] },
    { eje: "Emocional", hitos: ["Expresa emociones con palabras"] },
    { eje: "Lenguaje", hitos: ["Forma oraciones sencillas","Usa pronombres (yo, tu, él)"] },
  ],
  3: [
    { eje: "Motricidad gruesa", hitos: ["Corre con mayor coordinación","Salta con ambos pies","Lanza, atrapa y patea pelotas","Evita obstáculos","Se viste con ayuda"] },
    { eje: "Motricidad fina", hitos: ["Sostiene el lápiz con más control","Dibuja líneas, círculos","Empieza a pintar dentro de los límites","Come de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "Cognitivo", hitos: ["Reconoce colores, formas y algunos números","Resuelve problemas simples","Arma torres con 8 o más bloques","Reconoce su nombre","Entiende cuentos simples y sigue la conversación"] },
    { eje: "Socio-emocional", hitos: ["Juega con sus compañeros","Juego simbólico","Entiende reglas de juego y de convivencia","Participa de las actividades grupales propuestas por la líder"] },
    { eje: "Emocional", hitos: ["Expresa emociones con palabras"] },
    { eje: "Lenguaje", hitos: ["Forma oraciones sencillas","Usa pronombres (yo, tu, él)"] },
  ],
};

const HITO_COLOR: Record<string, string> = {
  L: "bg-green-100 text-green-700",
  P: "bg-amber-100 text-amber-700",
  N: "bg-red-100 text-red-700",
};
const HITO_LABEL: Record<string, string> = { L: "Logrado", P: "En proceso", N: "No logrado" };

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchReports(centerId: number | null, ecoNumber?: number | null, period?: string): Promise<Report[]> {
  if (!centerId) return [];
  let qs = `?centerId=${centerId}`;
  if (ecoNumber != null) qs += `&ecoNumber=${ecoNumber}`;
  if (period) qs += `&period=${period}`;
  const r = await fetch(`${BASE}/reports${qs}`);
  return r.ok ? r.json() : [];
}

// ── Report detail modal ────────────────────────────────────────────────────
function ReportModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const template = ECO_TEMPLATES[report.ecoNumber ?? 0] ?? [];
  const childName = `${report.apellido}, ${report.nombre}`;

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const hitoRows = template.flatMap(({ eje, hitos }) =>
      hitos.map((h) => {
        const val = report.hitos[h] ?? null;
        const color = val === "L" ? "#dcfce7" : val === "P" ? "#fef9c3" : val === "N" ? "#fee2e2" : "#f9fafb";
        return `<tr><td style="padding:4px 8px;border:1px solid #e5e7eb">${eje}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${h}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;background:${color}">${val ? HITO_LABEL[val] : "—"}</td></tr>`;
      })
    ).join("");

    const textoSections = template
      .filter(({ eje }) => report.textos?.[eje])
      .map(({ eje }) => `<p><strong>${eje}:</strong> ${report.textos[eje]}</p>`)
      .join("");

    w.document.write(`<html><head><title>Informe ${childName}</title>
      <style>body{font-family:sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 8px;border:1px solid #e5e7eb;text-align:left}</style>
      </head><body>
      <h2>Informe de Desarrollo</h2>
      <p><strong>Niño/a:</strong> ${childName}</p>
      <p><strong>Período:</strong> ${report.period}</p>
      ${report.lider ? `<p><strong>Líder:</strong> ${report.lider}</p>` : ""}
      ${report.facilitadora ? `<p><strong>Facilitadora:</strong> ${report.facilitadora}</p>` : ""}
      <table><thead><tr><th>Área</th><th>Hito</th><th>Estado</th></tr></thead><tbody>${hitoRows}</tbody></table>
      ${textoSections ? `<div style="margin-top:16px"><h3>Síntesis narrativa</h3>${textoSections}</div>` : ""}
      ${report.observaciones ? `<div style="margin-top:12px"><strong>Observaciones:</strong> ${report.observaciones}</div>` : ""}
      </body></html>`);
    w.document.close();
    w.print();
  }

  const totalHitos = template.reduce((a, e) => a + e.hitos.length, 0);
  const logrados = Object.values(report.hitos).filter((v) => v === "L").length;
  const enProceso = Object.values(report.hitos).filter((v) => v === "P").length;
  const noLogrados = Object.values(report.hitos).filter((v) => v === "N").length;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Informe de desarrollo</div>
              <h2 className="text-xl font-bold mt-0.5">{childName}</h2>
              <p className="text-white/60 text-sm mt-0.5">Período: {report.period} · Sala ECO {report.ecoNumber ?? 0}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
          </div>
          {/* summary chips */}
          <div className="flex gap-2 mt-3">
            {[
              { label: `${logrados} Logrado`, color: "bg-green-500/20 text-green-200" },
              { label: `${enProceso} En proceso`, color: "bg-amber-500/20 text-amber-200" },
              { label: `${noLogrados} No logrado`, color: "bg-red-500/20 text-red-200" },
            ].map(({ label, color }) => (
              <span key={label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex justify-end px-5 py-3 border-b border-gray-100">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600">
              <Printer className="w-3.5 h-3.5" />Imprimir / PDF
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* staff */}
            {(report.lider || report.facilitadora) && (
              <div className="text-sm text-gray-500">
                {report.lider && <p>Líder: <span className="font-semibold text-gray-800">{report.lider}</span></p>}
                {report.facilitadora && <p>Facilitadora: <span className="font-semibold text-gray-800">{report.facilitadora}</span></p>}
              </div>
            )}

            {/* hitos by area */}
            {template.map(({ eje, hitos }) => {
              const area = hitos.map((h) => ({ h, val: report.hitos[h] ?? null }));
              return (
                <div key={eje}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{eje}</p>
                  <div className="space-y-1">
                    {area.map(({ h, val }) => (
                      <div key={h} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 flex-1">{h}</span>
                        {val ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${HITO_COLOR[val]}`}>
                            {HITO_LABEL[val]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 shrink-0">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* texto narrativo */}
                  {report.textos?.[eje] && (
                    <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-600 italic">{report.textos[eje]}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* observaciones */}
            {report.observaciones && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones</p>
                <p className="text-sm text-gray-700">{report.observaciones}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
const PERIODS = ["1er trimestre","2do trimestre","3er trimestre","1er cuatrimestre","2do cuatrimestre","Anual"];

export default function Informes() {
  const { centerId } = useAuth();
  const [search, setSearch] = useState("");
  const [filterEco, setFilterEco] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [selected, setSelected] = useState<Report | null>(null);

  const roomsQ = useListRooms();
  const rooms = (roomsQ.data ?? []).filter((r: any) => !centerId || r.centerId === centerId);

  const reportsQ = useQuery({
    queryKey: ["all-reports", centerId, filterEco, filterPeriod],
    queryFn: () => fetchReports(centerId, filterEco !== "" ? Number(filterEco) : null, filterPeriod || undefined),
    enabled: !!centerId,
  });

  const reports = reportsQ.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter((r) =>
      `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) ||
      r.apellido.toLowerCase().includes(q)
    );
  }, [reports, search]);

  // group by child
  const byChild = useMemo(() => {
    const map: Record<number, { childId: number; nombre: string; apellido: string; reports: Report[] }> = {};
    filtered.forEach((r) => {
      if (!map[r.childId]) map[r.childId] = { childId: r.childId, nombre: r.nombre, apellido: r.apellido, reports: [] };
      map[r.childId].reports.push(r);
    });
    return Object.values(map).sort((a, b) => a.apellido.localeCompare(b.apellido));
  }, [filtered]);

  function hitoSummary(r: Report) {
    const L = Object.values(r.hitos).filter((v) => v === "L").length;
    const P = Object.values(r.hitos).filter((v) => v === "P").length;
    const N = Object.values(r.hitos).filter((v) => v === "N").length;
    return { L, P, N };
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Centro</div>
        <div className="flex items-end justify-between mt-1">
          <h1 className="text-2xl font-bold">Informes de desarrollo</h1>
          <span className="text-white/40 text-sm">{reports.length} informe{reports.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por apellido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={filterEco}
            onChange={(e) => setFilterEco(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas las salas</option>
            {rooms.map((r: any) => (
              <option key={r.id} value={r.ecoNumber}>{r.name}</option>
            ))}
          </select>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los períodos</option>
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {reportsQ.isPending && (
          <p className="text-center py-12 text-gray-400 text-sm">Cargando informes...</p>
        )}

        {!reportsQ.isPending && byChild.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search || filterEco || filterPeriod ? "Sin resultados para ese filtro" : "Todavía no hay informes cargados"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {byChild.map(({ childId, nombre, apellido, reports: childReports }) => (
            <div key={childId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="font-bold text-sm text-gray-900">{apellido}, {nombre}</p>
                <p className="text-xs text-gray-400">Sala ECO {childReports[0].ecoNumber ?? 0}</p>
              </div>
              {childReports.map((r) => {
                const { L, P, N } = hitoSummary(r);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50/50 transition-colors border-b border-gray-50 last:border-0 text-left"
                  >
                    <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{r.period}</p>
                      <div className="flex gap-2 mt-0.5">
                        {L > 0 && <span className="text-[10px] font-bold text-green-600">{L}L</span>}
                        {P > 0 && <span className="text-[10px] font-bold text-amber-600">{P}P</span>}
                        {N > 0 && <span className="text-[10px] font-bold text-red-500">{N}N</span>}
                        {r.lider && <span className="text-[10px] text-gray-400">· {r.lider}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && <ReportModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
