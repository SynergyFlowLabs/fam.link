export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-xl font-semibold tracking-tight ${className}`}>
      <span className="text-evergreen">fam</span>
      <span className="text-ink">.link</span>
    </span>
  );
}
