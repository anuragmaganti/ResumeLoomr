import AutoResizeTextarea from "../autoResizeTextarea";
import EntryActionMenu from "./entryActionMenu";
import FormFieldError from "./formFieldError";

export default function ReorderableTextList({
  label,
  items,
  idPrefix,
  pathPrefix,
  placeholder,
  addLabel,
  getFieldError,
  markTouched,
  onChangeItem,
  onMoveItem,
  onRemoveItem,
  onAddItem
}) {
  return (
    <div className="field">
      <label>{label}</label>

      {items.map((item, itemIndex) => (
        <div className="activityRow" key={`${idPrefix}-${itemIndex}`}>
          <div className="activityInputWrap">
            <AutoResizeTextarea
              id={`${idPrefix}-${itemIndex}`}
              value={item}
              onChange={(event) => onChangeItem(itemIndex, event.target.value)}
              onBlur={() => markTouched(`${pathPrefix}.${itemIndex}`)}
              rows={2}
              placeholder={placeholder}
            />
            <FormFieldError message={getFieldError(`${pathPrefix}.${itemIndex}`)} />
          </div>

          <div className="activityActions">
            <EntryActionMenu
              menuLabel={`${label} ${itemIndex + 1} actions`}
              moveUpLabel={`Move ${label.toLowerCase()} ${itemIndex + 1} up`}
              moveDownLabel={`Move ${label.toLowerCase()} ${itemIndex + 1} down`}
              removeLabel={`Remove ${label.toLowerCase()} ${itemIndex + 1}`}
              onMoveUp={() => onMoveItem(itemIndex, -1)}
              onMoveDown={() => onMoveItem(itemIndex, 1)}
              onRemove={() => onRemoveItem(itemIndex)}
              disableUp={itemIndex === 0}
              disableDown={itemIndex === items.length - 1}
            />
          </div>
        </div>
      ))}

      <button className="button buttonSecondary addInlineButton" type="button" onClick={onAddItem}>
        {addLabel}
      </button>
    </div>
  );
}
