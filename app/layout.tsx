import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Cohere uses proprietary CohereText / Unica77 / CohereMono. These are the
// documented public fallbacks: a tight geometric display face, a neutral
// body face, and a monospace for technical labels.
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Otomasi Terjadwal",
  description: "Dasbor agen otomatis terjadwal untuk banyak akun",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${body.variable} ${display.variable} ${mono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
