import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { getPreviewEditorLabel } from '../lib/editorTargets.js';

export default function MobilePreviewEditorProxy({
    session,
    inputRef,
    onBlur,
    onCaretEvent,
    onChange,
    onCommit,
    onProxyTap,
}) {
    const isComposingRef = useRef(false);
    const pointerDownRef = useRef(null);

    if (!session || typeof document === 'undefined') {
        return null;
    }

    const proxy = (
        <textarea
            ref={inputRef}
            className="mobilePreviewEditorProxy"
            data-mobile-preview-editor="true"
            aria-label={getPreviewEditorLabel(session.target)}
            value={session.value}
            rows={session.isMultiline ? 3 : 1}
            inputMode={session.inputMode}
            enterKeyHint={session.isMultiline ? 'enter' : 'done'}
            autoCapitalize={session.inputMode === 'text' ? 'sentences' : 'none'}
            autoCorrect={session.inputMode === 'text' ? 'on' : 'off'}
            spellCheck={session.inputMode === 'text'}
            style={session.proxyStyle || undefined}
            onBeforeInput={(event) => {
                if (!session.isMultiline && event.nativeEvent.inputType === 'insertLineBreak') {
                    event.preventDefault();
                    onCommit();
                }
            }}
            onBlur={onBlur}
            onChange={onChange}
            onCompositionStart={() => {
                isComposingRef.current = true;
            }}
            onCompositionEnd={(event) => {
                isComposingRef.current = false;
                onCaretEvent(event);
            }}
            onFocus={onCaretEvent}
            onInput={onCaretEvent}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCommit();
                    return;
                }

                if (
                    event.key === 'Enter'
                    && !session.isMultiline
                    && !isComposingRef.current
                    && !event.nativeEvent.isComposing
                ) {
                    event.preventDefault();
                    onCommit();
                }
            }}
            onKeyUp={onCaretEvent}
            onPointerDown={(event) => {
                pointerDownRef.current = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    timeStamp: event.timeStamp,
                };
            }}
            onPointerUp={(event) => {
                const pointerDown = pointerDownRef.current;
                pointerDownRef.current = null;
                const isShortTap = pointerDown?.pointerId === event.pointerId
                    && event.timeStamp - pointerDown.timeStamp < 350
                    && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 8;

                if (isShortTap) {
                    onProxyTap(event);
                    return;
                }

                onCaretEvent(event);
            }}
            onSelect={onCaretEvent}
        />
    );

    return createPortal(proxy, document.body);
}
