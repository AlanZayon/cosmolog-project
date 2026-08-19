mod common;

use axum::http::StatusCode;
use sqlx::PgPool;
use uuid::Uuid;

use common::app::{assert_status, json, setup_app};
use common::fixtures::{seed_arc, seed_story, seed_universe, seed_user};

async fn set_story_age(pool: &PgPool, story_id: Uuid, hours_ago: f64) {
    sqlx::query("UPDATE stories SET created_at = now() - ($2 * INTERVAL '1 hour') WHERE id = $1")
        .bind(story_id)
        .bind(hours_ago)
        .execute(pool)
        .await
        .expect("set story age");
}

async fn follow_universe(pool: &PgPool, user_id: Uuid, universe_id: Uuid) {
    sqlx::query(
        "INSERT INTO universe_follows (user_id, universe_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(user_id)
    .bind(universe_id)
    .execute(pool)
    .await
    .expect("follow universe");
}

async fn like_story(pool: &PgPool, user_id: Uuid, story_id: Uuid) {
    sqlx::query("INSERT INTO likes (user_id, story_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .bind(story_id)
        .execute(pool)
        .await
        .expect("like story");
}

async fn seed_delivery(pool: &PgPool, user_id: Uuid, item_type: &str, item_id: Uuid, count: i32) {
    sqlx::query(
        r#"
        INSERT INTO feed_deliveries (user_id, item_type, item_id, delivery_count, last_delivered_at)
        VALUES ($1, $2, $3, $4, now() - INTERVAL '2 hours')
        ON CONFLICT (user_id, item_type, item_id) DO UPDATE
        SET delivery_count = EXCLUDED.delivery_count,
            last_delivered_at = EXCLUDED.last_delivered_at
        "#,
    )
    .bind(user_id)
    .bind(item_type)
    .bind(item_id)
    .bind(count)
    .execute(pool)
    .await
    .expect("seed delivery");
}

async fn call_get_feed(
    pool: &PgPool,
    limit: i32,
    viewer_id: Option<Uuid>,
) -> Vec<(Uuid, String, f64)> {
    let rows = sqlx::query_as::<_, (Uuid, String, f64)>(
        "SELECT id, type, ranking_score FROM public.get_feed($1, $2)",
    )
    .bind(limit)
    .bind(viewer_id)
    .fetch_all(pool)
    .await
    .expect("get_feed");
    rows
}

fn story_ids(items: &[(Uuid, String, f64)]) -> Vec<Uuid> {
    items
        .iter()
        .filter(|(_, t, _)| t == "story")
        .map(|(id, _, _)| *id)
        .collect()
}

#[tokio::test]
async fn followed_story_ranks_above_unfollowed_same_age() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_follow_viewer").await;
    let author_a = seed_user(&app.pool, "rank_follow_a").await;
    let author_b = seed_user(&app.pool, "rank_follow_b").await;

    let followed = seed_universe(&app.pool, author_a.user_id, "Followed U").await;
    let other = seed_universe(&app.pool, author_b.user_id, "Other U").await;
    follow_universe(&app.pool, viewer.user_id, followed.id).await;

    let s_followed = seed_story(
        &app.pool,
        author_a.user_id,
        "Followed Story",
        "short_story",
        Some(followed.id),
        None,
    )
    .await;
    let s_other = seed_story(
        &app.pool,
        author_b.user_id,
        "Other Story",
        "short_story",
        Some(other.id),
        None,
    )
    .await;
    set_story_age(&app.pool, s_followed.id, 2.0).await;
    set_story_age(&app.pool, s_other.id, 2.0).await;

    let items = call_get_feed(&app.pool, 20, Some(viewer.user_id)).await;
    let ids = story_ids(&items);
    let pos_followed = ids.iter().position(|id| *id == s_followed.id);
    let pos_other = ids.iter().position(|id| *id == s_other.id);
    assert!(pos_followed.is_some(), "followed story present");
    assert!(pos_other.is_some(), "other story present");
    assert!(
        pos_followed.unwrap() < pos_other.unwrap(),
        "followed story should rank above unfollowed"
    );
}

#[tokio::test]
async fn own_story_ranks_below_peer_same_age() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_own_viewer").await;
    let peer = seed_user(&app.pool, "rank_own_peer").await;

    let own_u = seed_universe(&app.pool, viewer.user_id, "Own U").await;
    let peer_u = seed_universe(&app.pool, peer.user_id, "Peer U").await;

    let own_story = seed_story(
        &app.pool,
        viewer.user_id,
        "My Story",
        "short_story",
        Some(own_u.id),
        None,
    )
    .await;
    let peer_story = seed_story(
        &app.pool,
        peer.user_id,
        "Peer Story",
        "short_story",
        Some(peer_u.id),
        None,
    )
    .await;
    set_story_age(&app.pool, own_story.id, 1.0).await;
    set_story_age(&app.pool, peer_story.id, 1.0).await;

    let items = call_get_feed(&app.pool, 20, Some(viewer.user_id)).await;
    let ids = story_ids(&items);
    let pos_own = ids.iter().position(|id| *id == own_story.id);
    let pos_peer = ids.iter().position(|id| *id == peer_story.id);
    assert!(pos_own.is_some() && pos_peer.is_some());
    assert!(
        pos_peer.unwrap() < pos_own.unwrap(),
        "own story should rank below peer story of same age"
    );
}

#[tokio::test]
async fn engagement_beats_small_age_gap() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_eng_viewer").await;
    let author = seed_user(&app.pool, "rank_eng_author").await;
    let likers: Vec<_> = {
        let mut v = Vec::new();
        for i in 0..12 {
            v.push(seed_user(&app.pool, &format!("rank_eng_liker_{i}")).await);
        }
        v
    };

    let u = seed_universe(&app.pool, author.user_id, "Eng U").await;
    let popular = seed_story(
        &app.pool,
        author.user_id,
        "Popular Story",
        "short_story",
        Some(u.id),
        None,
    )
    .await;
    let fresh = seed_story(
        &app.pool,
        author.user_id,
        "Fresh Quiet Story",
        "short_story",
        Some(u.id),
        None,
    )
    .await;

    // Popular is 4h older; many likes should still win.
    set_story_age(&app.pool, popular.id, 5.0).await;
    set_story_age(&app.pool, fresh.id, 1.0).await;
    for l in &likers {
        like_story(&app.pool, l.user_id, popular.id).await;
    }

    let items = call_get_feed(&app.pool, 20, Some(viewer.user_id)).await;
    let ids = story_ids(&items);
    let pos_popular = ids.iter().position(|id| *id == popular.id);
    let pos_fresh = ids.iter().position(|id| *id == fresh.id);
    assert!(pos_popular.is_some() && pos_fresh.is_some());
    assert!(
        pos_popular.unwrap() < pos_fresh.unwrap(),
        "engaged story should beat slightly fresher quiet story"
    );
}

#[tokio::test]
async fn author_diversity_lets_second_author_into_top() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_div_viewer").await;
    let author_a = seed_user(&app.pool, "rank_div_a").await;
    let author_b = seed_user(&app.pool, "rank_div_b").await;

    let u_a = seed_universe(&app.pool, author_a.user_id, "Div A").await;
    let u_b = seed_universe(&app.pool, author_b.user_id, "Div B").await;

    let mut a_stories = Vec::new();
    for i in 0..5 {
        let s = seed_story(
            &app.pool,
            author_a.user_id,
            &format!("A Story {i}"),
            "short_story",
            Some(u_a.id),
            None,
        )
        .await;
        set_story_age(&app.pool, s.id, 0.5 + i as f64 * 0.1).await;
        a_stories.push(s.id);
    }
    let b_story = seed_story(
        &app.pool,
        author_b.user_id,
        "B Story",
        "short_story",
        Some(u_b.id),
        None,
    )
    .await;
    set_story_age(&app.pool, b_story.id, 0.6).await;

    let items = call_get_feed(&app.pool, 10, Some(viewer.user_id)).await;
    let top3: Vec<Uuid> = story_ids(&items).into_iter().take(3).collect();
    assert!(
        top3.contains(&b_story.id),
        "author B should appear in top 3 despite author A flooding: {:?}",
        top3
    );
}

#[tokio::test]
async fn high_delivery_count_damps_story() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_seen_viewer").await;
    let author = seed_user(&app.pool, "rank_seen_author").await;
    let u = seed_universe(&app.pool, author.user_id, "Seen U").await;

    let repeated = seed_story(
        &app.pool,
        author.user_id,
        "Seen Often",
        "short_story",
        Some(u.id),
        None,
    )
    .await;
    let fresh = seed_story(
        &app.pool,
        author.user_id,
        "Not Seen",
        "short_story",
        Some(u.id),
        None,
    )
    .await;
    set_story_age(&app.pool, repeated.id, 1.0).await;
    set_story_age(&app.pool, fresh.id, 1.0).await;
    seed_delivery(&app.pool, viewer.user_id, "story", repeated.id, 8).await;

    let items = call_get_feed(&app.pool, 20, Some(viewer.user_id)).await;
    let ids = story_ids(&items);
    let pos_repeated = ids.iter().position(|id| *id == repeated.id);
    let pos_fresh = ids.iter().position(|id| *id == fresh.id);
    assert!(pos_repeated.is_some() && pos_fresh.is_some());
    assert!(
        pos_fresh.unwrap() < pos_repeated.unwrap(),
        "heavily delivered story should rank lower"
    );
}

#[tokio::test]
async fn empty_followed_and_single_story_arc_excluded() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_card_viewer").await;
    let author = seed_user(&app.pool, "rank_card_author").await;

    let empty_u = seed_universe(&app.pool, author.user_id, "Empty Uni").await;
    let followed_u = seed_universe(&app.pool, author.user_id, "Followed Uni").await;
    follow_universe(&app.pool, viewer.user_id, followed_u.id).await;
    let _followed_story = seed_story(
        &app.pool,
        author.user_id,
        "In Followed",
        "short_story",
        Some(followed_u.id),
        None,
    )
    .await;

    let single_u = seed_universe(&app.pool, author.user_id, "Single Arc Uni").await;
    let single_arc = seed_arc(&app.pool, single_u.id, "Lonely Arc").await;
    let _only = seed_story(
        &app.pool,
        author.user_id,
        "Only In Arc",
        "short_story",
        Some(single_u.id),
        Some(single_arc.id),
    )
    .await;

    let multi_u = seed_universe(&app.pool, author.user_id, "Multi Arc Uni").await;
    let multi_arc = seed_arc(&app.pool, multi_u.id, "Busy Arc").await;
    let s1 = seed_story(
        &app.pool,
        author.user_id,
        "Arc S1",
        "short_story",
        Some(multi_u.id),
        Some(multi_arc.id),
    )
    .await;
    let s2 = seed_story(
        &app.pool,
        author.user_id,
        "Arc S2",
        "short_story",
        Some(multi_u.id),
        Some(multi_arc.id),
    )
    .await;
    set_story_age(&app.pool, s1.id, 1.0).await;
    set_story_age(&app.pool, s2.id, 2.0).await;

    let items = call_get_feed(&app.pool, 50, Some(viewer.user_id)).await;
    let universe_ids: Vec<Uuid> = items
        .iter()
        .filter(|(_, t, _)| t == "universe")
        .map(|(id, _, _)| *id)
        .collect();
    let arc_ids: Vec<Uuid> = items
        .iter()
        .filter(|(_, t, _)| t == "arc")
        .map(|(id, _, _)| *id)
        .collect();

    assert!(
        !universe_ids.contains(&empty_u.id),
        "empty universe must not appear"
    );
    assert!(
        !universe_ids.contains(&followed_u.id),
        "already-followed universe must not appear as discovery card"
    );
    assert!(
        !arc_ids.contains(&single_arc.id),
        "arc with a single story must not appear"
    );
    assert!(
        arc_ids.contains(&multi_arc.id),
        "arc with 2+ recent stories should be eligible"
    );
}

#[tokio::test]
async fn same_day_feed_order_is_stable() {
    let Some(app) = setup_app().await else { return };
    let viewer = seed_user(&app.pool, "rank_stable_viewer").await;
    let author = seed_user(&app.pool, "rank_stable_author").await;
    let u = seed_universe(&app.pool, author.user_id, "Stable U").await;
    for i in 0..6 {
        let s = seed_story(
            &app.pool,
            author.user_id,
            &format!("Stable {i}"),
            "short_story",
            Some(u.id),
            None,
        )
        .await;
        set_story_age(&app.pool, s.id, i as f64 + 0.5).await;
    }

    let first = call_get_feed(&app.pool, 10, Some(viewer.user_id)).await;
    let second = call_get_feed(&app.pool, 10, Some(viewer.user_id)).await;
    let first_ids: Vec<_> = first.iter().map(|(id, t, _)| (*id, t.clone())).collect();
    let second_ids: Vec<_> = second.iter().map(|(id, t, _)| (*id, t.clone())).collect();
    assert_eq!(first_ids, second_ids, "same-day feed order must be stable");
}

#[tokio::test]
async fn authenticated_feed_records_deliveries() {
    let Some(app) = setup_app().await else { return };
    let author = seed_user(&app.pool, "rank_del_author").await;
    let viewer = seed_user(&app.pool, "rank_del_viewer").await;
    let u = seed_universe(&app.pool, author.user_id, "Del U").await;
    let story = seed_story(
        &app.pool,
        author.user_id,
        "Delivered Story",
        "short_story",
        Some(u.id),
        None,
    )
    .await;
    let token = app.register_user(&viewer);

    let response = app.get("/feed?limit=10", Some(&token)).await;
    assert_status(&response, StatusCode::OK);
    let body = json(response).await;
    assert!(body.as_array().is_some());

    let count: (i64,) = sqlx::query_as(
        r#"
        SELECT COUNT(*)::bigint
        FROM feed_deliveries
        WHERE user_id = $1 AND item_type = 'story' AND item_id = $2
        "#,
    )
    .bind(viewer.user_id)
    .bind(story.id)
    .fetch_one(&app.pool)
    .await
    .expect("count deliveries");
    assert_eq!(
        count.0, 1,
        "served story should be logged in feed_deliveries"
    );
}
