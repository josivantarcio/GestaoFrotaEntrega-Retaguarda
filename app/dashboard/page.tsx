"use client";
import { useCallback, useMemo } from "react";
import { Package, CheckCircle2, Truck, AlertTriangle } from "lucide-react";
import { useRotasRealtime } from "@/hooks/useRotasRealtime";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { TopBar } from "@/components/layout/TopBar";
import { RotaCard } from "@/components/dashboard/RotaCard";
import type { EventoNotificacao } from "@/lib/types";

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const { dispararNotificacao } = useNotificacoes();

  const handleEvento = useCallback(
    (evento: EventoNotificacao) => dispararNotificacao(evento),
    [dispararNotificacao]
  );

  const { rotas, conectado, carregando } = useRotasRealtime({
    dataFiltro: hoje(),
    onEvento: handleEvento,
  });

  const emAndamento = useMemo(() => rotas.filter((r) => r.status === "em_andamento"), [rotas]);
  const concluidas = useMemo(() => rotas.filter((r) => r.status === "concluida"), [rotas]);

  const totalVolumes = rotas.reduce((s, r) => s + r.itens.reduce((si, i) => si + i.volumesSaida, 0), 0);
  const totalEntregues = rotas.reduce(
    (s, r) => s + r.itens.reduce((si, i) => si + (i.volumesEntregues ?? i.volumesSaida - (i.volumesDevolvidos ?? 0)), 0),
    0
  );
  const totalOcorrencias = rotas.reduce((s, r) => s + r.itens.reduce((si, i) => si + (i.ocorrencias?.length ?? 0), 0), 0);
  const cidadesConcluidas = rotas.reduce((s, r) => s + r.itens.filter((i) => i.concluido).length, 0);
  const cidadesTotal = rotas.reduce((s, r) => s + r.itens.length, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopBar conectado={conectado} />

      {/* KPIs */}
      <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icone={<Truck size={20} className="text-[#ee4d2d]" />}
          titulo="Em Andamento"
          valor={emAndamento.length}
          sub={`${concluidas.length} concluída${concluidas.length !== 1 ? "s" : ""}`}
          destaque={emAndamento.length > 0}
        />
        <KpiCard
          icone={<Package size={20} className="text-blue-600" />}
          titulo="Volumes"
          valor={`${totalEntregues}/${totalVolumes}`}
          sub="entregues / total"
        />
        <KpiCard
          icone={<CheckCircle2 size={20} className="text-green-600" />}
          titulo="Cidades"
          valor={`${cidadesConcluidas}/${cidadesTotal}`}
          sub="concluídas / total"
        />
        <KpiCard
          icone={<AlertTriangle size={20} className="text-amber-500" />}
          titulo="Ocorrências"
          valor={totalOcorrencias}
          sub="no dia"
          alerta={totalOcorrencias > 0}
        />
      </div>

      {/* Conteúdo */}
      <main className="flex-1 px-5 pb-8">
        {carregando ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-[#ee4d2d] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rotas.length === 0 ? (
          <div className="text-center py-24">
            <Truck size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">Nenhuma rota hoje</p>
            <p className="text-gray-300 text-sm mt-1">As rotas aparecerão aqui em tempo real</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {emAndamento.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-2">
                  Em andamento ({emAndamento.length})
                </h2>
                {emAndamento.map((r) => (
                  <RotaCard key={r.id} rota={r} />
                ))}
              </>
            )}
            {concluidas.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-4">
                  Concluídas hoje ({concluidas.length})
                </h2>
                {concluidas.map((r) => (
                  <RotaCard key={r.id} rota={r} concluida />
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {/* Rodapé */}
      <footer className="text-center py-4 text-xs text-gray-300">
        RouteLog · Desenvolvido por Josevan Oliveira
      </footer>
    </div>
  );
}

function KpiCard({
  icone, titulo, valor, sub, destaque = false, alerta = false,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: number | string;
  sub?: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${
      destaque ? "border-red-200" : alerta ? "border-amber-200" : "border-gray-100"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{titulo}</p>
        {icone}
      </div>
      <p className={`text-3xl font-bold ${alerta && typeof valor === "number" && valor > 0 ? "text-amber-600" : "text-gray-900"}`}>
        {valor}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
