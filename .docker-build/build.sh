#!/bin/sh
set -e
cd /build/backend

# 使用传入的 cargo 镜像配置（若存在）
if [ -f /root/.cargo/config.toml ]; then
    echo "[builder] 使用自定义 cargo 镜像配置"
fi

# 配置 rustup 镜像（若提供）
[ -n "$RUSTUP_DIST_SERVER" ] && echo "[builder] RUSTUP_DIST_SERVER=$RUSTUP_DIST_SERVER"

# 源码目录 /build 是只读挂载的，编译产物必须写到可写的 CARGO_TARGET_DIR
export CARGO_TARGET_DIR=/cargo-target
echo "[builder] CARGO_TARGET_DIR=$CARGO_TARGET_DIR"

echo "[builder] 开始 cargo build --release ..."
cargo build --release 2>&1 | tail -n 30

BIN="$CARGO_TARGET_DIR/release/boko-backend"
if [ -f "$BIN" ]; then
    # 复制到 /output，宿主机会通过卷映射拿到
    cp "$BIN" /output/boko-backend
    echo "[builder] 构建完成: $(ls -lh /output/boko-backend | awk '{print $5}')"
else
    echo "[builder] ERROR: 未找到二进制 $BIN"
    ls "$CARGO_TARGET_DIR/release/" 2>/dev/null | head -20 || echo "target dir 不存在"
    exit 1
fi
