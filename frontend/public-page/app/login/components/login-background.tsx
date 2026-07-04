export function LoginBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-grid-fine opacity-60" />
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/8 blur-[140px]" />
      <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="grain" />
    </div>
  );
}
