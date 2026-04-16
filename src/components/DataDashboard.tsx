import React from 'react';
import { createPortal } from 'react-dom';
import { useGameState } from '../store/useGameState';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function DataDashboard({ onClose }: Props) {
  const { historicalData, currentMonthRevenue, currentMonthExpenses, rating } = useGameState();

  // Ensure we have some data points to draw, pad if empty
  const data = historicalData.length > 0 
    ? historicalData 
    : [{ monthIndex: 1, revenue: 0, expenses: 0, satisfaction: 50 }];

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="hud-panel" style={{ width: 600, height: 400, padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>数据面板</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ marginBottom: 16, width: '100%', height: 220, display: 'flex', justifyContent: 'center' }}>
          <LineChart width={550} height={220} data={data} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="monthIndex" tickFormatter={(m) => `第${m}月`} stroke="#888" />
              <YAxis yAxisId="left" stroke="#888" />
              <YAxis yAxisId="right" orientation="right" stroke="#888" />
              <Tooltip 
                 contentStyle={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 8, color: '#fff' }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="收入" stroke="#44BBA4" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="expenses" name="支出" stroke="#E84855" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="satisfaction" name="满意度" stroke="#F4A223" strokeWidth={2} dot={false} />
            </LineChart>
        </div>
        
        <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
            <div style={{ flex: 1 }}>本月收入: <strong style={{ color: '#44BBA4' }}>{currentMonthRevenue.toLocaleString()}</strong></div>
            <div style={{ flex: 1 }}>本月支出: <strong style={{ color: '#E84855' }}>{currentMonthExpenses.toLocaleString()}</strong></div>
            <div style={{ flex: 1 }}>当前满意度: <strong style={{ color: '#F4A223' }}>{rating.toFixed(1)}</strong></div>
        </div>
      </div>
    </div>,
    document.body
  );
}
