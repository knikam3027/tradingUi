'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';

interface Trade {
  id: string;
  symbol: string;
  type: 'CE' | 'PE';
  strike: string;
  expiry: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  entryTime: string;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  pnl: number;
  pnlPercent: number;
}

const TradesPage = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'pending'>('active');
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mock trade data
  const activeTrades: Trade[] = [
    {
      id: '1',
      symbol: 'NIFTY',
      type: 'CE',
      strike: '25850',
      expiry: '13-FEB-26',
      side: 'BUY',
      quantity: 50,
      entryPrice: 128.75,
      currentPrice: 135.20,
      entryTime: '09:15:23',
      status: 'OPEN',
      pnl: 322.50,
      pnlPercent: 5.01
    },
    {
      id: '2',
      symbol: 'BANKNIFTY',
      type: 'PE',
      strike: '53500',
      expiry: '13-FEB-26',
      side: 'SELL',
      quantity: 25,
      entryPrice: 245.80,
      currentPrice: 238.15,
      entryTime: '10:30:45',
      status: 'OPEN',
      pnl: 191.25,
      pnlPercent: 3.11
    },
    {
      id: '3',
      symbol: 'NIFTY',
      type: 'PE',
      strike: '25750',
      expiry: '13-FEB-26',
      side: 'BUY',
      quantity: 75,
      entryPrice: 89.45,
      currentPrice: 82.30,
      entryTime: '11:45:12',
      status: 'OPEN',
      pnl: -536.25,
      pnlPercent: -7.99
    }
  ];

  const tradeHistory: Trade[] = [
    {
      id: '4',
      symbol: 'NIFTY',
      type: 'CE',
      strike: '25800',
      expiry: '06-FEB-26',
      side: 'BUY',
      quantity: 100,
      entryPrice: 156.25,
      currentPrice: 178.40,
      entryTime: '09:20:15',
      status: 'CLOSED',
      pnl: 2215.00,
      pnlPercent: 14.17
    },
    {
      id: '5',
      symbol: 'BANKNIFTY',
      type: 'PE',
      strike: '53000',
      expiry: '30-JAN-26',
      side: 'SELL',
      quantity: 50,
      entryPrice: 189.75,
      currentPrice: 125.60,
      entryTime: '14:25:30',
      status: 'CLOSED',
      pnl: 3207.50,
      pnlPercent: 16.90
    }
  ];

  const pendingTrades: Trade[] = [
    {
      id: '6',
      symbol: 'FINNIFTY',
      type: 'CE',
      strike: '24500',
      expiry: '13-FEB-26',
      side: 'BUY',
      quantity: 40,
      entryPrice: 95.25,
      currentPrice: 95.25,
      entryTime: '12:15:45',
      status: 'PENDING',
      pnl: 0,
      pnlPercent: 0
    }
  ];

  const getCurrentTrades = () => {
    switch (activeTab) {
      case 'active': return activeTrades;
      case 'history': return tradeHistory;
      case 'pending': return pendingTrades;
      default: return [];
    }
  };

  const handleSelectTrade = (tradeId: string) => {
    setSelectedTrades(prev => 
      prev.includes(tradeId) 
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    );
  };

  const handleSelectAll = () => {
    const currentTrades = getCurrentTrades();
    setSelectedTrades(
      selectedTrades.length === currentTrades.length 
        ? [] 
        : currentTrades.map(trade => trade.id)
    );
  };

  const handleSquareOff = (tradeIds: string[]) => {
    console.log('Square off trades:', tradeIds);
    setSelectedTrades([]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getTotalPnL = () => {
    return getCurrentTrades().reduce((sum, trade) => sum + trade.pnl, 0);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-900 text-white p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Trades</h1>
              <div className="flex items-center space-x-6 text-sm">
                <span className="text-gray-400">
                  Total P&L: 
                  <span className={`ml-1 font-bold ${getTotalPnL() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(getTotalPnL())}
                  </span>
                </span>
                <span className="text-gray-400">
                  Active Trades: <span className="text-white font-semibold">{activeTrades.length}</span>
                </span>
                <span className="text-gray-400">
                  Last Updated: <span className="text-white">{mounted ? new Date().toLocaleTimeString() : '--:--:--'}</span>
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                📊 Analytics
              </button>
              <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors">
                📈 New Trade
              </button>
              <button className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors">
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-gray-800 p-1 rounded-lg w-fit">
            {(['active', 'history', 'pending'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedTrades([]);
                }}
                className={`px-6 py-2 rounded-md font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab === 'active' ? `Active (${activeTrades.length})` : 
                 tab === 'history' ? `History (${tradeHistory.length})` : 
                 `Pending (${pendingTrades.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        {activeTab === 'active' && selectedTrades.length > 0 && (
          <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {selectedTrades.length} trade(s) selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSquareOff(selectedTrades)}
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  ⚡ Square Off Selected
                </button>
                <button
                  onClick={() => setSelectedTrades([])}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trades Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  {activeTab === 'active' && (
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTrades.length === getCurrentTrades().length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </th>
                  )}
                  <th className="p-3 text-left text-gray-300 font-semibold">Symbol</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Type</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Strike</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Side</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Qty</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Entry Price</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Current Price</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">P&L</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Time</th>
                  <th className="p-3 text-left text-gray-300 font-semibold">Status</th>
                  {activeTab === 'active' && (
                    <th className="p-3 text-left text-gray-300 font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {getCurrentTrades().map((trade) => (
                  <tr key={trade.id} className="border-t border-gray-700 hover:bg-gray-750">
                    {activeTab === 'active' && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedTrades.includes(trade.id)}
                          onChange={() => handleSelectTrade(trade.id)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </td>
                    )}
                    <td className="p-3 font-semibold text-yellow-400">{trade.symbol}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.type === 'CE' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">{trade.strike}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.side === 'BUY' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'
                      }`}>
                        {trade.side}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">{trade.quantity}</td>
                    <td className="p-3 text-gray-300">₹{trade.entryPrice.toFixed(2)}</td>
                    <td className="p-3 text-white font-semibold">₹{trade.currentPrice.toFixed(2)}</td>
                    <td className="p-3">
                      <div className={`font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{trade.pnl.toFixed(2)}
                      </div>
                      <div className={`text-xs ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%)
                      </div>
                    </td>
                    <td className="p-3 text-gray-300 text-sm">{trade.entryTime}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.status === 'OPEN' ? 'bg-green-600 text-white' :
                        trade.status === 'CLOSED' ? 'bg-gray-600 text-white' :
                        'bg-yellow-600 text-black'
                      }`}>
                        {trade.status}
                      </span>
                    </td>
                    {activeTab === 'active' && (
                      <td className="p-3">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleSquareOff([trade.id])}
                            className="bg-orange-600 hover:bg-orange-700 px-2 py-1 rounded text-xs transition-colors"
                          >
                            Exit
                          </button>
                          <button className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors">
                            Modify
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Today's P&L</div>
            <div className="text-xl font-bold text-green-400">₹2,183.25</div>
            <div className="text-xs text-green-400">+3.2%</div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Total Trades</div>
            <div className="text-xl font-bold text-white">127</div>
            <div className="text-xs text-gray-400">This month</div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-xl font-bold text-blue-400">68.5%</div>
            <div className="text-xs text-blue-400">87/127 trades</div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Max Profit</div>
            <div className="text-xl font-bold text-green-400">₹4,520</div>
            <div className="text-xs text-gray-400">Single trade</div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default TradesPage;