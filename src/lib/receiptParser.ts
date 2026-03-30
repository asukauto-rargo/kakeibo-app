import type { ParsedReceiptItem, ParsedReceiptResult } from '../types';
import { EXPENSE_CATS } from '../constants';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * 半角カタカナ→全角カタカナ変換
 */
function halfToFullKana(str: string): string {
  const kanaMap: Record<string, string> = {
    'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
    'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
    'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
    'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ｦ':'ヲ','ﾝ':'ン',
    'ﾞ':'゛','ﾟ':'゜',
    'ｧ':'ァ','ｨ':'ィ','ｩ':'ゥ','ｪ':'ェ','ｫ':'ォ',
    'ｬ':'ャ','ｭ':'ュ','ｮ':'ョ','ｯ':'ッ',
    'ｰ':'ー',
  };

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = str[i + 1];
    if (kanaMap[ch]) {
      let converted = kanaMap[ch];
      if (next === 'ﾞ' || next === '\u3099') {
        const dakutenMap: Record<string, string> = {
          'カ':'ガ','キ':'ギ','ク':'グ','ケ':'ゲ','コ':'ゴ',
          'サ':'ザ','シ':'ジ','ス':'ズ','セ':'ゼ','ソ':'ゾ',
          'タ':'ダ','チ':'ヂ','ツ':'ヅ','テ':'デ','ト':'ド',
          'ハ':'バ','ヒ':'ビ','フ':'ブ','ヘ':'ベ','ホ':'ボ',
          'ウ':'ヴ',
        };
        if (dakutenMap[converted]) { converted = dakutenMap[converted]; i++; }
      } else if (next === 'ﾟ' || next === '\u309A') {
        const handakutenMap: Record<string, string> = {
          'ハ':'パ','ヒ':'ピ','フ':'プ','ヘ':'ペ','ホ':'ポ',
        };
        if (handakutenMap[converted]) { converted = handakutenMap[converted]; i++; }
      }
      result += converted;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 画像ファイルをJPEG形式に変換する（HEIC/HEIF等の非対応形式対策）
 */
function convertToJpeg(file: File): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 2000;
      let w = img.width;
      let h = img.height;
      if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const base64 = dataUrl.split(',')[1];
      URL.revokeObjectURL(url);
      resolve({ base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました'));
    };
    img.src = url;
  });
}

/**
 * レシート画像をClaude APIで解析し、日付・店舗名・品目と金額をパースする
 */
export async function parseReceipt(
  imageFile: File,
  onProgress?: (p: number) => void
): Promise<ParsedReceiptResult> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_CLAUDE_API_KEY が設定されていません。.env ファイルを確認してください。');
  }

  onProgress?.(10);

  const converted = await convertToJpeg(imageFile);
  const base64 = converted.base64;
  const mediaType = converted.mediaType;

  onProgress?.(20);

  const categoryList = EXPENSE_CATS.map((c) => `${c.name}（${c.icon}）`).join('、');
  const today = new Date().toISOString().split('T')[0];

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
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `あなたは日本のスーパーマーケット・コンビニ・ドラッグストアのレシート読み取りの専門家です。
このレシート画像を注意深く解析し、以下の情報を抽出してください。

## 抽出する情報

### 1. 日付
- レシートに印字されている購入日を YYYY-MM-DD 形式で返してください
- 日付が読み取れない場合は "${today}" を返してください

### 2. 店舗名
- レシートの上部に記載されている店舗名を返してください
- 読み取れない場合は "" を返してください

### 3. 購入品目と金額

#### 品目名の正確な認識
- 半角カタカナ（例：ﾊﾞﾝﾉｳﾈｷﾞ）を全角に変換し、人間が読める商品名にしてください（例：万能ネギ）
- 先頭の管理コード（F、*、@、#等）は除去してください
- 省略された商品名は一般的な名前に補完してください

#### 金額（税込み金額を出力）
- 各品目の**税込み金額**を出力してください
- レシートに税抜き価格しか記載がない場合は、消費税率（8%または10%）を適用して税込み金額を計算してください
  - 軽減税率対象品目（食品・飲料）は8%、それ以外は10%
  - レシートに「*」「※」等の軽減税率マークがある場合はそれに従ってください
- 複数個（×2等）がある場合は合計金額にしてください

#### 割引・値引きの処理
- 割引行（「値引」「割引」「-」で始まるマイナス金額の行）を検出してください
- 割引はその**直前の品目**に適用し、品目の金額から差し引いた金額を出力してください
  - 例: りんご ¥200 → 値引 -¥30 の場合、りんごの金額は ¥170
- 全体割引（クーポン割引等）は、最も金額の大きい品目から差し引いてください
- 割引を適用した結果、金額が0以下になった品目は除外してください

#### 除外行
小計、合計（税込合計含む）、消費税合計、内税、外税、お預かり、お釣り、ポイント、レジ番号、日付行は除外してください。
※ 各品目の税込み単価は出力に含めますが、レシート末尾の「合計」行そのものは除外してください。

### カテゴリ分類ルール
- **食費**: 食品全般（野菜、果物、肉、魚、飲料、菓子、調味料、冷凍食品、惣菜、パン、米、麺類、乳製品、卵、酒類）
- **日用品**: ティッシュ、洗剤、シャンプー、ゴミ袋、ラップ等
- **ペット**: ペットフード、猫砂等
- **医療費**: 薬、マスク等
- **美容代**: 化粧品、スキンケア等
- **勉強代**: 参考書、テキスト、資格関連等
- 迷った場合は「食費」を選んでください

### カテゴリ一覧
${categoryList}

## 出力形式（JSONのみ、説明不要）
{
  "date": "YYYY-MM-DD",
  "storeName": "店舗名",
  "items": [
    {"name": "商品名", "amount": 税込金額, "category": "カテゴリ名"}
  ]
}

重要: amountは必ず割引適用済み・税込みの最終金額にしてください。
読み取れない場合: {"date": "${today}", "storeName": "", "items": []}`,
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
  const text = data.content?.[0]?.text || '{}';

  onProgress?.(90);

  // JSON抽出
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { date: today, storeName: '', items: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    onProgress?.(100);

    const items: ParsedReceiptItem[] = (parsed.items || [])
      .filter((item: ParsedReceiptItem) => item.name && typeof item.amount === 'number' && item.amount > 0)
      .map((item: ParsedReceiptItem) => ({
        ...item,
        name: halfToFullKana(item.name).trim(),
      }));

    // 日付のバリデーション
    let receiptDate = parsed.date || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      receiptDate = today;
    }

    return {
      date: receiptDate,
      storeName: parsed.storeName || '',
      items,
    };
  } catch {
    console.error('Failed to parse Claude response:', text);
    return { date: today, storeName: '', items: [] };
  }
}
