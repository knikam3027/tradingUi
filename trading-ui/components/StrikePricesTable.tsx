'use client'

import React, { useState, useEffect, useRef } from 'react';

// Manual Trade Popup Component
interface ManualTradePopupProps {
  isOpen: boolean;
  onClose: () => void;
  strike: string;
  ceLTP: string;
  peLTP: string;
  spotPrice: string;
}

function getPopupStartPosition() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }

  return {
    x: window.innerWidth / 2 - 180,
    y: window.innerHeight / 2 - 200,
  };
}

const ManualTradePopup: React.FC<ManualTradePopupProps> = ({
  isOpen,
  onClose,
  strike,
  ceLTP,
  peLTP,
  spotPrice
}) => {
  const [selectedTypes, setSelectedTypes] = useState({ call: true, put: false });
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [marketPrice, setMarketPrice] = useState(true);
  const [marketProtection, setMarketProtection] = useState(false);
  const [triggerEnabled, setTriggerEnabled] = useState(false);
  const [triggerPrice, setTriggerPrice] = useState('');
  
  // Draggable state
  const [position, setPosition] = useState(getPopupStartPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  const handleTypeToggle = (type: 'call' | 'put') => {
    setSelectedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const executeAction = (action: 'LE' | 'LX' | 'SE' | 'SX') => {
    const actionNames: Record<string, string> = {
      'LE': 'Long Entry',
      'LX': 'Long Exit',
      'SE': 'Short Entry',
      'SX': 'Short Exit'
    };
    const types = [];
    if (selectedTypes.call) types.push('CE');
    if (selectedTypes.put) types.push('PE');
    
    alert(`✅ ${actionNames[action]} executed!\nStrike: ${strike}\nType(s): ${types.join(', ')}\nQuantity: ${quantity} lots`);
    onClose();
  };

  // Draggable handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  return (
    <div className="fixed z-50" onClick={(e) => e.stopPropagation()}>
      <div 
        ref={popupRef}
        className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-80 text-white fixed"
        style={{ 
          left: position.x, 
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Draggable */}
        <div 
          className="flex justify-between items-center px-4 py-3 border-b border-gray-600 cursor-grab active:cursor-grabbing bg-gray-700 rounded-t-lg"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-white font-bold text-sm">🎯 Manual Trade - {strike}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl font-bold px-2 py-1 hover:bg-gray-600 rounded"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* CALL/PUT Selection */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.call}
                onChange={() => handleTypeToggle('call')}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm font-semibold text-blue-300">CALL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTypes.put}
                onChange={() => handleTypeToggle('put')}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm font-semibold text-red-300">PUT</span>
            </label>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => executeAction('LE')}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded transition-colors"
            >
              🟢 LE (Long Entry)
            </button>
            <button
              onClick={() => executeAction('LX')}
              className="px-3 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-bold rounded transition-colors"
            >
              🟢 LX (Long Exit)
            </button>
            <button
              onClick={() => executeAction('SE')}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded transition-colors"
            >
              🔴 SE (Short Entry)
            </button>
            <button
              onClick={() => executeAction('SX')}
              className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-bold rounded transition-colors"
            >
              🔴 SX (Short Exit)
            </button>
          </div>

          {/* Qty and Price Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-300 mb-1 font-bold">Qty</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                placeholder="Quantity"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1 font-bold">Price</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={marketPrice}
                className={`w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400 ${marketPrice ? 'opacity-50 cursor-not-allowed' : ''}`}
                placeholder="Enter price"
              />
            </div>
          </div>

          {/* Market Price & Market Protection Checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={marketPrice}
                onChange={(e) => setMarketPrice(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-300">Market Price</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={marketProtection}
                onChange={(e) => setMarketProtection(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-300">Market Protection</span>
            </label>
          </div>

          {/* Trigger Price Checkbox and Input */}
          <div>
            <label className="flex items-center space-x-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={triggerEnabled}
                onChange={(e) => setTriggerEnabled(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <span className="text-sm text-gray-300 font-bold">Trigger Price</span>
            </label>
            {triggerEnabled && (
              <input
                type="number"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
                placeholder="Enter trigger price"
              />
            )}
          </div>

          {/* Price Info */}
          <div className="bg-gray-700 rounded p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Spot Price</span>
              <span className="text-yellow-400 font-semibold">{spotPrice}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Strike</span>
              <span className="text-white font-semibold">{strike}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CE LTP</span>
              <span className="text-blue-300 font-semibold">₹{ceLTP}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">PE LTP</span>
              <span className="text-red-300 font-semibold">₹{peLTP}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StrikeRow {
  strike: number;
  cIV: number;
  open: number;
  ltp: number;
  ce: number;
  pe: number;
  change: number;
  lead: string;
  cDelta: number;
  cVolume: string;
  regime: string;
  indReg: string;
  tMode: string;
  tType: string;
  isATM: boolean;
}

interface Indicators {
  rsi: number | null;
  roc: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  chop: number | null;
}

interface TranslationSelfTest {
  passed: boolean;
  sample?: {
    strike: number;
    indicators?: {
      rsi: number | null;
      roc: number | null;
      adx: number | null;
      di_plus: number | null;
      di_minus: number | null;
      chop: number | null;
    };
  };
}

const STRIKES_CACHE_KEY = 'market.strikes.last_snapshot.v1';

const EMPTY_INDICATORS: Indicators = {
  rsi: null,
  roc: null,
  adx: null,
  plusDI: null,
  minusDI: null,
  chop: null,
};

function hasIndicatorValues(indicators?: Partial<Indicators> | null) {
  if (!indicators) {
    return false;
  }

  return Object.values(indicators).some((value) => value !== null && value !== undefined);
}

function formatIndicatorValue(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return '--';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

const StrikePricesTable = ({ className = "" }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const [showManualPopup, setShowManualPopup] = useState(false);
  const [manualPopupData, setManualPopupData] = useState<{strike: string; ce: string; pe: string; spot: string} | null>(null);

  // Live data state
  const [strikeData, setStrikeData] = useState<StrikeRow[]>([]);
  const [spotPrice, setSpotPrice] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<Indicators>(EMPTY_INDICATORS);
  const [marketOpen, setMarketOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [translationSelfTest, setTranslationSelfTest] = useState<TranslationSelfTest | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore last known snapshot on initial mount (useful when market is offline)
  useEffect(() => {
    try {
      const cachedRaw = localStorage.getItem(STRIKES_CACHE_KEY);
      if (!cachedRaw) {
        return;
      }

      const cached = JSON.parse(cachedRaw) as { strikes?: StrikeRow[]; indicators?: Indicators };
      if (cached?.strikes?.length) {
        setStrikeData(cached.strikes);
      }
      if (hasIndicatorValues(cached?.indicators)) {
        setIndicators((prev) => ({ ...prev, ...cached.indicators }));
      }
    } catch (error) {
      console.error('Error restoring strike cache:', error);
    }
  }, []);

  // Fetch strike data every 5 seconds
  useEffect(() => {
    const fetchStrikes = async () => {
      try {
        const res = await fetch('/api/market/strikes');
        const result = await res.json();

        if (result.status === 'success' && result.data) {
          if (result.data.spotPrice !== null && result.data.spotPrice !== undefined) {
            setSpotPrice(String(result.data.spotPrice));
          }
          if (result.data.strikes?.length > 0) {
            setStrikeData(result.data.strikes);
            try {
              localStorage.setItem(
                STRIKES_CACHE_KEY,
                JSON.stringify({
                  strikes: result.data.strikes,
                  indicators: result.data.indicators || {},
                  updatedAt: new Date().toISOString(),
                })
              );
            } catch (cacheError) {
              console.error('Error writing strike cache:', cacheError);
            }
          }
          if (hasIndicatorValues(result.data.indicators)) {
            setIndicators({ ...EMPTY_INDICATORS, ...result.data.indicators });
          }
          setMarketOpen(result.data.marketOpen ?? false);
        }
      } catch (error) {
        console.error('Error fetching strikes:', error);
      } finally {
        setLoading(false);
      }

      // Self-test fetch is independent — never block strike data if it fails
      try {
        const selfTestRes = await fetch('/api/market/strikes/self-test');
        const selfTestResult = await selfTestRes.json();
        if (selfTestResult.status === 'success' && selfTestResult.data) {
          setTranslationSelfTest(selfTestResult.data);
        }
      } catch (_) { /* self-test is optional */ }
    };

    fetchStrikes();
    const interval = setInterval(fetchStrikes, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className={`bg-gray-800 text-white p-4 rounded-lg shadow-lg ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-700 rounded flex-1"></div>
                <div className="h-4 bg-gray-700 rounded flex-1"></div>
                <div className="h-4 bg-gray-700 rounded flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const showLiveIndicators = hasIndicatorValues(indicators);
  const selfTestIndicators = translationSelfTest?.sample?.indicators;
  const showSelfTest = !showLiveIndicators && translationSelfTest?.passed && selfTestIndicators;
  const displayedIndicators: Indicators = showSelfTest
    ? {
        roc: selfTestIndicators?.roc ?? null,
        rsi: selfTestIndicators?.rsi ?? null,
        minusDI: selfTestIndicators?.di_minus ?? null,
        plusDI: selfTestIndicators?.di_plus ?? null,
        adx: selfTestIndicators?.adx ?? null,
        chop: selfTestIndicators?.chop ?? null,
      }
    : indicators;

  return (
    <div className={`border border-gray-700 bg-[#020617] rounded-md overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead className="bg-[#1d4ed8]">
            <tr>
              {["STRIKE", "C.IV", "OPEN", "LTP", "CE", "PE", "CHANGE", "LEAD", "C.DELTA", "C.VOLUME", "REGIME", "IND.REG", "T.MODE", "T.TYPE", "MANUAL"].map(h => (
                <th key={h} className="px-1 py-1 text-left font-bold text-white border-r border-blue-900 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {strikeData.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                  {loading ? 'Loading strike data...' : !marketOpen ? 'Market is closed - showing last close prices.' : 'No strike data available'}
                </td>
              </tr>
            ) : strikeData.map((row, i) => {
              return (
              <tr key={i} className={`border-t border-gray-800 transition-colors ${row.isATM ? 'bg-yellow-900/40 border-yellow-600' : 'hover:bg-gray-800/50'}`}>
                <td className={`px-1 py-1 font-mono ${row.isATM ? 'text-yellow-300 font-bold' : 'text-gray-400'}`}>{row.strike}</td>
                <td className="px-1 py-1 text-purple-400 font-semibold">{row.cIV}</td>
                <td className="px-1 py-1 text-gray-400">{row.open}</td>
                <td className="px-1 py-1 font-bold text-white">{row.ltp}</td>
                <td className="px-1 py-1 text-blue-300 font-semibold">{row.ce}</td>
                <td className="px-1 py-1 text-red-300 font-semibold">{row.pe}</td>
                <td className={`px-1 py-1 font-bold ${row.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {row.change >= 0 ? '+' : ''}{row.change}
                </td>
                <td className="px-1 py-1 text-orange-400">
                  {row.lead}
                </td>
                <td className={`px-1 py-1 font-semibold ${row.cDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {row.cDelta}
                </td>
                <td className="px-1 py-1 text-yellow-400 font-semibold">{row.cVolume}</td>
                <td className={`px-1 py-1 font-bold text-center ${row.regime === 'BEARISH' ? 'text-red-400' : row.regime === 'SHORT COV' ? 'text-orange-400' : row.regime === 'BULLISH' ? 'text-green-400' : 'text-gray-400'}`}>
                  {row.regime}
                </td>
                <td className={`px-1 py-1 font-semibold ${row.indReg === 'Bullish' ? 'text-green-400' : row.indReg === 'Bearish' ? 'text-red-400' : row.indReg === 'Neutral' ? 'text-yellow-400' : 'text-gray-400'}`}>{row.indReg}</td>
                <td className="px-1 py-1 text-blue-400 font-semibold">{row.tMode}</td>
                <td className="px-1 py-1 text-green-400 font-semibold">{row.tType}</td>

                {/* MANUAL Column */}
                <td className="px-1 py-1">
                  <button
                    onClick={() => {
                      setManualPopupData({
                        strike: String(row.strike),
                        ce: String(row.ce),
                        pe: String(row.pe),
                        spot: spotPrice ?? '--'
                      });
                      setShowManualPopup(true);
                    }}
                    className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded transition-colors"
                  >
                    Trade
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* Manual Trade Popup */}
        {showManualPopup && (
          <ManualTradePopup
            isOpen={showManualPopup}
            onClose={() => {
              setShowManualPopup(false);
            }}
            strike={manualPopupData?.strike || '--'}
            ceLTP={manualPopupData?.ce || '--'}
            peLTP={manualPopupData?.pe || '--'}
            spotPrice={manualPopupData?.spot || '--'}
          />
        )}

        {/* Indicators Footer */}
        <div className="border-t border-gray-700 bg-[#020617] text-[11px] px-3 py-2">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className={`rounded px-2 py-0.5 font-semibold ${showLiveIndicators ? 'bg-emerald-900/40 text-emerald-300' : showSelfTest ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-900/60 text-slate-400'}`}>
              {showLiveIndicators ? 'LIVE INDICATORS' : showSelfTest ? 'SELF-TEST INDICATORS' : 'NO INDICATOR CANDLES'}
            </span>
            {showSelfTest && translationSelfTest?.sample?.strike ? (
              <span className="text-slate-400">
                Using tested sample for strike {translationSelfTest.sample.strike} because live CE/PE candle history is unavailable.
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">ROC</div>
              <div className={`text-sm font-bold ${(displayedIndicators.roc ?? 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatIndicatorValue(displayedIndicators.roc)}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">RSI</div>
              <div className="text-sm font-bold text-white">
                {formatIndicatorValue(displayedIndicators.rsi)}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">-DI</div>
              <div className={`text-sm font-bold ${(displayedIndicators.minusDI ?? 0) > (displayedIndicators.plusDI ?? 0) ? 'text-red-400' : 'text-slate-300'}`}>
                {formatIndicatorValue(displayedIndicators.minusDI)}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">+DI</div>
              <div className={`text-sm font-bold ${(displayedIndicators.plusDI ?? 0) > (displayedIndicators.minusDI ?? 0) ? 'text-green-400' : 'text-slate-300'}`}>
                {formatIndicatorValue(displayedIndicators.plusDI)}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">ADX</div>
              <div className="text-sm font-bold text-cyan-400">
                {formatIndicatorValue(displayedIndicators.adx)}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5">
              <div className="text-[9px] font-semibold tracking-wide text-slate-500">CHOP</div>
              <div className={`text-sm font-bold ${(displayedIndicators.chop ?? 0) > 61.8 ? 'text-orange-400' : 'text-slate-300'}`}>
                {formatIndicatorValue(displayedIndicators.chop)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrikePricesTable;

