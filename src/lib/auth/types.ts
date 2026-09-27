/**
 * Shared shapes for the sign-in / sign-up server actions.
 *
 * This file deliberately has NO 'use server' directive: Next.js only allows a
 * file to export async functions when it does, and the initial state constant
 * below needs to live somewhere importable from a client component.
 */

export type AuthField =
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'fullName'
  | 'portfolioName';

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface AuthActionState {
  status: 'idle' | 'error' | 'success';
  /** Human readable, already localised to Thai. */
  message: string | null;
  fieldErrors: AuthFieldErrors;
}

export const INITIAL_AUTH_STATE: AuthActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
};

/** Where to send a visitor once they are known to be signed in. */
export const DEFAULT_AUTHENTICATED_PATH = '/dashboard';
