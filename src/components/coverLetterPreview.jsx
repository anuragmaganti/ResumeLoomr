import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS as DndCss } from '@dnd-kit/utilities';

import MobilePreviewEditorProxy from './mobilePreviewEditorProxy.jsx';
import {
  PreviewMarginControls,
  PreviewPageMarkers,
  SampleInformationToggle,
} from './resumePreviewControls.jsx';
import {
  useResumePreviewPageMetrics,
  useResumePrintPageRule,
} from './useResumePreviewLayout.js';
import { useMobilePreviewEditor } from './useMobilePreviewEditor.js';
import { isMobilePreviewEditingViewport } from './resumePreviewGeometry.js';
import {
  coverLetterHasContent,
  getCoverLetterPresentationVars,
  getCoverLetterPrintPageRule,
} from '../lib/coverLetter.js';
import {
  coverLetterAddressPath,
  coverLetterBodyPath,
  coverLetterBulletPath,
  coverLetterRecipientPath,
  coverLetterSenderPath,
  coverLetterSimplePath,
  getCoverLetterTargetInputMode,
  getCoverLetterTargetLabel,
  isCoverLetterTargetMultiline,
  parseCoverLetterTargetPath,
  readCoverLetterTargetValue,
} from '../lib/coverLetterEditorTargets.js';
import { getPreviewCaretOffsetFromPoint } from '../lib/editorTargets.js';
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from '../lib/sortableSensors.js';

function blockDragId(blockId) {
  return `cover-letter-block:${blockId}`;
}

function bulletDragId(blockId, itemId) {
  return `cover-letter-bullet:${blockId}:${itemId}`;
}

function SortableLetterBlock({ block, children }) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: blockDragId(block.id),
    data: { type: 'coverLetterBlock', blockId: block.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`coverLetterBodyBlock${isDragging ? ' isDragging' : ''}`}
      data-page-break-kind="entry"
      style={{
        transform: DndCss.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function SortableLetterBullet({ blockId, item, children }) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: bulletDragId(blockId, item.id),
    data: { type: 'coverLetterBullet', blockId, itemId: item.id },
  });

  return (
    <li
      ref={setNodeRef}
      className={`coverLetterBullet${isDragging ? ' isDragging' : ''}`}
      data-page-break-kind="item"
      style={{
        transform: DndCss.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  );
}

function CoverLetterDragPreview({ activeDrag, coverLetter }) {
  if (!activeDrag) return null;

  if (activeDrag.type === 'coverLetterBlock') {
    const block = coverLetter.bodyBlocks.find((candidate) => candidate.id === activeDrag.blockId);
    if (!block) return null;
    return (
      <div className="coverLetterDragPreview">
        {block.kind === 'paragraph'
          ? (block.text || 'Empty paragraph')
          : `${block.items.length} ${block.items.length === 1 ? 'bullet' : 'bullets'}`}
      </div>
    );
  }

  const block = coverLetter.bodyBlocks.find((candidate) => candidate.id === activeDrag.blockId);
  const item = block?.kind === 'bulletList'
    ? block.items.find((candidate) => candidate.id === activeDrag.itemId)
    : null;
  return item ? <div className="coverLetterDragPreview coverLetterDragPreview--bullet">{item.text || 'Empty bullet'}</div> : null;
}

export default function CoverLetterPreview({
  coverLetter,
  coverLetterId,
  template,
  resolvedSender,
  panelRef,
  activeEditorCaret,
  previewPulseTarget,
  isPrintRendering = false,
  onEditTarget,
  onPreviewValueChange,
  onPreviewValueCommit,
  onPreviewCaretChange,
  onPreviewEditorHandoff,
  onReorderBodyBlocks,
  onReorderBullets,
  onAdjustSetting,
  onLayoutChange,
  sampleModel = null,
  isSamplePreview = false,
  showSampleInformationToggle = false,
  showSampleInformation = false,
  onToggleSampleInformation,
  onDismissSampleInformation,
}) {
  const previewFrameRef = useRef(null);
  const pageRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const renderedLetter = sampleModel?.coverLetter || coverLetter;
  const renderedSender = sampleModel?.resolvedSender || resolvedSender;
  const hasContent = coverLetterHasContent(renderedLetter) || Boolean(sampleModel);
  const presentationVars = useMemo(
    () => getCoverLetterPresentationVars(coverLetter, template),
    [coverLetter, template],
  );
  const previewModel = useMemo(() => ({ hasContent }), [hasContent]);
  const pageMetrics = useResumePreviewPageMetrics({
    frameRef: previewFrameRef,
    presentationVars,
    previewModel,
    resumeRootRef: pageRef,
  });
  const printPageRule = useMemo(
    () => getCoverLetterPrintPageRule(coverLetter, template),
    [coverLetter, template],
  );
  const sensors = useSensors(
    useSensor(ResumeLoomrPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(ResumeLoomrKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const readTargetValue = useMemo(() => (
    (documentValue, target) => readCoverLetterTargetValue(documentValue, resolvedSender, target)
  ), [resolvedSender]);
  const {
    closeSession: closeMobileEditSession,
    handleBlur: handleMobileEditorBlur,
    handleChange: handleMobileEditorChange,
    handleProxyTap: handleMobileProxyTap,
    inputRef: mobileEditorRef,
    openSession: openMobileEditSession,
    scheduleCaretSync: scheduleMobileCaretSync,
    session: mobileEditSession,
    sessionRef: mobileEditSessionRef,
  } = useMobilePreviewEditor({
    activeEditorCaret,
    document: coverLetter,
    documentId: coverLetterId,
    getTargetInputMode: getCoverLetterTargetInputMode,
    getTargetLabel: getCoverLetterTargetLabel,
    isTargetMultiline: isCoverLetterTargetMultiline,
    isPrintRendering,
    onEditTarget,
    onPreviewCaretChange,
    onPreviewEditorHandoff,
    onPreviewValueChange,
    onPreviewValueCommit,
    pageScale: pageMetrics.scale,
    parseTargetPath: parseCoverLetterTargetPath,
    readTargetValue,
    resumeRootRef: pageRef,
  });

  useResumePrintPageRule(printPageRule);

  useEffect(() => {
    if (!onLayoutChange) return;
    onLayoutChange({
      mode: 'fitPage',
      width: pageMetrics.pageWidth > 0 && pageMetrics.layoutWidth > 0 ? pageMetrics.layoutWidth : 0,
    });
  }, [onLayoutChange, pageMetrics.layoutWidth, pageMetrics.pageWidth]);

  function pulseAttributes(path) {
    return previewPulseTarget?.path === path && previewPulseTarget?.requestId
      ? { 'data-preview-pulse': previewPulseTarget.requestId % 2 === 0 ? 'even' : 'odd' }
      : {};
  }

  function targetAttributes(target) {
    return {
      'data-edit-section-id': 'coverLetter',
      'data-edit-path': target.path,
      ...pulseAttributes(target.path),
    };
  }

  function renderEditableText(value, target, { fallback = '', prefix = '', suffix = '' } = {}) {
    const sourceText = value === undefined || value === null ? '' : String(value);
    const displayText = sourceText || fallback;
    const hasTypedCaret = typeof activeEditorCaret?.value === 'string' && activeEditorCaret.value.length > 0;
    const showCaret = (
      (!isSamplePreview || hasTypedCaret)
      && !activeDrag
      && activeEditorCaret?.path === target.path
      && Number.isFinite(activeEditorCaret.offset)
    );
    const caretValue = typeof activeEditorCaret?.value === 'string' ? activeEditorCaret.value : sourceText;
    const offset = showCaret ? Math.max(0, Math.min(activeEditorCaret.offset, caretValue.length)) : 0;

    return (
      <>
        {prefix ? <span data-preview-caret-decoration="prefix">{prefix}</span> : null}
        <span
          data-preview-caret-text="true"
          data-preview-caret-path={target.path}
          data-preview-caret-display={showCaret ? (caretValue || fallback) : displayText}
        >
          {showCaret ? (
            <>
              {caretValue.slice(0, offset)}
              <span className="previewTextCaret" aria-hidden="true" />
              {caretValue.slice(offset) || (!caretValue ? fallback : '')}
            </>
          ) : displayText}
        </span>
        {suffix ? <span data-preview-caret-decoration="suffix">{suffix}</span> : null}
      </>
    );
  }

  function handlePreviewClick(event) {
    if (suppressClickRef.current || !onEditTarget) return;
    const targetElement = event.target.closest('[data-edit-path]');
    if (!targetElement || !pageRef.current?.contains(targetElement)) return;

    const path = targetElement.dataset.editPath;
    const parsedTarget = parseCoverLetterTargetPath(path);
    if (!parsedTarget) return;
    event.preventDefault();

    const clickedValue = event.target.closest('[data-preview-caret-text="true"]');
    const valueElement = clickedValue?.dataset.previewCaretPath === path
      ? clickedValue
      : [...targetElement.querySelectorAll('[data-preview-caret-text="true"]')]
        .find((element) => element.dataset.previewCaretPath === path);
    const displayText = valueElement?.dataset.previewCaretDisplay ?? valueElement?.textContent ?? '';
    const decoration = event.target.closest('[data-preview-caret-decoration]');
    let displayOffset = displayText.length;
    if (decoration?.dataset.previewCaretDecoration === 'prefix') displayOffset = 0;
    else if (decoration?.dataset.previewCaretDecoration === 'suffix') displayOffset = displayText.length;
    else if (valueElement) {
      const pointOffset = getPreviewCaretOffsetFromPoint(valueElement, event.clientX, event.clientY);
      if (Number.isFinite(pointOffset)) displayOffset = pointOffset;
    }

    const editTarget = { ...parsedTarget, displayText, displayOffset };
    if (isMobilePreviewEditingViewport()) {
      if (mobileEditSessionRef.current?.target.path !== path) closeMobileEditSession();
      const editableDocument = onEditTarget({ ...editTarget, stayInPreview: true });
      if (editableDocument) openMobileEditSession(editTarget, valueElement, editableDocument);
      return;
    }
    closeMobileEditSession();
    onEditTarget(editTarget);
  }

  function handleDragStart(event) {
    closeMobileEditSession();
    suppressClickRef.current = true;
    setActiveDrag(event.active.data.current || null);
  }

  function handleDragEnd(event) {
    const dragMeta = event.active.data.current;
    const overMeta = event.over?.data.current;
    setActiveDrag(null);
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    if (!dragMeta || !overMeta || event.active.id === event.over.id) return;

    if (dragMeta.type === 'coverLetterBlock' && overMeta.type === 'coverLetterBlock') {
      const ids = coverLetter.bodyBlocks.map((block) => block.id);
      const fromIndex = ids.indexOf(dragMeta.blockId);
      const toIndex = ids.indexOf(overMeta.blockId);
      if (fromIndex >= 0 && toIndex >= 0) onReorderBodyBlocks?.(arrayMove(ids, fromIndex, toIndex));
      return;
    }

    if (
      dragMeta.type === 'coverLetterBullet'
      && overMeta.type === 'coverLetterBullet'
      && dragMeta.blockId === overMeta.blockId
    ) {
      const block = coverLetter.bodyBlocks.find((candidate) => candidate.id === dragMeta.blockId);
      if (block?.kind !== 'bulletList') return;
      const ids = block.items.map((item) => item.id);
      const fromIndex = ids.indexOf(dragMeta.itemId);
      const toIndex = ids.indexOf(overMeta.itemId);
      if (fromIndex >= 0 && toIndex >= 0) onReorderBullets?.(block.id, arrayMove(ids, fromIndex, toIndex));
    }
  }

  function handleDragCancel() {
    setActiveDrag(null);
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

  const senderDetails = [
    ['location', renderedSender.location],
    ['phone', renderedSender.phone],
    ['email', renderedSender.email],
    ['linkedinUrl', renderedSender.linkedinUrl],
    ['githubUrl', renderedSender.githubUrl],
    ['portfolioUrl', renderedSender.portfolioUrl],
    ['customField', renderedSender.customField],
  ].filter(([, value]) => Boolean(value));
  const signatureName = renderedLetter.signatureName || renderedSender.name;
  const bodyIds = renderedLetter.bodyBlocks.map((block) => blockDragId(block.id));
  const pageHeight = Math.max(pageMetrics.pageHeight || 1056, pageMetrics.contentHeight || 1056);

  return (
    <>
      <section className="previewPanel panel coverLetterPreviewPanel" ref={panelRef}>
        <div className="previewFrame" ref={previewFrameRef}>
          <div className="previewPageViewport">
            <div
              className="previewPageScaleShell"
              style={{
                '--preview-page-scale': pageMetrics.scale || 1,
                '--preview-page-width': `${pageMetrics.pageWidth || 816}px`,
                width: `${Math.round((pageMetrics.pageWidth || 816) * (pageMetrics.scale || 1))}px`,
                height: `${Math.round(pageHeight * (pageMetrics.scale || 1))}px`,
              }}
            >
              <div className="previewPageScaleLayer">
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <article
                    ref={pageRef}
                    className={`resumePage coverLetterPage coverLetterPage--${template}${activeDrag ? ' resumePage--dragging' : ''}`}
                    style={presentationVars}
                    onClick={handlePreviewClick}
                  >
                    <PreviewMarginControls
                      settings={coverLetter.settings}
                      hidden={isPrintRendering}
                      onAdjustSetting={onAdjustSetting}
                      onInteraction={closeMobileEditSession}
                    />
                    <SampleInformationToggle
                      enabled={showSampleInformationToggle}
                      showSampleInformation={showSampleInformation}
                      onToggleSampleInformation={onToggleSampleInformation}
                      onDismissSampleInformation={onDismissSampleInformation}
                    />
                    <div className="resumePageContent coverLetterPageContent" data-preview-page-content="true">
                      {isSamplePreview ? <p className="coverLetterSampleLabel">Sample cover letter. Disappears as you replace it.</p> : null}
                      <header className="coverLetterSender">
                        <h1 {...targetAttributes({ path: coverLetterSenderPath('name') })}>
                          {renderEditableText(renderedSender.name, { path: coverLetterSenderPath('name') }, { fallback: isPrintRendering ? '' : 'Your Name' })}
                        </h1>
                        {renderedSender.headline ? (
                          <p {...targetAttributes({ path: coverLetterSenderPath('headline') })}>
                            {renderEditableText(renderedSender.headline, { path: coverLetterSenderPath('headline') })}
                          </p>
                        ) : null}
                        {senderDetails.length ? (
                          <p className="coverLetterSenderDetails">
                            {senderDetails.map(([field, detail], index) => {
                              const target = { path: coverLetterSenderPath(field) };
                              return (
                                <span key={`${field}-${index}`} {...targetAttributes(target)}>
                                  {renderEditableText(detail, target)}
                                </span>
                              );
                            })}
                          </p>
                        ) : null}
                      </header>

                      <div className="coverLetterRecipientDate">
                        <div className="coverLetterRecipient" data-page-break-kind="entry">
                          {renderedLetter.recipient.hiringManagerName ? (
                            <p {...targetAttributes({ path: coverLetterRecipientPath('hiringManagerName') })}>
                              {renderEditableText(renderedLetter.recipient.hiringManagerName, { path: coverLetterRecipientPath('hiringManagerName') })}
                            </p>
                          ) : null}
                          {renderedLetter.recipient.hiringManagerTitle ? (
                            <p {...targetAttributes({ path: coverLetterRecipientPath('hiringManagerTitle') })}>
                              {renderEditableText(renderedLetter.recipient.hiringManagerTitle, { path: coverLetterRecipientPath('hiringManagerTitle') })}
                            </p>
                          ) : null}
                          {renderedLetter.recipient.company ? (
                            <p {...targetAttributes({ path: coverLetterRecipientPath('company') })}>
                              {renderEditableText(renderedLetter.recipient.company, { path: coverLetterRecipientPath('company') })}
                            </p>
                          ) : null}
                          {renderedLetter.recipient.addressLines.map((line, index) => line ? (
                            <p key={`address-${index}`} {...targetAttributes({ path: coverLetterAddressPath(index) })}>
                              {renderEditableText(line, { path: coverLetterAddressPath(index) })}
                            </p>
                          ) : null)}
                        </div>
                        {renderedLetter.recipient.date ? (
                          <p className="coverLetterDate" {...targetAttributes({ path: coverLetterRecipientPath('date') })}>
                            {renderEditableText(renderedLetter.recipient.date, { path: coverLetterRecipientPath('date') })}
                          </p>
                        ) : null}
                      </div>

                      <p className="coverLetterGreeting" {...targetAttributes({ path: coverLetterSimplePath('greeting') })}>
                        {renderEditableText(renderedLetter.greeting, { path: coverLetterSimplePath('greeting') }, { fallback: isPrintRendering ? '' : 'Dear Hiring Manager,' })}
                      </p>

                      <SortableContext items={bodyIds} strategy={verticalListSortingStrategy}>
                        <div className="coverLetterBody" data-page-break-kind="section">
                          {renderedLetter.bodyBlocks.map((block) => (
                            <SortableLetterBlock block={block} key={block.id}>
                              {block.kind === 'paragraph' ? (
                                <p {...targetAttributes({ path: coverLetterBodyPath(block.id) })}>
                                  {renderEditableText(block.text, { path: coverLetterBodyPath(block.id) }, { fallback: isPrintRendering ? '' : 'Write your cover letter here.' })}
                                </p>
                              ) : (
                                <SortableContext
                                  items={block.items.map((item) => bulletDragId(block.id, item.id))}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <ul>
                                    {block.items.map((item) => (
                                      <SortableLetterBullet blockId={block.id} item={item} key={item.id}>
                                        <span {...targetAttributes({ path: coverLetterBulletPath(block.id, item.id) })}>
                                          {renderEditableText(item.text, { path: coverLetterBulletPath(block.id, item.id) }, { fallback: isPrintRendering ? '' : 'Add a proof point.' })}
                                        </span>
                                      </SortableLetterBullet>
                                    ))}
                                  </ul>
                                </SortableContext>
                              )}
                            </SortableLetterBlock>
                          ))}
                        </div>
                      </SortableContext>

                      <footer className="coverLetterClosing" data-page-break-kind="entry">
                        <p {...targetAttributes({ path: coverLetterSimplePath('signOff') })}>
                          {renderEditableText(renderedLetter.signOff, { path: coverLetterSimplePath('signOff') }, { fallback: isPrintRendering ? '' : 'Sincerely,' })}
                        </p>
                        <p className="coverLetterSignature" {...targetAttributes({ path: coverLetterSimplePath('signatureName') })}>
                          {renderEditableText(signatureName, { path: coverLetterSimplePath('signatureName') }, { fallback: isPrintRendering ? '' : 'Your Name' })}
                        </p>
                      </footer>
                    </div>
                    <PreviewPageMarkers hasContent={hasContent} pageBreaks={pageMetrics.pageBreaks} />
                  </article>
                  <DragOverlay adjustScale={false} zIndex={1000}>
                    <CoverLetterDragPreview activeDrag={activeDrag} coverLetter={renderedLetter} />
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </div>
        </div>
      </section>
      <MobilePreviewEditorProxy
        session={mobileEditSession}
        inputRef={mobileEditorRef}
        onBlur={handleMobileEditorBlur}
        onCaretEvent={(event) => scheduleMobileCaretSync(event.currentTarget)}
        onChange={handleMobileEditorChange}
        onCommit={() => closeMobileEditSession()}
        onProxyTap={handleMobileProxyTap}
      />
    </>
  );
}
