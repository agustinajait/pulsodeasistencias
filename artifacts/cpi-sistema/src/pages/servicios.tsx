import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = "https://idsqnnyyoybknwqugspv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlkc3Fubnl5b3lia253cXVnc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzk2ODYsImV4cCI6MjA5NDk1NTY4Nn0.HRSQQwryyi7i_1TMUVKNUT4AzzGu6CJd_iHuI79qHE0";

type ServiceType =
  | "MATAFUEGOS"
  | "FUMIGACION"
  | "SIMULACRO"
  | "LIMPIEZA_TANQUES"
  | "CAPACITACION"
  | "SUPERVISION";

const SERVICE_TYPES: { value: ServiceType; label: string; emoji: string }[] = [
  { value: "MATAFUEGOS", label: "Matafuegos", emoji: "🧯" },
  { value: "FUMIGACION", label: "Fumigación", emoji: "🦟" },
  { value: "SIMULACRO", label: "Simulacro", emoji: "🚨" },
  { value: "LIMPIEZA_TANQUES", label: "Limpieza de tanques", emoji: "💧" },
  { value: "CAPACITACION", label: "Capacitación", emoji: "📚" },
  { value: "SUPERVISION", label: "Supervisión", emoji: "🔍" },
];

function typeInfo(type: string) {
  return SERVICE_TYPES.find((t) => t.value === type) ?? { emoji: "📋", label: type };
}

type Status = "VENCIDO" | "POR_VENCER" | "AL_DIA";

interface ServiceRecord {
  id: number;
  centerId: number;
  type: ServiceType;
  title: string | null;
  dateDone: string | null;
  nextDueDate: string | null;
  providerId: number | null;
  providerName: string | null;
  certificateUrl: string | null;
  observations: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

interface Provider {
  id: number;
  name: string;
  serviceTypes: ServiceType[];
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: Status) {
  if (status === "VENCIDO") return "bg-red-100 border-red-300 text-red-800";
  if (status === "POR_VENCER") return "bg-amber-100 border-amber-300 text-amber-800";
  return "bg-green-100 border-green-300 text-green-800";
}

function statusBadgeVariant(status: Status): "destructive" | "outline" | "secondary" {
  if (status === "VENCIDO") return "destructive";
  if (status === "POR_VENCER") return "outline";
  return "secondary";
}

function statusLabel(status: Status) {
  if (status === "VENCIDO") return "Vencido";
  if (status === "POR_VENCER") return "Por vencer";
  return "Al día";
}

function formatDate(d: string | null) {
  if (!d) return "-";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function autoNextDue(type: ServiceType, fromDate: string): string {
  const d = new Date(fromDate);
  if (type === "MATAFUEGOS" || type === "LIMPIEZA_TANQUES") {
    d.setFullYear(d.getFullYear() + 1);
  } else if (type === "FUMIGACION" || type === "SIMULACRO") {
    d.setMonth(d.getMonth() + 6);
  } else {
    return "";
  }
  return d.toISOString().split("T")[0];
}

async function uploadCertificado(serviceId: number, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${serviceId}/certificado.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/certificados/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) return null;
  return `${SUPABASE_URL}/storage/v1/object/certificados/${path}`;
}

// ---------------------------------------------------------------------------
// Service Form Dialog
// ---------------------------------------------------------------------------

interface ServiceFormProps {
  open: boolean;
  centerId: number | null;
  providers: Provider[];
  initial?: ServiceRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function ServiceFormDialog({ open, centerId, providers, initial, onClose, onSaved }: ServiceFormProps) {
  const [type, setType] = useState<ServiceType>("MATAFUEGOS");
  const [title, setTitle] = useState("");
  const [dateDone, setDateDone] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [providerId, setProviderId] = useState<string>("");
  const [providerName, setProviderName] = useState("");
  const [observations, setObservations] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certUrl, setCertUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initial) {
        setType(initial.type);
        setTitle(initial.title ?? "");
        setDateDone(initial.dateDone ? initial.dateDone.split("T")[0] : "");
        setNextDueDate(initial.nextDueDate ? initial.nextDueDate.split("T")[0] : "");
        setProviderId(initial.providerId ? String(initial.providerId) : "");
        setProviderName(initial.providerName ?? "");
        setCertUrl(initial.certificateUrl ?? "");
        setObservations(initial.observations ?? "");
      } else {
        setType("MATAFUEGOS");
        setTitle("");
        setDateDone("");
        setNextDueDate("");
        setProviderId("");
        setProviderName("");
        setCertUrl("");
        setObservations("");
      }
      setCertFile(null);
      setError("");
    }
  }, [open, initial]);

  function handleDateDoneChange(val: string) {
    setDateDone(val);
    if (val && !nextDueDate) {
      const auto = autoNextDue(type, val);
      if (auto) setNextDueDate(auto);
    }
  }

  function handleTypeChange(val: ServiceType) {
    setType(val);
    if (dateDone) {
      const auto = autoNextDue(val, dateDone);
      if (auto) setNextDueDate(auto);
    }
  }

  function handleProviderSelect(val: string) {
    setProviderId(val);
    const p = providers.find((x) => String(x.id) === val);
    if (p) setProviderName(p.name);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: any = {
        centerId,
        type,
        title: title || null,
        dateDone: dateDone || null,
        nextDueDate: nextDueDate || null,
        providerId: providerId ? parseInt(providerId) : null,
        providerName: providerName || null,
        certificateUrl: certUrl || null,
        observations: observations || null,
      };

      let res: Response;
      if (initial) {
        res = await fetch(`/api/services/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) { setError("Error al guardar"); setSaving(false); return; }

      const saved: ServiceRecord = await res.json();

      if (certFile) {
        const url = await uploadCertificado(saved.id, certFile);
        if (url) {
          await fetch(`/api/services/${saved.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, certificateUrl: url }),
          });
        }
      }

      onSaved();
      onClose();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={(v) => handleTypeChange(v as ServiceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Título (opcional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Empresa XYZ" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha realizada</Label>
              <Input type="date" value={dateDone} onChange={(e) => handleDateDoneChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Próxima fecha</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Proveedor</Label>
            {providers.length > 0 && (
              <Select value={providerId} onValueChange={handleProviderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_manual">Ingresar manualmente</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              className="mt-1"
              value={providerName}
              onChange={(e) => { setProviderName(e.target.value); setProviderId("_manual"); }}
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="space-y-1">
            <Label>Certificado</Label>
            {certUrl && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <a href={certUrl} target="_blank" rel="noreferrer" className="underline">Ver certificado actual</a>
                <button onClick={() => setCertUrl("")} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            )}
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Provider Form Dialog
// ---------------------------------------------------------------------------

interface ProviderFormProps {
  open: boolean;
  initial?: Provider | null;
  onClose: () => void;
  onSaved: () => void;
}

function ProviderFormDialog({ open, initial, onClose, onSaved }: ProviderFormProps) {
  const [name, setName] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initial) {
        setName(initial.name);
        setServiceTypes(initial.serviceTypes ?? []);
        setContactPerson(initial.contactPerson ?? "");
        setPhone(initial.phone ?? "");
        setEmail(initial.email ?? "");
        setAddress(initial.address ?? "");
        setNotes(initial.notes ?? "");
      } else {
        setName(""); setServiceTypes([]); setContactPerson(""); setPhone("");
        setEmail(""); setAddress(""); setNotes("");
      }
      setError("");
    }
  }, [open, initial]);

  function toggleType(t: ServiceType) {
    setServiceTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleSave() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { name, serviceTypes, contactPerson: contactPerson || null, phone: phone || null, email: email || null, address: address || null, notes: notes || null };
      const res = initial
        ? await fetch(`/api/providers/${initial.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setError("Error al guardar"); setSaving(false); return; }
      onSaved();
      onClose();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Empresa o persona" />
          </div>

          <div className="space-y-2">
            <Label>Tipos de servicio</Label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={serviceTypes.includes(t.value)}
                    onChange={() => toggleType(t.value)}
                    className="rounded"
                  />
                  {t.emoji} {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Persona de contacto</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Dirección</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Calendar View
// ---------------------------------------------------------------------------

function CalendarView({ services }: { services: ServiceRecord[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map day -> services with nextDueDate in that day
  const byDay: Record<number, ServiceRecord[]> = {};
  for (const s of services) {
    if (!s.nextDueDate) continue;
    const d = new Date(s.nextDueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(s);
    }
  }

  const daySelectedServices = selectedDay ? (byDay[selectedDay] ?? []) : [];

  const cells: (number | null)[] = [];
  // Start from Monday (adjust firstDow: 0=Sun -> 6, 1=Mon -> 0, ...)
  const startOffset = (firstDow + 6) % 7;
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft size={18} /></Button>
        <span className="font-semibold">{MONTH_NAMES[month]} {year}</span>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight size={18} /></Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-medium text-gray-500 mb-1">
        {["Lu","Ma","Mi","Ju","Vi","Sa","Do"].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dayServices = byDay[day] ?? [];
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSelected = selectedDay === day;
          let dotColor = "";
          if (dayServices.some(s => s.status === "VENCIDO")) dotColor = "bg-red-500";
          else if (dayServices.some(s => s.status === "POR_VENCER")) dotColor = "bg-amber-500";
          else if (dayServices.length > 0) dotColor = "bg-green-500";

          return (
            <button
              key={idx}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={`relative flex flex-col items-center justify-center rounded-lg p-1.5 text-sm leading-none transition-colors
                ${isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-100 font-bold" : "hover:bg-gray-100"}
              `}
            >
              {day}
              {dotColor && (
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${dotColor} ${isSelected ? "bg-white" : ""}`} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">
            {selectedDay} de {MONTH_NAMES[month]}
          </p>
          {daySelectedServices.length === 0 ? (
            <p className="text-sm text-gray-400">Sin servicios este día.</p>
          ) : (
            daySelectedServices.map(s => {
              const info = typeInfo(s.type);
              return (
                <div key={s.id} className={`rounded-lg border p-3 ${statusColor(s.status)}`}>
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <span>{info.emoji}</span>
                    <span>{info.label}</span>
                    {s.title && <span className="text-gray-600">— {s.title}</span>}
                  </div>
                  {s.providerName && <p className="text-xs mt-0.5">{s.providerName}</p>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Services Tab
// ---------------------------------------------------------------------------

function ServicesTab({ centerId, providers, centers }: { centerId: number | null; providers: Provider[]; centers?: { id: number; name: string }[] }) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const centerMap = Object.fromEntries((centers ?? []).map((c) => [c.id, c.name]));

  async function loadServices() {
    setLoading(true);
    try {
      const url = centerId ? `/api/services?centerId=${centerId}` : `/api/services`;
      const res = await fetch(url);
      if (res.ok) setServices(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadServices(); }, [centerId]);

  async function handleDelete(id: number) {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    setDeleteId(null);
    loadServices();
  }

  const groups: Record<Status, ServiceRecord[]> = { VENCIDO: [], POR_VENCER: [], AL_DIA: [] };
  for (const s of services) groups[s.status].push(s);

  const ORDER: Status[] = ["VENCIDO", "POR_VENCER", "AL_DIA"];
  const GROUP_LABELS: Record<Status, string> = { VENCIDO: "Vencidos", POR_VENCER: "Por vencer", AL_DIA: "Al día" };

  function openNew() { setEditTarget(null); setFormOpen(true); }
  function openEdit(s: ServiceRecord) { setEditTarget(s); setFormOpen(true); }

  return (
    <div className="space-y-4">
      {/* View toggle + Add button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          <button
            className={`px-3 py-1.5 ${view === "lista" ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
            onClick={() => setView("lista")}
          >
            Lista
          </button>
          <button
            className={`px-3 py-1.5 ${view === "calendario" ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
            onClick={() => setView("calendario")}
          >
            Calendario
          </button>
        </div>
        {centerId && (
          <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1" />Nuevo</Button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>}

      {!loading && view === "calendario" && (
        <CalendarView services={services} />
      )}

      {!loading && view === "lista" && (
        <div className="space-y-6">
          {ORDER.map((status) => {
            const items = groups[status];
            if (items.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="text-sm font-semibold mb-2 text-gray-600">{GROUP_LABELS[status]}</h3>
                <div className="space-y-2">
                  {items.map((s) => {
                    const info = typeInfo(s.type);
                    return (
                      <div key={s.id} className={`rounded-xl border p-4 ${statusColor(s.status)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg">{info.emoji}</span>
                              <span className="font-semibold text-sm">{info.label}</span>
                              {s.title && <span className="text-sm text-gray-700">— {s.title}</span>}
                              <Badge variant={statusBadgeVariant(s.status)} className="text-xs">
                                {statusLabel(s.status)}
                              </Badge>
                              {!centerId && centerMap[s.centerId] && (
                                <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                                  {centerMap[s.centerId]}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-700">
                              <div><span className="font-medium">Realizado:</span> {formatDate(s.dateDone)}</div>
                              <div><span className="font-medium">Próximo:</span> {formatDate(s.nextDueDate)}</div>
                              {s.providerName && (
                                <div className="col-span-2"><span className="font-medium">Proveedor:</span> {s.providerName}</div>
                              )}
                            </div>
                            {s.observations && (
                              <p className="mt-1 text-xs text-gray-600 italic">{s.observations}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(s)}>
                            <Pencil size={12} className="mr-1" />Editar
                          </Button>
                          {s.certificateUrl && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                              <a href={s.certificateUrl} target="_blank" rel="noreferrer">
                                <FileText size={12} className="mr-1" />Certificado
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 size={12} className="mr-1" />Eliminar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {services.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No hay servicios registrados.</p>
          )}
        </div>
      )}

      {/* Delete confirm dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar servicio</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro de que querés eliminar este servicio?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceFormDialog
        open={formOpen}
        centerId={centerId}
        providers={providers}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={loadServices}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Providers Tab
// ---------------------------------------------------------------------------

function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  async function loadProviders(q = "") {
    setLoading(true);
    try {
      const res = await fetch(`/api/providers?q=${encodeURIComponent(q)}`);
      if (res.ok) setProviders(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProviders(); }, []);

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadProviders(val), 300);
  }

  async function handleDelete(id: number) {
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    setDeleteId(null);
    loadProviders(search);
  }

  function openNew() { setEditTarget(null); setFormOpen(true); }
  function openEdit(p: Provider) { setEditTarget(p); setFormOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" onClick={openNew}><Plus size={14} className="mr-1" />Nuevo</Button>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>}

      {!loading && (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  {(p.serviceTypes ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(p.serviceTypes ?? []).map((t) => {
                        const info = typeInfo(t);
                        return (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {info.emoji} {info.label}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                    {p.contactPerson && <div><span className="font-medium">Contacto:</span> {p.contactPerson}</div>}
                    {p.phone && <div><span className="font-medium">Tel:</span> {p.phone}</div>}
                    {p.email && <div><span className="font-medium">Email:</span> {p.email}</div>}
                    {p.address && <div><span className="font-medium">Dir:</span> {p.address}</div>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(p)}>
                  <Pencil size={12} className="mr-1" />Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => setDeleteId(p.id)}
                >
                  <Trash2 size={12} className="mr-1" />Eliminar
                </Button>
              </div>
            </div>
          ))}
          {providers.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No se encontraron proveedores.</p>
          )}
        </div>
      )}

      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar proveedor</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">¿Estás seguro de que querés eliminar este proveedor?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProviderFormDialog
        open={formOpen}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={() => loadProviders(search)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ServiciosPage() {
  const { role, centerId: authCenterId } = useAuth();
  const [, navigate] = useLocation();
  const isSuperAdmin = role === "superadmin";

  const [selectedCenterId, setSelectedCenterId] = useState<number | null>(
    isSuperAdmin ? null : authCenterId  // super admin empieza sin filtro (ve todos)
  );
  const [centers, setCenters] = useState<{ id: number; name: string }[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeTab, setActiveTab] = useState<"servicios" | "proveedores">("servicios");

  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/centers")
        .then((r) => r.json())
        .then(setCenters)
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {});
  }, []);

  // For non-superadmin, always use their own centerId
  const effectiveCenterId = isSuperAdmin ? selectedCenterId : authCenterId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="p-1 rounded hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-lg font-bold flex-1">Servicios</h1>
          {isSuperAdmin && centers.length > 0 && (
            <Select
              value={selectedCenterId ? String(selectedCenterId) : "todos"}
              onValueChange={(v) => setSelectedCenterId(v === "todos" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Todos los centros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los centros</SelectItem>
                {centers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex border-t">
          {(["servicios", "proveedores"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "servicios" ? "Servicios" : "Proveedores"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {activeTab === "servicios" ? (
          effectiveCenterId ? (
            <ServicesTab centerId={effectiveCenterId} providers={providers} centers={centers} />
          ) : null
        ) : (
          <ProvidersTab />
        )}
      </div>
    </div>
  );
}
