import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Plus, ChevronLeft, Trash2, Save, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type Bloque = {
  id: number;
  planificacionId: number;
  nombre: string;
  actividades?: string;
  materiales?: string;
  inicio?: string;
  desarrollo?: string;
  cierre?: string;
  orden: number;
};

type Plan = {
  id: number;
  centerId: number;
  roomId?: number;
  mes: string;
  liderPedagogica?: string;
  facilitadoras?: string;
  observaciones?: string;
  bloques: Bloque[];
};

// ── Helpers ────────────────────────────────────────────────────────────────
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function mesLabel(ym: string) {
  const [, m] = ym.split("-");
  return MESES[parseInt(m) - 1] ?? ym;
}
function currentMonth() { return new Date().toISOString().slice(0, 7); }

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchPlans(centerId: number | null): Promise<Plan[]> {
  if (!centerId) return [];
  const r = await fetch(`${BASE}/planificaciones?centerId=${centerId}`);
  return r.ok ? r.json() : [];
}
async function fetchPlan(id: number): Promise<Plan> {
  const r = await fetch(`${BASE}/planificaciones/${id}`);
  return r.json();
}

// ── TextArea helper ────────────────────────────────────────────────────────
function TA({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-violet-400"
    />
  );
}

// ── BloqueForm ─────────────────────────────────────────────────────────────
function BloqueForm({
  planId,
  bloque,
  onSaved,
  onCancel,
  onDelete,
}: {
  planId: number;
  bloque?: Bloque;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState({
    nombre: bloque?.nombre ?? "",
    actividades: bloque?.actividades ?? "",
    materiales: bloque?.materiales ?? "",
    inicio: bloque?.inicio ?? "",
    desarrollo: bloque?.desarrollo ?? "",
    cierre: bloque?.cierre ?? "",
  });
  const [saving, setSaving] = useState(false);

  function upd(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    if (bloque) {
      await fetch(`${BASE}/planificaciones/${planId}/bloques/${bloque.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch(`${BASE}/planificaciones/${planId}/bloques`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="bg-violet-50 rounded-xl p-4 space-y-3 border border-violet-100">
      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Nombre del bloque</label>
        <Input value={form.nombre} onChange={(e) => upd("nombre", e.target.value)} placeholder="Ej: Bloque Pedagógico" className="text-sm" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Actividades</label>
          <TA value={form.actividades} onChange={(v) => upd("actividades", v)} placeholder="Lista de actividades..." rows={5} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Materiales</label>
          <TA value={form.materiales} onChange={(v) => upd("materiales", v)} placeholder="Lista de materiales..." rows={5} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Inicio</label>
          <TA value={form.inicio} onChange={(v) => upd("inicio", v)} placeholder="Cómo se inicia..." rows={5} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Desarrollo</label>
          <TA value={form.desarrollo} onChange={(v) => upd("desarrollo", v)} placeholder="Desarrollo de la actividad..." rows={5} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Cierre</label>
          <TA value={form.cierre} onChange={(v) => upd("cierre", v)} placeholder="Cierre y registro..." rows={5} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving || !form.nombre}>
          <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando..." : bloque ? "Actualizar" : "Agregar bloque"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
        {onDelete && (
          <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── PlanView (tabla estilo PDF) ────────────────────────────────────────────
function PlanView({ plan, roomName, onEdit }: { plan: Plan; roomName: string; onEdit: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Planificación ${mesLabel(plan.mes)}</title>
      <style>
        body { font-family: serif; font-size: 11px; margin: 20px; }
        h2 { font-size: 14px; } p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 10px; }
        th { font-weight: bold; background: #f0f0f0; }
        .label { font-weight: bold; font-size: 10px; }
      </style></head><body>${content}</body></html>
    `);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onEdit}>Editar planificación</Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir / PDF
        </Button>
      </div>

      <div ref={printRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {/* Header */}
        <div className="space-y-1 mb-5">
          <p className="text-sm"><span className="font-bold underline">Sala/Aldea:</span> {roomName}</p>
          {plan.liderPedagogica && <p className="text-sm"><span className="font-bold underline">Líder pedagógica:</span> {plan.liderPedagogica}</p>}
          {plan.facilitadoras && <p className="text-sm"><span className="font-bold underline">Facilitadoras:</span> {plan.facilitadoras}</p>}
          <p className="text-sm"><span className="font-bold underline">Mes:</span> {mesLabel(plan.mes)} {plan.mes.split("-")[0]}</p>
          {plan.observaciones && (
            <p className="text-sm mt-2"><span className="font-bold">●</span> {plan.observaciones}</p>
          )}
        </div>

        {/* Table */}
        {plan.bloques.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {["Bloque","Actividad","Materiales","Inicio","Desarrollo","Cierre"].map((h) => (
                    <th key={h} className="border border-gray-300 px-3 py-2 text-left font-bold text-[11px] min-w-[100px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.bloques.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="border border-gray-300 px-3 py-2 font-semibold whitespace-pre-wrap">{b.nombre}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{b.actividades}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{b.materiales}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{b.inicio}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{b.desarrollo}</td>
                    <td className="border border-gray-300 px-3 py-2 whitespace-pre-wrap">{b.cierre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic text-center py-8">Sin bloques cargados todavía</p>
        )}
      </div>
    </div>
  );
}

// ── PlanEditor ─────────────────────────────────────────────────────────────
function PlanEditor({ plan, rooms, onBack }: { plan: Plan; rooms: any[]; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"table" | "edit">("table");
  const [addingBloque, setAddingBloque] = useState(false);
  const [editingBloqueId, setEditingBloqueId] = useState<number | null>(null);
  const [header, setHeader] = useState({
    liderPedagogica: plan.liderPedagogica ?? "",
    facilitadoras: plan.facilitadoras ?? "",
    observaciones: plan.observaciones ?? "",
    roomId: plan.roomId ? String(plan.roomId) : "",
    mes: plan.mes,
  });

  const planQ = useQuery({
    queryKey: ["plan-detail", plan.id],
    queryFn: () => fetchPlan(plan.id),
    initialData: plan,
  });
  const current = planQ.data ?? plan;
  const roomName = rooms.find((r) => r.id === current.roomId)?.name ?? `Sala ${current.roomId ?? ""}`;

  async function saveHeader() {
    await fetch(`${BASE}/planificaciones/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...header, centerId: plan.centerId, roomId: header.roomId ? Number(header.roomId) : null }),
    });
    qc.invalidateQueries({ queryKey: ["plan-detail", plan.id] });
    qc.invalidateQueries({ queryKey: ["plans", plan.centerId] });
    toast({ title: "Guardado" });
  }

  async function deleteBloque(bloqueId: number) {
    await fetch(`${BASE}/planificaciones/${plan.id}/bloques/${bloqueId}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["plan-detail", plan.id] });
  }

  function refreshPlan() {
    qc.invalidateQueries({ queryKey: ["plan-detail", plan.id] });
    setAddingBloque(false);
    setEditingBloqueId(null);
  }

  return (
    <div className="space-y-4">
      {/* back + tabs */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setView("table")} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "table" ? "bg-white shadow-sm text-violet-700" : "text-gray-500"}`}>Vista</button>
          <button onClick={() => setView("edit")} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "edit" ? "bg-white shadow-sm text-violet-700" : "text-gray-500"}`}>Editar</button>
        </div>
        <span className="text-sm font-semibold text-gray-700 ml-1">{mesLabel(current.mes)} {current.mes.split("-")[0]} · {roomName}</span>
      </div>

      {view === "table" && (
        <PlanView plan={current} roomName={roomName} onEdit={() => setView("edit")} />
      )}

      {view === "edit" && (
        <div className="space-y-5">
          {/* Header fields */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Encabezado</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Mes</label>
                <Input type="month" value={header.mes} onChange={(e) => setHeader(h => ({ ...h, mes: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sala</label>
                <select
                  value={header.roomId}
                  onChange={(e) => setHeader(h => ({ ...h, roomId: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sin sala</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Líder pedagógica</label>
              <Input value={header.liderPedagogica} onChange={(e) => setHeader(h => ({ ...h, liderPedagogica: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Facilitadoras</label>
              <Input value={header.facilitadoras} onChange={(e) => setHeader(h => ({ ...h, facilitadoras: e.target.value }))} placeholder="Ej: Melina Gallo - Candelaria Salto" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observaciones generales</label>
              <TA value={header.observaciones} onChange={(v) => setHeader(h => ({ ...h, observaciones: v }))} placeholder="Descripción general del mes..." rows={2} />
            </div>
            <Button size="sm" onClick={saveHeader}><Save className="w-3.5 h-3.5 mr-1" />Guardar encabezado</Button>
          </div>

          {/* Bloques */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bloques ({current.bloques.length})</p>
              {!addingBloque && (
                <button onClick={() => setAddingBloque(true)} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />Agregar bloque
                </button>
              )}
            </div>

            {addingBloque && (
              <BloqueForm planId={plan.id} onSaved={refreshPlan} onCancel={() => setAddingBloque(false)} />
            )}

            {current.bloques.map((b) => (
              <div key={b.id}>
                {editingBloqueId === b.id ? (
                  <BloqueForm
                    planId={plan.id}
                    bloque={b}
                    onSaved={refreshPlan}
                    onCancel={() => setEditingBloqueId(null)}
                    onDelete={() => { deleteBloque(b.id); setEditingBloqueId(null); refreshPlan(); }}
                  />
                ) : (
                  <div
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-violet-200 transition-colors"
                    onClick={() => setEditingBloqueId(b.id)}
                  >
                    <p className="font-semibold text-sm text-gray-900">{b.nombre}</p>
                    {b.actividades && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{b.actividades}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Planificaciones() {
  const { centerId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ mes: currentMonth(), roomId: "" });

  const plansQ = useQuery({
    queryKey: ["plans", centerId],
    queryFn: () => fetchPlans(centerId),
  });

  const roomsQ = useListRooms();
  const rooms = (roomsQ.data ?? []).filter((r: any) => !centerId || r.centerId === centerId);

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/planificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId, mes: newForm.mes, roomId: newForm.roomId ? Number(newForm.roomId) : null }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["plans", centerId] });
      setCreating(false);
      setSelectedPlan(data);
      toast({ title: "Planificación creada" });
    },
  });

  async function deletePlan(id: number) {
    await fetch(`${BASE}/planificaciones/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["plans", centerId] });
    if (selectedPlan?.id === id) setSelectedPlan(null);
  }

  if (selectedPlan) {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 lg:pt-8">
          <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Planificaciones</div>
          <h1 className="text-2xl font-bold mt-1">Planificación mensual</h1>
        </div>
        <div className="px-4 py-5 max-w-5xl mx-auto">
          <PlanEditor plan={selectedPlan} rooms={rooms} onBack={() => setSelectedPlan(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Organización</div>
        <h1 className="text-2xl font-bold mt-1">Planificaciones y cronogramas</h1>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* new plan button */}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-violet-200 text-violet-500 hover:border-violet-400 hover:bg-violet-50 transition-colors text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />Nueva planificación
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nueva planificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Mes</label>
                <Input type="month" value={newForm.mes} onChange={(e) => setNewForm(f => ({ ...f, mes: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sala</label>
                <select
                  value={newForm.roomId}
                  onChange={(e) => setNewForm(f => ({ ...f, roomId: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Sin sala específica</option>
                  {rooms.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending ? "Creando..." : "Crear"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* list */}
        {plansQ.isPending && (
          <p className="text-center py-12 text-sm text-gray-400">Cargando...</p>
        )}

        {!plansQ.isPending && (plansQ.data ?? []).length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Todavía no hay planificaciones cargadas</p>
          </div>
        )}

        <div className="space-y-2">
          {(plansQ.data ?? []).map((p) => {
            const room = rooms.find((r: any) => r.id === p.roomId);
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-violet-200 transition-all"
                onClick={() => setSelectedPlan(p)}
              >
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{mesLabel(p.mes)} {p.mes.split("-")[0]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {room ? room.name : "Sin sala"}{p.liderPedagogica ? ` · ${p.liderPedagogica}` : ""}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">{p.bloques.length} bloque{p.bloques.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePlan(p.id); }}
                    className="text-gray-200 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
