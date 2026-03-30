import { useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { parseReceipt } from '../lib/receiptParser';
import { EXPENSE_CATS, findCat } from '../constants';
import type { ParsedReceiptItem, ParsedReceiptResult, Settings } from '../types';

interface ReceiptUploadProps {
  settings: Settings;
  currentUser: string;
  currentDate: string;
  onReceiptRegistered: (result: {
    user: string;
    date: string;
    memo: string;
    items: ParsedReceiptItem[];
    receiptStoragePath?: string;
  }) => void;
  onClose: () => void;
}

export default function ReceiptUpload({
  settings,
  currentUser,
  currentDate,
  onReceiptRegistered,
  onClose,
}: ReceiptUploadProps) {
  const userNames = [
    settings.user1Name || 'ユーザー1',
    settings.user2Name || 'ユーザー2',
    settings.user3Name || 'ユーザー3',
  ];

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedReceiptItem[]>([]);
  const [receiptDate, setReceiptDate] = useState<string>(currentDate);
  const [storeName, setStoreName] = useState<string>('');
  const [receiptMemo, setReceiptMemo] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>(currentUser);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [receiptStoragePath, setReceiptStoragePath] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
      showToast('画像ファイルを選択してください');
      return;
    }
    setSelectedFile(file);
    setErrorDetail(null);
    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile) { showToast('画像を選択してください'); return; }

    setIsProcessing(true);
    setProgress(0);
    setErrorDetail(null);

    try {
      // Storage upload
      const [year, month] = currentDate.split('-');
      const timestamp = Date.now();
      const filename = `${timestamp}_${selectedFile.name}`;
      const storagePath = `${year}-${month}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, selectedFile);
      if (uploadError) {
        console.warn('Storage upload failed:', uploadError.message);
      } else {
        setReceiptStoragePath(storagePath);
      }

      setProgress(30);

      const result: ParsedReceiptResult = await parseReceipt(selectedFile, (p) => {
        setProgress(30 + Math.round(p * 0.6));
      });

      if (!result.items || result.items.length === 0) {
        showToast('レシートから品目を検出できませんでした');
        setItems([]);
      } else {
        const validCatNames = EXPENSE_CATS.map((c) => c.name);
        const itemsNormalized = result.items.map((item) => ({
          ...item,
          category: validCatNames.includes(item.category) ? item.category : 'その他',
        }));
        setItems(itemsNormalized);
      }

      // 日付と店舗名をセット
      if (result.date) setReceiptDate(result.date);
      if (result.storeName) setStoreName(result.storeName);

      setProgress(100);
    } catch (error) {
      console.error('Error processing receipt:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrorDetail(msg);
      showToast('レシート処理に失敗しました');
      setItems([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleUpdateItem = (index: number, field: keyof ParsedReceiptItem, value: string | number) => {
    const updatedItems = [...items];
    if (field === 'amount') {
      updatedItems[index] = { ...updatedItems[index], amount: parseFloat(String(value)) || 0 };
    } else {
      updatedItems[index] = { ...updatedItems[index], [field]: value };
    }
    setItems(updatedItems);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  // カテゴリ別にグループ化（表示用）
  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: (ParsedReceiptItem & { originalIndex: number })[]; total: number }> = {};
    items.forEach((item, i) => {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = { items: [], total: 0 };
      groups[cat].items.push({ ...item, originalIndex: i });
      groups[cat].total += item.amount;
    });
    return groups;
  }, [items]);

  const handleConfirm = () => {
    const validItems = items.filter((item) => item.name && item.amount > 0);
    if (validItems.length === 0) { showToast('有効な品目を入力してください'); return; }
    onReceiptRegistered({
      user: selectedUser,
      date: receiptDate,
      memo: receiptMemo || storeName || '',
      items: validItems,
      receiptStoragePath: receiptStoragePath || undefined,
    });
  };

  const getCategoryIcon = (catName: string) => findCat(catName)?.icon || '📦';

  const resetFile = () => {
    setPreview(null); setSelectedFile(null); setItems([]); setErrorDetail(null);
    setStoreName(''); setReceiptDate(currentDate); setReceiptStoragePath(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const getUserColor = (name: string, idx: number) => {
    const colors = ['#3B82F6', '#EF4444', '#8B5CF6'];
    return name === selectedUser ? colors[idx] : undefined;
  };

  return (
    <div className="receipt-overlay">
      <div className="receipt-modal">
        <div className="receipt-header">
          <h2>レシート読取</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {toast && <div style={{
          background: '#1a1a1a', color: '#fff', padding: '8px 16px',
          borderRadius: 8, fontSize: 13, textAlign: 'center', marginBottom: 12
        }}>{toast}</div>}

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} style={{ display: 'none' }} />
        <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif"
          onChange={handleFileSelect} style={{ display: 'none' }} />

        {/* Source Selection */}
        {!preview && (
          <div className="receipt-section">
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="receipt-source-btn">
                <span style={{ fontSize: 24 }}>&#128247;</span>
                <span>カメラで撮影</span>
              </button>
              <button type="button" onClick={() => galleryInputRef.current?.click()} className="receipt-source-btn">
                <span style={{ fontSize: 24 }}>&#128444;&#65039;</span>
                <span>写真から選択</span>
              </button>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {preview && (
          <div className="receipt-section">
            <img src={preview} alt="レシート" className="receipt-preview" />
            <button type="button" onClick={resetFile} className="btn-secondary" style={{ fontSize: 12 }}>
              画像を変更
            </button>
          </div>
        )}

        {/* Error Detail */}
        {errorDetail && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '8px 12px', fontSize: 11, color: '#B91C1C', marginBottom: 12, wordBreak: 'break-all'
          }}>{errorDetail}</div>
        )}

        {/* Process Button */}
        {preview && items.length === 0 && !isProcessing && (
          <button onClick={handleUploadAndParse} className="btn-add" style={{ marginBottom: 12 }}>
            レシートを読み取る
          </button>
        )}

        {/* Loading Animation with Pixel Art Cat + Bicycle Couple */}
        {isProcessing && (
          <div className="receipt-section">
            <div className="loading-cat-container">
              <div className="loading-cat-track">
                {/* Cat runs ahead */}
                <div className="pixel-cat-runner">
                  <svg width="48" height="36" viewBox="0 0 24 18" style={{ imageRendering: 'pixelated' }}>
                    {/* Frame 1: front legs extended, back legs tucked */}
                    <g className="cat-frame cat-frame-1">
                      {/* Ears - dark chocolate */}
                      <rect x="2" y="0" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="7" y="0" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="3" y="0" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="8" y="0" width="1" height="1" fill="#FFB6C1"/>
                      {/* Head - dark brown mask top, white muzzle */}
                      <rect x="1" y="2" width="9" height="6" fill="#F5E6D0"/>
                      <rect x="2" y="2" width="7" height="3" fill="#6B4226"/>
                      <rect x="3" y="3" width="2" height="2" fill="#4A90D9"/>
                      <rect x="6" y="3" width="2" height="2" fill="#4A90D9"/>
                      <rect x="5" y="5" width="1" height="1" fill="#FFB6C1"/>
                      {/* White chin */}
                      <rect x="3" y="6" width="5" height="1" fill="#FFFFFF"/>
                      {/* Body - cream with brown saddle */}
                      <rect x="4" y="8" width="11" height="4" fill="#F5E6D0"/>
                      <rect x="6" y="8" width="7" height="2" fill="#B8875A"/>
                      {/* White belly */}
                      <rect x="5" y="10" width="6" height="2" fill="#FFFFFF"/>
                      {/* Front legs - white paws, stretched forward */}
                      <rect x="5" y="12" width="2" height="3" fill="#FFFFFF"/>
                      <rect x="3" y="14" width="2" height="2" fill="#FFFFFF"/>
                      {/* Back legs - white, tucked under */}
                      <rect x="12" y="12" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="13" y="14" width="2" height="2" fill="#FFFFFF"/>
                      {/* Tail - dark brown, fluffy, up */}
                      <rect x="15" y="8" width="2" height="2" fill="#6B4226"/>
                      <rect x="17" y="6" width="2" height="2" fill="#6B4226"/>
                      <rect x="19" y="4" width="2" height="3" fill="#5C3A1E"/>
                      <rect x="20" y="3" width="2" height="2" fill="#5C3A1E"/>
                    </g>
                    {/* Frame 2: front legs tucked, back legs extended */}
                    <g className="cat-frame cat-frame-2">
                      {/* Ears */}
                      <rect x="2" y="1" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="7" y="1" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="3" y="1" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="8" y="1" width="1" height="1" fill="#FFB6C1"/>
                      {/* Head */}
                      <rect x="1" y="3" width="9" height="6" fill="#F5E6D0"/>
                      <rect x="2" y="3" width="7" height="3" fill="#6B4226"/>
                      <rect x="3" y="4" width="2" height="2" fill="#4A90D9"/>
                      <rect x="6" y="4" width="2" height="2" fill="#4A90D9"/>
                      <rect x="5" y="6" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="3" y="7" width="5" height="1" fill="#FFFFFF"/>
                      {/* Body */}
                      <rect x="4" y="9" width="11" height="4" fill="#F5E6D0"/>
                      <rect x="6" y="9" width="7" height="2" fill="#B8875A"/>
                      <rect x="5" y="11" width="6" height="2" fill="#FFFFFF"/>
                      {/* Front legs - tucked */}
                      <rect x="6" y="13" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="8" y="14" width="2" height="2" fill="#FFFFFF"/>
                      {/* Back legs - extended back */}
                      <rect x="13" y="13" width="2" height="3" fill="#FFFFFF"/>
                      <rect x="15" y="14" width="2" height="2" fill="#FFFFFF"/>
                      {/* Tail - slightly different angle */}
                      <rect x="15" y="9" width="2" height="2" fill="#6B4226"/>
                      <rect x="17" y="7" width="2" height="2" fill="#6B4226"/>
                      <rect x="19" y="5" width="2" height="3" fill="#5C3A1E"/>
                      <rect x="20" y="4" width="2" height="2" fill="#5C3A1E"/>
                    </g>
                  </svg>
                </div>
                {/* Bicycle couple chasing behind */}
                <div className="pixel-bike-runner">
                  <svg width="72" height="44" viewBox="0 0 36 22" style={{ imageRendering: 'pixelated' }}>
                    {/* Frame 1: pedals at 12/6 position */}
                    <g className="bike-frame bike-frame-1">
                      {/* Back rider (man) */}
                      <rect x="8" y="0" width="3" height="3" fill="#4A3728"/>
                      <rect x="8" y="3" width="3" height="2" fill="#FFDBB4"/>
                      <rect x="7" y="5" width="5" height="4" fill="#3B82F6"/>
                      <rect x="7" y="9" width="2" height="3" fill="#333"/>
                      <rect x="10" y="9" width="2" height="3" fill="#333"/>
                      <rect x="7" y="12" width="2" height="1" fill="#555"/>
                      <rect x="11" y="11" width="2" height="1" fill="#555"/>
                      {/* Front rider (woman) */}
                      <rect x="17" y="0" width="3" height="3" fill="#2C1810"/>
                      <rect x="16" y="1" width="1" height="3" fill="#2C1810"/>
                      <rect x="17" y="3" width="3" height="2" fill="#FFDBB4"/>
                      <rect x="16" y="5" width="5" height="4" fill="#EF4444"/>
                      <rect x="16" y="9" width="2" height="3" fill="#333"/>
                      <rect x="19" y="9" width="2" height="3" fill="#333"/>
                      <rect x="16" y="12" width="2" height="1" fill="#555"/>
                      <rect x="20" y="11" width="2" height="1" fill="#555"/>
                      {/* Bicycle frame */}
                      <rect x="10" y="13" width="12" height="1" fill="#666"/>
                      <rect x="9" y="12" width="2" height="2" fill="#666"/>
                      <rect x="21" y="11" width="2" height="2" fill="#666"/>
                      <rect x="14" y="11" width="2" height="3" fill="#666"/>
                      {/* Back wheel */}
                      <rect x="6" y="15" width="7" height="1" fill="#444"/>
                      <rect x="5" y="16" width="2" height="3" fill="#444"/>
                      <rect x="12" y="16" width="2" height="3" fill="#444"/>
                      <rect x="6" y="19" width="7" height="1" fill="#444"/>
                      <rect x="7" y="16" width="5" height="1" fill="#444"/>
                      <rect x="7" y="18" width="5" height="1" fill="#444"/>
                      {/* Front wheel */}
                      <rect x="22" y="15" width="7" height="1" fill="#444"/>
                      <rect x="21" y="16" width="2" height="3" fill="#444"/>
                      <rect x="28" y="16" width="2" height="3" fill="#444"/>
                      <rect x="22" y="19" width="7" height="1" fill="#444"/>
                      <rect x="23" y="16" width="5" height="1" fill="#444"/>
                      <rect x="23" y="18" width="5" height="1" fill="#444"/>
                      {/* Spokes / hub */}
                      <rect x="9" y="17" width="1" height="1" fill="#888"/>
                      <rect x="25" y="17" width="1" height="1" fill="#888"/>
                    </g>
                    {/* Frame 2: pedals rotated */}
                    <g className="bike-frame bike-frame-2">
                      {/* Back rider (man) - slight bounce */}
                      <rect x="8" y="1" width="3" height="3" fill="#4A3728"/>
                      <rect x="8" y="4" width="3" height="2" fill="#FFDBB4"/>
                      <rect x="7" y="6" width="5" height="4" fill="#3B82F6"/>
                      <rect x="8" y="10" width="2" height="3" fill="#333"/>
                      <rect x="11" y="10" width="2" height="2" fill="#333"/>
                      <rect x="8" y="13" width="2" height="0" fill="#555"/>
                      <rect x="11" y="11" width="2" height="1" fill="#555"/>
                      {/* Front rider (woman) - slight bounce */}
                      <rect x="17" y="1" width="3" height="3" fill="#2C1810"/>
                      <rect x="16" y="2" width="1" height="3" fill="#2C1810"/>
                      <rect x="17" y="4" width="3" height="2" fill="#FFDBB4"/>
                      <rect x="16" y="6" width="5" height="4" fill="#EF4444"/>
                      <rect x="17" y="10" width="2" height="3" fill="#333"/>
                      <rect x="20" y="10" width="2" height="2" fill="#333"/>
                      <rect x="17" y="13" width="2" height="0" fill="#555"/>
                      <rect x="20" y="11" width="2" height="1" fill="#555"/>
                      {/* Bicycle frame */}
                      <rect x="10" y="13" width="12" height="1" fill="#666"/>
                      <rect x="9" y="12" width="2" height="2" fill="#666"/>
                      <rect x="21" y="11" width="2" height="2" fill="#666"/>
                      <rect x="14" y="11" width="2" height="3" fill="#666"/>
                      {/* Back wheel */}
                      <rect x="6" y="15" width="7" height="1" fill="#444"/>
                      <rect x="5" y="16" width="2" height="3" fill="#444"/>
                      <rect x="12" y="16" width="2" height="3" fill="#444"/>
                      <rect x="6" y="19" width="7" height="1" fill="#444"/>
                      <rect x="7" y="16" width="5" height="1" fill="#444"/>
                      <rect x="7" y="18" width="5" height="1" fill="#444"/>
                      {/* Front wheel */}
                      <rect x="22" y="15" width="7" height="1" fill="#444"/>
                      <rect x="21" y="16" width="2" height="3" fill="#444"/>
                      <rect x="28" y="16" width="2" height="3" fill="#444"/>
                      <rect x="22" y="19" width="7" height="1" fill="#444"/>
                      <rect x="23" y="16" width="5" height="1" fill="#444"/>
                      <rect x="23" y="18" width="5" height="1" fill="#444"/>
                      <rect x="9" y="17" width="1" height="1" fill="#888"/>
                      <rect x="25" y="17" width="1" height="1" fill="#888"/>
                    </g>
                  </svg>
                </div>
              </div>
              {/* Progress bar */}
              <div className="progress-bar" style={{ height: 8, borderRadius: 4 }}>
                <div className="progress-fill loading-bar-smooth" />
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginTop: 8 }}>
              レシートを読み取っています...
            </p>
          </div>
        )}

        {/* Results */}
        {items.length > 0 && (
          <>
            {/* User / Date / Memo Selection */}
            <div className="receipt-section" style={{ background: '#f8f9fa', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>計上者</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {userNames.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedUser(name)}
                      style={{
                        flex: 1, padding: '6px 4px', border: `2px solid ${getUserColor(name, i) || '#e0e0e0'}`,
                        borderRadius: 8, background: getUserColor(name, i) ? `${getUserColor(name, i)}10` : '#fff',
                        color: getUserColor(name, i) || '#999', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>日付</div>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="form-input"
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#999', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>メモ</div>
                  <input
                    type="text"
                    value={receiptMemo}
                    onChange={(e) => setReceiptMemo(e.target.value)}
                    placeholder={storeName || '任意'}
                    className="form-input"
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  />
                </div>
              </div>

              {storeName && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                  店舗: {storeName}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="receipt-section">
              <div className="receipt-items-header">
                <h3>読取結果 ({items.length}件)</h3>
                <span style={{ fontSize: 15, fontWeight: 700 }}>合計 ¥{totalAmount.toLocaleString()}</span>
              </div>

              {Object.entries(groupedItems).map(([catName, group]) => (
                <div key={catName} className="receipt-cat-group">
                  <div className="receipt-cat-title">
                    <h4>{getCategoryIcon(catName)} {catName}</h4>
                    <span className="cat-total">¥{group.total.toLocaleString()}</span>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.originalIndex}>
                      {editingIndex === item.originalIndex ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
                          <input type="text" value={item.name}
                            onChange={(e) => handleUpdateItem(item.originalIndex, 'name', e.target.value)}
                            className="form-input" style={{ flex: 1, minWidth: 80, fontSize: 12, padding: '4px 6px' }} />
                          <input type="number" value={item.amount || ''}
                            onChange={(e) => handleUpdateItem(item.originalIndex, 'amount', e.target.value)}
                            className="form-input" style={{ width: 70, fontSize: 12, padding: '4px 6px', textAlign: 'right' }} />
                          <select value={item.category}
                            onChange={(e) => handleUpdateItem(item.originalIndex, 'category', e.target.value)}
                            className="form-input" style={{ width: 90, fontSize: 11, padding: '4px 4px' }}>
                            {EXPENSE_CATS.map((cat) => (
                              <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                          <button onClick={() => setEditingIndex(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
                            OK
                          </button>
                        </div>
                      ) : (
                        <div className="receipt-cat-item" onClick={() => setEditingIndex(item.originalIndex)} style={{ cursor: 'pointer' }}>
                          <span>{item.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            ¥{item.amount.toLocaleString()}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.originalIndex); }}
                              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}>
                              ✕
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              <p style={{ fontSize: 10, color: '#999', marginTop: 8, textAlign: 'center' }}>
                品目をタップすると名前・金額・カテゴリを編集できます
              </p>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="receipt-actions">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          {items.length > 0 && (
            <button onClick={handleConfirm} className="btn-add">
              {items.length}件を登録
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
