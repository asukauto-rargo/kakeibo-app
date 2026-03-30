export interface Entry {
  id: string;
  type: 'expense' | 'income';
  category: string;
  amount: number;
  memo: string;
  date: string;
  user_name: string;
  is_fixed: boolean;
  fixed_expense_id?: string | null;
  receipt_url?: string | null;
  created_at?: string;
}

export interface FixedExpense {
  id: string;
  type: 'expense' | 'income';
  category: string;
  amount: number;
  memo: string;
  day_of_month: number;
  user_name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Settings {
  user1Name: string;
  user2Name: string;
  user3Name: string;
  monthlyTargets: Record<string, number>;
}

export interface ParsedReceiptItem {
  name: string;
  amount: number;
  category: string;
}

/** レシートOCRの結果全体 */
export interface ParsedReceiptResult {
  date: string;            // レシートから読み取った日付 (YYYY-MM-DD)
  storeName: string;       // 店舗名
  items: ParsedReceiptItem[];
}

export type TabId = 'input' | 'list' | 'fixed' | 'summary' | 'settings';
