/**
 * Turns internal error text into something a non-technical user can act on.
 *
 * The detailed version is still available under Setup → Advanced → Diagnose; the
 * main screens only ever show the short form.
 */
export function friendlySyncProblem(raw: string | null): string | null {
  if (!raw) return null;

  if (/quota of 0|quota is literally 0|not granted this project access/i.test(raw)) {
    return 'Google is still approving access for this account. Nothing for you to do — we keep checking automatically.';
  }
  if (/not enabled|SERVICE_DISABLED/i.test(raw)) {
    return 'A Google setting still needs switching on. Open Setup → Advanced settings for the details.';
  }
  if (/reconnect|invalid_grant|UNAUTHENTICATED|rejected the credentials/i.test(raw)) {
    return 'Your Google connection has expired. Open Setup and reconnect the account.';
  }
  if (/no Business Profile accounts|owner or manager|no locations/i.test(raw)) {
    return 'We could not find a verified business on this Google account. Check the account you connected manages one.';
  }
  return 'We could not load your locations yet. Open Setup → Advanced settings to see why.';
}
