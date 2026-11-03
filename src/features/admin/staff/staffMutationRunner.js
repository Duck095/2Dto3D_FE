export function createStaffMutationRunner() {
  let contextVersion = 0;
  let inFlight = false;

  return {
    invalidate() {
      contextVersion += 1;
      return contextVersion;
    },
    isInFlight() {
      return inFlight;
    },
    async run({ request, onSuccess, onError, onSettled } = {}) {
      if (inFlight) return { status: 'duplicate' };
      inFlight = true;
      const requestContext = contextVersion;
      let outcome;
      try {
        const value = await request();
        const stale = requestContext !== contextVersion;
        outcome = { status: stale ? 'stale-success' : 'success', value, stale, succeeded: true };
        if (!stale) onSuccess?.(value);
        return outcome;
      } catch (error) {
        const stale = requestContext !== contextVersion;
        outcome = { status: stale ? 'stale-error' : 'error', error, stale, succeeded: false };
        if (!stale) onError?.(error);
        return outcome;
      } finally {
        inFlight = false;
        onSettled?.(outcome);
      }
    },
  };
}
