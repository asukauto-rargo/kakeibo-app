import type { ParsedReceiptItem } from '../types';
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
      // 濁点・半濁点の結合
      if (next === 'ﾞ' || next === '\u3099') {
        const dakutenMap: Record<string, string> = {
          'カ':'ガ','キ':'ギ','ク':'グ','ケ':'ゲ','コ':'ゴ',
          'サ':'ザ','シ':'ジ','ス':'ズ','セ':'ゼ','ソ':'ゾ',
          'タ':'ダ','チ':'ヂ','ツ':'ヅ','テ':'デ','ト':'ド',
          'ハ':'バ','ヒ':'ビ','フ':'ブ','ヘ':'ベ','ホ':'ボ',
          'ウ':'ヴ',
        };
        if (dakutenMap[converted]) {
          converted = dakutenMap[converted];
          i++; // skip next
        }
      } else if (next === 'ﾟ' || next === '\u309A') {
        const handakutenMap: Record<string, string> = {
          'ハ':'パ','ヒ':'ピ','フ':'プ','ヘ':'ペ','ホ':'ポ',
        };
        if (handakutenMap[converted]) {
          converted = handakutenMap[converted];
          i++;
        }
      }
      result += converted;
    } else {
      result += ch;
    }
  }
  return result;
}

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
      max_tokens: 4096,
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
              text: `あなたは日本のスーパーマーケット・コンビニ・ドラッグストアのレシート読み取りの専門家です。
このレシート画像を注意深く解析し、購入品目と金額を**正確に**抽出してください。

## 最重要ルール：品目名の正確な認識

日本のレシートは品目名が**半角カタカナ**や**省略表記**で印字されます。
あなたは以下のルールに従い、**人間が読める正確な商品名**に変換してください。

### 半角カタカナの読み取り
- レシート上の半角カタカナ（例：ﾊﾞﾝﾉｳﾈｷﾞ）を正確に全角に変換してください（例：バンノウネギ→万能ネギ）
- 濁点（ﾞ）や半濁点（ﾟ）の処理を正確に行ってください
- 例：ﾎﾞﾝﾚｽ→ボンレス、ﾌﾟﾘﾝ→プリン

### 品目名の先頭の記号・コードの除去
- レシートの品目名の先頭にある「F」「*」「@」「#」などの管理コードは除去してください
- 例：「Fﾊﾞﾝﾉｳﾈｷﾞ」→「万能ネギ」、「Fﾖｰｸﾞﾙﾄ100」→「ヨーグルト100」

### 商品名の推測・補完
- 省略された商品名は、一般的な商品名に補完してください
- 例：「ﾐﾔｹ ｺｶｴﾓｷﾑ400」→「コカエモキム 400g」
- 例：「ﾔｸﾙﾄ100010ml」→「ヤクルト1000 10ml」
- 例：「ﾍﾞﾆﾎﾞﾊﾟｲ ｲﾁｺﾞ」→「紅ほっぱい イチゴ」
- 数量表記（例：「4ｺ」「5ﾎﾝ」「10ｺ」）は商品名に含めてください

### 金額の読み取り
- 各品目の右側にある金額を正確に読み取ってください
- 「×2」「×3」など複数個表記がある場合は、合計金額（単価×個数）を金額にしてください
- 値引き行（ー、マイナス金額）は**その対象品目の金額から差し引く**か、除外してください

## 除外すべき行
以下の行は**必ず除外**してください：
- 小計、合計、総合計
- 消費税、内税、外税、税
- お預かり、お釣り、釣銭
- ポイント、クーポン、値引合計
- レジ番号、日付、店舗名
- 空行、区切り線

## カテゴリの分類ルール

スーパーやコンビニのレシートの場合、ほとんどの品目は「食費」に該当します。
以下のルールで分類してください：

- **食費**: 食品全般（野菜、果物、肉、魚、飲料、菓子、調味料、冷凍食品、惣菜、パン、米、麺類、乳製品、卵、酒類を含むすべての食品・飲料）
- **日用品**: ティッシュ、洗剤、シャンプー、歯ブラシ、ゴミ袋、ラップ、アルミホイルなど生活消耗品
- **ペット**: ペットフード、猫砂、ちゅーるなどペット用品
- **医療費**: 薬、絆創膏、マスク（医療用）
- **美容代**: 化粧品、スキンケア用品

**迷った場合は「食費」を選んでください。**スーパーのレシートでは大部分が食費です。

## カテゴリ一覧
${categoryList}

## 出力形式
以下のJSON配列のみを出力してください。説明文やマークダウンは不要です。

[
  {"name": "商品名（日本語で読みやすく変換した名前）", "amount": 金額（正の整数）, "category": "カテゴリ名"}
]

レシートが不鮮明で全く読み取れない場合は空の配列 [] を返してください。`,
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

    // 後処理: 半角カナが残っていたら全角に変換 + name/amountのバリデーション
    return items
      .filter((item) => item.name && typeof item.amount === 'number' && item.amount > 0)
      .map((item) => ({
        ...item,
        name: halfToFullKana(item.name).trim(),
      }));
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
