import { useId } from 'react';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'date';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: FormFieldType;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  defaultValue?: string | number;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Numeric constraints. Passed straight through to the input so the browser's
   * own stepper and validation match the server rules in
   * src/lib/portfolio/validation.ts.
   */
  min?: string | number;
  max?: string | number;
  step?: string | number;
  /**
   * Numeric keypad hint for mobile. `type="number"` already implies decimal on
   * most keyboards, but being explicit keeps iOS from showing the full pad.
   */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'search' | 'email' | 'tel' | 'url';
  /** Inline validation message; also wires up aria-invalid / aria-describedby. */
  error?: string;
  hint?: string;
  disabled?: boolean;
}

const CONTROL_STYLES =
  'w-full rounded-lg border bg-surface-raised px-3 py-2.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

/** Keeps the spinner usable on the dark surface instead of the default white. */
const NUMBER_STYLES = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';

/**
 * A labelled input with error and hint slots.
 *
 * No 'use client' on purpose: this holds no state of its own, so the parent
 * Client Component pulls it into the bundle automatically when it needs it.
 */
export function FormField({
  label,
  name,
  type = 'text',
  autoComplete,
  placeholder,
  required = false,
  minLength,
  maxLength,
  defaultValue,
  value,
  onChange,
  min,
  max,
  step,
  inputMode,
  error,
  hint,
  disabled = false,
}: FormFieldProps) {
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

      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${CONTROL_STYLES} ${
          type === 'number' ? NUMBER_STYLES : ''
        } ${error ? 'border-red-500/70 focus:border-red-500' : 'border-surface-border focus:border-brand-500'}`}
      />

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
