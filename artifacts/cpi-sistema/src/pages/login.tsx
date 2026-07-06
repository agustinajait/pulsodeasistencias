import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, Role } from "@/lib/auth-context";
import { useListCenters, useListRooms, getListRoomsQueryKey } from "@workspace/api-client-react";
import type { Center, Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Plus, Lock, ShieldCheck, ChevronRight, FolderOpen } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"center" | "passcode" | "role" | "superadmin">("center");
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [newCenterName, setNewCenterName] = useState("");
  const [creatingCenter, setCreatingCenter] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);
  const [superPasscode, setSuperPasscode] = useState("");
  const [superPasscodeError, setSuperPasscodeError] = useState("");
  const [verifyingSuper, setVerifyingSuper] = useState(false);

  const centers = useListCenters();
  const roomsParams = selectedCenter ? { centerId: selectedCenter.id } : {};
  const rooms = useListRooms(
    roomsParams,
    { query: { enabled: !!selectedCenter && step === "role", queryKey: getListRoomsQueryKey(roomsParams) } }
  );

  const handleSelectCenter = (center: Center) => {
    setSelectedCenter(center);
    setPasscode("");
    setPasscodeError("");
    if (center.hasPasscode) {
      setStep("passcode");
    } else {
      setStep("role");
    }
  };

  const handleVerifyPasscode = async () => {
    if (!selectedCenter || !passcode.trim()) return;
    setVerifyingPasscode(true);
    setPasscodeError("");
    try {
      const res = await fetch(`/api/centers/${selectedCenter.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      if (!res.ok) throw new Error("invalid");
      const data = await res.json();
      if (data.token) setPendingToken(data.token);
      setStep("role");
    } catch {
      setPasscodeError("Codigo incorrecto. Intenta de nuevo.");
    } finally {
      setVerifyingPasscode(false);
    }
  };

  const handleVerifySuperAdmin = async () => {
    if (!superPasscode.trim()) return;
    setVerifyingSuper(true);
    setSuperPasscodeError("");
    try {
      const res = await fetch("/api/auth/super-admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: superPasscode.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        login(0, "superadmin" as Role, undefined, data.token ?? null);
        setLocation("/admin");
      } else {
        setSuperPasscodeError("Codigo incorrecto. Intenta de nuevo.");
      }
    } finally {
      setVerifyingSuper(false);
    }
  };

  const handleCreateCenter = async () => {
    const name = newCenterName.trim();
    if (!name) return;
    setCreatingCenter(true);
    try {
      const res = await fetch("/api/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created: Center = await res.json();
        centers.refetch();
        setNewCenterName("");
        handleSelectCenter(created);
      }
    } finally {
      setCreatingCenter(false);
    }
  };

  const handleLogin = (role: Role) => {
    if (!selectedCenter) return;
    login(selectedCenter.id, role, selectedCenter.name, pendingToken);
    if (role === "admin") {
      setLocation("/reportes");
    } else if (role === "equipotecnico") {
      setLocation("/casos");
    } else {
      setLocation("/sala");
    }
  };

  const centerRooms: Room[] = rooms.data ?? [];
  const salaRoles = centerRooms
    .filter((r) => r.ecoNumber != null)
    .sort((a, b) => a.ecoNumber - b.ecoNumber);

  return (
    <div className="min-h-screen flex">
      {/* ── Panel izquierdo — branding ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #7c3aed 100%)" }}
      >
        {/* Decoración */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
        <div className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #c4b5fd, transparent)" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.3"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight tracking-tight">Koratic</div>
            <div className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">By Koratic</div>
          </div>
        </div>

        {/* Tagline central */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
              I N F R A E S T R U C T U R A &nbsp; D E &nbsp; G E S T I Ó N &nbsp; S O C I A L
            </p>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Tecnología e IA para organizaciones de impacto social.
            </h2>
            <p className="text-white/50 text-base leading-relaxed mt-4">
              Diagnosticamos necesidades, acompañamos procesos de inclusión y centralizamos la gestión operativa — convirtiendo datos cotidianos en decisiones de mayor impacto.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { color: "bg-violet-400", label: "Módulo 01", text: "Asistencia, informes evolutivos y seguimiento" },
              { color: "bg-cyan-400",   label: "Módulo 02", text: "Diagnóstico y seguimiento social de personas y familias" },
              { color: "bg-emerald-400",label: "Módulo 03", text: "Gestión y cumplimiento de Servicios Centralizados" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className={`w-1 h-12 rounded-full ${item.color} shrink-0 mt-0.5`} />
                <div>
                  <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest">{item.label}</p>
                  <p className="text-white/80 text-sm font-medium leading-snug">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-white/20 text-[10px] relative z-10 font-medium uppercase tracking-widest">
          © 2026 Koratic · Infraestructura Digital para el Sector Social
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#fafafa]">
        {/* Header mobile */}
        <div className="lg:hidden text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#1e1147] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.9"/>
                <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.5"/>
                <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity="0.3"/>
              </svg>
            </div>
            <span className="font-bold text-[#1e1147]">Koratic</span>
          </div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">Infraestructura de Gestión Social</p>
        </div>

        <div className="w-full max-w-sm space-y-6">

          {/* STEP: seleccionar centro */}
          {step === "center" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">¿Cuál es tu centro?</h1>
                <p className="text-gray-400 text-sm mt-1">Seleccioná el CPI al que pertenecés</p>
              </div>

              <div className="space-y-2">
                {centers.isPending && (
                  <div className="text-sm text-gray-400 text-center py-6">Cargando centros...</div>
                )}
                {(centers.data ?? []).map((center) => (
                  <button
                    key={center.id}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:border-violet-400 hover:bg-violet-50/50 transition-all text-left group shadow-sm"
                    onClick={() => handleSelectCenter(center)}
                    data-testid={`btn-center-${center.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#1e1147]/8 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                      <span className="text-[#1e1147] font-bold text-sm">{center.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{center.name}</div>
                      <div className="text-xs text-gray-400">Ingresar al centro</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {center.hasPasscode && <Lock className="w-3.5 h-3.5 text-gray-300" />}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Nuevo centro */}
              <div className="pt-1">
                <p className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-widest">Registrar nuevo centro</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del CPI"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCenter()}
                    className="text-sm"
                    data-testid="input-new-center"
                  />
                  <Button onClick={handleCreateCenter} disabled={!newCenterName.trim() || creatingCenter} size="icon" data-testid="btn-create-center">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Super Admin */}
              <div className="pt-1 border-t border-gray-100">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
                  onClick={() => { setSuperPasscode(""); setSuperPasscodeError(""); setStep("superadmin"); }}
                  data-testid="btn-superadmin"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Acceso administrador general
                </button>
              </div>
            </div>
          )}

          {/* STEP: super admin */}
          {step === "superadmin" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("center")} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Administrador</h1>
                  <p className="text-gray-400 text-sm">Acceso a todos los centros</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Código de acceso"
                  value={superPasscode}
                  onChange={(e) => { setSuperPasscode(e.target.value); setSuperPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySuperAdmin()}
                  autoFocus
                  data-testid="input-superadmin-passcode"
                />
                {superPasscodeError && <p className="text-sm text-red-500">{superPasscodeError}</p>}
                <Button className="w-full bg-[#1e1147] hover:bg-[#2d1b6e]" onClick={handleVerifySuperAdmin} disabled={!superPasscode.trim() || verifyingSuper} data-testid="btn-verify-superadmin">
                  {verifyingSuper ? "Verificando..." : "Ingresar"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: passcode de centro */}
          {step === "passcode" && selectedCenter && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => { setStep("center"); setSelectedCenter(null); setPasscode(""); setPasscodeError(""); }} className="text-gray-400 hover:text-gray-700 transition-colors p-1">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedCenter.name}</h1>
                  <p className="text-gray-400 text-sm">Ingresá el código de acceso</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Código de acceso"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPasscode()}
                  autoFocus
                  data-testid="input-passcode"
                />
                {passcodeError && <p className="text-sm text-red-500">{passcodeError}</p>}
                <Button className="w-full bg-[#1e1147] hover:bg-[#2d1b6e]" onClick={handleVerifyPasscode} disabled={!passcode.trim() || verifyingPasscode} data-testid="btn-verify-passcode">
                  {verifyingPasscode ? "Verificando..." : "Continuar"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: seleccionar rol */}
          {step === "role" && selectedCenter && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (selectedCenter.hasPasscode) { setStep("passcode"); } else { setStep("center"); setSelectedCenter(null); }
                  }}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-1"
                  data-testid="btn-back-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{selectedCenter.name}</p>
                  <h1 className="text-2xl font-bold text-gray-900">¿Quién ingresa?</h1>
                </div>
              </div>

              {/* Salas — acción principal */}
              {rooms.isPending && (
                <div className="text-sm text-gray-400 text-center py-6">Cargando salas...</div>
              )}

              {!rooms.isPending && salaRoles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Líderes de sala</p>
                  <div className="grid grid-cols-2 gap-2">
                    {salaRoles.map((room) => (
                      <button
                        key={room.id}
                        className="flex flex-col items-start px-4 py-4 rounded-xl border-2 border-gray-100 bg-white hover:border-violet-400 hover:bg-violet-50/40 transition-all text-left shadow-sm group"
                        onClick={() => handleLogin(`sala${room.ecoNumber}` as Role)}
                        data-testid={`btn-sala-${room.ecoNumber}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-2 group-hover:bg-violet-200 transition-colors">
                          <span className="text-violet-700 font-bold text-xs">{room.ecoNumber}</span>
                        </div>
                        <div className="font-bold text-sm text-gray-900">{room.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Asistencia · Informes</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!rooms.isPending && salaRoles.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-3 bg-gray-50 rounded-xl px-3">
                  Este centro no tiene salas configuradas aún
                </p>
              )}

              {/* Coordinación y equipo técnico */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coordinación</p>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#1e1147] text-white hover:bg-[#2d1b6e] transition-colors text-left shadow-sm"
                  onClick={() => handleLogin("admin")}
                  data-testid="btn-admin"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">Administración</div>
                    <div className="text-[11px] text-white/60">Panel general del centro</div>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-100 bg-white hover:border-teal-300 hover:bg-teal-50/40 transition-colors text-left shadow-sm"
                  onClick={() => handleLogin("equipotecnico")}
                  data-testid="btn-equipotecnico"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-900">Equipo Técnico</div>
                    <div className="text-[11px] text-gray-400">Diagnóstico y seguimiento de casos</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
