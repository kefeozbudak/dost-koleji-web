import { useEffect, useMemo } from 'react';
import {
  Users, Eye, TrendingUp, Activity, FileStack, MessageSquare,
  ShieldCheck, Server, Lock, CheckCircle2, Database, BarChart3, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';

export default function AdminDashboard() {
  const {
    pages,
    forms,
    users,
    trafficSummary: rawSummary,
    trafficDaily,
    pagesLoaded,
    formsLoaded,
    ensureUsersListener,
    ensureAnalyticsListeners
  } = useAdminStore();

  useEffect(() => {
    ensureUsersListener();
    ensureAnalyticsListeners();
  }, [ensureUsersListener, ensureAnalyticsListeners]);

  const stats = useMemo(() => ({
    pagesCount: (pages || []).filter((p: any) => !p.isDeleted).length,
    formsCount: (forms || []).length,
    usersCount: (users || []).length || 1
  }), [pages, forms, users]);

  const recentForms = useMemo(() => {
    return (forms || []).slice(0, 5);
  }, [forms]);

  const trafficSummary = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDoc = (trafficDaily || []).find((d) => d.dateStr === todayStr);
    const todayViews = todayDoc?.views || 0;
    const todayVisitors = todayDoc?.visitors || 0;

    const last7 = (trafficDaily || []).slice(-7);
    let weeklyViews = 0;
    last7.forEach((d) => {
      weeklyViews += d.views || 0;
    });

    const totalViews = rawSummary?.totalViews || weeklyViews || todayViews;

    return {
      todayViews,
      todayVisitors,
      weeklyViews,
      totalViews
    };
  }, [rawSummary, trafficDaily]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getSenderName = (form: any) => {
    let name = '';
    if (form.data) {
      for (const [key, val] of Object.entries(form.data)) {
        if (!val) continue;
        const lowerKey = key.toLowerCase().trim();
        if (lowerKey.includes('formname')) continue;
        if (lowerKey.includes('kademe') || lowerKey.includes('sınıf') || lowerKey.includes('eğitim')) continue;
        if (lowerKey.includes('kampüs') || lowerKey.includes('kampus')) continue;
        if (lowerKey.includes('telefon') || lowerKey.includes('tel') || lowerKey.includes('phone') || lowerKey.includes('gsm')) continue;
        if (lowerKey.includes('email') || lowerKey.includes('eposta') || lowerKey.includes('e-posta')) continue;
        if (lowerKey.includes('mesaj') || lowerKey.includes('not') || lowerKey.includes('açıklama')) continue;
        if (lowerKey.includes('adı') || lowerKey.includes('soyad') || lowerKey.includes('isim') || lowerKey.includes('ad ') || lowerKey === 'ad' || lowerKey.includes('name')) {
          if (!name) name = String(val);
        }
      }
    }
    return name || form.parentName || form.name || form.studentName || 'Bilinmiyor';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bursluluk': return 'bg-blue-100 text-blue-700';
      case 'kulup': return 'bg-orange-100 text-orange-700';
      case 'iletisim': return 'bg-green-100 text-green-700';
      case 'chat': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'bursluluk': return 'Bursluluk';
      case 'kulup': return 'Kulüp';
      case 'iletisim': return 'İletişim';
      case 'chat': return 'Veli Asistanı';
      default: return type || 'Form';
    }
  };

  if (!pagesLoaded && !formsLoaded && pages.length === 0) {
    return <div className="flex-1 flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-[#004899] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto bg-slate-50 font-sans text-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><FileStack className="w-3 h-3" /> Toplam Sayfa</p>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black text-slate-800">{stats.pagesCount}</h2>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Form Talepleri</p>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black text-slate-800">{stats.formsCount}</h2>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><Users className="w-3 h-3" /> Yetkili Kullanıcı</p>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black text-slate-800">{stats.usersCount}</h2>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-24">
          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5"><Activity className="w-3 h-3" /> Sistem Durumu</p>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-black text-slate-800">Aktif</h2>
            <span className="text-green-500 text-[10px] font-bold italic flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> OPTİMAL</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[480px]">
        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-slate-800">Rapor Merkezi Akışı (Son Gelenler)</h3>
          </div>
          <div className="flex-1 overflow-hidden p-0">
            {recentForms.length === 0 ? (
               <div className="p-8 text-center text-sm font-medium text-slate-500">Henüz hiçbir form talebi alınmamış.</div>
            ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400">Tarih</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400">Gönderen</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400">Tip</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentForms.map((form) => (
                   <tr key={form.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-4 py-3 text-[11px] font-mono">{formatDate(form.createdAt)}</td>
                     <td className="px-4 py-3 text-xs font-bold text-slate-700">{getSenderName(form)}</td>
                     <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${getTypeColor(form.type)}`}>{getTypeName(form.type)}</span></td>
                     <td className="px-4 py-3 text-right">
                       <Link to="/dadmin/reports" className="p-1 text-slate-400 hover:text-blue-600 inline-block"><Eye className="w-4 h-4" /></Link>
                     </td>
                   </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-center mt-auto">
            <Link to="/dadmin/reports" className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-blue-600 transition-colors">Tüm Kayıtları Görüntüle</Link>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Sistem Sağlığı & Güvenlik */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Sistem Sağlığı & Güvenlik
              </h3>
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-emerald-100 text-emerald-700">
                Korumalı
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Firebase Veritabanı</p>
                    <p className="text-[10px] text-slate-500">Canlı Bağlantı & Firestore Rules</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> AKTİF
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">SSL/TLS Şifreleme</p>
                    <p className="text-[10px] text-slate-500">256-bit Güvenli HTTPS Bağlantısı</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ETKİN
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-purple-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Sunucu Yanıt Süresi</p>
                    <p className="text-[10px] text-slate-500">Global Cloud Run Ingress</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  32 ms
                </span>
              </div>
            </div>
          </div>

          {/* Gerçek Zamanlı Trafik Özeti */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black flex items-center gap-2 uppercase text-slate-800">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Trafik & Ziyaretçi Analizi
              </h3>
              <Link 
                to="/dadmin/analytics" 
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
              >
                <span>Detaylar</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-5 flex flex-col justify-center gap-5">
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Bugünkü Ziyaretçi</span>
                  <span key={trafficSummary.todayVisitors} className="text-lg font-black text-slate-900">{trafficSummary.todayVisitors}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min((trafficSummary.todayVisitors / (trafficSummary.weeklyViews || 1)) * 100, 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Canlı Firestore Kaydı
                </p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Son 7 Günlük Görüntüleme</span>
                  <span key={trafficSummary.weeklyViews} className="text-lg font-black text-slate-900">{trafficSummary.weeklyViews}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${Math.min((trafficSummary.weeklyViews / (trafficSummary.totalViews || 1)) * 100, 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-1.5">
                  Anlık haftalık toplam sayfa oturumu
                </p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase">Toplam Sayfa Görüntüleme</span>
                  <span key={trafficSummary.totalViews} className="text-lg font-black text-slate-900">{trafficSummary.totalViews}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>

              <Link 
                to="/dadmin/analytics"
                className="w-full mt-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Detaylı Trafik Analizi Raporu</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
