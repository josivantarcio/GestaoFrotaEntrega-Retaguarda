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

function usePosicoes(rotaIds: string[]) {
  const [posicoes, setPosicoes] = useState<Map<string, PosicaoGPS>>(new Map());

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || rotaIds.length === 0) return;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    supabase
      .from("localizacoes")
      .select("*")
      .in("rota_id", rotaIds)
      .order("criado_em", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const mapa = new Map<string, PosicaoGPS>();
        for (const row of data) {
          if (!mapa.has(row.rota_id)) mapa.set(row.rota_id, row as PosicaoGPS);
        }
        setPosicoes(mapa);
      });

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

function corStatus(rota: Rota): { bg: string; text: string; badge: string; hex: string } {
  if (rota.status === "concluida") return { bg: "#f0fdf4", text: "#15803d", badge: "bg-green-100 text-green-700", hex: "#16a34a" };
  const temOco = rota.itens.some((i) => (i.ocorrencias?.length ?? 0) > 0);
  if (temOco) return { bg: "#fffbeb", text: "#b45309", badge: "bg-amber-100 text-amber-700", hex: "#d97706" };
  return { bg: "#eff6ff", text: "#1d4ed8", badge: "bg-blue-100 text-blue-700", hex: "#0d47a1" };
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

function mapsUrlCidade(cidade: string): string {
  const q = encodeURIComponent(`${cidade}, Brasil`);
  return `https://www.google.com/maps/search/${q}`;
}

function gerarSessionId(data: string, placa: string, horaSaida: string, rotaId: number): string {
  const d = data.replace(/-/g, "");
  const p = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const h = horaSaida.replace(":", "");
  return `${d}-${p}-${h}-R${rotaId}`;
}

// SVG do marcador de carrinho para usar no Leaflet
function svgCarrinho(cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="${cor}" stroke="white" stroke-width="2.5"/>
    <g transform="translate(8,10)" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 13H2a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 2 1.5h8.5a1.5 1.5 0 0 1 1.5 1.5v2.25"/>
      <rect x="7" y="8.25" width="10.5" height="7.5" rx="1.5"/>
      <circle cx="9" cy="15.75" r="0.75"/>
      <circle cx="15" cy="15.75" r="0.75"/>
    </g>
  </svg>`;
}

// Componente do mapa Leaflet
function MapaLeaflet({
  posicoes,
  rotas,
  rotaSelecionadaId,
  sessionParaRota,
}: {
  posicoes: Map<string, PosicaoGPS>;
  rotas: Rota[];
  rotaSelecionadaId: number | null;
  sessionParaRota: Map<string, Rota>;
}) {
  const mapRef = useRef<any>(null);
  const markerMapRef = useRef<Map<string, any>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializa o mapa uma única vez
  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current || !containerRef.current) return;

    import("leaflet").then((L) => {
      // Corrige ícone padrão quebrado no Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [-14.235, -51.925],
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      L.control.attribution({ prefix: false }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerMapRef.current.clear();
      }
    };
  }, []);

  // Atualiza marcadores quando posições mudam
  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      const idsAtivos = new Set<string>();

      posicoes.forEach((pos, sessionId) => {
        idsAtivos.add(sessionId);
        const rotaDoMarker = sessionParaRota.get(sessionId);
        const cor = rotaDoMarker ? corStatus(rotaDoMarker).hex : "#0d47a1";
        const latLng: [number, number] = [pos.lat, pos.lng];

        if (markerMapRef.current.has(sessionId)) {
          // Move o marcador existente suavemente
          markerMapRef.current.get(sessionId).setLatLng(latLng);
        } else {
          // Cria novo marcador com ícone de carrinho
          const icon = L.divIcon({
            html: svgCarrinho(cor),
            className: "",
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -22],
          });

          const label = rotaDoMarker
            ? `<b>${rotaDoMarker.motorista}</b><br/>${rotaDoMarker.veiculo_placa}<br/>${cidadeAtual(rotaDoMarker)}`
            : sessionId;

          const marker = L.marker(latLng, { icon })
            .addTo(map)
            .bindPopup(label);

          markerMapRef.current.set(sessionId, marker);
        }

        // Atualiza popup com velocidade
        if (rotaDoMarker) {
          const vel = pos.velocidade != null && pos.velocidade > 0
            ? `<br/><span style="color:#16a34a;font-size:11px">● ${Math.round(pos.velocidade * 3.6)} km/h</span>`
            : "";
          markerMapRef.current.get(sessionId)?.setPopupContent(
            `<b>${rotaDoMarker.motorista}</b><br/>${rotaDoMarker.veiculo_placa}<br/>${cidadeAtual(rotaDoMarker)}${vel}`
          );
        }
      });

      // Remove marcadores de rotas que saíram
      markerMapRef.current.forEach((marker, sid) => {
        if (!idsAtivos.has(sid)) {
          marker.remove();
          markerMapRef.current.delete(sid);
        }
      });
    });
  }, [posicoes, sessionParaRota]);

  // Centraliza no motorista selecionado
  useEffect(() => {
    if (!mapRef.current || rotaSelecionadaId === null) return;

    const rota = rotas.find((r) => r.id === rotaSelecionadaId);
    if (!rota || !rota.hora_saida) return;
    const sid = gerarSessionId(rota.data, rota.veiculo_placa, rota.hora_saida, rota.id);
    const pos = posicoes.get(sid);
    if (pos) {
      mapRef.current.flyTo([pos.lat, pos.lng], 14, { animate: true, duration: 1 });
      markerMapRef.current.get(sid)?.openPopup();
    }
  }, [rotaSelecionadaId, posicoes, rotas]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

// Card lateral de cada motorista
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
        <div className="mt-0.5 rounded-lg p-1.5 flex-shrink-0" style={{ backgroundColor: cor.bg }}>
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

          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progresso}%`, backgroundColor: rota.status === "concluida" ? "#16a34a" : "#0d47a1" }}
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
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${item.concluido ? "bg-green-100" : "bg-gray-100"}`}>
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
            {(item.ocorrencias?.length ?? 0) > 0 && <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />}
            <IconeMapPin size={11} color="#d1d5db" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function MapaGeralPage() {
  const dataHoje = hoje();
  const [rotaSelecionadaId, setRotaSelecionadaId] = useState<number | null>(null);
  const [leafletCss, setLeafletCss] = useState(false);

  // Carrega CSS do Leaflet no cliente
  useEffect(() => {
    if (typeof window !== "undefined" && !leafletCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      setLeafletCss(true);
    }
  }, []);

  const handleEvento = useCallback((_: EventoNotificacao) => {}, []);
  const { rotas, conectado, carregando } = useRotasRealtime({ dataFiltro: dataHoje, onEvento: handleEvento });

  const emAndamento = useMemo(() => rotas.filter((r) => r.status !== "concluida"), [rotas]);
  const concluidas = useMemo(() => rotas.filter((r) => r.status === "concluida"), [rotas]);
  const rotaSelecionada = useMemo(() => rotas.find((r) => r.id === rotaSelecionadaId) ?? null, [rotas, rotaSelecionadaId]);

  const sessionIds = useMemo(() =>
    rotas
      .filter((r) => r.status === "em_andamento" && r.hora_saida && r.id)
      .map((r) => gerarSessionId(r.data, r.veiculo_placa, r.hora_saida, r.id)),
    [rotas]
  );

  const sessionParaRota = useMemo(() => {
    const m = new Map<string, Rota>();
    rotas.filter((r) => r.status === "em_andamento" && r.hora_saida && r.id).forEach((r) => {
      m.set(gerarSessionId(r.data, r.veiculo_placa, r.hora_saida, r.id), r);
    });
    return m;
  }, [rotas]);

  const posicoes = usePosicoes(sessionIds);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <NavBar />

      {/* Sub-header */}
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

        {/* Mapa Leaflet */}
        <main className="flex-1 relative">
          {leafletCss && (
            <MapaLeaflet
              posicoes={posicoes}
              rotas={rotas}
              rotaSelecionadaId={rotaSelecionadaId}
              sessionParaRota={sessionParaRota}
            />
          )}

          {rotas.length === 0 && !carregando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 z-10">
              <div className="mb-3 flex items-center justify-center w-20 h-20 rounded-3xl bg-gray-200"><IconeTruck size={40} color="#d1d5db" /></div>
              <p className="text-gray-400 font-medium">Nenhuma rota para exibir</p>
            </div>
          )}

          {/* Legenda flutuante */}
          {rotas.length > 0 && (
            <div className="absolute bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 space-y-1.5 text-xs z-[1000]">
              <p className="font-semibold text-gray-600 mb-2">Legenda</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-100"><IconeTruck size={12} color="#1d4ed8" /></div>
                <span className="text-gray-500">Em rota</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-100"><IconeTruck size={12} color="#b45309" /></div>
                <span className="text-gray-500">Com ocorrência</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded bg-green-100"><IconeTruck size={12} color="#15803d" /></div>
                <span className="text-gray-500">Concluída</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <span className="text-gray-400">GPS ao vivo ativo</span>
              </div>
              <p className="text-gray-300 pt-1 border-t border-gray-50">Toque no motorista para<br/>centralizar no mapa</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
