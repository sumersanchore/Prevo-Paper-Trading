import React, { useState, useRef, useEffect } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';
import {
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Link2,
  BarChart2,
  Flame,
  CircleDot,
  Coins,
  SlidersHorizontal,
} from 'lucide-react';

interface InstrumentMeta {
  symbol: string;
  apiSymbol: string;
  name: string;
  category: 'EQUITY' | 'COMMODITIES';
  lotSize: number;
  exchange: 'NSE' | 'BSE' | 'MCX';
  iconType: 'nifty' | 'sensex' | 'banknifty' | 'bosch' | 'ti' | 'hdfc' | 'crude' | 'gold' | 'silver' | 'gas';
}

const ALL_INSTRUMENTS: InstrumentMeta[] = [
  // F&O Major Indices
  { symbol: 'NIFTY', apiSymbol: 'NIFTY', name: 'NIFTY 50', category: 'EQUITY', lotSize: 25, exchange: 'NSE', iconType: 'nifty' },
  { symbol: 'BANKNIFTY', apiSymbol: 'BANKNIFTY', name: 'BANK NIFTY', category: 'EQUITY', lotSize: 15, exchange: 'NSE', iconType: 'banknifty' },
  { symbol: 'SENSEX', apiSymbol: 'SENSEX', name: 'SENSEX', category: 'EQUITY', lotSize: 10, exchange: 'BSE', iconType: 'sensex' },
  { symbol: 'FINNIFTY', apiSymbol: 'FINNIFTY', name: 'FIN NIFTY', category: 'EQUITY', lotSize: 25, exchange: 'NSE', iconType: 'nifty' },
  { symbol: 'MIDCPNIFTY', apiSymbol: 'MIDCPNIFTY', name: 'MIDCAP NIFTY', category: 'EQUITY', lotSize: 50, exchange: 'NSE', iconType: 'nifty' },
  { symbol: 'BANKEX', apiSymbol: 'BANKEX', name: 'BANKEX', category: 'EQUITY', lotSize: 15, exchange: 'BSE', iconType: 'banknifty' },

  // F&O Popular Stocks
  { symbol: 'BOSCH', apiSymbol: 'BOSCH', name: 'Bosch', category: 'EQUITY', lotSize: 25, exchange: 'NSE', iconType: 'bosch' },
  { symbol: 'TUBEINVEST', apiSymbol: 'TUBEINVEST', name: 'Tube Investments', category: 'EQUITY', lotSize: 25, exchange: 'NSE', iconType: 'ti' },
  { symbol: 'HDFCBANK', apiSymbol: 'HDFCBANK', name: 'HDFC Bank', category: 'EQUITY', lotSize: 550, exchange: 'NSE', iconType: 'hdfc' },

  // Commodities
  { symbol: 'CRUDEOIL', apiSymbol: 'CRUDEOIL', name: 'Crude Oil Mini', category: 'COMMODITIES', lotSize: 10, exchange: 'MCX', iconType: 'crude' },
  { symbol: 'GOLD', apiSymbol: 'GOLD', name: 'Gold Mini', category: 'COMMODITIES', lotSize: 10, exchange: 'MCX', iconType: 'gold' },
  { symbol: 'SILVER', apiSymbol: 'SILVER', name: 'Silver Micro', category: 'COMMODITIES', lotSize: 1, exchange: 'MCX', iconType: 'silver' },
  { symbol: 'NATURALGAS', apiSymbol: 'NATURALGAS', name: 'Natural Gas', category: 'COMMODITIES', lotSize: 1250, exchange: 'MCX', iconType: 'gas' },
];

const SYMBOL_TO_SLUG: Record<string, string> = {
  NIFTY: 'nifty50',
  BANKNIFTY: 'banknifty',
  SENSEX: 'sensex',
  FINNIFTY: 'finnifty',
  MIDCPNIFTY: 'midcpnifty',
  BANKEX: 'bankex',
  BOSCH: 'bosch',
  TUBEINVEST: 'tubeinvest',
  HDFCBANK: 'hdfcbank',
  CRUDEOIL: 'crudeoil',
  GOLD: 'gold',
  SILVER: 'silver',
  NATURALGAS: 'naturalgas',
};

const SLUG_TO_SYMBOL: Record<string, string> = {
  nifty: 'NIFTY',
  nifty50: 'NIFTY',
  'nifty-50': 'NIFTY',
  banknifty: 'BANKNIFTY',
  'bank-nifty': 'BANKNIFTY',
  sensex: 'SENSEX',
  finnifty: 'FINNIFTY',
  'fin-nifty': 'FINNIFTY',
  midcpnifty: 'MIDCPNIFTY',
  'midcap-nifty': 'MIDCPNIFTY',
  bankex: 'BANKEX',
  bosch: 'BOSCH',
  tubeinvest: 'TUBEINVEST',
  'tube-investments': 'TUBEINVEST',
  hdfcbank: 'HDFCBANK',
  'hdfc-bank': 'HDFCBANK',
  crudeoil: 'CRUDEOIL',
  crude: 'CRUDEOIL',
  gold: 'GOLD',
  silver: 'SILVER',
  naturalgas: 'NATURALGAS',
  gas: 'NATURALGAS',
};

const renderInstrumentIcon = (type: InstrumentMeta['iconType'], size: 'normal' | 'small' = 'normal') => {
  const containerCls = size === 'small' ? 'w-5 h-5' : 'w-8 h-8 sm:w-9 sm:h-9';

  switch (type) {
    case 'nifty':
      return (
        <div className={`${containerCls} rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-orange-400 p-0.5 flex items-center justify-center shrink-0 shadow-xs`}>
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5">
              <div className="bg-orange-500 rounded-full" />
              <div className="bg-rose-500 rounded-full" />
              <div className="bg-amber-400 rounded-full" />
              <div className="bg-emerald-500 rounded-full" />
            </div>
          </div>
        </div>
      );
    case 'sensex':
      return (
        <div className={`${containerCls} rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-black text-xs shrink-0 shadow-xs`}>
          <svg className={size === 'small' ? 'w-3 h-3 text-blue-500 fill-current' : 'w-4 h-4 text-blue-500 fill-current'} viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      );
    case 'banknifty':
      return (
        <div className={`${containerCls} rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-black text-xs shrink-0 shadow-xs`}>
          <svg className={size === 'small' ? 'w-3 h-3 text-amber-500 fill-current' : 'w-4 h-4 text-amber-500 fill-current'} viewBox="0 0 24 24">
            <path d="M4 10h3v7H4zm6 0h3v7h-3zm6 0h3v7h-3zM2 22h19v-3H2zm10-20L2 6v2h19V6z" />
          </svg>
        </div>
      );
    case 'bosch':
      return (
        <div className={`${containerCls} rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 font-black text-[10px] sm:text-xs shrink-0 shadow-xs`}>
          <span>B</span>
        </div>
      );
    case 'ti':
      return (
        <div className={`${containerCls} rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-white font-black text-[9px] sm:text-[10px] shrink-0 shadow-xs`}>
          TI
        </div>
      );
    case 'hdfc':
      return (
        <div className={`${containerCls} rounded-md bg-blue-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs`}>
          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 border border-red-500 bg-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-blue-600" />
          </div>
        </div>
      );
    case 'crude':
      return (
        <div className={`${containerCls} rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 shadow-xs`}>
          <Flame className={size === 'small' ? 'w-3 h-3 fill-current' : 'w-4 h-4 fill-current'} />
        </div>
      );
    case 'gold':
      return (
        <div className={`${containerCls} rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-xs`}>
          <Coins className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
        </div>
      );
    case 'silver':
      return (
        <div className={`${containerCls} rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0 shadow-xs`}>
          <CircleDot className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
        </div>
      );
    case 'gas':
      return (
        <div className={`${containerCls} rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0 shadow-xs`}>
          <Flame className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
        </div>
      );
    default:
      return (
        <div className={`${containerCls} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0`}>
          <BarChart2 className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />
        </div>
      );
  }
};

export const OptionChainTable: React.FC = () => {
  const { optionChain, indices, openOrderPad, fetchOptionChain } = useTradingStore();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/options\/([^/]+)/);
      if (match && match[1]) {
        return SLUG_TO_SYMBOL[match[1].toLowerCase()] || 'NIFTY';
      }
    }
    return null;
  });

  const [activeCategory, setActiveCategory] = useState<'EQUITY' | 'COMMODITIES'>('EQUITY');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInstrumentDropdownOpen, setIsInstrumentDropdownOpen] = useState(false);
  const [isExpiryDropdownOpen, setIsExpiryDropdownOpen] = useState(false);

  const instrumentDropdownRef = useRef<HTMLDivElement>(null);
  const expiryDropdownRef = useRef<HTMLDivElement>(null);

  // Browser Back/Forward navigation support (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/options\/([^/]+)/);
      if (match && match[1]) {
        const sym = SLUG_TO_SYMBOL[match[1].toLowerCase()];
        if (sym) setSelectedSymbol(sym);
      } else {
        setSelectedSymbol(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (instrumentDropdownRef.current && !instrumentDropdownRef.current.contains(event.target as Node)) {
        setIsInstrumentDropdownOpen(false);
      }
      if (expiryDropdownRef.current && !expiryDropdownRef.current.contains(event.target as Node)) {
        setIsExpiryDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInstrumentDropdownOpen(false);
        setIsExpiryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const formatExpiryLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthIdx = parseInt(parts[1]!, 10) - 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[monthIdx] || ''}`;
    }
    return dateStr;
  };

  // Fetch option chain whenever selected symbol changes
  useEffect(() => {
    if (selectedSymbol) {
      setIsRefreshing(true);
      fetchOptionChain(selectedSymbol).finally(() => {
        setIsRefreshing(false);
      });
    }
  }, [selectedSymbol]);

  // Navigate to an instrument's Option Chain with clean URL e.g. /options/nifty50
  const handleOpenChain = (symbol: string) => {
    const slug = SYMBOL_TO_SLUG[symbol] || symbol.toLowerCase();
    if (window.location.pathname !== `/options/${slug}`) {
      window.history.pushState({ symbol }, '', `/options/${slug}`);
    }
    setSelectedSymbol(symbol);
  };

  // Navigate back to Top Traded Home
  const handleBackToTopTraded = () => {
    if (window.location.pathname !== '/explore' && window.location.pathname !== '/') {
      window.history.pushState(null, '', '/explore');
    }
    setSelectedSymbol(null);
  };

  // Helper to get live data from indices or mock defaults
  const getInstrumentData = (inst: InstrumentMeta) => {
    const found = indices.find((idx) => {
      if (inst.symbol === 'NIFTY' && idx.symbol.includes('NIFTY 50')) return true;
      if (inst.symbol === 'BANKNIFTY' && idx.symbol.includes('BANK NIFTY')) return true;
      if (inst.symbol === 'SENSEX' && idx.symbol.includes('SENSEX')) return true;
      if (idx.symbol === inst.symbol) return true;
      return false;
    });

    if (found) {
      return {
        ltp: found.ltp,
        change: found.change,
        pChange: found.pChange,
        isPositive: found.change >= 0,
      };
    }

    const defaults: Record<string, { ltp: number; change: number; pChange: number }> = {
      NIFTY: { ltp: 24154.9, change: -132.75, pChange: -0.55 },
      BANKNIFTY: { ltp: 57262.4, change: -235.4, pChange: -0.41 },
      SENSEX: { ltp: 77235.46, change: -492.7, pChange: -0.63 },
      FINNIFTY: { ltp: 23890.0, change: -110.0, pChange: -0.46 },
      MIDCPNIFTY: { ltp: 12450.0, change: 45.0, pChange: 0.36 },
      BANKEX: { ltp: 62340.0, change: -190.0, pChange: -0.30 },
      BOSCH: { ltp: 48730.0, change: 1760.0, pChange: 3.75 },
      TUBEINVEST: { ltp: 2959.0, change: 217.6, pChange: 7.94 },
      HDFCBANK: { ltp: 723.0, change: -6.0, pChange: -0.82 },
      CRUDEOIL: { ltp: 8111.0, change: 95.0, pChange: 1.19 },
      GOLD: { ltp: 71450.0, change: 320.0, pChange: 0.45 },
      SILVER: { ltp: 84200.0, change: -410.0, pChange: -0.48 },
      NATURALGAS: { ltp: 195.4, change: 3.8, pChange: 1.98 },
    };

    const d = defaults[inst.symbol] || { ltp: 24000, change: -50, pChange: -0.2 };
    return {
      ltp: d.ltp,
      change: d.change,
      pChange: d.pChange,
      isPositive: d.change >= 0,
    };
  };

  const filteredInstruments = ALL_INSTRUMENTS.filter((i) => i.category === activeCategory);

  /* ────────────────────────────────────────────────────────────────────────
     VIEW 1: TOP TRADED EXPLORE HOME VIEW (Static Clean BG & Compact)
  ──────────────────────────────────────────────────────────────────────── */
  if (selectedSymbol === null) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4 animate-fadeIn pb-12 px-0 sm:px-2">
        {/* ── Top Traded Header & Category Switcher ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Top Traded
            </h2>
          </div>

          {/* Filter Pills: Equity | Commodities */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('EQUITY')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'EQUITY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              Equity
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('COMMODITIES')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeCategory === 'COMMODITIES'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span>Commodities</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 font-extrabold uppercase">
                Soon
              </span>
            </button>
          </div>

          {/* If Commodities: Show Coming Soon State */}
          {activeCategory === 'COMMODITIES' ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 text-center shadow-xs space-y-4 animate-fadeIn">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
                <Flame className="w-6 h-6 fill-current" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Commodities F&O Coming Soon
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  MCX Commodity contracts for <strong className="text-slate-800">Crude Oil</strong>,{' '}
                  <strong className="text-slate-800">Gold Mini</strong>,{' '}
                  <strong className="text-slate-800">Silver Micro</strong>, and{' '}
                  <strong className="text-slate-800">Natural Gas</strong> are currently in development.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory('EQUITY')}
                  className="px-5 py-2 rounded-xl bg-[#00D09C] hover:bg-[#00B386] text-black font-extrabold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  Explore Equity F&O
                </button>
              </div>
            </div>
          ) : (
            /* Equity Instruments List */
            <>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
                {filteredInstruments.map((inst) => {
                  const data = getInstrumentData(inst);
                  return (
                    <div
                      key={inst.symbol}
                      onClick={() => handleOpenChain(inst.symbol)}
                      className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group active:bg-slate-100"
                    >
                      {/* Left: Icon & Name & LTP */}
                      <div className="flex items-center gap-3 min-w-0">
                        {renderInstrumentIcon(inst.iconType)}
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-[#008f6b] transition-colors truncate">
                            {inst.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-mono-num mt-0.5">
                            <span className="text-slate-900 font-bold">
                              {formatNumber(data.ltp)}
                            </span>
                            <span
                              className={`font-semibold text-[11px] sm:text-xs ${
                                data.isPositive ? 'text-[#008f6b]' : 'text-[#d93838]'
                              }`}
                            >
                              {data.isPositive ? '+' : ''}
                              {formatNumber(data.change)} ({data.isPositive ? '+' : ''}
                              {formatNumber(data.pChange)}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Chain / Link Icon Button */}
                      <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-50 border border-slate-200 group-hover:border-[#00D09C] flex items-center justify-center text-slate-500 group-hover:text-[#008f6b] transition-all shrink-0">
                        <Link2 className="w-3.5 h-3.5 rotate-45 stroke-[2.5]" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* See More Link */}
              <div className="pt-1 flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer px-1">
                <span>See more</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────────────────────────────────────────
     VIEW 2: DEDICATED FULL-PAGE OPTION CHAIN VIEW (e.g. /options/nifty50)
  ──────────────────────────────────────────────────────────────────────── */
  if (!optionChain || (selectedSymbol && optionChain.symbol && optionChain.symbol !== selectedSymbol)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="w-8 h-8 border-3 border-[#00D09C] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading Live {selectedSymbol || ''} Option Chain...</p>
      </div>
    );
  }

  const spotPrice = optionChain.spotPrice;
  const chain = optionChain.chain;

  const activeInstrument = ALL_INSTRUMENTS.find((inst) => inst.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    apiSymbol: selectedSymbol,
    name: selectedSymbol,
    category: 'EQUITY' as const,
    lotSize: 25,
    exchange: 'NSE' as const,
    iconType: 'nifty' as const,
  };

  const activeIndexDetails = indices.find((idx) => {
    const idxSym = idx.symbol.toUpperCase().replace(/\s+/g, '');
    const selSym = (selectedSymbol || '').toUpperCase().replace(/\s+/g, '');
    if (selSym === 'NIFTY' && (idxSym === 'NIFTY50' || idxSym === 'NIFTY')) return true;
    if (selSym === 'BANKNIFTY' && idxSym === 'BANKNIFTY') return true;
    if (selSym === 'SENSEX' && idxSym === 'SENSEX') return true;
    if (selSym === 'FINNIFTY' && (idxSym === 'FINNIFTY' || idxSym === 'FINNIFTY')) return true;
    if (selSym === 'MIDCPNIFTY' && (idxSym === 'MIDCAPNIFTY' || idxSym === 'MIDCPNIFTY')) return true;
    if (selSym === 'BANKEX' && idxSym === 'BANKEX') return true;
    return idxSym === selSym;
  });

  const instData = getInstrumentData(activeInstrument);
  const indexChangeVal =
    optionChain.change !== undefined
      ? optionChain.change
      : activeIndexDetails?.change ?? instData.change;
  const indexChangePct =
    optionChain.pChange !== undefined
      ? optionChain.pChange
      : activeIndexDetails?.pChange ?? instData.pChange;
  const isIndexPos = indexChangeVal >= 0;

  let renderedAtmLine = false;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-0 animate-fadeIn bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* ── 1. Top Header Bar: Back Arrow + [ 🌸 NIFTY ⌄ ] · [ 25 Aug ⌄ ] + Tools ── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={handleBackToTopTraded}
            className="p-1 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Back to Top Traded"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Instrument Dropdown Trigger (🌸 NIFTY ⌄) */}
          <div className="relative inline-block" ref={instrumentDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsInstrumentDropdownOpen((prev) => !prev);
                setIsExpiryDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-slate-100 transition-all cursor-pointer group active:scale-95"
            >
              <div className="shrink-0">{renderInstrumentIcon(activeInstrument.iconType, 'small')}</div>
              <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                {activeInstrument.symbol}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.5] text-slate-500 group-hover:text-slate-900 transition-transform duration-200 ${
                  isInstrumentDropdownOpen ? 'rotate-180 text-[#008f6b]' : ''
                }`}
              />
            </button>

            {/* Instrument Dropdown Popover matching user screenshot */}
            {isInstrumentDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 sm:w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-fadeIn divide-y divide-slate-100">
                {ALL_INSTRUMENTS.filter((i) => i.category === 'EQUITY').map((inst) => {
                  const isSelected = inst.symbol === selectedSymbol;
                  return (
                    <button
                      key={inst.symbol}
                      type="button"
                      onClick={() => {
                        handleOpenChain(inst.symbol);
                        setIsInstrumentDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer group active:bg-slate-100"
                    >
                      {/* Emerald Radio Button */}
                      <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                        <div
                          className={`w-4.5 h-4.5 rounded-full border-2 transition-all flex items-center justify-center ${
                            isSelected
                              ? 'border-[#00D09C] bg-white'
                              : 'border-[#00D09C] group-hover:border-[#00B386]'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#00D09C]" />
                          )}
                        </div>
                      </div>

                      {/* Instrument Symbol Text */}
                      <span
                        className={`text-sm tracking-wide font-extrabold transition-colors ${
                          isSelected ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                        }`}
                      >
                        {inst.symbol}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dot separator */}
          <span className="text-slate-400 font-black text-sm select-none">·</span>

          {/* Expiry Dropdown Trigger (25 Aug ⌄) */}
          <div className="relative inline-block" ref={expiryDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsExpiryDropdownOpen((prev) => !prev);
                setIsInstrumentDropdownOpen(false);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-xl hover:bg-slate-100 transition-all cursor-pointer group active:scale-95 text-slate-900 font-black text-sm sm:text-base tracking-tight"
            >
              <span>{formatExpiryLabel(optionChain.selectedExpiry)}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 stroke-[2.5] text-slate-500 group-hover:text-slate-900 transition-transform duration-200 ${
                  isExpiryDropdownOpen ? 'rotate-180 text-[#008f6b]' : ''
                }`}
              />
            </button>

            {/* Expiry Popover with Emerald Radio Buttons */}
            {isExpiryDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-44 sm:w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 animate-fadeIn divide-y divide-slate-100">
                {optionChain.expiries.map((exp) => {
                  const isSelected = exp === optionChain.selectedExpiry;
                  return (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => {
                        fetchOptionChain(selectedSymbol, exp);
                        setIsExpiryDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer group active:bg-slate-100"
                    >
                      {/* Emerald Radio Button */}
                      <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                        <div
                          className={`w-4.5 h-4.5 rounded-full border-2 transition-all flex items-center justify-center ${
                            isSelected
                              ? 'border-[#00D09C] bg-white'
                              : 'border-[#00D09C] group-hover:border-[#00B386]'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#00D09C]" />
                          )}
                        </div>
                      </div>

                      {/* Expiry Label Text */}
                      <span
                        className={`text-xs sm:text-sm font-extrabold transition-colors ${
                          isSelected ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'
                        }`}
                      >
                        {formatExpiryLabel(exp)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Tools (Refresh & Filters) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => fetchOptionChain(selectedSymbol, optionChain.selectedExpiry)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh Quotes"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00D09C]' : ''}`} />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Chain Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 2. Integrated 3-Column Header Bar: Call price | Strike | Put price ── */}
      <div className="sticky top-12 bg-slate-50 border-b border-slate-200 z-20 grid grid-cols-[1fr_80px_1fr] sm:grid-cols-[1fr_110px_1fr] md:grid-cols-[1fr_130px_1fr] items-center text-center py-2 px-2.5 sm:px-4">
        {/* Left Header */}
        <div className="text-left text-xs font-black uppercase tracking-wider text-slate-500 pl-1">
          Call price
        </div>

        {/* Center Header */}
        <div className="text-center text-xs font-black uppercase tracking-wider text-slate-700 border-x border-slate-200 py-0.5">
          Strike
        </div>

        {/* Right Header */}
        <div className="text-right text-xs font-black uppercase tracking-wider text-slate-500 pr-1">
          Put price
        </div>
      </div>

      {/* ── 3. Full Responsive Option Strikes Table (Continuous Clean Scroll) ── */}
      <div className="divide-y divide-slate-100 bg-white">
        {chain.map((item) => {
          const isStrikeGreaterThanSpot = item.strikePrice >= spotPrice;
          const shouldRenderAtmLine = isStrikeGreaterThanSpot && !renderedAtmLine;

          return (
            <React.Fragment key={item.strikePrice}>
              {/* ── ATM Spot Price Center Divider Line (Solid Static BG) ── */}
              {shouldRenderAtmLine && (() => {
                renderedAtmLine = true;
                return (
                  <div className="relative flex items-center justify-center py-1.5 bg-slate-100 border-y border-slate-300">
                    <div className="absolute inset-x-0 h-px bg-slate-300" />
                    <div className="relative z-1 inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-white border border-slate-300 shadow-xs font-mono-num text-xs font-black text-slate-900">
                      <span>{formatNumber(spotPrice)}</span>
                      <span className="text-slate-300">|</span>
                      <span className={isIndexPos ? 'text-[#008f6b]' : 'text-[#d93838]'}>
                        {isIndexPos ? '+' : ''}
                        {formatNumber(indexChangeVal)} ({isIndexPos ? '+' : ''}
                        {formatNumber(indexChangePct)}%)
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ── Standard Strike Row ── */}
              <div className="grid grid-cols-[1fr_80px_1fr] sm:grid-cols-[1fr_110px_1fr] md:grid-cols-[1fr_130px_1fr] items-center hover:bg-slate-50 transition-colors group">
                {/* ── CALLS (Left Column: Price & Change on Left, Full BUY / SELL on Right) ── */}
                <div className="py-2.5 px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
                  {item.ce ? (
                    <>
                      {/* Price & Change */}
                      <div
                        onClick={() => {
                          openOrderPad({
                            contractId: item.ce!.contractId,
                            tradingSymbol: item.ce!.tradingSymbol,
                            symbol: selectedSymbol,
                            strikePrice: item.strikePrice,
                            optionType: 'CE',
                            lotSize: activeInstrument.lotSize,
                            ltp: item.ce!.ltp,
                            defaultAction: 'BUY',
                          });
                        }}
                        className="cursor-pointer hover:opacity-80 transition-opacity min-w-0"
                      >
                        <div className="text-xs sm:text-sm font-black text-slate-900 font-mono-num truncate leading-tight">
                          ₹{formatNumber(item.ce.ltp)}
                        </div>
                        <div
                          className={`text-[10px] sm:text-[11px] font-bold font-mono-num truncate ${
                            (item.ce.pChange ?? 0) >= 0 ? 'text-[#008f6b]' : 'text-[#d93838]'
                          }`}
                        >
                          {(item.ce.pChange ?? 0) >= 0 ? '+' : ''}
                          {formatNumber(item.ce.pChange)}%
                        </div>
                      </div>

                      {/* Full Buy & Sell Action Buttons */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderPad({
                              contractId: item.ce!.contractId,
                              tradingSymbol: item.ce!.tradingSymbol,
                              symbol: selectedSymbol,
                              strikePrice: item.strikePrice,
                              optionType: 'CE',
                              lotSize: activeInstrument.lotSize,
                              ltp: item.ce!.ltp,
                              defaultAction: 'BUY',
                            });
                          }}
                          className="px-2 sm:px-2.5 py-1 rounded-md bg-[#00D09C] hover:bg-[#00B386] text-black text-[10px] sm:text-xs font-black flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-all"
                          title="Buy Call (CE)"
                        >
                          BUY
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderPad({
                              contractId: item.ce!.contractId,
                              tradingSymbol: item.ce!.tradingSymbol,
                              symbol: selectedSymbol,
                              strikePrice: item.strikePrice,
                              optionType: 'CE',
                              lotSize: activeInstrument.lotSize,
                              ltp: item.ce!.ltp,
                              defaultAction: 'SELL',
                            });
                          }}
                          className="px-2 sm:px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-all"
                          title="Sell Call (CE)"
                        >
                          SELL
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </div>

                {/* ── STRIKE PRICE (Center Column) ── */}
                <div className="py-2.5 px-1 flex flex-col items-center justify-center font-mono-num select-none border-x border-slate-100 bg-slate-50/50">
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    {formatNumber(item.strikePrice, 0)}
                  </span>
                  {/* Subtle OI balance indicator */}
                  <div className="flex items-center gap-0.5 w-10 sm:w-14 h-0.5 sm:h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-rose-500"
                      style={{
                        width: `${Math.min(90, Math.max(10, (item.ce?.oi ?? 0) / 100000))}%`,
                      }}
                    />
                    <div
                      className="h-full bg-[#00D09C]"
                      style={{
                        width: `${Math.min(90, Math.max(10, (item.pe?.oi ?? 0) / 100000))}%`,
                      }}
                    />
                  </div>
                </div>

                {/* ── PUTS (Right Column: Full BUY / SELL on Left, Price & Change on Right) ── */}
                <div className="py-2.5 px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
                  {item.pe ? (
                    <>
                      {/* Full Buy & Sell Action Buttons */}
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderPad({
                              contractId: item.pe!.contractId,
                              tradingSymbol: item.pe!.tradingSymbol,
                              symbol: selectedSymbol,
                              strikePrice: item.strikePrice,
                              optionType: 'PE',
                              lotSize: activeInstrument.lotSize,
                              ltp: item.pe!.ltp,
                              defaultAction: 'BUY',
                            });
                          }}
                          className="px-2 sm:px-2.5 py-1 rounded-md bg-[#00D09C] hover:bg-[#00B386] text-black text-[10px] sm:text-xs font-black flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-all"
                          title="Buy Put (PE)"
                        >
                          BUY
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrderPad({
                              contractId: item.pe!.contractId,
                              tradingSymbol: item.pe!.tradingSymbol,
                              symbol: selectedSymbol,
                              strikePrice: item.strikePrice,
                              optionType: 'PE',
                              lotSize: activeInstrument.lotSize,
                              ltp: item.pe!.ltp,
                              defaultAction: 'SELL',
                            });
                          }}
                          className="px-2 sm:px-2.5 py-1 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-all"
                          title="Sell Put (PE)"
                        >
                          SELL
                        </button>
                      </div>

                      {/* Price & Change */}
                      <div
                        onClick={() => {
                          openOrderPad({
                            contractId: item.pe!.contractId,
                            tradingSymbol: item.pe!.tradingSymbol,
                            symbol: selectedSymbol,
                            strikePrice: item.strikePrice,
                            optionType: 'PE',
                            lotSize: activeInstrument.lotSize,
                            ltp: item.pe!.ltp,
                            defaultAction: 'BUY',
                          });
                        }}
                        className="cursor-pointer hover:opacity-80 transition-opacity min-w-0 text-right"
                      >
                        <div className="text-xs sm:text-sm font-black text-slate-900 font-mono-num truncate leading-tight">
                          ₹{formatNumber(item.pe.ltp)}
                        </div>
                        <div
                          className={`text-[10px] sm:text-[11px] font-bold font-mono-num truncate ${
                            (item.pe.pChange ?? 0) >= 0 ? 'text-[#008f6b]' : 'text-[#d93838]'
                          }`}
                        >
                          {(item.pe.pChange ?? 0) >= 0 ? '+' : ''}
                          {formatNumber(item.pe.pChange)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-300 text-xs ml-auto">-</span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
