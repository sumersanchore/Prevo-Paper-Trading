import React, { useState, useEffect } from 'react';
import {
  Activity,
  Shield,
  Zap,
  TrendingUp,
  Award,
  Lock,
  Mail,
  AlertCircle,
  Sparkles,
  ArrowRight,
  KeyRound,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { useToast } from '../../components/ui/Toast.js';
import {
  signInWithFirebaseGoogle,
  signInWithFirebaseApple,
} from '../../lib/firebase.js';

export const AuthPage: React.FC = () => {
  const toast = useToast();
  const { loginWithGoogle, sendEmailOtp, verifyEmailOtp, isLoading } = useTradingStore();

  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // 1. Send Email OTP
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setErrorMsg('');

    try {
      const res = await sendEmailOtp({ email: cleanEmail });
      setIsOtpSent(true);
      setResendCooldown(30);
      toast.success(
        'Verification Code Sent',
        `6-digit OTP has been sent to ${cleanEmail}`
      );
      if (res?.data?.devOtp) {
        toast.info('Development OTP', `Your test code is: ${res.data.devOtp}`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send verification code. Please check your email.';
      setErrorMsg(msg);
      toast.error('Email OTP Error', msg);
    }
  };

  // 2. Verify Email OTP
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (cleanCode.length < 4) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    setErrorMsg('');

    try {
      await verifyEmailOtp({
        email: email.trim().toLowerCase(),
        code: cleanCode,
      });

      toast.success(
        'Authentication Successful',
        `Welcome to PREVO! ₹10,00,000 virtual capital activated.`
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Invalid or expired verification code. Please try again.';
      setErrorMsg(msg);
      toast.error('Verification Failed', msg);
    }
  };

  // 3. Google OAuth via Firebase
  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setIsSocialLoading(true);

    try {
      const firebaseUser = await signInWithFirebaseGoogle();
      const googlePayload = {
        email: firebaseUser.email.toLowerCase(),
        fullName: firebaseUser.fullName,
        googleId: firebaseUser.uid,
        avatarUrl: firebaseUser.photoUrl,
      };

      await loginWithGoogle(googlePayload);
      toast.success(
        'Google Sign-In Successful',
        `Welcome, ${firebaseUser.fullName}! ₹10,00,000 virtual capital active.`
      );
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        toast.info('Sign-In Cancelled', 'Google sign-in popup was closed.');
      } else {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Google authentication failed.';
        setErrorMsg(msg);
        toast.error('Google Sign-In Error', msg);
      }
    } finally {
      setIsSocialLoading(false);
    }
  };

  // 4. Apple OAuth via Firebase
  const handleAppleAuth = async () => {
    setErrorMsg('');
    setIsSocialLoading(true);

    try {
      const firebaseUser = await signInWithFirebaseApple();
      const applePayload = {
        email: firebaseUser.email.toLowerCase(),
        fullName: firebaseUser.fullName,
        googleId: firebaseUser.uid,
        avatarUrl: firebaseUser.photoUrl,
      };

      await loginWithGoogle(applePayload);
      toast.success(
        'Apple Sign-In Successful',
        `Welcome, ${firebaseUser.fullName}! ₹10,00,000 virtual capital active.`
      );
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        toast.info('Sign-In Cancelled', 'Apple sign-in popup was closed.');
      } else {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Apple authentication failed.';
        setErrorMsg(msg);
        toast.error('Apple Sign-In Error', msg);
      }
    } finally {
      setIsSocialLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen min-h-screen bg-slate-950 text-white flex overflow-hidden font-sans selection:bg-[#00D09C] selection:text-black">
      {/* ── Left Hero Side (7 cols on desktop, full height) ── */}
      <div className="hidden lg:flex lg:w-7/12 h-full bg-gradient-to-br from-[#07090E] via-[#0B1713] to-[#07090E] p-10 xl:p-14 flex-col justify-between relative border-r border-slate-800/80 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo & Tagline Badge */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
              <Activity className="w-5 h-5 text-black font-extrabold stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-0.5">
                PRE<span className="text-[#00D09C]">VO</span>
              </span>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[#00D09C]">
                100% Free Platform
              </span>
              <span className="text-xs text-slate-400 hidden xl:inline">
                by <strong className="text-white">Sumer Kumar</strong>
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono-num shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
            <span>NSE / BSE Real-Time Feed</span>
          </div>
        </div>

        {/* Center Hero Content */}
        <div className="space-y-6 relative z-10 max-w-2xl my-auto">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[#00D09C] text-xs font-bold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Practice Trading • Build Confidence • Trade Smarter</span>
            </div>
            <h1 className="text-3xl xl:text-5xl font-black tracking-tight leading-tight text-white">
              Practice Before You Trade. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D09C] via-teal-300 to-emerald-400">
                Build Your Trading Edge
              </span>
            </h1>
            <p className="text-sm xl:text-base text-slate-400 mt-3.5 leading-relaxed max-w-xl">
              Master Indian equity and options strategies with real-time Greeks (Delta, Theta, Gamma, IV), automated bracket orders, and ₹10,00,000 virtual capital with zero financial risk.
            </p>
          </div>

          {/* 4 Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xs space-y-1.5 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center gap-2 text-[#00D09C] font-bold text-xs">
                <Zap className="w-4 h-4 shrink-0" />
                <span>Live Option Chain</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Delta, Theta, Gamma, IV & PCR analytics for NIFTY, BANK NIFTY & SENSEX.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xs space-y-1.5 hover:border-amber-500/30 transition-colors">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Award className="w-4 h-4 shrink-0" />
                <span>₹10,00,000 Virtual Capital</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pre-funded virtual capital to test multi-lot options and intraday setups.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xs space-y-1.5 hover:border-sky-500/30 transition-colors">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span>Bracket Order Pad</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automated Stop Loss, Trailing SL, and Target exits with live tick triggers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xs space-y-1.5 hover:border-purple-500/30 transition-colors">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Zero Slippage Ledger</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Accurate ledger accounting, mark-to-market P&L, and verified trade audit log.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Footer Credits */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-900 pt-4 relative z-10">
          <span>© 2026 PREVO — Practice Before You Trade.</span>
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Lock className="w-3.5 h-3.5 text-[#00D09C]" /> 256-Bit Encrypted Session
          </span>
        </div>
      </div>

      {/* ── Right Form Side (5 cols on desktop, vertically elevated by 60-80px) ── */}
      <div className="w-full lg:w-5/12 h-full bg-white text-slate-900 flex flex-col justify-between p-6 sm:p-10 xl:p-12 overflow-y-auto">
        {/* Top Header Bar with TOP RIGHT SKIP BUTTON */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-black font-extrabold stroke-[2.5]" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">
              PRE<span className="text-[#008f6b]">VO</span>
            </span>
          </div>

          <div className="hidden lg:block" />

          {/* TOP RIGHT SKIP BUTTON */}
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/explore');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-extrabold transition-all cursor-pointer shadow-2xs group active:scale-95 ml-auto"
          >
            <span>Skip</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Main Form Container - Shifted upward for balanced fintech aesthetics */}
        <div className="max-w-md w-full mx-auto my-auto lg:my-0 lg:pt-8 xl:pt-12 pb-4 space-y-5">
          {/* Brand Wordmark / Header */}
          <div>
            <div className="hidden lg:flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-xs">
                <Activity className="w-3.5 h-3.5 text-black font-extrabold stroke-[2.5]" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                PRE<span className="text-[#008f6b]">VO</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#008f6b] border border-emerald-200/80 ml-1">
                Practice Before You Trade
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {isOtpSent ? 'Verify Email Code' : 'Sign in to PREVO'}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {isOtpSent
                ? `Enter the 6-digit verification code sent to ${email}`
                : 'Practice trading. Build confidence. Trade smarter. Trade with ₹10,00,000 virtual capital — no real money involved.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* ── 1. Email OTP Form (Top & Primary) ── */}
          {!isOtpSent ? (
            <form onSubmit={handleSendEmailOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00D09C] focus:bg-white transition-all shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-3.5 rounded-2xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isLoading ? (
                  <span>Sending Verification Code...</span>
                ) : (
                  <>
                    <span>Continue with Email</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyEmailOtp} className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#008f6b] shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-500">Sent to: </span>
                    <strong className="text-slate-900 font-semibold">{email}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="text-xs font-bold text-[#008f6b] hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                >
                  <RotateCcw className="w-3 h-3" /> Change
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  6-Digit Verification Code
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-3.5 text-base tracking-widest font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00D09C] focus:bg-white text-center"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Didn't receive code?</span>
                {resendCooldown > 0 ? (
                  <span className="text-slate-400 font-mono">Resend in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    className="text-[#008f6b] font-bold hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 4}
                className="w-full py-3.5 rounded-2xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-sm transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isLoading ? (
                  <span>Verifying Code...</span>
                ) : (
                  <>
                    <span>Verify & Enter Terminal</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── 2. Social Login Section (Clean Fintech White Buttons) ── */}
          {!isOtpSent && (
            <div className="space-y-3.5 pt-1">
              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                  Or continue with
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              {/* Both Google and Apple with clean white style */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Google Login Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSocialLoading || isLoading}
                  className="py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                {/* 2. Apple Login Button - Clean White Card */}
                <button
                  type="button"
                  onClick={handleAppleAuth}
                  disabled={isSocialLoading || isLoading}
                  className="py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <svg className="w-4 h-4 fill-slate-900 shrink-0" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.6-1.02 1.01-2.43.9-3.87-1.22.05-2.7.81-3.3 1.83-.53.9-.99 2.34-.87 3.75 1.36.1 2.67-.69 3.27-1.71z" />
                  </svg>
                  <span>Apple</span>
                </button>
              </div>
            </div>
          )}

          {/* Privacy & Legal Note */}
          <div className="text-center text-[11px] text-slate-400 pt-1 leading-relaxed">
            By continuing, you agree to PREVO's Paper Trading Terms and Privacy Policy. No real money is involved.
          </div>
        </div>

        {/* Security footnote */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-[#008f6b]" />
          <span>PREVO Authenticated • 256-Bit Encrypted Session</span>
        </div>
      </div>
    </div>
  );
};
