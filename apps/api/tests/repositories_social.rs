mod common;

use cosmolog_api::domain::comments::{insert as insert_comment, list_by_story_id};
use cosmolog_api::domain::follows::{delete_follow, has_follow, insert_follow};
use cosmolog_api::domain::likes::{delete_like, has_like, insert_like};

use common::fixtures::{seed_story, seed_universe, seed_user};

async fn pool() -> Option<sqlx::PgPool> {
    common::db::test_db().await
}

#[tokio::test]
async fn likes_toggle_idempotently() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "like_author").await;
    let fan = seed_user(&pool, "fan").await;
    let story = seed_story(&pool, author.user_id, "Likable", "short_story", None, None).await;

    assert!(!has_like(&pool, story.id, fan.user_id).await.unwrap());

    insert_like(&pool, story.id, fan.user_id).await.unwrap();
    assert!(has_like(&pool, story.id, fan.user_id).await.unwrap());

    insert_like(&pool, story.id, fan.user_id).await.unwrap();
    assert!(has_like(&pool, story.id, fan.user_id).await.unwrap());

    delete_like(&pool, story.id, fan.user_id).await.unwrap();
    assert!(!has_like(&pool, story.id, fan.user_id).await.unwrap());
}

#[tokio::test]
async fn comments_list_with_author_username() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "comment_author").await;
    let reader = seed_user(&pool, "reader").await;
    let story = seed_story(&pool, author.user_id, "Discuss", "short_story", None, None).await;

    let comment = insert_comment(&pool, story.id, reader.user_id, "Great read!", None)
        .await
        .unwrap();
    assert_eq!(comment.content, "Great read!");
    assert_eq!(comment.username.as_deref(), Some("reader"));

    let list = list_by_story_id(&pool, story.id, None).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].id, comment.id);
}

#[tokio::test]
async fn universe_follow_toggle() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "follow_owner").await;
    let follower = seed_user(&pool, "follower").await;
    let universe = seed_universe(&pool, owner.user_id, "Follow Me").await;

    assert!(!has_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap());

    insert_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap();
    assert!(has_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap());

    insert_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap();

    delete_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap();
    assert!(!has_follow(&pool, universe.id, follower.user_id)
        .await
        .unwrap());
}
