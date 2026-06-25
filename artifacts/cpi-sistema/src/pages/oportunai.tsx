import { Sparkles } from "lucide-react";

export default function Oportunai() {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-[#1e1147] text-white px-5 pt-6 pb-7 lg:pt-8">
        <div className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">Módulo</div>
        <h1 className="text-2xl font-bold mt-1">Oportunai</h1>
      </div>
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-violet-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Próximamente</h2>
        <p className="text-sm text-gray-400 max-w-xs">
          Este módulo está en desarrollo. El contenido estará disponible pronto.
        </p>
      </div>
    </div>
  );
}
