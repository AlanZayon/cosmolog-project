mod common;

use cosmolog_api::domain::blocks::{list_for_story, replace_for_story, BlockInput};
use cosmolog_api::domain::chapters::{
    count_by_story_id, find_by_story_and_number, insert as insert_chapter, list_by_story_id,
    update_title,
};
use cosmolog_api::domain::comic_pages::{
    list_by_story_id as list_comic_pages, replace_for_story as replace_comic_pages,
};

use common::fixtures::{seed_story, seed_user};

async fn pool() -> Option<sqlx::PgPool> {
    common::db::test_db().await
}

#[tokio::test]
async fn chapters_insert_list_and_unique_number() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "chapter_author").await;
    let story = seed_story(&pool, author.user_id, "Book", "chapters", None, None).await;

    let ch1 = insert_chapter(&pool, story.id, "Chapter 1", 1)
        .await
        .unwrap();
    insert_chapter(&pool, story.id, "Chapter 2", 2)
        .await
        .unwrap();

    let list = list_by_story_id(&pool, story.id).await.unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(count_by_story_id(&pool, story.id).await.unwrap(), 2);

    let found = find_by_story_and_number(&pool, story.id, 1)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(found.id, ch1.id);

    let renamed = update_title(&pool, ch1.id, "Chapter One").await.unwrap();
    assert_eq!(renamed.title, "Chapter One");

    let dup = insert_chapter(&pool, story.id, "Duplicate", 1).await;
    assert!(dup.is_err());
}

#[tokio::test]
async fn blocks_replace_at_story_and_chapter_level() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "block_author").await;
    let story = seed_story(&pool, author.user_id, "Blocks", "short_story", None, None).await;
    let chapter = insert_chapter(&pool, story.id, "Ch", 1).await.unwrap();

    let story_blocks = vec![
        BlockInput {
            block_type: "text".into(),
            content: "Hello".into(),
        },
        BlockInput {
            block_type: "image".into(),
            content: "https://example.com/a.png".into(),
        },
    ];
    let saved = replace_for_story(&pool, story.id, None, &story_blocks)
        .await
        .unwrap();
    assert_eq!(saved.len(), 2);

    let listed = list_for_story(&pool, story.id, None).await.unwrap();
    assert_eq!(listed.len(), 2);

    replace_for_story(&pool, story.id, None, &[]).await.unwrap();
    assert!(list_for_story(&pool, story.id, None)
        .await
        .unwrap()
        .is_empty());

    let chapter_blocks = vec![BlockInput {
        block_type: "text".into(),
        content: "Chapter body".into(),
    }];
    replace_for_story(&pool, story.id, Some(chapter.id), &chapter_blocks)
        .await
        .unwrap();
    let ch_blocks = list_for_story(&pool, story.id, Some(chapter.id))
        .await
        .unwrap();
    assert_eq!(ch_blocks.len(), 1);
    assert_eq!(ch_blocks[0].content, "Chapter body");
}

#[tokio::test]
async fn comic_pages_replace_and_list() {
    let Some(pool) = pool().await else { return };
    let author = seed_user(&pool, "comic_author").await;
    let story = seed_story(&pool, author.user_id, "Comic", "comic", None, None).await;

    let pages = replace_comic_pages(
        &pool,
        story.id,
        &[
            ("https://example.com/p1.png".into(), 1),
            ("https://example.com/p2.png".into(), 2),
        ],
    )
    .await
    .unwrap();
    assert_eq!(pages.len(), 2);

    let listed = list_comic_pages(&pool, story.id).await.unwrap();
    assert_eq!(listed.len(), 2);
    assert_eq!(listed[0].page_order, 1);

    replace_comic_pages(&pool, story.id, &[]).await.unwrap();
    assert!(list_comic_pages(&pool, story.id).await.unwrap().is_empty());
}
