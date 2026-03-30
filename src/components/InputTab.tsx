import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATS, INCOME_CATS } from '../constants';
import type { Entry, Settings } from '../types';
import ReceiptUpload from './ReceiptUpload';

interface InputTabProps {
  settings: Settings;
  currentMonth: string;
  entries: Entry[];
  onEntryAdded: (entry: Entry) => void;
}

type TransactionType = 'expense' | 'income';

export default function InputTab({
  settings,
  currentMonth,
  entries,
  onEntryAdded,
}: InputTabProps) {
  const userNames = [
    settings.user1Name || 'ユーザー1',
    settings.user2Name || 'ユーザー2',
    settings.user3Name || 'ユーザー3',
  ];

  const [currentUser, setCurrentUser] = useState<string>(userNames[0]);
  const [currentType, setCurrentType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const categories = currentType === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCategory || !amount) {
      showToast('カテゴリと金額を入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const newEntry = {
        user_name: currentUser,
        type: currentType,
        category: selectedCategory,
        amount: parseFloat(amount),
        memo: memo || '',
        date,
      };

      const { data, error } = await supabase
        .from('entries')
        .insert([newEntry])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        onEntryAdded(data[0] as Entry);
        setSelectedCategory(null);
        setAmount('');
        setMemo('');
        setDate(new Date().toISOString().split('T')[0]);
        showToast('登録しました');
      }
    } catch (error) {
      console.error('Error adding entry:', error);
      showToast('登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemsParsed = async (items: { name: string; amount: number; category: string }[]) => {
    setShowReceiptUpload(false);
    setIsLoading(true);

    try {
      const newEntries = items.map((item) => ({
        user_name: currentUser,
        type: 'expense' as const,
        category: item.category,
        amount: item.amount,
        memo: item.name,
        date,
      }));

      const { data, error } = await supabase
        .from('entries')
        .insert(newEntries)
        .select();

      if (error) throw error;

      if (data) {
        data.forEach((entry) => onEntryAdded(entry as Entry));
        showToast(`レシートから ${data.length} 件登録しました`);
      }
    } catch (error) {
      console.error('Error adding receipt items:', error);
      showToast('レシート登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="input-tab">
      {showReceiptUpload && (
        <ReceiptUpload
          currentUser={currentUser}
          currentDate={date}
          onItemsParsed={handleItemsParsed}
          onClose={() => setShowReceiptUpload(false)}
        />
      )}

      {toast && <div className="toast show">{toast}</div>}

      <form onSubmit={handleSubmit}>
        {/* User Selection */}
        <div className="card">
          <div className="card-title">入力者</div>
          <div className="user-toggle">
            {userNames.map((name, i) => (
              <button
                key={name}
                type="button"
                onClick={() => setCurrentUser(name)}
                className={`user-toggle-btn ${currentUser === name ? `active-user${i + 1}` : ''}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Type Selection */}
        <div className="card">
          <div className="card-title">種類</div>
          <div className="type-toggle">
            <button
              type="button"
              onClick={() => { setCurrentType('expense'); setSelectedCategory(null); }}
              className={`type-toggle-btn ${currentType === 'expense' ? 'active-expense' : ''}`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => { setCurrentType('income'); setSelectedCategory(null); }}
              className={`type-toggle-btn ${currentType === 'income' ? 'active-income' : ''}`}
            >
              収入
            </button>
          </div>
        </div>

        {/* Category Grid */}
        <div className="card">
          <div className="card-title">カテゴリ</div>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`category-grid-btn ${selectedCategory === cat.name ? 'selected' : ''}`}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount, Memo, Date - compact */}
        <div className="card">
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label>金額</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="form-input"
            />
          </div>
          <div className="compact-fields">
            <div className="form-group">
              <label>メモ</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="任意"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>日付</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className={`submit-btn ${currentType}`}
        >
          {isLoading ? '保存中...' : '登録'}
        </button>

        {/* Receipt */}
        <button
          type="button"
          onClick={() => setShowReceiptUpload(true)}
          className="receipt-btn"
        >
          レシートから入力
        </button>
      </form>
    </div>
  );
}
