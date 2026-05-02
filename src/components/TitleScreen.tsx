import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Compass } from 'lucide-react';

interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const [fading, setFading] = useState(false);

  const handleStart = () => {
    setFading(true);
    setTimeout(onStart, 600);
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'linear-gradient(180deg, #1a3a4a 0%, #0d1f2d 40%, #1a2f1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      opacity: fading ? 0 : 1,
      transition: 'opacity 0.6s ease-out',
      pointerEvents: fading ? 'none' : 'auto',
    }}>
      {/* Decorative particles */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        overflow: 'hidden', pointerEvents: 'none',
      }}>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 4 + Math.random() * 6,
            height: 4 + Math.random() * 6,
            borderRadius: '50%',
            background: `rgba(255,255,255,${0.1 + Math.random() * 0.3})`,
            animation: `floatUp ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }} />
        ))}
      </div>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 12,
        animation: 'anim-fadeUp 0.8s ease-out',
      }}>
        <Compass size={48} color="#44BBA4" style={{ filter: 'drop-shadow(0 0 20px rgba(68,187,164,0.5))' }} />
        <h1 style={{
          fontSize: 64, fontWeight: 700,
          background: 'linear-gradient(135deg, #44BBA4, #4DB8FF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: 2,
        }}>
          Coast
        </h1>
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 48,
        animation: 'anim-fadeUp 0.8s ease-out 0.15s both',
      }}>
        主题公园模拟经营游戏
      </p>

      <button onClick={handleStart} style={{
        padding: '16px 48px', borderRadius: 14,
        background: 'linear-gradient(135deg, #44BBA4, #2E86AB)',
        border: 'none', color: '#fff', fontSize: 20, fontWeight: 600,
        cursor: 'pointer', letterSpacing: 1,
        boxShadow: '0 8px 32px rgba(46,134,171,0.4)',
        transition: 'all 0.3s',
        animation: 'anim-fadeUp 0.8s ease-out 0.3s both',
      }}
      onMouseEnter={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.05)'; }}
      onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(0) scale(1)'; }}
      >
        开始游戏
      </button>

      <div style={{
        position: 'absolute', bottom: 40,
        color: 'rgba(255,255,255,0.2)', fontSize: 12,
      }}>
        Press Enter or Click to Start
      </div>

      <style>{`
        @keyframes floatUp {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
