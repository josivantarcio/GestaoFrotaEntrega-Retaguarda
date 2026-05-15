"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Jornada, Descarga } from "@/lib/types";

export function useJornadasDescargasRealtime(dataFiltro: string) {
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [descargas, setDescargas] = useState<Descarga[]>([]);

  const jornadasRef = useRef<Map<number, Jornada>>(new Map());
  const descargasRef = useRef<Map<number, Descarga>>(new Map());

  const carregar = useCallback(async () => {
    try {
      const [rj, rd] = await Promise.all([
        fetch(`/api/sync/jornadas?data=${dataFiltro}`).then((r) => r.json()),
        fetch(`/api/sync/descargas?data=${dataFiltro}`).then((r) => r.json()),
      ]);

      const mj = new Map<number, Jornada>();
      (rj as Jornada[]).forEach((j) => mj.set(j.id, j));
      jornadasRef.current = mj;
      setJornadas([...mj.values()]);

      const md = new Map<number, Descarga>();
      (rd as Descarga[]).forEach((d) => md.set(d.id, d));
      descargasRef.current = md;
      setDescargas([...md.values()]);
    } catch {
      // ignore
    }
  }, [dataFiltro]);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // SSE: listen to the shared /api/events stream
  useEffect(() => {
    let es: EventSource | null = null;
    let reconectarTimeout: ReturnType<typeof setTimeout> | null = null;
    let ativo = true;

    function conectar() {
      if (!ativo) return;
      es = new EventSource("/api/events");

      es.onerror = () => {
        es?.close();
        if (ativo) reconectarTimeout = setTimeout(conectar, 7_000);
      };

      es.onmessage = (e: MessageEvent) => {
        try {
          const evento = JSON.parse(e.data) as { tipo: string; payload: unknown };

          if (evento.tipo === "jornada_upserted") {
            const j = evento.payload as Jornada;
            if (j.data !== dataFiltro) return;
            jornadasRef.current.set(j.id, j);
            setJornadas([...jornadasRef.current.values()]);
          } else if (evento.tipo === "descarga_upserted") {
            const d = evento.payload as Descarga;
            if (d.data !== dataFiltro) return;
            descargasRef.current.set(d.id, d);
            setDescargas([...descargasRef.current.values()]);
          }
        } catch {
          // invalid JSON
        }
      };
    }

    conectar();
    return () => {
      ativo = false;
      if (reconectarTimeout) clearTimeout(reconectarTimeout);
      es?.close();
    };
  }, [dataFiltro]);

  return { jornadas, descargas };
}
