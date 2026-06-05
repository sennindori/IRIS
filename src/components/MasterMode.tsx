import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import JsBarcode from 'jsbarcode';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  Loader2, 
  Database,
  Barcode,
  Building,
  Maximize,
  Clipboard,
  Check,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Star,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { ProductMasterItem } from '../types';
import { generateRecordNumber } from '../lib/id';

function isLargeDrink(sizeStr?: string): boolean {
  if (!sizeStr) return false;
  const clean = sizeStr.toLowerCase().replace(/\s+/g, '');
  
  if (clean.includes('l') && !clean.includes('ml')) {
    const lMatch = clean.match(/^([\d.]+)/);
    if (lMatch) {
      const liters = parseFloat(lMatch[1]);
      return liters >= 1.0;
    }
    return true; // standard L is >= 1.0
  }
  
  const matches = clean.match(/^([\d.]+)/);
  if (matches) {
    const value = parseFloat(matches[1]);
    if (clean.includes('ml') || clean.includes('g') || /^[0-9.]+$/.test(clean)) {
      return value >= 1000;
    }
  }
  return false;
}

interface MasterModeProps {
  onBack: () => void;
}

// Custom Barcode Generator helper component
interface BarcodeGeneratorProps {
  val: string;
}

function BarcodeGenerator({ val }: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (svgRef.current && val) {
      try {
        setError(false);
        // JAN codes in Japan are usually EAN-13 or EAN-8
        const isEan13 = val.length === 13 && /^\d+$/.test(val);
        const isEan8 = val.length === 8 && /^\d+$/.test(val);
        const format = isEan13 ? "EAN13" : isEan8 ? "EAN8" : "CODE128";

        JsBarcode(svgRef.current, val, {
          format: format,
          lineColor: "#000000",
          width: 2.2,
          height: 100,
          displayValue: true,
          fontOptions: "bold",
          fontSize: 16,
          background: "#ffffff",
          margin: 15
        });
      } catch (err) {
        console.error("Barcode generation failed:", err);
        setError(true);
      }
    }
  }, [val]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-950/20 border border-red-900/40 rounded-2xl text-red-400 gap-2">
        <AlertCircle size={24} />
        <p className="text-xs font-bold font-mono">バーコード生成エラー ({val})</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100 flex items-center justify-center overflow-x-auto max-w-full">
      <svg ref={svgRef} className="max-w-full"></svg>
    </div>
  );
}

export default function MasterMode({ onBack }: MasterModeProps) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ProductMasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  
  // Registration form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newJan, setNewJan] = useState('');
  const [newCaseJan, setNewCaseJan] = useState('');
  const [newName, setNewName] = useState('');
  const [newMaker, setNewMaker] = useState('');
  const [newSize, setNewSize] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [newUnit, setNewUnit] = useState('個');
  const [newGenre, setNewGenre] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJan, setEditJan] = useState('');
  const [editCaseJan, setEditCaseJan] = useState('');
  const [editName, setEditName] = useState('');
  const [editMaker, setEditMaker] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editUnit, setEditUnit] = useState('個');
  const [editGenre, setEditGenre] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm state
  const [deletingItem, setDeletingItem] = useState<ProductMasterItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Barcode Popup State
  const [barcodeItem, setBarcodeItem] = useState<ProductMasterItem | null>(null);

  // Standard items state and listener
  const [standardItems, setStandardItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'standard_items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .filter(doc => !doc.data().isDeleted)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      setStandardItems(data);
    }, (error) => {
      console.error("Failed to fetch standard items:", error);
    });
    return () => unsubscribe();
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStd, setFilterStd] = useState<'all' | 'std' | 'unregistered'>('all');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [filterSize, setFilterSize] = useState<'all' | 'large' | 'small'>('all');

  // CSV Import/Export States
  const [csvPreviewItems, setCsvPreviewItems] = useState<any[]>([]);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{current: number; total: number; phase: 'delete' | 'import'} | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV line parsing helper handling quotes, escaped quotes, and commas
  function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let curVal = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          curVal += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(curVal);
        curVal = '';
      } else {
        curVal += char;
      }
    }
    result.push(curVal);
    return result;
  }

  // Handle export to CSV
  function handleCsvExport() {
    if (items.length === 0) {
      alert("エクスポートする商品マスタがありません。");
      return;
    }

    try {
      const csvContent = "\uFEFF" + [ // Add BOM for Excel compatibility in Japanese encoding
        ['RECORD_#', 'JAN_プライマリ', 'JAN_セカンダリ', '商品名', 'メーカー', 'サイズ', '単位', '備考', 'ジャンル'].join(','),
        ...items.map(item => [
          `"${(item.recordNumber || '').replace(/"/g, '""')}"`,
          `"${(item.janCode || '').replace(/"/g, '""')}"`,
          `"${(item.caseJanCode || '').replace(/"/g, '""')}"`,
          `"${(item.productName || '').replace(/"/g, '""')}"`,
          `"${(item.maker || '').replace(/"/g, '""')}"`,
          `"${(item.size || '').replace(/"/g, '""')}"`,
          `"${(item.unit || '').replace(/"/g, '""')}"`,
          `"${(item.remarks || '').replace(/"/g, '""')}"`,
          `"${(item.genre || '').replace(/"/g, '""')}"`,
        ].join(','))
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19);
      link.setAttribute("href", url);
      link.setAttribute("download", `商品マスタ_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV Export failed:", err);
      alert("CSVのエクスポートに失敗しました。");
    }
  }

  // Handle CSV file selection and preparation
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset value so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      parseCSV(text);
    };
    reader.onerror = () => {
      alert("ファイルの読み込みに失敗しました。");
    };
    reader.readAsText(file);
  }

  // Parse CSV text and show preview
  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || !lines[0]) {
      alert("CSVファイルが空です。");
      return;
    }

    // Parse headers
    const headerRow = parseCSVLine(lines[0]);
    
    // Find matching columns
    let recordNumberIdx = -1;
    let janPrimaryIdx = -1;
    let janSecondaryIdx = -1;
    let nameIdx = -1;
    let makerIdx = -1;
    let sizeIdx = -1;
    let unitIdx = -1;
    let remarksIdx = -1;
    let genreIdx = -1;

    headerRow.forEach((h, index) => {
      const headerStr = h.trim().toLowerCase();
      if (['record_#', 'record_number', 'recordnumber', 'record#', 'レコード番号', 'レコード#', 'record_no', 'record_id'].includes(headerStr)) {
        recordNumberIdx = index;
      } else if (['jan_プライマリ', 'jan_primary', 'janプライマリ', 'primary_jan', 'primary jan', 'janコード', 'janコード(品番)', 'jancode', 'jan', 'jan_code', '品番', 'コード', 'barcode'].includes(headerStr)) {
        janPrimaryIdx = index;
      } else if (['jan_セカンダリ', 'jan_secondary', 'janセカンダリ', 'secondary_jan', 'secondary jan', 'ケースjan', 'case_jan', 'casejan', 'ケースjanコード'].includes(headerStr)) {
        janSecondaryIdx = index;
      } else if (['商品名', '商品名(必須)', 'productname', 'name', '品名', '商品', 'title'].includes(headerStr)) {
        nameIdx = index;
      } else if (['メーカー', 'メーカー(ブランド)', 'maker', 'brand', 'メーカー名', 'ブランド', 'manufacturer'].includes(headerStr)) {
        makerIdx = index;
      } else if (['サイズ', 'サイズ/容量/仕様', 'サイズ(容量等)', 'size', '容量', '規格', 'capacity'].includes(headerStr)) {
        sizeIdx = index;
      } else if (['単位', 'デフォルト単位', 'unit'].includes(headerStr)) {
        unitIdx = index;
      } else if (['備考', '備考(保管場所や発注詳細など)', 'remarks', 'memo', 'メモ'].includes(headerStr)) {
        remarksIdx = index;
      } else if (['ジャンル', '分類', 'カテゴリ', 'category', 'genre'].includes(headerStr)) {
        genreIdx = index;
      }
    });

    // Fallbacks based on typical column order if headers are missing or custom
    const anyHeaderMatched = recordNumberIdx !== -1 || janPrimaryIdx !== -1 || janSecondaryIdx !== -1 || nameIdx !== -1 || makerIdx !== -1 || sizeIdx !== -1 || unitIdx !== -1 || remarksIdx !== -1 || genreIdx !== -1;

    if (!anyHeaderMatched) {
      // If no headers matched at all, assume the export layout or legacy layout
      if (headerRow.length >= 9) {
        recordNumberIdx = 0;
        janPrimaryIdx = 1;
        janSecondaryIdx = 2;
        nameIdx = 3;
        makerIdx = 4;
        sizeIdx = 5;
        unitIdx = 6;
        remarksIdx = 7;
        genreIdx = 8;
      } else {
        janPrimaryIdx = 0;
        janSecondaryIdx = 1;
        nameIdx = 2;
        if (headerRow.length > 3) makerIdx = 3;
        if (headerRow.length > 4) sizeIdx = 4;
        if (headerRow.length > 5) unitIdx = 5;
        if (headerRow.length > 6) remarksIdx = 6;
        if (headerRow.length > 7) genreIdx = 7;
      }
    }

    if (janPrimaryIdx === -1 || nameIdx === -1) {
      alert("JAN_プライマリ及び商品名に該当する列が見つかりません。ヘッダー（1行目）に「JAN_プライマリ」と「商品名」を記載してください。");
      return;
    }

    const parsedItems: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      const rawPrimary = cols[janPrimaryIdx] ? cols[janPrimaryIdx].trim() : '';
      const cleanPrimary = rawPrimary.replace(/[^0-9]/g, '');

      const rawSecondary = janSecondaryIdx !== -1 && cols[janSecondaryIdx] ? cols[janSecondaryIdx].trim() : '';
      const cleanSecondary = rawSecondary.replace(/[^0-9]/g, '');

      const productName = cols[nameIdx] ? cols[nameIdx].trim() : '';

      if (!cleanPrimary || !productName) continue; // Skip incomplete or header lines

      parsedItems.push({
        janCode: cleanPrimary,
        caseJanCode: cleanSecondary || '',
        productName: productName,
        maker: makerIdx !== -1 && cols[makerIdx] ? cols[makerIdx].trim() : '',
        size: sizeIdx !== -1 && cols[sizeIdx] ? cols[sizeIdx].trim() : '',
        unit: unitIdx !== -1 && cols[unitIdx] ? cols[unitIdx].trim() : '個',
        remarks: remarksIdx !== -1 && cols[remarksIdx] ? cols[remarksIdx].trim() : '',
        genre: genreIdx !== -1 && cols[genreIdx] ? cols[genreIdx].trim() : '',
        recordNumber: recordNumberIdx !== -1 && cols[recordNumberIdx] ? cols[recordNumberIdx].trim() : ''
      });
    }

    if (parsedItems.length === 0) {
      alert("有効なデータ行（JAN_プライマリと商品名が入っている行）が見つかりませんでした。");
      return;
    }

    setCsvPreviewItems(parsedItems);
    setIsCsvModalOpen(true);
  }

  // Execute the import process to Firestore (Deletes all existing master items first, then imports new)
  async function runCsvImport() {
    setIsImporting(true);
    let deletedCount = 0;
    let added = 0;
    const total = csvPreviewItems.length;

    try {
      // 1. Delete all existing master items
      const itemsToDelete = [...items];
      const totalToDelete = itemsToDelete.length;

      for (let i = 0; i < totalToDelete; i++) {
        const item = itemsToDelete[i];
        await deleteDoc(doc(db, 'product_master', item.id));
        deletedCount++;
        setImportProgress({ current: i + 1, total: totalToDelete, phase: 'delete' });

        // Breath periodically to let UI render and keep firestore happy
        if (i % 25 === 0) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      // 2. Import new items
      setImportProgress({ current: 0, total, phase: 'import' });
      const allRecordNumbers = new Set<string>();

      for (let i = 0; i < total; i++) {
        const itemData = csvPreviewItems[i];
        
        let finalRecordNumber = '';
        if (itemData.recordNumber && itemData.recordNumber.trim()) {
          const trimmed = itemData.recordNumber.trim().toUpperCase();
          if (!allRecordNumbers.has(trimmed)) {
            finalRecordNumber = trimmed;
            allRecordNumbers.add(finalRecordNumber);
          } else {
            finalRecordNumber = generateRecordNumber(Array.from(allRecordNumbers));
            allRecordNumbers.add(finalRecordNumber);
          }
        } else {
          finalRecordNumber = generateRecordNumber(Array.from(allRecordNumbers));
          allRecordNumbers.add(finalRecordNumber);
        }

        const payload = {
          janCode: itemData.janCode,
          caseJanCode: itemData.caseJanCode || null,
          productName: itemData.productName,
          maker: itemData.maker || null,
          size: itemData.size || null,
          unit: itemData.unit || null,
          remarks: itemData.remarks || null,
          genre: itemData.genre || null,
          recordNumber: finalRecordNumber
        };

        await addDoc(collection(db, 'product_master'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        added++;

        setImportProgress({ current: i + 1, total, phase: 'import' });

        if (i % 15 === 0) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }

      alert(`CSVインポートが完了しました！\n既存データを全 ${deletedCount} 件削除し、新規に ${added} 件のマスタデータを登録しました。`);
      setIsCsvModalOpen(false);
      setCsvPreviewItems([]);
      setImportProgress(null);
    } catch (err) {
      console.error("CSV import execution error:", err);
      alert("インポート処理中にエラーが発生しました。");
    } finally {
      setIsImporting(false);
    }
  }

  // Helper to parse standard item name, extractor for product name, size & maker
  function parseStandardItem(item: { name: string; maker?: string | null }) {
    let tempName = item.name.trim();
    let maker = (item.maker || "").trim();
    let size = "";

    // 1. If maker is empty and tempName is separated by spaces, take the first segment as maker
    if (!maker) {
      const spaceIndex = tempName.search(/[\s　]/);
      if (spaceIndex !== -1) {
        maker = tempName.substring(0, spaceIndex).trim();
        tempName = tempName.substring(spaceIndex + 1).trim();
      }
    }

    // 2. Extract size (end of the string matching digits + capacity units)
    const sizeRegex = /([\d\.]+\s*(?:ml|mL|ML|l|L|g|G|kg|KG|本|缶|パック|P|p|袋|個)|[０-９．]+\s*(?:ｍｌ|ｍＬ|ＭＬ|ｌ|Ｌ|ｇ|Ｇ|ｋｇ|ＫＧ|本|缶|パック|Ｐ|ｐ|袋|個))$/i;
    const match = tempName.match(sizeRegex);
    if (match) {
      size = match[1].trim();
      tempName = tempName.substring(0, match.index).trim();
    }

    return {
      maker: maker || null,
      productName: tempName,
      size: size || null
    };
  }

  async function handleSyncFromStandard() {
    if (standardItems.length === 0) {
      alert("同期するSTD商品がありません。");
      return;
    }

    if (!confirm(`現在登録されているSTD商品（${standardItems.length}件）を、サイズなどで区切って商品マスタデータベースに反映（新規追加・更新）しますか？`)) {
      return;
    }

    setIsSyncing(true);
    let addedCount = 0;
    let skippedCount = 0;

    try {
      for (const std of standardItems) {
        if (!std.janCode) {
          skippedCount++;
          continue;
        }

        // Check if already registered in product_master
        const isDuplicated = items.some(item => item.janCode === std.janCode);
        if (isDuplicated) {
          skippedCount++;
          continue;
        }

        // Parse name into separate maker, name, and size fields
        const parsed = parseStandardItem({
          name: std.name || "",
          maker: std.maker || ""
        });

        await addDoc(collection(db, 'product_master'), {
          janCode: std.janCode.trim(),
          productName: parsed.productName.trim(),
          maker: parsed.maker ? parsed.maker.trim() : null,
          size: parsed.size ? parsed.size.trim() : null,
          remarks: null,
          recordNumber: generateRecordNumber(),
          createdAt: serverTimestamp()
        });

        addedCount++;
      }

      alert(`一括反映が完了しました！\n新規登録: ${addedCount} 件\n重複またはスキップ: ${skippedCount} 件`);
    } catch (err) {
      console.error("STD同期エラー: ", err);
      alert("反映処理中にエラーが発生しました。");
    } finally {
      setIsSyncing(false);
    }
  }

  // Register an item to standard list
  async function handleRegisterToStandard(item: ProductMasterItem) {
    try {
      await addDoc(collection(db, 'standard_items'), {
        name: item.productName,
        maker: item.maker || null,
        janCode: item.janCode,
        sortOrder: Date.now(),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to register standard item:", err);
      alert("STD登録に失敗しました。");
    }
  }

  // Remove an item from standard list
  async function handleRemoveFromStandard(item: ProductMasterItem) {
    const matched = standardItems.find(std => std.janCode === item.janCode);
    if (!matched) return;
    try {
      await deleteDoc(doc(db, 'standard_items', matched.id));
    } catch (err) {
      console.error("Failed to remove standard item:", err);
      alert("STD解除に失敗しました。");
    }
  }

  // Real-time Master DB listener
  useEffect(() => {
    const q = query(collection(db, 'product_master'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProductMasterItem[];
      setItems(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to fetch product master items:", error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter items in UI
  const filteredItems = items.filter(item => {
    // 1. STD classification filter
    if (filterStd === 'std') {
      const isStd = standardItems.some(std => std.janCode === item.janCode);
      if (!isStd) return false;
    } else if (filterStd === 'unregistered') {
      const isStd = standardItems.some(std => std.janCode === item.janCode);
      if (isStd) return false;
    }

    // 2. Genre filter
    if (filterGenre !== 'all') {
      if (filterGenre === 'unassigned') {
        const hasGenre = item.genre && item.genre.trim() !== '';
        if (hasGenre) return false;
      } else {
        if (item.genre !== filterGenre) {
          return false;
        }
      }
    }

    // 2.5. Size filter
    if (filterSize !== 'all') {
      const isLarge = isLargeDrink(item.size || '');
      if (filterSize === 'large' && !isLarge) return false;
      if (filterSize === 'small' && isLarge) return false;
    }

    // 3. Search text filter
    const term = search.toLowerCase();
    return (
      item.productName.toLowerCase().includes(term) ||
      (item.maker && item.maker.toLowerCase().includes(term)) ||
      item.janCode.includes(term) ||
      (item.caseJanCode && item.caseJanCode.includes(term)) ||
      (item.size && item.size.toLowerCase().includes(term)) ||
      (item.remarks && item.remarks.toLowerCase().includes(term))
    );
  });

  // Paste JAN from Clipboard helper
  async function handlePasteJan() {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/[^0-9]/g, '');
      if (digits.length >= 8) {
        setNewJan(digits);
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      } else {
        alert("クリップボードに有効な数字コード（8桁または13桁以上）が見つかりませんでした。");
      }
    } catch (err) {
      alert("クリップボードの読み取り権限がないか、取得できません。");
    }
  }

  // Register master item handler
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    const cleanJan = newJan.trim();
    const cleanCaseJan = newCaseJan.trim();

    if (!cleanJan || !newName.trim()) {
      alert("JAN_プライマリと商品名は必須項目です。");
      return;
    }
    
    // Check if standard JAN or case JAN already exists in other items
    const duplicated = items.find(item => {
      const matchJan = item.janCode === cleanJan || (item.caseJanCode && item.caseJanCode === cleanJan);
      const matchCaseJan = cleanCaseJan && (item.janCode === cleanCaseJan || (item.caseJanCode && item.caseJanCode === cleanCaseJan));
      return matchJan || matchCaseJan;
    });

    if (duplicated) {
      alert(`このJAN（${cleanJan}${cleanCaseJan ? ` または ${cleanCaseJan}` : ''}）はすでに「${duplicated.productName}」として登録されています。`);
      return;
    }

    setIsRegistering(true);
    try {
      await addDoc(collection(db, 'product_master'), {
        janCode: cleanJan,
        caseJanCode: cleanCaseJan || null,
        productName: newName.trim(),
        maker: newMaker.trim() || null,
        size: newSize.trim() || null,
        remarks: newRemarks.trim() || null,
        unit: newUnit || null,
        genre: newGenre.trim() || null,
        recordNumber: generateRecordNumber(),
        createdAt: serverTimestamp()
      });
      // Reset form states
      setNewJan('');
      setNewCaseJan('');
      setNewName('');
      setNewMaker('');
      setNewSize('');
      setNewRemarks('');
      setNewUnit('個');
      setNewGenre('');
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to register master item:", err);
      alert("登録に失敗しました。認証やフォーマットを確認してください。");
    } finally {
      setIsRegistering(false);
    }
  }

  // Start edit handler
  function startEdit(item: ProductMasterItem) {
    setEditingId(item.id);
    setEditJan(item.janCode);
    setEditCaseJan(item.caseJanCode || '');
    setEditName(item.productName);
    setEditMaker(item.maker || '');
    setEditSize(item.size || '');
    setEditRemarks(item.remarks || '');
    setEditUnit(item.unit || '個');
    setEditGenre(item.genre || '');
  }

  // Cancel edit
  function cancelEdit() {
    setEditingId(null);
  }

  // Save edit handler
  async function handleSaveEdit(id: string) {
    const janClean = editJan.trim();
    const caseJanClean = editCaseJan.trim();
    
    if (!janClean) {
      alert("JAN_プライマリは必須項目です。");
      return;
    }
    if (!editName.trim()) {
      alert("商品名は必須です。");
      return;
    }

    const duplicate = items.find(item => {
      if (item.id === id) return false;
      const matchJan = item.janCode === janClean || (item.caseJanCode && item.caseJanCode === janClean);
      const matchCaseJan = caseJanClean && (item.janCode === caseJanClean || (item.caseJanCode && item.caseJanCode === caseJanClean));
      return matchJan || matchCaseJan;
    });

    if (duplicate) {
      alert(`このJAN（${janClean}${caseJanClean ? ` または ${caseJanClean}` : ''}）はすでに「${duplicate.productName}」として登録されています。`);
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'product_master', id), {
        janCode: janClean,
        caseJanCode: caseJanClean || null,
        productName: editName.trim(),
        maker: editMaker.trim() || null,
        size: editSize.trim() || null,
        remarks: editRemarks.trim() || null,
        unit: editUnit || null,
        genre: editGenre.trim() || null
      });
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update item:", err);
      alert("更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  // Delete item handler
  async function handleDeleteItem() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'product_master', deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error("Failed to delete master item:", err);
      alert("削除に失敗しました。");
    } finally {
      setIsDeleting(false);
    }
  }



  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-950 font-sans text-white overflow-hidden pt-[env(safe-area-inset-top)]">
      
      {/* HEADER SECTION */}
      <header className="px-4 py-4 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full active:scale-90 transition-transform"
            title="メニューに戻る"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-1.5 leading-none">
              <Database size={16} className="text-blue-400" />
              商品マスタデータベース
            </h1>
            <p className="text-[10px] text-gray-400 font-bold mt-1 leading-none uppercase tracking-wider">
              Product Master Manager ({items.length}件登録)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl active:scale-95 transition-all shadow-lg shadow-blue-950/20 cursor-pointer"
          >
            <Plus size={14} />
            新規追加
          </button>
        </div>
      </header>

      {/* SEARCH / CONTROLS */}
      <div className="p-3 bg-gray-900/30 border-b border-gray-800 shrink-0">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {/* Accordion Trigger Header */}
          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-900 hover:bg-gray-850 border border-gray-800 rounded-xl transition-all duration-200 active:scale-[0.99] cursor-pointer group"
            id="toggle-master-filters"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Search size={14} className="text-blue-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="text-xs font-black text-gray-200 whitespace-nowrap">
                検索・フィルター・CSV操作
              </span>
              {/* Active filters status badge */}
              {(search || filterStd !== 'all' || filterGenre !== 'all' || filterSize !== 'all') && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 font-extrabold whitespace-nowrap">
                {isFiltersExpanded ? '折りたたむ' : '展開する'}
              </span>
              <motion.div
                animate={{ rotate: isFiltersExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-gray-400 shrink-0"
              >
                <ChevronDown size={14} />
              </motion.div>
            </div>
          </button>

          {/* Active filter summary info when collapsed */}
          {!isFiltersExpanded && (search || filterStd !== 'all' || filterGenre !== 'all' || filterSize !== 'all') && (
            <div className="flex items-center gap-1.5 flex-wrap px-1.5 py-1">
              {search && (
                <span className="bg-blue-500/10 text-blue-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-blue-500/10 max-w-[120px] truncate" title={search}>
                  🔍 {search}
                </span>
              )}
              {filterStd !== 'all' && (
                <span className="bg-amber-500/10 text-amber-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-amber-500/10">
                  ⭐️ {filterStd === 'std' ? 'STD' : '非STD'}
                </span>
              )}
              {filterGenre !== 'all' && (
                <span className="bg-purple-500/10 text-purple-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-purple-500/10">
                  📁 {filterGenre === 'unassigned' ? '未設定' : filterGenre}
                </span>
              )}
              {filterSize !== 'all' && (
                <span className="bg-teal-500/10 text-teal-400 text-[9px] px-1.5 py-0.5 rounded font-black border border-teal-500/10">
                  🥤 {filterSize === 'large' ? '大' : '小'}
                </span>
              )}
            </div>
          )}

          <motion.div
            initial={false}
            animate={{
              height: isFiltersExpanded ? 'auto' : 0,
              opacity: isFiltersExpanded ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="w-full overflow-hidden"
          >
            <div className="flex flex-col gap-3 pt-2">
              {/* Main search and CSV actions row */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="品番(JAN_プライマリ/セカンダリ)、商品名、メーカー、サイズから検索..."
                    className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 text-xs font-bold placeholder:text-gray-500 text-white outline-none transition-all"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-700 hover:bg-gray-655 rounded-full text-gray-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleCsvExport}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-800 hover:bg-gray-755 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="マスタ全件をCSVダウンロード"
                  >
                    <Download size={13} className="text-blue-400" />
                    CSV出力
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-3 bg-gray-800 hover:bg-gray-755 border border-gray-700 text-gray-200 font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="CSVファイルをアップロードして一括登録・更新"
                  >
                    <Upload size={13} className="text-teal-400" />
                    CSV取込
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Detailed filters row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-gray-900/60 p-3 rounded-2xl border border-gray-800/85">
                {/* STD classification selector */}
                <div className="flex flex-col text-left gap-1.5">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Star size={10} className="fill-amber-500 text-amber-500" />
                    STD区分
                  </span>
                  <select
                    value={filterStd}
                    onChange={(e) => setFilterStd(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-755 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[11px] cursor-pointer transition-all"
                  >
                    <option value="all">全て表示</option>
                    <option value="std">⭐️ STD登録済</option>
                    <option value="unregistered">⚪️ STD未登録</option>
                  </select>
                </div>

                {/* Genre classification selector */}
                <div className="flex flex-col text-left gap-1.5">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Filter size={10} className="text-purple-400" />
                    ジャンル
                  </span>
                  <select
                    value={filterGenre}
                    onChange={(e) => setFilterGenre(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-755 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[11px] cursor-pointer transition-all"
                  >
                    <option value="all">すべてのジャンル</option>
                    <option value="unassigned">未設定</option>
                    <option value="水・炭酸水">水・炭酸水</option>
                    <option value="茶系飲料">茶系飲料</option>
                    <option value="ジュース">ジュース</option>
                    <option value="紅茶・コーヒー">紅茶・コーヒー</option>
                    <option value="健康飲料">健康飲料</option>
                    <option value="エナジー飲料">エナジー飲料</option>
                  </select>
                </div>

                {/* Size classification selector */}
                <div className="flex flex-col text-left gap-1.5">
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider pl-1 flex items-center gap-1">
                    <span className="text-xs">🥤</span>
                    容量サイズ
                  </span>
                  <select
                    value={filterSize}
                    onChange={(e) => setFilterSize(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-755 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-[11px] cursor-pointer transition-all"
                  >
                    <option value="all">すべて表示</option>
                    <option value="large">大飲料 (1000ml以上)</option>
                    <option value="small">小飲料 (1000ml未満)</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
            <Loader2 className="animate-spin text-blue-500" size={36} />
            <p className="text-xs font-black tracking-widest uppercase">マスタデータを取得中...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 max-w-sm mx-auto">
            <AlertCircle size={44} className="text-gray-600 mb-3" />
            <p className="text-sm font-black text-gray-300">商品マスタが見つかりません</p>
            <p className="text-xs text-gray-400 leading-relaxed mt-2.5">
              まだマスタデータが登録されていないか、検索キーワードに該当がないようです。右上の<strong>「新規追加」</strong>から手動で登録、またはバーコードリーダーから保存してください。
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3 pb-8">
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id;
              
              return (
                <div 
                  key={item.id}
                  className={`relative bg-gray-900 border ${
                    isEditing ? 'border-blue-500/50 ring-4 ring-blue-950/30' : 'border-gray-800 hover:border-gray-700/80'
                  } rounded-2xl p-4 transition-all shadow-md`}
                >
                  {isEditing ? (
                    /* EDITING VIEW */
                    <div className="space-y-4 text-left">
                      <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-2.5">
                        <span className="text-xs font-black font-sans text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                          <Edit2 size={13} className="text-blue-400" />
                          商品マスタ編集
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 px-3 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white font-bold text-[10px] rounded-xl transition-all cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isSaving}
                            className="p-1.5 px-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-black text-[10px] rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-950/20 cursor-pointer"
                          >
                            {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                            マスタに保存
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-455 font-black uppercase">JAN_プライマリ (必須・数字)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editJan}
                            onChange={(e) => setEditJan(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="JAN_プライマリ"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-455 font-black uppercase">JAN_セカンダリ (任意・数字)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editCaseJan}
                            onChange={(e) => setEditCaseJan(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="JAN_セカンダリ"
                          />
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-456 font-black uppercase">商品名 (必須)</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="商品名"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-457 font-black uppercase">メーカー</label>
                          <input
                            type="text"
                            value={editMaker}
                            onChange={(e) => setEditMaker(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="メーカー名"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-458 font-black uppercase">サイズ (容量等)</label>
                          <input
                            type="text"
                            value={editSize}
                            onChange={(e) => setEditSize(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="例: 500ml, 3P"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-459 font-black uppercase">デフォルト単位</label>
                          <select
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-xs text-white outline-none cursor-pointer"
                          >
                            <option value="個">個</option>
                            <option value="ケース">ケース</option>
                            <option value="袋">袋</option>
                            <option value="本">本</option>
                            <option value="パック">パック</option>
                            <option value="缶">缶</option>
                            <option value="シート">シート</option>
                            <option value="その他">その他</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-455 font-black uppercase">ジャンル</label>
                          <select
                            value={editGenre}
                            onChange={(e) => setEditGenre(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-xs text-white outline-none cursor-pointer"
                          >
                            <option value="">未設定</option>
                            <option value="水・炭酸水">水・炭酸水</option>
                            <option value="茶系飲料">茶系飲料</option>
                            <option value="ジュース">ジュース</option>
                            <option value="紅茶・コーヒー">紅茶・コーヒー</option>
                            <option value="健康飲料">健康飲料</option>
                            <option value="エナジー飲料">エナジー飲料</option>
                          </select>
                        </div>

                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] text-gray-405 font-black uppercase">備考</label>
                          <input
                            type="text"
                            value={editRemarks}
                            onChange={(e) => setEditRemarks(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 placeholder:text-gray-650 font-bold text-xs text-white"
                            placeholder="備考を入力"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* DISPLAY VIEW */
                    <div className="flex flex-col text-left w-full gap-3">
                      {/* 1行目: メーカー名、ジャンル、編集ボタン、削除ボタン */}
                      <div className="flex items-center justify-between gap-2.5 w-full">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.maker ? (
                            <span className="text-[10px] font-black text-gray-300 bg-gray-800/80 border border-gray-700/65 px-2 py-0.5 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                              <Building size={9} className="text-gray-400" />
                              {item.maker}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-850/60 border border-gray-800/40 px-2 py-0.5 rounded-lg">
                              メーカー未設定
                            </span>
                          )}
                          {item.genre && (
                            <span className="text-[10px] font-black text-gray-300 bg-gray-800/80 border border-gray-700/65 px-2 py-0.5 rounded-lg">
                              {item.genre}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 bg-blue-950/40 hover:bg-blue-900/40 text-blue-400 hover:text-blue-300 rounded-lg active:scale-95 transition-all border border-blue-900/30 shadow-sm flex items-center justify-center cursor-pointer"
                            title="マスタ情報を編集"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 bg-red-950/45 hover:bg-red-900/45 text-red-400 hover:text-red-350 rounded-lg active:scale-95 transition-all border border-red-900/20 shadow-sm flex items-center justify-center cursor-pointer"
                            title="削除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* 2行目: 大きく商品名 */}
                      <h3 className="text-base font-black text-white tracking-tight leading-snug">
                        {item.productName}
                      </h3>

                      {/* 罫線 */}
                      <div className="border-b border-gray-800/80 my-0.5" />

                      {/* 3行目: サイズ、単位 */}
                      <div className="flex flex-wrap items-center gap-2">
                        {item.size ? (
                          <span className="text-[11px] font-extrabold text-gray-300 bg-gray-800/80 border border-gray-700/65 px-2 py-0.5 rounded-lg">
                            サイズ: {item.size}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-400 border border-transparent px-2 py-0.5">
                            サイズ: 未設定
                          </span>
                        )}
                        {item.unit && (
                          <span className="text-[11px] font-extrabold text-gray-300 bg-gray-800/80 border border-gray-700/65 px-2 py-0.5 rounded-lg">
                            単位: {item.unit}
                          </span>
                        )}
                      </div>

                      {/* 備考欄（あれば表示） */}
                      {item.remarks && (
                        <p className="text-[10px] text-gray-300 font-medium leading-normal p-1.5 px-2.5 bg-gray-850/35 border border-gray-800/35 rounded-xl flex items-start gap-1">
                          <span className="text-gray-400 font-bold shrink-0">備考:</span>
                          <span>{item.remarks}</span>
                        </p>
                      )}

                      {/* ２カラム２行のグリッド構造 */}
                      <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-1.5">
                        {/* 1行目・左（カラム1）: プライマリJAN */}
                        <div className="flex items-center justify-start w-full">
                          <button
                            onClick={() => setBarcodeItem(item)}
                            className="w-full text-[11px] font-bold font-mono tracking-tight text-orange-400 bg-orange-950/20 hover:bg-orange-950/40 border border-orange-900/30 px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
                            title="クリックしてプライマリバーコードを表示"
                          >
                            <Barcode size={12} className="text-orange-400 shrink-0" />
                            <span className="truncate">{item.janCode}</span>
                          </button>
                        </div>

                        {/* 1行目・右（カラム2）: セカンダリJAN */}
                        <div className="flex items-center justify-start w-full">
                          {item.caseJanCode ? (
                            <button
                              onClick={() => setBarcodeItem({ ...item, janCode: item.caseJanCode! })}
                              className="w-full text-[11px] font-bold font-mono tracking-tight text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/30 px-2 py-1 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
                              title="クリックしてセカンダリバーコードを表示"
                            >
                              <Barcode size={12} className="text-emerald-400 shrink-0" />
                              <span className="truncate">{item.caseJanCode}</span>
                            </button>
                          ) : (
                            <div className="h-7 w-full border border-dashed border-gray-800/45 rounded-lg flex items-center justify-center text-[10px] text-gray-600 font-bold">
                              ケースなし
                            </div>
                          )}
                        </div>

                        {/* 2行目・左（カラム1）: 空欄またはプレースホルダー */}
                        <div className="flex items-center">
                          {/* 空欄 */}
                        </div>

                        {/* 2行目・右（カラム2、右下）: STD定番登録ボタン */}
                        <div className="flex items-center justify-end w-full">
                          {standardItems.some((std) => std.janCode === item.janCode) ? (
                            <button
                              onClick={() => handleRemoveFromStandard(item)}
                              className="px-2.5 py-1 bg-blue-950/50 hover:bg-blue-900/40 border border-blue-900/40 text-[10px] font-black rounded-lg flex items-center justify-center gap-1.5 text-blue-400 hover:text-blue-300 transition-all active:scale-95 cursor-pointer shadow-md w-full sm:w-auto"
                              title="クリックしてSTDから解除"
                            >
                              <Check size={11} className="text-blue-400 shrink-0" />
                              <span>STD</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRegisterToStandard(item)}
                              className="px-2.5 py-1 bg-gray-800 hover:bg-blue-950/30 hover:text-blue-400 border border-gray-700/60 hover:border-blue-900/30 text-[10px] text-gray-400 font-extrabold rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md w-full sm:w-auto"
                              title="クリックしてSTDとして起用"
                            >
                              <span className="text-xs leading-none font-bold text-blue-400/90">+</span>
                              <span>STD</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MASTER ITEM BOTTOM SHEET / OVERLAY */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-lg bg-gray-900 border-t border-gray-800 rounded-t-[32px] sm:rounded-b-[32px] sm:border p-6 shadow-2xl z-10 text-left overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-800">
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Plus size={16} className="text-blue-400" />
                  マスタに新規商品を登録
                </h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4 font-sans text-xs">
                
                {/* JAN input */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">JAN_プライマリ (品番) *必須</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={newJan}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNewJan(val);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm tracking-widest font-mono"
                      placeholder="例: 4901301236547"
                    />
                    <button
                      type="button"
                      onClick={handlePasteJan}
                      className="px-3 bg-gray-800 hover:bg-gray-755 border border-gray-700 hover:border-gray-600 rounded-xl font-bold flex items-center gap-1 active:scale-95 transition-all text-gray-200 shadow-sm"
                      title="クリップボードからJANを抽出貼り付け"
                    >
                      {pasteSuccess ? (
                        <>
                          <Check size={14} className="text-green-400" />
                          <span className="text-[10px] font-black">貼付完了</span>
                        </>
                      ) : (
                        <>
                          <Clipboard size={14} />
                          <span className="text-[10px] font-black">貼付(📋)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Case JAN input */}
                <div className="space-y-1.55">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">JAN_セカンダリ (任意)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newCaseJan}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setNewCaseJan(val);
                    }}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm tracking-widest font-mono"
                    placeholder="例: 14901301236544"
                  />
                </div>

                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">商品名 *必須</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                    placeholder="例: アタック抗菌EX部屋干し用 詰め替え"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Maker */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">メーカー (ブランド)</label>
                    <input
                      type="text"
                      value={newMaker}
                      onChange={(e) => setNewMaker(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                      placeholder="例: 花王"
                    />
                  </div>

                  {/* Size */}
                  <div className="space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">サイズ / 容量 / 仕様</label>
                    <input
                      type="text"
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                      placeholder="例: 1000g, 4.2kg"
                    />
                  </div>

                  {/* Unit */}
                  <div className="space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">デフォルト単位</label>
                    <select
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                    >
                      <option value="個">個</option>
                      <option value="ケース">ケース</option>
                      <option value="袋">袋</option>
                      <option value="本">本</option>
                      <option value="パック">パック</option>
                      <option value="缶">缶</option>
                      <option value="シート">シート</option>
                      <option value="その他">その他</option>
                    </select>
                  </div>

                  {/* Genre */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">ジャンル (分類)</label>
                    <select
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      className="w-full px-4 py-3.5 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-sm"
                    >
                      <option value="">未設定 (またはその他)</option>
                      <option value="水・炭酸水">水・炭酸水</option>
                      <option value="茶系飲料">茶系飲料</option>
                      <option value="ジュース">ジュース</option>
                      <option value="紅茶・コーヒー">紅茶・コーヒー</option>
                      <option value="健康飲料">健康飲料</option>
                      <option value="エナジー飲料">エナジー飲料</option>
                    </select>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-gray-400 font-black uppercase tracking-wider pl-0.5">備考 (保管場所や発注詳細など)</label>
                  <textarea
                    value={newRemarks}
                    onChange={(e) => setNewRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-4 focus:ring-blue-950 focus:border-blue-500 outline-none font-bold text-xs leading-relaxed resize-none"
                    placeholder="例: A-3棚上、バラ、催事コーナー等"
                  />
                </div>

                <div className="pt-4 flex gap-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-4 bg-gray-800 text-gray-300 font-bold rounded-xl active:scale-95 hover:bg-gray-750 transition-all text-center text-xs"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl active:scale-[0.98] transition-all text-center tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20"
                  >
                    {isRegistering ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    マスターに登録
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION INTERFACE */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-14 h-14 bg-red-950/40 text-red-400 border border-red-900/45 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce" style={{ animationDuration: '3s' }}>
                <Trash2 size={24} />
              </div>
              
              <h3 className="text-base font-black text-white leading-tight mb-2">
                マスタから削除しますか？
              </h3>
              
              <p className="text-xs text-gray-400 font-medium leading-relaxed px-4 mb-5">
                本当に 「<strong className="text-gray-200">{deletingItem.productName}</strong>」 のマスタ情報を完全に削除してもよろしいですか？この操作は取り消せません。
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingItem(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold rounded-xl active:scale-95 transition-all text-xs"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteItem}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-black rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : null}
                  完全に削除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BARCODE POPUP INTERFACE */}
      <AnimatePresence>
        {barcodeItem && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBarcodeItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 210 }}
              className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-[32px] p-6 shadow-2xl z-10 text-center overflow-hidden"
            >
              <button
                onClick={() => setBarcodeItem(null)}
                className="absolute right-4 top-4 p-2 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white rounded-full transition-colors active:scale-95"
                title="閉じる"
              >
                <X size={16} />
              </button>

              <div className="mb-4 text-left">
                <span className="text-[10px] bg-blue-905 border border-blue-900/60 text-blue-400 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                  バーコード表示
                </span>
                <h3 className="text-sm font-black text-white leading-tight mt-3">
                  {barcodeItem.productName}
                </h3>
                {(barcodeItem.maker || barcodeItem.size) && (
                  <p className="text-[11px] text-gray-400 font-bold mt-1.5 flex gap-2">
                    {barcodeItem.maker && <span>{barcodeItem.maker}</span>}
                    {barcodeItem.size && <span>• {barcodeItem.size}</span>}
                  </p>
                )}
              </div>

              {/* Barcode SVG generation */}
              <div className="my-6">
                <BarcodeGenerator val={barcodeItem.janCode} />
              </div>

              <div className="text-[10px] text-gray-400 font-bold leading-normal bg-gray-950 p-3 rounded-2xl border border-gray-850">
                <p>💡 スマートフォン画面の明るさを上げて、ハンディスキャナー等にかざして読み取ることができます。</p>
              </div>

              <button
                onClick={() => setBarcodeItem(null)}
                className="w-full mt-5 py-3.5 bg-gray-800 hover:bg-gray-750 text-white font-black rounded-2xl text-xs active:scale-[0.98] transition-all"
              >
                閉じる
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV IMPORT PREVIEW MODAL */}
      <AnimatePresence>
        {isCsvModalOpen && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isImporting) { setIsCsvModalOpen(false); setCsvPreviewItems([]); } }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 210 }}
              className="relative w-full max-w-xl bg-gray-900 border border-gray-800 rounded-[32px] p-6 shadow-2xl z-10 text-left overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <Upload size={16} className="text-teal-400 animate-pulse" />
                    CSV商品マスタ取込インポート
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-1">
                    インポート対象: {csvPreviewItems.length}件のレコードが検出されました
                  </p>
                </div>
                {!isImporting && (
                  <button
                    onClick={() => { setIsCsvModalOpen(false); setCsvPreviewItems([]); }}
                    className="p-1.5 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white rounded-full transition-colors active:scale-95"
                    title="キャンセル"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {importProgress ? (
                /* progress panel */
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 flex-1">
                  <Loader2 size={36} className="animate-spin text-teal-400" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-white font-sans">
                      {importProgress.phase === 'delete' ? '既存の全マスタデータを削除中...' : '新規マスタデータをインポート登録中...'}
                    </h4>
                    <p className="text-[11px] font-mono text-gray-400 font-bold">
                      {importProgress.current} / {importProgress.total} 件処理中
                    </p>
                  </div>
                  <div className="w-full max-w-xs bg-gray-950 h-2 rounded-full overflow-hidden border border-gray-800">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-150"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold max-w-xs">
                    ※ {importProgress.phase === 'delete' ? '安全に旧マスタデータを全件クリーンアップしています。ブラウザを閉じずにお待ちください。' : 'CSVファイルの新規レコードをデータベースに登録しています。ブラウザを閉じずにお待ちください。'}
                  </p>
                </div>
              ) : (
                /* preview list & actions */
                <>
                  <div className="text-[10px] text-gray-300 bg-teal-950/20 border border-teal-900/40 p-3 rounded-2xl mb-4 leading-relaxed shrink-0">
                    💡 <strong>処理確認（クリア＆再インポート）:</strong> 今回のインポート開始と同時に、<strong>「現在データベースにある商品マスタはすべて一度完全に削除」</strong>され、CSVに入力された内容で<strong>「新規に全件登録」</strong>されます。
                  </div>

                  {/* table preview */}
                  <div className="flex-1 overflow-y-auto space-y-2 mb-5 max-h-[40vh] border border-gray-800 rounded-2xl p-1 bg-gray-950">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-gray-900 sticky top-0 text-gray-400 font-bold border-b border-gray-850 border-solid">
                        <tr>
                          <th className="p-2.5 font-bold">JAN_プライマリ</th>
                          <th className="p-2.5 font-bold">JAN_セカンダリ</th>
                          <th className="p-2.5 font-bold">商品名</th>
                          <th className="p-2.5 font-bold">メーカー</th>
                          <th className="p-2.5 font-bold">サイズ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-850/50 font-medium font-sans">
                        {csvPreviewItems.slice(0, 50).map((pItem, idx) => (
                           <tr key={idx} className="hover:bg-gray-900/50">
                             <td className="p-2.5 font-mono text-gray-300">{pItem.janCode}</td>
                             <td className="p-2.5 font-mono text-amber-500">{pItem.caseJanCode || '-'}</td>
                             <td className="p-2.5 text-white font-black truncate max-w-[120px]" title={pItem.productName}>{pItem.productName}</td>
                             <td className="p-2.5 text-gray-400 truncate max-w-[80px]" title={pItem.maker}>{pItem.maker || '-'}</td>
                             <td className="p-2.5 text-gray-400">{pItem.size || '-'}</td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreviewItems.length > 50 && (
                      <div className="p-3 text-center text-gray-500 font-bold border-t border-gray-850 bg-gray-900/10 text-[10px]">
                        ほか {csvPreviewItems.length - 50} 件のデータがあります（全件インポートされます）
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 shrink-0 pt-3 border-t border-gray-800">
                    <button
                      onClick={() => { setIsCsvModalOpen(false); setCsvPreviewItems([]); }}
                      className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-750 text-gray-300 font-bold rounded-2xl active:scale-95 transition-all text-xs text-center"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={runCsvImport}
                      className="flex-[2] py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black rounded-2xl active:scale-[0.98] transition-all text-xs text-center flex items-center justify-center gap-2 shadow-lg shadow-teal-950/20"
                    >
                      <Check size={14} />
                      インポートを実行（反映）
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
