import { useState, useEffect } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminStore } from '../../store/adminStore';
import {
  Briefcase,
  FileText,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  Printer,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Search,
  X,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Award,
  Building2,
  RotateCcw,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import {
  normalizeCampusKey,
  normalizeExamDateSlot,
  formatExamDateLabel,
  normalizeSessionSlot,
  formatExamSessionLabel
} from '../../lib/scholarshipCampaign';
import {
  exportToExcelXlsx,
  cleanExcelText,
  formatPhoneForExcel
} from '../../lib/excelExport';

type BranchKey = 'umitkoy' | 'eryaman' | 'oran';
type DateSlotFilter = 'all' | '9_ocak' | '10_ocak';
type SessionSlotFilter = 'all' | '1' | '2';

interface ReportBranchTheme {
  key: BranchKey;
  label: string;
  shortLabel: string;
  filterValue: string;
  accentText: string;
  accentBg: string;
  tabActive: string;
  tabInactive: string;
  panelSurface: string;
  panelDivider: string;
  selectBorder: string;
  slotActive: string;
  slotInactive: string;
}

const REPORT_BRANCH_CONFIGS: ReportBranchTheme[] = [
  {
    key: 'umitkoy',
    label: 'Ümitköy Kampüsü',
    shortLabel: 'Ümitköy',
    filterValue: 'ümitköy',
    accentText: 'text-emerald-800',
    accentBg: 'bg-emerald-100 text-emerald-700',
    tabActive: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    tabInactive: 'bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    panelSurface: 'bg-emerald-50/50 border-emerald-200',
    panelDivider: 'border-emerald-200/70',
    selectBorder: 'border-emerald-200 focus:border-emerald-600',
    slotActive: 'bg-emerald-600 text-white border-emerald-600 shadow-2xs',
    slotInactive: 'bg-white text-emerald-950 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/60'
  },
  {
    key: 'eryaman',
    label: 'Eryaman Kampüsü',
    shortLabel: 'Eryaman',
    filterValue: 'eryaman',
    accentText: 'text-[#004899]',
    accentBg: 'bg-blue-100 text-[#004899]',
    tabActive: 'bg-[#004899] text-white border-[#004899] shadow-xs',
    tabInactive: 'bg-blue-50/90 text-[#004899] border-blue-200 hover:bg-blue-100',
    panelSurface: 'bg-blue-50/50 border-blue-200',
    panelDivider: 'border-blue-200/70',
    selectBorder: 'border-blue-200 focus:border-[#004899]',
    slotActive: 'bg-[#004899] text-white border-[#004899] shadow-2xs',
    slotInactive: 'bg-white text-[#002147] border-blue-200 hover:border-[#004899] hover:bg-blue-50/60'
  },
  {
    key: 'oran',
    label: 'Oran Kampüsü',
    shortLabel: 'Oran',
    filterValue: 'oran',
    accentText: 'text-amber-800',
    accentBg: 'bg-amber-100 text-amber-700',
    tabActive: 'bg-amber-600 text-white border-amber-600 shadow-xs',
    tabInactive: 'bg-amber-50/90 text-amber-800 border-amber-200 hover:bg-amber-100',
    panelSurface: 'bg-amber-50/50 border-amber-200',
    panelDivider: 'border-amber-200/70',
    selectBorder: 'border-amber-200 focus:border-amber-600',
    slotActive: 'bg-amber-600 text-white border-amber-600 shadow-2xs',
    slotInactive: 'bg-white text-amber-950 border-amber-200 hover:border-amber-400 hover:bg-amber-50/60'
  }
];

function isScholarshipReport(r: any): boolean {
  if (!r) return false;
  if (
    r.type === 'scholarship_form' ||
    r.type === 'bursluluk_form' ||
    r.type === 'bursluluk_basvuru_formu' ||
    r.type === 'bursluluk_exam_form' ||
    r.type === 'scholarship'
  ) {
    return true;
  }
  const fn = String(r.formName || r.data?.formName || r.data?.formType || r.data?.title || '').toLocaleLowerCase('tr-TR');
  return fn.includes('bursluluk');
}

const CareerReportView = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-sm w-full max-w-4xl mx-auto my-4">
      <div className="p-6 space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#002147] text-xl">work</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">İŞ BAŞVURU BİLGİLERİ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ad Soyad</span>
              <p className="text-sm font-semibold text-slate-800">{data.firstName} {data.lastName}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">E-Posta</span>
              <p className="text-sm font-semibold text-slate-800">{data.email || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefon</span>
              <p className="text-sm font-semibold text-slate-800">{data.phone || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Başvurulan Pozisyon</span>
              <p className="text-sm font-semibold text-slate-800">
                {data.position === 'math_teacher' ? 'Matematik Öğretmeni' :
                 data.position === 'academic_coordinator' ? 'Akademik Koordinatör' :
                 data.position === 'guidance_counselor' ? 'Rehber Danışman' :
                 data.position === 'general' ? 'Genel Başvuru' : data.position || '-'}
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#002147] text-xl">description</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">CV & ÖN YAZI</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ön Yazı</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.coverLetter || '-'}</p>
            </div>
            {(() => {
              const fileKeys = Object.keys(data).filter(key => data[key] && typeof data[key] === 'object' && data[key].isUploaded);
              if (fileKeys.length > 0) {
                return fileKeys.map((key, idx) => {
                  const file = data[key];
                  return (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{key} (Yüklenen Dosya)</span>
                        <p className="text-sm font-semibold text-slate-800">{file.name || 'İsimsiz Dosya'}</p>
                      </div>
                      {file.dataUrl ? (
                        <a href={file.dataUrl} download={file.name || 'dosya'} className="flex items-center gap-2 bg-[#004899] text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-900 transition">
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Dosyayı İndir
                        </a>
                      ) : file.cvUrl ? (
                        <a href={file.cvUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#004899] text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-900 transition">
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Dosyayı İndir
                        </a>
                      ) : (
                        <span className="text-xs text-red-500 font-bold">Dosya İçeriği Eksik</span>
                      )}
                    </div>
                  );
                });
              } else {
                return (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Özgeçmiş Dosyası</span>
                      <p className="text-sm font-semibold text-slate-800">{data.fileName || 'Dosya Bulunamadı'}</p>
                    </div>
                    {data.cvUrl ? (
                      <a href={data.cvUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-[#004899] text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-900 transition">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Görüntüle / İndir
                      </a>
                    ) : (
                      <span className="text-xs text-red-500 font-bold">Dosya Eklenmemiş</span>
                    )}
                  </div>
                );
              }
            })()}
          </div>
        </section>
      </div>
    </div>
  );
};

const PreRegistrationReportView = ({ data }: { data: any }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-sm w-full max-w-4xl mx-auto my-4">
      <div className="p-6 space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#2b5ec9] text-xl">school</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">ÖĞRENCİ BİLGİLERİ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Öğrenci Adı Soyadı</span>
              <p className="text-sm font-semibold text-slate-800">{data.student_fullname || data.studentName || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">T.C. Kimlik Numarası</span>
              <p className="text-sm font-semibold text-slate-800">{data.student_tc || data.studentTc || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Doğum Tarihi</span>
              <p className="text-sm font-semibold text-slate-800">
                {data.dob ? data.dob.split('-').reverse().join('.') : (data.studentBirthDate ? data.studentBirthDate.split('-').reverse().join('.') : '-')}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cinsiyet</span>
              <p className="text-sm font-semibold text-slate-800">{data.gender || data.studentGender || '-'}</p>
            </div>
            <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mevcut Sınıf Seviyesi</span>
              <p className="text-sm font-semibold text-slate-800">{data.grade || data.studentGrade || '-'}</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#2b5ec9] text-xl">family_restroom</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">VELİ BİLGİLERİ</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Veli Adı Soyadı</span>
              <p className="text-sm font-semibold text-slate-800">{data.parent_fullname || data.parentName || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">T.C. Kimlik Numarası</span>
              <p className="text-sm font-semibold text-slate-800">{data.parent_tc || data.parentTc || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefon Numarası</span>
              <p className="text-sm font-semibold text-slate-800">{data.phone || data.parentPhone || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">E-posta Adresi</span>
              <p className="text-sm font-semibold text-slate-800">{data.email || data.parentEmail || '-'}</p>
            </div>
            <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Öğrenciye Yakınlık Derecesi</span>
              <p className="text-sm font-semibold text-slate-800">{data.relation || data.parentRelation || '-'}</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-[#2b5ec9] text-xl">location_on</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">KAMPÜS VE TERCİHLER</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kampüs Seçimi</span>
              <p className="text-sm font-semibold text-slate-800">{data.campus || '-'}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Akademik Yıl</span>
              <p className="text-sm font-semibold text-slate-800">{data.academic_year || data.academicYear || '-'}</p>
            </div>
            <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bizi nereden duydunuz?</span>
              <p className="text-sm font-semibold text-slate-800">{data.referral || data.heardFrom || '-'}</p>
            </div>
          </div>
        </section>

        {(data.notes || data.message) && (
          <section>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <span className="block text-[10px] font-bold text-[#002147] uppercase mb-1">Eklemek İstedikleriniz</span>
              <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{data.notes || data.message}</p>
            </div>
          </section>
        )}
      </div>

      <div className="flex h-1.5 w-full">
        <div className="w-1/3 bg-[#2357c6]"></div>
        <div className="w-1/3 bg-[#001b3b]"></div>
        <div className="w-1/3 bg-[#2b5ec9]"></div>
      </div>
    </div>
  );
};

const ScholarshipReportDetailView = ({ report }: { report: any }) => {
  const data = report?.data || {};
  const candidateNo =
    report?.candidateNo ||
    data?.candidateNo ||
    (report?.id ? `DK2027-${String(report.id).slice(0, 6).toUpperCase()}` : 'DK2027-0001');
  const examDateText = formatExamDateLabel(data.exam_date || data.examDate);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200/80 shadow-sm w-full max-w-4xl mx-auto my-4">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#004899]" />
            <h3 className="text-sm font-bold text-slate-800">
              Bursluluk Sınavı Başvuru Özeti
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums font-bold text-[#002147]">
            Belge No: {candidateNo}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Öğrenci Adı Soyadı</span>
            <p className="text-sm font-semibold text-slate-800">
              {data.student_fullname || data.studentName || data.student_name || '-'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">T.C. Kimlik No</span>
            <p className="text-sm font-mono tabular-nums font-semibold text-slate-800">
              {data.student_tc || data.studentTc || data.tc || '-'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Sınıf Seviyesi / Okul</span>
            <p className="text-sm font-semibold text-slate-800">
              {data.grade_level || data.grade || data.studentGrade || '-'}
              {data.current_school || data.school ? ` · ${data.current_school || data.school}` : ''}
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Kampüs (Şube)</span>
            <p className="text-sm font-semibold text-slate-800">
              {data.campus_preference || data.campus || data.kampus || '-'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Sınav Tarihi</span>
            <p className="text-sm font-semibold text-[#002147]">{examDateText}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Seans Saati</span>
            <p className="text-sm font-semibold text-[#004899]">
              {(data.exam_session || data.examSession || data.session)
                ? formatExamSessionLabel(data.exam_session || data.examSession || data.session)
                : '-'}
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Veli Adı Soyadı</span>
            <p className="text-sm font-semibold text-slate-800">
              {data.parent_fullname || data.parentName || '-'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Veli Telefon</span>
            <p className="text-sm font-mono tabular-nums font-semibold text-slate-800">
              {data.parent_phone || data.phone || data.parentPhone || '-'}
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Veli E-Posta</span>
            <p className="text-sm font-semibold text-slate-800">
              {data.parent_email || data.email || data.parentEmail || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ReportCenter() {
  const { forms: sharedForms, formsLoaded } = useAdminStore();
  const [reports, setReports] = useState<any[]>(sharedForms || []);
  const [loading, setLoading] = useState(!formsLoaded && sharedForms.length === 0);
  const [activeTab, setActiveTab] = useState<
    'scholarship' | 'chat' | 'quick_contact' | 'pre_registration' | 'contact' | 'career' | 'newsletter' | 'all'
  >('scholarship');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKampus, setFilterKampus] = useState('');
  const [filterKademe, setFilterKademe] = useState('');
  const [filterDateSlot, setFilterDateSlot] = useState<DateSlotFilter>('all');
  const [filterSessionSlot, setFilterSessionSlot] = useState<SessionSlotFilter>('all');

  // Per-branch independent Date & Session state (Her şube için ayrı ayrı sınav tarihi ve seans saati)
  const [branchFilters, setBranchFilters] = useState<
    Record<BranchKey, { date: DateSlotFilter; session: SessionSlotFilter }>
  >({
    umitkoy: { date: 'all', session: 'all' },
    eryaman: { date: 'all', session: 'all' },
    oran: { date: 'all', session: 'all' }
  });

  // Track expanded cards (key = report id, val = boolean)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    setReports(sharedForms || []);
    if (formsLoaded || (sharedForms && sharedForms.length > 0)) {
      setLoading(false);
    }
  }, [sharedForms, formsLoaded]);

  const applyBranchFilter = (
    branch: BranchKey,
    nextDate: DateSlotFilter,
    nextSession: SessionSlotFilter
  ) => {
    const branchCfg = REPORT_BRANCH_CONFIGS.find((b) => b.key === branch);
    setBranchFilters((prev) => ({
      ...prev,
      [branch]: { date: nextDate, session: nextSession }
    }));
    setFilterKampus(branchCfg?.filterValue || '');
    setFilterDateSlot(nextDate);
    setFilterSessionSlot(nextSession);
    if (activeTab !== 'scholarship' && activeTab !== 'all') {
      setActiveTab('scholarship');
    }
  };

  const resetBranchAndGlobalFilters = () => {
    setFilterKampus('');
    setFilterKademe('');
    setFilterDateSlot('all');
    setFilterSessionSlot('all');
    setSearchTerm('');
    setBranchFilters({
      umitkoy: { date: 'all', session: 'all' },
      eryaman: { date: 'all', session: 'all' },
      oran: { date: 'all', session: 'all' }
    });
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    setReports((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);

    if (!id.startsWith('local_')) {
      try {
        await deleteDoc(doc(db, 'forms', id));
      } catch (err) {
        console.error('Error deleting form from Firestore:', err);
      }
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = isSelectionMode ? selectedIds : filteredReports.map((r) => r.id);
    if (idsToDelete.length === 0) return;

    setReports((prev) => prev.filter((r) => !idsToDelete.includes(r.id)));
    setSelectedIds([]);
    setBulkDeleteConfirm(false);

    await Promise.all(
      idsToDelete
        .filter((delId) => !delId.startsWith('local_'))
        .map((delId) =>
          deleteDoc(doc(db, 'forms', delId)).catch((err) =>
            console.error('Error deleting form from Firestore:', err)
          )
        )
    );
  };

  const handleToggleStatus = async (report: any) => {
    const nextStatus = report.status === 'processed' ? 'new' : 'processed';
    setReports((prev) =>
      prev.map((item: any) => (item.id === report.id ? { ...item, status: nextStatus } : item))
    );
    try {
      await updateDoc(doc(db, 'forms', report.id), {
        status: nextStatus
      });
    } catch (err) {
      console.error('Error updating status in Firestore:', err);
    }
  };

  const formatReportDate = (rawDate: any) => {
    if (!rawDate) return '-';
    try {
      if (typeof rawDate === 'number') {
        return format(new Date(rawDate), 'dd.MM.yyyy HH:mm');
      }
      if (rawDate.toDate && typeof rawDate.toDate === 'function') {
        return format(rawDate.toDate(), 'dd.MM.yyyy HH:mm');
      }
      return format(new Date(rawDate), 'dd.MM.yyyy HH:mm');
    } catch (e) {
      return '-';
    }
  };

  const extractSenderInfo = (data: any = {}) => {
    let name = data.student_fullname || data.studentName || data.parent_fullname || data.parentName || data.name || '';
    let phone = data.parent_phone || data.phone || data.parentPhone || '';
    let email = data.parent_email || data.email || data.parentEmail || '';
    let kampus = data.campus_preference || data.campus || data.kampus || '';
    let kademe = data.grade_level || data.grade || data.studentGrade || data.kademe || '';
    let examDate = (data.exam_date || data.examDate) ? formatExamDateLabel(data.exam_date || data.examDate) : '';
    let examSession = (data.exam_session || data.examSession || data.session)
      ? formatExamSessionLabel(data.exam_session || data.examSession || data.session)
      : '';
    let message = data.notes || data.message || '';
    const otherFields: { label: string; value: any }[] = [];

    const keyTranslations: Record<string, string> = {
      studentName: 'Öğrenci Adı',
      student_fullname: 'Öğrenci Adı Soyadı',
      studentTc: 'Öğrenci TC',
      student_tc: 'Öğrenci TC',
      studentBirthDate: 'Doğum Tarihi',
      studentGender: 'Cinsiyet',
      studentGrade: 'Sınıf Seviyesi',
      grade_level: 'Sınıf Seviyesi',
      current_school: 'Mevcut Okul',
      parentName: 'Veli Adı',
      parent_fullname: 'Veli Adı Soyadı',
      parentTc: 'Veli TC',
      parentPhone: 'Veli Telefon',
      parent_phone: 'Veli Telefon',
      parentEmail: 'Veli E-posta',
      parent_email: 'Veli E-posta',
      parentRelation: 'Yakınlık',
      campus: 'Kampüs',
      campus_preference: 'Kampüs Seçimi',
      exam_date: 'Sınav Tarihi',
      examDate: 'Sınav Tarihi',
      exam_session: 'Sınav Saati / Seansı',
      examSession: 'Sınav Saati / Seansı',
      candidateNo: 'Aday Belge No',
      academicYear: 'Akademik Yıl',
      heardFrom: 'Nereden Duydu',
      discovery_source: 'Nereden Duydu',
      notes: 'Ek Notlar'
    };

    Object.entries(data).forEach(([key, val]) => {
      if (!val) return;
      const lowerKey = key.toLowerCase().trim();
      const label = keyTranslations[key] || key;
      if (lowerKey.includes('formname') || lowerKey.includes('kvkk') || lowerKey === 'ticketid') return;

      if (lowerKey === 'exam_date' || lowerKey === 'examdate') {
        if (!examDate) examDate = formatExamDateLabel(val);
      } else if (lowerKey === 'exam_session' || lowerKey === 'examsession') {
        if (!examSession) examSession = formatExamSessionLabel(val);
      } else if (lowerKey.includes('kademe') || lowerKey.includes('sınıf') || lowerKey.includes('eğitim') || lowerKey.includes('grade') || lowerKey.includes('class') || lowerKey.includes('education')) {
        if (!kademe) kademe = String(val);
        else otherFields.push({ label, value: val });
      } else if (lowerKey.includes('kampüs') || lowerKey.includes('kampus') || lowerKey.includes('campus')) {
        if (!kampus) kampus = String(val);
        else otherFields.push({ label, value: val });
      } else if (lowerKey.includes('telefon') || lowerKey.includes('tel') || lowerKey.includes('phone') || lowerKey.includes('gsm')) {
        if (!phone) phone = String(val);
        else otherFields.push({ label, value: val });
      } else if (lowerKey.includes('email') || lowerKey.includes('eposta') || lowerKey.includes('e-posta')) {
        if (!email) email = String(val);
        else otherFields.push({ label, value: val });
      } else if (lowerKey.includes('mesaj') || lowerKey.includes('not') || lowerKey.includes('açıklama') || lowerKey.includes('notes') || lowerKey.includes('message')) {
        if (!message) message = String(val);
        else otherFields.push({ label, value: val });
      } else if (lowerKey.includes('adı') || lowerKey.includes('soyad') || lowerKey.includes('isim') || lowerKey.includes('ad ') || lowerKey === 'ad' || lowerKey.includes('name')) {
        if (!name) name = String(val);
        else otherFields.push({ label, value: val });
      } else {
        otherFields.push({ label, value: val });
      }
    });

    return {
      name: name || email || 'Belirtilmedi',
      phone,
      email,
      kampus,
      kademe,
      examDate,
      examSession,
      message,
      otherFields
    };
  };

  const checkKademeMatch = (senderKademe: string, filterValue: string) => {
    if (!filterValue) return true;
    const k = senderKademe.toLowerCase();
    const f = filterValue.toLowerCase();

    if (f === 'anaokulu') {
      return k.includes('okul öncesi') || k.includes('anaokul') || k.includes('yaş');
    }
    if (f === 'ilkokul') {
      return k.includes('1. sınıf') || k.includes('2. sınıf') || k.includes('3. sınıf') || k.includes('4. sınıf') || k.includes('ilkokul');
    }
    if (f === 'ortaokul') {
      return k.includes('5. sınıf') || k.includes('6. sınıf') || k.includes('7. sınıf') || k.includes('8. sınıf') || k.includes('ortaokul');
    }
    if (f === 'lise') {
      return k.includes('9. sınıf') || k.includes('10. sınıf') || k.includes('11. sınıf') || k.includes('12. sınıf') || k.includes('hazırlık') || k.includes('lise');
    }

    return k.includes(f);
  };

  const isChatForm = (r: any) =>
    !isScholarshipReport(r) &&
    r.type !== 'quick_contact_form' &&
    r.type !== 'pre_registration_form' &&
    r.type !== 'contact_form' &&
    r.type !== 'is_basvuru_formu' &&
    r.type !== 'career_application' &&
    r.type !== 'newsletter' &&
    (r.type === 'chat' || !r.type || Boolean(r.data?.formName));

  const scholarshipReportsAll = reports.filter(isScholarshipReport);

  const matchScholarshipBranchSlot = (
    r: any,
    branch: BranchKey | 'all',
    dateSlot: DateSlotFilter,
    sessionSlot: SessionSlotFilter
  ) => {
    if (!isScholarshipReport(r)) return false;
    const rawCampus = r.data?.campus_preference || r.data?.campus || r.data?.kampus || '';
    if (branch !== 'all' && normalizeCampusKey(rawCampus) !== branch) return false;
    if (dateSlot !== 'all') {
      const normalizedLabel = formatExamDateLabel(r.data?.exam_date || r.data?.examDate);
      if (normalizeExamDateSlot(normalizedLabel) !== dateSlot) return false;
    }
    if (sessionSlot !== 'all') {
      const rawSession = r.data?.exam_session || r.data?.examSession || r.data?.session || '';
      if (normalizeSessionSlot(rawSession) !== sessionSlot) return false;
    }
    return true;
  };

  const getBranchCount = (
    branch: BranchKey,
    dateSlot: DateSlotFilter,
    sessionSlot: SessionSlotFilter
  ) => scholarshipReportsAll.filter((r) => matchScholarshipBranchSlot(r, branch, dateSlot, sessionSlot)).length;

  // Filter forms based on tab, campus, kademe, exam date, exam session & search term
  const filteredReports = reports.filter(r => {
    if (activeTab === 'scholarship' && !isScholarshipReport(r)) return false;
    if (activeTab === 'chat' && !isChatForm(r)) return false;
    if (activeTab === 'quick_contact' && r.type !== 'quick_contact_form') return false;
    if (activeTab === 'pre_registration' && r.type !== 'pre_registration_form') return false;
    if (activeTab === 'contact' && r.type !== 'contact_form') return false;
    if (activeTab === 'career' && r.type !== 'is_basvuru_formu' && r.type !== 'career_application') return false;
    if (activeTab === 'newsletter' && r.type !== 'newsletter') return false;

    const sender = extractSenderInfo(r.data);

    if (filterKampus) {
      const targetBranch = normalizeCampusKey(filterKampus);
      const itemBranch = normalizeCampusKey(sender.kampus);
      if (targetBranch) {
        if (itemBranch !== targetBranch) return false;
      } else if (!sender.kampus.toLocaleLowerCase('tr-TR').includes(filterKampus.toLocaleLowerCase('tr-TR'))) {
        return false;
      }
    }

    if (filterKademe && !checkKademeMatch(sender.kademe, filterKademe)) {
      return false;
    }

    if (filterDateSlot !== 'all') {
      if (!isScholarshipReport(r)) return false;
      const normalizedLabel = formatExamDateLabel(r.data?.exam_date || r.data?.examDate);
      if (normalizeExamDateSlot(normalizedLabel) !== filterDateSlot) return false;
    }

    if (filterSessionSlot !== 'all') {
      if (!isScholarshipReport(r)) return false;
      const rawSession = r.data?.exam_session || r.data?.examSession || r.data?.session || '';
      if (normalizeSessionSlot(rawSession) !== filterSessionSlot) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const candidateNo = String(r.candidateNo || r.data?.candidateNo || '').toLowerCase();
      const rawDataString = JSON.stringify(r.data || {}).toLowerCase();
      return candidateNo.includes(term) || rawDataString.includes(term);
    }
    return true;
  });

  const handleExportExcel = () => {
    if (!filteredReports || filteredReports.length === 0) return;

    const branchSuffix = activeBranchKey ? `_${activeBranchKey}` : '_tum-subeler';
    const dateSuffix =
      filterDateSlot === '9_ocak'
        ? '_9-Ocak-Cumartesi'
        : filterDateSlot === '10_ocak'
        ? '_10-Ocak-Pazar'
        : '';
    const sessionSuffix =
      filterSessionSlot === '1'
        ? '_11-00'
        : filterSessionSlot === '2'
        ? '_15-00'
        : '';

    if (activeTab === 'scholarship') {
      const rows = filteredReports.map((rep: any, idx: number) => {
        const d = rep.data || {};
        const sender = extractSenderInfo(d);
        return {
          rowNo: idx + 1,
          candidateNo: cleanExcelText(rep.candidateNo || d.candidateNo),
          studentName: cleanExcelText(d.student_fullname || d.studentName || sender.name),
          tc: cleanExcelText(d.student_tc || d.studentTc || d.tc),
          grade: cleanExcelText(d.grade_level || d.studentGrade || sender.kademe),
          school: cleanExcelText(d.current_school || d.school),
          campus: cleanExcelText(d.campus_preference || d.campus || sender.kampus),
          examDate: cleanExcelText(
            (d.exam_date || d.examDate) ? formatExamDateLabel(d.exam_date || d.examDate) : sender.examDate
          ),
          examSession: cleanExcelText(
            (d.exam_session || d.examSession)
              ? formatExamSessionLabel(d.exam_session || d.examSession)
              : sender.examSession
          ),
          parentName: cleanExcelText(d.parent_fullname || d.parentName),
          phone: formatPhoneForExcel(d.parent_phone || d.parentPhone || sender.phone),
          email: cleanExcelText(d.parent_email || d.parentEmail || sender.email),
          source: cleanExcelText(d.discovery_source || d.heardFrom),
          notes: cleanExcelText(d.notes || sender.message),
          createdAt: formatReportDate(rep.createdAt)
        };
      });

      exportToExcelXlsx({
        fileName: `Rapor_Merkezi_Bursluluk${branchSuffix}${dateSuffix}${sessionSuffix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
        sheetName: 'Bursluluk Raporları',
        columns: [
          { header: 'Sıra No', key: 'rowNo', type: 'number', align: 'center', minWidth: 9, maxWidth: 11 },
          { header: 'Belge No', key: 'candidateNo', align: 'center', bold: true, minWidth: 18 },
          { header: 'Öğrenci Adı Soyadı', key: 'studentName', bold: true, minWidth: 24 },
          { header: 'T.C. Kimlik No', key: 'tc', align: 'center', minWidth: 16 },
          { header: 'Sınıf Seviyesi', key: 'grade', align: 'center', minWidth: 15 },
          { header: 'Mevcut Okul', key: 'school', minWidth: 25 },
          { header: 'Kampüs Tercihi', key: 'campus', minWidth: 19 },
          { header: 'Sınav Tarihi', key: 'examDate', minWidth: 25 },
          { header: 'Sınav Seansı', key: 'examSession', align: 'center', minWidth: 16 },
          { header: 'Veli Adı Soyadı', key: 'parentName', minWidth: 22 },
          { header: 'Veli Telefon', key: 'phone', align: 'center', minWidth: 18 },
          { header: 'Veli E-Posta', key: 'email', minWidth: 25 },
          { header: 'Nereden Duydu', key: 'source', minWidth: 22 },
          { header: 'Notlar', key: 'notes', minWidth: 24, maxWidth: 48 },
          { header: 'Kayıt Tarihi', key: 'createdAt', align: 'center', minWidth: 19 }
        ],
        rows
      });
      return;
    }

    const rows = filteredReports.map((rep: any, idx: number) => {
      const d = rep.data || {};
      const sender = extractSenderInfo(d);
      const formTypeLabel = isScholarshipReport(rep)
        ? 'Bursluluk Sınavı Başvurusu'
        : rep.type === 'pre_registration_form'
        ? 'Ön Kayıt Formu'
        : rep.type === 'contact_form'
        ? 'İletişim Formu'
        : rep.type === 'quick_contact_form'
        ? 'Hızlı İletişim Formu'
        : rep.type === 'is_basvuru_formu' || rep.type === 'career_application'
        ? 'İş Başvurusu'
        : rep.type === 'newsletter'
        ? 'E-Bülten Kaydı'
        : d.formName || 'Veli Asistanı Formu';

      const primaryName =
        d.student_fullname ||
        d.studentName ||
        (d.firstName ? `${d.firstName} ${d.lastName || ''}`.trim() : '') ||
        sender.name;

      return {
        rowNo: idx + 1,
        formType: cleanExcelText(formTypeLabel),
        candidateNo: cleanExcelText(rep.candidateNo || d.candidateNo),
        primaryName: cleanExcelText(primaryName),
        tc: cleanExcelText(d.student_tc || d.studentTc || d.tc),
        parentName: cleanExcelText(d.parent_fullname || d.parentName),
        phone: formatPhoneForExcel(sender.phone),
        email: cleanExcelText(sender.email),
        campus: cleanExcelText(sender.kampus),
        kademe: cleanExcelText(sender.kademe),
        examDate: cleanExcelText(sender.examDate),
        examSession: cleanExcelText(sender.examSession),
        message: cleanExcelText(sender.message || d.coverLetter || d.subject),
        createdAt: formatReportDate(rep.createdAt)
      };
    });

    exportToExcelXlsx({
      fileName: `Rapor_Merkezi_${activeTab}${branchSuffix}${dateSuffix}${sessionSuffix}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      sheetName: 'Rapor Merkezi',
      columns: [
        { header: 'Sıra No', key: 'rowNo', type: 'number', align: 'center', minWidth: 9, maxWidth: 11 },
        { header: 'Form Türü', key: 'formType', minWidth: 22 },
        { header: 'Belge No', key: 'candidateNo', align: 'center', minWidth: 17 },
        { header: 'Ad Soyad / Öğrenci', key: 'primaryName', bold: true, minWidth: 24 },
        { header: 'T.C. Kimlik No', key: 'tc', align: 'center', minWidth: 16 },
        { header: 'Veli Adı Soyadı', key: 'parentName', minWidth: 22 },
        { header: 'Telefon', key: 'phone', align: 'center', minWidth: 18 },
        { header: 'E-Posta', key: 'email', minWidth: 24 },
        { header: 'Kampüs / Şube', key: 'campus', minWidth: 18 },
        { header: 'Kademe / Sınıf', key: 'kademe', align: 'center', minWidth: 15 },
        { header: 'Sınav Tarihi', key: 'examDate', minWidth: 24 },
        { header: 'Sınav Seansı', key: 'examSession', align: 'center', minWidth: 15 },
        { header: 'Mesaj / Detay', key: 'message', minWidth: 26, maxWidth: 50 },
        { header: 'Kayıt Tarihi', key: 'createdAt', align: 'center', minWidth: 19 }
      ],
      rows
    });
  };

  const handlePrint = (target: 'all' | any) => {
    const items = target === 'all' ? filteredReports : [target];
    if (!items || items.length === 0) return;

    const keyTranslations: Record<string, string> = {
      studentgender: 'Öğrenci Cinsiyeti',
      studentgrade: 'Öğrenci Kademesi/Sınıfı',
      grade_level: 'Sınıf Seviyesi',
      current_school: 'Mevcut Okul',
      parenttc: 'Veli TC No',
      parentname: 'Veli Adı Soyadı',
      parent_fullname: 'Veli Adı Soyadı',
      studenttc: 'Öğrenci TC No',
      student_tc: 'Öğrenci TC No',
      parentphone: 'Veli Telefon Numarası',
      parent_phone: 'Veli Telefon Numarası',
      heardfrom: 'Bizi Nereden Duydunuz?',
      discovery_source: 'Bizi Nereden Duydunuz?',
      campus: 'Kampüs',
      campus_preference: 'Kampüs Tercihi',
      exam_date: 'Sınav Tarihi',
      examdate: 'Sınav Tarihi',
      exam_session: 'Sınav Saati / Seansı',
      examsession: 'Sınav Saati / Seansı',
      candidateno: 'Aday Belge No',
      notes: 'Notlar',
      studentname: 'Öğrenci Adı Soyadı',
      student_fullname: 'Öğrenci Adı Soyadı',
      academicyear: 'Akademik Yıl',
      parentrelation: 'Öğrenci Yakınlık Derecesi',
      studentbirthdate: 'Öğrenci Doğum Tarihi',
      parentemail: 'Veli E-posta Adresi',
      parent_email: 'Veli E-posta Adresi',
      message: 'Mesaj',
      name: 'Adı Soyadı',
      email: 'E-posta Adresi',
      phone: 'Telefon Numarası',
      subject: 'Konu',
      kademe: 'Eğitim Kademesi',
      kampus: 'Kampüs'
    };

    const translateKey = (key: string) => {
      const lowerKey = key.toLowerCase();
      if (keyTranslations[lowerKey]) return keyTranslations[lowerKey];

      let displayKey = key.replace(/_/g, ' ');
      displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
      return displayKey;
    };

    const orderScholarship = [
      'candidateNo',
      'campus_preference',
      'exam_date',
      'exam_session',
      'student_fullname',
      'student_tc',
      'grade_level',
      'current_school',
      'parent_fullname',
      'parent_phone',
      'parent_email',
      'discovery_source',
      'notes'
    ];

    const orderPreReg = [
      'campus', 'academicYear',
      'studentName', 'studentTc', 'studentGender', 'studentBirthDate', 'studentGrade',
      'parentName', 'parentTc', 'parentPhone', 'parentEmail', 'parentRelation',
      'heardFrom', 'notes'
    ];

    const orderContact = [
      'name', 'email', 'phone', 'kampus', 'kademe', 'subject', 'message'
    ];

    let printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Dost Koleji - Rapor Çıktısı</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; line-height: 1.6; color: #0f172a; }
            .report { border: 1px solid #cbd5e1; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; page-break-inside: avoid; }
            .dost-header { font-size: 18px; font-weight: 800; color: #004899; margin-bottom: 6px; }
            .title { font-size: 15px; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; color: #1e293b; }
            .row { margin-bottom: 5px; font-size: 13px; display: flex; align-items: baseline; }
            .label { font-weight: 700; margin-right: 10px; width: 220px; flex-shrink: 0; color: #334155; }
            .value { flex-grow: 1; }
            .date { font-size: 12px; color: #475569; margin-bottom: 12px; }
          </style>
        </head>
        <body>
    `;

    items.forEach((rep: any, idx: number) => {
      let dataHtml = '';
      let senderName = 'Bilinmiyor';
      if (rep.data) {
        senderName =
          rep.data.student_fullname ||
          rep.data.studentName ||
          rep.data.parent_fullname ||
          rep.data.ParentName ||
          rep.data.parentName ||
          rep.data.name ||
          'Bilinmiyor';
      }

      if (rep.data) {
        const isSch = isScholarshipReport(rep);
        const workingData = isSch
          ? {
              ...rep.data,
              exam_date: formatExamDateLabel(rep.data.exam_date || rep.data.examDate),
              exam_session: formatExamSessionLabel(
                rep.data.exam_session || rep.data.examSession || rep.data.session
              )
            }
          : rep.data;

        const seenLabels = new Set<string>();
        const dataKeys = Object.keys(workingData).filter(
          (k) => k !== 'formName' && k !== 'ticketId' && k !== 'kvkk_approval' && workingData[k]
        );

        const isPreReg =
          rep.type === 'pre_registration_form' ||
          dataKeys.some((k) => k.toLowerCase() === 'studenttc');
        const preferredOrder = isSch ? orderScholarship : isPreReg ? orderPreReg : orderContact;

        dataKeys.sort((a, b) => {
          const idxA = preferredOrder.findIndex((k) => k.toLowerCase() === a.toLowerCase());
          const idxB = preferredOrder.findIndex((k) => k.toLowerCase() === b.toLowerCase());
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });

        for (const key of dataKeys) {
          const val = workingData[key];
          if (key.toLowerCase() === 'notes') continue;
          const displayKey = translateKey(key);
          if (seenLabels.has(displayKey)) continue;
          seenLabels.add(displayKey);

          let displayVal = val;
          if (typeof val === 'object' && val !== null) {
            displayVal = JSON.stringify(val);
          }
          dataHtml += `<div class="row"><span class="label">${displayKey}:</span> <span class="value">${displayVal}</span></div>`;
        }
      }

      const dateStr = formatReportDate(rep.createdAt);
      const formName = isScholarshipReport(rep)
        ? 'Bursluluk Sınavı Başvurusu'
        : rep.type === 'pre_registration_form'
        ? 'Ön Kayıt Formu'
        : rep.type === 'contact_form'
        ? 'İletişim Formu'
        : rep.type === 'quick_contact_form'
        ? 'Hızlı İletişim Formu'
        : rep.type === 'chat' || !rep.type
        ? 'Veli Asistanı Formu'
        : rep.data?.formName || 'Veli Asistanı Formu';

      printContent += `
        <div class="report">
          <div class="dost-header">Dost Koleji</div>
          <div class="title">Rapor #${idx + 1} - ${formName}</div>
          <div class="date">
            <strong>Kayıt Tarihi:</strong> ${dateStr} · <strong>Aday / Gönderen:</strong> ${senderName}
          </div>
          ${dataHtml}
          ${rep.data?.notes || rep.data?.Notes ? `<div class="row"><span class="label">Notlar:</span> <span class="value">${rep.data?.notes || rep.data?.Notes}</span></div>` : ''}
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

  const activeBranchKey = normalizeCampusKey(filterKampus);
  const hasAnyFilter =
    Boolean(filterKampus) ||
    Boolean(filterKademe) ||
    filterDateSlot !== 'all' ||
    filterSessionSlot !== 'all' ||
    Boolean(searchTerm.trim());

  const showScholarshipBranchMatrix =
    activeTab === 'scholarship' || activeTab === 'all';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-1 flex items-center gap-3 text-[#004899]">
              <FileText className="w-8 h-8 text-[#38C1D2]" />
              Rapor Merkezi
            </h1>
            <p className="text-slate-500 text-sm">
              Bursluluk sınavı, ön kayıt, Veli Asistanı ve tüm web formlarını şube, tarih ve seans bazında filtreleyip yazdırın.
            </p>
          </div>

          {/* Print / Export All Button */}
          <div className="flex items-center gap-2">
            {bulkDeleteConfirm ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 p-1.5 rounded-xl">
                <span className="text-xs font-bold text-red-700 px-2">Listelenenleri Sil?</span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Evet, Sil
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                >
                  İptal
                </button>
              </div>
            ) : (
              <>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setBulkDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <Trash2 className="w-4 h-4" />
                    Seçilenleri Sil ({selectedIds.length})
                  </button>
                )}
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap ${
                    isSelectionMode
                      ? 'bg-slate-800 text-white hover:bg-slate-700'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSelectionMode ? 'Seçimi İptal Et' : 'Seç'}
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                >
                  <Download className="w-4 h-4" />
                  Excel İndir ({filteredReports.length})
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint('all')}
                  className="px-4 py-2 bg-[#004899] hover:bg-[#003875] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                >
                  <Printer className="w-4 h-4" />
                  Tümünü Yazdır ({filteredReports.length})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
              <button
                onClick={() => setActiveTab('scholarship')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'scholarship'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Bursluluk Sınavı ({scholarshipReportsAll.length})
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'chat'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Veli Asistanı ({reports.filter(isChatForm).length})
              </button>

              <button
                onClick={() => setActiveTab('pre_registration')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'pre_registration'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ön Kayıt ({reports.filter((r) => r.type === 'pre_registration_form').length})
              </button>

              <button
                onClick={() => setActiveTab('contact')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'contact'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                İletişim ({reports.filter((r) => r.type === 'contact_form').length})
              </button>

              <button
                onClick={() => setActiveTab('quick_contact')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'quick_contact'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Hızlı İletişim ({reports.filter((r) => r.type === 'quick_contact_form').length})
              </button>

              <button
                onClick={() => setActiveTab('career')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'career'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                İş Başvuruları ({reports.filter((r) => r.type === 'is_basvuru_formu' || r.type === 'career_application').length})
              </button>

              <button
                onClick={() => setActiveTab('newsletter')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'newsletter'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                E-Bülten ({reports.filter((r) => r.type === 'newsletter').length})
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`font-bold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums ${
                  activeTab === 'all'
                    ? 'bg-[#004899] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tüm Formlar ({reports.length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="İsim, T.C., Belge No, telefon ara..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#38C1D2]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 p-0.5 hover:bg-slate-200 rounded-full text-slate-400 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Renk Kodlu Şube Sekmeleri + Kademe Filtresi */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setFilterKampus('');
                  setFilterDateSlot('all');
                  setFilterSessionSlot('all');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums flex items-center gap-1.5 ${
                  !activeBranchKey
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>
                  Tüm Şubeler (
                  {showScholarshipBranchMatrix ? scholarshipReportsAll.length : reports.length})
                </span>
              </button>

              {REPORT_BRANCH_CONFIGS.map((branch) => {
                const isSelected = activeBranchKey === branch.key;
                const bState = branchFilters[branch.key];
                const bCount = showScholarshipBranchMatrix
                  ? getBranchCount(branch.key, 'all', 'all')
                  : reports.filter(
                      (r) => normalizeCampusKey(extractSenderInfo(r.data).kampus) === branch.key
                    ).length;

                return (
                  <button
                    key={branch.key}
                    type="button"
                    onClick={() => {
                      setFilterKampus(branch.filterValue);
                      setFilterDateSlot(bState.date);
                      setFilterSessionSlot(bState.session);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums flex items-center gap-1.5 ${
                      isSelected ? branch.tabActive : branch.tabInactive
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>
                      {branch.label} ({bCount})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative min-w-44">
                <select
                  value={filterKademe}
                  onChange={(e) => setFilterKademe(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38C1D2] cursor-pointer"
                >
                  <option value="">Tüm Kademeler</option>
                  <option value="anaokulu">Anaokulu</option>
                  <option value="ilkokul">İlkokul</option>
                  <option value="ortaokul">Ortaokul</option>
                  <option value="lise">Lise</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>

              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={resetBranchAndGlobalFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Şube Sekmesinin Hemen Altında Açılan Renk Uyumlu Sınav Tarihi & Seans (11:00 / 15:00) Filtresi */}
          {showScholarshipBranchMatrix &&
            (() => {
              const selectedBranchCfg = REPORT_BRANCH_CONFIGS.find(
                (b) => b.key === activeBranchKey
              );

              if (selectedBranchCfg) {
                const bState = branchFilters[selectedBranchCfg.key];
                const branchTotal = getBranchCount(selectedBranchCfg.key, 'all', 'all');
                const branchMatched = getBranchCount(
                  selectedBranchCfg.key,
                  bState.date,
                  bState.session
                );

                const sat11 = getBranchCount(selectedBranchCfg.key, '9_ocak', '1');
                const sat15 = getBranchCount(selectedBranchCfg.key, '9_ocak', '2');
                const sun11 = getBranchCount(selectedBranchCfg.key, '10_ocak', '1');
                const sun15 = getBranchCount(selectedBranchCfg.key, '10_ocak', '2');

                return (
                  <div
                    className={`p-4 rounded-xl border transition-all space-y-3.5 ${selectedBranchCfg.panelSurface}`}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b ${selectedBranchCfg.panelDivider}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-lg ${selectedBranchCfg.accentBg}`}>
                          <Building2 className="w-4 h-4" />
                        </span>
                        <div>
                          <span
                            className={`text-sm font-bold block leading-tight ${selectedBranchCfg.accentText}`}
                          >
                            {selectedBranchCfg.label} · Sınav Tarihi ve Seans Saati Filtresi
                          </span>
                          <span className="text-xs text-slate-600 tabular-nums">
                            Toplam {branchTotal} bursluluk başvurusu · Eşleşen:{' '}
                            <strong className="text-slate-900">{branchMatched}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyBranchFilter(selectedBranchCfg.key, 'all', 'all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          bState.date === 'all' && bState.session === 'all'
                            ? selectedBranchCfg.slotActive
                            : selectedBranchCfg.slotInactive
                        }`}
                      >
                        Şube Tümü ({branchTotal})
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-6 lg:col-span-3 space-y-1">
                        <label
                          className={`block text-xs font-bold ${selectedBranchCfg.accentText}`}
                        >
                          Sınav Tarihi ({selectedBranchCfg.shortLabel})
                        </label>
                        <select
                          value={bState.date}
                          onChange={(e) =>
                            applyBranchFilter(
                              selectedBranchCfg.key,
                              e.target.value as DateSlotFilter,
                              bState.session
                            )
                          }
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer ${selectedBranchCfg.selectBorder}`}
                        >
                          <option value="all">Tüm Tarihler ({branchTotal})</option>
                          <option value="9_ocak">
                            9 Ocak Cumartesi ({getBranchCount(selectedBranchCfg.key, '9_ocak', 'all')})
                          </option>
                          <option value="10_ocak">
                            10 Ocak Pazar ({getBranchCount(selectedBranchCfg.key, '10_ocak', 'all')})
                          </option>
                        </select>
                      </div>

                      <div className="sm:col-span-6 lg:col-span-3 space-y-1">
                        <label
                          className={`block text-xs font-bold ${selectedBranchCfg.accentText}`}
                        >
                          Seans Saati ({selectedBranchCfg.shortLabel})
                        </label>
                        <select
                          value={bState.session}
                          onChange={(e) =>
                            applyBranchFilter(
                              selectedBranchCfg.key,
                              bState.date,
                              e.target.value as SessionSlotFilter
                            )
                          }
                          className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer ${selectedBranchCfg.selectBorder}`}
                        >
                          <option value="all">
                            Tüm Saatler ({getBranchCount(selectedBranchCfg.key, bState.date, 'all')})
                          </option>
                          <option value="1">
                            1. Seans • 11:00 ({getBranchCount(selectedBranchCfg.key, bState.date, '1')})
                          </option>
                          <option value="2">
                            2. Seans • 15:00 ({getBranchCount(selectedBranchCfg.key, bState.date, '2')})
                          </option>
                        </select>
                      </div>

                      <div className="lg:col-span-6 space-y-1">
                        <span
                          className={`block text-xs font-bold ${selectedBranchCfg.accentText}`}
                        >
                          Hızlı Seans Seçimi ({selectedBranchCfg.shortLabel})
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => applyBranchFilter(selectedBranchCfg.key, '9_ocak', '1')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 cursor-pointer tabular-nums whitespace-nowrap ${
                              bState.date === '9_ocak' && bState.session === '1'
                                ? selectedBranchCfg.slotActive
                                : selectedBranchCfg.slotInactive
                            }`}
                          >
                            <span>9 Ocak · 11:00</span>
                            <span className="font-mono">{sat11}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => applyBranchFilter(selectedBranchCfg.key, '9_ocak', '2')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 cursor-pointer tabular-nums whitespace-nowrap ${
                              bState.date === '9_ocak' && bState.session === '2'
                                ? selectedBranchCfg.slotActive
                                : selectedBranchCfg.slotInactive
                            }`}
                          >
                            <span>9 Ocak · 15:00</span>
                            <span className="font-mono">{sat15}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => applyBranchFilter(selectedBranchCfg.key, '10_ocak', '1')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 cursor-pointer tabular-nums whitespace-nowrap ${
                              bState.date === '10_ocak' && bState.session === '1'
                                ? selectedBranchCfg.slotActive
                                : selectedBranchCfg.slotInactive
                            }`}
                          >
                            <span>10 Ocak · 11:00</span>
                            <span className="font-mono">{sun11}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => applyBranchFilter(selectedBranchCfg.key, '10_ocak', '2')}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 cursor-pointer tabular-nums whitespace-nowrap ${
                              bState.date === '10_ocak' && bState.session === '2'
                                ? selectedBranchCfg.slotActive
                                : selectedBranchCfg.slotInactive
                            }`}
                          >
                            <span>10 Ocak · 15:00</span>
                            <span className="font-mono">{sun15}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Tüm Şubeler seçiliyken kompakt tarih & seans filtresi
              return (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <select
                        value={filterDateSlot}
                        onChange={(e) => setFilterDateSlot(e.target.value as DateSlotFilter)}
                        className="appearance-none pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38C1D2] cursor-pointer"
                      >
                        <option value="all">Tüm Sınav Tarihleri</option>
                        <option value="9_ocak">9 OCAK 2027 CUMARTESİ</option>
                        <option value="10_ocak">10 OCAK 2027 PAZAR</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <select
                        value={filterSessionSlot}
                        onChange={(e) => setFilterSessionSlot(e.target.value as SessionSlotFilter)}
                        className="appearance-none pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38C1D2] cursor-pointer"
                      >
                        <option value="all">Tüm Seans Saatleri</option>
                        <option value="1">1. Seans • 11:00</option>
                        <option value="2">2. Seans • 15:00</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Şubeye özel renkli tarih ve seans filtresini açmak için yukarıdan{' '}
                    <strong className="text-emerald-700">Ümitköy</strong>,{' '}
                    <strong className="text-[#004899]">Eryaman</strong> veya{' '}
                    <strong className="text-amber-700">Oran</strong> sekmesine tıklayın.
                  </p>
                </div>
              );
            })()}
        </div>

        {/* Main List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-slate-500 py-12 text-sm font-bold">
              Formlar yükleniyor...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-sm text-slate-700">Seçilen kriterlere uygun kayıt bulunmuyor.</p>
              <p className="text-xs text-slate-400 mt-1">
                Farklı bir şube, sınav tarihi veya seans saati seçerek tekrar kontrol edebilirsiniz.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const isProcessed = report.status === 'processed' || report.status === 'approved';
              const sender = extractSenderInfo(report.data);
              const isExpanded = !!expandedIds[report.id];
              const isSch = isScholarshipReport(report);

              return (
                <div
                  key={report.id}
                  className={`bg-white border rounded-2xl p-4 md:p-5 transition-all shadow-sm space-y-3 ${
                    isProcessed ? 'border-slate-200 bg-slate-50/60 opacity-90' : 'border-slate-200 hover:border-[#38C1D2]'
                  }`}
                >
                  {/* Top Meta Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 mr-1 cursor-pointer"
                          checked={selectedIds.includes(report.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, report.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== report.id));
                            }
                          }}
                        />
                      )}
                      <span className="font-bold text-[#004899]">
                        {isSch
                          ? 'Bursluluk Sınavı Başvurusu'
                          : report.type === 'newsletter'
                          ? 'E-Bülten Aboneliği'
                          : report.type === 'is_basvuru_formu' || report.type === 'career_application'
                          ? 'İş Başvurusu'
                          : report.type === 'pre_registration_form'
                          ? 'Ön Kayıt Formu'
                          : report.type === 'contact_form'
                          ? 'İletişim Formu'
                          : report.type === 'quick_contact_form'
                          ? 'Hızlı İletişim Formu'
                          : report.type === 'chat' || !report.type
                          ? 'Veli Asistanı Formu'
                          : report.data?.formName || 'Veli Asistanı Formu'}
                      </span>

                      {isSch && (sender.examDate || sender.examSession) && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="font-semibold text-[#002147]">
                            {sender.examDate}
                            {sender.examSession ? ` · ${sender.examSession}` : ''}
                          </span>
                        </>
                      )}

                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(report); }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                          isProcessed ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        {isProcessed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {isProcessed ? 'İncelendi' : 'Yeni / Bekliyor'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-medium tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatReportDate(report.createdAt)}
                      </span>

                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrint(report); }}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-[#004899] hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-blue-200/60"
                        title="Bu Raporu Yazdır"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#38C1D2]" />
                        Yazdır
                      </button>
                      {deleteConfirmId === report.id ? (
                        <div className="flex items-center gap-1 bg-red-50 border border-red-200 p-1 rounded-xl">
                          <span className="text-[11px] font-bold text-red-700 px-1">Silinsin mi?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Evet
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            Vazgeç
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(report.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Kaydı Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div
                    onClick={() => toggleExpand(report.id)}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200/80 cursor-pointer transition-all select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#004899] text-white flex items-center justify-center font-black text-base shadow-2xs shrink-0">
                        {(sender.name || 'B').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {isSch ? 'Öğrenci Adı Soyadı' : 'Gönderen'}
                        </p>
                        <p className="text-base font-black text-[#004899]">{sender.name || 'Bilinmiyor'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isExpanded && (
                        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 font-medium tabular-nums">
                          {sender.kampus && <span>{sender.kampus}</span>}
                          {sender.kademe && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{sender.kademe}</span>
                            </>
                          )}
                          {sender.phone && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{sender.phone}</span>
                            </>
                          )}
                        </div>
                      )}
                      <button className="flex items-center gap-1.5 text-xs font-bold text-[#004899] px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0">
                        {isExpanded ? (
                          <><span>Detayı Kapat</span><ChevronUp className="w-4 h-4 text-[#004899]" /></>
                        ) : (
                          <><span>Detayı Gör</span><ChevronDown className="w-4 h-4 text-[#004899]" /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details Area */}
                  {isExpanded && (
                    isSch ? (
                      <ScholarshipReportDetailView report={report} />
                    ) : report.type === 'is_basvuru_formu' || report.type === 'career_application' ? (
                      <CareerReportView data={report.data} />
                    ) : report.type === 'pre_registration_form' ? (
                      <PreRegistrationReportView data={report.data} />
                    ) : (
                      <div className="bg-gradient-to-b from-blue-50/50 to-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#004899] text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                              {(sender.name || 'B').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-[11px] font-semibold text-slate-400 block">Gönderen</span>
                              <span className="text-base font-black text-[#004899]">{sender.name || 'Bilinmiyor'}</span>
                            </div>
                          </div>

                          {sender.phone && (
                            <a
                              href={`https://wa.me/90${sender.phone.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="self-start sm:self-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5 text-[#004899]" />
                              İlgilendiği Eğitim Kademesi
                            </span>
                            <p className="font-bold text-slate-800 text-sm">
                              {sender.kademe || 'Belirtilmedi'}
                            </p>
                          </div>

                          <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#004899]" />
                              İlgilendiği Kampüs
                            </span>
                            <p className="font-bold text-slate-800 text-sm">
                              {sender.kampus || 'Belirtilmedi'}
                            </p>
                          </div>

                          <div className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-[#004899]" />
                              Telefon Numarası
                            </span>
                            {sender.phone ? (
                              <a href={`tel:${sender.phone}`} onClick={(e) => e.stopPropagation()} className="font-bold text-[#004899] hover:underline block text-sm tabular-nums">
                                {sender.phone}
                              </a>
                            ) : (
                              <p className="font-medium text-slate-400 text-sm">Belirtilmedi</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 space-y-1">
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-[#38C1D2]" />
                            Mesaj
                          </span>
                          <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {sender.message ? `"${sender.message}"` : 'Mesaj bırakılmadı.'}
                          </p>
                        </div>

                        {sender.otherFields.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {sender.otherFields.map((field, idx) => (
                              <div key={idx} className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{field.label}:</span>
                                <p className="text-xs font-semibold text-slate-800">{String(field.value)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
