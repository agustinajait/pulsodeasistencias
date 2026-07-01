import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Save, Users, CalendarDays, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListCenters } from "@workspace/api-client-react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type EventTipo = "FERIADO" | "VACACIONES" | "SUPERVISION" | "CAPACITACION" | "SUSPENSION";

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
const TIPOS: Record<EventTipo, { label: string; color: string; bg: string; dot: string }> = {
  FERIADO:     { label: "Feriado",      color: "text-red-700",    bg: "bg-red-100",    dot: "bg-red-500" },
  VACACIONES:  { label: "Vacaciones",   color: "text-amber-700",  bg: "bg-amber-100",  dot: "bg-amber-500" },
  SUPERVISION: { label: "Supervisión",  color: "text-blue-700",   bg: "bg-blue-100",   dot: "bg-blue-500" },
  CAPACITACION:{ label: "Capacitación", color: "text-teal-700",   bg: "bg-teal-100",   dot: "bg-teal-500" },
  SUSPENSION:  { label: "Suspensión",   color: "text-orange-700", bg: "bg-orange-100", dot: "bg-orange-500" },
};

const NON_WORKING: EventTipo[] = ["FERIADO", "VACACIONES", "SUSPENSION"];

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ── Helpers ────────────────────────────────────────────────────────────────
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days: string[] = [];
  const total = new Date(y, m, 0).getDate();
  for (let d = 1; d <= total; d++) {
    days.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function isWeekend(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function dow(dateStr: string) {
  return new Date(dateStr + "T12:00:00").getDay(); // 0=sun
}

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

// ── EventDot ───────────────────────────────────────────────────────────────
function EventDot({ tipo }: { tipo: EventTipo }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${TIPOS[tipo].dot}`} />;
}

// ── DayCell ────────────────────────────────────────────────────────────────
function DayCell({
  date,
  events,
  onClick,
}: {
  date: string;
  events: CalEvent[];
  onClick: () => void;
}) {
  const day = parseInt(date.slice(-2));
  const weekend = isWeekend(date);
  const nonWorking = events.some((e) => NON_WORKING.includes(e.tipo));

  return (
    <button
      onClick={onClick}
      className={`min-h-[52px] p-1.5 rounded-lg text-left transition-colors border ${
        weekend
          ? "bg-gray-50 border-gray-100 text-gray-300"
          : nonWorking
          ? "bg-red-50 border-red-100"
          : "bg-white border-gray-100 hover:border-violet-200 hover:bg-violet-50/30"
      }`}
    >
      <span className={`text-xs font-bold block mb-1 ${weekend ? "text-gray-300" : nonWorking ? "text-red-400" : "text-gray-700"}`}>
        {day}
      </span>
      <div className="flex flex-wrap gap-0.5">
        {events.map((e) => (
          <EventDot key={e.id} tipo={e.tipo} />
        ))}
      </div>
    </button>
  );
}

// ── DayModal ───────────────────────────────────────────────────────────────
function DayModal({
  date,
  centerId,
  events,
  onClose,
  onRefresh,
}: {
  date: string;
  centerId: number;
  events: CalEvent[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tipo, setTipo] = useState<EventTipo>("FERIADO");
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

        <div className="px-5 py-4 space-y-3">
          {/* existing events */}
          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${TIPOS[e.tipo].bg}`}>
                  <div>
                    <span className={`text-xs font-bold ${TIPOS[e.tipo].color}`}>{TIPOS[e.tipo].label}</span>
                    {e.hora && <span className="text-xs text-gray-500 ml-2">{e.hora}</span>}
                    {e.titulo && <span className="text-xs text-gray-600 ml-2">{e.titulo}</span>}
                  </div>
                  <button onClick={() => handleDelete(e.id)} className="text-gray-300 hover:text-red-500 ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* add new */}
          <div className="space-y-2 pt-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agregar evento</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(TIPOS) as EventTipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                    tipo === t ? `${TIPOS[t].bg} ${TIPOS[t].color} border-transparent` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {TIPOS[t].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Descripción (opcional)"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="text-sm flex-1"
              />
              <Input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="text-sm w-28"
                title="Hora (opcional)"
              />
            </div>
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
      {/* resumen días */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: workingDays.totalWeekdays, l: "Días hábiles" },
          { v: workingDays.nonWorkingDays, l: "Días no laborables", color: "text-red-600" },
          { v: workingDays.workingDays, l: "Días a liquidar", color: "text-green-600" },
        ].map(({ v, l, color }) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>{v}</div>
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* staff list */}
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

      {/* add staff form */}
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
const DOW_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Calendario() {
  const { centerId, role } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tab, setTab] = useState<"calendario" | "personal">("calendario");
  // For superadmin (centerId=0), use a local centerId picker
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
  // padding to start on Monday
  const firstDow = dow(days[0]); // 0=sun
  const padding = firstDow === 0 ? 6 : firstDow - 1;

  const eventsByDate: Record<string, CalEvent[]> = {};
  (eventsQ.data ?? []).forEach((e) => {
    if (!eventsByDate[e.fecha]) eventsByDate[e.fecha] = [];
    eventsByDate[e.fecha].push(e);
  });

  function prevMonth() {
    const d = new Date(y, m - 2, 1);
    setMonth(d.toISOString().slice(0, 7));
  }

  function nextMonth() {
    const d = new Date(y, m, 1);
    setMonth(d.toISOString().slice(0, 7));
  }

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
        {/* superadmin center picker */}
        {isSuperAdmin && <SuperCenterPicker value={superCenterId} onChange={setSuperCenterId} />}

        {tab === "calendario" && (
          <div className="space-y-4">
            {/* month nav */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
              <h2 className="font-bold text-gray-900">{MESES[m - 1]} {y}</h2>
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

            {/* add event CTA */}
            {canEdit ? (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-500 hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Agregar evento (feriado, supervisión, capacitación...)
              </button>
            ) : (
              <p className="text-center text-sm text-gray-400 py-2">
                {isSuperAdmin ? "Seleccioná un centro para agregar eventos" : ""}
              </p>
            )}

            {/* legend */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIPOS) as EventTipo[]).map((t) => (
                <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TIPOS[t].bg} ${TIPOS[t].color}`}>
                  {TIPOS[t].label}
                </span>
              ))}
            </div>

            {/* calendar grid */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
              {/* day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DOW_LABELS.map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {/* cells */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: padding }).map((_, i) => <div key={`pad-${i}`} />)}
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
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eventos del mes</p>
                {(eventsQ.data ?? []).map((e) => {
                  const d = new Date(e.fecha + "T12:00:00");
                  return (
                    <div key={e.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${TIPOS[e.tipo].bg}`}>
                      <div className="flex-1">
                        <span className={`text-xs font-bold ${TIPOS[e.tipo].color}`}>{TIPOS[e.tipo].label}</span>
                        <span className="text-xs text-gray-500 ml-2 capitalize">
                          {d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                        {e.hora && <span className="text-xs text-gray-500 ml-2">· {e.hora}</span>}
                        {e.titulo && <span className="text-xs text-gray-600 ml-1">· {e.titulo}</span>}
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
          onRefresh={() => { refresh(); }}
        />
      )}
    </div>
  );
}
