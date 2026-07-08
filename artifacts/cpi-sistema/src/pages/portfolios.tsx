import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, X, Trash2, ChevronLeft, Search, BookImage, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Child = {
  id: number;
  nombre: string;
  apellido: string;
  roomId: number;
  activo: boolean;
};

type Photo = {
  id: number;
  childId: number;
  fecha: string;
  titulo?: string;
  photoBase64: string;
  createdAt: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────
async function fetchChildren(centerId: number | null): Promise<Child[]> {
  const params = centerId ? `?centerId=${centerId}` : "";
  const r = await fetch(`${BASE}/children${params}`);
  return r.ok ? r.json() : [];
}

async function fetchPhotos(childId: number): Promise<Photo[]> {
  const r = await fetch(`${BASE}/portfolios?childId=${childId}`);
  return r.ok ? r.json() : [];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── PhotoGrid ──────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onDelete, onView }: {
  photos: Photo[];
  onDelete: (id: number) => void;
  onView: (photo: Photo) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <BookImage className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Sin fotos aún</p>
        <p className="text-xs mt-1">Subí la primera foto del portfolio</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {photos.map((p) => (
        <div key={p.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
          <img
            src={p.photoBase64}
            alt={p.titulo ?? "Portfolio"}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => onView(p)}
          />
          {/* overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
              className="self-end bg-black/50 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {p.titulo && (
              <p className="text-white text-[10px] font-semibold truncate bg-black/40 px-2 py-1 rounded-lg">{p.titulo}</p>
            )}
          </div>
          {/* fecha badge */}
          <div className="absolute top-1.5 left-1.5 bg-black/40 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
            {new Date(p.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── LightboxModal ──────────────────────────────────────────────────────────
function LightboxModal({ photo, onClose, onDelete }: { photo: Photo; onClose: () => void; onDelete: (id: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 pt-12 pb-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div>
          {photo.titulo && <p className="text-white font-semibold text-sm">{photo.titulo}</p>}
          <p className="text-white/50 text-xs">
            {new Date(photo.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            className="text-white/50 hover:text-red-400 p-2"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="text-white/50 hover:text-white p-2">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.photoBase64}
          alt={photo.titulo ?? "Portfolio"}
          className="max-w-full max-h-full object-contain rounded-xl"
        />
      </div>
    </div>
  );
}

// ── UploadModal ────────────────────────────────────────────────────────────
function UploadModal({ child, centerId, onClose, onUploaded }: {
  child: Child;
  centerId: number;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress: draw on canvas at max 1200px
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", 0.82);
      setPreview(b64);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    await fetch(`${BASE}/portfolios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: child.id, fecha, titulo: titulo || null, photoBase64: preview }),
    });
    setSaving(false);
    onUploaded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-t-2xl lg:rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Portfolio</p>
            <p className="font-bold text-gray-900">{child.apellido}, {child.nombre}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* photo picker */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

          {preview ? (
            <div className="relative">
              <img src={preview} alt="preview" className="w-full rounded-xl object-cover max-h-64" />
              <button
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400 hover:border-violet-300 hover:text-violet-500 transition-colors"
            >
              <Camera className="w-8 h-8" />
              <span className="text-sm font-semibold">Sacar foto o elegir imagen</span>
            </button>
          )}

          <Input
            placeholder="Descripción (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 shrink-0">Fecha</label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="text-sm flex-1"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={!preview || saving}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-violet-700 transition-colors"
          >
            {saving ? "Guardando..." : "Guardar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ChildPortfolio ─────────────────────────────────────────────────────────
function ChildPortfolio({ child, centerId, onBack }: { child: Child; centerId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const photosQ = useQuery({
    queryKey: ["portfolio", child.id],
    queryFn: () => fetchPhotos(child.id),
  });

  async function handleDelete(id: number) {
    await fetch(`${BASE}/portfolios/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["portfolio", child.id] });
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7">
        <button onClick={onBack} className="flex items-center gap-1 text-white/60 hover:text-white text-sm mb-3 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Portfolio</div>
        <h1 className="text-2xl font-bold mt-1">{child.apellido}, {child.nombre}</h1>
        <p className="text-white/50 text-xs mt-0.5">{(photosQ.data ?? []).length} foto{(photosQ.data ?? []).length !== 1 ? "s" : ""}</p>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => setUploading(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Camera className="w-4 h-4" />
          Agregar foto
        </button>

        {photosQ.isLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : (
          <PhotoGrid
            photos={photosQ.data ?? []}
            onDelete={handleDelete}
            onView={setLightbox}
          />
        )}
      </div>

      {uploading && (
        <UploadModal
          child={child}
          centerId={centerId}
          onClose={() => setUploading(false)}
          onUploaded={() => qc.invalidateQueries({ queryKey: ["portfolio", child.id] })}
        />
      )}

      {lightbox && (
        <LightboxModal
          photo={lightbox}
          onClose={() => setLightbox(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Portfolios() {
  const { centerId, role } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Child | null>(null);

  const effectiveCenterId = role === "superadmin" ? null : centerId;

  const childrenQ = useQuery({
    queryKey: ["children-portfolio", effectiveCenterId],
    queryFn: () => fetchChildren(effectiveCenterId),
  });

  const children = (childrenQ.data ?? [])
    .filter((c) => c.activo)
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.apellido.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.apellido.localeCompare(b.apellido));

  if (selected) {
    return (
      <ChildPortfolio
        child={selected}
        centerId={effectiveCenterId ?? 0}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Gestión</div>
        <h1 className="text-2xl font-bold mt-1">Portfolios</h1>
        <p className="text-white/50 text-xs mt-1">Fotos y registro del recorrido de cada niño</p>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-3">
        {/* search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar niño..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* list */}
        {childrenQ.isLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : children.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? "No se encontraron niños" : "Sin niños activos"}
          </div>
        ) : (
          <div className="space-y-1.5">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all text-left group"
              >
                {/* avatar */}
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-violet-600">
                    {c.apellido.charAt(0)}{c.nombre.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{c.apellido}, {c.nombre}</p>
                </div>
                <BookImage className="w-4 h-4 text-gray-300 group-hover:text-violet-400 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
