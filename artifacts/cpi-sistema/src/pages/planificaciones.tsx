import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Plus, ChevronLeft, Trash2, Save, Printer, ChevronDown, ChevronUp, Sparkles, ShoppingCart, X, CalendarDays } from "lucide-react";
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
  token,
  planId,
  bloque,
  onSaved,
  onCancel,
  onDelete,
}: {
  token?: string | null;
  planId: number;
  bloque?: Bloque;
  onSaved: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  function parseLines(text?: string) {
    const lines = (text ?? "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
    return lines.length ? lines : [""];
  }

  const [form, setForm] = useState({
    nombre: bloque?.nombre ?? "",
    inicio: bloque?.inicio ?? "",
    desarrollo: bloque?.desarrollo ?? "",
    cierre: bloque?.cierre ?? "",
  });
  const [actividades, setActividades] = useState<string[]>(parseLines(bloque?.actividades));
  const [materiales, setMateriales] = useState<string[]>(parseLines(bloque?.materiales));
  const [saving, setSaving] = useState(false);
  const [resumiendo, setResumiendo] = useState<Record<string, boolean>>({});

  function upd(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter(prev => [...prev, ""]);
  }
  function updateItem(setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number, val: string) {
    setter(prev => prev.map((v, i) => i === idx ? val : v));
  }
  function removeItem(setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number) {
    setter(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : [""]);
  }

  async function resumirCampo(campo: "inicio" | "desarrollo" | "cierre") {
    const texto = form[campo];
    if (!texto?.trim() || texto.trim().length < 40) return;
    setResumiendo(r => ({ ...r, [campo]: true }));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${BASE}/ai/resumir-bloque`, {
        method: "POST",
        headers,
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
    const payload = {
      ...form,
      actividades: actividades.filter(Boolean).join("\n"),
      materiales: materiales.filter(Boolean).join("\n"),
    };
    if (bloque) {
      await fetch(`${BASE}/planificaciones/${planId}/bloques/${bloque.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${BASE}/planificaciones/${planId}/bloques`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        {/* Actividades */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actividades</label>
            <button type="button" onClick={() => addItem(setActividades)}
              className="flex items-center gap-1 text-[10px] font-bold text-violet-500 hover:text-violet-700 bg-violet-100 hover:bg-violet-200 px-2 py-0.5 rounded-full transition-colors">
              <Plus className="w-3 h-3" />Agregar
            </button>
          </div>
          <div className="space-y-1.5">
            {actividades.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold flex items-center justify-center">{idx + 1}</span>
                <input
                  value={item}
                  onChange={e => updateItem(setActividades, idx, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(setActividades); } }}
                  placeholder={`Actividad ${idx + 1}...`}
                  className="flex-1 text-sm border border-violet-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
                <button type="button" onClick={() => removeItem(setActividades, idx)}
                  className="shrink-0 text-gray-300 hover:text-red-400 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        {/* Materiales */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Materiales</label>
            <button type="button" onClick={() => addItem(setMateriales)}
              className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors">
              <Plus className="w-3 h-3" />Agregar
            </button>
          </div>
          <div className="space-y-1.5">
            {materiales.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold flex items-center justify-center">{idx + 1}</span>
                <input
                  value={item}
                  onChange={e => updateItem(setMateriales, idx, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(setMateriales); } }}
                  placeholder={`Material ${idx + 1}...`}
                  className="flex-1 text-sm border border-amber-200 bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button type="button" onClick={() => removeItem(setMateriales, idx)}
                  className="shrink-0 text-gray-300 hover:text-red-400 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {([
          { key: "inicio" as const, label: "Inicio", placeholder: "¿Cómo se presenta la actividad? ¿Qué pregunta o consigna se da para motivar al grupo?", hint: "Cómo se abre el espacio y se presenta la propuesta", border: "border-l-sky-400" },
          { key: "desarrollo" as const, label: "Desarrollo", placeholder: "¿Qué hace el grupo? ¿Cómo interviene la facilitadora? ¿Qué se espera que pase?", hint: "El corazón de la actividad: qué se hace y cómo se acompaña", border: "border-l-emerald-400" },
          { key: "cierre" as const, label: "Cierre", placeholder: "¿Cómo se cierra? ¿Qué se registra o comparte? ¿Qué se lleva cada uno?", hint: "Cómo se concluye y qué queda registrado", border: "border-l-rose-400" },
        ]).map(({ key, label, placeholder, hint, border }) => (
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
            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{hint}</p>
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
    const logo = profile?.logoBase64 ? `<img src="${profile.logoBase64}" style="height:52px;object-fit:contain;border-radius:8px;" />` : "";
    const centerName = profile?.nombre ?? "";
    const address = profile?.direccion ?? "";

    function bulletHtml(text: string | undefined, color: string, dotColor: string) {
      if (!text?.trim()) return `<span style="color:#ccc;font-style:italic;font-size:9px;">—</span>`;
      const items = text.split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
      return `<ul style="margin:0;padding:0;list-style:none;">${items.map(i =>
        `<li style="display:flex;align-items:flex-start;gap:5px;margin-bottom:3px;">
          <span style="display:inline-block;min-width:14px;height:14px;line-height:14px;text-align:center;background:${color};color:${dotColor};font-size:7px;font-weight:bold;border-radius:50%;margin-top:1px;">•</span>
          <span style="font-size:9.5px;color:#333;line-height:1.4;">${i}</span>
        </li>`
      ).join("")}</ul>`;
    }

    const bloquesHtml = plan.bloques.map(b => `
      <div style="border:1px solid #e5e7eb;border-radius:12px;margin-bottom:14px;overflow:hidden;break-inside:avoid;">
        <div style="background:#f5f3ff;border-bottom:2px solid #ede9fe;padding:8px 14px;display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#a78bfa;display:inline-block;flex-shrink:0;"></span>
          <span style="font-size:11px;font-weight:700;color:#1e1147;">${b.nombre}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 14px;">
          <div style="background:#f5f3ff;border-radius:10px;padding:10px;">
            <div style="font-size:8px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Actividades</div>
            ${bulletHtml(b.actividades, "#ede9fe", "#7c3aed")}
          </div>
          <div style="background:#fffbeb;border-radius:10px;padding:10px;">
            <div style="font-size:8px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Materiales</div>
            ${bulletHtml(b.materiales, "#fde68a", "#92400e")}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:0 14px 12px;">
          <div style="background:#f0f9ff;border-left:3px solid #38bdf8;border-radius:0 8px 8px 0;padding:8px 10px;">
            <div style="font-size:8px;font-weight:700;color:#0284c7;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Inicio</div>
            <p style="margin:0;font-size:9px;color:#374151;line-height:1.5;">${b.inicio?.trim() || '<span style="color:#ccc;font-style:italic;">—</span>'}</p>
          </div>
          <div style="background:#f0fdf4;border-left:3px solid #34d399;border-radius:0 8px 8px 0;padding:8px 10px;">
            <div style="font-size:8px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Desarrollo</div>
            <p style="margin:0;font-size:9px;color:#374151;line-height:1.5;">${b.desarrollo?.trim() || '<span style="color:#ccc;font-style:italic;">—</span>'}</p>
          </div>
          <div style="background:#fff1f2;border-left:3px solid #fb7185;border-radius:0 8px 8px 0;padding:8px 10px;">
            <div style="font-size:8px;font-weight:700;color:#e11d48;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;">Cierre</div>
            <p style="margin:0;font-size:9px;color:#374151;line-height:1.5;">${b.cierre?.trim() || '<span style="color:#ccc;font-style:italic;">—</span>'}</p>
          </div>
        </div>
      </div>
    `).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Planificación ${mesLabel(plan.mes)}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm 16mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #111; background: #fff; }
    </style></head><body>
    <!-- Header -->
    <div style="background:#1e1147;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:12px;">
      ${logo}
      <div>
        ${centerName ? `<div style="font-size:15px;font-weight:800;color:#fff;line-height:1.2;">${centerName}</div>` : ""}
        ${address ? `<div style="font-size:9px;color:rgba(255,255,255,0.55);margin-top:2px;">${address}</div>` : ""}
      </div>
    </div>
    <!-- Meta -->
    <div style="display:flex;flex-wrap:wrap;gap:16px;padding:8px 4px 10px;border-bottom:1px solid #e5e7eb;margin-bottom:12px;">
      <div style="font-size:10px;"><strong style="color:#555;">Sala/Aldea:</strong> ${roomName}</div>
      ${plan.liderPedagogica ? `<div style="font-size:10px;"><strong style="color:#555;">Líder pedagógica:</strong> ${plan.liderPedagogica}</div>` : ""}
      ${plan.facilitadoras ? `<div style="font-size:10px;"><strong style="color:#555;">Facilitadoras:</strong> ${plan.facilitadoras}</div>` : ""}
      <div style="font-size:10px;"><strong style="color:#555;">Mes:</strong> ${mesLabel(plan.mes)} ${plan.mes.split("-")[0]}</div>
      ${plan.observaciones ? `<div style="font-size:9.5px;color:#888;font-style:italic;width:100%;margin-top:2px;">${plan.observaciones}</div>` : ""}
    </div>
    <!-- Bloques -->
    ${bloquesHtml}
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

// ── MaterialesCosto ────────────────────────────────────────────────────────
type MatItem = { id?: number; nombre: string; cantidad: number; precioUnitario: number; unidad: string; orden: number };

function parseMaterialesFromBloques(bloques: Bloque[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  bloques.forEach(b => {
    (b.materiales ?? "").split("\n").forEach(line => {
      const clean = line.replace(/^[-•*]\s*/, "").trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        result.push(clean);
      }
    });
  });
  return result;
}

function MaterialesCosto({ planId, bloques, mesLabel: mes, roomName, profile }: {
  planId: number; bloques: Bloque[]; mesLabel: string; roomName: string;
  profile?: { logoBase64?: string; nombre?: string } | null;
}) {
  const [items, setItems] = useState<MatItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load saved costs
  useEffect(() => {
    fetch(`${BASE}/planificaciones/${planId}/materiales-costo`)
      .then(r => r.json())
      .then((data: MatItem[]) => {
        setItems(data.length ? data : []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [planId]);

  // Import from bloques (deduplicated)
  function importFromBloques() {
    const fromBloques = parseMaterialesFromBloques(bloques);
    const existingNames = new Set(items.map(i => i.nombre.toLowerCase()));
    const toAdd = fromBloques
      .filter(n => !existingNames.has(n.toLowerCase()))
      .map((nombre, i) => ({ nombre, cantidad: 1, precioUnitario: 0, unidad: "unid.", orden: items.length + i }));
    setItems(prev => [...prev, ...toAdd]);
  }

  function addRow() {
    setItems(prev => [...prev, { nombre: "", cantidad: 1, precioUnitario: 0, unidad: "unid.", orden: prev.length }]);
  }

  function updateItem(idx: number, field: keyof MatItem, value: string | number) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    await fetch(`${BASE}/planificaciones/${planId}/materiales-costo`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items.map((it, i) => ({ ...it, orden: i }))),
    });
    setSaving(false);
  }

  function handlePrint() {
    const logo = profile?.logoBase64 ? `<img src="${profile.logoBase64}" style="height:44px;object-fit:contain;" />` : "";
    const rows = items.map(it => {
      const sub = (it.cantidad * it.precioUnitario).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
      return `<tr>
        <td>${it.nombre}</td>
        <td style="text-align:center">${it.cantidad}</td>
        <td style="text-align:center">${it.unidad}</td>
        <td style="text-align:right">${it.precioUnitario > 0 ? it.precioUnitario.toLocaleString("es-AR", { style: "currency", currency: "ARS" }) : "—"}</td>
        <td style="text-align:right;font-weight:600">${it.precioUnitario > 0 ? sub : "—"}</td>
      </tr>`;
    }).join("");
    const total = items.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Materiales ${mes}</title>
    <style>
      @page { size: A4 portrait; margin: 18mm 20mm; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
      .header { display:flex; align-items:center; gap:12px; border-bottom:2px solid #1e1147; padding-bottom:10px; margin-bottom:12px; }
      .org { font-size:14px; font-weight:800; color:#1e1147; }
      h2 { font-size:13px; color:#1e1147; margin:0 0 12px; }
      table { width:100%; border-collapse:collapse; }
      th { background:#1e1147; color:#fff; padding:6px 10px; text-align:left; font-size:10px; }
      td { border-bottom:1px solid #eee; padding:6px 10px; font-size:10px; }
      .total { font-weight:800; font-size:12px; text-align:right; margin-top:10px; color:#1e1147; }
    </style></head><body>
    <div class="header">${logo}<div class="org">${profile?.nombre ?? ""}</div></div>
    <h2>📦 Materiales necesarios · ${mes} · ${roomName}</h2>
    <table>
      <thead><tr><th>Material</th><th>Cant.</th><th>Unidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total estimado: ${total.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const total = items.reduce((s, it) => s + it.cantidad * it.precioUnitario, 0);

  if (!loaded) return <p className="text-center text-sm text-gray-400 py-10">Cargando...</p>;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {bloques.some(b => b.materiales?.trim()) && (
          <Button size="sm" variant="outline" onClick={importFromBloques}>
            <Plus className="w-3.5 h-3.5 mr-1" />Importar desde bloques
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={addRow}>
          <Plus className="w-3.5 h-3.5 mr-1" />Agregar ítem
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando..." : "Guardar"}
        </Button>
        {items.length > 0 && (
          <Button size="sm" variant="outline" onClick={handlePrint} className="ml-auto">
            <Printer className="w-3.5 h-3.5 mr-1" />Imprimir / PDF
          </Button>
        )}
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Sin materiales cargados.</p>
          <p className="text-xs text-gray-300 mt-1">Importá desde los bloques o agregá ítems manualmente.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_64px_80px_100px_100px_32px] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
            {["Material","Cant.","Unidad","Precio unit.","Subtotal",""].map(h => (
              <div key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{h}</div>
            ))}
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((it, idx) => {
              const sub = it.cantidad * it.precioUnitario;
              return (
                <div key={idx} className="grid grid-cols-[1fr_64px_80px_100px_100px_32px] gap-2 px-4 py-2 items-center">
                  <input
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={it.nombre}
                    onChange={e => updateItem(idx, "nombre", e.target.value)}
                    placeholder="Nombre del material"
                  />
                  <input
                    type="number" min="0" step="0.5"
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-full text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={it.cantidad}
                    onChange={e => updateItem(idx, "cantidad", parseFloat(e.target.value) || 0)}
                  />
                  <input
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={it.unidad}
                    onChange={e => updateItem(idx, "unidad", e.target.value)}
                    placeholder="unid."
                  />
                  <input
                    type="number" min="0" step="0.01"
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-full text-right focus:outline-none focus:ring-1 focus:ring-violet-400"
                    value={it.precioUnitario || ""}
                    onChange={e => updateItem(idx, "precioUnitario", parseFloat(e.target.value) || 0)}
                    placeholder="$0"
                  />
                  <div className={`text-sm font-semibold text-right pr-1 ${sub > 0 ? "text-violet-700" : "text-gray-300"}`}>
                    {sub > 0 ? `$${sub.toLocaleString("es-AR")}` : "—"}
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-violet-50 border-t border-violet-100">
            <span className="text-sm font-bold text-violet-700">Total estimado del mes</span>
            <span className="text-lg font-bold text-violet-700">
              ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CronogramaSemanal ─────────────────────────────────────────────────────
const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"] as const;
const DIAS_LABEL: Record<string, string> = { lunes: "LUNES", martes: "MARTES", miercoles: "MIÉRCOLES", jueves: "JUEVES", viernes: "VIERNES" };

type CronoFila = {
  id?: number;
  horario: string;
  bloque: string;
  tipo: string;
  bloqueSource?: string; // which planificacion bloque to pull activities from
  lunes?: string;
  martes?: string;
  miercoles?: string;
  jueves?: string;
  viernes?: string;
  orden: number;
};

type Cronograma = {
  id: number;
  semanaInicio: string;
  coach?: string;
  filas: CronoFila[];
};

function getMondayOfWeek(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getSemanaLabel(semanaInicio: string) {
  const mon = new Date(semanaInicio + "T12:00:00");
  const fri = new Date(mon);
  fri.setDate(fri.getDate() + 4);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
  return `${fmt(mon)} al ${fmt(fri)}`;
}

function getNext8Weeks() {
  const weeks: string[] = [];
  const today = new Date();
  // start from 2 weeks back
  const start = new Date(today);
  start.setDate(start.getDate() - 14);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    weeks.push(getMondayOfWeek(d.toISOString().slice(0, 10)));
  }
  return [...new Set(weeks)].sort().reverse();
}

// Detect whether a fila is "pedagogico" or "ludico" based on its bloque name and horario
function detectTipoBloqueRow(fila: CronoFila): "pedagogico" | "ludico" | null {
  if (fila.tipo === "rutina" || fila.tipo === "salida" || fila.tipo === "patio") return null;
  const nombre = (fila.bloque ?? "").toLowerCase();
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nb = normalize(nombre);
  if (nb.includes("ludico") || nb.includes("lúdico") || nb.includes("juego")) return "ludico";
  if (nb.includes("pedagogic") || nb.includes("pedagog")) return "pedagogico";
  // fallback: morning = pedagogico, afternoon = ludico
  const h = parseInt((fila.horario ?? "00:00").split(":")[0]);
  if (!isNaN(h)) return h < 12 ? "pedagogico" : "ludico";
  return "pedagogico";
}

// Get activities from plan bloques matching a tipo (pedagogico/ludico)
function getActividadesPorTipo(bloques: Bloque[], tipo: "pedagogico" | "ludico" | null, overrideBloque?: string) {
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const all = bloques.map(b => ({
    bloque: b.nombre,
    items: (b.actividades ?? "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
  })).filter(b => b.items.length > 0);

  if (overrideBloque && overrideBloque !== "__all__") {
    return all.filter(b => b.bloque === overrideBloque);
  }
  if (!tipo) return all;

  const filtered = all.filter(b => {
    const nb = normalize(b.bloque);
    if (tipo === "ludico") return nb.includes("ludic") || nb.includes("lúdic") || nb.includes("jueg");
    if (tipo === "pedagogico") return nb.includes("pedagog");
    return false;
  });
  // if nothing matched, return all so the panel isn't empty
  return filtered.length > 0 ? filtered : all;
}

function CronogramaSemanal({ plan, roomName, profile }: {
  plan: Plan;
  roomName: string;
  profile?: { logoBase64?: string; nombre?: string; direccion?: string } | null;
}) {
  const [semana, setSemana] = useState<string>(getMondayOfWeek(new Date().toISOString().slice(0, 10)));
  const [crono, setCrono] = useState<Cronograma | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ idx: number; dia: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [adaptingItem, setAdaptingItem] = useState<string | null>(null); // item text being AI-adapted
  const { token } = useAuth();
  const weeks = getNext8Weeks();

  // All activities from planificacion bloques, grouped by bloque
  const actividadesPorBloque = plan.bloques.map(b => ({
    bloque: b.nombre,
    items: (b.actividades ?? "").split("\n").map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean),
  })).filter(b => b.items.length > 0);

  const todasActividades = actividadesPorBloque.flatMap(b => b.items);

  // Activities relevant to focused cell
  const actividadesFocused = focusedCell && crono
    ? getActividadesPorTipo(
        plan.bloques,
        detectTipoBloqueRow(crono.filas[focusedCell.idx]),
        crono.filas[focusedCell.idx]?.bloqueSource
      )
    : actividadesPorBloque;

  async function loadOrCreate() {
    setLoading(true);
    const r = await fetch(`${BASE}/cronogramas-semanales?centerId=${plan.centerId}&planificacionId=${plan.id}`);
    const list: Cronograma[] = await r.json();
    const existing = list.find(c => c.semanaInicio === semana);
    if (existing) {
      const r2 = await fetch(`${BASE}/cronogramas-semanales/${existing.id}`);
      setCrono(await r2.json());
    } else {
      const r2 = await fetch(`${BASE}/cronogramas-semanales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: plan.centerId,
          roomId: plan.roomId,
          planificacionId: plan.id,
          semanaInicio: semana,
        }),
      });
      setCrono(await r2.json());
    }
    setLoading(false);
  }

  useEffect(() => { loadOrCreate(); }, [semana, plan.id]);

  function updateFila(idx: number, dia: string, val: string) {
    if (!crono) return;
    setCrono(c => {
      if (!c) return c;
      const filas = c.filas.map((f, i) => i === idx ? { ...f, [dia]: val } : f);
      return { ...c, filas };
    });
  }

  async function insertActividad(texto: string) {
    if (!focusedCell || !crono) return;
    const { idx, dia } = focusedCell;
    const fila = crono.filas[idx];
    setAdaptingItem(texto);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${BASE}/ai/adaptar-cronograma`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          actividad: texto,
          bloque: fila.bloque,
          horario: fila.horario,
        }),
      });
      const data = r.ok ? await r.json() : null;
      const adapted = data?.adapted ?? texto;
      const current = (crono.filas[idx] as any)[dia] ?? "";
      updateFila(idx, dia, current ? `${current}\n${adapted}` : adapted);
    } catch {
      // fallback: insert raw
      const current = (crono.filas[idx] as any)[dia] ?? "";
      updateFila(idx, dia, current ? `${current}\n${texto}` : texto);
    } finally {
      setAdaptingItem(null);
    }
  }

  function autoDistribuir() {
    if (!crono || todasActividades.length === 0) return;
    setCrono(c => {
      if (!c) return c;
      // Track index per bloque type
      const counters: Record<string, number> = {};
      const filas = c.filas.map(f => {
        if (f.tipo !== "pedagogico") return f;
        const tipo = detectTipoBloqueRow(f);
        const actList = getActividadesPorTipo(plan.bloques, tipo, f.bloqueSource);
        const items = actList.flatMap(b => b.items);
        if (items.length === 0) return f;
        const key = tipo ?? "all";
        if (counters[key] === undefined) counters[key] = 0;
        const updated: any = { ...f };
        DIAS.forEach(dia => {
          updated[dia] = items[counters[key] % items.length];
          counters[key]++;
        });
        return updated;
      });
      return { ...c, filas };
    });
  }

  function updateHorario(idx: number, field: "horario" | "bloque" | "bloqueSource", val: string) {
    if (!crono) return;
    setCrono(c => {
      if (!c) return c;
      const filas = c.filas.map((f, i) => i === idx ? { ...f, [field]: val } : f);
      return { ...c, filas };
    });
  }

  function addFila() {
    if (!crono) return;
    setCrono(c => {
      if (!c) return c;
      return { ...c, filas: [...c.filas, { horario: "", bloque: "", tipo: "pedagogico", orden: c.filas.length }] };
    });
  }

  function removeFila(idx: number) {
    if (!crono) return;
    setCrono(c => {
      if (!c) return c;
      return { ...c, filas: c.filas.filter((_, i) => i !== idx) };
    });
  }

  async function save() {
    if (!crono) return;
    setSaving(true);
    await fetch(`${BASE}/cronogramas-semanales/${crono.id}/filas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crono.filas.map((f, i) => ({ ...f, orden: i }))),
    });
    setSaving(false);
  }

  function handlePrint() {
    if (!crono) return;
    const logo = profile?.logoBase64 ? `<img src="${profile.logoBase64}" style="height:44px;object-fit:contain;" />` : "";
    const semanaLabel = getSemanaLabel(crono.semanaInicio);
    const { liderPedagogica, facilitadoras } = plan;

    const rows = crono.filas.map(f => {
      const isRutina = f.tipo === "rutina" || f.tipo === "salida" || f.tipo === "patio";
      const cellStyle = isRutina
        ? `font-weight:bold;background:#f0f0f0;text-align:center;`
        : `vertical-align:top;`;
      const dias = DIAS.map(d => {
        const val = (f as any)[d] ?? "";
        return `<td style="border:1px solid #ccc;padding:5px 6px;font-size:9px;${cellStyle}">${val || (isRutina ? "" : "")}</td>`;
      }).join("");
      return `<tr>
        <td style="border:1px solid #ccc;padding:5px 6px;font-size:9px;font-weight:600;white-space:nowrap;">${f.horario}</td>
        <td style="border:1px solid #ccc;padding:5px 6px;font-size:9px;font-weight:${isRutina ? "700" : "600"};background:${isRutina ? "#f0f0f0" : "white"};">${f.bloque}</td>
        ${dias}
      </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Cronograma ${semanaLabel}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm 12mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; color: #111; }
      .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1e1147; padding-bottom:8px; margin-bottom:8px; }
      .meta { font-size:9px; line-height:1.8; }
      .meta strong { display:inline-block; min-width:120px; }
      .title { font-size:11px; font-weight:800; color:#1e1147; text-align:right; max-width:400px; }
      table { width:100%; border-collapse:collapse; margin-top:6px; }
      th { background:#1e1147; color:#fff; padding:5px 6px; font-size:9px; border:1px solid #1e1147; }
      td { font-size:9px; }
    </style></head><body>
    <div class="top">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logo}
        <div class="meta">
          <div><strong>Coach:</strong></div>
          <div><strong>Líder Pedagógica:</strong> ${liderPedagogica ?? ""}</div>
          <div><strong>Facilitadora:</strong> ${facilitadoras ?? ""}</div>
          <div><strong>Mes:</strong> ${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][parseInt(plan.mes.split("-")[1])-1]}</div>
          <div><strong>Semana:</strong> ${semanaLabel}</div>
        </div>
      </div>
      <div class="title">CRONOGRAMA CORRESPONDIENTE A LAS SEMANAS DEL ${semanaLabel.toUpperCase()}<br/><small style="font-size:9px;font-weight:400;color:#666;">${roomName}</small></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:7%">HORARIO</th>
        <th style="width:12%">BLOQUE</th>
        <th>LUNES</th><th>MARTES</th><th>MIÉRCOLES</th><th>JUEVES</th><th>VIERNES</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  if (loading) return <p className="text-center py-12 text-sm text-gray-400">Cargando cronograma...</p>;

  return (
    <div className="space-y-4">
      {/* Week selector + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <select
            value={semana}
            onChange={e => setSemana(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold"
          >
            {weeks.map(w => (
              <option key={w} value={w}>Semana del {getSemanaLabel(w)}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          {todasActividades.length > 0 && (
            <Button size="sm" variant="outline" onClick={autoDistribuir} title="Repartir automáticamente las actividades de la planificación">
              <Sparkles className="w-3.5 h-3.5 mr-1" />Auto-distribuir
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={addFila}>
            <Plus className="w-3.5 h-3.5 mr-1" />Agregar fila
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando..." : "Guardar"}
          </Button>
          {crono && (
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-1" />PDF
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Main grid */}
        <div className="flex-1 min-w-0">
          {crono && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-[#1e1147] text-white">
                      <th className="px-3 py-2 text-left font-semibold border-r border-white/10 w-16">Horario</th>
                      <th className="px-3 py-2 text-left font-semibold border-r border-white/10 w-28">Bloque</th>
                      {DIAS.map(d => (
                        <th key={d} className="px-2 py-2 text-center font-semibold border-r border-white/10 text-[10px]">{DIAS_LABEL[d]}</th>
                      ))}
                      <th className="w-7"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {crono.filas.map((fila, idx) => {
                      const isRutina = fila.tipo === "rutina" || fila.tipo === "salida" || fila.tipo === "patio";
                      return (
                        <tr key={idx} className={isRutina ? "bg-gray-50" : "bg-white hover:bg-violet-50/20"}>
                          <td className="px-2 py-1 border-r border-gray-100">
                            <input
                              value={fila.horario}
                              onChange={e => updateHorario(idx, "horario", e.target.value)}
                              className="w-full text-xs font-mono bg-transparent focus:outline-none focus:ring-1 focus:ring-violet-300 rounded px-1"
                            />
                          </td>
                          <td className="px-2 py-1 border-r border-gray-100">
                            <input
                              value={fila.bloque}
                              onChange={e => updateHorario(idx, "bloque", e.target.value)}
                              className={`w-full text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-violet-300 rounded px-1 ${isRutina ? "font-bold text-gray-700" : "font-semibold text-[#1e1147]"}`}
                            />
                            {!isRutina && actividadesPorBloque.length > 1 && (
                              <select
                                value={fila.bloqueSource ?? "__auto__"}
                                onChange={e => updateHorario(idx, "bloqueSource", e.target.value === "__auto__" ? "" : e.target.value)}
                                className="mt-0.5 w-full text-[9px] bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-gray-500"
                                title="Fuente de actividades para esta fila"
                              >
                                <option value="__auto__">auto ({detectTipoBloqueRow(fila) ?? "—"})</option>
                                <option value="__all__">Todos los bloques</option>
                                {actividadesPorBloque.map(b => (
                                  <option key={b.bloque} value={b.bloque}>{b.bloque}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          {DIAS.map(d => (
                            <td key={d} className={`px-1 py-1 border-r border-gray-100 ${focusedCell?.idx === idx && focusedCell?.dia === d ? "bg-violet-50" : ""}`}>
                              <textarea
                                value={(fila as any)[d] ?? ""}
                                onChange={e => updateFila(idx, d, e.target.value)}
                                onFocus={() => !isRutina && setFocusedCell({ idx, dia: d })}
                                rows={2}
                                className={`w-full text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-violet-300 rounded px-1 resize-none ${isRutina ? "font-bold text-center text-gray-600" : "text-gray-700"}`}
                              />
                            </td>
                          ))}
                          <td className="px-1 py-1 text-center">
                            <button onClick={() => removeFila(idx)} className="text-gray-200 hover:text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            Filas en gris: rutinas fijas. Hacé click en una celda pedagógica/lúdica y luego tocá una actividad del panel para insertarla. El panel filtra automáticamente por tipo de bloque. Podés cambiar la fuente de actividades con el selector debajo del nombre del bloque.
          </p>
        </div>

        {/* Activities panel */}
        {actividadesPorBloque.length > 0 && (
          <div className="w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden sticky top-4">
              <button
                onClick={() => setPanelOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 border-b border-violet-100"
              >
                <span className="text-xs font-bold text-violet-700">📋 Actividades</span>
                {panelOpen ? <ChevronUp className="w-3.5 h-3.5 text-violet-400" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-400" />}
              </button>
              {panelOpen && (
                <div className="p-3 max-h-[500px] overflow-y-auto space-y-3">
                  {focusedCell && crono ? (
                    <div>
                      <p className="text-[10px] text-violet-500 font-semibold">
                        Insertando en: {DIAS_LABEL[focusedCell.dia]} · {crono.filas[focusedCell.idx]?.bloque}
                      </p>
                      {(() => {
                        const tipo = detectTipoBloqueRow(crono.filas[focusedCell.idx]);
                        return tipo ? (
                          <p className="text-[9px] text-violet-300 mt-0.5">
                            Mostrando actividades: <strong>{tipo === "pedagogico" ? "Pedagógico" : "Lúdico"}</strong>
                          </p>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400">Hacé click en una celda del cronograma y luego en una actividad para insertarla.</p>
                  )}
                  {actividadesFocused.map(({ bloque, items }) => (
                    <div key={bloque}>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1">{bloque}</p>
                      <div className="space-y-1">
                        {items.map((item, i) => {
                          const isAdapting = adaptingItem === item;
                          return (
                            <button
                              key={i}
                              onClick={() => insertActividad(item)}
                              disabled={!focusedCell || !!adaptingItem}
                              className="w-full text-left text-[11px] text-gray-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-lg transition-colors leading-tight flex items-center gap-1.5"
                            >
                              {isAdapting ? (
                                <>
                                  <span className="inline-block w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                  <span className="text-violet-500">Adaptando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-2.5 h-2.5 text-violet-300 shrink-0" />
                                  {item}
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
  const { centerId, token } = useAuth();
  // Si la planificación está vacía (sin bloques ni líder), arrancá directo en Editar
  const isEmpty = !plan.bloques?.length && !plan.liderPedagogica;
  const [view, setView] = useState<"table" | "edit" | "materiales" | "cronograma">(isEmpty ? "edit" : "table");
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
          <button onClick={() => setView("materiales")} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1 ${view === "materiales" ? "bg-white shadow-sm text-violet-700" : "text-gray-500"}`}>
            <ShoppingCart className="w-3.5 h-3.5" />Materiales
          </button>
          <button onClick={() => setView("cronograma")} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-1 ${view === "cronograma" ? "bg-white shadow-sm text-violet-700" : "text-gray-500"}`}>
            <CalendarDays className="w-3.5 h-3.5" />Cronograma
          </button>
        </div>
        <span className="text-sm font-semibold text-gray-700 ml-1">{mesLabel(current.mes)} {current.mes.split("-")[0]} · {roomName}</span>
      </div>

      {view === "table" && (
        <PlanView plan={current} roomName={roomName} onEdit={() => setView("edit")} profile={profileQ.data} />
      )}

      {view === "cronograma" && (
        <CronogramaSemanal
          plan={current}
          roomName={roomName}
          profile={profileQ.data}
        />
      )}

      {view === "materiales" && (
        <MaterialesCosto
          planId={plan.id}
          bloques={current.bloques}
          mesLabel={`${mesLabel(current.mes)} ${current.mes.split("-")[0]}`}
          roomName={roomName}
          profile={profileQ.data}
        />
      )}

      {view === "edit" && (
        <div className="space-y-5">
          {/* Instrucción general */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex gap-3 items-start">
            <span className="text-violet-400 text-lg shrink-0">📋</span>
            <div>
              <p className="text-xs font-bold text-violet-700 mb-0.5">¿Cómo completar la planificación?</p>
              <p className="text-xs text-violet-600 leading-relaxed">
                Primero completá el <strong>encabezado</strong> con los datos generales del mes y guardalo.
                Después agregá los <strong>bloques</strong> — cada bloque es una actividad o momento del día.
                Por cada bloque cargá las actividades, materiales, y cómo se desarrolla cada momento.
              </p>
            </div>
          </div>

          {/* Header fields */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <p className="text-sm font-bold text-gray-700">Datos generales del mes</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Mes</label>
                <Input type="month" value={header.mes} onChange={(e) => setHeader(h => ({ ...h, mes: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sala / Aldea</label>
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
              <Input value={header.liderPedagogica} onChange={(e) => setHeader(h => ({ ...h, liderPedagogica: e.target.value }))} placeholder="Nombre completo de la líder pedagógica" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Facilitadoras</label>
              <Input value={header.facilitadoras} onChange={(e) => setHeader(h => ({ ...h, facilitadoras: e.target.value }))} placeholder="Ej: Melina Gallo - Candelaria Salto" className="text-sm" />
              <p className="text-[10px] text-gray-400 mt-1">Separalas con guión si son varias</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Observaciones generales</label>
              <TA value={header.observaciones} onChange={(v) => setHeader(h => ({ ...h, observaciones: v }))} placeholder="Contexto general del mes, ejes temáticos, situación del grupo..." rows={2} />
              <p className="text-[10px] text-gray-400 mt-1">Describí brevemente el enfoque o contexto del mes</p>
            </div>
            <Button size="sm" onClick={saveHeader}><Save className="w-3.5 h-3.5 mr-1" />Guardar encabezado</Button>
          </div>

          {/* Bloques */}
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border-2 border-violet-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Bloques de la planificación</p>
                    <p className="text-xs text-gray-400">{current.bloques.length === 0 ? "Todavía no hay bloques — agregá el primero" : `${current.bloques.length} bloque${current.bloques.length !== 1 ? "s" : ""} cargado${current.bloques.length !== 1 ? "s" : ""}`}</p>
                  </div>
                </div>
                {!addingBloque && (
                  <button onClick={() => setAddingBloque(true)} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Agregar bloque
                  </button>
                )}
              </div>
              {current.bloques.length === 0 && !addingBloque && (
                <div className="mt-3 border-2 border-dashed border-violet-200 rounded-xl p-6 text-center">
                  <p className="text-sm text-violet-400 font-semibold mb-1">¡Empezá a armar la planificación!</p>
                  <p className="text-xs text-gray-400">Cada bloque es un momento o actividad del día: Juego, Merienda, Bloque pedagógico, etc.</p>
                  <button onClick={() => setAddingBloque(true)} className="mt-3 inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />Agregar primer bloque
                  </button>
                </div>
              )}
            </div>

            {addingBloque && (
              <BloqueForm token={token} planId={plan.id} onSaved={refreshPlan} onCancel={() => setAddingBloque(false)} />
            )}

            {current.bloques.map((b) => (
              <div key={b.id}>
                {editingBloqueId === b.id ? (
                  <BloqueForm
                    token={token}
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
          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-800">¿Para qué mes y sala es esta planificación?</p>
              <p className="text-xs text-gray-400 mt-0.5">Después vas a poder completar todos los detalles y los bloques de actividades.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Mes</label>
                <Input type="month" value={newForm.mes} onChange={(e) => setNewForm(f => ({ ...f, mes: e.target.value }))} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Sala / Aldea</label>
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
                <Plus className="w-3.5 h-3.5 mr-1" />{createMut.isPending ? "Creando..." : "Crear y empezar a completar"}
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
