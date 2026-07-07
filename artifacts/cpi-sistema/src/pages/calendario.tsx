import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Save, Users, CalendarDays, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListCenters } from "@workspace/api-client-react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type EventTipo = "FERIADO" | "VACACIONES" | "SUPERVISION" | "CAPACITACION" | "SUSPENSION" | "EVENTO";

type CalEvent = {
  id: number;
  centerId: number;
  fecha: string;
  tipo: EventTipo;
  titulo?: string;
  descripcion?: string;
  hora?: string;
};

type Staff = {
  id: number;
  centerId: number;
  nombre: string;
  apellido: string;
  cargo?: string;
  sueldoMensual: number;
  activo: boolean;
};

type WorkingDays = {
  workingDays: number;
  totalWeekdays: number;
  nonWorkingDays: number;
};

// ── Config ─────────────────────────────────────────────────────────────────
const TIPOS: Record<EventTipo, { label: string; color: string; bg: string; dot: string; chip: string; solid: string }> = {
  FERIADO:     { label: "Feriado",      color: "text-red-700",    bg: "bg-red-50",    dot: "bg-red-500",    chip: "bg-red-500 text-white",        solid: "bg-red-500" },
  VACACIONES:  { label: "Vacaciones",   color: "text-amber-700",  bg: "bg-amber-50",  dot: "bg-amber-500",  chip: "bg-amber-400 text-white",      solid: "bg-amber-400" },
  SUPERVISION: { label: "Supervisión",  color: "text-blue-700",   bg: "bg-blue-50",   dot: "bg-blue-500",   chip: "bg-blue-500 text-white",       solid: "bg-blue-500" },
  CAPACITACION:{ label: "Capacitación", color: "text-teal-700",   bg: "bg-teal-50",   dot: "bg-teal-500",   chip: "bg-teal-500 text-white",       solid: "bg-teal-500" },
  SUSPENSION:  { label: "Suspensión",   color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500", chip: "bg-orange-500 text-white",     solid: "bg-orange-500" },
  EVENTO:      { label: "Evento",       color: "text-violet-700", bg: "bg-violet-50", dot: "bg-violet-500", chip: "bg-violet-500 text-white",     solid: "bg-violet-500" },
};

const NON_WORKING: EventTipo[] = ["FERIADO", "VACACIONES", "SUSPENSION"];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ── Helpers ────────────────────────────────────────────────────────────────
function currentMonth() { return new Date().toISOString().slice(0, 7); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function getDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days: string[] = [];
  const total = new Date(y, m, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(`${month}-${String(d).padStart(2, "0")}`);
  return days;
}

function isWeekend(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function dow(dateStr: string) { return new Date(dateStr + "T12:00:00").getDay(); }

function fmt(pesos: number) {
  return pesos.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 });
}

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchEvents(centerId: number | null, month: string): Promise<CalEvent[]> {
  if (!centerId) return [];
  const r = await fetch(`${BASE}/calendario/events?centerId=${centerId}&month=${month}`);
  return r.ok ? r.json() : [];
}

async function fetchWorkingDays(centerId: number | null, month: string): Promise<WorkingDays> {
  if (!centerId) return { workingDays: 0, totalWeekdays: 0, nonWorkingDays: 0 };
  const r = await fetch(`${BASE}/calendario/working-days?centerId=${centerId}&month=${month}`);
  return r.ok ? r.json() : { workingDays: 0, totalWeekdays: 0, nonWorkingDays: 0 };
}

async function fetchStaff(centerId: number | null): Promise<Staff[]> {
  if (!centerId) return [];
  const r = await fetch(`${BASE}/calendario/staff?centerId=${centerId}`);
  return r.ok ? r.json() : [];
}

// ── DayCell — Google Calendar style ───────────────────────────────────────
function DayCell({ date, events, onClick }: { date: string; events: CalEvent[]; onClick: () => void }) {
  const day = parseInt(date.slice(-2));
  const weekend = isWeekend(date);
  const isToday = date === todayStr();
  const maxVisible = 3;
  const visible = events.slice(0, maxVisible);
  const overflow = events.length - maxVisible;

  return (
    <button
      onClick={onClick}
      className={`min-h-[90px] p-1.5 text-left transition-colors rounded-lg group ${
        weekend ? "bg-gray-50/80" : "bg-white hover:bg-gray-50"
      }`}
    >
      {/* Day number */}
      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full mb-1 ${
        isToday
          ? "bg-violet-600 text-white"
          : weekend
          ? "text-gray-300"
          : "text-gray-700 group-hover:bg-gray-100"
      }`}>
        {day}
      </span>

      {/* Event chips */}
      <div className="space-y-0.5">
        {visible.map((e) => (
          <div
            key={e.id}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded truncate leading-tight ${TIPOS[e.tipo]?.chip ?? "bg-gray-400 text-white"}`}
            title={e.titulo || TIPOS[e.tipo]?.label}
          >
            {e.titulo ? e.titulo : TIPOS[e.tipo]?.label}
          </div>
        ))}
        {overflow > 0 && (
          <div className="text-[9px] text-gray-400 font-semibold px-1">+{overflow} más</div>
        )}
      </div>
    </button>
  );
}

// ── DayModal ───────────────────────────────────────────────────────────────
function DayModal({ date, centerId, events, onClose, onRefresh }: {
  date: string; centerId: number; events: CalEvent[]; onClose: () => void; onRefresh: () => void;
}) {
  const [tipo, setTipo] = useState<EventTipo>("EVENTO");
  const [titulo, setTitulo] = useState("");
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);

  const d = new Date(date + "T12:00:00");
  const label = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  async function handleAdd() {
    setSaving(true);
    await fetch(`${BASE}/calendario/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, fecha: date, tipo, titulo: titulo || null, hora: hora || null }),
    });
    setSaving(false);
    setTitulo("");
    setHora("");
    onRefresh();
  }

  async function handleDelete(id: number) {
    await fetch(`${BASE}/calendario/events/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Día</p>
            <p className="font-bold text-gray-900 capitalize">{label}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* existing events */}
          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${TIPOS[e.tipo]?.bg ?? "bg-gray-50"}`}>
                  <div className={`w-2 h-full min-h-[20px] rounded-full ${TIPOS[e.tipo]?.solid ?? "bg-gray-400"} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${TIPOS[e.tipo]?.color ?? "text-gray-700"}`}>{TIPOS[e.tipo]?.label}</p>
                    {e.titulo && <p className="text-xs text-gray-700 truncate">{e.titulo}</p>}
                    {e.hora && <p className="text-xs text-gray-400">{e.hora}</p>}
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* add new */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agregar evento</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(TIPOS) as EventTipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
                    tipo === t
                      ? `${TIPOS[t].bg} ${TIPOS[t].color} border-transparent ring-2 ring-offset-1 ring-current/30`
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${TIPOS[t].dot} shrink-0`} />
                  {TIPOS[t].label}
                </button>
              ))}
            </div>
            <Input
              placeholder="Descripción (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-sm"
            />
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="text-sm"
              title="Hora (opcional)"
            />
            <Button onClick={handleAdd} disabled={saving} className="w-full" size="sm">
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StaffPanel ─────────────────────────────────────────────────────────────
function StaffPanel({ centerId, workingDays }: { centerId: number; workingDays: WorkingDays }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nombre: "", apellido: "", cargo: "", sueldoMensual: "" });
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Staff>>({});

  const staffQ = useQuery({ queryKey: ["staff", centerId], queryFn: () => fetchStaff(centerId) });
  const staff = staffQ.data ?? [];

  async function handleAdd() {
    setAdding(true);
    await fetch(`${BASE}/calendario/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, ...form, sueldoMensual: Number(form.sueldoMensual) }),
    });
    setForm({ nombre: "", apellido: "", cargo: "", sueldoMensual: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["staff", centerId] });
  }

  async function handleEdit(id: number) {
    await fetch(`${BASE}/calendario/staff/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["staff", centerId] });
  }

  async function handleDelete(id: number) {
    await fetch(`${BASE}/calendario/staff/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["staff", centerId] });
  }

  const wd = workingDays.workingDays;
  const dailyRate = (s: Staff) => wd > 0 ? s.sueldoMensual / wd : 0;
  const monthlyCalc = (s: Staff) => s.sueldoMensual - dailyRate(s) * workingDays.nonWorkingDays;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: workingDays.totalWeekdays, l: "Días hábiles" },
          { v: workingDays.nonWorkingDays, l: "No laborables", color: "text-red-600" },
          { v: workingDays.workingDays, l: "A liquidar", color: "text-green-600" },
        ].map(({ v, l, color }) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{v}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {staff.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            {editId === s.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.nombre ?? ""} onChange={(e) => setEditForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" className="text-sm" />
                  <Input value={editForm.apellido ?? ""} onChange={(e) => setEditForm(f => ({ ...f, apellido: e.target.value }))} placeholder="Apellido" className="text-sm" />
                </div>
                <Input value={editForm.cargo ?? ""} onChange={(e) => setEditForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Cargo" className="text-sm" />
                <Input type="number" value={editForm.sueldoMensual ?? ""} onChange={(e) => setEditForm(f => ({ ...f, sueldoMensual: Number(e.target.value) }))} placeholder="Sueldo mensual" className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(s.id)}><Save className="w-3.5 h-3.5 mr-1" />Guardar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{s.apellido}, {s.nombre}</p>
                  {s.cargo && <p className="text-xs text-gray-500">{s.cargo}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-400">Sueldo: <span className="font-semibold text-gray-700">{fmt(s.sueldoMensual)}</span></span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-green-700 font-semibold">A cobrar: {fmt(Math.max(0, monthlyCalc(s)))}</span>
                  </div>
                  {workingDays.nonWorkingDays > 0 && (
                    <p className="text-[10px] text-red-500 mt-0.5">
                      Descuento: {fmt(dailyRate(s) * workingDays.nonWorkingDays)} ({workingDays.nonWorkingDays} día{workingDays.nonWorkingDays !== 1 ? "s" : ""})
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(s.id); setEditForm({ nombre: s.nombre, apellido: s.apellido, cargo: s.cargo, sueldoMensual: s.sueldoMensual, activo: s.activo }); }} className="text-gray-300 hover:text-violet-600 p-1">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-500 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agregar personal</p>
        <div className="grid grid-cols-2 gap-2">
          <Input value={form.nombre} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" className="text-sm" />
          <Input value={form.apellido} onChange={(e) => setForm(f => ({ ...f, apellido: e.target.value }))} placeholder="Apellido" className="text-sm" />
        </div>
        <Input value={form.cargo} onChange={(e) => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Cargo" className="text-sm" />
        <Input type="number" value={form.sueldoMensual} onChange={(e) => setForm(f => ({ ...f, sueldoMensual: e.target.value }))} placeholder="Sueldo mensual ($)" className="text-sm" />
        <Button size="sm" onClick={handleAdd} disabled={adding || !form.nombre || !form.apellido} className="w-full">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {adding ? "Guardando..." : "Agregar"}
        </Button>
      </div>
    </div>
  );
}

// ── SuperCenterPicker ──────────────────────────────────────────────────────
function SuperCenterPicker({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const centers = useListCenters();
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Centro</p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Seleccioná un centro...</option>
        {(centers.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Calendario() {
  const { centerId, role } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tab, setTab] = useState<"calendario" | "personal">("calendario");
  const [superCenterId, setSuperCenterId] = useState<number | null>(null);
  const isSuperAdmin = role === "superadmin";
  const effectiveCenterId = isSuperAdmin ? superCenterId : centerId;

  const [y, m] = month.split("-").map(Number);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  async function handleSeed() {
    if (!effectiveCenterId) return;
    const ok = window.confirm("¿Cargar el calendario académico 2026? Esto reemplazará todos los eventos 2026 ya cargados para este centro.");
    if (!ok) return;
    setSeeding(true);
    try {
      const r = await fetch(`${BASE}/calendario/seed-2026`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId: effectiveCenterId }),
      });
      if (r.ok) {
        setSeedDone(true);
        qc.invalidateQueries({ queryKey: ["cal-events", effectiveCenterId] });
        qc.invalidateQueries({ queryKey: ["cal-working", effectiveCenterId] });
        setTimeout(() => setSeedDone(false), 4000);
      }
    } finally {
      setSeeding(false);
    }
  }

  const eventsQ = useQuery({
    queryKey: ["cal-events", effectiveCenterId, month],
    queryFn: () => fetchEvents(effectiveCenterId, month),
  });

  const workingQ = useQuery({
    queryKey: ["cal-working", effectiveCenterId, month],
    queryFn: () => fetchWorkingDays(effectiveCenterId, month),
  });

  const days = getDays(month);
  const firstDow = dow(days[0]);
  const padding = firstDow === 0 ? 6 : firstDow - 1;

  const eventsByDate: Record<string, CalEvent[]> = {};
  (eventsQ.data ?? []).forEach((e) => {
    if (!eventsByDate[e.fecha]) eventsByDate[e.fecha] = [];
    eventsByDate[e.fecha].push(e);
  });

  function prevMonth() { const d = new Date(y, m - 2, 1); setMonth(d.toISOString().slice(0, 7)); }
  function nextMonth() { const d = new Date(y, m, 1); setMonth(d.toISOString().slice(0, 7)); }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["cal-events", effectiveCenterId, month] });
    qc.invalidateQueries({ queryKey: ["cal-working", effectiveCenterId, month] });
  }

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const canEdit = effectiveCenterId != null && effectiveCenterId !== 0;

  return (
    <div className="min-h-full bg-gray-50">
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Organización</div>
        <h1 className="text-2xl font-bold mt-1">Calendario</h1>
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 sticky top-0 z-10">
        {[
          { key: "calendario", label: "Calendario", icon: <CalendarDays className="w-4 h-4" /> },
          { key: "personal", label: "Personal y liquidación", icon: <Users className="w-4 h-4" /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === key ? "border-violet-600 text-violet-700" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto">
        {isSuperAdmin && <SuperCenterPicker value={superCenterId} onChange={setSuperCenterId} />}

        {tab === "calendario" && (
          <div className="space-y-4">
            {/* month nav */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="font-bold text-gray-900 text-lg">{MESES[m - 1]} {y}</h2>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {/* seed 2026 */}
            {canEdit && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  seedDone
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100"
                } disabled:opacity-50`}
              >
                <Download className="w-4 h-4" />
                {seeding ? "Cargando..." : seedDone ? "✓ Calendario 2026 cargado" : "Cargar calendario académico 2026"}
              </button>
            )}

            {/* add event */}
            {canEdit ? (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-500 hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Agregar evento
              </button>
            ) : isSuperAdmin ? (
              <p className="text-center text-sm text-gray-400 py-2">Seleccioná un centro para agregar eventos</p>
            ) : null}

            {/* legend */}
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TIPOS) as EventTipo[]).map((t) => (
                <span key={t} className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${TIPOS[t].bg} ${TIPOS[t].color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${TIPOS[t].dot}`} />
                  {TIPOS[t].label}
                </span>
              ))}
            </div>

            {/* calendar grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DOW_LABELS.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-bold py-2 ${i >= 5 ? "text-gray-300" : "text-gray-400"}`}>{d}</div>
                ))}
              </div>
              {/* cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                {Array.from({ length: padding }).map((_, i) => <div key={`pad-${i}`} className="min-h-[90px] bg-gray-50/50" />)}
                {days.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    events={eventsByDate[date] ?? []}
                    onClick={() => setSelectedDate(date)}
                  />
                ))}
              </div>
            </div>

            {/* summary */}
            {workingQ.data && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resumen del mes</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{workingQ.data.totalWeekdays}</div>
                    <div className="text-[10px] text-gray-400 font-semibold">Días hábiles</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-500">{workingQ.data.nonWorkingDays}</div>
                    <div className="text-[10px] text-gray-400 font-semibold">No laborables</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{workingQ.data.workingDays}</div>
                    <div className="text-[10px] text-gray-400 font-semibold">A liquidar</div>
                  </div>
                </div>
              </div>
            )}

            {/* events list */}
            {(eventsQ.data ?? []).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eventos del mes</p>
                {(eventsQ.data ?? []).map((e) => {
                  const d = new Date(e.fecha + "T12:00:00");
                  const tipo = TIPOS[e.tipo] ?? TIPOS.EVENTO;
                  return (
                    <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${tipo.bg}`}>
                      <div className={`w-1 self-stretch rounded-full ${tipo.solid}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold ${tipo.color}`}>{tipo.label}</span>
                        <span className="text-xs text-gray-500 ml-2 capitalize">
                          {d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                        {e.hora && <span className="text-xs text-gray-500 ml-2">· {e.hora}</span>}
                        {e.titulo && <p className="text-xs text-gray-700 truncate">{e.titulo}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "personal" && canEdit && workingQ.data && (
          <StaffPanel centerId={effectiveCenterId!} workingDays={workingQ.data} />
        )}
        {tab === "personal" && !canEdit && (
          <p className="text-center text-gray-400 py-12 text-sm">
            {isSuperAdmin ? "Seleccioná un centro arriba para ver el personal" : "Sin centro asignado"}
          </p>
        )}
      </div>

      {/* day modal */}
      {selectedDate && canEdit && (
        <DayModal
          date={selectedDate}
          centerId={effectiveCenterId!}
          events={selectedEvents}
          onClose={() => setSelectedDate(null)}
          onRefresh={() => { refresh(); setSelectedDate(null); }}
        />
      )}
    </div>
  );
}
