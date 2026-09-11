// src/lib/auth.ts
import NextAuth, { type User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getDb } from './db/client';
import { getUserByEmail, type UserRole } from './db/users';
import { verifyCredentials } from './auth-credentials';

// The base next-auth `User` type only declares id/name/email/image. We stash our own
// role/vendorId on the object returned from `authorize`, then read them back out (via
// this same shape) in the `jwt` callback below. Using a named interface here — instead
// of `any` — keeps the cast explicit while satisfying the no-explicit-any lint rule.
interface AuthorizedUser {
  id: string;
  email: string;
  role: UserRole;
  vendorId: string | null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = getUserByEmail(getDb(), email);
        const valid = await verifyCredentials(user, password);
        if (!valid || !user) return null;

        const authorized: AuthorizedUser = {
          id: user.id,
          email: user.email,
          role: user.role,
          vendorId: user.vendorId,
        };
        return authorized as unknown as User;
      },
    }),
  ],
  callbacks: {
    // Without this callback the default middleware behavior treats every request as
    // authorized (see next-auth/lib/index.js), which would silently defeat the route
    // protection this task exists to add. Returning !!auth?.user is what actually makes
    // the middleware redirect unauthenticated requests to the `pages.signIn` page.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        const authorized = user as unknown as AuthorizedUser;
        token.role = authorized.role;
        token.vendorId = authorized.vendorId;
      }
      return token;
    },
    session({ session, token }) {
      // `token.sub` is set automatically by Auth.js from the `id` returned by
      // `authorize()` (via the internal jwt handling that runs before our `jwt`
      // callback above). The `Session.user` type declares `id: string` (see
      // src/types/next-auth.d.ts), but nothing previously copied it from the token
      // onto the session object, so `session.user.id` was silently `undefined` at
      // runtime. Task 13's SOP upload action is the first caller that reads
      // `session.user.id` (as `uploaded_by`), which is what surfaced this.
      session.user.id = token.sub as string;
      session.user.role = token.role as UserRole;
      session.user.vendorId = token.vendorId as string | null;
      return session;
    },
  },
});
