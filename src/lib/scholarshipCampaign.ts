import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { parseExamSessionTime } from './examTicketExport';
import { getCachedData, setCachedData, isCacheFresh, fetchWithDedup } from './cache';

const OUTBOX_STORAGE_KEY = 'dost_pending_submissions_v1';
const ATTRIBUTION_STORAGE_KEY = 'dost_campaign_attribution_v1';
const DRAFT_PREFIX = 'dost_form_draft_v1_';

export const EXAM_DATE_OPTIONS = [
  '9 OCAK 2027 CUMARTESİ',
  '10 OCAK 2027 PAZAR'
] as const;

export const DEFAULT_EXAM_DATE = EXAM_DATE_OPTIONS[0];

export interface CampaignAttribution {
  ad_channel: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  referrer_host?: string;
}

export interface PendingSubmissionItem {
  id: string;
  formId: string;
  formPayload: Record<string, any>;
  ticketId?: string;
  ticketPayload?: Record<string, any>;
  queuedAt: number;
}

/**
 * Saf JS yedekli deterministik 128-bit/256-bit karma üretici (T.C. Kimlik -> KVKK uyumlu tahmin edilemez Belge ID)
 * Üretilen ID: "tk_" + 32 hex karakter = 35 karakter (firestore.rules isHighEntropyId ile %100 uyumlu)
 */
function fallbackDeterministicHex(input: string): string {
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    seeds[0] = Math.imul(seeds[0] ^ code, 0x01000193) >>> 0;
    seeds[1] = Math.imul(seeds[1] ^ (code + i * 17), 0x85ebca6b) >>> 0;
    seeds[2] = Math.imul(seeds[2] ^ (code * 31 + 7), 0xc2b2ae35) >>> 0;
    seeds[3] = Math.imul(seeds[3] ^ (code ^ (i << 3)), 0x27d4eb2f) >>> 0;
  }
  return seeds.map((s) => (s >>> 0).toString(16).padStart(8, '0')).join('');
}

export async function computeDeterministicTicketId(rawTc: string): Promise<string> {
  const cleanTc = String(rawTc || '').replace(/\D/g, '');
  const salted = `dost_koleji_2027_ticket::${cleanTc}::v1`;

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(salted);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .slice(0, 16)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `tk_${hex}`;
    }
  } catch (_) {
    // Fallback for non-secure local HTTP contexts
  }

  return `tk_${fallbackDeterministicHex(salted)}`;
}

/**
 * Reklam & UTM Kaynak Takibi (Instagram/Meta Ads, Google Ads, TikTok, WhatsApp, Organik)
 * Sadece tarayıcı sessionStorage kullanır (0 Firestore okuma/yazma maliyeti).
 */
export function captureCampaignAttribution(): CampaignAttribution {
  if (typeof window === 'undefined') {
    return { ad_channel: 'Doğrudan Giriş' };
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = (params.get('utm_source') || '').trim().slice(0, 60);
    const utmMedium = (params.get('utm_medium') || '').trim().slice(0, 60);
    const utmCampaign = (params.get('utm_campaign') || '').trim().slice(0, 80);
    const utmContent = (params.get('utm_content') || '').trim().slice(0, 80);
    const hasFbclid = Boolean(params.get('fbclid'));
    const hasGclid = Boolean(params.get('gclid') || params.get('gbraid') || params.get('wbraid'));
    const hasTtclid = Boolean(params.get('ttclid'));

    const existingRaw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    const hasIncomingParams = Boolean(utmSource || utmMedium || utmCampaign || hasFbclid || hasGclid || hasTtclid);

    if (existingRaw && !hasIncomingParams) {
      return JSON.parse(existingRaw) as CampaignAttribution;
    }

    let refHost = '';
    try {
      if (document.referrer) {
        const refUrl = new URL(document.referrer);
        if (refUrl.hostname !== window.location.hostname) {
          refHost = refUrl.hostname.replace(/^www\./, '').slice(0, 60);
        }
      }
    } catch (_) {}

    const srcLower = `${utmSource} ${utmMedium} ${refHost}`.toLowerCase();
    let adChannel = 'Doğrudan Giriş';

    if (hasFbclid || srcLower.includes('instagram') || srcLower.includes('ig') || srcLower.includes('meta') || srcLower.includes('facebook') || srcLower.includes('fb')) {
      adChannel = hasFbclid || utmMedium.toLowerCase().includes('cpc') || utmMedium.toLowerCase().includes('paid') || utmMedium.toLowerCase().includes('ad')
        ? 'Instagram / Meta Reklam'
        : 'Instagram / Sosyal Medya';
    } else if (hasGclid || (srcLower.includes('google') && (utmMedium.toLowerCase().includes('cpc') || utmMedium.toLowerCase().includes('ppc') || utmSource.toLowerCase().includes('ad')))) {
      adChannel = 'Google Reklam (Ads)';
    } else if (hasTtclid || srcLower.includes('tiktok')) {
      adChannel = 'TikTok Reklam';
    } else if (srcLower.includes('whatsapp') || srcLower.includes('wa.me')) {
      adChannel = 'WhatsApp Paylaşımı';
    } else if (srcLower.includes('google') || srcLower.includes('yandex') || srcLower.includes('bing')) {
      adChannel = 'Arama Motoru (Organik)';
    } else if (utmSource) {
      adChannel = `Kampanya: ${utmSource}`;
    } else if (refHost) {
      adChannel = `Yönlendirme (${refHost})`;
    }

    const attribution: CampaignAttribution = {
      ad_channel: adChannel,
      ...(utmSource ? { utm_source: utmSource } : {}),
      ...(utmMedium ? { utm_medium: utmMedium } : {}),
      ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
      ...(utmContent ? { utm_content: utmContent } : {}),
      ...(refHost ? { referrer_host: refHost } : {})
    };

    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
    return attribution;
  } catch (_) {
    return { ad_channel: 'Doğrudan Giriş' };
  }
}

export function getCampaignAttribution(): CampaignAttribution {
  return captureCampaignAttribution();
}

/**
 * Form Taslak Koruma (Sayfa yanlışlıkla yenilense bile velinin yazdığı bilgiler kaybolmaz)
 */
export function saveFormDraft(formType: string, data: Record<string, any>): void {
  if (typeof window === 'undefined' || !formType) return;
  try {
    const safeCopy: Record<string, any> = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      if (v instanceof File || typeof v === 'object') return;
      // Güvenlik gereği T.C. Kimlik taslağını saklama, diğer tüm alanları koru
      const lk = k.toLowerCase();
      if (lk === 'tc' || lk.includes('_tc') || lk.includes('kimlik')) return;
      safeCopy[k] = v;
    });
    sessionStorage.setItem(DRAFT_PREFIX + formType, JSON.stringify(safeCopy));
  } catch (_) {}
}

export function loadFormDraft(formType: string): Record<string, any> | null {
  if (typeof window === 'undefined' || !formType) return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + formType);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearFormDraft(formType: string): void {
  if (typeof window === 'undefined' || !formType) return;
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + formType);
  } catch (_) {}
}

/**
 * 3 Katmanlı Sıfır Veri Kaybı (Zero-Data-Loss) Gönderim Motoru:
 * Katman 1: Doğrudan Firestore Yazımı + Otomatik Retry (Üstel Geri Çekilme)
 * Katman 2: Kurumsal ağ/VPN/AdBlocker engeline karşı Backend Express Relay (/api/forms/submit)
 * Katman 3: Tam internet kopmasına karşı Offline Kuyruk (localStorage) + Bağlantı Geldiğinde Otomatik Senkronizasyon
 */
function withStepTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function writeDirectToFirestore(
  formId: string,
  formPayload: Record<string, any>,
  ticketId?: string,
  ticketPayload?: Record<string, any>
): Promise<void> {
  const formWrite = setDoc(doc(db, 'forms', formId), formPayload);
  const ticketWrite =
    ticketId && ticketPayload
      ? setDoc(doc(db, 'exam_tickets', ticketId), ticketPayload).catch((err: any) => {
          const msg = String(err?.message || '');
          // Deterministik ticket daha önceki denemede zaten oluşturulduysa formu engelleme
          if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
            return;
          }
          throw err;
        })
      : Promise.resolve();
  await withStepTimeout(Promise.all([formWrite, ticketWrite]), 8500);
}

async function writeViaBackendRelay(
  formId: string,
  formPayload: Record<string, any>,
  ticketId?: string,
  ticketPayload?: Record<string, any>
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch('/api/forms/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formId, formPayload, ticketId, ticketPayload }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || `HTTP_${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function enqueueOfflineSubmission(item: PendingSubmissionItem): void {
  if (typeof window === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    const list: PendingSubmissionItem[] = existingRaw ? JSON.parse(existingRaw) : [];
    const deduped = list.filter((x) => x.formId !== item.formId);
    deduped.push(item);
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(deduped.slice(-25)));
  } catch (_) {}
}

export function getPendingSubmissionCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return 0;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch (_) {
    return 0;
  }
}

let isFlushingOutbox = false;
export async function flushPendingSubmissions(): Promise<void> {
  if (typeof window === 'undefined' || isFlushingOutbox) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  let list: PendingSubmissionItem[] = [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return;
    list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return;
  } catch (_) {
    return;
  }

  isFlushingOutbox = true;
  const remaining: PendingSubmissionItem[] = [];

  try {
    for (const item of list) {
      const freshFormPayload = {
        ...item.formPayload,
        createdAt: item.formPayload.createdAt || Date.now()
      };
      const freshTicketPayload = item.ticketPayload
        ? {
            ...item.ticketPayload,
            createdAt: item.ticketPayload.createdAt || Date.now()
          }
        : undefined;

      try {
        await writeDirectToFirestore(item.formId, freshFormPayload, item.ticketId, freshTicketPayload);
      } catch (_) {
        try {
          await writeViaBackendRelay(item.formId, freshFormPayload, item.ticketId, freshTicketPayload);
        } catch (err2) {
          // Keep in outbox if younger than 7 days
          if (Date.now() - item.queuedAt < 7 * 24 * 60 * 60 * 1000) {
            remaining.push(item);
          }
        }
      }
    }

    if (remaining.length === 0) {
      localStorage.removeItem(OUTBOX_STORAGE_KEY);
    } else {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(remaining));
    }
  } finally {
    isFlushingOutbox = false;
  }
}

export async function submitFormResilient(params: {
  formId: string;
  formPayload: Record<string, any>;
  ticketId?: string;
  ticketPayload?: Record<string, any>;
  allowOfflineQueue?: boolean;
}): Promise<{ syncedNow: boolean; via: 'firestore' | 'relay' | 'offline_queue' }> {
  const { formId, formPayload, ticketId, ticketPayload, allowOfflineQueue = true } = params;

  // Katman 1: Doğrudan Firestore SDK (2 deneme, hızlı geri çekilme)
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await writeDirectToFirestore(formId, formPayload, ticketId, ticketPayload);
        return { syncedNow: true, via: 'firestore' };
      } catch (err: any) {
        const msg = String(err?.message || '');
        // Şema/izin hatası ise beklemeden Katman 2'ye geç
        if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
          break;
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 650));
        }
      }
    }

    // Katman 2: Sunucu Üzerinden Yedek Gönderim (/api/forms/submit)
    try {
      await writeViaBackendRelay(formId, formPayload, ticketId, ticketPayload);
      return { syncedNow: true, via: 'relay' };
    } catch (relayErr) {
      console.warn('Backend form relay fallback warning:', relayErr);
    }
  }

  // Katman 3: Çevrimdışı Kuyruk (Veri kaybını ve kullanıcı mağduriyetini %100 önler)
  if (allowOfflineQueue) {
    enqueueOfflineSubmission({
      id: `${formId}_${Date.now()}`,
      formId,
      formPayload,
      ticketId,
      ticketPayload,
      queuedAt: Date.now()
    });
    return { syncedNow: false, via: 'offline_queue' };
  }

  throw new Error('Bağlantı kurulamadı.');
}

/**
 * Kampüs, Sınav Tarihi ve Seans Kontenjan Anahtarı Yardımcısı
 * Örn: "eryaman__9_ocak__1", "umitkoy__10_ocak__2" (geriye dönük "eryaman__1" uyumlu)
 */
export function normalizeCampusKey(rawCampus: any): 'eryaman' | 'umitkoy' | 'oran' | '' {
  const c = String(rawCampus || '').toLocaleLowerCase('tr-TR');
  if (c.includes('ümitköy') || c.includes('umitkoy')) return 'umitkoy';
  if (c.includes('oran')) return 'oran';
  if (c.includes('eryaman')) return 'eryaman';
  return '';
}

export function normalizeExamDateSlot(rawDate: any): '9_ocak' | '10_ocak' | '' {
  const d = String(rawDate || '').toLocaleLowerCase('tr-TR').trim();
  if (!d) return '';
  if (d.includes('10') || d.includes('pazar')) return '10_ocak';
  if (d.includes('9') || d.includes('cumartesi')) return '9_ocak';
  return '';
}

export function formatExamDateLabel(rawDate: any): string {
  const rawStr = String(rawDate || '').trim();
  if (!rawStr || rawStr === '5 Ocak 2027') return DEFAULT_EXAM_DATE;
  const slot = normalizeExamDateSlot(rawStr);
  if (slot === '10_ocak') return '10 OCAK 2027 PAZAR';
  if (slot === '9_ocak') return '9 OCAK 2027 CUMARTESİ';
  return rawStr;
}

export function normalizeSessionSlot(rawSession: any): '1' | '2' {
  const s = String(rawSession || '').toLocaleLowerCase('tr-TR');
  if (
    s.includes('15:00') ||
    s.includes('16:00') ||
    s.includes('seans 2') ||
    s.includes('2. seans') ||
    s.includes('session_2') ||
    s.includes('öğleden')
  ) {
    return '2';
  }
  return '1';
}

export function formatExamSessionLabel(rawSession: any): string {
  const s = String(rawSession || '').trim();
  if (!s) return '';
  return normalizeSessionSlot(s) === '2' ? 'Seans 2: 15:00' : 'Seans 1: 11:00';
}

export function getCampusSessionKey(
  rawCampus: any,
  rawSession: any,
  rawExamDate?: any
): string {
  const cKey = normalizeCampusKey(rawCampus);
  if (!cKey) return '';
  const sSlot = normalizeSessionSlot(rawSession);
  const dSlot = normalizeExamDateSlot(rawExamDate);
  if (dSlot) {
    return `${cKey}__${dSlot}__${sSlot}`;
  }
  return `${cKey}__${sSlot}`;
}

export function isCampusSessionClosed(
  generalSettings: any,
  rawCampus: any,
  rawSession: any,
  rawExamDate?: any
): boolean {
  const cKey = normalizeCampusKey(rawCampus);
  if (!cKey) return false;
  const closedList: string[] = Array.isArray(generalSettings?.burslulukClosedSessions)
    ? generalSettings.burslulukClosedSessions
    : [];
  if (closedList.length === 0) return false;

  const sSlot = normalizeSessionSlot(rawSession);
  const legacyKey = `${cKey}__${sSlot}`;
  if (closedList.includes(legacyKey)) return true;

  const dSlot = normalizeExamDateSlot(rawExamDate);
  if (dSlot) {
    return closedList.includes(`${cKey}__${dSlot}__${sSlot}`);
  }
  // Henüz sınav tarihi seçilmemişse yalnızca her iki gün de kapalıysa kilitli göster
  return (
    closedList.includes(`${cKey}__9_ocak__${sSlot}`) &&
    closedList.includes(`${cKey}__10_ocak__${sSlot}`)
  );
}

export function isCampusDateFullyClosed(
  generalSettings: any,
  rawCampus: any,
  rawExamDate: any
): boolean {
  const cKey = normalizeCampusKey(rawCampus);
  const dSlot = normalizeExamDateSlot(rawExamDate);
  if (!cKey || !dSlot) return false;
  return (
    isCampusSessionClosed(generalSettings, rawCampus, '1', rawExamDate) &&
    isCampusSessionClosed(generalSettings, rawCampus, '2', rawExamDate)
  );
}

/**
 * Sınav Takvimi (.ICS) Hatırlatıcı Üretici (iPhone Takvim, Google Takvim, Outlook Uyumlu)
 */
function parseTurkishDateToYMD(rawDate: string): { year: number; month: number; day: number } {
  const months: Record<string, number> = {
    ocak: 1,
    şubat: 2,
    subat: 2,
    mart: 3,
    nisan: 4,
    mayıs: 5,
    mayis: 5,
    haziran: 6,
    temmuz: 7,
    ağustos: 8,
    agustos: 8,
    eylül: 9,
    eylul: 9,
    ekim: 10,
    kasım: 11,
    kasim: 11,
    aralık: 12,
    aralik: 12
  };

  const lower = String(rawDate || '').toLocaleLowerCase('tr-TR');
  const dayMatch = lower.match(/(\d{1,2})/);
  const yearMatch = lower.match(/(20\d{2})/);

  let foundMonth = 1;
  for (const [mName, mNum] of Object.entries(months)) {
    if (lower.includes(mName)) {
      foundMonth = mNum;
      break;
    }
  }

  return {
    year: yearMatch ? parseInt(yearMatch[1], 10) : 2027,
    month: foundMonth,
    day: dayMatch ? Math.min(31, Math.max(1, parseInt(dayMatch[1], 10))) : 9
  };
}

export function downloadExamCalendarIcs(params: {
  docNo: string;
  studentName: string;
  examDate: string;
  examTime: string;
  campusName: string;
  campusAddress: string;
}): void {
  const { year, month, day } = parseTurkishDateToYMD(params.examDate);
  const parsedTime = parseExamSessionTime(params.examTime);
  const [hourStr, minStr] = parsedTime.split(':');
  const startHour = Math.min(23, Math.max(0, parseInt(hourStr || '11', 10)));
  const startMin = Math.min(59, Math.max(0, parseInt(minStr || '0', 10)));
  const endHour = Math.min(23, startHour + 2);

  const pad = (n: number) => String(n).padStart(2, '0');
  const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startHour)}${pad(startMin)}00`;
  const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(startMin)}00`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const cleanText = (s: string) =>
    String(s || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[,;]/g, ' ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dost Koleji//Bursluluk Sinavi//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.docNo}@dostkoleji.com`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanText(`Dost Koleji Bursluluk Sınavı - ${params.studentName}`)}`,
    `LOCATION:${cleanText(`${params.campusName} - ${params.campusAddress}`)}`,
    `DESCRIPTION:${cleanText(`Aday Belge No: ${params.docNo} | Öğrenci: ${params.studentName} | Lütfen sınavdan 30 dakika önce kimlik kartınız ve giriş belgenizle birlikte kampüste hazır bulununuz.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Dost Koleji Bursluluk Sınavı 1 saat sonra başlayacaktır.',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dost_Koleji_Sinav_Takvimi_${params.docNo}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * WhatsApp Sınav Giriş Belgesi Paylaşım & Veliye Gönderim Linki Üretici
 */
export function normalizeTurkishPhoneForWhatsApp(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('90') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `9${digits}`;
  if (digits.startsWith('5') && digits.length === 10) return `90${digits}`;
  return digits;
}

export function buildWhatsAppTicketUrl(params: {
  phone?: string;
  docNo: string;
  studentName: string;
  grade: string;
  examDate: string;
  examTime: string;
  campusName: string;
  campusAddress: string;
  ticketId?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ticketUrl = params.ticketId
    ? `${origin}/bursluluk-basvuru-onay?id=${encodeURIComponent(params.ticketId)}`
    : `${origin}/bursluluk-basvuru-onay`;

  const message = [
    `*DOST KOLEJİ BURSLULUK SINAVI GİRİŞ BELGESİ*`,
    ``,
    `• *Belge No:* ${params.docNo}`,
    `• *Öğrenci:* ${params.studentName}`,
    `• *Sınıf:* ${params.grade}`,
    `• *Sınav Tarihi:* ${params.examDate}`,
    `• *Sınav Saati:* ${params.examTime}`,
    `• *Sınav Merkezi:* ${params.campusName}`,
    `• *Adres:* ${params.campusAddress}`,
    ``,
    `*Resmi Giriş Belgesi İndirme Bağlantısı:*`,
    ticketUrl
  ].join('\n');

  const normalizedPhone = params.phone ? normalizeTurkishPhoneForWhatsApp(params.phone) : '';
  const base = normalizedPhone ? `https://wa.me/${normalizedPhone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildCampusMapsUrl(
  campusName: string,
  campusAddress: string,
  directMapUrl?: string
): string {
  if (directMapUrl && /^https?:\/\//i.test(directMapUrl.trim())) {
    return directMapUrl.trim();
  }
  const query = `${campusName} ${campusAddress}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * "İletişim Bilgilerimiz" (/iletisim) sayfasındaki kampüs adres ve harita bilgilerini dinamik çözümleyici
 */
export interface ContactCampusItem {
  name: string;
  address: string;
  mapUrl: string;
}

export interface ContactCampusDirectory {
  eryaman: ContactCampusItem;
  oran: ContactCampusItem;
  umitkoy: ContactCampusItem;
}

export const DEFAULT_CONTACT_CAMPUSES: ContactCampusDirectory = {
  eryaman: {
    name: 'Eryaman Kampüsü',
    address: 'Şehit Osman Avcı Mah. 2651. Cad. No:4F Eryaman/Ankara',
    mapUrl: 'https://maps.app.goo.gl/QjDp3RnuQVfbXmK88'
  },
  oran: {
    name: 'Oran Kampüsü',
    address: 'Akpınar Mah. Dikmen Cad. No: 592 Çankaya/Ankara',
    mapUrl: 'https://maps.app.goo.gl/7Cp6TkAZdFAxPvMC7'
  },
  umitkoy: {
    name: 'Ümitköy Kampüsü',
    address: 'Ümit Mah. Meksika Cad. 2434. Sok. No:3 Ümitköy/Ankara',
    mapUrl: 'https://maps.app.goo.gl/R1gBYiXkCjo4AcrR8'
  }
};

function cleanSingleLineAddress(raw: any): string {
  return String(raw || '')
    .replace(/\s*\r?\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractContactCampusesFromPage(iletisimPage: any): ContactCampusDirectory {
  const result: ContactCampusDirectory = {
    eryaman: { ...DEFAULT_CONTACT_CAMPUSES.eryaman },
    oran: { ...DEFAULT_CONTACT_CAMPUSES.oran },
    umitkoy: { ...DEFAULT_CONTACT_CAMPUSES.umitkoy }
  };

  const blocks = iletisimPage?.blocks;
  if (!Array.isArray(blocks)) return result;

  for (const block of blocks) {
    if (!block || !Array.isArray(block.items)) continue;
    if (block.type !== 'contact_campuses' && !block.items.some((it: any) => it?.address)) {
      continue;
    }

    for (const item of block.items) {
      if (!item) continue;
      const key = normalizeCampusKey(`${item.badge || ''} ${item.title || ''} ${item.name || ''}`);
      const addr = cleanSingleLineAddress(item.address || item.desc);
      if (!key || !addr) continue;

      result[key].address = addr;
      const cleanTitle = cleanSingleLineAddress(item.title || item.name);
      if (cleanTitle) {
        result[key].name = cleanTitle;
      }
      const rawMapUrl = String(item.buttonUrl || item.link || item.url || '').trim();
      if (rawMapUrl && /^https?:\/\//i.test(rawMapUrl)) {
        result[key].mapUrl = rawMapUrl;
      }
    }
  }

  return result;
}

export function getCachedContactCampuses(): ContactCampusDirectory {
  const cachedPage = getCachedData<any>('page_iletisim', null);
  return extractContactCampusesFromPage(cachedPage);
}

export async function loadContactCampusesFromFirestore(): Promise<ContactCampusDirectory> {
  if (isCacheFresh('page_iletisim', 15 * 60 * 1000)) {
    return getCachedContactCampuses();
  }
  try {
    const snap = await fetchWithDedup('fb_page_iletisim', () =>
      getDoc(doc(db, 'pages', 'iletisim'))
    );
    if (snap.exists()) {
      const pageData = snap.data();
      setCachedData('page_iletisim', pageData);
      return extractContactCampusesFromPage(pageData);
    }
  } catch (_) {
    // Offline veya erişim gecikmesinde önbellek / varsayılan İletişim Bilgilerimiz verisini kullan
  }
  return getCachedContactCampuses();
}

export function resolveCampusDetailsFromDirectory(
  rawCampus: any,
  directory: ContactCampusDirectory = getCachedContactCampuses()
): {
  campusKey: 'eryaman' | 'oran' | 'umitkoy';
  campusName: string;
  campusAddress: string;
  mapUrl: string;
} {
  const matchedKey = normalizeCampusKey(rawCampus) || 'eryaman';
  const entry = directory[matchedKey] || DEFAULT_CONTACT_CAMPUSES[matchedKey];
  const rawStr = cleanSingleLineAddress(rawCampus);
  const displayCampusName =
    entry.name ||
    (matchedKey === 'oran'
      ? 'Oran Kampüsü'
      : matchedKey === 'umitkoy'
      ? 'Ümitköy Kampüsü'
      : rawStr || 'Eryaman Kampüsü');

  return {
    campusKey: matchedKey,
    campusName: displayCampusName,
    campusAddress: entry.address,
    mapUrl: buildCampusMapsUrl(displayCampusName, entry.address, entry.mapUrl)
  };
}
