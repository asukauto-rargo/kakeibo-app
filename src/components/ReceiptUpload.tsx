import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseReceipt } from '../lib/receiptParser';
import { EXPENSE_CATS } from '../constants';
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
      // Upload to Supabase Storage
      const [year, month] = currentDate.split('-');
      const timestamp = Date.now();
      const filename = `${timestamp}_${selectedFile.name}`;
      const storagePath = `${year}-${month}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, selectedFile);

      if (uploadError) {
        console.warn('Storage upload failed (bucket may not exist):', uploadError.message);
      }

      setProgress(30);

      // Run OCR with the actual File object
      const parsedItems = await parseReceipt(selectedFile, (p) => {
        setProgress(30 + Math.round(p * 0.6));
      });

      if (!parsedItems || parsedItems.length === 0) {
        showToast('レシートから品目を検出できませんでした');
        setItems([]);
      } else {
        // Claude APIはカテゴリ名を直接返すのでそのまま使用
        // 不明なカテゴリは「その他」にフォールバック
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

  const handleAddItem = () => {
    setItems([...items, { name: '', amount: 0, category: EXPENSE_CATS[0].name }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
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

  const handleConfirm = () => {
    const validItems = items.filter((item) => item.name && item.amount > 0);
    if (validItems.length === 0) {
      showToast('有効な品目を入力してください');
      return;
    }
    onItemsParsed(validItems);
  };

  return (
    <div className="receipt-overlay">
      <div className="receipt-modal">
        <div className="receipt-header">
          <h2>レシート読取</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {toast && <div className="toast">{toast}</div>}

        {/* File Input */}
        {!preview && (
          <div className="receipt-section">
            <label>レシート画像を選択</label>
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
            <img src={preview} alt="レシートプレビュー" className="receipt-preview" />
            <button
              type="button"
              onClick={() => { setPreview(null); setSelectedFile(null); setItems([]); }}
              className="btn-secondary"
            >
              画像を変更
            </button>
          </div>
        )}

        {/* Process Button */}
        {preview && items.length === 0 && !isProcessing && (
          <button onClick={handleUploadAndParse} className="receipt-btn">
            レシートを読み取る
          </button>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="receipt-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: '#F39C12' }} />
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 8 }}>
              読み取り中... {progress}%
            </p>
          </div>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <div className="receipt-section">
            <div className="receipt-items-header">
              <h3>読取結果 ({items.length}件)</h3>
              <button onClick={handleAddItem} className="btn-secondary">+ 追加</button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="receipt-item-row">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                  placeholder="品目名"
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={(e) => handleUpdateItem(index, 'amount', e.target.value)}
                  placeholder="金額"
                  className="form-input"
                  style={{ width: 80 }}
                />
                <select
                  value={item.category}
                  onChange={(e) => handleUpdateItem(index, 'category', e.target.value)}
                  className="form-input"
                  style={{ width: 100 }}
                >
                  {EXPENSE_CATS.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <button onClick={() => handleRemoveItem(index)} className="btn-delete">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="receipt-actions">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          {items.length > 0 && (
            <button onClick={handleConfirm} className="btn-add">確定</button>
          )}
        </div>
      </div>
    </div>
  );
}
