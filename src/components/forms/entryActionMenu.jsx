import { useEffect, useRef, useState } from "react";

export default function EntryActionMenu({
  menuLabel,
  triggerContent = '•••',
  buttonClassName = '',
  moveUpLabel,
  moveDownLabel,
  removeLabel,
  onMoveUp,
  onMoveDown,
  onRemove,
  extraItems = [],
  disableUp = false,
  disableDown = false,
  disableRemove = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const runAction = (callback) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div className={`entryMenu${isOpen ? " isOpen" : ""}`} ref={menuRef}>
      <button
        className={`button buttonSecondary entryMenuButton ${buttonClassName}`.trim()}
        type="button"
        aria-label={menuLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        {triggerContent}
      </button>

      {isOpen ? (
        <div className="entryMenuPopover" role="menu" aria-label={menuLabel}>
          {extraItems.map((item) => (
            <button
              key={item.key ?? item.label}
              className={`entryMenuItem${item.tone === "danger" ? " entryMenuItemDanger" : ""}`}
              type="button"
              role="menuitem"
              aria-label={item.ariaLabel ?? item.label}
              onClick={() => runAction(item.onSelect)}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
          {onMoveUp ? (
            <button
              className="entryMenuItem"
              type="button"
              role="menuitem"
              aria-label={moveUpLabel}
              onClick={() => runAction(onMoveUp)}
              disabled={disableUp}
            >
              Move up
            </button>
          ) : null}
          {onMoveDown ? (
            <button
              className="entryMenuItem"
              type="button"
              role="menuitem"
              aria-label={moveDownLabel}
              onClick={() => runAction(onMoveDown)}
              disabled={disableDown}
            >
              Move down
            </button>
          ) : null}
          {onRemove ? (
            <button
              className="entryMenuItem entryMenuItemDanger"
              type="button"
              role="menuitem"
              aria-label={removeLabel}
              onClick={() => runAction(onRemove)}
              disabled={disableRemove}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
