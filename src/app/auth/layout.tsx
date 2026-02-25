export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'linear-gradient(160deg, #080c18 0%, #0f1629 40%, #0d0f1f 100%)' }}
    >
      {/* Animated gradient mesh blobs - rich & saturated */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[650px] h-[650px] rounded-full bg-[#8938b0]/40 blur-[120px] auth-mesh-1" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#2e3a76]/50 blur-[100px] auth-mesh-2" />
        <div className="absolute top-[25%] right-[10%] w-[450px] h-[450px] rounded-full bg-[#4a54a0]/35 blur-[90px] auth-mesh-3" />
      </div>

      {/* Soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.25)_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo - no rounding, raw SVG */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <img src="/callengo-fill.svg" alt="Callengo" className="w-9 h-9 shrink-0" />
          <span className="text-white font-bold text-lg tracking-tight">Callengo</span>
        </div>

        {/* Glassmorphism Card */}
        <div className="auth-card">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-white/20">
          &copy; {new Date().getFullYear()} Callengo. All rights reserved.
        </p>
      </div>
    </div>
  );
}
