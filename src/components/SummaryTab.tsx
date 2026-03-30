import { useState, useRef, useEffect } from 'react';
import { EXPENSE_CATS, INCOME_CATS, CAT_COLORS, findCat, catToId, catToName } from '../constants';
import type { Entry, Settings } from '../types';

interface SummaryTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

export default function SummaryTab({ entries, settings, currentMonth }: SummaryTabProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** user_name を設定の表示名にマッピング */
  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    if (raw === 'user1' || raw === 'ユーザー1') return settings.user1Name || 'ユーザー1';
    if (raw === 'user2' || raw === 'ユーザー2') return settings.user2Name || 'ユーザー2';
    if (raw === 'user3' || raw === 'ユーザー3') return settings.user3Name || 'ユーザー3';
    return raw;
  };

  // Filter entries by month and type
  const filteredEntries = entries.filter((entry) => {
    return entry.date?.startsWith(currentMonth) && entry.type === type;
  });

  // Calculate category totals (keyed by category ID for consistency)
  const catTotals: Record<string, number> = {};
  for (const entry of filteredEntries) {
    const id = catToId(entry.category) || entry.category;
    catTotals[id] = (catTotals[id] || 0) + entry.amount;
  }

  // Calculate total amount
  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);

  // Get categories based on type
  const categories = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // Draw donut chart
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const displaySize = 180;

    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const centerX = displaySize / 2;
    const centerY = displaySize / 2;
    const outerRadius = 80;
    const innerRadius = 50;

    if (totalAmount === 0) {
      // Draw empty donut
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
      ctx.closePath();
      ctx.fillStyle = '#e8e8e8';
      ctx.fill();

      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('データなし', centerX, centerY);
      return;
    }

    let currentAngle = -Math.PI / 2;
    categories.forEach((cat) => {
      const amount = catTotals[cat.id] || 0;
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

    // Draw center text with total amount
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`¥${totalAmount.toLocaleString()}`, centerX, centerY - 8);

    // Draw label below
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('合計', centerX, centerY + 14);
  }, [catTotals, totalAmount, categories, type]);

  // Calculate user totals
  const user1Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user1Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user2Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user2Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user3Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user3Name)
    .reduce((sum, e) => sum + e.amount, 0);

  // Check if there are any targets for display
  const hasTargets = settings.monthlyTargets && Object.keys(settings.monthlyTargets).some((k) => settings.monthlyTargets[k] > 0);

  return (
    <div className="summary-tab">
      {/* Toggle buttons */}
      <div className="summary-section">
        <div className="summary-toggle-wrap">
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
      </div>

      {/* Total display */}
      <div className="summary-section">
        <div className="summary-total-card" style={{
          borderLeft: `4px solid ${type === 'expense' ? '#E74C3C' : '#27AE60'}`
        }}>
          <div className="total-label">
            {type === 'expense' ? '今月の支出' : '今月の収入'}
          </div>
          <div className="total-amount" style={{ color: type === 'expense' ? '#E74C3C' : '#27AE60' }}>
            ¥{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Target and Achievement section (expense only) */}
      {type === 'expense' && hasTargets && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">目標と実績</h3>
            {categories.map((cat) => {
              const target = settings.monthlyTargets?.[cat.id] || 0;
              if (target === 0) return null;

              const spent = catTotals[cat.id] || 0;
              const remaining = target - spent;
              const percentage = (spent / target) * 100;
              let barColor = '#27AE60';
              if (percentage >= 100) barColor = '#E74C3C';
              else if (percentage >= 80) barColor = '#F39C12';

              return (
                <div key={cat.id} className="target-row">
                  <div className="tr-cat">{cat.icon} {cat.name}</div>
                  <div className="tr-bar">
                    <div className="target-bar-bg">
                      <div
                        className="target-bar"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: barColor
                        }}
                      />
                    </div>
                  </div>
                  <div className="tr-info">
                    {remaining > 0 ? `残 ¥${remaining.toLocaleString()}` : `¥${Math.abs(remaining).toLocaleString()} 超過`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chart section */}
      <div className="summary-section">
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="section-title" style={{ textAlign: 'left' }}>
            {type === 'expense' ? '支出内訳' : '収入内訳'}
          </h3>
          <div style={{ margin: '16px auto', width: '180px', height: '180px' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {totalAmount > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">カテゴリ別内訳</h3>
            {categories.map((cat) => {
              const amount = catTotals[cat.id] || 0;
              if (amount === 0) return null;

              const percentage = ((amount / totalAmount) * 100).toFixed(1);
              const color = CAT_COLORS[cat.id] || '#999';

              return (
                <div key={cat.id} className="cat-row">
                  <div className="cat-dot" style={{ backgroundColor: color }} />
                  <div className="cat-info">
                    <div className="cat-label-name">{cat.icon} {cat.name}</div>
                    <div className="cat-bar-bg">
                      <div className="cat-bar" style={{ width: `${percentage}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div className="cat-pct">{percentage}%</div>
                  <div className="cat-amount">¥{amount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User comparison section */}
      <div className="summary-section">
        <div className="card">
          <h3 className="section-title">ユーザー別合計</h3>
          <div className="user-boxes">
            <div className="user-box-card">
              <div className="user-box-name">{settings.user1Name || 'ユーザー1'}</div>
              <div className="user-box-amount">¥{user1Total.toLocaleString()}</div>
            </div>
            <div className="user-box-card">
              <div className="user-box-name">{settings.user2Name || 'ユーザー2'}</div>
              <div className="user-box-amount">¥{user2Total.toLocaleString()}</div>
            </div>
            <div className="user-box-card">
              <div className="user-box-name">{settings.user3Name || 'ユーザー3'}</div>
              <div className="user-box-amount">¥{user3Total.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
