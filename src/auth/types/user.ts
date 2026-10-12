export type Role = 'customer' | 'staff' | 'admin';

export interface User {
  id: string;
  email: string;
  /** Whether the owner proved the address, e.g. by using a magic link or a reset link. */
  emailVerified: boolean;
  roles: Role[];
}