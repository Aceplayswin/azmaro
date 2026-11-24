import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<ComponentProps<"input">, "id"> {
  label: string;
  error?: string | null;
  hint?: string;
  prefix?: string;
  wrapperClassName?: string;
}

/** Labelled input with inline error message wired up for screen readers. */
export function Field({ label, error, hint, prefix, wrapperClassName, className, ...props }: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={wrapperClassName}>
      <label htmlFor={id} className="az-field-label">
        {label}
        {props.required && <span className="sr-only"> (required)</span>}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-0 grid w-12 place-items-center border-r border-line-soft text-sm text-ink-2">
            {prefix}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("az-input", prefix && "pl-15", className)}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends Omit<ComponentProps<"textarea">, "id"> {
  label: string;
  error?: string | null;
}

export function TextAreaField({ label, error, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="az-field-label">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn("az-input min-h-32 resize-y", className)}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends Omit<ComponentProps<"select">, "id"> {
  label: string;
  error?: string | null;
  options: readonly string[];
  placeholder?: string;
}

export function SelectField({ label, error, options, placeholder, className, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="az-field-label">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn("az-input appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23d2ad70' stroke-width='1.2'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
