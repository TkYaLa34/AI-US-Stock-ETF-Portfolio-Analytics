/**
 * Route constants shared by the dashboard page, the server actions and the
 * revalidatePath() calls that tie them together.
 *
 * A literal '/dashboard' typed in four places is one typo away from a stale
 * cache, which is the kind of bug that only shows up in production.
 */

/** The only protected screen Phase 3 ships. */
export const DASHBOARD_PATH = '/dashboard';

/** Query parameter that selects which portfolio the dashboard shows. */
export const PORTFOLIO_QUERY_PARAM = 'portfolio';
