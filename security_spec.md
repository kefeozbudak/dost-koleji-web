# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default Deny Safety Net:** Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **PII Split-Collection Isolation (`forms` & `reports` vs `exam_tickets`):**
   - `forms/{formId}` and `reports/{reportId}` store sensitive student/parent PII (full T.C. Kimlik No, phone, email, notes, CVs). Unauthenticated visitors can **ONLY `create`** strictly validated documents; they can **NEVER `get`, `list`, `update`, or `delete`** `forms` or `reports`.
   - Printable exam entry cards use `/exam_tickets/{ticketId}` with high-entropy IDs (`size >= 16`) and strictly masked T.C. Kimlik (`123*****901`) — zero phone, email, or unmasked national IDs. Public `list`, `update`, and `delete` on `exam_tickets` are denied.
3. **Verified Admin & Anti-Privilege-Escalation (`users`):**
   - Admin access requires `request.auth != null && request.auth.token.email_verified == true` AND either bootstrapped super-admin (`yasinozbudak@gmail.com`) or an active role document in `/users/$(request.auth.token.email)`.
   - Only `isSuperAdmin()` may create, update, or delete `/users/{userEmail}` documents, preventing editors or guests from self-assigning `super_admin`.
4. **Public Showcase Read-Only Integrity (`pages`, `settings`, `popups`, `media`):**
   - Visitors can read published `pages`, public `settings` (`header`, `footer`, `general`, `assistant`), active `popups` (`status == 'AKTİF'`), and individual `media/{mediaId}` documents. Only verified admins can mutate them or list full admin collections.
5. **Write-Only Bounded Analytics (`traffic_logs`, `traffic_daily`, `traffic_pages`):**
   - Public visitors can only create bounded `traffic_logs` and atomically create/increment sharded `traffic_daily` and `traffic_pages` counters (`affectedKeys().hasOnly(...)` + strict numeric/string bounds). Public reads on all `traffic_*` collections are denied.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated PII Scraping (`forms` list):** `getDocs(collection(db, 'forms'))` as anonymous user -> `PERMISSION_DENIED`.
2. **Unauthenticated Single Form Read (`forms` get):** `getDoc(doc(db, 'forms', 'knownId1234567890'))` as anonymous user -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Form Create:** `setDoc(doc(db, 'forms', 'validId1234567890'), { type: 'bursluluk_basvuru_formu', createdAt: 1700000000000, data: {}, isAdminApproved: true })` -> `PERMISSION_DENIED`.
4. **Oversized Payload / Denial-of-Wallet String on Form Create:** `type` string of 5,000 chars or `data` map > 40 keys -> `PERMISSION_DENIED`.
5. **Unauthenticated Form Deletion:** `deleteDoc(doc(db, 'forms', 'validId1234567890'))` -> `PERMISSION_DENIED`.
6. **Unverified Admin Email Spoofing:** Authenticated token with `email: 'yasinozbudak@gmail.com'`, `email_verified: false` attempting `getDocs(collection(db, 'forms'))` -> `PERMISSION_DENIED`.
7. **Self-Privilege Escalation on `users`:** Authenticated non-admin (`attacker@example.com`) writing `/users/attacker@example.com` with `{ role: 'super_admin' }` -> `PERMISSION_DENIED`.
8. **Editor Role Escalation on `users`:** Authenticated `editor` updating `/users/editor@example.com` to `{ role: 'super_admin' }` -> `PERMISSION_DENIED`.
9. **Public Website Defacement (`pages` write):** Anonymous or non-admin user calling `setDoc(doc(db, 'pages', 'home'), ...)` -> `PERMISSION_DENIED`.
10. **Exam Ticket Enumeration (`exam_tickets` list):** Anonymous user calling `getDocs(collection(db, 'exam_tickets'))` -> `PERMISSION_DENIED`.
11. **Exam Ticket Unmasked TC / Short ID Poisoning:** Creating `/exam_tickets/123` (short guessable ID < 16 chars) or injecting `phone` shadow key -> `PERMISSION_DENIED`.
12. **Analytics Value Poisoning:** Updating `/traffic_daily/2026-11-19__s0` with `views: "1000000"` (string instead of int) or negative decrement `views: resource.data.views - 500` -> `PERMISSION_DENIED`.
