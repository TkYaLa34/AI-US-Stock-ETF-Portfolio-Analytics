import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * Signs the user out and returns them to the landing page.
 *
 * POST only. A GET sign-out would let any `<img src="/auth/signout">` on a
 * malicious page log the user out, so the button has to submit a form.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if the network call fails, send them to a page that will see a
    // signed-out browser session rather than stranding them on a dead one.
  }

  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = '/';
  homeUrl.search = '';

  return NextResponse.redirect(homeUrl, { status: 303 });
}
