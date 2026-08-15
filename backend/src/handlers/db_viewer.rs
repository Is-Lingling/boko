//! 数据库查看 API（仅管理员）。
//!
//! 提供列出所有表及行数、查看指定表数据（分页）、查看表结构三个接口。
//! 所有接口均要求管理员认证。表名参数通过 `sqlite_master` 白名单验证，
//! 杜绝 SQL 注入风险。

use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::Json;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::auth::is_authorized;
use crate::db::Db;
use crate::models::{AppError, ApiResult};

// ========== 响应结构 ==========

#[derive(Debug, Serialize)]
pub struct TableInfo {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct TableData {
    pub table: String,
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub notnull: bool,
    pub pk: bool,
}

#[derive(Debug, Serialize)]
pub struct TableSchema {
    pub table: String,
    pub sql: String,
    pub columns: Vec<ColumnInfo>,
}

// ========== 查询参数 ==========

#[derive(Debug, Deserialize)]
pub struct TableDataQuery {
    #[serde(default = "default_table_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_table_limit() -> i64 { 50 }

// ========== 内部 helper ==========

/// 从 `sqlite_master` 读取所有用户表名（排除 `sqlite_` 前缀的内部表）。
fn user_tables(conn: &rusqlite::Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .map_err(|e| AppError::internal(e.to_string()))?;
    let names = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| AppError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(names)
}

/// 校验表名存在于白名单中，返回清洗后的表名。
fn validate_table(conn: &rusqlite::Connection, name: &str) -> Result<String, AppError> {
    let tables = user_tables(conn)?;
    tables
        .into_iter()
        .find(|t| t == name)
        .ok_or_else(|| AppError::not_found(format!("table '{}' not found", name)))
}

/// 将 `rusqlite::types::Value` 转换为 `serde_json::Value`。
fn sqlite_value_to_json(v: rusqlite::types::Value) -> serde_json::Value {
    use rusqlite::types::Value;
    match v {
        Value::Null => serde_json::Value::Null,
        Value::Integer(i) => serde_json::json!(i),
        Value::Real(f) => serde_json::json!(f),
        Value::Text(s) => serde_json::Value::String(s),
        Value::Blob(b) => serde_json::Value::String(format!("<blob {} bytes>", b.len())),
    }
}

fn require_admin(headers: &HeaderMap) -> Result<(), AppError> {
    if !is_authorized(headers.get("authorization").and_then(|v| v.to_str().ok())) {
        return Err(AppError::unauthorized("unauthorized"));
    }
    Ok(())
}

// ========== Handler ==========

/// GET /api/db/tables — 列出所有表及行数（管理员）
pub async fn list_tables(State(db): State<Db>, headers: HeaderMap) -> ApiResult<Vec<TableInfo>> {
    require_admin(&headers)?;
    let conn = db.lock().unwrap();
    let tables = user_tables(&conn)?;
    let mut result = Vec::with_capacity(tables.len());
    for name in tables {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", name), [], |r| r.get(0))
            .map_err(|e| AppError::internal(e.to_string()))?;
        result.push(TableInfo { name, count });
    }
    Ok(Json(result))
}

/// GET /api/db/tables/:name — 查看指定表的数据（管理员，支持分页）
pub async fn table_data(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(name): Path<String>,
    Query(q): Query<TableDataQuery>,
) -> ApiResult<TableData> {
    require_admin(&headers)?;
    let conn = db.lock().unwrap();
    let table = validate_table(&conn, &name)?;

    let limit = q.limit.clamp(1, 1000);
    let offset = q.offset.max(0);

    // 总行数
    let total: i64 = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table), [], |r| r.get(0))
        .map_err(|e| AppError::internal(e.to_string()))?;

    // 列名 + 数据（列名从 prepared statement 获取，反映实际查询结果）
    let sql = format!("SELECT * FROM \"{}\" LIMIT ?1 OFFSET ?2", table);
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| AppError::internal(e.to_string()))?;
    let col_count = stmt.column_count();
    let columns: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("").to_string())
        .collect();

    let rows: Vec<Vec<serde_json::Value>> = stmt
        .query_map(params![limit, offset], |row| {
            let mut values = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let v: rusqlite::types::Value = row.get(i)?;
                values.push(sqlite_value_to_json(v));
            }
            Ok(values)
        })
        .map_err(|e| AppError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Json(TableData {
        table,
        columns,
        rows,
        total,
    }))
}

/// GET /api/db/schema/:name — 查看表结构（管理员）
pub async fn table_schema(
    State(db): State<Db>,
    headers: HeaderMap,
    Path(name): Path<String>,
) -> ApiResult<TableSchema> {
    require_admin(&headers)?;
    let conn = db.lock().unwrap();
    let table = validate_table(&conn, &name)?;

    // CREATE TABLE 语句
    let sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?1",
            params![table],
            |r| r.get(0),
        )
        .map_err(|e| AppError::internal(e.to_string()))?;

    // 列信息（PRAGMA 不支持参数绑定，但 table 已通过白名单校验）
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| AppError::internal(e.to_string()))?;
    let columns: Vec<ColumnInfo> = stmt
        .query_map([], |row| {
            Ok(ColumnInfo {
                name: row.get(1)?,
                type_: row.get(2).unwrap_or_default(),
                notnull: row.get::<_, i64>(3).map(|v| v != 0).unwrap_or(false),
                pk: row.get::<_, i64>(5).map(|v| v != 0).unwrap_or(false),
            })
        })
        .map_err(|e| AppError::internal(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Json(TableSchema { table, sql, columns }))
}
