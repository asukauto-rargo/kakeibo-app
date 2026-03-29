import Tesseract from 'tesseract.js';
import type { ParsedReceiptItem } from '../types';
import { guessCategory } from '../constants';

/**
 * レシート画像からテキストを抽出し、品目と金額をパースする
 */
export async function parseReceipt(
  imageFile: File,
  onProgress?: (p: number) => void
): Promise<ParsedReceiptItem[]> {
  const result = await Tesseract.recognize(imageFile, 'jpn+eng', {
    logger: (info) => {
      if (info.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(info.progress * 100));
      }
    },
  });

  const text = result.data.text;
  return extractItems(text);
}

/**
 * OCRテキストから品目・金額ペアを抽出
 *
 * 日本のレシートの代表的パターン:
 *   品目名  ¥1,234
 *   品目名  1,234円
 *   品目名  *1,234
 *   品目名    1234
 */
function extractItems(text: string): ParsedReceiptItem[] {
  const items: ParsedReceiptItem[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 小計・合計・お釣り等は除外
  const skipWords = /小計|合計|税|お預|お釣|クレジット|カード|TOTAL|SUBTOTAL|CHANGE|CASH/i;

  for (const line of lines) {
    if (skipWords.test(line)) continue;

    // パターン: 文字列 + 金額（¥記号あり/なし）
    const match = line.match(
      /(.{2,}?)\s+[¥\\*]?\s?([0-9,]+)\s*円?\s*$/
    );
    if (!match) continue;

    const name = match[1].replace(/[\s　]+$/, '').trim();
    const amountStr = match[2].replace(/,/g, '');
    const amount = parseInt(amountStr, 10);

    if (!name || isNaN(amount) || amount <= 0 || amount > 1_000_000) continue;

    items.push({
      name,
      amount,
      category: guessCategory(name),
    });
  }

  return items;
}
