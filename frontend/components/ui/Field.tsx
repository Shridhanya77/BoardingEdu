import React from "react";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  error,
  hint,
  required,
  className = "",
  children,
}) => {
  const controlId = htmlFor;
  const cloned = React.cloneElement(children, {
    id: controlId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${controlId}-error` : undefined,
    className: `be-field__control ${children.props.className ?? ""}`.trim(),
  });

  return (
    <div className={`be-field ${className}`.trim()}>
      <label htmlFor={controlId} className="be-field__label">
        {label}
        {required && <span aria-hidden="true" style={{ color: "#c0392b", marginLeft: 2 }}>*</span>}
      </label>
      {cloned}
      {hint && !error && <span className="be-field__hint">{hint}</span>}
      {error && (
        <span id={controlId ? `${controlId}-error` : undefined} className="be-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default Field;
