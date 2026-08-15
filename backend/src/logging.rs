//! 操作日志记录模块。
//!
//! 在管理员执行写操作（create/update/delete）后调用 `log_operation`，
//! 将操作前后的数据快照写入 `operation_logs` 表，用于审计和回滚。

use rusqlite::{params, Connection};
use serde::Serialize;

/// 记录一条操作日志。
///
/// # 参数
/// * `action`     - "create" | "update" | "delete"
/// * `entity`     - 实体名：article / profile / feed / home_resume / kv / friend_link / comment / category / song
/// * `entity_id`  - 记录 ID（单例如 profile 传 "1"）
/// * `before`     - 操作前数据（create 时传 None）
/// * `after`      - 操作后数据（delete 时传 None）
pub fn log_operation<T: Serialize, U: Serialize>(
    conn: &Connection,
    action: &str,
    entity: &str,
    entity_id: Option<String>,
    before: Option<&T>,
    after: Option<&U>,
) {
    let before_json = before.and_then(|v| serde_json::to_string(v).ok());
    let after_json = after.and_then(|v| serde_json::to_string(v).ok());
    let _ = conn.execute(
        "INSERT INTO operation_logs (action, entity, entity_id, before_data, after_data, operator) \
         VALUES (?1, ?2, ?3, ?4, ?5, 'admin')",
        params![action, entity, entity_id, before_json, after_json],
    );
}
