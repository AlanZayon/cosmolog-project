mod common;

use cosmolog_api::domain::library::{
    self, CreateCollectionInput, ReorderCollectionStoriesInput, UpdateCollectionInput,
};
use cosmolog_api::domain::likes::{delete_like, insert_like};

use common::fixtures::{seed_story, seed_user};

async fn pool() -> Option<sqlx::PgPool> {
    common::db::test_db().await
}

#[tokio::test]
async fn collection_crud_and_items() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "lib_owner").await;
    let author = seed_user(&pool, "lib_author").await;
    let story = seed_story(&pool, author.user_id, "Saved", "short_story", None, None).await;

    let input = CreateCollectionInput {
        name: "To Read".into(),
        description: Some("Later".into()),
        icon: Some("bookmark".into()),
    };
    let collection = library::insert(&pool, owner.user_id, &input)
        .await
        .unwrap();
    assert_eq!(collection.name, "To Read");
    assert_eq!(collection.icon, "bookmark");

    let list = library::list_by_user_id(&pool, owner.user_id).await.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].item_count, 0);

    library::insert_item(&pool, collection.id, story.id, owner.user_id)
        .await
        .unwrap();
    library::insert_item(&pool, collection.id, story.id, owner.user_id)
        .await
        .unwrap();

    let list = library::list_by_user_id(&pool, owner.user_id).await.unwrap();
    assert_eq!(list[0].item_count, 1);

    let stories = library::list_stories_in_collection(&pool, collection.id, owner.user_id)
        .await
        .unwrap();
    assert_eq!(stories.len(), 1);
    assert_eq!(stories[0].id, story.id);

    library::delete_item(&pool, collection.id, story.id, owner.user_id)
        .await
        .unwrap();
    let stories = library::list_stories_in_collection(&pool, collection.id, owner.user_id)
        .await
        .unwrap();
    assert!(stories.is_empty());

    let updated = library::update(
        &pool,
        collection.id,
        owner.user_id,
        &UpdateCollectionInput {
            name: Some("Renamed".into()),
            description: None,
            icon: Some("star".into()),
        },
    )
    .await
    .unwrap();
    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.icon, "star");

    library::delete(&pool, collection.id, owner.user_id)
        .await
        .unwrap();
    let list = library::list_by_user_id(&pool, owner.user_id).await.unwrap();
    assert!(list.is_empty());
}

#[tokio::test]
async fn list_liked_stories_ordered_by_like_time() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "like_author2").await;
    let fan = seed_user(&pool, "like_fan").await;
    let story_a = seed_story(&pool, author.user_id, "First", "short_story", None, None).await;
    let story_b = seed_story(&pool, author.user_id, "Second", "short_story", None, None).await;

    insert_like(&pool, story_a.id, fan.user_id).await.unwrap();
    insert_like(&pool, story_b.id, fan.user_id).await.unwrap();

    let liked = library::list_liked_stories(&pool, fan.user_id).await.unwrap();
    assert_eq!(liked.len(), 2);
    assert_eq!(liked[0].id, story_b.id);

    delete_like(&pool, story_b.id, fan.user_id).await.unwrap();
    let liked = library::list_liked_stories(&pool, fan.user_id).await.unwrap();
    assert_eq!(liked.len(), 1);
    assert_eq!(liked[0].id, story_a.id);
}

#[tokio::test]
async fn library_status_reports_liked_and_collections() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "status_owner").await;
    let author = seed_user(&pool, "status_author").await;
    let story = seed_story(&pool, author.user_id, "Status", "short_story", None, None).await;

    let collection = library::insert(
        &pool,
        owner.user_id,
        &CreateCollectionInput {
            name: "Shelf".into(),
            description: None,
            icon: None,
        },
    )
    .await
    .unwrap();

    insert_like(&pool, story.id, owner.user_id).await.unwrap();
    library::insert_item(&pool, collection.id, story.id, owner.user_id)
        .await
        .unwrap();

    let status = library::library_status(&pool, story.id, owner.user_id)
        .await
        .unwrap();
    assert!(status.liked);
    assert_eq!(status.collections.len(), 1);
    assert!(status.collections[0].contains_story);
}

#[tokio::test]
async fn reorder_collection_stories() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "reorder_owner").await;
    let author = seed_user(&pool, "reorder_author").await;
    let story_a = seed_story(&pool, author.user_id, "A", "short_story", None, None).await;
    let story_b = seed_story(&pool, author.user_id, "B", "short_story", None, None).await;
    let story_c = seed_story(&pool, author.user_id, "C", "short_story", None, None).await;

    let collection = library::insert(
        &pool,
        owner.user_id,
        &CreateCollectionInput {
            name: "Ordered".into(),
            description: None,
            icon: None,
        },
    )
    .await
    .unwrap();

    library::insert_item(&pool, collection.id, story_a.id, owner.user_id)
        .await
        .unwrap();
    library::insert_item(&pool, collection.id, story_b.id, owner.user_id)
        .await
        .unwrap();
    library::insert_item(&pool, collection.id, story_c.id, owner.user_id)
        .await
        .unwrap();

    library::reorder_stories(
        &pool,
        collection.id,
        owner.user_id,
        &ReorderCollectionStoriesInput {
            story_ids: vec![story_c.id, story_a.id, story_b.id],
        },
    )
    .await
    .unwrap();

    let stories = library::list_stories_in_collection(&pool, collection.id, owner.user_id)
        .await
        .unwrap();
    assert_eq!(stories.len(), 3);
    assert_eq!(stories[0].id, story_c.id);
    assert_eq!(stories[1].id, story_a.id);
    assert_eq!(stories[2].id, story_b.id);
}

#[tokio::test]
async fn foreign_user_cannot_access_collection() {
    let Some(pool) = pool().await else { return };
    let owner = seed_user(&pool, "col_owner").await;
    let intruder = seed_user(&pool, "col_intruder").await;

    let collection = library::insert(
        &pool,
        owner.user_id,
        &CreateCollectionInput {
            name: "Private".into(),
            description: None,
            icon: None,
        },
    )
    .await
    .unwrap();

    let err = library::list_stories_in_collection(&pool, collection.id, intruder.user_id)
        .await
        .unwrap_err();
    assert!(matches!(err, sqlx::Error::RowNotFound));
}
