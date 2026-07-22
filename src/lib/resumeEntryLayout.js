export const ENTRY_HEADER_LAYOUT_FIELDS = {
  education: ['school', 'degree', 'location', 'yearsEdu', 'gpa', 'honors'],
  roles: ['company', 'role', 'location', 'yearsExp'],
  custom: ['title', 'subtitle', 'location', 'years'],
};

const ENTRY_HEADER_LAYOUT_VERSION = 1;
const ENTRY_HEADER_LAYOUT_DEFAULTS = {
  education: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['school', null, null], right: [null, null, 'location'] },
      { left: ['degree', 'gpa', 'honors'], right: [null, null, 'yearsEdu'] },
    ],
  },
  roles: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['company', null], right: [null, 'location'] },
      { left: ['role', null], right: [null, 'yearsExp'] },
    ],
  },
  custom: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['title', null], right: [null, 'location'] },
      { left: ['subtitle', null], right: [null, 'years'] },
    ],
  },
};

function normalizeLayoutKind(sectionKind) {
  return Object.hasOwn(ENTRY_HEADER_LAYOUT_FIELDS, sectionKind) ? sectionKind : 'custom';
}

function cloneEntryHeaderLayout(layout) {
  return {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [0, 1].map((lineIndex) => ({
      left: (Array.isArray(layout?.lines?.[lineIndex]?.left) ? layout.lines[lineIndex].left : [null, null])
        .map((field) => field ?? null),
      right: (Array.isArray(layout?.lines?.[lineIndex]?.right) ? layout.lines[lineIndex].right : [null, null])
        .map((field) => field ?? null),
    })),
  };
}

export function getDefaultEntryHeaderLayout(sectionKind) {
  const defaultLayout = ENTRY_HEADER_LAYOUT_DEFAULTS[normalizeLayoutKind(sectionKind)];

  return defaultLayout ? cloneEntryHeaderLayout(defaultLayout) : null;
}

function getEntryHeaderLayoutFields(sectionKind) {
  return ENTRY_HEADER_LAYOUT_FIELDS[normalizeLayoutKind(sectionKind)] || [];
}

function resolveEntryHeaderLayoutSlot(layout, slot) {
  const lineIndex = Number(slot?.lineIndex);
  const slotIndex = Number(slot?.slotIndex);
  const side = slot?.side === 'right' ? 'right' : 'left';
  const slots = layout?.lines?.[lineIndex]?.[side];

  if (
    !Number.isInteger(lineIndex)
    || !Number.isInteger(slotIndex)
    || lineIndex < 0
    || lineIndex > 1
    || !Array.isArray(slots)
    || slotIndex < 0
    || slotIndex >= slots.length
  ) {
    return null;
  }

  return { lineIndex, side, slotIndex };
}

function getEntryHeaderLayoutSlot(layout, slot) {
  const resolvedSlot = resolveEntryHeaderLayoutSlot(layout, slot);

  return resolvedSlot
    ? layout.lines[resolvedSlot.lineIndex][resolvedSlot.side][resolvedSlot.slotIndex]
    : undefined;
}

function setEntryHeaderLayoutSlot(layout, slot, value) {
  const resolvedSlot = resolveEntryHeaderLayoutSlot(layout, slot);

  if (!resolvedSlot) {
    return layout;
  }

  const nextLayout = cloneEntryHeaderLayout(layout);
  nextLayout.lines[resolvedSlot.lineIndex][resolvedSlot.side][resolvedSlot.slotIndex] = value || null;
  return nextLayout;
}

function findEntryHeaderFieldSlot(layout, field) {
  for (let lineIndex = 0; lineIndex < 2; lineIndex += 1) {
    for (const side of ['left', 'right']) {
      const slots = layout?.lines?.[lineIndex]?.[side] || [];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        if (layout?.lines?.[lineIndex]?.[side]?.[slotIndex] === field) {
          return { lineIndex, side, slotIndex };
        }
      }
    }
  }

  return null;
}

function findEmptyEntryHeaderSlot(layout) {
  for (let lineIndex = 0; lineIndex < 2; lineIndex += 1) {
    for (const side of ['left', 'right']) {
      const slots = layout?.lines?.[lineIndex]?.[side] || [];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        if (!layout?.lines?.[lineIndex]?.[side]?.[slotIndex]) {
          return { lineIndex, side, slotIndex };
        }
      }
    }
  }

  return null;
}

export function normalizeEntryHeaderLayout(sectionKind, layout) {
  const fields = getEntryHeaderLayoutFields(sectionKind);
  const defaultLayout = getDefaultEntryHeaderLayout(sectionKind);

  if (!defaultLayout) {
    return null;
  }

  const fieldSet = new Set(fields);
  const usedFields = new Set();
  let normalizedLayout = {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [0, 1].map((lineIndex) => ({
      left: defaultLayout.lines[lineIndex].left.map((_, slotIndex) => {
        const field = layout?.lines?.[lineIndex]?.left?.[slotIndex];

        if (!fieldSet.has(field) || usedFields.has(field)) {
          return null;
        }

        usedFields.add(field);
        return field;
      }),
      right: defaultLayout.lines[lineIndex].right.map((_, slotIndex) => {
        const field = layout?.lines?.[lineIndex]?.right?.[slotIndex];

        if (!fieldSet.has(field) || usedFields.has(field)) {
          return null;
        }

        usedFields.add(field);
        return field;
      }),
    })),
  };

  fields
    .filter((field) => !usedFields.has(field))
    .forEach((field) => {
      const defaultSlot = findEntryHeaderFieldSlot(defaultLayout, field);
      const targetSlot = defaultSlot && getEntryHeaderLayoutSlot(normalizedLayout, defaultSlot) === null
        ? defaultSlot
        : findEmptyEntryHeaderSlot(normalizedLayout);

      if (targetSlot) {
        normalizedLayout = setEntryHeaderLayoutSlot(normalizedLayout, targetSlot, field);
        usedFields.add(field);
      }
    });

  return normalizedLayout;
}

export function moveSectionHeaderField(layout, fromSlot, toSlot) {
  const fromField = getEntryHeaderLayoutSlot(layout, fromSlot);

  if (!fromField) {
    return cloneEntryHeaderLayout(layout);
  }

  const toField = getEntryHeaderLayoutSlot(layout, toSlot) || null;
  let nextLayout = setEntryHeaderLayoutSlot(layout, fromSlot, toField);
  nextLayout = setEntryHeaderLayoutSlot(nextLayout, toSlot, fromField);

  return nextLayout;
}
