import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Search, FileText, ChevronRight, X, Printer, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type HitoVal = "L" | "P" | "N" | null;

type Report = {
  id: number;
  childId: number;
  nombre: string;
  apellido: string;
  period: string;
  ecoNumber?: number;
  lider?: string;
  facilitadora?: string;
  hitos: Record<string, HitoVal>;
  textos: Record<string, string>;
  observaciones?: string;
  createdAt: string;
};

type Child = {
  id: number;
  nombre: string;
  apellido: string;
  ecoNumber?: number;
};

// ── ECO templates ─────────────────────────────────────────────────────────
const ECO_TEMPLATES: Record<number, { eje: string; hitos: string[]; inf: string[] }[]> = {
  0: [
    { eje: "Motricidad gruesa", hitos: ["Camina y corre solo","Se sube a su silla","Patea y lanza la pelota","Levanta objetos del suelo en cuclillas","Se agacha y se levanta sin apoyo","Empuja y arrastra objetos"], inf: ["caminar y correr solo","subirse a la silla","patear y lanzar la pelota","levantar objetos del suelo en cuclillas","agacharse y levantarse sin apoyo","empujar y arrastrar objetos"] },
    { eje: "Motricidad fina", hitos: ["Manipula objetos pequeños (como cubos por ejemplo)","Come con cuchara","Pasa las páginas del libro","Apila 2 a 4 cubos","Usa ambas manos para jugar"], inf: ["manipular objetos pequeños","comer con cuchara","pasar las páginas del libro","apilar 2 a 4 cubos","usar ambas manos para jugar"] },
    { eje: "Cognitivo", hitos: ["Busca juguetes escondidos","Trasvasado"], inf: ["buscar juguetes escondidos","realizar trasvasado"] },
    { eje: "Socio-emocional", hitos: ["Muestra curiosidad","Coopera en los momentos de guardado","Se interesa por sus compañeros/as","Puede expresar necesidades básicas con llanto o gestos","Logra almorzar sentado en la mesa"], inf: ["mostrar curiosidad","cooperar en los momentos de guardado","interesarse por sus compañeros/as","expresar necesidades básicas con llanto o gestos","almorzar sentado en la mesa"] },
    { eje: "Lenguaje", hitos: ["Dice su propio nombre","Expresa lo quiere alcanzar o pedir","Señala personas conocidas",'Usa gestos como "chau" "no" "mano"'], inf: ["decir su propio nombre","expresar lo que quiere alcanzar o pedir","señalar personas conocidas",'usar gestos como "chau", "no", "mano"'] },
  ],
  1: [
    { eje: "Motricidad gruesa", hitos: ["Camina, corre y escala sin dificultad","Patea pelotas","Sube y baja escaleras sin ayuda","Salta con ambos pies","Se agacha sin dificultad","Camina para atrás"], inf: ["caminar, correr y escalar sin dificultad","patear pelotas","subir y bajar escaleras sin ayuda","saltar con ambos pies","agacharse sin dificultad","caminar para atrás"] },
    { eje: "Motricidad fina", hitos: ["Pasa páginas del libro","Realiza trazos o garabatos","Puede comer usando cubiertos y vaso"], inf: ["pasar páginas del libro","realizar trazos o garabatos","comer usando cubiertos y vaso"] },
    { eje: "Cognitivo", hitos: ["Reconoce objetos","Cuenta hasta 5","Sigue instrucciones dobles","Hace preguntas","Imita animales","Juega de manera simbólica","Reconoce colores"], inf: ["reconocer objetos","contar hasta 5","seguir instrucciones dobles","hacer preguntas","imitar animales","jugar de manera simbólica","reconocer colores"] },
    { eje: "Socio-emocional", hitos: ["Avisa si quiere ir al baño","Colabora con el guardado de los juguetes","Se saca algunas prendas"], inf: ["avisar cuando quiere ir al baño","colaborar con el guardado de los juguetes","sacarse algunas prendas"] },
    { eje: "Autonomía", hitos: ["Acepta las propuestas de la líder","Muestra interés por compartir con sus pares","Respeta la rutina","Imita comportamientos de adultos","Busca aprobación del adulto"], inf: ["aceptar las propuestas de la líder","mostrar interés por compartir con sus pares","respetar la rutina","imitar comportamientos de adultos","buscar aprobación del adulto"] },
    { eje: "Emocional", hitos: ["Expresa emociones como enojo, alegría o frustración"], inf: ["expresar emociones como enojo, alegría o frustración"] },
    { eje: "Lenguaje", hitos: ["Nombra objetos o personas conocidas","Forma frases de 2 palabras o más"], inf: ["nombrar objetos o personas conocidas","formar frases de 2 palabras o más"] },
  ],
  2: [
    { eje: "Motricidad gruesa", hitos: ["Corre con mayor coordinación","Salta con ambos pies","Lanza, atrapa y patea pelotas","Evita obstáculos","Se viste con ayuda"], inf: ["correr con mayor coordinación","saltar con ambos pies","lanzar, atrapar y patear pelotas","evitar obstáculos","vestirse con ayuda"] },
    { eje: "Motricidad fina", hitos: ["Sostiene el lápiz con más control","Dibuja líneas, círculos","Empieza a pintar dentro de los límites","Come de manera independiente usando cuchara, tenedor y vaso sin pico"], inf: ["sostener el lápiz con más control","dibujar líneas y círculos","pintar dentro de los límites","comer de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "Cognitivo", hitos: ["Reconoce colores, formas y algunos números","Resuelve problemas simples (ej: alcanzar objetos)","Arma torres con 8 o más bloques","Reconoce su nombre","Entiende cuentos simples y sigue la conversación"], inf: ["reconocer colores, formas y algunos números","resolver problemas simples","armar torres con 8 o más bloques","reconocer su nombre","entender cuentos simples y seguir la conversación"] },
    { eje: "Socio-emocional", hitos: ["Juega con sus compañeros","Juego simbólico","Entiende reglas de juego y de convivencia","Participa de las actividades grupales propuestas por la líder"], inf: ["jugar con sus compañeros","realizar juego simbólico","entender reglas de juego y de convivencia","participar de las actividades grupales propuestas por la líder"] },
    { eje: "Emocional", hitos: ["Expresa emociones con palabras"], inf: ["expresar emociones con palabras"] },
    { eje: "Lenguaje", hitos: ["Forma oraciones sencillas","Usa pronombres (yo, tu, él)"], inf: ["formar oraciones sencillas","usar pronombres (yo, tú, él)"] },
  ],
  3: [
    { eje: "Motricidad gruesa", hitos: ["Corre con mayor coordinación","Salta con ambos pies","Lanza, atrapa y patea pelotas","Evita obstáculos","Se viste con ayuda"], inf: ["correr con mayor coordinación","saltar con ambos pies","lanzar, atrapar y patear pelotas","evitar obstáculos","vestirse con ayuda"] },
    { eje: "Motricidad fina", hitos: ["Sostiene el lápiz con más control","Dibuja líneas, círculos","Empieza a pintar dentro de los límites","Come de manera independiente usando cuchara, tenedor y vaso sin pico"], inf: ["sostener el lápiz con más control","dibujar líneas y círculos","pintar dentro de los límites","comer de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "Cognitivo", hitos: ["Reconoce colores, formas y algunos números","Resuelve problemas simples","Arma torres con 8 o más bloques","Reconoce su nombre","Entiende cuentos simples y sigue la conversación"], inf: ["reconocer colores, formas y algunos números","resolver problemas simples","armar torres con 8 o más bloques","reconocer su nombre","entender cuentos simples y seguir la conversación"] },
    { eje: "Socio-emocional", hitos: ["Juega con sus compañeros","Juego simbólico","Entiende reglas de juego y de convivencia","Participa de las actividades grupales propuestas por la líder"], inf: ["jugar con sus compañeros","realizar juego simbólico","entender reglas de juego y de convivencia","participar de las actividades grupales propuestas por la líder"] },
    { eje: "Emocional", hitos: ["Expresa emociones con palabras"], inf: ["expresar emociones con palabras"] },
    { eje: "Lenguaje", hitos: ["Forma oraciones sencillas","Usa pronombres (yo, tu, él)"], inf: ["formar oraciones sencillas","usar pronombres (yo, tú, él)"] },
  ],
};

function joinList(items: string[]) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
}

function autoGenerateTextos(template: { eje: string; hitos: string[]; inf: string[] }[], hitosMap: Record<string, HitoVal>, nombre: string) {
  const first = nombre.split(" ")[0] || "El/la niño/a";
  const result: Record<string, string> = {};
  for (const { eje, hitos, inf } of template) {
    const logra = hitos.map((h, i) => hitosMap[h] === "L" ? inf[i] : null).filter(Boolean) as string[];
    const proceso = hitos.map((h, i) => hitosMap[h] === "P" ? inf[i] : null).filter(Boolean) as string[];
    const noLogra = hitos.map((h, i) => hitosMap[h] === "N" ? inf[i] : null).filter(Boolean) as string[];
    let text = "";
    if (logra.length) text += `${first} logra ${joinList(logra)}. `;
    if (proceso.length) text += `Se encuentra en proceso de ${joinList(proceso)}. `;
    if (noLogra.length) text += `Aún no logra ${joinList(noLogra)}. `;
    result[eje] = text.trim() || `Sin observaciones registradas para ${eje}.`;
  }
  return result;
}

const HITO_COLOR: Record<string, string> = {
  L: "bg-green-100 text-green-700",
  P: "bg-amber-100 text-amber-700",
  N: "bg-red-100 text-red-700",
};
const HITO_LABEL: Record<string, string> = { L: "Logrado", P: "En proceso", N: "No logrado" };
const PERIODS = ["1er trimestre","2do trimestre","3er trimestre","1er cuatrimestre","2do cuatrimestre","Anual"];

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchReports(centerId: number | null, ecoNumber?: number | null, period?: string): Promise<Report[]> {
  if (!centerId) return [];
  let qs = `?centerId=${centerId}`;
  if (ecoNumber != null) qs += `&ecoNumber=${ecoNumber}`;
  if (period) qs += `&period=${period}`;
  const r = await fetch(`${BASE}/reports${qs}`);
  return r.ok ? r.json() : [];
}

async function fetchChildren(centerId: number | null): Promise<Child[]> {
  if (!centerId) return [];
  const r = await fetch(`${BASE}/children?centerId=${centerId}`);
  if (!r.ok) return [];
  const data = await r.json();
  return (data.children ?? data ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    ecoNumber: c.eco_number ?? c.ecoNumber,
  }));
}

async function fetchProfile(centerId: number | null): Promise<{ logoBase64?: string; directorNombre?: string } | null> {
  if (!centerId) return null;
  const r = await fetch(`${BASE}/centers/${centerId}/profile`);
  return r.ok ? r.json() : null;
}

// ── NewReportModal ─────────────────────────────────────────────────────────
function NewReportModal({
  centerId,
  defaultEco,
  onClose,
  onSaved,
}: {
  centerId: number;
  defaultEco: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const childrenQ = useQuery({ queryKey: ["children-for-informe", centerId], queryFn: () => fetchChildren(centerId) });
  const allChildren = childrenQ.data ?? [];

  const [childSearch, setChildSearch] = useState("");
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [eco, setEco] = useState<number>(defaultEco ?? 0);
  const [lider, setLider] = useState("");
  const [facilitadora, setFacilitadora] = useState("");
  const [hitos, setHitos] = useState<Record<string, HitoVal>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const template = ECO_TEMPLATES[eco] ?? [];

  const filteredChildren = useMemo(() => {
    const q = childSearch.toLowerCase();
    let list = allChildren;
    if (defaultEco != null) list = list.filter((c) => c.ecoNumber === defaultEco);
    if (!q) return list.slice(0, 20);
    return list.filter((c) => `${c.apellido} ${c.nombre}`.toLowerCase().includes(q)).slice(0, 20);
  }, [allChildren, childSearch, defaultEco]);

  function setHito(key: string, val: HitoVal) {
    setHitos((h) => ({ ...h, [key]: val }));
  }

  function setTexto(eje: string, val: string) {
    setTextos((t) => ({ ...t, [eje]: val }));
  }

  async function handleSave() {
    if (!selectedChild) { toast({ title: "Seleccioná un niño/a", variant: "destructive" }); return; }
    setSaving(true);
    const res = await fetch(`${BASE}/children/${selectedChild.id}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, ecoNumber: eco, lider: lider || null, facilitadora: facilitadora || null, hitos, textos, observaciones: observaciones || null }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Informe guardado" });
      onSaved();
      onClose();
    } else {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        {/* header */}
        <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Nuevo</div>
              <h2 className="text-xl font-bold mt-0.5">Informe de desarrollo</h2>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* child search */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Niño/a</p>
            {selectedChild ? (
              <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-violet-900">{selectedChild.apellido}, {selectedChild.nombre}</span>
                <button onClick={() => setSelectedChild(null)} className="text-violet-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Buscar por apellido..." value={childSearch} onChange={(e) => setChildSearch(e.target.value)} className="pl-9 text-sm" />
                </div>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                  {filteredChildren.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>}
                  {filteredChildren.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedChild(c); setEco(c.ecoNumber ?? defaultEco ?? 0); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors">
                      <span className="font-semibold">{c.apellido}, {c.nombre}</span>
                      {c.ecoNumber != null && <span className="text-xs text-gray-400 ml-2">ECO {c.ecoNumber}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Período</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Sala ECO</label>
              <select value={eco} onChange={(e) => setEco(Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                disabled={defaultEco != null}>
                {[0,1,2,3].map((n) => <option key={n} value={n}>ECO {n}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Líder</label>
              <Input value={lider} onChange={(e) => setLider(e.target.value)} placeholder="Nombre" className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Facilitadora</label>
              <Input value={facilitadora} onChange={(e) => setFacilitadora(e.target.value)} placeholder="Nombre" className="text-sm" />
            </div>
          </div>

          {/* hitos */}
          {template.map(({ eje, hitos: hitoList }) => (
            <div key={eje}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{eje}</p>
              <div className="space-y-1.5">
                {hitoList.map((h) => {
                  const val = hitos[h] ?? null;
                  return (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-xs text-gray-700 flex-1">{h}</span>
                      <div className="flex gap-1.5 shrink-0">
                        {(["L","P","N"] as HitoVal[]).map((v) => (
                          <button key={v!} onClick={() => setHito(h, val === v ? null : v)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                              val === v ? HITO_COLOR[v!] + " border-transparent" : "bg-white text-gray-600 border-gray-400 hover:border-gray-700 hover:text-gray-800"
                            }`}>
                            {HITO_LABEL[v!]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2">
                <textarea
                  value={textos[eje] ?? ""}
                  onChange={(e) => setTexto(eje, e.target.value)}
                  placeholder={`Síntesis narrativa — ${eje}...`}
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none text-gray-600"
                />
              </div>
            </div>
          ))}

          {/* generar automático */}
          <div className="flex items-center justify-between py-2 border-t border-dashed border-violet-200">
            <div>
              <p className="text-xs font-semibold text-violet-700">✦ Generar descripciones automáticamente</p>
              <p className="text-[10px] text-gray-400">Basado en los hitos marcados. Podés editar antes de guardar.</p>
            </div>
            <button
              onClick={() => {
                const nombre = selectedChild
                  ? `${selectedChild.nombre} ${selectedChild.apellido}`.trim()
                  : "El/la niño/a";
                setTextos(autoGenerateTextos(template, hitos, nombre));
              }}
              className="shrink-0 text-[11px] font-bold text-violet-600 hover:text-violet-800 border border-violet-400 hover:border-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Generar
            </button>
          </div>

          {/* observaciones */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones generales</p>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <Button onClick={handleSave} disabled={saving || !selectedChild} className="w-full">
            {saving ? "Guardando..." : "Guardar informe"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Report detail modal ────────────────────────────────────────────────────
function ReportModal({ report, onClose, logoBase64 }: { report: Report; onClose: () => void; logoBase64?: string }) {
  const template = ECO_TEMPLATES[report.ecoNumber ?? 0] ?? [];
  const childName = `${report.apellido}, ${report.nombre}`;

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const hitoRows = template.flatMap(({ eje, hitos }) =>
      hitos.map((h) => {
        const val = report.hitos[h] ?? null;
        const color = val === "L" ? "#dcfce7" : val === "P" ? "#fef9c3" : val === "N" ? "#fee2e2" : "#f9fafb";
        return `<tr><td style="padding:4px 8px;border:1px solid #e5e7eb">${eje}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${h}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;background:${color}">${val ? HITO_LABEL[val] : "—"}</td></tr>`;
      })
    ).join("");

    const textoSections = template
      .filter(({ eje }) => report.textos?.[eje])
      .map(({ eje }) => `<p><strong>${eje}:</strong> ${report.textos[eje]}</p>`)
      .join("");

    const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="height:60px;object-fit:contain;margin-bottom:8px;display:block" alt="Logo"/>` : "";
    w.document.write(`<html><head><title>Informe ${childName}</title>
      <style>body{font-family:sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 8px;border:1px solid #e5e7eb;text-align:left}.header{display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}</style>
      </head><body>
      <div class="header">${logoHtml}<div><h2 style="margin:0 0 4px 0">Informe de Desarrollo</h2><p style="margin:0;color:#6b7280;font-size:11px">Koratic · Infraestructura de Gestión Social</p></div></div>
      <p><strong>Niño/a:</strong> ${childName}</p>
      <p><strong>Período:</strong> ${report.period}</p>
      ${report.lider ? `<p><strong>Líder:</strong> ${report.lider}</p>` : ""}
      ${report.facilitadora ? `<p><strong>Facilitadora:</strong> ${report.facilitadora}</p>` : ""}
      <table><thead><tr><th>Área</th><th>Hito</th><th>Estado</th></tr></thead><tbody>${hitoRows}</tbody></table>
      ${textoSections ? `<div style="margin-top:16px"><h3>Síntesis narrativa</h3>${textoSections}</div>` : ""}
      ${report.observaciones ? `<div style="margin-top:12px"><strong>Observaciones:</strong> ${report.observaciones}</div>` : ""}
      </body></html>`);
    w.document.close();
    w.print();
  }

  const logrados = Object.values(report.hitos).filter((v) => v === "L").length;
  const enProceso = Object.values(report.hitos).filter((v) => v === "P").length;
  const noLogrados = Object.values(report.hitos).filter((v) => v === "N").length;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#1e1147] text-white px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Informe de desarrollo</div>
              <h2 className="text-xl font-bold mt-0.5">{childName}</h2>
              <p className="text-white/60 text-sm mt-0.5">Período: {report.period} · Sala ECO {report.ecoNumber ?? 0}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-2 mt-3">
            {[
              { label: `${logrados} Logrado`, color: "bg-green-500/20 text-green-200" },
              { label: `${enProceso} En proceso`, color: "bg-amber-500/20 text-amber-200" },
              { label: `${noLogrados} No logrado`, color: "bg-red-500/20 text-red-200" },
            ].map(({ label, color }) => (
              <span key={label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex justify-end px-5 py-3 border-b border-gray-100">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600">
              <Printer className="w-3.5 h-3.5" />Imprimir / PDF
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {(report.lider || report.facilitadora) && (
              <div className="text-sm text-gray-500">
                {report.lider && <p>Líder: <span className="font-semibold text-gray-800">{report.lider}</span></p>}
                {report.facilitadora && <p>Facilitadora: <span className="font-semibold text-gray-800">{report.facilitadora}</span></p>}
              </div>
            )}

            {template.map(({ eje, hitos }) => {
              const area = hitos.map((h) => ({ h, val: report.hitos[h] ?? null }));
              return (
                <div key={eje}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{eje}</p>
                  <div className="space-y-1">
                    {area.map(({ h, val }) => (
                      <div key={h} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 flex-1">{h}</span>
                        {val ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${HITO_COLOR[val]}`}>
                            {HITO_LABEL[val]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-300 shrink-0">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {report.textos?.[eje] && (
                    <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-600 italic">{report.textos[eje]}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {report.observaciones && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones</p>
                <p className="text-sm text-gray-700">{report.observaciones}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Informes() {
  const { centerId, role } = useAuth();
  const qc = useQueryClient();
  const ecoNumber = role?.startsWith("sala") ? parseInt(role.slice(4)) : null;
  const profileQ = useQuery({ queryKey: ["center-profile", centerId], queryFn: () => fetchProfile(centerId), enabled: !!centerId });
  const logoBase64 = profileQ.data?.logoBase64;

  const [search, setSearch] = useState("");
  const [filterEco, setFilterEco] = useState<string>(ecoNumber != null ? String(ecoNumber) : "");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [showNew, setShowNew] = useState(false);

  const roomsQ = useListRooms();
  const rooms = (roomsQ.data ?? []).filter((r: any) => !centerId || r.centerId === centerId);

  const reportsQ = useQuery({
    queryKey: ["all-reports", centerId, filterEco, filterPeriod],
    queryFn: () => fetchReports(centerId, filterEco !== "" ? Number(filterEco) : null, filterPeriod || undefined),
    enabled: !!centerId,
  });

  const reports = reportsQ.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter((r) =>
      `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) ||
      r.apellido.toLowerCase().includes(q)
    );
  }, [reports, search]);

  const byChild = useMemo(() => {
    const map: Record<number, { childId: number; nombre: string; apellido: string; reports: Report[] }> = {};
    filtered.forEach((r) => {
      if (!map[r.childId]) map[r.childId] = { childId: r.childId, nombre: r.nombre, apellido: r.apellido, reports: [] };
      map[r.childId].reports.push(r);
    });
    return Object.values(map).sort((a, b) => a.apellido.localeCompare(b.apellido));
  }, [filtered]);

  function hitoSummary(r: Report) {
    const L = Object.values(r.hitos).filter((v) => v === "L").length;
    const P = Object.values(r.hitos).filter((v) => v === "P").length;
    const N = Object.values(r.hitos).filter((v) => v === "N").length;
    return { L, P, N };
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Centro</div>
        <div className="flex items-end justify-between mt-1">
          <h1 className="text-2xl font-bold">Informes de desarrollo</h1>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por apellido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <select
            value={filterEco}
            onChange={(e) => setFilterEco(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            disabled={ecoNumber != null}
          >
            <option value="">Todas las salas</option>
            {rooms.map((r: any) => (
              <option key={r.id} value={r.ecoNumber}>{r.name}</option>
            ))}
          </select>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los períodos</option>
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {reportsQ.isPending && (
          <p className="text-center py-12 text-gray-400 text-sm">Cargando informes...</p>
        )}

        {!reportsQ.isPending && byChild.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search || filterEco || filterPeriod ? "Sin resultados para ese filtro" : "Todavía no hay informes cargados"}
            </p>
            <button onClick={() => setShowNew(true)} className="mt-4 text-violet-600 text-sm font-semibold hover:underline flex items-center gap-1 mx-auto">
              <Plus className="w-4 h-4" />Crear el primer informe
            </button>
          </div>
        )}

        <div className="space-y-2">
          {byChild.map(({ childId, nombre, apellido, reports: childReports }) => (
            <div key={childId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="font-bold text-sm text-gray-900">{apellido}, {nombre}</p>
                <p className="text-xs text-gray-400">Sala ECO {childReports[0].ecoNumber ?? 0}</p>
              </div>
              {childReports.map((r) => {
                const { L, P, N } = hitoSummary(r);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50/50 transition-colors border-b border-gray-50 last:border-0 text-left"
                  >
                    <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{r.period}</p>
                      <div className="flex gap-2 mt-0.5">
                        {L > 0 && <span className="text-[10px] font-bold text-green-600">{L}L</span>}
                        {P > 0 && <span className="text-[10px] font-bold text-amber-600">{P}P</span>}
                        {N > 0 && <span className="text-[10px] font-bold text-red-500">{N}N</span>}
                        {r.lider && <span className="text-[10px] text-gray-400">· {r.lider}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && <ReportModal report={selected} onClose={() => setSelected(null)} logoBase64={logoBase64} />}
      {showNew && centerId && (
        <NewReportModal
          centerId={centerId}
          defaultEco={ecoNumber}
          onClose={() => setShowNew(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["all-reports"] })}
        />
      )}
    </div>
  );
}
