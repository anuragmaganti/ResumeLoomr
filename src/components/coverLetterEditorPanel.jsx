import { useEffect, useRef } from 'react';
import CoverLetterSettingsRail from './coverLetterSettingsRail.jsx';
import {
  COVER_LETTER_EDITOR_GROUPS,
  COVER_LETTER_SENDER_FIELDS,
  getCoverLetterWordCount,
} from '../lib/coverLetter.js';
import {
  coverLetterAddressPath,
  coverLetterBodyPath,
  coverLetterBulletPath,
  coverLetterRecipientPath,
  coverLetterSenderPath,
  coverLetterSimplePath,
} from '../lib/coverLetterEditorTargets.js';
import { createEditorTargetAttributes, mapDisplayedCaretOffsetToSource } from '../lib/editorTargets.js';

const senderLabels = {
  name: 'Full name',
  headline: 'Professional headline',
  location: 'Location',
  phone: 'Phone number',
  email: 'Email address',
  linkedinUrl: 'LinkedIn URL',
  githubUrl: 'GitHub URL',
  portfolioUrl: 'Portfolio or website',
  customField: 'Custom field',
};

function Field({ label, path, value, placeholder = '', multiline = false, onChange, onBlur }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <div className="field">
      <label htmlFor={path}>{label}</label>
      <Component
        id={path}
        {...createEditorTargetAttributes(path)}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        rows={multiline ? 4 : undefined}
      />
    </div>
  );
}

export default function CoverLetterEditorPanel({
  activeGroup,
  setActiveGroup,
  coverLetter,
  resolvedSender,
  template,
  onTemplateChange,
  actions,
  maxHeight,
  previewEditTarget,
  onClearPreviewEditTarget,
  onPreviewPulseTarget,
  onEditorCaretChange,
  placeholderFor = (_path, fallback = '') => fallback,
}) {
  const handledRequestRef = useRef(0);
  const caretFrameRef = useRef(0);
  const editorWorkspaceStyle = maxHeight ? {
    minHeight: `${maxHeight}px`,
    '--editor-stage-max-height': `${maxHeight}px`,
  } : undefined;

  useEffect(() => {
    if (!previewEditTarget?.requestId || handledRequestRef.current === previewEditTarget.requestId) return;
    handledRequestRef.current = previewEditTarget.requestId;
    setActiveGroup(previewEditTarget.group || 'letter');

    const frameId = window.requestAnimationFrame(() => {
      const field = document.querySelector(`[data-editor-path="${CSS.escape(previewEditTarget.path)}"]`);
      if (!field) return;
      field.closest('.formContainer')?.scrollTo({
        top: Math.max(0, field.offsetTop - 24),
        behavior: 'smooth',
      });
      field.focus({ preventScroll: true });
      const sourceOffset = mapDisplayedCaretOffsetToSource({
        displayText: previewEditTarget.displayText,
        sourceValue: field.value,
        displayOffset: previewEditTarget.displayOffset,
        isPlaceholder: field.value.trim() === '',
      });
      field.setSelectionRange?.(sourceOffset, sourceOffset);
      onEditorCaretChange?.({ path: previewEditTarget.path, offset: sourceOffset, value: field.value });
      onClearPreviewEditTarget?.(previewEditTarget.requestId);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [onClearPreviewEditTarget, onEditorCaretChange, previewEditTarget, setActiveGroup]);

  function handleCaretEvent(event) {
    const field = event.target.closest?.('[data-editor-path]');
    if (!field || typeof field.selectionStart !== 'number') return;
    window.cancelAnimationFrame(caretFrameRef.current);
    caretFrameRef.current = window.requestAnimationFrame(() => {
      onEditorCaretChange?.({
        path: field.dataset.editorPath,
        offset: field.selectionStart,
        value: field.value,
      });
    });
  }

  function renderSender() {
    return (
      <div className="formStack">
        <div className="coverLetterLinkMode" role="group" aria-label="Sender information source">
          <button type="button" className={coverLetter.sender.mode === 'resume' ? 'isActive' : ''} onClick={() => actions.setSenderMode('resume')}>Linked to resume</button>
          <button type="button" className={coverLetter.sender.mode === 'custom' ? 'isActive' : ''} onClick={() => actions.setSenderMode('custom')}>Custom sender</button>
        </div>
        <div className="fieldGrid fieldGridTwo">
          {COVER_LETTER_SENDER_FIELDS.map((field) => {
            const hasOverride = Object.hasOwn(coverLetter.sender.overrides, field);
            const value = hasOverride ? coverLetter.sender.overrides[field] : resolvedSender[field] || '';
            return (
              <div className="coverLetterLinkedField" key={field}>
                <Field
                  label={senderLabels[field]}
                  path={coverLetterSenderPath(field)}
                  value={value}
                  placeholder={placeholderFor(coverLetterSenderPath(field), '')}
                  onChange={(nextValue) => actions.updateSenderOverride(field, nextValue)}
                />
                {coverLetter.sender.mode === 'resume' ? (
                  <div className="coverLetterFieldSource">
                    <span>{hasOverride ? 'Custom override' : 'Linked to resume'}</span>
                    {hasOverride ? <button type="button" onClick={() => actions.resetSenderOverride(field)}>Reset</button> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderRecipient() {
    return (
      <div className="formStack">
        <div className="fieldGrid fieldGridTwo">
          <Field label="Date" path={coverLetterRecipientPath('date')} value={coverLetter.recipient.date} placeholder={placeholderFor(coverLetterRecipientPath('date'), 'July 26, 2026')} onChange={(value) => actions.updateRecipientField('date', value)} />
          <Field label="Company" path={coverLetterRecipientPath('company')} value={coverLetter.recipient.company} placeholder={placeholderFor(coverLetterRecipientPath('company'), 'Company name')} onChange={(value) => actions.updateRecipientField('company', value)} />
          <Field label="Hiring manager" path={coverLetterRecipientPath('hiringManagerName')} value={coverLetter.recipient.hiringManagerName} placeholder={placeholderFor(coverLetterRecipientPath('hiringManagerName'), 'Hiring manager name')} onChange={(value) => actions.updateRecipientField('hiringManagerName', value)} />
          <Field label="Hiring manager title" path={coverLetterRecipientPath('hiringManagerTitle')} value={coverLetter.recipient.hiringManagerTitle} placeholder={placeholderFor(coverLetterRecipientPath('hiringManagerTitle'), 'Hiring manager title')} onChange={(value) => actions.updateRecipientField('hiringManagerTitle', value)} />
        </div>
        <div className="coverLetterAddressLines">
          {coverLetter.recipient.addressLines.map((line, index) => (
            <div className="coverLetterAddressRow" key={`address-${index}`}>
              <Field label={`Address line ${index + 1}`} path={coverLetterAddressPath(index)} value={line} placeholder={placeholderFor(coverLetterAddressPath(index), 'Street, city, state')} onChange={(value) => actions.updateRecipientAddressLine(index, value)} />
              {coverLetter.recipient.addressLines.length > 1 ? <button type="button" className="button buttonSecondary" onClick={() => actions.removeRecipientAddressLine(index)} aria-label={`Remove address line ${index + 1}`}>−</button> : null}
            </div>
          ))}
          {coverLetter.recipient.addressLines.length < 6 ? <button type="button" className="button buttonSecondary coverLetterAddButton" onClick={actions.addRecipientAddressLine}>+ Add address line</button> : null}
        </div>
      </div>
    );
  }

  function renderLetter() {
    const wordCount = getCoverLetterWordCount(coverLetter);
    return (
      <div className="formStack">
        <Field label="Greeting" path={coverLetterSimplePath('greeting')} value={coverLetter.greeting} placeholder={placeholderFor(coverLetterSimplePath('greeting'), 'Dear Hiring Manager,')} onChange={actions.updateGreeting} />
        {coverLetter.bodyBlocks.map((block, index) => (
          <section className="formSection coverLetterBlockCard" key={block.id}>
            <div className="coverLetterBlockHeader">
              <span>{block.kind === 'paragraph' ? `${block.role[0].toUpperCase()}${block.role.slice(1)} paragraph` : 'Bullet list'}</span>
              <button type="button" className="button entryCollapseButton" onClick={() => actions.removeBodyBlock(block.id)}>Remove</button>
            </div>
            {block.kind === 'paragraph' ? (
              <Field label={`Paragraph ${index + 1}`} path={coverLetterBodyPath(block.id)} value={block.text} placeholder={placeholderFor(coverLetterBodyPath(block.id), 'Write a focused paragraph…')} multiline onChange={(value) => actions.updateBodyBlock(block.id, value)} />
            ) : (
              <div className="formStack">
                {block.items.map((item, itemIndex) => (
                  <div className="coverLetterBulletEditor" key={item.id}>
                    <Field label={`Bullet ${itemIndex + 1}`} path={coverLetterBulletPath(block.id, item.id)} value={item.text} placeholder={placeholderFor(coverLetterBulletPath(block.id, item.id), 'Add a concise proof point…')} multiline onChange={(value) => actions.updateBullet(block.id, item.id, value)} />
                    {block.items.length > 1 ? <button type="button" className="button buttonSecondary" onClick={() => actions.removeBullet(block.id, item.id)}>Remove</button> : null}
                  </div>
                ))}
                <button type="button" className="button buttonSecondary coverLetterAddButton" onClick={() => actions.addBullet(block.id)}>+ Add bullet</button>
              </div>
            )}
          </section>
        ))}
        <div className="coverLetterBlockActions">
          <button type="button" className="button buttonSecondary" onClick={() => actions.addParagraph('evidence')}>+ Add paragraph</button>
          <button type="button" className="button buttonSecondary" onClick={actions.addBulletList}>+ Add bullet list</button>
        </div>
        <p className={`coverLetterWordCount${wordCount >= 400 ? ' isWarning' : ''}`}>
          {wordCount} words{wordCount >= 400 ? '. Consider tightening this letter.' : ''}
        </p>
      </div>
    );
  }

  function renderClosing() {
    return (
      <div className="formStack">
        <Field label="Sign-off" path={coverLetterSimplePath('signOff')} value={coverLetter.signOff} placeholder={placeholderFor(coverLetterSimplePath('signOff'), 'Sincerely,')} onChange={actions.updateSignOff} />
        <Field label="Signature name" path={coverLetterSimplePath('signatureName')} value={coverLetter.signatureName} placeholder={placeholderFor(coverLetterSimplePath('signatureName'), resolvedSender.name || 'Your name')} onChange={actions.updateSignatureName} />
        {!coverLetter.signatureName && resolvedSender.name ? <p className="coverLetterLinkedHint">Signature currently uses the name linked from this resume.</p> : null}
      </div>
    );
  }

  const groupContent = {
    sender: renderSender,
    recipient: renderRecipient,
    letter: renderLetter,
    closing: renderClosing,
  };

  return (
    <section className="editorPanel coverLetterEditorPanel">
      <div className="editorWorkspace" style={editorWorkspaceStyle}>
        <div className="editorSidebar">
          <aside className="settingsRail panel">
            <CoverLetterSettingsRail coverLetter={coverLetter} template={template} onTemplateChange={onTemplateChange} onAdjustSetting={actions.updateSetting} />
          </aside>
          <aside className="editorRail panel">
            <div className="coverLetterTabs" role="tablist" aria-label="Cover letter editor groups">
              {COVER_LETTER_EDITOR_GROUPS.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className={`coverLetterTab${activeGroup === group.id ? ' isActive' : ''}`}
                  role="tab"
                  aria-selected={activeGroup === group.id}
                  onClick={() => setActiveGroup(group.id)}
                >{group.label}</button>
              ))}
            </div>
          </aside>
        </div>
        <div
          className="editorStage panel"
          onFocus={(event) => {
            const field = event.target.closest?.('[data-editor-path]');
            if (field) onPreviewPulseTarget?.({ path: field.dataset.editorPath });
            handleCaretEvent(event);
          }}
          onInput={handleCaretEvent}
          onKeyUp={handleCaretEvent}
          onMouseUp={handleCaretEvent}
          onSelect={handleCaretEvent}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) onEditorCaretChange?.(null);
          }}
        >
          <div className="editorPanelHeader">
            <div className="editorPanelHeading"><h3>{COVER_LETTER_EDITOR_GROUPS.find((group) => group.id === activeGroup)?.label}</h3></div>
          </div>
          <div className="formContainer">{groupContent[activeGroup]?.()}</div>
        </div>
      </div>
    </section>
  );
}
