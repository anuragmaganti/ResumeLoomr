import { trimText } from './text.js';

export function normalizeSampleDisplay(sampleDisplay) {
  const display = sampleDisplay && typeof sampleDisplay === 'object' ? sampleDisplay : {};
  const isDismissed = Boolean(display.isDismissed);

  return {
    hasStarted: isDismissed || Boolean(display.hasStarted),
    showInformation: isDismissed ? false : display.showInformation !== false,
    isDismissed,
    entryBindings: isDismissed ? {} : normalizeSampleEntryBindings(display.entryBindings),
    textListOrders: isDismissed ? {} : normalizeSampleTextListOrders(display.textListOrders),
  };
}

export function normalizeSampleTextListOrders(textListOrders) {
  if (!textListOrders || typeof textListOrders !== 'object' || Array.isArray(textListOrders)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(textListOrders).flatMap(([rawKey, rawOrder]) => {
      const key = trimText(rawKey);
      const order = Array.isArray(rawOrder)
        ? rawOrder.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 99)
        : [];
      const uniqueOrder = [...new Set(order)];

      return key && key.length <= 360 && uniqueOrder.length === order.length && uniqueOrder.length > 0
        ? [[key, uniqueOrder]]
        : [];
    }),
  );
}

export function normalizeSampleEntryBindings(entryBindings) {
  if (!entryBindings || typeof entryBindings !== 'object' || Array.isArray(entryBindings)) {
    return {};
  }

  const nextBindings = {};

  Object.entries(entryBindings).forEach(([rawSectionId, sectionBindings]) => {
    const sectionId = trimText(rawSectionId);

    if (
      !sectionId ||
      sectionId.length > 100 ||
      !sectionBindings ||
      typeof sectionBindings !== 'object' ||
      Array.isArray(sectionBindings)
    ) {
      return;
    }

    const entryBindingsById = {};

    Object.entries(sectionBindings).forEach(([rawEntryId, rawSourceIndex]) => {
      const entryId = trimText(rawEntryId);
      const sourceIndex = Number(rawSourceIndex);

      if (
        !entryId ||
        entryId.length > 160 ||
        !Number.isInteger(sourceIndex) ||
        sourceIndex < 0 ||
        sourceIndex > 99
      ) {
        return;
      }

      entryBindingsById[entryId] = sourceIndex;
    });

    if (Object.keys(entryBindingsById).length > 0) {
      nextBindings[sectionId] = entryBindingsById;
    }
  });

  return nextBindings;
}

function isValidSampleSourceIndex(sourceIndex) {
  return Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex <= 99;
}

function canInferSampleEntryBindings(normalizedResume, section) {
  return (
    normalizedResume.sampleDisplay.showInformation &&
    section?.kind === 'roles' &&
    /experience|work|career/i.test(`${section.id} ${section.title}`)
  );
}

export function inferSectionSampleEntryBindings(normalizedResume, section) {
  const currentBindings = normalizedResume.sampleDisplay.entryBindings?.[section.id] || {};
  const shouldInfer = canInferSampleEntryBindings(normalizedResume, section);
  const nextBindings = {};

  (Array.isArray(section?.entries) ? section.entries : []).forEach((entry, index) => {
    const entryId = trimText(entry.id);

    if (!entryId) {
      return;
    }

    const currentSourceIndex = currentBindings[entryId];

    if (isValidSampleSourceIndex(currentSourceIndex)) {
      nextBindings[entryId] = currentSourceIndex;
      return;
    }

    if (shouldInfer && index <= 99) {
      nextBindings[entryId] = index;
    }
  });

  return nextBindings;
}

export function applySectionSampleEntryBindings(
  normalizedResume,
  sectionId,
  orderedEntries,
  incomingBindings = {},
  inferredSectionBindings = null,
) {
  const section = normalizedResume.sections.find((candidateSection) => candidateSection.id === sectionId);

  if (!section) {
    return normalizedResume;
  }

  const fallbackSectionBindings = inferredSectionBindings || inferSectionSampleEntryBindings(normalizedResume, section);
  const nextSectionBindings = {};

  (Array.isArray(orderedEntries) ? orderedEntries : []).forEach((entry) => {
    const entryId = trimText(entry.id);
    const sourceIndex = isValidSampleSourceIndex(incomingBindings[entryId])
      ? incomingBindings[entryId]
      : fallbackSectionBindings[entryId];

    if (entryId && isValidSampleSourceIndex(sourceIndex)) {
      nextSectionBindings[entryId] = sourceIndex;
    }
  });

  const nextEntryBindings = {
    ...normalizedResume.sampleDisplay.entryBindings,
  };

  if (Object.keys(nextSectionBindings).length > 0) {
    nextEntryBindings[sectionId] = nextSectionBindings;
  } else {
    delete nextEntryBindings[sectionId];
  }

  return {
    ...normalizedResume,
    sampleDisplay: normalizeSampleDisplay({
      ...normalizedResume.sampleDisplay,
      entryBindings: nextEntryBindings,
    }),
  };
}

