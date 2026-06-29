import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListRooms } from "@workspace/api-client-react";
import { Search, FileText, ChevronRight, X, Printer, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

// ── Types ──────────────────────────────────────────────────────────────────
type HitoVal = "L" | "P" | "N" | null;

type ReportStatus = "borrador" | "en_revision" | "aprobado";

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
  status?: ReportStatus;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = { borrador: "Borrador", en_revision: "En revisión", aprobado: "Aprobado" };
const STATUS_CLASS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-500",
  en_revision: "bg-amber-100 text-amber-700",
  aprobado: "bg-green-100 text-green-700",
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
    { eje: "Motricidad gruesa", hitos: ["Se desplaza (rola o gatea)","Mueve las piernas al estar acostado","Agarra objetos con ambas manos","Permanece sentado","Si está boca abajo puede levantar el pecho extendiendo los brazos","Gira la cabeza al escuchar sonidos","Se pone de pie agarrándose de muebles","Gatea","Levanta y tira objetos","Sostiene la cabeza"], inf: ["desplazarse (rolar o gatear)","mover las piernas al estar acostado","agarrar objetos con ambas manos","permanecer sentado","levantar el pecho extendiendo los brazos al estar boca abajo","girar la cabeza al escuchar sonidos","ponerse de pie agarrándose de muebles","gatear","levantar y tirar objetos","sostener la cabeza"] },
    { eje: "Motricidad fina", hitos: ["Intenta alcanzar objetos que cuelgan","Sigue con la mirada lo que sucede a su alrededor","Agarra objetos con una mano","Usa manos para darse de comer a si mismo"], inf: ["intentar alcanzar objetos que cuelgan","seguir con la mirada lo que sucede a su alrededor","agarrar objetos con una mano","usar las manos para darse de comer solo"] },
    { eje: "Cognitivo", hitos: ["Sonríe hacia su imagen en el espejo","Se interesa por las imágenes","Se da cuenta de los cambios","Muestra si está sorprendido","Mueve obstáculos para alcanzar lo que desea","Responde saludos","Reconoce"], inf: ["sonreír hacia su imagen en el espejo","interesarse por las imágenes","darse cuenta de los cambios","mostrar sorpresa","mover obstáculos para alcanzar lo que desea","responder a saludos","reconocer personas conocidas"] },
    { eje: "Social", hitos: ["Se vincula con las líderes del espacio","Responde a su nombre","Reconoce a familiares","Sonríe","Mantiene contacto visual"], inf: ["vincularse con las líderes del espacio","responder a su nombre","reconocer a familiares","sonreír","mantener contacto visual"] },
    { eje: "Emocional", hitos: ["Llora si no se siente cómodo"], inf: ["expresar incomodidad a través del llanto"] },
    { eje: "Lenguaje", hitos: ["Emite sonidos para comunicarse","Responde a gestos o expresiones"], inf: ["emitir sonidos para comunicarse","responder a gestos o expresiones"] },
  ],
  1: [
    { eje: "Motricidad gruesa", hitos: ["Camina y corre solo","Se sube a su silla","Patea y lanza la pelota","Levanta objetos del suelo en cuclillas","Se agacha y se levanta sin apoyo","Empuja y arrastra objetos"], inf: ["caminar y correr solo","subirse a su silla","patear y lanzar la pelota","levantar objetos del suelo en cuclillas","agacharse y levantarse sin apoyo","empujar y arrastrar objetos"] },
    { eje: "Motricidad fina", hitos: ["Manipula objetos pequeños (como cubos por ejemplo)","Come con cuchara","Pasa las páginas del libro","Apila 2 a 4 cubos","Usa ambas manos para jugar"], inf: ["manipular objetos pequeños","comer con cuchara","pasar las páginas del libro","apilar 2 a 4 cubos","usar ambas manos para jugar"] },
    { eje: "Cognitivo", hitos: ["Busca juguetes escondidos","Trasvasado"], inf: ["buscar juguetes escondidos","realizar trasvasado"] },
    { eje: "Social", hitos: ["Muestra curiosidad","Coopera en los momentos de guardado","Se interesa por sus compañeros/as","Puede expresar necesidades básicas con llanto o gestos","Logra almorzar sentado en la mesa"], inf: ["mostrar curiosidad","cooperar en los momentos de guardado","interesarse por sus compañeros/as","expresar necesidades básicas con llanto o gestos","almorzar sentado en la mesa"] },
    { eje: "Lenguaje", hitos: ["Dice su propio nombre","Expresa lo quiere alcanzar o pedir","Señala personas conocidas","Usa gestos como \"chau\" \"no\" \"mano\""], inf: ["decir su propio nombre","expresar lo que quiere alcanzar o pedir","señalar personas conocidas","usar gestos como \"chau\", \"no\", \"mano\""] },
  ],
  2: [
    { eje: "Motricidad gruesa", hitos: ["Camina corre y escala sin dificultad","Patea pelotas","Sube y baja escaleras sin ayuda","Salta con ambos pies","Se agacha sin dificultad","Camina para atrás"], inf: ["caminar, correr y escalar sin dificultad","patear pelotas","subir y bajar escaleras sin ayuda","saltar con ambos pies","agacharse sin dificultad","caminar para atrás"] },
    { eje: "Motricidad fina", hitos: ["Pasa páginas del libro","Realiza trazos o garabatos","Puede comer usando cubiertos y vaso"], inf: ["pasar páginas del libro","realizar trazos o garabatos","comer usando cubiertos y vaso"] },
    { eje: "Cognitivo", hitos: ["Reconoce objetos","Cuenta hasta 5","Sigue instrucciones dobles","Hace preguntas","Imita animales","Juega de manera simbólica","Reconoce colores"], inf: ["reconocer objetos","contar hasta 5","seguir instrucciones dobles","hacer preguntas","imitar animales","jugar de manera simbólica","reconocer colores"] },
    { eje: "Autonomía", hitos: ["Avisa si quiere ir al baño","Colabora con el guardado de los juguetes","Se saca algunas prendas"], inf: ["avisar cuando quiere ir al baño","colaborar con el guardado de los juguetes","sacarse algunas prendas"] },
    { eje: "Social", hitos: ["Acepta las propuestas de la líder","Muestra interés por compartir con sus pares","Respeta la rutina","Imita comportamientos de adultos","Busca aprobación del adulto"], inf: ["aceptar las propuestas de la líder","mostrar interés por compartir con sus pares","respetar la rutina","imitar comportamientos de adultos","buscar aprobación del adulto"] },
    { eje: "Emocional", hitos: ["Expresa emociones como enojo, alegría o frustración"], inf: ["expresar emociones como enojo, alegría o frustración"] },
    { eje: "Lenguaje", hitos: ["Nombra objetos o personas conocidas","Forma frases de 2 palabras o más"], inf: ["nombrar objetos o personas conocidas","formar frases de 2 palabras o más"] },
  ],
  3: [
    { eje: "Motricidad gruesa", hitos: ["Corre con mayor coordinación","Salta con ambos pies","Lanza, atrapa y patea pelotas","Evita obstáculos","Se viste con ayuda"], inf: ["correr con mayor coordinación","saltar con ambos pies","lanzar, atrapar y patear pelotas","evitar obstáculos","vestirse con ayuda"] },
    { eje: "Motricidad fina", hitos: ["Sostiene el lápiz con más control","Dibuja líneas, círculos","Empieza a pintar dentro de los límites","Come de manera independiente usando cuchara, tenedor y toma en vaso sin pico"], inf: ["sostener el lápiz con más control","dibujar líneas y círculos","pintar dentro de los límites","comer de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "Cognitivo", hitos: ["Reconoce colores, formas y algunos números","Resuelve problemas simples (por ejemplo: alcanzar objetos)","Arma torres con 8 o más bloques","Reconoce su nombre","Entiende cuentos simples y sigue la conversación"], inf: ["reconocer colores, formas y algunos números","resolver problemas simples","armar torres con 8 o más bloques","reconocer su nombre","entender cuentos simples y seguir la conversación"] },
    { eje: "Social", hitos: ["Juega con sus compañeros","Juego simbólico","Entiende reglas de juego y de convivencia","Participa de las actividades grupales propuestas por la líder"], inf: ["jugar con sus compañeros","realizar juego simbólico","entender reglas de juego y de convivencia","participar de las actividades grupales propuestas por la líder"] },
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
    const parts: string[] = [];
    if (logra.length) parts.push(`${first} logra ${joinList(logra)}, lo que refleja un avance muy valioso en su desarrollo.`);
    if (proceso.length) parts.push(`Se encuentra avanzando hacia ${joinList(proceso)}, y desde el equipo acompañamos ese proceso con mucho entusiasmo.`);
    if (noLogra.length) parts.push(`Continuamos trabajando junto a ${first} en el camino hacia ${joinList(noLogra)}, brindando el acompañamiento necesario y confiando plenamente en sus posibilidades.`);
    result[eje] = parts.join(" ").trim();
  }
  return result;
}

const HITO_COLOR: Record<string, string> = {
  L: "bg-green-100 text-green-700",
  P: "bg-amber-100 text-amber-700",
  N: "bg-red-100 text-red-700",
};
const HITO_LABEL: Record<string, string> = { L: "Logrado", P: "En proceso", N: "No logrado" };

// ── Shared report preview (mirrors the printed output) ────────────────────
function ReportPreview({
  childName, period, ecoNumber, lider, facilitadora, hitos, textos, observaciones, template, logoBase64,
}: {
  childName: string | null; period: string; ecoNumber: number; lider: string; facilitadora: string;
  hitos: Record<string, HitoVal>; textos: Record<string, string>; observaciones: string;
  template: { eje: string; hitos: string[]; inf: string[] }[]; logoBase64?: string;
}) {
  const hasContent = childName || Object.values(hitos).some(Boolean);
  if (!hasContent) return (
    <p className="text-xs text-gray-300 italic text-center py-8">Completá el formulario para ver la vista previa</p>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-sm overflow-hidden">
      {/* header del informe */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        {logoBase64 && <img src={logoBase64} alt="Logo" className="h-10 object-contain mb-3" />}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-base text-gray-900">{childName ?? "—"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{period} · Sala ECO {ecoNumber}</p>
            {(lider || facilitadora) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {lider && `Líder: ${lider}`}{lider && facilitadora && " · "}{facilitadora && `Facilitadora: ${facilitadora}`}
              </p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-[10px] font-bold text-[#1e1147] uppercase tracking-widest">Informe de Desarrollo</p>
            <p className="text-[9px] text-gray-400 mt-0.5">Koratic</p>
          </div>
        </div>
      </div>

      {/* tabla de hitos */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Hitos de desarrollo</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600 w-1/3">Área</th>
              <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600">Hito</th>
              <th className="text-center px-2 py-1.5 border border-gray-200 font-semibold text-gray-600 w-20">Estado</th>
            </tr>
          </thead>
          <tbody>
            {template.flatMap(({ eje, hitos: hitoList }) =>
              hitoList.map((h, i) => {
                const val = hitos[h] ?? null;
                return (
                  <tr key={h} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-2 py-1 border border-gray-100 text-gray-500 align-top">{i === 0 ? eje : ""}</td>
                    <td className="px-2 py-1 border border-gray-100 text-gray-700">{h}</td>
                    <td className="px-2 py-1 border border-gray-100 text-center">
                      {val ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${HITO_COLOR[val]}`}>{HITO_LABEL[val]}</span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* síntesis narrativa — texto corrido sin encabezados de área */}
      {template.some(({ eje }) => textos[eje]) && (
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Síntesis de desarrollo</p>
          <p className="text-xs text-gray-700 leading-relaxed">
            {template.filter(({ eje }) => textos[eje]).map(({ eje }) => textos[eje].trim()).join(" ")}
          </p>
        </div>
      )}

      {/* observaciones */}
      {observaciones && (
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones generales</p>
          <p className="text-xs text-gray-700 leading-relaxed">{observaciones}</p>
        </div>
      )}

      {/* firmas */}
      {(lider || facilitadora) && (
        <div className="px-5 py-5 flex gap-6">
          {lider && (
            <div className="flex-1 text-center">
              <div className="border-t border-gray-400 pt-2 mt-8">
                <p className="text-xs font-semibold text-gray-700">{lider}</p>
                <p className="text-[10px] text-gray-400">Líder pedagógica</p>
              </div>
            </div>
          )}
          {facilitadora && (
            <div className="flex-1 text-center">
              <div className="border-t border-gray-400 pt-2 mt-8">
                <p className="text-xs font-semibold text-gray-700">{facilitadora}</p>
                <p className="text-[10px] text-gray-400">Facilitadora</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const PERIODS = ["1er trimestre","2do trimestre","3er trimestre","1er cuatrimestre","2do cuatrimestre","Anual"];

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchReports(centerId: number | null, ecoNumber?: number | null, period?: string): Promise<Report[]> {
  if (!centerId) return [];
  let qs = `?centerId=${centerId}`;
  if (ecoNumber != null) qs += `&ecoNumber=${ecoNumber}`;
  if (period) qs += `&period=${period}`;
  const r = await fetch(`${BASE}/reports${qs}`);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.detail ?? body?.error ?? `Error ${r.status}`);
  }
  return r.json();
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

async function fetchProfile(centerId: number | null): Promise<{ logoBase64?: string; directorNombre?: string; reportPeriods?: string[] } | null> {
  if (!centerId) return null;
  const r = await fetch(`${BASE}/centers/${centerId}/profile`);
  return r.ok ? r.json() : null;
}

// ── NewReportModal ─────────────────────────────────────────────────────────
function NewReportModal({
  centerId,
  defaultEco,
  periods,
  onClose,
  onSaved,
  logoBase64,
}: {
  centerId: number;
  defaultEco: number | null;
  periods: string[];
  onClose: () => void;
  onSaved: () => void;
  logoBase64?: string;
}) {
  const { toast } = useToast();
  const childrenQ = useQuery({ queryKey: ["children-for-informe", centerId], queryFn: () => fetchChildren(centerId) });
  const allChildren = childrenQ.data ?? [];
  const existingQ = useQuery({ queryKey: ["all-reports", centerId, null, null], queryFn: () => fetchReports(centerId) });
  const existingReports = existingQ.data ?? [];

  const [childSearch, setChildSearch] = useState("");
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [period, setPeriod] = useState(periods[0] ?? PERIODS[0]);
  const [eco, setEco] = useState<number>(defaultEco ?? 0);
  const [lider, setLider] = useState("");
  const [facilitadora, setFacilitadora] = useState("");
  const [hitos, setHitos] = useState<Record<string, HitoVal>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const template = ECO_TEMPLATES[eco] ?? [];

  const childrenWithReport = useMemo(() => {
    const ids = new Set<number>();
    existingReports.forEach((r) => { if (r.period === period) ids.add(r.childId); });
    return ids;
  }, [existingReports, period]);

  const filteredChildren = useMemo(() => {
    const q = childSearch.toLowerCase();
    let list = allChildren;
    if (defaultEco != null) list = list.filter((c) => c.ecoNumber === defaultEco);
    if (!q) return list.slice(0, 30);
    return list.filter((c) => `${c.apellido} ${c.nombre}`.toLowerCase().includes(q)).slice(0, 30);
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
    try {
      const res = await fetch(`${BASE}/children/${selectedChild.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, ecoNumber: eco, lider: lider || null, facilitadora: facilitadora || null, hitos, textos, observaciones: observaciones || null }),
      });
      if (res.ok) {
        toast({ title: "Informe guardado" });
        onSaved();
        onClose();
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Error al guardar", description: body?.error ?? `Error ${res.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo contactar al servidor", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const childName = selectedChild ? `${selectedChild.apellido}, ${selectedChild.nombre}` : null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-start justify-between max-w-7xl mx-auto">
          <div>
            <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Nuevo</div>
            <h2 className="text-xl font-bold mt-0.5">Informe de desarrollo</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Formulario (izquierda) ── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 max-w-2xl w-full mx-auto">
          {/* child search */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Niño/a</p>
            {selectedChild ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                  <span className="text-sm font-semibold text-violet-900">{selectedChild.apellido}, {selectedChild.nombre}</span>
                  <button onClick={() => setSelectedChild(null)} className="text-violet-400 hover:text-red-500 ml-2"><X className="w-4 h-4" /></button>
                </div>
                {childrenWithReport.has(selectedChild.id) && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-medium">
                    ⚠ {selectedChild.nombre} ya tiene un informe para <strong>{period}</strong>. Si guardás, se creará uno duplicado.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="Buscar por apellido..." value={childSearch} onChange={(e) => setChildSearch(e.target.value)} className="pl-9 text-sm" />
                </div>
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {filteredChildren.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">Sin resultados</p>}
                  {[...filteredChildren].sort((a, b) => {
                    const aHas = childrenWithReport.has(a.id) ? 1 : 0;
                    const bHas = childrenWithReport.has(b.id) ? 1 : 0;
                    return aHas - bHas;
                  }).map((c) => {
                    const tieneInforme = childrenWithReport.has(c.id);
                    return (
                      <button key={c.id} onClick={() => { setSelectedChild(c); setEco(c.ecoNumber ?? defaultEco ?? 0); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors flex items-center justify-between ${tieneInforme ? "opacity-50" : ""}`}>
                        <span>
                          <span className="font-semibold">{c.apellido}, {c.nombre}</span>
                          {c.ecoNumber != null && <span className="text-xs text-gray-400 ml-2">ECO {c.ecoNumber}</span>}
                        </span>
                        {tieneInforme
                          ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0 ml-2">Ya tiene</span>
                          : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0 ml-2">Pendiente</span>
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Período</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {periods.map((p) => <option key={p} value={p}>{p}</option>)}
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
          {!selectedChild && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium text-center">
              Seleccioná un niño/a para completar los hitos de desarrollo
            </div>
          )}
          {selectedChild && template.map(({ eje, hitos: hitoList }) => (
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
                const generated = autoGenerateTextos(template, hitos, nombre);
                setTextos((prev) => {
                  const merged: Record<string, string> = { ...prev };
                  for (const eje of Object.keys(generated)) {
                    const existing = (prev[eje] ?? "").trim();
                    const auto = generated[eje].trim();
                    merged[eje] = auto ? (existing ? `${existing} ${auto}` : auto) : existing;
                  }
                  return merged;
                });
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

        <div className="px-5 py-4 border-t border-gray-100 shrink-0 max-w-2xl w-full mx-auto space-y-2">
          {!selectedChild && (
            <p className="text-xs text-center text-amber-600 font-semibold">⚠ Primero buscá y seleccioná un niño/a arriba</p>
          )}
          <Button onClick={handleSave} disabled={saving || !selectedChild} className="w-full">
            {saving ? "Guardando..." : "Guardar informe"}
          </Button>
        </div>
        </div>{/* end left col */}

        {/* ── Vista previa (derecha) ── */}
        <div className="hidden lg:flex flex-col w-[420px] xl:w-[500px] shrink-0 bg-gray-50 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vista previa · Informe para la familia</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <ReportPreview
              childName={childName}
              period={period}
              ecoNumber={eco}
              lider={lider}
              facilitadora={facilitadora}
              hitos={hitos}
              textos={textos}
              observaciones={observaciones}
              template={template}
              logoBase64={logoBase64}
            />
          </div>
        </div>
      </div>{/* end flex body */}
    </div>
  );
}

// ── Report edit/detail modal ───────────────────────────────────────────────
function ReportModal({ report, onClose, onSaved, logoBase64, userRole }: { report: Report; onClose: () => void; onSaved: () => void; logoBase64?: string; userRole?: string | null }) {
  const { toast } = useToast();
  const template = ECO_TEMPLATES[report.ecoNumber ?? 0] ?? [];
  const childName = `${report.apellido}, ${report.nombre}`;

  const [hitos, setHitos] = useState<Record<string, HitoVal>>(report.hitos ?? {});
  const [textos, setTextos] = useState<Record<string, string>>(report.textos ?? {});
  const [lider, setLider] = useState(report.lider ?? "");
  const [facilitadora, setFacilitadora] = useState(report.facilitadora ?? "");
  const [observaciones, setObservaciones] = useState(report.observaciones ?? "");
  const [status, setStatus] = useState<ReportStatus>(report.status ?? "borrador");
  const [saving, setSaving] = useState(false);

  const isCoord = userRole === "admin" || userRole === "superadmin" || userRole === "coordinacion";
  const isSala = !isCoord;

  function setHito(h: string, val: HitoVal) { setHitos((hh) => ({ ...hh, [h]: val })); }
  function setTexto(eje: string, val: string) { setTextos((t) => ({ ...t, [eje]: val })); }

  async function saveWithStatus(newStatus: ReportStatus) {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/children/${report.childId}/reports/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: report.period, ecoNumber: report.ecoNumber, lider: lider || null, facilitadora: facilitadora || null, hitos, textos, observaciones: observaciones || null, status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        const msg = newStatus === "en_revision" ? "Informe enviado para validación" : newStatus === "aprobado" ? "Informe aprobado" : "Informe guardado";
        toast({ title: msg });
        onSaved();
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Error al guardar", description: body?.error ?? `Error ${res.status}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() { await saveWithStatus(status); }

  async function handleDelete() {
    if (!confirm(`¿Eliminár el informe de ${childName} (${report.period})? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${BASE}/children/${report.childId}/reports/${report.id}`, { method: "DELETE" });
      if (res.ok) { toast({ title: "Informe eliminado" }); onSaved(); }
      else toast({ title: "Error al eliminar", variant: "destructive" });
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  }

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const hitoRows = template.flatMap(({ eje, hitos: hitoList }) =>
      hitoList.map((h) => {
        const val = hitos[h] ?? null;
        const color = val === "L" ? "#dcfce7" : val === "P" ? "#fef9c3" : val === "N" ? "#fee2e2" : "#f9fafb";
        return `<tr><td style="padding:4px 8px;border:1px solid #e5e7eb">${eje}</td><td style="padding:4px 8px;border:1px solid #e5e7eb">${h}</td><td style="padding:4px 8px;border:1px solid #e5e7eb;background:${color}">${val ? HITO_LABEL[val] : "—"}</td></tr>`;
      })
    ).join("");
    const textoSections = template.filter(({ eje }) => textos[eje]).map(({ eje }) => textos[eje].trim()).join(" ");
    const logoHtml = logoBase64 ? `<img src="${logoBase64}" style="height:60px;object-fit:contain" alt="Logo"/>` : "";
    const firmaLider = lider ? `<div style="flex:1;text-align:center"><div style="border-top:1px solid #374151;padding-top:6px;margin-top:40px;font-size:11px;color:#374151">${lider}<br/><span style="color:#6b7280">Líder pedagógica</span></div></div>` : "";
    const firmaFacilitadora = facilitadora ? `<div style="flex:1;text-align:center"><div style="border-top:1px solid #374151;padding-top:6px;margin-top:40px;font-size:11px;color:#374151">${facilitadora}<br/><span style="color:#6b7280">Facilitadora</span></div></div>` : "";
    const firmas = (firmaLider || firmaFacilitadora) ? `<div style="display:flex;gap:40px;margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb">${firmaLider}${firmaFacilitadora}</div>` : "";
    w.document.write(`<html><head><title>Informe ${childName}</title>
      <style>body{font-family:sans-serif;font-size:12px;margin:32px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:6px 8px;border:1px solid #e5e7eb;text-align:left}.header{display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1e1147}@media print{body{margin:20px}}</style>
      </head><body>
      <div class="header">${logoHtml}<div style="margin-left:${logoBase64 ? "0" : "0"}"><h2 style="margin:0 0 2px 0;color:#1e1147">Informe de Desarrollo</h2><p style="margin:0;color:#6b7280;font-size:11px">Período: ${report.period}</p></div></div>
      <p style="margin:4px 0"><strong>Niño/a:</strong> ${childName}</p>
      ${lider ? `<p style="margin:4px 0;color:#6b7280;font-size:11px">Líder: ${lider}${facilitadora ? ` · Facilitadora: ${facilitadora}` : ""}</p>` : ""}
      <div style="margin-top:16px">
      <table><thead><tr><th>Área</th><th>Hito</th><th style="width:100px">Estado</th></tr></thead><tbody>${hitoRows}</tbody></table>
      </div>
      ${textoSections ? `<div style="margin-top:20px"><h3 style="margin-bottom:8px;color:#1e1147">Síntesis de desarrollo</h3><p style="line-height:1.8;color:#374151">${textoSections}</p></div>` : ""}
      ${observaciones ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px"><strong>Observaciones generales:</strong><br/>${observaciones}</div>` : ""}
      ${firmas}
      </body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-start justify-between max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Informe de desarrollo</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[status] ?? STATUS_CLASS.borrador}`}>{STATUS_LABEL[status] ?? status}</span>
            </div>
            <h2 className="text-xl font-bold mt-0.5">{childName}</h2>
            <p className="text-white/60 text-sm mt-0.5">Período: {report.period} · Sala ECO {report.ecoNumber ?? 0}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Formulario (izquierda) ── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-gray-100">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 max-w-2xl w-full mx-auto">
            {/* líder / facilitadora */}
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

            {/* hitos por eje */}
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
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${val === v ? HITO_COLOR[v!] + " border-transparent" : "bg-white text-gray-600 border-gray-400 hover:border-gray-700 hover:text-gray-800"}`}>
                              {HITO_LABEL[v!]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <textarea value={textos[eje] ?? ""} onChange={(e) => setTexto(eje, e.target.value)}
                    placeholder={`Síntesis narrativa — ${eje}...`} rows={2}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none text-gray-600" />
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
                  const generated = autoGenerateTextos(template, hitos, `${report.nombre} ${report.apellido}`.trim());
                  setTextos((prev) => {
                    const merged: Record<string, string> = { ...prev };
                    for (const eje of Object.keys(generated)) {
                      const existing = (prev[eje] ?? "").trim();
                      const auto = generated[eje].trim();
                      merged[eje] = auto ? (existing ? `${existing} ${auto}` : auto) : existing;
                    }
                    return merged;
                  });
                }}
                className="shrink-0 text-[11px] font-bold text-violet-600 hover:text-violet-800 border border-violet-400 hover:border-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Generar
              </button>
            </div>

            {/* observaciones */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Observaciones generales</p>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Observaciones adicionales..." rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none" />
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t border-gray-100 shrink-0 max-w-2xl w-full mx-auto flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600 border border-gray-200 rounded-lg px-3 py-2">
              <Printer className="w-3.5 h-3.5" />Imprimir / PDF
            </button>
            {isSala && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Guardando..." : "Guardar borrador"}
                </Button>
                {status !== "aprobado" && (
                  <Button onClick={() => saveWithStatus("en_revision")} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                    {saving ? "Enviando..." : "Enviar para validar"}
                  </Button>
                )}
              </>
            )}
            {isCoord && (
              <>
                <button onClick={handleDelete} className="text-xs font-semibold text-red-400 hover:text-red-600 px-2 py-2 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                  Eliminar
                </button>
                <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
                {status !== "aprobado" && (
                  <Button onClick={() => saveWithStatus("aprobado")} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                    {saving ? "Aprobando..." : "Aprobar informe"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Vista previa (derecha) ── */}
        <div className="hidden lg:flex flex-col w-[420px] xl:w-[500px] shrink-0 bg-gray-50 overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-200 bg-white shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vista previa · Informe para la familia</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <ReportPreview
              childName={childName}
              period={report.period}
              ecoNumber={report.ecoNumber ?? 0}
              lider={lider}
              facilitadora={facilitadora}
              hitos={hitos}
              textos={textos}
              observaciones={observaciones}
              template={template}
              logoBase64={logoBase64}
            />
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
  const { toast } = useToast();
  const isCoord = role === "admin" || role === "superadmin" || role === "coordinacion";
  const ecoNumber = role?.startsWith("sala") ? parseInt(role.slice(4)) : null;
  const profileQ = useQuery({ queryKey: ["center-profile", centerId], queryFn: () => fetchProfile(centerId), enabled: !!centerId });
  const logoBase64 = profileQ.data?.logoBase64;
  const periods = (profileQ.data?.reportPeriods?.length ? profileQ.data.reportPeriods : null) ?? PERIODS;

  const [search, setSearch] = useState("");
  const [filterEco, setFilterEco] = useState<string>(ecoNumber != null ? String(ecoNumber) : "");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
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
    return reports.filter((r) => {
      if (filterStatus && (r.status ?? "borrador") !== filterStatus) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) || r.apellido.toLowerCase().includes(q);
    });
  }, [reports, search, filterStatus]);

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
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobado">Aprobado</option>
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
                  <div key={r.id} className="flex items-center border-b border-gray-50 last:border-0 group">
                    <button
                      onClick={() => setSelected(r)}
                      className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-violet-50/50 transition-colors text-left min-w-0"
                    >
                      <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">{r.period}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_CLASS[r.status ?? "borrador"]}`}>{STATUS_LABEL[r.status ?? "borrador"]}</span>
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          {L > 0 && <span className="text-[10px] font-bold text-green-600">{L}L</span>}
                          {P > 0 && <span className="text-[10px] font-bold text-amber-600">{P}P</span>}
                          {N > 0 && <span className="text-[10px] font-bold text-red-500">{N}N</span>}
                          {r.lider && <span className="text-[10px] text-gray-400">· {r.lider}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                    {isCoord && (
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar informe de ${nombre} ${apellido} (${r.period})?`)) return;
                          const res = await fetch(`${BASE}/children/${r.childId}/reports/${r.id}`, { method: "DELETE" });
                          if (res.ok) { toast({ title: "Informe eliminado" }); qc.invalidateQueries({ queryKey: ["all-reports"] }); }
                          else toast({ title: "Error al eliminar", variant: "destructive" });
                        }}
                        className="px-3 py-3 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        title="Eliminar informe"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && <ReportModal report={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); qc.invalidateQueries({ queryKey: ["all-reports"] }); }} logoBase64={logoBase64} userRole={role} />}
      {showNew && centerId && (
        <NewReportModal
          centerId={centerId}
          defaultEco={ecoNumber}
          periods={periods}
          onClose={() => setShowNew(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["all-reports"] })}
          logoBase64={logoBase64}
        />
      )}
    </div>
  );
}
