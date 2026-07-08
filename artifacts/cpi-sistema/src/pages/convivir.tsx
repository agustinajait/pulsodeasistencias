import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Camera, ChevronLeft, ChevronRight, Package, ZoomIn, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Entrega = {
  id: number;
  centerId: number;
  fecha: string;
  proveedor: string;
  items?: string;
  comprobanteBase64?: string;
  observaciones?: string;
  createdAt: string;
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function currentMonth() { return new Date().toISOString().slice(0, 7); }

async function fetchEntregas(centerId: number | null, month: string): Promise<Entrega[]> {
  if (!centerId) return [];
  const r = await fetch(`${BASE}/convivir/entregas?centerId=${centerId}&month=${month}`);
  return r.ok ? r.json() : [];
}

function fileToBase64Compressed(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1400;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// ── EntregaModal ───────────────────────────────────────────────────────────
function EntregaModal({ centerId, initial, onClose, onSaved }: {
  centerId: number;
  initial?: Entrega;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fecha, setFecha] = useState(initial?.fecha ?? new Date().toISOString().slice(0, 10));
  const [proveedor, setProveedor] = useState(initial?.proveedor ?? "Ministerio");
  const [items, setItems] = useState(initial?.items ?? "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [comprobante, setComprobante] = useState<string | undefined>(initial?.comprobanteBase64);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64Compressed(file);
    setComprobante(b64);
  }

  async function handleSave() {
    setSaving(true);
    const body = { centerId, fecha, proveedor, items: items || null, comprobanteBase64: comprobante ?? null, observaciones: observaciones || null };
    if (initial) {
      await fetch(`${BASE}/convivir/entregas/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`${BASE}/convivir/entregas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Convivir</p>
            <p className="font-bold text-gray-900">{initial ? "Editar entrega" : "Nueva entrega"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Origen</label>
              <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Ministerio" className="text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alimentos recibidos</label>
            <textarea
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="Ej: 10kg arroz, 5kg lentejas, 20 latas de tomate..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Estado de los alimentos, faltantes, etc."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
          </div>

          {/* Comprobante */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Foto del comprobante</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            {comprobante ? (
              <div className="relative">
                <img src={comprobante} alt="comprobante" className="w-full rounded-xl object-cover max-h-48" />
                <button
                  onClick={() => setComprobante(undefined)}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs font-semibold">Sacar foto o elegir imagen</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !fecha || !proveedor}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-sm disabled:opacity-40 hover:bg-violet-700 transition-colors"
          >
            {saving ? "Guardando..." : initial ? "Guardar cambios" : "Registrar entrega"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LightboxModal ──────────────────────────────────────────────────────────
function LightboxModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex justify-end px-4 pt-12 pb-3 shrink-0">
        <button onClick={onClose} className="text-white/60 hover:text-white p-2"><X className="w-6 h-6" /></button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <img src={src} alt="comprobante" className="max-w-full max-h-full object-contain rounded-xl" />
      </div>
    </div>
  );
}

// ── EntregaCard ────────────────────────────────────────────────────────────
function EntregaCard({ entrega, onDelete, onEdit }: { entrega: Entrega; onDelete: () => void; onEdit: () => void }) {
  const [lightbox, setLightbox] = useState(false);
  const fechaFmt = new Date(entrega.fecha + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* comprobante foto */}
        {entrega.comprobanteBase64 && (
          <div className="relative cursor-pointer" onClick={() => setLightbox(true)}>
            <img src={entrega.comprobanteBase64} alt="comprobante" className="w-full object-cover h-40" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}

        <div className="px-4 py-3 space-y-2">
          {/* header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900 text-sm capitalize">{fechaFmt}</p>
              <p className="text-xs text-violet-600 font-semibold">{entrega.proveedor}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={onEdit} className="text-gray-300 hover:text-violet-500 p-1.5 rounded-lg hover:bg-gray-50">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* items */}
          {entrega.items && (
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Alimentos</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{entrega.items}</p>
            </div>
          )}

          {/* observaciones */}
          {entrega.observaciones && (
            <p className="text-xs text-gray-500 italic">{entrega.observaciones}</p>
          )}

          {/* sin foto badge */}
          {!entrega.comprobanteBase64 && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-lg w-fit">
              <Camera className="w-3 h-3" /> Sin comprobante
            </div>
          )}
        </div>
      </div>

      {lightbox && entrega.comprobanteBase64 && (
        <LightboxModal src={entrega.comprobanteBase64} onClose={() => setLightbox(false)} />
      )}
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Convivir() {
  const { centerId, role } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Entrega | undefined>();

  const effectiveCenterId = role === "superadmin" ? null : centerId;
  const [y, m] = month.split("-").map(Number);

  const entregasQ = useQuery({
    queryKey: ["convivir-entregas", effectiveCenterId, month],
    queryFn: () => fetchEntregas(effectiveCenterId, month),
  });

  const entregas = entregasQ.data ?? [];

  function refresh() { qc.invalidateQueries({ queryKey: ["convivir-entregas", effectiveCenterId, month] }); }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta entrega?")) return;
    await fetch(`${BASE}/convivir/entregas/${id}`, { method: "DELETE" });
    refresh();
  }

  function prevMonth() { const d = new Date(y, m - 2, 1); setMonth(d.toISOString().slice(0, 7)); }
  function nextMonth() { const d = new Date(y, m, 1); setMonth(d.toISOString().slice(0, 7)); }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Gestión</div>
        <h1 className="text-2xl font-bold mt-1">Convivir</h1>
        <p className="text-white/50 text-xs mt-1">Recibos y registro de alimentos</p>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-bold text-gray-900">{MESES[m - 1]} {y}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{entregas.length}</p>
            <p className="text-xs text-gray-400 font-semibold">entrega{entregas.length !== 1 ? "s" : ""} registrada{entregas.length !== 1 ? "s" : ""} en {MESES[m - 1]}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm font-bold text-gray-700">{entregas.filter(e => e.comprobanteBase64).length}</p>
            <p className="text-[10px] text-gray-400">con comprobante</p>
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Registrar entrega de alimentos
        </button>

        {/* List */}
        {entregasQ.isLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : entregas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Sin entregas en {MESES[m - 1]}</p>
            <p className="text-xs mt-1">Registrá la primera entrega del ministerio</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entregas.map((e) => (
              <EntregaCard
                key={e.id}
                entrega={e}
                onDelete={() => handleDelete(e.id)}
                onEdit={() => { setEditing(e); setShowModal(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && effectiveCenterId != null && (
        <EntregaModal
          centerId={effectiveCenterId}
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
