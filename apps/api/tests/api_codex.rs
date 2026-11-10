mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::app::{assert_status, json, setup_app, text_body};
use common::fixtures::{seed_arc, seed_story, seed_universe, seed_user};

fn gallery_image_url() -> String {
    "https://cdn.test.example/codex-gallery/u1/asset.png".into()
}

fn map_image_url() -> String {
    "https://cdn.test.example/codex-maps/u1/map.png".into()
}

#[tokio::test]
async fn codex_create_entry_as_owner_and_deny_intruder() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "codex_owner").await;
    let intruder = seed_user(&app.pool, "codex_intruder").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Codex U").await;
    let owner_token = app.register_user(&owner);
    let intruder_token = app.register_user(&intruder);

    let create = app
        .post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&owner_token),
            json!({
                "kind": "faction",
                "slug": "rebel-alliance",
                "title": "Rebel Alliance",
                "summary": "Freedom fighters",
                "publish_state": "published"
            }),
        )
        .await;
    assert_status(&create, StatusCode::OK);
    let entry = json(create).await;
    let entry_id = entry["id"].as_str().unwrap().to_string();

    let by_slug = app
        .get(
            &format!(
                "/universes/{}/codex/entries/by-slug/Rebel-Alliance",
                universe.id
            ),
            None,
        )
        .await;
    assert_status(&by_slug, StatusCode::OK);
    assert_eq!(json(by_slug).await["id"], entry_id);

    let denied = app
        .post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&intruder_token),
            json!({
                "kind": "faction",
                "slug": "empire",
                "title": "Empire",
            }),
        )
        .await;
    assert_status(&denied, StatusCode::UNAUTHORIZED);

    let removed = app
        .delete(&format!("/codex/entries/{entry_id}"), Some(&owner_token))
        .await;
    assert_status(&removed, StatusCode::OK);

    let gone = app
        .get(&format!("/codex/entries/{entry_id}"), Some(&owner_token))
        .await;
    assert_status(&gone, StatusCode::NOT_FOUND);

    let reused = app
        .post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&owner_token),
            json!({
                "kind": "faction",
                "slug": "rebel-alliance",
                "title": "Rebel Alliance Reborn",
            }),
        )
        .await;
    assert_status(&reused, StatusCode::OK);
}

#[tokio::test]
async fn codex_list_search_and_draft_visibility() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "list_owner").await;
    let universe = seed_universe(&app.pool, owner.user_id, "List U").await;
    let token = app.register_user(&owner);

    app.post_json(
        &format!("/universes/{}/codex/entries", universe.id),
        Some(&token),
        json!({
            "kind": "character",
            "slug": "luke",
            "title": "Luke Skywalker",
            "publish_state": "published"
        }),
    )
    .await;

    let draft = json(
        app.post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&token),
            json!({
                "kind": "character",
                "slug": "leia-draft",
                "title": "Leia Organa",
                "publish_state": "draft"
            }),
        )
        .await,
    )
    .await;
    let draft_id = draft["id"].as_str().unwrap();

    let hidden = app.get(&format!("/codex/entries/{draft_id}"), None).await;
    assert_status(&hidden, StatusCode::NOT_FOUND);

    let owner_draft = app
        .get(&format!("/codex/entries/{draft_id}"), Some(&token))
        .await;
    assert_status(&owner_draft, StatusCode::OK);

    let public = app
        .get(&format!("/universes/{}/codex/entries", universe.id), None)
        .await;
    assert_status(&public, StatusCode::OK);
    assert_eq!(json(public).await.as_array().unwrap().len(), 1);

    let owner_list = app
        .get(
            &format!(
                "/universes/{}/codex/entries?include_drafts=true",
                universe.id
            ),
            Some(&token),
        )
        .await;
    assert_eq!(json(owner_list).await.as_array().unwrap().len(), 2);

    let search = app
        .get(
            &format!("/universes/{}/codex/entries?q=luke", universe.id),
            None,
        )
        .await;
    let hits = json(search).await;
    assert_eq!(hits.as_array().unwrap().len(), 1);
    assert_eq!(hits[0]["slug"], "luke");
}

#[tokio::test]
async fn codex_blocks_replace_relation_timeline() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "blocks_owner").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Blocks U").await;
    let token = app.register_user(&owner);

    let e1 = json(
        app.post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&token),
            json!({
                "kind": "place",
                "slug": "tatooine",
                "title": "Tatooine",
            }),
        )
        .await,
    )
    .await;
    let e2 = json(
        app.post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&token),
            json!({
                "kind": "place",
                "slug": "naboo",
                "title": "Naboo",
            }),
        )
        .await,
    )
    .await;

    let blocks = app
        .put_json(
            &format!("/codex/entries/{}/blocks", e1["id"].as_str().unwrap()),
            Some(&token),
            json!({
                "blocks": [
                    { "block_type": "text", "content": "A desert world.", "block_order": 0 }
                ]
            }),
        )
        .await;
    assert_status(&blocks, StatusCode::OK);
    assert_eq!(json(blocks).await.as_array().unwrap().len(), 1);

    let rel = app
        .post_json(
            &format!("/universes/{}/codex/relations", universe.id),
            Some(&token),
            json!({
                "from_entry_id": e1["id"],
                "to_entry_id": e2["id"],
                "rel_type": "related",
            }),
        )
        .await;
    assert_status(&rel, StatusCode::OK);

    let timeline = app
        .post_json(
            &format!("/universes/{}/codex/timeline", universe.id),
            Some(&token),
            json!({
                "title": "Battle of Yavin",
                "body": "The Death Star falls.",
                "occurred_at_label": "0 ABY",
            }),
        )
        .await;
    assert_status(&timeline, StatusCode::OK);
}

#[tokio::test]
async fn codex_map_pins_gallery_toc_arc_appearance_export() {
    let Some(app) = setup_app().await else { return };
    let owner = seed_user(&app.pool, "full_owner").await;
    let universe = seed_universe(&app.pool, owner.user_id, "Export U").await;
    let token = app.register_user(&owner);
    let arc = seed_arc(&app.pool, universe.id, "Main Saga").await;
    let story = seed_story(
        &app.pool,
        owner.user_id,
        "ANH",
        "short_story",
        Some(universe.id),
        Some(arc.id),
    )
    .await;

    let entry = json(
        app.post_json(
            &format!("/universes/{}/codex/entries", universe.id),
            Some(&token),
            json!({
                "kind": "character",
                "slug": "han",
                "title": "Han Solo",
                "summary": "Smuggler",
            }),
        )
        .await,
    )
    .await;

    let map = json(
        app.post_json(
            &format!("/universes/{}/codex/maps", universe.id),
            Some(&token),
            json!({
                "title": "Galaxy",
                "image_url": map_image_url(),
            }),
        )
        .await,
    )
    .await;

    let pins = app
        .put_json(
            &format!("/codex/maps/{}/pins", map["id"].as_str().unwrap()),
            Some(&token),
            json!({
                "pins": [
                    { "label": "Core", "x_norm": 0.5, "y_norm": 0.5, "entry_id": entry["id"] }
                ]
            }),
        )
        .await;
    assert_status(&pins, StatusCode::OK);

    let gallery = json(
        app.post_json(
            &format!("/universes/{}/codex/gallery", universe.id),
            Some(&token),
            json!({ "title": "Concept Art" }),
        )
        .await,
    )
    .await;

    let assets = app
        .put_json(
            &format!("/codex/gallery/{}/assets", gallery["id"].as_str().unwrap()),
            Some(&token),
            json!({
                "assets": [
                    {
                        "image_url": gallery_image_url(),
                        "art_kind": "final",
                        "sort_key": 0,
                        "entry_id": entry["id"]
                    }
                ]
            }),
        )
        .await;
    assert_status(&assets, StatusCode::OK);

    let toc = app
        .put_json(
            &format!("/universes/{}/codex/toc", universe.id),
            Some(&token),
            json!({
                "items": [
                    { "title": "Cover", "href_kind": "cover", "sort_key": 0 },
                    { "title": "Han Solo", "href_kind": "entry", "entry_id": entry["id"], "sort_key": 1 }
                ]
            }),
        )
        .await;
    assert_status(&toc, StatusCode::OK);

    let link = app
        .post_json(
            &format!("/arcs/{}/lore-links", arc.id),
            Some(&token),
            json!({ "entry_id": entry["id"] }),
        )
        .await;
    assert_status(&link, StatusCode::OK);

    let appearance = app
        .post_json(
            &format!(
                "/codex/entries/{}/appearances",
                entry["id"].as_str().unwrap()
            ),
            Some(&token),
            json!({ "story_id": story.id }),
        )
        .await;
    assert_status(&appearance, StatusCode::OK);

    let _ = app
        .post_json(
            &format!("/universes/{}/codex/timeline", universe.id),
            Some(&token),
            json!({
                "title": "Kessel Run",
                "body": "Han makes the run.",
            }),
        )
        .await;

    let premise = app
        .patch_json(
            &format!("/universes/{}", universe.id),
            Some(&token),
            json!({
                "saga_premise": "A smuggler finds a cause.",
                "afterword": "May the Force be with you.",
                "default_calendar_label": "ABY",
                "codex_enabled": true
            }),
        )
        .await;
    assert_status(&premise, StatusCode::OK);
    let universe_body = json(premise).await;
    assert_eq!(universe_body["saga_premise"], "A smuggler finds a cause.");
    assert_eq!(universe_body["default_calendar_label"], "ABY");
    assert_eq!(universe_body["codex_enabled"], true);

    let export = app
        .get(&format!("/universes/{}/codex/export.md", universe.id), None)
        .await;
    assert_status(&export, StatusCode::OK);
    let md = text_body(export).await;
    assert!(md.contains("Han Solo"));
    assert!(md.contains("Kessel Run"));
    assert!(md.contains("A smuggler finds a cause."));
    assert!(md.contains("May the Force be with you."));
}
