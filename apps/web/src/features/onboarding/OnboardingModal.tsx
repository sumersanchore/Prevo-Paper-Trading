import React, { useState } from 'react';
import {
  Activity,
  Shield,
  Zap,
  TrendingUp,
  Award,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Target,
} from 'lucide-react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { useToast } from '../../components/ui/Toast.js';

export const OnboardingModal: React.FC = () => {
  const toast = useToast();
  const { user, isOnboardingOpen, setOnboardingOpen, setActiveTab } = useTradingStore();
  const [step, setStep] = useState(0);

  if (!isOnboardingOpen) return null;

  const handleFinish = () => {
    if (user?.id) {
      try {
        localStorage.setItem(`prevo_onboarded_${user.id}`, 'true');
      } catch {
        // Ignore storage errors
      }
    }
    setOnboardingOpen(false);
    setActiveTab('option-chain');
    toast.success('Welcome to PREVO Terminal!', 'Your ₹10,00,000 margin is active. Happy Trading!');
  };

  const slides = [
    {
      id: 'wallet',
      badge: 'Account Setup Complete',
      title: '₹10,00,000 Paper Margin Provisioned',
      subtitle: 'Your virtual trading account is ready with zero financial risk.',
      icon: <Award className="w-7 h-7 text-emerald-400" />,
      content: (
        <div className="space-y-4">
          {/* Virtual Trading Card */}
          <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-[#0d281f] to-slate-900 border border-emerald-500/30 text-white shadow-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D09C] to-[#008f6b] flex items-center justify-center shadow-md">
                  <Activity className="w-4 h-4 text-black font-extrabold" />
                </div>
                <span className="font-black text-sm tracking-tight">PREVO PAPER MARGIN</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-[#00D09C] border border-emerald-500/40">
                ● SIMULATION ACTIVE
              </span>
            </div>

            <div className="mt-5">
              <div className="text-[11px] text-slate-400 font-medium">Available Virtual Balance</div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono-num mt-0.5">
                ₹10,00,000.00
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono-num">
              <div>
                <span className="text-[10px] uppercase block text-slate-500">Trader</span>
                <span className="text-slate-200 font-bold">{user?.fullName || 'Trader'}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase block text-slate-500">Status</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> KYC Verified
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#008f6b]" /> Zero Capital Risk
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Test options buying, selling, and complex spreads without losing real capital.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Real Market Simulation
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Live tick pricing, realistic margin deductions, and verified ledger settlements.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'option-chain',
      badge: 'Step 1: Explore & Analyze',
      title: 'Live Option Chain & Greeks',
      subtitle: 'Inspect real-time strikes for NIFTY, BANK NIFTY, SENSEX, and FINNIFTY.',
      icon: <Zap className="w-7 h-7 text-[#00D09C]" />,
      content: (
        <div className="space-y-4">
          {/* Mock Option Chain Strip */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2 font-mono-num text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 text-sm">NIFTY 50</span>
                <span className="text-[11px] font-bold text-slate-500">24,154.90</span>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">-0.55%</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Expiry: 28 Aug 2026</span>
            </div>

            <div className="grid grid-cols-3 text-center text-[11px] font-bold text-slate-400 py-1 bg-slate-50 rounded-xl">
              <div className="text-emerald-700">CALLS (CE)</div>
              <div className="text-slate-700">STRIKE</div>
              <div className="text-rose-700">PUTS (PE)</div>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="grid grid-cols-3 items-center text-center p-1.5 rounded-xl hover:bg-slate-50">
                <div className="font-bold text-[#008f6b]">₹142.50 <span className="text-[9px] text-slate-400 block">Δ 0.52</span></div>
                <div className="font-extrabold text-slate-900 bg-slate-100 py-1 rounded-lg">24150</div>
                <div className="font-bold text-[#d93838]">₹138.20 <span className="text-[9px] text-slate-400 block">Δ -0.48</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#008f6b] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
              <p><strong>Option Greeks:</strong> Delta, Theta, Gamma, IV & PCR calculated dynamically for every strike.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#008f6b] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
              <p><strong>1-Tap Strike Select:</strong> Click any strike to launch the order pad immediately.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'bracket-orders',
      badge: 'Step 2: Risk Management',
      title: 'Bracket Orders & Automated SL/Target',
      subtitle: 'Protect your virtual trades with instant trigger execution on live ticks.',
      icon: <Target className="w-7 h-7 text-sky-500" />,
      content: (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Bracket Order Engine</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800">Auto Execution</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                <div className="text-[10px] font-bold text-rose-600 uppercase">Stop Loss (SL)</div>
                <div className="text-sm font-black text-slate-900 font-mono-num mt-0.5">₹120.00</div>
                <span className="text-[10px] text-slate-400">Auto-exit if price drops</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                <div className="text-[10px] font-bold text-[#008f6b] uppercase">Target Profit</div>
                <div className="text-sm font-black text-slate-900 font-mono-num mt-0.5">₹185.00</div>
                <span className="text-[10px] text-slate-400">Auto-lock profit on target</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">✓</div>
              <p><strong>Sub-Second Heartbeat Engine:</strong> Open orders evaluate against live market ticks every second.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">✓</div>
              <p><strong>Trailing Stop Loss:</strong> Follow profits upwards automatically as the market rallies.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'positions',
      badge: 'Step 3: Portfolio & Orders',
      title: 'Active Portfolio & 1-Tap Actions',
      subtitle: 'Real-time mark-to-market P&L, instant lot scaling, and clean order book.',
      icon: <TrendingUp className="w-7 h-7 text-purple-500" />,
      content: (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-900 block">NIFTY 24150 CE</span>
                <span className="text-[11px] text-slate-400">2 Lots (50 Qty) • Avg ₹142.50</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-[#008f6b] font-mono-num">+₹1,850.00</span>
                <span className="text-[10px] text-emerald-600 font-bold block">+12.98%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex-1 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                + Add Lots
              </button>
              <button
                type="button"
                className="flex-1 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
              >
                Square Off
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">✓</div>
              <p><strong>Order Book Audit Trail:</strong> Inspect executed, open, and cancelled orders with 1-tap <strong>Retry</strong>.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">✓</div>
              <p><strong>Instant Square-Off:</strong> Exit any position or all positions simultaneously with 1 tap.</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const currentSlide = slides[step]!;
  const isLast = step === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn font-sans">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              {currentSlide.icon}
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-[#008f6b] border border-emerald-200/80">
                {currentSlide.badge}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Skip Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slide Title */}
        <div className="mt-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {currentSlide.title}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {currentSlide.subtitle}
          </p>
        </div>

        {/* Dynamic Slide Body */}
        <div className="min-h-[240px]">
          {currentSlide.content}
        </div>

        {/* Bottom Navigation & Progress Dots */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          {/* Progress Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  step === idx
                    ? 'w-6 bg-[#00D09C]'
                    : 'w-2 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((prev) => prev - 1)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={handleFinish}
                className="px-5 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-black text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>Start Trading Now</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
