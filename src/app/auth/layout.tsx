export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ========================================
          Left Branding Panel - Hidden on mobile
          ======================================== */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[52%] relative overflow-hidden">
        {/* Base gradient */}
        <div className="absolute inset-0 gradient-bg" />

        {/* Dot grid pattern overlay */}
        <div className="absolute inset-0 auth-dot-grid" />

        {/* Floating gradient orbs */}
        <div className="absolute top-[12%] right-[-8%] w-[420px] h-[420px] bg-purple-500/20 rounded-full blur-[100px] auth-orb-1" />
        <div className="absolute top-[45%] left-[-10%] w-[320px] h-[320px] bg-blue-400/15 rounded-full blur-[80px] auth-orb-2" />
        <div className="absolute bottom-[8%] left-[30%] w-[260px] h-[260px] bg-indigo-400/10 rounded-full blur-[60px] auth-orb-3" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Top: Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/callengo-fill.svg"
              alt="Callengo"
              className="w-10 h-10 rounded-xl"
            />
            <span className="text-white font-bold text-xl tracking-tight">
              Callengo
            </span>
          </div>

          {/* Center: Hero content */}
          <div className="space-y-8 max-w-lg">
            <div>
              <h2 className="text-4xl xl:text-[2.75rem] font-bold text-white leading-[1.15] mb-5">
                The Future of
                <br />
                <span className="text-white/70">Sales Automation</span>
              </h2>
              <p className="text-white/45 text-lg leading-relaxed">
                AI-powered voice agents that handle your outbound calls, book
                meetings, and drive revenue around the clock.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-3">
              <div className="flex items-center gap-4 glass-card rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">AI Voice Agents</h3>
                  <p className="text-white/35 text-sm mt-0.5">Natural conversations that book meetings autonomously</p>
                </div>
              </div>

              <div className="flex items-center gap-4 glass-card rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Calendar Integration</h3>
                  <p className="text-white/35 text-sm mt-0.5">Seamlessly syncs with Google Calendar &amp; Outlook</p>
                </div>
              </div>

              <div className="flex items-center gap-4 glass-card rounded-2xl p-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Real-time Analytics</h3>
                  <p className="text-white/35 text-sm mt-0.5">Track conversions, calls, and team performance live</p>
                </div>
              </div>
            </div>

            {/* Dashboard preview placeholder */}
            {/* Replace src with your screenshot. Recommended: 1200x680px, PNG or WebP */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ aspectRatio: '16 / 9' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />
              <img
                src="/images/auth-dashboard-preview.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              {/* Overlay stat cards */}
              <div className="absolute bottom-3 left-3 glass-card rounded-xl px-3.5 py-2.5">
                <p className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Conversion Rate</p>
                <p className="text-white font-bold text-base">+42%</p>
              </div>
              <div className="absolute top-3 right-3 glass-card rounded-xl px-3.5 py-2.5">
                <p className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Calls Automated</p>
                <p className="text-white font-bold text-base">10K+</p>
              </div>
            </div>
          </div>

          {/* Bottom: Trust footer */}
          <div className="flex items-center gap-2 text-white/25 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Protected by enterprise-grade security</span>
          </div>
        </div>
      </div>

      {/* ========================================
          Right Content Panel
          ======================================== */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 lg:px-12 lg:py-8 bg-[var(--background)] relative min-h-screen lg:min-h-0">
        {/* Subtle decorative gradient blob (top-right) */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-[var(--color-primary)]/[0.03] via-[var(--color-accent)]/[0.02] to-transparent rounded-full blur-[80px] pointer-events-none" />

        {/* Mobile-only branding header */}
        <div className="lg:hidden w-full max-w-[420px] mb-8">
          <div className="flex items-center gap-2.5">
            <img
              src="/callengo-fill.svg"
              alt="Callengo"
              className="w-9 h-9 rounded-lg"
            />
            <span className="text-slate-900 font-bold text-lg tracking-tight">
              Callengo
            </span>
          </div>
        </div>

        {/* Page content */}
        <div className="w-full max-w-[420px] relative z-10">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400 relative z-10">
          <p>&copy; {new Date().getFullYear()} Callengo. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
