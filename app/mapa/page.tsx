"use client";
export const dynamic = "force-dynamic";

import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, AlertTriangle, Package, ChevronRight, Wifi, WifiOff, Navigation } from "lucide-react";
import { NavBar } from "@/components/layout/NavBar";
import { createClient } from "@supabase/supabase-js";
import { useRotasRealtime } from "@/hooks/useRotasRealtime";
import type { Rota, ItemRota, EventoNotificacao } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface PosicaoGPS {
  rota_id: string;
  lat: number;
  lng: number;
  velocidade: number | null;
  motorista: string;
  veiculo_placa: string;
  criado_em: string;
  status: string;
}

// Hook que mantém as últimas posições GPS de todos os motoristas ativos
function usePosicoes(rotaIds: string[]) {
  const [posicoes, setPosicoes] = useState<Map<string, PosicaoGPS>>(new Map());

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || rotaIds.length === 0) return;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Carrega últimas posições de todos os IDs
    supabase
      .from("localizacoes")
      .select("*")
      .in("rota_id", rotaIds)
      .order("criado_em", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const mapa = new Map<string, PosicaoGPS>();
        // Fica com a mais recente de cada rota_id
        for (const row of data) {
          if (!mapa.has(row.rota_id)) mapa.set(row.rota_id, row as PosicaoGPS);
        }
        setPosicoes(mapa);
      });

    // Escuta inserções em tempo real
    const canal = supabase
      .channel("mapa-geral-gps")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "localizacoes" }, (p) => {
        const nova = p.new as PosicaoGPS;
        if (!rotaIds.includes(nova.rota_id)) return;
        setPosicoes((prev) => new Map(prev).set(nova.rota_id, nova));
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [rotaIds.join(",")]);

  return posicoes;
}

function IconeTruck({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
      <rect x="9" y="11" width="14" height="10" rx="2"/>
      <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    </svg>
  );
}

function IconeMapPin({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function corStatus(rota: Rota): { bg: string; text: string; badge: string } {
  if (rota.status === "concluida") return { bg: "#f0fdf4", text: "#15803d", badge: "bg-green-100 text-green-700" };
  const temOco = rota.itens.some((i) => (i.ocorrencias?.length ?? 0) > 0);
  if (temOco) return { bg: "#fffbeb", text: "#b45309", badge: "bg-amber-100 text-amber-700" };
  return { bg: "#eff6ff", text: "#1d4ed8", badge: "bg-blue-100 text-blue-700" };
}

function labelStatus(rota: Rota): string {
  if (rota.status === "concluida") return "Concluída";
  const concluidas = rota.itens.filter((i) => i.concluido).length;
  return `${concluidas}/${rota.itens.length} cidades`;
}

function proximaCidade(rota: Rota): ItemRota | null {
  return rota.itens.find((i) => !i.concluido) ?? null;
}

function ultimaCidadeConcluida(rota: Rota): ItemRota | null {
  const concluidas = rota.itens.filter((i) => i.concluido);
  return concluidas[concluidas.length - 1] ?? null;
}

function cidadeAtual(rota: Rota): string {
  if (rota.status === "concluida") return "Encerrada";
  const prox = proximaCidade(rota);
  const ult = ultimaCidadeConcluida(rota);
  if (prox) return `Próxima: ${prox.cidadeNome}`;
  if (ult) return `Última: ${ult.cidadeNome}`;
  return "Em rota";
}

function mapsUrlCidade(cidade: string, uf?: string): string {
  const q = encodeURIComponent(uf ? `${cidade}, ${uf}, Brasil` : `${cidade}, Brasil`);
  return `https://www.google.com/maps/search/${q}`;
}

function mapsEmbedMultiplo(rotas: Rota[]): string {
  // Monta URL de embed com a primeira cidade ativa como centro
  // Google Maps embed gratuito suporta apenas uma query, então centramos na cidade mais relevante
  const rotasAtivas = rotas.filter((r) => r.status !== "concluida");
  const referencia = rotasAtivas[0] ?? rotas[0];
  if (!referencia) return "";
  const prox = proximaCidade(referencia) ?? ultimaCidadeConcluida(referencia);
  const cidade = prox?.cidadeNome ?? referencia.motorista;
  const q = encodeURIComponent(`${cidade}, Brasil`);
  return `https://maps.google.com/maps?q=${q}&z=9&output=embed`;
}

// ── Card lateral de cada motorista ──────────────────────────
function MotoristaCard({ rota, selecionado, onSelecionar, posicao }: {
  rota: Rota;
  selecionado: boolean;
  onSelecionar: () => void;
  posicao?: PosicaoGPS | null;
}) {
  const cor = corStatus(rota);
  const concluidas = rota.itens.filter((i) => i.concluido).length;
  const total = rota.itens.length;
  const ocorrencias = rota.itens.reduce((s, i) => s + (i.ocorrencias?.length ?? 0), 0);
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <button
      onClick={onSelecionar}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        selecionado ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100 hover:border-gray-200"
      } bg-white shadow-sm`}
    >
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 rounded-lg p-1.5 flex-shrink-0"
          style={{ backgroundColor: cor.bg }}
        >
          <IconeTruck size={14} color={cor.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{rota.motorista}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cor.badge}`}>
              {labelStatus(rota)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-gray-400">{rota.veiculo_placa}</p>
            {posicao && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                GPS ao vivo{posicao.velocidade != null && posicao.velocidade > 0 ? ` · ${Math.round(posicao.velocidade * 3.6)}km/h` : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">{cidadeAtual(rota)}</p>

          {/* Barra de progresso */}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progresso}%`,
                backgroundColor: rota.status === "concluida" ? "#16a34a" : "#0d47a1",
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400">{concluidas}/{total} cidades</span>
            {ocorrencias > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle size={10} />
                {ocorrencias}
              </span>
            )}
            {rota.hora_saida && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={10} />
                {rota.hora_saida}
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="text-gray-300 mt-1 flex-shrink-0" />
      </div>
    </button>
  );
}

// ── Painel de detalhe da rota selecionada ──────────────────
function PainelDetalhe({ rota }: { rota: Rota }) {
  const volumesSaida = rota.itens.reduce((s, i) => s + i.volumesSaida, 0);
  const volumesEntregues = rota.itens.reduce((s, i) => s + (i.volumesEntregues ?? (i.concluido ? i.volumesSaida : 0)), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">{rota.motorista}</p>
          <p className="text-xs text-gray-400">{rota.veiculo_placa} · Saída {rota.hora_saida || "—"}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Package size={12} />
          {volumesEntregues}/{volumesSaida}
        </div>
      </div>

      <div className="space-y-1.5">
        {rota.itens.map((item, idx) => (
          <a
            key={idx}
            href={mapsUrlCidade(item.cidadeNome)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-gray-50 transition-colors group"
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.concluido ? "bg-green-100" : "bg-gray-100"
            }`}>
              {item.concluido
                ? <CheckCircle2 size={12} className="text-green-600" />
                : <IconeTruck size={11} color="#9ca3af" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${item.concluido ? "text-gray-400 line-through" : "text-gray-700"}`}>
                {item.cidadeNome}
              </p>
              <p className="text-xs text-gray-400">{item.entregadorNome} · {item.volumesSaida} vol.</p>
            </div>
            {(item.ocorrencias?.length ?? 0) > 0 && (
              <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
            )}
            <IconeMapPin size={11} color="#d1d5db" />
          </a>
        ))}
      </div>
    </div>
  );
}

// Gera o sessionId do Supabase a partir dos dados da rota (mesmo algoritmo do app mobile)
function gerarSessionId(data: string, placa: string, horaSaida: string, rotaId: number): string {
  const d = data.replace(/-/g, "");
  const p = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const h = horaSaida.replace(":", "");
  return `${d}-${p}-${h}-R${rotaId}`;
}

// ── Página principal ────────────────────────────────────────
export default function MapaGeralPage() {
  const dataHoje = hoje();
  const [rotaSelecionadaId, setRotaSelecionadaId] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeSrcRef = useRef<string>("");

  const handleEvento = useCallback((_: EventoNotificacao) => {}, []);
  const { rotas, conectado, carregando } = useRotasRealtime({ dataFiltro: dataHoje, onEvento: handleEvento });

  const emAndamento = useMemo(() => rotas.filter((r) => r.status !== "concluida"), [rotas]);
  const concluidas = useMemo(() => rotas.filter((r) => r.status === "concluida"), [rotas]);
  const rotaSelecionada = useMemo(() => rotas.find((r) => r.id === rotaSelecionadaId) ?? null, [rotas, rotaSelecionadaId]);

  // Monta mapa de sessionId → rotaId para as rotas em andamento
  const sessionIds = useMemo(() =>
    rotas
      .filter((r) => r.status === "em_andamento" && r.hora_saida && r.id)
      .map((r) => gerarSessionId(r.data, r.veiculo_placa, r.hora_saida, r.id)),
    [rotas]
  );

  // Mapa sessionId → rota para lookup rápido
  const sessionParaRota = useMemo(() => {
    const m = new Map<string, Rota>();
    rotas.filter((r) => r.status === "em_andamento" && r.hora_saida && r.id).forEach((r) => {
      m.set(gerarSessionId(r.data, r.veiculo_placa, r.hora_saida, r.id), r);
    });
    return m;
  }, [rotas]);

  // Posições GPS em tempo real
  const posicoes = usePosicoes(sessionIds);

  // sessionId da rota selecionada
  const sessionSelecionada = useMemo(() => {
    if (!rotaSelecionada || !rotaSelecionada.hora_saida) return null;
    return gerarSessionId(rotaSelecionada.data, rotaSelecionada.veiculo_placa, rotaSelecionada.hora_saida, rotaSelecionada.id);
  }, [rotaSelecionada]);

  const posicaoSelecionada = sessionSelecionada ? posicoes.get(sessionSelecionada) ?? null : null;

  // URL do mapa: se tiver GPS real usa lat/lng, senão fallback para cidade
  const embedUrl = useMemo(() => {
    if (posicaoSelecionada) {
      return `https://maps.google.com/maps?q=${posicaoSelecionada.lat},${posicaoSelecionada.lng}&z=14&output=embed`;
    }
    if (rotaSelecionada) {
      const prox = proximaCidade(rotaSelecionada) ?? ultimaCidadeConcluida(rotaSelecionada);
      if (prox) {
        const q = encodeURIComponent(`${prox.cidadeNome}, Brasil`);
        return `https://maps.google.com/maps?q=${q}&z=11&output=embed`;
      }
    }
    // Fallback: primeiro motorista com GPS ou primeira cidade
    const primeiroPosicao = posicoes.size > 0 ? [...posicoes.values()][0] : null;
    if (primeiroPosicao) {
      return `https://maps.google.com/maps?q=${primeiroPosicao.lat},${primeiroPosicao.lng}&z=11&output=embed`;
    }
    return mapsEmbedMultiplo(rotas);
  }, [posicaoSelecionada, rotaSelecionada, posicoes, rotas]);

  useEffect(() => {
    if (!embedUrl || embedUrl === iframeSrcRef.current) return;
    iframeSrcRef.current = embedUrl;
    if (iframeRef.current) iframeRef.current.src = embedUrl;
  }, [embedUrl]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <NavBar />
      {/* Sub-header com status ao vivo */}
      <div className="bg-[#0d47a1]/90 text-white px-5 py-1.5 flex items-center justify-between text-xs flex-shrink-0 border-t border-white/10">
        <span className="text-blue-200">{emAndamento.length} em rota · {concluidas.length} concluída{concluidas.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-3">
          {posicoes.size > 0 && (
            <div className="flex items-center gap-1.5 text-green-300">
              <Navigation size={11} />
              {posicoes.size} GPS ativo{posicoes.size !== 1 ? "s" : ""}
            </div>
          )}
          <div className={`flex items-center gap-1.5 ${conectado ? "text-white/60" : "text-red-300"}`}>
            {conectado ? <Wifi size={11} /> : <WifiOff size={11} />}
            {conectado ? "Ao vivo" : "Reconectando"}
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex overflow-hidden">

        {/* Painel lateral */}
        <aside className="w-80 flex-shrink-0 flex flex-col bg-white border-r border-gray-100 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {carregando ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#0d47a1] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rotas.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-3 flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100"><IconeTruck size={28} color="#d1d5db" /></div>
                <p className="text-sm text-gray-400">Nenhuma rota hoje</p>
              </div>
            ) : (
              <>
                {emAndamento.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-1">
                      Em rota ({emAndamento.length})
                    </p>
                    {emAndamento.map((r) => {
                      const sid = r.hora_saida ? gerarSessionId(r.data, r.veiculo_placa, r.hora_saida, r.id) : null;
                      return (
                        <MotoristaCard
                          key={r.id}
                          rota={r}
                          selecionado={r.id === rotaSelecionadaId}
                          onSelecionar={() => setRotaSelecionadaId(r.id === rotaSelecionadaId ? null : r.id)}
                          posicao={sid ? posicoes.get(sid) : null}
                        />
                      );
                    })}
                  </>
                )}
                {concluidas.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">
                      Concluídas ({concluidas.length})
                    </p>
                    {concluidas.map((r) => (
                      <MotoristaCard
                        key={r.id}
                        rota={r}
                        selecionado={r.id === rotaSelecionadaId}
                        onSelecionar={() => setRotaSelecionadaId(r.id === rotaSelecionadaId ? null : r.id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Detalhe da rota selecionada */}
          {rotaSelecionada && (
            <div className="border-t border-gray-100 p-3 max-h-72 overflow-y-auto flex-shrink-0">
              <PainelDetalhe rota={rotaSelecionada} />
            </div>
          )}
        </aside>

        {/* Mapa */}
        <main className="flex-1 relative bg-gray-200">
          <iframe
            ref={iframeRef}
            width="100%"
            height="100%"
            style={{ border: "none", display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {rotas.length === 0 && !carregando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
              <div className="mb-3 flex items-center justify-center w-20 h-20 rounded-3xl bg-gray-200"><IconeTruck size={40} color="#d1d5db" /></div>
              <p className="text-gray-400 font-medium">Nenhuma rota para exibir</p>
            </div>
          )}

          {/* Legenda flutuante */}
          {rotas.length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 space-y-1.5 text-xs">
              <p className="font-semibold text-gray-600 mb-2">Legenda</p>
              <div className="flex items-center gap-2"><div className="flex items-center justify-center w-5 h-5 rounded bg-blue-100"><IconeTruck size={12} color="#1d4ed8" /></div><span className="text-gray-500">Em rota</span></div>
              <div className="flex items-center gap-2"><div className="flex items-center justify-center w-5 h-5 rounded bg-amber-100"><IconeTruck size={12} color="#b45309" /></div><span className="text-gray-500">Com ocorrência</span></div>
              <div className="flex items-center gap-2"><div className="flex items-center justify-center w-5 h-5 rounded bg-green-100"><IconeTruck size={12} color="#15803d" /></div><span className="text-gray-500">Concluída</span></div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-50"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" /><span className="text-gray-400">GPS ao vivo ativo</span></div>
              <p className="text-gray-300 pt-1 border-t border-gray-50">Toque no motorista para<br/>centralizar no mapa</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
