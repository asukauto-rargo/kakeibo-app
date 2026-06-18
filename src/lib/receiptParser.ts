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
      model: 'claude-sonnet-4-6',
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
              text: `あなたは日本のレシート読み取りの専門家です。このレシート画像を正確に解析してください。

## ステップ1: レシート全体の構造を把握する
まず、レシート全体を見て以下を特定してください：
- 店舗名（上部に記載）
- 購入日（日付が印字されている行）
- **買上金額 / 合計 / お支払い金額**（レシート下部の最終的な支払金額）
- 消費税に関する情報（内税/外税、8%/10%の区分）

## ステップ2: 各品目を読み取る

#### 品目名の処理
- 半角カタカナ→全角カタカナに変換し、人間が読める商品名にする（例：ﾊﾞﾝﾉｳﾈｷﾞ→万能ネギ）
- 先頭の管理コード（F、*、@、#等）は除去
- 省略名は一般的な名前に補完

#### 金額の読み取り（最重要）
- レシートに記載されている**各品目の単価**を正確に読み取ってください
- 複数個（×2等）がある場合は「単価×個数」の合計にしてください
- **税抜き表示の場合**: レシートに「(税抜)」「本体価格」等と書かれている場合、消費税を加算して税込み金額にしてください
  - 食品・飲料（軽減税率対象）: ×1.08
  - それ以外: ×1.10
  - レシートに「*」「※」等の軽減税率マークがあればそれに従う
- **税込み表示の場合**: そのままの金額を使ってください
- **内消費税/内税が記載されている場合**: 品目の金額はすでに税込みなので、そのまま使ってください

#### 割引・値引きの処理
- 割引行（「値引」「割引」「-」で始まるマイナス金額）→ 直前の品目の金額から差し引く
- 全体割引（クーポン等）→ 最高額の品目から差し引く
- 差し引き後0以下の品目は除外

#### 除外する行
小計、合計、税合計、内税、外税、お預かり、お釣り、ポイント、レジ番号、バーコード、日付行は品目に含めない。

## ステップ3: 検算（必須）
**全品目の amount を合計し、レシートに記載されている「買上金額」「合計」「お支払い金額」と比較してください。**
- 一致する場合: そのまま出力
- 一致しない場合: 差額の原因を特定し修正（税計算ミス、品目の読み漏れ、割引の適用漏れ等）
- 検算結果を "verification" フィールドに記載してください

## カテゴリ分類
- **食費**: 食品全般（野菜、果物、肉、魚、飲料、菓子、調味料、冷凍食品、惣菜、パン、米、麺、乳製品、卵、酒類）
- **日用品**: ティッシュ、洗剤、シャンプー、ゴミ袋、ラップ等
- **ペット**: ペットフード、猫砂等
- **医療費**: 薬、マスク等
- **美容代**: 化粧品、スキンケア等
- **勉強代**: 参考書、テキスト、資格関連等
- 迷ったら「食費」

### カテゴリ一覧
${categoryList}

## 出力形式（JSONのみ、説明不要）
{
  "date": "YYYY-MM-DD",
  "storeName": "店舗名",
  "receiptTotal": レシート記載の合計金額(税込),
  "items": [
    {"name": "商品名", "amount": 税込金額(整数), "category": "カテゴリ名"}
  ],
  "verification": {
    "itemsSum": 品目合計,
    "receiptTotal": レシート記載合計,
    "match": true/false,
    "note": "差異がある場合の説明"
  }
}

### 重要ルール
1. amountは必ず**整数**（小数点以下は四捨五入）
2. amountは必ず**割引適用済み・税込みの最終金額**
3. 全品目のamount合計がレシートの合計金額と一致するように調整すること
4. レシートに「内消費税」として税額が記載されている場合、各品目価格にはすでに税が含まれているので二重加算しないこと
5. 読み取れない場合: {"date": "${today}", "storeName": "", "receiptTotal": 0, "items": [], "verification": {"itemsSum": 0, "receiptTotal": 0, "match": true, "note": "読み取り不可"}}`,
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

    let items: ParsedReceiptItem[] = (parsed.items || [])
      .filter((item: ParsedReceiptItem) => item.name && typeof item.amount === 'number' && item.amount > 0)
      .map((item: ParsedReceiptItem) => ({
        ...item,
        amount: Math.round(item.amount), // 整数に丸める
        name: halfToFullKana(item.name).trim(),
      }));

    // 検算: レシート合計と品目合計の差異を検出・調整
    const receiptTotal = parsed.receiptTotal || parsed.verification?.receiptTotal || 0;
    if (receiptTotal > 0 && items.length > 0) {
      const itemsSum = items.reduce((sum: number, item: ParsedReceiptItem) => sum + item.amount, 0);
      const diff = receiptTotal - itemsSum;

      if (diff !== 0 && Math.abs(diff) <= receiptTotal * 0.15) {
        // 差額が合計の15%以内なら、最も金額の大きい品目に調整を加える
        console.log(`Receipt verification: items sum=${itemsSum}, receipt total=${receiptTotal}, diff=${diff}. Adjusting.`);
        const maxIdx = items.reduce((maxI: number, item: ParsedReceiptItem, i: number) =>
          item.amount > items[maxI].amount ? i : maxI, 0);
        items = items.map((item: ParsedReceiptItem, i: number) =>
          i === maxIdx ? { ...item, amount: item.amount + diff } : item
        );
      } else if (diff !== 0) {
        console.warn(`Receipt verification: large discrepancy. items sum=${itemsSum}, receipt total=${receiptTotal}, diff=${diff}`);
      }
    }

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
