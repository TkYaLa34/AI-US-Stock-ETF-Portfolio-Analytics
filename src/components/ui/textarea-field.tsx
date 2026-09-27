'use client';

import { useId } from 'react';

export interface TextareaFieldProps {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
  defaultValue?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * A labelled <textarea>, matching FormField's error and hint affordances.
 */
export function TextareaField({
  label,
  name,
  placeholder,
  required = false,
  maxLength,
  rows = 3,
  defaultValue,
  error,
  hint,
  disabled = false,
}: TextareaFieldProps) {
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

      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full resize-y rounded-lg border bg-surface-raised px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? 'border-red-500/70 focus:border-red-500'
            : 'border-surface-border focus:border-brand-500'
        }`}
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
