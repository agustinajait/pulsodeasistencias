import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useGetChild, useCreateContact, useUpdateChild, useDischargeChild, useReinstateChild, useListAttendance, useListRooms, getGetChildQueryKey, getListChildrenQueryKey, getGetRoomsSummaryQueryKey, getGetDashboardSummaryQueryKey, getGetAlertsQueryKey, getListAttendanceQueryKey } from "@workspace/api-client-react";
import type { AttendanceRecord, Room } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Phone, ExternalLink, AlertTriangle, ChevronLeft, ChevronRight, Copy, CheckCircle2, Circle, FileText, RefreshCw, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { key: "dni_nino",    label: "DNI / Fotocopia niño/a" },
  { key: "acta_nac",   label: "Acta de nacimiento" },
  { key: "dni_padres", label: "DNI padres (con foto)" },
  { key: "apto_fisico",label: "Apto físico" },
  { key: "aut_retiro", label: "Autorización de retiro" },
  { key: "aut_llamada",label: "Autorización de llamada" },
  { key: "aut_fotos",  label: "Autorización de fotos" },
  { key: "carnet_vac", label: "Carnet de vacunas" },
] as const;

const MES_ACTUAL = new Date().toISOString().slice(0, 7);

type HitoVal = "L" | "P" | "N" | null;

const ECO_TEMPLATES: Record<number, { eje: string; hitos: string[]; inf: string[] }[]> = {
  1: [
    { eje: "MOTRICIDAD GRUESA",
      hitos: ["Camina y corre solo", "Se sube a su silla", "Patea y lanza la pelota", "Levanta objetos del suelo en cuclillas", "Se agacha y se levanta sin apoyo", "Empuja y arrastra objetos"],
      inf:   ["caminar y correr solo", "subirse a la silla", "patear y lanzar la pelota", "levantar objetos del suelo en cuclillas", "agacharse y levantarse sin apoyo", "empujar y arrastrar objetos"] },
    { eje: "MOTRICIDAD FINA",
      hitos: ["Manipula objetos pequeños (como cubos por ejemplo)", "Come con cuchara", "Pasa las páginas del libro", "Apila 2 a 4 cubos", "Usa ambas manos para jugar"],
      inf:   ["manipular objetos pequeños", "comer con cuchara", "pasar las páginas del libro", "apilar 2 a 4 cubos", "usar ambas manos para jugar"] },
    { eje: "COGNITIVO",
      hitos: ["Busca juguetes escondidos", "Trasvasado"],
      inf:   ["buscar juguetes escondidos", "realizar trasvasado"] },
    { eje: "SOCIAL",
      hitos: ["Muestra curiosidad", "Coopera en los momentos de guardado", "Se interesa por sus compañeros/as", "Puede expresar necesidades básicas con llanto o gestos", "Logra almorzar sentado en la mesa"],
      inf:   ["mostrar curiosidad", "cooperar en los momentos de guardado", "interesarse por sus compañeros/as", "expresar necesidades básicas con llanto o gestos", "almorzar sentado en la mesa"] },
    { eje: "LENGUAJE",
      hitos: ["Dice su propio nombre", "Expresa lo quiere alcanzar o pedir", "Señala personas conocidas", 'Usa gestos como "chau" "no" "mano"'],
      inf:   ["decir su propio nombre", "expresar lo que quiere alcanzar o pedir", "señalar personas conocidas", 'usar gestos como "chau", "no", "mano"'] },
  ],
  2: [
    { eje: "MOTRICIDAD GRUESA",
      hitos: ["Camina, corre y escala sin dificultad", "Patea pelotas", "Sube y baja escaleras sin ayuda", "Salta con ambos pies", "Se agacha sin dificultad", "Camina para atrás"],
      inf:   ["caminar, correr y escalar sin dificultad", "patear pelotas", "subir y bajar escaleras sin ayuda", "saltar con ambos pies", "agacharse sin dificultad", "caminar para atrás"] },
    { eje: "MOTRICIDAD FINA",
      hitos: ["Pasa páginas del libro", "Realiza trazos o garabatos", "Puede comer usando cubiertos y vaso"],
      inf:   ["pasar páginas del libro", "realizar trazos o garabatos", "comer usando cubiertos y vaso"] },
    { eje: "COGNITIVO",
      hitos: ["Reconoce objetos", "Cuenta hasta 5", "Sigue instrucciones dobles", "Hace preguntas", "Imita animales", "Juega de manera simbólica", "Reconoce colores"],
      inf:   ["reconocer objetos", "contar hasta 5", "seguir instrucciones dobles", "hacer preguntas", "imitar animales", "jugar de manera simbólica", "reconocer colores"] },
    { eje: "AUTONOMÍA",
      hitos: ["Avisa si quiere ir al baño", "Colabora con el guardado de los juguetes", "Se saca algunas prendas"],
      inf:   ["avisar cuando quiere ir al baño", "colaborar con el guardado de los juguetes", "sacarse algunas prendas"] },
    { eje: "SOCIAL",
      hitos: ["Acepta las propuestas de la líder", "Muestra interés por compartir con sus pares", "Respeta la rutina", "Imita comportamientos de adultos", "Busca aprobación del adulto"],
      inf:   ["aceptar las propuestas de la líder", "mostrar interés por compartir con sus pares", "respetar la rutina", "imitar comportamientos de adultos", "buscar aprobación del adulto"] },
    { eje: "EMOCIONAL",
      hitos: ["Expresa emociones como enojo, alegría o frustración"],
      inf:   ["expresar emociones como enojo, alegría o frustración"] },
    { eje: "LENGUAJE",
      hitos: ["Nombra objetos o personas conocidas", "Forma frases de 2 palabras o más"],
      inf:   ["nombrar objetos o personas conocidas", "formar frases de 2 palabras o más"] },
  ],
  3: [
    { eje: "MOTRICIDAD GRUESA",
      hitos: ["Corre con mayor coordinación", "Salta con ambos pies", "Lanza, atrapa y patea pelotas", "Evita obstáculos", "Se viste con ayuda"],
      inf:   ["correr con mayor coordinación", "saltar con ambos pies", "lanzar, atrapar y patear pelotas", "evitar obstáculos", "vestirse con ayuda"] },
    { eje: "MOTRICIDAD FINA",
      hitos: ["Sostiene el lápiz con más control", "Dibuja líneas, círculos", "Empieza a pintar dentro de los límites", "Come de manera independiente usando cuchara, tenedor y vaso sin pico"],
      inf:   ["sostener el lápiz con más control", "dibujar líneas y círculos", "pintar dentro de los límites", "comer de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "COGNITIVO",
      hitos: ["Reconoce colores, formas y algunos números", "Resuelve problemas simples (ej: alcanzar objetos)", "Arma torres con 8 o más bloques", "Reconoce su nombre", "Entiende cuentos simples y sigue la conversación"],
      inf:   ["reconocer colores, formas y algunos números", "resolver problemas simples", "armar torres con 8 o más bloques", "reconocer su nombre", "entender cuentos simples y seguir la conversación"] },
    { eje: "SOCIAL",
      hitos: ["Juega con sus compañeros", "Juego simbólico", "Entiende reglas de juego y de convivencia", "Participa de las actividades grupales propuestas por la líder"],
      inf:   ["jugar con sus compañeros", "realizar juego simbólico", "entender reglas de juego y de convivencia", "participar de las actividades grupales propuestas por la líder"] },
    { eje: "EMOCIONAL",
      hitos: ["Expresa emociones con palabras"],
      inf:   ["expresar emociones con palabras"] },
    { eje: "LENGUAJE",
      hitos: ["Forma oraciones sencillas", "Usa pronombres (yo, tu, él)"],
      inf:   ["formar oraciones sencillas", "usar pronombres (yo, tú, él)"] },
  ],
  4: [
    { eje: "MOTRICIDAD GRUESA",
      hitos: ["Corre con mayor coordinación", "Salta con ambos pies", "Lanza, atrapa y patea pelotas", "Evita obstáculos", "Se viste con ayuda"],
      inf:   ["correr con mayor coordinación", "saltar con ambos pies", "lanzar, atrapar y patear pelotas", "evitar obstáculos", "vestirse con ayuda"] },
    { eje: "MOTRICIDAD FINA",
      hitos: ["Sostiene el lápiz con más control", "Dibuja líneas, círculos", "Empieza a pintar dentro de los límites", "Come de manera independiente usando cuchara, tenedor y vaso sin pico"],
      inf:   ["sostener el lápiz con más control", "dibujar líneas y círculos", "pintar dentro de los límites", "comer de manera independiente usando cuchara, tenedor y vaso sin pico"] },
    { eje: "COGNITIVO",
      hitos: ["Reconoce colores, formas y algunos números", "Resuelve problemas simples", "Arma torres con 8 o más bloques", "Reconoce su nombre", "Entiende cuentos simples y sigue la conversación"],
      inf:   ["reconocer colores, formas y algunos números", "resolver problemas simples", "armar torres con 8 o más bloques", "reconocer su nombre", "entender cuentos simples y seguir la conversación"] },
    { eje: "SOCIAL",
      hitos: ["Juega con sus compañeros", "Juego simbólico", "Entiende reglas de juego y de convivencia", "Participa de las actividades grupales propuestas por la líder"],
      inf:   ["jugar con sus compañeros", "realizar juego simbólico", "entender reglas de juego y de convivencia", "participar de las actividades grupales propuestas por la líder"] },
    { eje: "EMOCIONAL",
      hitos: ["Expresa emociones con palabras"],
      inf:   ["expresar emociones con palabras"] },
    { eje: "LENGUAJE",
      hitos: ["Forma oraciones sencillas", "Usa pronombres (yo, tu, él)"],
      inf:   ["formar oraciones sencillas", "usar pronombres (yo, tú, él)"] },
  ],
};

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
  const [view, setView] = useState<"ficha" | "llamado" | "baja" | "historial" | "documentos" | "editar" | "informe">("ficha");
  const [histMonth, setHistMonth] = useState(MES_ACTUAL);

  // Docs state
  const [docsData, setDocsData] = useState<{ docsToken: string; panialesAuth: boolean; aptoFisico: boolean; autRetiro: boolean; autLlamada: boolean; autFotos: boolean; carnetVacunas: boolean; docs: {tipo:string;url:string;uploadedAt?:string}[] } | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  // Llamado form
  const [llFecha, setLlFecha] = useState(TODAY);
  const [llQuien, setLlQuien] = useState("");
  const [llMotivo, setLlMotivo] = useState(MOTIVO_CONTACTO_OPTIONS[0]);
  const [llObs, setLlObs] = useState("");
  const [llResultado, setLlResultado] = useState(RESULTADO_OPTIONS[0]);

  // Baja form
  const [bajaTipo, setBajaTipo] = useState<string>("");
  const [bajaObs, setBajaObs] = useState("");

  // Informe state
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [infPeriod, setInfPeriod] = useState(() => {
    const now = new Date();
    const t = Math.ceil(now.getMonth() / 4) || 1;
    return `${now.getFullYear()}-T${t}`;
  });
  const [infLider, setInfLider] = useState("");
  const [infFacilitadora, setInfFacilitadora] = useState("");
  const [infHitos, setInfHitos] = useState<Record<string, HitoVal>>({});
  const [infObs, setInfObs] = useState("");
  const [infTextos, setInfTextos] = useState<Record<string, string>>({});
  const [infSaving, setInfSaving] = useState(false);
  const [infMode, setInfMode] = useState<"list" | "edit" | "view" | "preview">("list");
  const [viewingReport, setViewingReport] = useState<any>(null);

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

  useEffect(() => {
    if (view === "informe") loadReports();
  }, [view]);

  const createContact = useCreateContact();
  const dischargeChild = useDischargeChild();
  const reinstateChild = useReinstateChild();
  const updateChild = useUpdateChild();
  const allRooms = useListRooms({});

  // Edit form state (populated when entering edit view)
  const [editRoomId, setEditRoomId] = useState("");
  const [editRegistro, setEditRegistro] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editDni, setEditDni] = useState("");
  const [editFnac, setEditFnac] = useState("");
  const [editGenero, setEditGenero] = useState("");
  const [editDomicilio, setEditDomicilio] = useState("");
  const [editBarrio, setEditBarrio] = useState("");
  const [editLocalidad, setEditLocalidad] = useState("");
  const [editFamApellido, setEditFamApellido] = useState("");
  const [editFamNombre, setEditFamNombre] = useState("");
  const [editVinculo, setEditVinculo] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEstAsist, setEditEstAsist] = useState("");
  const [editObs, setEditObs] = useState("");

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/children/${childId}/reports`);
      if (res.ok) setReportsList(await res.json());
    } finally {
      setReportsLoading(false);
    }
  }, [childId]);

  function joinList(items: string[]) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0].toLowerCase();
    return items.slice(0, -1).map((s) => s.toLowerCase()).join(", ") + " y " + items[items.length - 1].toLowerCase();
  }

  function autoGenerateTextos(template: { eje: string; hitos: string[]; inf: string[] }[], hitos: Record<string, HitoVal>, nombre: string) {
    const first = nombre.split(" ")[0] || "El/la niño/a";
    const result: Record<string, string> = {};
    for (const { eje, hitos: items, inf } of template) {
      const logra = items.map((h, i) => hitos[h] === "L" ? inf[i] : null).filter(Boolean) as string[];
      const proceso = items.map((h, i) => hitos[h] === "P" ? inf[i] : null).filter(Boolean) as string[];
      const noLogra = items.map((h, i) => hitos[h] === "N" ? inf[i] : null).filter(Boolean) as string[];
      let text = "";
      if (logra.length) text += `${first} logra ${joinList(logra)}. `;
      if (proceso.length) text += `Se encuentra en proceso de ${joinList(proceso)}. `;
      if (noLogra.length) text += `Aún no logra ${joinList(noLogra)}. `;
      result[eje] = text.trim() || `Sin observaciones registradas para ${eje}.`;
    }
    return result;
  }

  function enterNewReport() {
    setEditingReportId(null);
    setInfLider("");
    setInfFacilitadora("");
    setInfHitos({});
    setInfTextos({});
    setInfObs("");
    setInfMode("edit");
  }

  function enterEditReport(r: any) {
    setEditingReportId(r.id);
    setInfPeriod(r.period);
    setInfLider(r.lider ?? "");
    setInfFacilitadora(r.facilitadora ?? "");
    setInfHitos(r.hitos ?? {});
    setInfTextos(r.textos ?? {});
    setInfObs(r.observaciones ?? "");
    setInfMode("edit");
  }

  async function saveReport(ecoNumber: number) {
    setInfSaving(true);
    try {
      const body = { period: infPeriod, ecoNumber, lider: infLider, facilitadora: infFacilitadora, hitos: infHitos, textos: infTextos, observaciones: infObs };
      let res: Response;
      if (editingReportId) {
        res = await fetch(`/api/children/${childId}/reports/${editingReportId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch(`/api/children/${childId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Informe guardado correctamente" });
      await loadReports();
      setInfMode("list");
    } catch {
      toast({ title: "Error al guardar el informe", variant: "destructive" });
    } finally {
      setInfSaving(false);
    }
  }

  async function deleteReport(id: number) {
    if (!confirm("¿Eliminar este informe?")) return;
    await fetch(`/api/children/${childId}/reports/${id}`, { method: "DELETE" });
    await loadReports();
  }

  function buildReportHtml(r: any, childName: string, ecoNumber: number, roomName: string, template: { eje: string; hitos: string[]; inf: string[] }[]) {
    const LABEL: Record<string, string> = { L: "Logra", P: "En proceso", N: "Aún no logra" };
    const COLOR: Record<string, string> = { L: "#dcfce7;color:#15803d", P: "#fef9c3;color:#a16207", N: "#fee2e2;color:#b91c1c" };
    const logoUrl = `${window.location.origin}/logo-cpi.svg`;
    const rows = template.flatMap(({ eje, hitos }) =>
      hitos.map((hito, i) => {
        const val = (r.hitos ?? {})[hito] ?? null;
        const bg = val ? COLOR[val].split(";")[0].replace("background:", "") : "#f9fafb";
        const fg = val ? COLOR[val].split(";")[1]?.replace("color:", "") : "#6b7280";
        return `
          <tr>
            ${i === 0 ? `<td rowspan="${hits(eje, template)}" style="font-weight:700;font-size:11px;vertical-align:top;padding:6px 8px;border:1px solid #e5e7eb;background:#f3f4f6;text-transform:uppercase;letter-spacing:.5px">${eje}</td>` : ""}
            <td style="font-size:12px;padding:6px 8px;border:1px solid #e5e7eb">${hito}</td>
            <td style="text-align:center;padding:6px 8px;border:1px solid #e5e7eb;background:${bg};color:${fg};font-size:11px;font-weight:600;white-space:nowrap">${val ? LABEL[val] : "—"}</td>
          </tr>`;
      })
    ).join("");

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Informe ${childName} - ${r.period}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:32px;color:#111;font-size:13px}
        h2{margin:0 0 4px;font-size:18px} p{margin:0 0 2px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        @media print{body{margin:16px}}
      </style>
    </head><body>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;border-bottom:2px solid #e5e7eb;padding-bottom:16px">
        <img src="${logoUrl}" height="60" style="object-fit:contain" />
        <div>
          <h2 style="margin:0 0 4px;font-size:20px">${childName}</h2>
          <p style="color:#6b7280;font-size:12px;margin:0 0 2px">${roomName} (ECO ${ecoNumber}) · Período ${r.period}</p>
          <p style="color:#6b7280;font-size:12px;margin:0 0 2px">Fecha: ${new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"long", year:"numeric" })}</p>
          ${r.lider ? `<p style="font-size:12px;margin:0 0 1px">Líder pedagógica: <strong>${r.lider}</strong></p>` : ""}
          ${r.facilitadora ? `<p style="font-size:12px;margin:0">Facilitadora: <strong>${r.facilitadora}</strong></p>` : ""}
        </div>
      </div>
      <table><tbody>${rows}</tbody></table>
      ${Object.keys(r.textos ?? {}).length > 0 ? `
        <div style="margin-top:24px">
          <strong style="font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:.5px">Descripción por área</strong>
          ${template.map(({ eje }) => {
            const txt = (r.textos ?? {})[eje];
            return txt ? `<div style="margin-top:12px;padding:10px 12px;background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:4px"><p style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;margin:0 0 4px">${eje}</p><p style="font-size:13px;line-height:1.6;margin:0">${txt}</p></div>` : "";
          }).join("")}
        </div>` : ""}
      ${r.observaciones ? `<div style="margin-top:20px"><strong style="font-size:12px;text-transform:uppercase;color:#6b7280">Observaciones generales</strong><p style="margin-top:6px;line-height:1.6">${r.observaciones}</p></div>` : ""}
      <div style="margin-top:32px;display:flex;gap:40px;border-top:1px solid #e5e7eb;padding-top:20px">
        <div><p style="color:#6b7280;font-size:11px">FIRMA LÍDER PEDAGÓGICA</p><div style="margin-top:24px;border-top:1px solid #111;width:180px"></div></div>
        <div><p style="color:#6b7280;font-size:11px">FIRMA RESPONSABLE DEL NIÑO/A</p><div style="margin-top:24px;border-top:1px solid #111;width:180px"></div></div>
      </div>
    </body></html>`;
  }

  function hitsCount(eje: string, template: { eje: string; hitos: string[] }[]) {
    return template.find((e) => e.eje === eje)?.hitos.length ?? 1;
  }

  function hits(eje: string, template: { eje: string; hitos: string[] }[]) {
    return hitsCount(eje, template);
  }

  async function buildPdfBlob(r: any, childName: string, ecoNumber: number, roomName: string, template: { eje: string; hitos: string[]; inf: string[] }[]): Promise<Blob> {
    const html = buildReportHtml(r, childName, ecoNumber, roomName, template);
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:Arial,sans-serif;font-size:13px";
    container.innerHTML = html.replace(/^[\s\S]*<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      let yPos = 10;
      let remaining = imgH;
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - 20);
        pdf.addImage(imgData, "PNG", 10, yPos, imgW, imgH);
        remaining -= sliceH;
        if (remaining > 0) { pdf.addPage(); yPos = 10 - (imgH - sliceH); }
      }
      return pdf.output("blob");
    } finally {
      document.body.removeChild(container);
    }
  }

  async function handlePrintReport(r: any, childName: string, ecoNumber: number, roomName: string, template: { eje: string; hitos: string[]; inf: string[] }[]) {
    const blob = await buildPdfBlob(r, childName, ecoNumber, roomName, template);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-${childName.replace(/\s+/g, "-")}-${r.period}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function handleShareReport(r: any, childName: string, ecoNumber: number, roomName: string, template: { eje: string; hitos: string[]; inf: string[] }[]) {
    const blob = await buildPdfBlob(r, childName, ecoNumber, roomName, template);
    const fileName = `informe-${childName.replace(/\s+/g, "-")}-${r.period}.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Informe ${childName} - ${r.period}` });
      } else {
        // desktop fallback: download the PDF
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      // user cancelled share — do nothing
    }
  }

  function enterEditView() {
    const c = child.data;
    if (!c) return;
    setEditRoomId(String(c.roomId));
    setEditRegistro((c as any).registro ?? "");
    setEditApellido(c.apellido ?? "");
    setEditNombre(c.nombre ?? "");
    setEditDni(c.dni ?? "");
    setEditFnac(c.fnac ?? "");
    setEditGenero(c.genero ?? "");
    setEditDomicilio(c.domicilio ?? "");
    setEditBarrio((c as any).barrio ?? "");
    setEditLocalidad((c as any).localidad ?? "");
    setEditFamApellido(c.famApellido ?? "");
    setEditFamNombre(c.famNombre ?? "");
    setEditVinculo(c.vinculo ?? "");
    setEditCelular(c.celular ?? "");
    setEditEmail(c.email ?? "");
    setEditEstAsist(c.estAsist ?? "");
    setEditObs(c.obs ?? "");
    setView("editar");
  }

  function handleSaveEdit() {
    updateChild.mutate(
      {
        id: childId,
        data: {
          roomId: parseInt(editRoomId),
          registro: editRegistro || undefined,
          apellido: editApellido || undefined,
          nombre: editNombre || undefined,
          dni: editDni || undefined,
          fnac: editFnac || undefined,
          genero: editGenero || undefined,
          domicilio: editDomicilio || undefined,
          barrio: editBarrio || undefined,
          localidad: editLocalidad || undefined,
          famApellido: editFamApellido || undefined,
          famNombre: editFamNombre || undefined,
          vinculo: editVinculo || undefined,
          celular: editCelular || undefined,
          email: editEmail || undefined,
          estAsist: editEstAsist || undefined,
          obs: editObs || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Datos actualizados" });
          invalidateAll();
          setView("ficha");
        },
        onError: () => toast({ title: "Error al guardar", variant: "destructive" }),
      }
    );
  }

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

  async function handleUploadDoc(tipo: string, file: File) {
    setUploadingDoc(tipo);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/children/${childId}/upload-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fileBase64, mimeType: file.type, ext }),
      });
      if (res.ok) {
        toast({ title: "Documento subido" });
        await loadDocs();
      } else {
        toast({ title: "Error al subir el documento", variant: "destructive" });
      }
    } finally {
      setUploadingDoc(null);
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
        className={`bg-card rounded-t-2xl w-full max-w-xl flex flex-col shadow-2xl ${view === "informe" ? "h-[92vh]" : "max-h-[92vh]"}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="child-sheet"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            {view !== "ficha" && view !== "informe" && (
              <button onClick={() => setView("ficha")} className="text-muted-foreground hover:text-foreground flex items-center gap-1 mr-1" data-testid="btn-back-ficha">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {c && (
              <>
                <div>
                  <h2 className="text-base font-bold">{c.apellido} {c.nombre}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ECO {c.ecoNumber}
                    {(c.consecutiveAbsences ?? 0) >= 2 ? (
                      <span className="ml-2 text-red-600 font-semibold">
                        {c.consecutiveAbsences} días consecutivos sin asistir
                      </span>
                    ) : null}
                  </p>
                </div>
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
          <>
          {view === "informe" ? (() => {
            const childRoom = allRooms.data?.find((r: Room) => r.id === child.data?.roomId);
            const ecoNumber = (childRoom as any)?.ecoNumber ?? 1;
            const template = ECO_TEMPLATES[ecoNumber] ?? ECO_TEMPLATES[1];
            const HITO_VALS: { val: HitoVal; label: string; color: string }[] = [
              { val: "L", label: "Logra", color: "bg-green-100 text-green-700 border-green-300" },
              { val: "P", label: "En proceso", color: "bg-amber-100 text-amber-700 border-amber-300" },
              { val: "N", label: "Aún no", color: "bg-red-100 text-red-700 border-red-300" },
            ];
            return (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <button
                    onClick={() => {
                      if (infMode === "preview") setInfMode("view");
                      else if (infMode === "edit" || infMode === "view") setInfMode("list");
                      else setView("ficha");
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {infMode === "list" ? "Volver" : infMode === "preview" ? "Informe" : "Lista"}
                  </button>
                  <span className="text-sm font-semibold flex-1 text-center">
                    {infMode === "preview" ? "Vista previa" : infMode === "view" && viewingReport ? viewingReport.period : `Informe ECO ${ecoNumber}`}
                  </span>
                  {infMode === "list" && (
                    <button onClick={enterNewReport} className="text-xs text-primary font-semibold">+ Nuevo</button>
                  )}
                  {infMode === "view" && viewingReport && (
                    <button onClick={() => enterEditReport(viewingReport)} className="text-xs text-primary font-semibold">Editar</button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                  {infMode === "list" ? (
                    reportsLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
                    ) : reportsList.length === 0 ? (
                      <div className="text-center py-10 space-y-3">
                        <p className="text-sm text-muted-foreground">No hay informes registrados todavía.</p>
                        <button onClick={enterNewReport} className="text-sm font-semibold text-primary underline">Crear primer informe</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {reportsList.map((r: any) => {
                          const total = Object.keys(r.hitos ?? {}).length;
                          const logra = Object.values(r.hitos ?? {}).filter((v) => v === "L").length;
                          return (
                            <div
                              key={r.id}
                              className="border rounded-xl p-3 space-y-1 cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors"
                              onClick={() => { setViewingReport(r); setInfMode("view"); }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">{r.period}</span>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button onClick={() => { setViewingReport(r); setInfMode("view"); }} className="text-xs text-primary font-semibold underline">Ver</button>
                                  <button onClick={() => enterEditReport(r)} className="text-xs text-muted-foreground underline">Editar</button>
                                  <button onClick={() => deleteReport(r.id)} className="text-xs text-destructive underline">Eliminar</button>
                                </div>
                              </div>
                              {r.lider && <p className="text-xs text-muted-foreground">Líder: {r.lider}{r.facilitadora ? ` · ${r.facilitadora}` : ""}</p>}
                              <div className="flex gap-3 text-xs">
                                <span className="text-green-700 font-medium">{logra} logrados</span>
                                <span className="text-muted-foreground">{total} completados de {template.reduce((a, e) => a + e.hitos.length, 0)} hitos</span>
                              </div>
                              {r.observaciones && <p className="text-xs italic text-muted-foreground line-clamp-2">{r.observaciones}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : infMode === "view" && viewingReport ? (
                    <div className="space-y-4">
                      <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Líder pedagógica</p>
                          <p className="text-sm font-semibold mt-0.5">{viewingReport.lider || <span className="text-muted-foreground italic text-xs">Sin datos</span>}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Facilitadora</p>
                          <p className="text-sm font-semibold mt-0.5">{viewingReport.facilitadora || <span className="text-muted-foreground italic text-xs">Sin datos</span>}</p>
                        </div>
                      </div>
                      {template.map(({ eje, hitos }) => (
                        <div key={eje}>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">{eje}</p>
                          <div className="border rounded-lg overflow-hidden divide-y divide-border">
                            {hitos.map((hito) => {
                              const val = (viewingReport.hitos ?? {})[hito] ?? null;
                              const badge =
                                val === "L" ? { label: "Logra", cls: "bg-green-100 text-green-700" } :
                                val === "P" ? { label: "En proceso", cls: "bg-amber-100 text-amber-700" } :
                                val === "N" ? { label: "Aún no", cls: "bg-red-100 text-red-700" } :
                                null;
                              return (
                                <div key={hito} className="flex items-center gap-2 px-3 py-2">
                                  <span className="flex-1 text-xs leading-snug">{hito}</span>
                                  {badge ? (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.cls}`}>{badge.label}</span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground shrink-0">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {/* Textos descriptivos por eje */}
                      {template.some(({ eje }) => (viewingReport.textos ?? {})[eje]) && (
                        <div className="space-y-3 mt-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descripción por área</p>
                          {template.map(({ eje }) => {
                            const txt = (viewingReport.textos ?? {})[eje];
                            if (!txt) return null;
                            return (
                              <div key={eje} className="bg-muted/30 rounded-lg px-3 py-2">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{eje}</p>
                                <p className="text-sm leading-relaxed">{txt}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {viewingReport.observaciones && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Observaciones generales</p>
                          <p className="text-sm leading-relaxed">{viewingReport.observaciones}</p>
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-2 pb-4">
                        <Button variant="outline" className="flex-1" onClick={() => setInfMode("preview")}>Vista previa</Button>
                        <Button variant="outline" className="flex-1" onClick={() => handlePrintReport(viewingReport, `${c?.apellido} ${c?.nombre}`, ecoNumber, (childRoom as any)?.name ?? "", template)}>Descargar</Button>
                        <Button className="flex-1" onClick={() => handleShareReport(viewingReport, `${c?.apellido} ${c?.nombre}`, ecoNumber, (childRoom as any)?.name ?? "", template)}>Compartir</Button>
                      </div>
                    </div>
                  ) : infMode === "preview" && viewingReport ? (
                    <div className="flex flex-col h-full">
                      <iframe
                        className="flex-1 w-full border-0 bg-white"
                        srcDoc={buildReportHtml(viewingReport, `${c?.apellido} ${c?.nombre}`, ecoNumber, (childRoom as any)?.name ?? "", template)}
                        title="Vista previa del informe"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Período</Label>
                          <Select value={infPeriod} onValueChange={setInfPeriod}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[2024, 2025, 2026].flatMap((y) => [1, 2, 3].map((t) => `${y}-T${t}`)).map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">ECO</Label>
                          <Input className="mt-1 h-8 text-xs bg-muted" value={`ECO ${ecoNumber}`} disabled readOnly />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Líder pedagógica</Label>
                          <Input className="mt-1 h-8 text-xs" value={infLider} onChange={(e) => setInfLider(e.target.value)} placeholder="Nombre" />
                        </div>
                        <div>
                          <Label className="text-xs">Facilitadora</Label>
                          <Input className="mt-1 h-8 text-xs" value={infFacilitadora} onChange={(e) => setInfFacilitadora(e.target.value)} placeholder="Nombre" />
                        </div>
                      </div>

                      {template.map(({ eje, hitos }) => (
                        <div key={eje}>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1 mt-3">{eje}</p>
                          <div className="border rounded-lg overflow-hidden divide-y divide-border">
                            {hitos.map((hito) => {
                              const current = infHitos[hito] ?? null;
                              return (
                                <div key={hito} className="flex items-center gap-2 px-3 py-2">
                                  <span className="flex-1 text-xs leading-snug">{hito}</span>
                                  <div className="flex gap-1 shrink-0">
                                    {HITO_VALS.map(({ val, label, color }) => (
                                      <button
                                        key={val}
                                        onClick={() => setInfHitos((prev) => ({ ...prev, [hito]: current === val ? null : val }))}
                                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-all ${current === val ? color : "bg-background text-muted-foreground border-border"}`}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Textos descriptivos por eje */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Descripción por área</p>
                          <button
                            type="button"
                            className="text-xs text-primary font-semibold underline"
                            onClick={() => setInfTextos(autoGenerateTextos(template, infHitos, `${c?.nombre ?? ""} ${c?.apellido ?? ""}`.trim()))}
                          >
                            ✦ Generar automático
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">Podés editar el texto generado antes de guardar.</p>
                        {template.map(({ eje }) => (
                          <div key={eje}>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{eje}</Label>
                            <Textarea
                              className="mt-1 text-xs resize-none"
                              rows={3}
                              value={infTextos[eje] ?? ""}
                              onChange={(e) => setInfTextos((prev) => ({ ...prev, [eje]: e.target.value }))}
                              placeholder={`Descripción del niño/a en ${eje.toLowerCase()}...`}
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <Label className="text-xs">Observaciones generales</Label>
                        <Textarea className="mt-1 text-xs resize-none" rows={3} value={infObs} onChange={(e) => setInfObs(e.target.value)} placeholder="Notas adicionales sobre el desarrollo del niño/a..." />
                      </div>
                    </div>
                  )}
                </div>

                {infMode === "preview" && viewingReport && (
                  <div className="border-t border-border px-4 py-3 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handlePrintReport(viewingReport, `${c?.apellido} ${c?.nombre}`, ecoNumber, (childRoom as any)?.name ?? "", template)}
                    >
                      Descargar PDF
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleShareReport(viewingReport, `${c?.apellido} ${c?.nombre}`, ecoNumber, (childRoom as any)?.name ?? "", template)}
                    >
                      Compartir
                    </Button>
                  </div>
                )}
                {infMode === "edit" && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <Button className="w-full" size="sm" onClick={() => saveReport(ecoNumber)} disabled={infSaving}>
                      {infSaving ? "Guardando..." : editingReportId ? "Actualizar informe" : "Guardar informe"}
                    </Button>
                  </div>
                )}
              </>
            );
          })() : (
          <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">
            {/* Alert badge */}
            {(c.consecutiveAbsences ?? 0) >= 2 && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{c.consecutiveAbsences} días consecutivos sin asistir — requiere contacto</span>
              </div>
            )}

            {/* Estado badge */}
            {(c as any).estado === "EN REVISION" && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-300 rounded-lg px-3 py-2 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">Niño/a en revisión</span>
                <button
                  className="text-xs underline"
                  onClick={() => updateChild.mutate({ id: childId, data: { estado: "INSCRIPTX" } as any }, { onSuccess: () => { toast({ title: "Estado actualizado" }); invalidateAll(); } })}
                >
                  Quitar revisión
                </button>
              </div>
            )}
            {(c as any).estado === "ALERTA" && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-300 rounded-lg px-3 py-2 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="flex-1">Niño/a en alerta</span>
                <button
                  className="text-xs underline"
                  onClick={() => updateChild.mutate({ id: childId, data: { estado: "INSCRIPTX" } as any }, { onSuccess: () => { toast({ title: "Estado actualizado" }); invalidateAll(); } })}
                >
                  Quitar alerta
                </button>
              </div>
            )}

            {/* View tabs */}
            {view === "ficha" && (
              <>
                {/* Personal data */}
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Datos personales</h4>
                  {[
                    { label: "Legajo", value: c.registro },
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

            {/* EDIT FORM */}
            {view === "editar" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="sm" className="px-2 py-1 h-auto" onClick={() => setView("ficha")}>
                    <ChevronLeft className="w-4 h-4 mr-1" />Volver
                  </Button>
                  <h3 className="font-semibold text-base">Editar datos</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Sala</Label>
                    <Select value={editRoomId} onValueChange={setEditRoomId}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(allRooms.data ?? []).map((r: Room) => (
                          <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Nro. Legajo</Label><Input value={editRegistro} onChange={(e) => setEditRegistro(e.target.value)} className="mt-1" placeholder="001" /></div>
                  <div></div>
                  <div><Label className="text-xs">Apellido</Label><Input value={editApellido} onChange={(e) => setEditApellido(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Nombre</Label><Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">DNI</Label><Input value={editDni} onChange={(e) => setEditDni(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Fecha de nac.</Label><Input type="date" value={editFnac} onChange={(e) => setEditFnac(e.target.value)} className="mt-1" /></div>
                  <div>
                    <Label className="text-xs">Género</Label>
                    <Select value={editGenero} onValueChange={setEditGenero}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEMENINO">FEMENINO</SelectItem>
                        <SelectItem value="MASCULINO">MASCULINO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Teléfono</Label><Input value={editCelular} onChange={(e) => setEditCelular(e.target.value)} className="mt-1" /></div>
                  <div className="sm:col-span-2"><Label className="text-xs">Domicilio</Label><Input value={editDomicilio} onChange={(e) => setEditDomicilio(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Barrio</Label><Input value={editBarrio} onChange={(e) => setEditBarrio(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Localidad</Label><Input value={editLocalidad} onChange={(e) => setEditLocalidad(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Apellido familiar</Label><Input value={editFamApellido} onChange={(e) => setEditFamApellido(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs">Nombre familiar</Label><Input value={editFamNombre} onChange={(e) => setEditFamNombre(e.target.value)} className="mt-1" /></div>
                  <div>
                    <Label className="text-xs">Vínculo</Label>
                    <Select value={editVinculo} onValueChange={setEditVinculo}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["MADRE/PADRE","ABUELA/O","TÍA/O","HERMANA/O MAYOR","OTRO"].map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" /></div>
                  <div>
                    <Label className="text-xs">Est. asistencia</Label>
                    <Select value={editEstAsist} onValueChange={setEditEstAsist}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {["Regular","Irregular","No regular"].map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2"><Label className="text-xs">Observaciones</Label><Textarea value={editObs} onChange={(e) => setEditObs(e.target.value)} rows={2} className="mt-1" /></div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={updateChild.isPending} data-testid="btn-save-edit">
                    {updateChild.isPending ? "Guardando..." : "Guardar cambios"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setView("ficha")}>Cancelar</Button>
                </div>
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
                            <label className={`text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 cursor-pointer px-2 py-1 rounded border border-dashed border-border hover:border-foreground/30 transition-colors ${uploadingDoc === key ? "opacity-50" : ""}`}>
                              <Upload className="w-3 h-3" />
                              {uploadingDoc === key ? "Subiendo..." : doc ? "Reemplazar" : "Adjuntar"}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                disabled={uploadingDoc === key}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadDoc(key, file);
                                  e.target.value = "";
                                }}
                                data-testid={`input-upload-doc-${key}`}
                              />
                            </label>
                          </div>
                        );
                      })}

                      {/* Carnet de vacunas — toggleable */}
                      <div className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5 cursor-pointer"
                        onClick={async () => {
                          const newVal = !docsData.carnetVacunas;
                          setDocsData({ ...docsData, carnetVacunas: newVal });
                          await fetch(`/api/children/${childId}/carnet-vacunas`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ value: newVal }),
                          });
                        }}
                      >
                        {docsData.carnetVacunas ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Carnet de vacunas</p>
                          <p className="text-[10px] text-muted-foreground">
                            {docsData.carnetVacunas ? "Presentado" : "Tap para marcar como presentado"}
                          </p>
                        </div>
                        <Badge variant={docsData.carnetVacunas ? "default" : "outline"} className="shrink-0 text-[10px]">
                          {docsData.carnetVacunas ? "Sí" : "No"}
                        </Badge>
                      </div>

                      {/* Autorizaciones firmadas en la inscripción */}
                      {[
                        { label: "Apto físico", value: docsData.aptoFisico },
                        { label: "Autorización de retiro", value: docsData.autRetiro },
                        { label: "Autorización de llamada", value: docsData.autLlamada },
                        { label: "Autorización de toma de fotos", value: docsData.autFotos },
                        { label: "Autorización uso de pañales", value: docsData.panialesAuth },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5">
                          {value ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {value ? "Autorizado por familia" : "No autorizado"}
                            </p>
                          </div>
                          <Badge variant={value ? "default" : "outline"} className="shrink-0 text-[10px]">
                            {value ? "Sí" : "No"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          </div>
          )}

          {/* Sticky action footer — visible sin scrollear */}
          {view === "ficha" && (
            <div className="border-t border-border bg-card px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => setView("historial")} data-testid="btn-ver-historial">Historial</Button>
                <Button size="sm" variant="outline" onClick={() => { setView("documentos"); loadDocs(); }} data-testid="btn-ver-documentos">
                  <FileText className="w-3.5 h-3.5 mr-1" />Documentos
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setView("informe"); setInfMode("list"); }} className="col-span-2" data-testid="btn-ver-informe">
                  Informe de desarrollo
                </Button>
                {c?.activo && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setView("llamado")} data-testid="btn-registrar-llamado">Contacto</Button>
                    <Button size="sm" variant="outline" onClick={enterEditView} data-testid="btn-editar">Editar datos</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const nuevoEstado = (c as any).estado === "EN REVISION" ? "INSCRIPTX" : "EN REVISION";
                        updateChild.mutate(
                          { id: childId, data: { estado: nuevoEstado } as any },
                          { onSuccess: () => { toast({ title: nuevoEstado === "EN REVISION" ? "Pasado a En revisión" : "Quitado de revisión" }); invalidateAll(); } }
                        );
                      }}
                      className={`col-span-1 ${(c as any).estado === "EN REVISION" ? "border-amber-400 text-amber-700 bg-amber-50" : "border-amber-300 text-amber-700"}`}
                      data-testid="btn-toggle-revision"
                    >
                      {(c as any).estado === "EN REVISION" ? "Quitar revisión" : "En revisión"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const nuevoEstado = (c as any).estado === "ALERTA" ? "INSCRIPTX" : "ALERTA";
                        updateChild.mutate(
                          { id: childId, data: { estado: nuevoEstado } as any },
                          { onSuccess: () => { toast({ title: nuevoEstado === "ALERTA" ? "Pasado a Alerta" : "Quitado de alerta" }); invalidateAll(); } }
                        );
                      }}
                      className={`col-span-1 ${(c as any).estado === "ALERTA" ? "border-red-400 text-red-700 bg-red-50" : "border-red-300 text-red-700"}`}
                      data-testid="btn-toggle-alerta"
                    >
                      {(c as any).estado === "ALERTA" ? "Quitar alerta" : "Alerta"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setView("baja")} data-testid="btn-registrar-baja">Registrar egreso</Button>
                  </>
                )}
                {!c?.activo && (
                  <Button size="sm" className="col-span-2" onClick={handleReinstate} disabled={reinstateChild.isPending} data-testid="btn-reinstate">
                    Dar de alta nuevamente
                  </Button>
                )}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
