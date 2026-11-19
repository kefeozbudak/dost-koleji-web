/**
 * Firestore Security Rules Specification & Dirty Dozen Verification Suite
 * Validates all 12 adversarial payloads defined in security_spec.md.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: null | { uid: string; email: string; email_verified: boolean };
  docId?: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated PII Scraping on forms list',
    collection: 'forms',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Unauthenticated single PII document read on forms',
    collection: 'forms',
    operation: 'get',
    docId: 'abcdef1234567890abcd',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Shadow field injection on form creation',
    collection: 'forms',
    operation: 'create',
    docId: 'abcdef1234567890abcd',
    auth: null,
    payload: {
      type: 'bursluluk_basvuru_formu',
      createdAt: 1763548800000,
      data: { student_fullname: 'Test' },
      isVerifiedAdmin: true
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Oversized type field Denial-of-Wallet on form creation',
    collection: 'forms',
    operation: 'create',
    docId: 'abcdef1234567890abcd',
    auth: null,
    payload: {
      type: 'x'.repeat(500),
      createdAt: 1763548800000,
      data: { student_fullname: 'Test' }
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Unauthenticated deletion of form submission',
    collection: 'forms',
    operation: 'delete',
    docId: 'abcdef1234567890abcd',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Unverified admin email spoofing attack',
    collection: 'forms',
    operation: 'list',
    auth: {
      uid: 'spoof-uid',
      email: 'yasinozbudak@gmail.com',
      email_verified: false
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Self-privilege escalation on users collection',
    collection: 'users',
    operation: 'create',
    docId: 'attacker@example.com',
    auth: {
      uid: 'att-1',
      email: 'attacker@example.com',
      email_verified: true
    },
    payload: {
      email: 'attacker@example.com',
      role: 'super_admin',
      allowedPages: [],
      createdAt: 1763548800000
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'Editor role escalation to super_admin',
    collection: 'users',
    operation: 'update',
    docId: 'editor@example.com',
    auth: {
      uid: 'ed-1',
      email: 'editor@example.com',
      email_verified: true
    },
    payload: {
      email: 'editor@example.com',
      role: 'super_admin',
      allowedPages: [],
      createdAt: 1763548800000
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Public defacement attempt on pages/home',
    collection: 'pages',
    operation: 'update',
    docId: 'home',
    auth: null,
    payload: { title: 'Hacked', path: '/', blocks: [] },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Public enumeration of exam_tickets collection',
    collection: 'exam_tickets',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Short guessable ID or shadow PII field on exam_tickets',
    collection: 'exam_tickets',
    operation: 'create',
    docId: '1001',
    auth: null,
    payload: {
      candidateNo: 'DK2027-1001',
      studentName: 'Test Student',
      maskedTc: '123*****901',
      grade: '5. Sınıf',
      campus: 'Eryaman Kampüsü',
      examSession: '10:00',
      createdAt: 1763548800000,
      phone: '05551112233'
    },
    expected: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Analytics counter value poisoning / decrement attack',
    collection: 'traffic_daily',
    operation: 'update',
    docId: '2026-11-19__s0',
    auth: null,
    payload: {
      dateStr: '2026-11-19',
      views: -9999,
      visitors: 'invalid_type',
      updatedAt: 1763548800000
    },
    expected: 'PERMISSION_DENIED'
  }
];
