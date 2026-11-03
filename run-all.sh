#!/usr/bin/env bash

set -Eeuo pipefail

frontend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
backend_dir="$(cd -- "$frontend_dir/../2Dto3D_BE" 2>/dev/null && pwd -P || true)"

if [[ -z "$backend_dir" || ! -f "$backend_dir/run-local.sh" || ! -f "$backend_dir/dev-env.sh" ]]; then
    printf 'Backend local launcher is incomplete. Expected run-local.sh and dev-env.sh under ../2Dto3D_BE.\n' >&2
    exit 1
fi

source "$backend_dir/dev-env.sh"
load_local_env "$backend_dir"
BACKEND_PORT="${BACKEND_PORT:-8080}"
export BACKEND_PORT
validate_backend_port

backend_log="$backend_dir/backend-local.log"
frontend_log="$frontend_dir/frontend-local.log"
if ! command -v sha256sum >/dev/null 2>&1; then
    printf 'sha256sum is required to verify the local Backend build before reusing a running service.\n' >&2
    exit 1
fi
APP_LOCAL_BUILD_ID="$(find "$backend_dir/src/main/java" "$backend_dir/src/main/resources" -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sha256sum \
    | awk '{print $1}')"
if [[ ! "$APP_LOCAL_BUILD_ID" =~ ^[[:xdigit:]]{64}$ ]]; then
    printf 'Could not calculate the local Backend build fingerprint. No services were started or stopped.\n' >&2
    exit 1
fi
export APP_LOCAL_BUILD_ID
backend_job_pid=""
frontend_job_pid=""
backend_windows_pid=""
frontend_windows_pid=""

port_pid() {
    local port="$1"
    powershell.exe -NoProfile -Command \
        "\$connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if (\$connection) { \$connection.OwningProcess }" \
        2>/dev/null | tr -d '\r[:space:]' || true
}

backend_matches_source() {
    local url="http://127.0.0.1:$BACKEND_PORT/api/auth/ping"
    local body build_id
    body="$(curl -fsS --max-time 3 "$url" 2>/dev/null || true)"
    [[ "$body" == "ok" ]] || return 1
    build_id="$(curl -fsS --max-time 3 -D - -o /dev/null "$url" 2>/dev/null \
        | tr -d '\r' \
        | awk 'tolower($1) == "x-backend-build-id:" { value = $2 } END { print value }')"
    [[ "$build_id" == "$APP_LOCAL_BUILD_ID" ]]
}

wait_for_url() {
    local url="$1"
    local job_pid="$2"
    local label="$3"
    local attempts="${4:-180}"

    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
            return 0
        fi
        if [[ -n "$job_pid" ]] && ! kill -0 "$job_pid" 2>/dev/null; then
            printf '%s exited during startup. See its local log for details.\n' "$label" >&2
            return 1
        fi
        sleep 1
    done

    printf '%s did not become ready within %s seconds. See its local log for details.\n' "$label" "$attempts" >&2
    return 1
}

cleanup() {
    trap - EXIT INT TERM
    if [[ -z "$frontend_windows_pid" && -z "$backend_windows_pid" && -z "$frontend_job_pid" && -z "$backend_job_pid" ]]; then
        return
    fi

    printf '\nStopping only services started by run-all.sh...\n'
    if [[ -n "$frontend_windows_pid" ]]; then
        taskkill.exe /PID "$frontend_windows_pid" /T /F >/dev/null 2>&1 || true
    fi
    if [[ -n "$backend_windows_pid" ]]; then
        taskkill.exe /PID "$backend_windows_pid" /T /F >/dev/null 2>&1 || true
    fi
    if [[ -n "$frontend_job_pid" ]]; then
        kill "$frontend_job_pid" >/dev/null 2>&1 || true
    fi
    if [[ -n "$backend_job_pid" ]]; then
        kill "$backend_job_pid" >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT INT TERM

if ! command -v npm >/dev/null 2>&1; then
    printf 'Node.js and npm are required to start the frontend, but npm was not found on PATH.\n' >&2
    exit 1
fi

existing_backend_pid="$(port_pid "$BACKEND_PORT")"
existing_frontend_pid="$(port_pid 3000)"
existing_backend_body="$(curl -fsS --max-time 3 "http://127.0.0.1:$BACKEND_PORT/api/auth/ping" 2>/dev/null || true)"

if [[ -n "$existing_backend_pid" || "$existing_backend_body" == "ok" ]]; then
    if [[ "$existing_backend_body" != "ok" ]]; then
        printf 'Port %s is occupied by PID %s, but it is not a responding Morphia backend. No process was stopped.\n' "$BACKEND_PORT" "$existing_backend_pid" >&2
        exit 1
    fi
    if ! backend_matches_source; then
        printf 'Backend on port %s (reported PID %s) is stale or unverified: its build fingerprint does not match current source. No process was stopped. Verify ownership, restart the workspace Backend, and retry.\n' "$BACKEND_PORT" "${existing_backend_pid:-unknown}" >&2
        exit 1
    fi
    printf 'Local backend is already responding on port %s (PID %s).\n' "$BACKEND_PORT" "${existing_backend_pid:-unknown}"
else
    validate_local_database_config
    printf 'Starting local backend on port %s. Log: %s\n' "$BACKEND_PORT" "$backend_log"
    bash "$backend_dir/run-local.sh" >"$backend_log" 2>&1 &
    backend_job_pid="$!"
    if ! wait_for_url "http://127.0.0.1:$BACKEND_PORT/api/auth/ping" "$backend_job_pid" "Backend" 180; then
        exit 1
    fi
    if ! backend_matches_source; then
        printf 'Backend started but its build fingerprint does not match current source. See %s.\n' "$backend_log" >&2
        exit 1
    fi
    backend_pid_candidate="$(port_pid "$BACKEND_PORT")"
    if [[ "$backend_pid_candidate" =~ ^[1-9][0-9]*$ ]]; then
        backend_windows_pid="$backend_pid_candidate"
    fi
fi

existing_frontend_pid="$(port_pid 3000)"
if [[ -z "$existing_frontend_pid" ]]; then
    printf 'Starting frontend on port 3000. Log: %s\n' "$frontend_log"
    (
        cd "$frontend_dir"
        npm run dev -- --host 127.0.0.1 --port 3000 --strictPort >"$frontend_log" 2>&1
    ) &
    frontend_job_pid="$!"
    if ! wait_for_url 'http://127.0.0.1:3000' "$frontend_job_pid" 'Frontend' 60; then
        exit 1
    fi
    frontend_pid_candidate="$(port_pid 3000)"
    if [[ "$frontend_pid_candidate" =~ ^[1-9][0-9]*$ ]]; then
        frontend_windows_pid="$frontend_pid_candidate"
    fi
else
    if ! curl -fsS --max-time 3 'http://127.0.0.1:3000' | grep -qi 'Morphia'; then
        printf 'Port 3000 is occupied by PID %s, but it is not a responding Morphia frontend. No process was stopped.\n' "$existing_frontend_pid" >&2
        exit 1
    fi
    printf 'Frontend is already responding on port 3000 (PID %s).\n' "$existing_frontend_pid"
fi

printf '\nLocal development environment is ready:\n'
printf '  Frontend: http://127.0.0.1:3000\n'
printf '  Backend:  http://127.0.0.1:%s\n' "$BACKEND_PORT"

if [[ -z "$backend_job_pid" && -z "$frontend_job_pid" ]]; then
    trap - EXIT INT TERM
    exit 0
fi

printf 'Press Ctrl+C to stop only the services started by this launcher.\n'
while true; do
    if [[ -n "$backend_job_pid" ]] && ! kill -0 "$backend_job_pid" 2>/dev/null; then
        printf 'Backend stopped. See local log: %s\n' "$backend_log" >&2
        exit 1
    fi
    if [[ -n "$frontend_job_pid" ]] && ! kill -0 "$frontend_job_pid" 2>/dev/null; then
        printf 'Frontend stopped. See local log: %s\n' "$frontend_log" >&2
        exit 1
    fi
    sleep 2
done
