export default function ThemedSwitch({
    checked,
    className = '',
    disabled = false,
    label,
    onChange,
}) {
    return (
        <label className={`themedSwitch${className ? ` ${className}` : ''}`}>
            <input
                type="checkbox"
                role="switch"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange?.(event.target.checked)}
            />
            <span className="themedSwitchTrack" aria-hidden="true" />
            <span className="themedSwitchLabel">{label}</span>
        </label>
    );
}
