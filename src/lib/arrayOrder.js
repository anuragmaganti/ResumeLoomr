import { trimText } from './text.js';

export function moveItem(array, index, direction) {
  const targetIndex = index + direction;

  if (index < 0 || targetIndex < 0 || targetIndex >= array.length) {
    return array;
  }

  const nextItems = [...array];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item);
  return nextItems;
}

export function moveItemToIndex(array, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const nextItems = [...array];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export function moveItemById(items, itemId, direction) {
  return moveItem(items, items.findIndex((item) => item.id === itemId), direction);
}

export function reorderItemSubsetById(items, orderedItemIds) {
  const requestedIds = Array.isArray(orderedItemIds) ? orderedItemIds.map(trimText).filter(Boolean) : [];
  const requestedIdSet = new Set(requestedIds);
  const itemById = new Map(items.map((item) => [item.id, item]));

  if (
    requestedIds.length === 0 ||
    requestedIdSet.size !== requestedIds.length ||
    requestedIds.some((itemId) => !itemById.has(itemId))
  ) {
    return items;
  }

  const reorderedItems = requestedIds.map((itemId) => itemById.get(itemId));
  let reorderedIndex = 0;

  return items.map((item) => {
    if (!requestedIdSet.has(item.id)) {
      return item;
    }

    const nextItem = reorderedItems[reorderedIndex];
    reorderedIndex += 1;
    return nextItem;
  });
}
