//! Site-wide guestbook comments (homepage `state.comments`).

use axum::{extract::{Path, State}, http::HeaderMap, Json};
use rusqlite::params;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, Comment, CommentInput, OkResponse};

/// GET /api/comments
pub async fn list(State(db): State<Db>) -> ApiResult<Vec<Comment>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, contact, content, date, parent_id FROM site_comments ORDER BY id DESC",
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let rows = stmt.query_map([], |r| Ok(Comment {
        id: r.get(0)?, name: r.get(1)?, contact: r.get(2)?,
        content: r.get(3)?, date: r.get(4)?, parent_id: r.get(5)?,
        article_id: None,
    })).map_err(|e| AppError::internal(e.to_string()))?;
    let out: Vec<Comment> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(out))
}

/// POST /api/comments
pub async fn create(
    State(db): State<Db>,
    Json(input): Json<CommentInput>,
) -> ApiResult<Comment> {
    let conn = db.lock().unwrap();
    let date = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO site_comments (name, contact, content, date, parent_id) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.name, input.contact, input.content, date, input.parent_id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let id = conn.last_insert_rowid();
    let comment = Comment {
        id, name: input.name, contact: input.contact, content: input.content,
        date, parent_id: input.parent_id, article_id: None,
    };
    log_operation::<Comment, Comment>(&conn, "create", "comment", Some(id.to_string()), None, Some(&comment));
    Ok(Json(comment))
}

/// DELETE /api/comments/:id  (admin) — also removes child replies
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
    let before: Option<Comment> = conn.query_row(
        "SELECT id, name, contact, content, date, parent_id FROM site_comments WHERE id=?1",
        params![id],
        |r| Ok(Comment {
            id: r.get(0)?, name: r.get(1)?, contact: r.get(2)?,
            content: r.get(3)?, date: r.get(4)?, parent_id: r.get(5)?,
            article_id: None,
        }),
    ).ok();
    let n1 = conn.execute("DELETE FROM site_comments WHERE id=?1", params![id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let n2 = conn.execute("DELETE FROM site_comments WHERE parent_id=?1", params![id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    if n1 + n2 > 0 {
        if let Some(b) = &before {
            log_operation::<Comment, Comment>(&conn, "delete", "comment", Some(id.to_string()), Some(b), None);
        }
    }
    Ok(Json(OkResponse { ok: n1 + n2 > 0 }))
}
