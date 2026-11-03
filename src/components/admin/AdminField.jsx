import { useId } from 'react';

export default function AdminField({
  as = 'input',
  id,
  label,
  hint,
  error,
  required = false,
  className = '',
  children,
  type = 'text',
  'aria-describedby': describedBy,
  ...props
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const helpIds = [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  const Control = as === 'select' ? 'select' : 'input';

  return (
    <div className={`admin-field ${className}`.trim()}>
      <label className="admin-field__label" htmlFor={fieldId}>
        {label}
        {required && <span className="admin-field__required" aria-hidden="true"> *</span>}
      </label>
      <Control
        {...props}
        id={fieldId}
        type={Control === 'input' ? type : undefined}
        required={required}
        aria-describedby={helpIds}
        aria-invalid={error ? 'true' : undefined}
        className={`admin-field__control${error ? ' admin-field__control--error' : ''}`}
      >
        {Control === 'select' ? children : undefined}
      </Control>
      {hint && <p className="admin-field__hint" id={hintId}>{hint}</p>}
      {error && <p className="admin-field__error" id={errorId}>{error}</p>}
    </div>
  );
}
