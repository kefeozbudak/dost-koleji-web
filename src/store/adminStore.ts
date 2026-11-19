import { create } from 'zustand';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCachedData, setCachedData, invalidateServerPublicCache } from '../lib/cache';
import { DailyTraffic, TrafficLog, PageStat } from '../lib/analytics';

interface AdminRealtimeState {
  // Core Collections
  pages: any[];
  pagesLoaded: boolean;
  forms: any[];
  formsLoaded: boolean;
  lgsReports: any[];
  lgsLoaded: boolean;
  users: any[];
  usersLoaded: boolean;
  media: any[];
  mediaLoaded: boolean;
  popups: any[];
  popupsLoaded: boolean;

  // Settings Documents
  headerSettings: any;
  footerSettings: any;
  generalSettings: any;
  assistantSettings: any;
  settingsLoaded: boolean;

  // Analytics & Traffic
  trafficSummary: any;
  trafficDaily: DailyTraffic[];
  trafficPages: PageStat[];
  trafficLogs: TrafficLog[];
  analyticsLoaded: boolean;

  // Lifecycle Actions
  startBaseListeners: () => void;
  ensureUsersListener: () => void;
  ensureMediaListener: () => void;
  ensurePopupsListener: () => void;
  ensureSettingsListeners: () => void;
  ensureAnalyticsListeners: () => void;
  stopAllListeners: () => void;
}

const activeUnsubs: Record<string, Unsubscribe> = {};

function sortFormsDescending(firestoreItems: any[]): any[] {
  // Purge legacy unencrypted PII backups from localStorage (KVKK & 5MB quota protection)
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('dost_forms_backup');
      localStorage.removeItem('dost_scholarship_forms_backup');
      localStorage.removeItem('dost_forms_deleted_ids');
      localStorage.removeItem('dost_scholarship_forms_deleted_ids');
    } catch (_) {}
  }

  const sorted = [...firestoreItems];
  sorted.sort((a, b) => {
    const timeA = typeof a.createdAt === 'number' ? a.createdAt : a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = typeof b.createdAt === 'number' ? b.createdAt : b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });
  return sorted;
}

export const useAdminStore = create<AdminRealtimeState>((set) => ({
  pages: getCachedData('admin_pages', []) || [],
  pagesLoaded: Boolean(getCachedData('admin_pages', null)),
  forms: [],
  formsLoaded: false,
  lgsReports: getCachedData('admin_lgs_reports', []) || [],
  lgsLoaded: Boolean(getCachedData('admin_lgs_reports', null)),
  users: getCachedData('admin_users', []) || [],
  usersLoaded: Boolean(getCachedData('admin_users', null)),
  media: [],
  mediaLoaded: false,
  popups: getCachedData('admin_popups', []) || [],
  popupsLoaded: Boolean(getCachedData('admin_popups', null)),

  headerSettings: getCachedData('settings_header', null),
  footerSettings: getCachedData('settings_footer', null),
  generalSettings: getCachedData('settings_general', null),
  assistantSettings: getCachedData('settings_assistant', null),
  settingsLoaded: false,

  trafficSummary: getCachedData('admin_traffic_summary', null),
  trafficDaily: getCachedData('admin_traffic_daily', []) || [],
  trafficPages: getCachedData('admin_traffic_pages', []) || [],
  trafficLogs: getCachedData('admin_traffic_logs', []) || [],
  analyticsLoaded: Boolean(getCachedData('admin_traffic_summary', null)),

  startBaseListeners: () => {
    // 1. Pages Listener (Singleton across entire Admin Panel)
    if (!activeUnsubs.pages) {
      let initialPagesSync = true;
      activeUnsubs.pages = onSnapshot(
        collection(db, 'pages'),
        (snapshot) => {
          const fetched = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          set({ pages: fetched, pagesLoaded: true });
          setCachedData('admin_pages', fetched);
          fetched.forEach((p) => {
            if (p.id && !p.isDeleted && !p.isHidden) {
              setCachedData(`page_${p.id}`, p);
            }
          });
          if (!initialPagesSync) {
            invalidateServerPublicCache();
          }
          initialPagesSync = false;
        },
        (err) => {
          console.error('Admin pages listener error:', err);
          set({ pagesLoaded: true });
        }
      );
    }

    // 2. Forms Listener (Singleton shared by Dashboard, ReportCenter, ClubCenter, ScholarshipCenter)
    if (!activeUnsubs.forms) {
      activeUnsubs.forms = onSnapshot(
        collection(db, 'forms'),
        (snapshot) => {
          const fetched = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          const sorted = sortFormsDescending(fetched);
          set({ forms: sorted, formsLoaded: true });
        },
        (err) => {
          console.error('Admin forms listener error:', err);
          set({ formsLoaded: true });
        }
      );
    }

    // 3. LGS Reports Listener (Singleton)
    if (!activeUnsubs.lgsReports) {
      const q = query(collection(db, 'reports'), where('type', '==', 'lgs_calculator'));
      activeUnsubs.lgsReports = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((d) => {
            const item = { id: d.id, ...(d.data() as any) };
            if (item.createdAt && typeof item.createdAt === 'object' && item.createdAt.seconds) {
              item.createdAt = item.createdAt.toDate().getTime();
            }
            return item;
          });
          data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          set({ lgsReports: data, lgsLoaded: true });
          setCachedData('admin_lgs_reports', data);
        },
        (err) => {
          console.error('Admin LGS reports listener error:', err);
          set({ lgsLoaded: true });
        }
      );
    }
  },

  ensureUsersListener: () => {
    if (activeUnsubs.users) return;
    activeUnsubs.users = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        set({ users: fetched, usersLoaded: true });
        setCachedData('admin_users', fetched);
      },
      (err) => {
        console.error('Admin users listener error:', err);
        set({ usersLoaded: true });
      }
    );
  },

  ensureMediaListener: () => {
    if (activeUnsubs.media) return;
    const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
    activeUnsubs.media = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        set({ media: items, mediaLoaded: true });
        // Populate individual media cache entries so resolveMediaUrls never has to re-fetch them
        items.forEach((m) => {
          if (m.id && m.url) {
            setCachedData(`media_${m.id}`, m.url);
          }
        });
      },
      (err) => {
        console.error('Admin media listener error:', err);
        set({ mediaLoaded: true });
      }
    );
  },

  ensurePopupsListener: () => {
    if (activeUnsubs.popups) return;
    let initialPopupsSync = true;
    activeUnsubs.popups = onSnapshot(
      collection(db, 'popups'),
      (snapshot) => {
        const fetched = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        set({ popups: fetched, popupsLoaded: true });
        setCachedData('admin_popups', fetched);
        const activeOnly = fetched.filter((p: any) => {
          const st = (p.status || '').toString().trim().toUpperCase();
          return st === 'AKTİF' || st === 'AKTIF';
        });
        setCachedData('popups_active', activeOnly);
        if (!initialPopupsSync) {
          invalidateServerPublicCache();
        }
        initialPopupsSync = false;
      },
      (err) => {
        console.error('Admin popups listener error:', err);
        set({ popupsLoaded: true });
      }
    );
  },

  ensureSettingsListeners: () => {
    if (!activeUnsubs.settings_header) {
      let initH = true;
      activeUnsubs.settings_header = onSnapshot(doc(db, 'settings', 'header'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ headerSettings: data, settingsLoaded: true });
          setCachedData('settings_header', data);
          if (!initH) invalidateServerPublicCache();
        } else {
          set({ settingsLoaded: true });
        }
        initH = false;
      });
    }
    if (!activeUnsubs.settings_footer) {
      let initF = true;
      activeUnsubs.settings_footer = onSnapshot(doc(db, 'settings', 'footer'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ footerSettings: data, settingsLoaded: true });
          setCachedData('settings_footer', data);
          if (!initF) invalidateServerPublicCache();
        }
        initF = false;
      });
    }
    if (!activeUnsubs.settings_general) {
      let initG = true;
      activeUnsubs.settings_general = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ generalSettings: data, settingsLoaded: true });
          setCachedData('settings_general', data);
          if (!initG) invalidateServerPublicCache();
        }
        initG = false;
      });
    }
    if (!activeUnsubs.settings_assistant) {
      let initA = true;
      activeUnsubs.settings_assistant = onSnapshot(doc(db, 'settings', 'assistant'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ assistantSettings: data, settingsLoaded: true });
          setCachedData('settings_assistant', data);
          if (!initA) invalidateServerPublicCache();
        }
        initA = false;
      });
    }
  },

  ensureAnalyticsListeners: () => {
    if (!activeUnsubs.traffic_summary) {
      activeUnsubs.traffic_summary = onSnapshot(doc(db, 'traffic_stats', 'summary'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ trafficSummary: data, analyticsLoaded: true });
          setCachedData('admin_traffic_summary', data);
        } else {
          set({ analyticsLoaded: true });
        }
      });
    }
    if (!activeUnsubs.traffic_daily) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      const dailyQuery = query(
        collection(db, 'traffic_daily'),
        where('dateStr', '>=', cutoffStr),
        orderBy('dateStr', 'asc')
      );
      activeUnsubs.traffic_daily = onSnapshot(dailyQuery, (snap) => {
        // Aggregate distributed shards (e.g. 2026-11-19__s0 .. s9) and legacy docs by dateStr
        const byDate = new Map<string, DailyTraffic>();
        snap.forEach((d) => {
          const item = d.data() as DailyTraffic;
          const dateKey = item.dateStr || d.id.split('__s')[0];
          if (!dateKey) return;
          const prev = byDate.get(dateKey);
          if (prev) {
            prev.views = (prev.views || 0) + (item.views || 0);
            prev.visitors = (prev.visitors || 0) + (item.visitors || 0);
          } else {
            byDate.set(dateKey, {
              dateStr: dateKey,
              views: item.views || 0,
              visitors: item.visitors || 0
            });
          }
        });
        const dailies = Array.from(byDate.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        set({ trafficDaily: dailies, analyticsLoaded: true });
        setCachedData('admin_traffic_daily', dailies);
      });
    }
    if (!activeUnsubs.traffic_pages) {
      activeUnsubs.traffic_pages = onSnapshot(collection(db, 'traffic_pages'), (snap) => {
        // Aggregate distributed shards (e.g. bursluluk-sinavi__s0 .. s9) and legacy docs by path
        const byPath = new Map<string, PageStat>();
        snap.forEach((d) => {
          const item = d.data() as PageStat;
          const pathKey = item.path || d.id.split('__s')[0];
          if (!pathKey) return;
          const prev = byPath.get(pathKey);
          if (prev) {
            prev.views = (prev.views || 0) + (item.views || 0);
            if (item.title && item.title !== 'Sayfa') prev.title = item.title;
          } else {
            byPath.set(pathKey, {
              path: pathKey,
              title: item.title || 'Sayfa',
              views: item.views || 0
            });
          }
        });
        const pList = Array.from(byPath.values()).sort((a, b) => (b.views || 0) - (a.views || 0));
        set({ trafficPages: pList, analyticsLoaded: true });
        setCachedData('admin_traffic_pages', pList);
      });
    }
    if (!activeUnsubs.traffic_logs) {
      const logsQuery = query(collection(db, 'traffic_logs'), orderBy('timestamp', 'desc'), limit(30));
      activeUnsubs.traffic_logs = onSnapshot(logsQuery, (snap) => {
        const logs: TrafficLog[] = [];
        snap.forEach((d) => logs.push({ id: d.id, ...(d.data() as any) } as TrafficLog));
        set({ trafficLogs: logs, analyticsLoaded: true });
        setCachedData('admin_traffic_logs', logs);
      });
    }
  },

  stopAllListeners: () => {
    Object.keys(activeUnsubs).forEach((key) => {
      try {
        activeUnsubs[key]();
      } catch (_) {}
      delete activeUnsubs[key];
    });
  }
}));
