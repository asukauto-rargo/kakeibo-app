export interface CategoryDef {
  id: string;
  name: string;
  icon: string;
}

export const EXPENSE_CATS: CategoryDef[] = [
  { id: 'rent', name: '家賃', icon: '🏠' },
  { id: 'food', name: '食費', icon: '🍽️' },
  { id: 'electric', name: '電気代', icon: '💡' },
  { id: 'gas', name: 'ガス代', icon: '🔥' },
  { id: 'comm', name: '通信費', icon: '📱' },
  { id: 'daily', name: '日用品', icon: '🧴' },
  { id: 'entertainment', name: '娯楽', icon: '🎮' },
  { id: 'clothing', name: '衣服費', icon: '👕' },
  { id: 'medical', name: '医療費', icon: '🏥' },
  { id: 'pet', name: 'ペット', icon: '🐾' },
  { id: 'sub', name: 'サブスク', icon: '📺' },
  { id: 'insurance', name: '保険料', icon: '🛡️' },
  { id: 'loan', name: '奨学金', icon: '🎓' },
  { id: 'transport', name: '交通費', icon: '🚃' },
  { id: 'social', name: '交際費', icon: '🍻' },
  { id: 'water', name: '水道代', icon: '💧' },
  { id: 'gym', name: 'ジム代', icon: '💪' },
  { id: 'beauty', name: '美容代', icon: '💅' },
  { id: 'other_exp', name: 'その他', icon: '📦' },
];

export const INCOME_CATS: CategoryDef[] = [
  { id: 'salary', name: '給与', icon: '💰' },
  { id: 'bonus', name: '賞与', icon: '🎉' },
  { id: 'sidejob', name: '副業', icon: '💼' },
  { id: 'other_inc', name: 'その他', icon: '📥' },
];

export const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

export const CAT_COLORS: Record<string, string> = {
  rent: '#3498DB', food: '#E74C3C', electric: '#F1C40F', gas: '#E67E22',
  comm: '#00BCD4', daily: '#1ABC9C', entertainment: '#9B59B6', clothing: '#2ECC71',
  medical: '#FF9800', pet: '#E91E63', sub: '#34495E', insurance: '#795548',
  loan: '#F39C12', transport: '#607D8B', social: '#8BC34A', water: '#00BCD4',
  gym: '#FF5722', beauty: '#FF69B4', other_exp: '#C0392B',
  salary: '#27AE60', bonus: '#2ECC71', sidejob: '#16A085', other_inc: '#1ABC9C',
};

/** カテゴリ名からCategoryDefを引く */
export function findCatByName(name: string): CategoryDef | undefined {
  return ALL_CATS.find((c) => c.name === name);
}
/** カテゴリ名またはIDからCategoryDefを引く */
export function findCat(nameOrId: string): CategoryDef | undefined {
  return ALL_CATS.find((c) => c.name === nameOrId || c.id === nameOrId);
}
/** カテゴリ名からIDを引く */
export function catNameToId(name: string): string {
  return findCatByName(name)?.id ?? '';
}
/** カテゴリ名またはIDからIDを返す */
export function catToId(nameOrId: string): string {
  return findCat(nameOrId)?.id ?? '';
}
/** カテゴリ名またはIDから表示名を返す */
export function catToName(nameOrId: string): string {
  return findCat(nameOrId)?.name ?? nameOrId;
}

/** カテゴリ名からIDを推定（レシートOCR用） */
export function guessCategory(itemName: string): string {
  const lower = itemName.toLowerCase();
  const rules: [RegExp, string][] = [
    [/コーヒー|カフェ|ラテ|茶|ジュース|ドリンク|スタバ|タリーズ/, 'food'],
    [/パン|米|肉|魚|野菜|弁当|おにぎり|サンド|ランチ|ディナー|ごはん|食/, 'food'],
    [/菓子|チョコ|クッキー|ケーキ|アイス|スナック|おかし/, 'food'],
    [/電気/, 'electric'],
    [/ガス/, 'gas'],
    [/水道/, 'water'],
    [/通信|携帯|スマホ|WiFi|wi-fi/, 'comm'],
    [/家賃/, 'rent'],
    [/日用品|洗剤|シャンプー|ティッシュ|トイレ/, 'daily'],
    [/薬|病院|クリニック|医療/, 'medical'],
    [/保険/, 'insurance'],
    [/交通|電車|バス|タクシー|PASMO|Suica|pasmo|suica/, 'transport'],
    [/服|衣|ZOZOTOWN|zozotown|ユニクロ|GU/, 'clothing'],
    [/ジム|フィットネス/, 'gym'],
    [/ペット|猫|犬|ちゅーる/, 'pet'],
    [/Netflix|Amazon|サブスク|月額/, 'sub'],
    [/美容|まつげ|パーマ|カット|ヘア|ネイル|エステ|脱毛|サロン/, 'beauty'],
  ];
  for (const [re, cat] of rules) {
    if (re.test(lower) || re.test(itemName)) return cat;
  }
  return 'other_exp';
}
