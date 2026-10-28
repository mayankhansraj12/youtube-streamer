import { useState, type FormEvent } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { useAuth } from '../context/authState';
import { authApi, getErrorMessage } from '../lib/api';
import { inputClass, primaryButtonClass } from '../lib/formStyles';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await authApi.login({ identifier: identifier.trim(), password });
      login(session);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught, 'Sign in failed. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue"
      error={error}
      footer={
        <>
          New to StreamSync?{' '}
          <Link to="/signup" className="font-medium text-brand-text transition hover:text-brand-cyan">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <FormField id="login-identifier" label="Username or email">
          <input
            id="login-identifier"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="yourname or you@example.com"
            className={inputClass}
          />
        </FormField>

        <FormField id="login-password" label="Password">
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-white/50 transition hover:text-white"
            >
              {showPassword ? <FaEyeSlash size={14} aria-hidden="true" /> : <FaEye size={14} aria-hidden="true" />}
            </button>
          </div>
        </FormField>

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
