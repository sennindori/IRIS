import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Loader2, Send, CheckCircle2, Scan, AlertCircle, RefreshCw, Plus, Search, Keyboard, X, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerModeProps {
  onBack: () => void;
}

export default function ScannerMode({ onBack }: ScannerModeProps) {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<{ productName: string; imageUrl?: string; maker?: string } | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('個');
  const [manualCode, setManualCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRegisteringStandard, setIsRegisteringStandard] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const [showTenkey, setShowTenkey] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  
  // States for live scan candidate when typing 13/14 digits in tenkey
  const [candidateProduct, setCandidateProduct] = useState<{ productName: string; imageUrl?: string; maker?: string } | null>(null);
  const [isSearchingCandidate, setIsSearchingCandidate] = useState(false);
  const [searchedCandidateCode, setSearchedCandidateCode] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Auto-search candidate when 13 or 14 digits are typed
  useEffect(() => {
    if (showTenkey && (manualCode.length === 13 || manualCode.length === 14)) {
      if (manualCode !== searchedCandidateCode) {
        setSearchedCandidateCode(manualCode);
        const code = manualCode;
        
        const fetchCandidate = async () => {
          setIsSearchingCandidate(true);
          try {
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
      } catch (err: any) {
        console.error("Scanner Error:", err);
        setErrorHeader("カメラの起動に失敗しました。権限と環境を確認してください。");
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
  }, []);

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
    try {
      const res = await fetch(`/api/product/${janCode}`);
      if (res.ok) {
        const data = await res.json();
        setProductInfo(data);
      } else {
        setProductInfo({ productName: `不明な商品 (${janCode})` });
        setManualCode(janCode);
      }
    } catch (err) {
      setProductInfo({ productName: `検索エラー (${janCode})` });
      setManualCode(janCode);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit() {
    if (!scannedCode || !productInfo) return;
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'replenishment_list'), {
        janCode: scannedCode,
        productName: productInfo.productName,
        maker: productInfo.maker || null,
        imageUrl: productInfo.imageUrl || null,
        quantity: quantity.trim(),
        unit: unit,
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
        name: productInfo.productName,
        maker: productInfo.maker || null,
        createdAt: serverTimestamp(),
      });
      alert("定番商品として登録しました");
    } catch (err) {
      console.error(err);
      alert("登録に失敗しました");
    } finally {
      setIsRegisteringStandard(false);
    }
  }

  function resetScanner() {
    setScannedCode(null);
    setProductInfo(null);
    setManualCode('');
    setQuantity('1');
    setUnit('個');
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
        {errorHeader ? (
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
        {!scannedCode && !errorHeader && (
          <>
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* No visible guides as requested */}
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
            className="fixed inset-x-0 bottom-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.2)] rounded-t-[32px] p-6 pb-12 z-50"
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
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {isSearching ? "商品情報を取得中..." : productInfo?.productName}
                  </h3>
                  {scannedCode !== 'STANDARD' && productInfo && !isSearching && (
                    <button 
                      onClick={handleRegisterStandard}
                      disabled={isRegisteringStandard}
                      className="mt-2 text-[10px] items-center gap-1 flex font-black text-blue-600 hover:text-blue-700 active:scale-95 transition-all"
                    >
                      {isRegisteringStandard ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                      定番商品リストに登録
                    </button>
                  )}
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

              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 mb-4 relative min-h-[72px] flex flex-col justify-center items-center">
                <span className="text-3xl font-mono text-white font-black tracking-widest break-all">
                  {manualCode || <span className="text-gray-600 font-sans text-lg tracking-normal font-medium">コードを入力...</span>}
                </span>
                {manualCode.length > 0 && (
                  <span className="text-[10px] text-blue-400 font-mono font-bold mt-1 uppercase tracking-wider">
                    {manualCode.length} 桁 (JAN: 13 / ITF: 14)
                  </span>
                )}
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
