import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListChildren, useListAttendance, useMarkAttendance, getListChildrenQueryKey, getListAttendanceQueryKey, useGetRoomsSummary, getGetRoomsSummaryQueryKey, useListRooms, useGetAlerts, useListCenters } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ChevronLeft, ChevronRight, LogOut, AlertTriangle, MessageCircle, X } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Child, AttendanceRecord, Room, RoomSummary, Alert } from "@workspace/api-client-react";
import ChildSheet from "@/components/child-sheet";

const TODAY = new Date().toISOString().slice(0, 10);
const MES_ACTUAL = new Date().toISOString().slice(0, 7);

const MOTIVOS = ["Enfermedad", "Logistica", "Turno medico", "Clima", "Otros"];

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function getMonthDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const days = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6;
}

function dayColor(att: AttendanceRecord[], total: number) {
  if (att.length === 0) return "bg-muted text-muted-foreground";
  const pres = att.filter((a) => a.estado === "P").length;
  const aus = att.filter((a) => a.estado === "A").length;
  const merc = att.filter((a) => a.mercaderia).length;
  if (merc > 0 && pres === att.length) return "bg-purple-100 text-purple-700 border-purple-200";
  if (pres === att.length) return "bg-green-100 text-green-700 border-green-200";
  if (aus === att.length) return "bg-red-100 text-red-700 border-red-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

export default function SalaPage() {
  const { role, ecoNumber, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [calMonth, setCalMonth] = useState(MES_ACTUAL);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [closingDay, setClosingDay] = useState(false);
  const [notasDraft, setNotasDraft] = useState<Record<number, string>>({});
  // Estado optimista para el modal de día del calendario
  const [calDayOptimistic, setCalDayOptimistic] = useState<Record<number, Partial<AttendanceRecord>>>({});

  // Superadmin: selector de centro y sala
  const savedCenterId = role === "superadmin" ? parseInt(localStorage.getItem("superadmin_sala_centerId") ?? "0") || null : null;
  const savedRoomId = role === "superadmin" ? parseInt(localStorage.getItem("superadmin_sala_roomId") ?? "0") || null : null;
  const [superCenterId, setSuperCenterId] = useState<number | null>(savedCenterId);
  const [superRoomId, setSuperRoomId] = useState<number | null>(savedRoomId);
  const centers = useListCenters({ query: { enabled: role === "superadmin" } });

  const rooms = useListRooms();
  // Resolve actual DB roomId by matching ecoNumber — robust against re-seeds
  const roomInfo = role === "superadmin"
    ? rooms.data?.find((r: Room) => r.id === superRoomId) ?? null
    : rooms.data?.find((r: Room) => r.ecoNumber === ecoNumber);
  const roomId = role === "superadmin" ? superRoomId : (roomInfo?.id ?? null);

  const centerRoomsForSuper = (rooms.data ?? []).filter((r: Room) => r.centerId === superCenterId);

  const summary = useGetRoomsSummary();
  const roomSummary: RoomSummary | undefined = summary.data?.find((s: RoomSummary) => s.id === roomId);

  const children = useListChildren(
    { roomId: roomId ?? undefined, active: true },
    { query: { enabled: !!roomId, queryKey: getListChildrenQueryKey({ roomId: roomId ?? undefined, active: true }) } }
  );

  const attendance = useListAttendance(
    { roomId: roomId ?? undefined, date: TODAY },
    { query: { enabled: !!roomId, queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, date: TODAY }) } }
  );

  const calAtt = useListAttendance(
    { roomId: roomId ?? undefined, month: calMonth },
    { query: { enabled: !!roomId, queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, month: calMonth }) } }
  );

  const markAttendance = useMarkAttendance();

  // Alertas de esta sala (2+ ausencias consecutivas)
  const allAlerts = useGetAlerts();
  const salaAlerts = useMemo(
    () => (allAlerts.data ?? []).filter((a: Alert) => a.ecoNumber === ecoNumber),
    [allAlerts.data, ecoNumber]
  );

  function waUrl(alert: Alert) {
    if (!alert.celular) return null;
    // Tomar solo el primer número (puede haber varios separados por / o espacio)
    const firstNumber = alert.celular.split(/[\/,;\s]+/)[0];
    const phone = firstNumber.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hola ${alert.famNombre ?? "familia"}, le contactamos del CPI Norte. Notamos que ${alert.apellido} ${alert.nombre} lleva ${alert.consecutiveAbsences} día${alert.consecutiveAbsences !== 1 ? "s" : ""} sin asistir. ¿Todo bien?`
    );
    return `https://wa.me/54${phone}?text=${msg}`;
  }

  const attMap = useMemo(() => {
    const m: Record<number, AttendanceRecord> = {};
    (attendance.data ?? []).forEach((a: AttendanceRecord) => (m[a.childId] = a));
    return m;
  }, [attendance.data]);

  // Estado optimista local: se actualiza inmediatamente al hacer clic
  const [optimisticAtt, setOptimisticAtt] = useState<Record<number, Partial<AttendanceRecord>>>({});

  // Merge: optimistic tiene prioridad sobre server
  const mergedAttMap = useMemo(() => {
    const m: Record<number, AttendanceRecord> = { ...attMap };
    Object.entries(optimisticAtt).forEach(([id, patch]) => {
      const numId = Number(id);
      m[numId] = { ...(m[numId] ?? { childId: numId, fecha: TODAY }), ...patch } as AttendanceRecord;
    });
    return m;
  }, [attMap, optimisticAtt]);

  const calAttMap = useMemo(() => {
    const m: Record<string, AttendanceRecord[]> = {};
    (calAtt.data ?? []).forEach((a: AttendanceRecord) => {
      if (!m[a.fecha]) m[a.fecha] = [];
      m[a.fecha].push(a);
    });
    return m;
  }, [calAtt.data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (children.data ?? []).filter(
      (c: Child) =>
        c.apellido.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    );
  }, [children.data, search]);

  function handleToggle(childId: number, estado: "P" | "A") {
    const curr = mergedAttMap[childId];
    // Actualización optimista inmediata
    setOptimisticAtt((prev) => ({
      ...prev,
      [childId]: { ...curr, estado, motivo: estado === "P" ? undefined : curr?.motivo },
    }));
    markAttendance.mutate(
      { data: { childId, fecha: TODAY, estado } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, date: TODAY }) });
          queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
        onError: () => {
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
      }
    );
  }

  function handleMotivo(childId: number, motivo: string) {
    const curr = mergedAttMap[childId];
    setOptimisticAtt((prev) => ({ ...prev, [childId]: { ...curr, estado: "A", motivo } }));
    markAttendance.mutate(
      { data: { childId, fecha: TODAY, estado: "A", motivo, nota: curr?.nota ?? undefined, mercaderia: curr?.mercaderia ?? false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, date: TODAY }) });
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
        onError: () => {
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
      }
    );
  }

  function handleNota(childId: number) {
    const curr = mergedAttMap[childId];
    const nota = notasDraft[childId] ?? curr?.nota ?? "";
    markAttendance.mutate(
      { data: { childId, fecha: TODAY, estado: curr?.estado ?? "A", motivo: curr?.motivo ?? undefined, nota: nota || undefined, mercaderia: curr?.mercaderia ?? false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, date: TODAY }) });
        },
      }
    );
  }

  function handleMercaderia(childId: number) {
    const curr = mergedAttMap[childId];
    const newMerc = !(curr?.mercaderia ?? false);
    setOptimisticAtt((prev) => ({ ...prev, [childId]: { ...curr, mercaderia: newMerc } }));
    markAttendance.mutate(
      { data: { childId, fecha: TODAY, estado: curr?.estado ?? undefined, mercaderia: newMerc } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, date: TODAY }) });
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
        onError: () => {
          setOptimisticAtt((prev) => { const next = { ...prev }; delete next[childId]; return next; });
        },
      }
    );
  }

  function handleCerrar() {
    setClosingDay(true);
    setTimeout(() => {
      setClosingDay(false);
      toast({ title: "Asistencia cerrada", description: formatDateLabel(TODAY) });
      queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
    }, 800);
  }

  function prevMonth() {
    const [y, m] = calMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCalMonth(d.toISOString().slice(0, 7));
  }

  function nextMonth() {
    const [y, m] = calMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setCalMonth(d.toISOString().slice(0, 7));
  }

  const calDays = getMonthDays(calMonth);
  const firstDow = calDays[0].getDay();
  const paddingDays = firstDow === 0 ? 6 : firstDow - 1;

  const roomLabel = roomInfo?.name ?? `Sala ECO ${ecoNumber ?? 0}`;
  const totalKids = children.data?.length ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(28,110,68,0.2)]" />
            <span className="font-bold text-sm">{role === "superadmin" ? "Super Admin" : "CPI Norte"}</span>
            {role !== "superadmin" && <Badge variant="secondary" className="text-xs font-semibold">{roomLabel}</Badge>}
            {role === "superadmin" && roomId && <Badge variant="secondary" className="text-xs font-semibold">{roomInfo?.name ?? ""}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground capitalize hidden sm:inline">{formatDateLabel(TODAY)}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => { setLocation("/admin"); }}
              data-testid="button-back-admin"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Admin
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => { logout(); setLocation("/login"); }}
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Salir
            </Button>
          </div>
        </div>
        {role === "superadmin" && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <Select value={superCenterId ? String(superCenterId) : ""} onValueChange={(v) => { setSuperCenterId(Number(v)); setSuperRoomId(null); }}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="Centro" />
              </SelectTrigger>
              <SelectContent>
                {(centers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={superRoomId ? String(superRoomId) : ""} onValueChange={(v) => setSuperRoomId(Number(v))} disabled={!superCenterId}>
              <SelectTrigger className="h-8 text-sm w-40">
                <SelectValue placeholder="Sala" />
              </SelectTrigger>
              <SelectContent>
                {centerRoomsForSuper.map((r: Room) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* Stats bar */}
      {roomSummary && (
        <div className="grid grid-cols-5 gap-2 px-4 py-3 bg-card border-b border-border" data-testid="stats-bar">
          <div className="text-center">
            <div className="text-xl font-bold text-foreground">{roomSummary.total}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">{roomSummary.present}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Presentes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-red-600">{roomSummary.absent}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Ausentes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-600">{roomSummary.unmarked}</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Sin marcar</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{roomSummary.pct}%</div>
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Asistencia</div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-24">
        <Tabs defaultValue="lista">
          <TabsList className="w-full mb-4" data-testid="tabs-sala">
            <TabsTrigger value="lista" className="flex-1" data-testid="tab-lista">Lista</TabsTrigger>
            <TabsTrigger value="calendario" className="flex-1" data-testid="tab-calendario">Calendario</TabsTrigger>
          </TabsList>

          {/* LISTA */}
          <TabsContent value="lista">
            {/* Alertas ausencias consecutivas */}
            {salaAlerts.length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden" data-testid="sala-alerts">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-100">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-sm font-bold text-amber-800">
                    {salaAlerts.length === 1 ? "1 niño con ausencias consecutivas" : `${salaAlerts.length} niños con ausencias consecutivas`}
                  </span>
                </div>
                {salaAlerts.map((alert: Alert) => {
                  const url = waUrl(alert);
                  return (
                    <div key={alert.childId} className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-amber-900 truncate">
                          {alert.apellido} {alert.nombre}
                        </div>
                        <div className="text-xs text-amber-700">
                          {alert.consecutiveAbsences} día{alert.consecutiveAbsences !== 1 ? "s" : ""} seguido{alert.consecutiveAbsences !== 1 ? "s" : ""} sin asistir · {alert.famNombre ?? "Familia"} {alert.famApellido ?? ""}
                        </div>
                      </div>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors shrink-0"
                          data-testid={`btn-wa-alert-${alert.childId}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Sin teléfono</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar niño/a..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            {children.isLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">Cargando...</div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                {filtered.map((child: Child, idx: number) => {
                  const att = mergedAttMap[child.id];
                  const estado = att?.estado ?? null;
                  const mercaderia = att?.mercaderia ?? false;
                  return (
                    <div
                      key={child.id}
                      className="border-b border-border last:border-0"
                      data-testid={`row-child-${child.id}`}
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer"
                          style={{ background: child.genero === "FEMENINO" ? "var(--color-primary)/10" : "hsl(215 60% 92%)", color: child.genero === "FEMENINO" ? "var(--color-primary)" : "hsl(215 60% 35%)" }}
                          onClick={() => setSelectedChild(child.id)}
                        >
                          {child.apellido.slice(0, 1)}{child.nombre.slice(0, 1)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedChild(child.id)}>
                          <div className="text-sm font-semibold truncate">{child.apellido} {child.nombre}</div>
                          {child.celular && (
                            <div className="text-xs text-muted-foreground truncate">{child.famNombre} · {child.celular}</div>
                          )}
                        </div>
                        {/* M button */}
                        <button
                          onClick={() => handleMercaderia(child.id)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border transition-colors shrink-0 ${mercaderia ? "bg-yellow-300 text-yellow-800 border-yellow-400 shadow-[0_0_6px_2px_rgba(250,204,21,0.6)]" : "bg-muted text-muted-foreground border-border"}`}
                          title="Mercadería"
                          data-testid={`btn-mercaderia-${child.id}`}
                        >
                          M
                        </button>
                        {/* P/A toggle */}
                        <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
                          <button
                            onClick={() => handleToggle(child.id, "P")}
                            className={`px-3 py-1.5 text-sm font-bold transition-colors ${estado === "P" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            data-testid={`btn-presente-${child.id}`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => handleToggle(child.id, "A")}
                            className={`px-3 py-1.5 text-sm font-bold transition-colors border-l border-border ${estado === "A" ? "bg-red-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            data-testid={`btn-ausente-${child.id}`}
                          >
                            A
                          </button>
                        </div>
                      </div>
                      {/* Motivos + nota */}
                      {estado === "A" && (
                        <div className="px-4 pb-3 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {MOTIVOS.map((m) => (
                              <button
                                key={m}
                                onClick={() => handleMotivo(child.id, m)}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${att?.motivo === m ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-background text-muted-foreground border-border hover:border-amber-300 hover:bg-amber-50"}`}
                                data-testid={`btn-motivo-${child.id}-${m}`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Observación (opcional)..."
                            value={notasDraft[child.id] ?? att?.nota ?? ""}
                            onChange={(e) =>
                              setNotasDraft((prev) => ({ ...prev, [child.id]: e.target.value }))
                            }
                            onBlur={() => handleNota(child.id)}
                            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            data-testid={`textarea-nota-${child.id}`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">Sin resultados</div>
                )}
              </div>
            )}
          </TabsContent>

          {/* CALENDARIO */}
          <TabsContent value="calendario">
            <div className="bg-card rounded-xl border border-border shadow-sm p-4 mb-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base capitalize">
                  {new Date(calMonth + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                </h3>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={prevMonth} data-testid="btn-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={nextMonth} data-testid="btn-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex gap-3 flex-wrap mb-3 text-[11px] font-medium">
                {[
                  { color: "bg-green-200", label: "Todos presentes" },
                  { color: "bg-red-200", label: "Todos ausentes" },
                  { color: "bg-amber-200", label: "Mixto" },
                  { color: "bg-purple-200", label: "Mercaderia" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: paddingDays }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calDays.map((day) => {
                  const dateStr = day.toISOString().slice(0, 10);
                  const isToday = dateStr === TODAY;
                  const isFuture = dateStr > TODAY;
                  const weekend = isWeekend(day);
                  const dayAtt = calAttMap[dateStr] ?? [];
                  const color = weekend || isFuture ? "opacity-30 pointer-events-none" : dayAtt.length > 0 ? dayColor(dayAtt, totalKids) : "bg-muted text-muted-foreground hover:bg-muted/70";
                  return (
                    <div
                      key={dateStr}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-semibold border transition-all ${color} ${isToday ? "ring-2 ring-primary" : "border-transparent"} ${!weekend && !isFuture ? "cursor-pointer hover:opacity-80" : ""}`}
                      data-testid={`cal-day-${dateStr}`}
                      onClick={() => !weekend && !isFuture && setSelectedDay(dateStr)}
                    >
                      {!weekend && day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal detalle/edición del día */}
            {selectedDay && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm" onClick={() => { setSelectedDay(null); setCalDayOptimistic({}); }}>
                <div
                  className="bg-card rounded-t-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
                    <div>
                      <h2 className="text-base font-bold capitalize">{formatDateLabel(selectedDay)}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(calAttMap[selectedDay] ?? []).filter(a => a.estado === "P").length} presentes ·{" "}
                        {(calAttMap[selectedDay] ?? []).filter(a => a.estado === "A").length} ausentes
                        {selectedDay !== TODAY && <span className="ml-1 text-amber-600 font-medium">· Día anterior</span>}
                      </p>
                    </div>
                    <button onClick={() => { setSelectedDay(null); setCalDayOptimistic({}); }} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="divide-y divide-border px-2 py-2">
                    {(children.data ?? []).map((child: Child) => {
                      const serverAtt = (calAttMap[selectedDay] ?? []).find(a => a.childId === child.id);
                      const optimistic = calDayOptimistic[child.id];
                      const att = optimistic ? { ...serverAtt, ...optimistic } as AttendanceRecord : serverAtt;
                      const estado = att?.estado ?? null;
                      const mercaderia = att?.mercaderia ?? false;

                      function markCalDay(newEstado: "P" | "A") {
                        setCalDayOptimistic((prev) => ({ ...prev, [child.id]: { ...att, estado: newEstado, motivo: newEstado === "P" ? undefined : att?.motivo } }));
                        markAttendance.mutate(
                          { data: { childId: child.id, fecha: selectedDay!, estado: newEstado } },
                          {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, month: calMonth }) });
                              queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
                              setCalDayOptimistic((prev) => { const next = { ...prev }; delete next[child.id]; return next; });
                            },
                            onError: () => setCalDayOptimistic((prev) => { const next = { ...prev }; delete next[child.id]; return next; }),
                          }
                        );
                      }

                      function markCalMerc() {
                        const newMerc = !mercaderia;
                        setCalDayOptimistic((prev) => ({ ...prev, [child.id]: { ...att, mercaderia: newMerc } }));
                        markAttendance.mutate(
                          { data: { childId: child.id, fecha: selectedDay!, estado: att?.estado ?? undefined, mercaderia: newMerc } },
                          {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ roomId: roomId ?? undefined, month: calMonth }) });
                              setCalDayOptimistic((prev) => { const next = { ...prev }; delete next[child.id]; return next; });
                            },
                            onError: () => setCalDayOptimistic((prev) => { const next = { ...prev }; delete next[child.id]; return next; }),
                          }
                        );
                      }

                      return (
                        <div key={child.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                            style={{ background: child.genero === "FEMENINO" ? "hsl(var(--primary)/0.1)" : "hsl(215 60% 92%)", color: child.genero === "FEMENINO" ? "hsl(var(--primary))" : "hsl(215 60% 35%)" }}
                          >
                            {child.apellido.slice(0, 1)}{child.nombre.slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{child.apellido} {child.nombre}</div>
                            {att?.motivo && <div className="text-xs text-muted-foreground">{att.motivo}</div>}
                          </div>
                          <button
                            onClick={markCalMerc}
                            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold border transition-colors shrink-0 ${mercaderia ? "bg-yellow-300 text-yellow-800 border-yellow-400 shadow-[0_0_6px_2px_rgba(250,204,21,0.6)]" : "bg-muted text-muted-foreground border-border"}`}
                          >
                            M
                          </button>
                          <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
                            <button
                              onClick={() => markCalDay("P")}
                              className={`px-3 py-1.5 text-sm font-bold transition-colors ${estado === "P" ? "bg-green-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            >
                              P
                            </button>
                            <button
                              onClick={() => markCalDay("A")}
                              className={`px-3 py-1.5 text-sm font-bold transition-colors border-l border-border ${estado === "A" ? "bg-red-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            >
                              A
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border py-3 px-4 flex justify-center z-50">
        <Button
          className="max-w-sm w-full h-11 font-semibold"
          onClick={handleCerrar}
          disabled={closingDay}
          data-testid="button-cerrar-asistencia"
        >
          {closingDay ? "Cerrando..." : "Cerrar asistencia del día"}
        </Button>
      </div>

      {/* Child sheet */}
      {selectedChild !== null && (
        <ChildSheet
          childId={selectedChild}
          onClose={() => setSelectedChild(null)}
          roomId={roomId}
        />
      )}
    </div>
  );
}
