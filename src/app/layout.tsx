import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivo — Transmite tus eventos sin límites",
  description:
    "Videollamadas grupales para eventos en vivo: bodas, graduaciones, cumpleaños y conferencias. Sin límite de tiempo y con control total del anfitrión.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Evita zoom accidental con doble tap dentro de la sala en móvil
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
