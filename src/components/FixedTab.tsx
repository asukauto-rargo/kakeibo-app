import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATS, findCatByName } from '../constants';
import type { FixedExpense, Settings } from '../types';

interface FixedTabProps {
  fixedExpenses: FixedExpense[];
  settings: Settings;
  onFixedAdded: (fe: FixedExpense) => void;
  onFixedDeleted: (id: string) => void;
}

export default function FixedTab({
  fixedExpenses,
  settings,
  onFixedAdded,
  onFixedDeleted,
}: FixedTabProps) {
  const [category, setCategory] = useState<string>(EXPENSE_CATS[0]?.name || '');
  const [amount, setAmount] = useState<string>('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [userName, setUserName] = useState<string>(settings.user1Name || 'ユーザー1');
  const [memo, setMemo] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const userOptions = [settings.user1Name || 'ユーザー1', settings.user2Name || 'ユーザー2', settings.user3Name || 'ユーザー3'];
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  const getCategoryIcon = (categoryName: string) => {
    const cat = findCatByName(categoryName);
    return cat?.icon || '📌';
  };

  const handleAddFixed = async () => {
    if (!category || !amount || !userName) {
      alert('すべてのフィールドを入力してください');
      return;
    }

    const newFixedExpense = {
      type: 'expense' as const,
      category,
      amount: parseInt(amount),
      day_of_month: dayOfMonth,
      user_name: userName,
      memo: memo || '',
      is_active: true,
    };

    const { data, error } = await supabase
      .from('fixed_expenses')
      .insert([newFixedExpense])
      .select();

    if (error) {
      console.error('Error adding fixed expense:', error);
      return;
    }

    if (data && data.length > 0) {
      onFixedAdded(data[0]);
    }

    setCategory(EXPENSE_CATS[0]?.name || '');
    setAmount('');
    setDayOfMonth(1);
    setUserName(settings.user1Name || 'ユーザー1');
    setMemo('');
  };

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
    await supabase.from('fixed_expenses').delete().eq('id', id);
    onFixedDeleted(id);
  };

  return (
    <div className="fixed-tab">
      <div className="fixed-form">
        <div className="form-grid">
          <div>
            <label>カテゴリ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATS.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>金額</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label>日付</label>
            <select value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value))}>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
          </div>
          <div>
            <label>ユーザー</label>
            <select value={userName} onChange={(e) => setUserName(e.target.value)}>
              {userOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="full-width">
            <label>メモ</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ（任意）" />
          </div>
          <div className="full-width">
            <button onClick={handleAddFixed} className="btn-add">追加</button>
          </div>
        </div>
      </div>

      <div className="fixed-list">
        {fixedExpenses.length === 0 ? (
          <div className="empty-state"><span>📋 固定費が登録されていません</span></div>
        ) : (
          fixedExpenses.map((fe) => (
            <div key={fe.id} className="fixed-item">
              <div className="fixed-left">
                <span className="fixed-icon">{getCategoryIcon(fe.category)}</span>
                <div className="fixed-info">
                  <div className="fixed-category">{fe.category}</div>
                  {fe.memo && <div className="fixed-memo">{fe.memo}</div>}
                </div>
              </div>
              <div className="fixed-right">
                <div className="fixed-meta">
                  <span className="fixed-day">毎月{fe.day_of_month}日</span>
                  <span className="fixed-user">· {fe.user_name}</span>
                </div>
                <div className="fixed-amount-row">
                  <span className="fixed-amount">¥{fe.amount.toLocaleString()}</span>
                  <button
                    onClick={() => handleDeleteClick(fe.id)}
                    className={`btn-delete ${deleteConfirm?.id === fe.id ? 'confirming' : ''}`}
                  >
                    {deleteConfirm?.id === fe.id ? '削除' : '✕'}
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
