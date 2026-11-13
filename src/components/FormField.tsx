import { useId, type ReactNode } from 'react';

/**
 * Wraps a labeled form control with consistent spacing and styling.
 * The child render prop receives the generated id to wire up `htmlFor`.
 */
interface FormFieldProps {
  label: string;
  children: (fieldId: string) => ReactNode;
}

export default function FormField({ label, children }: FormFieldProps) {
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-sm font-medium text-gray-300">
        {label}
      </label>
      {children(fieldId)}
    </div>
  );
}
