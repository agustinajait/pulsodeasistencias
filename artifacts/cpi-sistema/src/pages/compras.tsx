import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, Printer, Check, Clock, ShoppingCart, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_URL ?? "/api";
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function mesLabel(ym: string) { const [,m] = ym.split("-"); return MESES[parseInt(m)-1] ?? ym; }
function mesLargo(ym: string) { const d = new Date(ym+"-15"); return d.toLocaleDateString("es-AR",{month:"long",year:"numeric"}); }
function currentMonth() { return new Date().toISOString().slice(0,7); }
function getLast12Months() {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  return months;
}

type Pedido = {
  id: number; mes: string; nombre: string; cantidad: number; unidad: string;
  precioUnitario: number; proveedor?: string; estado: "pendiente"|"aprobado"|"comprado"; notas?: string; orden: number;
};
type CatItem = { id: number; nombre: string; unidad: string; ultimoPrecio?: number; ultimoProveedor?: string };
type Proveedor = { id: number; nombre: string; contacto?: string; telefono?: string };

const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3"/> },
  { value: "aprobado",  label: "Aprobado",  color: "bg-blue-100 text-blue-700",   icon: <Check className="w-3 h-3"/> },
  { value: "comprado",  label: "Comprado",  color: "bg-green-100 text-green-700", icon: <ShoppingCart className="w-3 h-3"/> },
];

function estadoBadge(estado: string) {
  const e = ESTADOS.find(s => s.value === estado) ?? ESTADOS[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${e.color}`}>
      {e.icon}{e.label}
    </span>
  );
}

// ── Autocomplete input ─────────────────────────────────────────────────────
function AutoInput({ value, onChange, suggestions, placeholder, className = "" }: {
  value: string; onChange: (v: string) => void;
  suggestions: string[]; placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value);
  return (
    <div className="relative">
      <input
        className={`border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 w-full ${className}`}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-0.5">
          {filtered.slice(0, 8).map(s => (
            <div key={s} className="px-3 py-2 text-sm cursor-pointer hover:bg-violet-50 hover:text-violet-700" onMouseDown={() => { onChange(s); setOpen(false); }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row editor ─────────────────────────────────────────────────────────────
function PedidoRow({ item, catalogo, proveedores, onSave, onDelete, isNew = false }: {
  item: Partial<Pedido>; catalogo: CatItem[]; proveedores: Proveedor[];
  onSave: (data: Partial<Pedido>) => void; onDelete: () => void; isNew?: boolean;
}) {
  const [form, setForm] = useState<Partial<Pedido>>({
    nombre: "", cantidad: 1, unidad: "unid.", precioUnitario: 0, proveedor: "", estado: "pendiente", notas: "", ...item,
  });

  function upd(k: keyof Pedido, v: any) { setForm(f => ({ ...f, [k]: v })); }

  // Auto-fill from catalog
  function onNombreChange(nombre: string) {
    upd("nombre", nombre);
    const cat = catalogo.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (cat) {
      if (cat.unidad) upd("unidad", cat.unidad);
      if (cat.ultimoPrecio) upd("precioUnitario", cat.ultimoPrecio);
      if (cat.ultimoProveedor) upd("proveedor", cat.ultimoProveedor);
    }
  }

  const sub = (form.cantidad ?? 0) * (form.precioUnitario ?? 0);
  const nomSugg = catalogo.map(c => c.nombre);
  const provSugg = proveedores.map(p => p.nombre);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Material</label>
          <AutoInput value={form.nombre ?? ""} onChange={onNombreChange} suggestions={nomSugg} placeholder="Nombre del material" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Cantidad</label>
            <input type="number" min="0" step="0.5"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
              value={form.cantidad} onChange={e => upd("cantidad", parseFloat(e.target.value)||0)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Unidad</label>
            <input
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
              value={form.unidad} onChange={e => upd("unidad", e.target.value)} placeholder="unid." />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Precio unit.</label>
            <input type="number" min="0" step="0.01"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full text-right focus:outline-none focus:ring-1 focus:ring-violet-400"
              value={form.precioUnitario || ""} onChange={e => upd("precioUnitario", parseFloat(e.target.value)||0)} placeholder="$0" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Proveedor</label>
          <AutoInput value={form.proveedor ?? ""} onChange={v => upd("proveedor", v)} suggestions={provSugg} placeholder="Nombre del proveedor" />
        </div>
        {!isNew && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Estado</label>
            <select
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
              value={form.estado} onChange={e => upd("estado", e.target.value as any)}
            >
              {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Notas</label>
          <input
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
            value={form.notas ?? ""} onChange={e => upd("notas", e.target.value)} placeholder="Opcional..." />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        {sub > 0 ? (
          <span className="text-sm font-bold text-violet-700">Subtotal: ${sub.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
        ) : <span/>}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-400 hover:text-red-600 px-2">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={!form.nombre?.trim()}>
            <Save className="w-3.5 h-3.5 mr-1" />{isNew ? "Agregar" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Compras() {
  const { centerId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mes, setMes] = useState(currentMonth());
  const [addingItem, setAddingItem] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingProv, setAddingProv] = useState(false);
  const [newProv, setNewProv] = useState({ nombre: "", contacto: "", telefono: "" });
  const [tab, setTab] = useState<"pedidos" | "proveedores">("pedidos");
  const months = getLast12Months();

  const pedidosQ = useQuery({
    queryKey: ["pedidos", centerId, mes],
    queryFn: async () => {
      if (!centerId) return [];
      const r = await fetch(`${BASE}/compras/pedidos?centerId=${centerId}&mes=${mes}`);
      return r.ok ? r.json() as Promise<Pedido[]> : [];
    },
    enabled: !!centerId,
  });

  const catalogoQ = useQuery({
    queryKey: ["catalogo", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const r = await fetch(`${BASE}/compras/catalogo?centerId=${centerId}`);
      return r.ok ? r.json() as Promise<CatItem[]> : [];
    },
    enabled: !!centerId,
  });

  const proveedoresQ = useQuery({
    queryKey: ["proveedores-compras", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const r = await fetch(`${BASE}/compras/proveedores?centerId=${centerId}`);
      return r.ok ? r.json() as Promise<Proveedor[]> : [];
    },
    enabled: !!centerId,
  });

  const pedidos = pedidosQ.data ?? [];
  const catalogo = catalogoQ.data ?? [];
  const proveedores = proveedoresQ.data ?? [];

  // Import from planificaciones
  async function importarDePlanificaciones() {
    const r = await fetch(`${BASE}/compras/pedidos/desde-planificaciones?centerId=${centerId}&mes=${mes}`);
    if (!r.ok) return;
    const nombres: string[] = await r.json();
    if (!nombres.length) { toast({ title: "Sin materiales en planificaciones de este mes" }); return; }
    const existing = new Set(pedidos.map(p => p.nombre.toLowerCase()));
    const nuevos = nombres.filter(n => !existing.has(n.toLowerCase()));
    if (!nuevos.length) { toast({ title: "Todos los materiales ya están en el pedido" }); return; }
    const items = nuevos.map(nombre => {
      const cat = catalogo.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
      return { nombre, cantidad: 1, unidad: cat?.unidad ?? "unid.", precioUnitario: cat?.ultimoPrecio ?? 0, proveedor: cat?.ultimoProveedor ?? "" };
    });
    await fetch(`${BASE}/compras/pedidos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, mes, items }),
    });
    qc.invalidateQueries({ queryKey: ["pedidos", centerId, mes] });
    qc.invalidateQueries({ queryKey: ["catalogo", centerId] });
    toast({ title: `${nuevos.length} materiales importados de planificaciones` });
  }

  async function savePedido(id: number, data: Partial<Pedido>) {
    await fetch(`${BASE}/compras/pedidos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, centerId }),
    });
    qc.invalidateQueries({ queryKey: ["pedidos", centerId, mes] });
    qc.invalidateQueries({ queryKey: ["catalogo", centerId] });
    setEditingId(null);
    toast({ title: "Guardado" });
  }

  async function addPedido(data: Partial<Pedido>) {
    await fetch(`${BASE}/compras/pedidos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, mes, items: [{ ...data }] }),
    });
    qc.invalidateQueries({ queryKey: ["pedidos", centerId, mes] });
    qc.invalidateQueries({ queryKey: ["catalogo", centerId] });
    setAddingItem(false);
    toast({ title: "Material agregado" });
  }

  async function deletePedido(id: number) {
    await fetch(`${BASE}/compras/pedidos/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["pedidos", centerId, mes] });
  }

  async function addProveedor() {
    if (!newProv.nombre.trim()) return;
    await fetch(`${BASE}/compras/proveedores`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, ...newProv }),
    });
    qc.invalidateQueries({ queryKey: ["proveedores-compras", centerId] });
    setNewProv({ nombre: "", contacto: "", telefono: "" });
    setAddingProv(false);
    toast({ title: "Proveedor agregado" });
  }

  async function deleteProveedor(id: number) {
    await fetch(`${BASE}/compras/proveedores/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["proveedores-compras", centerId] });
  }

  function handlePrint() {
    const rows = pedidos.map(p => {
      const sub = p.cantidad * p.precioUnitario;
      const e = ESTADOS.find(s => s.value === p.estado) ?? ESTADOS[0];
      return `<tr>
        <td>${p.nombre}</td>
        <td style="text-align:center">${p.cantidad}</td>
        <td style="text-align:center">${p.unidad}</td>
        <td style="text-align:right">${p.precioUnitario > 0 ? `$${p.precioUnitario.toLocaleString("es-AR")}` : "—"}</td>
        <td style="text-align:right;font-weight:600">${sub > 0 ? `$${sub.toLocaleString("es-AR")}` : "—"}</td>
        <td>${p.proveedor ?? "—"}</td>
        <td><span style="padding:2px 8px;border-radius:99px;font-size:9px;font-weight:700;background:${p.estado==="comprado"?"#d1fae5":p.estado==="aprobado"?"#dbeafe":"#fef3c7"};color:${p.estado==="comprado"?"#065f46":p.estado==="aprobado"?"#1e40af":"#92400e"}">${e.label}</span></td>
      </tr>`;
    }).join("");
    const total = pedidos.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Pedido ${mesLabel(mes)}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm 18mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; }
      h2 { font-size: 14px; color: #1e1147; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e1147; color: #fff; padding: 6px 10px; text-align: left; }
      td { border-bottom: 1px solid #eee; padding: 6px 10px; }
      .total { font-weight: 800; font-size: 13px; text-align: right; margin-top: 10px; color: #1e1147; }
    </style></head><body>
    <h2>📦 Pedido de materiales · ${mesLargo(mes)}</h2>
    <table>
      <thead><tr><th>Material</th><th>Cant.</th><th>Unidad</th><th>Precio unit.</th><th>Subtotal</th><th>Proveedor</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">Total estimado: $${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const total = pedidos.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0);
  const pendientes = pedidos.filter(p => p.estado === "pendiente").length;
  const comprados = pedidos.filter(p => p.estado === "comprado").length;

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Organización</div>
        <h1 className="text-2xl font-bold mt-1">Materiales y Compras</h1>
        {/* KPIs */}
        <div className="flex gap-4 mt-4">
          <div className="text-center">
            <div className="text-xl font-bold">{pedidos.length}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide">Ítems</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-amber-300">{pendientes}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide">Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-300">{comprados}</div>
            <div className="text-[10px] text-white/50 uppercase tracking-wide">Comprados</div>
          </div>
          {total > 0 && (
            <div className="text-center ml-auto">
              <div className="text-xl font-bold text-violet-300">${total.toLocaleString("es-AR",{maximumFractionDigits:0})}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide">Total est.</div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Tab selector */}
        <div className="flex rounded-lg border border-border overflow-hidden bg-white shadow-sm">
          <button onClick={() => setTab("pedidos")} className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab==="pedidos" ? "bg-[#1e1147] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            📦 Pedido del mes
          </button>
          <button onClick={() => setTab("proveedores")} className={`flex-1 py-2 text-sm font-semibold transition-colors border-l border-border ${tab==="proveedores" ? "bg-[#1e1147] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            🏪 Proveedores
          </button>
        </div>

        {/* ── PEDIDOS TAB ── */}
        {tab === "pedidos" && (
          <>
            {/* Month + actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-white"
                value={mes} onChange={e => setMes(e.target.value)}
              >
                {months.map(m => <option key={m} value={m}>{mesLargo(m)}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={importarDePlanificaciones}>
                <Plus className="w-3.5 h-3.5 mr-1" />Importar de planificaciones
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingItem(true)} disabled={addingItem}>
                <Plus className="w-3.5 h-3.5 mr-1" />Agregar ítem
              </Button>
              {pedidos.length > 0 && (
                <Button size="sm" variant="outline" onClick={handlePrint} className="ml-auto">
                  <Printer className="w-3.5 h-3.5 mr-1" />PDF
                </Button>
              )}
            </div>

            {/* New item form */}
            {addingItem && (
              <PedidoRow
                item={{}}
                catalogo={catalogo}
                proveedores={proveedores}
                onSave={addPedido}
                onDelete={() => setAddingItem(false)}
                isNew
              />
            )}

            {/* List */}
            {pedidos.length === 0 && !addingItem ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Sin materiales para {mesLargo(mes)}</p>
                <p className="text-xs text-gray-300 mt-1">Importá desde planificaciones o agregá ítems manualmente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pedidos.map(p => (
                  editingId === p.id ? (
                    <PedidoRow
                      key={p.id}
                      item={p}
                      catalogo={catalogo}
                      proveedores={proveedores}
                      onSave={data => savePedido(p.id, data)}
                      onDelete={() => deletePedido(p.id).then(() => setEditingId(null))}
                    />
                  ) : (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 cursor-pointer hover:border-violet-200 transition-colors"
                      onClick={() => setEditingId(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">{p.nombre}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                            <span>{p.cantidad} {p.unidad}</span>
                            {p.precioUnitario > 0 && <span className="text-violet-600 font-medium">${(p.cantidad*p.precioUnitario).toLocaleString("es-AR")}</span>}
                            {p.proveedor && <span>📦 {p.proveedor}</span>}
                          </div>
                          {p.notas && <div className="text-xs text-gray-300 mt-0.5 italic">{p.notas}</div>}
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          {estadoBadge(p.estado)}
                        </div>
                      </div>
                    </div>
                  )
                ))}

                {/* Total */}
                {total > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-violet-50 rounded-xl border border-violet-100">
                    <span className="text-sm font-bold text-violet-700">Total estimado del mes</span>
                    <span className="text-lg font-bold text-violet-700">${total.toLocaleString("es-AR",{minimumFractionDigits:2})}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── PROVEEDORES TAB ── */}
        {tab === "proveedores" && (
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={() => setAddingProv(true)} disabled={addingProv}>
              <Plus className="w-3.5 h-3.5 mr-1" />Agregar proveedor
            </Button>

            {addingProv && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nuevo proveedor</p>
                <Input placeholder="Nombre *" value={newProv.nombre} onChange={e => setNewProv(p => ({...p, nombre: e.target.value}))} className="text-sm" />
                <Input placeholder="Contacto (persona)" value={newProv.contacto} onChange={e => setNewProv(p => ({...p, contacto: e.target.value}))} className="text-sm" />
                <Input placeholder="Teléfono / WhatsApp" value={newProv.telefono} onChange={e => setNewProv(p => ({...p, telefono: e.target.value}))} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addProveedor} disabled={!newProv.nombre.trim()}>
                    <Save className="w-3.5 h-3.5 mr-1" />Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingProv(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {proveedores.length === 0 && !addingProv ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <p className="text-sm text-gray-400">Sin proveedores cargados todavía</p>
              </div>
            ) : (
              <div className="space-y-2">
                {proveedores.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{p.nombre}</div>
                      {p.contacto && <div className="text-xs text-gray-400">{p.contacto}</div>}
                      {p.telefono && (
                        <a href={`https://wa.me/${p.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                          className="text-xs text-green-600 font-medium">
                          📱 {p.telefono}
                        </a>
                      )}
                    </div>
                    <button onClick={() => deleteProveedor(p.id)} className="text-gray-300 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Catálogo */}
            {catalogo.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Catálogo de materiales ({catalogo.length})</p>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {catalogo.map(c => (
                    <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{c.nombre}</div>
                        <div className="text-xs text-gray-400">{c.unidad}{c.ultimoProveedor ? ` · ${c.ultimoProveedor}` : ""}</div>
                      </div>
                      {c.ultimoPrecio && (
                        <span className="text-sm font-semibold text-violet-600">${c.ultimoPrecio.toLocaleString("es-AR")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
