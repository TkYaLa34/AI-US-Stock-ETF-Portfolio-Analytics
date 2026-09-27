'use client';

import { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  options: readonly SelectOption[];
  /** A first, non-selectable entry such as "เลือกพอร์ตโฟลิโอ...". */
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  /**
   * Passing `value` together with `onChange` makes this a controlled select,
   * which the transaction form uses to keep its asset list in step with the
   * chosen portfolio. Pass `defaultValue` instead for the uncontrolled case.
   */
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * A labelled <select> with the same error/hint affordances as FormField.
 *
 * No state of its own: useId only, so it works either controlled or not.
 */
export function SelectField({
  label,
  name,
  options,
  placeholder,
  required = false,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  disabled = false,
}: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>

      <select
        id={id}
        name={name}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-lg border bg-surface-raised px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? 'border-red-500/70 focus:border-red-500'
            : 'border-surface-border focus:border-brand-500'
        }`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      {hint ? (
        <p id={hintId} className="text-xs text-slate-400">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
