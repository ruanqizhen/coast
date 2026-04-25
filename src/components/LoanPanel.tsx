import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGameState } from '../store/useGameState';
import { X, Landmark, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function LoanPanel({ onClose }: Props) {
  const loan = useGameState(state => state.loan);
  const money = useGameState(state => state.money);
  const addMoney = useGameState(state => state.addMoney);
  const setLoan = useGameState(state => state.setLoan);

  const [loanAmount, setLoanAmount] = useState(1000);
  const [repayAmount, setRepayAmount] = useState(500);

  const canBorrow = loan.principal + loanAmount <= loan.maxLoan;
  const canRepay = repayAmount > 0 && repayAmount <= Math.min(money, loan.principal);
  const monthlyInterest = loan.principal * loan.monthlyRate;

  const handleBorrow = () => {
    if (!canBorrow) return;
    addMoney(loanAmount);
    setLoan({ ...loan, principal: loan.principal + loanAmount });
    useGameState.getState().addMessage({
      id: `msg_${Date.now()}`,
      text: `💰 成功贷款 $${loanAmount}`,
      priority: 'info',
      timestamp: Date.now(),
    });
  };

  const handleRepay = () => {
    const actual = Math.min(repayAmount, loan.principal, money);
    if (actual <= 0) return;
    addMoney(-actual);
    setLoan({ ...loan, principal: loan.principal - actual });
    useGameState.getState().addMessage({
      id: `msg_${Date.now()}`,
      text: `💸 还款 $${actual}`,
      priority: 'info',
      timestamp: Date.now(),
    });
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="hud-panel" style={{ width: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Landmark size={20} color="#7B61FF" /> 贷款管理
          </h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Current loan info */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>当前贷款余额</span>
            <strong style={{ color: loan.principal > 0 ? '#E84855' : '#44BBA4', fontSize: 18 }}>
              ${loan.principal.toLocaleString()}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>贷款上限</span>
            <strong>${loan.maxLoan.toLocaleString()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>月利率</span>
            <strong>{(loan.monthlyRate * 100).toFixed(1)}%</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#999' }}>预估月利息</span>
            <strong style={{ color: '#F4A223' }}>${monthlyInterest.toFixed(0)}</strong>
          </div>
        </div>

        {/* Borrow */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ArrowDownCircle size={20} color="#44BBA4" />
          <span style={{ flex: 1 }}>借款金额</span>
          <input
            type="range" min={500} max={loan.maxLoan - loan.principal} step={500}
            value={loanAmount}
            onChange={e => setLoanAmount(Number(e.target.value))}
            style={{ width: 120, accentColor: '#44BBA4' }}
          />
          <span style={{ width: 60, textAlign: 'right', color: '#44BBA4', fontWeight: 600 }}>${loanAmount}</span>
          <button
            disabled={!canBorrow}
            onClick={handleBorrow}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: canBorrow ? '#44BBA4' : '#333',
              color: '#fff', cursor: canBorrow ? 'pointer' : 'not-allowed',
              fontWeight: 500
            }}
          >
            借款
          </button>
        </div>

        {/* Repay */}
        {loan.principal > 0 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ArrowUpCircle size={20} color="#E84855" />
            <span style={{ flex: 1 }}>还款金额</span>
            <input
              type="range" min={100} max={Math.min(money, loan.principal)} step={100}
              value={Math.min(repayAmount, Math.min(money, loan.principal))}
              onChange={e => setRepayAmount(Number(e.target.value))}
              style={{ width: 120, accentColor: '#E84855' }}
            />
            <span style={{ width: 60, textAlign: 'right', color: '#E84855', fontWeight: 600 }}>${repayAmount}</span>
            <button
              disabled={!canRepay}
              onClick={handleRepay}
              style={{
                padding: '8px 16px', borderRadius: 6,
                background: canRepay ? '#E84855' : '#333',
                color: '#fff', cursor: canRepay ? 'pointer' : 'not-allowed',
                fontWeight: 500
              }}
            >
              还款
            </button>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
          贷款利息将在每月结算时自动扣除
        </div>
      </div>
    </div>,
    document.body
  );
}
