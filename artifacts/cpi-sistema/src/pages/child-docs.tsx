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

type AuthRecord = {
  tipo: string;
  accepted_at: string;
  accepted_by_name: string;
  accepted_by_dni: string;
  accepted_by_vinculo: string;
  data: Record<string, unknown>;
};

type ChildDocsData = {
  childId: number;
  nombre: string;
  apellido: string;
  panialesAuth: boolean;
  docs: DocEntry[];
};

type AuthorizedPerson = { nombre: string; dni: string; telefono: string };
type EmergencyContact = { nombre: string; telefono: string };

const EMPTY_PERSON: AuthorizedPerson = { nombre: "", dni: "", telefono: "" };
const EMPTY_CONTACT: EmergencyContact = { nombre: "", telefono: "" };

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function ChildDocs() {
  const [, params] = useRoute("/docs/:token");
  const token = params?.token;

  const [data, setData] = useState<ChildDocsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [panialesLoading, setPanialesLoading] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // authorizations state
  const [authorizations, setAuthorizations] = useState<AuthRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"docs" | "retiro" | "higiene">("docs");

  // retiro form state
  const [retiroPersons, setRetiroPersons] = useState<AuthorizedPerson[]>([
    { ...EMPTY_PERSON }, { ...EMPTY_PERSON }, { ...EMPTY_PERSON }, { ...EMPTY_PERSON },
  ]);
  const [retiroContacts, setRetiroContacts] = useState<EmergencyContact[]>([
    { ...EMPTY_CONTACT }, { ...EMPTY_CONTACT },
  ]);
  const [retiroSigner, setRetiroSigner] = useState({ nombre: "", dni: "", vinculo: "" });
  const [retiroSaving, setRetiroSaving] = useState(false);
  const [retiroSaved, setRetiroSaved] = useState(false);

  // higiene form state
  const [higieneConsents, setHigieneConsents] = useState<Record<string, boolean | null>>({
    fotos: null,
    higiene: null,
    simulacro: null,
  });
  const [higieneSigner, setHigieneSigner] = useState({ nombre: "", dni: "", vinculo: "" });
  const [higieneSaving, setHigieneSaving] = useState(false);
  const [higieneSaved, setHigieneSaved] = useState(false);

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

  async function loadAuthorizations() {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/child-authorizations/${token}`);
      const json = await res.json();
      if (!json.error) setAuthorizations(json.authorizations ?? []);
    } catch { /* silent */ }
  }

  useEffect(() => {
    loadData();
    loadAuthorizations();
  }, [token]);

  // Pre-fill form if already saved
  useEffect(() => {
    const retiro = authorizations.find(a => a.tipo === "RETIRO");
    if (retiro) {
      const d = retiro.data as { authorized_persons?: AuthorizedPerson[]; emergency_contacts?: EmergencyContact[] };
      setRetiroPersons(d.authorized_persons?.length ? d.authorized_persons : [EMPTY_PERSON, EMPTY_PERSON, EMPTY_PERSON, EMPTY_PERSON]);
      setRetiroContacts(d.emergency_contacts?.length ? d.emergency_contacts : [EMPTY_CONTACT, EMPTY_CONTACT]);
      setRetiroSigner({ nombre: retiro.accepted_by_name ?? "", dni: retiro.accepted_by_dni ?? "", vinculo: retiro.accepted_by_vinculo ?? "" });
    }
    const higiene = authorizations.find(a => a.tipo === "HIGIENE");
    if (higiene) {
      const d = higiene.data as { fotos?: boolean; higiene?: boolean; simulacro?: boolean };
      setHigieneConsents({ fotos: d.fotos ?? null, higiene: d.higiene ?? null, simulacro: d.simulacro ?? null });
      setHigieneSigner({ nombre: higiene.accepted_by_name ?? "", dni: higiene.accepted_by_dni ?? "", vinculo: higiene.accepted_by_vinculo ?? "" });
    }
  }, [authorizations]);

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
          if (res.ok) await loadData();
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

  async function handleRetiroSave() {
    if (!retiroSigner.nombre || !retiroSigner.dni) return;
    setRetiroSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/child-authorizations/${token}/retiro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted_by_name: retiroSigner.nombre,
          accepted_by_dni: retiroSigner.dni,
          accepted_by_vinculo: retiroSigner.vinculo,
          authorized_persons: retiroPersons.filter(p => p.nombre.trim()),
          emergency_contacts: retiroContacts.filter(c => c.nombre.trim()),
        }),
      });
      if (res.ok) {
        setRetiroSaved(true);
        await loadAuthorizations();
      }
    } finally {
      setRetiroSaving(false);
    }
  }

  async function handleHigieneSave() {
    if (!higieneSigner.nombre || !higieneSigner.dni) return;
    if (higieneConsents.fotos === null || higieneConsents.higiene === null || higieneConsents.simulacro === null) return;
    setHigieneSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/child-authorizations/${token}/higiene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted_by_name: higieneSigner.nombre,
          accepted_by_dni: higieneSigner.dni,
          accepted_by_vinculo: higieneSigner.vinculo,
          fotos: higieneConsents.fotos,
          higiene: higieneConsents.higiene,
          simulacro: higieneConsents.simulacro,
        }),
      });
      if (res.ok) {
        setHigieneSaved(true);
        await loadAuthorizations();
      }
    } finally {
      setHigieneSaving(false);
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

  const retiroAuth = authorizations.find(a => a.tipo === "RETIRO");
  const higieneAuth = authorizations.find(a => a.tipo === "HIGIENE");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-violet-600 text-white px-4 pt-10 pb-6">
        <p className="text-violet-200 text-xs font-semibold uppercase tracking-widest mb-1">Pulso de Asistencias · Caipli Lab</p>
        <h1 className="text-2xl font-bold">{data.apellido} {data.nombre}</h1>
        <p className="text-violet-200 text-sm mt-1">Ficha familiar</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        <TabBtn active={activeTab === "docs"} onClick={() => setActiveTab("docs")}>Documentación</TabBtn>
        <TabBtn active={activeTab === "retiro"} onClick={() => setActiveTab("retiro")} badge={!retiroAuth}>
          Aut. de Retiro {retiroAuth ? "✓" : ""}
        </TabBtn>
        <TabBtn active={activeTab === "higiene"} onClick={() => setActiveTab("higiene")} badge={!higieneAuth}>
          Higiene y Fotos {higieneAuth ? "✓" : ""}
        </TabBtn>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">

        {/* ── DOCS TAB ── */}
        {activeTab === "docs" && (
          <>
            {DOC_TYPES.map(({ key, label }) => {
              const doc = data.docs.find(d => d.tipo === key);
              const isUploading = uploading === key;
              return (
                <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${doc ? "bg-green-100" : "bg-gray-100"}`}>
                    <span className={`text-lg ${doc ? "text-green-600" : "text-gray-400"}`}>{doc ? "✓" : "○"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm leading-tight">{label}</p>
                    <p className={`text-xs mt-0.5 font-semibold ${doc ? "text-green-600" : "text-gray-400"}`}>
                      {doc ? "Entregado" : "Pendiente"}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {doc && (
                      <a href={doc.url} target="_blank" rel="noreferrer"
                        className="text-xs text-violet-600 font-semibold py-1 px-2 rounded-lg border border-violet-200 hover:bg-violet-50 active:bg-violet-100">
                        Ver
                      </a>
                    )}
                    <button
                      onClick={() => fileInputRefs.current[key]?.click()}
                      disabled={isUploading}
                      className={`text-xs font-semibold py-2 px-3 rounded-xl transition-colors ${doc ? "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300" : "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800"}`}
                    >
                      {isUploading ? "Subiendo..." : doc ? "Reemplazar" : "Subir"}
                    </button>
                    <input type="file" accept="image/*,.pdf" className="hidden"
                      ref={el => { fileInputRefs.current[key] = el; }}
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(key, file); e.target.value = ""; }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Pañales */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${data.panialesAuth ? "bg-green-100" : "bg-gray-100"}`}>
                <span className={`text-lg ${data.panialesAuth ? "text-green-600" : "text-gray-400"}`}>{data.panialesAuth ? "✓" : "○"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm leading-tight">Autorización uso de pañales</p>
                <p className={`text-xs mt-0.5 font-semibold ${data.panialesAuth ? "text-green-600" : "text-gray-400"}`}>
                  {data.panialesAuth ? "Autorizado ✓" : "No autorizado"}
                </p>
              </div>
              <button
                onClick={handlePanialesToggle}
                disabled={panialesLoading}
                className={`text-xs font-semibold py-2 px-3 rounded-xl transition-colors shrink-0 ${data.panialesAuth ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800"}`}
              >
                {panialesLoading ? "..." : data.panialesAuth ? "Revocar" : "Autorizar"}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 pt-2">
              Los archivos son almacenados de forma segura. Sólo el equipo del CPI puede acceder a ellos.
            </p>
          </>
        )}

        {/* ── RETIRO TAB ── */}
        {activeTab === "retiro" && (
          <div className="space-y-5">
            {retiroAuth && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                ✓ Ficha firmada digitalmente por <strong>{retiroAuth.accepted_by_name}</strong> el{" "}
                {new Date(retiroAuth.accepted_at).toLocaleDateString("es-AR")}. Podés actualizar los datos a continuación.
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-bold text-gray-800 text-base">Personas autorizadas para retirar</h2>
              <p className="text-xs text-gray-500">Completá los datos de hasta 4 personas autorizadas.</p>
              {retiroPersons.map((p, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Persona {i + 1}</p>
                  <input placeholder="Nombre completo" value={p.nombre}
                    onChange={e => { const arr = [...retiroPersons]; arr[i] = { ...arr[i], nombre: e.target.value }; setRetiroPersons(arr); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                  <div className="flex gap-2">
                    <input placeholder="DNI" value={p.dni}
                      onChange={e => { const arr = [...retiroPersons]; arr[i] = { ...arr[i], dni: e.target.value }; setRetiroPersons(arr); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                    <input placeholder="Teléfono" value={p.telefono}
                      onChange={e => { const arr = [...retiroPersons]; arr[i] = { ...arr[i], telefono: e.target.value }; setRetiroPersons(arr); }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-bold text-gray-800 text-base">Contactos de emergencia</h2>
              {retiroContacts.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder={`Nombre contacto ${i + 1}`} value={c.nombre}
                    onChange={e => { const arr = [...retiroContacts]; arr[i] = { ...arr[i], nombre: e.target.value }; setRetiroContacts(arr); }}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                  <input placeholder="Teléfono" value={c.telefono}
                    onChange={e => { const arr = [...retiroContacts]; arr[i] = { ...arr[i], telefono: e.target.value }; setRetiroContacts(arr); }}
                    className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-bold text-gray-800 text-base">Firma digital</h2>
              <p className="text-xs text-gray-500">
                Al guardar, confirmás que los datos son correctos y que autorizás a las personas indicadas a retirar a{" "}
                <strong>{data.nombre} {data.apellido}</strong> del CPI.
              </p>
              <input placeholder="Tu nombre completo *" value={retiroSigner.nombre}
                onChange={e => setRetiroSigner(s => ({ ...s, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
              <div className="flex gap-2">
                <input placeholder="Tu DNI *" value={retiroSigner.dni}
                  onChange={e => setRetiroSigner(s => ({ ...s, dni: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                <input placeholder="Vínculo (ej: madre)" value={retiroSigner.vinculo}
                  onChange={e => setRetiroSigner(s => ({ ...s, vinculo: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </div>
            </div>

            {retiroSaved && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 text-center font-semibold">
                ✓ Autorización de retiro guardada correctamente
              </div>
            )}

            <button
              onClick={handleRetiroSave}
              disabled={retiroSaving || !retiroSigner.nombre || !retiroSigner.dni}
              className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white rounded-xl py-4 text-base font-bold transition-colors"
            >
              {retiroSaving ? "Guardando..." : "Firmar y guardar autorización"}
            </button>
          </div>
        )}

        {/* ── HIGIENE TAB ── */}
        {activeTab === "higiene" && (
          <div className="space-y-5">
            {higieneAuth && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                ✓ Ficha firmada digitalmente por <strong>{higieneAuth.accepted_by_name}</strong> el{" "}
                {new Date(higieneAuth.accepted_at).toLocaleDateString("es-AR")}. Podés actualizar los datos a continuación.
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <h2 className="font-bold text-gray-800 text-base">Consentimientos</h2>

              <ConsentItem
                label="Fotografías y filmaciones"
                description="Autorizo al CPI a tomar fotos o videos de mi hijo/a para uso institucional."
                value={higieneConsents.fotos}
                onChange={v => setHigieneConsents(c => ({ ...c, fotos: v }))}
              />
              <div className="border-t border-gray-100" />
              <ConsentItem
                label="Cambio de pañales e higiene"
                description="Autorizo al personal del CPI a realizar el cambio de pañales y la higiene personal de mi hijo/a."
                value={higieneConsents.higiene}
                onChange={v => setHigieneConsents(c => ({ ...c, higiene: v }))}
              />
              <div className="border-t border-gray-100" />
              <ConsentItem
                label="Simulacro de evacuación"
                description="Autorizo la participación de mi hijo/a en los simulacros de evacuación realizados en el CPI."
                value={higieneConsents.simulacro}
                onChange={v => setHigieneConsents(c => ({ ...c, simulacro: v }))}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-bold text-gray-800 text-base">Firma digital</h2>
              <p className="text-xs text-gray-500">
                Al guardar confirmás que la información es correcta y que diste tu consentimiento para los ítems marcados como SÍ.
              </p>
              <input placeholder="Tu nombre completo *" value={higieneSigner.nombre}
                onChange={e => setHigieneSigner(s => ({ ...s, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
              <div className="flex gap-2">
                <input placeholder="Tu DNI *" value={higieneSigner.dni}
                  onChange={e => setHigieneSigner(s => ({ ...s, dni: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
                <input placeholder="Vínculo (ej: padre)" value={higieneSigner.vinculo}
                  onChange={e => setHigieneSigner(s => ({ ...s, vinculo: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </div>
            </div>

            {higieneSaved && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 text-center font-semibold">
                ✓ Autorización de higiene y fotos guardada correctamente
              </div>
            )}

            <button
              onClick={handleHigieneSave}
              disabled={
                higieneSaving ||
                !higieneSigner.nombre ||
                !higieneSigner.dni ||
                higieneConsents.fotos === null ||
                higieneConsents.higiene === null ||
                higieneConsents.simulacro === null
              }
              className="w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white rounded-xl py-4 text-base font-bold transition-colors"
            >
              {higieneSaving ? "Guardando..." : "Firmar y guardar consentimientos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ children, active, onClick, badge }: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative py-3 px-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
        active ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
      {badge && (
        <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-orange-400" />
      )}
    </button>
  );
}

function ConsentItem({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-gray-800 text-sm">{label}</p>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="flex gap-3">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
            value === true
              ? "bg-green-500 border-green-500 text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-green-300"
          }`}
        >
          SÍ
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${
            value === false
              ? "bg-red-500 border-red-500 text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-red-300"
          }`}
        >
          NO
        </button>
      </div>
    </div>
  );
}
