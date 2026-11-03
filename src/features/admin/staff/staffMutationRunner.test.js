import assert from 'node:assert/strict';
import test from 'node:test';

let createStaffMutationRunner;
try {
  ({ createStaffMutationRunner } = await import('./staffMutationRunner.js'));
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('a response for profile A is stale after switching to profile B and cannot overwrite B or close its form', async () => {
  assert.equal(typeof createStaffMutationRunner, 'function');
  const runner = createStaffMutationRunner();
  const response = deferred();
  const view = { detail: { id: 'B' }, form: 'edit-B', feedback: '' };
  let listRefreshes = 0;
  const oldMutation = runner.run({
    request: () => response.promise,
    onSuccess: value => { view.detail = value; view.form = null; view.feedback = 'A saved'; },
    onSettled: result => { if (result.succeeded) listRefreshes += 1; },
  });

  runner.invalidate();
  response.resolve({ id: 'A' });
  const result = await oldMutation;

  assert.equal(result.status, 'stale-success');
  assert.deepEqual(view, { detail: { id: 'B' }, form: 'edit-B', feedback: '' });
  assert.equal(listRefreshes, 1);
});

test('a stale failure does not replace feedback in the new profile context', async () => {
  assert.equal(typeof createStaffMutationRunner, 'function');
  const runner = createStaffMutationRunner();
  const response = deferred();
  const view = { feedback: 'B detail is ready' };
  let displayedErrors = 0;
  const oldMutation = runner.run({
    request: () => response.promise,
    onError: () => { displayedErrors += 1; view.feedback = 'A failed'; },
  });
  runner.invalidate();
  response.reject(new Error('A failed'));
  assert.equal((await oldMutation).status, 'stale-error');
  assert.equal(displayedErrors, 0);
  assert.equal(view.feedback, 'B detail is ready');
});

test('the mutation runner prevents a second submit while the first request is unresolved', async () => {
  assert.equal(typeof createStaffMutationRunner, 'function');
  const runner = createStaffMutationRunner();
  const response = deferred();
  let requestCount = 0;
  const request = () => { requestCount += 1; return response.promise; };
  const first = runner.run({ request });
  const duplicate = await runner.run({ request });
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(requestCount, 1);
  response.resolve({ id: 7 });
  assert.equal((await first).status, 'success');
});
