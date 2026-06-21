export function Container({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[var(--color-line)] bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50';
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-800',
    secondary:
      'border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-surface)]',
    ghost: 'text-[var(--color-muted)] hover:text-[var(--color-ink)]',
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm text-[var(--color-muted)]">{label}</span>}
      <input
        className={`w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

export function Badge({ status }) {
  const map = {
    publicada: 'bg-brand-50 text-brand-800',
    rascunho: 'bg-amber-50 text-amber-700',
    encerrada: 'bg-stone-100 text-stone-500',
  };
  const label = { publicada: 'Publicada', rascunho: 'Rascunho', encerrada: 'Encerrada' };
  return (
    <span className={`rounded-md px-2.5 py-1 text-xs ${map[status] || 'bg-stone-100 text-stone-500'}`}>
      {label[status] || status}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      rows={3}
      className={`w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${className}`}
      {...props}
    />
  );
}
