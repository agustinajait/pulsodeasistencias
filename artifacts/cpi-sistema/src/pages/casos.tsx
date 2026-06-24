import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen, Plus, Search, ChevronRight, X, CheckCircle2,
  AlertTriangle, Clock, ChevronDown, ChevronUp, Trash2, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type Novedad = {
  id: number;
  caseId: number;
  fecha: string;
  descripcion: string;
  acuerdos?: string;
  organismo?: string;
  registradoPor?: string;
};

type Case = {
  id: number;
  childId: number;
  centerId: number;
  ivsBase?: number;
  ivsPotencial?: number;
  referenteNombre?: string;
  referenteVinculo?: string;
  referenteTelefono?: string;
  situacionResumen?: string;
  tiposProblematica: string[];
  organismos?: string;
  tieneCud: boolean;
  cudPendiente: boolean;
  acompaniamientoPrevio: boolean;
  estado: "ABIERTO" | "EN_PROCESO" | "CERRADO";
  createdAt: string;
  updatedAt: string;
  novedades: Novedad[];
  // joined
  childName?: string;
};

type Child = { id: number; nombre: string; apellido: string; centerId: number };

// ── Constants ──────────────────────────────────────────────────────────────
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

const TIPOS_KEYS = Object.keys(TIPOS_LABEL);

const ESTADO_COLORS: Record<string, string> = {
  ABIERTO: "bg-amber-100 text-amber-700",
  EN_PROCESO: "bg-blue-100 text-blue-700",
  CERRADO: "bg-gray-100 text-gray-500",
};

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchCases(centerId?: number | null): Promise<Case[]> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/cases${qs}`);
  if (!r.ok) return [];
  return r.json();
}

async function fetchChildren(centerId?: number | null): Promise<Child[]> {
  const qs = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/children${qs}`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.children ?? j ?? [];
}

// ── Small helpers ──────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Badge({ estado }: { estado: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ESTADO_COLORS[estado] ?? "bg-gray-100 text-gray-500"}`}>
      {estado === "EN_PROCESO" ? "En proceso" : estado === "ABIERTO" ? "Abierto" : "Cerrado"}
    </span>
  );
}

// ── Case form (new + edit) ─────────────────────────────────────────────────
type CaseFormData = {
  childId: string;
  ivsBase: string;
  ivsPotencial: string;
  referenteNombre: string;
  referenteVinculo: string;
  referenteTelefono: string;
  situacionResumen: string;
  tiposProblematica: string[];
  organismos: string;
  tieneCud: boolean;
  cudPendiente: boolean;
  acompaniamientoPrevio: boolean;
  estado: string;
};

function emptyForm(): CaseFormData {
  return {
    childId: "",
    ivsBase: "",
    ivsPotencial: "",
    referenteNombre: "",
    referenteVinculo: "",
    referenteTelefono: "",
    situacionResumen: "",
    tiposProblematica: [],
    organismos: "",
    tieneCud: false,
    cudPendiente: false,
    acompaniamientoPrevio: false,
    estado: "ABIERTO",
  };
}

function caseToForm(c: Case): CaseFormData {
  return {
    childId: String(c.childId),
    ivsBase: c.ivsBase != null ? String(c.ivsBase) : "",
    ivsPotencial: c.ivsPotencial != null ? String(c.ivsPotencial) : "",
    referenteNombre: c.referenteNombre ?? "",
    referenteVinculo: c.referenteVinculo ?? "",
    referenteTelefono: c.referenteTelefono ?? "",
    situacionResumen: c.situacionResumen ?? "",
    tiposProblematica: c.tiposProblematica ?? [],
    organismos: c.organismos ?? "",
    tieneCud: c.tieneCud,
    cudPendiente: c.cudPendiente,
    acompaniamientoPrevio: c.acompaniamientoPrevio,
    estado: c.estado,
  };
}

// ── CaseDetail panel ───────────────────────────────────────────────────────
function CaseDetail({
  caso,
  children,
  centerId,
  onClose,
  onUpdated,
}: {
  caso: Case;
  children: Child[];
  centerId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CaseFormData>(() => caseToForm(caso));
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [nov, setNov] = useState({ fecha: "", descripcion: "", acuerdos: "", organismo: "", registradoPor: "" });

  const updateMut = useMutation({
    mutationFn: async (data: CaseFormData) => {
      const r = await fetch(`${BASE}/cases/${caso.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ivsBase: data.ivsBase ? Number(data.ivsBase) : null,
          ivsPotencial: data.ivsPotencial ? Number(data.ivsPotencial) : null,
          referenteNombre: data.referenteNombre || null,
          referenteVinculo: data.referenteVinculo || null,
          referenteTelefono: data.referenteTelefono || null,
          situacionResumen: data.situacionResumen || null,
          tiposProblematica: data.tiposProblematica,
          organismos: data.organismos || null,
          tieneCud: data.tieneCud,
          cudPendiente: data.cudPendiente,
          acompaniamientoPrevio: data.acompaniamientoPrevio,
          estado: data.estado,
        }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cases"] }); onUpdated(); setEditing(false); },
  });

  const addNovMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/cases/${caso.id}/novedades`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nov }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cases"] }); onUpdated(); setNovedadOpen(false); setNov({ fecha: "", descripcion: "", acuerdos: "", organismo: "", registradoPor: "" }); },
  });

  const delNovMut = useMutation({
    mutationFn: async (novedadId: number) => {
      await fetch(`${BASE}/cases/${caso.id}/novedades/${novedadId}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cases"] }); onUpdated(); },
  });

  const childName = children.find((c) => c.id === caso.childId);
  const displayName = childName ? `${childName.apellido}, ${childName.nombre}` : `Niño #${caso.childId}`;

  function toggleTipo(t: string) {
    setForm((f) => ({
      ...f,
      tiposProblematica: f.tiposProblematica.includes(t)
        ? f.tiposProblematica.filter((x) => x !== t)
        : [...f.tiposProblematica, t],
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* panel */}
      <div className="w-full max-w-lg bg-white flex flex-col overflow-hidden shadow-2xl">
        {/* header */}
        <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Caso #{caso.id}</div>
              <h2 className="text-xl font-bold mt-0.5">{displayName}</h2>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge estado={caso.estado} />
            <span className="text-white/40 text-xs">Abierto {fmtDate(caso.createdAt)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* edit / view toggle */}
          <div className="flex border-b border-gray-100 px-5 py-3 gap-3 shrink-0">
            <button
              onClick={() => { setEditing(false); setForm(caseToForm(caso)); }}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${!editing ? "border-violet-600 text-violet-700" : "border-transparent text-gray-400"}`}
            >
              Ficha
            </button>
            <button
              onClick={() => setEditing(true)}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${editing ? "border-violet-600 text-violet-700" : "border-transparent text-gray-400"}`}
            >
              Editar
            </button>
          </div>

          {!editing ? (
            <div className="px-5 py-4 space-y-5">
              {/* resumen */}
              {caso.situacionResumen && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Situación</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{caso.situacionResumen}</p>
                </div>
              )}

              {/* tipos */}
              {caso.tiposProblematica.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Problemáticas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {caso.tiposProblematica.map((t) => (
                      <span key={t} className="text-xs bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">
                        {TIPOS_LABEL[t] ?? t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* referente */}
              {caso.referenteNombre && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Referente familiar</p>
                  <p className="text-sm font-semibold text-gray-800">{caso.referenteNombre}</p>
                  {caso.referenteVinculo && <p className="text-xs text-gray-500">{caso.referenteVinculo}</p>}
                  {caso.referenteTelefono && <p className="text-xs text-gray-500">{caso.referenteTelefono}</p>}
                </div>
              )}

              {/* IVS */}
              {(caso.ivsBase != null || caso.ivsPotencial != null) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IVS Base</p>
                    <p className="text-2xl font-bold text-gray-800 mt-0.5">{caso.ivsBase ?? "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IVS Potencial</p>
                    <p className="text-2xl font-bold text-gray-800 mt-0.5">{caso.ivsPotencial ?? "—"}</p>
                  </div>
                </div>
              )}

              {/* flags */}
              <div className="flex flex-wrap gap-2">
                {caso.tieneCud && <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Tiene CUD</span>}
                {caso.cudPendiente && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">CUD pendiente</span>}
                {caso.acompaniamientoPrevio && <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full">Acompañamiento previo</span>}
              </div>

              {caso.organismos && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Organismos intervinientes</p>
                  <p className="text-sm text-gray-700">{caso.organismos}</p>
                </div>
              )}

              {/* novedades */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Novedades ({caso.novedades.length})</p>
                  <button
                    onClick={() => setNovedadOpen((v) => !v)}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar
                  </button>
                </div>

                {novedadOpen && (
                  <div className="bg-violet-50 rounded-xl p-4 mb-3 space-y-2">
                    <Input
                      type="date"
                      value={nov.fecha}
                      onChange={(e) => setNov((v) => ({ ...v, fecha: e.target.value }))}
                      className="text-sm"
                    />
                    <textarea
                      placeholder="Descripción de la novedad"
                      value={nov.descripcion}
                      onChange={(e) => setNov((v) => ({ ...v, descripcion: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm resize-none"
                      rows={3}
                    />
                    <Input
                      placeholder="Acuerdos (opcional)"
                      value={nov.acuerdos}
                      onChange={(e) => setNov((v) => ({ ...v, acuerdos: e.target.value }))}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Organismo (opcional)"
                      value={nov.organismo}
                      onChange={(e) => setNov((v) => ({ ...v, organismo: e.target.value }))}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Registrado por"
                      value={nov.registradoPor}
                      onChange={(e) => setNov((v) => ({ ...v, registradoPor: e.target.value }))}
                      className="text-sm"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => addNovMut.mutate()}
                        disabled={!nov.fecha || !nov.descripcion || addNovMut.isPending}
                      >
                        {addNovMut.isPending ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNovedadOpen(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {caso.novedades.length === 0 && !novedadOpen && (
                  <p className="text-sm text-gray-400 italic">Sin novedades registradas</p>
                )}

                <div className="space-y-2">
                  {caso.novedades.map((n) => (
                    <div key={n.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-gray-500">{fmtDate(n.fecha)}</span>
                          {n.registradoPor && <span className="text-xs text-gray-400 ml-2">· {n.registradoPor}</span>}
                        </div>
                        <button onClick={() => delNovMut.mutate(n.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{n.descripcion}</p>
                      {n.acuerdos && <p className="text-xs text-gray-500 mt-1 italic">Acuerdos: {n.acuerdos}</p>}
                      {n.organismo && <p className="text-xs text-teal-600 mt-0.5 font-medium">{n.organismo}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ABIERTO">Abierto</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="CERRADO">Cerrado</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Situación / resumen</label>
                <textarea
                  value={form.situacionResumen}
                  onChange={(e) => setForm((f) => ({ ...f, situacionResumen: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Problemáticas</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_KEYS.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTipo(t)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        form.tiposProblematica.includes(t)
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-500 border-gray-200 hover:border-violet-300"
                      }`}
                    >
                      {TIPOS_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IVS Base</label>
                  <Input type="number" value={form.ivsBase} onChange={(e) => setForm((f) => ({ ...f, ivsBase: e.target.value }))} className="mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IVS Potencial</label>
                  <Input type="number" value={form.ivsPotencial} onChange={(e) => setForm((f) => ({ ...f, ivsPotencial: e.target.value }))} className="mt-1 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referente (nombre)</label>
                <Input value={form.referenteNombre} onChange={(e) => setForm((f) => ({ ...f, referenteNombre: e.target.value }))} className="mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vínculo</label>
                  <Input value={form.referenteVinculo} onChange={(e) => setForm((f) => ({ ...f, referenteVinculo: e.target.value }))} className="mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</label>
                  <Input value={form.referenteTelefono} onChange={(e) => setForm((f) => ({ ...f, referenteTelefono: e.target.value }))} className="mt-1 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Organismos intervinientes</label>
                <Input value={form.organismos} onChange={(e) => setForm((f) => ({ ...f, organismos: e.target.value }))} className="mt-1 text-sm" />
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { key: "tieneCud", label: "Tiene CUD" },
                  { key: "cudPendiente", label: "CUD pendiente" },
                  { key: "acompaniamientoPrevio", label: "Acompañamiento previo" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form as any)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateMut.mutate(form)} disabled={updateMut.isPending} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {updateMut.isPending ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button variant="ghost" onClick={() => { setEditing(false); setForm(caseToForm(caso)); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── New case modal ─────────────────────────────────────────────────────────
function NewCaseModal({
  children,
  centerId,
  onClose,
  onCreated,
}: {
  children: Child[];
  centerId: number | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CaseFormData>(emptyForm);
  const [childSearch, setChildSearch] = useState("");

  const filtered = children.filter((c) => {
    const full = `${c.nombre} ${c.apellido}`.toLowerCase();
    return full.includes(childSearch.toLowerCase());
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId: Number(form.childId),
          centerId,
          ivsBase: form.ivsBase ? Number(form.ivsBase) : null,
          ivsPotencial: form.ivsPotencial ? Number(form.ivsPotencial) : null,
          referenteNombre: form.referenteNombre || null,
          referenteVinculo: form.referenteVinculo || null,
          referenteTelefono: form.referenteTelefono || null,
          situacionResumen: form.situacionResumen || null,
          tiposProblematica: form.tiposProblematica,
          organismos: form.organismos || null,
          tieneCud: form.tieneCud,
          cudPendiente: form.cudPendiente,
          acompaniamientoPrevio: form.acompaniamientoPrevio,
          estado: "ABIERTO",
        }),
      });
      return r.json();
    },
    onSuccess: () => { onCreated(); onClose(); },
  });

  function toggleTipo(t: string) {
    setForm((f) => ({
      ...f,
      tiposProblematica: f.tiposProblematica.includes(t)
        ? f.tiposProblematica.filter((x) => x !== t)
        : [...f.tiposProblematica, t],
    }));
  }

  const selectedChild = children.find((c) => String(c.id) === form.childId);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg">Nuevo caso</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* child picker */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Niño/a</label>
            {selectedChild ? (
              <div className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2.5">
                <span className="text-sm font-semibold text-violet-800">{selectedChild.apellido}, {selectedChild.nombre}</span>
                <button onClick={() => { setForm((f) => ({ ...f, childId: "" })); setChildSearch(""); }} className="text-violet-400 hover:text-violet-700"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div>
                <Input
                  placeholder="Buscar por nombre..."
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                  className="text-sm"
                />
                {childSearch && (
                  <div className="mt-1 border border-gray-100 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                    {filtered.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setForm((f) => ({ ...f, childId: String(c.id) })); setChildSearch(""); }}
                        className="w-full text-left px-3 py-2 hover:bg-violet-50 text-sm"
                      >
                        {c.apellido}, {c.nombre}
                      </button>
                    ))}
                    {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Situación / resumen</label>
            <textarea
              value={form.situacionResumen}
              onChange={(e) => setForm((f) => ({ ...f, situacionResumen: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Problemáticas</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_KEYS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTipo(t)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    form.tiposProblematica.includes(t)
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-violet-300"
                  }`}
                >
                  {TIPOS_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referente (nombre)</label>
            <Input value={form.referenteNombre} onChange={(e) => setForm((f) => ({ ...f, referenteNombre: e.target.value }))} className="mt-1 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vínculo</label>
              <Input value={form.referenteVinculo} onChange={(e) => setForm((f) => ({ ...f, referenteVinculo: e.target.value }))} className="mt-1 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</label>
              <Input value={form.referenteTelefono} onChange={(e) => setForm((f) => ({ ...f, referenteTelefono: e.target.value }))} className="mt-1 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.childId || createMut.isPending}
            >
              {createMut.isPending ? "Creando..." : "Crear caso"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Casos() {
  const { centerId } = useAuth();
  const qc = useQueryClient();
  const [location] = useLocation();

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<"" | "ABIERTO" | "EN_PROCESO" | "CERRADO">("");
  const [filterChildId, setFilterChildId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("childId");
    setFilterChildId(cid ? Number(cid) : null);
  }, [location]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const casesQ = useQuery({
    queryKey: ["cases", centerId],
    queryFn: () => fetchCases(centerId),
    refetchInterval: 60_000,
  });

  const childrenQ = useQuery({
    queryKey: ["children", centerId],
    queryFn: () => fetchChildren(centerId),
  });

  const allCases = casesQ.data ?? [];
  const allChildren = childrenQ.data ?? [];

  // join child name
  const casesWithName: Case[] = allCases.map((c) => {
    const child = allChildren.find((ch) => ch.id === c.childId);
    return {
      ...c,
      childName: child ? `${child.apellido}, ${child.nombre}` : undefined,
    };
  });

  const filterChild = filterChildId ? allChildren.find((c) => c.id === filterChildId) : null;

  const filtered = casesWithName.filter((c) => {
    const matchesSearch =
      !search ||
      (c.childName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.situacionResumen ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesEstado = !filterEstado || c.estado === filterEstado;
    const matchesChild = !filterChildId || c.childId === filterChildId;
    return matchesSearch && matchesEstado && matchesChild;
  });

  const abiertos = allCases.filter((c) => c.estado === "ABIERTO" || c.estado === "EN_PROCESO").length;

  function refreshSelected() {
    qc.invalidateQueries({ queryKey: ["cases", centerId] });
    if (selectedCase) {
      // refresh selected from updated list
      casesQ.refetch().then((r) => {
        const updated = (r.data ?? []).find((c) => c.id === selectedCase.id);
        if (updated) setSelectedCase(updated);
      });
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Equipo técnico</div>
        <div className="flex items-end justify-between mt-1">
          <h1 className="text-2xl font-bold">Casos</h1>
          <span className={`text-sm font-bold ${abiertos > 0 ? "text-amber-300" : "text-white/40"}`}>
            {abiertos} {abiertos === 1 ? "activo" : "activos"}
          </span>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* child filter banner */}
        {filterChild && (
          <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5">
            <div>
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block">Filtrado por niño/a</span>
              <span className="text-sm font-semibold text-violet-800">{filterChild.apellido}, {filterChild.nombre}</span>
            </div>
            <button
              onClick={() => { setFilterChildId(null); window.history.replaceState({}, "", "/casos"); }}
              className="text-violet-400 hover:text-violet-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por niño o situación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as any)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="ABIERTO">Abierto</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="CERRADO">Cerrado</option>
          </select>
          <Button onClick={() => setNewCaseOpen(true)} size="icon" className="shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* list */}
        {casesQ.isPending && (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando casos...</div>
        )}

        {!casesQ.isPending && filtered.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search || filterEstado ? "Sin resultados para ese filtro" : "Todavía no hay casos registrados"}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCase(c)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-violet-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge estado={c.estado} />
                    <span className="text-[10px] text-gray-400">#{c.id} · {fmtDate(c.createdAt)}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {c.childName ?? `Niño #${c.childId}`}
                  </p>
                  {c.situacionResumen && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.situacionResumen}</p>
                  )}
                  {c.tiposProblematica.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.tiposProblematica.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] bg-violet-100 text-violet-600 font-semibold px-1.5 py-0.5 rounded-full">
                          {TIPOS_LABEL[t] ?? t}
                        </span>
                      ))}
                      {c.tiposProblematica.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{c.tiposProblematica.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                  {c.novedades.length > 0 && (
                    <span className="text-[10px] text-gray-400">{c.novedades.length} nov.</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* detail panel */}
      {selectedCase && (
        <CaseDetail
          caso={selectedCase}
          children={allChildren}
          centerId={centerId}
          onClose={() => setSelectedCase(null)}
          onUpdated={refreshSelected}
        />
      )}

      {/* new case modal */}
      {newCaseOpen && (
        <NewCaseModal
          children={allChildren}
          centerId={centerId}
          onClose={() => setNewCaseOpen(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["cases", centerId] }); }}
        />
      )}
    </div>
  );
}
