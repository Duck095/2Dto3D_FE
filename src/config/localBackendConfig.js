export function resolveBackendPort(value) {
    if (value === undefined || value === '') return 8080;

    if (typeof value !== 'string' || !/^\d{1,5}$/.test(value)) {
        throw new Error('BACKEND_PORT must be an integer between 1 and 65535');
    }

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('BACKEND_PORT must be an integer between 1 and 65535');
    }

    return port;
}
