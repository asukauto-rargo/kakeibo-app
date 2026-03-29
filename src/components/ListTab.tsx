import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ALL_CATS, findCatByName } from '../constants';
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

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => entry.date?.startsWith(currentMonth))
      .filter((entry) => selectedUser === '全員' || entry.user_name === selectedUser)
      .filter((entry) => {
        if (selectedType === '全種類') return true;
        return selectedType === '支出' ? entry.type === 'expense' : entry.type === 'income';
      })
      .filter((entry) => selectedCategory === '全カテゴリ' || entry.category === selectedCategory)
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
    if (userName === settings.user1Name) return '#3498DB';
    if (userName === settings.user2Name) return '#E91E63';
    if (userName === settings.user3Name) return '#9B59B6';
    return '#999';
  };

  const getCategoryIcon = (category: string) => {
    const cat = findCatByName(category);
    return cat?.icon || '📌';
  };

  return (
    <div className="list-tab">
      <div className="filter-section">
        <div className="filter-grid">
          <div>
            <label>ユーザー</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label>種類</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="full-width">
            <label>カテゴリ</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="全カテゴリ">全カテゴリ</option>
              {ALL_CATS.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>日付</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
          <div>
            <button onClick={() => setSelectedDate('')} className="btn-secondary">日付クリア</button>
          </div>
        </div>
      </div>

      <div className="entries-list">
        {filteredEntries.length === 0 ? (
          <div className="empty-state"><span>📊 データがありません</span></div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="entry-item">
              <div className="entry-left">
                <span className="entry-icon">{getCategoryIcon(entry.category)}</span>
                <div className="entry-info">
                  <div className="entry-category">{entry.category}</div>
                  {entry.memo && <div className="entry-memo">{entry.memo}</div>}
                </div>
              </div>
              <div className="entry-right">
                <div className="entry-meta">
                  <span className="user-badge" style={{ backgroundColor: getUserBadgeColor(entry.user_name) }}>
                    {entry.user_name}
                  </span>
                  <span className="entry-date">{entry.date}</span>
                  {entry.is_fixed && <span className="badge-fixed">固定</span>}
                </div>
                <div className="entry-amount-row">
                  <span className={`entry-amount ${entry.type === 'expense' ? 'expense' : 'income'}`}>
                    {entry.type === 'expense' ? '-' : '+'} ¥{entry.amount.toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleDeleteClick(entry.id)}
                    className={`btn-delete ${deleteConfirm?.id === entry.id ? 'confirming' : ''}`}
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
