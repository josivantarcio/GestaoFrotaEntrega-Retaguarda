"use client";
export const dynamic = "force-dynamic";
import { useCallback, useMemo } from "react";
import { Package, CheckCircle2, Truck, AlertTriangle, Clock, PackageOpen } from "lucide-react";
import { useRotasRealtime } from "@/hooks/useRotasRealtime";
import { useJornadasDescargasRealtime } from "@/hooks/useJornadasDescargasRealtime";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { TopBar } from "@/components/layout/TopBar";
import { RotaCard } from "@/components/dashboard/RotaCard";
import { PainelAlertas } from "@/components/dashboard/PainelAlertas";
import type { EventoNotificacao, Jornada, Descarga } from "@/lib/types";

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

  const dataHoje = hoje();

  const { rotas, conectado, carregando } = useRotasRealtime({
    dataFiltro: dataHoje,
    onEvento: handleEvento,
  });

  const { jornadas, descargas } = useJornadasDescargasRealtime(dataHoje);

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
          icone={<Truck size={20} className="text-[#0d47a1]" />}
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

      {/* Alertas operacionais */}
      <PainelAlertas rotas={rotas} />

      {/* Conteúdo */}
      <main className="flex-1 px-5 pb-8">
        {carregando ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-[#0d47a1] border-t-transparent rounded-full animate-spin" />
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

      {/* Jornada e Descargas */}
      {(jornadas.length > 0 || descargas.length > 0) && (
        <section className="px-5 pb-6 max-w-4xl mx-auto w-full">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Jornada &amp; Descargas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {jornadas.map((j) => (
              <JornadaCard key={j.id} jornada={j} />
            ))}
            {descargas.map((d) => (
              <DescargaCard key={d.id} descarga={d} />
            ))}
          </div>
        </section>
      )}

      {/* Rodapé */}
      <footer className="text-center py-4 text-xs text-gray-300">
        RotaFácil · Desenvolvido por Josevan Oliveira
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

function JornadaCard({ jornada }: { jornada: Jornada }) {
  const aberta = !jornada.hora_fim;
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm flex gap-3 items-start ${aberta ? "border-blue-200" : "border-gray-100"}`}>
      <div className={`mt-0.5 rounded-full p-2 ${aberta ? "bg-blue-50" : "bg-gray-50"}`}>
        <Clock size={16} className={aberta ? "text-blue-600" : "text-gray-400"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">Jornada</p>
          {aberta ? (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">em andamento</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">encerrada</span>
          )}
        </div>
        {jornada.motorista && (
          <p className="text-xs text-gray-500 mt-0.5">{jornada.motorista}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {jornada.hora_inicio}
          {jornada.hora_fim ? ` → ${jornada.hora_fim}` : " → em andamento"}
        </p>
      </div>
    </div>
  );
}

function DescargaCard({ descarga }: { descarga: Descarga }) {
  const aberta = !descarga.hora_fim;
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm flex gap-3 items-start ${aberta ? "border-amber-200" : "border-gray-100"}`}>
      <div className={`mt-0.5 rounded-full p-2 ${aberta ? "bg-amber-50" : "bg-gray-50"}`}>
        <PackageOpen size={16} className={aberta ? "text-amber-600" : "text-gray-400"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">Descarga</p>
          {aberta ? (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">em andamento</span>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">concluída</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {descarga.hora_inicio}
          {descarga.hora_fim ? ` → ${descarga.hora_fim}` : " → em andamento"}
        </p>
        {descarga.observacao && (
          <p className="text-xs text-gray-500 mt-1 truncate">{descarga.observacao}</p>
        )}
      </div>
    </div>
  );
}
