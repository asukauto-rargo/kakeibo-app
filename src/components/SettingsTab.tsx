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

export default function SettingsTab({ settings, onSettingsChanged }: SettingsTabProps) {
  const [user1Name, setUser1Name] = useState(settings.user1Name || '');
  const [user2Name, setUser2Name] = useState(settings.user2Name || '');
  const [user3Name, setUser3Name] = useState(settings.user3Name || '');
  const [monthlyTargets, setMonthlyTargets] = useState<Record<string, number>>(
    settings.monthlyTargets || {}
  );
  const [savingNames, setSavingNames] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);

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

  const handleTargetChange = (catId: string, value: string) => {
    const numValue = parseInt(value, 10) || 0;
    setMonthlyTargets({ ...monthlyTargets, [catId]: numValue });
  };

  return (
    <div className="settings-tab">
      {/* User names */}
      <div className="settings-card">
        <h2>ユーザー名</h2>
        <div className="settings-form-group">
          <label>ユーザー1</label>
          <input
            type="text"
            value={user1Name}
            onChange={(e) => setUser1Name(e.target.value)}
            placeholder="例: 太郎"
            className="settings-input"
            style={{ borderLeft: '3px solid #3B82F6' }}
          />
        </div>
        <div className="settings-form-group">
          <label>ユーザー2</label>
          <input
            type="text"
            value={user2Name}
            onChange={(e) => setUser2Name(e.target.value)}
            placeholder="例: 花子"
            className="settings-input"
            style={{ borderLeft: '3px solid #EF4444' }}
          />
        </div>
        <div className="settings-form-group">
          <label>ユーザー3</label>
          <input
            type="text"
            value={user3Name}
            onChange={(e) => setUser3Name(e.target.value)}
            placeholder="例: 次郎"
            className="settings-input"
            style={{ borderLeft: '3px solid #8B5CF6' }}
          />
        </div>
        <button
          onClick={handleSaveNames}
          disabled={savingNames}
          className="settings-btn"
        >
          {savingNames ? '保存中...' : '名前を保存'}
        </button>
      </div>

      {/* Monthly targets */}
      <div className="settings-card">
        <h2>カテゴリ別 月間目標</h2>
        <div className="targets-list">
          {EXPENSE_CATS.map((cat) => (
            <div key={cat.id} className="target-input-row">
              <div className="cat-label">
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label-text">{cat.name}</span>
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
          className="settings-btn"
        >
          {savingTargets ? '保存中...' : '目標を保存'}
        </button>
      </div>

      <style>{`
        .settings-tab {
          padding: 0;
        }
        .settings-card {
          background: white;
          padding: 18px;
          border-radius: 10px;
          margin-bottom: 10px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(0,0,0,0.04);
        }
        .settings-card h2 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .settings-form-group {
          margin-bottom: 12px;
        }
        .settings-form-group label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #999;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .settings-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e5ea;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        .settings-input:focus {
          outline: none;
          border-color: #555;
        }
        .targets-list {
          margin-bottom: 16px;
        }
        .target-input-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
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
          font-size: 18px;
          width: 22px;
          text-align: center;
        }
        .cat-label-text {
          font-size: 13px;
          color: #333;
          font-weight: 500;
        }
        .input-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .number-input {
          width: 100px;
          padding: 6px 8px;
          border: 1px solid #e2e5ea;
          border-radius: 6px;
          font-size: 13px;
          text-align: right;
          font-family: inherit;
        }
        .number-input:focus {
          outline: none;
          border-color: #555;
        }
        .input-unit {
          font-size: 11px;
          color: #999;
          width: 20px;
        }
        .settings-btn {
          width: 100%;
          padding: 11px 16px;
          background: #1a1a1a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .settings-btn:hover:not(:disabled) {
          background: #333;
        }
        .settings-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        @media (max-width: 600px) {
          .target-input-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
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
