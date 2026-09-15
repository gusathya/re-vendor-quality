'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      setError(
        result.error === "CredentialsSignin"
          ? "Invalid email or password"
          : `Sign-in failed (${result.error})`,
      );
      return;
    }
    router.push('/');
  }

  return (
    <main className="login-page">
      <form onSubmit={handleSubmit} className="login-form">
        <h1>Vendor MES — Sign In</h1>
        {error && <p className="login-error">{error}</p>}
        <label>
          Email
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Sign In</button>
      </form>
    </main>
  );
}
