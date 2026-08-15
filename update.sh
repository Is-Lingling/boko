#!/bin/bash
# update.sh — 修改代码后快速更新容器（复用已有镜像和缓存）
#
# 用法：
#   ./update.sh          # 重新编译后端 + 重启容器
#   ./update.sh --fe     # 仅重启容器（前端文件是挂载的，改完 JS/CSS/HTML 重启即可）
#
# 与 docker.sh 的区别：
#   - 不重新拉取镜像（复用已有的）
#   - 不重新生成镜像源配置
#   - 复用 cargo 缓存卷，增量编译更快
#   - 适合开发阶段频繁迭代

set -e
cd "$(dirname "$0")"

BOKO_PORT="${BOKO_PORT:-8287}"
BOKO_DB_PATH="${BOKO_DB_PATH:-$(pwd)/data/boko.db}"
BOKO_STATIC_DIR="${BOKO_STATIC_DIR:-$(pwd)}"
BUILD_OUTPUT=".docker-build/output"
START_TIME=$(date +%s)

# ========== 1. 停止旧容器 ==========
echo "==> 1. 停止旧容器"
docker stop boko 2>/dev/null; docker rm boko 2>/dev/null
echo "    已停止"

# ========== 2. 判断是否需要重新编译 ==========
SKIP_BUILD=false
if [ "$1" = "--fe" ] || [ "$1" = "-f" ]; then
    SKIP_BUILD=true
fi

if [ "$SKIP_BUILD" = true ]; then
    echo "==> 2. 跳过后端编译（--fe 模式：仅前端改动）"
else
    echo "==> 2. 重新编译 Rust 后端（增量编译）"

    # 复用 docker.sh 已创建的镜像源配置
    CARGO_CONFIG_FILE=".docker-build/cargo-config.toml"
    APT_SOURCES_FILE=".docker-build/apt-sources.list"

    # 查找已拉取的 Rust 镜像（不再重新拉取）
    RUST_IMAGE=""
    for img in $(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -i '^rust' | head -5); do
        RUST_IMAGE="$img"
        break
    done
    if [ -z "$RUST_IMAGE" ]; then
        echo "    未找到本地 Rust 镜像，回退到完整部署"
        exec ./docker.sh
    fi
    echo "    使用镜像: $RUST_IMAGE"

    # 构建挂载参数
    BUILD_MOUNTS=(
        -v "$(pwd)":/build:ro
        -v boko-cargo-registry:/usr/local/cargo/registry
        -v boko-cargo-git:/usr/local/cargo/git
        -v boko-target-cache:/cargo-target
        -v "$(pwd)/$BUILD_OUTPUT":/output
    )
    [ -s "$CARGO_CONFIG_FILE" ] && BUILD_MOUNTS+=(-v "$(pwd)/$CARGO_CONFIG_FILE:/root/.cargo/config.toml:ro")

    rm -rf "$BUILD_OUTPUT" && mkdir -p "$BUILD_OUTPUT"

    echo "    开始增量编译..."
    if ! docker run --rm \
        "${BUILD_MOUNTS[@]}" \
        "$RUST_IMAGE" \
        sh -c '
            set -e
            cd /build/backend
            export CARGO_TARGET_DIR=/cargo-target
            cargo build --release 2>&1
            cp "$CARGO_TARGET_DIR/release/boko-backend" /output/boko-backend
            echo "[builder] 完成: $(ls -lh /output/boko-backend | awk "{print \$5}")"
        ' 2>&1 | grep -E '^\[builder\]|error|warning|Compiling boko|Finished'; then
        echo "错误：编译失败"
        exit 1
    fi
fi

# ========== 3. 启动新容器 ==========
echo "==> 3. 启动容器"

# 查找已拉取的 runtime 镜像
RT_IMAGE=""
for img in $(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -iE '^debian|^ubuntu' | head -5); do
    RT_IMAGE="$img"
    break
done
[ -z "$RT_IMAGE" ] && RT_IMAGE="$RUST_IMAGE"
echo "    runtime: $RT_IMAGE"

docker run -d \
    -p "$BOKO_PORT:8287" \
    --name boko \
    --restart always \
    -v "$(pwd)":/app:ro \
    -v "$(pwd)/data":/app/data \
    -v "$(pwd)/$BUILD_OUTPUT:/opt/boko:ro" \
    -e BOKO_DB_PATH=/app/data/boko.db \
    -e BOKO_STATIC_DIR=/app \
    -e BOKO_PORT=8287 \
    -w /app/backend \
    "$RT_IMAGE" \
    sh -c 'exec /opt/boko/boko-backend' \
    >/dev/null

# ========== 4. 健康检查 ==========
echo "==> 4. 健康检查"
for i in $(seq 1 15); do
    if curl -sf -o /dev/null "http://127.0.0.1:$BOKO_PORT/api/profile" 2>/dev/null; then
        END_TIME=$(date +%s)
        echo "    API 就绪（${i}x2=$((i*2))s）"
        echo
        echo "========================================================"
        echo "  更新完成！耗时 $((END_TIME - START_TIME))s"
        echo "  首页       http://localhost:$BOKO_PORT/"
        echo "  仅前端改动 ./update.sh --fe"
        echo "  查看日志   docker logs -f boko"
        echo "========================================================"
        exit 0
    fi
    sleep 2
done

echo "    超时：API 未就绪，查看日志: docker logs boko"
exit 1
