"use client";

import { use, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Localizacao {
  id: number; rota_id: number; lat: number; lng: number;
  velocidade: number | null; criado_em: string;
  motorista?: string; veiculo_placa?: string;
  hora_saida?: string; data?: string; status?: string;
}

interface Evento {
  id: number; rota_id: number; tipo: string;
  payload: Record<string, any>; criado_em: string;
}

const TIPO_LABEL: Record<string, string> = {
  rota_iniciada: "Rota iniciada",
  cidade_concluida: "Cidade concluída",
  pausa_iniciada: "Pausa iniciada",
  pausa_finalizada: "Pausa encerrada",
  rota_encerrada: "Rota encerrada",
};

const TIPO_ICON: Record<string, string> = {
  rota_iniciada: "🚛",
  cidade_concluida: "✅",
  pausa_iniciada: "🍽️",
  pausa_finalizada: "▶️",
  rota_encerrada: "🏁",
};

const TIPO_COR: Record<string, string> = {
  rota_iniciada: "#2563eb",
  cidade_concluida: "#16a34a",
  pausa_iniciada: "#d97706",
  pausa_finalizada: "#7c3aed",
  rota_encerrada: "#dc2626",
};

function tocarSom() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silencioso */ }
}

function horaRelativa(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function dataBR(d?: string) {
  if (!d) return "";
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

function EventoDetalhe({ ev }: { ev: Evento }) {
  const p = ev.payload;
  if (ev.tipo === "cidade_concluida") return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      <div><b>Entregador:</b> {p.entregadorNome}</div>
      <div><b>Volumes saída:</b> {p.volumesSaida}{p.volumesEntregues != null ? ` · Entregues: ${p.volumesEntregues}` : ""}{p.volumesDevolvidos ? ` · Devolvidos: ${p.volumesDevolvidos}` : ""}</div>
      {p.horaConclusao && <div><b>Horário:</b> {p.horaConclusao}</div>}
      {p.ocorrencias?.length > 0 && (
        <div><b>Ocorrências:</b> {p.ocorrencias.map((o: any) => `${o.tipo}${o.quantidade > 1 ? ` (${o.quantidade})` : ""}`).join(", ")}</div>
      )}
      {p.nomeProxima && <div><b>Próxima:</b> {p.nomeProxima}{p.previsaoProxima ? ` ~${p.previsaoProxima}` : ""}</div>}
    </div>
  );
  if (ev.tipo === "rota_iniciada") return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      <div><b>Motorista:</b> {p.motorista} · <b>Veículo:</b> {p.veiculoPlaca}</div>
      <div><b>Saída:</b> {p.horaSaida} — {dataBR(p.data)}</div>
      <div><b>Cidades:</b> {p.totalCidades} · <b>Volumes:</b> {p.totalVolumes}</div>
    </div>
  );
  if (ev.tipo === "pausa_iniciada" || ev.tipo === "pausa_finalizada") return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      <div><b>Tipo:</b> {p.tipo}</div>
      {p.local && <div><b>Local:</b> {p.local}</div>}
      {p.horaInicio && <div><b>Início:</b> {p.horaInicio}</div>}
      {p.horaFim && <div><b>Fim:</b> {p.horaFim}</div>}
      {p.duracaoMin != null && <div><b>Duração:</b> {p.duracaoMin} min</div>}
    </div>
  );
  if (ev.tipo === "rota_encerrada") return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      {p.horaChegada && <div><b>Chegada:</b> {p.horaChegada}</div>}
      {p.kmTotal != null && <div><b>KM percorridos:</b> {p.kmTotal}</div>}
    </div>
  );
  return null;
}

export default function RastrearPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const rotaId = Number(id);
  const [posicao, setPosicao] = useState<Localizacao | null>(null);
  const [encerrada, setEncerrada] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoAberto, setEventoAberto] = useState<number | null>(null);
  const [timelineAberta, setTimelineAberta] = useState(false);
  const [carrinhoPos, setCarrinhoPos] = useState(0);
  const primeiroCarregamento = useRef(true);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Anima carrinho na timeline
  useEffect(() => {
    if (eventos.length === 0) return;
    const concluidas = eventos.filter(e => e.tipo === "cidade_concluida").length;
    const total = eventos.find(e => e.tipo === "rota_iniciada")?.payload?.totalCidades ?? concluidas;
    const pct = total > 0 ? Math.min((concluidas / total) * 100, 95) : 0;
    setCarrinhoPos(pct);
  }, [eventos]);

  useEffect(() => {
    async function carregar() {
      const [{ data: locs }, { data: evs }] = await Promise.all([
        supabase.from("localizacoes").select("*").eq("rota_id", rotaId).order("criado_em", { ascending: false }).limit(1),
        supabase.from("eventos_rota").select("*").eq("rota_id", rotaId).order("criado_em", { ascending: true }),
      ]);
      if (locs && locs.length > 0) {
        setPosicao(locs[0]);
        setUltimaAtualizacao(new Date(locs[0].criado_em));
        if (locs[0].status === "concluida") setEncerrada(true);
      }
      if (evs) setEventos(evs);
      primeiroCarregamento.current = false;
    }
    carregar();

    const channel = supabase.channel(`rastrear-${rotaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "localizacoes", filter: `rota_id=eq.${rotaId}` }, (payload) => {
        const nova = payload.new as Localizacao;
        setPosicao(nova);
        setUltimaAtualizacao(new Date(nova.criado_em));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "localizacoes", filter: `rota_id=eq.${rotaId}` }, (payload) => {
        if (payload.new.status === "concluida") setEncerrada(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos_rota", filter: `rota_id=eq.${rotaId}` }, (payload) => {
        const novo = payload.new as Evento;
        setEventos(prev => [...prev, novo]);
        if (!primeiroCarregamento.current && novo.tipo === "cidade_concluida") {
          tocarSom();
          setTimelineAberta(true);
        }
        if (novo.tipo === "rota_encerrada") setEncerrada(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rotaId]);

  const mapsUrl = posicao
    ? `https://maps.google.com/maps?q=${posicao.lat},${posicao.lng}&z=15&output=embed`
    : null;

  const concluidas = eventos.filter(e => e.tipo === "cidade_concluida").length;
  const totalCidades = eventos.find(e => e.tipo === "rota_iniciada")?.payload?.totalCidades ?? 0;
  const motorista = posicao?.motorista ?? eventos.find(e => e.tipo === "rota_iniciada")?.payload?.motorista ?? "—";
  const placa = posicao?.veiculo_placa ?? eventos.find(e => e.tipo === "rota_iniciada")?.payload?.veiculoPlaca ?? "—";
  const horaSaida = posicao?.hora_saida ?? "";
  const dataRota = posicao?.data ?? "";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ backgroundColor: "#ee4d2d", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 20 }}>📍</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{motorista} · {placa}</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              {horaSaida ? `Saída ${horaSaida} — ${dataBR(dataRota)}` : "Aguardando…"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {totalCidades > 0 && (
              <div style={{ color: "#fff", fontSize: 12, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "2px 8px" }}>
                {concluidas}/{totalCidades}
              </div>
            )}
            {encerrada ? (
              <div style={{ backgroundColor: "#7f1d1d", borderRadius: 12, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 700 }}>ENCERRADA</div>
            ) : posicao ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#4ade80", animation: "pulse 2s infinite" }} />
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 11 }}>AO VIVO</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Barra de progresso com carrinho */}
        {(totalCidades > 0 || concluidas > 0) && (
          <div
            onClick={() => setTimelineAberta(t => !t)}
            style={{ cursor: "pointer", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 20, height: 28, position: "relative", overflow: "hidden" }}
          >
            {/* progresso */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${carrinhoPos}%`,
              backgroundColor: "rgba(255,255,255,0.25)",
              borderRadius: 20,
              transition: "width 1s ease",
            }} />
            {/* carrinho animado */}
            <div style={{
              position: "absolute",
              left: `calc(${carrinhoPos}% - 14px)`,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 18,
              transition: "left 1s ease",
              filter: "drop-shadow(0 0 4px rgba(0,0,0,0.3))",
            }}>🚛</div>
            {/* label */}
            <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600 }}>
              {timelineAberta ? "▲ fechar" : "▼ timeline"}
            </div>
          </div>
        )}
      </div>

      {/* Timeline expansível */}
      {timelineAberta && (
        <div style={{ backgroundColor: "#1e1e2e", maxHeight: "40vh", overflowY: "auto", flexShrink: 0 }}>
          {eventos.length === 0 ? (
            <div style={{ color: "#9ca3af", padding: 16, fontSize: 13, textAlign: "center" }}>Nenhum evento ainda</div>
          ) : (
            <div style={{ padding: "8px 16px" }}>
              {eventos.map((ev) => (
                <div key={ev.id}>
                  <div
                    onClick={() => setEventoAberto(eventoAberto === ev.id ? null : ev.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: TIPO_COR[ev.tipo] ?? "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                      {TIPO_ICON[ev.tipo] ?? "•"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f3f4f6", fontSize: 13, fontWeight: 600 }}>
                        {TIPO_LABEL[ev.tipo] ?? ev.tipo}
                        {ev.tipo === "cidade_concluida" && ` — ${ev.payload.cidadeNome}`}
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 11 }}>
                        {new Date(ev.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{horaRelativa(new Date(ev.criado_em))}
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>{eventoAberto === ev.id ? "▲" : "▼"}</div>
                  </div>
                  {eventoAberto === ev.id && (
                    <div style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "10px 12px", margin: "4px 0 8px 38px" }}>
                      <EventoDetalhe ev={ev} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mapa */}
      <div style={{ flex: 1, backgroundColor: "#e5e7eb", position: "relative" }}>
        {mapsUrl ? (
          <iframe
            key={`${posicao?.lat}-${posicao?.lng}`}
            src={mapsUrl}
            width="100%" height="100%"
            style={{ border: "none", display: "block" }}
            allowFullScreen loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ fontSize: 48 }}>📡</div>
            <div style={{ color: "#6b7280", fontSize: 14, textAlign: "center", padding: "0 32px" }}>
              {encerrada ? "Esta rota foi encerrada." : "Aguardando primeira localização…\nO motorista precisa estar com o app aberto na tela da rota."}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{ backgroundColor: "#fff", padding: "6px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {ultimaAtualizacao ? `GPS: ${horaRelativa(ultimaAtualizacao)}` : "Sem GPS ainda"}
        </div>
        {posicao?.velocidade != null && posicao.velocidade > 0 && (
          <div style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>{Math.round(posicao.velocidade * 3.6)} km/h</div>
        )}
        <div style={{ fontSize: 11, color: "#9ca3af" }}>_RotaFacil · Jt@rcio_</div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}
