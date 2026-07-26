# ResumeLoomr

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/loomr-logo-dark.png">
    <img src="public/loomr-logo-light.png" alt="ResumeLoomr" width="360">
  </picture>
</p>

ResumeLoomr is a local-first, AI-assisted workspace for creating, importing, editing, organizing, syncing, and printing resumes with attached cover letters.

The app uses block-first document models, IndexedDB as the working store, Firebase Auth and Firestore for account backup, Vercel API routes for secure server work, and Gemini-powered PDF, DOCX, and image import. Users can work without an account, then sign in for cloud backup, cross-device restore, or resume and cover-letter import.

## Features

### Resume Editing

- Edit a structured resume form while the live preview updates immediately.
- Click any editable text in the live preview to open the matching editor field.
- Drag sections, entries, and bullet points directly inside the live preview to reorder them.
- Drag sections in the editor rail and organize resume tiles or folders in the workspace rail with dnd-kit sortable interactions.
- Fresh empty resumes offer document import, start-from-scratch, or an attached cover letter; scratch resumes use Personal plus Education, Experience, Internships, Projects, and Skills, with render-only sample placeholders until real content is added.
- Add repeatable sections such as Research, Teaching, Leadership, Volunteering, Certifications, Languages, Awards, Publications, Presentations, Patents, Professional Affiliations, and custom sections.
- Rename section titles inline, including temporarily blank names that fall back to an untitled section label on blur.
- Collapse and expand repeated entry cards for dense editing.

### Live Preview And Print

- Preview uses the same data and presentation settings as print output.
- Print/Save uses browser print output with resume-specific document title naming.
- The live preview supports hover affordances, click-to-edit, drag-to-reorder, entry header layout editing, margin controls, and separator controls without printing helper UI.
- `Full page` preview scales a Letter-size page to the visible workspace while print output remains physical page size.
- Personal details stay first; every other section is ordered by the resume’s section block list.
- Personal contact order, headline/contact order, compact summary width, entry header layout, and separator styling can be adjusted directly from the preview while field data stays structured.
- Fictional sample information remains render-only, can be reordered safely, and can be permanently dismissed per resume without entering saved resume fields.
- Page margins can be adjusted directly from the preview; text size, line gap, entry gap, heading size, and name size remain in the compact settings rail.
- Two print templates are available today: `Compact` as the default and `Executive` as an alternate layout.

### Attached Cover Letters

- Add or open a cover letter from a resume tile, then switch between the two documents without changing resume or folder placement.
- Sender fields link to the attached resume at render time, while intentional cover-letter overrides remain independent.
- Edit Sender, Recipient, Letter, and Closing groups with the same exact preview click-to-caret and local-first save behavior as resumes.
- Reorder body paragraphs and bullet points directly in the preview while recipient, greeting, and signature order stays conventional and ATS-safe.
- Choose `Compact`, `Executive`, or `Modern` cover-letter templates with selectable print text and physical Letter output.
- Fictional sample letters match their parent sample resumes but remain render-only; deleting a letter keeps its resume, while deleting a resume removes its attachments.

### Block-First Data Model

- Every resume uses one canonical block model: `personal`, `settings`, and ordered `sections`.
- Fixed legacy arrays such as `experience`, `education`, `skills`, and `sectionOrder` are no longer the app model.
- Role sections share one implementation, so Experience, Internships, Leadership, Research, Teaching, Clinical Experience, Military Service, Volunteering, Campus Involvement, and Community Service all use the same editor and preview path.
- Imported resumes and manually created resumes are edited through the same section block forms.
- Custom imported headings can stay editable without forcing them into a rigid schema.
- Layout preferences live as resume or section metadata, so visual rearranging stays separate from ATS-friendly field data.
- Cover letters use separate block-first drafts and attach through workspace metadata, so letter revisions, conflicts, and deletes cannot target resume bodies.

### Multi-Resume Workspace

- Create, rename, duplicate, delete, reorder, and switch between resumes.
- Select multiple resumes to batch-delete them or place them into a new folder; the workspace always retains at least one resume.
- Folders expand inline inside the wrapping rail, support multiple open folders, and allow resume movement within, into, or out of folders.
- Removing a folder ungroups its resumes instead of deleting them; deleted folder identities remain tombstoned so stale browsers cannot restore them.
- Resume and folder order, membership, names, and colors persist locally and through cloud sync.
- A single browser workspace supports up to `100` resumes.
- Each resume keeps its own content, ordered section blocks, template, and presentation settings.

### Local-First Persistence

- The browser’s IndexedDB workspace is the immediate source of truth.
- Resume and cover-letter edits, imports, deletes, switches, reorders, and settings changes save locally before cloud sync is attempted.
- Local saves update the visible `Saved locally` timestamp from the actual local save time.
- Local drafts include `localRevision` metadata to prevent stale tab saves from overwriting newer local changes.
- IndexedDB remains canonical; `localStorage` keeps a best-effort compatibility mirror plus theme, browser-preference, and folder-open keys.
- Workspace organization and cover-letter attachment metadata are stored separately from document bodies, so organization changes never rewrite content.
- On sign-out, users can clearly choose whether to keep local resumes editable on that browser or sync first and remove its local copies; neither choice deletes cloud resumes.

### Account Sync

- Firebase Auth provides Google and email/password sign-in.
- Firestore stores separate cloud copies of each signed-in user’s workspace, resumes, and cover letters.
- Vercel API routes verify Firebase identity before reading or writing cloud data.
- Sync is background-only: UI actions never wait for Firestore to finish.
- A durable local outbox queues document-specific workspace, resume, cover-letter, and delete operations.
- Outbox acknowledgements are version-aware using `id`, `operationVersion`, and `localRevision`, so an old in-flight sync cannot clear a newer local edit.
- Accepted workspace operations determine folder placement without trusting browser wall clocks, preventing clock skew from blocking later cross-device organization changes.
- Sync operations are scoped to the signed-in Firebase account to avoid cross-account writes from shared browsers.
- A service worker requests Background Sync where supported; otherwise queued changes sync on reconnect or the next app open.
- Login safely merges local and cloud resumes, attachments, and conflict copies instead of letting either side replace the other.

### AI Document Import

- Signed-in users can import a resume, a cover letter, or both from PDF, DOCX, PNG, JPG, or JPEG.
- Guests see the same import action, but it opens the sign-in modal first.
- Files are sent to a secure Vercel API route; Gemini and Firebase Admin secrets are never exposed to the browser bundle.
- Readable PDFs are text-extracted first for lower latency and cost.
- Scanned or low-quality PDFs can fall back to Gemini document understanding.
- DOCX files are extracted server-side with Mammoth.
- PNG, JPG, and JPEG images are processed through Gemini image understanding.
- Gemini 3.1 Flash-Lite powers classification and mapping.
- Resume and cover-letter imports use separate source-document compilers, preserving document order and uncertain content as editable data instead of silently dropping it.
- Paired imports reconcile shared sender fields and commit the new resume, attachment metadata, and cover letter in one local transaction.
- Uploaded files and extracted text are processed in memory and are not stored by the import API.

## How The App Works

ResumeLoomr is intentionally local-first:

1. The user edits a resume or attached cover letter in React state.
2. The exact active document is saved to IndexedDB with a fresh `savedAt` timestamp and `localRevision`.
3. If signed in, the local save also queues an outbox operation.
4. A debounced foreground sync, service worker sync, or next app session sends the outbox to `/api/sync-workspace`.
5. The Vercel API verifies the Firebase user and writes valid operations to Firestore.
6. Firestore responds with exact operation acknowledgements.
7. The browser clears only the exact outbox versions that were acknowledged.

The core draft shape is:

```js
{
  resume: {
    personal,
    settings,
    sampleDisplay,
    sections: [
      { id, kind, title, entries, entryHeaderLayout }
    ]
  },
  template,
  savedAt,
  localRevision,
  cloudVersion
}
```

Cover letters are independent drafts attached by stable IDs:

```js
{
  coverLetter: { resumeId, sender, recipient, greeting, bodyBlocks, signOff, signatureName, settings },
  template, savedAt, localRevision, cloudVersion
}
```

The core local storage concept is:

```text
IndexedDB
workspace       current resume ids, active resume, names, ordering
drafts          one normalized draft per resume
coverLetterDrafts one normalized draft per attached cover letter
outbox          queued cloud sync operations
tombstones      pending cloud deletes
coverLetterTombstones pending attachment deletes
accountBinding  browser/account connection metadata
```

The workspace record carries folders, ordering, stable folder colors, removal tombstones, and cover-letter attachment metadata. Resume and cover-letter drafts remain independent records.

## Key Decisions

- **Local first, cloud second:** the editor remains usable even if the network, Firebase, or Vercel sync is unavailable.
- **Firestore is a mirror:** Firestore is for backup and cross-device restore, not the source that blocks editing.
- **Block-first schema:** flexible ordered sections make imports, custom headings, internships, research, leadership, and future section types easier to support.
- **Source-first AI import:** the importer preserves source order and content by compiling from a detected source document instead of asking the AI to produce the final app schema in one large response.
- **Server-only secrets:** Gemini and Firebase Admin credentials live only in Vercel/server environments.
- **Versioned sync acknowledgements:** stale cloud responses cannot clear newer local outbox work.
- **Independent document identities:** resume and cover-letter revisions, tombstones, conflicts, and acknowledgements cannot cross document IDs.
- **Linked sender data:** resume contact edits flow into attached letters without duplicating or rewriting letter drafts; explicit overrides still win.
- **Organization without content rewrites:** folders and rail order sync as workspace metadata rather than rewriting resume drafts.
- **No trusted-device Firestore cache mode:** the app no longer relies on Firestore’s browser cache for correctness; IndexedDB is the durable local workspace.
- **Enforced dependency direction:** domain and infrastructure modules stay independent of React UI, and hooks cannot import components; the architecture check rejects cycles, unreachable production modules, and boundary violations.

## Tech Stack

- React 19
- Vite
- JavaScript
- Plain CSS stylesheets
- dnd-kit for sortable resume rails, section rails, and preview reordering
- Motion for position-only folder expansion and rail layout transitions
- IndexedDB via `idb`
- Firebase Auth
- Firestore
- Firebase Admin for server-side auth verification and cloud writes
- Vercel API routes for sync sessions, workspace sync, and AI import
- Gemini API through `@google/genai`
- Mammoth for DOCX extraction
- pdf-parse for readable PDF extraction
- Zod for server-side validation
- Vercel Analytics

## Project Structure

```text
api/                 Vercel API routes for import, sync sessions, and workspace sync
server/              Server-only Firebase Admin and Gemini import helpers
public/              Logos, favicon assets, and sync worker
src/components/      React UI components, rails, preview, and editor forms
src/hooks/           Resume builder and Firebase auth hooks
src/lib/             Resume and cover-letter models, IndexedDB workspace, sync and import clients
src/styles/          Form, button, and resume preview styles
tests/               Node tests and Firestore rules tests
```

## Getting Started

### Prerequisites

- Node.js 22.13 or newer
- npm
- Firebase project for auth/cloud sync
- Gemini API key for document import
- Java installed locally if you want to run Firestore emulator tests

### Install

```bash
npm install
```

### Run The Frontend

```bash
npm run dev
```

The frontend can run in local-only mode without Firebase or Gemini environment variables.

### Run With API Routes

Use Vercel’s local runtime for signed-in sync and document import:

```bash
npx vercel dev
```

## Environment Variables

Client-side Firebase config is public app configuration and must use `VITE_`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
```

Server-only variables must not use `VITE_`:

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_THINKING_LEVEL=medium
GEMINI_MAX_OUTPUT_TOKENS=20000
FIREBASE_SERVICE_ACCOUNT_JSON=
```

## Scripts

```bash
npm run dev      # Start the Vite dev server
npm run build    # Build the production frontend
npm run preview  # Preview the production build locally
npm run check:dead-code # Reject unused files, exports, and dependencies
npm run lint     # Run ESLint
npm test         # Run Node tests
npm run verify   # Run architecture, dead-code, lint, tests, audit, and build
```

## Testing

The test suite covers:

- Block-first resume normalization and editing helpers
- Section creation, renaming, ordering, deletion, and validation
- Multi-resume selection, folder organization, cross-container movement, and guarded batch deletion
- Cover-letter normalization, linked sender resolution, attachment conflicts, and cascade deletion
- Preview model rendering, sample resumes, separator settings, and print presentation variables
- Saved-local timestamp behavior
- Local/cloud login merge, clock-skew handling, and durable folder deletion behavior
- Account-scoped sync operations
- Versioned outbox acknowledgements
- Resume and cover-letter import validation and source-document compilation
- Gemini request configuration
- Firestore Security Rules through the emulator

Run the main test suite:

```bash
npm test
```

Run Firestore rules tests with the emulator:

```bash
npx --yes firebase-tools@15.24.0 emulators:exec --only firestore --project resumeloomr-test \
  "node --test --test-concurrency=1 tests/firestore.rules.test.js"
```

## Security And Privacy Notes

- Unsigned users can create and edit resumes locally without an account.
- Signed-in users sync through Firebase Auth and Firestore.
- Resume and cover-letter import requires sign-in.
- Gemini and Firebase Admin credentials are server-only.
- Firestore rules restrict users to their own workspace, resume, and cover-letter documents.
- Sync API routes verify Firebase identity server-side before cloud reads/writes.
- Firebase App Check can attest Firebase SDK traffic when enforcement is enabled; custom Vercel APIs use separately verified Firebase ID tokens or HTTP-only session cookies.
- Uploaded resume and cover-letter files are processed in memory and are not intentionally stored server-side.
- Users can remove the account connection and local resume copies from browser settings.
- On shared computers, users should disable keeping resumes available after sign out or clear the browser connection.

## Deployment

ResumeLoomr is built for Vercel:

- Frontend: Vite static build
- Server work: Vercel API routes
- Auth/database: Firebase Auth and Firestore
- AI import: Gemini API called from the server for resumes and cover letters
- Sync worker: static service worker in `public/sync-worker.js`

Firestore rules are deployed separately:

```bash
npx firebase-tools deploy --only firestore:rules --project resumeloomr
```

## Status

The app is currently optimized around block-first resumes and cover letters, direct preview editing/reordering, organized multi-resume workspaces, local-first IndexedDB persistence, Firebase-backed account sync, and source-first document import.
