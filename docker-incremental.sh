#!/bin/sh
# Incrementally rebuild and restart the Boko container.
#
# Usage:
#   ./docker-incremental.sh          # rebuild backend image and restart boko
#   ./docker-incremental.sh backend  # same as default
#   ./docker-incremental.sh frontend # frontend files are bind-mounted; just ensure boko is running

set -eu

cd "$(dirname "$0")"

MODE="${1:-backend}"
BOKO_PORT="${BOKO_PORT:-8287}"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

wait_for_boko() {
    i=1
    while [ "$i" -le 30 ]; do
        if curl -fsS "http://127.0.0.1:${BOKO_PORT}/api/profile" >/dev/null 2>&1; then
            echo "Boko is ready: http://localhost:${BOKO_PORT}/"
            return 0
        fi
        sleep 1
        i=$((i + 1))
    done

    echo "Boko did not become ready in time. Recent logs:"
    docker compose logs --tail=80 boko
    return 1
}

build_boko() {
    if docker compose build boko; then
        return 0
    fi

    echo "Build failed once; retrying in 3 seconds..."
    sleep 3
    docker compose build boko
}

case "$MODE" in
    backend|all)
        echo "Incremental backend rebuild with Docker BuildKit cache..."
        build_boko
        docker compose up -d --no-deps boko
        wait_for_boko
        ;;
    frontend|static)
        echo "Frontend files are bind-mounted into the container."
        echo "No image rebuild is needed. Ensuring boko is running..."
        docker compose up -d --no-deps boko
        wait_for_boko
        echo "Refresh the browser to see index.html/css/js/img changes."
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 2
        ;;
esac
