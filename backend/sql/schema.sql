-- Boko blog SQLite schema (idempotent)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ========== Articles ==========
CREATE TABLE IF NOT EXISTS articles (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    date        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT '随笔',
    tags        TEXT NOT NULL DEFAULT '[]',     -- JSON array of strings
    read_count  INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    summary     TEXT NOT NULL DEFAULT '',
    cover       TEXT NOT NULL DEFAULT '',
    auto_cover  TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    featured    INTEGER NOT NULL DEFAULT 0,
    like_count  INTEGER NOT NULL DEFAULT 0,
    deleted_at  INTEGER,                        -- NULL = published; non-null = in trash (epoch ms)
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_articles_category   ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_date       ON articles(date);

-- ========== Article-scoped comments ==========
CREATE TABLE IF NOT EXISTS article_comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  INTEGER NOT NULL,
    name        TEXT NOT NULL DEFAULT '匿名',
    contact     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    date        TEXT NOT NULL,
    parent_id   INTEGER,                        -- NULL = top-level
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments(article_id);

-- ========== Site-wide guestbook comments ==========
CREATE TABLE IF NOT EXISTS site_comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL DEFAULT '匿名',
    contact     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    date        TEXT NOT NULL,
    parent_id   INTEGER
);

-- ========== Singleton: profile ==========
CREATE TABLE IF NOT EXISTS profile (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    name  TEXT NOT NULL,
    bio   TEXT NOT NULL,
    avatar TEXT NOT NULL,
    about TEXT NOT NULL,
    socials TEXT NOT NULL DEFAULT '[]',          -- JSON array of {label, value}
    qq      TEXT NOT NULL DEFAULT '',
    wechat  TEXT NOT NULL DEFAULT '',
    github  TEXT NOT NULL DEFAULT '',
    email   TEXT NOT NULL DEFAULT ''
);

-- Migration: add socials column if profile table already exists without it
-- (SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we use a pragma check)
-- This is handled in db.rs at startup.

-- ========== Singleton: home resume (stored as one JSON blob) ==========
CREATE TABLE IF NOT EXISTS home_resume (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    data  TEXT NOT NULL                          -- full JSON blob
);

-- ========== Friend links ==========
CREATE TABLE IF NOT EXISTS friend_links (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    url        TEXT NOT NULL,
    title_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- ========== Music playlist ==========
CREATE TABLE IF NOT EXISTS music_playlist (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id      TEXT NOT NULL DEFAULT '',       -- 原始 id (number 或 string)
    name         TEXT NOT NULL,
    artist       TEXT NOT NULL DEFAULT '未知艺术家',
    pic_url      TEXT NOT NULL DEFAULT '',
    url          TEXT NOT NULL DEFAULT '',       -- 音频直链
    song_id_enc  TEXT NOT NULL DEFAULT '',
    platform     TEXT NOT NULL DEFAULT 'netease',
    sort_order   INTEGER NOT NULL DEFAULT 0
);

-- ========== Singleton: music API base ==========
CREATE TABLE IF NOT EXISTS music_config (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    api_base TEXT NOT NULL DEFAULT 'https://netease-cloud-music-api.fe-mm.com'
);

-- ========== Categories & tags (admin-managed) ==========
CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS category_tags (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER NOT NULL,
    tag          TEXT NOT NULL,
    UNIQUE(category_id, tag),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ========== Singleton: visitor stats ==========
CREATE TABLE IF NOT EXISTS visitor_stats (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    pv          INTEGER NOT NULL DEFAULT 0,
    uv          INTEGER NOT NULL DEFAULT 0,
    last_visit  INTEGER NOT NULL DEFAULT 0       -- epoch ms
);

-- ========== Singleton: admin credentials (very minimal) ==========
CREATE TABLE IF NOT EXISTS admin_user (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL DEFAULT 'admin',
    password TEXT NOT NULL DEFAULT 'admin123'    -- 明文，仅作本地最小可用；生产请改用 hash
);

-- ========== Space feeds (动态/说说) ==========
CREATE TABLE IF NOT EXISTS space_feeds (
    id      INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    date    TEXT NOT NULL,
    images  TEXT NOT NULL DEFAULT '[]',          -- JSON array of URLs
    likes   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS space_feed_comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id     INTEGER NOT NULL,
    name        TEXT NOT NULL DEFAULT '匿名',
    contact     TEXT NOT NULL DEFAULT '',
    text        TEXT NOT NULL,
    date        TEXT NOT NULL,
    parent_id   INTEGER,                         -- NULL = top-level; non-null = reply
    FOREIGN KEY (feed_id) REFERENCES space_feeds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_space_feed_comments_feed ON space_feed_comments(feed_id);

-- ========== Generic key-value store (极简方案) ==========
-- Stores admin-managed config data that doesn't warrant its own table:
--   gallery_images, gallery_names, cover_usage,
--   article_content_images, other_images, files,
--   custom_admin_links, calendar_memos
CREATE TABLE IF NOT EXISTS kv_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL                           -- JSON blob
);

-- ========== Operation logs (审计日志 + 回滚) ==========
-- 记录所有管理员写操作，支持查询历史和回滚。
-- before_data / after_data 存储操作前后的完整 JSON 快照。
CREATE TABLE IF NOT EXISTS operation_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,                    -- 'create' | 'update' | 'delete'
    entity      TEXT NOT NULL,                    -- 'article' | 'profile' | 'feed' | 'comment' | 'friend_link' | 'category' | 'kv' | 'home_resume' | 'song'
    entity_id   TEXT,                             -- 记录 ID（profile/home_resume 单例用 '1'）
    before_data TEXT,                             -- 操作前 JSON（create 时 NULL）
    after_data  TEXT,                             -- 操作后 JSON（delete 时 NULL）
    operator    TEXT NOT NULL DEFAULT 'admin',    -- 操作者
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at DESC);

