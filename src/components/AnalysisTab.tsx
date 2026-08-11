import { useState, useMemo } from 'react';
import type { Entry, Settings } from '../types';
import { findCat } from '../constants';
import {
  aggregateStores,
  aggregateItems,
  aggregateMonthlyTotals,
} from '../lib/receiptMemo';

interface AnalysisTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
}

type Period = 'month' | 'all';

export default function AnalysisTab({ entries, settings, currentMonth }: AnalysisTabProps) {
  const [period, setPeriod] = useState<Period>('all');

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
