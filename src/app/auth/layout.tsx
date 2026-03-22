'use client';

import Image from 'next/image';
import LanguageSelector from '@/components/LanguageSelector';
import { useTranslation } from '@/i18n';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'var(--gradient-auth-base)' }}
    >
      {/* Animated gradient mesh blobs - rich & saturated */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[650px] h-[650px] rounded-full bg-[var(--color-electric)]/40 blur-[120px] auth-mesh-1" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--color-deep-indigo)]/50 blur-[100px] auth-mesh-2" />
        <div className="absolute top-[25%] right-[10%] w-[450px] h-[450px] rounded-full bg-[var(--color-slate-indigo)]/35 blur-[90px] auth-mesh-3" />
      </div>

      {/* Soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.25)_100%)] pointer-events-none" />

      {/* Language selector - top right corner */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector compact dark />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo - no rounding, raw SVG */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <Image src="/callengo-logo.svg" alt="Callengo" width={48} height={48} className="w-12 h-12 p-1 rounded-lg bg-white/90 backdrop-blur-sm" />
          <span className="text-white font-bold text-2xl tracking-tight">Callengo</span>
        </div>

        {/* Glassmorphism Card */}
        <div className="auth-card">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-white/20">
          &copy; {new Date().getFullYear()} Callengo. {t.auth.footer}
        </p>
      </div>
    </div>
  );
}
