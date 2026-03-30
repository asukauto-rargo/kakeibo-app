import { useState, useMemo } from 'react';
import { EXPENSE_CATS, INCOME_CATS, CAT_COLORS, catToId } from '../constants';
import type { Entry, Settings } from '../types';

interface SummaryTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

/** SVG donut chart segment with clear gap */
function DonutSegment({
  cx, cy, radius, strokeWidth, startAngle, endAngle, color, isHovered, onHover, onLeave
}: {
  cx: number; cy: number; radius: number; strokeWidth: number;
  startAngle: number; endAngle: number; color: string;
  isHovered: boolean; onHover: () => void; onLeave: () => void;
}) {
  const angle = endAngle - startAngle;
  if (angle <= 0) return null;
  const largeArc = angle > Math.PI ? 1 : 0;
  const r = radius;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const sw = isHovered ? strokeWidth + 8 : strokeWidth;

  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="butt"
      style={{
        transition: 'stroke-width 0.3s ease, opacity 0.3s ease, filter 0.3s ease',
        opacity: isHovered ? 1 : 0.88,
        cursor: 'pointer',
        filter: isHovered ? 'brightness(1.1) drop-shadow(0 0 4px rgba(0,0,0,0.2))' : 'none',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onTouchStart={onHover}
    />
  );
}

/** Daily stacked bar chart */
function DailyChart({
  entries,
  currentMonth,
  categories,
}: {
  entries: Entry[];
  currentMonth: string;
  categories: { id: string; name: string; icon: string }[];
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const { dailyData, maxDayTotal, daysInMonth, activeCats } = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const dim = new Date(y, m, 0).getDate();

    // Build daily totals per category
    const data: Record<number, Record<string, number>> = {};
    for (let d = 1; d <= dim; d++) data[d] = {};

    const catSet = new Set<string>();
    for (const entry of entries) {
      if (!entry.date?.startsWith(currentMonth) || entry.type !== 'expense') continue;
      const day = parseInt(entry.date.split('-')[2], 10);
      const catId = catToId(entry.category) || entry.category;
      data[day][catId] = (data[day][catId] || 0) + entry.amount;
      catSet.add(catId);
    }

    let maxTotal = 0;
    for (let d = 1; d <= dim; d++) {
      const dayTotal = Object.values(data[d]).reduce((s, v) => s + v, 0);
      if (dayTotal > maxTotal) maxTotal = dayTotal;
    }

    const active = categories.filter((c) => catSet.has(c.id));

    return { dailyData: data, maxDayTotal: maxTotal, daysInMonth: dim, activeCats: active };
  }, [entries, currentMonth, categories]);

  if (maxDayTotal === 0) {
    return <div className="empty-state" style={{ padding: '16px 0' }}>支出データがありません</div>;
  }

  const chartWidth = 320;
  const chartHeight = 180;
  const barAreaWidth = chartWidth - 30;
  const barWidth = Math.max(2, Math.min(10, (barAreaWidth / daysInMonth) - 1));
  const barGap = Math.max(0.5, (barAreaWidth - barWidth * daysInMonth) / daysInMonth);

  // Round up max to nearest nice number
  const niceMax = Math.ceil(maxDayTotal / 1000) * 1000 || 1000;

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        width={Math.max(chartWidth, daysInMonth * (barWidth + barGap) + 40)}
        height={chartHeight + 40}
        viewBox={`0 0 ${Math.max(chartWidth, daysInMonth * (barWidth + barGap) + 40)} ${chartHeight + 40}`}
        style={{ display: 'block' }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const lineY = 10 + (1 - pct) * chartHeight;
          return (
            <g key={pct}>
              <line x1="30" y1={lineY} x2={chartWidth} y2={lineY} stroke="#f0f0f0" strokeWidth="1" />
              <text x="26" y={lineY + 3} textAnchor="end" fontSize="8" fill="#999">
                {pct === 0 ? '0' : `${((niceMax * pct) / 1000).toFixed(0)}k`}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const x = 30 + (day - 1) * (barWidth + barGap) + barGap / 2;
          const dayTotals = dailyData[day] || {};
          const dayTotal = Object.values(dayTotals).reduce((s, v) => s + v, 0);
          let yOffset = 0;

          return (
            <g
              key={day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              onTouchStart={() => setHoveredDay(day)}
            >
              {/* Invisible hitbox */}
              <rect x={x} y={10} width={barWidth} height={chartHeight} fill="transparent" />

              {categories.map((cat) => {
                const amount = dayTotals[cat.id] || 0;
                if (amount === 0) return null;
                const barH = (amount / niceMax) * chartHeight;
                const barY = 10 + chartHeight - yOffset - barH;
                yOffset += barH;
                return (
                  <rect
                    key={cat.id}
                    x={x}
                    y={barY}
                    width={barWidth}
                    height={Math.max(barH, 0.5)}
                    fill={CAT_COLORS[cat.id] || '#999'}
                    rx="1"
                    opacity={hoveredDay === day ? 1 : 0.85}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                );
              })}

              {/* Day label */}
              {(day === 1 || day % 5 === 0 || day === daysInMonth) && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 22}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#999"
                >
                  {day}
                </text>
              )}

              {/* Hover tooltip */}
              {hoveredDay === day && dayTotal > 0 && (
                <g>
                  <rect
                    x={Math.min(x - 20, chartWidth - 70)}
                    y={0}
                    width="60"
                    height="16"
                    rx="4"
                    fill="#1a1a1a"
                    opacity="0.9"
                  />
                  <text
                    x={Math.min(x - 20, chartWidth - 70) + 30}
                    y={11}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#fff"
                    fontWeight="600"
                  >
                    {day}日 ¥{dayTotal.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* X axis */}
        <line x1="30" y1={10 + chartHeight} x2={chartWidth} y2={10 + chartHeight} stroke="#e0e0e0" strokeWidth="1" />
      </svg>

      {/* Legend */}
      {activeCats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', marginTop: 8, justifyContent: 'center' }}>
          {activeCats.map((cat) => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#666' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CAT_COLORS[cat.id] || '#999' }} />
              {cat.icon} {cat.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mini donut for user breakdown */
function MiniDonut({
  segments,
  size,
  radius,
  strokeWidth,
}: {
  segments: { catId: string; color: string; startAngle: number; endAngle: number }[];
  size: number;
  radius: number;
  strokeWidth: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
      {segments.map((seg) => {
        const angle = seg.endAngle - seg.startAngle;
        if (angle <= 0) return null;
        const largeArc = angle > Math.PI ? 1 : 0;
        const x1 = cx + radius * Math.cos(seg.startAngle);
        const y1 = cy + radius * Math.sin(seg.startAngle);
        const x2 = cx + radius * Math.cos(seg.endAngle);
        const y2 = cy + radius * Math.sin(seg.endAngle);
        return (
          <path
            key={seg.catId}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            opacity="0.88"
          />
        );
      })}
    </svg>
  );
}

export default function SummaryTab({ entries, settings, currentMonth }: SummaryTabProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('全員');

  const USER_COLORS = ['#3B82F6', '#EF4444', '#8B5CF6'];
  const userNames = [
    settings.user1Name || 'ユーザー1',
    settings.user2Name || 'ユーザー2',
    settings.user3Name || 'ユーザー3',
  ];

  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    if (raw === 'user1' || raw === 'ユーザー1') return settings.user1Name || 'ユーザー1';
    if (raw === 'user2' || raw === 'ユーザー2') return settings.user2Name || 'ユーザー2';
    if (raw === 'user3' || raw === 'ユーザー3') return settings.user3Name || 'ユーザー3';
    return raw;
  };

  const filteredEntries = useMemo(() =>
    entries.filter((entry) =>
      entry.date?.startsWith(currentMonth) && entry.type === type
    ),
    [entries, currentMonth, type]
  );

  // Further filter by selected user for charts
  const userFilteredEntries = useMemo(() => {
    if (selectedUser === '全員') return filteredEntries;
    return filteredEntries.filter((e) => resolveUserName(e.user_name) === selectedUser);
  }, [filteredEntries, selectedUser]);

  const catTotals: Record<string, number> = {};
  for (const entry of userFilteredEntries) {
    const id = catToId(entry.category) || entry.category;
    catTotals[id] = (catTotals[id] || 0) + entry.amount;
  }

  const totalAmount = userFilteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const overallTotal = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const categories = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // Build chart segments
  const segments = useMemo(() => {
    if (totalAmount === 0) return [];
    const result: { catId: string; catName: string; icon: string; color: string; amount: number; pct: number; startAngle: number; endAngle: number }[] = [];
    let currentAngle = -Math.PI / 2;

    categories.forEach((cat) => {
      const amount = catTotals[cat.id] || 0;
      if (amount === 0) return;
      const pct = amount / totalAmount;
      const sliceAngle = pct * 2 * Math.PI;
      if (sliceAngle <= 0.005) return;

      result.push({
        catId: cat.id,
        catName: cat.name,
        icon: cat.icon,
        color: CAT_COLORS[cat.id] || '#999',
        amount,
        pct,
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
      });
      currentAngle += sliceAngle;
    });
    return result;
  }, [catTotals, totalAmount, categories]);

  // Per-user totals and mini-donut data
  const userBreakdowns = useMemo(() => {
    return userNames.map((name, idx) => {
      const userEntries = filteredEntries.filter((e) => resolveUserName(e.user_name) === name);
      const total = userEntries.reduce((sum, e) => sum + e.amount, 0);
      const perCat: Record<string, number> = {};
      for (const e of userEntries) {
        const id = catToId(e.category) || e.category;
        perCat[id] = (perCat[id] || 0) + e.amount;
      }

      // Build mini donut segments
      const miniSegs: { catId: string; color: string; startAngle: number; endAngle: number }[] = [];
      if (total > 0) {
        let angle = -Math.PI / 2;
        categories.forEach((cat) => {
          const amt = perCat[cat.id] || 0;
          if (amt === 0) return;
          const slice = (amt / total) * 2 * Math.PI;
          if (slice <= 0.005) return;
          miniSegs.push({ catId: cat.id, color: CAT_COLORS[cat.id] || '#999', startAngle: angle, endAngle: angle + slice });
          angle += slice;
        });
      }

      // Top 3 categories
      const topCats = Object.entries(perCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([catId, amount]) => {
          const cat = categories.find((c) => c.id === catId);
          return { catId, name: cat?.name || catId, icon: cat?.icon || '📦', amount, pct: total > 0 ? amount / total : 0 };
        });

      return { name, color: USER_COLORS[idx], total, topCats, miniSegs };
    });
  }, [filteredEntries, userNames, categories]);

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
            ¥{overallTotal.toLocaleString()}
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
              const allCatTotals: Record<string, number> = {};
              for (const entry of filteredEntries) {
                const id = catToId(entry.category) || entry.category;
                allCatTotals[id] = (allCatTotals[id] || 0) + entry.amount;
              }
              const spent = allCatTotals[cat.id] || 0;
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

      {/* User filter tabs + Donut Chart */}
      <div className="summary-section">
        <div className="card" style={{ textAlign: 'center', padding: '12px 10px' }}>
          <h3 className="section-title" style={{ textAlign: 'left' }}>
            {type === 'expense' ? '支出内訳' : '収入内訳'}
          </h3>

          {/* User filter */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button
              onClick={() => setSelectedUser('全員')}
              style={{
                flex: 1, padding: '5px 2px', border: `2px solid ${selectedUser === '全員' ? '#1a1a1a' : '#e0e0e0'}`,
                borderRadius: 8, background: selectedUser === '全員' ? '#1a1a1a' : '#fff',
                color: selectedUser === '全員' ? '#fff' : '#999', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              全員
            </button>
            {userNames.map((name, i) => (
              <button
                key={name}
                onClick={() => setSelectedUser(name)}
                style={{
                  flex: 1, padding: '5px 2px', border: `2px solid ${selectedUser === name ? USER_COLORS[i] : '#e0e0e0'}`,
                  borderRadius: 8, background: selectedUser === name ? `${USER_COLORS[i]}15` : '#fff',
                  color: selectedUser === name ? USER_COLORS[i] : '#999', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Donut + Top categories side by side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="56" fill="none" stroke="#f0f0f0" strokeWidth="22" />
                {totalAmount === 0 ? null : (
                  segments.map((seg) => (
                    <DonutSegment
                      key={seg.catId}
                      cx={80} cy={80} radius={56} strokeWidth={22}
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
                    <div style={{ fontSize: 10, color: '#999', marginBottom: 1 }}>{hoveredSegment.icon} {hoveredSegment.catName}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>¥{hoveredSegment.amount.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#999' }}>{(hoveredSegment.pct * 100).toFixed(1)}%</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 9, color: '#999', marginBottom: 1 }}>
                      {selectedUser === '全員' ? '合計' : selectedUser}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>
                      {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : 'なし'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Top categories list beside chart */}
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              {segments.slice(0, 5).map((seg) => (
                <div
                  key={seg.catId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', fontSize: 11,
                    cursor: 'pointer', opacity: hoveredCat === seg.catId ? 1 : 0.85,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={() => setHoveredCat(seg.catId)}
                  onMouseLeave={() => setHoveredCat(null)}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.icon} {seg.catName}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, flexShrink: 0, fontSize: 10, color: '#555' }}>
                    ¥{seg.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              {segments.length > 5 && (
                <div style={{ fontSize: 10, color: '#999', paddingTop: 2 }}>
                  +{segments.length - 5}カテゴリ
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full Category breakdown */}
      {totalAmount > 0 && (
        <div className="summary-section">
          <div className="card" style={{ padding: '10px 12px' }}>
            <h3 className="section-title">カテゴリ別内訳</h3>
            {segments.map((seg) => (
              <div
                key={seg.catId}
                className="cat-row"
                onMouseEnter={() => setHoveredCat(seg.catId)}
                onMouseLeave={() => setHoveredCat(null)}
                style={{ background: hoveredCat === seg.catId ? '#fafafa' : 'transparent', borderRadius: 6, padding: '6px 4px', cursor: 'pointer', transition: 'background 0.2s' }}
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

      {/* Daily spending chart */}
      {type === 'expense' && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">日別支出</h3>
            <DailyChart
              entries={selectedUser === '全員' ? entries : entries.filter((e) => resolveUserName(e.user_name) === selectedUser)}
              currentMonth={currentMonth}
              categories={EXPENSE_CATS}
            />
          </div>
        </div>
      )}

      {/* User breakdown cards */}
      <div className="summary-section">
        <div className="card" style={{ padding: '10px 12px' }}>
          <h3 className="section-title">ユーザー別内訳</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {userBreakdowns.map((ub) => (
              <div
                key={ub.name}
                onClick={() => setSelectedUser(selectedUser === ub.name ? '全員' : ub.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                  background: selectedUser === ub.name ? `${ub.color}08` : '#fafafa',
                  borderRadius: 10, border: `1.5px solid ${selectedUser === ub.name ? ub.color : '#eee'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {/* Mini donut */}
                <MiniDonut segments={ub.miniSegs} size={52} radius={18} strokeWidth={8} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff', background: ub.color,
                      padding: '1px 7px', borderRadius: 10,
                    }}>
                      {ub.name}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                      ¥{ub.total.toLocaleString()}
                    </span>
                    {overallTotal > 0 && (
                      <span style={{ fontSize: 10, color: '#999' }}>
                        ({(ub.total / overallTotal * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {/* Top categories inline */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {ub.topCats.map((tc) => (
                      <span key={tc.catId} style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>
                        {tc.icon} ¥{tc.amount.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
