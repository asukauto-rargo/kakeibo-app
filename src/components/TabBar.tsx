import React from 'react';
import { TabId } from '../types';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'input',
    label: '入力',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
    ),
  },
  {
    id: 'list',
    label: '一覧',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M3 13h8v-2H3v2zm0 4h8v-2H3v2zm0-8h8V7H3v2zm10 0h8V7h-8v2zm0 4h8v-2h-8v2zm0 4h8v-2h-8v2z" />
      </svg>
    ),
  },
  {
    id: 'fixed',
    label: '固定費',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    ),
  },
  {
    id: 'summary',
    label: 'サマリー',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: '設定',
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.38-.28-.59-.17l-2.39 1.83c-.5-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.19.59-1.69.98l-2.39-1.83c-.22-.11-.47-.05-.59.17L2.74 8.87c-.12.21-.08.48.1.62l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.1.62l1.92 3.32c.12.22.37.29.59.17l2.39-1.83c.5.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.19-.59 1.69-.98l2.39 1.83c.22.11.47.05.59-.17l1.92-3.32c.12-.22.07-.48-.1-.62l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
  },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <div className="tab-icon">{tab.icon}</div>
          <div className="tab-label">{tab.label}</div>
        </button>
      ))}
    </nav>
  );
}
