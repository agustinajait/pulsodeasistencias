import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useGetDashboardSummary, useGetAlerts, useGetRecentContacts, useGetRoomsSummary,
  useListChildren, useListAttendance, useCreateChild, useUpdateRoom, useDeleteChild, useUpdateChild,
  useListCenters, useListRooms, useCreateCenter, useCreateRoom, useDeleteRoom, useUpdateCenter,
  getGetDashboardSummaryQueryKey, getGetAlertsQueryKey, getGetRecentContactsQueryKey,
  getGetRoomsSummaryQueryKey, getListChildrenQueryKey, getListRoomsQueryKey, getListAttendanceQueryKey,
  getListCentersQueryKey
} from "@workspace/api-client-react";
import type { RoomSummary as RoomSummaryType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, LogOut, Phone, ExternalLink, AlertTriangle, Plus, Copy, Download, Pencil, Check, X, Upload, Trash2, ChevronLeft, ChevronRight, FileText, Lock, LockOpen, Users, QrCode } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { Child, Alert, RoomSummary, Contact, AttendanceRecord, Center, Room } from "@workspace/api-client-react";
import ChildSheet from "@/components/child-sheet";

const TODAY = new Date().toISOString().slice(0, 10);

function prevMonthAdmin(m: string) { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; }
function nextMonthAdmin(m: string) { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; }
function getMonthDaysAdmin(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days: Date[] = [];
  for (let d = new Date(y, m - 1, 1), last = new Date(y, m, 0); d <= last; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const ECO_COLORS: Record<number, { bg: string; text: string; bar: string }> = {
  0: { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" },
  1: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
  2: { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500" },
  3: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
};

function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center shadow-sm">
      <div className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function RoomCard({ room, onNavigate }: { room: RoomSummary; onNavigate?: (roomId: number) => void }) {
  const c = ECO_COLORS[room.ecoNumber] ?? ECO_COLORS[0];
  const vacantes = room.capacity - room.total;
  const pctBar = room.total > 0 ? Math.round((room.present / room.total) * 100) : 0;
  return (
    <div
      className={`rounded-xl border border-border p-4 shadow-sm ${c.bg} ${onNavigate ? "cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" : ""}`}
      data-testid={`room-card-${room.ecoNumber}`}
      onClick={() => onNavigate?.(room.id)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className={`text-sm font-bold ${c.text}`}>{room.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Capacidad: {room.capacity}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {room.alerts > 0 && (
            <Badge variant="destructive" className="text-[11px]" data-testid={`badge-alerts-${room.ecoNumber}`}>
              {room.alerts} alertas
            </Badge>
          )}
          {onNavigate && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.text} border-current opacity-70`}>
              Ver sala →
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-4 text-sm mb-3">
        <div><span className="font-bold text-green-600">{room.present}</span> <span className="text-muted-foreground text-xs">pres.</span></div>
        <div><span className="font-bold text-red-600">{room.absent}</span> <span className="text-muted-foreground text-xs">aus.</span></div>
        <div><span className="font-bold text-amber-600">{room.unmarked}</span> <span className="text-muted-foreground text-xs">s/m</span></div>
        <div><span className="font-bold text-foreground">{room.total}</span> <span className="text-muted-foreground text-xs">total</span></div>
      </div>
      <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-1">
        <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pctBar}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pctBar}% asistencia hoy</span>
        <span className="text-blue-600 font-medium">{vacantes} vacante{vacantes !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  function waLink() {
    if (!alert.celular) return null;
    const firstNumber = alert.celular.split(/[\/,;\s]+/)[0];
    const phone = firstNumber.replace(/\D/g, "").replace(/^0+/, "");
    if (!phone) return null;
    const fullPhone = phone.startsWith("54") ? phone : `549${phone}`;
    const msg = encodeURIComponent(
      `Hola ${alert.famNombre ?? "familia"}, le contactamos del CPI Norte, sala ECO ${alert.ecoNumber}. Notamos que ${alert.apellido} ${alert.nombre} lleva ${alert.consecutiveAbsences} día${alert.consecutiveAbsences !== 1 ? "s" : ""} sin asistir. ¿Podemos ponernos en contacto?`
    );
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }
  const urgency = alert.consecutiveAbsences >= 5 ? "border-red-500" : alert.consecutiveAbsences >= 3 ? "border-amber-500" : "border-yellow-400";
  return (
    <div className={`bg-card border-l-4 ${urgency} border border-border rounded-r-xl p-4 shadow-sm`} data-testid={`alert-card-${alert.childId}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-sm">{alert.apellido} {alert.nombre}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ECO {alert.ecoNumber} · {alert.famNombre} {alert.famApellido}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-sm font-semibold text-red-600">{alert.consecutiveAbsences} días consecutivos sin asistir</span>
          </div>
        </div>
        {alert.celular && waLink() && (
          <a
            href={waLink()!}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-green-700"
            data-testid={`link-wa-${alert.childId}`}
          >
            <Phone className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        )}
      </div>
      {alert.celular && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-900 leading-relaxed">
          Hola {alert.famNombre ?? "familia"}, le contactamos del CPI Norte, sala ECO {alert.ecoNumber}. Notamos que {alert.apellido} {alert.nombre} lleva {alert.consecutiveAbsences} días sin asistir. ¿Podemos ponernos en contacto?
        </div>
      )}
    </div>
  );
}

function ImportarCSVDialog({ rooms, onSuccess }: { rooms: RoomSummaryType[]; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const createChild = useCreateChild();

  const TEMPLATE_COLS = ["Apellido","Nombre","Sala ECO","DNI","Fecha Nac","Genero","Domicilio","Barrio","Localidad","Fam Apellido","Fam Nombre","Vinculo","Celular","Email"];

  function downloadTemplate() {
    const csv = [TEMPLATE_COLS.join(","), '"GARCIA","JUAN",0,"70000000","2022-03-15","FEMENINO","AV SIEMPREVIVA 742","FLORES","CABA","GARCIA","MARIA","MADRE/PADRE","1155551234",""'].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "plantilla-nomina.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const [header, ...dataLines] = lines;
    const cols = header.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    return dataLines.map(line => {
      const vals = line.match(/("(?:[^"]|"")*"|[^,]*)/g) ?? [];
      const obj: Record<string, string> = {};
      cols.forEach((c, i) => { obj[c] = (vals[i] ?? "").trim().replace(/^"|"$/g, "").replace(/""/g, '"'); });
      return obj;
    }).filter(r => r["Apellido"] || r["Nombre"]);
  }

  // Mapeo de columnas del Excel de focalización al formato interno
  function mapExcelRow(r: Record<string, unknown>): Record<string, string> {
    function str(v: unknown): string {
      if (v == null) return "";
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v).trim();
    }
    return {
      "Apellido": str(r["Apellidos"]),
      "Nombre": str(r["Nombres"]),
      "Sala ECO": str(r["Sala"]),
      "DNI": str(r["Número Doc"]),
      "Fecha Nac": str(r["F.Nacimiento"]).slice(0, 10),
      "Genero": str(r["Género"]).toUpperCase(),
      "Domicilio": str(r["Domicilio"]),
      "Barrio": str(r["Barrio"]),
      "Localidad": str(r["Localidad"]),
      "Fam Apellido": str(r["Ad.Apellidos"]),
      "Fam Nombre": str(r["Ad.Nombres"]),
      "Vinculo": str(r["Vínculo c/niñx"]),
      "Celular": str(r["Teléfonos"]),
      "Email": str(r["Email"]),
      "Registro": str(r["Nro.Registro"]),
    };
  }

  async function parseExcel(file: File): Promise<Record<string, string>[]> {
    // Cargar xlsx desde CDN sin necesidad de instalación
    if (!(window as any).XLSX) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("No se pudo cargar xlsx"));
        document.head.appendChild(s);
      });
    }
    const XLSX = (window as any).XLSX;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    // Buscar hoja "Sistema" primero, sino la primera
    const sheetName = wb.SheetNames.includes("Sistema") ? "Sistema" : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
    // Detectar si es el formato de focalización (tiene "Apellidos") o plantilla propia (tiene "Apellido")
    if (raw.length > 0 && "Apellidos" in raw[0]) {
      return raw.map(mapExcelRow).filter(r => r["Apellido"]);
    }
    // Formato propio — columnas iguales al CSV
    return raw.map(r => {
      const obj: Record<string, string> = {};
      Object.entries(r).forEach(([k, v]) => {
        obj[k] = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").trim();
      });
      return obj;
    }).filter(r => r["Apellido"] || r["Nombre"]);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      try {
        const parsed = await parseExcel(file);
        setRows(parsed);
      } catch {
        toast({ title: "Error al leer el Excel", variant: "destructive" });
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setRows(parseCSV(text));
      };
      reader.readAsText(file, "utf-8");
    }
  }

  async function handleImport() {
    if (!rows.length) return;
    setImporting(true);
    setProgress(0);
    let ok = 0; let err = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const eco = parseInt(r["Sala ECO"] ?? "0");
      const room = rooms.find(rm => rm.ecoNumber === eco);
      if (!room) { err++; setProgress(i + 1); continue; }
      try {
        await new Promise<void>((resolve, reject) => {
          createChild.mutate(
            { data: {
              roomId: room.id,
              apellido: r["Apellido"] ?? "",
              nombre: r["Nombre"] ?? "",
              dni: r["DNI"] || undefined,
              fnac: r["Fecha Nac"] || undefined,
              genero: r["Genero"] || undefined,
              domicilio: r["Domicilio"] || undefined,
              barrio: r["Barrio"] || undefined,
              localidad: r["Localidad"] || undefined,
              famApellido: r["Fam Apellido"] || undefined,
              famNombre: r["Fam Nombre"] || undefined,
              vinculo: r["Vinculo"] || undefined,
              celular: r["Celular"] || undefined,
              email: r["Email"] || undefined,
            }},
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
        ok++;
      } catch { err++; }
      setProgress(i + 1);
    }
    setImporting(false);
    toast({ title: "Importación completada", description: `${ok} altas registradas${err ? `, ${err} errores` : ""}` });
    setRows([]);
    setOpen(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors" data-testid="btn-importar-csv">
          <Upload className="w-3.5 h-3.5" />
          Importar nómina
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar nómina</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="text-sm text-muted-foreground">
            Aceptamos <span className="font-medium">Excel de focalización (.xlsx)</span> o CSV con columnas: Apellido, Nombre, Sala ECO, DNI, Fecha Nac, etc.
          </div>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-primary underline hover:no-underline">
            <Download className="w-3.5 h-3.5" />
            Descargar plantilla CSV
          </button>
          <div>
            <Label className="text-xs">Seleccionar archivo (.xlsx o .csv)</Label>
            <Input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleFile} className="mt-1 text-xs" />
          </div>
          {rows.length > 0 && (
            <div className="bg-muted rounded-lg px-3 py-2 text-sm">
              <span className="font-semibold">{rows.length}</span> {rows.length === 1 ? "fila detectada" : "filas detectadas"} para importar
              {importing && <div className="text-xs text-muted-foreground mt-1">Procesando {progress} / {rows.length}...</div>}
            </div>
          )}
          <Button onClick={handleImport} disabled={!rows.length || importing} className="w-full">
            {importing ? `Importando ${progress}/${rows.length}...` : `Importar ${rows.length ? rows.length + " registros" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SUPABASE_URL = "https://idsqnnyyoybknwqugspv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkc3Fubnl5b3lia253cXVnc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzk2ODYsImV4cCI6MjA5NDk1NTY4Nn0.HRSQQwryyi7i_1TMUVKNUT4AzzGu6CJd_iHuI79qHE0";

async function uploadVacunas(childId: number, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${childId}/carnet.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/vacunas/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) return null;
  return `${SUPABASE_URL}/storage/v1/object/vacunas/${path}`;
}

function NuevaAltaDialog({ onSuccess, onOpenDocs }: { onSuccess: () => void; onOpenDocs: (childId: number) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [apellido, setApellido] = useState("");
  const [nombre, setNombre] = useState("");
  const [sala, setSala] = useState("1");
  const [legajo, setLegajo] = useState("");
  const [dni, setDni] = useState("");
  const [fnac, setFnac] = useState("");
  const [genero, setGenero] = useState("FEMENINO");
  const [domicilio, setDomicilio] = useState("");
  const [famApellido, setFamApellido] = useState("");
  const [famNombre, setFamNombre] = useState("");
  const [vinculo, setVinculo] = useState("MADRE/PADRE");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [vacunasFile, setVacunasFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createdChild, setCreatedChild] = useState<{ id: number; nombre: string; apellido: string } | null>(null);
  const [panialesAuth, setPanialesAuth] = useState(false);
  const [aptoFisico, setAptoFisico] = useState(false);
  const [autRetiro, setAutRetiro] = useState(false);
  const [autLlamada, setAutLlamada] = useState(false);
  const [autFotos, setAutFotos] = useState(false);
  const createChild = useCreateChild();

  function resetForm() {
    setApellido(""); setNombre(""); setLegajo(""); setDni(""); setFnac(""); setDomicilio("");
    setFamApellido(""); setFamNombre(""); setCelular(""); setEmail(""); setObs("");
    setVacunasFile(null); setCreatedChild(null);
    setPanialesAuth(false); setAptoFisico(false); setAutRetiro(false); setAutLlamada(false); setAutFotos(false);
  }

  async function handleSubmit() {
    if (!apellido) return;
    setUploading(true);
    try {
      const payload = {
        roomId: parseInt(sala),
        apellido, nombre: nombre || "",
        dni: dni || undefined, fnac: fnac || undefined,
        genero: genero || undefined, domicilio: domicilio || undefined,
        famApellido: famApellido || undefined, famNombre: famNombre || undefined,
        vinculo: vinculo || undefined, celular: celular || undefined,
        email: email || undefined, obs: obs || undefined,
        registro: legajo || undefined,
        panialesAuth, aptoFisico, autRetiro, autLlamada, autFotos,
      };
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const child = await res.json();
      if (vacunasFile && child?.id) {
        const url = await uploadVacunas(child.id, vacunasFile);
        if (url) {
          await fetch(`/api/children/${child.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vacunasUrl: url }),
          });
        }
      }
      setUploading(false);
      setCreatedChild({ id: child.id, nombre: child.nombre, apellido: child.apellido });
      onSuccess();
    } catch (err: any) {
      setUploading(false);
      toast({ title: `Error al registrar alta: ${err?.message ?? "desconocido"}`, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center gap-1.5" data-testid="btn-nueva-alta">
          <Plus className="w-4 h-4" />
          Nueva alta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alta de nuevo niño/a</DialogTitle>
        </DialogHeader>

        {/* SUCCESS STATE */}
        {createdChild ? (
          <div className="space-y-4 mt-2">
            <div className="flex flex-col items-center gap-2 py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-bold text-base">{createdChild.apellido}, {createdChild.nombre}</p>
              <p className="text-sm text-muted-foreground">Alta registrada correctamente</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">¿Qué querés hacer ahora?</p>
              <Button className="w-full" onClick={() => { setOpen(false); onOpenDocs(createdChild.id); resetForm(); }}>
                Cargar documentos del legajo
              </Button>
              <Button variant="outline" className="w-full" onClick={() => resetForm()}>
                Agregar otro niño/a
              </Button>
              <button className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => { setOpen(false); resetForm(); }}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (

        <div className="space-y-3 mt-2">
          {/* Legajo + Apellido + Nombre */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs">Nro. Legajo</Label><Input value={legajo} onChange={(e) => setLegajo(e.target.value)} className="mt-1" placeholder="001" data-testid="input-alta-legajo" /></div>
            <div><Label className="text-xs">Apellido</Label><Input value={apellido} onChange={(e) => setApellido(e.target.value)} className="mt-1" placeholder="GARCÍA" data-testid="input-alta-apellido" /></div>
            <div><Label className="text-xs">Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1" placeholder="JUAN" data-testid="input-alta-nombre" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sala (ECO)</Label>
              <Select value={sala} onValueChange={setSala}>
                <SelectTrigger className="mt-1" data-testid="select-alta-sala"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4].map((id, i) => <SelectItem key={id} value={String(id)}>ECO {i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">DNI</Label><Input value={dni} onChange={(e) => setDni(e.target.value)} className="mt-1" placeholder="70000000" data-testid="input-alta-dni" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Fecha de nacimiento</Label><Input type="date" value={fnac} onChange={(e) => setFnac(e.target.value)} className="mt-1" data-testid="input-alta-fnac" /></div>
            <div>
              <Label className="text-xs">Género</Label>
              <Select value={genero} onValueChange={setGenero}>
                <SelectTrigger className="mt-1" data-testid="select-alta-genero"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEMENINO">FEMENINO</SelectItem>
                  <SelectItem value="MASCULINO">MASCULINO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Domicilio</Label><Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="mt-1" placeholder="Calle 123" data-testid="input-alta-domicilio" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Apellido familiar</Label><Input value={famApellido} onChange={(e) => setFamApellido(e.target.value)} className="mt-1" data-testid="input-alta-fam-apellido" /></div>
            <div><Label className="text-xs">Nombre familiar</Label><Input value={famNombre} onChange={(e) => setFamNombre(e.target.value)} className="mt-1" data-testid="input-alta-fam-nombre" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Vínculo</Label>
              <Select value={vinculo} onValueChange={setVinculo}>
                <SelectTrigger className="mt-1" data-testid="select-alta-vinculo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MADRE/PADRE","ABUELA/O","TÍA/O","HERMANA/O MAYOR","OTRO"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Teléfono</Label><Input value={celular} onChange={(e) => setCelular(e.target.value)} className="mt-1" placeholder="11 5555-1234" data-testid="input-alta-celular" /></div>
          </div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" data-testid="input-alta-email" /></div>
          <div><Label className="text-xs">Observaciones</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1" data-testid="textarea-alta-obs" /></div>
          <div>
            <Label className="text-xs">Autorizaciones firmadas en la inscripción</Label>
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: "apto", label: "Apto físico", checked: aptoFisico, set: setAptoFisico },
                { key: "retiro", label: "Autorización de retiro", checked: autRetiro, set: setAutRetiro },
                { key: "llamada", label: "Autorización de llamada", checked: autLlamada, set: setAutLlamada },
                { key: "fotos", label: "Autorización de toma de fotos", checked: autFotos, set: setAutFotos },
                { key: "paniales", label: "Pañales (autorización)", checked: panialesAuth, set: setPanialesAuth },
              ].map(({ key, label, checked, set }) => (
                <label key={key} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-sm cursor-pointer hover:bg-muted/60 transition-colors" data-testid={`check-alta-${key}`}>
                  <Checkbox checked={checked} onCheckedChange={(v) => set(!!v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Carnet de vacunas (imagen o PDF)</Label>
            <div className="mt-1 flex items-center gap-2">
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground cursor-pointer hover:bg-muted/60 transition-colors">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{vacunasFile ? vacunasFile.name : "Seleccionar archivo..."}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setVacunasFile(e.target.files?.[0] ?? null)} data-testid="input-alta-vacunas" />
              </label>
              {vacunasFile && (
                <button onClick={() => setVacunasFile(null)} className="text-muted-foreground hover:text-red-500 p-1">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Opcional — se puede cargar después desde la ficha del niño/a</p>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!apellido || createChild.isPending || uploading} data-testid="btn-confirmar-alta">
            {uploading ? "Subiendo carnet..." : createChild.isPending ? "Registrando..." : "Registrar alta"}
          </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoomAttendanceDialog({ room, onOpenChild }: { room: RoomSummary; onOpenChild: (id: number) => void }) {
  const [open, setOpen] = useState(false);

  const children = useListChildren(
    { roomId: room.id, active: true },
    { query: { enabled: open, queryKey: getListChildrenQueryKey({ roomId: room.id, active: true }) } }
  );
  const att = useListAttendance(
    { roomId: room.id, date: TODAY },
    { query: { enabled: open, queryKey: getListAttendanceQueryKey({ roomId: room.id, date: TODAY }) } }
  );

  const attMap = useMemo(() => {
    const m: Record<number, AttendanceRecord> = {};
    (att.data ?? []).forEach((a) => { m[a.childId] = a; });
    return m;
  }, [att.data]);

  const sorted = useMemo(() => {
    return [...(children.data ?? [])].sort((a, b) => a.apellido.localeCompare(b.apellido));
  }, [children.data]);

  const stats = useMemo(() => {
    let p = 0, a = 0, m = 0, sm = 0;
    sorted.forEach((c) => {
      const rec = attMap[c.id];
      if (!rec) { sm++; return; }
      if (rec.estado === "P") p++;
      else if (rec.estado === "A") a++;
      if (rec.mercaderia) m++;
    });
    return { p, a, m, sm };
  }, [sorted, attMap]);

  const c = ECO_COLORS[room.ecoNumber] ?? ECO_COLORS[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-7 px-3 text-xs font-semibold" data-testid={`btn-ver-lista-${room.id}`}>
          <Users className="w-3.5 h-3.5 mr-1" />
          Ver lista
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`font-bold ${c.text}`}>{room.name}</span>
            <span className="text-sm text-muted-foreground font-normal">— Asistencia de hoy</span>
          </DialogTitle>
        </DialogHeader>

        {/* Summary chips */}
        <div className="flex gap-2 flex-wrap py-1">
          <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold">{stats.p} Presentes</span>
          <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">{stats.a} Ausentes</span>
          {stats.m > 0 && <span className="px-2.5 py-1 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold">{stats.m} Mercadería</span>}
          {stats.sm > 0 && <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-bold">{stats.sm} Sin marcar</span>}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {(children.isPending || att.isPending) && (
            <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
          )}
          {!(children.isPending || att.isPending) && sorted.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin alumnos en esta sala</div>
          )}
          {sorted.map((child, i) => {
            const rec = attMap[child.id];
            const estado = rec?.estado;
            const merc = rec?.mercaderia;
            return (
              <div
                key={child.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                onClick={() => { setOpen(false); onOpenChild(child.id); }}
              >
                <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{child.apellido} {child.nombre}</div>
                  {child.famNombre && <div className="text-xs text-muted-foreground truncate">{child.famNombre} · {child.celular ?? "sin tel."}</div>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {merc && (
                    <span className="w-5 h-5 rounded flex items-center justify-center bg-yellow-300 text-yellow-800 text-[10px] font-bold border border-yellow-400">M</span>
                  )}
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${
                    estado === "P" ? "bg-green-100 text-green-700 border-green-300" :
                    estado === "A" ? "bg-red-100 text-red-700 border-red-300" :
                    "bg-muted text-muted-foreground border-border"
                  }`}>
                    {estado ?? "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const QR_BASE = "https://pulsodeasistencias.vercel.app";

function QrDialogButton({ room, allRooms }: { room: RoomSummary; allRooms: Room[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const roomData = allRooms.find((r) => r.id === room.id) as (Room & { checkInToken?: string }) | undefined;
  const token = roomData?.checkInToken;
  const checkInUrl = token ? `${QR_BASE}/check-in/${token}` : null;
  const qrSrc = checkInUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(checkInUrl)}&size=220x220&format=png`
    : null;

  function copyLink() {
    if (!checkInUrl) return;
    navigator.clipboard.writeText(checkInUrl);
    toast({ title: "Enlace copiado", description: "El enlace de check-in fue copiado al portapapeles." });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="text-violet-600 hover:text-violet-800 p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          title="Ver QR de check-in"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR de check-in — {room.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrSrc ? (
            <>
              <img src={qrSrc} alt="QR code" className="rounded-xl border border-border shadow-sm" width={220} height={220} />
              <p className="text-xs text-muted-foreground text-center break-all px-2">{checkInUrl}</p>
              <Button size="sm" variant="outline" onClick={copyLink} className="w-full">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar enlace
              </Button>
              <p className="text-xs text-muted-foreground text-center px-2 leading-relaxed">
                Imprimí este QR y pegalo en la entrada. Los padres lo escanean para marcar la llegada de sus hijos.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Esta sala aún no tiene token. Recargá la página para generarlo automáticamente.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { logout, centerId: authCenterId, role } = useAuth();
  const isSuperAdmin = role === "superadmin";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [nominaTab, setNominaTab] = useState<"activos" | "revision" | "alerta" | "bajas">("activos");
  const [nominaRoomId, setNominaRoomId] = useState<number | null>(null);
  const [nominaVacunas, setNominaVacunas] = useState<"todos" | "con" | "sin">("todos");
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Super admin ve todos los centros; admin de centro solo ve el suyo
  const [activeCenterId, setActiveCenterId] = useState<number | null>(authCenterId);
  const [showCenterMgmt, setShowCenterMgmt] = useState(false);
  const [newCenterName, setNewCenterName] = useState("");
  const [newRoomCenterId, setNewRoomCenterId] = useState<number | "">("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomEco, setNewRoomEco] = useState("");
  const [newRoomCap, setNewRoomCap] = useState("");

  const MES_HIST_INIT = TODAY.slice(0, 7);
  const ANO_HIST_INIT = TODAY.slice(0, 4);

  const [histSubview, setHistSubview] = useState<"mensual" | "anual" | "ninos">("mensual");
  const [histRoomId, setHistRoomId] = useState<number | null>(null);
  const [histMonth, setHistMonth] = useState(MES_HIST_INIT);
  const [histYear, setHistYear] = useState(ANO_HIST_INIT);

  const centerParam = activeCenterId != null ? { centerId: activeCenterId } : {};

  const centers = useListCenters();
  const allRooms = useListRooms(centerParam);
  const createCenter = useCreateCenter();
  const updateCenter = useUpdateCenter();
  const createRoom = useCreateRoom();
  const deleteRoom = useDeleteRoom();
  const [editingPasscodeId, setEditingPasscodeId] = useState<number | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");

  const dashboard = useGetDashboardSummary(centerParam);
  const alerts = useGetAlerts(centerParam);
  const recentContacts = useGetRecentContacts();
  const roomSummary = useGetRoomsSummary(centerParam);
  const allChildren = useListChildren({ ...centerParam, active: true });
  const dischargedChildren = useListChildren({ ...centerParam, active: false });
  const todayAttendance = useListAttendance({ date: TODAY });
  const updateRoom = useUpdateRoom();
  const deleteChild = useDeleteChild();
  const updateChild = useUpdateChild();

  const histMonthParams = histRoomId != null ? { roomId: histRoomId, month: histMonth } : { month: histMonth };
  const histYearParams = histRoomId != null ? { roomId: histRoomId, year: histYear } : { year: histYear };

  const histMonthAtt = useListAttendance(
    histMonthParams,
    { query: { queryKey: getListAttendanceQueryKey(histMonthParams), enabled: histSubview === "mensual" || histSubview === "ninos" } }
  );

  const histYearAtt = useListAttendance(
    histYearParams,
    { query: { queryKey: getListAttendanceQueryKey(histYearParams), enabled: histSubview === "anual" } }
  );

  function exportCSV(data: Child[], filename: string) {
    const cols = ["Apellido", "Nombre", "DNI", "Sala ECO", "Fecha Nac.", "Genero", "Domicilio", "Barrio", "Localidad", "Fam. Apellido", "Fam. Nombre", "Vinculo", "Celular", "Email", "Estado", "Asistencia"];
    const rows = data.map((c: Child) => [
      c.apellido, c.nombre, c.dni ?? "", c.ecoNumber ?? "", c.fnac ?? "",
      c.genero ?? "", c.domicilio ?? "", c.barrio ?? "", c.localidad ?? "",
      c.famApellido ?? "", c.famNombre ?? "", c.vinculo ?? "",
      c.celular ?? "", c.email ?? "", c.estado ?? "", c.estAsist ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentContactsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey({ active: true }) });
    queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey({ active: false }) });
    queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCentersQueryKey() });
  }

  function handleCreateCenter() {
    const name = newCenterName.trim();
    if (!name) return;
    createCenter.mutate({ data: { name } }, {
      onSuccess: () => {
        toast({ title: "Centro creado" });
        setNewCenterName("");
        queryClient.invalidateQueries({ queryKey: getListCentersQueryKey() });
      },
      onError: () => toast({ title: "Error al crear centro", variant: "destructive" }),
    });
  }

  function handleCreateRoom() {
    const cid = typeof newRoomCenterId === "number" ? newRoomCenterId : parseInt(String(newRoomCenterId));
    const eco = parseInt(newRoomEco);
    const cap = parseInt(newRoomCap);
    const name = newRoomName.trim();
    if (!cid || isNaN(eco) || !name || isNaN(cap)) return;
    createRoom.mutate({ data: { centerId: cid, ecoNumber: eco, name, capacity: cap } }, {
      onSuccess: () => {
        toast({ title: "Sala creada" });
        setNewRoomName(""); setNewRoomEco(""); setNewRoomCap("");
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
      },
      onError: () => toast({ title: "Error al crear sala", variant: "destructive" }),
    });
  }

  function handleDeleteRoom(roomId: number) {
    deleteRoom.mutate({ roomId }, {
      onSuccess: () => {
        toast({ title: "Sala eliminada" });
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
      },
      onError: (e: any) => toast({ title: e?.response?.data?.error ?? "Error al eliminar sala", variant: "destructive" }),
    });
  }

  function saveRoomName(roomId: number) {
    const name = editRoomName.trim();
    if (!name) return;
    updateRoom.mutate(
      { roomId, data: { name } },
      {
        onSuccess: () => {
          setEditingRoomId(null);
          queryClient.invalidateQueries({ queryKey: getGetRoomsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        },
      }
    );
  }

  function handleDeleteChild(id: number) {
    deleteChild.mutate({ id }, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        invalidateAll();
      },
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await new Promise<void>((resolve) => {
        deleteChild.mutate({ id }, { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setBulkDeleteMode(false);
    setConfirmBulkDelete(false);
    invalidateAll();
    toast({ title: `${ids.length} alumno${ids.length !== 1 ? "s" : ""} eliminado${ids.length !== 1 ? "s" : ""}` });
  }

  const absentsByRoom = useMemo(() => {
    const attMap: Record<number, string> = {};
    (todayAttendance.data ?? []).forEach((a) => { attMap[a.childId] = a.estado ?? ""; });
    const absents = (allChildren.data ?? []).filter((c: Child) => attMap[c.id] === "A");
    const grouped: Record<number, Child[]> = {};
    absents.forEach((c: Child) => {
      const eco = c.ecoNumber ?? 0;
      if (!grouped[eco]) grouped[eco] = [];
      grouped[eco].push(c);
    });
    return grouped;
  }, [todayAttendance.data, allChildren.data]);

  function applyVacunasFilter(list: Child[]) {
    if (nominaVacunas === "con") return list.filter((c) => !!(c as any).carnetVacunas);
    if (nominaVacunas === "sin") return list.filter((c) => !(c as any).carnetVacunas);
    return list;
  }

  const filteredActive = useMemo(() => {
    const q = search.toLowerCase();
    const SPECIAL = ["EN REVISION", "ALERTA"];
    const base = (allChildren.data ?? []).filter(
      (c: Child) => !SPECIAL.includes((c as any).estado ?? "") && (c.apellido.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q))
    );
    const byRoom = nominaRoomId != null ? base.filter((c: Child) => c.roomId === nominaRoomId) : base;
    return applyVacunasFilter(byRoom);
  }, [allChildren.data, search, nominaRoomId, nominaVacunas]);

  const filteredRevision = useMemo(() => {
    const q = search.toLowerCase();
    const base = (allChildren.data ?? []).filter(
      (c: Child) => (c as any).estado === "EN REVISION" && (c.apellido.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q))
    );
    const byRoom = nominaRoomId != null ? base.filter((c: Child) => c.roomId === nominaRoomId) : base;
    return applyVacunasFilter(byRoom);
  }, [allChildren.data, search, nominaRoomId, nominaVacunas]);

  const filteredAlerta = useMemo(() => {
    const q = search.toLowerCase();
    const base = (allChildren.data ?? []).filter(
      (c: Child) => (c as any).estado === "ALERTA" && (c.apellido.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q))
    );
    const byRoom = nominaRoomId != null ? base.filter((c: Child) => c.roomId === nominaRoomId) : base;
    return applyVacunasFilter(byRoom);
  }, [allChildren.data, search, nominaRoomId, nominaVacunas]);

  const filteredBajas = useMemo(() => {
    const q = search.toLowerCase();
    const base = (dischargedChildren.data ?? []).filter(
      (c: Child) => c.apellido.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    );
    return nominaRoomId != null ? base.filter((c: Child) => c.roomId === nominaRoomId) : base;
  }, [dischargedChildren.data, search, nominaRoomId]);

  const alertCount = alerts.data?.length ?? 0;

  // Historial mensual: agregación por día
  const histMonthDailyStats = useMemo(() => {
    const byDate: Record<string, { p: number; a: number }> = {};
    (histMonthAtt.data ?? []).forEach((r: AttendanceRecord) => {
      if (!byDate[r.fecha]) byDate[r.fecha] = { p: 0, a: 0 };
      if (r.estado === "P") byDate[r.fecha].p++;
      else if (r.estado === "A") byDate[r.fecha].a++;
    });
    return byDate;
  }, [histMonthAtt.data]);

  // Historial anual: agregación por mes
  const histYearMonthlyStats = useMemo(() => {
    const byMonth: Record<string, { p: number; a: number }> = {};
    (histYearAtt.data ?? []).forEach((r: AttendanceRecord) => {
      const mo = r.fecha.slice(0, 7);
      if (!byMonth[mo]) byMonth[mo] = { p: 0, a: 0 };
      if (r.estado === "P") byMonth[mo].p++;
      else if (r.estado === "A") byMonth[mo].a++;
    });
    return byMonth;
  }, [histYearAtt.data]);

  const histYearMax = useMemo(() => {
    const vals = Object.values(histYearMonthlyStats).map((s) => s.p + s.a);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [histYearMonthlyStats]);

  const childMonthlyStats = useMemo(() => {
    const byChild: Record<number, { p: number; a: number }> = {};
    (histMonthAtt.data ?? []).forEach((r: AttendanceRecord) => {
      if (!byChild[r.childId]) byChild[r.childId] = { p: 0, a: 0 };
      if (r.estado === "P") byChild[r.childId].p++;
      else if (r.estado === "A") byChild[r.childId].a++;
    });
    return byChild;
  }, [histMonthAtt.data]);

  const roomMonthlyStats = useMemo(() => {
    const childRoomMap: Record<number, { roomId: number; ecoNumber: number; roomName: string }> = {};
    (allChildren.data ?? []).forEach((c: Child) => {
      if (c.roomId) childRoomMap[c.id] = { roomId: c.roomId, ecoNumber: c.ecoNumber ?? 0, roomName: "" };
    });
    (roomSummary.data ?? []).forEach((r: RoomSummary) => {
      Object.values(childRoomMap).forEach((entry) => { if (entry.ecoNumber === r.ecoNumber) entry.roomName = r.name; });
    });
    const byRoom: Record<number, { name: string; ecoNumber: number; p: number; a: number }> = {};
    Object.entries(childMonthlyStats).forEach(([cid, stats]) => {
      const info = childRoomMap[Number(cid)];
      if (!info) return;
      if (!byRoom[info.roomId]) byRoom[info.roomId] = { name: info.roomName, ecoNumber: info.ecoNumber, p: 0, a: 0 };
      byRoom[info.roomId].p += stats.p;
      byRoom[info.roomId].a += stats.a;
    });
    return byRoom;
  }, [childMonthlyStats, allChildren.data, roomSummary.data]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar */}
      <header className="bg-card border-b border-border sticky top-0 z-50 flex flex-col z-50">
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(28,110,68,0.2)]" />
            <span className="font-bold text-sm">Sistema CPI</span>
            <Badge variant="secondary" className="text-xs font-semibold">Coordinación</Badge>
          </div>
          <div className="flex items-center gap-1">
            {isSuperAdmin && (
              <Button
                variant="ghost" size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setLocation("/sala")}
                data-testid="button-go-sala"
              >
                Tomar asistencia
              </Button>
            )}
            <Button
              variant="ghost" size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => { logout(); setLocation("/login"); }}
              data-testid="button-logout-admin"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Salir
            </Button>
          </div>
        </div>
        {/* Centro selector bar — solo visible para superadmin */}
        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 px-4 pb-1 overflow-x-auto">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider shrink-0 mr-1">Centro:</span>
            <button
              onClick={() => setActiveCenterId(null)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${activeCenterId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
              data-testid="btn-center-all"
            >
              Todos
            </button>
            {(centers.data ?? []).map((c: Center) => (
              <button
                key={c.id}
                onClick={() => setActiveCenterId(c.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${activeCenterId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                data-testid={`btn-center-filter-${c.id}`}
              >
                {c.name}
              </button>
            ))}
            <button
              onClick={() => setShowCenterMgmt(!showCenterMgmt)}
              className={`ml-1 px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${showCenterMgmt ? "bg-primary/10 border-primary/30 text-primary" : "border-dashed border-border text-muted-foreground hover:border-primary/50"}`}
              data-testid="btn-toggle-center-mgmt"
            >
              Gestionar
            </button>
          </div>
        )}
      </header>

      {/* Panel gestión centros/salas */}
      {showCenterMgmt && (
        <div className="bg-muted/50 border-b border-border px-4 py-4 space-y-5">
          {/* Crear centro */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nuevo centro</p>
            <div className="flex gap-2">
              <Input placeholder="Nombre del centro" value={newCenterName} onChange={(e) => setNewCenterName(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleCreateCenter()} data-testid="input-new-center-admin" />
              <Button size="sm" onClick={handleCreateCenter} disabled={!newCenterName.trim() || createCenter.isPending} data-testid="btn-create-center-admin">
                <Plus className="w-3.5 h-3.5 mr-1" />Crear
              </Button>
            </div>
          </div>
          {/* Lista de centros */}
          {(centers.data ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Centros registrados</p>
              <div className="space-y-1.5">
                {(centers.data ?? []).map((c: Center) => (
                  <div key={c.id} className="bg-card rounded-lg border border-border">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-semibold flex-1">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {(allRooms.data ?? []).filter((r: Room) => r.centerId === c.id).length} sala(s)
                      </span>
                      <button
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border hover:border-foreground/30"
                        onClick={() => { setEditingPasscodeId(editingPasscodeId === c.id ? null : c.id); setPasscodeInput(""); }}
                      >
                        {c.hasPasscode ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
                        {c.hasPasscode ? "Cambiar código" : "Agregar código"}
                      </button>
                    </div>
                    {editingPasscodeId === c.id && (
                      <div className="px-3 pb-2 flex gap-2">
                        <Input
                          className="h-7 text-sm"
                          placeholder={c.hasPasscode ? "Nuevo código (vacío para quitar)" : "Código de acceso"}
                          value={passcodeInput}
                          onChange={(e) => setPasscodeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateCenter.mutate(
                                { centerId: c.id, data: { name: c.name, passcode: passcodeInput.trim() || null } },
                                { onSuccess: () => { setEditingPasscodeId(null); centers.refetch(); } }
                              );
                            }
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => updateCenter.mutate(
                            { centerId: c.id, data: { name: c.name, passcode: passcodeInput.trim() || null } },
                            { onSuccess: () => { setEditingPasscodeId(null); centers.refetch(); } }
                          )}
                          disabled={updateCenter.isPending}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingPasscodeId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Crear sala */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Nueva sala</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select value={String(newRoomCenterId)} onValueChange={(v) => setNewRoomCenterId(Number(v))}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-new-room-center"><SelectValue placeholder="Centro" /></SelectTrigger>
                <SelectContent>
                  {(centers.data ?? []).map((c: Center) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Nombre (ej: Sala ECO 0)" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} className="h-8 text-sm" data-testid="input-new-room-name" />
              <Input placeholder="N° ECO (0,1,2...)" type="number" value={newRoomEco} onChange={(e) => setNewRoomEco(e.target.value)} className="h-8 text-sm" data-testid="input-new-room-eco" />
              <Input placeholder="Capacidad" type="number" value={newRoomCap} onChange={(e) => setNewRoomCap(e.target.value)} className="h-8 text-sm" data-testid="input-new-room-cap" />
            </div>
            <Button size="sm" className="mt-2 w-full" onClick={handleCreateRoom} disabled={!newRoomCenterId || !newRoomName || !newRoomEco || !newRoomCap || createRoom.isPending} data-testid="btn-create-room-admin">
              <Plus className="w-3.5 h-3.5 mr-1" />Crear sala
            </Button>
          </div>
          {/* Salas existentes con delete */}
          {(allRooms.data ?? []).length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Salas existentes</p>
              <div className="space-y-1">
                {(allRooms.data ?? []).map((r: Room) => {
                  const cName = (centers.data ?? []).find((c: Center) => c.id === r.centerId)?.name ?? "";
                  return (
                    <div key={r.id} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border border-border">
                      <span className="text-xs text-muted-foreground min-w-[80px]">{cName}</span>
                      <span className="text-sm flex-1 font-medium">{r.name}</span>
                      <span className="text-[11px] text-muted-foreground">Cap. {r.capacity}</span>
                      <button onClick={() => handleDeleteRoom(r.id)} className="text-red-500 hover:text-red-700 p-1 rounded" data-testid={`btn-delete-room-${r.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 pt-4 pb-10">
        <Tabs defaultValue="tablero">
          <TabsList className="w-full mb-4 overflow-x-auto flex-nowrap whitespace-nowrap" data-testid="tabs-admin">
            <TabsTrigger value="tablero" className="flex-1 text-xs" data-testid="tab-tablero">Tablero</TabsTrigger>
            <TabsTrigger value="alertas" className="flex-1 text-xs relative" data-testid="tab-alertas">
              Alertas
              {alertCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{alertCount}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="nomina" className="flex-1 text-xs" data-testid="tab-nomina">Nómina</TabsTrigger>
            <TabsTrigger value="asistencia" className="flex-1 text-xs" data-testid="tab-asistencia">Asistencia</TabsTrigger>
            <TabsTrigger value="vacantes" className="flex-1 text-xs" data-testid="tab-vacantes">Vacantes</TabsTrigger>
            <TabsTrigger value="egresos" className="flex-1 text-xs" data-testid="tab-egresos">Egresos</TabsTrigger>
            <TabsTrigger value="historial" className="flex-1 text-xs" data-testid="tab-historial">Historial</TabsTrigger>
          </TabsList>

          {/* TABLERO */}
          <TabsContent value="tablero">
            {dashboard.data && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4" data-testid="dashboard-stats">
                  <StatCard value={dashboard.data.totalActive} label="Activos" />
                  <StatCard value={dashboard.data.totalPresent} label="Presentes" color="text-green-600" />
                  <StatCard value={dashboard.data.totalAbsent} label="Ausentes" color="text-red-600" />
                  <StatCard value={`${dashboard.data.pctPresent}%`} label="Asistencia" color="text-primary" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  <StatCard value={dashboard.data.totalAlerts} label="Alertas" color="text-red-600" />
                  <StatCard value={dashboard.data.totalDischarge} label="Egresos" color="text-muted-foreground" />
                  <StatCard value={dashboard.data.totalCapacity} label="Capacidad total" />
                </div>
              </>
            )}
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Por sala — hoy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(roomSummary.data ?? []).map((r: RoomSummary) => (
                <RoomCard key={r.id} room={r} onNavigate={(roomId) => {
                  localStorage.setItem("superadmin_sala_roomId", String(roomId));
                  setLocation(`/sala?roomId=${roomId}`);
                }} />
              ))}
            </div>
            {/* Ausentes hoy */}
            {Object.keys(absentsByRoom).length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Ausentes hoy</h3>
                <div className="space-y-3">
                  {(roomSummary.data ?? []).map((r: RoomSummary) => {
                    const kids = absentsByRoom[r.ecoNumber] ?? [];
                    if (!kids.length) return null;
                    const c = ECO_COLORS[r.ecoNumber] ?? ECO_COLORS[0];
                    return (
                      <div key={r.id} className={`rounded-xl border border-border overflow-hidden shadow-sm ${c.bg}`}>
                        <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${c.text}`}>{r.name} — {kids.length} ausente{kids.length !== 1 ? "s" : ""}</div>
                        {kids.map((child: Child) => (
                          <div key={child.id} className="flex items-center gap-3 px-4 py-2 border-t border-border/50 bg-white/60 last:rounded-b-xl">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold">{child.apellido} {child.nombre}</span>
                              {child.celular && (
                                <span className="ml-2 text-xs text-muted-foreground">{child.celular}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent contacts */}
            {recentContacts.data && recentContacts.data.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Últimos contactos</h3>
                <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                  {recentContacts.data.map((c: Contact) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{c.childName}</div>
                        <div className="text-xs text-muted-foreground">{c.motivo} · {c.quien}</div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono shrink-0">{c.fecha}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ALERTAS */}
          <TabsContent value="alertas">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">Niños/as con ausencias consecutivas</h3>
              {alertCount > 0 && <Badge variant="destructive">{alertCount} activas</Badge>}
            </div>
            {alerts.isLoading && <div className="text-center py-10 text-muted-foreground text-sm">Cargando...</div>}
            {!alerts.isLoading && alertCount === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">Sin alertas activas</div>
            )}
            <div className="space-y-3">
              {(alerts.data ?? []).map((alert: Alert) => (
                <AlertCard key={alert.childId} alert={alert} />
              ))}
            </div>
          </TabsContent>

          {/* NÓMINA */}
          <TabsContent value="nomina">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setNominaTab("activos"); setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${nominaTab === "activos" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                  data-testid="btn-nomina-activos"
                >
                  Activos ({allChildren.data?.length ?? 0})
                </button>
                <button
                  onClick={() => { setNominaTab("revision"); setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${nominaTab === "revision" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}
                  data-testid="btn-nomina-revision"
                >
                  En revisión ({filteredRevision.length})
                </button>
                <button
                  onClick={() => { setNominaTab("alerta"); setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${nominaTab === "alerta" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"}`}
                  data-testid="btn-nomina-alerta"
                >
                  Alerta ({filteredAlerta.length})
                </button>
                <button
                  onClick={() => { setNominaTab("bajas"); setBulkDeleteMode(false); setSelectedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${nominaTab === "bajas" ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
                  data-testid="btn-nomina-bajas"
                >
                  Egresos ({dischargedChildren.data?.length ?? 0})
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!bulkDeleteMode ? (
                  <>
                    <button
                      onClick={() => exportCSV(allChildren.data ?? [], `nomina-activos-${TODAY}.csv`)}
                      disabled={!allChildren.data?.length}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      data-testid="btn-export-csv"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar CSV
                    </button>
                    <ImportarCSVDialog rooms={roomSummary.data ?? []} onSuccess={invalidateAll} />
                    <NuevaAltaDialog onSuccess={invalidateAll} onOpenDocs={(id) => setSelectedChild(id)} />
                    <button
                      onClick={() => { setBulkDeleteMode(true); setSelectedIds(new Set()); setConfirmBulkDelete(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                      data-testid="btn-bulk-delete-mode"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar varios
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
                    <button
                      onClick={() => {
                        const currentList = nominaTab === "activos" ? filteredActive : nominaTab === "revision" ? filteredRevision : nominaTab === "alerta" ? filteredAlerta : filteredBajas;
                        const allIds = new Set<number>(currentList.map((c: Child) => c.id));
                        setSelectedIds(selectedIds.size === allIds.size ? new Set() : allIds);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {selectedIds.size === (nominaTab === "activos" ? filteredActive : nominaTab === "revision" ? filteredRevision : nominaTab === "alerta" ? filteredAlerta : filteredBajas).length ? "Deseleccionar todo" : "Seleccionar todo"}
                    </button>
                    {selectedIds.size > 0 && !confirmBulkDelete && (
                      <button
                        onClick={() => setConfirmBulkDelete(true)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                        data-testid="btn-bulk-delete-confirm"
                      >
                        Eliminar {selectedIds.size}
                      </button>
                    )}
                    {confirmBulkDelete && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-600 font-semibold">¿Confirmar eliminación de {selectedIds.size}?</span>
                        <button
                          onClick={handleBulkDelete}
                          disabled={bulkDeleting}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                        >{bulkDeleting ? "Eliminando..." : "Sí, eliminar"}</button>
                        <button
                          onClick={() => setConfirmBulkDelete(false)}
                          className="px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80"
                        >Cancelar</button>
                      </div>
                    )}
                    <button
                      onClick={() => { setBulkDeleteMode(false); setSelectedIds(new Set()); setConfirmBulkDelete(false); }}
                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 mb-3 overflow-x-auto flex-nowrap">
              <button
                onClick={() => setNominaRoomId(null)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${nominaRoomId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                data-testid="btn-nomina-room-all"
              >
                Todas las salas ({(roomSummary.data ?? []).reduce((sum: number, r: RoomSummary) => sum + r.total, 0)})
              </button>
              {(roomSummary.data ?? []).map((r: RoomSummary) => (
                <button
                  key={r.id}
                  onClick={() => setNominaRoomId(r.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${nominaRoomId === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                  data-testid={`btn-nomina-room-${r.id}`}
                >
                  {r.name} ({r.total})
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mb-3 overflow-x-auto flex-nowrap">
              {([["todos", "Todos"], ["con", "Con carnet vacunas"], ["sin", "Sin carnet vacunas"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setNominaVacunas(val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 transition-all ${nominaVacunas === val ? "bg-green-600 text-white border-green-600" : "bg-background border-border text-muted-foreground hover:border-green-500/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-nomina-search" />
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              {(nominaTab === "activos" ? filteredActive : nominaTab === "revision" ? filteredRevision : nominaTab === "alerta" ? filteredAlerta : filteredBajas).map((child: Child) => (
                <div
                  key={child.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors ${bulkDeleteMode && selectedIds.has(child.id) ? "bg-red-50" : ""}`}
                  data-testid={`row-nomina-${child.id}`}
                  onClick={bulkDeleteMode ? () => setSelectedIds(prev => { const n = new Set(prev); n.has(child.id) ? n.delete(child.id) : n.add(child.id); return n; }) : undefined}
                >
                  {bulkDeleteMode ? (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selectedIds.has(child.id) ? "bg-red-600 border-red-600" : "border-border bg-background"}`}>
                      {selectedIds.has(child.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 cursor-pointer"
                      onClick={() => setSelectedChild(child.id)}
                    >
                      {child.apellido.slice(0, 1)}{child.nombre.slice(0, 1)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-semibold truncate ${!bulkDeleteMode ? "cursor-pointer" : ""}`}
                      onClick={!bulkDeleteMode ? () => setSelectedChild(child.id) : undefined}
                    >
                      {child.apellido} {child.nombre}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {child.registro && <span className="font-mono mr-1.5">#{child.registro}</span>}
                      {child.famNombre} · {child.celular ?? "sin tel."}
                    </div>
                    {!bulkDeleteMode && (
                      <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={String(child.roomId)}
                          className="text-[11px] border border-border rounded px-1.5 py-0.5 bg-background text-foreground focus:outline-none"
                          data-testid={`select-sala-${child.id}`}
                          onChange={(e) => {
                            updateChild.mutate(
                              { id: child.id, data: { roomId: parseInt(e.target.value) } },
                              { onSuccess: invalidateAll }
                            );
                          }}
                        >
                          {(allRooms.data ?? []).map((r: Room) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <select
                          value={(child as any).estado ?? "INSCRIPTX"}
                          className={`text-[11px] border rounded px-1.5 py-0.5 focus:outline-none ${(child as any).estado === "EN REVISION" ? "border-amber-400 bg-amber-50 text-amber-700" : (child as any).estado === "ALERTA" ? "border-red-400 bg-red-50 text-red-700" : "border-border bg-background text-foreground"}`}
                          data-testid={`select-estado-${child.id}`}
                          onChange={(e) => {
                            const nuevoEstado = e.target.value;
                            const labels: Record<string, string> = { "INSCRIPTX": "Activo", "EN REVISION": "En revisión", "ALERTA": "Alerta" };
                            updateChild.mutate(
                              { id: child.id, data: { estado: nuevoEstado } as any },
                              { onSuccess: () => {
                                toast({ title: `${child.apellido} ${child.nombre} → ${labels[nuevoEstado] ?? nuevoEstado}`, duration: 3000 });
                                setTimeout(invalidateAll, 1500);
                              }}
                            );
                          }}
                        >
                          <option value="INSCRIPTX">Inscriptx</option>
                          <option value="EN REVISION">En revisión</option>
                          <option value="ALERTA">Alerta</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {!bulkDeleteMode && (
                    <>
                      <Badge variant={child.estAsist === "Regular" ? "secondary" : "outline"} className="text-[11px] shrink-0 hidden sm:flex">{child.estAsist}</Badge>
                      {confirmDeleteId === child.id ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-red-600 font-medium">Eliminar?</span>
                          <button onClick={() => handleDeleteChild(child.id)} disabled={deleteChild.isPending} className="px-2 py-0.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50">Si</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(child.id); }}
                          className="shrink-0 text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="Eliminar alumno"
                          data-testid={`btn-delete-${child.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {filteredActive.length === 0 && nominaTab === "activos" && (
                <div className="text-center py-10 text-muted-foreground text-sm">Sin resultados</div>
              )}
              {filteredRevision.length === 0 && nominaTab === "revision" && (
                <div className="text-center py-10 text-muted-foreground text-sm">No hay niños en revisión</div>
              )}
              {filteredAlerta.length === 0 && nominaTab === "alerta" && (
                <div className="text-center py-10 text-muted-foreground text-sm">No hay niños en alerta</div>
              )}
            </div>
          </TabsContent>

          {/* ASISTENCIA */}
          <TabsContent value="asistencia">
            <div className="mb-3">
              <h3 className="font-bold mb-3">Asistencia de hoy — todas las salas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(roomSummary.data ?? []).map((r: RoomSummary) => (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-sm" data-testid={`asist-room-${r.ecoNumber}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {editingRoomId === r.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={editRoomName}
                            onChange={(e) => setEditRoomName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveRoomName(r.id); if (e.key === "Escape") setEditingRoomId(null); }}
                            className="h-7 text-sm font-semibold py-0"
                            autoFocus
                          />
                          <button onClick={() => saveRoomName(r.id)} className="text-green-600 hover:text-green-700 p-0.5">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingRoomId(null)} className="text-muted-foreground hover:text-foreground p-0.5">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="font-semibold text-sm flex-1 text-left hover:text-primary transition-colors"
                            onClick={() => {
                              if (isSuperAdmin) {
                                localStorage.setItem("superadmin_sala_centerId", String(r.centerId ?? activeCenterId ?? ""));
                                localStorage.setItem("superadmin_sala_roomId", String(r.id));
                              }
                              setLocation("/sala");
                            }}
                          >
                            {r.name}
                          </button>
                          <RoomAttendanceDialog room={r} onOpenChild={(id) => setSelectedChild(id)} />
                          <QrDialogButton room={r} allRooms={allRooms.data ?? []} />
                          <button
                            onClick={() => { setEditingRoomId(r.id); setEditRoomName(r.name); }}
                            className="text-muted-foreground hover:text-foreground p-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            title="Renombrar sala"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="text-green-600 font-bold">{r.present} P</div>
                      <div className="text-red-600 font-bold">{r.absent} A</div>
                      <div className="text-amber-600 font-bold">{r.unmarked} s/m</div>
                      <div className="text-purple-600 font-bold">{r.mercaderia} M</div>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${r.pct}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{r.pct}% de asistencia</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* VACANTES */}
          <TabsContent value="vacantes">
            <h3 className="font-bold mb-4">Vacantes por sala</h3>
            <div className="space-y-3">
              {(roomSummary.data ?? []).map((r: RoomSummary) => {
                const vacantes = r.capacity - r.total;
                const pct = Math.round((r.total / r.capacity) * 100);
                const c = ECO_COLORS[r.ecoNumber] ?? ECO_COLORS[0];
                return (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-sm" data-testid={`vacantes-room-${r.ecoNumber}`}>
                    <div className="flex justify-between items-center mb-2">
                      <div className={`font-semibold text-sm ${c.text}`}>{r.name}</div>
                      <span className={`text-sm font-bold ${vacantes > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {vacantes > 0 ? `${vacantes} vacante${vacantes !== 1 ? "s" : ""}` : "Sala completa"}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{r.total} inscriptos</span>
                      <span>Tope: {r.capacity}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* EGRESOS */}
          <TabsContent value="egresos">
            <div className="mb-3">
              <h3 className="font-bold mb-1">Egresos registrados</h3>
              <p className="text-xs text-muted-foreground mb-4">Niños/as dados de baja del sistema</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-egresos-search" />
              </div>
            </div>
            <div className="space-y-3">
              {filteredBajas.map((child: Child) => (
                <div key={child.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm" data-testid={`egreso-card-${child.id}`}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedChild(child.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                      {child.apellido.slice(0, 1)}{child.nombre.slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{child.apellido} {child.nombre}</div>
                      <div className="text-xs text-muted-foreground">ECO {child.ecoNumber} · {child.fechaBaja ?? "—"} · {child.motivoBaja ?? "—"}</div>
                    </div>
                  </div>
                  {/* CPIS panel */}
                  <div className="bg-blue-50 border-t border-blue-100 px-4 py-3">
                    <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Panel cpis.com.ar
                    </div>
                    <div className="space-y-1">
                      {[
                        { label: "Nombre", value: `${child.apellido}, ${child.nombre}` },
                        { label: "DNI", value: child.dni ?? "—" },
                        { label: "Sala", value: `ECO ${child.ecoNumber}` },
                        { label: "Fecha baja", value: child.fechaBaja ?? "—" },
                        { label: "Tipo", value: child.motivoBaja ?? "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-[11px] text-blue-600 font-semibold min-w-[70px]">{label}</span>
                          <span className="text-xs text-blue-900 flex-1">{value}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(value); }}
                            className="text-blue-600 hover:bg-blue-200 rounded px-1.5 py-0.5 text-[11px] font-semibold border border-blue-300"
                            data-testid={`btn-copy-${child.id}-${label}`}
                          >
                            Copiar
                          </button>
                        </div>
                      ))}
                    </div>
                    <a
                      href="https://cpis.com.ar"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 font-semibold hover:underline"
                      data-testid={`link-cpis-${child.id}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir cpis.com.ar
                    </a>
                  </div>
                </div>
              ))}
              {filteredBajas.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">Sin egresos registrados</div>
              )}
            </div>
          </TabsContent>
          {/* HISTORIAL */}
          <TabsContent value="historial">
            {/* Subview selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setHistSubview("mensual")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${histSubview === "mensual" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                data-testid="btn-hist-subview-mensual"
              >
                Mensual
              </button>
              <button
                onClick={() => setHistSubview("anual")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${histSubview === "anual" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                data-testid="btn-hist-subview-anual"
              >
                Anual
              </button>
              <button
                onClick={() => setHistSubview("ninos")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${histSubview === "ninos" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                data-testid="btn-hist-subview-ninos"
              >
                Por niño/a
              </button>
            </div>

            {/* Room selector */}
            <div className="mb-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setHistRoomId(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${histRoomId === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                  data-testid="btn-hist-room-all"
                >
                  Todas las salas
                </button>
                {(roomSummary.data ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setHistRoomId(r.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${histRoomId === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                    data-testid={`btn-hist-room-${r.id}`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* MENSUAL VIEW */}
            {histSubview === "mensual" && (
              <div className="space-y-4">
                {/* Month nav */}
                <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(prevMonthAdmin(histMonth))} data-testid="btn-hist-admin-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold capitalize">
                    {new Date(histMonth + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                  </span>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(nextMonthAdmin(histMonth))} disabled={histMonth >= TODAY.slice(0, 7)} data-testid="btn-hist-admin-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Daily table */}
                {histMonthAtt.isPending && <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>}
                {!histMonthAtt.isPending && (() => {
                  const days = getMonthDaysAdmin(histMonth).filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
                  const hasData = days.some((d) => histMonthDailyStats[d.toISOString().slice(0, 10)]);
                  if (!hasData) return <div className="text-center py-8 text-muted-foreground text-sm">Sin datos registrados para este mes</div>;
                  const maxVal = Math.max(...days.map((d) => { const s = histMonthDailyStats[d.toISOString().slice(0, 10)]; return s ? s.p + s.a : 0; }), 1);
                  return (
                    <div className="overflow-x-auto">
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b border-border bg-muted/40">
                        <div className="w-12">Fecha</div>
                        <div className="px-3">Presentes / Ausentes</div>
                        <div className="w-8 text-right text-green-700">P</div>
                        <div className="w-8 text-right text-red-700">A</div>
                        <div className="w-10 text-right">%</div>
                      </div>
                      <div className="divide-y divide-border">
                        {days.map((d) => {
                          const ds = d.toISOString().slice(0, 10);
                          const s = histMonthDailyStats[ds];
                          if (!s) return null;
                          const total = s.p + s.a;
                          const pct = total > 0 ? Math.round((s.p / total) * 100) : 0;
                          const pBar = total > 0 ? (s.p / maxVal) * 100 : 0;
                          const aBar = total > 0 ? (s.a / maxVal) * 100 : 0;
                          return (
                            <div key={ds} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-3 py-2 gap-1 hover:bg-muted/30 transition-colors">
                              <div className="w-12 text-xs font-mono text-muted-foreground">
                                {d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                              </div>
                              <div className="px-3 flex gap-0.5 items-center h-4">
                                {s.p > 0 && <div className="h-full rounded-sm bg-green-400" style={{ width: `${pBar}%`, minWidth: "3px" }} />}
                                {s.a > 0 && <div className="h-full rounded-sm bg-red-300" style={{ width: `${aBar}%`, minWidth: "3px" }} />}
                              </div>
                              <div className="w-8 text-right text-xs font-semibold text-green-700">{s.p}</div>
                              <div className="w-8 text-right text-xs font-semibold text-red-700">{s.a}</div>
                              <div className="w-10 text-right text-xs font-bold text-primary">{pct}%</div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Monthly totals */}
                      {(() => {
                        const totP = Object.values(histMonthDailyStats).reduce((acc, s) => acc + s.p, 0);
                        const totA = Object.values(histMonthDailyStats).reduce((acc, s) => acc + s.a, 0);
                        const totT = totP + totA;
                        const pct = totT > 0 ? Math.round((totP / totT) * 100) : 0;
                        return (
                          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-3 py-2 bg-muted/60 border-t-2 border-border">
                            <div className="w-12 text-[11px] font-bold text-muted-foreground uppercase">Total</div>
                            <div className="px-3" />
                            <div className="w-8 text-right text-sm font-bold text-green-700">{totP}</div>
                            <div className="w-8 text-right text-sm font-bold text-red-700">{totA}</div>
                            <div className="w-10 text-right text-sm font-bold text-primary">{pct}%</div>
                          </div>
                        );
                      })()}
                    </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ANUAL VIEW */}
            {histSubview === "anual" && (
              <div className="space-y-4">
                {/* Year nav */}
                <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistYear(String(Number(histYear) - 1))} data-testid="btn-hist-prev-year">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold">{histYear}</span>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistYear(String(Number(histYear) + 1))} disabled={histYear >= TODAY.slice(0, 4)} data-testid="btn-hist-next-year">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {histYearAtt.isPending && <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>}
                {!histYearAtt.isPending && (
                  <div className="overflow-x-auto">
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b border-border bg-muted/40">
                      <div className="w-10">Mes</div>
                      <div className="px-3">Distribución</div>
                      <div className="w-8 text-right text-green-700">P</div>
                      <div className="w-8 text-right text-red-700">A</div>
                      <div className="w-10 text-right">%</div>
                    </div>
                    <div className="divide-y divide-border">
                      {Array.from({ length: 12 }, (_, i) => {
                        const mo = `${histYear}-${String(i + 1).padStart(2, "0")}`;
                        const s = histYearMonthlyStats[mo];
                        const total = s ? s.p + s.a : 0;
                        const pct = total > 0 ? Math.round((s!.p / total) * 100) : 0;
                        const pBar = total > 0 ? (s!.p / histYearMax) * 100 : 0;
                        const aBar = total > 0 ? (s!.a / histYearMax) * 100 : 0;
                        return (
                          <div key={mo} className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-3 py-2 gap-1 ${!s ? "opacity-40" : "hover:bg-muted/30 transition-colors"}`} data-testid={`hist-year-row-${mo}`}>
                            <div className="w-10 text-xs font-semibold text-muted-foreground">{MONTHS_ES[i]}</div>
                            <div className="px-3 flex gap-0.5 items-center h-4">
                              {s && s.p > 0 && <div className="h-full rounded-sm bg-green-400" style={{ width: `${pBar}%`, minWidth: "3px" }} />}
                              {s && s.a > 0 && <div className="h-full rounded-sm bg-red-300" style={{ width: `${aBar}%`, minWidth: "3px" }} />}
                            </div>
                            <div className="w-8 text-right text-xs font-semibold text-green-700">{s?.p ?? "—"}</div>
                            <div className="w-8 text-right text-xs font-semibold text-red-700">{s?.a ?? "—"}</div>
                            <div className="w-10 text-right text-xs font-bold text-primary">{total > 0 ? `${pct}%` : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Annual totals */}
                    {(() => {
                      const totP = Object.values(histYearMonthlyStats).reduce((acc, s) => acc + s.p, 0);
                      const totA = Object.values(histYearMonthlyStats).reduce((acc, s) => acc + s.a, 0);
                      const totT = totP + totA;
                      const pct = totT > 0 ? Math.round((totP / totT) * 100) : 0;
                      if (totT === 0) return <div className="px-3 py-3 text-center text-xs text-muted-foreground border-t border-border">Sin datos para este año</div>;
                      return (
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-3 py-2 bg-muted/60 border-t-2 border-border">
                          <div className="w-10 text-[11px] font-bold text-muted-foreground uppercase">Tot.</div>
                          <div className="px-3" />
                          <div className="w-8 text-right text-sm font-bold text-green-700">{totP}</div>
                          <div className="w-8 text-right text-sm font-bold text-red-700">{totA}</div>
                          <div className="w-10 text-right text-sm font-bold text-primary">{pct}%</div>
                        </div>
                      );
                    })()}
                  </div>
                  </div>
                )}
              </div>
            )}
            {/* POR NIÑO/A VIEW */}
            {histSubview === "ninos" && (
              <div className="space-y-4">
                {/* Month nav */}
                <div className="flex items-center justify-between bg-card rounded-xl border border-border p-3">
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(prevMonthAdmin(histMonth))} data-testid="btn-ninos-prev-month">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-semibold capitalize">
                    {new Date(histMonth + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                  </span>
                  <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setHistMonth(nextMonthAdmin(histMonth))} disabled={histMonth >= TODAY.slice(0, 7)} data-testid="btn-ninos-next-month">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Per-room summary */}
                {Object.keys(roomMonthlyStats).length > 0 && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <div className="px-3 py-2 border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Resumen por sala</div>
                    <div className="divide-y divide-border">
                      {Object.values(roomMonthlyStats)
                        .sort((a, b) => a.ecoNumber - b.ecoNumber)
                        .map((r) => {
                          const total = r.p + r.a;
                          const pct = total > 0 ? Math.round((r.p / total) * 100) : 0;
                          const c = ECO_COLORS[r.ecoNumber] ?? ECO_COLORS[0];
                          return (
                            <div key={r.ecoNumber} className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2 gap-2">
                              <div className={`text-sm font-semibold ${c.text}`}>{r.name}</div>
                              <div className="text-xs font-semibold text-green-700">{r.p} P</div>
                              <div className="text-xs font-semibold text-red-700">{r.a} A</div>
                              <div className="text-xs font-bold text-primary w-10 text-right">{pct}%</div>
                            </div>
                          );
                        })}
                    </div>
                    {(() => {
                      const totP = Object.values(roomMonthlyStats).reduce((acc, r) => acc + r.p, 0);
                      const totA = Object.values(roomMonthlyStats).reduce((acc, r) => acc + r.a, 0);
                      const totT = totP + totA;
                      const pct = totT > 0 ? Math.round((totP / totT) * 100) : 0;
                      return (
                        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center px-3 py-2 bg-muted/60 border-t-2 border-border gap-2">
                          <div className="text-[11px] font-bold text-muted-foreground uppercase">Total centro</div>
                          <div className="text-sm font-bold text-green-700">{totP}</div>
                          <div className="text-sm font-bold text-red-700">{totA}</div>
                          <div className="text-sm font-bold text-primary w-10 text-right">{pct}%</div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Per-child table */}
                {histMonthAtt.isPending && <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>}
                {!histMonthAtt.isPending && (() => {
                  const childMap: Record<number, Child> = {};
                  (allChildren.data ?? []).forEach((c: Child) => { childMap[c.id] = c; });
                  const rows = Object.entries(childMonthlyStats)
                    .map(([cid, stats]) => ({ child: childMap[Number(cid)], ...stats }))
                    .filter((r) => r.child)
                    .sort((a, b) => a.child.apellido.localeCompare(b.child.apellido));
                  if (!rows.length) return <div className="text-center py-8 text-muted-foreground text-sm">Sin datos para este mes</div>;
                  return (
                    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b border-border bg-muted/40">
                        <div>Niño/a</div>
                        <div className="w-8 text-center">ECO</div>
                        <div className="w-8 text-right text-green-700">P</div>
                        <div className="w-8 text-right text-red-700">A</div>
                        <div className="w-10 text-right">%</div>
                      </div>
                      <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                        {rows.map(({ child, p, a }) => {
                          const total = p + a;
                          const pct = total > 0 ? Math.round((p / total) * 100) : 0;
                          return (
                            <div
                              key={child.id}
                              className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => setSelectedChild(child.id)}
                            >
                              <div className="text-sm font-medium truncate">{child.apellido} {child.nombre}</div>
                              <div className="w-8 text-center text-xs text-muted-foreground">{child.ecoNumber}</div>
                              <div className="w-8 text-right text-xs font-semibold text-green-700">{p}</div>
                              <div className="w-8 text-right text-xs font-semibold text-red-700">{a}</div>
                              <div className={`w-10 text-right text-xs font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-amber-600" : "text-red-600"}`}>{pct}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

      {selectedChild !== null && (
        <ChildSheet
          childId={selectedChild}
          onClose={() => { setSelectedChild(null); invalidateAll(); }}
        />
      )}
    </div>
  );
}
