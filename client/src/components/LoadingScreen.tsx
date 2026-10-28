interface LoadingScreenProps {
  label?: string;
}

export default function LoadingScreen({ label = 'Loading' }: LoadingScreenProps) {
  return (
    <div role="status" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-black text-brand-dim">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-cyan" aria-hidden="true" />
      <p className="text-sm tracking-wide">{label}…</p>
    </div>
  );
}
