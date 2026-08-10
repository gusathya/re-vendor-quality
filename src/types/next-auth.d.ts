import type { UserRole } from '@/lib/db/users';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      vendorId: string | null;
    };
  }
}
