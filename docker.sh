#!/bin/bash
# docker.sh — 构建并运行 Boko 博客（Rust + Axum + SQLite）
#
# 部署策略（全部在 Docker 容器内完成，不依赖本机 cargo / rust）：
#   1. 构建阶段：基于 rust:slim 容器，配置国内镜像源（清华 TUNA / 阿里云）
#      加速 cargo 下载，编译出 release 二进制
#   2. 发布阶段：基于 debian:bookworm-slim 容器，挂载项目目录，
#      运行编译好的二进制并托管前端静态文件
#
# 环境变量：
#   BOKO_PORT       监听端口（默认 8287）
#   BOKO_DB_PATH    SQLite 数据库路径（默认 ./data/boko.db）
#   BOKO_STATIC_DIR 静态前端目录（默认脚本所在目录）
#   RUST_MIRROR     cargo 镜像源：tuna（清华，默认）| aliyun（阿里）| official

set -e
cd "$(dirname "$0")"

BOKO_PORT="${BOKO_PORT:-8287}"
BOKO_DB_PATH="${BOKO_DB_PATH:-$(pwd)/data/boko.db}"
BOKO_STATIC_DIR="${BOKO_STATIC_DIR:-$(pwd)}"
RUST_MIRROR="${RUST_MIRROR:-tuna}"

mkdir -p "$(dirname "$BOKO_DB_PATH")"

# 记录开始时间（用于统计总耗时）
START_TIME=$(date +%s)

# ========== 工具函数 ==========

# 跨平台 timeout（macOS 默认没有 timeout 命令）
run_with_timeout() {
    local secs=$1; shift
    if command -v timeout >/dev/null 2>&1; then
        timeout "$secs" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$secs" "$@"
    else
        # macOS fallback：后台运行 + sleep + kill
        "$@" &
        local pid=$!
        (
            sleep "$secs"
            kill -TERM "$pid" 2>/dev/null
            sleep 2
            kill -KILL "$pid" 2>/dev/null
        ) &
        local watcher=$!
        wait "$pid" 2>/dev/null
        local status=$?
        kill "$watcher" 2>/dev/null
        wait "$watcher" 2>/dev/null
        return $status
    fi
}

# 镜像拉取（带国内代理 fallback）
# 用法：pull_image_with_fallback "rust:slim" "rust:bookworm" ...
# 返回（stdout）：第一个可用的完整镜像名（含代理前缀）
pull_image_with_fallback() {
    local images=("$@")
    # 国内 Docker Hub 镜像代理（按可用性/稳定性排序）
    # 实测 2026-08：docker.1ms.run 最稳定，daocloud 下载大文件可能 EOF
    local proxies=(
        "docker.1ms.run/"
        "docker.xuanyuan.me/"
        "docker.m.daocloud.io/"
        "ccr.ccs.tencentyun.com/"
        "dockerproxy.com/"
        "hub-mirror.c.163.com/"
        ""
    )

    for img in "${images[@]}"; do
        for proxy in "${proxies[@]}"; do
            local full="${proxy}${img}"
            printf "        尝试 %s ... " "$full" >&2
            if run_with_timeout 180 docker pull "$full" >/dev/null 2>&1; then
                printf "OK\n" >&2
                echo "$full"
                return 0
            else
                printf "失败\n" >&2
            fi
        done
    done
    return 1
}

# 格式化耗时（秒 → "1m23s"）
format_duration() {
    local secs=$1
    if [ "$secs" -lt 60 ]; then
        echo "${secs}s"
    else
        printf "%dm%ds\n" $((secs / 60)) $((secs % 60))
    fi
}

# ========== 1. 停止旧实例 ==========
echo "==> 1. 停止旧实例"
# 清理旧的本机进程（兼容历史遗留）
if [ -f .boko.pid ]; then
    OLD_PID=$(cat .boko.pid 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        kill "$OLD_PID" 2>/dev/null || true
        echo "    已停止旧进程 PID=$OLD_PID"
    fi
    rm -f .boko.pid
fi
# 清理旧容器（用分号分隔，避免 && 链在容器不存在时跳过后续）
docker stop boko 2>/dev/null; docker rm boko 2>/dev/null; echo "    已清理旧容器"
# 清理旧的构建容器（可能有残留）
docker ps -a --filter "name=boko-build-" -q | xargs -r docker rm -f 2>/dev/null || true

# Docker 可用性检查
if ! command -v docker >/dev/null 2>&1; then
    echo "错误：未检测到 Docker。请先安装 Docker Desktop。"
    exit 1
fi

# ========== 2. 生成 cargo 镜像配置 ==========
echo "==> 2. 生成 cargo 镜像配置 [$RUST_MIRROR]"

MIRROR_CARGO_TOML=""
RUSTUP_DIST_SERVER=""
RUSTUP_UPDATE_ROOT=""
APT_SOURCES=""

case "$RUST_MIRROR" in
    tuna|tsinghua)
        MIRROR_CARGO_TOML="[source.crates-io]
replace-with = 'tuna'

[source.tuna]
registry = 'https://mirrors.tuna.tsinghua.edu.cn/git/crates.io-index.git'

[net]
git-fetch-with-cli = true
"
        RUSTUP_DIST_SERVER="https://mirrors.tuna.tsinghua.edu.cn/rustup"
        RUSTUP_UPDATE_ROOT="https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup"
        APT_SOURCES="# Debian bookworm 清华源
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-backports main contrib non-free non-free-firmware
deb https://mirrors.tuna.tsinghua.edu.cn/debian-security/ bookworm-security main contrib non-free non-free-firmware
"
        ;;
    aliyun|ali)
        MIRROR_CARGO_TOML="[source.crates-io]
replace-with = 'aliyun'

[source.aliyun]
registry = 'https://code.aliyun.com/rustcc/crates.io-index'

[net]
git-fetch-with-cli = true
"
        RUSTUP_DIST_SERVER="https://mirrors.aliyun.com/rustup"
        RUSTUP_UPDATE_ROOT="https://mirrors.aliyun.com/rustup/rustup"
        APT_SOURCES="# Debian bookworm 阿里云源
deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware
deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware
deb https://mirrors.aliyun.com/debian/ bookworm-backports main contrib non-free non-free-firmware
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main contrib non-free non-free-firmware
"
        ;;
    official|"")
        : # 使用官方源
        ;;
    *)
        echo "错误：未知的 RUST_MIRROR 值 '$RUST_MIRROR'"
        echo "支持: tuna (清华) | aliyun (阿里) | official (官方)"
        exit 1
        ;;
esac

mkdir -p .docker-build
CARGO_CONFIG_FILE=".docker-build/cargo-config.toml"
APT_SOURCES_FILE=".docker-build/apt-sources.list"
printf '%s' "$MIRROR_CARGO_TOML" > "$CARGO_CONFIG_FILE"
printf '%s' "$APT_SOURCES" > "$APT_SOURCES_FILE"

if [ -s "$CARGO_CONFIG_FILE" ]; then
    echo "    cargo 镜像: $RUST_MIRROR ($(wc -l <"$CARGO_CONFIG_FILE" | tr -d ' ') 行配置)"
else
    echo "    cargo 镜像: official (无自定义配置)"
fi

# ========== 3. 构建阶段 ==========
BUILD_STEP_START=$(date +%s)
echo "==> 3. 构建 Rust 后端（容器内 cargo build）"

# 创建缓存卷（cargo 依赖缓存 + 编译产物缓存）
# 注意：registry 和 git 需要独立的卷，不能共用（否则目录结构会冲突）
for vol in boko-cargo-registry boko-cargo-git boko-target-cache; do
    if ! docker volume inspect "$vol" >/dev/null 2>&1; then
        docker volume create "$vol" >/dev/null
        echo "    已创建缓存卷: $vol"
    fi
done

# 拉取 Rust 构建镜像
# 不用带具体版本的 tag（如 rust:1.81-slim-bookworm），因为 Rust 版本更新很快
RUST_IMAGES=("rust:slim" "rust:bookworm" "rust:latest")
echo "    搜索可用 Rust 镜像（国内代理 fallback）..."
RUST_IMAGE=$(pull_image_with_fallback "${RUST_IMAGES[@]}") || {
    echo "错误：所有 Rust Docker 镜像（含国内代理）均无法拉取。"
    echo ""
    echo "请尝试以下方案之一："
    echo "  1. 配置 Docker Desktop 镜像加速器："
    echo "     Docker Desktop → Settings → Docker Engine → 添加:"
    echo '       "registry-mirrors": ["https://docker.1ms.run", "https://docker.m.daocloud.io"]'
    echo "  2. 使用阿里云容器镜像服务（需登录）："
    echo "     https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors"
    echo "  3. 检查网络代理设置（VPN / 透明代理可能拦截 docker pull）"
    exit 1
}
echo "    Rust 镜像: $RUST_IMAGE"

# 构建挂载参数（避免 word splitting，用数组）
BUILD_MOUNTS=(
    -v "$(pwd)":/build:ro
    -v boko-cargo-registry:/usr/local/cargo/registry
    -v boko-cargo-git:/usr/local/cargo/git
    -v boko-target-cache:/cargo-target
    -v "$(pwd)/.docker-build/output":/output
)
[ -s "$CARGO_CONFIG_FILE" ] && BUILD_MOUNTS+=(-v "$(pwd)/$CARGO_CONFIG_FILE:/root/.cargo/config.toml:ro")
[ -s "$APT_SOURCES_FILE" ]  && BUILD_MOUNTS+=(-v "$(pwd)/$APT_SOURCES_FILE:/etc/apt/sources.list:ro")
[ -n "$RUSTUP_DIST_SERVER" ] && BUILD_MOUNTS+=(-e "RUSTUP_DIST_SERVER=$RUSTUP_DIST_SERVER" -e "RUSTUP_UPDATE_ROOT=$RUSTUP_UPDATE_ROOT")

# 准备输出目录
BUILD_OUTPUT=".docker-build/output"
rm -rf "$BUILD_OUTPUT" && mkdir -p "$BUILD_OUTPUT"

echo "    开始构建..."
# 在容器内执行 cargo build，直接输出编译过程（不 tail），同时保存日志
BUILD_LOG=".docker-build/build.log"
if ! docker run --rm \
    "${BUILD_MOUNTS[@]}" \
    "$RUST_IMAGE" \
    sh -c '
        set -e
        cd /build/backend
        export CARGO_TARGET_DIR=/cargo-target
        echo "[builder] CARGO_TARGET_DIR=$CARGO_TARGET_DIR"
        echo "[builder] cargo build --release 开始..."
        cargo build --release 2>&1
        BIN="$CARGO_TARGET_DIR/release/boko-backend"
        if [ -f "$BIN" ]; then
            cp "$BIN" /output/boko-backend
            echo "[builder] 构建完成: $(ls -lh /output/boko-backend | awk "{print \$5}")"
        else
            echo "[builder] ERROR: 未找到二进制 $BIN"
            exit 1
        fi
    ' 2>&1 | tee "$BUILD_LOG" | grep -E '^\[builder\]|error|warning|Compiling boko|Finished'; then
    echo "错误：构建失败。完整日志见 $BUILD_LOG"
    tail -30 "$BUILD_LOG"
    exit 1
fi

BUILT_BIN="$BUILD_OUTPUT/boko-backend"
if [ ! -f "$BUILT_BIN" ]; then
    echo "错误：构建成功但未输出二进制 $BUILT_BIN"
    exit 1
fi

BUILD_STEP_END=$(date +%s)
echo "    构建产物: $(du -h "$BUILT_BIN" | cut -f1), 耗时 $(format_duration $((BUILD_STEP_END - BUILD_STEP_START)))"

# ========== 4. 启动运行容器 ==========
echo "==> 4. 启动 Boko 容器"

# 拉取 runtime 镜像
RT_IMAGES=("debian:bookworm-slim" "debian:bookworm" "ubuntu:22.04")
echo "    搜索可用 runtime 镜像..."
RT_IMAGE=$(pull_image_with_fallback "${RT_IMAGES[@]}") || {
    echo "    警告：拉取不到轻量 runtime 镜像，复用构建镜像"
    RT_IMAGE="$RUST_IMAGE"
}
echo "    runtime 镜像: $RT_IMAGE"

# 启动容器
# 二进制挂载到 /opt/boko/ 而非 /app/bin/，因为 /app 是只读挂载
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
    sh -c 'echo "Starting boko-backend..."; exec /opt/boko/boko-backend' \
    >/dev/null

echo "    容器已启动: boko (端口 $BOKO_PORT)"

# ========== 5. 健康检查 ==========
echo "==> 5. 健康检查"
HEALTH_OK=false
for i in $(seq 1 30); do
    if curl -sf -o /dev/null "http://127.0.0.1:$BOKO_PORT/api/profile" 2>/dev/null; then
        echo "    API 就绪（第 ${i} 次轮询, ${i}x2=$((i*2))s）"
        HEALTH_OK=true
        break
    fi
    sleep 2
done

if [ "$HEALTH_OK" = false ]; then
    echo "    警告：健康检查超时（60s），API 未就绪"
    echo "    查看容器日志: docker logs boko"
    exit 1
fi

END_TIME=$(date +%s)
echo
echo "========================================================"
echo "  部署完成！总耗时 $(format_duration $((END_TIME - START_TIME)))"
echo "  首页       http://localhost:$BOKO_PORT/"
echo "  管理员     admin / admin123"
echo "  查看日志   docker logs -f boko"
echo "  停止服务   docker stop boko"
echo "  数据目录   $(pwd)/data/"
echo "  构建日志   .docker-build/build.log"
echo "  切换镜像源 RUST_MIRROR=aliyun ./docker.sh"
echo "========================================================"
