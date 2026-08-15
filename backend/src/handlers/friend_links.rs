//! Friend links CRUD.

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, FriendLink, FriendLinkInput, IdResponse};

/// GET /api/friend-links
pub async fn list(State(db): State<Db>) -> ApiResult<Vec<FriendLink>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, title, url, title_text FROM friend_links ORDER BY sort_order ASC, id ASC")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let rows = stmt.query_map([], |r| Ok(FriendLink {
        id: r.get(0)?, title: r.get(1)?, url: r.get(2)?, title_text: r.get(3)?,
    })).map_err(|e| AppError::internal(e.to_string()))?;
    let out: Vec<FriendLink> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(out))
}

/// POST /api/friend-links  (admin)
pub async fn create(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(input): Json<FriendLinkInput>,
) -> ApiResult<IdResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    conn.execute("INSERT INTO friend_links (title, url, title_text) VALUES (?1, ?2, ?3)",
        params![input.title, input.url, input.title_text])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let id = conn.last_insert_rowid();
    let link = FriendLink {
        id, title: input.title, url: input.url, title_text: input.title_text,
    };
    log_operation::<FriendLink, FriendLink>(&conn, "create", "friend_link", Some(id.to_string()), None, Some(&link));
    Ok(Json(IdResponse { id }))
}

/// PUT /api/friend-links/:id  (admin)
pub async fn update(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<FriendLinkInput>,
) -> ApiResult<IdResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before: Option<FriendLink> = conn.query_row(
        "SELECT id, title, url, title_text FROM friend_links WHERE id=?1",
        params![id],
        |r| Ok(FriendLink {
            id: r.get(0)?, title: r.get(1)?, url: r.get(2)?, title_text: r.get(3)?,
        }),
    ).ok();
    conn.execute("UPDATE friend_links SET title=?1, url=?2, title_text=?3 WHERE id=?4",
        params![input.title, input.url, input.title_text, id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let after = FriendLink {
        id, title: input.title, url: input.url, title_text: input.title_text,
    };
    if let Some(b) = &before {
        log_operation(&conn, "update", "friend_link", Some(id.to_string()), Some(b), Some(&after));
    }
    Ok(Json(IdResponse { id }))
}

/// DELETE /api/friend-links/:id  (admin)
pub async fn delete(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<IdResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before: Option<FriendLink> = conn.query_row(
        "SELECT id, title, url, title_text FROM friend_links WHERE id=?1",
        params![id],
        |r| Ok(FriendLink {
            id: r.get(0)?, title: r.get(1)?, url: r.get(2)?, title_text: r.get(3)?,
        }),
    ).ok();
    conn.execute("DELETE FROM friend_links WHERE id=?1", params![id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(b) = &before {
        log_operation::<FriendLink, FriendLink>(&conn, "delete", "friend_link", Some(id.to_string()), Some(b), None);
    }
    Ok(Json(IdResponse { id }))
}
