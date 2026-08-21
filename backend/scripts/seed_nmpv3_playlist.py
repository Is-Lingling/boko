#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 NMPv3 默认歌单（网易云 playlist 14273792576 = "Umamusume: Pretty Derby 的动画歌单"）
写入 boko 博客后端 SQLite 的 music_playlist 表，替换原有歌单。

用法：
    python3 seed_nmpv3_playlist.py [--db PATH] [--api-base URL] [--playlist-id ID]

- 默认从网易云 API 实时拉取歌单曲目；若拉取失败，则回退到同目录的 nmpv3_playlist.json。
- 只填元数据（song_id / name / artist / pic_url / platform），音频地址由前端播放时按
  song id 实时解析（getNeteaseSongUrl -> meting / 外链），与原播放器行为一致。
- 仅修改 music_playlist 表，不动 music_config / 其它数据。

部署环境（Docker 命名卷 boko_data，DB 在 /app/data/boko.db）示例：
    docker run --rm -v boko_data:/data -v "$PWD/backend/scripts":/scripts python:3.12-slim \
        python3 /scripts/seed_nmpv3_playlist.py --db /data/boko.db
或（容器里已有 python3）：
    docker cp backend/scripts/seed_nmpv3_playlist.py boko:/tmp/
    docker exec boko python3 /tmp/seed_nmpv3_playlist.py --db /app/data/boko.db
"""

import argparse
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error

DEFAULT_API_BASE = "https://netease-cloud-music-api.fe-mm.com"
DEFAULT_PLAYLIST_ID = 14273792576
FALLBACK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nmpv3_playlist.json")


def log(*a):
    print("[seed-nmpv3]", *a, file=sys.stderr)


def detect_db_path(cli_db):
    if cli_db:
        return cli_db
    candidates = [
        "/app/data/boko.db",
        os.path.expanduser("~/.local/share/boko/boko.db"),
        os.path.join(os.getcwd(), "data", "boko.db"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "boko.db"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    # 若都找不到，默认用第一个候选（会让用户明确看到路径）
    return candidates[0]


def fetch_playlist(api_base, playlist_id):
    url = f"{api_base.rstrip('/')}/playlist/track/all?id={playlist_id}"
    log("fetching", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as e:
        log("live fetch failed:", e)
        return None
    songs = data.get("songs") or data.get("playlist", {}).get("tracks") or []
    if not songs:
        log("live fetch returned no songs")
        return None
    return [normalize(s) for s in songs]


def normalize(s):
    song_id = str(s.get("id", ""))
    name = s.get("name", "未知歌曲")
    artists = " & ".join(a.get("name", "") for a in s.get("ar", []))
    pic_url = (s.get("al") or {}).get("picUrl", "")
    return {
        "song_id": song_id,
        "name": name,
        "artist": artists or "未知艺术家",
        "pic_url": pic_url,
        "url": "",
        "song_id_enc": "",
        "platform": "netease",
    }


def load_fallback():
    if not os.path.isfile(FALLBACK_FILE):
        return None
    try:
        with open(FALLBACK_FILE, encoding="utf-8") as f:
            rows = json.load(f)
        log("using bundled fallback:", FALLBACK_FILE)
        return rows
    except Exception as e:
        log("fallback read failed:", e)
        return None


def seed(db_path, rows):
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='music_playlist'")
        if not cur.fetchone():
            raise SystemExit(f"错误：{db_path} 中没有 music_playlist 表，请确认这是 boko 的数据库")
        cur.execute("DELETE FROM music_playlist")
        cur.executemany(
            """INSERT INTO music_playlist
               (song_id, name, artist, pic_url, url, song_id_enc, platform, sort_order)
               VALUES (:song_id, :name, :artist, :pic_url, :url, :song_id_enc, :platform, :sort_order)""",
            [{**r, "sort_order": i} for i, r in enumerate(rows)],
        )
        conn.commit()
        count = cur.execute("SELECT COUNT(*) FROM music_playlist").fetchone()[0]
        log(f"完成：已写入 {count} 首到 {db_path}")
    finally:
        conn.close()
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", help="SQLite 数据库路径（默认自动探测）")
    ap.add_argument("--api-base", default=DEFAULT_API_BASE, help="网易云 API 代理基址")
    ap.add_argument("--playlist-id", type=int, default=DEFAULT_PLAYLIST_ID, help="歌单 ID")
    args = ap.parse_args()

    db_path = detect_db_path(args.db)
    log("target db:", db_path)
    if not os.path.isfile(db_path):
        log("警告：目标 DB 文件不存在，脚本将创建它（若这不是你预期的 DB，请用 --db 指定）")

    rows = fetch_playlist(args.api_base, args.playlist_id)
    if not rows:
        rows = load_fallback()
    if not rows:
        raise SystemExit("无法获取歌单数据（实时拉取与本地 fallback 均失败），终止。")

    log(f"准备写入 {len(rows)} 首：")
    for i, r in enumerate(rows):
        log(f"  {i + 1}. {r['name']} — {r['artist']}")
    seed(db_path, rows)


if __name__ == "__main__":
    main()
