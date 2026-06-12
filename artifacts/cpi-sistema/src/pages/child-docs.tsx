import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";

const DOC_TYPES = [
  { key: "dni_nino",    label: "DNI / Fotocopia niño/a" },
  { key: "acta_nac",   label: "Acta de nacimiento" },
  { key: "dni_padres", label: "DNI padres (con foto)" },
  { key: "apto_fisico",label: "Apto físico" },
  { key: "aut_retiro", label: "Autorización de retiro" },
  { key: "aut_llamada",label: "Autorización de llamada" },
  { key: "aut_fotos",  label: "Autorización de fotos" },
] as const;

type DocEntry = { tipo: string; url: string; uploadedAt?: string };

type ChildDocsData = {
  childId: number;
  nombre: string;
  apellido: string;
  panialesAuth: boolean;
  docs: DocEntry[];
};

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function ChildDocs() {
  const [, params] = useRoute("/docs/:token");
  const token = params?.token;

  const [data, setData] = useState<ChildDocsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [panialesLoading, setPanialesLoading] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadData() {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/child-docs/${token}`);
      const json = await res.json();
      if (json.error) { setLoadError(json.error); return; }
      setData(json);
    } catch {
      setLoadError("No se pudo cargar. Revisá tu conexión.");
    }
  }

  useEffect(() => { loadData(); }, [token]);

  async function handleFileUpload(tipo: string, file: File) {
    setUploading(tipo);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(",")[1];
          const ext = file.name.split(".").pop() ?? "jpg";
          const res = await fetch(`${BASE_URL}/child-docs/${token}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo, fileBase64: base64, mimeType: file.type, ext }),
          });
          if (res.ok) {
            await loadData();
          }
        } finally {
          setUploading(null);
        }
      };
      reader.onerror = () => setUploading(null);
      reader.readAsDataURL(file);
    } catch {
      setUploading(null);
    }
  }

  async function handlePanialesToggle() {
    if (!data) return;
    setPanialesLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/child-docs/${token}/paniales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth: !data.panialesAuth }),
      });
      if (res.ok) await loadData();
    } finally {
      setPanialesLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-gray-800">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-violet-50 flex flex-col items-center justify-center px-4">
        <p className="text-violet-700 font-semibold animate-pulse">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-violet-600 text-white px-4 pt-10 pb-6">
        <p className="text-violet-200 text-xs font-semibold uppercase tracking-widest mb-1">Pulso de Asistencias · Caipli Lab</p>
        <h1 className="text-2xl font-bold">{data.apellido} {data.nombre}</h1>
        <p className="text-violet-200 text-sm mt-1">Documentación requerida</p>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">
        {DOC_TYPES.map(({ key, label }) => {
          const doc = data.docs.find(d => d.tipo === key);
          const isUploading = uploading === key;

          return (
            <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4 flex items-center gap-3">
              {doc ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <span className="text-green-600 text-lg">✓</span>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-gray-400 text-lg">○</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm leading-tight">{label}</p>
                {doc ? (
                  <p className="text-xs text-green-600 font-semibold mt-0.5">Entregado</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Pendiente</p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {doc && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-violet-600 font-semibold py-1 px-2 rounded-lg border border-violet-200 hover:bg-violet-50 active:bg-violet-100"
                  >
                    Ver
                  </a>
                )}
                <button
                  onClick={() => fileInputRefs.current[key]?.click()}
                  disabled={isUploading}
                  className={`text-xs font-semibold py-2 px-3 rounded-xl transition-colors ${
                    doc
                      ? "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300"
                      : "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800"
                  }`}
                >
                  {isUploading ? "Subiendo..." : doc ? "Reemplazar" : "Subir"}
                </button>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  ref={el => { fileInputRefs.current[key] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(key, file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Pañales */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4 flex items-center gap-3">
          {data.panialesAuth ? (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-green-600 text-lg">✓</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-gray-400 text-lg">○</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 text-sm leading-tight">Autorización uso de pañales</p>
            <p className={`text-xs mt-0.5 font-semibold ${data.panialesAuth ? "text-green-600" : "text-gray-400"}`}>
              {data.panialesAuth ? "Autorizado ✓" : "No autorizado"}
            </p>
          </div>
          <button
            onClick={handlePanialesToggle}
            disabled={panialesLoading}
            className={`text-xs font-semibold py-2 px-3 rounded-xl transition-colors shrink-0 ${
              data.panialesAuth
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800"
            }`}
          >
            {panialesLoading ? "..." : data.panialesAuth ? "Revocar" : "Autorizar"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 pt-2">
          Los archivos son almacenados de forma segura. Sólo el equipo del CPI puede acceder a ellos.
        </p>
      </div>
    </div>
  );
}
