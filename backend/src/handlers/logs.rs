//! 操作日志查询与回滚。

use axum::extract::{Path, Query, State};
use axum::Json;
use rusqlite::params;
use serde::Deserialize;

use crate::auth::is_authorized;
use crate::db::Db;
use crate::logging::log_operation;
use crate::models::{AppError, ApiResult, OperationLog};

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub entity: Option<String>,
    pub action: Option<String>,
    #[serde(default = "default_since")]
    pub since: i64,
}

fn default_limit() -> i64 { 100 }
fn default_since() -> i64 { 7 }

/// GET /api/logs  — 查询操作日志列表（管理员）
pub async fn list(State(db): State<Db>, Query(q): Query<LogQuery>) -> ApiResult<Vec<OperationLog>> {
    let conn = db.lock().unwrap();
    let limit = q.limit.clamp(1, 1000);
    let mut sql = String::from(
        "SELECT id, action, entity, entity_id, before_data, after_data, operator, created_at \
         FROM operation_logs WHERE 1=1",
    );
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(limit)];
    let mut idx = 2;
    let since = q.since.clamp(0, 36500);
    sql.push_str(&format!(
        " AND created_at >= datetime('now', '-' || ?{} || ' days')",
        idx
    ));
    args.push(Box::new(since));
    idx += 1;
    if let Some(ref e) = q.entity {
        sql.push_str(&format!(" AND entity = ?{}", idx));
        args.push(Box::new(e.clone()));
        idx += 1;
    }
    if let Some(ref a) = q.action {
        sql.push_str(&format!(" AND action = ?{}", idx));
        args.push(Box::new(a.clone()));
    }
    sql.push_str(&format!(" ORDER BY created_at DESC LIMIT ?1"));
    // 重新排列参数顺序：limit 始终是 ?1
    let mut bind_args: Vec<&dyn rusqlite::ToSql> = Vec::new();
    bind_args.push(args[0].as_ref());
    for i in 1..args.len() {
        bind_args.push(args[i].as_ref());
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| AppError::internal(e.to_string()))?;
    let logs: Vec<OperationLog> = stmt
        .query_map(bind_args.as_slice(), |row| {
            let before_str: Option<String> = row.get(4)?;
            let after_str: Option<String> = row.get(5)?;
            let before = before_str.and_then(|s| serde_json::from_str(&s).ok());
            let after = after_str.and_then(|s| serde_json::from_str(&s).ok());
            Ok(OperationLog {
                id: row.get(0)?,
                action: row.get(1)?,
                entity: row.get(2)?,
                entity_id: row.get(3)?,
                before_data: before,
                after_data: after,
                operator: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| AppError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(Json(logs))
}

/// GET /api/logs/:id — 查询单条日志详情
pub async fn get_one(State(db): State<Db>, Path(id): Path<i64>) -> ApiResult<OperationLog> {
    let conn = db.lock().unwrap();
    let log = conn
        .query_row(
            "SELECT id, action, entity, entity_id, before_data, after_data, operator, created_at \
             FROM operation_logs WHERE id = ?1",
            params![id],
            |row| {
                let before_str: Option<String> = row.get(4)?;
                let after_str: Option<String> = row.get(5)?;
                let before = before_str.and_then(|s| serde_json::from_str(&s).ok());
                let after = after_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(OperationLog {
                    id: row.get(0)?,
                    action: row.get(1)?,
                    entity: row.get(2)?,
                    entity_id: row.get(3)?,
                    before_data: before,
                    after_data: after,
                    operator: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|_| AppError::not_found(format!("log {} not found", id)))?;
    Ok(Json(log))
}

/// POST /api/logs/:id/rollback — 回滚指定操作（管理员）
///
/// 回滚策略：
/// - create → 删除被创建的记录
/// - update → 用 before_data 恢复操作前的状态
/// - delete → 用 before_data 重新插入记录
pub async fn rollback(
    State(db): State<Db>,
    headers: axum::http::HeaderMap,
    Path(id): Path<i64>,
) -> ApiResult<serde_json::Value> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    let conn = db.lock().unwrap();

    // 1. 读取日志
    let (action, entity, entity_id, before_str, after_str): (String, String, Option<String>, Option<String>, Option<String>) =
        conn.query_row(
            "SELECT action, entity, entity_id, before_data, after_data FROM operation_logs WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|_| AppError::not_found(format!("log {} not found", id)))?;

    let before: serde_json::Value = before_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .ok_or_else(|| AppError::bad_request("无法回滚：操作前数据缺失"))?;
    let after: serde_json::Value = after_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null);

    // 2. 根据实体和操作类型执行回滚
    let rollback_desc = match (action.as_str(), entity.as_str()) {
        ("create", "article") => {
            let aid = entity_id.as_ref().and_then(|s| s.parse::<i64>().ok())
                .ok_or_else(|| AppError::bad_request("无效的 article id"))?;
            conn.execute("DELETE FROM article_comments WHERE article_id = ?1", params![aid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            conn.execute("DELETE FROM articles WHERE id = ?1", params![aid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：删除文章 id={aid}")
        }
        ("update", "article") => {
            restore_article(&conn, &before)?;
            format!("已回滚：恢复文章修改")
        }
        ("delete", "article") => {
            restore_article(&conn, &before)?;
            format!("已回滚：恢复已删除文章")
        }
        ("update", "profile") => {
            restore_profile(&conn, &before)?;
            format!("已回滚：恢复个人资料")
        }
        ("update", "home_resume") => {
            let data = before.get("data").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::bad_request("home_resume before_data 缺少 data 字段"))?;
            conn.execute("UPDATE home_resume SET data = ?1 WHERE id = 1", params![data])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：恢复首页简历")
        }
        ("create", "feed") => {
            let fid = entity_id.as_ref().and_then(|s| s.parse::<i64>().ok())
                .ok_or_else(|| AppError::bad_request("无效的 feed id"))?;
            conn.execute("DELETE FROM space_feed_comments WHERE feed_id = ?1", params![fid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            conn.execute("DELETE FROM space_feeds WHERE id = ?1", params![fid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：删除动态 id={fid}")
        }
        ("update", "feed") => {
            restore_feed(&conn, &before)?;
            format!("已回滚：恢复动态修改")
        }
        ("delete", "feed") => {
            restore_feed(&conn, &before)?;
            format!("已回滚：恢复已删除动态")
        }
        ("set", "kv") | ("update", "kv") => {
            let key = before.get("key").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::bad_request("kv before_data 缺少 key 字段"))?;
            let value = before.get("value").unwrap_or(&serde_json::Value::Null);
            conn.execute("UPDATE kv_store SET value = ?1 WHERE key = ?2", params![serde_json::to_string(value).unwrap_or_default(), key])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：恢复 KV key={key}")
        }
        ("create", "friend_link") => {
            let fid = entity_id.as_ref().and_then(|s| s.parse::<i64>().ok())
                .ok_or_else(|| AppError::bad_request("无效的 friend_link id"))?;
            conn.execute("DELETE FROM friend_links WHERE id = ?1", params![fid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：删除友链 id={fid}")
        }
        ("update", "friend_link") => {
            restore_friend_link(&conn, &before)?;
            format!("已回滚：恢复友链修改")
        }
        ("delete", "friend_link") => {
            restore_friend_link(&conn, &before)?;
            format!("已回滚：恢复已删除友链")
        }
        ("create", "comment") => {
            let cid = entity_id.as_ref().and_then(|s| s.parse::<i64>().ok())
                .ok_or_else(|| AppError::bad_request("无效的 comment id"))?;
            conn.execute("DELETE FROM site_comments WHERE id = ?1", params![cid])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：删除站点评论 id={cid}")
        }
        ("delete", "comment") => {
            let cid = before.get("id").and_then(|v| v.as_i64())
                .ok_or_else(|| AppError::bad_request("comment before_data 缺少 id"))?;
            let name = before.get("name").and_then(|v| v.as_str()).unwrap_or("匿名");
            let contact = before.get("contact").and_then(|v| v.as_str()).unwrap_or("");
            let content = before.get("content").and_then(|v| v.as_str()).unwrap_or("");
            let date = before.get("date").and_then(|v| v.as_str()).unwrap_or("");
            let parent_id = before.get("parentId").or(before.get("parent_id")).and_then(|v| v.as_i64());
            conn.execute(
                "INSERT OR REPLACE INTO site_comments (id, name, contact, content, date, parent_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![cid, name, contact, content, date, parent_id],
            ).map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：恢复已删除评论 id={cid}")
        }
        ("create", "category") => {
            let name = entity_id.as_deref().unwrap_or("");
            conn.execute("DELETE FROM categories WHERE name = ?1", params![name])
                .map_err(|e| AppError::internal(e.to_string()))?;
            conn.execute("DELETE FROM category_tags WHERE category = ?1", params![name])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：删除分类 name={name}")
        }
        ("delete", "category") => {
            let name = before.get("name").and_then(|v| v.as_str())
                .ok_or_else(|| AppError::bad_request("category before_data 缺少 name"))?;
            conn.execute("INSERT OR IGNORE INTO categories (name, sort_order) VALUES (?1, 0)", params![name])
                .map_err(|e| AppError::internal(e.to_string()))?;
            format!("已回滚：恢复已删除分类 name={name}")
        }
        _ => return Err(AppError::bad_request(format!(
            "暂不支持回滚此操作：action={}, entity={}", action, entity
        ))),
    };

    // 3. 记录回滚操作本身（便于追溯）
    log_operation(&conn, "rollback", &entity, entity_id, Some(&after), Some(&before));

    Ok(Json(serde_json::json!({ "ok": true, "message": rollback_desc })))
}

// ===== 回滚 helper 函数 =====

fn restore_article(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let id = data.get("id").and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::bad_request("article data 缺少 id"))?;
    let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
    let date = data.get("date").and_then(|v| v.as_str()).unwrap_or("");
    let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("随笔");
    let tags: String = serde_json::to_string(
        data.get("tags").and_then(|v| v.as_array()).unwrap_or(&Vec::new())
    ).unwrap_or_else(|_| "[]".into());
    let read_count = data.get("read").and_then(|v| v.as_i64()).unwrap_or(0);
    let comment_count = data.get("comment").and_then(|v| v.as_i64()).unwrap_or(0);
    let summary = data.get("summary").and_then(|v| v.as_str()).unwrap_or("");
    let cover = data.get("cover").and_then(|v| v.as_str()).unwrap_or("");
    let auto_cover = data.get("autoCover").and_then(|v| v.as_str()).unwrap_or("");
    let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let featured = data.get("featured").and_then(|v| v.as_bool()).unwrap_or(false);
    let like_count = data.get("like").and_then(|v| v.as_i64()).unwrap_or(0);
    let deleted_at = data.get("deletedAt").and_then(|v| v.as_i64());

    conn.execute(
        "INSERT OR REPLACE INTO articles \
         (id, title, date, category, tags, read_count, comment_count, summary, cover, auto_cover, \
          content, featured, like_count, deleted_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
        params![id, title, date, category, tags, read_count, comment_count, summary, cover,
                auto_cover, content, featured, like_count, deleted_at],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(())
}

fn restore_profile(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let bio = data.get("bio").and_then(|v| v.as_str()).unwrap_or("");
    let avatar = data.get("avatar").and_then(|v| v.as_str()).unwrap_or("");
    let about = data.get("about").and_then(|v| v.as_str()).unwrap_or("");
    let socials = serde_json::to_string(
        data.get("socials").and_then(|v| v.as_array()).unwrap_or(&Vec::new())
    ).unwrap_or_else(|_| "[]".into());
    let qq = data.get("qq").and_then(|v| v.as_str()).unwrap_or("");
    let wechat = data.get("wechat").and_then(|v| v.as_str()).unwrap_or("");
    let github = data.get("github").and_then(|v| v.as_str()).unwrap_or("");
    let email = data.get("email").and_then(|v| v.as_str()).unwrap_or("");

    conn.execute(
        "UPDATE profile SET name=?1, bio=?2, avatar=?3, about=?4, socials=?5, qq=?6, wechat=?7, github=?8, email=?9 WHERE id=1",
        params![name, bio, avatar, about, socials, qq, wechat, github, email],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(())
}

fn restore_feed(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let id = data.get("id").and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::bad_request("feed data 缺少 id"))?;
    let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let date = data.get("date").and_then(|v| v.as_str()).unwrap_or("");
    let images = serde_json::to_string(
        data.get("images").and_then(|v| v.as_array()).unwrap_or(&Vec::new())
    ).unwrap_or_else(|_| "[]".into());
    let likes = data.get("likes").and_then(|v| v.as_i64()).unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO space_feeds (id, content, date, images, likes) VALUES (?1,?2,?3,?4,?5)",
        params![id, content, date, images, likes],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(())
}

fn restore_friend_link(conn: &rusqlite::Connection, data: &serde_json::Value) -> Result<(), AppError> {
    let id = data.get("id").and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::bad_request("friend_link data 缺少 id"))?;
    let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
    let url = data.get("url").and_then(|v| v.as_str()).unwrap_or("");
    let title_text = data.get("titleText").or(data.get("title_text")).and_then(|v| v.as_str()).unwrap_or("");
    let sort_order = data.get("sortOrder").or(data.get("sort_order")).and_then(|v| v.as_i64()).unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO friend_links (id, title, url, title_text, sort_order) VALUES (?1,?2,?3,?4,?5)",
        params![id, title, url, title_text, sort_order],
    ).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(())
}
