mod common;

use cosmolog_api::domain::profiles::{find_by_user_id, find_by_username, update_by_user_id, ValidatedUpdate};
use cosmolog_api::domain::stories::{attach_profiles, find_by_id as find_story, list_by_author_id, list_by_universe_id, search_by_title, update, UpdateStoryInput};
use cosmolog_api::domain::universes::{find_by_id as find_universe, list_by_owner_id, update as update_universe, UpdateUniverseInput};
use cosmolog_api::domain::arcs::{delete_by_id, find_by_id as find_arc, list_by_universe_id as list_arcs, update as update_arc};
use uuid::Uuid;

use common::fixtures::{seed_arc, seed_story, seed_universe, seed_user};

async fn pool() -> Option<sqlx::PgPool> {
    common::db::test_db().await
}

#[tokio::test]
async fn profiles_find_and_update() {
    let Some(pool) = pool().await else { return };
    let user = seed_user(&pool, "alan").await;

    let found = find_by_user_id(&pool, user.user_id).await.unwrap().unwrap();
    assert_eq!(found.username, "alan");

    let by_name = find_by_username(&pool, "alan").await.unwrap().unwrap();
    assert_eq!(by_name.user_id, user.user_id);

    let validated = ValidatedUpdate {
        username: Some("Alan Z".into()),
        bio: Some("Hello".into()),
        avatar_url: None,
    };
    let updated = update_by_user_id(&pool, user.user_id, &validated)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(updated.username, "Alan Z");
    assert_eq!(updated.bio.as_deref(), Some("Hello"));
}

#[tokio::test]
async fn profiles_update_returns_none_for_missing_user() {
    let Some(pool) = pool().await else { return };
    let validated = ValidatedUpdate {
        username: Some("ghost".into()),
        bio: None,
        avatar_url: None,
    };
    let result = update_by_user_id(&pool, Uuid::new_v4(), &validated)
        .await
        .unwrap();
    assert!(result.is_none());
}

#[tokio::test]
async fn profiles_username_must_be_unique() {
    let Some(pool) = pool().await else { return };
    seed_user(&pool, "taken").await;
    let other = seed_user(&pool, "other").await;

    let validated = ValidatedUpdate {
        username: Some("taken".into()),
        bio: None,
        avatar_url: None,
    };
    let err = update_by_user_id(&pool, other.user_id, &validated)
        .await
        .unwrap_err();
    assert!(matches!(err, sqlx::Error::Database(_)));
}

#[tokio::test]
async fn universes_crud_and_ownership() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "owner").await;
    let other = seed_user(&pool, "other").await;

    let universe = seed_universe(&pool, owner.user_id, "Cosmos").await;
    let listed = list_by_owner_id(&pool, owner.user_id).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, universe.id);

    let input = UpdateUniverseInput {
        title: Some("Cosmos Renamed".into()),
        description: Some("New blurb".into()),
        cover_image_url: None,
    };
    let updated = update_universe(&pool, universe.id, owner.user_id, &input)
        .await
        .unwrap();
    assert_eq!(updated.title, "Cosmos Renamed");

    let denied = update_universe(
        &pool,
        universe.id,
        other.user_id,
        &UpdateUniverseInput {
            title: Some("Hack".into()),
            description: None,
            cover_image_url: None,
        },
    )
    .await;
    assert!(matches!(denied, Err(sqlx::Error::RowNotFound)));

    assert!(find_universe(&pool, universe.id).await.unwrap().is_some());
}

#[tokio::test]
async fn stories_insert_list_search_and_author_guard() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "author").await;
    let other = seed_user(&pool, "intruder").await;
    let universe = seed_universe(&pool, author.user_id, "U1").await;

    let story = seed_story(
        &pool,
        author.user_id,
        "Star Saga",
        "short_story",
        Some(universe.id),
        None,
    )
    .await;

    let mine = list_by_author_id(&pool, author.user_id).await.unwrap();
    assert_eq!(mine.len(), 1);

    let in_universe = list_by_universe_id(&pool, universe.id, None)
        .await
        .unwrap();
    assert_eq!(in_universe[0].id, story.id);

    let hits = search_by_title(&pool, "star", 10).await.unwrap();
    assert_eq!(hits.len(), 1);

    let updated = update(
        &pool,
        story.id,
        author.user_id,
        &UpdateStoryInput {
            title: Some("Star Saga II".into()),
            description: None,
            tags: None,
            r#type: None,
            universe_id: None,
            arc_id: None,
            cover_image_url: None,
            feed_display_mode: None,
            content: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(updated.title, "Star Saga II");

    let denied = update(
        &pool,
        story.id,
        other.user_id,
        &UpdateStoryInput {
            title: Some("Stolen".into()),
            description: None,
            tags: None,
            r#type: None,
            universe_id: None,
            arc_id: None,
            cover_image_url: None,
            feed_display_mode: None,
            content: None,
        },
    )
    .await;
    assert!(matches!(denied, Err(sqlx::Error::RowNotFound)));

    assert!(find_story(&pool, story.id).await.unwrap().is_some());
}

#[tokio::test]
async fn attach_profiles_joins_authors() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "writer").await;
    let story = seed_story(&pool, author.user_id, "Tale", "chapters", None, None).await;

    let with_profiles = attach_profiles(&pool, vec![story.clone()]).await.unwrap();
    assert_eq!(with_profiles.len(), 1);
    assert_eq!(
        with_profiles[0].profiles.as_ref().unwrap().username,
        "writer"
    );
}

#[tokio::test]
async fn arcs_lifecycle_in_universe() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "arc_owner").await;
    let universe = seed_universe(&pool, owner.user_id, "Arcverse").await;

    let arc = seed_arc(&pool, universe.id, "Arc One").await;
    let listed = list_arcs(&pool, universe.id).await.unwrap();
    assert_eq!(listed.len(), 1);

    let updated = update_arc(
        &pool,
        arc.id,
        "Arc One Revised",
        Some("desc"),
        "event",
        None,
    )
    .await
    .unwrap();
    assert_eq!(updated.name, "Arc One Revised");

    delete_by_id(&pool, arc.id).await.unwrap();
    assert!(find_arc(&pool, arc.id).await.unwrap().is_none());
}

#[tokio::test]
async fn story_linked_to_arc_in_same_universe() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "linker").await;
    let universe = seed_universe(&pool, author.user_id, "Linked U").await;
    let arc = seed_arc(&pool, universe.id, "Main Arc").await;

    let story = seed_story(
        &pool,
        author.user_id,
        "Linked Story",
        "chapters",
        Some(universe.id),
        Some(arc.id),
    )
    .await;

    assert_eq!(story.universe_id, Some(universe.id));
    assert_eq!(story.arc_id, Some(arc.id));
}
