import { Bot } from "lucide-react";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* announcement-bar — full-width black strip, 36px, centered microcopy */}
      <div className="flex h-9 items-center justify-center gap-2 bg-black px-4 text-center">
        <Bot className="h-3.5 w-3.5 text-white/70" strokeWidth={1.75} />
        <p className="mono-label text-white/70">
          Agen otomatis terjadwal
          <span className="mx-2 text-white/30">/</span>
          <span className="text-white">berjalan sendiri sesuai jadwal</span>
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
        <Dashboard />
      </main>
    </div>
  );
}
