import React, { useState } from 'react';
import { X, Lock, Mail, User, Phone, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalMode, closeAuthModal, openAuthModal, login, register, isLoading } =
    useTradingStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const isLogin = authModalMode === 'login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          fullName,
          phone: phone || undefined,
        });
      }
    } catch (err: any) {
      const serverDetails = err?.response?.data?.error?.details;
      if (Array.isArray(serverDetails) && serverDetails.length > 0) {
        setErrorMsg(serverDetails.map((d: any) => d.message).join(', '));
      } else {
        setErrorMsg(err?.response?.data?.error?.message || 'Authentication request failed.');
      }
    }
  };

  const fillDemoCredentials = () => {
    setEmail('sumer.kumar@trademitra.local');
    setPassword('Password@123');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#131722] border border-[#2A2E39] rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2A2E39]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center font-bold text-black text-sm shadow-md">
              TM
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {isLogin ? 'Sign In to TradeMitra' : 'Create Trader Account'}
              </h3>
              <p className="text-[11px] text-groww-textSubtle">
                {isLogin
                  ? 'Access live option execution & simulated wallet'
                  : 'Start with ₹10,00,000 complimentary paper margin'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-groww-textMuted hover:text-white hover:bg-[#202433] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[#EB5B5B] text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Demo Fast Login Pill (Only on Login tab) */}
        {isLogin && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-[#00D09C]/20 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-white">Demo Trader Creds</span>
              <div className="text-[11px] text-groww-textSubtle">sumer.kumar@trademitra.local</div>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="text-xs font-bold text-[#00D09C] hover:underline bg-[#00D09C]/10 px-2.5 py-1 rounded-lg border border-[#00D09C]/30"
            >
              Auto-Fill
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-groww-textMuted mb-1">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-groww-textSubtle absolute left-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sumer Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#1A1E2C] border border-[#2A2E39] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-groww-textSubtle focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-groww-textMuted mb-1">
                  Phone Number (Optional)
                </label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-groww-textSubtle absolute left-3" />
                  <input
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#1A1E2C] border border-[#2A2E39] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-groww-textSubtle focus:outline-none focus:border-[#00D09C]"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-groww-textMuted mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-groww-textSubtle absolute left-3" />
              <input
                type="email"
                required
                placeholder="trader@trademitra.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1A1E2C] border border-[#2A2E39] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-groww-textSubtle focus:outline-none focus:border-[#00D09C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-groww-textMuted mb-1">
              Password {!isLogin && <span className="text-[10px] text-groww-textSubtle">(Min 8 chars, 1 uppercase, 1 number)</span>}
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-groww-textSubtle absolute left-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1A1E2C] border border-[#2A2E39] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-groww-textSubtle focus:outline-none focus:border-[#00D09C]"
              />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full py-3 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 active:scale-98 disabled:opacity-50"
          >
            <span>{isLoading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Register & Claim ₹10L'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Switch Login / Register Mode */}
        <div className="mt-5 text-center text-xs text-groww-textSubtle">
          {isLogin ? (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setErrorMsg('');
                  openAuthModal('register');
                }}
                className="font-bold text-[#00D09C] hover:underline"
              >
                Create Account
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                onClick={() => {
                  setErrorMsg('');
                  openAuthModal('login');
                }}
                className="font-bold text-[#00D09C] hover:underline"
              >
                Sign In
              </button>
            </span>
          )}
        </div>

        {/* Trust Badges */}
        <div className="mt-5 pt-4 border-t border-[#2A2E39] flex items-center justify-center gap-4 text-[10px] text-groww-textSubtle">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#00D09C]" /> 256-Bit JWT Encryption
          </span>
          <span>•</span>
          <span>Instant Paper Margin</span>
        </div>
      </div>
    </div>
  );
};
