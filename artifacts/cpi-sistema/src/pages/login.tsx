import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, Role } from "@/lib/auth-context";
import { useListRooms, getListRoomsQueryKey } from "@workspace/api-client-react";
import type { Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ShieldCheck, FolderOpen, Eye, EyeOff, Building2 } from "lucide-react";

type Step =
  | "main"          // email + contraseña
  | "register"      // registrar nueva org
  | "role"          // elegir rol dentro del centro
  | "superadmin";   // acceso superadmin

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("main");

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // register form
  const [regOrgName, setRegOrgName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regError, setRegError] = useState("");
  const [registering, setRegistering] = useState(false);

  // superadmin
  const [superPasscode, setSuperPasscode] = useState("");
  const [superError, setSuperError] = useState("");
  const [verifyingSuper, setVerifyingSuper] = useState(false);

  // after login: center + token stored here before role selection
  const [authedCenter, setAuthedCenter] = useState<{ id: number; name: string } | null>(null);
  const [authedToken, setAuthedToken] = useState<string | null>(null);

  const roomsParams = authedCenter ? { centerId: authedCenter.id } : {};
  const rooms = useListRooms(
    roomsParams,
    { query: { enabled: !!authedCenter && step === "role", queryKey: getListRoomsQueryKey(roomsParams) } }
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Error al iniciar sesión");
        return;
      }
      setAuthedCenter(data.center);
      setAuthedToken(data.token ?? null);
      setStep("role");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRegister = async () => {
    if (!regOrgName.trim() || !regEmail.trim() || !regPassword) return;
    setRegistering(true);
    setRegError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: regOrgName.trim(),
          email: regEmail.trim(),
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error ?? "Error al registrar");
        return;
      }
      setAuthedCenter(data.center);
      setAuthedToken(data.token ?? null);
      setStep("role");
    } finally {
      setRegistering(false);
    }
  };

  const handleVerifySuperAdmin = async () => {
    if (!superPasscode.trim()) return;
    setVerifyingSuper(true);
    setSuperError("");
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
        setSuperError("Código incorrecto. Intentá de nuevo.");
      }
    } finally {
      setVerifyingSuper(false);
    }
  };

  const handleSelectRole = (role: Role) => {
    if (!authedCenter) return;
    login(authedCenter.id, role, authedCenter.name, authedToken);
    if (role === "admin") setLocation("/reportes");
    else if (role === "equipotecnico") setLocation("/casos");
    else setLocation("/sala");
  };

  const centerRooms: Room[] = rooms.data ?? [];
  const salaRoles = centerRooms
    .filter((r) => r.ecoNumber != null)
    .sort((a, b) => a.ecoNumber - b.ecoNumber);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #7c3aed 100%)" }}
      >
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
        <div className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #818cf8, transparent)" }} />

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

        <div className="text-white/20 text-[10px] relative z-10 font-medium uppercase tracking-widest">
          © 2026 Koratic · Infraestructura Digital para el Sector Social
        </div>
      </div>

      {/* Panel derecho */}
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

          {/* ── MAIN: email + password ── */}
          {step === "main" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bienvenido</h1>
                <p className="text-gray-400 text-sm mt-1">Iniciá sesión con tu cuenta de organización</p>
              </div>

              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoFocus
                />
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginError && <p className="text-sm text-red-500">{loginError}</p>}
                <Button
                  className="w-full bg-[#1e1147] hover:bg-[#2d1b6e]"
                  onClick={handleLogin}
                  disabled={!email.trim() || !password || loggingIn}
                >
                  {loggingIn ? "Ingresando..." : "Ingresar"}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#fafafa] px-3 text-gray-400">¿No tenés cuenta?</span>
                </div>
              </div>

              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-violet-400 hover:bg-violet-50/40 transition-all text-left group"
                onClick={() => { setRegOrgName(""); setRegEmail(""); setRegPassword(""); setRegError(""); setStep("register"); }}
              >
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <Building2 className="w-4 h-4 text-violet-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">Registrar mi organización</div>
                  <div className="text-[11px] text-gray-400">Creá tu cuenta gratuita</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
              </button>

              <div className="border-t border-gray-100 pt-2">
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
                  onClick={() => { setSuperPasscode(""); setSuperError(""); setStep("superadmin"); }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Acceso administrador general
                </button>
              </div>
            </div>
          )}

          {/* ── REGISTER ── */}
          {step === "register" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("main")} className="text-gray-400 hover:text-gray-700 p-1">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Nueva organización</h1>
                  <p className="text-gray-400 text-sm">Creá tu cuenta para comenzar</p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Nombre de la organización"
                  value={regOrgName}
                  onChange={(e) => { setRegOrgName(e.target.value); setRegError(""); }}
                  autoFocus
                />
                <Input
                  type="email"
                  placeholder="Email de contacto"
                  value={regEmail}
                  onChange={(e) => { setRegEmail(e.target.value); setRegError(""); }}
                />
                <div className="relative">
                  <Input
                    type={regShowPw ? "text" : "password"}
                    placeholder="Contraseña (mín. 6 caracteres)"
                    value={regPassword}
                    onChange={(e) => { setRegPassword(e.target.value); setRegError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setRegShowPw(!regShowPw)}
                  >
                    {regShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {regError && <p className="text-sm text-red-500">{regError}</p>}
                <Button
                  className="w-full bg-[#1e1147] hover:bg-[#2d1b6e]"
                  onClick={handleRegister}
                  disabled={!regOrgName.trim() || !regEmail.trim() || !regPassword || registering}
                >
                  {registering ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </div>

              <p className="text-center text-xs text-gray-400">
                ¿Ya tenés cuenta?{" "}
                <button className="text-violet-600 font-medium hover:underline" onClick={() => setStep("main")}>
                  Iniciá sesión
                </button>
              </p>
            </div>
          )}

          {/* ── ROLE SELECTION ── */}
          {step === "role" && authedCenter && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep("main"); setAuthedCenter(null); setAuthedToken(null); }}
                  className="text-gray-400 hover:text-gray-700 p-1"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{authedCenter.name}</p>
                  <h1 className="text-2xl font-bold text-gray-900">¿Quién ingresa?</h1>
                </div>
              </div>

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
                        onClick={() => handleSelectRole(`sala${room.ecoNumber}` as Role)}
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

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Coordinación</p>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#1e1147] text-white hover:bg-[#2d1b6e] transition-colors text-left shadow-sm"
                  onClick={() => handleSelectRole("admin")}
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
                  onClick={() => handleSelectRole("equipotecnico")}
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

          {/* ── SUPERADMIN ── */}
          {step === "superadmin" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("main")} className="text-gray-400 hover:text-gray-700 p-1">
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
                  onChange={(e) => { setSuperPasscode(e.target.value); setSuperError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifySuperAdmin()}
                  autoFocus
                />
                {superError && <p className="text-sm text-red-500">{superError}</p>}
                <Button
                  className="w-full bg-[#1e1147] hover:bg-[#2d1b6e]"
                  onClick={handleVerifySuperAdmin}
                  disabled={!superPasscode.trim() || verifyingSuper}
                >
                  {verifyingSuper ? "Verificando..." : "Ingresar"}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
