import {
  createCoverLetterBulletItem,
  createCoverLetterBulletListBlock,
  createCoverLetterParagraphBlock,
  reorderCoverLetterBodyBlocks,
  reorderCoverLetterBullets,
} from './coverLetter.js';

function updateBodyBlock(letter, blockId, update) {
  return {
    ...letter,
    bodyBlocks: letter.bodyBlocks.map((block) => (
      block.id === blockId ? update(block) : block
    )),
  };
}

function updateRecipient(letter, update) {
  return { ...letter, recipient: { ...letter.recipient, ...update } };
}

function updateSender(letter, update) {
  return { ...letter, sender: { ...letter.sender, ...update } };
}

function updateBulletItems(letter, blockId, update) {
  return updateBodyBlock(letter, blockId, (block) => (
    block.kind === 'bulletList' ? { ...block, items: update(block.items) } : block
  ));
}

export function createCoverLetterEditorActions(updateCoverLetter) {
  const updateRootField = (field, value) => {
    updateCoverLetter((letter) => ({ ...letter, [field]: value }));
  };

  return {
    updateSenderOverride(field, value) {
      updateCoverLetter((letter) => updateSender(letter, {
        overrides: { ...letter.sender.overrides, [field]: value },
      }));
    },
    resetSenderOverride(field) {
      updateCoverLetter((letter) => {
        const overrides = { ...letter.sender.overrides };
        delete overrides[field];
        return updateSender(letter, { overrides });
      });
    },
    resetAllSenderOverrides() {
      updateCoverLetter((letter) => updateSender(letter, { overrides: {} }));
    },
    updateRecipientField(field, value) {
      updateCoverLetter((letter) => updateRecipient(letter, { [field]: value }));
    },
    updateRecipientAddressLine(index, value) {
      updateCoverLetter((letter) => updateRecipient(letter, {
        addressLines: letter.recipient.addressLines.map((line, lineIndex) => (
          lineIndex === index ? value : line
        )),
      }));
    },
    addRecipientAddressLine() {
      updateCoverLetter((letter) => updateRecipient(letter, {
        addressLines: [...letter.recipient.addressLines, ''],
      }));
    },
    removeRecipientAddressLine(index) {
      updateCoverLetter((letter) => updateRecipient(letter, {
        addressLines: letter.recipient.addressLines.filter((_, lineIndex) => lineIndex !== index),
      }));
    },
    updateGreeting(value) {
      updateRootField('greeting', value);
    },
    updateBodyBlock(blockId, value) {
      updateCoverLetter((letter) => updateBodyBlock(letter, blockId, (block) => (
        block.kind === 'paragraph' ? { ...block, text: value } : block
      )));
    },
    addParagraph(role = 'evidence') {
      updateCoverLetter((letter) => ({
        ...letter,
        bodyBlocks: [...letter.bodyBlocks, createCoverLetterParagraphBlock(role)],
      }));
    },
    addBulletList() {
      updateCoverLetter((letter) => ({
        ...letter,
        bodyBlocks: [...letter.bodyBlocks, createCoverLetterBulletListBlock()],
      }));
    },
    removeBodyBlock(blockId) {
      updateCoverLetter((letter) => ({
        ...letter,
        bodyBlocks: letter.bodyBlocks.filter((block) => block.id !== blockId),
      }));
    },
    reorderBodyBlocks(orderedIds) {
      updateCoverLetter((letter) => reorderCoverLetterBodyBlocks(letter, orderedIds));
    },
    updateBullet(blockId, bulletId, value) {
      updateCoverLetter((letter) => updateBulletItems(letter, blockId, (items) => (
        items.map((item) => (item.id === bulletId ? { ...item, text: value } : item))
      )));
    },
    addBullet(blockId) {
      updateCoverLetter((letter) => updateBulletItems(letter, blockId, (items) => (
        [...items, createCoverLetterBulletItem()]
      )));
    },
    removeBullet(blockId, bulletId) {
      updateCoverLetter((letter) => updateBulletItems(letter, blockId, (items) => (
        items.filter((item) => item.id !== bulletId)
      )));
    },
    reorderBullets(blockId, orderedIds) {
      updateCoverLetter((letter) => reorderCoverLetterBullets(letter, blockId, orderedIds));
    },
    updateSignOff(value) {
      updateRootField('signOff', value);
    },
    updateSignatureName(value) {
      updateRootField('signatureName', value);
    },
    setSampleInformationVisible(showInformation) {
      updateCoverLetter((letter) => letter.sampleDisplay.isDismissed ? letter : ({
        ...letter,
        sampleDisplay: {
          ...letter.sampleDisplay,
          hasStarted: true,
          showInformation: Boolean(showInformation),
        },
      }));
    },
    dismissSampleInformation() {
      updateCoverLetter((letter) => ({
        ...letter,
        sampleDisplay: {
          hasStarted: true,
          showInformation: false,
          isDismissed: true,
          entryBindings: {},
          textListOrders: {},
        },
      }));
    },
    updateSetting(settingId, delta) {
      updateCoverLetter((letter) => ({
        ...letter,
        settings: {
          ...letter.settings,
          [settingId]: Number(letter.settings[settingId] || 0) + delta,
        },
      }));
    },
  };
}
