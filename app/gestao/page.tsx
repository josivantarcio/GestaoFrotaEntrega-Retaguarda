"use client";
export const dynamic = "force-dynamic";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  BarChart2, Package, AlertTriangle, Truck, TrendingUp,
  Users, MapPin, RotateCcw, CheckCircle2, RefreshCw, Award,
} from "lucide-react";
import { LABELS_OCORRENCIA } from "@/lib/types";
import type { TipoOcorrencia } from "@/lib/types";
import { NavBar } from "@/components/layout/NavBar";

// ── Helpers ──────────────────────────────────────────────────
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function labelMes(iso: string) {
  const [ano, mes] = iso.split("-");
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function corTaxa(t: number) { return t >= 95 ? "#16a34a" : t >= 80 ? "#d97706" : "#dc2626"; }
function bgTaxa(t: number) { return t >= 95 ? "#dcfce7" : t >= 80 ? "#fef9c3" : "#fee2e2"; }

interface DadosGestao {
  kpis: {
    totalRotas: number; totalConcluidas: number; totalVolumes: number;
    totalEntregues: number; totalDevolvidos: number; totalOcorrencias: number;
    totalKm: number; taxaEntrega: number;
  };
  tendencia: { data: string; saida: number; entregues: number; rotas: number }[];
  rankingEntregadores: { id: string; nome: string; volumes: number; entregues: number; ocorrencias: number; cidades: number; taxa: number }[];
  rankingOcorrencias: { tipo: string; qtd: number }[];
  rankingMotoristas: { nome: string; rotas: number; km: number; volumes: number }[];
}

// ── Mini gráfico de barras SVG ────────────────────────────────
function MiniBarras({ dados, corBarra = "#0d47a1", label }: {
  dados: number[];
  corBarra?: string;
  label?: string;
}) {
  const max = Math.max(...dados, 1);
  const largura = 280;
  const altura = 60;
  const qtd = dados.length;
  const espaco = 3;
  const largBarra = Math.floor((largura - espaco * (qtd - 1)) / qtd);

  return (
    <div>
      {label && <p className="text-xs text-gray-400 mb-1">{label}</p>}
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} className="overflow-visible">
        {dados.map((v, i) => {
          const h = max > 0 ? Math.max(2, Math.round((v / max) * (altura - 4))) : 2;
          const x = i * (largBarra + espaco);
          return (
            <rect
              key={i} x={x} y={altura - h} width={largBarra} height={h}
              rx={2} fill={corBarra} opacity={i === dados.length - 1 ? 1 : 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ icone, titulo, valor, sub, cor = "text-gray-900", destaque = false }: {
  icone: React.ReactNode; titulo: string; valor: string | number; sub?: string; cor?: string; destaque?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${destaque ? "border-amber-200" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{titulo}</p>
        {icone}
      </div>
      <p className={`text-2xl font-black ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────
export default function GestaoPage() {
  const [inicio, setInicio] = useState(inicioDeMes());
  const [fim, setFim] = useState(hoje());
  const [dados, setDados] = useState<DadosGestao | null>(null);
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async () => {
    if (!inicio || !fim) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/gestao?inicio=${inicio}&fim=${fim}`);
      if (res.ok) setDados(await res.json());
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim]);

  // Carrega ao montar
  useEffect(() => { buscar(); }, []);

  const kpis = dados?.kpis;
  const tendencia = dados?.tendencia ?? [];
  const rankingE = dados?.rankingEntregadores ?? [];
  const rankingO = dados?.rankingOcorrencias ?? [];
  const rankingM = dados?.rankingMotoristas ?? [];

  const maxOc = rankingO[0]?.qtd ?? 1;
  const maxVol = Math.max(...tendencia.map((t) => t.saida), 1);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar />

      <main className="flex-1 px-5 py-5 max-w-6xl mx-auto w-full space-y-5">

        {/* Filtro de período */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">De</label>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Até</label>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <button onClick={buscar} disabled={carregando}
              className="flex items-center gap-2 bg-[#0d47a1] hover:bg-blue-800 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60">
              {carregando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <RefreshCw size={14} />}
              Atualizar
            </button>
            {inicio && <p className="text-sm text-gray-500 font-medium capitalize ml-1">{labelMes(inicio)}</p>}
          </div>
        </div>

        {carregando && !dados && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-[#0d47a1] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {kpis && (
          <>
            {/* KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icone={<Truck size={18} className="text-blue-600" />} titulo="Rotas" valor={kpis.totalRotas}
                sub={`${kpis.totalConcluidas} concluída${kpis.totalConcluidas !== 1 ? "s" : ""}`} />
              <KpiCard icone={<Package size={18} className="text-purple-600" />} titulo="Volumes"
                valor={kpis.totalEntregues} sub={`de ${kpis.totalVolumes} · ${kpis.taxaEntrega}% entregues`}
                cor={kpis.taxaEntrega >= 95 ? "text-green-700" : kpis.taxaEntrega >= 80 ? "text-amber-700" : "text-red-700"} />
              <KpiCard icone={<MapPin size={18} className="text-green-600" />} titulo="KM Rodados"
                valor={kpis.totalKm > 0 ? `${kpis.totalKm.toLocaleString("pt-BR")} km` : "—"}
                sub={kpis.totalConcluidas > 0 ? `~${Math.round(kpis.totalKm / kpis.totalConcluidas)} km/rota` : undefined} />
              <KpiCard icone={<AlertTriangle size={18} className="text-amber-500" />} titulo="Ocorrências"
                valor={kpis.totalOcorrencias} sub={`${kpis.totalDevolvidos} volume${kpis.totalDevolvidos !== 1 ? "s" : ""} devolvido${kpis.totalDevolvidos !== 1 ? "s" : ""}`}
                destaque={kpis.totalOcorrencias > 0} cor={kpis.totalOcorrencias > 0 ? "text-amber-700" : "text-gray-900"} />
            </div>

            {/* Taxa de entrega — destaque */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Taxa de Entrega Geral</p>
                  <p className="text-4xl font-black mt-1" style={{ color: corTaxa(kpis.taxaEntrega) }}>{kpis.taxaEntrega}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{kpis.totalEntregues} entregues</p>
                  <p className="text-sm text-gray-400">{kpis.totalDevolvidos} devolvidos</p>
                  <p className="text-xs text-gray-300 mt-1">{dataBR(inicio)} → {dataBR(fim)}</p>
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${kpis.taxaEntrega}%`, backgroundColor: corTaxa(kpis.taxaEntrega) }} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Tendência de volumes por dia */}
              {tendencia.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Volumes por dia</p>
                  <div className="space-y-4">
                    <MiniBarras dados={tendencia.map((t) => t.saida)} corBarra="#0d47a1" label="Volumes saída" />
                    <MiniBarras dados={tendencia.map((t) => t.entregues)} corBarra="#16a34a" label="Volumes entregues" />
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#0d47a1] inline-block" /> Saída</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-600 inline-block" /> Entregues</span>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-300">
                    <span>{tendencia[0]?.data ? dataBR(tendencia[0].data) : ""}</span>
                    <span>{tendencia[tendencia.length - 1]?.data ? dataBR(tendencia[tendencia.length - 1].data) : ""}</span>
                  </div>
                </div>
              )}

              {/* Ranking de ocorrências */}
              {rankingO.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ocorrências por tipo</p>
                  <div className="space-y-3">
                    {rankingO.slice(0, 6).map(({ tipo, qtd }) => (
                      <div key={tipo} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-44 flex-shrink-0 truncate">
                          {LABELS_OCORRENCIA[tipo as TipoOcorrencia] ?? tipo}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                            style={{ width: `${(qtd / maxOc) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-amber-700 w-5 text-right">{qtd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ranking de entregadores */}
              {rankingE.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ranking Entregadores</p>
                    <Link href="/relatorios/entregadores" className="text-xs text-blue-600 hover:underline font-semibold">
                      Ver completo →
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {rankingE.slice(0, 5).map((e, idx) => {
                      const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                      return (
                        <div key={e.id} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: bgTaxa(e.taxa) }}>
                            {medalha
                              ? <span className="text-sm">{medalha}</span>
                              : <Users size={13} style={{ color: corTaxa(e.taxa) }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">{e.nome}</p>
                              <span className="text-xs font-bold flex-shrink-0" style={{ color: corTaxa(e.taxa) }}>
                                {e.taxa}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${e.taxa}%`, backgroundColor: corTaxa(e.taxa) }} />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {e.entregues} entregues · {e.cidades} cidade{e.cidades !== 1 ? "s" : ""}
                              {e.ocorrencias > 0 && <span className="text-amber-600"> · {e.ocorrencias} oc.</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ranking de motoristas */}
              {rankingM.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ranking Motoristas</p>
                  <div className="space-y-3">
                    {rankingM.slice(0, 5).map((m, idx) => (
                      <div key={m.nome} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          {idx < 3
                            ? <span className="text-sm">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                            : <Truck size={13} className="text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800 truncate">{m.nome}</p>
                            <span className="text-xs text-blue-700 font-bold flex-shrink-0">{m.rotas} rota{m.rotas !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {m.volumes} volumes · {m.km > 0 ? `${m.km} km` : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-6">
              {[
                { href: "/dashboard", icon: <Truck size={18} />, titulo: "Operacional do Dia", desc: "Rotas ao vivo com SSE" },
                { href: "/mapa", icon: <MapPin size={18} />, titulo: "Mapa Geral + GPS", desc: "Posição em tempo real" },
                { href: "/relatorios", icon: <BarChart2 size={18} />, titulo: "Relatórios Detalhados", desc: "Histórico e exportação CSV" },
              ].map((l) => (
                <Link key={l.href} href={l.href}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-md transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    {l.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{l.titulo}</p>
                    <p className="text-xs text-gray-400">{l.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {!dados && !carregando && (
          <div className="text-center py-24">
            <BarChart2 size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Selecione o período e clique em Atualizar</p>
          </div>
        )}
      </main>
    </div>
  );
}
