"use client";

import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Localizacao {
  id: number; rota_id: string | number; lat: number; lng: number;
  velocidade: number | null; criado_em: string;
  motorista?: string; veiculo_placa?: string;
  hora_saida?: string; data?: string; status?: string;
}

interface Evento {
  id: number; rota_id: string | number; tipo: string;
  payload: Record<string, any>; criado_em: string;
}

const TIPO_LABEL: Record<string, string> = {
  rota_iniciada:    "Rota iniciada",
  cidade_concluida: "Entrega concluída",
  pausa_iniciada:   "Pausa iniciada",
  pausa_finalizada: "Pausa encerrada",
  rota_encerrada:   "Rota encerrada",
};

const TIPO_COR: Record<string, { bg: string; dot: string; text: string }> = {
  rota_iniciada:    { bg: "#eff6ff", dot: "#3b82f6", text: "#1d4ed8" },
  cidade_concluida: { bg: "#f0fdf4", dot: "#22c55e", text: "#15803d" },
  pausa_iniciada:   { bg: "#fffbeb", dot: "#f59e0b", text: "#b45309" },
  pausa_finalizada: { bg: "#faf5ff", dot: "#a855f7", text: "#7e22ce" },
  rota_encerrada:   { bg: "#f8fafc", dot: "#64748b", text: "#334155" },
};

function IconeTruck({ size = 16, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
      <rect x="9" y="11" width="14" height="10" rx="2"/>
      <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    </svg>
  );
}

function IconeCheck({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconePlay({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function IconePause({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

function IconeFlag({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
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

function IconeChevron({ up = false, color = "#94a3b8" }: { up?: boolean; color?: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
    </svg>
  );
}

function iconeParaTipo(tipo: string) {
  const cor = TIPO_COR[tipo]?.dot ?? "#6b7280";
  if (tipo === "rota_iniciada")    return <IconeMapPin size={13} color={cor} />;
  if (tipo === "cidade_concluida") return <IconeCheck size={13} color={cor} />;
  if (tipo === "pausa_iniciada")   return <IconePause size={12} color={cor} />;
  if (tipo === "pausa_finalizada") return <IconePlay  size={12} color={cor} />;
  if (tipo === "rota_encerrada")   return <IconeFlag  size={13} color={cor} />;
  return null;
}

function tocarSom() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
  } catch { /* silencioso */ }
}

function horaStr(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dataBR(d?: string) {
  if (!d) return "";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

function horaRelativa(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function EventoDetalhe({ ev }: { ev: Evento }) {
  const p = ev.payload;
  const row = (label: string, value: any) => value != null && value !== "" && (
    <div key={label} style={{ display: "flex", gap: 6 }}>
      <span style={{ color: "#94a3b8", minWidth: 90, fontSize: 11 }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 500 }}>{value}</span>
    </div>
  );
  if (ev.tipo === "rota_iniciada") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {row("Motorista", p.motorista)} {row("Veículo", p.veiculoPlaca)}
      {row("Saída", p.horaSaida && `${p.horaSaida} — ${dataBR(p.data)}`)}
      {row("Cidades", p.totalCidades)} {row("Volumes", p.totalVolumes)}
    </div>
  );
  if (ev.tipo === "cidade_concluida") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {row("Entregador", p.entregadorNome)}
      {row("Volumes", `${p.volumesSaida} saída${p.volumesEntregues != null ? ` · ${p.volumesEntregues} entregues` : ""}${p.volumesDevolvidos ? ` · ${p.volumesDevolvidos} devolvidos` : ""}`)}
      {row("Horário", p.horaConclusao)}
      {p.ocorrencias?.length > 0 && row("Ocorrências", p.ocorrencias.map((o: any) => `${o.tipo}${o.quantidade > 1 ? ` (${o.quantidade})` : ""}`).join(", "))}
      {p.nomeProxima && row("Próxima", `${p.nomeProxima}${p.previsaoProxima ? ` · ~${p.previsaoProxima}` : ""}`)}
    </div>
  );
  if (ev.tipo === "pausa_iniciada" || ev.tipo === "pausa_finalizada") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {row("Tipo", p.tipo)} {row("Local", p.local)}
      {row("Início", p.horaInicio)} {row("Fim", p.horaFim)}
      {row("Duração", p.duracaoMin != null ? `${p.duracaoMin} min` : null)}
    </div>
  );
  if (ev.tipo === "rota_encerrada") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {row("Chegada", p.horaChegada)}
      {row("KM percorridos", p.kmTotal)}
    </div>
  );
  return null;
}

// SVG do marcador de carrinho
function svgCarrinhoStr(pulsando = false): string {
  const pulso = pulsando
    ? `<circle cx="20" cy="20" r="18" fill="none" stroke="#4ade80" stroke-width="2" opacity="0.5">
         <animate attributeName="r" from="18" to="26" dur="1.5s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
       </circle>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    ${pulso}
    <circle cx="22" cy="22" r="18" fill="#0d47a1" stroke="white" stroke-width="2.5"/>
    <g transform="translate(10,11)" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 14H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5"/>
      <rect x="8" y="9" width="13" height="9" rx="1.5"/>
      <circle cx="11" cy="18" r="1"/><circle cx="18" cy="18" r="1"/>
    </g>
  </svg>`;
}

// Componente do mapa Leaflet para rastreamento individual
function MapaRastrear({ posicao, ultimaAtu }: { posicao: Localizacao | null; ultimaAtu: Date | null }) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const trailRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cssCarregado = useRef(false);

  // Inicializa o mapa
  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current || !containerRef.current) return;

    // Garante que o CSS do Leaflet está carregado
    if (!cssCarregado.current) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      cssCarregado.current = true;
    }

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current!, {
        center: [-14.235, -51.925],
        zoom: 5,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        trailRef.current = [];
      }
    };
  }, []);

  // Atualiza posição em tempo real
  useEffect(() => {
    if (!posicao || !mapRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      const latLng: [number, number] = [posicao.lat, posicao.lng];
      const isMoving = posicao.velocidade != null && posicao.velocidade > 1;

      const icon = L.divIcon({
        html: svgCarrinhoStr(isMoving),
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -24],
      });

      if (markerRef.current) {
        // Move suavemente sem recriar o marcador
        markerRef.current.setLatLng(latLng);
        markerRef.current.setIcon(icon);
      } else {
        // Primeiro marcador
        markerRef.current = L.marker(latLng, { icon })
          .addTo(map)
          .bindPopup(
            `<b>${posicao.motorista ?? "Motorista"}</b><br/>${posicao.veiculo_placa ?? ""}`,
            { closeButton: false }
          )
          .openPopup();

        map.flyTo(latLng, 15, { animate: true, duration: 1.5 });
      }

      // Rastro de trilha (polyline dos últimos N pontos)
      trailRef.current.push(latLng);
      if (trailRef.current.length > 60) trailRef.current.shift();

      // Limpa trilha anterior e redesenha
      map.eachLayer((layer: any) => {
        if (layer._trail) { layer.remove(); }
      });

      if (trailRef.current.length > 1) {
        const trail = L.polyline(trailRef.current, {
          color: "#0d47a1",
          weight: 3,
          opacity: 0.45,
          dashArray: "6 4",
        }).addTo(map);
        (trail as any)._trail = true;
      }

      // Pan suave para nova posição (sem zoom, só centraliza)
      map.panTo(latLng, { animate: true, duration: 0.8 });
    });
  }, [posicao?.lat, posicao?.lng, posicao?.velocidade]);

  return (
    <div style={{ flex: 1, position: "relative", backgroundColor: "#1e293b" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      {!posicao && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#1e293b" }}>
          <IconeMapPin size={40} color="#334155" />
          <div style={{ color: "#475569", fontSize: 13, textAlign: "center", lineHeight: 1.6, padding: "0 32px" }}>
            Aguardando localização<br/>O motorista precisa estar com o app aberto
          </div>
        </div>
      )}
    </div>
  );
}

export default function RastrearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rotaId = id;
  const [posicao, setPosicao]           = useState<Localizacao | null>(null);
  const [encerrada, setEncerrada]       = useState(false);
  const [ultimaAtu, setUltimaAtu]       = useState<Date | null>(null);
  const [eventos, setEventos]           = useState<Evento[]>([]);
  const [eventoAberto, setEventoAberto] = useState<number | null>(null);
  const [timelineAberta, setTimelineAberta] = useState(false);
  const [carrinhoPos, setCarrinhoPos]   = useState(0);
  const primeiroLoad = useRef(true);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Atualiza posição da barra de progresso
  useEffect(() => {
    if (eventos.length === 0) return;
    const concluidas = eventos.filter(e => e.tipo === "cidade_concluida").length;
    const total = eventos.find(e => e.tipo === "rota_iniciada")?.payload?.totalCidades ?? concluidas;
    setCarrinhoPos(total > 0 ? Math.min((concluidas / total) * 100, 96) : 0);
  }, [eventos]);

  useEffect(() => {
    async function carregar() {
      const [{ data: locs }, { data: evs }] = await Promise.all([
        supabase.from("localizacoes").select("*").eq("rota_id", rotaId).order("criado_em", { ascending: false }).limit(1),
        supabase.from("eventos_rota").select("*").eq("rota_id", rotaId).order("criado_em", { ascending: true }),
      ]);
      if (locs?.length) {
        setPosicao(locs[0]);
        setUltimaAtu(new Date(locs[0].criado_em));
        if (locs[0].status === "concluida") setEncerrada(true);
      }
      if (evs) setEventos(evs);
      primeiroLoad.current = false;
    }
    carregar();

    const ch = supabase.channel(`rastrear-${rotaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "localizacoes", filter: `rota_id=eq.${rotaId}` }, (p) => {
        const n = p.new as Localizacao;
        setPosicao(n);
        setUltimaAtu(new Date(n.criado_em));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "localizacoes", filter: `rota_id=eq.${rotaId}` }, (p) => {
        if (p.new.status === "concluida") setEncerrada(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos_rota", filter: `rota_id=eq.${rotaId}` }, (p) => {
        const n = p.new as Evento;
        setEventos(prev => [...prev, n]);
        if (!primeiroLoad.current && n.tipo === "cidade_concluida") { tocarSom(); setTimelineAberta(true); }
        if (n.tipo === "rota_encerrada") setEncerrada(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [rotaId]);

  const concluidas   = eventos.filter(e => e.tipo === "cidade_concluida").length;
  const totalCidades = eventos.find(e => e.tipo === "rota_iniciada")?.payload?.totalCidades ?? 0;
  const motorista    = posicao?.motorista ?? eventos.find(e => e.tipo === "rota_iniciada")?.payload?.motorista ?? "";
  const placa        = posicao?.veiculo_placa ?? eventos.find(e => e.tipo === "rota_iniciada")?.payload?.veiculoPlaca ?? "";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: "hidden", backgroundColor: "#0f172a" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #0d47a1, #1565c0)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconeTruck size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {motorista || "—"}{placa ? ` · ${placa}` : ""}
            </div>
            <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>
              {posicao?.hora_saida ? `Saída ${posicao.hora_saida} — ${dataBR(posicao.data)}` : "Aguardando localização"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {totalCidades > 0 && (
              <div style={{ color: "#94a3b8", fontSize: 11, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "2px 8px", fontVariantNumeric: "tabular-nums" }}>
                {concluidas}/{totalCidades}
              </div>
            )}
            {encerrada ? (
              <div style={{ background: "rgba(100,116,139,0.2)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: 8, padding: "3px 10px", color: "#94a3b8", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>ENCERRADA</div>
            ) : posicao ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ade80", boxShadow: "0 0 6px #4ade80", animation: "pulse 2s infinite" }} />
                <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}>AO VIVO</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Barra de progresso com carrinho */}
        {totalCidades > 0 && (
          <div
            onClick={() => setTimelineAberta(t => !t)}
            title={timelineAberta ? "Fechar timeline" : "Ver timeline"}
            style={{ cursor: "pointer", position: "relative", height: 32, display: "flex", alignItems: "center" }}
          >
            <div style={{ position: "absolute", left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${carrinhoPos}%`, background: "linear-gradient(90deg, #0d47a1, #1565c0)", borderRadius: 2, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>

            {totalCidades > 1 && Array.from({ length: totalCidades - 1 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", left: `${((i + 1) / totalCidades) * 100}%`, width: 1, height: 7, backgroundColor: "rgba(255,255,255,0.15)", transform: "translateX(-50%)", top: "50%", marginTop: -3.5 }} />
            ))}

            <div style={{
              position: "absolute",
              left: `${carrinhoPos}%`,
              transform: "translateX(-50%)",
              transition: "left 1.2s cubic-bezier(0.4,0,0.2,1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28,
              background: "linear-gradient(135deg, #0d47a1, #1565c0)",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(13,71,161,0.5)",
            }}>
              <IconeTruck size={14} color="#fff" />
            </div>

            <div style={{ position: "absolute", right: 0, color: "#475569", fontSize: 10, userSelect: "none" }}>
              {timelineAberta ? "fechar" : "timeline"}
            </div>
          </div>
        )}
      </div>

      {/* ── Timeline ── */}
      {timelineAberta && eventos.length > 0 && (
        <div style={{ backgroundColor: "#0f172a", borderBottom: "1px solid rgba(255,255,255,0.05)", maxHeight: "38vh", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ padding: "4px 18px 8px" }}>
            {eventos.map((ev, idx) => {
              const cor = TIPO_COR[ev.tipo] ?? { bg: "#f8fafc", dot: "#94a3b8", text: "#64748b" };
              const aberto = eventoAberto === ev.id;
              const ultimo = idx === eventos.length - 1;
              return (
                <div key={ev.id} style={{ display: "flex", gap: 12, paddingTop: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: cor.dot, flexShrink: 0, marginTop: 3 }} />
                    {!ultimo && <div style={{ width: 1, flex: 1, minHeight: 16, backgroundColor: "rgba(255,255,255,0.06)", marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div
                      onClick={() => setEventoAberto(aberto ? null : ev.id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
                    >
                      <span style={{ color: cor.dot }}>{iconeParaTipo(ev.tipo)}</span>
                      <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 500, flex: 1 }}>
                        {TIPO_LABEL[ev.tipo]}
                        {ev.tipo === "cidade_concluida" && <span style={{ color: "#94a3b8", fontWeight: 400 }}> — {ev.payload.cidadeNome}</span>}
                      </span>
                      <span style={{ color: "#475569", fontSize: 10, marginRight: 4 }}>{horaStr(ev.criado_em)}</span>
                      <IconeChevron up={aberto} />
                    </div>
                    {aberto && (
                      <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                        <EventoDetalhe ev={ev} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mapa Leaflet ── */}
      <MapaRastrear posicao={posicao} ultimaAtu={ultimaAtu} />

      {/* ── Rodapé ── */}
      <div style={{ background: "#0f172a", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "7px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#475569" }}>
          {ultimaAtu ? `GPS ${horaRelativa(ultimaAtu)}` : "Sem sinal"}
        </div>
        {posicao?.velocidade != null && posicao.velocidade > 0 && (
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{Math.round(posicao.velocidade * 3.6)} km/h</div>
        )}
        <div style={{ fontSize: 10, color: "#334155" }}>RotaFacil · Jt@rcio</div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        .leaflet-container { background: #1e293b; }
      `}</style>
    </div>
  );
}
