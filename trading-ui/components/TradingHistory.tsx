'use client'

import React, { useState, useEffect } from 'react';

const TradingHistory = ({ className = "" }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<'recent' | 'stats' | 'auto'>('recent');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`bg-gray-800 text-white p-4 rounded-lg shadow-lg ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recentTrades = [
    { time: '14:35', type: 'AUTO BUY', strike: '25850 CE', qty: 2, price: 210.6, pnl: '+1420', status: 'PROFIT' },
    { time: '14:28', type: 'AUTO SELL', strike: '25800 PE', qty: 3, price: 194.8, pnl: '+2850', status: 'PROFIT' },
    { time: '14:15', type: 'AUTO BUY', strike: '25900 CE', qty: 1, price: 234.65, pnl: '-480', status: 'LOSS' },
    { time: '14:02', type: 'AUTO SELL', strike: '25750 PE', qty: 4, price: 189.2, pnl: '+5640', status: 'PROFIT' },
    { time: '13:55', type: 'AUTO BUY', strike: '25850 CE', qty: 2, price: 205.3, pnl: '+960', status: 'PROFIT' },
  ];

  const autoTradingStats = [
    { metric: 'Auto Trades Today', value: '24', change: '+12%', color: 'text-blue-400' },
    { metric: 'Success Rate', value: '78%', change: '+5%', color: 'text-green-400' },
    { metric: 'Avg Profit/Trade', value: '₹2,840', change: '+15%', color: 'text-green-400' },
    { metric: 'Total Auto P&L', value: '₹45,680', change: '+8%', color: 'text-green-400' },
  ];

  const autoSettings = [
    { setting: 'Auto Buy Trigger', value: 'RSI < 30', status: 'ACTIVE' },
    { setting: 'Auto Sell Trigger', value: 'RSI > 70', status: 'ACTIVE' },
    { setting: 'Max Risk per Trade', value: '₹5,000', status: 'SET' },
    { setting: 'Stop Loss', value: '15%', status: 'SET' },
    { setting: 'Target Profit', value: '25%', status: 'SET' },
  ];

  return (
    <div className={`bg-[#111827] border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header with Tabs */}
      <div className="bg-[#1f2937] p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            📊 Trading Intelligence
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setActiveView('recent')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeView === 'recent' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setActiveView('stats')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeView === 'stats' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              Stats
            </button>
            <button
              onClick={() => setActiveView('auto')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeView === 'auto' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              Auto
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 h-64 overflow-y-auto">
        {/* Recent Trades View */}
        {activeView === 'recent' && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">🕒 Recent Auto Trades</h4>
            {recentTrades.map((trade, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[#020617] rounded border border-gray-800 hover:border-gray-600 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">{trade.time}</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      trade.type === 'AUTO BUY' ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'
                    }`}>
                      {trade.type}
                    </span>
                  </div>
                  <div className="text-xs text-white mt-1">{trade.strike} × {trade.qty}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">₹{trade.price}</div>
                  <div className={`text-xs font-bold ${
                    trade.status === 'PROFIT' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.pnl}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Statistics View */}
        {activeView === 'stats' && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">📈 Auto Trading Performance</h4>
            {autoTradingStats.map((stat, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[#020617] rounded border border-gray-800">
                <div className="flex-1">
                  <div className="text-xs text-gray-400">{stat.metric}</div>
                  <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
                </div>
                <div className="text-xs text-green-400 font-semibold">{stat.change}</div>
              </div>
            ))}
            
            {/* Additional metrics */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="p-2 bg-[#020617] rounded border border-gray-800 text-center">
                <div className="text-xs text-gray-400">Trades/Hour</div>
                <div className="text-sm font-bold text-blue-400">3.2</div>
              </div>
              <div className="p-2 bg-[#020617] rounded border border-gray-800 text-center">
                <div className="text-xs text-gray-400">Max Drawdown</div>
                <div className="text-sm font-bold text-yellow-400">-8.5%</div>
              </div>
            </div>
          </div>
        )}

        {/* Auto Settings View */}
        {activeView === 'auto' && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">🤖 Auto Trading Settings</h4>
            {autoSettings.map((setting, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[#020617] rounded border border-gray-800">
                <div className="flex-1">
                  <div className="text-xs text-gray-300">{setting.setting}</div>
                  <div className="text-xs text-white font-semibold">{setting.value}</div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold ${
                  setting.status === 'ACTIVE' 
                    ? 'bg-green-700 text-green-100' 
                    : 'bg-blue-700 text-blue-100'
                }`}>
                  {setting.status}
                </div>
              </div>
            ))}
            
            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors">
                Enable All
              </button>
              <button className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors">
                Disable All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingHistory;