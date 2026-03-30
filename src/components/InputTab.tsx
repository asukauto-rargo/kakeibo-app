import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATS, INCOME_CATS } from '../constants';
import type { Entry, Settings, ParsedReceiptItem } from '../types';
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

  const handleReceiptRegistered = async (result: {
    user: string;
    date: string;
    memo: string;
    items: ParsedReceiptItem[];
    receiptStoragePath?: string;
  }) => {
    setShowReceiptUpload(false);
    setIsLoading(true);

    try {
      // レシート全体を1つのエントリとして登録
      // 合計金額を計算
      const totalAmount = result.items.reduce((sum, it) => sum + it.amount, 0);

      // 品目の詳細をメモに格納
      const detailLines = result.items.map((it) =>
        `${it.name} ¥${it.amount.toLocaleString()} [${it.category}]`
      ).join('｜');

      const receiptLabel = result.memo || 'レシート';
      const memoStr = `【${receiptLabel} ${result.items.length}品】${detailLines}`;

      // 最も金額が大きいカテゴリを代表カテゴリにする
      const catTotals: Record<string, number> = {};
      for (const item of result.items) {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
      }
      const mainCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '食費';

      const newEntry = {
        user_name: result.user,
        type: 'expense' as const,
        category: mainCategory,
        amount: totalAmount,
        memo: memoStr,
        date: result.date,
        ...(result.receiptStoragePath ? { receipt_url: result.receiptStoragePath } : {}),
      };

      // まずreceipt_url付きで試す。カラムがなければreceipt_urlなしで再試行
      let insertResult = await supabase
        .from('entries')
        .insert([newEntry])
        .select();

      if (insertResult.error && result.receiptStoragePath) {
        // receipt_urlカラムが存在しない場合、除外して再試行
        const { receipt_url: _unused, ...entryWithoutReceipt } = newEntry;
        void _unused;
        insertResult = await supabase
          .from('entries')
          .insert([entryWithoutReceipt])
          .select();
      }

      const { data, error } = insertResult;

      if (error) throw error;

      if (data) {
        data.forEach((entry) => onEntryAdded(entry as Entry));
        showToast(`レシート（${result.items.length}品）を登録しました`);
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
          settings={settings}
          currentUser={currentUser}
          currentDate={date}
          onReceiptRegistered={handleReceiptRegistered}
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
