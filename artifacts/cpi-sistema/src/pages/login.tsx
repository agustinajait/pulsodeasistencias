import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, Role } from "@/lib/auth-context";
import { useListCenters, useListRooms, getListRoomsQueryKey, verifyCenterPasscode } from "@workspace/api-client-react";
import type { Center, Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Plus, Lock, ShieldCheck, ChevronRight, Activity, FolderOpen } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"center" | "passcode" | "role" | "superadmin">("center");
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [newCenterName, setNewCenterName] = useState("");
  const [creatingCenter, setCreatingCenter] = useState(false);
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
      await verifyCenterPasscode(selectedCenter.id, { passcode: passcode.trim() });
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
        login(0, "superadmin" as Role);
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
    login(selectedCenter.id, role);
    if (role === "admin") {
      setLocation("/admin");
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
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #7c3aed 100%)" }}>
        {/* Circles decorativos */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #c4b5fd, transparent)" }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">Koratic</div>
            <div className="text-purple-200 text-xs font-medium">By Koratic</div>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Asistencia en tiempo real para cada centro.
          </h2>
          <p className="text-purple-200 text-base leading-relaxed">
            Gestioná la asistencia, alertas y nómina de todos tus centros de primera infancia desde un solo lugar.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { color: "bg-violet-400", text: "Asistencia por sala en segundos" },
              { color: "bg-cyan-400", text: "Dashboard de impacto en tiempo real" },
              { color: "bg-red-400", text: "Alertas automaticas por ausencias" },
              { color: "bg-green-400", text: "Evidencia simple para la direccion" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className={`w-1.5 h-6 rounded-full ${item.color} shrink-0`} />
                <span className="text-purple-100 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-purple-300 text-xs relative z-10">
          © 2026 Koratic · Red de Centros de Primera Infancia
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        {/* Header mobile */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">Koratic</div>
            <div className="text-xs text-muted-foreground">By Koratic</div>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-6">

          {/* STEP: seleccionar centro */}
          {step === "center" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Ingresar</h1>
                <p className="text-muted-foreground text-sm mt-1">Selecciona tu centro para continuar</p>
              </div>

              <div className="space-y-2">
                {centers.isPending && (
                  <div className="text-sm text-muted-foreground text-center py-6">Cargando centros...</div>
                )}
                {(centers.data ?? []).map((center) => (
                  <button
                    key={center.id}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    onClick={() => handleSelectCenter(center)}
                    data-testid={`btn-center-${center.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <span className="text-primary font-bold text-sm">{center.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{center.name}</div>
                      <div className="text-xs text-muted-foreground">Ingresar al centro</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {center.hasPasscode && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Nuevo centro */}
              <div className="pt-1">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Nuevo centro</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del centro"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCenter()}
                    data-testid="input-new-center"
                  />
                  <Button onClick={handleCreateCenter} disabled={!newCenterName.trim() || creatingCenter} size="icon" data-testid="btn-create-center">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Super Admin */}
              <div className="pt-1 border-t border-border">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => { setSuperPasscode(""); setSuperPasscodeError(""); setStep("superadmin"); }}
                  data-testid="btn-superadmin"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Acceso Super Admin
                </button>
              </div>
            </div>
          )}

          {/* STEP: super admin */}
          {step === "superadmin" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <button onClick={() => setStep("center")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold">Super Admin</h1>
                  <p className="text-muted-foreground text-sm">Acceso general a todos los centros</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Codigo de acceso"
                  value={superPasscode}
                  onChange={(e) => { setSuperPasscode(e.target.value); setSuperPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySuperAdmin()}
                  autoFocus
                  data-testid="input-superadmin-passcode"
                />
                {superPasscodeError && <p className="text-sm text-destructive">{superPasscodeError}</p>}
                <Button className="w-full" onClick={handleVerifySuperAdmin} disabled={!superPasscode.trim() || verifyingSuper} data-testid="btn-verify-superadmin">
                  {verifyingSuper ? "Verificando..." : "Ingresar"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: passcode de centro */}
          {step === "passcode" && selectedCenter && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <button onClick={() => { setStep("center"); setSelectedCenter(null); setPasscode(""); setPasscodeError(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold">{selectedCenter.name}</h1>
                  <p className="text-muted-foreground text-sm">Ingresa el codigo de acceso</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Codigo de acceso"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPasscode()}
                  autoFocus
                  data-testid="input-passcode"
                />
                {passcodeError && <p className="text-sm text-destructive">{passcodeError}</p>}
                <Button className="w-full" onClick={handleVerifyPasscode} disabled={!passcode.trim() || verifyingPasscode} data-testid="btn-verify-passcode">
                  {verifyingPasscode ? "Verificando..." : "Continuar"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP: seleccionar rol */}
          {step === "role" && selectedCenter && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedCenter.hasPasscode) { setStep("passcode"); } else { setStep("center"); setSelectedCenter(null); }
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="btn-back-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold">{selectedCenter.name}</h1>
                  <p className="text-muted-foreground text-sm">Selecciona tu rol</p>
                </div>
              </div>

              {rooms.isPending && (
                <div className="text-sm text-muted-foreground text-center py-6">Cargando salas...</div>
              )}

              {!rooms.isPending && salaRoles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docentes</p>
                  <div className="grid grid-cols-2 gap-2">
                    {salaRoles.map((room) => (
                      <button
                        key={room.id}
                        className="flex flex-col items-start px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                        onClick={() => handleLogin(`sala${room.ecoNumber}` as Role)}
                        data-testid={`btn-sala-${room.ecoNumber}`}
                      >
                        <div className="font-semibold text-sm">{room.name}</div>
                        <div className="text-xs text-muted-foreground">Tomar asistencia</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!rooms.isPending && salaRoles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2 bg-muted/40 rounded-lg px-3">
                  Este centro no tiene salas configuradas aun
                </p>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coordinacion</p>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-left"
                  onClick={() => handleLogin("admin")}
                  data-testid="btn-admin"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Administracion</div>
                    <div className="text-xs text-primary-foreground/75">Panel general</div>
                  </div>
                  <ChevronRight className="w-4 h-4 ml-auto opacity-75" />
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                  onClick={() => handleLogin("equipotecnico")}
                  data-testid="btn-equipotecnico"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">Equipo Técnico</div>
                    <div className="text-xs text-muted-foreground">Seguimiento de casos</div>
                  </div>
                  <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
