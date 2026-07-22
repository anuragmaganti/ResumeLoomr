# ResumeLoomr

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/loomr-logo-dark.png">
    <img src="public/loomr-logo-light.png" alt="ResumeLoomr" width="360">
  </picture>
</p>

ResumeLoomr is a local-first, AI-assisted resume builder for creating, importing, editing, previewing, syncing, and printing multiple resumes in one browser workspace.

The app uses a block-first resume model, IndexedDB as the working store, Firebase Auth and Firestore for account backup, Vercel API routes for secure server work, and Gemini-powered PDF, DOCX, and image import. Users can work without an account, then sign in when they want cloud backup, cross-device restore, or resume import.

## Features

### Resume Editing

- Edit a structured resume form while the live preview updates immediately.
- Click any editable text in the live preview to open the matching editor field.
- Drag sections, entries, and bullet points directly inside the live preview to reorder them.
- Drag sections in the editor rail and organize resume tiles or folders in the workspace rail with dnd-kit sortable interactions.
- Fresh empty resumes offer import or start-from-scratch; scratch resumes use Personal plus Education, Experience, Internships, Projects, and Skills, with render-only sample placeholders until real content is added.
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

### Block-First Data Model

- Every resume uses one canonical block model: `personal`, `settings`, and ordered `sections`.
- Fixed legacy arrays such as `experience`, `education`, `skills`, and `sectionOrder` are no longer the app model.
- Role sections share one implementation, so Experience, Internships, Leadership, Research, Teaching, Clinical Experience, Military Service, Volunteering, Campus Involvement, and Community Service all use the same editor and preview path.
- Imported resumes and manually created resumes are edited through the same section block forms.
- Custom imported headings can stay editable without forcing them into a rigid schema.
- Layout preferences live as resume or section metadata, so visual rearranging stays separate from ATS-friendly field data.

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
- Edits, imports, deletes, switches, reorders, and template/settings changes save locally before cloud sync is attempted.
- Local saves update the visible `Saved locally` timestamp from the actual local save time.
- Local drafts include `localRevision` metadata to prevent stale tab saves from overwriting newer local changes.
- IndexedDB remains canonical; `localStorage` keeps a best-effort compatibility mirror plus theme, browser-preference, and folder-open keys.
- Workspace organization is stored separately from resume bodies, so folder operations never rewrite resume content.
- On sign-out, users can clearly choose whether to keep local resumes editable on that browser or sync first and remove its local copies; neither choice deletes cloud resumes.

### Account Sync

- Firebase Auth provides Google and email/password sign-in.
- Firestore stores the cloud copy of each signed-in user’s workspace and resumes.
- Vercel API routes verify Firebase identity before reading or writing cloud data.
- Sync is background-only: UI actions never wait for Firestore to finish.
- A durable local outbox queues cloud operations for workspace updates, draft upserts, and deletes.
- Outbox acknowledgements are version-aware using `id`, `operationVersion`, and `localRevision`, so an old in-flight sync cannot clear a newer local edit.
- Accepted workspace operations determine folder placement without trusting browser wall clocks, preventing clock skew from blocking later cross-device organization changes.
- Sync operations are scoped to the signed-in Firebase account to avoid cross-account writes from shared browsers.
- A service worker requests Background Sync where supported; otherwise queued changes sync on reconnect or the next app open.
- Login always performs a safe local/cloud merge so existing browser resumes and cloud resumes are preserved instead of one side replacing the other.

### AI Resume Import

- Signed-in users can import existing resumes from PDF, DOCX, PNG, JPG, or JPEG.
- Guests see the same import action, but it opens the sign-in modal first.
- Files are sent to a secure Vercel API route; Gemini and Firebase Admin secrets are never exposed to the browser bundle.
- Readable PDFs are text-extracted first for lower latency and cost.
- Scanned or low-quality PDFs can fall back to Gemini document understanding.
- DOCX files are extracted server-side with Mammoth.
- PNG, JPG, and JPEG resume images are processed through Gemini image understanding, then compiled through the same source-first block pipeline.
- Gemini 3.1 Flash-Lite powers classification and mapping.
- The import pipeline is source-first: the server builds a source document model, classifies smaller chunks, compiles final ResumeLoomr section blocks, and preserves unmapped content as editable data instead of silently dropping it.
- Uploaded files and extracted text are processed in memory and are not stored by the import API.

## How The App Works

ResumeLoomr is intentionally local-first:

1. The user edits a resume in React state.
2. The active draft is saved to IndexedDB with a fresh `savedAt` timestamp and `localRevision`.
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
  localRevision
}
```

The core local storage concept is:

```text
IndexedDB
workspace       current resume ids, active resume, names, ordering
drafts          one normalized draft per resume
outbox          queued cloud sync operations
tombstones      pending cloud deletes
accountBinding  browser/account connection metadata
```

The workspace record also carries normalized root items, folders, folder membership, stable folder colors, and removed-folder tombstones. Resume drafts remain independent records.

## Key Decisions

- **Local first, cloud second:** the editor remains usable even if the network, Firebase, or Vercel sync is unavailable.
- **Firestore is a mirror:** Firestore is for backup and cross-device restore, not the source that blocks editing.
- **Block-first schema:** flexible ordered sections make imports, custom headings, internships, research, leadership, and future section types easier to support.
- **Source-first AI import:** the importer preserves source order and content by compiling from a detected source document instead of asking the AI to produce the final app schema in one large response.
- **Server-only secrets:** Gemini and Firebase Admin credentials live only in Vercel/server environments.
- **Versioned sync acknowledgements:** stale cloud responses cannot clear newer local outbox work.
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
src/lib/             Resume model, IndexedDB workspace, sync client, import client
src/styles/          Form, button, and resume preview styles
tests/               Node tests and Firestore rules tests
```

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm
- Firebase project for auth/cloud sync
- Gemini API key for resume import
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

Use Vercel’s local runtime for signed-in sync and resume import:

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
- Preview model rendering, sample resumes, separator settings, and print presentation variables
- Saved-local timestamp behavior
- Local/cloud login merge, clock-skew handling, and durable folder deletion behavior
- Account-scoped sync operations
- Versioned outbox acknowledgements
- AI import file validation and source-document compilation
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
- Resume import requires sign-in.
- Gemini and Firebase Admin credentials are server-only.
- Firestore rules restrict users to their own workspace and resume documents.
- Sync API routes verify Firebase identity server-side before cloud reads/writes.
- Firebase App Check can attest Firebase SDK traffic when enforcement is enabled; custom Vercel APIs use separately verified Firebase ID tokens or HTTP-only session cookies.
- Uploaded resume files are processed in memory by the import route and are not intentionally stored server-side.
- Users can remove the account connection and local resume copies from browser settings.
- On shared computers, users should disable keeping resumes available after sign out or clear the browser connection.

## Deployment

ResumeLoomr is built for Vercel:

- Frontend: Vite static build
- Server work: Vercel API routes
- Auth/database: Firebase Auth and Firestore
- AI import: Gemini API called from the server only
- Sync worker: static service worker in `public/sync-worker.js`

Firestore rules are deployed separately:

```bash
npx firebase-tools deploy --only firestore:rules --project resumeloomr
```

## Status

The app is currently optimized around a block-first model, direct preview editing/reordering, organized multi-resume workspaces, local-first IndexedDB persistence, Firebase-backed account sync, and source-first Gemini resume import.
