export default function Diagnostico() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-4 lg:pt-8 shrink-0">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Herramienta</div>
        <h1 className="text-2xl font-bold mt-1">Diagnóstico</h1>
      </div>
      <iframe
        src="https://app.korai.lat"
        className="flex-1 w-full border-0"
        title="Diagnóstico"
        allow="fullscreen"
      />
    </div>
  );
}
