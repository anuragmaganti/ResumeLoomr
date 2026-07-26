# Attached Cover Letters Implementation Plan

## Objective

Add first-class cover letters attached to resumes. Guests edit offline, signed-in users sync in the background, and login/account switching merges without data loss. Letters reuse appropriate editor/preview interactions but remain separate drafts so revisions, conflicts, deletes, and cloud acknowledgements cannot cross document IDs.

## Product Contract

- Entry points:
  - Add **Add a cover letter** to the blank resume's **How would you like to start?** choices.
  - Add **Add/Open/Delete cover letter** to each resume's `...` menu.
  - Rename import everywhere to **Import resume and/or cover letter**.
- An attached letter adds a square switcher left of `...`; its icon/tooltip show the destination (letter from resume, resume from letter) without changing folder or resume selection.
- Initial UI creates one primary letter per resume. The model permits extra IDs; the resume `...` menu lists conflict copies so none are discarded or inaccessible.
- Creating/editing a letter works signed out and offline. AI import remains signed-in-only.
- Deleting a letter leaves its resume. Deleting a resume atomically deletes/tombstones attached letters and reports that in confirmation copy.
- `Duplicate resume` continues duplicating only the resume; package duplication is out of scope.
- Templates, in order:
  1. **Compact**: dense, one-page-first, matching Compact resumes.
  2. **Executive**: formal, left-aligned, matching Executive resumes.
  3. **Modern**: restrained single-column alternative.
- Use real miniature previews and preselect the attached resume's matching template, otherwise Compact.
- All templates keep one semantic reading order and ATS-safe selectable text. Use [Resume.com](https://support.resume.com/hc/en-us/articles/360060444552-How-do-I-create-a-cover-letter), [Microsoft](https://word.cloud.microsoft/create/en/blog/cover-letter-format/), [Novoresume](https://novoresume.com/cover-letter-maker), and [Jobscan](https://www.jobscan.co/cover-letter-templates) only as layout/content references.

## Data Contracts

Extend the workspace without changing resume organization:

```js
coverLetters: {
  version: 1,
  updatedAt,
  orderByResumeId: { [resumeId]: [coverLetterId] },
  meta: { [coverLetterId]: { id, resumeId, name, updatedAt } },
  removedIds: []
}
```

Invariants:

- Every letter has one stable ID, one existing parent resume, and one registry placement.
- Removed IDs beat stale metadata; malformed/orphaned data is recovered visibly, never silently reassigned or dropped.
- Resume conflict copies receive the letters from the same merge side.

Use a dedicated block-first draft:

```js
{
  coverLetter: {
    resumeId,
    sender: { mode: 'resume' | 'custom', overrides: {} },
    recipient: { date, hiringManagerName, hiringManagerTitle, company, addressLines: [] },
    greeting,
    bodyBlocks: [
      { id, kind: 'paragraph', role: 'opening' | 'evidence' | 'closing', text },
      { id, kind: 'bulletList', items: [{ id, text }] }
    ],
    signOff,
    signatureName,
    sampleDisplay,
    settings: { horizontalMargins, verticalMargins, textSize, lineGap, paragraphGap, nameSize }
  },
  template: 'compact' | 'executive' | 'modern',
  savedAt,
  localRevision,
  cloudVersion
}
```

Model rules:

- Store structured plain text, never HTML or `contentEditable` output.
- Stable IDs identify reorderable blocks/bullets.
- Linked sender values resolve at render time from resume fields: name, headline, location, phone, email, LinkedIn, GitHub, portfolio/website, and custom field. Explicit overrides win, including intentional blanks.
- `signatureName` falls back to the linked name until explicitly overridden.
- Default/blank metadata does not count as real content.
- Resume and cover-letter schema versions remain independent.

## Persistence, Sync, And Accounts

- Upgrade IndexedDB to version 2 and add `coverLetterDrafts` and `coverLetterTombstones`; add the same stores/version to `public/sync-worker.js`. Existing resume stores are untouched.
- Add localStorage fallback mirrors, while IndexedDB remains canonical.
- Every save targets an exact loaded identity:

```js
{ type: 'resume' | 'coverLetter', documentId, resumeId, localRevision }
```

- Autosave, page lifecycle, switching, printing, import, and delete read current refs for that identity, never the active tile ID.
- Serialize writes through the existing local mutation queue/browser lock and apply the same stale-revision guard used by resume drafts.
- Add outbox operations `upsertCoverLetter` and `deleteCoverLetter`; upserts carry `operationVersion`, `localRevision`, and `baseCloudVersion`, and acknowledgements match the exact sent version. Old/stale responses cannot clear or mark newer rows.
- Store cloud documents at `users/{uid}/coverLetters/{id}` and `users/{uid}/coverLetterTombstones/{id}`. Validate IDs, parent ownership, field lengths, and payload limits server-side. Browser code still never writes Firestore directly.
- Extend Firestore rules/tests so owners may read these collections while all browser writes remain denied.
- The workspace document stores only attachment metadata. Cover-letter body edits sync only the letter, not the workspace.
- Bump the cloud workspace schema. Server merge must preserve the cloud registry when old clients omit it; an explicit versioned empty registry remains intentional.
- Old-client resume deletion must derive letter tombstones server-side so invisible attachments cannot survive or resurrect.
- Merge resumes first, then letters using final resume-ID mappings. Same hash dedupes; same ID/different content preserves the older side as an attached conflict copy; local tombstones prevent resurrection.
- Cloud pull failure stops login bootstrap from uploading local/blank replacements.
- Sign-in merges local and cloud before account binding. Sign-out keep/remove choices, account-switch Import/Clear, browser-data removal, and outbox UID scoping must include both document types.
- Active resume/letter view is bounded browser-only state and is not cloud-synced.

## Import Resume And/Or Cover Letter

The import dialog has two optional labelled slots: **Resume** and **Cover letter**. At least one is required. Each accepts one PDF, DOCX, PNG, JPG, or JPEG up to 3 MB.

- Resume only creates a new resume.
- Cover letter only attaches to a clearly shown target resume, defaulting to the active one.
- Both create a new resume with the imported letter attached.
- If a target already has a letter, require another target or explicit replacement; never overwrite silently.
- The submit label becomes **Import resume**, **Import cover letter**, or **Import both**.

Generalize the server to `/api/import-document` with explicit `documentKind`; keep `/api/import-resume` as a rollout compatibility wrapper. Send one file per authenticated request, so paired imports do not combine two base64 payloads.

- Keep existing resume PDF/DOCX/image extraction and compiler behavior unchanged.
- Cover-letter input uses the same source-first strategy but a separate `CoverLetterSourceDocument`: sender/contact lines, date, recipient/company/address, greeting, ordered paragraphs/bullets, sign-off, signature.
- Gemini transcribes/classifies source structure; a deterministic compiler creates the canonical draft and preserves uncertain text as editable blocks with warnings.
- Detect strong resume-vs-letter mismatches and require confirmation instead of silently swapping document kinds or compiling obvious nonsense.
- Keep detailed diagnostics server-only. Uploaded bytes and API keys are never persisted or exposed.

For paired import, parse both into transient memory, verify the captured account UID, then perform one serialized IndexedDB transaction that writes registry/workspace data, both drafts, and exact outbox rows. No visible placeholder is created before parsing. If one request fails, offer retry, import the successful file only, or cancel; never silently commit half.

Shared-field reconciliation:

- New letters link to resume sender fields automatically, so a resume named Anurag immediately creates a letter showing Anurag.
- Paired import links matching/resume-only values, may backfill fields missing from the new resume, and stores conflicting letter values as explicit overrides with a warning.
- Cover-letter-only import never mutates an existing resume; missing/conflicting source values become letter overrides.
- Later linked resume edits update rendered/printed letter fields without rewriting the letter draft.

## Editor, Preview, And Print

- Keep the resume/folder rail visible; replace only document-specific navigation, editor, settings, and preview.
- Cover-letter editor groups: **Sender**, **Recipient**, **Letter**, **Closing**.
- Add dedicated cover-letter model/forms/preview. Share infrastructure through document adapters only where behavior is genuinely common.
- Reuse exact click-to-caret, mobile/tablet proxy editing, editor-only scrolling, hover pulse, preview scaling, margins, page markers, save status, responsive behavior, and print cleanup.
- Allow drag reorder only for body blocks and bullets within their list. Sender, recipient, greeting, closing, and signature retain conventional fixed order.
- Do not show resume section controls, header-slot layout, summary controls, or resume separators in letter mode.
- Print US Letter with selectable text in sender -> recipient/date -> greeting -> body -> closing -> signature order. Never print controls, samples, carets, or drag chrome. Warn around 400 words but never truncate or fake one-page output.

## Visual And Interaction Contract

- Reuse current tokens/primitives for surfaces, borders, radii, typography, spacing, controls, dialogs, toasts, focus, themes, and reduced motion; no separate letter theme.
- Preserve the shell, folder/resume rail geometry, breakpoints, and resume mode pixel-for-pixel. The switcher fits the tile action area without shifting the checkbox or `...` and has tooltip, pressed, and active states.
- Letter navigation/settings use the same rails, replacing resume controls in place. Switching restores each document's group, caret, and scroll without a layout jump.
- Label sender values **Linked to resume** or **Custom override**, show the resolved value, and allow **Reset to resume**; linked fields must not look disabled.
- Reuse portal dialogs. Import uses a compact desktop grid/mobile stack with inline per-file progress/error and one primary action.
- Reuse preview paper and interaction chrome. Hover actions need focus/touch equivalents and 44px targets. Namespace letter CSS, reuse motion timing, and suppress initial-load animation.

## Fictional Sample Letters

Add one render-only letter for every existing sample ID: Erlich Bachman, Michael Scott, Daenerys Targaryen, Squidward Tentacles, Dwight Schrute, Jake Peralta, Saul Goodman, Helly R., and Tony Stark.

- Select by the parent resume ID through the existing character selector; never hash the letter independently. Tony Stark's resume always gets Tony Stark's letter.
- Research each character one at a time from official HBO/NBC/Warner Bros./Nickelodeon/AMC/Apple/Marvel sources. Keep claims consistent with the existing sample resume, original rather than quoted, lore-accurate, and under one page.
- Match current sample semantics: preview-only text, editor placeholders, transient sample-only controls, mixed real/sample rendering, sample block/bullet ordering metadata, show/hide, permanent dismissal, and print suppression.
- Real linked resume fields override fictional sender placeholders. Parent resume sample dismissal prevents an attached letter from resurrecting samples; letter-only dismissal does not alter the resume.
- Fictional text never enters drafts, hashes, IndexedDB, localStorage, outbox, Firestore, print, or export.

## Implementation Order

1. Add pure letter/workspace models, linked sender resolution, hashing, validation, and conflict/cascade helpers.
2. Add IndexedDB/service-worker stores, local mutations, outbox operations, cloud documents, backward-compatible workspace merge, and account reconciliation.
3. Add exact active-document state and lifecycle-safe load/save/switch behavior.
4. Add creation flows, rail switcher/menu actions, template chooser, deletion, and conflict-copy access.
5. Build editor, preview, shared interaction adapters, drag scope, and print output.
6. Generalize import, add atomic single/paired commit, then regression-check existing resume import fixtures.
7. Research/add all nine samples and sample projection behavior.
8. Run crucial verification before merge.

## Crucial Verification

Do not add Playwright coverage or a broad manual matrix for this feature. Keep tests focused on data loss and regressions:

- Normalize registry/drafts; enforce one parent/placement; preserve conflict copies and cascade deletes.
- Verify stale local writes and stale sync acknowledgements cannot affect newer resume or letter operations.
- Verify IndexedDB upgrade preserves all existing resume, folder, outbox, tombstone, and account-binding data; app/worker schemas match.
- Verify signed-out edits, login merge, account switching, offline reconnect, second-browser restore, and old-client workspace writes preserve attachments.
- Verify paired import commits both documents or neither, account changes discard staged results, and replacement cannot delete the old letter before the new write succeeds.
- Re-run current readable/scanned PDF, DOCX, PNG, and JPEG resume import fixtures; add representative cover-letter fixtures for each extraction path.
- Verify shared-field matching/conflicts and that linked resume edits do not enqueue letter/workspace writes.
- Verify every sample ID has one letter and fictional text cannot serialize or print.
- Verify print reading order and sample/control suppression with component/DOM tests.
- Run `npm run verify` and the focused Firestore emulator rules test for the new collections; no Playwright suite or broad manual matrix.

## Acceptance Criteria

- Resume and letter saves, revisions, tombstones, and acknowledgements cannot target each other's IDs.
- Guest, signed-in, offline, reconnect, sign-out, login merge, and account-switch flows preserve both document types without silent loss.
- Resume-only, letter-only, and paired imports are account-safe and locally atomic.
- Linked sender fields update automatically without duplicate storage; conflicts remain recoverable overrides.
- All three templates are ATS-safe and all nine sample pairs remain render-only and character-consistent.
- Existing resume editing, folders, drag/drop, samples, import output, sync, and print behavior do not regress.

## Non-Goals

- AI-written letter copy, job-description analysis/scoring, email/application submission, job tracking, arbitrary rich text, nested attachments, or attaching one letter to multiple resumes.
