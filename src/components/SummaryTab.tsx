import { useState, useRef, useEffect } from 'react';
import { EXPENSE_CATS, INCOME_CATS, CAT_COLORS } from '../constants';
import type { Entry, Settings } from '../types';

interface SummaryTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

export default function SummaryTab({ entries, settings, currentMonth }: SummaryTabProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter entries by month and type
  const filteredEntries = entries.filter((entry) => {
    return entry.date?.startsWith(currentMonth) && entry.type === type;
  });

  // Calculate category totals (keyed by category name)
  const catTotals: Record<string, number> = {};
  for (const entry of filteredEntries) {
    catTotals[entry.category] = (catTotals[entry.category] || 0) + entry.amount;
  }

  // Calculate total amount
  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);

  // Get categories based on type
  const categories = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // Draw pie/donut chart
  useEffect(() => {
    if (!canvasRef.current || totalAmount === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = 80;
    const innerRadius = 50;

    ctx.clearRect(0, 0, width, height);

    let currentAngle = -Math.PI / 2;
    categories.forEach((cat) => {
      const amount = catTotals[cat.name] || 0;
      if (amount === 0) return;

      const sliceAngle = (amount / totalAmount) * 2 * Math.PI;
      const color = CAT_COLORS[cat.id] || '#999';

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
      ctx.lineTo(
        centerX + innerRadius * Math.cos(currentAngle + sliceAngle),
        centerY + innerRadius * Math.sin(currentAngle + sliceAngle)
      );
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      currentAngle += sliceAngle;
    });

    // Draw center text
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`¥${totalAmount.toLocaleString()}`, centerX, centerY);
  }, [catTotals, totalAmount, categories]);

  // Calculate user totals by actual user_name
  const user1Total = filteredEntries
    .filter((e) => e.user_name === settings.user1Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user2Total = filteredEntries
    .filter((e) => e.user_name === settings.user2Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user3Total = filteredEntries
    .filter((e) => e.user_name === settings.user3Name)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="summary-tab">
      {/* Toggle buttons */}
      <div className="toggle-buttons">
        <button
          className={`toggle-btn ${type === 'expense' ? 'active' : ''}`}
          onClick={() => setType('expense')}
        >
          支出
        </button>
        <button
          className={`toggle-btn ${type === 'income' ? 'active' : ''}`}
          onClick={() => setType('income')}
        >
          収入
        </button>
      </div>

      {/* Total display */}
      <div className="total-display">
        <div className={`total-amount ${type}`}>
          ¥{totalAmount.toLocaleString()}
        </div>
      </div>

      {/* Target progress (expense only) */}
      {type === 'expense' && settings.monthlyTargets && Object.keys(settings.monthlyTargets).some((k) => settings.monthlyTargets[k] > 0) && (
        <div className="target-section">
          <h3>カテゴリ別目標</h3>
          {categories.map((cat) => {
            const target = settings.monthlyTargets?.[cat.id] || 0;
            if (target === 0) return null;

            const spent = catTotals[cat.name] || 0;
            const remaining = target - spent;
            const percentage = (spent / target) * 100;
            let barColor = '#4CAF50';
            if (percentage >= 100) barColor = '#E74C3C';
            else if (percentage >= 80) barColor = '#F39C12';

            return (
              <div key={cat.id} className="target-item">
                <div className="target-label">{cat.icon} {cat.name}</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} />
                </div>
                <div className="target-amount">
                  {remaining > 0 ? `残 ¥${remaining.toLocaleString()}` : `¥${Math.abs(remaining).toLocaleString()} 超過`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div className="chart-container">
        {totalAmount === 0 ? (
          <div className="empty-state"><span>📊 データがありません</span></div>
        ) : (
          <canvas ref={canvasRef} width={250} height={250} />
        )}
      </div>

      {/* Category breakdown */}
      <div className="breakdown-section">
        <h3>カテゴリ別内訳</h3>
        {categories.map((cat) => {
          const amount = catTotals[cat.name] || 0;
          if (amount === 0) return null;

          const percentage = ((amount / totalAmount) * 100).toFixed(1);
          const color = CAT_COLORS[cat.id] || '#999';

          return (
            <div key={cat.id} className="breakdown-row">
              <span className="breakdown-dot" style={{ backgroundColor: color }} />
              <span className="breakdown-name">{cat.icon} {cat.name}</span>
              <span className="breakdown-bar-wrap">
                <span className="breakdown-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
              </span>
              <span className="breakdown-percent">{percentage}%</span>
              <span className="breakdown-amount">¥{amount.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {/* User comparison */}
      <div className="user-comparison">
        <h3>ユーザー別合計</h3>
        <div className="user-boxes">
          <div className="user-box" style={{ backgroundColor: '#3498DB' }}>
            <div className="user-box-name">{settings.user1Name || 'ユーザー1'}</div>
            <div className="user-box-amount">¥{user1Total.toLocaleString()}</div>
          </div>
          <div className="user-box" style={{ backgroundColor: '#E91E63' }}>
            <div className="user-box-name">{settings.user2Name || 'ユーザー2'}</div>
            <div className="user-box-amount">¥{user2Total.toLocaleString()}</div>
          </div>
          <div className="user-box" style={{ backgroundColor: '#9B59B6' }}>
            <div className="user-box-name">{settings.user3Name || 'ユーザー3'}</div>
            <div className="user-box-amount">¥{user3Total.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
