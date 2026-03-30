import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ALL_CATS, findCat, catToName, catToId, CAT_COLORS } from '../constants';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const userOptions = ['全員', settings.user1Name || 'ユーザー1', settings.user2Name || 'ユーザー2', settings.user3Name || 'ユーザー3'];
  const typeOptions = ['全種類', '支出', '収入'];

  /** user_name を設定の表示名にマッピング */
  const resolveUserName = (raw: string) => {
    if (!raw) return '';
    // すでに設定名と一致すればそのまま
    if (raw === settings.user1Name || raw === settings.user2Name || raw === settings.user3Name) return raw;
    // user1 / user2 / user3 パターン
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
        const entryName = catToName(entry.category);
        return entryName === selectedCategory;
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
    if (resolved === settings.user1Name) return '#555';
    if (resolved === settings.user2Name) return '#888';
    if (resolved === settings.user3Name) return '#aaa';
    return '#999';
  };

  const getCategoryIcon = (category: string) => {
    const cat = findCat(category);
    return cat?.icon || '📦';
  };

  const getCategoryColor = (category: string) => {
    const cat = findCat(category);
    if (!cat) return '#999';
    return CAT_COLORS[cat.id] || '#999';
  };

  return (
    <div className="list-tab card">
      {/* Filter Row */}
      <div className="filter-row">
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          {userOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="全カテゴリ">全カテゴリ</option>
          {ALL_CATS.map((cat) => (
            <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <button
          onClick={() => setSelectedDate('')}
          className="btn-secondary"
        >
          日付クリア
        </button>
      </div>

      {/* Entry List */}
      <div className="entry-list">
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <span>データがありません</span>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="entry-item">
              {/* Entry Icon */}
              <div
                className="entry-icon"
                style={{
                  backgroundColor: `${getCategoryColor(entry.category)}18`,
                  color: getCategoryColor(entry.category),
                }}
              >
                {getCategoryIcon(entry.category)}
              </div>

              {/* Entry Detail */}
              <div className="entry-detail">
                <div className="entry-cat">{catToName(entry.category)}</div>
                {entry.memo && <div className="entry-memo">{entry.memo}</div>}
              </div>

              {/* Right Section */}
              <div className="entry-right-section">
                {/* Meta Information */}
                <div className="entry-meta">
                  <span
                    className="user-badge"
                    style={{ backgroundColor: getUserBadgeColor(entry.user_name) }}
                  >
                    {resolveUserName(entry.user_name)}
                  </span>
                  <span className="entry-date">{entry.date}</span>
                  {entry.is_fixed && <span className="fixed-badge">固定</span>}
                </div>

                {/* Amount and Delete */}
                <div className="entry-amount-section">
                  <span className={`entry-amount ${entry.type === 'expense' ? 'expense' : 'income'}`}>
                    {entry.type === 'expense' ? '-' : '+'} ¥{entry.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteClick(entry.id)}
                    className={`entry-del ${deleteConfirm?.id === entry.id ? 'confirming' : ''}`}
                  >
                    {deleteConfirm?.id === entry.id ? '削除' : '✕'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
