import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Calendar,
  Trash2,
  ChevronRight,
  PieChart as PieChartIcon,
  X,
  LogOut,
  Settings as SettingsIcon,
  BarChart3,
  FileText,
  User as UserIcon,
  LogIn,
  Save,
  Plus,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfYear, eachMonthOfInterval } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn, formatCurrency, type Transaction, type User } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'history' | 'settings'>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    units: 1,
    unit_price: 0,
    category: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [transRes, sumRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/summary')
      ]);
      const transData = await transRes.json();
      const sumData = await sumRes.json();
      setTransactions(transData);
      setSummary(sumData || { totalIncome: 0, totalExpense: 0 });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleLogin = async () => {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    setTransactions([]);
    setSummary({ totalIncome: 0, totalExpense: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = formData.type === 'income' ? formData.units * formData.unit_price : formData.unit_price;
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount
        }),
      });
      if (response.ok) {
        setIsModalOpen(false);
        setFormData({
          type: 'income',
          units: 1,
          unit_price: 0,
          category: '',
          description: '',
          date: format(new Date(), 'yyyy-MM-dd'),
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (response.ok) fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const updateSettings = async (newSettings: any) => {
    if (!user) return;
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
      if (response.ok) {
        setUser({ ...user, settings: newSettings });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export-sheets', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        alert('Gagal mengekspor. Pastikan Anda sudah login dengan Google.');
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const pieData = React.useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const COLORS = ['#008D4C', '#FFD700', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];

  const chartData = React.useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayTransactions = transactions.filter(t => t.date === dayStr);
      const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { name: format(day, 'd MMM'), income, expense };
    });
  }, [transactions]);

  const monthlyReport = React.useMemo(() => {
    const start = startOfYear(new Date());
    const months = eachMonthOfInterval({ start, end: new Date() });
    return months.map(month => {
      const monthTransactions = transactions.filter(t => isSameMonth(parseISO(t.date), month));
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { month: format(month, 'MMMM yyyy', { locale: localeId }), income, expense, profit: income - expense };
    }).reverse();
  }, [transactions]);

  const currentMonthIncome = transactions
    .filter(t => t.type === 'income' && isSameMonth(parseISO(t.date), new Date()))
    .reduce((sum, t) => sum + t.amount, 0);

  const targetProgress = user ? Math.min((currentMonthIncome / user.settings.targetSales) * 100, 100) : 0;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50">Memuat...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
          <div className="w-20 h-20 bg-[--color-sewu-yellow] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <UserIcon size={40} className="text-black" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Sewu Frame</h1>
          <p className="text-zinc-500 mb-8">Kelola laporan keuangan bisnis photobooth Anda dengan mudah.</p>
          <button onClick={handleLogin} className="w-full btn-sewu py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-100">
            <LogIn size={20} />
            Masuk dengan Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-72 sidebar-sewu p-6 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-md overflow-hidden p-2">
            <img 
              src="/Logo Sewu Frame.png" 
              alt="Sewu Frame Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="font-bold text-xs text-center leading-tight">SEWU<br/>FRAME</span>';
              }}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Sewu Frame</h1>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
            { id: 'report', label: 'Laporan Bulanan', icon: FileText },
            { id: 'history', label: 'Riwayat', icon: ReceiptText },
            { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-semibold",
                activeTab === tab.id ? "bg-black text-white shadow-lg" : "text-zinc-800 hover:bg-black/5"
              )}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Target Progress */}
        <div className="mt-4 bg-white/50 p-4 rounded-2xl border border-black/5">
          <div className="flex justify-between items-end mb-2">
            <p className="text-xs font-bold text-zinc-700 uppercase">Target Penjualan</p>
            <p className="text-xs font-bold text-zinc-900">{Math.round(targetProgress)}%</p>
          </div>
          <div className="h-2 w-full bg-black/10 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${targetProgress}%` }} className="h-full bg-[--color-sewu-green]" />
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 font-medium">
            {formatCurrency(currentMonthIncome)} / {formatCurrency(user.settings.targetSales)}
          </p>
        </div>

        <div className="mt-auto space-y-4">
          <button onClick={() => setIsModalOpen(true)} className="w-full btn-sewu py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
            <PlusCircle size={20} />
            Tambah Data
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-zinc-800 font-bold text-sm hover:text-rose-600 transition-colors">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">
              {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'report' ? 'Laporan Laba/Rugi' : activeTab === 'history' ? 'Riwayat Transaksi' : 'Pengaturan'}
            </h2>
            <p className="text-zinc-500">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })}</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Save size={16} className="text-emerald-600" />
              Export ke Sheets
            </button>
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm">
              <div className="w-8 h-8 bg-[--color-sewu-yellow] rounded-full flex items-center justify-center font-bold text-xs">{user.name[0]}</div>
              <span className="text-sm font-bold pr-2">{user.name}</span>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-4"><TrendingUp size={24} /></div>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Total Pemasukan</p>
                <h3 className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(summary.totalIncome)}</h3>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl w-fit mb-4"><TrendingDown size={24} /></div>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-wider">Total Pengeluaran</p>
                <h3 className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(summary.totalExpense)}</h3>
              </div>
              <div className="bg-[--color-sewu-green] p-6 rounded-3xl shadow-xl shadow-emerald-100 text-white">
                <div className="p-2 bg-white/20 rounded-xl w-fit mb-4"><Wallet size={24} /></div>
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider">Saldo Kas</p>
                <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary.totalIncome - summary.totalExpense)}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-bold text-zinc-900">Tren Pemasukan Harian</h4>
                <div className="flex gap-2">
                  {['bar', 'area', 'pie'].map((type) => (
                    <button
                      key={type}
                      onClick={() => updateSettings({ ...user.settings, chartType: type })}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        user.settings.chartType === type ? "bg-[--color-sewu-yellow] text-black" : "bg-zinc-100 text-zinc-400"
                      )}
                    >
                      {type === 'bar' ? <BarChart3 size={18} /> : type === 'area' ? <TrendingUp size={18} /> : <PieChartIcon size={18} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {user.settings.chartType === 'bar' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="income" fill="#008D4C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : user.settings.chartType === 'area' ? (
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#008D4C" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#008D4C" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="income" stroke="#008D4C" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                    </AreaChart>
                  ) : (
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Bulan</th>
                  <th className="px-6 py-4 text-right">Pemasukan</th>
                  <th className="px-6 py-4 text-right">Pengeluaran</th>
                  <th className="px-6 py-4 text-right">Laba/Rugi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {monthlyReport.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-zinc-900">{row.month}</td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-bold">{formatCurrency(row.income)}</td>
                    <td className="px-6 py-4 text-right text-rose-600 font-bold">{formatCurrency(row.expense)}</td>
                    <td className={cn("px-6 py-4 text-right font-bold", row.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {formatCurrency(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Detail</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-zinc-600">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight",
                          t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-zinc-900">{t.description || '-'}</p>
                        {t.type === 'income' && (
                          <p className="text-xs text-zinc-500">{t.units} unit x {formatCurrency(t.unit_price)}</p>
                        )}
                      </td>
                      <td className={cn("px-6 py-4 text-sm font-bold text-right", t.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleDelete(t.id)} className="p-2 text-zinc-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
              <h4 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <BarChart3 size={20} className="text-[--color-sewu-green]" /> Target Penjualan
              </h4>
              <div className="space-y-4">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Target Bulanan (IDR)</label>
                <input
                  type="number"
                  value={user.settings.targetSales}
                  onChange={(e) => updateSettings({ ...user.settings, targetSales: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <PlusCircle size={20} className="text-[--color-sewu-green]" /> Manajemen Item & Layanan
                </h4>
                <button 
                  onClick={() => {
                    const name = prompt('Nama item baru:');
                    const price = parseInt(prompt('Harga item:') || '0');
                    if (name) updateSettings({ ...user.settings, items: [...user.settings.items, { name, price, type: 'income' }] });
                  }}
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="space-y-3">
                {user.settings.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div>
                      <p className="font-bold text-zinc-900">{item.name}</p>
                      <p className="text-xs text-zinc-500">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const newItems = [...user.settings.items];
                          newItems[idx].hidden = !newItems[idx].hidden;
                          updateSettings({ ...user.settings, items: newItems });
                        }}
                        className={cn("p-2 rounded-lg", item.hidden ? "bg-zinc-200 text-zinc-400" : "bg-emerald-50 text-emerald-600")}
                      >
                        {item.hidden ? 'Sembunyi' : 'Aktif'}
                      </button>
                      <button 
                        onClick={() => {
                          const newItems = user.settings.items.filter((_, i) => i !== idx);
                          updateSettings({ ...user.settings, items: newItems });
                        }}
                        className="p-2 bg-rose-50 text-rose-600 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <h3 className="text-xl font-bold text-zinc-900">Catat Transaksi</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="flex p-1 bg-zinc-100 rounded-xl">
                  {['income', 'expense'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: t as any, category: '', unit_price: 0 })}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                        formData.type === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                      )}
                    >
                      {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {formData.type === 'income' ? (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Layanan / Item</label>
                        <div className="grid grid-cols-2 gap-2">
                          {user.settings.items.filter(i => !i.hidden).map((item) => (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => setFormData({ ...formData, category: item.name, unit_price: item.price })}
                              className={cn(
                                "px-4 py-3 rounded-xl border text-sm font-bold transition-all",
                                formData.category === item.name ? "bg-[--color-sewu-yellow] border-black/10 text-black" : "bg-zinc-50 border-zinc-200 text-zinc-600"
                              )}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Jumlah Unit</label>
                          <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-xl p-1">
                            <button type="button" onClick={() => setFormData({ ...formData, units: Math.max(1, formData.units - 1) })} className="p-2 bg-white rounded-lg shadow-sm"><Minus size={16}/></button>
                            <span className="flex-1 text-center font-bold">{formData.units}</span>
                            <button type="button" onClick={() => setFormData({ ...formData, units: formData.units + 1 })} className="p-2 bg-white rounded-lg shadow-sm"><Plus size={16}/></button>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Total Harga</label>
                          <div className="px-4 py-3 bg-zinc-100 rounded-xl font-bold text-emerald-600">
                            {formatCurrency(formData.units * formData.unit_price)}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Kategori Pengeluaran</label>
                        <input
                          type="text"
                          required
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="Misal: Tinta, Kertas, Sewa"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nominal (IDR)</label>
                        <input
                          type="number"
                          required
                          value={formData.unit_price}
                          onChange={(e) => setFormData({ ...formData, unit_price: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Keterangan</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Catatan tambahan..."
                    />
                  </div>
                </div>

                <button type="submit" className="w-full btn-sewu py-4 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                  <Save size={20} /> Simpan Transaksi
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
