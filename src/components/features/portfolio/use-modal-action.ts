'use client';

/**
 * Wires a Server Action to a modal and closes the modal when the write lands.
 *
 * Two things every Phase 3 form needs, in one place:
 *
 *  1. useActionState, so the action gets (previousState, formData) and the
 *     returned PortfolioActionState drives the inline errors.
 *
 *  2. Close on success only. useActionState keeps the last returned state, so a
 *     modal that is unmounted and reopened would otherwise see a stale
 *     "success" and close itself immediately. Every caller remounts its modals
 *     with a fresh `key`, which resets both the state and this ref - that is why
 *     the guard is a ref and not a state comparison.
 */

import { useActionState, useEffect, useRef } from 'react';

import {
  INITIAL_PORTFOLIO_ACTION_STATE,
  type PortfolioActionState,
} from '@/lib/portfolio/types';

export type PortfolioServerAction = (
  previousState: PortfolioActionState,
  formData: FormData,
) => Promise<PortfolioActionState>;

export interface ModalAction {
  state: PortfolioActionState;
  formAction: (formData: FormData) => void;
}

export function useModalAction(
  action: PortfolioServerAction,
  onSuccess: () => void,
): ModalAction {
  const [state, formAction] = useActionState(
    action,
    INITIAL_PORTFOLIO_ACTION_STATE,
  );

  const notified = useRef(false);

  useEffect(() => {
    if (state.status !== 'success' || notified.current) {
      return;
    }

    notified.current = true;
    onSuccess();
  }, [state, onSuccess]);

  return { state, formAction };
}
