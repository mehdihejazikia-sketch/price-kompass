export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <circle cx="28" cy="28" r="13" fill="none" stroke="var(--accent-fg)" strokeWidth="5" />
      <path d="M38 38l11 11" stroke="var(--accent-fg)" strokeWidth="6" strokeLinecap="round" />
      <path d="M22 28h12M28 22v12" stroke="var(--accent-fg)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
