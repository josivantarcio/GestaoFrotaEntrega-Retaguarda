"use client";
import { Wifi, WifiOff, Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

export function TopBar({ conectado }: { conectado: boolean }) {
  const [hora, setHora] = useState("");
  const [data, setData] = useState("");
  const [permissao, setPermissao] = useState<NotificationPermission>("default");

  useEffect(() => {
    function atualizar() {
      const agora = new Date();
      setHora(agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setData(agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
    }
    atualizar();
    const id = setInterval(atualizar, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setPermissao(Notification.permission);
  }, []);

  async function ativarNotificacoes() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPermissao(perm);
  }

  return (
    <header className="bg-[#ee4d2d] text-white px-5 py-3 flex items-center justify-between shadow-md flex-shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">RouteLog</h1>
          <span className="text-xs bg-white/20 rounded px-2 py-0.5 font-medium">Retaguarda</span>
        </div>
        <p className="text-xs text-red-200 capitalize mt-0.5">{data}</p>
      </div>

      <div className="flex items-center gap-3">
        {permissao !== "granted" && (
          <button
            onClick={ativarNotificacoes}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {permissao === "denied" ? <BellOff size={13} /> : <Bell size={13} />}
            {permissao === "denied" ? "Notif. bloqueadas" : "Ativar notificações"}
          </button>
        )}

        <span className="text-sm font-mono font-bold tabular-nums">{hora}</span>

        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            conectado ? "bg-green-500/30 text-green-100" : "bg-black/20 text-red-200"
          }`}
        >
          {conectado ? <Wifi size={12} /> : <WifiOff size={12} />}
          {conectado ? "Ao vivo" : "Reconectando..."}
        </div>
      </div>
    </header>
  );
}
