// app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Callengo Logo */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-8">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </div>

        {/* Error Code */}
        <h1 className="text-7xl font-black text-slate-900 tracking-tight">404</h1>

        {/* Message */}
        <p className="mt-4 text-lg font-semibold text-slate-700">Page not found</p>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          The page you are looking for does not exist or has been moved. Let&apos;s get you back on track.
        </p>

        {/* Back to Dashboard Button */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
