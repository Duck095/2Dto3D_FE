function canonicalize(value) {
    if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
    if (value && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalize(value[key])).join(',') + '}';
    }
    return JSON.stringify(value);
}

async function digest(value, cryptoApi) {
    if (typeof cryptoApi?.subtle?.digest !== 'function') throw new Error('Secure command fingerprinting is unavailable.');
    const bytes = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getOrCreateDesignCommandKey(
    storage,
    ownerKey,
    projectId,
    operation,
    payload,
    { createKey = () => globalThis.crypto.randomUUID(), cryptoApi = globalThis.crypto } = {},
) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function'
        || typeof ownerKey !== 'string' || !ownerKey || typeof projectId !== 'string' || !projectId
        || typeof operation !== 'string' || !operation) return { key: null, blocked: true };
    const scope = await digest(ownerKey + '\u001f' + projectId + '\u001f' + operation, cryptoApi);
    const fingerprint = await digest(canonicalize(payload), cryptoApi);
    const storageKey = '2dto3d.ai-studio.command.' + scope;
    let previous = null;
    try {
        const raw = storage.getItem(storageKey);
        if (raw !== null) {
            previous = JSON.parse(raw);
            if (!previous || typeof previous !== 'object'
                || typeof previous.fingerprint !== 'string'
                || typeof previous.key !== 'string'
                || !['unresolved', 'accepted', 'rejected'].includes(previous.outcome)) {
                return { key: null, blocked: true };
            }
        }
    } catch {
        return { key: null, blocked: true };
    }
    if (previous?.fingerprint === fingerprint) {
        return { key: previous.key, storageKey, fingerprint, outcome: previous.outcome, blocked: false };
    }
    if (previous?.outcome === 'unresolved') return { key: null, storageKey, fingerprint, blocked: true };

    const command = { key: createKey(), storageKey, fingerprint, outcome: 'unresolved', blocked: false };
    if (typeof command.key !== 'string' || !command.key.trim()) return { key: null, blocked: true };
    try {
        storage.setItem(storageKey, JSON.stringify({
            key: command.key,
            fingerprint,
            outcome: 'unresolved',
        }));
    } catch {
        return { key: null, blocked: true };
    }
    return command;
}

export function markDesignCommandKeyOutcome(storage, command, outcome) {
    if (!storage || !command?.storageKey || !command?.key || !command?.fingerprint
        || !['unresolved', 'accepted', 'rejected'].includes(outcome)) return false;
    try {
        storage.setItem(command.storageKey, JSON.stringify({
            key: command.key,
            fingerprint: command.fingerprint,
            outcome,
        }));
        command.outcome = outcome;
        return true;
    } catch {
        return false;
    }
}
