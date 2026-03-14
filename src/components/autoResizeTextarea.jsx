import { useLayoutEffect, useRef } from "react";

export default function AutoResizeTextarea({ className = "", onInput, value, ...props }) {
    const textareaRef = useRef(null);

    function syncHeight() {
        const textarea = textareaRef.current;

        if (!textarea) {
            return;
        }

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }

    useLayoutEffect(() => {
        syncHeight();
    }, [value]);

    return (
        <textarea
            {...props}
            ref={textareaRef}
            value={value}
            className={["autoResizeTextarea", className].filter(Boolean).join(" ")}
            onInput={(event) => {
                syncHeight();
                onInput?.(event);
            }}
        />
    );
}
