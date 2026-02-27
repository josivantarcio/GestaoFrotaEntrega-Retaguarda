"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Rota, ItemRota, Ocorrencia, EventoNotificacao } from "@/lib/types";

interface Options {
  dataFiltro: string; // "YYYY-MM-DD"
  onEvento: (e: EventoNotificacao) => void;
}

export function useRotasRealtime({ dataFiltro, onEvento }: Options) {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const rotasRef = useRef<Map<number, Rota>>(new Map());
  const onEventoRef = useRef(onEvento);
  onEventoRef.current = onEvento;

  const setRotasOrdenadas = useCallback((mapa: Map<number, Rota>) => {
    setRotas(
      [...mapa.values()].sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      )
    );
  }, []);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/sync/rotas?data=${dataFiltro}`);
      if (!res.ok) return;
      const data: Rota[] = await res.json();
      const mapa = new Map<number, Rota>();
      data.forEach((r) => mapa.set(r.id, r));
      rotasRef.current = mapa;
      setRotasOrdenadas(mapa);
    } catch {
      // silently ignore network errors
    }
  }, [dataFiltro, setRotasOrdenadas]);

  // Carregamento inicial
  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  // Polling a cada 15s como fallback quando SSE não conecta
  useEffect(() => {
    const intervalo = setInterval(carregar, 15_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // SSE
  useEffect(() => {
    let es: EventSource | null = null;
    let reconectarTimeout: ReturnType<typeof setTimeout> | null = null;
    let ativo = true;

    function conectar() {
      if (!ativo) return;
      es = new EventSource("/api/events");

      es.onopen = () => {
        if (ativo) setConectado(true);
      };

      es.onerror = () => {
        setConectado(false);
        es?.close();
        if (ativo) {
          reconectarTimeout = setTimeout(conectar, 7_000);
        }
      };

      es.onmessage = (e: MessageEvent) => {
        try {
          const evento = JSON.parse(e.data) as { tipo: string; tabela: string; payload: unknown };
          if (evento.tipo !== "rota_upserted" || evento.tabela !== "rotas") return;

          const nova = evento.payload as Rota;
          if (nova.data !== dataFiltro) return;

          const antiga = rotasRef.current.get(nova.id);

          if (!antiga) {
            onEventoRef.current({ tipo: "rota_iniciada", rota: nova });
          } else if (nova.status === "concluida" && antiga.status !== "concluida") {
            onEventoRef.current({ tipo: "rota_encerrada", rota: nova });
          } else {
            detectarMudancasItens(antiga, nova, onEventoRef.current);
          }

          rotasRef.current.set(nova.id, nova);
          setRotasOrdenadas(rotasRef.current);
        } catch {
          // invalid JSON — ignore
        }
      };
    }

    conectar();

    return () => {
      ativo = false;
      if (reconectarTimeout) clearTimeout(reconectarTimeout);
      es?.close();
      setConectado(false);
    };
  }, [dataFiltro, setRotasOrdenadas]);

  return { rotas, conectado, carregando };
}

function detectarMudancasItens(
  antiga: Rota,
  nova: Rota,
  onEvento: (e: EventoNotificacao) => void
) {
  nova.itens.forEach((itemNovo: ItemRota, idx: number) => {
    const itemAntigo = antiga.itens[idx];
    if (!itemAntigo) return;

    if (itemNovo.concluido && !itemAntigo.concluido) {
      onEvento({ tipo: "cidade_concluida", rota: nova, cidade: itemNovo });
      return;
    }

    const ocosNovo = itemNovo.ocorrencias?.length ?? 0;
    const ocosAntigo = itemAntigo.ocorrencias?.length ?? 0;
    if (ocosNovo > ocosAntigo) {
      const novaOco = itemNovo.ocorrencias[ocosNovo - 1] as Ocorrencia;
      onEvento({ tipo: "ocorrencia_registrada", rota: nova, cidade: itemNovo, ocorrencia: novaOco });
    }
  });
}
