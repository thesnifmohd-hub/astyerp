import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { DEMO_SUPABASE_AUTH_PASSWORD, useErp } from '@/app/ErpContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { state, loginAsUser } = useErp();
  const [identifier, setIdentifier] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = identifier.trim().toLowerCase();
    if (!cleaned) return;
    if (isSupabaseConfigured && supabase && !cleaned.endsWith('@asty.demo')) {
      const isEmail = cleaned.includes('@');
      const { error } = isEmail
        ? await supabase.auth.signInWithOtp({ email: cleaned })
        : await supabase.auth.signInWithOtp({ phone: identifier.trim() });
      if (error) {
        setStatusMsg(error.message);
        return;
      }
      setOtpSent(true);
      setStatusMsg('Live Supabase OTP sent — enter the 6-digit verification code.');
      return;
    }
    setOtpSent(true);
    setStatusMsg('Demo OTP ready for @asty.demo profile (enter 123456 to sign into live Supabase session).');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = identifier.trim().toLowerCase();
    if (isSupabaseConfigured && supabase && cleaned && !cleaned.endsWith('@asty.demo')) {
      const isEmail = cleaned.includes('@');
      const { error } = isEmail
        ? await supabase.auth.verifyOtp({ email: cleaned, token: otpCode.trim(), type: 'email' })
        : await supabase.auth.verifyOtp({ phone: identifier.trim(), token: otpCode.trim(), type: 'sms' });
      if (error) {
        setStatusMsg(error.message);
        return;
      }
    } else if (isSupabaseConfigured && supabase && cleaned.endsWith('@asty.demo')) {
      await supabase.auth.signInWithPassword({
        email: cleaned,
        password: DEMO_SUPABASE_AUTH_PASSWORD,
      });
    }

    const matched = state.users.find(
      (u) =>
        u.isActive &&
        (u.email.toLowerCase() === cleaned ||
          u.phone.replace(/\s+/g, '') === identifier.replace(/\s+/g, '')),
    );
    if (matched) {
      loginAsUser(matched.id);
    } else {
      setStatusMsg('No active user profile matched that email/phone. Use one of the seeded position accounts below.');
    }
  };

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'ml' : 'en';
    i18n.changeLanguage(next);
    window.localStorage.setItem('asty_lang', next);
  };

  return (
    <div className="min-h-screen bg-asty-charcoal flex flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden bg-white shadow-2xl">
        {/* Left Brand Panel */}
        <div className="lg:col-span-5 bg-[#141A1C] p-8 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-white text-asty-charcoal font-bold flex items-center justify-center text-xl">
                  A
                </div>
                <div>
                  <div className="font-heading text-lg font-bold tracking-tight">{t('app.brand')}</div>
                  <div className="text-xs text-asty-slate">{t('app.subtitle')}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleLang}
                className="rounded-lg border border-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/10"
              >
                {i18n.language === 'en' ? 'മലയാളം' : 'English'}
              </button>
            </div>

            <div className="mt-10 space-y-4">
              <h1 className="font-heading text-2xl font-bold leading-snug">
                Zero Site Delays. Every Rupee Approved. Live Site-Wise Books.
              </h1>
              <p className="text-sm text-asty-slate leading-relaxed">
                Unified construction project execution, GPS-verified daily site reporting, configurable approvals, and full Indian double-entry accounting.
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-asty-slate flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Dynamic Positions & RLS Permissions • Paise Integer Accounting • Asia/Kolkata IST</span>
          </div>
        </div>

        {/* Right Login + Instant Position Login Panel */}
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-asty-black">{t('auth.sign_in')}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in via Email / Mobile OTP or select a seeded position profile to inspect permissions & RLS scoping.
            </p>
          </div>

          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Smartphone className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="director1@asty.demo or +91 98470 00005"
                  className="w-full rounded-xl border border-asty-border pl-9 pr-3 py-2.5 text-sm focus:border-asty-charcoal focus:outline-none"
                />
              </div>
              {otpSent && (
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="OTP (123456)"
                  className="w-full sm:w-36 rounded-xl border border-asty-border px-3 py-2.5 text-sm font-mono focus:border-asty-charcoal focus:outline-none"
                />
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-asty-charcoal px-5 py-2.5 text-sm font-semibold text-white hover:bg-asty-black"
              >
                <KeyRound className="h-4 w-4" />
                {otpSent ? t('auth.verify_otp') : t('auth.send_otp')}
              </button>
            </div>
            {statusMsg && <p className="text-xs font-medium text-amber-700">{statusMsg}</p>}
          </form>

          <div className="border-t border-asty-border pt-5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {t('auth.quick_demo_login')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {state.users
                .filter((u) => u.isActive)
                .map((u) => {
                  const posNames = u.positionIds
                    .map((pid) => state.positions.find((p) => p.id === pid)?.name)
                    .filter(Boolean)
                    .join(', ');
                  const siteScope = u.allSites
                    ? 'All Sites'
                    : `${u.assignedSiteIds.length} Assigned Site(s)`;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => loginAsUser(u.id)}
                      className="text-left rounded-xl border border-asty-border p-3 hover:border-asty-charcoal hover:bg-asty-surface transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-asty-black group-hover:text-asty-charcoal">
                          {u.fullName}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {u.preferredLanguage.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-asty-charcoal">{posNames}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {u.email} • {siteScope}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

