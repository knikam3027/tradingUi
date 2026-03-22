'use client'

import React, { useState, useEffect } from 'react';

const OngoingTradesTable = ({ className = "" }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const [engineRunning, setEngineRunning] = useState(true);
  const [ongoingTrades, setOngoingTrades] = useState([
    {
      id: 1,
      type: 'BUY',
      symbol: '25850 CE',
      qty: 2,
      entryPrice: 210.6,
      currentPrice: 215.3,
      mtm: '+946',
      mtmPercent: '+0.45%',
      sl: '200',
      target: '230',
      status: 'ACTIVE',
      entryTime: '14:30',
      trioStatus: 'Active'
    },
    {
      id: 2,
      type: 'SELL',
      symbol: '25800 PE',
      qty: 3,
      entryPrice: 194.8,
      currentPrice: 192.5,
      mtm: '+690',
      mtmPercent: '+0.34%',
      sl: '205',
      target: '180',
      status: 'ACTIVE',
      entryTime: '14:25',
      trioStatus: 'Waiting'
    },
    {
      id: 3,
      type: 'BUY',
      symbol: '25900 CE',
      qty: 1,
      entryPrice: 234.65,
      currentPrice: 228.9,
      mtm: '-5.75',
      mtmPercent: '-0.25%',
      sl: '215',
      target: '250',
      status: 'ACTIVE',
      entryTime: '14:15',
      trioStatus: 'Entry'
    }
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSquareOffAll = () => {
    if (confirm('Are you sure you want to square off all trades?')) {
      alert('All trades have been squared off with Current MTM realized');
      setOngoingTrades([]);
    }
  };

  const handleBookTrade = (tradeId: number) => {
    alert(`Trade #${tradeId} booked successfully!`);
  };

  const handleStartStop = () => {
    setEngineRunning(!engineRunning);
    alert(engineRunning ? 'Engine stopped. No new trades will be executed.' : 'Engine started. Trading active.');
  };

  if (!mounted) {
    return (
      <div className={`bg-gray-800 text-white p-4 rounded-lg shadow-lg ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-4 bg-gray-700 rounded flex-1"></div>
                <div className="h-4 bg-gray-700 rounded flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalMTM = ongoingTrades.reduce((sum, trade) => {
    const value = parseFloat(trade.mtm.replace(/[+₹,]/g, ''));
    return sum + (trade.mtm.includes('+') ? value : -value);
  }, 0);

  return (
    <div className={`border border-gray-700 bg-[#020617] rounded-md overflow-hidden ${className}`}>
      {/* Header with Control Buttons */}
      <div className="bg-[#1f2937] p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            📊 Ongoing Trades (CALL/PUT)
          </h3>
          <div className="text-sm text-gray-300">
            Total MTM: <span className={totalMTM >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              ₹{Math.abs(totalMTM).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSquareOffAll}
            disabled={ongoingTrades.length === 0 || !engineRunning}
            className={`px-3 py-1.5 text-sm font-bold rounded transition-colors flex items-center gap-1 ${
              ongoingTrades.length === 0 || !engineRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            <span>🔲</span>
            Square Off All
          </button>

          <div className="flex-1"></div>

          <span className={`text-xs px-2 py-1 rounded font-bold ${
            engineRunning ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}>
            {engineRunning ? '🟢 RUNNING' : '🔴 STOPPED'}
          </span>
        </div>
      </div>

      {/* Trades Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse min-w-[1200px]">
          <thead className="bg-[#1d4ed8]">
            <tr>
              {["TYPE", "SYMBOL", "QTY", "ENTRY", "CURRENT", "MTM", "MTM %", "SL", "TARGET", "ENTRY TIME", "STATUS", "TRIO", "BOOK"].map(h => (
                <th key={h} className="px-2 py-1 text-left font-bold text-white border-r border-blue-900 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ongoingTrades.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-4 text-center text-gray-400">
                  No active trades
                </td>
              </tr>
            ) : (
              ongoingTrades.map((trade) => (
                <tr key={trade.id} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className={`px-2 py-1 font-bold text-sm ${
                    trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.type}
                  </td>
                  <td className="px-2 py-1 text-white font-mono font-semibold">{trade.symbol}</td>
                  <td className="px-2 py-1 text-gray-300 font-semibold">{trade.qty}</td>
                  <td className="px-2 py-1 text-blue-300">₹{trade.entryPrice}</td>
                  <td className="px-2 py-1 text-yellow-300 font-semibold">₹{trade.currentPrice}</td>
                  <td className={`px-2 py-1 font-bold ${
                    trade.mtm.includes('+') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.mtm}
                  </td>
                  <td className={`px-2 py-1 font-semibold ${
                    trade.mtmPercent.includes('+') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.mtmPercent}
                  </td>
                  <td className="px-2 py-1 text-orange-400 font-semibold">{trade.sl}</td>
                  <td className="px-2 py-1 text-purple-400 font-semibold">{trade.target}</td>
                  <td className="px-2 py-1 text-gray-400 text-[10px]">{trade.entryTime}</td>
                  <td className="px-2 py-1">
                    <span className="px-2 py-0.5 bg-green-900 text-green-300 rounded text-[10px] font-bold">
                      {trade.status}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <select
                      defaultValue={trade.trioStatus}
                      className="px-1 py-0.5 bg-gray-700 text-white text-[10px] rounded border border-gray-600 focus:outline-none focus:border-blue-400"
                    >
                      <option>Entry</option>
                      <option>Waiting</option>
                      <option>Active</option>
                      <option>Exit</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => handleBookTrade(trade.id)}
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded transition-colors"
                    >
                      BOOK
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="border-t border-gray-700 bg-[#020617] text-[11px] px-3 py-2">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-white font-bold">Active Trades: {ongoingTrades.length}</span>
          <span className="text-green-400 font-bold">Available Margin: ₹2,50,000</span>
          <span className="text-yellow-400 font-bold">Used Margin: ₹75,000</span>
          <span className={`font-bold ${totalMTM >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Total MTM: ₹{totalMTM.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OngoingTradesTable;
