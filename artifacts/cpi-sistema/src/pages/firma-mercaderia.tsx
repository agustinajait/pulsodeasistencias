import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type FirmaData = {
  childId: number;
  fecha: string;
  childNombre: string;
  childApellido: string;
  famNombre?: string;
  famApellido?: string;
  firmado: boolean;
  firmadoAt?: string;
  firmanteNombre?: string;
};

// ── Signature canvas ───────────────────────────────────────────────────────
function SignatureCanvas({ onSigned }: { onSigned: (base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1e1147";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing.current = true;
      const { x, y } = getPos(e, canvas!);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const { x, y } = getPos(e, canvas!);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasStroke(true);
    }
    function end() { drawing.current = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSigned(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-2xl overflow-hidden bg-gray-50 touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full"
          style={{ touchAction: "none" }}
        />
        <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-gray-300 font-medium pointer-events-none select-none">
          Firmá con tu dedo aquí
        </p>
        {hasStroke && (
          <button
            onClick={clear}
            className="absolute top-2 right-2 text-[10px] font-semibold text-gray-400 hover:text-red-500 bg-white border border-gray-200 rounded-lg px-2 py-1"
          >
            Borrar
          </button>
        )}
      </div>
      <button
        onClick={confirm}
        disabled={!hasStroke}
        className="w-full py-3.5 rounded-2xl bg-[#1e1147] text-white font-bold text-base disabled:opacity-30 active:scale-95 transition-transform"
      >
        Confirmar firma
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function FirmaMercaderia() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<FirmaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [step, setStep] = useState<"loading" | "nombre" | "firma" | "done" | "error">("loading");

  useEffect(() => {
    fetch(`${BASE}/mercaderia/firma/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setStep("error"); return; }
        setData(d);
        if (d.firmado) { setStep("done"); return; }
        // Pre-fill nombre del familiar
        if (d.famNombre) setNombre([d.famNombre, d.famApellido].filter(Boolean).join(" "));
        setStep("nombre");
      })
      .catch(() => { setError("No se pudo cargar el link"); setStep("error"); });
  }, [token]);

  async function handleFirma(firmaBase64: string) {
    const r = await fetch(`${BASE}/mercaderia/firma/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmanteNombre: nombre, firmaBase64 }),
    });
    if (r.ok) {
      setStep("done");
    } else {
      const d = await r.json();
      setError(d.error ?? "Error al guardar");
      setStep("error");
    }
  }

  const fechaFmt = data?.fecha
    ? new Date(data.fecha + "T12:00:00").toLocaleDateString("es-AR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1e1147] text-white px-5 pt-12 pb-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">CAIPLI</div>
        <h1 className="text-2xl font-bold mt-1">Retiro de mercadería</h1>
        {data && (
          <p className="text-white/70 text-sm mt-1 capitalize">{fechaFmt}</p>
        )}
      </div>

      <div className="flex-1 px-5 py-6 max-w-md mx-auto w-full space-y-6">

        {step === "loading" && (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        )}

        {step === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-2">
            <p className="text-red-600 font-bold">Link inválido</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-2">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-700 font-bold text-lg">¡Firma registrada!</p>
              {data?.firmanteNombre && (
                <p className="text-green-600 text-sm">Firmado por: <strong>{data.firmanteNombre}</strong></p>
              )}
              {data && (
                <p className="text-green-600 text-sm">
                  Bolsón de <strong>{data.childNombre} {data.childApellido}</strong>
                </p>
              )}
              <p className="text-green-500 text-xs capitalize">{fechaFmt}</p>
            </div>
            <p className="text-center text-xs text-gray-400">Ya podés cerrar esta pantalla.</p>
          </div>
        )}

        {(step === "nombre" || step === "firma") && data && (
          <>
            {/* Info del bolsón */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Niño/a</p>
              <p className="font-bold text-gray-900 text-lg">{data.childApellido}, {data.childNombre}</p>
              <p className="text-sm text-gray-500 capitalize">{fechaFmt}</p>
            </div>

            {step === "nombre" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">¿Quién retira?</p>
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400">
                    Confirmás que retirás el bolsón de mercadería de {data.childNombre} {data.childApellido}.
                  </p>
                </div>
                <button
                  onClick={() => setStep("firma")}
                  disabled={!nombre.trim()}
                  className="w-full py-3.5 rounded-2xl bg-[#1e1147] text-white font-bold text-base disabled:opacity-30 active:scale-95 transition-transform"
                >
                  Continuar →
                </button>
              </div>
            )}

            {step === "firma" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Firma</p>
                    <button
                      onClick={() => setStep("nombre")}
                      className="text-xs text-violet-600 font-semibold"
                    >
                      ← {nombre}
                    </button>
                  </div>
                  <SignatureCanvas onSigned={handleFirma} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
