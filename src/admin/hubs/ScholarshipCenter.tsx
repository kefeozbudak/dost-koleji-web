import { useState, useEffect } from 'react';
import { doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminStore } from '../../store/adminStore';
import { setCachedData, invalidateServerPublicCache } from '../../lib/cache';
import {
  Calendar,
  Trash2,
  CheckCircle2,
  Printer,
  User,
  Phone,
  GraduationCap,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Award,
  Download,
  Building2,
  Filter,
  FileDown,
  SlidersHorizontal,
  MessageCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import {
  generateExamTicketFiles,
  triggerBlobDownload,
  parseExamSessionTime
} from '../../lib/examTicketExport';
import {
  buildWhatsAppTicketUrl,
  normalizeSessionSlot
} from '../../lib/scholarshipCampaign';

const PAGE_SIZE = 50;

const CAMPUS_SESSION_SLOTS = [
  { campusKey: 'eryaman', campusLabel: 'Eryaman Kampüsü', slot: '1', sessionLabel: 'Seans 1 • 10:00', defaultLimit: 300 },
  { campusKey: 'eryaman', campusLabel: 'Eryaman Kampüsü', slot: '2', sessionLabel: 'Seans 2 • 16:00', defaultLimit: 300 },
  { campusKey: 'umitkoy', campusLabel: 'Ümitköy Kampüsü', slot: '1', sessionLabel: 'Seans 1 • 10:00', defaultLimit: 200 },
  { campusKey: 'umitkoy', campusLabel: 'Ümitköy Kampüsü', slot: '2', sessionLabel: 'Seans 2 • 16:00', defaultLimit: 200 },
  { campusKey: 'oran', campusLabel: 'Oran Kampüsü', slot: '1', sessionLabel: 'Seans 1 • 10:00', defaultLimit: 200 },
  { campusKey: 'oran', campusLabel: 'Oran Kampüsü', slot: '2', sessionLabel: 'Seans 2 • 16:00', defaultLimit: 200 }
] as const;

function toSafeMillis(raw: any): number {
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getCandidateNo(report: any): string {
  return (
    report?.candidateNo ||
    report?.data?.candidateNo ||
    (report?.id ? `DK2027-${String(report.id).slice(0, 6).toUpperCase()}` : 'DK2027-0001')
  );
}

function getAdChannelLabel(report: any): string {
  const d = report?.data || {};
  if (d.ad_channel) return String(d.ad_channel);
  if (d.utm_source) return `Kampanya: ${d.utm_source}`;
  if (d.discovery_source) return String(d.discovery_source);
  return 'Doğrudan Giriş';
}

const ScholarshipReportView = ({ report }: { report: any }) => {
  const data = report?.data || {};
  const candidateNo = getCandidateNo(report);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-sm w-full max-w-4xl mx-auto my-4">
      <div className="p-6 space-y-8">
        {/* 1. ÖĞRENCİ BİLGİLERİ */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-4 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004899] text-xl">school</span>
              <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                Bursluluk Öğrenci Bilgileri
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums font-bold text-[#002147]">
              Belge No: {candidateNo}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Öğrenci Adı Soyadı
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.student_fullname || data.studentName || data.student_name || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                T.C. Kimlik Numarası
              </span>
              <p className="text-sm font-mono tabular-nums font-semibold text-slate-800">
                {data.student_tc || data.studentTc || data.tc || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Sınıf Seviyesi
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.grade_level || data.grade || data.studentGrade || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Mevcut Okul
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.current_school || data.school || '-'}
              </p>
            </div>
            {(data.dob || data.studentBirthDate || data.gender || data.studentGender) && (
              <>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Doğum Tarihi
                  </span>
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">
                    {data.dob
                      ? String(data.dob).split('-').reverse().join('.')
                      : data.studentBirthDate
                      ? String(data.studentBirthDate).split('-').reverse().join('.')
                      : '-'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Cinsiyet
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {data.gender || data.studentGender || '-'}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 2. VELİ BİLGİLERİ */}
        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#004899] text-xl">family_restroom</span>
            <h3 className="text-sm font-bold text-slate-800 tracking-wide">
              Veli Bilgileri
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Veli Adı Soyadı
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.parent_fullname || data.parentName || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Telefon Numarası
              </span>
              <p className="text-sm font-mono tabular-nums font-semibold text-slate-800">
                {data.parent_phone || data.phone || data.parentPhone || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                E-posta Adresi
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.parent_email || data.email || data.parentEmail || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                KVKK Aydınlatma Onayı
              </span>
              <p className="text-sm font-semibold text-emerald-700">
                {data.kvkk_approval || data.kvkkConsent || data.kvkk ? 'Onaylandı' : 'Belirtilmedi'}
              </p>
            </div>
          </div>
        </section>

        {/* 3. SINAV VE REKLAM TERCİHLERİ */}
        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#004899] text-xl">location_on</span>
            <h3 className="text-sm font-bold text-slate-800 tracking-wide">
              Kampüs, Seans ve Başvuru Kaynağı
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Kampüs Seçimi
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.campus_preference || data.campus || data.kampus || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Sınav Saati / Seansı
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.exam_session ||
                  data.examSession ||
                  data.session ||
                  data.academic_year ||
                  data.academicYear ||
                  '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Bizi Nereden Duydunuz? (Veli Beyanı)
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {data.discovery_source || data.referral || data.heardFrom || '-'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                Dijital Reklam / UTM Kaynağı
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {getAdChannelLabel(report)}
                {data.utm_campaign ? ` · ${data.utm_campaign}` : ''}
              </p>
            </div>
          </div>
        </section>

        {(data.notes || data.message) && (
          <section>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <span className="block text-[11px] font-bold text-[#002147] mb-1">
                Eklemek İstedikleriniz
              </span>
              <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">
                {data.notes || data.message}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default function ScholarshipCenter() {
  const {
    forms: sharedForms,
    formsLoaded,
    generalSettings,
    ensureSettingsListeners
  } = useAdminStore();

  const [reports, setReports] = useState<any[]>(sharedForms || []);
  const [loading, setLoading] = useState(!formsLoaded && sharedForms.length === 0);

  const [selectedCampusTab, setSelectedCampusTab] = useState<'all' | 'umitkoy' | 'eryaman' | 'oran'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<'all' | '1' | '2'>('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [downloadingTicketId, setDownloadingTicketId] = useState<string | null>(null);

  // Capacity & Session Management Panel
  const [showCapacityPanel, setShowCapacityPanel] = useState(false);
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [closedSessions, setClosedSessions] = useState<string[]>([]);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacitySavedMsg, setCapacitySavedMsg] = useState('');

  // Selection mode & delete confirmation modal state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogIds, setDeleteDialogIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    ensureSettingsListeners();
  }, [ensureSettingsListeners]);

  useEffect(() => {
    if (generalSettings) {
      setCapacities(generalSettings.burslulukCapacities || {});
      setClosedSessions(
        Array.isArray(generalSettings.burslulukClosedSessions)
          ? generalSettings.burslulukClosedSessions
          : []
      );
    }
  }, [generalSettings]);

  useEffect(() => {
    setReports(sharedForms || []);
    if (formsLoaded || (sharedForms && sharedForms.length > 0)) {
      setLoading(false);
    }
  }, [sharedForms, formsLoaded]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCampusTab, selectedGradeFilter, selectedSessionFilter, searchTerm]);

  const saveCapacityConfig = async (
    nextCapacities: Record<string, number>,
    nextClosedSessions: string[]
  ) => {
    setSavingCapacity(true);
    setCapacitySavedMsg('');
    try {
      const merged = {
        ...(generalSettings || {}),
        burslulukCapacities: nextCapacities,
        burslulukClosedSessions: nextClosedSessions,
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'settings', 'general'), merged, { merge: true });
      setCachedData('settings_general', merged);
      invalidateServerPublicCache();
      setCapacitySavedMsg('Kontenjan ve seans ayarları kaydedildi.');
      setTimeout(() => setCapacitySavedMsg(''), 3000);
    } catch (err) {
      console.error('Error saving capacity settings:', err);
    } finally {
      setSavingCapacity(false);
    }
  };

  const toggleSessionClosed = async (sessionKey: string) => {
    const nextClosed = closedSessions.includes(sessionKey)
      ? closedSessions.filter((k) => k !== sessionKey)
      : [...closedSessions, sessionKey];
    setClosedSessions(nextClosed);
    await saveCapacityConfig(capacities, nextClosed);
  };

  const confirmDelete = async () => {
    if (!deleteDialogIds || deleteDialogIds.length === 0 || deleting) return;
    setDeleting(true);
    try {
      await Promise.all(
        deleteDialogIds.map(async (id) => {
          const targetReport = reports.find((r) => r.id === id);
          const linkedTicketId = targetReport?.ticketId || targetReport?.data?.ticketId;
          await deleteDoc(doc(db, 'forms', id)).catch((err) =>
            console.error('Error deleting form:', err)
          );
          await deleteDoc(doc(db, 'exam_tickets', id)).catch(() => {});
          if (linkedTicketId && linkedTicketId !== id) {
            await deleteDoc(doc(db, 'exam_tickets', linkedTicketId)).catch(() => {});
          }
        })
      );
      setSelectedIds((prev) => prev.filter((id) => !deleteDialogIds.includes(id)));
      if (deleteDialogIds.length > 1) {
        setIsSelectionMode(false);
      }
      setDeleteDialogIds(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (report: any, nextStatus: string) => {
    try {
      await updateDoc(doc(db, 'forms', report.id), { status: nextStatus });
    } catch (err) {
      console.error('Firestore update status error:', err);
    }
  };

  const extractSenderInfo = (data: any = {}) => {
    let name =
      data.student_fullname ||
      data.studentName ||
      data.student_name ||
      data.parent_fullname ||
      data.parentName ||
      data.name ||
      '';
    let phone = data.parent_phone || data.phone || data.parentPhone || '';
    let email = data.parent_email || data.email || data.parentEmail || '';
    let kampus = data.campus_preference || data.campus || data.kampus || '';
    let kademe = data.grade_level || data.grade || data.studentGrade || data.kademe || '';
    let session = data.exam_session || data.examSession || data.session || '';
    let school = data.current_school || data.school || '';
    let source = data.discovery_source || data.referral || data.heardFrom || '';
    let message = data.notes || data.message || '';
    const otherFields: { label: string; value: any }[] = [];

    Object.entries(data).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '') return;
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey.includes('formname')) return;

      if (lowerKey.includes('kademe') || lowerKey.includes('sınıf') || lowerKey.includes('grade')) {
        if (!kademe) kademe = String(val);
        else otherFields.push({ label: key, value: val });
      } else if (lowerKey.includes('kampüs') || lowerKey.includes('kampus') || lowerKey.includes('campus')) {
        if (!kampus) kampus = String(val);
        else otherFields.push({ label: key, value: val });
      } else if (lowerKey.includes('telefon') || lowerKey.includes('tel') || lowerKey.includes('phone')) {
        if (!phone) phone = String(val);
        else otherFields.push({ label: key, value: val });
      } else if (lowerKey.includes('email') || lowerKey.includes('eposta') || lowerKey.includes('e-posta')) {
        if (!email) email = String(val);
        else otherFields.push({ label: key, value: val });
      } else if (lowerKey.includes('mesaj') || lowerKey.includes('not') || lowerKey.includes('notes')) {
        if (!message) message = String(val);
        else otherFields.push({ label: key, value: val });
      } else if (lowerKey.includes('adı') || lowerKey.includes('soyad') || lowerKey.includes('name')) {
        if (!name) name = String(val);
        else otherFields.push({ label: key, value: val });
      } else {
        otherFields.push({ label: key, value: val });
      }
    });

    return {
      name: name || 'Belirtilmedi',
      phone,
      email,
      kampus,
      kademe,
      session,
      school,
      source,
      message,
      otherFields
    };
  };

  const isScholarshipForm = (r: any) => {
    if (
      r.type === 'scholarship_form' ||
      r.type === 'bursluluk_form' ||
      r.type === 'bursluluk_basvuru_formu' ||
      r.type === 'bursluluk_exam_form' ||
      r.type === 'scholarship'
    ) {
      return true;
    }
    if (
      r.data?.formName?.toLowerCase().includes('bursluluk') ||
      r.data?.formType?.toLowerCase().includes('bursluluk')
    ) {
      return true;
    }
    if (r.data?.title?.toLowerCase().includes('bursluluk')) return true;
    return false;
  };

  const matchCampus = (r: any, campusKey: string) => {
    if (campusKey === 'all') return true;
    const sender = extractSenderInfo(r.data);
    const c = (
      sender.kampus ||
      r.data?.campus_preference ||
      r.data?.campus ||
      r.data?.kampus ||
      ''
    ).toLowerCase();
    if (campusKey === 'umitkoy') return c.includes('ümitköy') || c.includes('umitkoy');
    if (campusKey === 'eryaman') return c.includes('eryaman');
    if (campusKey === 'oran') return c.includes('oran');
    return false;
  };

  const matchGrade = (r: any, gradeNum: string) => {
    if (gradeNum === 'all') return true;
    const sender = extractSenderInfo(r.data);
    const g = String(
      sender.kademe ||
        r.data?.grade_level ||
        r.data?.grade ||
        r.data?.studentGrade ||
        r.data?.kademe ||
        ''
    ).toLowerCase();
    return new RegExp(`(^|\\D)${gradeNum}(\\D|$)`).test(g);
  };

  const matchSessionSlot = (r: any, slot: 'all' | '1' | '2') => {
    if (slot === 'all') return true;
    const rawSession = r.data?.exam_session || r.data?.examSession || r.data?.session || '';
    return normalizeSessionSlot(rawSession) === slot;
  };

  const allScholarshipReports = reports.filter(isScholarshipForm);
  const activeScholarshipReports = allScholarshipReports.filter((r) => r.status !== 'cancelled');

  const totalScholarshipCount = allScholarshipReports.length;
  const umitkoyTotalCount = allScholarshipReports.filter((r) => matchCampus(r, 'umitkoy')).length;
  const eryamanTotalCount = allScholarshipReports.filter((r) => matchCampus(r, 'eryaman')).length;
  const oranTotalCount = allScholarshipReports.filter((r) => matchCampus(r, 'oran')).length;

  // Campus-scoped reports for session & ad-channel metrics
  const campusScopedReports = allScholarshipReports.filter((r) => matchCampus(r, selectedCampusTab));
  const session1Count = campusScopedReports.filter((r) => matchSessionSlot(r, '1')).length;
  const session2Count = campusScopedReports.filter((r) => matchSessionSlot(r, '2')).length;

  // Campaign Ad Channel Breakdown
  const adStats = campusScopedReports.reduce(
    (acc, r) => {
      const ch = getAdChannelLabel(r).toLowerCase();
      if (ch.includes('instagram') || ch.includes('meta') || ch.includes('facebook') || ch.includes('sosyal')) {
        acc.meta += 1;
      } else if (ch.includes('google') || ch.includes('arama') || ch.includes('internet')) {
        acc.google += 1;
      } else if (ch.includes('whatsapp') || ch.includes('tavsiye')) {
        acc.referral += 1;
      } else {
        acc.direct += 1;
      }
      return acc;
    },
    { meta: 0, google: 0, referral: 0, direct: 0 }
  );

  const availableGradeList =
    selectedCampusTab === 'eryaman' || selectedCampusTab === 'all'
      ? ['4', '5', '6', '7', '8', '9', '10', '11']
      : ['4', '5', '6', '7'];

  const getGradeCount = (gradeNum: string) => {
    return allScholarshipReports.filter(
      (r) =>
        matchCampus(r, selectedCampusTab) &&
        matchSessionSlot(r, selectedSessionFilter) &&
        matchGrade(r, gradeNum)
    ).length;
  };

  const filteredReports = allScholarshipReports.filter((r) => {
    if (!matchCampus(r, selectedCampusTab)) return false;
    if (!matchSessionSlot(r, selectedSessionFilter)) return false;
    if (!matchGrade(r, selectedGradeFilter)) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const candidateNo = getCandidateNo(r).toLowerCase();
      const rawDataString = JSON.stringify(r.data || {}).toLowerCase();
      return candidateNo.includes(term) || rawDataString.includes(term);
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + PAGE_SIZE);

  const resolveCampusInfo = (rawCampusStr: string) => {
    const rawCampus = String(rawCampusStr || 'Eryaman Kampüsü').toLowerCase();
    let campusName = 'Eryaman Kampüsü - Ana Bina';
    let campusAddress = 'Şehit Osman Avcı Mh. Malazgirt 1071 Cad. No:20 Eryaman / Etimesgut / Ankara';
    if (rawCampus.includes('oran')) {
      campusName = 'Oran Kampüsü - Ana Bina';
      campusAddress = 'Oran Mh. Rafet Canıtez Cd. No:8 Çankaya / Ankara';
    } else if (rawCampus.includes('ümitköy') || rawCampus.includes('umitkoy')) {
      campusName = 'Ümitköy Kampüsü - Ana Bina';
      campusAddress = 'Ümitköy Mh. 2432. Cd. No:18 Çankaya / Ankara';
    }
    return { campusName, campusAddress };
  };

  const getReportWhatsAppHref = (report: any) => {
    const data = report?.data || {};
    const sender = extractSenderInfo(data);
    const candidateNo = getCandidateNo(report);
    const { campusName, campusAddress } = resolveCampusInfo(sender.kampus || 'Eryaman Kampüsü');
    const rawGrade = sender.kademe || '8. Sınıf';
    const gradeFormatted = String(rawGrade).includes('Sınıf') ? String(rawGrade) : `${rawGrade}. Sınıf`;
    const ticketId = report?.ticketId || data?.ticketId || report?.id || '';

    return buildWhatsAppTicketUrl({
      phone: sender.phone,
      docNo: candidateNo,
      studentName: sender.name,
      grade: gradeFormatted,
      examDate: '5 Ocak 2027',
      examTime: parseExamSessionTime(sender.session || 'Seans 1: 10:00'),
      campusName,
      campusAddress,
      ticketId
    });
  };

  const handlePrint = (target: 'all' | any) => {
    const items = target === 'all' ? filteredReports : [target];
    if (!items || items.length === 0) return;

    let printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Dost Koleji - Bursluluk Başvuru Raporu</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; line-height: 1.6; color: #0f172a; }
            .report { border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px; page-break-inside: avoid; }
            .dost-header { font-size: 18px; font-weight: 800; color: #002147; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #002147; display: flex; justify-content: space-between; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
            .row { font-size: 13px; margin-bottom: 4px; }
            .label { font-weight: 700; color: #475569; }
          </style>
        </head>
        <body>
    `;

    items.forEach((item: any) => {
      const sender = extractSenderInfo(item.data);
      const candidateNo = getCandidateNo(item);
      const ms = toSafeMillis(item.createdAt);
      const dateFormatted = ms ? format(new Date(ms), 'dd.MM.yyyy HH:mm') : '-';
      const tc = item.data?.student_tc || item.data?.studentTc || item.data?.tc || '-';
      const parentName = item.data?.parent_fullname || item.data?.parentName || '-';

      printContent += `
        <div class="report">
          <div class="dost-header">
            <span>DOST KOLEJİ BURSLULUK SINAVI BAŞVURU KARTI</span>
            <span>BELGE NO: ${candidateNo}</span>
          </div>
          <div class="grid">
            <div class="row"><span class="label">Öğrenci Adı Soyadı:</span> ${sender.name}</div>
            <div class="row"><span class="label">T.C. Kimlik No:</span> ${tc}</div>
            <div class="row"><span class="label">Sınıf Seviyesi:</span> ${sender.kademe || '-'}</div>
            <div class="row"><span class="label">Mevcut Okul:</span> ${sender.school || '-'}</div>
            <div class="row"><span class="label">Kampüs Tercihi:</span> ${sender.kampus || '-'}</div>
            <div class="row"><span class="label">Sınav Seansı:</span> ${sender.session || '-'}</div>
            <div class="row"><span class="label">Veli Adı Soyadı:</span> ${parentName}</div>
            <div class="row"><span class="label">Veli Telefon:</span> ${sender.phone || '-'}</div>
            <div class="row"><span class="label">E-Posta:</span> ${sender.email || '-'}</div>
            <div class="row"><span class="label">Başvuru Tarihi:</span> ${dateFormatted}</div>
          </div>
        </div>
      `;
    });

    printContent += `</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const docWriter = iframe.contentWindow?.document;
    if (docWriter) {
      docWriter.open();
      docWriter.write(printContent);
      docWriter.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }, 250);
    }
  };

  const handleDownloadTicketPdf = async (report: any) => {
    if (downloadingTicketId) return;
    setDownloadingTicketId(report.id);
    try {
      const data = report?.data || {};
      const sender = extractSenderInfo(data);
      const candidateNo = getCandidateNo(report);
      const ms = toSafeMillis(report.createdAt);
      const docDate = ms ? new Date(ms).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
      const { campusName, campusAddress } = resolveCampusInfo(sender.kampus || 'Eryaman Kampüsü');

      const rawGrade = sender.kademe || '8. Sınıf';
      const gradeFormatted = String(rawGrade).includes('Sınıf') ? String(rawGrade) : `${rawGrade}. Sınıf`;

      const files = await generateExamTicketFiles({
        docNo: candidateNo,
        docDate,
        studentName: sender.name,
        studentTc: data.student_tc || data.studentTc || data.tc || '-',
        grade: gradeFormatted,
        examDate: '5 Ocak 2027',
        examTime: parseExamSessionTime(sender.session || 'Seans 1: 10:00'),
        campusName,
        campusAddress,
        documentTitle: 'Bursluluk Sınavı Giriş Belgesi',
        logoUrl: '/dost-logo-png.png',
        rules: [
          'Sınav başlamadan 30 dk. önce salonda hazır bulununuz.',
          'İlk 30 dk. ve son 15 dk. salondan çıkmak yasaktır.',
          'Optik formda kodlamaları kurşun kalemle yapınız.'
        ],
        requiredDocs: ['Nüfus Cüzdanı veya Kimlik Kartı', 'Sınav Giriş Belgesi']
      });
      triggerBlobDownload(files.pdfBlob, files.pdfFileName);
    } catch (err) {
      console.error('Admin ticket PDF error:', err);
    } finally {
      setDownloadingTicketId(null);
    }
  };

  const escapeCsvCell = (val: any): string => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };

  const downloadCSV = () => {
    const campusName = selectedCampusTab === 'all' ? 'Tum-Kampusler' : selectedCampusTab;
    const gradeName = selectedGradeFilter === 'all' ? 'Tum-Kademeler' : `${selectedGradeFilter}-Sinif`;
    const fileName = `Bursluluk-Basvurulari_${campusName}_${gradeName}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

    const headers = [
      'Belge No',
      'Öğrenci Adı Soyadı',
      'TC Kimlik',
      'Sınıf Seviyesi',
      'Mevcut Okul',
      'Kampüs Tercihi',
      'Sınav Seansı',
      'Veli Adı Soyadı',
      'Telefon',
      'E-Posta',
      'Nereden Duydu',
      'Dijital Reklam / UTM',
      'Durum',
      'Başvuru Tarihi'
    ];

    const statusLabels: Record<string, string> = {
      pending: 'Beklemede',
      new: 'Beklemede',
      approved: 'Onaylandı',
      contacted: 'Görüşüldü',
      cancelled: 'İptal Edildi'
    };

    const rows = filteredReports.map((report) => {
      const sender = extractSenderInfo(report.data);
      const candidateNo = getCandidateNo(report);
      const studentName =
        report.data?.student_fullname || report.data?.studentName || sender.name || '';
      const tc = report.data?.student_tc || report.data?.studentTc || report.data?.tc || '';
      const grade = sender.kademe || '';
      const school = sender.school || '';
      const campus = sender.kampus || '';
      const session = sender.session || '';
      const parentName = report.data?.parent_fullname || report.data?.parentName || '';
      const phone = sender.phone || '';
      const email = sender.email || '';
      const source = sender.source || '';
      const adChannel = getAdChannelLabel(report);
      const statusText = statusLabels[report.status || 'pending'] || report.status || 'Beklemede';
      const ms = toSafeMillis(report.createdAt);
      const date = ms ? format(new Date(ms), 'dd.MM.yyyy HH:mm') : '-';

      return [
        escapeCsvCell(candidateNo),
        escapeCsvCell(studentName),
        escapeCsvCell(tc),
        escapeCsvCell(grade),
        escapeCsvCell(school),
        escapeCsvCell(campus),
        escapeCsvCell(session),
        escapeCsvCell(parentName),
        escapeCsvCell(phone),
        escapeCsvCell(email),
        escapeCsvCell(source),
        escapeCsvCell(adChannel),
        escapeCsvCell(statusText),
        escapeCsvCell(date)
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2 bg-blue-50 text-[#004899] rounded-xl font-bold">
                <Award className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Bursluluk Sınavı Merkezi
              </h1>
            </div>
            <p className="text-slate-500 text-sm">
              Başvuruları kampüs, seans, sınıf kademesi ve reklam kanallarına göre anlık yönetin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCapacityPanel((prev) => !prev)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all border cursor-pointer whitespace-nowrap ${
                showCapacityPanel
                  ? 'bg-[#002147] text-white border-[#002147]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Seans & Kontenjan Yönetimi
            </button>

            <button
              type="button"
              onClick={() => handlePrint('all')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Rapor Çıktısı Al ({filteredReports.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedIds([]);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all border cursor-pointer whitespace-nowrap ${
                isSelectionMode
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSelectionMode ? 'Seçimi Kapat' : 'Çoklu Seçim'}
            </button>

            {isSelectionMode && selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteDialogIds(selectedIds)}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Seçilenleri Sil ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Campus & Session Capacity (Kontenjan) Panel */}
        {showCapacityPanel && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Kampüs ve Sınav Seansı Kontenjan Yönetimi
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kontenjanı dolan bir seansı kapattığınızda başvuru formunda o seans otomatik olarak &ldquo;(Kontenjan Doldu)&rdquo; şeklinde kilitlenir ve veliler açık seansa yönlendirilir.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {capacitySavedMsg && (
                  <span className="text-xs font-semibold text-emerald-700">{capacitySavedMsg}</span>
                )}
                <button
                  type="button"
                  disabled={savingCapacity}
                  onClick={() => saveCapacityConfig(capacities, closedSessions)}
                  className="px-4 py-2 bg-[#004899] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {savingCapacity ? 'Kaydediliyor...' : 'Limitleri Kaydet'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CAMPUS_SESSION_SLOTS.map((item) => {
                const key = `${item.campusKey}__${item.slot}`;
                const count = activeScholarshipReports.filter(
                  (r) => matchCampus(r, item.campusKey) && matchSessionSlot(r, item.slot)
                ).length;
                const limitVal = capacities[key] ?? item.defaultLimit;
                const pct = limitVal > 0 ? Math.min(100, Math.round((count / limitVal) * 100)) : 0;
                const isClosed = closedSessions.includes(key);

                return (
                  <div
                    key={key}
                    className={`p-4 rounded-xl border transition-colors space-y-3 ${
                      isClosed
                        ? 'border-red-200 bg-red-50/30'
                        : pct >= 90
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200 bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.campusLabel}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.sessionLabel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSessionClosed(key)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                          isClosed
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {isClosed ? 'Kapalı (Aç)' : 'Açık (Kapat)'}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Doluluk Oranı</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {count} / {limitVal} (%{pct})
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isClosed || pct >= 100
                              ? 'bg-red-600'
                              : pct >= 85
                              ? 'bg-amber-500'
                              : 'bg-[#004899]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <label className="text-[11px] font-semibold text-slate-500">
                        Maksimum Kontenjan:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={limitVal}
                        onChange={(e) =>
                          setCapacities((prev) => ({
                            ...prev,
                            [key]: Math.max(1, parseInt(e.target.value || '1', 10))
                          }))
                        }
                        className="w-24 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono tabular-nums font-bold text-right focus:outline-none focus:border-[#004899]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Row - Toplam Başvuru ve Kampüslere Göre Dağılım */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setSelectedCampusTab('all');
              setSelectedGradeFilter('all');
            }}
            className={`bg-white p-5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
              selectedCampusTab === 'all'
                ? 'border-[#004899] bg-blue-50/20 ring-2 ring-blue-100'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="p-3 bg-blue-50 text-[#004899] rounded-xl font-bold">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Toplam Başvuru
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{totalScholarshipCount}</span>
            </div>
          </div>

          <div
            onClick={() => {
              setSelectedCampusTab('umitkoy');
              setSelectedGradeFilter('all');
            }}
            className={`bg-white p-5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
              selectedCampusTab === 'umitkoy'
                ? 'border-[#004899] bg-blue-50/20 ring-2 ring-blue-100'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Ümitköy Kampüsü
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{umitkoyTotalCount}</span>
            </div>
          </div>

          <div
            onClick={() => {
              setSelectedCampusTab('eryaman');
              setSelectedGradeFilter('all');
            }}
            className={`bg-white p-5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
              selectedCampusTab === 'eryaman'
                ? 'border-[#004899] bg-blue-50/20 ring-2 ring-blue-100'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Eryaman Kampüsü
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{eryamanTotalCount}</span>
            </div>
          </div>

          <div
            onClick={() => {
              setSelectedCampusTab('oran');
              setSelectedGradeFilter('all');
            }}
            className={`bg-white p-5 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
              selectedCampusTab === 'oran'
                ? 'border-[#004899] bg-blue-50/20 ring-2 ring-blue-100'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Oran Kampüsü
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{oranTotalCount}</span>
            </div>
          </div>
        </div>

        {/* Seans Özeti & Dijital Reklam Kanalı Dağılımı */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 px-5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Clock className="w-4 h-4 text-[#004899]" />
              <span>Seans Tercihi Dağılımı:</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  selectedSessionFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tümü ({campusScopedReports.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  selectedSessionFilter === '1'
                    ? 'bg-white text-[#004899] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                10:00 Seansı ({session1Count})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSessionFilter('2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  selectedSessionFilter === '2'
                    ? 'bg-white text-[#004899] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                16:00 Seansı ({session2Count})
              </button>
            </div>
          </div>

          <div className="bg-white p-4 px-5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Başvuru Kaynağı (UTM):</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
              <span>
                Instagram/Meta: <strong className="text-slate-900">{adStats.meta}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Google/Web: <strong className="text-slate-900">{adStats.google}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                WhatsApp/Tavsiye: <strong className="text-slate-900">{adStats.referral}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Doğrudan: <strong className="text-slate-900">{adStats.direct}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Kampüs ve Sınıf Kademe Filtreleme Alanı */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setSelectedCampusTab('all');
                  setSelectedGradeFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                  selectedCampusTab === 'all'
                    ? 'bg-white text-[#004899] shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tüm Başvurular ({totalScholarshipCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCampusTab('umitkoy');
                  setSelectedGradeFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                  selectedCampusTab === 'umitkoy'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Ümitköy Kampüsü ({umitkoyTotalCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCampusTab('eryaman');
                  setSelectedGradeFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                  selectedCampusTab === 'eryaman'
                    ? 'bg-white text-purple-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Eryaman Kampüsü ({eryamanTotalCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCampusTab('oran');
                  setSelectedGradeFilter('all');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer tabular-nums ${
                  selectedCampusTab === 'oran'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Oran Kampüsü ({oranTotalCount})
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Öğrenci, veli, TC veya Belge No ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer tabular-nums"
            >
              <Download className="w-4 h-4" />
              Excel / CSV İndir ({filteredReports.length})
            </button>
          </div>

          {/* Sınıf Kademeleri Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Sınıf Kademesi:
            </span>

            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap tabular-nums ${
                selectedGradeFilter === 'all'
                  ? 'bg-[#004899] text-white border-[#004899]'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tüm Sınıflar (
              {
                allScholarshipReports.filter(
                  (r) => matchCampus(r, selectedCampusTab) && matchSessionSlot(r, selectedSessionFilter)
                ).length
              }
              )
            </button>

            {availableGradeList.map((gradeNum) => {
              const count = getGradeCount(gradeNum);
              const isSelected = selectedGradeFilter === gradeNum;

              return (
                <button
                  type="button"
                  key={gradeNum}
                  onClick={() => setSelectedGradeFilter(gradeNum)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap tabular-nums ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : count > 0
                      ? 'bg-blue-50/80 text-blue-700 border-blue-200 hover:bg-blue-100'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {gradeNum}. Sınıf ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-slate-400 font-medium">
            Başvurular yükleniyor...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">
              Seçilen kriterlere uygun bursluluk başvurusu bulunamadı.
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Farklı bir kampüs, seans veya sınıf kademesi seçerek ya da arama terimini temizleyerek tekrar deneyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <span className="text-xs font-bold text-slate-500 tabular-nums">
                Toplam Eşleşen:{' '}
                <span className="text-slate-900 font-black">{filteredReports.length} başvuru</span>
                {filteredReports.length > PAGE_SIZE && (
                  <span className="text-slate-400 font-semibold ml-2">
                    ({startIndex + 1} - {Math.min(startIndex + PAGE_SIZE, filteredReports.length)} arası gösteriliyor)
                  </span>
                )}
              </span>

              <div className="flex items-center gap-3">
                {isSelectionMode && (
                  <button
                    type="button"
                    onClick={() => {
                      const pageIds = paginatedReports.map((r) => r.id);
                      const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
                      if (allSelectedOnPage) {
                        setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                      } else {
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                      }
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Bu Sayfadakileri Seç / Bırak
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePrint('all')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Bu Listeyi Yazdır
                </button>
              </div>
            </div>

            {paginatedReports.map((report) => {
              const sender = extractSenderInfo(report.data);
              const candidateNo = getCandidateNo(report);
              const isExpanded = !!expandedIds[report.id];
              const status = report.status === 'new' || !report.status ? 'pending' : report.status;
              const createdMs = toSafeMillis(report.createdAt);
              const adChannel = getAdChannelLabel(report);

              return (
                <div
                  key={report.id}
                  className={`bg-white border rounded-2xl p-5 transition-all space-y-4 ${
                    status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : status === 'contacted'
                      ? 'border-purple-200 bg-purple-50/15'
                      : status === 'cancelled'
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {/* Top Metadata & Action Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mr-1"
                          checked={selectedIds.includes(report.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((prev) => [...prev, report.id]);
                            else setSelectedIds((prev) => prev.filter((i) => i !== report.id));
                          }}
                        />
                      )}

                      <span className="font-semibold flex items-center gap-1 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {createdMs ? format(new Date(createdMs), 'dd.MM.yyyy HH:mm') : 'Tarih Belirtilmedi'}
                      </span>

                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-bold text-[#002147]">{candidateNo}</span>

                      {sender.session && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#004899]">{sender.session}</span>
                        </>
                      )}

                      <span aria-hidden="true">·</span>
                      <span className="text-slate-500">{adChannel}</span>
                    </div>

                    {/* Status dropdown & action buttons */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(report, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border outline-none cursor-pointer ${
                          status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : status === 'contacted'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : status === 'cancelled'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="pending">Beklemede</option>
                        <option value="approved">Onaylandı / Kayıt Alındı</option>
                        <option value="contacted">Görüşüldü</option>
                        <option value="cancelled">İptal Edildi</option>
                      </select>

                      {sender.phone && (
                        <a
                          href={getReportWhatsAppHref(report)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                          title="Veliye WhatsApp'tan Giriş Belgesi Gönder"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadTicketPdf(report)}
                        disabled={downloadingTicketId === report.id}
                        className="p-2 text-slate-500 hover:text-[#002147] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        title="Sınav Giriş Belgesi PDF İndir"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrint(report)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Başvuru Kartını Yazdır"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteDialogIds([report.id])}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Grid Card */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Öğrenci Adı / T.C.
                      </span>
                      <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{sender.name}</span>
                      </p>
                      {(report.data?.student_tc || report.data?.studentTc) && (
                        <p className="text-xs font-mono tabular-nums text-slate-500 pl-5">
                          TC: {report.data?.student_tc || report.data?.studentTc}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Veli İletişim
                      </span>
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 tabular-nums">
                        <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{sender.phone || '-'}</span>
                      </p>
                      {(report.data?.parent_fullname || report.data?.parentName) && (
                        <p className="text-xs text-slate-500 pl-5">
                          {report.data?.parent_fullname || report.data?.parentName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        Kampüs / Sınıf
                      </span>
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>
                          {sender.kampus || sender.kademe
                            ? `${sender.kampus || '-'} ${sender.kademe ? `(${sender.kademe})` : ''}`
                            : '-'}
                        </span>
                      </p>
                      {sender.school && (
                        <p className="text-xs text-slate-500 pl-5 truncate" title={sender.school}>
                          Okul: {sender.school}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => ({ ...prev, [report.id]: !prev[report.id] }))
                        }
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {isExpanded ? (
                          <>
                            Detayları Gizle <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Başvuru Detayını Gör <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Report View */}
                  {isExpanded && (
                    <div className="pt-4 border-t border-slate-100">
                      <ScholarshipReportView report={report} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
                <span className="text-xs font-bold text-slate-500 tabular-nums">
                  Sayfa {safePage} / {totalPages}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Önceki
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - safePage) <= 2
                    )
                    .map((pageNum, idx, arr) => {
                      const prevPage = arr[idx - 1];
                      const showEllipsis = prevPage && pageNum - prevPage > 1;
                      return (
                        <span key={pageNum} className="inline-flex items-center gap-1.5">
                          {showEllipsis && <span className="text-xs text-slate-400 px-1">...</span>}
                          <button
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer tabular-nums ${
                              pageNum === safePage
                                ? 'bg-[#004899] text-white'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </span>
                      );
                    })}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                  >
                    Sonraki <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteDialogIds && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Başvuru Kaydını Sil</h3>
                <p className="text-xs text-slate-500">
                  {deleteDialogIds.length === 1
                    ? 'Bu bursluluk başvuru kaydını ve ilişkili giriş belgesini kalıcı olarak silmek istediğinize emin misiniz?'
                    : `${deleteDialogIds.length} adet bursluluk başvuru kaydını kalıcı olarak silmek istediğinize emin misiniz?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteDialogIds(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {deleting ? 'Siliniyor...' : 'Evet, Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
