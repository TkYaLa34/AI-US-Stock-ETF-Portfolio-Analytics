import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { PostgrestError } from '@supabase/supabase-js';

import { DashboardShell } from '@/components/features/portfolio/dashboard-shell';
import { DEFAULT_AUTHENTICATED_PATH } from '@/lib/auth/types';
import {
  allocationByAssetType,
  allocationBySector,
  summarisePortfolio,
} from '@/lib/portfolio/analytics';
import { PORTFOLIO_QUERY_PARAM } from '@/lib/portfolio/constants';
import { toErrorDetail } from '@/lib/portfolio/diagnostics';
import { toReadErrorMessage } from '@/lib/portfolio/errors';
import {
  listAssetsForPortfolios,
  listPortfolios,
  listRecentTransactions,
  selectPortfolio,
  toPositionViews,
} from '@/lib/portfolio/queries';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'แดชบอร์ด',
};

/**
 * The dashboard reads the session and the query string, so it can never be
 * statically prerendered. Next would infer this from `cookies()` and the
 * `searchParams` await, but stating it keeps the reason next to the code rather
 * than in a comment on someone else's line.
 */
export const dynamic = 'force-dynamic';

/** `?portfolio=` can legitimately arrive as an array from a crafted URL. */
function firstParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

/**
 * Collapses the read errors into one banner.
 *
 * The friendly sentence is what the user reads; `toReadBannerDetail` adds the raw
 * SQLSTATE underneath it, gated by the same SHOW_ERROR_DETAILS switch as the
 * write path (see src/lib/portfolio/diagnostics.ts). A missing migration surfaces
 * here as 42P01 on the dashboard rather than as a silently empty portfolio.
 */
function firstReadError(
  errors: readonly (PostgrestError | null)[],
): PostgrestError | null {
  return errors.find((error) => error !== null) ?? null;
}

function toReadBanner(
  errors: readonly (PostgrestError | null)[],
): string | null {
  const first = firstReadError(errors);

  return first === null
    ? null
    : `โหลดข้อมูลบางส่วนไม่สำเร็จ: ${toReadErrorMessage(first)}`;
}

function toReadBannerDetail(
  errors: readonly (PostgrestError | null)[],
): string | null {
  return toErrorDetail(firstReadError(errors));
}

/**
 * The portfolio dashboard.
 *
 * SERVER COMPONENT ON PURPOSE. It runs the RLS-scoped queries with the signed-in
 * user's session and reduces the rows to the four derived numbers the UI shows.
 * Only the dialog bookkeeping is a Client Component (DashboardShell), so no
 * portfolio data is fetched twice and the anon key never has to be exercised
 * from the browser.
 *
 * ROUTE PROTECTION IS LAYERED, and this file is the second layer:
 *   1. src/middleware.ts redirects an anonymous visitor to /login?next=... before
 *      the page is ever rendered, so nothing below runs for a signed-out user.
 *   2. The getUser() check below repeats the guard, so the page stays correct if
 *      it is ever rendered by something other than the middleware (a prefetch, a
 *      future route handler, a test harness).
 * RLS in Postgres remains the real boundary: a forged cookie yields no rows,
 *   not a 500 and not someone else's portfolio.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // OUTSIDE any try/catch: redirect() signals by throwing, and swallowing it
  // here would render the dashboard to a signed-out visitor.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(DEFAULT_AUTHENTICATED_PATH)}`);
  }

  const { data: portfolios, error: portfoliosError } = await listPortfolios();

  // A ?portfolio= the caller cannot see is not an error - it is a stale bookmark
  // or someone poking at the URL - so selectPortfolio falls back to the default.
  const selected = selectPortfolio(portfolios, firstParam(params[PORTFOLIO_QUERY_PARAM]));

  /*
   * Assets are fetched for EVERY portfolio in one round trip, not just the
   * selected one. The transaction form lets the user switch portfolio without
   * leaving the page, and a <select> cannot query the database, so the options
   * have to be here already. The rows are tiny.
   */
  const [assetsResult, transactionsResult] = await Promise.all([
    listAssetsForPortfolios(portfolios.map((portfolio) => portfolio.id)),
    selected
      ? listRecentTransactions(selected.id, 10)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const positions = selected
    ? toPositionViews(
        assetsResult.data.filter(
          (asset) => asset.portfolio_id === selected.id,
        ),
      )
    : [];

  const summary = selected
    ? summarisePortfolio(positions, selected.cash_balance, selected.base_currency)
    : null;

  /*
   * Collected once so the banner text and its raw detail below always describe
   * the same error, in the same order.
   */
  const readErrors = [
    portfoliosError,
    assetsResult.error,
    transactionsResult.error,
  ] as const;

  return (
    <DashboardShell
      userLabel={user.email ?? user.id}
      portfolios={portfolios}
      selectedPortfolio={selected}
      positions={positions}
      summary={summary}
      transactions={transactionsResult.data}
      allAssets={assetsResult.data}
      typeAllocation={allocationByAssetType(positions)}
      sectorAllocation={allocationBySector(positions)}
      readError={toReadBanner(readErrors)}
      readErrorDetail={toReadBannerDetail(readErrors)}
    />
  );
}

