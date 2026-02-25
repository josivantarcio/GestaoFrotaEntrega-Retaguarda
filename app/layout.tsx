import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Retaguarda — RouteLog",
  description: "Painel de monitoramento de rotas em tempo real",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
