import type { Entry } from '../types';
import { catToName } from '../constants';

/** レシートメモから抽出した個別品目 */
export interface ParsedMemoItem {
  name: string;
  amount: number;
  category: string;
}

/** レシートメモの解析結果 */
export interface ParsedMemo {
  isReceipt: boolean;
  store: string;
  items: ParsedMemoItem[];
}

/**
 * エントリのメモ文字列からレシート情報（店舗名・品目）を抽出する。
 * 形式:
 *   新: 【店舗名 N品】品名 ¥金額 [カテゴリ]｜...
 *   旧: 【レシート N品】品名 ¥金額｜...
 */
export function parseReceiptMemo(memo: string): ParsedMemo {
  if (!memo) return { isReceipt: false, store: '', items: [] };

  // 新形式: 【店舗名 N品】品名 ¥金額 [カテゴリ]｜...
  const matchNew = memo.match(/^【(.+?)\s+(\d+)品】(.+)$/);
  if (matchNew) {
    const store = matchNew[1].trim();
    const content = matchNew[3];
    const items: ParsedMemoItem[] = content.split('｜').map((part) => {
      const m = part.match(/^(.+?)\s*¥([\d,]+)\s*\[(.+?)\]$/);
      if (m) return { name: m[1].trim(), amount: parseInt(m[2].replace(/,/g, ''), 10) || 0, category: m[3].trim() };
      const m2 = part.match(/^(.+?)\s*¥([\d,]+)$/);
      if (m2) return { name: m2[1].trim(), amount: parseInt(m2[2].replace(/,/g, ''), 10) || 0, category: '' };
      return { name: part.trim(), amount: 0, category: '' };
    }).filter((it) => it.name);
    return { isReceipt: true, store: store === 'レシート' ? '' : store, items };
  }

  // 旧形式: 【レシート N品】品名 ¥金額｜...
  const matchOld = memo.match(/^【レシート\s+(\d+)品】(.+)$/);
  if (matchOld) {
    const content = matchOld[2];
    const items: ParsedMemoItem[] = content.split('｜').map((part) => {
      const m = part.match(/^(.+?)\s*¥([\d,]+)$/);
      if (m) return { name: m[1].trim(), amount: parseInt(m[2].replace(/,/g, ''), 10) || 0, category: '' };
      return { name: part.trim(), amount: 0, category: '' };
    }).filter((it) => it.name);
    return { isReceipt: true, store: '', items };
  }

  return { isReceipt: false, store: '', items: [] };
}

/** 店舗の集計結果 */
export interface StoreStat {
  store: string;
  visits: number;      // 訪問回数（レシート枚数）
  total: number;       // 累計支出
  itemCount: number;   // 累計品目数
}

/** 品目の集計結果 */
export interface ItemStat {
  name: string;
  count: number;       // 購入回数
  total: number;       // 累計金額
  category: string;    // 代表カテゴリ
}

/**
 * 品目名の表記ゆれを吸収するための正規化キー。
 * 全角/半角スペース除去・小文字化のみ（過度な正規化はしない）。
 */
function normalizeItemKey(name: string): string {
  return name.replace(/[\s　]/g, '').toLowerCase();
}

/**
 * エントリ配列から店舗ランキングを集計する。
 * レシート由来のエントリ（メモが【店舗名…】形式）と、
 * 通常入力のメモ（店舗名として扱う）の両方を対象にする。
 */
export function aggregateStores(entries: Entry[]): StoreStat[] {
  const map = new Map<string, StoreStat>();

  for (const entry of entries) {
    if (entry.type !== 'expense') continue;
    const parsed = parseReceiptMemo(entry.memo || '');
    let store = '';
    if (parsed.isReceipt && parsed.store) {
      store = parsed.store;
    }
    if (!store) continue; // 店舗名が特定できないものは除外

    const key = normalizeItemKey(store);
    const existing = map.get(key);
    const itemCount = parsed.items.length;
    if (existing) {
      existing.visits += 1;
      existing.total += entry.amount;
      existing.itemCount += itemCount;
    } else {
      map.set(key, { store, visits: 1, total: entry.amount, itemCount });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.visits - a.visits || b.total - a.total);
}

/**
 * エントリ配列から品目ランキングを集計する。
 * onlyFoodがtrueの場合、食費カテゴリの品目のみを対象にする（よく食べるもの）。
 */
export function aggregateItems(entries: Entry[], onlyFood = false): ItemStat[] {
  const map = new Map<string, ItemStat>();

  for (const entry of entries) {
    if (entry.type !== 'expense') continue;
    const parsed = parseReceiptMemo(entry.memo || '');
    if (!parsed.isReceipt) continue;

    for (const item of parsed.items) {
      if (!item.name) continue;
      const catName = item.category ? catToName(item.category) : '';
      if (onlyFood && catName !== '食費') continue;

      const key = normalizeItemKey(item.name);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.total += item.amount;
        if (!existing.category && catName) existing.category = catName;
      } else {
        map.set(key, { name: item.name, count: 1, total: item.amount, category: catName });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count || b.total - a.total);
}

/**
 * 月ごとの支出合計を集計する（推移グラフ用）。
 * 直近 monthsBack ヶ月分を古い順で返す。
 */
export interface MonthlyTotal {
  month: string;   // YYYY-MM
  label: string;   // M月
  total: number;
}

export function aggregateMonthlyTotals(entries: Entry[], currentMonth: string, monthsBack = 6): MonthlyTotal[] {
  const [cy, cm] = currentMonth.split('-').map(Number);
  const result: MonthlyTotal[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(cy, cm - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const total = entries
      .filter((e) => e.type === 'expense' && e.date?.startsWith(monthStr))
      .reduce((sum, e) => sum + e.amount, 0);
    result.push({ month: monthStr, label: `${m}月`, total });
  }

  return result;
}
