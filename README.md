# ResumeLoomr

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/loomr-logo-dark.png">
    <img src="public/loomr-logo-light.png" alt="ResumeLoomr" width="360">
  </picture>
</p>

ResumeLoomr is a block-based, local-first resume builder with Firebase Auth, IndexedDB persistence, optional Firestore cloud sync, Gemini-powered PDF/DOCX resume import, live preview, and multi-resume workspaces.

It is designed for people who want a fast resume editor that works immediately in the browser, supports imported resumes, and can sync across devices when they choose to sign in.

## Features

### Live Resume Builder

- Edit resume content in a structured editor while the resume preview updates immediately.
- Click text in the live preview to jump directly to the matching editor field.
- Print or save the active resume from the browser using print-optimized styling.
- Use light and dark UI themes without changing the printed resume output.

### Block-Based Resume Model

- Every resume is stored as ordered section blocks instead of a rigid fixed schema.
- Personal details stay first; every other section is a movable block.
- Supported block types include education, roles, skills, projects, certifications, languages, awards, publications, and custom sections.
- Role-based sections can represent experience, internships, research, teaching, leadership, volunteering, clinical experience, military service, community service, and similar resume categories.
- Users can add, rename, remove, and reorder sections from the editor rail.

### Multi-Resume Workspace

- Create, rename, duplicate, delete, reorder, and switch between multiple resumes.
- Resume tabs live in a dedicated rail so users can keep several versions, such as role-specific or no-skills variants.
- Each resume keeps its own content, section order, template, and presentation settings.

### Local-First Storage

- The browser is the immediate source of truth while editing.
- Resume drafts are persisted locally with IndexedDB.
- UI actions such as editing, switching resumes, importing, deleting, and reordering are designed to happen locally first instead of waiting on the network.
- Local data remains available for signed-out users unless they choose to clear this browser.

### Optional Account Sync

- Firebase Auth supports account-based sync.
- Firestore stores a cloud copy of the user workspace for cross-device access.
- Background sync mirrors local changes to the cloud when a user is signed in.
- Browser settings let users control whether resumes remain available after sign out, which matters on shared computers.

### Gemini-Powered Resume Import

- Signed-in users can import an existing resume from PDF or DOCX.
- Readable PDFs are text-extracted first for speed and lower cost.
- Scanned or low-quality PDFs can fall back to Gemini document understanding.
- DOCX files are extracted server-side with Mammoth.
- Gemini 3.1 Flash-Lite is used through a secure Vercel API route; the API key is never exposed to the client.
- The import pipeline is source-first: it segments the uploaded resume into source sections, classifies those sections, then compiles them into editable ResumeLoomr blocks.

### Presentation Controls

- Choose between professional resume templates.
- Adjust text size, horizontal margins, vertical margins, line spacing, section spacing, entry spacing, heading size, and name size.
- Live preview and print output use the same presentation settings.

## How It Works

ResumeLoomr uses a local-first architecture:

1. The user edits a resume in React state.
2. Changes are saved into IndexedDB as the durable local workspace.
3. If the user is signed in, sync work is queued in a local outbox.
4. A Vercel API verifies the user session and writes the latest workspace and resume drafts to Firestore.
5. On login from another browser, cloud resumes are merged into the local workspace rather than replacing local work.

The core resume shape is intentionally simple:

```js
{
  resume: {
    personal,
    settings,
    sections: [
      { id, kind, title, entries }
    ]
  },
  template,
  savedAt,
  localRevision
}
```

This model makes imported resumes, manually created resumes, custom sections, reordered sections, and future resume categories use the same editor and preview path.

## Key Product Decisions

- **Local-first editing:** editing should feel instant and should not fail just because the network is unavailable.
- **Cloud as a mirror:** Firestore is used for backup and cross-device sync, not as the click-path source of truth.
- **Block-first data model:** sections are flexible blocks so resumes can represent internships, leadership, research, publications, custom imported headings, and future categories without schema rewrites.
- **Secure AI import:** Gemini runs only on the server through Vercel API routes. Uploaded files and extracted text are processed in memory and are not stored server-side.
- **Source-first import parsing:** the importer preserves source order and content by compiling from a source document model instead of asking the AI to generate the final app draft in one large response.

## Tech Stack

- React 19
- Vite
- JavaScript
- CSS modules by convention through app stylesheets
- IndexedDB via `idb`
- Firebase Auth
- Firestore
- Firebase Admin for server-side sync/auth verification
- Gemini API through `@google/genai`
- Mammoth for DOCX text extraction
- pdf-parse for readable PDF text extraction
- dnd-kit for drag-and-drop ordering
- Zod for server-side request and AI response validation
- Vercel API routes for secure server work

## Project Structure

```text
api/                 Vercel API routes for import and sync
server/              Server-only Firebase and Gemini helpers
public/              Icons, logo assets, and sync worker
src/components/      React UI components and editor forms
src/hooks/           App-level resume builder and auth hooks
src/lib/             Resume model, local storage, sync, Firebase, and import clients
src/styles/          Shared button, form, and preview styling
tests/               Node tests and Firestore rules tests
```

## Getting Started

### Prerequisites

- Node.js LTS
- npm
- Firebase project if you want auth/cloud sync
- Gemini API key if you want resume import

### Install

```bash
npm install
```

### Run The Frontend

```bash
npm run dev
```

The app can run in local-only mode without Firebase or Gemini environment variables.

### Run With API Routes

For import and server-backed sync flows, use Vercel’s local runtime:

```bash
npx vercel dev
```

## Environment Variables

Client-side Firebase values are public app configuration and must be prefixed with `VITE_`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
```

Server-only values must not use the `VITE_` prefix:

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
npm run lint     # Run ESLint
npm test         # Run Node tests
```

## Testing

The project includes tests for:

- Block-first resume normalization and editing helpers
- Section creation, ordering, and validation
- Local/cloud workspace merge behavior
- AI import file validation and source-document compilation
- Gemini request configuration
- Firestore Security Rules through the emulator

Run the main test suite:

```bash
npm test
```

Run Firestore rules tests with the emulator:

```bash
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npx firebase-tools emulators:exec --only firestore --project resumeloomr "npm test"
```

## Security And Privacy Notes

- Gemini and Firebase Admin secrets are server-only.
- Resume import requires sign-in.
- Firestore rules restrict users to their own workspace and resume documents.
- The app is designed so unsigned users can keep working locally without creating an account.
- Users can clear the browser connection and local resume copies from settings.

## Deployment

The app is built for Vercel:

- Frontend: Vite static build
- Server work: Vercel API routes
- Auth/database: Firebase Auth and Firestore
- AI import: Gemini API called from the server only

Firestore rules are deployed separately:

```bash
npx firebase-tools deploy --only firestore:rules --project resumeloomr
```

## Current Focus

ResumeLoomr is moving toward a simpler, fully block-first editing system with a smaller codebase, stronger import accuracy, and a cleaner local-first sync model.
