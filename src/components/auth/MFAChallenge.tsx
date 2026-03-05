'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MFAChallengeProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MFAChallenge({ onSuccess, onCancel }: MFAChallengeProps) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) throw new Error('No MFA factor found');

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4 p-6 max-w-sm mx-auto">
      <h2 className="text-xl font-bold text-center">Two-Factor Authentication</h2>
      <p className="text-sm text-slate-600 text-center">
        Enter the 6-digit code from your authenticator app.
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border rounded-lg"
        maxLength={6}
        autoFocus
      />

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleVerify}
          disabled={isVerifying || code.length !== 6}
          className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {isVerifying ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
}
