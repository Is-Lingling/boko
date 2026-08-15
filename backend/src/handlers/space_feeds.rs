//! Space feeds (动态/说说) CRUD + comments + likes.

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;
use std::collections::HashMap;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, OkResponse, SpaceFeed, SpaceFeedComment, SpaceFeedCommentInput, SpaceFeedInput, SpaceFeedLikeBody};

/// Build a flat list of comments into a nested structure (top-level + replies).
fn build_comment_tree(rows: Vec<(i64, String, String, String, String, Option<i64>)>) -> Vec<SpaceFeedComment> {
    let mut top_level: Vec<SpaceFeedComment> = Vec::new();
    let mut replies: HashMap<i64, Vec<SpaceFeedComment>> = HashMap::new();

    for (id, name, contact, text, date, parent_id) in rows {
        let cmt = SpaceFeedComment {
            id, name, contact, text, date, parent_id, replies: Vec::new(),
        };
        match parent_id {
            Some(pid) => replies.entry(pid).or_default().push(cmt),
            None => top_level.push(cmt),
        }
    }
    // Attach replies to their parents
    for cmt in &mut top_level {
        if let Some(reps) = replies.remove(&cmt.id) {
            cmt.replies = reps;
        }
    }
    top_level
}

fn load_feed_comments(conn: &rusqlite::Connection, feed_id: i64) -> Vec<SpaceFeedComment> {
    let mut stmt = match conn.prepare(
        "SELECT id, name, contact, text, date, parent_id FROM space_feed_comments WHERE feed_id=?1 ORDER BY id ASC"
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let rows: Vec<_> = stmt.query_map(params![feed_id], |r| {
        Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
    }).ok().into_iter().flatten().filter_map(|r| r.ok()).collect();
    build_comment_tree(rows)
}

/// Read a feed (without comments) by id. Returns None if the row doesn't exist.
fn read_feed(conn: &rusqlite::Connection, feed_id: i64) -> Option<SpaceFeed> {
    conn.query_row(
        "SELECT id, content, date, images, likes FROM space_feeds WHERE id=?1",
        params![feed_id],
        |r| {
            let images_json: String = r.get(3)?;
            let images: Vec<String> = serde_json::from_str(&images_json).unwrap_or_default();
            Ok(SpaceFeed {
                id: r.get(0)?,
                content: r.get(1)?,
                date: r.get(2)?,
                images,
                likes: r.get(4)?,
                comments: Vec::new(),
            })
        },
    ).ok()
}

/// GET /api/feeds
pub async fn list(State(db): State<Db>) -> ApiResult<Vec<SpaceFeed>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, content, date, images, likes FROM space_feeds ORDER BY id DESC")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let feed_rows: Vec<(i64, String, String, String, i64)> = stmt.query_map([], |r| {
        Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
    }).map_err(|e| AppError::internal(e.to_string()))?
      .filter_map(|r| r.ok()).collect();

    let mut feeds = Vec::with_capacity(feed_rows.len());
    for (id, content, date, images_json, likes) in feed_rows {
        let images: Vec<String> = serde_json::from_str(&images_json).unwrap_or_default();
        let comments = load_feed_comments(&conn, id);
        feeds.push(SpaceFeed { id, content, date, images, likes, comments });
    }
    Ok(Json(feeds))
}

/// GET /api/feeds/:id
pub async fn get_one(State(db): State<Db>, Path(id): Path<i64>) -> ApiResult<SpaceFeed> {
    let conn = db.lock().unwrap();
    let row = conn.query_row(
        "SELECT id, content, date, images, likes FROM space_feeds WHERE id=?1",
        params![id],
        |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?, r.get::<_, i64>(4)?)),
    ).map_err(|_| AppError::not_found(format!("feed {} not found", id)))?;
    let images: Vec<String> = serde_json::from_str(&row.3).unwrap_or_default();
    let comments = load_feed_comments(&conn, id);
    Ok(Json(SpaceFeed { id: row.0, content: row.1, date: row.2, images, likes: row.4, comments }))
}

/// POST /api/feeds  (admin)
pub async fn create(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(input): Json<SpaceFeedInput>,
) -> ApiResult<SpaceFeed> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let id = chrono::Utc::now().timestamp_millis();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M").to_string();
    let images_json = serde_json::to_string(&input.images).unwrap_or_else(|_| "[]".into());
    let conn = db.lock().unwrap();
    conn.execute(
        "INSERT INTO space_feeds (id, content, date, images, likes) VALUES (?1, ?2, ?3, ?4, 0)",
        params![id, input.content, now, images_json],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let feed = SpaceFeed {
        id, content: input.content, date: now, images: input.images, likes: 0, comments: Vec::new(),
    };
    log_operation::<SpaceFeed, SpaceFeed>(&conn, "create", "feed", Some(id.to_string()), None, Some(&feed));
    Ok(Json(feed))
}

/// PUT /api/feeds/:id  (admin)
pub async fn update(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<SpaceFeedInput>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let images_json = serde_json::to_string(&input.images).unwrap_or_else(|_| "[]".into());
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before = read_feed(&conn, id);
    let n = conn.execute(
        "UPDATE space_feeds SET content=?1, images=?2 WHERE id=?3",
        params![input.content, images_json, id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        if let Some(b) = &before {
            if let Some(a) = read_feed(&conn, id) {
                log_operation(&conn, "update", "feed", Some(id.to_string()), Some(b), Some(&a));
            }
        }
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// DELETE /api/feeds/:id  (admin)
pub async fn delete(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before = read_feed(&conn, id);
    let n = conn.execute("DELETE FROM space_feeds WHERE id=?1", params![id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        if let Some(b) = &before {
            log_operation::<SpaceFeed, SpaceFeed>(&conn, "delete", "feed", Some(id.to_string()), Some(b), None);
        }
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// POST /api/feeds/:id/like  — body { liked: bool }
pub async fn set_like(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(body): Json<SpaceFeedLikeBody>,
) -> ApiResult<OkResponse> {
    let conn = db.lock().unwrap();
    let delta: i64 = if body.liked { 1 } else { -1 };
    let n = conn.execute(
        "UPDATE space_feeds SET likes = MAX(0, likes + ?1) WHERE id=?2",
        params![delta, id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// POST /api/feeds/:id/comments
pub async fn add_comment(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(input): Json<SpaceFeedCommentInput>,
) -> ApiResult<SpaceFeedComment> {
    let conn = db.lock().unwrap();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M").to_string();
    // reply_to_id maps to parent_id in DB
    conn.execute(
        "INSERT INTO space_feed_comments (feed_id, name, contact, text, date, parent_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.name, input.contact, input.text, now, input.reply_to_id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let cid = conn.last_insert_rowid();
    Ok(Json(SpaceFeedComment {
        id: cid, name: input.name, contact: input.contact, text: input.text,
        date: now, parent_id: input.reply_to_id, replies: Vec::new(),
    }))
}

/// DELETE /api/feeds/:id/comments/:cid  (admin) — also removes child replies
pub async fn delete_comment(
    State(db): State<Db>,
    headers: HeaderMap,
    Path((id, cid)): Path<(i64, i64)>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let n1 = conn.execute("DELETE FROM space_feed_comments WHERE id=?1 AND feed_id=?2", params![cid, id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let n2 = conn.execute("DELETE FROM space_feed_comments WHERE parent_id=?1 AND feed_id=?2", params![cid, id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(OkResponse { ok: n1 + n2 > 0 }))
}
