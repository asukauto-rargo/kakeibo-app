import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EXPENSE_CATS } from '../constants';
import type { Entry, Settings } from '../types';

interface SettingsTabProps {
  settings: Settings;
  entries: Entry[];
  currentMonth: string;
  onSettingsChanged: (s: Settings) => void;
}

export default function SettingsTab({ settings, entries, currentMonth, onSettingsChanged }: SettingsTabProps) {
  const [user1Name, setUser1Name] = useState(settings.user1Name || '');
  const [user2Name, setUser2Name] = useState(settings.user2Name || '');
  const [user3Name, setUser3Name] = useState(settings.user3Name || '');
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>(
    settings.monthlyTargets || {}
  );
  const [savingNames, setSavingNames] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);

  // Save user names
  const handleSaveNames = async () => {
    setSavingNames(true);
    try {
      const updates = [];
      if (user1Name) updates.push({ key: 'user1Name', value: user1Name });
      if (user2Name) updates.push({ key: 'user2Name', value: user2Name });
      if (user3Name) updates.push({ key: 'user3Name', value: user3Name });

      for (const update of updates) {
        await supabase.from('settings').upsert(update);
      }

      const newSettings = { ...settings, user1Name, user2Name, user3Name };
      onSettingsChanged(newSettings);
      alert('名前を保存しました');
    } catch (error) {
      console.error('Error saving names:', error);
      alert('保存に失敗しました');
    } finally {
      setSavingNames(false);
    }
  };

  // Save monthly targets
  const handleSaveTargets = async () => {
    setSavingTargets(true);
    try {
      await supabase.from('settings').upsert({
        key: 'monthlyTargets',
        value: JSON.stringify(monthlyTargets),
      });

      const newSettings = { ...settings, monthlyTargets };
      onSettingsChanged(newSettings);
      alert('目標を保存しました');
    } catch (error) {
      console.error('Error saving targets:', error);
      alert('保存に失敗しました');
    } finally {
      setSavingTargets(false);
    }
  };

  // CSV export current month
  const handleExportCurrentMonth = () => {
    const monthEntries = entries.filter((e) => e.date.startsWith(currentMonth));
    exportToCSV(monthEntries, `kakeibo_${currentMonth}.csv`);
  };

  // CSV export all
  const handleExportAll = () => {
    exportToCSV(entries, 'kakeibo_all.csv');
  };

  // CSV export helper
  const exportToCSV = (data: Entry[], filename: string) => {
    const BOM = '\uFEFF';
    const headers = ['日付', '種類', 'カテゴリ', '金額', '入力者', 'メモ'];
    const rows = data.map((entry) => [
      entry.date,
      entry.type === 'expense' ? '支出' : '収入',
      entry.category,
      entry.amount,
      entry.user_name || '',
      entry.memo || '',
    ]);

    const csv = BOM + [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTargetChange = (catId: string, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setMonthlyTargets({
      ...monthlyTargets,
      [catId]: numValue,
    });
  };

  return (
    <div className="settings-tab">
      {/* Card 1: User names */}
      <div className="settings-card">
        <h2>ユーザー名</h2>
        <div className="form-group">
          <label>ユーザー1名</label>
          <input
            type="text"
            value={user1Name}
            onChange={(e) => setUser1Name(e.target.value)}
            placeholder="例: 太郎"
            className="text-input"
          />
        </div>
        <div className="form-group">
          <label>ユーザー2名</label>
          <input
            type="text"
            value={user2Name}
            onChange={(e) => setUser2Name(e.target.value)}
            placeholder="例: 花子"
            className="text-input"
          />
        </div>
        <div className="form-group">
          <label>ユーザー3名</label>
          <input
            type="text"
            value={user3Name}
            onChange={(e) => setUser3Name(e.target.value)}
            placeholder="例: 次郎"
            className="text-input"
          />
        </div>
        <button
          onClick={handleSaveNames}
          disabled={savingNames}
          className="save-button"
        >
          {savingNames ? '保存中...' : '名前を保存'}
        </button>
      </div>

      {/* Card 2: Monthly targets */}
      <div className="settings-card">
        <h2>カテゴリ別 月間目標支出額</h2>
        <div className="targets-list">
          {EXPENSE_CATS.map((cat) => (
            <div key={cat.id} className="target-input-row">
              <div className="cat-label">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </div>
              <div className="input-wrapper">
                <input
                  type="number"
                  value={monthlyTargets[cat.id] || ''}
                  onChange={(e) => handleTargetChange(cat.id, e.target.value)}
                  placeholder="0"
                  className="number-input"
                  min="0"
                />
                <span className="input-unit">円</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveTargets}
          disabled={savingTargets}
          className="save-button"
        >
          {savingTargets ? '保存中...' : '目標を保存'}
        </button>
      </div>

      {/* Card 3: Data management */}
      <div className="settings-card">
        <h2>データ管理</h2>
        <div className="export-buttons">
          <button
            onClick={handleExportCurrentMonth}
            className="export-button"
          >
            CSV エクスポート（当月）
          </button>
          <button
            onClick={handleExportAll}
            className="export-button"
          >
            CSV エクスポート（全期間）
          </button>
        </div>
      </div>

      <style>{`
        .settings-tab {
          padding: 16px;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .settings-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .settings-card h2 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          margin-bottom: 8px;
        }

        .text-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
          font-family: inherit;
        }

        .text-input:focus {
          outline: none;
          border-color: #3498DB;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .targets-list {
          margin-bottom: 20px;
        }

        .target-input-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .target-input-row:last-child {
          border-bottom: none;
        }

        .cat-label {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .cat-icon {
          font-size: 20px;
          width: 24px;
          text-align: center;
        }

        .cat-name {
          font-size: 14px;
          color: #333;
          font-weight: 500;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .number-input {
          width: 120px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          text-align: right;
          font-family: inherit;
        }

        .number-input:focus {
          outline: none;
          border-color: #3498DB;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .input-unit {
          font-size: 12px;
          color: #999;
          width: 24px;
        }

        .save-button {
          width: 100%;
          padding: 12px 16px;
          background: #3498DB;
          color: #1a1a1a;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .save-button:hover:not(:disabled) {
          background: #2980B9;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .export-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .export-button {
          padding: 12px 16px;
          background: #3498DB;
          color: #1a1a1a;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .export-button:hover {
          background: #2980B9;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        @media (max-width: 600px) {
          .export-buttons {
            grid-template-columns: 1fr;
          }

          .target-input-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .input-wrapper {
            width: 100%;
          }

          .number-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
