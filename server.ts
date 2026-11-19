import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import 'dotenv/config';

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

let db: any = null;
try {
  const firebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);
} catch (error) {
  console.error("Firebase init error:", error);
}

// ============================================================================
// SERVER-SIDE FREE QUOTA PROTECTION CACHES (RAM-backed, TTL-bounded)
// Protects Google Firestore daily free read quota under 500-1,000 concurrent ad clicks
// ============================================================================
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MEDIA_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MEDIA_CACHE_MAX_ITEMS = 250;
const mediaMemoryCache = new Map<string, CacheEntry<any>>();

const PUBLIC_CACHE_TTL_MS = 90 * 1000; // 90 seconds (fresh showcase data, 99.9% burst read reduction)
const publicDocCache = new Map<string, CacheEntry<any>>();
const publicInflight = new Map<string, Promise<any>>();

function getCachedRam<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedRam<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  maxItems = 200
): void {
  if (map.size >= maxItems) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function fetchPublicCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = getCachedRam(publicDocCache, key);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }
  if (publicInflight.has(key)) {
    return publicInflight.get(key) as Promise<T>;
  }
  const p = loader()
    .then((res) => {
      setCachedRam(publicDocCache, key, res, PUBLIC_CACHE_TTL_MS, 150);
      return res;
    })
    .finally(() => {
      publicInflight.delete(key);
    });
  publicInflight.set(key, p);
  return p;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_FORM_TYPES = new Set([
  'bursluluk_basvuru_formu',
  'bursluluk_exam_form',
  'scholarship_form',
  'bursluluk_form',
  'pre_registration_form',
  'club_registration_form',
  'career_application',
  'contact_form',
  'quick_contact_form',
  'assistant_form',
  'newsletter',
  'contact',
  'club',
  'scholarship',
  'chat'
]);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // 1. Media serving endpoint (with 30-min RAM LRU cache + immutable browser cache)
  app.get("/api/media/:id", async (req, res) => {
    try {
      if (!db) {
        return res.status(500).send('Firebase not configured');
      }
      const mediaId = String(req.params.id || '').trim();
      if (!mediaId || mediaId.length > 128 || !VALID_ID_REGEX.test(mediaId)) {
        return res.status(400).send('Invalid media id');
      }

      let data = getCachedRam(mediaMemoryCache, mediaId);
      if (data === undefined) {
        const snap = await getDoc(doc(db, 'media', mediaId));
        data = snap.exists() ? snap.data() : null;
        setCachedRam(mediaMemoryCache, mediaId, data, MEDIA_CACHE_TTL_MS, MEDIA_CACHE_MAX_ITEMS);
      }

      if (data) {
        if (data.url && data.url.startsWith('data:image/')) {
          const parts = data.url.split(';base64,');
          if (parts.length === 2) {
            const mimeType = parts[0].replace('data:', '');
            const buffer = Buffer.from(parts[1], 'base64');
            res.set('Content-Type', mimeType);
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            return res.send(buffer);
          }
        } else if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
          res.set('Cache-Control', 'public, max-age=86400');
          return res.redirect(data.url);
        }
      }
      res.status(404).send('Not found');
    } catch (e: any) {
      console.error(e);
      res.status(500).send(e.message);
    }
  });

  // 2. Public Bootstrap Endpoint (Bundles showcase settings, active popups, and requested page from 90s RAM cache)
  app.get("/api/public-bootstrap", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }
      const rawDocId = String(req.query.docId || '').trim();
      const safeDocId =
        rawDocId && rawDocId.length <= 128 && VALID_ID_REGEX.test(rawDocId) ? rawDocId : '';

      const [header, footer, general, popups, page] = await Promise.all([
        fetchPublicCached('settings_header', async () => {
          const s = await getDoc(doc(db, 'settings', 'header'));
          return s.exists() ? s.data() : null;
        }),
        fetchPublicCached('settings_footer', async () => {
          const s = await getDoc(doc(db, 'settings', 'footer'));
          return s.exists() ? s.data() : null;
        }),
        fetchPublicCached('settings_general', async () => {
          const s = await getDoc(doc(db, 'settings', 'general'));
          return s.exists() ? s.data() : null;
        }),
        fetchPublicCached('popups_active', async () => {
          const q = query(collection(db, 'popups'), where('status', 'in', ['AKTİF', 'AKTIF']));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }),
        safeDocId
          ? fetchPublicCached(`page_${safeDocId}`, async () => {
              const p = await getDoc(doc(db, 'pages', safeDocId));
              if (!p.exists()) return null;
              const pData = p.data();
              if (pData?.isDeleted || pData?.isHidden) return { __hidden: true };
              return pData;
            })
          : Promise.resolve(null)
      ]);

      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({
        ok: true,
        header,
        footer,
        general,
        popups,
        page
      });
    } catch (e: any) {
      console.error("Bootstrap cache error:", e?.message || e);
      res.status(500).json({ ok: false, error: 'Bootstrap fetch error' });
    }
  });

  // 3. Instant Server RAM Cache Invalidation (Triggered automatically when Admin saves content)
  app.post("/api/cache/invalidate", (_req, res) => {
    publicDocCache.clear();
    mediaMemoryCache.clear();
    res.json({ ok: true });
  });

  // 4. Resilient Form Submission Relay (Zero-Data-Loss fallback for restricted networks / ad-blockers)
  app.post("/api/forms/submit", async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ ok: false, error: 'Firebase yapılandırması bulunamadı.' });
      }

      const { formId, formPayload, ticketId, ticketPayload } = req.body || {};
      const cleanFormId = String(formId || '').trim();

      if (!cleanFormId || cleanFormId.length > 128 || !VALID_ID_REGEX.test(cleanFormId)) {
        return res.status(400).json({ ok: false, error: 'Geçersiz form kimliği.' });
      }
      if (
        !formPayload ||
        typeof formPayload !== 'object' ||
        !ALLOWED_FORM_TYPES.has(String(formPayload.type || '')) ||
        !formPayload.data ||
        typeof formPayload.data !== 'object' ||
        Object.keys(formPayload.data).length === 0 ||
        Object.keys(formPayload.data).length > 50
      ) {
        return res.status(400).json({ ok: false, error: 'Geçersiz form verisi.' });
      }

      const safeFormDoc: Record<string, any> = {
        type: String(formPayload.type).slice(0, 64),
        createdAt:
          typeof formPayload.createdAt === 'number' && formPayload.createdAt > 1700000000000
            ? formPayload.createdAt
            : Date.now(),
        data: formPayload.data
      };
      if (formPayload.formName) safeFormDoc.formName = String(formPayload.formName).slice(0, 150);
      if (formPayload.candidateNo) safeFormDoc.candidateNo = String(formPayload.candidateNo).slice(0, 32);
      if (formPayload.ticketId) safeFormDoc.ticketId = String(formPayload.ticketId).slice(0, 64);
      if (formPayload.status === 'new' || formPayload.status === 'pending') {
        safeFormDoc.status = formPayload.status;
      }

      const writes: Promise<any>[] = [setDoc(doc(db, 'forms', cleanFormId), safeFormDoc)];

      if (ticketId && ticketPayload && typeof ticketPayload === 'object') {
        const cleanTicketId = String(ticketId).trim();
        if (
          cleanTicketId.length >= 16 &&
          cleanTicketId.length <= 128 &&
          VALID_ID_REGEX.test(cleanTicketId)
        ) {
          const safeTicketDoc: Record<string, any> = {
            candidateNo: String(ticketPayload.candidateNo || 'DK2027-0001').slice(0, 32),
            studentName: String(ticketPayload.studentName || 'Öğrenci').slice(0, 120),
            maskedTc: String(ticketPayload.maskedTc || '***********').slice(0, 16),
            grade: String(ticketPayload.grade || 'Belirtilmedi').slice(0, 64),
            campus: String(ticketPayload.campus || 'Eryaman Kampüsü').slice(0, 120),
            examSession: String(ticketPayload.examSession || 'Seans 1: 10:00').slice(0, 64),
            examDate: String(ticketPayload.examDate || '5 Ocak 2027').slice(0, 64),
            createdAt:
              typeof ticketPayload.createdAt === 'number' && ticketPayload.createdAt > 1700000000000
                ? ticketPayload.createdAt
                : Date.now()
          };
          writes.push(
            setDoc(doc(db, 'exam_tickets', cleanTicketId), safeTicketDoc).catch((err: any) => {
              const msg = String(err?.message || '');
              if (msg.includes('permission-denied') || msg.includes('PERMISSION_DENIED')) {
                return;
              }
              throw err;
            })
          );
        }
      }

      await Promise.all(writes);
      res.json({ ok: true, id: cleanFormId });
    } catch (e: any) {
      console.error("Form relay error:", e);
      res.status(500).json({ ok: false, error: e?.message || 'Sunucu kayıt hatası' });
    }
  });

  // 5. AI Assistant endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, knowledgeBase, siteContext } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not defined");
        return res.status(500).json({ error: "GEMINI_API_KEY eksik. Lütfen ortam değişkenlerini kontrol edin." });
      }

      const ai = new GoogleGenAI({ 
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const systemInstruction = `SİSTEM VE MİMARİ BAĞLAMI:
Bu uygulama, web sitesinde yer alan mevcut canlı destek penceresi modülünün arka plan mantığının yenilenmiş halidir.
- Arayüz Tasarımı: Sitedeki mevcut asistan penceresi ve görsel modül tasarımı birebir korunmaktadır.
- Yönetim Paneli: Yönetim paneli tarafı, bilgi tabanını (JSON/Veritabanı) ve yanıt kurallarını güncelleyecek şekilde bu yeni yapıya entegre edilmiştir.
- Çalışma Mantığı: Sistem iki aşamalıdır. İlk aşamada yönetim panelinden tanımlanan veriler yerel olarak taranır; yanıt bulunamadığında ikinci aşamada sen devreye girersin.

SENİN ROLÜN VE KURALLARIN:
Sen, mevcut canlı destek penceresi arayüzünde kullanıcı sorularını yanıtlayan arka plan asistanısın.

1. Bilgi Tabanına Sadakat: Yönetim paneli üzerinden sana aktarılan bilgi tabanı (context) dışına çıkma. Bilmediğin veya bilgi tabanında karşılığı olmayan konularda kesinlikle uydurma cevap verme.
2. Modül Arayüzüne Yönlendirme: Bir sorunun yanıtı bilgi tabanında yoksa veya canlı yetkili gerekiyorsa, bunu dürüstçe belirt ve kullanıcıyı mevcut asistan penceresinde yer alan ilgili butonlara (örneğin: "WhatsApp ile İletişim", "İletişim Formu" veya "Yetkiliye Bağlan") yönlendir. (Not: Form açmasını önermek istersen cevabının sonuna [FORM_TEKLIFI] yaz).
3. Arayüz Tasarımına Uyum: Yanıtların mevcut sohbet penceresi tasarımını bozmayacak şekilde kısa, öz, anlaşılır ve yapıcı olsun.

ÖRNEK YANIT YAKLAŞIMLARI:
- Bilgi mevcutsa: "Siparişleriniz 1-3 iş günü içerisinde kargoya teslim edilmektedir."
- Bilgi mevcut değilse: "Bu konu hakkında sistemimde kayıtlı bilgi bulunmamaktadır. Dilerseniz penceredeki 'İletişim Formu' veya 'WhatsApp' butonlarını kullanarak ekibimize ulaşabilirsiniz. [FORM_TEKLIFI]"

SİTE SAYFA VE BİLGİ İÇERİKLERİ:
${siteContext || 'Yok'}

EK KURUMSAL BİLGİ BANKASI VE NOTLAR:
${knowledgeBase || 'Yok'}`;
      
      const formattedMessages = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text || '' }]
      }));

      // Gemini API requires conversation to start with a 'user' turn
      while (formattedMessages.length > 0 && formattedMessages[0].role === 'model') {
        formattedMessages.shift();
      }

      if (formattedMessages.length === 0) {
        return res.status(400).json({ error: "Geçerli bir mesaj bulunamadı." });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: formattedMessages,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2
        }
      });
      res.json({ text: response.text });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // 6. Notification endpoint
  app.post("/api/notify", async (req, res) => {
    try {
      const { email, text } = req.body;
      const results = { email: false, errors: [] as string[] };
      
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          let host = process.env.SMTP_HOST;
          if (host.includes('://')) {
            host = host.split('://')[1];
          }
          const transporter = nodemailer.createTransport({
            host: host,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
          await transporter.sendMail({
            from: `"Dost Koleji Veli Asistanı" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Dost Koleji Veli Asistanı - Yeni Form Başvurusu",
            text: text,
          });
          results.email = true;
        } catch (err: any) {
          console.error("Email send error:", err);
          results.errors.push(`Email error: ${err.message}`);
        }
      } else { 
        results.errors.push("Email configuration (SMTP) is missing.");
      }

      if (!results.email) { 
        return res.status(500).json({ success: false, message: 'Bildirimler gönderilemedi. E-posta (SMTP) ayarları eksik veya hatalı.', errors: results.errors });
      }

      res.json({ success: true, message: 'Notification processed', results });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
