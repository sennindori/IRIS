import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Loader2, Send, CheckCircle2, Scan, AlertCircle, RefreshCw, Plus, Search } from 'lucide-react';
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
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "reader";

  useEffect(() => {
    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode(containerId);
        
        const config = { 
          fps: 20, 
          // 画面全体ではなく中央の帯状のエリアをスキャン対象として強調
          qrbox: (viewWidth: number, viewHeight: number) => {
            return {
              width: Math.min(viewWidth * 0.85, 400),
              height: 120
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
    setScannedCode(decodedText);
    fetchProductInfo(decodedText);
    
    // Attempt to stop scanning temporarily to focus on the result
    if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.pause();
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
      }
    } catch (err) {
      setProductInfo({ productName: `検索エラー (${janCode})` });
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
      scannerRef.current.pause();
    }
  }

  return (
    <div className="relative h-screen bg-black overflow-hidden font-sans">
      {/* Floating Back Button & UI Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-30 pointer-events-none">
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
                <div className="relative group">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    placeholder="バーコードを手入力..."
                    className="w-full pl-12 pr-16 py-4 bg-white/20 backdrop-blur-xl border border-white/30 text-white placeholder:text-white/50 rounded-2xl outline-none focus:bg-white/30 focus:border-white/50 transition-all font-bold text-lg"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
                  <button
                    onClick={handleManualSearch}
                    disabled={!manualCode.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-white text-black text-xs font-black rounded-xl hover:bg-gray-100 disabled:opacity-0 transition-all"
                  >
                    検索
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
    </div>
  );
}
