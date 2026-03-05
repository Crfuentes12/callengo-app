'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MFASetup() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  // Check if MFA is already enabled on mount
  useEffect(() => {
    const checkMFAStatus = async () => {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp && factors.totp.some((f) => f.status === 'verified')) {
          setIsEnabled(true);
        }
      } catch {
        // Silently fail - user may not have MFA set up
      }
    };
    checkMFAStatus();
  }, [supabase]);

  const startEnrollment = async () => {
    setIsEnrolling(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      if (error) throw error;
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start MFA enrollment');
    } finally {
      setIsEnrolling(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!factorId || !verifyCode) return;
    setIsVerifying(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setIsEnabled(true);
      setSuccess('MFA has been enabled successfully!');
      setQrCode(null);
      setSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  const disableMFA = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp && factors.totp.length > 0) {
        for (const factor of factors.totp) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      setIsEnabled(false);
      setSuccess('MFA has been disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
      <p className="text-sm text-slate-600">
        Add an extra layer of security to your account using an authenticator app.
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {!qrCode && !isEnabled && (
        <button
          onClick={startEnrollment}
          disabled={isEnrolling}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {isEnrolling ? 'Setting up...' : 'Enable MFA'}
        </button>
      )}

      {qrCode && (
        <div className="space-y-4">
          <div className="p-4 bg-white border rounded-lg inline-block">
            <img src={qrCode} alt="QR Code for authenticator app" className="w-48 h-48" />
          </div>
          {secret && (
            <p className="text-xs text-slate-500">
              Manual entry key: <code className="bg-slate-100 px-2 py-1 rounded">{secret}</code>
            </p>
          )}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="px-3 py-2 border rounded-lg w-40 text-center tracking-widest"
              maxLength={6}
            />
            <button
              onClick={verifyAndEnable}
              disabled={isVerifying || verifyCode.length !== 6}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      )}

      {isEnabled && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            MFA Enabled
          </span>
          <button
            onClick={disableMFA}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Disable MFA
          </button>
        </div>
      )}
    </div>
  );
}
