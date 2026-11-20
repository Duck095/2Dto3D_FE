import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getOrCreateDesignCommandKey,
    markDesignCommandKeyOutcome,
} from './designCommandIdempotency.js';

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
    };
}

test('same owner, operation, and payload reuse a persisted key across reload', async () => {
    const storage = createStorage();
    let created = 0;
    const createKey = () => 'key-' + (++created);
    const first = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        decision: 'APPROVED', feedback: '',
    }, { createKey });
    const afterReload = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        feedback: '', decision: 'APPROVED',
    }, { createKey });
    assert.equal(afterReload.key, first.key);
    assert.equal(created, 1);
});

test('an unresolved command blocks a new payload but permits retry with the same key', async () => {
    const storage = createStorage();
    let created = 0;
    const createKey = () => 'key-' + (++created);
    const first = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'references-generate', {
        viewSlot: null, revisionFeedback: null,
    }, { createKey });
    const sameRequest = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'references-generate', {
        revisionFeedback: null, viewSlot: null,
    }, { createKey });
    const changedRequest = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'references-generate', {
        viewSlot: 'front', revisionFeedback: 'Improve the front',
    }, { createKey });
    assert.equal(sameRequest.key, first.key);
    assert.equal(changedRequest.blocked, true);
    assert.equal(created, 1);
});

test('a resolved command can be followed by a different intentional command', async () => {
    const storage = createStorage();
    let created = 0;
    const createKey = () => 'key-' + (++created);
    const command = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        decision: 'CHANGES_REQUESTED', feedback: 'Revise the front',
    }, { createKey });
    markDesignCommandKeyOutcome(storage, command, 'accepted');
    const next = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        decision: 'APPROVED', feedback: '',
    }, { createKey });
    assert.equal(next.key, 'key-2');
});

test('a definitively rejected command can be followed by a new intentional payload', async () => {
    const storage = createStorage();
    let created = 0;
    const createKey = () => 'key-' + (++created);
    const rejected = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        decision: 'APPROVED', feedback: '',
    }, { createKey });
    markDesignCommandKeyOutcome(storage, rejected, 'rejected');
    const next = await getOrCreateDesignCommandKey(storage, 'owner-a', 'project-a', 'reference-approval-v1', {
        decision: 'CHANGES_REQUESTED', feedback: 'Revise the front',
    }, { createKey });
    assert.equal(next.key, 'key-2');
    assert.equal(next.blocked, false);
});
