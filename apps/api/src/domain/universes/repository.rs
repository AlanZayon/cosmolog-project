use sqlx::PgPool;
use uuid::Uuid;

use super::create::CreateUniverseInput;
use super::model::Universe;
use super::update::UpdateUniverseInput;

const UNIVERSE_COLUMNS: &str = r#"id, title, description, cover_image_url, owner_id,
    codex_enabled, saga_premise, default_calendar_label, afterword, created_at, updated_at"#;

pub async fn list_by_owner_id(pool: &PgPool, owner_id: Uuid) -> Result<Vec<Universe>, sqlx::Error> {
    sqlx::query_as::<_, Universe>(&format!(
        r#"
        SELECT {UNIVERSE_COLUMNS}
        FROM universes
        WHERE owner_id = $1
        ORDER BY created_at DESC
        "#
    ))
    .bind(owner_id)
    .fetch_all(pool)
    .await
}

pub async fn insert(
    pool: &PgPool,
    owner_id: Uuid,
    input: &CreateUniverseInput,
) -> Result<Universe, sqlx::Error> {
    sqlx::query_as::<_, Universe>(&format!(
        r#"
        INSERT INTO universes (title, description, cover_image_url, owner_id)
        VALUES ($1, $2, $3, $4)
        RETURNING {UNIVERSE_COLUMNS}
        "#
    ))
    .bind(input.title())
    .bind(input.description())
    .bind(input.cover_image_url.as_deref())
    .bind(owner_id)
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &PgPool,
    id: Uuid,
    owner_id: Uuid,
    input: &UpdateUniverseInput,
) -> Result<Universe, sqlx::Error> {
    let existing = find_by_id(pool, id).await?;
    let Some(universe) = existing else {
        return Err(sqlx::Error::RowNotFound);
    };
    if universe.owner_id != owner_id {
        return Err(sqlx::Error::RowNotFound);
    }

    let title = input
        .title
        .as_ref()
        .map(|s| s.trim().to_string())
        .unwrap_or(universe.title);
    let description = match &input.description {
        Some(d) => Some(d.trim().to_string()).filter(|s| !s.is_empty()),
        None => universe.description,
    };
    let cover_image_url = input
        .cover_image_url
        .clone()
        .unwrap_or(universe.cover_image_url);
    let codex_enabled = input.codex_enabled.unwrap_or(universe.codex_enabled);
    let saga_premise = match &input.saga_premise {
        Some(v) => v.clone(),
        None => universe.saga_premise,
    };
    let default_calendar_label = match &input.default_calendar_label {
        Some(v) => v.clone(),
        None => universe.default_calendar_label,
    };
    let afterword = match &input.afterword {
        Some(v) => v.clone(),
        None => universe.afterword,
    };

    sqlx::query_as::<_, Universe>(&format!(
        r#"
        UPDATE universes SET
            title = $2,
            description = $3,
            cover_image_url = $4,
            codex_enabled = $5,
            saga_premise = $6,
            default_calendar_label = $7,
            afterword = $8,
            updated_at = NOW()
        WHERE id = $1
        RETURNING {UNIVERSE_COLUMNS}
        "#
    ))
    .bind(id)
    .bind(title)
    .bind(description)
    .bind(cover_image_url)
    .bind(codex_enabled)
    .bind(saga_premise)
    .bind(default_calendar_label)
    .bind(afterword)
    .fetch_one(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> Result<Option<Universe>, sqlx::Error> {
    sqlx::query_as::<_, Universe>(&format!(
        r#"
        SELECT {UNIVERSE_COLUMNS}
        FROM universes
        WHERE id = $1
        "#
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}
