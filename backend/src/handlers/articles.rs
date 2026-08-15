//! Article CRUD + trash endpoints.

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use rusqlite::params;
use serde::Deserialize;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, Article, ArticleInput, Comment, CommentInput, IdResponse, OkResponse};

fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64
}

fn row_to_article(row: &rusqlite::Row<'_>) -> rusqlite::Result<Article> {
    let tags_json: String = row.get("tags")?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    let featured_int: i64 = row.get("featured")?;
    Ok(Article {
        id: row.get("id")?,
        title: row.get("title")?,
        date: row.get("date")?,
        category: row.get("category")?,
        tags,
        read_count: row.get("read_count")?,
        comment_count: row.get("comment_count")?,
        summary: row.get("summary")?,
        cover: row.get("cover")?,
        auto_cover: row.get("auto_cover")?,
        content: row.get("content")?,
        featured: featured_int != 0,
        like_count: row.get("like_count")?,
        deleted_at: row.get("deleted_at")?,
        comment_list: None,
    })
}

#[derive(Debug, Deserialize, Default)]
pub struct ListQuery {
    /// "trash" returns only soft-deleted articles; anything else returns published.
    pub scope: Option<String>,
    pub sort: Option<String>,
    pub q: Option<String>,
    pub tag: Option<String>,
    pub category: Option<String>,
}

/// GET /api/articles
pub async fn list(State(db): State<Db>, Query(q): Query<ListQuery>) -> ApiResult<Vec<Article>> {
    let conn = db.lock().unwrap();
    let is_trash = q.scope.as_deref() == Some("trash");

    let mut sql = String::from(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE ",
    );
    if is_trash {
        sql.push_str("deleted_at IS NOT NULL ");
    } else {
        sql.push_str("deleted_at IS NULL ");
    }

    // We do filtering in Rust after fetch to keep SQL simple & avoid SQLi surface.
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(e) => return Err(AppError::internal(e.to_string())),
    };
    let rows = stmt.query_map([], row_to_article).map_err(|e| AppError::internal(e.to_string()))?;
    let mut out: Vec<Article> = rows.filter_map(|r| r.ok()).collect();

    // Optional text search
    if let Some(needle) = &q.q {
        let n = needle.to_lowercase();
        out.retain(|a| {
            a.title.to_lowercase().contains(&n)
                || a.summary.to_lowercase().contains(&n)
                || a.tags.iter().any(|t| t.to_lowercase().contains(&n))
        });
    }
    // Optional tag / category filter
    if let Some(cat) = &q.category {
        out.retain(|a| a.category == *cat);
    }
    if let Some(tag) = &q.tag {
        out.retain(|a| a.tags.iter().any(|t| t == tag));
    }

    // Sorting
    let sort = q.sort.as_deref().unwrap_or("date");
    match sort {
        "read" => out.sort_by(|a, b| b.read_count.cmp(&a.read_count)),
        "comment" => out.sort_by(|a, b| b.comment_count.cmp(&a.comment_count)),
        _ => out.sort_by(|a, b| b.date.cmp(&a.date)),
    }

    Ok(Json(out))
}

/// GET /api/articles/:id  (also increments read_count)
pub async fn get(State(db): State<Db>, Path(id): Path<i64>) -> ApiResult<Article> {
    let conn = db.lock().unwrap();
    // increment read_count
    let _ = conn.execute(
        "UPDATE articles SET read_count = read_count + 1 WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
    );

    let mut stmt = conn.prepare(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let mut article = stmt.query_row(params![id], row_to_article)
        .map_err(|_| AppError::not_found(format!("article {} not found", id)))?;

    // Attach comments
    let mut cmt_stmt = conn.prepare(
        "SELECT id, article_id, name, contact, content, date, parent_id FROM article_comments WHERE article_id = ?1 ORDER BY id ASC",
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let cmts: Vec<Comment> = cmt_stmt.query_map(params![id], |row| {
        Ok(Comment {
            id: row.get("id")?,
            name: row.get("name")?,
            contact: row.get("contact")?,
            content: row.get("content")?,
            date: row.get("date")?,
            parent_id: row.get("parent_id")?,
            article_id: Some(row.get("article_id")?),
        })
    }).map_err(|e| AppError::internal(e.to_string()))?
      .filter_map(|r| r.ok()).collect();
    article.comment_list = Some(cmts);

    Ok(Json(article))
}

/// POST /api/articles  (admin)
pub async fn create(
    State(db): State<Db>,
    headers: HeaderMap,
    Json(input): Json<ArticleInput>,
) -> ApiResult<Article> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let id = now_ms();
    let date = input.date.clone().unwrap_or_else(|| {
        chrono::Utc::now().format("%Y-%m-%d").to_string()
    });
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".into());
    let featured_int: i64 = if input.featured { 1 } else { 0 };
    conn.execute(
        "INSERT INTO articles (id, title, date, category, tags, summary, cover, content, featured)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, input.title, date, input.category, tags_json, input.summary, input.cover, input.content, featured_int],
    ).map_err(|e| AppError::internal(e.to_string()))?;

    let article = Article {
        id, title: input.title, date, category: input.category, tags: input.tags,
        read_count: 0, comment_count: 0, summary: input.summary, cover: input.cover,
        auto_cover: String::new(), content: input.content, featured: input.featured,
        like_count: 0, deleted_at: None, comment_list: None,
    };
    log_operation::<Article, Article>(&conn, "create", "article", Some(id.to_string()), None, Some(&article));
    Ok(Json(article))
}

/// PUT /api/articles/:id  (admin)
pub async fn update(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(input): Json<ArticleInput>,
) -> ApiResult<Article> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort; None if row doesn't exist).
    let before: Option<Article> = conn.query_row(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
        params![id],
        row_to_article,
    ).ok();
    let tags_json = serde_json::to_string(&input.tags).unwrap_or_else(|_| "[]".into());
    let featured_int: i64 = if input.featured { 1 } else { 0 };
    let date = input.date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    let updated = conn.execute(
        "UPDATE articles SET title=?1, date=?2, category=?3, tags=?4, summary=?5, cover=?6, content=?7, featured=?8
         WHERE id=?9 AND deleted_at IS NULL",
        params![input.title, date, input.category, tags_json, input.summary, input.cover, input.content, featured_int, id],
    ).map_err(|e| AppError::internal(e.to_string()))?;

    if updated == 0 {
        return Err(AppError::not_found(format!("article {} not found", id)));
    }
    // Re-fetch the updated row (without incrementing read_count).
    let mut stmt = conn.prepare(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let article = stmt.query_row(params![id], row_to_article)
        .map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(b) = &before {
        log_operation(&conn, "update", "article", Some(id.to_string()), Some(b), Some(&article));
    }
    Ok(Json(article))
}

/// DELETE /api/articles/:id  (admin) — soft delete (move to trash)
pub async fn soft_delete(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before: Option<Article> = conn.query_row(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
        params![id],
        row_to_article,
    ).ok();
    let n = conn.execute("UPDATE articles SET deleted_at=?1 WHERE id=?2 AND deleted_at IS NULL",
        params![now_ms(), id]).map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        if let Some(b) = &before {
            log_operation::<Article, Article>(&conn, "delete", "article", Some(id.to_string()), Some(b), None);
        }
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// POST /api/articles/trash/:id/restore  (admin)
pub async fn restore(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    let n = conn.execute("UPDATE articles SET deleted_at=NULL WHERE id=?1 AND deleted_at IS NOT NULL",
        params![id]).map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        // Read restored article to log it as the "after" snapshot.
        let restored: Option<Article> = conn.query_row(
            "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
            params![id],
            row_to_article,
        ).ok();
        if let Some(r) = &restored {
            log_operation::<Article, Article>(&conn, "create", "article", Some(id.to_string()), None, Some(r));
        }
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// DELETE /api/articles/trash/:id  (admin) — permanent delete
pub async fn permanent_delete(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // Read before state (best-effort).
    let before: Option<Article> = conn.query_row(
        "SELECT id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, content, featured, like_count, deleted_at FROM articles WHERE id = ?1",
        params![id],
        row_to_article,
    ).ok();
    let n = conn.execute("DELETE FROM articles WHERE id=?1 AND deleted_at IS NOT NULL",
        params![id]).map_err(|e| AppError::internal(e.to_string()))?;
    if n > 0 {
        if let Some(b) = &before {
            log_operation::<Article, Article>(&conn, "delete", "article", Some(id.to_string()), Some(b), None);
        }
    }
    Ok(Json(OkResponse { ok: n > 0 }))
}

/// POST /api/articles/:id/like with body { liked: bool }
#[derive(Deserialize)]
pub struct LikeBody { pub liked: bool }

pub async fn set_like(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(body): Json<LikeBody>,
) -> ApiResult<IdResponse> {
    let conn = db.lock().unwrap();
    let delta: i64 = if body.liked { 1 } else { -1 };
    conn.execute(
        "UPDATE articles SET like_count = MAX(0, like_count + ?1) WHERE id=?2",
        params![delta, id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(IdResponse { id }))
}

// ========== Article comments ==========

/// GET /api/articles/:id/comments
pub async fn list_article_comments(State(db): State<Db>, Path(id): Path<i64>) -> ApiResult<Vec<Comment>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, article_id, name, contact, content, date, parent_id FROM article_comments WHERE article_id=?1 ORDER BY id ASC",
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let rows = stmt.query_map(params![id], |row| {
        Ok(Comment {
            id: row.get("id")?,
            name: row.get("name")?,
            contact: row.get("contact")?,
            content: row.get("content")?,
            date: row.get("date")?,
            parent_id: row.get("parent_id")?,
            article_id: Some(row.get("article_id")?),
        })
    }).map_err(|e| AppError::internal(e.to_string()))?;
    let out: Vec<Comment> = rows.filter_map(|r| r.ok()).collect();
    Ok(Json(out))
}

/// POST /api/articles/:id/comments
pub async fn add_article_comment(
    State(db): State<Db>,
    Path(id): Path<i64>,
    Json(input): Json<CommentInput>,
) -> ApiResult<Comment> {
    let conn = db.lock().unwrap();
    let date = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO article_comments (article_id, name, contact, content, date, parent_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.name, input.contact, input.content, date, input.parent_id],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    let row_id = conn.last_insert_rowid();
    conn.execute("UPDATE articles SET comment_count = comment_count + 1 WHERE id=?1", params![id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(Json(Comment {
        id: row_id, name: input.name, contact: input.contact, content: input.content,
        date, parent_id: input.parent_id, article_id: Some(id),
    }))
}

/// DELETE /api/articles/:id/comments/:cid  (admin)
pub async fn delete_article_comment(
    State(db): State<Db>,
    headers: HeaderMap,
    Path((id, cid)): Path<(i64, i64)>,
) -> ApiResult<OkResponse> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();
    // delete the comment and its child replies
    let n1 = conn.execute("DELETE FROM article_comments WHERE id=?1 AND article_id=?2", params![cid, id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let n2 = conn.execute("DELETE FROM article_comments WHERE parent_id=?1 AND article_id=?2", params![cid, id])
        .map_err(|e| AppError::internal(e.to_string()))?;
    let total = n1 + n2;
    if total > 0 {
        let _ = conn.execute("UPDATE articles SET comment_count = MAX(0, comment_count - ?1) WHERE id=?2",
            params![total, id]);
    }
    Ok(Json(OkResponse { ok: total > 0 }))
}
