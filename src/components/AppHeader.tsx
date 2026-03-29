import React from 'react';

interface AppHeaderProps {
  currentMonth: string; // YYYY-MM format
  onChangeMonth: (delta: number) => void;
  onLogout: () => void;
}

export default function AppHeader({
  currentMonth,
  onChangeMonth,
  onLogout,
}: AppHeaderProps) {
  const [year, month] = currentMonth.split('-');
  const monthNum = parseInt(month, 10);
  const displayMonth = `${year}年${monthNum}月`;

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="header-title">家計簿</h1>
      </div>

      <div className="header-center">
        <button
          className="month-nav-button"
          onClick={() => onChangeMonth(-1)}
          aria-label="前月"
        >
          ◀
        </button>
        <span className="month-display">{displayMonth}</span>
        <button
          className="month-nav-button"
          onClick={() => onChangeMonth(1)}
          aria-label="翌月"
        >
          ▶
        </button>
      </div>

      <div className="header-right">
        <button className="logout-button" onClick={onLogout}>
          ログアウト
        </button>
      </div>
    </header>
  );
}
