import { useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { parseReceipt } from '../lib/receiptParser';
import { EXPENSE_CATS, findCat } from '../constants';
import type { ParsedReceiptItem, ParsedReceiptResult, Settings } from '../types';

/** 個別レシートの状態 */
interface ReceiptEntry {
  id: number;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  items: ParsedReceiptItem[];
  date: string;
  storeName: string;
  storagePath: string | null;
  error?: string;
  expanded: boolean;
}

/** 登録結果の型 */
export interface ReceiptResult {
  user: string;
  date: string;
  memo: string;
  items: ParsedReceiptItem[];
  receiptStoragePath?: string;
}

interface ReceiptUploadProps {
  settings: Settings;
  currentUser: string;
  currentDate: string;
  onReceiptRegistered: (results: ReceiptResult[]) => void;
  onClose: () => void;
}

let nextId = 1;

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

  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>(currentUser);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessing, setCurrentProcessing] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ receiptId: number; itemIndex: number } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // ファイル選択ハンドラ（複数対応）
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newReceipts: ReceiptEntry[] = [];

    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) {
        return; // 画像以外はスキップ
      }
      const reader = new FileReader();
      const id = nextId++;
      reader.onload = (event) => {
        const entry: ReceiptEntry = {
          id,
          file,
          preview: event.target?.result as string,
          status: 'pending',
          items: [],
          date: currentDate,
          storeName: '',
          storagePath: null,
          expanded: false,
        };
        setReceipts((prev) => [...prev, entry]);
      };
      reader.readAsDataURL(file);
    });

    // input値をリセット（同じファイルを再選択可能にする）
    e.target.value = '';
  };

  // 全レシートを順次処理
  const handleProcessAll = useCallback(async () => {
    const pendingReceipts = receipts.filter((r) => r.status === 'pending');
    if (pendingReceipts.length === 0) {
      showToast('処理するレシートがありません');
      return;
    }

    setIsProcessing(true);
    setCurrentProcessing(0);

    for (let i = 0; i < pendingReceipts.length; i++) {
      const receipt = pendingReceipts[i];
      setCurrentProcessing(i + 1);

      // ステータスを processing に更新
      setReceipts((prev) =>
        prev.map((r) => (r.id === receipt.id ? { ...r, status: 'processing' as const } : r))
      );

      try {
        // Storage upload
        const [year, month] = currentDate.split('-');
        const timestamp = Date.now();
        const filename = `${timestamp}_${receipt.file.name}`;
        const storagePath = `${year}-${month}/${filename}`;
        let uploadedPath: string | null = null;

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(storagePath, receipt.file);

        if (!uploadError) {
          uploadedPath = storagePath;
        } else {
          console.warn('Storage upload failed:', uploadError.message);
        }

        // OCR処理
        const result: ParsedReceiptResult = await parseReceipt(receipt.file);

        const validCatNames = EXPENSE_CATS.map((c) => c.name);
        const itemsNormalized = (result.items || []).map((item) => ({
          ...item,
          category: validCatNames.includes(item.category) ? item.category : 'その他',
        }));

        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receipt.id
              ? {
                  ...r,
                  status: 'done' as const,
                  items: itemsNormalized,
                  date: result.date || currentDate,
                  storeName: result.storeName || '',
                  storagePath: uploadedPath,
                  expanded: true,
                }
              : r
          )
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error processing receipt:', error);
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === receipt.id
              ? { ...r, status: 'error' as const, error: msg }
              : r
          )
        );
      }
    }

    setIsProcessing(false);
  }, [receipts, currentDate]);

  // 個別レシートを再処理
  const handleRetry = useCallback(async (receiptId: number) => {
    const receipt = receipts.find((r) => r.id === receiptId);
    if (!receipt) return;

    setReceipts((prev) =>
      prev.map((r) => (r.id === receiptId ? { ...r, status: 'processing' as const, error: undefined } : r))
    );

    try {
      const result: ParsedReceiptResult = await parseReceipt(receipt.file);
      const validCatNames = EXPENSE_CATS.map((c) => c.name);
      const itemsNormalized = (result.items || []).map((item) => ({
        ...item,
        category: validCatNames.includes(item.category) ? item.category : 'その他',
      }));

      setReceipts((prev) =>
        prev.map((r) =>
          r.id === receiptId
            ? { ...r, status: 'done' as const, items: itemsNormalized, date: result.date || currentDate, storeName: result.storeName || '', expanded: true }
            : r
        )
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === receiptId ? { ...r, status: 'error' as const, error: msg } : r
        )
      );
    }
  }, [receipts, currentDate]);

  // レシート削除
  const handleRemoveReceipt = (receiptId: number) => {
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
  };

  // 展開/折りたたみ
  const toggleExpand = (receiptId: number) => {
    setReceipts((prev) =>
      prev.map((r) => (r.id === receiptId ? { ...r, expanded: !r.expanded } : r))
    );
  };

  // 品目の編集
  const handleUpdateItem = (receiptId: number, itemIndex: number, field: keyof ParsedReceiptItem, value: string | number) => {
    setReceipts((prev) =>
      prev.map((r) => {
        if (r.id !== receiptId) return r;
        const newItems = [...r.items];
        if (field === 'amount') {
          newItems[itemIndex] = { ...newItems[itemIndex], amount: parseFloat(String(value)) || 0 };
        } else {
          newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
        }
        return { ...r, items: newItems };
      })
    );
  };

  // 品目の削除
  const handleRemoveItem = (receiptId: number, itemIndex: number) => {
    setReceipts((prev) =>
      prev.map((r) => {
        if (r.id !== receiptId) return r;
        return { ...r, items: r.items.filter((_, i) => i !== itemIndex) };
      })
    );
    if (editingItem?.receiptId === receiptId && editingItem?.itemIndex === itemIndex) {
      setEditingItem(null);
    }
  };

  // 日付の変更
  const handleDateChange = (receiptId: number, newDate: string) => {
    setReceipts((prev) =>
      prev.map((r) => (r.id === receiptId ? { ...r, date: newDate } : r))
    );
  };

  // 全登録
  const handleConfirmAll = () => {
    const doneReceipts = receipts.filter((r) => r.status === 'done' && r.items.length > 0);
    if (doneReceipts.length === 0) {
      showToast('登録できるレシートがありません');
      return;
    }

    const results: ReceiptResult[] = doneReceipts.map((r) => ({
      user: selectedUser,
      date: r.date,
      memo: r.storeName || '',
      items: r.items.filter((item) => item.name && item.amount > 0),
      receiptStoragePath: r.storagePath || undefined,
    }));

    onReceiptRegistered(results);
  };

  // 集計
  const doneReceipts = receipts.filter((r) => r.status === 'done' && r.items.length > 0);
  const pendingCount = receipts.filter((r) => r.status === 'pending').length;
  const errorCount = receipts.filter((r) => r.status === 'error').length;
  const totalItems = doneReceipts.reduce((sum, r) => sum + r.items.length, 0);
  const totalAmount = doneReceipts.reduce(
    (sum, r) => sum + r.items.reduce((s, it) => s + it.amount, 0),
    0
  );

  const getCategoryIcon = (catName: string) => findCat(catName)?.icon || '📦';

  const getUserColor = (name: string, idx: number) => {
    const colors = ['#3B82F6', '#EF4444', '#8B5CF6'];
    return name === selectedUser ? colors[idx] : undefined;
  };

  const statusIcon = (status: ReceiptEntry['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '🔄';
      case 'done': return '✅';
      case 'error': return '❌';
    }
  };

  return (
    <div className="receipt-overlay">
      <div className="receipt-modal">
        <div className="receipt-header">
          <h2>レシート読取</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {toast && (
          <div style={{
            background: '#1a1a1a', color: '#fff', padding: '8px 16px',
            borderRadius: 8, fontSize: 13, textAlign: 'center', marginBottom: 12,
          }}>{toast}</div>
        )}

        {/* Hidden file inputs */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileSelect} style={{ display: 'none' }} />
        <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" multiple
          onChange={handleFileSelect} style={{ display: 'none' }} />

        {/* Source Selection: always visible to add more */}
        <div className="receipt-section">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => cameraInputRef.current?.click()} className="receipt-source-btn">
              <span style={{ fontSize: 24 }}>&#128247;</span>
              <span>カメラで撮影</span>
            </button>
            <button type="button" onClick={() => galleryInputRef.current?.click()} className="receipt-source-btn">
              <span style={{ fontSize: 24 }}>&#128444;&#65039;</span>
              <span>写真から選択</span>
              <span style={{ fontSize: 10, color: '#999' }}>複数選択可</span>
            </button>
          </div>
        </div>

        {/* Receipt Thumbnails */}
        {receipts.length > 0 && (
          <div className="receipt-section">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              レシート一覧 ({receipts.length}枚)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
              {receipts.map((r) => (
                <div key={r.id} style={{ position: 'relative' }}>
                  <img
                    src={r.preview}
                    alt=""
                    style={{
                      width: '100%', height: 80, objectFit: 'cover', borderRadius: 8,
                      border: r.status === 'error' ? '2px solid #E74C3C' : r.status === 'done' ? '2px solid #27AE60' : '2px solid #e0e0e0',
                      opacity: r.status === 'processing' ? 0.6 : 1,
                    }}
                  />
                  <span style={{
                    position: 'absolute', top: 2, right: 2, fontSize: 14,
                    background: 'rgba(255,255,255,0.85)', borderRadius: 4, padding: '0 2px',
                  }}>{statusIcon(r.status)}</span>
                  {r.status !== 'processing' && (
                    <button
                      onClick={() => handleRemoveReceipt(r.id)}
                      style={{
                        position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,0.5)',
                        color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18,
                        fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <div className="receipt-section">
            <div className="loading-cat-container">
              <div className="loading-cat-track">
                <div className="pixel-cat-runner">
                  <svg width="48" height="36" viewBox="0 0 24 18" style={{ imageRendering: 'pixelated' }}>
                    <g className="cat-frame cat-frame-1">
                      <rect x="0" y="3" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="1" y="4" width="2" height="3" fill="#5C3A1E"/>
                      <rect x="3" y="6" width="2" height="2" fill="#6B4226"/>
                      <rect x="5" y="8" width="2" height="2" fill="#6B4226"/>
                      <rect x="7" y="8" width="11" height="4" fill="#F5E6D0"/>
                      <rect x="9" y="8" width="7" height="2" fill="#B8875A"/>
                      <rect x="10" y="10" width="6" height="2" fill="#FFFFFF"/>
                      <rect x="14" y="2" width="9" height="6" fill="#F5E6D0"/>
                      <rect x="15" y="2" width="7" height="3" fill="#6B4226"/>
                      <rect x="15" y="0" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="20" y="0" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="16" y="0" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="21" y="0" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="16" y="3" width="2" height="2" fill="#4A90D9"/>
                      <rect x="19" y="3" width="2" height="2" fill="#4A90D9"/>
                      <rect x="18" y="5" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="16" y="6" width="5" height="1" fill="#FFFFFF"/>
                      <rect x="17" y="12" width="2" height="3" fill="#FFFFFF"/>
                      <rect x="19" y="14" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="9" y="12" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="7" y="14" width="2" height="2" fill="#FFFFFF"/>
                    </g>
                    <g className="cat-frame cat-frame-2">
                      <rect x="0" y="4" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="1" y="5" width="2" height="3" fill="#5C3A1E"/>
                      <rect x="3" y="7" width="2" height="2" fill="#6B4226"/>
                      <rect x="5" y="9" width="2" height="2" fill="#6B4226"/>
                      <rect x="7" y="9" width="11" height="4" fill="#F5E6D0"/>
                      <rect x="9" y="9" width="7" height="2" fill="#B8875A"/>
                      <rect x="10" y="11" width="6" height="2" fill="#FFFFFF"/>
                      <rect x="14" y="3" width="9" height="6" fill="#F5E6D0"/>
                      <rect x="15" y="3" width="7" height="3" fill="#6B4226"/>
                      <rect x="15" y="1" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="20" y="1" width="2" height="2" fill="#5C3A1E"/>
                      <rect x="16" y="1" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="21" y="1" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="16" y="4" width="2" height="2" fill="#4A90D9"/>
                      <rect x="19" y="4" width="2" height="2" fill="#4A90D9"/>
                      <rect x="18" y="6" width="1" height="1" fill="#FFB6C1"/>
                      <rect x="16" y="7" width="5" height="1" fill="#FFFFFF"/>
                      <rect x="16" y="13" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="14" y="14" width="2" height="2" fill="#FFFFFF"/>
                      <rect x="8" y="13" width="2" height="3" fill="#FFFFFF"/>
                      <rect x="6" y="14" width="2" height="2" fill="#FFFFFF"/>
                    </g>
                  </svg>
                </div>
              </div>
              <div className="progress-bar" style={{ height: 8, borderRadius: 4 }}>
                <div style={{
                  background: 'linear-gradient(90deg, #1a1a1a 0%, #555 100%)',
                  height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                  width: `${(currentProcessing / receipts.filter((r) => r.status !== 'done').length) * 100}%`,
                }} />
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginTop: 8 }}>
              {currentProcessing} / {receipts.filter((r) => r.status === 'pending' || r.status === 'processing').length + currentProcessing - 1} 枚目を処理中...
            </p>
          </div>
        )}

        {/* Process Button */}
        {!isProcessing && pendingCount > 0 && (
          <button onClick={handleProcessAll} className="btn-add" style={{ marginBottom: 12, width: '100%' }}>
            {pendingCount === 1 ? 'レシートを読み取る' : `${pendingCount}枚のレシートを読み取る`}
          </button>
        )}

        {/* User Selection (show when there are results) */}
        {doneReceipts.length > 0 && (
          <div className="receipt-section" style={{ background: '#f8f9fa', borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ marginBottom: 4 }}>
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
          </div>
        )}

        {/* Results per receipt */}
        {receipts.filter((r) => r.status === 'done' || r.status === 'error').map((receipt) => (
          <div key={receipt.id} className="receipt-section" style={{
            border: receipt.status === 'error' ? '1px solid #FECACA' : '1px solid #e0e0e0',
            borderRadius: 10, padding: 12, marginBottom: 8,
            background: receipt.status === 'error' ? '#FEF2F2' : '#fff',
          }}>
            {/* Receipt header */}
            <div
              onClick={() => toggleExpand(receipt.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <img src={receipt.preview} alt="" style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                  {receipt.storeName || '不明な店舗'}
                </div>
                {receipt.status === 'done' && (
                  <>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {receipt.date} ・ {receipt.items.length}品
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#E74C3C' }}>
                      ¥{receipt.items.reduce((s, it) => s + it.amount, 0).toLocaleString()}
                    </div>
                  </>
                )}
                {receipt.status === 'error' && (
                  <div style={{ fontSize: 11, color: '#B91C1C' }}>
                    {receipt.error}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {receipt.status === 'error' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRetry(receipt.id); }}
                    style={{ background: '#E74C3C', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >再試行</button>
                )}
                <span style={{ fontSize: 12, color: '#999', transform: receipt.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
              </div>
            </div>

            {/* Expanded content */}
            {receipt.expanded && receipt.status === 'done' && (
              <div style={{ marginTop: 12 }}>
                {/* Date edit */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#999', fontWeight: 600 }}>日付:</span>
                  <input
                    type="date"
                    value={receipt.date}
                    onChange={(e) => handleDateChange(receipt.id, e.target.value)}
                    className="form-input"
                    style={{ fontSize: 12, padding: '4px 6px', flex: 1 }}
                  />
                </div>

                {/* Items */}
                {receipt.items.map((item, idx) => (
                  <div key={idx}>
                    {editingItem?.receiptId === receipt.id && editingItem?.itemIndex === idx ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
                        <input type="text" value={item.name}
                          onChange={(e) => handleUpdateItem(receipt.id, idx, 'name', e.target.value)}
                          className="form-input" style={{ flex: 1, minWidth: 80, fontSize: 12, padding: '4px 6px' }} />
                        <input type="number" value={item.amount || ''}
                          onChange={(e) => handleUpdateItem(receipt.id, idx, 'amount', e.target.value)}
                          className="form-input" style={{ width: 70, fontSize: 12, padding: '4px 6px', textAlign: 'right' }} />
                        <select value={item.category}
                          onChange={(e) => handleUpdateItem(receipt.id, idx, 'category', e.target.value)}
                          className="form-input" style={{ width: 90, fontSize: 11, padding: '4px 4px' }}>
                          {EXPENSE_CATS.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                          ))}
                        </select>
                        <button onClick={() => setEditingItem(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
                          OK
                        </button>
                      </div>
                    ) : (
                      <div
                        className="receipt-cat-item"
                        onClick={() => setEditingItem({ receiptId: receipt.id, itemIndex: idx })}
                        style={{ cursor: 'pointer', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {getCategoryIcon(item.category)} {item.name}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          ¥{item.amount.toLocaleString()}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(receipt.id, idx); }}
                            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 11 }}>
                            ✕
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                <p style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>
                  品目をタップして編集
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Summary & Action Buttons */}
        {doneReceipts.length > 0 && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            padding: 12, marginBottom: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#666' }}>
              {doneReceipts.length}枚のレシート ・ {totalItems}品
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>
              合計 ¥{totalAmount.toLocaleString()}
            </div>
            {errorCount > 0 && (
              <div style={{ fontSize: 11, color: '#E74C3C', marginTop: 4 }}>
                {errorCount}枚のレシートでエラーが発生しています
              </div>
            )}
          </div>
        )}

        <div className="receipt-actions">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          {doneReceipts.length > 0 && (
            <button onClick={handleConfirmAll} className="btn-add">
              {doneReceipts.length === 1
                ? `${totalItems}件を登録`
                : `${doneReceipts.length}枚・${totalItems}件を登録`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
