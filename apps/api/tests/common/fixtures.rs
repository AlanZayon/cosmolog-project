use cosmolog_api::domain::profiles::Profile;
use cosmolog_api::domain::stories::{CreateStoryInput, Story};
use cosmolog_api::domain::universes::{CreateUniverseInput, Universe};
use cosmolog_api::domain::{arcs, stories, universes};
use sqlx::PgPool;
use uuid::Uuid;

pub struct TestUser {
    pub user_id: Uuid,
    pub profile: Profile,
}

pub async fn seed_user(pool: &PgPool, username: &str) -> TestUser {
    let user_id = Uuid::new_v4();
    let profile = sqlx::query_as::<_, Profile>(
        r#"
        INSERT INTO profiles (user_id, username)
        VALUES ($1, $2)
        RETURNING id, user_id, username, avatar_url, bio, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(username)
    .fetch_one(pool)
    .await
    .expect("seed profile");

    TestUser { user_id, profile }
}

pub async fn seed_universe(pool: &PgPool, owner_id: Uuid, title: &str) -> Universe {
    let input = CreateUniverseInput {
        title: title.into(),
        description: Some("A test universe".into()),
        cover_image_url: None,
    };
    universes::insert(pool, owner_id, &input)
        .await
        .expect("seed universe")
}

pub async fn seed_story(
    pool: &PgPool,
    author_id: Uuid,
    title: &str,
    story_type: &str,
    universe_id: Option<Uuid>,
    arc_id: Option<Uuid>,
) -> Story {
    let input = CreateStoryInput {
        title: title.into(),
        description: Some("Story description".into()),
        tags: Some(vec!["tag-a".into()]),
        r#type: story_type.into(),
        universe_id,
        arc_id,
        cover_image_url: None,
        feed_display_mode: None,
        content: Some("Once upon a time".into()),
    };
    stories::insert(pool, author_id, &input)
        .await
        .expect("seed story")
}

pub async fn seed_arc(pool: &PgPool, universe_id: Uuid, name: &str) -> arcs::Arc {
    arcs::insert(
        pool,
        universe_id,
        name,
        Some("Arc description"),
        "custom",
        None,
    )
    .await
    .expect("seed arc")
}
