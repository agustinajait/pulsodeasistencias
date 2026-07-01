import React, { useState, useMemo } from "react";
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
  firmaLiderData?: string | null;
  firmaLiderAt?: string | null;
  firmaFacilitadoraData?: string | null;
  firmaFacilitadoraAt?: string | null;
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
  dni?: string | null;
  fnac?: string | null;
  famNombre?: string | null;
  famApellido?: string | null;
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
function fmtFirmaFecha(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function SignaturePad({ onSave, onCancel }: { onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const hasDrawnRef = React.useRef(false);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    hasDrawnRef.current = true;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    if (ctx) { ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#1e1147"; ctx.lineTo(x, y); ctx.stroke(); }
  }

  function end() { drawingRef.current = false; }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return;
    onSave(canvas.toDataURL("image/png"));
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={140}
        className="w-full h-[140px] bg-white rounded-md border border-dashed border-gray-300 touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} className="flex-1 min-w-[100px]">Guardar firma</Button>
        <Button type="button" size="sm" variant="outline" onClick={clear} className="flex-1 min-w-[100px]">Limpiar</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="flex-1 min-w-[100px]">Cancelar</Button>
      </div>
    </div>
  );
}

function SignatureBlock({
  label, name, data, at, canSign, onSign, onClear,
}: {
  label: string;
  name: string;
  data?: string | null;
  at?: string | null;
  canSign: boolean;
  onSign: (dataUrl: string | null) => void;
  onClear: () => void;
}) {
  const [drawing, setDrawing] = useState(false);

  if (!name) return null;

  if (at) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest">✓ Firmado por {label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{name} · {fmtFirmaFecha(at)}</p>
          </div>
          {canSign && (
            <button onClick={onClear} className="text-[11px] font-semibold text-gray-400 hover:text-red-500 shrink-0">Volver a firmar</button>
          )}
        </div>
        {data && data !== "CONFIRMADO" && (
          <img src={data} alt={`Firma ${label}`} className="h-12 mt-2 object-contain" />
        )}
      </div>
    );
  }

  if (!canSign) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg px-3 py-2.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label} sin firmar</p>
      </div>
    );
  }

  if (drawing) {
    return <SignaturePad onSave={(d) => { onSign(d); setDrawing(false); }} onCancel={() => setDrawing(false)} />;
  }

  return (
    <div className="border border-dashed border-violet-300 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold text-violet-700">Firmar como {label} ({name})</p>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => setDrawing(true)} className="text-[11px] font-bold text-violet-600 hover:text-violet-800 border border-violet-400 hover:border-violet-600 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition-colors">Dibujar firma</button>
        <button onClick={() => onSign(null)} className="text-[11px] font-bold text-gray-500 hover:text-gray-700 border border-gray-300 hover:border-gray-500 bg-white px-2.5 py-1 rounded-lg transition-colors">Confirmar</button>
      </div>
    </div>
  );
}

function ReportPreview({
  childName, period, ecoNumber, lider, facilitadora, hitos, textos, observaciones, template, logoBase64,
  firmaLiderData, firmaFacilitadoraData,
}: {
  childName: string | null; period: string; ecoNumber: number; lider: string; facilitadora: string;
  hitos: Record<string, HitoVal>; textos: Record<string, string>; observaciones: string;
  template: { eje: string; hitos: string[]; inf: string[] }[]; logoBase64?: string;
  firmaLiderData?: string | null; firmaFacilitadoraData?: string | null;
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
              {firmaLiderData && firmaLiderData !== "CONFIRMADO" && (
                <img src={firmaLiderData} alt="Firma líder" className="h-10 object-contain mx-auto mb-1" />
              )}
              <div className="border-t border-gray-400 pt-2 mt-8">
                <p className="text-xs font-semibold text-gray-700">{lider}</p>
                <p className="text-[10px] text-gray-400">Líder pedagógica</p>
              </div>
            </div>
          )}
          {facilitadora && (
            <div className="flex-1 text-center">
              {firmaFacilitadoraData && firmaFacilitadoraData !== "CONFIRMADO" && (
                <img src={firmaFacilitadoraData} alt="Firma facilitadora" className="h-10 object-contain mx-auto mb-1" />
              )}
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

async function fetchProfile(centerId: number | null): Promise<{ logoBase64?: string; directorNombre?: string; coordinadorNombre?: string; email?: string; reportPeriods?: string[] } | null> {
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
  const [mobilePreview, setMobilePreview] = useState(false);

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

  async function handleSave(statusOverride?: string | React.MouseEvent) {
    const resolvedStatus = typeof statusOverride === "string" ? statusOverride : "borrador";
    if (!selectedChild) { toast({ title: "Seleccioná un niño/a", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/children/${selectedChild.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, ecoNumber: eco, lider: lider || null, facilitadora: facilitadora || null, hitos, textos, observaciones: observaciones || null, status: resolvedStatus }),
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{height: '100dvh'}}>
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-start justify-between max-w-7xl mx-auto">
          <div>
            <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Nuevo</div>
            <h2 className="text-xl font-bold mt-0.5">Informe de desarrollo</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobilePreview((v) => !v)}
              className="lg:hidden text-xs font-semibold text-white/70 hover:text-white border border-white/30 rounded-lg px-2.5 py-1 transition-colors"
            >
              {mobilePreview ? "← Editar" : "Vista previa"}
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ── Formulario (izquierda) — oculto en mobile cuando se muestra preview ── */}
        <div className={`${mobilePreview ? "hidden lg:flex" : "flex"} flex-1 overflow-y-auto px-5 py-4 space-y-5 max-w-2xl w-full mx-auto flex-col`}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div key={h} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 py-1">
                      <span className="text-sm text-gray-700 flex-1 leading-snug">{h}</span>
                      <div className="flex gap-2 shrink-0">
                        {(["L","P","N"] as HitoVal[]).map((v) => (
                          <button key={v!} onClick={() => setHito(h, val === v ? null : v)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors min-w-[56px] ${
                              val === v ? HITO_COLOR[v!] + " border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-dashed border-violet-200">
            <div className="flex-1">
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
              className="shrink-0 text-[11px] font-bold text-violet-600 hover:text-violet-800 border border-violet-400 hover:border-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto"
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

        {/* ── Vista previa — desktop siempre, mobile cuando mobilePreview=true ── */}
        <div className={`${mobilePreview ? "flex" : "hidden lg:flex"} flex-col lg:w-[420px] xl:w-[500px] flex-1 lg:flex-none shrink-0 bg-gray-50 overflow-y-auto`}>
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

      {/* footer — fixed at bottom, always visible */}
      <div className="px-4 py-4 border-t border-gray-100 bg-white shrink-0 space-y-2">
        {!selectedChild && (
          <p className="text-xs text-center text-amber-600 font-semibold">⚠ Primero buscá y seleccioná un niño/a arriba</p>
        )}
        <Button onClick={handleSave} disabled={saving || !selectedChild} className="w-full">
          {saving ? "Guardando..." : "Guardar borrador"}
        </Button>
        <Button onClick={() => handleSave("en_revision")} disabled={saving || !selectedChild} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
          {saving ? "Enviando..." : "Enviar para validar"}
        </Button>
      </div>
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
  const [firmaLiderData, setFirmaLiderData] = useState<string | null | undefined>(report.firmaLiderData);
  const [firmaLiderAt, setFirmaLiderAt] = useState<string | null | undefined>(report.firmaLiderAt);
  const [firmaFacilitadoraData, setFirmaFacilitadoraData] = useState<string | null | undefined>(report.firmaFacilitadoraData);
  const [firmaFacilitadoraAt, setFirmaFacilitadoraAt] = useState<string | null | undefined>(report.firmaFacilitadoraAt);

  const isCoord = userRole === "admin" || userRole === "superadmin" || userRole === "coordinacion";
  const isSala = !isCoord;
  const [mobilePreview, setMobilePreview] = useState(false);

  async function sign(role: "lider" | "facilitadora", data: string | null) {
    try {
      const res = await fetch(`${BASE}/children/${report.childId}/reports/${report.id}/sign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, data }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (role === "lider") { setFirmaLiderData(updated.firmaLiderData); setFirmaLiderAt(updated.firmaLiderAt); }
        else { setFirmaFacilitadoraData(updated.firmaFacilitadoraData); setFirmaFacilitadoraAt(updated.firmaFacilitadoraAt); }
        toast({ title: "Firma guardada" });
        onSaved();
      } else {
        toast({ title: "Error al firmar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  }

  async function clearSign(role: "lider" | "facilitadora") {
    try {
      const res = await fetch(`${BASE}/children/${report.childId}/reports/${report.id}/sign?role=${role}`, { method: "DELETE" });
      if (res.ok) {
        if (role === "lider") { setFirmaLiderData(null); setFirmaLiderAt(null); }
        else { setFirmaFacilitadoraData(null); setFirmaFacilitadoraAt(null); }
        onSaved();
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  }

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
      hitoList.filter((h) => hitos[h] != null).map((h) => {
        const val = hitos[h]!;
        const color = val === "L" ? "#dcfce7;color:#166534" : val === "P" ? "#fef9c3;color:#92400e" : "#fee2e2;color:#991b1b";
        const label = val === "L" ? "✓ Logrado" : val === "P" ? "En proceso" : "No logrado";
        return `<tr><td class="td-area">${eje}</td><td class="td-hito">${h}</td><td class="td-estado" style="background:${color}">${label}</td></tr>`;
      })
    ).join("");
    const textoSections = template.filter(({ eje }) => textos[eje]).map(({ eje }) => textos[eje].trim()).join(" ");
    const firmaLiderImg = firmaLiderData && firmaLiderData !== "CONFIRMADO" ? `<img src="${firmaLiderData}" style="height:40px;object-fit:contain;display:block;margin:0 auto"/>` : "";
    const firmaFacilitadoraImg = firmaFacilitadoraData && firmaFacilitadoraData !== "CONFIRMADO" ? `<img src="${firmaFacilitadoraData}" style="height:40px;object-fit:contain;display:block;margin:0 auto"/>` : "";
    const firmaLider = lider ? `<div class="firma">${firmaLiderImg}<div class="firma-linea"></div><div class="firma-nombre">${lider}</div><div class="firma-rol">Líder pedagógica${firmaLiderAt ? ` · Firmado ${fmtFirmaFecha(firmaLiderAt)}` : ""}</div></div>` : "";
    const firmaFacilitadora = facilitadora ? `<div class="firma">${firmaFacilitadoraImg}<div class="firma-linea"></div><div class="firma-nombre">${facilitadora}</div><div class="firma-rol">Facilitadora${firmaFacilitadoraAt ? ` · Firmado ${fmtFirmaFecha(firmaFacilitadoraAt)}` : ""}</div></div>` : "";
    const firmas = (firmaLider || firmaFacilitadora) ? `<div class="firmas">${firmaLider}${firmaFacilitadora}</div>` : "";
    const logoHtml = logoBase64
      ? `<img id="logo" src="${logoBase64}" style="height:64px;object-fit:contain;display:block" alt="Logo"/>`
      : `<div style="font-size:20px;font-weight:900;color:#1e1147;letter-spacing:-1px">Koratic</div>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe — ${childName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#1a1a2e;padding:32px 36px;max-width:800px;margin:0 auto}
      .header{display:flex;align-items:center;gap:20px;padding-bottom:16px;border-bottom:3px solid #1e1147;margin-bottom:20px}
      .header-text h1{font-size:20px;font-weight:800;color:#1e1147;margin-bottom:2px}
      .header-text p{font-size:11px;color:#6b7280}
      .meta{margin-bottom:16px;padding:12px 16px;background:#f5f4fb;border-radius:8px;border-left:4px solid #7c3aed}
      .meta-nombre{font-size:15px;font-weight:800;color:#1e1147}
      .meta-sub{font-size:11px;color:#6b7280;margin-top:3px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}
      th{background:#1e1147;color:white;padding:7px 10px;text-align:left;font-weight:700}
      .td-area{padding:5px 10px;border:1px solid #e5e7eb;color:#6b7280;font-size:10px;white-space:nowrap;width:130px}
      .td-hito{padding:5px 10px;border:1px solid #e5e7eb;color:#374151}
      .td-estado{padding:5px 10px;border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:700;white-space:nowrap;width:90px;border-radius:4px}
      tr:nth-child(even) .td-area, tr:nth-child(even) .td-hito{background:#fafafa}
      .sintesis{margin-bottom:20px}
      .sintesis h2{font-size:13px;font-weight:800;color:#1e1147;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
      .sintesis p{line-height:1.8;color:#374151;font-size:12px}
      .obs{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:24px}
      .obs strong{display:block;margin-bottom:4px;color:#1e1147}
      .firmas{display:flex;gap:48px;margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb}
      .firma{flex:1;text-align:center}
      .firma-linea{border-top:1px solid #374151;margin-bottom:6px}
      .firma-nombre{font-size:12px;font-weight:700;color:#1e1147}
      .firma-rol{font-size:10px;color:#6b7280;margin-top:2px}
      @media print{body{padding:20px 24px}@page{margin:12mm}}
    </style>
    </head><body>
    <div class="header">
      ${logoHtml}
      <div class="header-text">
        <h1>Informe de Desarrollo</h1>
        <p>Período: ${report.period} &nbsp;·&nbsp; Sala ECO ${report.ecoNumber ?? 0}</p>
      </div>
    </div>
    <div class="meta">
      <div class="meta-nombre">${childName}</div>
      <div class="meta-sub">${[lider ? `Líder: ${lider}` : "", facilitadora ? `Facilitadora: ${facilitadora}` : ""].filter(Boolean).join(" &nbsp;·&nbsp; ")}</div>
    </div>
    <table>
      <thead><tr><th>Área</th><th>Hito</th><th style="width:90px;text-align:center">Estado</th></tr></thead>
      <tbody>${hitoRows}</tbody>
    </table>
    ${textoSections ? `<div class="sintesis"><h2>Síntesis de desarrollo</h2><p>${textoSections}</p></div>` : ""}
    ${observaciones ? `<div class="obs"><strong>Observaciones generales:</strong>${observaciones}</div>` : ""}
    ${firmas}
    <script>
      ${logoBase64 ? `document.getElementById('logo').onload=function(){window.print()};document.getElementById('logo').onerror=function(){window.print()};` : "window.print();"}
    </script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{height: '100dvh'}}>
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
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setMobilePreview((v) => !v)}
              className="lg:hidden text-xs font-semibold text-white/70 hover:text-white border border-white/30 rounded-lg px-2.5 py-1 transition-colors"
            >
              {mobilePreview ? "← Editar" : "Vista previa"}
            </button>
            <button onClick={onClose} className="text-white/60 hover:text-white p-1"><X className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ── Formulario (izquierda) ── */}
        <div className={`${mobilePreview ? "hidden lg:flex lg:flex-col" : "flex flex-col"} flex-1 overflow-y-auto px-5 py-4 space-y-5 max-w-2xl w-full mx-auto`}>
            {/* líder / facilitadora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div key={h} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 py-1">
                        <span className="text-sm text-gray-700 flex-1 leading-snug">{h}</span>
                        <div className="flex gap-2 shrink-0">
                          {(["L","P","N"] as HitoVal[]).map((v) => (
                            <button key={v!} onClick={() => setHito(h, val === v ? null : v)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors min-w-[56px] ${val === v ? HITO_COLOR[v!] + " border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}>
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-t border-dashed border-violet-200">
              <div className="flex-1">
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
                className="shrink-0 text-[11px] font-bold text-violet-600 hover:text-violet-800 border border-violet-400 hover:border-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors w-full sm:w-auto"
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

            {/* firmas */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Firmas</p>
              <SignatureBlock
                label="Líder"
                name={lider}
                data={firmaLiderData}
                at={firmaLiderAt}
                canSign={isSala}
                onSign={(d) => sign("lider", d)}
                onClear={() => clearSign("lider")}
              />
              <SignatureBlock
                label="Facilitadora"
                name={facilitadora}
                data={firmaFacilitadoraData}
                at={firmaFacilitadoraAt}
                canSign={isSala}
                onSign={(d) => sign("facilitadora", d)}
                onClear={() => clearSign("facilitadora")}
              />
            </div>
          </div>

        {/* ── Vista previa (derecha) ── */}
        <div className={`${mobilePreview ? "flex" : "hidden lg:flex"} flex-col lg:w-[420px] xl:w-[500px] w-full shrink-0 bg-gray-50 overflow-y-auto`}>
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
              firmaLiderData={firmaLiderData}
              firmaFacilitadoraData={firmaFacilitadoraData}
            />
          </div>
        </div>
      </div>

      {/* footer — siempre visible, fuera del scroll */}
      <div className="px-4 py-4 border-t border-gray-100 bg-white shrink-0 space-y-2">
        {isSala && (
          <>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Guardando..." : "Guardar borrador"}
              </Button>
              {status !== "aprobado" && (
                <Button onClick={() => saveWithStatus("en_revision")} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                  {saving ? "Enviando..." : "Enviar para validar"}
                </Button>
              )}
            </div>
            <button onClick={handlePrint} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600 border border-gray-200 rounded-lg px-3 py-2">
              <Printer className="w-3.5 h-3.5" />Imprimir / PDF
            </button>
          </>
        )}
        {isCoord && (
          <>
            {(lider || facilitadora) && (
              <p className="text-[11px] text-gray-400 text-center">
                {lider && (firmaLiderAt ? `✓ Líder firmó el ${fmtFirmaFecha(firmaLiderAt)}` : "⚠ Líder sin firmar")}
                {lider && facilitadora && " · "}
                {facilitadora && (firmaFacilitadoraAt ? `✓ Facilitadora firmó el ${fmtFirmaFecha(firmaFacilitadoraAt)}` : "⚠ Facilitadora sin firmar")}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
              {status !== "aprobado" && (
                <Button onClick={() => saveWithStatus("aprobado")} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  {saving ? "Aprobando..." : "Aprobar informe"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600 border border-gray-200 rounded-lg px-3 py-2">
                <Printer className="w-3.5 h-3.5" />Imprimir / PDF
              </button>
              <button onClick={handleDelete} className="text-xs font-semibold text-red-400 hover:text-red-600 px-4 py-2 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                Eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
type FollowupReport = {
  id?: number;
  childId?: number;
  nombre?: string;
  apellido?: string;
  centerId?: number;
  fecha?: string;
  lider?: string;
  facilitadora?: string;
  ecoNumber?: number;
  dniNino?: string;
  fechaNacNino?: string;
  adultNombre?: string;
  adultDni?: string;
  bodyText?: string;
  firmanteNombre?: string;
  firmanteTitulo?: string;
  firmanteMatricula?: string;
  firmaLiderData?: string | null;
  firmaLiderAt?: string | null;
  firmaFirmanteData?: string | null;
  firmaFirmanteAt?: string | null;
  createdAt?: string;
};

function calcEdad(fnac: string): string {
  const parts = fnac.split(/[\/\-]/);
  if (parts.length < 3) return "";
  const [d, m, y] = parts.length === 3 && fnac.includes("/") ? parts : [parts[2], parts[1], parts[0]];
  const birth = new Date(Number(y), Number(m) - 1, Number(d));
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  const yStr = years > 0 ? `${years} año${years !== 1 ? "s" : ""}` : "";
  const mStr = months > 0 ? `${months} mes${months !== 1 ? "es" : ""}` : "";
  return [yStr, mStr].filter(Boolean).join(" y ") || "menos de 1 mes";
}

function fmtFechaLarga(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}

// ── FollowupReportModal ────────────────────────────────────────────────────
function FollowupReportModal({
  centerId, centerName, report, children: childList, logoBase64, email, onClose, onSaved,
}: {
  centerId: number;
  centerName?: string | null;
  report?: FollowupReport | null;
  children: Child[];
  logoBase64?: string;
  email?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!report?.id;

  const [childSearch, setChildSearch] = useState("");
  const [selectedChild, setSelectedChild] = useState<Child | null>(
    report?.childId ? { id: report.childId, nombre: report.nombre ?? "", apellido: report.apellido ?? "", ecoNumber: report.ecoNumber } : null
  );
  const [fecha, setFecha] = useState(report?.fecha ?? new Date().toISOString().slice(0, 10));
  const [lider, setLider] = useState(report?.lider ?? "");
  const [facilitadora, setFacilitadora] = useState(report?.facilitadora ?? "");
  const [dniNino, setDniNino] = useState(report?.dniNino ?? "");
  const [fechaNacNino, setFechaNacNino] = useState(report?.fechaNacNino ?? "");
  const [adultNombre, setAdultNombre] = useState(report?.adultNombre ?? "");
  const [adultDni, setAdultDni] = useState(report?.adultDni ?? "");
  const [bodyText, setBodyText] = useState(report?.bodyText ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [firmanteNombre, setFiremanteNombre] = useState(report?.firmanteNombre ?? "");
  const [firmanteTitulo, setFirmanteTitulo] = useState(report?.firmanteTitulo ?? "");
  const [firmanteMatricula, setFiremanteMatricula] = useState(report?.firmanteMatricula ?? "");
  const [firmaLiderData, setFirmaLiderData] = useState<string | null | undefined>(report?.firmaLiderData);
  const [firmaLiderAt, setFirmaLiderAt] = useState<string | null | undefined>(report?.firmaLiderAt);
  const [firmaFirmanteData, setFirmaFirmanteData] = useState<string | null | undefined>(report?.firmaFirmanteData);
  const [firmaFirmanteAt, setFirmaFirmanteAt] = useState<string | null | undefined>(report?.firmaFirmanteAt);
  const [saving, setSaving] = useState(false);

  async function sign(role: "lider" | "firmante", data: string | null) {
    if (!report?.id) return;
    try {
      const res = await fetch(`${BASE}/followup-reports/${report.id}/sign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, data }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (role === "lider") { setFirmaLiderData(updated.firmaLiderData); setFirmaLiderAt(updated.firmaLiderAt); }
        else { setFirmaFirmanteData(updated.firmaFirmanteData); setFirmaFirmanteAt(updated.firmaFirmanteAt); }
        toast({ title: "Firma guardada" });
        onSaved();
      } else { toast({ title: "Error al firmar", variant: "destructive" }); }
    } catch { toast({ title: "Error de conexión", variant: "destructive" }); }
  }

  async function clearSign(role: "lider" | "firmante") {
    if (!report?.id) return;
    try {
      const res = await fetch(`${BASE}/followup-reports/${report.id}/sign?role=${role}`, { method: "DELETE" });
      if (res.ok) {
        if (role === "lider") { setFirmaLiderData(null); setFirmaLiderAt(null); }
        else { setFirmaFirmanteData(null); setFirmaFirmanteAt(null); }
        onSaved();
      }
    } catch { toast({ title: "Error de conexión", variant: "destructive" }); }
  }

  const filteredChildren = useMemo(() => {
    const q = childSearch.toLowerCase();
    if (!q) return childList.slice(0, 40);
    return childList.filter((c) => `${c.apellido} ${c.nombre}`.toLowerCase().includes(q)).slice(0, 40);
  }, [childList, childSearch]);

  async function handleSave() {
    if (!selectedChild && !isEdit) { toast({ title: "Seleccioná un niño/a", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        childId: selectedChild?.id ?? report?.childId,
        centerId,
        fecha, lider: lider || null, facilitadora: facilitadora || null,
        ecoNumber: selectedChild?.ecoNumber ?? report?.ecoNumber,
        dniNino: dniNino || null, fechaNacNino: fechaNacNino || null,
        adultNombre: adultNombre || null, adultDni: adultDni || null,
        bodyText: bodyText || null,
        firmanteNombre: firmanteNombre || null,
        firmanteTitulo: firmanteTitulo || null,
        firmanteMatricula: firmanteMatricula || null,
      };
      const url = isEdit ? `${BASE}/followup-reports/${report!.id}` : `${BASE}/followup-reports`;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const saved = await res.json();
        toast({ title: isEdit ? "Informe actualizado" : "Informe creado" });
        if (!isEdit) {
          onSaved();
        } else {
          // stay open; only update firma state if server returned real data
          if (saved.firmaLiderData != null) { setFirmaLiderData(saved.firmaLiderData); setFirmaLiderAt(saved.firmaLiderAt); }
          if (saved.firmaFirmanteData != null) { setFirmaFirmanteData(saved.firmaFirmanteData); setFirmaFirmanteAt(saved.firmaFirmanteAt); }
          onSaved();
        }
      }
      else { const b = await res.json().catch(() => ({})); toast({ title: "Error al guardar", description: b?.error ?? `Error ${res.status}`, variant: "destructive" }); }
    } catch { toast({ title: "Error de conexión", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const childName = selectedChild ? `${selectedChild.apellido} ${selectedChild.nombre}` : (report ? `${report.apellido} ${report.nombre}` : "");
    const ecoNum = selectedChild?.ecoNumber ?? report?.ecoNumber;
    const edad = fechaNacNino ? ` Edad: ${calcEdad(fechaNacNino)}.` : "";
    const fechaStr = fmtFechaLarga(fecha);
    const logoHtml = logoBase64
      ? `<img id="logo" src="${logoBase64}" style="height:72px;object-fit:contain;display:block" alt="Logo"/>`
      : `<div style="font-size:22px;font-weight:900;color:#1e1147">Koratic</div>`;
    const mkFirmaBlock = (nombre: string, rol: string, data?: string | null, at?: string | null) => {
      const img = data && data !== "CONFIRMADO" ? `<img src="${data}" style="height:38px;object-fit:contain;display:block;margin-bottom:4px"/>` : "";
      const ts = at ? ` · Firmado ${fmtFirmaFecha(at)}` : "";
      return `<div style="flex:1;text-align:center">${img}<div style="border-top:1px solid #374151;margin-bottom:6px"></div><div style="font-size:12px;font-weight:700;color:#1e1147">${nombre}</div><div style="font-size:10px;color:#6b7280">${rol}${ts}</div></div>`;
    };
    const firmaBlocks = [
      lider ? mkFirmaBlock(lider, "Líder pedagógica", firmaLiderData, firmaLiderAt) : "",
      firmanteNombre ? mkFirmaBlock(firmanteNombre, [firmanteTitulo, firmanteMatricula ? `M.P. ${firmanteMatricula}` : ""].filter(Boolean).join(" · "), firmaFirmanteData, firmaFirmanteAt) : "",
    ].filter(Boolean);
    const firmaHtml = firmaBlocks.length
      ? `<div style="display:flex;gap:40px;margin-top:48px;justify-content:center">${firmaBlocks.join("")}</div>`
      : "";
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe — ${childName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#1a1a1a;padding:40px 56px;max-width:800px;margin:0 auto;line-height:1.6}
      .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px}
      .fecha{font-size:12pt;text-align:right}
      .section-title{text-decoration:underline;font-weight:bold;margin-bottom:6px;margin-top:20px;font-size:12pt}
      .section-body{margin-bottom:20px;font-size:12pt}
      p{margin-bottom:12px;text-align:justify}
      .cierre{margin-top:24px}
      @media print{body{padding:20px 40px}@page{margin:15mm}}
    </style>
    </head><body>
    <div class="header">
      ${logoHtml}
      <div class="fecha">Bs. As. el ${fechaStr}</div>
    </div>
    <p class="section-title">Datos de la niño/a:</p>
    <div class="section-body">
      <p>Nombre y apellido: ${childName}.</p>
      ${fechaNacNino ? `<p>Fecha de nacimiento: ${fechaNacNino}.${edad}</p>` : ""}
      ${dniNino ? `<p>DNI: ${dniNino}</p>` : ""}
    </div>
    ${adultNombre ? `<p class="section-title">Datos del adulto/a responsable:</p><div class="section-body"><p>Nombre y apellido: ${adultNombre}.</p>${adultDni ? `<p>DNI: ${adultDni}</p>` : ""}</div>` : ""}
    <p>Desde el Centro de Primera Infancia "${centerName ?? "CAIPLI"}"${lider ? `, a cargo de ${lider}` : ""}${ecoNum ? `, sala ECO ${ecoNum}` : ""}, nos dirigimos a quien corresponda a fin de elevar el informe de seguimiento para poner en conocimiento la situación en que se encuentra actualmente el/la niño/a ${(selectedChild?.nombre ?? report?.nombre ?? "").split(" ")[0]}.</p>
    ${bodyText ? `<p>${bodyText.replace(/\n/g, "</p><p>")}</p>` : ""}
    <div class="cierre">
      <p>Quedo a disposición para ampliar información o trabajar de manera conjunta.</p>
      ${email ? `<p>Mail de contacto: ${email}</p>` : ""}
      <p style="margin-top:16px">Saluda atentamente,</p>
    </div>
    ${firmaHtml}
    <script>
      window.onload = function() { window.print(); };
    </script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ height: "100dvh" }}>
      {/* header */}
      <div className="bg-[#1e1147] text-white px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-start justify-between max-w-7xl mx-auto">
          <div>
            <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Informe de seguimiento</div>
            <h2 className="text-xl font-bold mt-0.5">{isEdit ? `${report!.apellido}, ${report!.nombre}` : "Nuevo informe"}</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1 mt-1"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 max-w-2xl w-full mx-auto">
        {/* child selector */}
        {!isEdit && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Niño/a</p>
            {selectedChild ? (
              <div className="flex items-center justify-between border border-violet-300 bg-violet-50 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-violet-800">{selectedChild.apellido}, {selectedChild.nombre}</span>
                <button onClick={() => setSelectedChild(null)} className="text-violet-400 hover:text-violet-600"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input placeholder="Buscar por apellido..." value={childSearch} onChange={(e) => setChildSearch(e.target.value)} className="text-sm" />
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {filteredChildren.map((c) => (
                    <button key={c.id} onClick={() => {
                        setSelectedChild(c);
                        setChildSearch("");
                        if (c.dni && !dniNino) setDniNino(c.dni);
                        if (c.fnac && !fechaNacNino) setFechaNacNino(c.fnac);
                        const adultName = [c.famApellido, c.famNombre].filter(Boolean).join(", ");
                        if (adultName && !adultNombre) setAdultNombre(adultName);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors">
                      <span className="font-medium">{c.apellido}, {c.nombre}</span>
                      {c.ecoNumber != null && <span className="text-gray-400 text-xs ml-2">ECO {c.ecoNumber}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* fecha */}
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Fecha del informe</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </div>

        {/* datos del niño */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Datos del niño/a</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">DNI</label>
              <Input value={dniNino} onChange={(e) => setDniNino(e.target.value)} placeholder="Ej: 70.123.456" className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Fecha de nacimiento</label>
              <Input value={fechaNacNino} onChange={(e) => setFechaNacNino(e.target.value)} placeholder="DD/MM/AAAA" className="text-sm" />
              {fechaNacNino && <p className="text-[10px] text-gray-400 mt-0.5">{calcEdad(fechaNacNino)}</p>}
            </div>
          </div>
        </div>

        {/* datos adulto responsable */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Adulto/a responsable</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Nombre y apellido</label>
              <Input value={adultNombre} onChange={(e) => setAdultNombre(e.target.value)} placeholder="Apellido, Nombre" className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">DNI</label>
              <Input value={adultDni} onChange={(e) => setAdultDni(e.target.value)} placeholder="Ej: 30.123.456" className="text-sm" />
            </div>
          </div>
        </div>

        {/* líder / facilitadora */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Líder</label>
            <Input value={lider} onChange={(e) => setLider(e.target.value)} placeholder="Nombre" className="text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Facilitadora</label>
            <Input value={facilitadora} onChange={(e) => setFacilitadora(e.target.value)} placeholder="Nombre" className="text-sm" />
          </div>
        </div>

        {/* texto libre */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contenido del informe</label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const sc = selectedChild ?? (report as any);
                    const childFullName = sc ? `${sc.apellido ?? ""} ${sc.nombre ?? ""}`.trim() : "";
                    const age = fechaNacNino ? calcEdad(fechaNacNino) : undefined;
                    const ecoN = selectedChild?.ecoNumber ?? report?.ecoNumber;
                    const r = await fetch(`${BASE}/ai/generate-followup-text`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        childName: childFullName,
                        childAge: age,
                        sala: ecoN ? `ECO ${ecoN}` : undefined,
                        lider: lider || undefined,
                        facilitadora: facilitadora || undefined,
                        adultNombre: adultNombre || undefined,
                        existingText: bodyText || undefined,
                      }),
                    });
                    const data = await r.json();
                    if (data.text) setBodyText(data.text);
                    else toast({ title: data.error ?? "Error al generar texto", variant: "destructive" });
                  } catch {
                    toast({ title: "Error al generar texto", variant: "destructive" });
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium disabled:opacity-50"
              >
                {aiLoading ? (
                  <span className="animate-spin inline-block w-3 h-3 border border-violet-500 border-t-transparent rounded-full" />
                ) : (
                  <span>✦</span>
                )}
                {bodyText.trim().length > 30 ? "Mejorar texto" : "Generar texto"}
              </button>
            </div>
          </div>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Redactá el informe de seguimiento aquí. Podés describir el período de adaptación, rutinas, comportamiento social, lenguaje, desarrollo motriz, etc."
            rows={10}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        {/* firmante */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Firmante</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Nombre y apellido</label>
              <Input value={firmanteNombre} onChange={(e) => setFiremanteNombre(e.target.value)} placeholder="Nombre del firmante" className="text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">Título profesional</label>
              <Input value={firmanteTitulo} onChange={(e) => setFirmanteTitulo(e.target.value)} placeholder="Ej: Lic. en Psicopedagogía" className="text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-gray-400 block mb-1">Matrícula</label>
              <Input value={firmanteMatricula} onChange={(e) => setFiremanteMatricula(e.target.value)} placeholder="Ej: 273365" className="text-sm" />
            </div>
          </div>
        </div>

        {/* firmas — solo en modo edición */}
        {isEdit && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Firmas</p>
            <SignatureBlock
              label="Líder"
              name={lider || "Líder"}
              data={firmaLiderData}
              at={firmaLiderAt}
              canSign={!!lider}
              onSign={(data) => sign("lider", data)}
              onClear={() => clearSign("lider")}
            />
            <SignatureBlock
              label="Firmante"
              name={firmanteNombre || "Firmante"}
              data={firmaFirmanteData}
              at={firmaFirmanteAt}
              canSign={!!firmanteNombre}
              onSign={(data) => sign("firmante", data)}
              onClear={() => clearSign("firmante")}
            />
          </div>
        )}
      </div>

      {/* footer */}
      <div className="px-4 py-4 border-t border-gray-100 bg-white shrink-0 space-y-2">
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Guardar informe"}
          </Button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-violet-600 border border-gray-200 rounded-lg px-3 py-2">
            <Printer className="w-3.5 h-3.5" />PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Informes() {
  const { centerId, role, centerName } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isCoord = role === "admin" || role === "superadmin" || role === "coordinacion";
  const ecoNumber = role?.startsWith("sala") ? parseInt(role.slice(4)) : null;
  const profileQ = useQuery({ queryKey: ["center-profile", centerId], queryFn: () => fetchProfile(centerId), enabled: !!centerId });
  const logoBase64 = profileQ.data?.logoBase64;
  const periods = (profileQ.data?.reportPeriods?.length ? profileQ.data.reportPeriods : null) ?? PERIODS;

  const urlParams = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<"desarrollo" | "seguimiento">(urlParams.get("tab") === "seguimiento" ? "seguimiento" : "desarrollo");
  const urlChildId = urlParams.get("childId") ? Number(urlParams.get("childId")) : null;
  const [search, setSearch] = useState("");
  const [filterEco, setFilterEco] = useState<string>(ecoNumber != null ? String(ecoNumber) : "");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState<FollowupReport | null>(null);
  const [showNewFollowup, setShowNewFollowup] = useState(() => urlParams.get("tab") === "seguimiento" && !!urlParams.get("childId"));

  const roomsQ = useListRooms();
  const rooms = (roomsQ.data ?? []).filter((r: any) => !centerId || r.centerId === centerId);

  const reportsQ = useQuery({
    queryKey: ["all-reports", centerId, filterEco, filterPeriod],
    queryFn: () => fetchReports(centerId, filterEco !== "" ? Number(filterEco) : null, filterPeriod || undefined),
    enabled: !!centerId,
  });

  const followupQ = useQuery<FollowupReport[]>({
    queryKey: ["followup-reports", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const r = await fetch(`${BASE}/followup-reports?centerId=${centerId}`);
      return r.ok ? r.json() : [];
    },
    enabled: !!centerId,
  });
  const followupReports = followupQ.data ?? [];

  const filteredFollowups = useMemo(() => {
    let list = urlChildId ? followupReports.filter((r) => r.childId === urlChildId) : followupReports;
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((r) => `${r.nombre} ${r.apellido}`.toLowerCase().includes(q));
  }, [followupReports, search, urlChildId]);

  const childrenForFollowup = useQuery<Child[]>({
    queryKey: ["children-for-followup", centerId],
    queryFn: () => centerId ? fetch(`${BASE}/children?centerId=${centerId}`).then(r => r.json()).then(d => (d.children ?? d ?? []).map((c: any) => ({ id: c.id, nombre: c.nombre, apellido: c.apellido, ecoNumber: c.eco_number ?? c.ecoNumber, dni: c.dni, fnac: c.fnac, famNombre: c.famNombre ?? c.fam_nombre, famApellido: c.famApellido ?? c.fam_apellido }))) : Promise.resolve([]),
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

  const pendingCount = useMemo(() =>
    isCoord ? reports.filter((r) => (r.status ?? "borrador") === "en_revision").length : 0,
    [reports, isCoord]
  );

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-4 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Informes</div>
        <div className="flex items-end justify-between mt-1 mb-4">
          <h1 className="text-2xl font-bold">{tab === "desarrollo" ? "Desarrollo" : "Seguimiento"}</h1>
          <button
            onClick={() => tab === "desarrollo" ? setShowNew(true) : setShowNewFollowup(true)}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-1.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />Nuevo
          </button>
        </div>
        {/* tab switcher */}
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setTab("desarrollo")}
            className={`flex-1 text-sm font-semibold py-1.5 rounded-lg transition-colors ${tab === "desarrollo" ? "bg-white text-[#1e1147]" : "text-white/70 hover:text-white"}`}
          >
            Desarrollo
          </button>
          <button
            onClick={() => setTab("seguimiento")}
            className={`flex-1 text-sm font-semibold py-1.5 rounded-lg transition-colors ${tab === "seguimiento" ? "bg-white text-[#1e1147]" : "text-white/70 hover:text-white"}`}
          >
            Seguimiento
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">

        {tab === "desarrollo" && (<>

        {/* Alerta informes pendientes de validación */}
        {isCoord && pendingCount > 0 && (
          <button
            onClick={() => setFilterStatus("en_revision")}
            className="w-full flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-left hover:bg-amber-100 transition-colors"
          >
            <span className="text-2xl shrink-0">📋</span>
            <div className="flex-1">
              <p className="font-bold text-sm text-amber-800">
                {pendingCount === 1 ? "1 informe pendiente de validar" : `${pendingCount} informes pendientes de validar`}
              </p>
              <p className="text-xs text-amber-600">Tocá para ver los informes en revisión</p>
            </div>
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">{pendingCount}</span>
          </button>
        )}

        {/* filters */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 sm:flex-1 sm:min-w-[160px]">
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
                          {isCoord && (r.lider || r.facilitadora) && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              (!r.lider || r.firmaLiderAt) && (!r.facilitadora || r.firmaFacilitadoraAt)
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-400"
                            }`}>
                              {(!r.lider || r.firmaLiderAt) && (!r.facilitadora || r.firmaFacilitadoraAt) ? "✓ Firmado" : "Sin firmar"}
                            </span>
                          )}
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

        </>)}

        {/* ── SEGUIMIENTO TAB ── */}
        {tab === "seguimiento" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar por apellido..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-sm" />
            </div>

            {followupQ.isPending && <p className="text-center py-12 text-gray-400 text-sm">Cargando...</p>}

            {!followupQ.isPending && filteredFollowups.length === 0 && (
              <div className="text-center py-16">
                <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No hay informes de seguimiento</p>
                <button onClick={() => setShowNewFollowup(true)} className="mt-4 text-violet-600 text-sm font-semibold hover:underline flex items-center gap-1 mx-auto">
                  <Plus className="w-4 h-4" />Crear el primer informe
                </button>
              </div>
            )}

            <div className="space-y-2">
              {filteredFollowups.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setSelectedFollowup(r)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-violet-50/50 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{r.apellido}, {r.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.fecha ? fmtFechaLarga(r.fecha) : "—"}
                        {r.ecoNumber ? ` · ECO ${r.ecoNumber}` : ""}
                        {r.firmanteNombre ? ` · ${r.firmanteNombre}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
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
      {(showNewFollowup || selectedFollowup) && centerId && (
        <FollowupReportModal
          centerId={centerId}
          centerName={centerName}
          report={selectedFollowup ?? (urlChildId && !selectedFollowup ? (() => { const c = (childrenForFollowup.data ?? []).find(x => x.id === urlChildId); return c ? { childId: c.id, nombre: c.nombre, apellido: c.apellido, ecoNumber: c.ecoNumber } : null; })() : null)}
          children={childrenForFollowup.data ?? []}
          logoBase64={logoBase64}
          email={profileQ.data?.email}
          onClose={() => { setShowNewFollowup(false); setSelectedFollowup(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["followup-reports"] }); }}
        />
      )}
    </div>
  );
}
