import { useState, useMemo } from 'react';
import { EXPENSE_CATS, INCOME_CATS, CAT_COLORS, catToId } from '../constants';
import type { Entry, Settings } from '../types';

interface SummaryTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

/** SVG donut chart segment */
function DonutSegment({
  cx, cy, radius, strokeWidth, startAngle, endAngle, color, isHovered, onHover, onLeave
}: {
  cx: number; cy: number; radius: number; strokeWidth: number;
  startAngle: number; endAngle: number; color: string;
  isHovered: boolean; onHover: () => void; onLeave: () => void;
}) {
  const angle = endAngle - startAngle;
  const largeArc = angle > Math.PI ? 1 : 0;
  const r = radius;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const sw = isHovered ? strokeWidth + 6 : strokeWidth;

  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      style={{ transition: 'stroke-width 0.3s ease, opacity 0.3s ease', opacity: isHovered ? 1 : 0.85, cursor: 'pointer' }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    />
  );
}

export default function SummaryTab({ entries, settings, currentMonth }: SummaryTabProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    if (raw === 'user1' || raw === 'ユーザー1') return settings.user1Name || 'ユーザー1';
    if (raw === 'user2' || raw === 'ユーザー2') return settings.user2Name || 'ユーザー2';
    if (raw === 'user3' || raw === 'ユーザー3') return settings.user3Name || 'ユーザー3';
    return raw;
  };

  const filteredEntries = entries.filter((entry) =>
    entry.date?.startsWith(currentMonth) && entry.type === type
  );

  const catTotals: Record<string, number> = {};
  for (const entry of filteredEntries) {
    const id = catToId(entry.category) || entry.category;
    catTotals[id] = (catTotals[id] || 0) + entry.amount;
  }

  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const categories = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // Build chart segments
  const segments = useMemo(() => {
    if (totalAmount === 0) return [];
    const result: { catId: string; catName: string; icon: string; color: string; amount: number; pct: number; startAngle: number; endAngle: number }[] = [];
    let currentAngle = -Math.PI / 2;
    const GAP = 0.03; // small gap between segments

    categories.forEach((cat) => {
      const amount = catTotals[cat.id] || 0;
      if (amount === 0) return;
      const pct = amount / totalAmount;
      const sliceAngle = pct * 2 * Math.PI - GAP;
      if (sliceAngle <= 0) return;
      result.push({
        catId: cat.id,
        catName: cat.name,
        icon: cat.icon,
        color: CAT_COLORS[cat.id] || '#999',
        amount,
        pct,
        startAngle: currentAngle + GAP / 2,
        endAngle: currentAngle + GAP / 2 + sliceAngle,
      });
      currentAngle += pct * 2 * Math.PI;
    });
    return result;
  }, [catTotals, totalAmount, categories]);

  const user1Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user1Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user2Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user2Name)
    .reduce((sum, e) => sum + e.amount, 0);
  const user3Total = filteredEntries
    .filter((e) => resolveUserName(e.user_name) === settings.user3Name)
    .reduce((sum, e) => sum + e.amount, 0);

  const hasTargets = settings.monthlyTargets && Object.keys(settings.monthlyTargets).some((k) => settings.monthlyTargets[k] > 0);

  const hoveredSegment = segments.find((s) => s.catId === hoveredCat);

  return (
    <div className="summary-tab">
      {/* Toggle */}
      <div className="summary-section">
        <div className="summary-toggle-wrap">
          <button className={`toggle-btn ${type === 'expense' ? 'active' : ''}`} onClick={() => setType('expense')}>
            支出
          </button>
          <button className={`toggle-btn ${type === 'income' ? 'active' : ''}`} onClick={() => setType('income')}>
            収入
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="summary-section">
        <div className="summary-total-card" style={{ borderLeft: `4px solid ${type === 'expense' ? '#E74C3C' : '#27AE60'}` }}>
          <div className="total-label">{type === 'expense' ? '今月の支出' : '今月の収入'}</div>
          <div className="total-amount" style={{ color: type === 'expense' ? '#E74C3C' : '#27AE60' }}>
            ¥{totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Targets */}
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
                      <div className="target-bar" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }} />
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

      {/* SVG Donut Chart */}
      <div className="summary-section">
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="section-title" style={{ textAlign: 'left' }}>
            {type === 'expense' ? '支出内訳' : '収入内訳'}
          </h3>
          <div style={{ position: 'relative', width: 200, height: 200, margin: '12px auto' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              {totalAmount === 0 ? (
                <circle cx="100" cy="100" r="70" fill="none" stroke="#eee" strokeWidth="24" />
              ) : (
                segments.map((seg) => (
                  <DonutSegment
                    key={seg.catId}
                    cx={100} cy={100} radius={70} strokeWidth={24}
                    startAngle={seg.startAngle} endAngle={seg.endAngle}
                    color={seg.color}
                    isHovered={hoveredCat === seg.catId}
                    onHover={() => setHoveredCat(seg.catId)}
                    onLeave={() => setHoveredCat(null)}
                  />
                ))
              )}
            </svg>
            {/* Center text */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              {hoveredSegment ? (
                <>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 2 }}>{hoveredSegment.icon} {hoveredSegment.catName}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>¥{hoveredSegment.amount.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{(hoveredSegment.pct * 100).toFixed(1)}%</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>合計</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
                    {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : 'データなし'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {totalAmount > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">カテゴリ別内訳</h3>
            {segments.map((seg) => (
              <div
                key={seg.catId}
                className="cat-row"
                onMouseEnter={() => setHoveredCat(seg.catId)}
                onMouseLeave={() => setHoveredCat(null)}
                style={{ background: hoveredCat === seg.catId ? '#fafafa' : 'transparent', borderRadius: 6, padding: '7px 4px', cursor: 'pointer', transition: 'background 0.2s' }}
              >
                <div className="cat-dot" style={{ backgroundColor: seg.color }} />
                <div className="cat-info">
                  <div className="cat-label-name">{seg.icon} {seg.catName}</div>
                  <div className="cat-bar-bg">
                    <div className="cat-bar" style={{ width: `${(seg.pct * 100).toFixed(1)}%`, backgroundColor: seg.color }} />
                  </div>
                </div>
                <div className="cat-pct">{(seg.pct * 100).toFixed(1)}%</div>
                <div className="cat-amount">¥{seg.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User comparison */}
      <div className="summary-section">
        <div className="card">
          <h3 className="section-title">ユーザー別合計</h3>
          <div className="user-boxes">
            <div className="user-box-card" style={{ background: '#3B82F6' }}>
              <div className="user-box-name">{settings.user1Name || 'ユーザー1'}</div>
              <div className="user-box-amount">¥{user1Total.toLocaleString()}</div>
            </div>
            <div className="user-box-card" style={{ background: '#EF4444' }}>
              <div className="user-box-name">{settings.user2Name || 'ユーザー2'}</div>
              <div className="user-box-amount">¥{user2Total.toLocaleString()}</div>
            </div>
            <div className="user-box-card" style={{ background: '#8B5CF6' }}>
              <div className="user-box-name">{settings.user3Name || 'ユーザー3'}</div>
              <div className="user-box-amount">¥{user3Total.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
