/**
 * Runs once when the Next.js server starts.
 * DEV_INSECURE_TLS=true disables TLS verification in development only
 * (fixes UNABLE_TO_VERIFY_LEAF_SIGNATURE behind corporate proxies / AV SSL inspection).
 */
export async function register() {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.DEV_INSECURE_TLS === 'true'
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn(
      '[league-caster] DEV_INSECURE_TLS=true: TLS certificate verification is disabled for local dev only.'
    );
  }
}
