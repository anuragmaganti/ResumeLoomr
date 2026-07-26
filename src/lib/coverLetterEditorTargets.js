function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

export function coverLetterSenderPath(field) {
  return `coverLetter.sender.${field}`;
}

export function coverLetterRecipientPath(field) {
  return `coverLetter.recipient.${field}`;
}

export function coverLetterAddressPath(index) {
  return `coverLetter.recipient.addressLines.${index}`;
}

export function coverLetterBodyPath(blockId) {
  return `coverLetter.body.${blockId}.text`;
}

export function coverLetterBulletPath(blockId, itemId) {
  return `coverLetter.body.${blockId}.items.${itemId}`;
}

export function coverLetterSimplePath(field) {
  return `coverLetter.${field}`;
}

export function parseCoverLetterTargetPath(path) {
  const segments = String(path || '').split('.');
  if (segments[0] !== 'coverLetter') return null;

  if (segments[1] === 'sender' && segments[2]) {
    return { kind: 'sender', field: segments[2], group: 'sender', path };
  }
  if (segments[1] === 'recipient' && segments[2] === 'addressLines' && /^\d+$/.test(segments[3] || '')) {
    return { kind: 'address', index: Number(segments[3]), group: 'recipient', path };
  }
  if (segments[1] === 'recipient' && segments[2]) {
    return { kind: 'recipient', field: segments[2], group: 'recipient', path };
  }
  if (segments[1] === 'body' && segments[2] && segments[3] === 'text') {
    return { kind: 'paragraph', blockId: segments[2], group: 'letter', path };
  }
  if (segments[1] === 'body' && segments[2] && segments[3] === 'items' && segments[4]) {
    return { kind: 'bullet', blockId: segments[2], itemId: segments[4], group: 'letter', path };
  }
  if (['greeting', 'signOff', 'signatureName'].includes(segments[1])) {
    return {
      kind: 'simple',
      field: segments[1],
      group: segments[1] === 'greeting' ? 'letter' : 'closing',
      path,
    };
  }
  return null;
}

export function readCoverLetterTargetValue(coverLetter, resolvedSender, target) {
  if (!target?.kind) return null;

  if (target.kind === 'sender') {
    return text(Object.hasOwn(coverLetter.sender.overrides, target.field)
      ? coverLetter.sender.overrides[target.field]
      : resolvedSender?.[target.field]);
  }
  if (target.kind === 'recipient') return text(coverLetter.recipient?.[target.field]);
  if (target.kind === 'address') return text(coverLetter.recipient?.addressLines?.[target.index]);
  if (target.kind === 'simple') return text(coverLetter?.[target.field]);

  const block = coverLetter.bodyBlocks.find((candidate) => candidate.id === target.blockId);
  if (!block) return null;
  if (target.kind === 'paragraph' && block.kind === 'paragraph') return text(block.text);
  if (target.kind === 'bullet' && block.kind === 'bulletList') {
    return text(block.items.find((item) => item.id === target.itemId)?.text);
  }
  return null;
}

export function applyCoverLetterTargetValue(actions, target, value) {
  switch (target?.kind) {
    case 'sender':
      actions.updateSenderOverride(target.field, value);
      break;
    case 'recipient':
      actions.updateRecipientField(target.field, value);
      break;
    case 'address':
      actions.updateRecipientAddressLine(target.index, value);
      break;
    case 'paragraph':
      actions.updateBodyBlock(target.blockId, value);
      break;
    case 'bullet':
      actions.updateBullet(target.blockId, target.itemId, value);
      break;
    case 'simple':
      if (target.field === 'greeting') actions.updateGreeting(value);
      if (target.field === 'signOff') actions.updateSignOff(value);
      if (target.field === 'signatureName') actions.updateSignatureName(value);
      break;
    default:
      break;
  }
}

export function isCoverLetterTargetMultiline(target) {
  return target?.kind === 'paragraph' || target?.kind === 'bullet';
}

export function getCoverLetterTargetInputMode(target) {
  if (target?.kind === 'sender' && target.field === 'email') return 'email';
  if (target?.kind === 'sender' && target.field === 'phone') return 'tel';
  if (target?.kind === 'sender' && ['linkedinUrl', 'githubUrl', 'portfolioUrl'].includes(target.field)) return 'url';
  return 'text';
}

export function getCoverLetterTargetLabel(target) {
  if (target?.kind === 'sender') return `Edit sender ${target.field}`;
  if (target?.kind === 'recipient') return `Edit recipient ${target.field}`;
  if (target?.kind === 'address') return `Edit address line ${target.index + 1}`;
  if (target?.kind === 'paragraph') return 'Edit cover letter paragraph';
  if (target?.kind === 'bullet') return 'Edit cover letter bullet';
  if (target?.kind === 'simple') return `Edit ${target.field}`;
  return 'Edit cover letter text';
}
