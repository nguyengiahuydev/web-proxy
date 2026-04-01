/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  Zap, 
  Globe, 
  Cpu, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Server,
  Lock,
  User,
  RefreshCw,
  ChevronRight,
  CreditCard,
  LogOut,
  Wallet,
  History,
  PlusCircle,
  Mail,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShoppingCart,
  Settings,
  ShieldCheck,
  MessageCircle,
  X,
  Send,
  UserCircle,
  Bot,
  Megaphone,
  Phone,
  SendHorizontal,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { Toaster, toast } from 'sonner';

// Configuration
const PROXY_PRICE_PER_DAY = 2000; 
const ROTATING_SURCHARGE = 5000; 

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  balance: number;
  discount?: number;
  role: 'user' | 'admin';
  createdAt: string;
}

interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'purchase';
  status: 'pending' | 'success' | 'failed';
  description: string;
  createdAt: string;
}

interface ProxyAsset {
  id: string;
  userId: string;
  ip: string;
  port: number;
  username?: string;
  password?: string;
  type: string;
  expiresAt: string;
  createdAt: string;
}

interface GlobalSettings {
  priceMarkup: number;
  announcement: string;
  showAnnouncement: boolean;
  contactEmail: string;
  contactTelegram: string;
  contactPhone: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allPendingTransactions, setAllPendingTransactions] = useState<Transaction[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    priceMarkup: 0,
    announcement: '',
    showAnnouncement: false,
    contactEmail: '',
    contactTelegram: '',
    contactPhone: ''
  });
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'none'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'order' | 'deposit' | 'history' | 'admin'>('order');
  const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'transactions' | 'users' | 'settings'>('dashboard');
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    pendingDeposits: 0,
    totalPurchases: 0
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState<'all' | 'deposit' | 'purchase'>('all');
  const [allProxies, setAllProxies] = useState<any[]>([]);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('');
  const [selectedDepositAmount, setSelectedDepositAmount] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);

  // AI Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý AI của PROXYPRO. Tôi có thể giúp gì cho bạn?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [formData, setFormData] = useState({
    userId: '',
    numProxy: 1,
    passwordproxy: '',
    usernameproxy: '',
    tinhtrangproxy: 'Không xoay',
    thoigianxoay: 0,
    soNgay: 30,
    tenKhach: ''
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile]);

  const api = axios.create({
    baseURL: '/api',
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const fetchProfile = async () => {
    try {
      const res = await api.get('/user/profile');
      setProfile(res.data);
      setFormData(prev => ({ ...prev, userId: res.data.id, tenKhach: res.data.displayName }));
    } catch (err) {
      handleLogout();
    }
  };

  const fetchData = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const [txRes, proxyRes, settingsRes] = await Promise.all([
        api.get('/user/transactions'),
        api.get('/user/proxies'),
        api.get('/settings')
      ]);
      setTransactions(txRes.data);
      setAllProxies(proxyRes.data);
      setGlobalSettings(settingsRes.data);
      if (!localSettings) setLocalSettings(settingsRes.data);
      
      if (settingsRes.data.announcement && settingsRes.data.showAnnouncement && settingsRes.data.announcement !== lastAnnouncement) {
        setShowAnnouncementPopup(true);
        setLastAnnouncement(settingsRes.data.announcement);
      }

      if (profile?.role === 'admin') {
        const usersRes = await api.get('/admin/users');
        setAllUsers(usersRes.data);
        const totalBal = usersRes.data.reduce((acc: number, u: any) => acc + (u.balance || 0), 0);
        setStats(prev => ({ ...prev, totalUsers: usersRes.data.length, totalBalance: totalBal }));
      }
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setAuthMode('none');
      fetchProfile();
    } else {
      setAuthMode('login');
    }
  }, []);

  useEffect(() => {
    if (profile) {
      fetchData();
      const interval = setInterval(fetchData, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [profile]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setProfile(null);
    setAuthMode('login');
    toast.success('Đã đăng xuất!');
  };

  const totalPrice = useMemo(() => {
    let base = formData.numProxy * formData.soNgay * PROXY_PRICE_PER_DAY;
    if (formData.tinhtrangproxy === 'Xoay') {
      base += formData.numProxy * ROTATING_SURCHARGE;
    }
    // Apply Global Markup
    const markupAmount = (base * (globalSettings.priceMarkup || 0)) / 100;
    let finalPrice = base + markupAmount;

    // Apply User-specific Discount
    if (profile?.discount && profile.discount > 0) {
      finalPrice = finalPrice * (1 - profile.discount / 100);
    }

    return finalPrice;
  }, [formData, globalSettings.priceMarkup, profile?.discount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numProxy' || name === 'soNgay' || name === 'thoigianxoay' ? parseInt(value) || 0 : value
    }));
  };

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.email.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [allUsers, userSearch]);

  const filteredTransactions = useMemo(() => {
    return allPendingTransactions.filter(tx => {
      const matchesSearch = tx.userId.toLowerCase().includes(txSearch.toLowerCase()) || 
                           tx.description.toLowerCase().includes(txSearch.toLowerCase());
      const matchesFilter = txFilter === 'all' || tx.type === txFilter;
      return matchesSearch && matchesFilter;
    });
  }, [allPendingTransactions, txSearch, txFilter]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      if (authMode === 'register') {
        const res = await api.post('/auth/register', { email, password, displayName });
        localStorage.setItem('token', res.data.token);
        setProfile(res.data.user);
        toast.success('Đăng ký tài khoản thành công!');
      } else {
        const res = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', res.data.token);
        setProfile(res.data.user);
        toast.success('Đăng nhập thành công!');
      }
      setAuthMode('none');
      fetchData();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      toast.error(errorMessage);
      setStatus({ type: 'error', msg: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    toast.error('Đăng nhập Google hiện không khả dụng với hệ thống SQLite. Vui lòng sử dụng Email/Mật khẩu.');
  };

  const handleDeposit = async (amount: number) => {
    setSelectedDepositAmount(amount);
    setLoading(true);
    try {
      await api.post('/deposit', { amount });
      toast.success('Yêu cầu nạp tiền đã được gửi. Vui lòng chuyển khoản theo hướng dẫn.');
      setStatus({ type: 'success', msg: 'Yêu cầu nạp tiền đã được gửi. Vui lòng chuyển khoản theo nội dung hướng dẫn.' });
      fetchData();
      fetchProfile();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.balance < totalPrice) {
      toast.error('Số dư không đủ. Vui lòng nạp thêm tiền.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/proxy/order', { ...formData, totalPrice });
      if (response.data.status === 'success') {
        toast.success('Đơn hàng đã được khởi tạo thành công!');
        fetchData();
        fetchProfile();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Không thể xử lý đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransaction = async (tx: Transaction) => {
    try {
      setLoading(true);
      await api.post('/admin/transaction/approve', { transactionId: tx.id });
      toast.success('Phê duyệt giao dịch thành công!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserBalance = async (userId: string, newBalance: number) => {
    try {
      await api.post('/admin/user/update', { userId, balance: newBalance, discount: profile?.discount || 0, displayName: profile?.displayName || '' });
      toast.success('Cập nhật số dư thành công!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleUpdateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
    try {
      const targetUser = allUsers.find(u => u.id === userId);
      await api.post('/admin/user/update', { 
        userId, 
        balance: data.balance ?? targetUser?.balance ?? 0, 
        discount: data.discount ?? targetUser?.discount ?? 0, 
        displayName: data.displayName ?? targetUser?.displayName ?? '' 
      });
      toast.success('Cập nhật thông tin người dùng thành công!');
      setIsEditUserModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<GlobalSettings>) => {
    try {
      await api.post('/admin/settings/update', { ...globalSettings, ...newSettings });
      toast.success('Cập nhật cài đặt thành công!');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Bạn là trợ lý hỗ trợ khách hàng thông minh cho PROXYPRO.
          Dịch vụ của chúng tôi cung cấp Proxy IPv4/IPv6 tốc độ cao, ổn định, không giới hạn băng thông.
          
          Thông tin liên hệ:
          - Email: ${globalSettings.contactEmail}
          - Telegram: ${globalSettings.contactTelegram}
          - Phone: ${globalSettings.contactPhone}
          
          Hướng dẫn nạp tiền: Người dùng chuyển khoản qua MB Bank (0355656730 ) với nội dung "PROXY [tên tài khoản]".
          
          Hãy trả lời bằng tiếng Việt, phong cách chuyên nghiệp, thân thiện và ngắn gọn. Nếu không biết câu trả lời, hãy hướng dẫn khách hàng liên hệ qua Telegram ${globalSettings.contactTelegram}.
          
          Câu hỏi của khách hàng: ${chatInput}` }] }
        ]
      });
      
      const aiText = response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
      setChatMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Đã sao chép ${field}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (authMode !== 'none') {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6">
        <Toaster position="top-right" theme="dark" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
          <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-violet-600/10 blur-[120px] rounded-full" />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              {authMode === 'login' ? 'Đăng nhập để quản lý Proxy của bạn' : 'Bắt đầu trải nghiệm dịch vụ Proxy tốt nhất'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên hiển thị</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    required
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nhập tên của bạn"
                    className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  required
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  required
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {status && status.type === 'error' && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-medium">
                {status.msg}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#121214] px-2 text-slate-500">Hoặc tiếp tục với</span></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google
          </button>

          <p className="text-center mt-8 text-sm text-slate-500">
            {authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="ml-1 text-indigo-500 font-bold hover:underline"
            >
              {authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans selection:bg-indigo-500/30">
      <Toaster position="top-right" theme="dark" richColors />
      
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-violet-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('order')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">PROXY<span className="text-indigo-500">PRO</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            {globalSettings.contactTelegram && (
              <a href={`https://t.me/${globalSettings.contactTelegram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5 text-sm font-medium">
                <SendHorizontal className="w-4 h-4" />
                Hỗ trợ Telegram
              </a>
            )}
            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <Wallet className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-white">
                {profile?.balance.toLocaleString('vi-VN')}đ
              </span>
              <button 
                onClick={() => setActiveTab('deposit')}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold text-white">{profile?.displayName}</div>
                <div className="text-[10px] text-slate-500">{profile?.email}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2.5 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 rounded-xl text-slate-400 hover:text-rose-400 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-12 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'order', label: 'Mua Proxy', icon: ShoppingCart },
            { id: 'deposit', label: 'Nạp tiền', icon: Wallet },
            { id: 'history', label: 'Lịch sử', icon: History },
            ...(isAdmin ? [{ id: 'admin', label: 'Quản trị', icon: ShieldCheck }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'order' && (
            <motion.div 
              key="order"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-2 gap-16 items-start"
            >
              {/* Left Column: Hero */}
              <div className="space-y-12">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                    <Zap className="w-3 h-3" /> Hệ thống Proxy sạch 100%
                  </div>
                  <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-white leading-[1.1]">
                    Giải pháp Proxy <br />
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-violet-400">Chuyên nghiệp</span>
                  </h1>
                  <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                    Cung cấp Proxy IPv4/IPv6 tốc độ cao, ổn định, không giới hạn băng thông. Tự động kích hoạt ngay sau khi thanh toán.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  {[
                    { icon: Globe, title: "Đa quốc gia", desc: "Hệ thống IP trải dài khắp thế giới" },
                    { icon: Zap, title: "Tốc độ cao", desc: "Băng thông 1Gbps ổn định 99.9%" },
                    { icon: Shield, title: "Bảo mật", desc: "Mã hóa dữ liệu, ẩn danh hoàn toàn" },
                    { icon: RefreshCw, title: "Tự động", desc: "Gia hạn và kích hoạt tự động" },
                  ].map((feature, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 transition-colors group">
                      <feature.icon className="w-8 h-8 text-indigo-500 mb-4 group-hover:scale-110 transition-transform" />
                      <h3 className="text-white font-bold mb-1">{feature.title}</h3>
                      <p className="text-sm text-slate-500">{feature.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Order Form */}
              <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Server className="w-32 h-32" />
                </div>

                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-indigo-500" />
                    Cấu hình gói Proxy
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số lượng Proxy</label>
                        <input required type="number" name="numProxy" min="1" value={formData.numProxy} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số ngày sử dụng</label>
                        <input required type="number" name="soNgay" min="1" value={formData.soNgay} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white" />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username Proxy</label>
                        <input required type="text" name="usernameproxy" value={formData.usernameproxy} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password Proxy</label>
                        <input required type="password" name="passwordproxy" value={formData.passwordproxy} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white" />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loại Proxy</label>
                        <select name="tinhtrangproxy" value={formData.tinhtrangproxy} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all appearance-none text-white">
                          <option value="Không xoay">Tĩnh (Static)</option>
                          <option value="Xoay">Xoay (Rotating)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian xoay (phút)</label>
                        <input type="number" name="thoigianxoay" disabled={formData.tinhtrangproxy === 'Không xoay'} value={formData.thoigianxoay} onChange={handleInputChange} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all disabled:opacity-30 text-white" />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-medium">Tổng thanh toán:</span>
                        <div className="text-right">
                          <span className="text-3xl font-black text-white">{totalPrice.toLocaleString('vi-VN')}đ</span>
                          {globalSettings.priceMarkup > 0 && (
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Đã bao gồm phí dịch vụ</div>
                          )}
                        </div>
                      </div>

                      {status && (
                        <div className={`p-4 rounded-xl flex items-start gap-3 ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                          <span className="text-sm font-medium">{status.msg}</span>
                        </div>
                      )}

                      <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
                        {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Thanh toán ngay <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'deposit' && (
            <motion.div 
              key="deposit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-indigo-500" />
                  Nạp tiền vào tài khoản
                </h2>

                <div className="grid md:grid-cols-3 gap-6 mb-12">
                  {[50000, 100000, 200000, 500000, 1000000, 2000000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleDeposit(amount)}
                      className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group text-center"
                    >
                      <div className="text-2xl font-black text-white mb-1 group-hover:text-indigo-400">
                        {amount.toLocaleString('vi-VN')}đ
                      </div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Chọn gói này</div>
                    </button>
                  ))}
                </div>

                <div className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <CreditCard className="w-32 h-32" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-indigo-400" />
                    Hướng dẫn chuyển khoản
                  </h3>
                  
                  <div className="space-y-4 relative z-10">
                    {[
                      { label: 'Ngân hàng', value: 'MB BANK (Quân Đội)', field: 'Ngân hàng' },
                      { label: 'Số tài khoản', value: '0355656730', field: 'Số tài khoản' },
                      { label: 'Chủ tài khoản', value: 'NGUYEN GIA HUY', field: 'Chủ tài khoản' },
                      { label: 'Nội dung', value: `PROXY ${profile?.email?.split('@')[0]}`, field: 'Nội dung' },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-white/5 gap-2">
                        <span className="text-sm text-slate-400">{item.label}:</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${item.label === 'Nội dung' ? 'text-indigo-400 uppercase' : 'text-white'}`}>
                            {item.value}
                          </span>
                          <button 
                            onClick={() => copyToClipboard(item.value, item.field)}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                          >
                            {copiedField === item.field ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500 italic max-w-md">
                      * Hệ thống sẽ tự động cộng tiền sau 1-3 phút kể từ khi nhận được tiền. Nếu quá 10 phút chưa thấy tiền, vui lòng liên hệ hỗ trợ.
                    </p>
                    <button 
                      onClick={() => toast.info('Vui lòng thực hiện chuyển khoản trên ứng dụng ngân hàng của bạn. Hệ thống sẽ tự động cập nhật.')}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all"
                    >
                      Tôi đã chuyển khoản
                    </button>
                  </div>

                  {selectedDepositAmount && (
                    <div className="mt-8 flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-2xl">
                      <div className="text-center space-y-1">
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Quét mã QR để thanh toán</p>
                        <p className="text-2xl font-black text-indigo-600">{selectedDepositAmount.toLocaleString('vi-VN')}đ</p>
                      </div>
                      <div className="relative p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                        <img 
                          src={`https://img.vietqr.io/image/MB-0355656730-compact2.png?amount=${selectedDepositAmount}&addInfo=PROXY%20${profile?.email?.split('@')[0]}&accountName=NGUYEN%20GIA%20HUY`}
                          alt="VietQR"
                          className="w-64 h-64 object-contain mix-blend-multiply"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-2xl pointer-events-none" />
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full">
                        <Zap className="w-3 h-3 text-indigo-600" />
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Tự động cộng tiền sau khi quét</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto space-y-12"
            >
              {/* My Proxies Section */}
              <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Server className="w-6 h-6 text-indigo-500" />
                    Proxy của tôi ({allProxies.length})
                  </h2>
                  {allProxies.length > 0 && (
                    <button 
                      onClick={() => {
                        const text = allProxies.map(p => `${p.ip}:${p.port}:${p.username}:${p.password}`).join('\n');
                        copyToClipboard(text, 'Tất cả Proxy');
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Sao chép tất cả
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <th className="pb-4 px-4">Địa chỉ IP</th>
                        <th className="pb-4 px-4">Cổng (Port)</th>
                        <th className="pb-4 px-4">Tài khoản</th>
                        <th className="pb-4 px-4">Mật khẩu</th>
                        <th className="pb-4 px-4">Hết hạn</th>
                        <th className="pb-4 px-4">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {allProxies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                            Bạn chưa sở hữu Proxy nào. Hãy mua ngay để bắt đầu!
                          </td>
                        </tr>
                      ) : (
                        allProxies.map((p) => (
                          <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <td className="py-4 px-4 font-mono text-white">{p.ip}</td>
                            <td className="py-4 px-4 font-mono text-indigo-400">{p.port}</td>
                            <td className="py-4 px-4 text-slate-400">{p.username}</td>
                            <td className="py-4 px-4 text-slate-400">••••••••</td>
                            <td className="py-4 px-4">
                              <div className="text-xs text-slate-300 font-bold">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('vi-VN') : ''}</div>
                              <div className="text-[10px] text-slate-500">{p.expiresAt ? new Date(p.expiresAt).toLocaleTimeString('vi-VN') : ''}</div>
                            </td>
                            <td className="py-4 px-4">
                              <button 
                                onClick={() => copyToClipboard(`${p.ip}:${p.port}:${p.username}:${p.password}`, 'Thông tin Proxy')}
                                className="p-2 bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/20 rounded-lg text-slate-500 hover:text-indigo-400 transition-all"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <History className="w-6 h-6 text-indigo-500" />
                  Lịch sử giao dịch
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <th className="pb-4 px-4">Thời gian</th>
                        <th className="pb-4 px-4">Loại</th>
                        <th className="pb-4 px-4">Số tiền</th>
                        <th className="pb-4 px-4">Trạng thái</th>
                        <th className="pb-4 px-4">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                            Chưa có giao dịch nào được ghi lại.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 text-slate-400">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : ''}
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                                tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                              }`}>
                                {tx.type === 'deposit' ? 'Nạp tiền' : 'Mua Proxy'}
                              </span>
                            </td>
                            <td className={`py-4 px-4 font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="py-4 px-4">
                              <span className={`flex items-center gap-1.5 text-xs font-medium ${
                                tx.status === 'success' ? 'text-emerald-400' : 
                                tx.status === 'pending' ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {tx.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Chờ duyệt' : 'Thất bại'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-slate-500 max-w-xs truncate">
                              {tx.description}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto"
            >
              <div className="bg-[#121214] border border-white/10 rounded-[32px] p-8 lg:p-10 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-indigo-500" />
                    Bảng điều khiển Admin
                  </h2>
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    {[
                      { id: 'dashboard', label: 'Tổng quan', icon: Zap },
                      { id: 'transactions', label: 'Giao dịch', icon: History },
                      { id: 'users', label: 'Người dùng', icon: UserCircle },
                      { id: 'settings', label: 'Cài đặt', icon: Settings },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setAdminSubTab(sub.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          adminSubTab === sub.id 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <sub.icon className="w-3.5 h-3.5" />
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>

                {adminSubTab === 'dashboard' && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                      { label: 'Tổng người dùng', value: stats.totalUsers, icon: User, color: 'text-blue-400' },
                      { label: 'Tổng số dư (VND)', value: stats.totalBalance.toLocaleString('vi-VN'), icon: Wallet, color: 'text-emerald-400' },
                      { label: 'Nạp tiền chờ duyệt', value: stats.pendingDeposits, icon: Clock, color: 'text-amber-400' },
                      { label: 'Tổng đơn hàng', value: stats.totalPurchases, icon: ShoppingCart, color: 'text-indigo-400' },
                    ].map((item, i) => (
                      <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-2 rounded-lg bg-white/5 ${item.color}`}>
                            <item.icon className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-white">{item.value}</div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {adminSubTab === 'transactions' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-white">Giao dịch chờ duyệt ({filteredTransactions.length})</h3>
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Tìm kiếm giao dịch..." 
                            value={txSearch}
                            onChange={(e) => setTxSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-xs"
                          />
                        </div>
                        <select 
                          value={txFilter}
                          onChange={(e) => setTxFilter(e.target.value as any)}
                          className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500"
                        >
                          <option value="all">Tất cả loại</option>
                          <option value="deposit">Nạp tiền</option>
                          <option value="purchase">Mua Proxy</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                            <th className="pb-4 px-4">Thời gian</th>
                            <th className="pb-4 px-4">User ID</th>
                            <th className="pb-4 px-4">Số tiền</th>
                            <th className="pb-4 px-4">Mô tả</th>
                            <th className="pb-4 px-4">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-500 italic">
                                Không có giao dịch nào khớp với tìm kiếm.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.map((tx) => (
                              <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-4 px-4 text-slate-400 text-xs">
                                  {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : ''}
                                </td>
                                <td className="py-4 px-4 text-slate-400 font-mono text-xs truncate max-w-[150px]">{tx.userId}</td>
                                <td className={`py-4 px-4 font-bold ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="py-4 px-4 text-slate-500 text-xs max-w-xs truncate">{tx.description}</td>
                                <td className="py-4 px-4">
                                  <button 
                                    onClick={() => handleApproveTransaction(tx)}
                                    disabled={loading}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                  >
                                    Phê duyệt
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {adminSubTab === 'users' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold text-white">Quản lý người dùng ({allUsers.length})</h3>
                      <div className="relative w-full sm:w-64">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Tìm kiếm người dùng..." 
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-xs"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-white/5">
                            <th className="pb-4 px-4">Người dùng</th>
                            <th className="pb-4 px-4">Số dư</th>
                            <th className="pb-4 px-4">Ngày tạo</th>
                            <th className="pb-4 px-4">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-slate-500 italic">
                                Không tìm thấy người dùng nào.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u) => (
                              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-4 px-4">
                                  <div className="font-bold text-white">{u.displayName}</div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                  <div className="text-[10px] text-slate-600 font-mono mt-1">{u.id}</div>
                                </td>
                                <td className="py-4 px-4 font-bold text-indigo-400">
                                  {u.balance.toLocaleString('vi-VN')}đ
                                  {u.discount && u.discount > 0 && (
                                    <div className="text-[10px] text-emerald-400 font-bold">Giảm giá: {u.discount}%</div>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-slate-500 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : ''}</td>
                                <td className="py-4 px-4">
                                  <button 
                                    onClick={() => {
                                      setEditingUser(u);
                                      setIsEditUserModalOpen(true);
                                    }}
                                    className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-2"
                                  >
                                    <Settings className="w-4 h-4" />
                                    <span className="text-xs font-bold">Chỉnh sửa</span>
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {adminSubTab === 'settings' && localSettings && (
                  <div className="space-y-8 max-w-2xl">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tăng giá (%)</label>
                        <input 
                          type="number" 
                          value={localSettings.priceMarkup} 
                          onChange={(e) => setLocalSettings({ ...localSettings, priceMarkup: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm" 
                        />
                        <p className="text-[10px] text-slate-500 italic">* Giá bán = Giá gốc + (Giá gốc * % tăng)</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hiện thông báo</label>
                        <div className="flex items-center gap-3 h-[50px]">
                          <button 
                            onClick={() => setLocalSettings({ ...localSettings, showAnnouncement: !localSettings.showAnnouncement })}
                            className={`w-12 h-6 rounded-full transition-all relative ${localSettings.showAnnouncement ? 'bg-indigo-600' : 'bg-white/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.showAnnouncement ? 'left-7' : 'left-1'}`} />
                          </button>
                          <span className="text-sm font-medium text-slate-400">{localSettings.showAnnouncement ? 'Đang bật' : 'Đang tắt'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nội dung thông báo</label>
                      <textarea 
                        value={localSettings.announcement} 
                        onChange={(e) => setLocalSettings({ ...localSettings, announcement: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white resize-none"
                        placeholder="Nhập nội dung thông báo cho khách hàng..."
                      />
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email liên hệ</label>
                        <input 
                          type="email" 
                          value={localSettings.contactEmail} 
                          onChange={(e) => setLocalSettings({ ...localSettings, contactEmail: e.target.value })}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Telegram</label>
                        <input 
                          type="text" 
                          value={localSettings.contactTelegram} 
                          onChange={(e) => setLocalSettings({ ...localSettings, contactTelegram: e.target.value })}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số điện thoại</label>
                        <input 
                          type="text" 
                          value={localSettings.contactPhone} 
                          onChange={(e) => setLocalSettings({ ...localSettings, contactPhone: e.target.value })}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm" 
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-end">
                      <button 
                        onClick={() => handleUpdateSettings(localSettings)}
                        disabled={loading}
                        className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Lưu cấu hình
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-12 mt-24 bg-black/40">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">PROXYPRO</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              Giải pháp Proxy hàng đầu Việt Nam. Chất lượng, ổn định và bảo mật tuyệt đối.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Liên hệ</h4>
            <div className="space-y-3">
              {globalSettings.contactEmail && (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  {globalSettings.contactEmail}
                </div>
              )}
              {globalSettings.contactPhone && (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Phone className="w-4 h-4 text-indigo-500" />
                  {globalSettings.contactPhone}
                </div>
              )}
              {globalSettings.contactTelegram && (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <SendHorizontal className="w-4 h-4 text-indigo-500" />
                  {globalSettings.contactTelegram}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Dịch vụ</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Proxy IPv4 Tĩnh</li>
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Proxy IPv4 Xoay</li>
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Proxy IPv6</li>
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">API Tích hợp</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest">Chính sách</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Điều khoản dịch vụ</li>
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Chính sách bảo mật</li>
              <li className="hover:text-indigo-400 cursor-pointer transition-colors">Chính sách hoàn tiền</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-600">© 2026 PROXYPRO. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-3 h-3" />
              Verified Secure
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Zap className="w-3 h-3" />
              Powered by AI
            </div>
          </div>
        </div>
      </footer>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditUserModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#121214] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <button 
                onClick={() => setIsEditUserModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-500">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Chỉnh sửa người dùng</h2>
                    <p className="text-xs text-slate-500">{editingUser.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tên hiển thị</label>
                    <input 
                      type="text" 
                      defaultValue={editingUser.displayName}
                      id="edit-displayName"
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số dư (VND)</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        defaultValue={editingUser.balance}
                        id="edit-balance"
                        className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm"
                      />
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => {
                            const val = prompt('Số tiền muốn cộng:');
                            if (val) {
                              const input = document.getElementById('edit-balance') as HTMLInputElement;
                              input.value = (parseInt(input.value) + parseInt(val)).toString();
                            }
                          }}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-bold hover:bg-emerald-500/20"
                        >
                          + Cộng
                        </button>
                        <button 
                          onClick={() => {
                            const val = prompt('Số tiền muốn trừ:');
                            if (val) {
                              const input = document.getElementById('edit-balance') as HTMLInputElement;
                              input.value = (parseInt(input.value) - parseInt(val)).toString();
                            }
                          }}
                          className="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-md text-[10px] font-bold hover:bg-rose-500/20"
                        >
                          - Trừ
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giảm giá (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      defaultValue={editingUser.discount || 0}
                      id="edit-discount"
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm"
                    />
                    <p className="text-[10px] text-slate-500 italic">* Giảm giá trực tiếp cho mọi đơn hàng của user này.</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsEditUserModalOpen(false)}
                    className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => {
                      const displayName = (document.getElementById('edit-displayName') as HTMLInputElement).value;
                      const balance = parseInt((document.getElementById('edit-balance') as HTMLInputElement).value) || 0;
                      const discount = parseInt((document.getElementById('edit-discount') as HTMLInputElement).value) || 0;
                      handleUpdateUserProfile(editingUser.id, { displayName, balance, discount });
                    }}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Announcement Popup */}
      <AnimatePresence>
        {showAnnouncementPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-[#121214] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-indigo-600 to-violet-600" />
              <button 
                onClick={() => setShowAnnouncementPopup(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-500">
                  <Megaphone className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white">Thông báo hệ thống</h2>
                  <p className="text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {globalSettings.announcement}
                  </p>
                </div>
                <button 
                  onClick={() => setShowAnnouncementPopup(false)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Chat Widget */}
      <div className="fixed bottom-8 right-8 z-40">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-20 right-0 w-[380px] h-[520px] bg-[#121214] border border-white/10 rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 bg-indigo-600 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Hỗ trợ AI</div>
                    <div className="text-[10px] text-indigo-200 font-medium flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Trực tuyến
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white/5 text-slate-300 border border-white/10 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5 bg-black/20">
                <div className="relative">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Nhập tin nhắn..."
                    className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-all text-white text-sm"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${
            isChatOpen ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
          }`}
        >
          {isChatOpen ? <X className="w-8 h-8" /> : <MessageCircle className="w-8 h-8" />}
        </button>
      </div>
    </div>
  );
}
