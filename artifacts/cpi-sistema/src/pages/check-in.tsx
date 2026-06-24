import { useState, useEffect } from "react";
import { useRoute } from "wouter";

type Child = { id: number; apellido: string; nombre: string };

type CheckInData = {
  roomId: number;
  roomName: string;
  children: Child[];
};

type Stage = "search" | "confirm" | "success" | "already" | "error";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export default function CheckIn() {
  const [, params] = useRoute("/check-in/:token");
  const token = params?.token;

  const [data, setData] = useState<CheckInData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Child | null>(null);
  const [stage, setStage] = useState<Stage>("search");
  const [confirming, setConfirming] = useState(false);
  const [markedChild, setMarkedChild] = useState<Child | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE_URL}/check-in/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(d.error); return; }
        setData(d);
      })
      .catch(() => setLoadError("No se pudo cargar la sala. Revisá tu conexión."));
  }, [token]);

  const filtered =
    data && query.trim().length >= 2
      ? data.children.filter((c) =>
          `${c.apellido} ${c.nombre}`.toLowerCase().includes(query.trim().toLowerCase())
        )
      : [];

  function handleSelect(child: Child) {
    setSelected(child);
    setStage("confirm");
  }

  async function handleConfirm() {
    if (!selected || !token) return;
    setConfirming(true);
    try {
      const r = await fetch(`${BASE_URL}/check-in/${token}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId: selected.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        setStage("error");
        return;
      }
      setMarkedChild(selected);
      setStage("success");
    } catch {
      setStage("error");
    } finally {
      setConfirming(false);
    }
  }

  function handleBack() {
    setSelected(null);
    setStage("search");
  }

  // Loading / error state
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1e1147] px-6">
        <div className="bg-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-white text-lg font-semibold">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1e1147]">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white/60 mt-4 text-sm">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1e1147]">
      {/* Header */}
      <div className="px-6 pt-10 pb-6 text-center">
        <div className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
          Koratic
        </div>
        <div className="text-white text-2xl font-bold">{data.roomName}</div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col bg-white rounded-t-3xl px-6 pt-8 pb-10">
        {stage === "search" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Marcar llegada</h1>
            <p className="text-gray-500 text-sm mb-6">Escribí el apellido de tu hijo/a para encontrarlo/a.</p>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Apellido de tu hijo/a"
              autoFocus
              className="w-full border-2 border-gray-200 focus:border-violet-500 rounded-xl px-4 py-4 text-lg outline-none transition-colors mb-4"
            />

            {query.trim().length >= 2 && filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                No se encontraron coincidencias. Probá con otro apellido.
              </p>
            )}

            {filtered.length > 0 && (
              <div className="space-y-2 mt-2">
                {filtered.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleSelect(child)}
                    className="w-full text-left bg-violet-50 hover:bg-violet-100 active:bg-violet-200 border border-violet-200 rounded-xl px-5 py-4 transition-colors"
                  >
                    <span className="text-base font-bold text-violet-900">
                      {child.apellido}, {child.nombre}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {stage === "confirm" && selected && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmar llegada</h1>
            <p className="text-gray-500 text-sm mb-8">¿Confirmás que llegó hoy?</p>

            <div className="bg-violet-50 border border-violet-200 rounded-2xl px-6 py-6 mb-8 text-center">
              <div className="text-3xl font-bold text-violet-900">
                {selected.apellido}
              </div>
              <div className="text-xl text-violet-700 mt-1">{selected.nombre}</div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:opacity-60 text-white rounded-xl py-4 text-lg font-bold transition-colors mb-4"
            >
              {confirming ? "Confirmando..." : "✓ Confirmar llegada"}
            </button>

            <button
              onClick={handleBack}
              className="w-full text-gray-500 hover:text-gray-700 py-3 text-sm font-medium transition-colors"
            >
              ← Volver
            </button>
          </>
        )}

        {stage === "success" && markedChild && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="text-7xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡{markedChild.nombre} fue marcado/a presente!
            </h2>
            <p className="text-gray-500 text-sm mt-2">Podés cerrar esta ventana.</p>
          </div>
        )}

        {stage === "already" && markedChild && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="text-7xl mb-6">👍</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {markedChild.nombre} ya estaba marcado/a como presente hoy.
            </h2>
            <p className="text-gray-500 text-sm mt-2">¡Todo en orden!</p>
          </div>
        )}

        {stage === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="text-7xl mb-6">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
            <p className="text-gray-500 text-sm mb-6">No se pudo registrar la asistencia. Intentá de nuevo.</p>
            <button
              onClick={handleBack}
              className="bg-violet-600 text-white rounded-xl px-8 py-3 font-semibold"
            >
              Volver a intentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
