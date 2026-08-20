import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Plus, ChevronLeft, Trash2, Save, Printer, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
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
async function fetchCenterProfile(centerId: number | null | undefined) {
  if (!centerId) return null;
  const r = await fetch(`${BASE}/centers/${centerId}/profile`);
  return r.ok ? r.json() : null;
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

// ── Bullet list from newline-separated text ────────────────────────────────
function BulletList({ text, color = "bg-violet-100 text-violet-700" }: { text?: string; color?: string }) {
  if (!text?.trim()) return <span className="text-gray-300 text-xs italic">—</span>;
  const items = text.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className={`mt-0.5 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>•</span>
          <span className="text-xs text-gray-700 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Expandable text cell (for inicio/desarrollo/cierre) ───────────────────
function ExpandableText({ text, label }: { text?: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return <span className="text-gray-300 text-xs italic">—</span>;
  const preview = text.trim().slice(0, 90) + (text.trim().length > 90 ? "…" : "");
  return (
    <div>
      <div className="text-xs text-gray-700 leading-relaxed">{open ? text.trim() : preview}</div>
      {text.trim().length > 90 && (
        <button
          onClick={() => setOpen(o => !o)}
          className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-violet-500 hover:text-violet-700"
        >
          {open ? <><ChevronUp className="w-3 h-3"/>Ver menos</> : <><ChevronDown className="w-3 h-3"/>Ver más</>}
        </button>
      )}
    </div>
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
  const [resumiendo, setResumiendo] = useState<Record<string, boolean>>({});

  function upd(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function resumirCampo(campo: "inicio" | "desarrollo" | "cierre") {
    const texto = form[campo];
    if (!texto?.trim() || texto.trim().length < 40) return;
    setResumiendo(r => ({ ...r, [campo]: true }));
    try {
      const r = await fetch(`${BASE}/ai/resumir-bloque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, texto, bloque: form.nombre }),
      });
      const j = await r.json();
      if (j.summary) upd(campo, j.summary);
    } finally {
      setResumiendo(r => ({ ...r, [campo]: false }));
    }
  }

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
        {([
          { key: "inicio" as const, label: "Inicio", placeholder: "Cómo se inicia...", border: "border-l-sky-400" },
          { key: "desarrollo" as const, label: "Desarrollo", placeholder: "Desarrollo de la actividad...", border: "border-l-emerald-400" },
          { key: "cierre" as const, label: "Cierre", placeholder: "Cierre y registro...", border: "border-l-rose-400" },
        ]).map(({ key, label, placeholder, border }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
              {form[key]?.trim().length > 40 && (
                <button
                  type="button"
                  onClick={() => resumirCampo(key)}
                  disabled={resumiendo[key]}
                  className="flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700 disabled:opacity-50 disabled:cursor-wait"
                  title="Resumir con IA"
                >
                  <Sparkles className="w-3 h-3" />
                  {resumiendo[key] ? "Resumiendo..." : "Resumir con IA"}
                </button>
              )}
            </div>
            <div className={`border-l-2 ${border} rounded-r-lg`}>
              <TA value={form[key]} onChange={(v) => upd(key, v)} placeholder={placeholder} rows={5} />
            </div>
          </div>
        ))}
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

// ── PlanView (vista card + PDF) ────────────────────────────────────────────
function PlanView({ plan, roomName, onEdit, profile }: { plan: Plan; roomName: string; onEdit: () => void; profile?: { logoBase64?: string; nombre?: string; direccion?: string } | null }) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const logo = profile?.logoBase64 ? `<img src="${profile.logoBase64}" style="height:52px;object-fit:contain;" />` : "";
    const centerName = profile?.nombre ?? "";
    const address = profile?.direccion ?? "";

    // Build PDF-specific HTML (no expandable buttons, full text)
    const bloquesHtml = plan.bloques.map(b => {
      const actItems = (b.actividades ?? "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
      const matItems = (b.materiales ?? "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
      const actHtml = actItems.length ? `<ul style="margin:0;padding-left:14px;">${actItems.map(i=>`<li>${i}</li>`).join("")}</ul>` : "—";
      const matHtml = matItems.length ? `<ul style="margin:0;padding-left:14px;">${matItems.map(i=>`<li>${i}</li>`).join("")}</ul>` : "—";
      return `<tr>
        <td style="border:1px solid #ccc;padding:6px 8px;font-weight:600;vertical-align:top;min-width:80px;">${b.nombre}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;">${actHtml}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;">${matHtml}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;font-size:9.5px;">${b.inicio ?? "—"}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;font-size:9.5px;">${b.desarrollo ?? "—"}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;vertical-align:top;font-size:9.5px;">${b.cierre ?? "—"}</td>
      </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Planificación ${mesLabel(plan.mes)}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm 18mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #111; }
      .org-header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1e1147; padding-bottom: 10px; margin-bottom: 10px; }
      .org-name { font-size: 15px; font-weight: 800; color: #1e1147; }
      .org-addr { font-size: 9px; color: #666; }
      .plan-meta { display: flex; gap: 24px; font-size: 10px; margin-bottom: 10px; }
      .plan-meta span { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e1147; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { vertical-align: top; font-size: 9.5px; }
      ul { margin: 0; padding-left: 14px; }
      li { margin-bottom: 2px; }
    </style></head><body>
    <div class="org-header">
      ${logo}
      <div>
        ${centerName ? `<div class="org-name">${centerName}</div>` : ""}
        ${address ? `<div class="org-addr">${address}</div>` : ""}
      </div>
    </div>
    <div class="plan-meta">
      <div><span>Sala/Aldea:</span> ${roomName}</div>
      ${plan.liderPedagogica ? `<div><span>Líder pedagógica:</span> ${plan.liderPedagogica}</div>` : ""}
      ${plan.facilitadoras ? `<div><span>Facilitadoras:</span> ${plan.facilitadoras}</div>` : ""}
      <div><span>Mes:</span> ${mesLabel(plan.mes)} ${plan.mes.split("-")[0]}</div>
    </div>
    ${plan.observaciones ? `<p style="margin:0 0 10px;font-style:italic;color:#444;">${plan.observaciones}</p>` : ""}
    <table>
      <thead><tr>
        <th style="width:11%">Bloque</th><th style="width:16%">Actividades</th><th style="width:12%">Materiales</th>
        <th style="width:20%">Inicio</th><th style="width:21%">Desarrollo</th><th style="width:20%">Cierre</th>
      </tr></thead>
      <tbody>${bloquesHtml}</tbody>
    </table>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onEdit}>Editar planificación</Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir / PDF
        </Button>
      </div>

      <div ref={printRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Centro header */}
        <div className="bg-[#1e1147] px-6 py-4 flex items-center gap-4">
          {profile?.logoBase64 && (
            <img src={profile.logoBase64} alt="Logo" className="h-12 w-12 object-contain rounded-lg bg-white/10 p-1 shrink-0" />
          )}
          <div>
            {profile?.nombre && <div className="text-white font-bold text-base leading-tight">{profile.nombre}</div>}
            {profile?.direccion && <div className="text-white/50 text-xs mt-0.5">{profile.direccion}</div>}
          </div>
        </div>

        {/* Plan meta */}
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap gap-x-6 gap-y-1">
          <p className="text-sm"><span className="font-bold text-gray-600">Sala/Aldea:</span> <span className="text-gray-800">{roomName}</span></p>
          {plan.liderPedagogica && <p className="text-sm"><span className="font-bold text-gray-600">Líder pedagógica:</span> <span className="text-gray-800">{plan.liderPedagogica}</span></p>}
          {plan.facilitadoras && <p className="text-sm"><span className="font-bold text-gray-600">Facilitadoras:</span> <span className="text-gray-800">{plan.facilitadoras}</span></p>}
          <p className="text-sm"><span className="font-bold text-gray-600">Mes:</span> <span className="text-gray-800">{mesLabel(plan.mes)} {plan.mes.split("-")[0]}</span></p>
          {plan.observaciones && <p className="text-sm text-gray-500 italic w-full">{plan.observaciones}</p>}
        </div>

        {/* Bloques as cards */}
        {plan.bloques.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-10">Sin bloques cargados todavía</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {plan.bloques.map((b) => (
              <div key={b.id} className="px-6 py-5">
                {/* Bloque name */}
                <div className="text-sm font-bold text-[#1e1147] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0"/>
                  {b.nombre}
                </div>

                {/* Actividades + Materiales */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-2">Actividades</p>
                    <BulletList text={b.actividades} color="bg-violet-100 text-violet-700" />
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Materiales</p>
                    <BulletList text={b.materiales} color="bg-amber-100 text-amber-700" />
                  </div>
                </div>

                {/* Inicio / Desarrollo / Cierre */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Inicio", text: b.inicio, border: "border-l-sky-400", bg: "bg-sky-50" },
                    { label: "Desarrollo", text: b.desarrollo, border: "border-l-emerald-400", bg: "bg-emerald-50" },
                    { label: "Cierre", text: b.cierre, border: "border-l-rose-400", bg: "bg-rose-50" },
                  ].map(({ label, text, border, bg }) => (
                    <div key={label} className={`${bg} border-l-2 ${border} rounded-r-xl px-3 py-2.5`}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
                      <ExpandableText text={text} label={label} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PlanEditor ─────────────────────────────────────────────────────────────
function PlanEditor({ plan, rooms, onBack }: { plan: Plan; rooms: any[]; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { centerId } = useAuth();
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

  const profileQ = useQuery({
    queryKey: ["center-profile-plan", centerId],
    queryFn: () => fetchCenterProfile(centerId),
    enabled: !!centerId,
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
        <PlanView plan={current} roomName={roomName} onEdit={() => setView("edit")} profile={profileQ.data} />
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
