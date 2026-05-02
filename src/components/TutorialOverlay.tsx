import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STEPS = [
  {
    title: '建造道路',
    desc: '从底部建造栏选择「道路」标签，点击一个道路类型，然后在公园地面上点击铺设道路。设施必须连接道路才能运营。',
    highlight: 'bottom',
  },
  {
    title: '放置第一个游乐设施',
    desc: '选择「刺激」或「温和」标签，挑选一个设施（如旋转木马），放入与道路相邻的位置。游客会通过道路找到它。',
    highlight: 'bottom',
  },
  {
    title: '设置餐饮摊位',
    desc: '选择「商业」标签，放置薯条摊或汽水摊。饥饿/口渴的游客会来消费，为你创造收入。',
    highlight: 'bottom',
  },
  {
    title: '雇佣清洁工',
    desc: '选择「员工」标签，雇佣一名清洁工。他们会在巡逻区内清扫垃圾和呕吐物，保持公园环境整洁。',
    highlight: 'bottom',
  },
  {
    title: '检查财务状况',
    desc: '点击顶部栏的「数据」按钮查看收支趋势，点击「设置」调整门票和各设施票价。祝你经营成功！',
    highlight: 'top',
  },
];

export function TutorialOverlay({ onClose }: Props) {
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      try { localStorage.setItem('coast_tutorial_done', 'true'); } catch {}
      onClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    try { localStorage.setItem('coast_tutorial_done', 'true'); } catch {}
    onClose();
  };

  const s = STEPS[step];

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      zIndex: 2000, pointerEvents: 'auto',
    }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginTop: 40 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: 32, height: 4, borderRadius: 2,
            background: i <= step ? '#44BBA4' : 'rgba(255,255,255,0.2)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Card */}
      <div style={{
        position: 'absolute',
        [s.highlight === 'top' ? 'top' : 'bottom']: s.highlight === 'top' ? 80 : 180,
        left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(20,20,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16,
        padding: '28px 32px', maxWidth: 480, width: '90%',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#44BBA4', fontWeight: 600 }}>
            新手引导 · {step + 1}/{STEPS.length}
          </span>
          <button onClick={handleSkip} style={{ color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            跳过
          </button>
        </div>

        <h2 style={{ fontSize: 22, margin: 0, fontWeight: 700 }}>{s.title}</h2>
        <p style={{ color: '#bbb', lineHeight: 1.7, margin: 0, fontSize: 14 }}>{s.desc}</p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button onClick={handleSkip} style={{
            padding: '10px 20px', borderRadius: 8, background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)', color: '#888', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <X size={16} /> 跳过全部
          </button>
          <button onClick={handleNext} style={{
            padding: '10px 24px', borderRadius: 8,
            background: isLast ? '#44BBA4' : '#2E86AB',
            border: 'none', color: '#111', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {isLast ? <Check size={16} /> : <ArrowRight size={16} />}
            {isLast ? '开始游戏' : '下一步'}
          </button>
        </div>
      </div>

      {/* Subtle highlight indicator */}
      <div style={{
        position: 'absolute',
        [s.highlight === 'top' ? 'top' : 'bottom']: s.highlight === 'top' ? 60 : 160,
        left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 3, borderRadius: 2,
        background: 'linear-gradient(90deg, transparent, #44BBA4, transparent)',
        animation: 'pulseGlow 2s infinite',
      }} />

      <style>{`
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
