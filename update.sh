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
PROJ_ROOT="$(pwd)"

BOKO_PORT="${BOKO_PORT:-8287}"
BOKO_DB_PATH="${BOKO_DB_PATH:-$PROJ_ROOT/data/boko.db}"
BOKO_STATIC_DIR="${BOKO_STATIC_DIR:-$PROJ_ROOT}"
BUILD_OUTPUT_DIR="$PROJ_ROOT/.docker-build/output"
BUILD_OUTPUT_REL=".docker-build/output"
START_TIME=$(date +%s)

# 查找本地已有的 Rust 镜像（匹配 rust 或 */rust 格式，含代理前缀）
find_rust_image() {
    docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
        | grep -iE '(^|/)rust:' | head -1
}

# 停止/删除旧容器（兼容 set -e 下非零返回）
stop_container() {
    local name="$1"
    docker stop "$name" 2>/dev/null || true
    docker rm "$name" 2>/dev/null || true
}

# ========== 0. 停止旧容器 ==========
echo "==> 0. 停止旧容器"
stop_container boko
# 顺带清理旧版 docker.sh 遗留的 my-blog（会占用 8287）
stop_container my-blog
echo "    已停止"

# ========== 1. 判断是否需要重新编译 ==========
SKIP_BUILD=false
if [ "$1" = "--fe" ] || [ "$1" = "-f" ]; then
    SKIP_BUILD=true
fi

RUST_IMAGE=$(find_rust_image)
if [ -z "$RUST_IMAGE" ]; then
    echo "    未找到本地 Rust 镜像，回退到完整部署"
    exec ./docker.sh
fi

if [ "$SKIP_BUILD" = true ]; then
    echo "==> 1. 跳过后端编译（--fe 模式：仅前端改动）"

    # 校验已有二进制：
    #   a) 存在
    #   b) 是 Linux ELF（不是宿主 macOS Mach-O）
    # 缺失时尝试从 docker cargo 缓存卷复制
    BIN_PATH="$BUILD_OUTPUT_DIR/boko-backend"
    NEED_RESCUE=false
    if [ ! -f "$BIN_PATH" ]; then
        NEED_RESCUE=true
    else
        ELF_MAGIC=$(head -c 4 "$BIN_PATH" 2>/dev/null | od -An -c 2>/dev/null | tr -d ' ')
        if [ "$ELF_MAGIC" != "177ELF" ]; then
            echo "    ⚠️  现有 $BUILD_OUTPUT_REL/boko-backend 非 Linux ELF（宿主编译产物？），从缓存卷恢复"
            NEED_RESCUE=true
        fi
    fi

    if [ "$NEED_RESCUE" = true ]; then
        echo "    从 Docker cargo 缓存卷 (boko-target-cache) 提取 Linux 二进制..."
        rm -rf "$BUILD_OUTPUT_DIR" && mkdir -p "$BUILD_OUTPUT_DIR"
        if ! docker run --rm \
            -v boko-target-cache:/cargo-target \
            -v "$BUILD_OUTPUT_DIR:/output" \
            "$RUST_IMAGE" \
            sh -c '
                set -e
                if [ -f /cargo-target/release/boko-backend ]; then
                    cp /cargo-target/release/boko-backend /output/boko-backend
                    chmod +x /output/boko-backend
                    echo "[rescue] 提取成功: $(ls -lh /output/boko-backend | awk "{print \$5}")"
                else
                    echo "[rescue] 缓存卷中没有 boko-backend，请先运行 ./update.sh（不带 --fe）完整编译" 1>&2
                    exit 2
                fi
            ' 2>&1; then
            echo "错误：无法从缓存卷恢复二进制，请去掉 --fe 参数重新编译"
            exit 1
        fi
    fi
else
    echo "==> 1. 重新编译 Rust 后端（增量编译）"

    # 复用 docker.sh 已创建的镜像源配置
    CARGO_CONFIG_FILE="$PROJ_ROOT/.docker-build/cargo-config.toml"

    echo "    使用镜像: $RUST_IMAGE"

    # 构建挂载参数（全部用绝对路径，避免 cd 上下文歧义）
    BUILD_MOUNTS=(
        -v "$PROJ_ROOT:/build:ro"
        -v boko-cargo-registry:/usr/local/cargo/registry
        -v boko-cargo-git:/usr/local/cargo/git
        -v boko-target-cache:/cargo-target
        -v "$BUILD_OUTPUT_DIR:/output"
    )
    if [ -s "$CARGO_CONFIG_FILE" ]; then
        BUILD_MOUNTS+=(-v "$CARGO_CONFIG_FILE:/root/.cargo/config.toml:ro")
    fi

    rm -rf "$BUILD_OUTPUT_DIR" && mkdir -p "$BUILD_OUTPUT_DIR"

    echo "    开始增量编译..."
    set +e
    DOCKER_BUILD_OUTPUT=$(docker run --rm \
        "${BUILD_MOUNTS[@]}" \
        "$RUST_IMAGE" \
        sh -c '
            set -e
            cd /build/backend
            export CARGO_TARGET_DIR=/cargo-target
            cargo build --release 2>&1 | tee /tmp/build.log
            cp "$CARGO_TARGET_DIR/release/boko-backend" /output/boko-backend
            chmod +x /output/boko-backend
            echo "[builder] 完成: $(ls -lh /output/boko-backend | awk "{print \$5}")"
            # 如果有 warning/error，grep 会过滤掉最后一句完成提示，这里兜底输出
            echo "[builder] 编译结束"
        ' 2>&1)
    BUILD_EXIT=$?
    set -e
    echo "$DOCKER_BUILD_OUTPUT" | grep -E '^\[builder\]|error|warning|Compiling boko|Finished' || true
    if [ "$BUILD_EXIT" -ne 0 ]; then
        echo "错误：编译失败（exit=$BUILD_EXIT）"
        exit 1
    fi
fi

# ========== 2. 启动前二次校验二进制 ==========
echo "==> 2. 校验二进制"
BIN_PATH="$BUILD_OUTPUT_DIR/boko-backend"
if [ ! -f "$BIN_PATH" ]; then
    echo "错误：$BUILD_OUTPUT_REL/boko-backend 不存在，请去掉 --fe 参数重新编译"
    exit 1
fi
ELF_MAGIC=$(head -c 4 "$BIN_PATH" | od -An -c | tr -d ' ')
if [ "$ELF_MAGIC" != "177ELF" ]; then
    echo "错误：$BUILD_OUTPUT_REL/boko-backend 不是 Linux ELF（当前文件头: $ELF_MAGIC），可能是宿主 macOS 编译产物，容器内无法运行"
    exit 1
fi
BIN_SIZE=$(wc -c < "$BIN_PATH" | tr -d ' ')
echo "    OK: ELF Linux 二进制，大小 ${BIN_SIZE} 字节"

# ========== 3. 启动新容器 ==========
echo "==> 3. 启动容器"

# 查找已拉取的 runtime 镜像（匹配 debian/ubuntu，含代理前缀）
RT_IMAGE=$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
    | grep -iE '(^|/)(debian|ubuntu):' | head -1)
if [ -z "$RT_IMAGE" ]; then
    RT_IMAGE="$RUST_IMAGE"
fi
echo "    runtime: $RT_IMAGE"

# 端口占用预检：如果 8287 被非 Docker 进程或其他容器占用，提前报错
if lsof -iTCP:"$BOKO_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    HOLDER=$(lsof -iTCP:"$BOKO_PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)
    if [ -n "$HOLDER" ]; then
        HOLDER_NAME=$(ps -p "$HOLDER" -o comm= 2>/dev/null || echo "PID $HOLDER")
        CONFLICT=$(docker ps --format '{{.Names}}' 2>/dev/null | while read n; do
            if docker port "$n" 2>/dev/null | grep -q ":$BOKO_PORT->"; then
                echo "$n"
                break
            fi
        done)
        if [ -n "$CONFLICT" ]; then
            echo "    端口 $BOKO_PORT 被容器 $CONFLICT 占用，尝试清理..."
            stop_container "$CONFLICT"
        else
            echo "    ⚠️  端口 $BOKO_PORT 被进程 $HOLDER_NAME (pid=$HOLDER) 占用，可能启动失败"
        fi
    fi
fi

docker run -d \
    -p "$BOKO_PORT:8287" \
    --name boko \
    --restart always \
    -v "$PROJ_ROOT:/app:ro" \
    -v "$PROJ_ROOT/data":/app/data \
    -v "$BUILD_OUTPUT_DIR:/opt/boko:ro" \
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
