import React, { useState } from 'react';
import { useTradingStore } from '../../app/store/useTradingStore.js';
import { formatNumber } from '../../lib/utils.js';
import { Activity, Link2, ArrowLeft, SlidersHorizontal, Settings } from 'lucide-react';

export const OptionChainTable: React.FC = () => {
  const { optionChain, indices, openOrderPad, fetchOptionChain } = useTradingStore();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY');
  const [activeExploreTab, setActiveExploreTab] = useState<'equity' | 'commodities'>('equity');
  
  // Option Chain Overlay state
  const [isChainOverlayOpen, setIsChainOverlayOpen] = useState(false);

  if (!optionChain) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-groww-textMuted">
        <div className="w-8 h-8 border-2 border-[#00D09C] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Loading Market Data...</p>
      </div>
    );
  }

  const spotPrice = optionChain.spotPrice;
  const chain = optionChain.chain;

  // Filter indices vs stocks
  const marketIndices = indices.filter(idx => ['NIFTY 50', 'SENSEX', 'BANK NIFTY'].includes(idx.symbol));
  const marketStocks = indices.filter(idx => ['BOSCH', 'TUBEINVEST', 'HDFCBANK'].includes(idx.symbol));

  // Expiry date formatter (e.g. '2026-08-20' -> '20 Aug')
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

  // Custom asset graphics/icons matching the Groww UI screenshot
  const renderAssetIcon = (symbol: string) => {
    switch (symbol) {
      case 'NIFTY 50':
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-sm border border-orange-500/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4.5 16.5L12 21L19.5 16.5M4.5 7.5L12 12L19.5 7.5M12 3L4.5 7.5L12 12L19.5 7.5L12 3Z" />
            </svg>
          </div>
        );
      case 'SENSEX':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-sm border border-blue-500/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" />
            </svg>
          </div>
        );
      case 'BANK NIFTY':
        return (
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shadow-sm border border-yellow-500/10">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 21h18M3 10h18M3 6h18M4 6v15M20 6v15M12 6v15" />
            </svg>
          </div>
        );
      case 'BOSCH':
        return (
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-groww-border flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
            B
          </div>
        );
      case 'TUBEINVEST':
        return (
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-groww-border flex items-center justify-center text-[#E8EAED] font-extrabold text-sm shadow-sm">
            TI
          </div>
        );
      case 'HDFCBANK':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center text-[#437EF7] font-black text-sm shadow-sm">
            HDFC
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-groww-surface flex items-center justify-center text-groww-textMuted">
            <Activity className="w-4 h-4" />
          </div>
        );
    }
  };

  const handleOpenChain = async (symbol: 'NIFTY' | 'BANKNIFTY') => {
    setSelectedSymbol(symbol);
    await fetchOptionChain(symbol);
    setIsChainOverlayOpen(true);
  };

  // Find index details for spot line
  const activeIndexDetails = marketIndices.find(idx => 
    selectedSymbol === 'NIFTY' ? idx.symbol === 'NIFTY 50' : idx.symbol === 'BANK NIFTY'
  );
  const indexChangeVal = optionChain.change !== undefined ? optionChain.change : activeIndexDetails?.change ?? (selectedSymbol === 'BANKNIFTY' ? -235.40 : -132.75);
  const indexChangePct = optionChain.pChange !== undefined ? optionChain.pChange : activeIndexDetails?.pChange ?? (selectedSymbol === 'BANKNIFTY' ? -0.41 : -0.55);
  const isIndexPos = indexChangeVal >= 0;

  // Track if spot line is rendered
  let renderedAtmLine = false;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Top Traded Section */}
      <div className="bg-groww-card border border-groww-border rounded-2xl p-5 shadow-2xl">
        <h3 className="text-base font-bold text-white mb-4">Top Traded</h3>
        
        {/* Equity / Commodities Sub-tabs */}
        <div className="flex gap-2 mb-5 p-1 bg-groww-surface border border-groww-border rounded-xl max-w-xs">
          <button
            onClick={() => setActiveExploreTab('equity')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeExploreTab === 'equity'
                ? 'bg-groww-hover text-white shadow-sm'
                : 'text-groww-textMuted hover:text-white'
            }`}
          >
            Equity
          </button>
          <button
            onClick={() => setActiveExploreTab('commodities')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeExploreTab === 'commodities'
                ? 'bg-groww-hover text-white shadow-sm'
                : 'text-groww-textMuted hover:text-white'
            }`}
          >
            Commodities
          </button>
        </div>

        {activeExploreTab === 'commodities' ? (
          <div className="py-10 text-center text-xs text-groww-textSubtle">
            Commodities are not supported by india-stock-mcp.
          </div>
        ) : (
          <div className="divide-y divide-groww-border/30">
            {/* 1. Benchmark Indices */}
            {marketIndices.map((idx) => {
              const isPositive = idx.change >= 0;

              return (
                <div
                  key={idx.symbol}
                  className="flex items-center justify-between py-3.5 hover:bg-groww-surface/30 px-2 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    {renderAssetIcon(idx.symbol)}
                    <div>
                      <div className="text-sm font-bold text-white tracking-tight">{idx.symbol}</div>
                      <div className="text-xs font-semibold font-mono-num text-groww-textMuted flex items-center gap-1.5 mt-0.5">
                        <span>{formatNumber(idx.ltp)}</span>
                        <span className={isPositive ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}>
                          {isPositive ? '+' : ''}{formatNumber(idx.change)} ({isPositive ? '+' : ''}{formatNumber(idx.pChange)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Circular Link Button to launch Option Chain */}
                  <button
                    onClick={() => {
                      const symKey = idx.symbol === 'BANK NIFTY' ? 'BANKNIFTY' : idx.symbol === 'SENSEX' ? 'SENSEX' : 'NIFTY';
                      handleOpenChain(symKey as any);
                    }}
                    className="w-9 h-9 rounded-full bg-groww-surface hover:bg-groww-hover border border-groww-border hover:border-groww-borderLight flex items-center justify-center text-groww-textMuted hover:text-[#00D09C] transition-all group"
                    title="Open Options Chain"
                  >
                    <Link2 className="w-4 h-4 transition-transform group-hover:rotate-45" />
                  </button>
                </div>
              );
            })}

            {/* 2. Top Stocks */}
            {marketStocks.map((stock) => {
              const isPositive = stock.change >= 0;

              return (
                <div
                  key={stock.symbol}
                  className="flex items-center justify-between py-3.5 hover:bg-groww-surface/20 px-2 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    {renderAssetIcon(stock.symbol)}
                    <div>
                      <div className="text-sm font-bold text-white tracking-tight">{stock.name}</div>
                      <div className="text-xs font-semibold font-mono-num text-groww-textMuted flex items-center gap-1.5 mt-0.5">
                        <span>{formatNumber(stock.ltp)}</span>
                        <span className={isPositive ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}>
                          {isPositive ? '+' : ''}{formatNumber(stock.change)} ({isPositive ? '+' : ''}{formatNumber(stock.pChange)}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Circular Link icon for stocks */}
                  <button
                    onClick={() => handleOpenChain(stock.symbol as any)}
                    className="w-9 h-9 rounded-full bg-groww-surface hover:bg-groww-hover border border-groww-border hover:border-groww-borderLight flex items-center justify-center text-groww-textMuted hover:text-[#00D09C] transition-all group"
                    title={`Open ${stock.name} Options Chain`}
                  >
                    <Link2 className="w-4 h-4 transition-transform group-hover:rotate-45" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Option Chain Overlay Modal (matching user's screenshot details exactly) */}
      {isChainOverlayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-y-auto">
          <div className="w-full max-w-lg min-h-screen bg-[#090a0f] flex flex-col shadow-2xl relative">
            
            {/* Modal Header (matching screen top in screenshot) */}
            <div className="flex items-center justify-between p-4 border-b border-groww-border bg-[#090a0f] sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsChainOverlayOpen(false)}
                  className="p-1 text-groww-textMuted hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <h3 className="text-base font-extrabold text-white">
                  {selectedSymbol === 'NIFTY'
                    ? 'NIFTY 50'
                    : selectedSymbol === 'BANKNIFTY'
                    ? 'BANK NIFTY'
                    : selectedSymbol === 'SENSEX'
                    ? 'BSE SENSEX'
                    : selectedSymbol}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-groww-textMuted">
                <SlidersHorizontal className="w-5 h-5 cursor-pointer hover:text-white" />
                <Settings className="w-5 h-5 cursor-pointer hover:text-white" />
              </div>
            </div>

            {/* Option Chain strikes grid */}
            <div className="flex-1 overflow-x-hidden pb-24 sm:pb-8">
              <table className="w-full text-center border-collapse">
                <thead>
                  {/* Outer columns headings */}
                  <tr className="bg-[#090a0f] text-[11px] font-bold text-groww-textSubtle border-b border-groww-border">
                    <th className="py-3 px-4 w-1/3 text-left">Call price</th>
                    <th className="py-3 px-2 w-1/3">
                      {/* Expiry Selector Dropdown in Middle Column matching Groww UI */}
                      <div className="inline-flex items-center justify-center">
                        <select
                          value={optionChain.selectedExpiry}
                          onChange={(e) => {
                            const newExp = e.target.value;
                            fetchOptionChain(selectedSymbol, newExp);
                          }}
                          className="bg-[#181B26] hover:bg-[#202534] text-white font-extrabold text-xs px-2.5 py-1 rounded-lg border border-[#2A2E39] focus:outline-none focus:border-[#00D09C] cursor-pointer transition-all appearance-none text-center"
                          style={{ backgroundImage: 'none' }}
                        >
                          {optionChain.expiries.map((exp) => (
                            <option key={exp} value={exp} className="bg-[#131722] text-white py-1">
                              {formatExpiryLabel(exp)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="py-3 px-4 w-1/3 text-right">Put price</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-groww-border/30 text-xs">
                  {chain.map((item) => {
                    // Check if we need to render the ATM spot price badge line
                    const isStrikeGreaterThanSpot = item.strikePrice >= spotPrice;
                    const shouldRenderAtmLine = isStrikeGreaterThanSpot && !renderedAtmLine;

                    return (
                      <React.Fragment key={item.strikePrice}>
                        {/* Render ATM Spot price line divider */}
                        {shouldRenderAtmLine && (() => {
                          renderedAtmLine = true;
                          return (
                            <tr className="relative h-11 bg-transparent">
                              <td colSpan={3} className="p-0 align-middle">
                                <div className="absolute inset-x-0 top-1/2 border-t border-white pointer-events-none"></div>
                                <div className="relative z-10 flex justify-center">
                                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-[#090a0f] font-black text-xs shadow-lg">
                                    <span>{formatNumber(spotPrice)}</span>
                                    <span className="text-zinc-300">|</span>
                                    <span className={`font-extrabold ${isIndexPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {isIndexPos ? '+' : ''}{formatNumber(indexChangeVal)} ({isIndexPos ? '+' : ''}{formatNumber(indexChangePct)}%)
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })()}

                        {/* Standard Strike Row */}
                        <tr className="hover:bg-groww-hover/40 transition-colors">
                          {/* CALLS (CE) Price */}
                          <td
                            onClick={() => {
                              if (item.ce) {
                                openOrderPad({
                                  contractId: item.ce.contractId,
                                  tradingSymbol: item.ce.tradingSymbol,
                                  symbol: selectedSymbol,
                                  strikePrice: item.strikePrice,
                                  optionType: 'CE',
                                  lotSize: 25,
                                  ltp: item.ce.ltp,
                                  defaultAction: 'BUY',
                                });
                              }
                            }}
                            className="py-3 px-4 text-left font-mono-num cursor-pointer hover:bg-groww-surface/40 transition-colors"
                          >
                            {item.ce ? (
                              <div>
                                <div className="text-sm font-semibold text-white">₹{formatNumber(item.ce.ltp)}</div>
                                <div className={`text-[10px] font-semibold mt-0.5 ${(item.ce.pChange ?? 0) >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}`}>
                                  {(item.ce.pChange ?? 0) >= 0 ? '+' : ''}{formatNumber(item.ce.pChange)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-groww-textSubtle">-</span>
                            )}
                          </td>

                          {/* Strike Price + OI volume visual gauges in center column */}
                          <td className="py-3 px-2 bg-[#0d0e14] font-black text-white font-mono-num align-middle">
                            <div className="flex flex-col items-center">
                              <span className="text-[13px] tracking-tight">{formatNumber(item.strikePrice, 0)}</span>
                              
                              {/* Orange/Green weight bar charts matching screenshot */}
                              <div className="flex items-center gap-0.5 w-10 h-[3px] bg-groww-border/30 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className="h-full bg-orange-500" 
                                  style={{ width: `${Math.min(90, Math.max(10, (item.ce?.oi ?? 0) / 100000))}%` }} 
                                />
                                <div 
                                  className="h-full bg-[#00D09C]" 
                                  style={{ width: `${Math.min(90, Math.max(10, (item.pe?.oi ?? 0) / 100000))}%` }} 
                                />
                              </div>
                            </div>
                          </td>

                          {/* PUTS (PE) Price */}
                          <td
                            onClick={() => {
                              if (item.pe) {
                                openOrderPad({
                                  contractId: item.pe.contractId,
                                  tradingSymbol: item.pe.tradingSymbol,
                                  symbol: selectedSymbol,
                                  strikePrice: item.strikePrice,
                                  optionType: 'PE',
                                  lotSize: 25,
                                  ltp: item.pe.ltp,
                                  defaultAction: 'BUY',
                                });
                              }
                            }}
                            className="py-3 px-4 text-right font-mono-num cursor-pointer hover:bg-groww-surface/40 transition-colors"
                          >
                            {item.pe ? (
                              <div>
                                <div className="text-sm font-semibold text-white">₹{formatNumber(item.pe.ltp)}</div>
                                <div className={`text-[10px] font-semibold mt-0.5 ${(item.pe.pChange ?? 0) >= 0 ? 'text-[#00D09C]' : 'text-[#EB5B5B]'}`}>
                                  {(item.pe.pChange ?? 0) >= 0 ? '+' : ''}{formatNumber(item.pe.pChange)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-groww-textSubtle">-</span>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
