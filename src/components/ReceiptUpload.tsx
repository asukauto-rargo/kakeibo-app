import { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { parseReceipt } from '../lib/receiptParser';
import { EXPENSE_CATS, findCat } from '../constants';
import type { ParsedReceiptItem } from '../types';

interface ReceiptUploadProps {
  currentUser: string;
  currentDate: string;
  onItemsParsed: (items: ParsedReceiptItem[]) => void;
  onClose: () => void;
}

export default function ReceiptUpload({
  currentUser,
  currentDate,
  onItemsParsed,
  onClose,
}: ReceiptUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedReceiptItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('画像ファイルを選択してください');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile) {
      showToast('画像を選択してください');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const [year, month] = currentDate.split('-');
      const timestamp = Date.now();
      const filename = `${timestamp}_${selectedFile.name}`;
      const storagePath = `${year}-${month}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, selectedFile);

      if (uploadError) {
        console.warn('Storage upload failed:', uploadError.message);
      }

      setProgress(30);

      const parsedItems = await parseReceipt(selectedFile, (p) => {
        setProgress(30 + Math.round(p * 0.6));
      });

      if (!parsedItems || parsedItems.length === 0) {
        showToast('レシートから品目を検出できませんでした');
        setItems([]);
      } else {
        const validCatNames = EXPENSE_CATS.map((c) => c.name);
        const itemsNormalized = parsedItems.map((item) => ({
          ...item,
          category: validCatNames.includes(item.category) ? item.category : 'その他',
        }));
        setItems(itemsNormalized);
      }

      setProgress(100);
    } catch (error) {
      console.error('Error processing receipt:', error);
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

  // カテゴリ別にグループ化
  const groupedItems = useMemo(() => {
    const groups: Record<string, { items: (ParsedReceiptItem & { originalIndex: number })[]; total: number }> = {};
    items.forEach((item, i) => {
      const cat = item.category;
      if (!groups[cat]) {
        groups[cat] = { items: [], total: 0 };
      }
      groups[cat].items.push({ ...item, originalIndex: i });
      groups[cat].total += item.amount;
    });
    return groups;
  }, [items]);

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const handleConfirm = () => {
    const validItems = items.filter((item) => item.name && item.amount > 0);
    if (validItems.length === 0) {
      showToast('有効な品目を入力してください');
      return;
    }
    onItemsParsed(validItems);
  };

  const getCategoryIcon = (catName: string) => {
    const cat = findCat(catName);
    return cat?.icon || '📦';
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

        {/* File Input */}
        {!preview && (
          <div className="receipt-section">
            <label style={{ fontSize: 13, color: '#666', marginBottom: 8, display: 'block' }}>
              レシート画像を選択
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="form-input"
            />
          </div>
        )}

        {/* Image Preview */}
        {preview && (
          <div className="receipt-section">
            <img src={preview} alt="レシート" className="receipt-preview" />
            <button
              type="button"
              onClick={() => { setPreview(null); setSelectedFile(null); setItems([]); }}
              className="btn-secondary"
              style={{ fontSize: 12 }}
            >
              画像を変更
            </button>
          </div>
        )}

        {/* Process Button */}
        {preview && items.length === 0 && !isProcessing && (
          <button onClick={handleUploadAndParse} className="btn-add" style={{ marginBottom: 12 }}>
            レシートを読み取る
          </button>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="receipt-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: '#1a1a1a' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginTop: 8 }}>
              読み取り中... {progress}%
            </p>
          </div>
        )}

        {/* Items - Grouped by Category */}
        {items.length > 0 && (
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
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.originalIndex, 'name', e.target.value)}
                          className="form-input"
                          style={{ flex: 1, fontSize: 12, padding: '4px 6px' }}
                        />
                        <input
                          type="number"
                          value={item.amount || ''}
                          onChange={(e) => handleUpdateItem(item.originalIndex, 'amount', e.target.value)}
                          className="form-input"
                          style={{ width: 70, fontSize: 12, padding: '4px 6px', textAlign: 'right' }}
                        />
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(item.originalIndex, 'category', e.target.value)}
                          className="form-input"
                          style={{ width: 80, fontSize: 11, padding: '4px 4px' }}
                        >
                          {EXPENSE_CATS.map((cat) => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setEditingIndex(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3B82F6', fontWeight: 600 }}
                        >
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
                            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}
                          >
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
              品目をタップすると編集できます
            </p>
          </div>
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
