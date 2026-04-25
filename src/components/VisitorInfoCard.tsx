import React from 'react';
import { useParkState } from '../store/useParkState';
import { X } from 'lucide-react';
import type { VisitorAgeGroup, VisitorState } from '../types';
import './VisitorInfoCard.css';

const AGE_LABELS: Record<VisitorAgeGroup, string> = {
  child: '👦 儿童',
  teen: '🧑 青少年',
  adult: '🧑‍💼 成人',
  family: '👨‍👩‍👧 家庭',
};

const STATE_LABELS: Record<VisitorState, string> = {
  entering: '正在入园',
  idle: '闲逛中',
  walking: '行走中',
  queuing: '排队中',
  riding: '游玩中',
  eating: '用餐中',
  resting: '休息中',
  vomiting: '🤢 呕吐中',
  first_aid: '急救中',
  leaving: '离开中',
};

interface NeedBarProps {
  label: string;
  value: number;
  color: string;
  inverted?: boolean; // true = higher is worse (toilet, fatigue, nausea)
}

function NeedBar({ label, value, color, inverted }: NeedBarProps) {
  const displayValue = Math.round(value);
  const dangerLevel = inverted ? value > 60 : value < 30;
  return (
    <div className="vic-need-row">
      <span className="vic-need-label">{label}</span>
      <div className="vic-need-bar-bg">
        <div
          className="vic-need-bar-fill"
          style={{
            width: `${displayValue}%`,
            background: dangerLevel ? '#E84855' : color,
          }}
        />
      </div>
      <span className="vic-need-value">{displayValue}</span>
    </div>
  );
}

function getThought(state: VisitorState, targetFacilityId: string | null): string {
  if (state === 'queuing') return '「排队好久了...」';
  if (state === 'riding') return '「好刺激！」';
  if (state === 'eating') return '「吃饱喝足~」';
  if (state === 'resting') return '「休息一会...」';
  if (state === 'vomiting') return '「好恶心...」';
  if (state === 'leaving') return '「该回家了」';
  if (state === 'walking' && targetFacilityId) return '「想去玩那个！」';
  return '「看看有什么好玩的~」';
}

/**
 * VisitorInfoCard – PRD §6.3 compliant visitor detail card.
 * Shows all 6 need bars, age group, money, state, and thought bubble.
 */
export const VisitorInfoCard: React.FC = () => {
  const selectedVisitorId = useParkState(state => state.selectedVisitorId);
  const visitors = useParkState(state => state.visitors);
  const selectVisitor = useParkState(state => state.selectVisitor);

  if (!selectedVisitorId) return null;
  const visitor = visitors[selectedVisitorId];
  if (!visitor) return null;

  return (
    <div className="visitor-info-card">
      {/* Header */}
      <div className="vic-header">
        <div className="vic-title">
          <span>{AGE_LABELS[visitor.ageGroup]}</span>
          <span className="vic-state">{STATE_LABELS[visitor.state]}</span>
        </div>
        <button className="vic-close" onClick={() => selectVisitor(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="vic-divider" />

      {/* Core stats */}
      <div className="vic-stats">
        <div className="vic-stat-row">
          <span>余额</span>
          <strong style={{ color: '#F4A223' }}>${Math.round(visitor.money)}</strong>
        </div>
        <div className="vic-stat-row">
          <span>满意度</span>
          <strong style={{ color: visitor.satisfaction > 60 ? '#44BBA4' : '#E84855' }}>
            {Math.round(visitor.satisfaction)}
          </strong>
        </div>
        <div className="vic-stat-row">
          <span>已乘坐</span>
          <strong>{visitor.ridesCount} 次</strong>
        </div>
      </div>

      <div className="vic-divider" />

      {/* Need Bars */}
      <div className="vic-needs">
        <NeedBar label="饥饿" value={visitor.needs.hunger} color="#44BBA4" />
        <NeedBar label="口渴" value={visitor.needs.thirst} color="#4DB8FF" />
        <NeedBar label="如厕" value={visitor.needs.toilet} color="#F4A223" inverted />
        <NeedBar label="疲劳" value={visitor.needs.fatigue} color="#B0BEC5" inverted />
        <NeedBar label="恶心" value={visitor.needs.nausea} color="#E84855" inverted />
        <NeedBar label="乐趣" value={visitor.needs.fun} color="#E040FB" />
      </div>

      <div className="vic-divider" />

      {/* Thought bubble */}
      <div className="vic-thought">
        💭 {getThought(visitor.state, visitor.targetFacilityId)}
      </div>
    </div>
  );
};
