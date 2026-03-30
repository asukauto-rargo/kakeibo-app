import type { ParsedReceiptItem } from '../types';
import { EXPENSE_CATS } from '../constants';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * レシート画像をClaude APIで解析し、品目と金額をパースする
 */
export async function parseReceipt(
  imageFile: File,
  onProgress?: (p: number) => void
): Promise<ParsedReceiptItem[]> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_CLAUDE_API_KEY が設定されていません。.env ファイルを確認してください。');
  }

  onProgress?.(10);

  // 画像をBase64に変換
  const base64 = await fileToBase64(imageFile);
  const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  onProgress?.(20);

  // カテゴリ一覧を生成（IDと名前のペア）
  const categoryList = EXPENSE_CATS.map((c) => `${c.name}（${c.icon}）`).join('、');

  // Claude API に送信
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `あなたはレシート読み取りの専門家です。このレシート画像を注意深く読み取り、購入品目と金額を正確に抽出してください。

## 重要な読み取りルール
- OCRの誤読に注意：数字の0とO、1とl、8とBなどを区別してください
- 金額は必ず正の整数にしてください（小数点以下は四捨五入）
- 値引き・割引行は除外してください
- 「小計」「合計」「税」「消費税」「内税」「外税」「お預かり」「お釣り」「釣銭」行は必ず除外してください
- 品目名が途中で切れている場合は、読み取れる範囲で記載してください
- 同じ品目が複数ある場合（例: ×2）は、1品目の金額に個数を掛けた合計を金額としてください

## 出力形式
以下のJSON配列のみを出力してください。説明文やマークダウンは不要です。

[
  {"name": "品目名（レシートに記載された通り）", "amount": 金額, "category": "カテゴリ名"}
]

## カテゴリ一覧（この中から最も適切なものを選んでください）
${categoryList}

判別に迷う場合は「その他」を選んでください。
レシートが不鮮明で読み取れない場合は空の配列 [] を返してください。`,
            },
          ],
        },
      ],
    }),
  });

  onProgress?.(80);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API エラー: ${response.status} ${errorData?.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';

  onProgress?.(90);

  // JSONを抽出（Claudeがマークダウンコードブロックで囲む場合も対応）
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  try {
    const items: ParsedReceiptItem[] = JSON.parse(jsonMatch[0]);
    onProgress?.(100);
    return items.filter(
      (item) => item.name && typeof item.amount === 'number' && item.amount > 0
    );
  } catch {
    console.error('Failed to parse Claude response:', text);
    return [];
  }
}

/**
 * File → Base64文字列（data: prefix なし）
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
