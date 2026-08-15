//! Serde models that mirror the original frontend JS shapes (snake_case DB
//! columns are mapped to camelCase JSON for backwards-compatible API output).

use serde::{Deserialize, Serialize};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

// ========== Article ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: i64,
    pub title: String,
    pub date: String,
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "read")]
    pub read_count: i64,
    #[serde(rename = "comment")]
    pub comment_count: i64,
    pub summary: String,
    pub cover: String,
    #[serde(default, rename = "autoCover")]
    pub auto_cover: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub featured: bool,
    #[serde(default, rename = "like")]
    pub like_count: i64,
    /// Only present when article is in trash.
    #[serde(default, rename = "deletedAt", skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<i64>,
    /// Article-scoped comments (joined in handler). Optional — only populated
    /// by the single-article endpoint to avoid huge list responses.
    #[serde(default, rename = "commentList", skip_serializing_if = "Option::is_none")]
    pub comment_list: Option<Vec<Comment>>,
}

#[derive(Debug, Deserialize)]
pub struct ArticleInput {
    pub title: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub summary: String,
    #[serde(default)]
    pub cover: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub featured: bool,
    /// Optional for updates; ignored on create.
    #[serde(default)]
    pub date: Option<String>,
}

fn default_category() -> String { "随笔".to_string() }

// ========== Comments ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comment {
    pub id: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub contact: String,
    pub content: String,
    pub date: String,
    #[serde(default, rename = "parentId", skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<i64>,
    /// Only set for article comments.
    #[serde(default, rename = "articleId", skip_serializing_if = "Option::is_none")]
    pub article_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CommentInput {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub contact: String,
    pub content: String,
    #[serde(default)]
    pub parent_id: Option<i64>,
}

// ========== Profile ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub bio: String,
    pub avatar: String,
    pub about: String,
    #[serde(default)]
    pub socials: Vec<SocialLink>,
    /// Legacy / backward-compat contact fields. 空字符串表示未设置。
    /// 新的前端使用 `socials` 数组（支持任意 label/value 对），
    /// 这里保留字段以便老版本 localStorage/profile 兼容。
    #[serde(default)]
    pub qq: String,
    #[serde(default)]
    pub wechat: String,
    #[serde(default)]
    pub github: String,
    #[serde(default)]
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocialLink {
    pub label: String,
    pub value: String,
}

// ========== Friend links ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendLink {
    pub id: i64,
    pub title: String,
    pub url: String,
    #[serde(rename = "titleText")]
    pub title_text: String,
}

#[derive(Debug, Deserialize)]
pub struct FriendLinkInput {
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub title_text: String,
}

// ========== Music ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: i64,
    #[serde(rename = "songId")]
    pub song_id: String,
    pub name: String,
    pub artist: String,
    #[serde(rename = "picUrl")]
    pub pic_url: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub url: String,
    #[serde(default, rename = "songIdEnc", skip_serializing_if = "String::is_empty")]
    pub song_id_enc: String,
    #[serde(default)]
    pub platform: String,
}

#[derive(Debug, Deserialize)]
pub struct SongInput {
    #[serde(default)]
    pub id: Option<serde_json::Value>,
    #[serde(default)]
    pub song_id_enc: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub artist: Option<String>,
    #[serde(default)]
    pub pic_url: Option<String>,
    #[serde(default)]
    pub platform: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MusicConfig {
    #[serde(rename = "musicApiBase")]
    pub api_base: String,
    #[serde(rename = "musicPlaylist")]
    pub playlist: Vec<Song>,
}

#[derive(Debug, Deserialize)]
pub struct MusicApiBaseInput {
    #[serde(rename = "apiBase")]
    pub api_base: String,
}

// ========== Categories ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub name: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct RenameCategoryInput {
    #[serde(rename = "newName")]
    pub new_name: String,
}

#[derive(Debug, Deserialize)]
pub struct TagInput {
    pub tag: String,
}

// ========== Visitor stats ==========

#[derive(Debug, Serialize)]
pub struct VisitorStats {
    pub pv: i64,
    pub uv: i64,
}

// ========== Auth ==========

#[derive(Debug, Deserialize)]
pub struct AdminLoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub token: String,
    pub message: String,
}

// ========== Generic ==========

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
}

/// 统一的应用错误类型，携带正确的 HTTP 状态码。
///
/// 重要：Axum 中 `Result<Json<T>, Json<ApiError>>` 的 `Err(Json(...))`
/// 会默认返回 **200 OK**（因为 `Json` 本身不带状态码）。这导致前端
/// 收到 200 后误以为操作成功，但数据库实际未修改（如鉴权失败时）。
/// 使用 `AppError` 实现 `IntoResponse` 可返回正确的 4xx/5xx 状态码。
#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::UNAUTHORIZED, message: msg.into() }
    }
    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::FORBIDDEN, message: msg.into() }
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::NOT_FOUND, message: msg.into() }
    }
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::BAD_REQUEST, message: msg.into() }
    }
    pub fn internal(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::INTERNAL_SERVER_ERROR, message: msg.into() }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(ApiError { error: self.message })).into_response()
    }
}

/// 便捷类型别名：所有 handler 的返回类型统一用 `ApiResult<T>`。
pub type ApiResult<T> = Result<Json<T>, AppError>;

#[derive(Debug, Serialize)]
pub struct IdResponse {
    pub id: i64,
}

#[derive(Debug, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

// ========== Space feeds ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceFeed {
    pub id: i64,
    pub content: String,
    pub date: String,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub likes: i64,
    #[serde(default)]
    pub comments: Vec<SpaceFeedComment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceFeedComment {
    pub id: i64,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub contact: String,
    pub text: String,
    pub date: String,
    #[serde(default, rename = "parentId", skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<i64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub replies: Vec<SpaceFeedComment>,
}

#[derive(Debug, Deserialize)]
pub struct SpaceFeedInput {
    pub content: String,
    #[serde(default)]
    pub images: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SpaceFeedCommentInput {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub contact: String,
    pub text: String,
    #[serde(default)]
    pub reply_to_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SpaceFeedLikeBody {
    pub liked: bool,
}

// ========== KV store ==========

#[derive(Debug, Serialize, Deserialize)]
pub struct KvEntry {
    pub key: String,
    pub value: serde_json::Value,
}

// ========== Operation logs ==========

#[derive(Debug, Clone, Serialize)]
pub struct OperationLog {
    pub id: i64,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<String>,
    pub before_data: Option<serde_json::Value>,
    pub after_data: Option<serde_json::Value>,
    pub operator: String,
    pub created_at: String,
}
