import { KeyboardSensor, PointerSensor } from '@dnd-kit/core';

function isDragBlocked(event) {
  const target = event?.target instanceof Element ? event.target : null;

  return Boolean(target?.closest('[data-dnd-no-drag="true"]'));
}

export class ResumeLoomrPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown',
      handler: ({ nativeEvent }) => !isDragBlocked(nativeEvent),
    },
  ];
}

export class ResumeLoomrKeyboardSensor extends KeyboardSensor {
  static activators = [
    {
      eventName: 'onKeyDown',
      handler: ({ nativeEvent }) => !isDragBlocked(nativeEvent),
    },
  ];
}
