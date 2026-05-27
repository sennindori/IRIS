import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { ArrowLeft, Loader2, Send, CheckCircle2, Scan, AlertCircle, RefreshCw, Plus, Search, Keyboard, X, Delete, Clipboard, Database, Save, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModeProps {
  onBack: () => void;
}

export default function ScannerMode({ onBack }: ScannerModeProps) {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<{ productName: string; imageUrl?: string; maker?: string } | null>(null);
  const [editableProductName, setEditableProductName] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('個');
  const [subcategory, setSubcategory] = useState('通常');
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [isRegisteringStandard, setIsRegisteringStandard] = useState(false);
  const [editableMaker, setEditableMaker] = useState('');
  const [masterSize, setMasterSize] = useState('');
  const [masterRemarks, setMasterRemarks] = useState('');
  const [isRegisteringMaster, setIsRegisteringMaster] = useState(false);
  const [masterRegisterSuccess, setMasterRegisterSuccess] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [showTenkey, setShowTenkey] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(() => {
    return localStorage.getItem('iris_camera_granted') === 'true';
  });
  
  // States for live scan candidate when typing 13/14 digits in tenkey
  const [candidateProduct, setCandidateProduct] = useState<{ productName: string; imageUrl?: string; maker?: string } | null>(null);
  const [isSearchingCandidate, setIsSearchingCandidate] = useState(false);
  const [searchedCandidateCode, setSearchedCandidateCode] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // クリップボードからバーコードをコピーして入力欄に貼り付ける関数
  async function handlePaste() {
    try {
      if (!navigator.clipboard) {
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        // 余計な空白を取り除く
        const trimmed = text.trim();
        // バーコードは一般的に数値なので、数値以外のノイズを除去したバージョンを作る
        const numericOnly = trimmed.replace(/[^0-9]/g, '');
        if (numericOnly) {
          setManualCode(numericOnly);
        } else {
          setManualCode(trimmed);
        }
      }
    } catch (err) {
      console.warn("Failed to paste clipoard content. Clipboard read API is often blocked inside standard iframes or requires permission approval:", err);
    }
  }

  // 定番マスタ商品 (standard_items) から JANコード で優先検索するヘルパー関数
  async function findStandardProduct(janCode: string) {
    try {
      const q = query(
        collection(db, 'standard_items'),
        where('janCode', '==', janCode),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        return {
          productName: docData.name as string,
          maker: docData.maker || undefined,
          imageUrl: docData.imageUrl || undefined
        };
      }
    } catch (err) {
      console.error("Firestore standard_items lookup error:", err);
    }
    return null;
  }

  // 商品マスタ商品 (product_master) から JANコード で検索するヘルパー関数
  async function findMasterProduct(janCode: string) {
    try {
      const q = query(
        collection(db, 'product_master'),
        where('janCode', '==', janCode),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        return {
          productName: docData.productName as string,
          maker: docData.maker || undefined,
          size: docData.size || undefined,
          remarks: docData.remarks || undefined,
          imageUrl: undefined
        };
      }
    } catch (err) {
      console.error("Firestore product_master lookup error:", err);
    }
    return null;
  }

  // Auto-search candidate when 13 or 14 digits are typed
  useEffect(() => {
    if (showTenkey && (manualCode.length === 13 || manualCode.length === 14)) {
      if (manualCode !== searchedCandidateCode) {
        setSearchedCandidateCode(manualCode);
        const code = manualCode;
        
        const fetchCandidate = async () => {
          setIsSearchingCandidate(true);
          try {
            // 1. まずは登録済みの定番マスタからマッチング
            const standardProd = await findStandardProduct(code);
            if (standardProd) {
              setCandidateProduct(standardProd);
              return;
            }

            // 2. なければYahoo!ショッピングAPIを使用
            const res = await fetch(`/api/product/${code}`);
            if (res.ok) {
              const data = await res.json();
              setCandidateProduct(data);
            } else {
              setCandidateProduct({ productName: `不明な商品 (${code})` });
            }
          } catch (err) {
            setCandidateProduct({ productName: `不明な商品 (${code})` });
          } finally {
            setIsSearchingCandidate(false);
          }
        };
        fetchCandidate();
      }
    } else {
      if (manualCode.length !== 13 && manualCode.length !== 14) {
        setCandidateProduct(null);
        setSearchedCandidateCode(null);
      }
    }
  }, [manualCode, showTenkey, searchedCandidateCode]);

  const handleSelectCandidate = () => {
    if (!searchedCandidateCode || !candidateProduct) return;
    setScannedCode(searchedCandidateCode);
    setProductInfo(candidateProduct);
    setEditableProductName(candidateProduct.productName);
    setShowTenkey(false);
    
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.pause(true);
    }
  };

  const handleTenkeyPress = (num: string) => {
    if (manualCode.length < 20) {
      setManualCode(prev => prev + num);
    }
  };

  const handleTenkeyBackspace = () => {
    setManualCode(prev => prev.slice(0, -1));
  };

  const handleTenkeyClear = () => {
    setManualCode('');
  };

  const handleTenkeySearch = () => {
    if (!manualCode.trim()) return;
    setShowTenkey(false);
    handleManualSearch();
  };

  useEffect(() => {
    // 画面の向きを縦（portrait）にロック（対応端末のみ、通常は全画面状態などで効果を発揮）
    const orientation = (typeof screen !== 'undefined' && screen?.orientation) ? (screen.orientation as any) : null;
    if (orientation && orientation.lock) {
      try {
        orientation.lock('portrait').catch((err: any) => {
          console.debug("Screen orientation lock is not supported or needs user activation:", err);
        });
      } catch (e) {
        console.debug("Orientation lock error:", e);
      }
    }

    const checkOrientation = () => {
      // 画面が横長 かつ 画面幅が1024px未満（モバイル・タブレットサイズ）の場合に横向き制限フラグを立てる
      const isLandscapeMatched = window.matchMedia('(orientation: landscape)').matches;
      const isMobileMatched = window.matchMedia('(max-width: 1023px)').matches;
      setIsLandscape(isLandscapeMatched && isMobileMatched);
    };

    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      const orientation = (typeof screen !== 'undefined' && screen?.orientation) ? (screen.orientation as any) : null;
      if (orientation && orientation.unlock) {
        try {
          orientation.unlock();
        } catch (e) {}
      }
    };
  }, []);

  const containerId = "reader";

  useEffect(() => {
    if (!isPermissionGranted) return;

    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode(containerId);
        
        const config = { 
          fps: 15, 
          // 読み取る対象を「JANコード」と「段ボールのITFコード」だけに超限定！
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.ITF
          ],
          qrbox: (viewWidth: number, viewHeight: number) => {
            // バーコードがカメラの最適なピント位置で収まるよう、読み取り枠幅を最大240pxに最適化
            return {
              width: Math.min(viewWidth * 0.8, 240),
              height: 100
            };
          },
          aspectRatio: window.innerWidth / window.innerHeight
        };

        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        );
        // カメラ起動が完全に成功したら、フラグを永続化
        localStorage.setItem('iris_camera_granted', 'true');
      } catch (err: any) {
        console.error("Scanner Error:", err);
        setErrorHeader("カメラの起動に失敗しました。権限と環境を確認してください。");
        // エラー時にはフラグをリセットして許可モーダルが再試行されるようにする
        localStorage.setItem('iris_camera_granted', 'false');
        setIsPermissionGranted(false);
      }
    };

    // Small delay to ensure container is mounted
    const timer = setTimeout(startScanner, 500);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, [isPermissionGranted]);

  function onScanSuccess(decodedText: string) {
    if (scannedCode) return; 
    // 13桁未満（13桁に満たない）の場合はJAN等の誤読・誤スキャンであるため、結果表示をせずスキャンを続行
    if (decodedText.length < 13) {
      return;
    }
    setScannedCode(decodedText);
    fetchProductInfo(decodedText);
    
    // Attempt to stop scanning temporarily to focus on the result
    // Pass true to shouldClearHistory to reset scanning history so we can scan the same barcode again
    if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.pause(true);
    }
  }

  function onScanFailure(error: any) {
    // Silent for background scans
  }

  async function fetchProductInfo(janCode: string) {
    setIsSearching(true);
    // Reset any previous master register states
    setEditableMaker('');
    setMasterSize('');
    setMasterRemarks('');
    setMasterRegisterSuccess(false);

    try {
      // 1. まずは本気の商品マスタ (product_master) からマッチング
      const masterProd = await findMasterProduct(janCode);
      if (masterProd) {
        setProductInfo({
          productName: masterProd.productName,
          maker: masterProd.maker || undefined
        });
        setEditableProductName(masterProd.productName);
        setEditableMaker(masterProd.maker || '');
        setMasterSize(masterProd.size || '');
        setMasterRemarks(masterProd.remarks || '');
        return;
      }

      // 2. 次に登録済みの定番マスタ (standard_items) からマッチング
      const standardProd = await findStandardProduct(janCode);
      if (standardProd) {
        setProductInfo(standardProd);
        setEditableProductName(standardProd.productName);
        setEditableMaker(standardProd.maker || '');
        return;
      }

      // 3. なければYahoo!ショッピングAPIを使用
      const res = await fetch(`/api/product/${janCode}`);
      if (res.ok) {
        const data = await res.json();
        setProductInfo(data);
        setEditableProductName(data.productName);
        setEditableMaker(data.maker || '');
      } else {
        const defaultName = `不明な商品 (${janCode})`;
        setProductInfo({ productName: defaultName });
        setEditableProductName(defaultName);
        setEditableMaker('');
        setManualCode(janCode);
      }
    } catch (err) {
      const errorName = `検索エラー (${janCode})`;
      setProductInfo({ productName: errorName });
      setEditableProductName(errorName);
      setEditableMaker('');
      setManualCode(janCode);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleWebSearch(janCode: string) {
    if (!janCode) return;
    setIsSearchingWeb(true);
    setEditableProductName("ウェブ検索中...");
    setEditableMaker('');
    setMasterSize('');
    setMasterRemarks('');
    setMasterRegisterSuccess(false);

    try {
      const res = await fetch(`/api/product/${janCode}?forceSearch=true`);
      if (res.ok) {
        const data = await res.json();
        setProductInfo(data);
        setEditableProductName(data.productName);
        setEditableMaker(data.maker || '');
      } else {
        const defaultName = `不明な商品 (${janCode})`;
        setProductInfo({ productName: defaultName });
        setEditableProductName(defaultName);
        setEditableMaker('');
      }
    } catch (err) {
      const errorName = `検索エラー (${janCode})`;
      setProductInfo({ productName: errorName });
      setEditableProductName(errorName);
      setEditableMaker('');
    } finally {
      setIsSearchingWeb(false);
    }
  }

  async function handleSubmit() {
    if (!scannedCode || !productInfo) return;
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'replenishment_list'), {
        janCode: scannedCode,
        productName: (editableProductName || productInfo.productName).trim(),
        maker: editableMaker.trim() || productInfo.maker || null,
        imageUrl: productInfo.imageUrl || null,
        quantity: quantity.trim(),
        unit: unit,
        subcategory: subcategory,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetScanner();
      }, 1500);
    } catch (err) {
      console.error("Error adding document: ", err);
      alert("送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterStandard() {
    if (!scannedCode || !productInfo) return;
    setIsRegisteringStandard(true);
    try {
      await addDoc(collection(db, 'standard_items'), {
        janCode: scannedCode,
        name: (editableProductName || productInfo.productName).trim(),
        maker: editableMaker.trim() || productInfo.maker || null,
        createdAt: serverTimestamp(),
      });
      alert("スタンダードとして登録しました");
    } catch (err) {
      console.error(err);
      alert("登録に失敗しました");
    } finally {
      setIsRegisteringStandard(false);
    }
  }

  async function handleRegisterMaster() {
    if (!scannedCode) return;
    setIsRegisteringMaster(true);
    setMasterRegisterSuccess(false);
    try {
      const q = query(
        collection(db, 'product_master'),
        where('janCode', '==', scannedCode),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      const payload = {
        janCode: scannedCode,
        productName: (editableProductName || '').trim(),
        maker: (editableMaker || '').trim() || null,
        size: (masterSize || '').trim() || null,
        remarks: (masterRemarks || '').trim() || null,
      };

      if (!snapshot.empty) {
        // Update
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, 'product_master', docId), payload);
      } else {
        // Create
        await addDoc(collection(db, 'product_master'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setMasterRegisterSuccess(true);
      alert("商品マスタを保存しました");
    } catch (err) {
      console.error("Failed to register in product master:", err);
      alert("商品マスタの登録に失敗しました。");
    } finally {
      setIsRegisteringMaster(false);
    }
  }

  function resetScanner() {
    setScannedCode(null);
    setProductInfo(null);
    setManualCode('');
    setQuantity('1');
    setUnit('個');
    setSubcategory('通常');
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.resume();
    }
  }

  function handleManualSearch() {
    if (!manualCode.trim()) return;
    const code = manualCode.trim();
    setScannedCode(code);
    fetchProductInfo(code);
    
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.pause(true);
    }
  }

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] bg-black overflow-hidden font-sans">
      {/* Floating Back Button & UI Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex items-center justify-between z-30 pointer-events-none">
        <button 
          onClick={onBack} 
          className="p-3 bg-black/30 backdrop-blur-md text-white rounded-full pointer-events-auto active:scale-90 transition-transform" 
          id="floating-back-btn"
        >
          <ArrowLeft size={24} />
        </button>

        {/* Floating Help Trigger when scanning */}
        {!scannedCode && isPermissionGranted && !errorHeader && (
          <button 
            onClick={() => setShowHelp(true)} 
            className="p-3 bg-black/40 backdrop-blur-md text-yellow-300 hover:text-yellow-200 border border-yellow-300/20 rounded-full pointer-events-auto active:scale-90 transition-all flex items-center gap-1.5 shadow-lg"
            title="スキャンを成功させるコツと説明"
          >
            <AlertCircle size={20} />
            <span className="text-[11px] font-black tracking-wider pr-1">コツ・お困りですか？</span>
          </button>
        )}
        
        {errorHeader && (
           <button 
             onClick={() => window.location.reload()} 
             className="p-3 bg-blue-600/80 backdrop-blur-md text-white rounded-full pointer-events-auto"
           >
             <RefreshCw size={20} />
           </button>
        )}
      </div>

      {/* Main Scanner Area */}
      <div className="absolute inset-0 z-0">
        {!isPermissionGranted ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gray-950 text-white z-20">
            <div className="relative mb-6">
              {/* Pulse scanning effect decoration */}
              <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-xl animate-pulse scale-150" />
              <div className="relative w-24 h-24 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center text-blue-400 shadow-2xl">
                <Scan size={44} className="animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            
            <div className="max-w-xs text-center mb-8">
              <h3 className="text-lg font-black tracking-wider text-gray-100 mb-2 font-mono">
                CAMERA ACTIVATION
              </h3>
              <p className="text-xs font-medium text-gray-400 leading-relaxed">
                商品のバーコードをスキャンするためにカメラを使用します。スキャンを開始しますか？
              </p>
            </div>

            <button
              onClick={() => setIsPermissionGranted(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm tracking-widest flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              スキャンを開始する
            </button>
            
            <button
              onClick={onBack}
              className="mt-4 px-6 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
            >
              ダッシュボードに戻る
            </button>
          </div>
        ) : errorHeader ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gray-950 text-white z-10">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">起動エラー</h2>
            <p className="text-gray-400 mb-6">{errorHeader}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
            >
              再試行
            </button>
          </div>
        ) : (
          <div id={containerId} className="w-full h-full"></div>
        )}
        
        {/* Invisible scanner area */}
        {!scannedCode && !errorHeader && isPermissionGranted && (
          <>
            <div className="absolute inset-x-0 top-24 pointer-events-none z-10 flex flex-col items-center px-6">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center max-w-xs space-y-1.5 shadow-xl animate-pulse" style={{ animationDuration: '4s' }}>
                <p className="text-sm font-black text-white flex items-center justify-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  バーコードスキャン待機中...
                </p>
                <p className="text-[10.5px] font-bold text-gray-300 leading-normal">
                  バーコードから<strong>15〜20cmほど離し</strong>、中央の枠内に水平に合わせて写してください。
                </p>
              </div>

              <div className="mt-3 bg-blue-950/70 backdrop-blur-sm border border-blue-500/20 rounded-xl px-4 py-2.5 text-center max-w-xs shadow-lg">
                <p className="text-[10px] font-bold text-blue-300 leading-relaxed">
                  💡 <strong>うまく認識しなくてもOK！</strong><br />
                  読み取った後に、商品名はご自身で自由に変更・入力可能です。
                </p>
              </div>
            </div>
            
            {/* Manual Entry UI */}
            <div className="absolute bottom-10 left-0 right-0 px-6 z-20">
              <div className="max-w-md mx-auto">
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                      onClick={() => setShowTenkey(true)}
                      placeholder="バーコードを手入力..."
                      className="w-full pl-12 pr-16 py-4 bg-white/20 backdrop-blur-xl border border-white/30 text-white placeholder:text-white/50 rounded-2xl outline-none focus:bg-white/30 focus:border-white/50 transition-all font-bold text-lg cursor-pointer"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
                    <button
                      onClick={handleManualSearch}
                      disabled={!manualCode.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-white text-black text-xs font-black rounded-xl hover:bg-gray-100 disabled:opacity-0 transition-all animate-none"
                    >
                      検索
                    </button>
                  </div>
                  <button
                    onClick={handlePaste}
                    className="p-4 bg-white/20 backdrop-blur-xl border border-white/30 hover:bg-white/30 text-white rounded-2xl active:scale-95 transition-all flex items-center justify-center shrink-0"
                    title="コピーしたバーコードを貼り付け"
                  >
                    <Clipboard size={24} />
                  </button>
                  <button
                    onClick={() => setShowTenkey(true)}
                    className="p-4 bg-white/20 backdrop-blur-xl border border-white/30 hover:bg-white/30 text-white rounded-2xl active:scale-95 transition-all flex items-center justify-center shrink-0"
                    title="テンキーを入力する"
                  >
                    <Keyboard size={24} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          position: absolute;
          top: 0;
          left: 0;
        }
        /* Hide html5-qrcode built-in UI */
        #reader__scan_region {
          border: none !important;
          background: transparent !important;
        }
        #reader__scan_region > div {
          border: none !important;
          background: transparent !important;
        }
      `}</style>

      <AnimatePresence>
        {scannedCode && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)] rounded-t-[32px] p-6 pb-8 z-50 overflow-y-auto max-h-[92dvh]"
          >
            <div className="max-w-md mx-auto">
              {/* Result UI handles here */}
              <div className="flex items-start gap-4 mb-6">
                {productInfo?.imageUrl ? (
                  <img src={productInfo.imageUrl} alt={productInfo.productName} className="w-20 h-20 object-contain bg-gray-50 rounded-xl border border-gray-100" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                    {isSearching ? <Loader2 className="animate-spin" /> : <Scan />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-mono mb-1">{scannedCode}</p>
                  {productInfo?.maker && (
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-md mb-1 uppercase tracking-wider">
                      {productInfo.maker}
                    </span>
                  )}
                  {isSearching || isSearchingWeb ? (
                    <h3 className="text-sm font-bold text-gray-900 leading-tight flex items-center gap-2 py-2">
                      <Loader2 className="animate-spin text-blue-600" size={16} />
                      {isSearchingWeb ? "ウェブを再検索中..." : "商品情報を取得中..."}
                    </h3>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-gray-400 font-black uppercase tracking-wider pl-0.5">商品名 (タップして編集可能)</label>
                      <input
                        type="text"
                        value={editableProductName}
                        onChange={(e) => setEditableProductName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 text-gray-950 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold text-sm"
                        placeholder="商品名を手動で変更..."
                      />
                    </div>
                  )}
                  {productInfo && !isSearching && !isSearchingWeb && (editableProductName.includes('不明な商品') || editableProductName.includes('検索エラー') || editableProductName.trim() === '') && (
                    <div className="mt-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold leading-normal space-y-3.5 shadow-sm">
                      <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                        <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                        <div>
                          商品情報を特定できませんでした。手動で入力するか、下のボタンから<strong>ウェブで自動検索・反映</strong>してください。
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/50">
                        <button
                          type="button"
                          onClick={() => handleWebSearch(scannedCode || '')}
                          disabled={isSearchingWeb}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black rounded-xl text-[10.5px] uppercase tracking-wide active:scale-[0.98] transition-all shadow-sm"
                        >
                          {isSearchingWeb ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                          ウェブ自動検索
                        </button>
                        
                        <a
                          href={`https://www.google.com/search?q=${scannedCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-zinc-800 hover:bg-zinc-900 text-zinc-100 font-black rounded-xl text-[10.5px] uppercase tracking-wide active:scale-[0.98] transition-all shadow-sm index_external_link"
                        >
                          <Search size={13} />
                          Google手動検索
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 商品マスタへの登録・更新カード */}
              <div className="mb-5 p-4 bg-indigo-50 border border-indigo-100/60 rounded-2xl text-left shadow-sm">
                <h4 className="text-[11px] font-black text-indigo-950 flex items-center gap-1.5 mb-2.5">
                  <Database size={13} className="text-indigo-600" />
                  商品マスタへの登録・更新
                </h4>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[9px] text-indigo-800 font-black uppercase pl-0.5">メーカー・ブランド</label>
                    <input
                      type="text"
                      value={editableMaker}
                      onChange={(e) => setEditableMaker(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 text-xs font-bold text-gray-950 outline-none rounded-xl focus:border-indigo-500 transition-colors"
                      placeholder="例: 花王, コカ・コーラなど"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] text-indigo-800 font-black uppercase pl-0.5">規格・サイズ</label>
                    <input
                      type="text"
                      value={masterSize}
                      onChange={(e) => setMasterSize(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 text-xs font-bold text-gray-950 outline-none rounded-xl focus:border-indigo-500 transition-colors"
                      placeholder="例: 500ml, 大袋"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] text-indigo-800 font-black uppercase pl-0.5">マスタ備考</label>
                    <input
                      type="text"
                      value={masterRemarks}
                      onChange={(e) => setMasterRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 text-xs font-bold text-gray-950 outline-none rounded-xl focus:border-indigo-500 transition-colors"
                      placeholder="例: A-1棚、催事用など"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-indigo-100 pt-2 px-0.5">
                  <p className="text-[9px] text-indigo-600 font-extrabold max-w-[200px] leading-snug">
                    ※マスタへ保存すると次回以降自動でメーカー・サイズ等が補完されます。
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleRegisterMaster}
                    disabled={isRegisteringMaster || !editableProductName.trim()}
                    className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-black text-[10px] rounded-xl active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    {isRegisteringMaster ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : masterRegisterSuccess ? (
                      <Check size={11} />
                    ) : (
                      <Save size={11} />
                    )}
                    {masterRegisterSuccess ? '保存完了' : 'マスタに保存'}
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">数量</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        // For type=number, value is already somewhat restricted, 
                        // but we can ensure it's not negative and contains only digits
                        const numericVal = val.replace(/[^0-9]/g, '');
                        setQuantity(numericVal);
                      }}
                      className="block w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-xl font-black"
                      placeholder="数量"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">単位</label>
                    <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
                      {['個', 'ケース'].map((u) => (
                        <button
                          key={u}
                          onClick={() => setUnit(u)}
                          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                            unit === u ? 'bg-white text-blue-600 shadow-sm scale-[1.02]' : 'text-gray-400'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-sm font-bold text-gray-700 mb-1 pl-1">売場 (サブカテゴリ)</label>
                  <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1">
                    {['通常', '催事', 'エンド', '客注', 'その他'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSubcategory(s)}
                        type="button"
                        className={`flex-1 py-2 font-black rounded-xl transition-all ${
                          subcategory === s ? 'bg-white text-blue-600 shadow-sm scale-[1.02]' : 'text-gray-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetScanner}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    再スキャン
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSearching || isSubmitting}
                    className="flex-[2] px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    依頼を送信
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center"
            >
              <div className="text-green-500 mb-4 bg-green-50 p-6 rounded-full">
                <CheckCircle2 size={72} />
              </div>
              <p className="text-2xl font-black text-gray-900">送信完了</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTenkey && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTenkey(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-gray-900 border-t border-gray-800 rounded-t-[32px] sm:rounded-b-[32px] p-6 shadow-2xl z-10 text-center flex flex-col"
            >
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4 sm:hidden" />

              <div className="flex items-center justify-between mb-4 text-left">
                <span className="text-xs font-black text-gray-400">バーコード手入力 (テンキー)</span>
                <button
                  onClick={() => setShowTenkey(false)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 pr-14 mb-4 relative min-h-[72px] flex flex-col justify-center items-center">
                <span className="text-3xl font-mono text-white font-black tracking-widest break-all">
                  {manualCode || <span className="text-gray-600 font-sans text-lg tracking-normal font-medium text-gray-500">コードを入力...</span>}
                </span>
                {manualCode.length > 0 && (
                  <span className="text-[10px] text-blue-400 font-mono font-bold mt-1 uppercase tracking-wider">
                    {manualCode.length} 桁 (JAN: 13 / ITF: 14)
                  </span>
                )}
                <button
                  onClick={handlePaste}
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-xl transition-all active:scale-95 border border-gray-700/50 flex items-center justify-center shadow"
                  title="貼り付け"
                >
                  <Clipboard size={18} />
                </button>
              </div>

              {/* Real-time Candidate Display */}
              <div className="min-h-0 overflow-hidden mb-4">
                <AnimatePresence mode="wait">
                  {isSearchingCandidate ? (
                    <motion.div
                      key="searching"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="w-full py-3 bg-gray-800/20 border border-gray-800/40 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-gray-400"
                    >
                      <Loader2 className="animate-spin text-blue-500" size={16} />
                      <span>商品情報を検索中...</span>
                    </motion.div>
                  ) : candidateProduct ? (
                    <motion.button
                      key="candidate"
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      onClick={handleSelectCandidate}
                      className="w-full bg-blue-950/40 hover:bg-blue-900/40 border border-blue-900/30 p-3 rounded-2xl flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                    >
                      {candidateProduct.imageUrl ? (
                        <img 
                          src={candidateProduct.imageUrl} 
                          alt="" 
                          className="w-12 h-12 object-contain bg-white rounded-xl p-1 shrink-0 border border-gray-800" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-900/20 text-blue-400 border border-blue-800/20 rounded-xl flex items-center justify-center shrink-0">
                          <Plus size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black rounded mb-0.5 uppercase tracking-wide">
                          スキャン候補 (タップで確定)
                        </span>
                        <h4 className="text-sm font-black text-white truncate leading-snug">{candidateProduct.productName}</h4>
                        {candidateProduct.maker && (
                          <p className="text-[10.5px] font-black text-gray-400 truncate mt-0.5">{candidateProduct.maker}</p>
                        )}
                      </div>
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <motion.button
                    key={num}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleTenkeyPress(num.toString())}
                    className="aspect-[1.5/1] sm:aspect-[1.4/1] bg-gray-800 hover:bg-gray-700 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-colors shadow-md border border-gray-800/60"
                  >
                    {num}
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleTenkeyClear}
                  className="aspect-[1.5/1] sm:aspect-[1.4/1] bg-red-950/40 hover:bg-red-900/40 text-red-400 font-bold text-base rounded-2xl flex items-center justify-center transition-all border border-red-900/20 active:scale-95"
                >
                  クリア
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleTenkeyPress('0')}
                  className="aspect-[1.5/1] sm:aspect-[1.4/1] bg-gray-800 hover:bg-gray-700 text-white font-black text-2xl rounded-2xl flex items-center justify-center transition-colors shadow-md border border-gray-800/60"
                >
                  0
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleTenkeyBackspace}
                  className="aspect-[1.5/1] sm:aspect-[1.4/1] bg-gray-800 hover:bg-gray-700 text-white rounded-2xl flex items-center justify-center transition-all shadow-md border border-gray-800/60 active:scale-95 text-gray-400"
                >
                  <Delete size={22} />
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-4 sm:pb-0">
                <button
                  onClick={() => setShowTenkey(false)}
                  className="py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-colors active:scale-95 text-sm"
                >
                  閉じる
                </button>
                <button
                  onClick={handleTenkeySearch}
                  disabled={!manualCode.trim()}
                  className="py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-900/30 transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 text-sm"
                >
                  コードで検索
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-3xl p-6 shadow-2xl z-10 text-left overflow-y-auto max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-805">
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  <AlertCircle size={20} />
                  スキャン成功のコツ＆説明書
                </h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs text-zinc-300 leading-relaxed font-sans">
                
                {/* Section 1 */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-blue-500 rounded" />
                    1. カメラに写す際の3つのポイント
                  </h4>
                  <ul className="list-disc list-inside pl-1 space-y-1.5 text-zinc-400 font-medium">
                    <li>
                      <strong className="text-zinc-200">【距離は15〜20cm】</strong> 近すぎるとカメラのピントが合いません。手のひら1つ分ほど離してください。
                    </li>
                    <li>
                      <strong className="text-zinc-200">【水平に合わせる】</strong> バーコードが斜めになっていないか確認し、枠に対して直角・水平に合わせてください。
                    </li>
                    <li>
                      <strong className="text-zinc-200">【光の反射を防ぐ】</strong> 蛍光灯などの強い光がバーコードの上に置かれるようであれば、スマホをほんの数度傾けてきれいに撮影してください。
                    </li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-emerald-500 rounded" />
                    2. 「不明な商品」や検索に失敗したら？
                  </h4>
                  <p className="text-zinc-400 pl-3">
                    新発売された商品、ネット通販、一部の海外製品などは検索APIやAI（Gemini）で見つからず、<strong>「不明な商品」</strong>と表示されることがあります。
                  </p>
                  <p className="pl-3 py-1 px-2.5 bg-yellow-950/20 border border-yellow-500/10 rounded-xl text-yellow-300 text-[10.5px] font-bold">
                    💡 <strong>ご安心ください！</strong><br />
                    不明な商品と出ても、そのポップアップから商品名入力欄をタップして「お好きな名前（例: 水 2L ケース）」に<strong>自由に変更・修正して送信可能</strong>です！そのままリクエストがきちんと送信されます。
                  </p>
                </div>

                {/* Section 3 */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-purple-500 rounded" />
                    3. コピペや手入力の裏ワザ
                  </h4>
                  <p className="text-zinc-400 pl-3 leading-normal">
                    カメラが使えない場合やうまく撮影できない場合は、画面下の入力フォーム、または右端の<strong>貼り付け(📋)ボタン</strong>をお使いください。他のメールやアプリからコピーしたJANコードの数値をワンタップで自動入力、テンキーでの入力時もリアルタイムで裏で自動検索されます。
                  </p>
                </div>

                {/* Confirm button */}
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl active:scale-95 transition-all text-center tracking-widest text-xs uppercase"
                  >
                    閉じてスキャンを続ける
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLandscape && (
          <div className="fixed inset-0 z-[99999] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-xs flex flex-col items-center animate-none"
            >
              <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-6 border border-blue-500/20">
                <RefreshCw size={40} className="animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <h3 className="text-xl font-black mb-3 text-white">画面を縦向きにしてください</h3>
              <p className="text-xs font-bold text-gray-400 leading-relaxed">
                バーコードスキャンは縦画面（ポートレート）に最適化されています。スマートフォンを縦向きに戻してご利用ください。
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
