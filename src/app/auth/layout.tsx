export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'linear-gradient(160deg, #080c18 0%, #0f1629 40%, #0d0f1f 100%)' }}
    >
      {/* Animated gradient mesh blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#8938b0]/25 blur-[120px] auth-mesh-1" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full bg-[#2e3a76]/35 blur-[100px] auth-mesh-2" />
        <div className="absolute top-[25%] right-[15%] w-[400px] h-[400px] rounded-full bg-[#4a54a0]/20 blur-[90px] auth-mesh-3" />
      </div>

      {/* Vignette overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
            <img src="/callengo-fill.svg" alt="Callengo" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Callengo</span>
        </div>

        {/* Card */}
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
