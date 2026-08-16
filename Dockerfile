# syntax=docker/dockerfile:1.7
FROM docker.1ms.run/rust:alpine AS builder
RUN apk add --no-cache musl-dev
RUN mkdir -p /root/.cargo && \
    echo '[source.crates-io]' > /root/.cargo/config.toml && \
    echo 'replace-with = "tuna"' >> /root/.cargo/config.toml && \
    echo '[source.tuna]' >> /root/.cargo/config.toml && \
    echo 'registry = "https://mirrors.tuna.tsinghua.edu.cn/git/crates.io-index.git"' >> /root/.cargo/config.toml && \
    echo '[net]' >> /root/.cargo/config.toml && \
    echo 'git-fetch-with-cli = true' >> /root/.cargo/config.toml
WORKDIR /build
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    mkdir src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && rm -rf src
COPY backend/src ./src
COPY backend/sql ./sql
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    touch src/main.rs && cargo build --release --bin boko-backend && \
    mkdir -p /output && cp /build/target/release/boko-backend /output/

FROM docker.1ms.run/alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
RUN mkdir -p /app/data /app/static
COPY --from=builder /output/boko-backend /app/boko-backend
COPY index.html /app/
COPY css /app/css
COPY js /app/js
COPY img /app/img
RUN chmod +x /app/boko-backend
EXPOSE 8287
ENV BOKO_PORT=8287 \
    BOKO_DB_PATH=/app/data/boko.db \
    BOKO_STATIC_DIR=/app
CMD ["/app/boko-backend"]
