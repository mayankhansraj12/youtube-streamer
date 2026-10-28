import type { ReactNode } from 'react';
import { FaVideo } from 'react-icons/fa';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared frame for the login and signup pages. */
export default function AuthLayout({ title, subtitle, error, children, footer }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-brand-black p-4 font-sans">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-brand-cyan/5 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-brand-purple/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/5 bg-brand-surface/60 p-6 shadow-glass backdrop-blur-xl sm:p-8">
        <div className="mb-8 flex justify-center">
          <div className="rounded-2xl bg-gradient-to-tr from-brand-cyan to-brand-purple p-0.5 shadow-glow-cyan">
            <div className="rounded-2xl bg-brand-black p-3">
              <FaVideo className="text-2xl text-white" aria-hidden="true" />
            </div>
          </div>
        </div>

        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-brand-text">{title}</h1>
        <p className="mb-8 text-center text-sm uppercase tracking-widest text-brand-dim">{subtitle}</p>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {children}

        <div className="mt-8 text-center text-sm text-brand-dim">{footer}</div>
      </div>
    </main>
  );
}
