import { useState, useMemo } from "react";
import { useGetChild, useCreateContact, useUpdateChild, useDischargeChild, useReinstateChild, useListAttendance, getGetChildQueryKey, getListChildrenQueryKey, getGetRoomsSummaryQueryKey, getGetDashboardSummaryQueryKey, getGetAlertsQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import type { AttendanceRecord } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Phone, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, Copy, CheckCircle2, Circle, FileText, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { key: "dni_nino",    label: "DNI / Fotocopia niño/a" },
  { key: "acta_nac",   label: "Acta de nacimiento" },
  { key: "dni_padres", label: "DNI padres (con foto)" },
  { key: "apto_fisico",label: "Apto físico" },
  { key: "aut_retiro", label: "Autorización de retiro" },
  { key: "aut_llamada",label: "Autorización de llamada" },
  { key: "aut_fotos",  label: "Autorización de fotos" },
] as const;

const MES_ACTUAL = new Date().toISOString().slice(0, 7);

function getMonthDaysCS(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const days: Date[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}
function prevMonthStr(m: string) { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; }
function nextMonthStr(m: string) { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; }

interface Props {
  childId: number;
  onClose: () => void;
  roomId?: number | null;
}

const TODAY = new Date().toISOString().slice(0, 10);

const MOTIVO_CONTACTO_OPTIONS = [
  "Consulta por ausencias", "Enfermedad", "Turno médico",
  "Logística familiar", "Mercadería / bolsón", "Sin respuesta",
  "Confirma regreso", "Solicita baja", "Otro",
];
const RESULTADO_OPTIONS = ["Asiste", "Va a venir", "Una vez", "Dar Baja", "Alarma", "Alimentos", "Adaptación"];
const TIPO_BAJA_OPTIONS = [
  { value: "baja-vol", label: "Baja voluntaria" },
  { value: "baja-aus", label: "Ausencias reiteradas" },
  { value: "pase-cpi", label: "Pase a otro CPI" },
  { value: "pase-jardin", label: "Pase a jardín" },
  { value: "otro", label: "Otro" },
];

export default function ChildSheet({ childId, onClose, roomId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"ficha" | "llamado" | "baja" | "historial" | "documentos">("ficha");
  const [histMonth, setHistMonth] = useState(MES_ACTUAL);

  // Docs state
  const [docsData, setDocsData] = useState<{ docsToken: string; panialesAuth: boolean; docs: {tipo:string;url:string;uploadedAt?:string}[] } | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  // Llamado form
  const [llFecha, setLlFecha] = useState(TODAY);
  const [llQuien, setLlQuien] = useState("");
  const [llMotivo, setLlMotivo] = useState(MOTIVO_CONTACTO_OPTIONS[0]);
  const [llObs, setLlObs] = useState("");
  const [llResultado, setLlResultado] = useState(RESULTADO_OPTIONS[0]);

  // Baja form
  const [bajaTipo, setBajaTipo] = useState<string>("");
  const [bajaObs, setBajaObs] = useState("");

  const child = useGetChild(childId, {
    query: { queryKey: getGetChildQueryKey(childId) },
  });

  const histAtt = useListAttendance(
    { childId, month: histMonth },
    { query: { queryKey: getListAttendanceQueryKey({ childId, month: histMonth }) } }
  );

  const histAttMap = useMemo(() => {
    const m: Record<string, AttendanceRecord> = {};
    (histAtt.data ?? []).forEach((r) => { m[r.fecha] = r; });
    return m;
  }, [histAtt.data]);

  const histDays = useMemo(() => getMonthDaysCS(histMonth), [histMonth]);
  const histPaddingDays = useMemo(() => {
    if (!histDays.length) return 0;
    const dow = histDays[0].getDay();
    return dow === 0 ? 6 : dow - 1;
  }, [histDays]);

  const createContact = useCreateContact();
  const dischargeChild = useDischargeChild();
  const reinstateChild = useReinstateChild();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetChildQueryKey(childId) });
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey({ roomId: roomId ?? undefined, active: true }) });
    queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
  }

  function handleLlamado() {
    createContact.mutate(
      { data: { childId, fecha: llFecha, quien: llQuien, motivo: llMotivo, obs: llObs, resultado: llResultado } },
      {
        onSuccess: () => {
          toast({ title: "Contacto registrado" });
          setView("ficha");
          setLlObs(""); setLlQuien("");
          invalidateAll();
        },
      }
    );
  }

  function handleBaja() {
    if (!bajaTipo) return;
    dischargeChild.mutate(
      { data: { tipo: bajaTipo, obs: bajaObs }, id: childId },
      {
        onSuccess: () => {
          toast({ title: "Egreso registrado" });
          setView("ficha");
          invalidateAll();
          onClose();
        },
      }
    );
  }

  async function loadDocs() {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/children/${childId}/docs`);
      if (res.ok) setDocsData(await res.json());
    } finally {
      setDocsLoading(false);
    }
  }

  function handleReinstate() {
    reinstateChild.mutate(
      { data: {}, id: childId },
      {
        onSuccess: () => {
          toast({ title: "Alta registrada" });
          invalidateAll();
        },
      }
    );
  }

  const c = child.data;

  function waLink() {
    if (!c?.celular) return null;
    const phone = c.celular.replace(/\D/g, "");
    const ecoNum = c.ecoNumber;
    const dias = c.consecutiveAbsences ?? 0;
    const msg = encodeURIComponent(
      `Hola ${c.famNombre ?? "familia"}, le contactamos del CPI Norte, sala ECO ${ecoNum}. Notamos que ${c.apellido} ${c.nombre} lleva ${dias} día${dias !== 1 ? "s" : ""} sin asistir. ¿Podemos ponernos en contacto?`
    );
    return `https://wa.me/54${phone}?text=${msg}`;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="child-sheet"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            {c && (
              <>
                <h2 className="text-base font-bold">{c.apellido} {c.nombre}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ECO {c.ecoNumber}
                  {c.consecutiveAbsences && c.consecutiveAbsences >= 2 ? (
                    <span className="ml-2 text-red-600 font-semibold">
                      {c.consecutiveAbsences} días consecutivos sin asistir
                    </span>
                  ) : null}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="btn-close-sheet">
            <X className="w-5 h-5" />
          </button>
        </div>

        {child.isLoading && (
          <div className="text-center py-10 text-muted-foreground text-sm">Cargando...</div>
        )}

        {c && (
          <div className="px-5 py-4 space-y-4">
            {/* Alert badge */}
            {c.consecutiveAbsences && c.consecutiveAbsences >= 2 && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{c.consecutiveAbsences} días consecutivos sin asistir — requiere contacto</span>
              </div>
            )}

            {/* View tabs */}
            {view === "ficha" && (
              <>
                {/* Personal data */}
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Datos personales</h4>
                  {[
                    { label: "DNI", value: c.dni },
                    { label: "Nacimiento", value: c.fnac },
                    { label: "Género", value: c.genero },
                    { label: "Domicilio", value: c.domicilio },
                    { label: "Barrio", value: c.barrio },
                    { label: "Localidad", value: c.localidad },
                    { label: "Est. asistencia", value: c.estAsist },
                    { label: "Estado", value: c.estado },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <div key={label} className="flex gap-2">
                      <span className="text-xs text-muted-foreground min-w-[90px] shrink-0 font-medium">{label}</span>
                      <span className="text-sm text-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Family */}
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Familia</h4>
                  {[
                    { label: "Familiar", value: c.famNombre && c.famApellido ? `${c.famApellido}, ${c.famNombre}` : (c.famNombre ?? c.famApellido) },
                    { label: "Vínculo", value: c.vinculo },
                    { label: "Teléfono", value: c.celular },
                    { label: "Email", value: c.email },
                  ].filter(r => r.value).map(({ label, value }) => (
                    <div key={label} className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground min-w-[90px] shrink-0 font-medium">{label}</span>
                      <span className="text-sm text-foreground flex-1">{value}</span>
                      {label === "Teléfono" && c.celular && waLink() && (
                        <a
                          href={waLink()!}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-xs bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5 font-semibold hover:bg-green-200 flex items-center gap-1"
                          data-testid="link-whatsapp"
                        >
                          <Phone className="w-3 h-3" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Contacts history */}
                {c.contacts && c.contacts.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Llamados / Contactos</h4>
                    <div className="space-y-2">
                      {c.contacts.slice(0, 5).map((ct: any) => (
                        <div key={ct.id} className="bg-muted/40 rounded-lg px-3 py-2">
                          <div className="text-[11px] text-muted-foreground font-mono">{ct.fecha}</div>
                          <div className="text-sm text-foreground mt-0.5">{ct.obs ?? ct.motivo}</div>
                          {ct.quien && <div className="text-[11px] text-primary font-semibold mt-0.5">{ct.quien}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => setView("historial")}
                    variant="outline"
                    className="w-full"
                    data-testid="btn-ver-historial"
                  >
                    Ver historial de asistencia
                  </Button>
                  <Button
                    onClick={() => { setView("documentos"); loadDocs(); }}
                    variant="outline"
                    className="w-full"
                    data-testid="btn-ver-documentos"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Documentos
                  </Button>
                  {c.activo && (
                    <>
                      <Button
                        onClick={() => setView("llamado")}
                        variant="outline"
                        className="w-full"
                        data-testid="btn-registrar-llamado"
                      >
                        Registrar contacto
                      </Button>
                      <Button
                        onClick={() => setView("baja")}
                        variant="destructive"
                        className="w-full"
                        data-testid="btn-registrar-baja"
                      >
                        Registrar egreso
                      </Button>
                    </>
                  )}
                  {!c.activo && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                        Egresado/a el {c.fechaBaja} · {c.motivoBaja}
                      </div>
                      <Button
                        onClick={handleReinstate}
                        className="w-full"
                        disabled={reinstateChild.isPending}
                        data-testid="btn-reinstate"
                      >
                        Dar de alta nuevamente
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* LLAMADO FORM */}
            {view === "llamado" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Registrar contacto con familia</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input type="date" value={llFecha} onChange={(e) => setLlFecha(e.target.value)} className="mt-1" data-testid="input-llamado-fecha" />
                  </div>
                  <div>
                    <Label className="text-xs">¿Quién llamó?</Label>
                    <Input value={llQuien} onChange={(e) => setLlQuien(e.target.value)} placeholder="Ej: Matías" className="mt-1" data-testid="input-llamado-quien" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Motivo del contacto</Label>
                  <Select value={llMotivo} onValueChange={setLlMotivo}>
                    <SelectTrigger className="mt-1" data-testid="select-llamado-motivo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVO_CONTACTO_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Observación</Label>
                  <Textarea value={llObs} onChange={(e) => setLlObs(e.target.value)} rows={3} className="mt-1" data-testid="textarea-llamado-obs" />
                </div>
                <div>
                  <Label className="text-xs">Estado resultante</Label>
                  <Select value={llResultado} onValueChange={setLlResultado}>
                    <SelectTrigger className="mt-1" data-testid="select-llamado-resultado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESULTADO_OPTIONS.map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setView("ficha")} data-testid="btn-cancelar-llamado">Cancelar</Button>
                  <Button className="flex-2" onClick={handleLlamado} disabled={createContact.isPending} data-testid="btn-guardar-llamado">
                    {createContact.isPending ? "Guardando..." : "Guardar contacto"}
                  </Button>
                </div>
              </div>
            )}

            {/* HISTORIAL VIEW */}
            {view === "historial" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="px-2 py-1 h-auto" onClick={() => setView("ficha")} data-testid="btn-historial-back">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Ficha
                  </Button>
                  <h3 className="font-semibold text-base flex-1">Historial de asistencia</h3>
                </div>

                {/* Month nav */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(prevMonthStr(histMonth))} data-testid="btn-hist-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold capitalize">
                    {new Date(histMonth + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                  </span>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(nextMonthStr(histMonth))} disabled={histMonth >= MES_ACTUAL} data-testid="btn-hist-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Legend */}
                <div className="flex gap-3 flex-wrap text-[11px] font-medium">
                  {[
                    { color: "bg-green-200", label: "Presente" },
                    { color: "bg-red-200", label: "Ausente" },
                    { color: "bg-gray-200", label: "Sin registro" },
                  ].map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                      <span className="text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1">
                  {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-0.5">{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: histPaddingDays }).map((_, i) => <div key={`hp-${i}`} />)}
                  {histDays.map((day) => {
                    const ds = day.toISOString().slice(0, 10);
                    const dow = day.getDay();
                    const weekend = dow === 0 || dow === 6;
                    if (weekend) return <div key={ds} className="aspect-square opacity-0" />;
                    const rec = histAttMap[ds];
                    const color = !rec
                      ? "bg-muted text-muted-foreground border-transparent"
                      : rec.estado === "P"
                      ? "bg-green-200 text-green-800 border-green-300 font-semibold"
                      : rec.estado === "A"
                      ? "bg-red-200 text-red-800 border-red-300 font-semibold"
                      : "bg-gray-200 text-gray-600 border-gray-300";
                    return (
                      <div key={ds} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] border transition-all ${color}`} title={rec?.estado ?? ""} data-testid={`hist-day-${ds}`}>
                        <span>{day.getDate()}</span>
                        {rec && <span className="text-[9px] leading-none font-bold">{rec.estado}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Monthly stats */}
                {(() => {
                  const records = Object.values(histAttMap);
                  const pCount = records.filter((r) => r.estado === "P").length;
                  const aCount = records.filter((r) => r.estado === "A").length;
                  const total = pCount + aCount;
                  if (total === 0) return <div className="text-xs text-muted-foreground text-center py-2">Sin registros en este mes</div>;
                  const pct = Math.round((pCount / total) * 100);
                  return (
                    <div className="bg-muted/50 rounded-lg px-4 py-3 flex justify-around text-center">
                      <div><div className="text-base font-bold text-green-700">{pCount}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Presentes</div></div>
                      <div><div className="text-base font-bold text-red-700">{aCount}</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Ausentes</div></div>
                      <div><div className="text-base font-bold text-primary">{pct}%</div><div className="text-[10px] text-muted-foreground uppercase tracking-wider">Asistencia</div></div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* BAJA FORM */}
            {view === "baja" && (
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Registrar egreso</h3>
                <div className="grid grid-cols-2 gap-2">
                  {TIPO_BAJA_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setBajaTipo(o.value)}
                      className={`px-3 py-3 rounded-lg border text-sm font-semibold text-center transition-all ${bajaTipo === o.value ? "border-red-400 bg-red-50 text-red-700" : "border-border bg-background text-muted-foreground hover:border-red-300"}`}
                      data-testid={`btn-baja-tipo-${o.value}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-xs">Observaciones</Label>
                  <Textarea value={bajaObs} onChange={(e) => setBajaObs(e.target.value)} rows={3} className="mt-1" data-testid="textarea-baja-obs" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setView("ficha")} data-testid="btn-cancelar-baja">Cancelar</Button>
                  <Button variant="destructive" className="flex-1" onClick={handleBaja} disabled={!bajaTipo || dischargeChild.isPending} data-testid="btn-confirmar-baja">
                    {dischargeChild.isPending ? "Registrando..." : "Confirmar egreso"}
                  </Button>
                </div>
              </div>
            )}

            {/* DOCUMENTOS VIEW */}
            {view === "documentos" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="px-2 py-1 h-auto" onClick={() => setView("ficha")} data-testid="btn-docs-back">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Ficha
                  </Button>
                  <h3 className="font-semibold text-base flex-1">Documentos</h3>
                  <Button variant="ghost" size="sm" className="px-2 py-1 h-auto" onClick={loadDocs} disabled={docsLoading} data-testid="btn-docs-reload">
                    <RefreshCw className={`w-4 h-4 ${docsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                {docsLoading && !docsData && (
                  <div className="text-center py-8 text-muted-foreground text-sm">Cargando documentos...</div>
                )}

                {docsData && (
                  <>
                    {/* Parent link card */}
                    <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 space-y-2">
                      <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Enlace para padres</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-violet-800 flex-1 truncate bg-white rounded px-2 py-1 border border-violet-200">
                          {window.location.origin}/docs/{docsData.docsToken}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-violet-300 text-violet-700 hover:bg-violet-100"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/docs/${docsData.docsToken}`);
                            toast({ title: "Enlace copiado" });
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Document list */}
                    <div className="space-y-2">
                      {DOC_TYPES.map(({ key, label }) => {
                        const doc = docsData.docs.find(d => d.tipo === key);
                        return (
                          <div key={key} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5">
                            {doc ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{label}</p>
                              {doc && doc.uploadedAt && (
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(doc.uploadedAt).toLocaleDateString("es-AR")}
                                </p>
                              )}
                              {!doc && (
                                <p className="text-[10px] text-muted-foreground">Pendiente</p>
                              )}
                            </div>
                            {doc && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-violet-700 hover:underline flex items-center gap-1 shrink-0"
                              >
                                Ver <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        );
                      })}

                      {/* Pañales row */}
                      <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5">
                        {docsData.panialesAuth ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Autorización uso de pañales</p>
                          <p className="text-[10px] text-muted-foreground">
                            {docsData.panialesAuth ? "Autorizado por familia" : "No autorizado"}
                          </p>
                        </div>
                        <Badge variant={docsData.panialesAuth ? "default" : "outline"} className="shrink-0 text-[10px]">
                          {docsData.panialesAuth ? "Sí" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
