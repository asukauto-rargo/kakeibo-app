import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import type { Entry, FixedExpense, Settings, TabId } from './types';
import LoginScreen from './components/LoginScreen';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import InputTab from './components/InputTab';
import ListTab from './components/ListTab';
import FixedTab from './components/FixedTab';
import SummaryTab from './components/SummaryTab';
import SettingsTab from './components/SettingsTab';
import './App.css';

const DEFAULT_SETTINGS: Settings = {
  user1Name: 'ユーザー1',
  user2Name: 'ユーザー2',
  user3Name: 'ユーザー3',
  monthlyTargets: {},
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('input');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');

  // ── Auth check ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
      } else {
        setLoading(false);
      }
    });
  }, []);

  // ── Load data after login ──
  useEffect(() => {
    if (!loggedIn) return;
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.from('entries').select('*').order('date', { ascending: false }),
        supabase.from('fixed_expenses').select('*').order('day_of_month'),
        supabase.from('settings').select('*'),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (r3.error) throw r3.error;

      setEntries(r1.data ?? []);
      setFixedExpenses(r2.data ?? []);

      // Parse settings
      const s = { ...DEFAULT_SETTINGS };
      let hasTargets = false;
      for (const row of r3.data ?? []) {
        if (row.key === 'monthlyTargets') {
          try { s.monthlyTargets = JSON.parse(row.value); hasTargets = true; } catch { /* */ }
        } else if (row.key === 'budgets' && !hasTargets) {
          try { s.monthlyTargets = JSON.parse(row.value); } catch { /* */ }
        } else if (row.key === 'user1Name') s.user1Name = row.value;
        else if (row.key === 'user2Name') s.user2Name = row.value;
        else if (row.key === 'user3Name') s.user3Name = row.value;
      }
      setSettings(s);

      // Auto-record fixed expenses
      await autoRecordFixed(r1.data ?? [], r2.data ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-record fixed expenses ──
  async function autoRecordFixed(currentEntries: Entry[], fe: FixedExpense[]) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;
    const lastDay = new Date(y, m + 1, 0).getDate();

    for (const f of fe) {
      if (!f.is_active) continue;
      const actualDay = Math.min(f.day_of_month, lastDay);
      if (d < actualDay) continue;
      const exists = currentEntries.some(
        (e) => e.fixed_expense_id === f.id && e.date?.startsWith(monthStr)
      );
      if (exists) continue;

      const dateStr = `${monthStr}-${String(actualDay).padStart(2, '0')}`;
      const newEntry = {
        type: f.type || 'expense',
        category: f.category,
        amount: f.amount,
        memo: `${f.memo || ''}（自動）`,
        date: dateStr,
        user_name: f.user_name,
        is_fixed: true,
        fixed_expense_id: f.id,
      };
      const res = await supabase.from('entries').insert(newEntry).select();
      if (res.data?.[0]) {
        setEntries((prev) => [res.data![0], ...prev]);
      }
    }
  }

  // ── Month navigation (fixed) ──
  function changeMonth(delta: number) {
    setCurrentMonth((prev) => {
      const [y, m] = prev.split('-').map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }

  // ── Handlers ──
  function handleEntryAdded(entry: Entry) {
    setEntries((prev) => [entry, ...prev]);
  }
  function handleEntryDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }
  function handleFixedAdded(fe: FixedExpense) {
    setFixedExpenses((prev) => [...prev, fe]);
  }
  function handleFixedDeleted(id: string) {
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  }
  function handleLogout() {
    supabase.auth.signOut().then(() => {
      setLoggedIn(false);
      setEntries([]);
      setFixedExpenses([]);
      setSettings(DEFAULT_SETTINGS);
    });
  }

  // ── Render ──
  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <div style={{ color: '#95A5A6', fontSize: 14 }}>データを読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-overlay">
        <div style={{ textAlign: 'center', padding: 20, color: '#E74C3C' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>&#9888;&#65039;</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>接続エラー</div>
          <div style={{ fontSize: 13, color: '#666', maxWidth: 300 }}>
            Supabaseとの接続に失敗しました。<br />.envの設定を確認してください。
            <br /><br />
            <span style={{ color: '#999', fontSize: 11 }}>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader
        currentMonth={currentMonth}
        onChangeMonth={changeMonth}
        onLogout={handleLogout}
      />

      <button className="refresh-btn" onClick={loadAllData} title="データを更新">
        &#8635;
      </button>

      <div className="tab-panels">
        {activeTab === 'input' && (
          <InputTab
            settings={settings}
            currentMonth={currentMonth}
            entries={entries}
            onEntryAdded={handleEntryAdded}
          />
        )}
        {activeTab === 'list' && (
          <ListTab
            entries={entries}
            settings={settings}
            currentMonth={currentMonth}
            onEntryDeleted={handleEntryDeleted}
          />
        )}
        {activeTab === 'fixed' && (
          <FixedTab
            fixedExpenses={fixedExpenses}
            settings={settings}
            onFixedAdded={handleFixedAdded}
            onFixedDeleted={handleFixedDeleted}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryTab
            entries={entries}
            settings={settings}
            currentMonth={currentMonth}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            entries={entries}
            currentMonth={currentMonth}
            onSettingsChanged={setSettings}
          />
        )}
      </div>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
