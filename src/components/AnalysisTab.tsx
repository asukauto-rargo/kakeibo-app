import { useState, useMemo } from 'react';
import type { Entry, Settings } from '../types';
import { findCat } from '../constants';
import {
  aggregateStores,
  aggregateItems,
  aggregateMonthlyTotals,
  getItemPriceSeries,
  aggregateWeekday,
  parseReceiptMemo,
} from '../lib/receiptMemo';

interface AnalysisTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

type Period = 'month' | 'all';

export default function AnalysisTab({ entries, settings, currentMonth }: AnalysisTabProps) {
  const [period, setPeriod] = useState<Period>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [priceKey, setPriceKey] = useState<string>('');

  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    if (raw === 'user1' || raw === 'ユーザー1') return settings.user1Name || 'ユーザー1';
    if (raw === 'user2' || raw === 'ユーザー2') return settings.user2Name || 'ユーザー2';
    if (raw === 'user3' || raw === 'ユーザー3') return settings.user3Name || 'ユーザー3';
    return raw;
  };
  void resolveUserName;

  // 対象期間でフィルタ
  const scopedEntries = useMemo(() => {
    if (period === 'all') return entries;
    return entries.filter((e) => e.date?.startsWith(currentMonth));
  }, [entries, period, currentMonth]);

  const stores = useMemo(() => aggregateStores(scopedEntries).slice(0, 8), [scopedEntries]);
  const items = useMemo(() => aggregateItems(scopedEntries).slice(0, 10), [scopedEntries]);
  const foods = useMemo(() => aggregateItems(scopedEntries, true).slice(0, 10), [scopedEntries]);

  // 月別推移（常に全期間ベースで直近6ヶ月）
  const monthly = useMemo(
    () => aggregateMonthlyTotals(entries, currentMonth, 6),
    [entries, currentMonth]
  );
  const maxMonthly = Math.max(...monthly.map((m) => m.total), 1);
  const thisMonthTotal = monthly[monthly.length - 1]?.total || 0;
  const lastMonthTotal = monthly[monthly.length - 2]?.total || 0;
  const monthDiff = thisMonthTotal - lastMonthTotal;
  const monthDiffPct = lastMonthTotal > 0 ? (monthDiff / lastMonthTotal) * 100 : 0;

  const hasReceiptData = items.length > 0 || stores.length > 0;

  // 価格推移（全期間の同一商品）
  const priceSeriesList = useMemo(() => getItemPriceSeries(entries), [entries]);
  const activePriceKey = priceKey || priceSeriesList[0]?.key || '';
  const activeSeries = priceSeriesList.find((s) => s.key === activePriceKey);

  // 曜日別傾向（対象期間）
  const weekday = useMemo(() => aggregateWeekday(scopedEntries), [scopedEntries]);
  const maxWeekday = Math.max(...weekday.map((w) => w.total), 1);

  // カレンダー用: 当月の日別内訳（店舗・金額）
  const dayMap = useMemo(() => {
    const m: Record<number, { store: string; amount: number; category: string }[]> = {};
    for (const e of entries) {
      if (e.type !== 'expense' || !e.date?.startsWith(currentMonth)) continue;
      const day = parseInt(e.date.split('-')[2], 10);
      const parsed = parseReceiptMemo(e.memo || '');
      const store = parsed.isReceipt && parsed.store
        ? parsed.store
        : (e.memo && !parsed.isReceipt ? e.memo : e.category);
      (m[day] = m[day] || []).push({ store, amount: e.amount, category: e.category });
    }
    return m;
  }, [entries, currentMonth]);

  // 選択日の店舗別まとめ
  const selectedDayStores = useMemo(() => {
    if (selectedDay === null) return [];
    const list = dayMap[selectedDay] || [];
    const byStore: Record<string, { store: string; amount: number; category: string; count: number }> = {};
    for (const it of list) {
      if (!byStore[it.store]) byStore[it.store] = { store: it.store, amount: 0, category: it.category, count: 0 };
      byStore[it.store].amount += it.amount;
      byStore[it.store].count += 1;
    }
    return Object.values(byStore).sort((a, b) => b.amount - a.amount);
  }, [selectedDay, dayMap]);

  return (
    <div className="analysis-tab">
      {/* Period toggle */}
      <div className="summary-section">
        <div className="summary-toggle-wrap">
          <button className={`toggle-btn ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>
            全期間
          </button>
          <button className={`toggle-btn ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>
            今月
          </button>
        </div>
      </div>

      {/* 日別カレンダー（どの日にどこでいくら） */}
      <div className="summary-section">
        <div className="card">
          <h3 className="section-title">📅 日別カレンダー</h3>
          {(() => {
            const [y, mo] = currentMonth.split('-').map(Number);
            const daysInMonth = new Date(y, mo, 0).getDate();
            const firstWeekday = new Date(y, mo - 1, 1).getDay();
            const dayTotals: Record<number, number> = {};
            for (let d = 1; d <= daysInMonth; d++) {
              dayTotals[d] = (dayMap[d] || []).reduce((s, it) => s + it.amount, 0);
            }
            const monthTotal = Object.values(dayTotals).reduce((s, v) => s + v, 0);
            const maxDay = Math.max(...Object.values(dayTotals), 1);
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstWeekday; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            const todayStr = new Date().toISOString().split('T')[0];
            return (
              <>
                <div className="calendar-monthtotal" style={{ marginTop: 0 }}>
                  今月の支出 <strong>¥{monthTotal.toLocaleString()}</strong>
                </div>
                <div className="calendar-grid calendar-head">
                  {weekdays.map((w, i) => (
                    <div key={w} className="calendar-weekday" style={{ color: i === 0 ? '#E74C3C' : i === 6 ? '#3B82F6' : '#999' }}>{w}</div>
                  ))}
                </div>
                <div className="calendar-grid">
                  {cells.map((d, i) => {
                    if (d === null) return <div key={`e${i}`} className="calendar-cell empty" />;
                    const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
                    const amount = dayTotals[d];
                    const intensity = amount > 0 ? 0.12 + (amount / maxDay) * 0.5 : 0;
                    const isToday = dateStr === todayStr;
                    const isSel = selectedDay === d;
                    return (
                      <button
                        key={d}
                        className={`calendar-cell ${isToday ? 'today' : ''}`}
                        style={{
                          background: amount > 0 ? `rgba(231,76,60,${intensity})` : undefined,
                          outline: isSel ? '2px solid #1a1a1a' : undefined,
                        }}
                        onClick={() => setSelectedDay(isSel ? null : d)}
                      >
                        <span className="calendar-day">{d}</span>
                        {amount > 0 && (
                          <span className="calendar-amount">
                            {amount >= 10000 ? `${(amount / 10000).toFixed(1)}万` : `${(amount / 1000).toFixed(amount >= 1000 ? 0 : 1)}k`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 選択日の内訳 */}
                {selectedDay !== null && (
                  <div className="calendar-day-detail">
                    <div className="cdd-head">
                      {mo}月{selectedDay}日 の支出
                      <span className="cdd-total">¥{(dayTotals[selectedDay] || 0).toLocaleString()}</span>
                    </div>
                    {selectedDayStores.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#999', padding: '8px 0', textAlign: 'center' }}>この日の支出はありません</div>
                    ) : (
                      selectedDayStores.map((s) => (
                        <div key={s.store} className="cdd-row">
                          <span className="cdd-store">
                            {findCat(s.category)?.icon || '📦'} {s.store}
                          </span>
                          <span className="cdd-amount">¥{s.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                {selectedDay === null && (
                  <div className="calendar-hint">日付をタップすると、その日にどこでいくら使ったか表示します</div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* 支出の推移 */}
      <div className="summary-section">
        <div className="card">
          <h3 className="section-title">支出の推移（直近6ヶ月）</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, padding: '8px 0' }}>
            {monthly.map((m, i) => {
              const h = (m.total / maxMonthly) * 100;
              const isCurrent = i === monthly.length - 1;
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 9, color: '#999', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {m.total > 0 ? `¥${(m.total / 1000).toFixed(m.total >= 10000 ? 0 : 1)}k` : ''}
                  </div>
                  <div style={{
                    width: '100%', maxWidth: 34, height: `${Math.max(h, 2)}%`, minHeight: 2,
                    background: isCurrent ? 'linear-gradient(180deg,#E74C3C,#c0392b)' : 'linear-gradient(180deg,#95A5A6,#7f8c8d)',
                    borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease',
                  }} />
                  <div style={{ fontSize: 10, color: isCurrent ? '#E74C3C' : '#999', fontWeight: isCurrent ? 700 : 500 }}>
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
          {/* 前月比 */}
          <div style={{
            marginTop: 6, padding: '8px 12px', borderRadius: 8,
            background: monthDiff > 0 ? '#FEF2F2' : '#F0FDF4',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#666' }}>前月比</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: monthDiff > 0 ? '#E74C3C' : '#27AE60' }}>
              {monthDiff > 0 ? '▲' : '▼'} ¥{Math.abs(monthDiff).toLocaleString()}
              {lastMonthTotal > 0 && (
                <span style={{ fontSize: 11, marginLeft: 4 }}>
                  ({monthDiff > 0 ? '+' : ''}{monthDiffPct.toFixed(0)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* 曜日別の傾向 */}
      <div className="summary-section">
        <div className="card">
          <h3 className="section-title">曜日別の支出傾向（{period === 'all' ? '全期間' : '今月'}）</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120, padding: '8px 0' }}>
            {weekday.map((w, i) => {
              const h = (w.total / maxWeekday) * 100;
              const color = i === 0 ? '#E74C3C' : i === 6 ? '#3B82F6' : '#7f8c8d';
              return (
                <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ fontSize: 9, color: '#999', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {w.total > 0 ? (w.total >= 10000 ? `${(w.total / 10000).toFixed(1)}万` : `${(w.total / 1000).toFixed(0)}k`) : ''}
                  </div>
                  <div style={{ width: '100%', maxWidth: 28, height: `${Math.max(h, 2)}%`, minHeight: 2, background: color, borderRadius: '4px 4px 0 0', transition: 'height .3s' }} />
                  <div style={{ fontSize: 11, color, fontWeight: 600 }}>{w.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>棒の高さは合計支出額</div>
        </div>
      </div>

      {/* 同じ商品の価格推移 */}
      {priceSeriesList.length > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">同じ商品の価格推移</h3>
            <select
              value={activePriceKey}
              onChange={(e) => setPriceKey(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginBottom: 10 }}
            >
              {priceSeriesList.map((s) => (
                <option key={s.key} value={s.key}>{s.label}（{s.count}回）</option>
              ))}
            </select>
            {activeSeries && (() => {
              const pts = activeSeries.points;
              const amounts = pts.map((p) => p.amount);
              const minA = Math.min(...amounts);
              const maxA = Math.max(...amounts);
              const W = 300, H = 110, padX = 10, padY = 16;
              const n = pts.length;
              const xFor = (i: number) => padX + (n === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (n - 1));
              const yFor = (a: number) => {
                if (maxA === minA) return H / 2;
                return padY + (1 - (a - minA) / (maxA - minA)) * (H - 2 * padY);
              };
              const linePts = pts.map((p, i) => `${xFor(i)},${yFor(p.amount)}`).join(' ');
              const first = pts[0].amount;
              const last = pts[n - 1].amount;
              const diff = last - first;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: '#999' }}>最安 ¥{minA.toLocaleString()} / 最高 ¥{maxA.toLocaleString()}</span>
                    <span style={{ color: diff > 0 ? '#E74C3C' : diff < 0 ? '#27AE60' : '#999', fontWeight: 700 }}>
                      {diff > 0 ? `▲¥${diff.toLocaleString()}` : diff < 0 ? `▼¥${Math.abs(diff).toLocaleString()}` : '横ばい'}
                    </span>
                  </div>
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    <polyline points={linePts} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={xFor(i)} cy={yFor(p.amount)} r="3" fill="#3B82F6" />
                        <text x={xFor(i)} y={yFor(p.amount) - 6} textAnchor="middle" fontSize="9" fill="#666" fontWeight="600">¥{p.amount}</text>
                        <text x={xFor(i)} y={H - 2} textAnchor="middle" fontSize="8" fill="#aaa">
                          {p.date.slice(5).replace('-', '/')}
                        </text>
                      </g>
                    ))}
                  </svg>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {!hasReceiptData && (
        <div className="summary-section">
          <div className="card" style={{ textAlign: 'center', padding: 24, color: '#999', fontSize: 13 }}>
            レシートから登録したデータがまだありません。<br />
            レシートを読み取ると、よく行く店や<br />よく買うものが分析できます。
          </div>
        </div>
      )}

      {/* よく行く店 */}
      {stores.length > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">🏪 よく行く店</h3>
            {stores.map((s, i) => (
              <div key={s.store} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <div className="rank-main">
                  <div className="rank-name">{s.store}</div>
                  <div className="rank-sub">{s.visits}回 ・ {s.itemCount}品</div>
                </div>
                <div className="rank-amount">¥{s.total.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* よく買うもの */}
      {items.length > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">🛒 よく買うもの</h3>
            {items.map((it, i) => (
              <div key={it.name} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <div className="rank-main">
                  <div className="rank-name">
                    {it.category && findCat(it.category)?.icon ? `${findCat(it.category)!.icon} ` : ''}{it.name}
                  </div>
                  <div className="rank-sub">{it.count}回</div>
                </div>
                <div className="rank-amount">¥{it.total.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* よく食べるもの */}
      {foods.length > 0 && (
        <div className="summary-section">
          <div className="card">
            <h3 className="section-title">🍽️ よく食べるもの</h3>
            {foods.map((it, i) => (
              <div key={it.name} className="rank-row">
                <span className="rank-num">{i + 1}</span>
                <div className="rank-main">
                  <div className="rank-name">{it.name}</div>
                  <div className="rank-sub">{it.count}回</div>
                </div>
                <div className="rank-amount">¥{it.total.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
