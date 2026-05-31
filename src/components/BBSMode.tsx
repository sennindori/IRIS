import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BbsMessage, BbsReply, AppMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  ThumbsUp, 
  Trash2, 
  Megaphone, 
  AlertCircle, 
  Coffee, 
  FileCheck, 
  Search, 
  X,
  Plus,
  MessageCircle,
  Clock
} from 'lucide-react';

interface BBSModeProps {
  onBack: () => void;
  username: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function BBSMode({ onBack, username }: BBSModeProps) {
  const [messages, setMessages] = useState<BbsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Post states
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'notice' | 'handover' | 'chat' | 'urgent'>('notice');
  const [isSubmiting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Filter states
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply section states
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replies, setReplies] = useState<{ [messageId: string]: BbsReply[] }>({});
  const [localReplyCounts, setLocalReplyCounts] = useState<{ [messageId: string]: number }>({});
  const [newReplyContent, setNewReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Fetch reply counts for all messages to ensure they are visible on load and self-heal any missing counts
  useEffect(() => {
    if (messages.length === 0) return;

    messages.forEach(async (msg) => {
      // If we already have a locally cached count matching the msg's replyCount, skip to avoid redundant fetches
      if (localReplyCounts[msg.id] !== undefined && localReplyCounts[msg.id] === msg.replyCount) return;

      try {
        const path = `bbs_messages/${msg.id}/replies`;
        const snap = await getDocs(collection(db, path));
        const cnt = snap.size;

        setLocalReplyCounts(prev => ({ ...prev, [msg.id]: cnt }));

        // Self-heal: Update Firestore in the background if the counts are desynchronized or blank
        if (msg.replyCount !== cnt) {
          const docRef = doc(db, 'bbs_messages', msg.id);
          await updateDoc(docRef, { replyCount: cnt });
        }
      } catch (err) {
        console.error(`Error fetching replies count for ${msg.id}:`, err);
      }
    });
  }, [messages]);

  // Realtime subscription for posts
  useEffect(() => {
    const path = 'bbs_messages';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: BbsMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          author: data.author || '匿名',
          content: data.content || '',
          category: data.category || 'notice',
          createdAt: data.createdAt,
          likesCount: data.likesCount || 0,
          likedBy: data.likedBy || [],
          readBy: data.readBy || [],
          replyCount: data.replyCount || 0,
        });
      });
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, []);

  // Monitor activeMessageId to automatically mark threads as read
  useEffect(() => {
    if (!activeMessageId || !username) return;

    const message = messages.find(m => m.id === activeMessageId);
    if (!message) return;

    const readBy = message.readBy || [];
    const isAuthor = message.author === username;
    const isAlreadyRead = readBy.includes(username);

    if (!isAuthor && !isAlreadyRead) {
      const docRef = doc(db, 'bbs_messages', activeMessageId);
      updateDoc(docRef, {
        readBy: arrayUnion(username)
      }).catch((error) => {
        console.error("Failed to auto-mark as read: ", error);
      });
    }
  }, [activeMessageId, messages, username]);

  // Sync replies for the expanded post
  useEffect(() => {
    if (!activeMessageId) return;

    const path = `bbs_messages/${activeMessageId}/replies`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rps: BbsReply[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        rps.push({
          id: doc.id,
          author: data.author || '匿名',
          content: data.content || '',
          createdAt: data.createdAt,
        });
      });
      setReplies(prev => ({ ...prev, [activeMessageId]: rps }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [activeMessageId]);

  // Submit new bulletin post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const contentTrimmed = newContent.trim();
    if (!contentTrimmed) return;

    setIsSubmitting(true);
    const path = 'bbs_messages';
    try {
      await addDoc(collection(db, path), {
        author: username,
        content: contentTrimmed,
        category: newCategory,
        createdAt: serverTimestamp(),
        likesCount: 0,
        likedBy: [],
        readBy: [username],
      });
      setNewContent('');
      setShowCreateForm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit a reply comment
  const handleCreateReply = async (e: React.FormEvent, messageId: string) => {
    e.preventDefault();
    const replyTrimmed = newReplyContent.trim();
    if (!replyTrimmed) return;

    setIsSubmittingReply(true);
    const path = `bbs_messages/${messageId}/replies`;
    try {
      await addDoc(collection(db, path), {
        author: username,
        content: replyTrimmed,
        createdAt: serverTimestamp(),
      });
      // Increment replyCount in backend to keep dashboard / lists synced in real time
      const parentDocRef = doc(db, 'bbs_messages', messageId);
      await updateDoc(parentDocRef, {
        replyCount: increment(1)
      });
      setNewReplyContent('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Toggle Like Reaction
  const handleToggleLike = async (msg: BbsMessage) => {
    const isLiked = msg.likedBy.includes(username);
    const docRef = doc(db, 'bbs_messages', msg.id);
    const path = `bbs_messages/${msg.id}`;

    try {
      if (isLiked) {
        await updateDoc(docRef, {
          likedBy: arrayRemove(username),
          likesCount: Math.max(0, msg.likesCount - 1),
        });
      } else {
        await updateDoc(docRef, {
          likedBy: arrayUnion(username),
          likesCount: msg.likesCount + 1,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // Delete message (Owner only)
  const handleDeletePost = async (messageId: string) => {
    if (!window.confirm('この投稿を削除してもよろしいですか？')) return;
    const path = `bbs_messages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'bbs_messages', messageId));
      if (activeMessageId === messageId) {
        setActiveMessageId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // Filtered post items
  const filteredMessages = messages.filter((msg) => {
    const matchesCategory = activeFilter === 'all' || msg.category === activeFilter;
    const matchesSearch = 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'urgent':
        return {
          bg: 'bg-red-50 text-red-700 border-red-100',
          badge: 'bg-red-500 text-white',
          label: '緊急',
          icon: AlertCircle
        };
      case 'notice':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-100',
          badge: 'bg-blue-600 text-white',
          label: '連絡',
          icon: Megaphone
        };
      case 'handover':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-100',
          badge: 'bg-orange-600 text-white',
          label: '引継ぎ',
          icon: FileCheck
        };
      case 'chat':
      default:
        return {
          bg: 'bg-green-50 text-green-700 border-green-100',
          badge: 'bg-green-600 text-white',
          label: '雑談',
          icon: Coffee
        };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '送信中...';
    const date = timestamp.toDate();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${m}/${d} ${h}:${min}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="py-4 px-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 shadow-sm">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-700 rounded-xl flex items-center justify-center transition-all select-none active:scale-95"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center flex-1">
          <h1 className="text-lg font-black text-gray-900 tracking-tight">連絡事項 (BBS)</h1>
          <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-widest leading-none">
            Workplace Communication
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all select-none active:scale-95 shadow-md shadow-blue-500/15"
          title="新規投稿"
        >
          <Plus size={20} />
        </button>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* Left pane: Notice feeds and controls */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100 h-full">
          
          {/* Quick Filters */}
          <div className="p-3 bg-white border-b border-gray-100 flex flex-col gap-2 shrink-0">
            {/* Search inputs */}
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="投稿を検索（内容、発言者）"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200/80 rounded-xl pl-9 pr-4 py-1.5 text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all placeholder-gray-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Tags row */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin select-none">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'notice', label: '連絡' },
                { id: 'handover', label: '引継ぎ' },
                { id: 'urgent', label: '緊急' },
                { id: 'chat', label: '雑談' },
              ].map((item) => {
                const isActive = activeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveFilter(item.id)}
                    className={`px-3.5 py-1 text-xs font-black rounded-lg transition-all shrink-0 border border-transparent ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="h-44 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-bold text-gray-400">投稿を読み込み中...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={22} />
                </div>
                <h3 className="text-sm font-black text-gray-800">投稿がありません</h3>
                <p className="text-[11px] text-gray-400 mt-1">
                  最初の投稿を作成するか、検索条件やフィルターを変更してください。
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMyPost = msg.author === username;
                const catInfo = getCategoryTheme(msg.category);
                const isLikedByMe = msg.likedBy.includes(username);
                const isUnread = !isMyPost && !msg.readBy?.includes(username);

                return (
                  <motion.div
                    key={msg.id}
                    layout="position"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-[24px] border ${
                      isUnread 
                        ? 'border-blue-200 bg-blue-50/10 shadow-blue-100/20' 
                        : msg.category === 'urgent' 
                          ? 'border-red-100 bg-red-50/10' 
                          : 'border-gray-100'
                    } p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3 relative cursor-pointer`}
                    onClick={() => setActiveMessageId(activeMessageId === msg.id ? null : msg.id)}
                  >
                    {/* Message Header */}
                    <div className="flex items-start justify-between">
                      {/* Left: display metadata */}
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-gray-100 to-gray-200 text-gray-700 border border-gray-100 font-extrabold flex items-center justify-center text-xs select-none shadow-sm">
                            {msg.author.charAt(0)}
                          </div>
                          {isUnread && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-white"></span>
                            </span>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-gray-800 truncate max-w-[120px]">
                              {msg.author}
                            </span>
                            {isMyPost && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 rounded px-1 font-bold scale-90">
                                あなた
                              </span>
                            )}
                            {isUnread && (
                              <span className="text-[9px] bg-red-500 text-white rounded px-1.5 py-0.5 font-bold scale-90 flex items-center gap-0.5 animate-pulse shrink-0">
                                未読
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold mt-0.5">
                            <Clock size={10} />
                            <span>{formatDate(msg.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Category badge & Delete */}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${catInfo.bg} border`}>
                          <catInfo.icon size={10} />
                          {catInfo.label}
                        </span>
                        
                        {isMyPost && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePost(msg.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="この投稿を削除"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Message Body Content */}
                    <div className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap text-left pl-1">
                      {msg.content}
                    </div>

                    {/* Footer buttons / Interactions */}
                    <div className="flex items-center gap-2.5 border-t border-gray-100 pt-3 select-none">
                      {/* Like button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(msg);
                        }}
                        className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all outline-none ${
                          isLikedByMe 
                            ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                            : 'bg-gray-50 text-gray-400 hover:text-gray-700 border border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <ThumbsUp size={13} className={isLikedByMe ? 'fill-blue-600' : ''} />
                        <span>{msg.likesCount}</span>
                      </button>

                      {/* Comment / Reply trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMessageId(activeMessageId === msg.id ? null : msg.id);
                        }}
                        className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all outline-none ${
                          activeMessageId === msg.id 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-gray-50 text-gray-400 hover:text-gray-700 border border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <MessageCircle size={13} />
                        <span>コメ返 ({replies[msg.id] !== undefined ? replies[msg.id].length : (localReplyCounts[msg.id] !== undefined ? localReplyCounts[msg.id] : (msg.replyCount || 0))})</span>
                      </button>
                    </div>

                    {/* Expandable Mini Drawer / Thread inline for mobile screens */}
                    <AnimatePresence>
                      {activeMessageId === msg.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          onClick={(e) => e.stopPropagation()}
                          className="overflow-hidden md:hidden border-t border-gray-100 mt-1 pt-3"
                        >
                          <p className="text-[10px] text-gray-400 font-extrabold tracking-wider mb-2.5">
                            コメ返スレッド
                          </p>

                          {/* Inline Replies feed */}
                          <div className="space-y-2 mb-3 max-h-[180px] overflow-y-auto">
                            {!replies[msg.id] || replies[msg.id].length === 0 ? (
                              <p className="text-[11px] text-gray-400 font-bold py-3 text-center">
                                コメントはありません。最初のメッセージを送りましょう！
                              </p>
                            ) : (
                              replies[msg.id].map((reply) => (
                                <div key={reply.id} className="bg-gray-50/80 p-2.5 rounded-xl border border-gray-100/50 flex flex-col gap-1 text-left">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-black text-gray-800">{reply.author}</span>
                                    <span className="text-[9px] text-gray-400 font-bold">{formatDate(reply.createdAt)}</span>
                                  </div>
                                  <p className="text-xs font-bold text-gray-600 leading-normal">{reply.content}</p>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Quick reply form */}
                          <form onSubmit={(e) => handleCreateReply(e, msg.id)} className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="コメントを入力..."
                              value={newReplyContent}
                              onChange={(e) => setNewReplyContent(e.target.value)}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none placeholder-gray-400 focus:bg-white focus:border-blue-500 transition-all"
                            />
                            <button
                              type="submit"
                              disabled={isSubmittingReply || !newReplyContent.trim()}
                              className="p-1.5 bg-blue-600 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-all select-none"
                            >
                              <Send size={14} />
                            </button>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: Dedicated split thread list (Desktop-friendly view) */}
        <div className="hidden md:flex w-80 bg-white border-l border-gray-100 flex-col overflow-hidden h-full">
          {activeMessageId ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
                <div className="text-left">
                  <h3 className="text-xs font-black text-gray-800">コメント欄</h3>
                  <p className="text-[10px] text-gray-400 font-bold">
                    投稿者: {messages.find(m => m.id === activeMessageId)?.author || ''}
                  </p>
                </div>
                <button
                  onClick={() => setActiveMessageId(null)}
                  className="w-7 h-7 bg-white hover:bg-gray-100 border border-gray-100 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center transition-transform active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Replies Feed List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!replies[activeMessageId] || replies[activeMessageId].length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                    <MessageCircle size={24} className="mb-2 text-gray-300" />
                    <p className="text-xs font-black">コメントがありません</p>
                    <p className="text-[10px] mt-1">
                      下のフォームから、この投稿にメッセージを返信してみましょう。
                    </p>
                  </div>
                ) : (
                  replies[activeMessageId].map((reply) => (
                    <div 
                      key={reply.id} 
                      className="bg-gray-50 border border-gray-200/50 p-3 rounded-2xl flex flex-col gap-1 text-left"
                    >
                      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                        <span className="font-black text-gray-800">{reply.author}</span>
                        <span>{formatDate(reply.createdAt)}</span>
                      </div>
                      <p className="text-xs font-bold text-gray-600 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Write Reply Form */}
              <div className="p-4 border-t border-gray-100 bg-white shrink-0">
                <form onSubmit={(e) => handleCreateReply(e, activeMessageId)} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="コメントを入力してください..."
                    value={newReplyContent}
                    onChange={(e) => setNewReplyContent(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none placeholder-gray-400 focus:bg-white focus:border-blue-500 transition-all text-left"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReply || !newReplyContent.trim()}
                    className="p-2.5 bg-blue-600 disabled:bg-gray-200 text-white rounded-2xl flex items-center justify-center shrink-0 transition-all select-none"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
              <MessageSquare size={32} className="mb-2.5 text-gray-200" />
              <h3 className="text-sm font-black text-gray-800">スレッド未選択</h3>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                投稿を選択すると、PCなどの大きな画面では右側にコメントをリアルタイム表示できます。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal dialog overlay for creating new posts */}
      <AnimatePresence>
        {showCreateForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-gray-100 z-10 flex flex-col"
            >
              <div className="flex justify-between items-center mb-5 shrink-0">
                <div className="text-left">
                  <h3 className="text-lg font-black text-gray-900 leading-tight">新しい投稿</h3>
                  <p className="text-xs text-gray-400 font-bold">情報を職場の同僚と共有します</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-center text-gray-400 transition-transform active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-4">
                {/* Select category */}
                <div className="text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 pl-1">
                    カテゴリ選択
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'notice', label: '連絡', color: 'hover:border-blue-500 border-gray-200 bg-blue-50/10 text-blue-800', activeColor: 'bg-blue-600 border-blue-600 text-white' },
                      { id: 'handover', label: '引継ぎ', color: 'hover:border-orange-500 border-gray-200 bg-orange-50/10 text-orange-800', activeColor: 'bg-orange-600 border-orange-600 text-white' },
                      { id: 'urgent', label: '緊急', color: 'hover:border-red-500 border-gray-200 bg-red-50/10 text-red-800', activeColor: 'bg-red-600 border-red-600 text-white' },
                      { id: 'chat', label: '雑談', color: 'hover:border-green-500 border-gray-200 bg-green-50/10 text-green-800', activeColor: 'bg-green-600 border-green-600 text-white' },
                    ].map((cat) => {
                      const isActive = newCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewCategory(cat.id as any)}
                          className={`py-2 px-1 text-xs font-black rounded-xl border text-center transition-all cursor-pointer ${
                            isActive ? cat.activeColor : cat.color
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content body input */}
                <div className="text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1.5 pl-1">
                    メッセージ内容
                  </label>
                  <textarea
                    placeholder="ここに同僚へ共有したい内容を入力してください。改行が反映されます。"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    rows={4}
                    maxLength={1500}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 font-bold rounded-2xl p-4.5 outline-none focus:bg-white focus:border-blue-500 transition-all text-left placeholder-gray-400 text-sm leading-relaxed"
                    required
                  />
                </div>

                {/* Submitter info row */}
                <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl flex items-center justify-between text-left">
                  <div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">発信者</p>
                    <p className="text-xs font-black text-gray-800 mt-0.5">{username}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold">※同僚にはこのお名前で届きます</span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmiting || !newContent.trim()}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 text-white rounded-2xl font-black text-sm active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
                  >
                    {isSubmiting ? '送信中...' : '送信する'}
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
