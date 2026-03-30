import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ALL_CATS, findCat, catToName, CAT_COLORS } from '../constants';
import type { Entry, Settings } from '../types';

interface ListTabProps {
  entries: Entry[];
  settings: Settings;
  currentMonth: string;
  onEntryDeleted: (id: string) => void;
}

export default function ListTab({
  entries,
  settings,
  currentMonth,
  onEntryDeleted,
}: ListTabProps) {
  const [selectedUser, setSelectedUser] = useState<string>('全員');
  const [selectedType, setSelectedType] = useState<string>('全種類');
  const [selectedCategory, setSelectedCategory] = useState<string>('全カテゴリ');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const userOptions = ['全員', settings.user1Name || 'ユーザー1', settings.user2Name || 'ユーザー2', settings.user3Name || 'ユーザー3'];
  const typeOptions = ['全種類', '支出', '収入'];

  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    if (raw === 'user1' || raw === 'ユーザー1') return settings.user1Name || 'ユーザー1';
    if (raw === 'user2' || raw === 'ユーザー2') return settings.user2Name || 'ユーザー2';
    if (raw === 'user3' || raw === 'ユーザー3') return settings.user3Name || 'ユーザー3';
    return raw;
  };

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => entry.date?.startsWith(currentMonth))
      .filter((entry) => {
        if (selectedUser === '全員') return true;
        return resolveUserName(entry.user_name) === selectedUser;
      })
      .filter((entry) => {
        if (selectedType === '全種類') return true;
        return selectedType === '支出' ? entry.type === 'expense' : entry.type === 'income';
      })
      .filter((entry) => {
        if (selectedCategory === '全カテゴリ') return true;
        return catToName(entry.category) === selectedCategory;
      })
      .filter((entry) => !selectedDate || entry.date === selectedDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, currentMonth, selectedUser, selectedType, selectedCategory, selectedDate]);

  const handleDeleteClick = (id: string) => {
    if (deleteConfirm?.id === id) {
      confirmDelete(id);
    } else {
      if (deleteConfirm?.timer) clearTimeout(deleteConfirm.timer);
      const timer = setTimeout(() => setDeleteConfirm(null), 3000);
      setDeleteConfirm({ id, timer });
    }
  };

  const confirmDelete = async (id: string) => {
    if (deleteConfirm?.timer) clearTimeout(deleteConfirm.timer);
    setDeleteConfirm(null);
    await supabase.from('entries').delete().eq('id', id);
    onEntryDeleted(id);
  };

  const getUserBadgeColor = (userName: string) => {
    const resolved = resolveUserName(userName);
    if (resolved === settings.user1Name) return '#3B82F6';
    if (resolved === settings.user2Name) return '#EF4444';
    if (resolved === settings.user3Name) return '#8B5CF6';
    return '#999';
  };

  const getCategoryIcon = (category: string) => findCat(category)?.icon || '📦';
  const getCategoryColor = (category: string) => {
    const cat = findCat(category);
    return cat ? (CAT_COLORS[cat.id] || '#999') : '#999';
  };

  /** レシート登録のメモから詳細アイテムを抽出 */
  const parseReceiptMemo = (memo: string): {
    isReceipt: boolean;
    label: string;
    items: { name: string; amount: string; category: string }[];
  } => {
    // 新形式: 【店舗名 N品】品名 ¥金額 [カテゴリ]｜...
    const matchNew = memo.match(/^【(.+?)\s+(\d+)品】(.+)$/);
    if (matchNew) {
      const label = matchNew[1];
      const content = matchNew[3];
      const items = content.split('｜').map((part) => {
        const m = part.match(/^(.+?)\s*¥([\d,]+)\s*\[(.+?)\]$/);
        if (m) return { name: m[1], amount: `¥${m[2]}`, category: m[3] };
        // 旧形式fallback（カテゴリなし）
        const m2 = part.match(/^(.+?)\s*¥([\d,]+)$/);
        if (m2) return { name: m2[1], amount: `¥${m2[2]}`, category: '' };
        return { name: part, amount: '', category: '' };
      }).filter((it) => it.name);
      return { isReceipt: true, label, items };
    }

    // 旧形式: 【レシート N品】品名 ¥金額｜...
    const matchOld = memo.match(/^【レシート\s+(\d+)品】(.+)$/);
    if (matchOld) {
      const content = matchOld[2];
      const items = content.split('｜').map((part) => {
        const m = part.match(/^(.+?)\s*¥([\d,]+)$/);
        if (m) return { name: m[1], amount: `¥${m[2]}`, category: '' };
        return { name: part, amount: '', category: '' };
      }).filter((it) => it.name);
      return { isReceipt: true, label: 'レシート', items };
    }

    return { isReceipt: false, label: '', items: [] };
  };

  return (
    <div className="list-tab card">
      {/* Filter Section */}
      <div className="filter-group">
        <div className="filter-row" style={{ marginBottom: 4 }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 3 }}>入力者</div>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%' }}
            >
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 3 }}>種類</div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%' }}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-row" style={{ marginBottom: 4 }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 3 }}>カテゴリ</div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="全カテゴリ">全カテゴリ</option>
              {ALL_CATS.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="filter-label" style={{ marginBottom: 3 }}>日付</div>
            {!showDatePicker && !selectedDate ? (
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="date-filter-btn"
              >
                全期間
              </button>
            ) : (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (!e.target.value) setShowDatePicker(false);
                }}
                style={{ width: '100%' }}
                autoFocus={showDatePicker && !selectedDate}
              />
            )}
          </div>
        </div>
        {(selectedDate || showDatePicker) && (
          <button
            onClick={() => { setSelectedDate(''); setShowDatePicker(false); }}
            className="btn-secondary"
            style={{ marginBottom: 8 }}
          >
            全期間に戻す
          </button>
        )}
      </div>

      {/* Entry List */}
      <div className="entry-list">
        {filteredEntries.length === 0 ? (
          <div className="empty-state">データがありません</div>
        ) : (
          filteredEntries.map((entry) => {
            const receiptInfo = parseReceiptMemo(entry.memo);
            const isExpanded = expandedEntryId === entry.id;

            return (
              <div key={entry.id} className="entry-card-wrap">
                <div
                  className="entry-item"
                  onClick={receiptInfo.isReceipt ? () => setExpandedEntryId(isExpanded ? null : entry.id) : undefined}
                  style={receiptInfo.isReceipt ? { cursor: 'pointer' } : undefined}
                >
                  <div
                    className="entry-icon"
                    style={{
                      backgroundColor: `${getCategoryColor(entry.category)}15`,
                      color: getCategoryColor(entry.category),
                    }}
                  >
                    {receiptInfo.isReceipt ? '🧾' : getCategoryIcon(entry.category)}
                  </div>

                  <div className="entry-detail">
                    <div className="entry-cat">
                      {receiptInfo.isReceipt ? receiptInfo.label : catToName(entry.category)}
                      {receiptInfo.isReceipt && (
                        <span style={{ fontSize: 10, color: '#999', marginLeft: 4, fontWeight: 400 }}>
                          {receiptInfo.items.length}品 {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    {entry.memo && !receiptInfo.isReceipt && (
                      <div className="entry-memo">{entry.memo}</div>
                    )}
                  </div>

                  <div className="entry-right-section">
                    <div className="entry-meta">
                      <span className="user-badge" style={{ backgroundColor: getUserBadgeColor(entry.user_name) }}>
                        {resolveUserName(entry.user_name)}
                      </span>
                      <span className="entry-date">{entry.date}</span>
                      {entry.is_fixed && <span className="fixed-badge">固定</span>}
                    </div>
                    <div className="entry-amount-section">
                      <span className={`entry-amount ${entry.type === 'expense' ? 'expense' : 'income'}`}>
                        {entry.type === 'expense' ? '-' : '+'} ¥{entry.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.id); }}
                        className={`entry-del ${deleteConfirm?.id === entry.id ? 'confirming' : ''}`}
                      >
                        {deleteConfirm?.id === entry.id ? '削除' : '✕'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable receipt detail */}
                {receiptInfo.isReceipt && isExpanded && (
                  <div className="receipt-detail-expand">
                    {receiptInfo.items.map((it, idx) => (
                      <div key={idx} className="receipt-detail-row">
                        <span className="receipt-detail-name">
                          {it.category && (
                            <span style={{ fontSize: 10, color: '#aaa', marginRight: 4 }}>
                              {findCat(it.category)?.icon || ''}
                            </span>
                          )}
                          {it.name}
                        </span>
                        <span className="receipt-detail-amount">{it.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
