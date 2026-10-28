import { useState, type FormEvent } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { LIMITS } from '../config';
import { useAuth } from '../context/authState';
import { authApi, getErrorMessage } from '../lib/api';
import { inputClass, primaryButtonClass } from '../lib/formStyles';

export default function Signup() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      const session = await authApi.signup({
        username: username.trim(),
        email: email.trim() || undefined,
        password,
      });
      login(session);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(getErrorMessage(caught, 'Account creation failed. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start watching together"
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-text transition hover:text-brand-cyan">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <FormField
          id="signup-username"
          label="Username"
          hint="3 to 24 characters: letters, numbers, underscores, dots, or hyphens."
        >
          <input
            id="signup-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_.\-]{3,24}"
            aria-describedby="signup-username-hint"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="your_name"
            className={inputClass}
          />
        </FormField>

        <FormField id="signup-email" label="Email (optional)" hint="Lets you sign in with your email as well as your username.">
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-describedby="signup-email-hint"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </FormField>

        <FormField id="signup-password" label="Password" hint={`At least ${LIMITS.minPasswordLength} characters.`}>
          <div className="relative">
            <input
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={LIMITS.minPasswordLength}
              aria-describedby="signup-password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a password"
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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
