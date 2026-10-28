import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-black px-6 text-center font-sans text-brand-text">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-dim">404</p>
      <h1 className="text-3xl font-bold">This page does not exist</h1>
      <p className="max-w-sm text-sm text-brand-dim">The link may be out of date, or the room may have been closed.</p>
      <Link to="/" className="mt-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200">
        Back to StreamSync
      </Link>
    </main>
  );
}
