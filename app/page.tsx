import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* announcement-bar — full-width black strip, 36px, centered microcopy */}
      <div className="flex h-9 items-center justify-center bg-black px-4 text-center">
        <p className="mono-label text-white/70">
          Otomasi absensi
          <span className="mx-2 text-white/30">/</span>
          <span className="text-white">kelola banyak akun sekaligus</span>
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
        <Dashboard />
      </main>
    </div>
  );
}
