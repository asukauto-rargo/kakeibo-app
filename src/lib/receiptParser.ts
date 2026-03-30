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

  // カテゴリ一覧を生成
  const categoryList = EXPENSE_CATS.map((c) => c.name).join(', ');

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
      max_tokens: 1024,
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
              text: `このレシート画像から、購入品目と金額を読み取ってください。

以下のJSON形式で出力してください。JSONのみを出力し、説明文は不要です。

[
  {"name": "品目名", "amount": 金額（数値）, "category": "カテゴリ名"}
]

カテゴリは以下から最も適切なものを選んでください：
${categoryList}

注意：
- 小計、合計、税、お預かり、お釣りなどは除外してください
- 金額は正の整数で記載してください
- 品目名はレシートに記載されている通りに記載してください
- レシートが読み取れない場合は空の配列 [] を返してください`,
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
      // "data:image/png;base64,..." から base64 部分だけ取り出す
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
