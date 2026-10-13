import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loyverse POS | Punto de Venta & Back Office",
  description: "Sistema de punto de venta táctil, rápido y profesional con gestión de inventario, turnos y reportes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full overflow-hidden bg-slate-900 font-sans select-none">
        {children}
      </body>
    </html>
  );
}
