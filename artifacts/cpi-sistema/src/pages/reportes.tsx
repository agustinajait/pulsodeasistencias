import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Users, ClipboardCheck, Briefcase, FolderOpen, TrendingUp } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Summary = {
  totalActive: number;
  totalPresent: number;
  totalAbsent: number;
  totalAlerts: number;
  totalDischarge: number;
  totalCapacity: number;
  pctPresent: number;
  totalMercaderiaMonth: number;
};

type CenterSummary = Summary & {
  centerId: number;
  centerName: string;
};

type MonthlyPoint = { mes: string; pct: number; present: number; total: number };

// Fetch helpers
async function fetchSummary(centerId?: number | null): Promise<Summary> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/dashboard/summary${qs}`);
  return r.json();
}

async function fetchByCenter(): Promise<CenterSummary[]> {
  const r = await fetch(`${BASE}/dashboard/summary-by-center`);
  return r.json();
}

async function fetchCases(centerId?: number | null): Promise<{ estado: string; tipos_problematica: string[] }[]> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/cases${qs}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.cases ?? j ?? [];
}

async function fetchServices(centerId?: number | null): Promise<{ status: string }[]> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/services${qs}`);
  if (!r.ok) return [];
  return r.json();
}

async function fetchMonthlyTrend(centerId?: number | null): Promise<MonthlyPoint[]> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/dashboard/monthly-trend${qs}`);
  if (!r.ok) return [];
  return r.json();
}

// ── Metric card ───────────────────────────────────────────────────────────
function Metric({
  value,
  label,
  sub,
  color,
  icon,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
      <div className="flex items-start justify-between">
        <div className={`text-3xl font-bold ${color ?? "text-gray-900"}`}>{value}</div>
        {icon && <div className="text-gray-300">{icon}</div>}
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  );
}

const MES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function mesLabel(ym: string) {
  const [, m] = ym.split("-");
  return MES_ES[parseInt(m) - 1] ?? ym;
}

const TIPOS_LABEL: Record<string, string> = {
  violencia: "Violencia familiar",
  abuso: "Abuso/maltrato",
  abandono: "Abandono",
  adicciones: "Adicciones",
  vivienda: "Problemática de vivienda",
  salud_mental: "Salud mental",
  discapacidad: "Discapacidad/CUD",
  trabajo_inf: "Trabajo infantil",
  otro: "Otro",
};

export default function Reportes() {
  const { role, centerId } = useAuth();
  const isSuperAdmin = role === "superadmin";

  const summaryQ = useQuery({
    queryKey: ["dashboard-summary", centerId],
    queryFn: () => fetchSummary(centerId),
    refetchInterval: 60_000,
  });

  const byCenterQ = useQuery({
    queryKey: ["dashboard-by-center"],
    queryFn: fetchByCenter,
    enabled: isSuperAdmin,
    refetchInterval: 60_000,
  });

  const casesQ = useQuery({
    queryKey: ["cases-report", centerId],
    queryFn: () => fetchCases(centerId),
  });

  const servicesQ = useQuery({
    queryKey: ["services-report", centerId],
    queryFn: () => fetchServices(centerId),
  });

  const trendQ = useQuery({
    queryKey: ["monthly-trend", centerId],
    queryFn: () => fetchMonthlyTrend(centerId),
  });

  const s = summaryQ.data;

  // Case breakdowns
  const cases = casesQ.data ?? [];
  const casesAbiertos = cases.filter((c) => c.estado === "ABIERTO" || c.estado === "EN_PROCESO").length;
  const casesCerrados = cases.filter((c) => c.estado === "CERRADO").length;
  const tipoCounts: Record<string, number> = {};
  cases.filter(c => c.estado !== "CERRADO").forEach((c) => {
    (c.tipos_problematica ?? []).forEach((t) => {
      tipoCounts[t] = (tipoCounts[t] ?? 0) + 1;
    });
  });
  const topTipos = Object.entries(tipoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Service breakdowns
  const services = servicesQ.data ?? [];
  const svcVencidos = services.filter((s) => s.status === "VENCIDO").length;
  const svcPorVencer = services.filter((s) => s.status === "POR_VENCER").length;
  const svcAlDia = services.filter((s) => s.status === "AL_DIA").length;

  // Monthly trend
  const trend = trendQ.data ?? [];
  const maxPct = trend.length ? Math.max(...trend.map((t) => t.pct), 1) : 100;

  const today = new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page header */}
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest capitalize">{today}</div>
        <h1 className="text-2xl font-bold mt-1">Resumen general</h1>
      </div>

      <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto lg:max-w-4xl">

        {/* ── Asistencia hoy ── */}
        <Section title="Asistencia · hoy">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              value={s ? `${s.pctPresent}%` : "—"}
              label="Tasa de asistencia"
              sub={s ? `${s.totalPresent} de ${s.totalActive} niños` : undefined}
              color={s && s.pctPresent >= 70 ? "text-green-600" : "text-amber-600"}
              icon={<TrendingUp className="w-6 h-6" />}
            />
            <Metric
              value={s?.totalPresent ?? "—"}
              label="Presentes"
              color="text-green-600"
              icon={<ClipboardCheck className="w-6 h-6" />}
            />
            <Metric
              value={s?.totalAbsent ?? "—"}
              label="Ausentes"
              color="text-red-500"
            />
            <Metric
              value={s?.totalAlerts ?? "—"}
              label="Alertas activas"
              sub={s?.totalAlerts ? "2+ días consecutivos" : "Sin alertas"}
              color={s?.totalAlerts ? "text-red-600" : "text-gray-400"}
              icon={<AlertTriangle className="w-6 h-6" />}
            />
          </div>
        </Section>

        {/* ── Matrícula ── */}
        <Section title="Matrícula">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Metric
              value={s?.totalActive ?? "—"}
              label="Inscriptos activos"
              icon={<Users className="w-6 h-6" />}
            />
            <Metric
              value={s ? s.totalCapacity - s.totalActive : "—"}
              label="Vacantes disponibles"
              color="text-blue-600"
            />
            <Metric
              value={s?.totalDischarge ?? "—"}
              label="Bajas en el año"
              color="text-gray-400"
            />
          </div>
        </Section>

        {/* ── Mercadería ── */}
        <Section title="Mercadería">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              value={s?.totalMercaderiaMonth ?? "—"}
              label="Bolsones retirados"
              sub="en el mes actual"
              color="text-violet-600"
            />
          </div>
        </Section>

        {/* ── Tendencia mensual (si hay datos) ── */}
        {trend.length > 1 && (
          <Section title="Tendencia de asistencia mensual">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-end gap-2 h-24">
                {trend.map((pt) => (
                  <div key={pt.mes} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] font-bold text-gray-500">{pt.pct}%</div>
                    <div
                      className="w-full rounded-t-md bg-violet-500"
                      style={{ height: `${Math.round((pt.pct / maxPct) * 72)}px`, minHeight: 4 }}
                    />
                    <div className="text-[10px] text-gray-400">{mesLabel(pt.mes)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── Seguimiento de casos ── */}
        <Section title="Seguimiento de casos">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Metric
              value={casesAbiertos}
              label="Casos abiertos"
              color={casesAbiertos > 0 ? "text-amber-600" : "text-gray-400"}
              icon={<FolderOpen className="w-6 h-6" />}
            />
            <Metric
              value={casesCerrados}
              label="Casos cerrados"
              color="text-gray-400"
            />
            <Metric
              value={cases.length}
              label="Total histórico"
            />
          </div>

          {topTipos.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                Problemáticas más frecuentes (activos)
              </p>
              <div className="space-y-2">
                {topTipos.map(([tipo, count]) => (
                  <div key={tipo} className="flex items-center gap-3">
                    <div className="flex-1 text-sm font-medium text-gray-700">
                      {TIPOS_LABEL[tipo] ?? tipo}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-violet-200 w-20">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${Math.round((count / (topTipos[0][1] || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-violet-700 w-4 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── Servicios ── */}
        <Section title="Servicios del centro">
          <div className="grid grid-cols-3 gap-3">
            <Metric
              value={svcVencidos}
              label="Vencidos"
              color={svcVencidos > 0 ? "text-red-600" : "text-gray-400"}
              icon={<Briefcase className="w-6 h-6" />}
            />
            <Metric
              value={svcPorVencer}
              label="Por vencer"
              color={svcPorVencer > 0 ? "text-amber-600" : "text-gray-400"}
            />
            <Metric
              value={svcAlDia}
              label="Al día"
              color="text-green-600"
            />
          </div>
        </Section>

        {/* ── Por centro (superadmin) ── */}
        {isSuperAdmin && byCenterQ.data && byCenterQ.data.length > 0 && (
          <Section title="Comparativa por centro">
            <div className="space-y-3">
              {byCenterQ.data.map((c) => (
                <div key={c.centerId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">{c.centerName}</h3>
                    <span className={`text-xl font-bold ${c.pctPresent >= 70 ? "text-green-600" : "text-amber-500"}`}>
                      {c.pctPresent}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${c.pctPresent >= 70 ? "bg-green-500" : "bg-amber-400"}`}
                      style={{ width: `${c.pctPresent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { v: c.totalActive, l: "Activos" },
                      { v: c.totalPresent, l: "Presentes" },
                      { v: c.totalAbsent, l: "Ausentes" },
                      { v: c.totalCapacity - c.totalActive, l: "Vacantes" },
                    ].map(({ v, l }) => (
                      <div key={l}>
                        <div className="text-lg font-bold text-gray-900">{v}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}
