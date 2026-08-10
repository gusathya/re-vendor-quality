export { auth as middleware } from '@/lib/auth';

// Auth.js's config in `@/lib/auth` pulls in `better-sqlite3` (via the Credentials
// provider's `authorize` -> getDb()), a native Node addon that cannot run on the
// default Edge middleware runtime. Force the Node.js runtime for this middleware so
// that native module works instead of failing to bundle for Edge.
export const runtime = 'nodejs';

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};
