import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, Role } from "@/lib/auth-context";
import { useListCenters, useListRooms, getListRoomsQueryKey, verifyCenterPasscode } from "@workspace/api-client-react";
import type { Center, Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BookOpen, Users, ChevronLeft, Plus, Lock } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"center" | "passcode" | "role">("center");
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [newCenterName, setNewCenterName] = useState("");
  const [creatingCenter, setCreatingCenter] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);

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
    } else {
      setLocation("/sala");
    }
  };

  const centerRooms: Room[] = rooms.data ?? [];
  const salaRoles = centerRooms
    .filter((r) => r.ecoNumber != null)
    .sort((a, b) => a.ecoNumber - b.ecoNumber);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-serif text-foreground">Sistema CPI</h1>
          <p className="text-muted-foreground">Asistencia e Integración</p>
        </div>

        {step === "center" && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Seleccionar Centro</CardTitle>
              <CardDescription>¿Desde qué centro vas a trabajar?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {centers.isPending && (
                <div className="text-sm text-muted-foreground text-center py-4">Cargando centros...</div>
              )}
              {!centers.isPending && (centers.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">No hay centros registrados aún</div>
              )}
              <div className="space-y-2">
                {(centers.data ?? []).map((center) => (
                  <Button
                    key={center.id}
                    variant="outline"
                    className="w-full h-14 justify-start px-4"
                    onClick={() => handleSelectCenter(center)}
                    data-testid={`btn-center-${center.id}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{center.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">Ingresar</div>
                      </div>
                      {center.hasPasscode && <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </div>
                  </Button>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Nuevo centro</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del centro"
                    value={newCenterName}
                    onChange={(e) => setNewCenterName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCenter()}
                    data-testid="input-new-center"
                  />
                  <Button
                    onClick={handleCreateCenter}
                    disabled={!newCenterName.trim() || creatingCenter}
                    size="icon"
                    data-testid="btn-create-center"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "passcode" && selectedCenter && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 -ml-1"
                  onClick={() => { setStep("center"); setSelectedCenter(null); setPasscode(""); setPasscodeError(""); }}
                  data-testid="btn-back-passcode"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle>{selectedCenter.name}</CardTitle>
                  <CardDescription>Ingresá el código de acceso</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Codigo de acceso"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setPasscodeError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyPasscode()}
                  autoFocus
                  data-testid="input-passcode"
                />
                {passcodeError && (
                  <p className="text-sm text-destructive">{passcodeError}</p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={handleVerifyPasscode}
                disabled={!passcode.trim() || verifyingPasscode}
                data-testid="btn-verify-passcode"
              >
                {verifyingPasscode ? "Verificando..." : "Ingresar"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "role" && selectedCenter && (
          <Card className="border-none shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 -ml-1"
                  onClick={() => {
                    if (selectedCenter.hasPasscode) {
                      setStep("passcode");
                    } else {
                      setStep("center");
                      setSelectedCenter(null);
                    }
                  }}
                  data-testid="btn-back-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle>{selectedCenter.name}</CardTitle>
                  <CardDescription>Seleccioná tu rol</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {rooms.isPending && (
                <div className="text-sm text-muted-foreground text-center py-4">Cargando salas...</div>
              )}
              {!rooms.isPending && salaRoles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Docentes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {salaRoles.map((room) => (
                      <Button
                        key={room.id}
                        variant="outline"
                        className="h-14 justify-start px-4 text-left"
                        onClick={() => handleLogin(`sala${room.ecoNumber}` as Role)}
                        data-testid={`btn-sala-${room.ecoNumber}`}
                      >
                        <div>
                          <div className="font-semibold">{room.name}</div>
                          <div className="text-xs text-muted-foreground font-normal">Tomar asistencia</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {!rooms.isPending && salaRoles.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2 bg-muted/40 rounded-lg px-3">
                  Este centro no tiene salas configuradas aún
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Coordinación</h3>
                <Button
                  variant="default"
                  className="w-full h-14"
                  onClick={() => handleLogin("admin")}
                  data-testid="btn-admin"
                >
                  <Users className="w-5 h-5 mr-2" />
                  <div className="text-left">
                    <div className="font-semibold">Administración</div>
                    <div className="text-xs text-primary-foreground/80 font-normal">Panel general</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
