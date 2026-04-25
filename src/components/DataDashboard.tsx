import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameState } from '../store/useGameState';
import { useParkState } from '../store/useParkState';
import { FACILITIES } from '../config/facilities';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts';
import { X, TrendingUp, BarChart2, Gauge } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type TabId = 'trend' | 'breakdown' | 'gauges';

const COLORS = ['#44BBA4', '#2E86AB', '#F4A223', '#E84855', '#E040FB', '#FF8A65', '#7B61FF', '#4DB8FF'];

export function DataDashboard({ onClose }: Props) {
  const { historicalData, currentMonthRevenue, currentMonthExpenses, rating, visitorsCount } = useGameState();
  const facilities = useParkState(state => state.facilities);

  const [activeTab, setActiveTab] = useState<TabId>('trend');

  // Trend data
  const trendData = historicalData.length > 0 
    ? historicalData 
    : [{ monthIndex: 1, revenue: 0, expenses: 0, satisfaction: 50, visitorPeak: 0 }];

  // Facility revenue breakdown (grouped by category)
  const facilityBreakdownData = React.useMemo(() => {
    const buckets: Record<string, { name: string; count: number; totalRides: number }> = {};
    for (const fac of facilities) {
      const def = FACILITIES[fac.typeId];
      if (!def) continue;
      if (!buckets[def.name]) {
        buckets[def.name] = { name: def.name, count: 0, totalRides: 0 };
      }
      buckets[def.name].count++;
      buckets[def.name].totalRides += fac.totalRides;
    }
    return Object.values(buckets).sort((a, b) => b.totalRides - a.totalRides);
  }, [facilities]);

  // Gauge data
  const netProfit = currentMonthRevenue - currentMonthExpenses;
  const facilityCount = facilities.length;
  const operatingFacilities = facilities.filter(f => !f.breakdown).length;
  const utilizationRate = facilityCount > 0 ? Math.round((operatingFacilities / facilityCount) * 100) : 0;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'trend', label: '趋势', icon: <TrendingUp size={14} /> },
    { id: 'breakdown', label: '设施', icon: <BarChart2 size={14} /> },
    { id: 'gauges', label: '仪表', icon: <Gauge size={14} /> },
  ];

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="hud-panel" style={{ width: 680, height: 480, padding: 24, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>📊 数据面板</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 16px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6,
                background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                fontWeight: activeTab === tab.id ? 600 : 400, fontSize: 13, cursor: 'pointer'
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {activeTab === 'trend' && (
            <>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="monthIndex" tickFormatter={(m) => `第${m}月`} stroke="#888" />
                    <YAxis yAxisId="left" stroke="#888" />
                    <YAxis yAxisId="right" orientation="right" stroke="#888" />
                    <Tooltip contentStyle={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 8, color: '#fff' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="revenue" name="收入" stroke="#44BBA4" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="expenses" name="支出" stroke="#E84855" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="satisfaction" name="满意度" stroke="#F4A223" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 8 }}>
                <div style={{ flex: 1 }}>本月收入: <strong style={{ color: '#44BBA4' }}>${currentMonthRevenue.toLocaleString()}</strong></div>
                <div style={{ flex: 1 }}>本月支出: <strong style={{ color: '#E84855' }}>${currentMonthExpenses.toLocaleString()}</strong></div>
                <div style={{ flex: 1 }}>当前满意度: <strong style={{ color: '#F4A223' }}>{rating.toFixed(1)}</strong></div>
              </div>
            </>
          )}

          {activeTab === 'breakdown' && (
            <div style={{ width: '100%', height: 300 }}>
              {facilityBreakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={facilityBreakdownData} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="#888" angle={-30} textAnchor="end" interval={0} fontSize={12} />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ background: 'var(--panel-bg)', border: 'none', borderRadius: 8, color: '#fff' }} />
                    <Bar dataKey="totalRides" name="累计乘客" radius={[4, 4, 0, 0]}>
                      {facilityBreakdownData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 80, color: '#666' }}>暂无设施数据</div>
              )}
            </div>
          )}

          {activeTab === 'gauges' && (
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <GaugeCard label="当日净利润" value={`$${netProfit.toLocaleString()}`} color={netProfit >= 0 ? '#44BBA4' : '#E84855'} />
              <GaugeCard label="当前游客" value={`${visitorsCount}`} subtext="/1000" color="#2E86AB" />
              <GaugeCard label="设施利用率" value={`${utilizationRate}%`} subtext={`${operatingFacilities}/${facilityCount}`} color="#F4A223" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function GaugeCard({ label, value, subtext, color }: { label: string; value: string; subtext?: string; color: string }) {
  return (
    <div style={{
      width: 160, height: 160, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontSize: 13, color: '#999' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {subtext && <div style={{ fontSize: 12, color: '#666' }}>{subtext}</div>}
    </div>
  );
}
