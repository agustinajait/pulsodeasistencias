import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Upload, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useListCenters } from "@workspace/api-client-react";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Profile = {
  centerId: number;
  logoBase64?: string;
  direccion?: string;
  directorNombre?: string;
  coordinadorNombre?: string;
  telefono?: string;
  email?: string;
  descripcion?: string;
};

async function fetchProfile(centerId: number): Promise<Profile> {
  const r = await fetch(`${BASE}/centers/${centerId}/profile`);
  return r.ok ? r.json() : { centerId };
}

export default function Configuracion() {
  const { centerId, role } = useAuth();
  const isSuperAdmin = role === "superadmin";
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const centers = useListCenters({ query: { enabled: isSuperAdmin } });
  const [superCenterId, setSuperCenterId] = useState<number | null>(null);
  const effectiveCenterId = isSuperAdmin ? superCenterId : centerId;

  const profileQ = useQuery({
    queryKey: ["center-profile", effectiveCenterId],
    queryFn: () => fetchProfile(effectiveCenterId!),
    enabled: effectiveCenterId != null && effectiveCenterId !== 0,
  });

  const [form, setForm] = useState<Omit<Profile, "centerId">>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profileQ.data) {
      const { centerId: _, ...rest } = profileQ.data;
      setForm(rest);
      setDirty(false);
    }
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await fetch(`${BASE}/centers/${effectiveCenterId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["center-profile", effectiveCenterId] });
      qc.invalidateQueries({ queryKey: ["center-profile-dashboard", effectiveCenterId] });
      toast({ title: "Configuración guardada" });
      setDirty(false);
    },
  });

  function update(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update("logoBase64", reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const canEdit = effectiveCenterId != null && effectiveCenterId !== 0;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Centro</div>
        <h1 className="text-2xl font-bold mt-1">Configuración</h1>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* superadmin center picker */}
        {isSuperAdmin && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Centro</label>
            <select
              value={superCenterId ?? ""}
              onChange={(e) => setSuperCenterId(Number(e.target.value))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccioná un centro...</option>
              {(centers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {!canEdit && !isSuperAdmin && (
          <p className="text-center text-gray-400 py-12 text-sm">Sin centro asignado</p>
        )}

        {canEdit && (
          <>
            {/* Logo */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Logo del centro</p>
              <div className="flex items-center gap-4">
                {form.logoBase64 ? (
                  <div className="relative">
                    <img
                      src={form.logoBase64}
                      alt="Logo"
                      className="w-20 h-20 rounded-xl object-contain border border-gray-100 bg-gray-50"
                    />
                    <button
                      onClick={() => update("logoBase64", "")}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                    <Building2 className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {form.logoBase64 ? "Cambiar logo" : "Subir logo"}
                  </Button>
                  <p className="text-[10px] text-gray-400 mt-1">PNG, JPG — recomendado cuadrado</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Información del centro</p>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Dirección</label>
                <Input
                  value={form.direccion ?? ""}
                  onChange={(e) => update("direccion", e.target.value)}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Director/a</label>
                <Input
                  value={form.directorNombre ?? ""}
                  onChange={(e) => update("directorNombre", e.target.value)}
                  placeholder="Nombre completo"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Coordinador/a</label>
                <Input
                  value={form.coordinadorNombre ?? ""}
                  onChange={(e) => update("coordinadorNombre", e.target.value)}
                  placeholder="Nombre completo"
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Teléfono</label>
                  <Input
                    value={form.telefono ?? ""}
                    onChange={(e) => update("telefono", e.target.value)}
                    placeholder="Ej: 11 1234-5678"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Email</label>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="centro@mail.com"
                    className="text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Descripción / misión</label>
                <textarea
                  value={form.descripcion ?? ""}
                  onChange={(e) => { update("descripcion", e.target.value); }}
                  placeholder="Breve descripción del centro..."
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <Button
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMut.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
