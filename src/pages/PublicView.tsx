import ErrorBoundary from "../components/ErrorBoundary";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, limit, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Lock, Settings } from 'lucide-react';
import AssistantWidget from '../components/AssistantWidget';
import { DynamicBlockRenderer } from '../components/PageBlocks';
import { liveFallbackData } from '../lib/liveFallbackData';
import {
  defaultHomePageData,
  defaultHakkimizdaData,
  defaultBasarilarimizData,
  defaultDuyurularData,
  defaultPreRegistrationData,
  defaultScholarshipPageData,
  defaultScholarshipConfirmationPageData,
  defaultEgitimSistemiData,
  defaultCareerPageData,
  defaultLgsCalculatorData
} from '../lib/defaultData';
import { onAuthStateChanged } from 'firebase/auth';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PopupOverlay from '../components/PopupOverlay';
import { recordPageView } from '../lib/analytics';
import { getCachedData, setCachedData, isCacheFresh, fetchWithDedup } from '../lib/cache';
import { resolveMediaUrls } from '../lib/resolveMedia';
import { captureCampaignAttribution, flushPendingSubmissions } from '../lib/scholarshipCampaign';
import { motion, AnimatePresence } from 'framer-motion';

function cleanBrokenImages(obj: any, contextTitle = ''): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.includes('lh3.googleusercontent.com') || obj.includes('aida-public')) {
      const lower = contextTitle.toLowerCase();
      if (lower.includes('eryaman')) return 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80';
      if (lower.includes('oran')) return 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1200&q=80';
      if (lower.includes('ümitköy') || lower.includes('umitkoy')) return 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80';
      return 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanBrokenImages(item, contextTitle));
  }
  if (typeof obj === 'object') {
    const title = obj.title || obj.name || contextTitle;
    const res: any = {};
    for (const k of Object.keys(obj)) {
      res[k] = cleanBrokenImages(obj[k], title);
    }
    return res;
  }
  return obj;
}

function getNormalizedDocId(rawPath: string) {
  const trimmed = rawPath === '/' ? 'home' : rawPath.replace(/^\/+|\/+$/g, '');
  const docIdRaw = (trimmed || 'home').replace(/[^a-zA-Z0-9_-]/g, '-');
  if (['is-basvuru-formu', 'is-basvurusu', 'is-basvuru', 'isbasvurusu', 'isbasvuru'].includes(docIdRaw)) {
    return 'is-basvuru-formu';
  }
  if (['bursluluk-sinavi', 'bursluluk-basvurusu'].includes(docIdRaw)) {
    return 'bursluluk-basvuru-formu';
  }
  return docIdRaw;
}

function getFallbackPageData(rawPath: string, cleanPath: string, docId: string) {
  const fallbackPages: any = liveFallbackData.pages;
  let matchedFallback = null;

  if (docId && fallbackPages[docId]) {
    matchedFallback = fallbackPages[docId];
  } else {
    const fallbackValues = Object.values(fallbackPages);
    matchedFallback = fallbackValues.find((p: any) => p.path === cleanPath);
  }

  if (matchedFallback && !matchedFallback.isDeleted && !matchedFallback.isHidden) {
    return cleanBrokenImages(matchedFallback);
  }

  const normalizedPath = cleanPath.toLowerCase();
  if (rawPath === '/' || docId === 'home') {
    return {
      title: 'Ana Sayfa',
      blocks: defaultHomePageData.filter(b => b.type !== 'header' && b.type !== 'footer')
    };
  }
  if (docId === 'kulup-kayit-formu' || normalizedPath === '/kulup-kayit-formu') {
    return {
      title: 'Kulüp Kayıt Formu',
      path: '/kulup-kayit-formu',
      blocks: [
        {
          type: 'club_registration_form',
          titlePart1: 'Dost Koleji',
          titlePart2: 'Kulüp Kayıt',
          subtitle: 'Lütfen Formu Eksiksiz Doldurunuz.'
        }
      ]
    };
  }
  if (docId === 'duyurular' || normalizedPath === '/duyurular') {
    return {
      title: 'Duyurular',
      blocks: defaultDuyurularData
    };
  }
  if (docId === 'basarilarimiz' || normalizedPath === '/basarilarimiz') {
    return {
      title: 'Başarılarımız',
      blocks: defaultBasarilarimizData
    };
  }
  if (docId === 'hakkimizda' || normalizedPath === '/hakkimizda') {
    return {
      title: 'Hakkımızda',
      blocks: defaultHakkimizdaData
    };
  }
  if (docId === 'is-basvuru-formu' || docId === 'is-basvurusu' || ['/is-basvuru-formu', '/is-basvuru', '/is-basvurusu', '/isbasvurusu', '/isbasvuru'].includes(normalizedPath)) {
    return {
      title: 'İş Başvurusu',
      path: '/is-basvurusu',
      blocks: defaultCareerPageData
    };
  }
  if (docId === 'egitim-sistemimiz' || normalizedPath === '/egitim-sistemimiz') {
    return {
      title: 'Eğitim Sistemimiz',
      path: '/egitim-sistemimiz',
      blocks: defaultEgitimSistemiData
    };
  }
  if (docId === 'on-kayit' || normalizedPath === '/on-kayit') {
    return {
      title: 'Öğrenci Ön Kayıt Formu',
      blocks: defaultPreRegistrationData
    };
  }
  if (docId === 'bursluluk-basvuru-formu' || normalizedPath === '/bursluluk-basvuru-formu') {
    return {
      title: 'Bursluluk Sınav Başvurusu',
      path: '/bursluluk-basvuru-formu',
      blocks: defaultScholarshipPageData
    };
  }
  if (docId === 'bursluluk-basvuru-onay' || normalizedPath === '/bursluluk-basvuru-onay') {
    return {
      title: 'Bursluluk Sınav Başvuru Onayı',
      path: '/bursluluk-basvuru-onay',
      blocks: defaultScholarshipConfirmationPageData
    };
  }
  if (docId === 'lgs-puan-hesaplama' || normalizedPath === '/lgs-puan-hesaplama') {
    return {
      title: 'LGS Puan Hesaplama Modülü',
      path: '/lgs-puan-hesaplama',
      blocks: defaultLgsCalculatorData
    };
  }
  return null;
}

function normalizeHomePageBlocks(rawPath: string, docId: string, data: any) {
  if ((rawPath === '/' || docId === 'home') && data?.blocks) {
    const hasVideo = data.blocks.some((b: any) => b.type === 'video');
    if (!hasVideo) {
      const statsIndex = data.blocks.findIndex((b: any) => b.type === 'stats');
      const videoBlock = defaultHomePageData.find(b => b.type === 'video');
      if (videoBlock) {
        const newBlocks = [...data.blocks];
        if (statsIndex !== -1) {
          newBlocks.splice(statsIndex, 0, videoBlock);
        } else {
          newBlocks.push(videoBlock);
        }
        return { ...data, blocks: newBlocks };
      }
    }
  }
  return data;
}

export default function PublicView() {
  const location = useLocation();
  const navigate = useNavigate();
  const handleAdminLogin = () => navigate('/dadmin');

  const initialRawPath = location.pathname;
  const initialCleanPath = initialRawPath.startsWith('/') ? initialRawPath : '/' + initialRawPath;
  const initialDocId = getNormalizedDocId(initialRawPath);

  // 1. Stale-While-Revalidate: Initialize state directly from localStorage or liveFallbackData (0 second render)
  const [headerData, setHeaderData] = useState<any>(() =>
    getCachedData('settings_header', liveFallbackData.settings?.header || null)
  );
  const [footerData, setFooterData] = useState<any>(() =>
    getCachedData('settings_footer', liveFallbackData.settings?.footer || null)
  );
  const [generalSettings, setGeneralSettings] = useState<any>(() =>
    getCachedData('settings_general', liveFallbackData.settings?.general || null)
  );
  const [pageData, setPageData] = useState<any>(() => {
    const cachedPage = getCachedData(`page_${initialDocId}`, null);
    if (cachedPage) return cachedPage;
    return getFallbackPageData(initialRawPath, initialCleanPath, initialDocId);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cachedPage = getCachedData(`page_${initialDocId}`, null);
    const fallbackPage = getFallbackPageData(initialRawPath, initialCleanPath, initialDocId);
    return !cachedPage && !fallbackPage;
  });
  const [user, setUser] = useState<any>(null);

  // Capture ad attribution & flush any offline-queued submissions on boot and when network reconnects
  useEffect(() => {
    captureCampaignAttribution();
    flushPendingSubmissions();
    const handleOnline = () => {
      flushPendingSubmissions();
    };
    window.addEventListener('online', handleOnline);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => {
      window.removeEventListener('online', handleOnline);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    captureCampaignAttribution();
  }, [location.search]);

  useEffect(() => {
    if (generalSettings?.siteTitle) document.title = generalSettings.siteTitle;
    if (generalSettings?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = generalSettings.faviconUrl;
    }
  }, [generalSettings]);

  useEffect(() => {
    let isMounted = true;
    const rawPath = location.pathname;
    const cleanPath = rawPath.startsWith('/') ? rawPath : '/' + rawPath;
    const docId = getNormalizedDocId(rawPath);

    // 1. Instant Stale-While-Revalidate render from localStorage or fallback
    const cachedPage = getCachedData(`page_${docId}`, null);
    const fallbackPage = getFallbackPageData(rawPath, cleanPath, docId);
    const isNegativeCached = isCacheFresh(`page_404_${docId}`, 10 * 60 * 1000);

    if (cachedPage) {
      setPageData(cachedPage);
      setLoading(false);
    } else if (fallbackPage) {
      setPageData(fallbackPage);
      setLoading(false);
    } else if (isNegativeCached && !auth.currentUser) {
      setPageData(null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const isAdminUser = Boolean(auth.currentUser);
    const needHeader = isAdminUser || !isCacheFresh('settings_header', 15 * 60 * 1000);
    const needFooter = isAdminUser || !isCacheFresh('settings_footer', 15 * 60 * 1000);
    const needGeneral = isAdminUser || !isCacheFresh('settings_general', 3 * 60 * 1000);
    const needPage = isAdminUser || (!isNegativeCached && !isCacheFresh(`page_${docId}`, 15 * 60 * 1000));

    if (!needHeader && !needFooter && !needGeneral && !needPage) {
      return () => {
        isMounted = false;
      };
    }

    const syncShowcase = async () => {
      let bootstrapHandledPage = false;

      // Tier 1: Server-side RAM-cached bootstrap (protects daily free Firestore quota under 500-1000 concurrent ad visitors)
      if (!isAdminUser && (needHeader || needFooter || needGeneral || needPage)) {
        try {
          const res = await fetchWithDedup(`bootstrap_${docId}`, async () => {
            const resp = await fetch(`/api/public-bootstrap?docId=${encodeURIComponent(docId)}`);
            if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
            return resp.json();
          });

          if (res?.ok && isMounted) {
            if (res.header) {
              const resolvedH = await resolveMediaUrls(res.header);
              if (isMounted) {
                setHeaderData(resolvedH);
                setCachedData('settings_header', resolvedH);
              }
            }
            if (res.footer) {
              const resolvedF = await resolveMediaUrls(res.footer);
              if (isMounted) {
                setFooterData(resolvedF);
                setCachedData('settings_footer', resolvedF);
              }
            }
            if (res.general) {
              const resolvedG = await resolveMediaUrls(res.general);
              if (isMounted) {
                setGeneralSettings(resolvedG);
                setCachedData('settings_general', resolvedG);
              }
            }
            if (Array.isArray(res.popups)) {
              setCachedData('popups_active', res.popups);
            }

            if (res.page) {
              if (res.page.__hidden) {
                setPageData(null);
                setLoading(false);
                bootstrapHandledPage = true;
              } else if (Array.isArray(res.page.blocks) && res.page.blocks.length > 0) {
                let resolvedP = await resolveMediaUrls(res.page);
                resolvedP = normalizeHomePageBlocks(rawPath, docId, resolvedP);
                const cleaned = cleanBrokenImages(resolvedP);
                if (isMounted) {
                  setPageData(cleaned);
                  setCachedData(`page_${docId}`, cleaned);
                  setLoading(false);
                }
                bootstrapHandledPage = true;
              }
            }

            window.dispatchEvent(new CustomEvent('dost:bootstrap-ready'));
            if (bootstrapHandledPage || !needPage) {
              return;
            }
          }
        } catch (_) {
          // Seamless fallback to direct Firestore SDK below if /api/public-bootstrap is unreachable
        }
      }

      // Tier 2: Direct Firestore fallback (or Admin live mode / custom slug lookup)
      try {
        if (needHeader || needFooter || needGeneral) {
          const [headerDoc, footerDoc, generalDoc] = await Promise.all([
            needHeader
              ? fetchWithDedup('fb_settings_header', () => getDoc(doc(db, 'settings', 'header')))
              : Promise.resolve(null),
            needFooter
              ? fetchWithDedup('fb_settings_footer', () => getDoc(doc(db, 'settings', 'footer')))
              : Promise.resolve(null),
            needGeneral
              ? fetchWithDedup('fb_settings_general', () => getDoc(doc(db, 'settings', 'general')))
              : Promise.resolve(null)
          ]);

          if (isMounted) {
            if (headerDoc?.exists()) {
              const resolvedHeader = await resolveMediaUrls(headerDoc.data());
              if (isMounted) {
                setHeaderData(resolvedHeader);
                setCachedData('settings_header', resolvedHeader);
              }
            }
            if (footerDoc?.exists()) {
              const resolvedFooter = await resolveMediaUrls(footerDoc.data());
              if (isMounted) {
                setFooterData(resolvedFooter);
                setCachedData('settings_footer', resolvedFooter);
              }
            }
            if (generalDoc?.exists()) {
              const gData = await resolveMediaUrls(generalDoc.data());
              if (isMounted) {
                setGeneralSettings(gData);
                setCachedData('settings_general', gData);
                window.dispatchEvent(new CustomEvent('dost:bootstrap-ready'));
              }
            }
          }
        }

        if (!needPage || bootstrapHandledPage) return;

        const docSnap = await fetchWithDedup(`fb_page_${docId}`, () =>
          getDoc(doc(db, 'pages', docId))
        );
        if (!isMounted) return;

        if (docSnap.exists() && docSnap.data().blocks && docSnap.data().blocks.length > 0) {
          let data = await resolveMediaUrls(docSnap.data());
          if (!isMounted) return;

          if (data.isDeleted || data.isHidden) {
            setPageData(null);
            setLoading(false);
            return;
          }

          data = normalizeHomePageBlocks(rawPath, docId, data);
          const cleaned = cleanBrokenImages(data);
          setPageData(cleaned);
          setCachedData(`page_${docId}`, cleaned);
          setLoading(false);
          return;
        }

        // Custom slug fallback query (limit 1)
        try {
          const q = query(collection(db, 'pages'), where('path', '==', cleanPath), limit(1));
          const snapshot = await getDocs(q);
          if (!isMounted) return;

          if (!snapshot.empty) {
            let data = await resolveMediaUrls(snapshot.docs[0].data());
            if (!isMounted) return;

            if (data.isDeleted || data.isHidden) {
              setPageData(null);
              setLoading(false);
              return;
            } else if (data.blocks && data.blocks.length > 0) {
              const cleaned = cleanBrokenImages(data);
              setPageData(cleaned);
              setCachedData(`page_${docId}`, cleaned);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Query by path error:", err);
        }

        if (isMounted) {
          const fb = getFallbackPageData(rawPath, cleanPath, docId);
          setPageData(fb);
          if (fb) {
            setCachedData(`page_${docId}`, fb);
          } else {
            // Negative cache 404 paths for 10 minutes so bots/typos don't re-query Firestore
            setCachedData(`page_404_${docId}`, true);
          }
          setLoading(false);
        }
      } catch (e) {
        console.error("PUBLIC_VIEW_ERROR:", e);
        if (isMounted) {
          if (!cachedPage) {
            setPageData(getFallbackPageData(rawPath, cleanPath, docId));
          }
          setLoading(false);
        }
      }
    };

    syncShowcase();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (pageData && !pageData.isHidden && !pageData.isDeleted) {
      recordPageView(location.pathname, pageData.title || pageData.name || 'Sayfa');
    }
  }, [location.pathname, pageData?.title]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface-background text-slate-500">Sayfa yükleniyor...</div>;

  if (generalSettings?.maintenanceMode && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white font-sans px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center mb-6 border border-blue-500/30">
          <Settings className="w-8 h-8 animate-spin-slow" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{generalSettings.schoolName || 'Özel Dost Koleji'}</h1>
        <p className="text-slate-300 max-w-lg mb-8 leading-relaxed text-sm md:text-base">
          {generalSettings.maintenanceMessage || 'Sitemiz şu anda planlı bakım çalışmasındadır. Kısa süre sonra tekrar hizmetinizde olacağız.'}
        </p>
        <button
          onClick={handleAdminLogin}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          Yönetici Girişi
        </button>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-background font-sans text-slate-900 px-4">
        <h1 className="text-3xl md:text-4xl font-light mb-4 text-center">404 - Sayfa Bulunamadı</h1>
        <p className="text-sm md:text-base text-slate-500 mb-8 text-center max-w-md">Aradığınız sayfa mevcut değil veya yayından kaldırılmış olabilir.</p>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  const isAnnouncementActive = generalSettings?.announcementActive && generalSettings?.announcementText;

  return (
    <div className="min-h-screen bg-surface-background relative text-on-background font-body-md selection:bg-primary/20 flex flex-col">
      <Header data={headerData} announcement={generalSettings} />

      <div className={`flex-1 transition-all duration-300 ${isAnnouncementActive ? 'pt-[140px] md:pt-[124px]' : 'pt-[80px]'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <ErrorBoundary><DynamicBlockRenderer blocks={pageData.blocks || []} /></ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
      <Footer data={footerData} headerData={headerData} />
      <AssistantWidget />
      <PopupOverlay />
    </div>
  );
}
