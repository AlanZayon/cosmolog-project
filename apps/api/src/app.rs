use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderName, Method},
    middleware,
    routing::{get, patch, post},
    Router,
};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::Config;
use crate::domain::limits::MAX_UPLOAD_BYTES;
use crate::middleware::{rate_limit, request_context, security_headers};
use crate::routes::{
    arcs, auth, db, feed, health, library, notifications, profiles, storage, stories,
    story_content, universes,
};
use crate::state::AppState;

fn is_production() -> bool {
    std::env::var("APP_ENV")
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false)
}

pub fn router(state: AppState, config: &Config) -> Router {
    let origin = config
        .cors_allowed_origin
        .parse::<axum::http::HeaderValue>()
        .expect("CORS_ALLOWED_ORIGIN must be a valid origin URL");

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact(origin))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            HeaderName::from_static(request_context::REQUEST_ID_HEADER),
        ])
        .expose_headers([HeaderName::from_static(request_context::REQUEST_ID_HEADER)]);

    let auth_routes = Router::new()
        .route("/auth/sign-in", post(auth::sign_in))
        .route("/auth/sign-up", post(auth::sign_up))
        .route("/auth/refresh", post(auth::refresh))
        .layer(middleware::from_fn(rate_limit::auth_rate_limit));

    let mut api = Router::new()
        .route("/health", get(health::health))
        .merge(auth_routes)
        .route("/auth/me", get(auth::me))
        .route("/feed", get(feed::list))
        .route(
            "/storage/upload",
            post(storage::upload).layer(DefaultBodyLimit::max(MAX_UPLOAD_BYTES)),
        )
        .route("/profiles/me", get(profiles::me).patch(profiles::update_me))
        .route("/profiles/batch", get(profiles::batch))
        .route("/profiles/search", get(profiles::search))
        .route("/profiles/user/{user_id}", get(profiles::by_user_id))
        .route("/profiles/{username}", get(profiles::by_username))
        .route(
            "/profiles/{username}/notification-subscription",
            get(notifications::profile_subscription_status)
                .post(notifications::subscribe_profile)
                .delete(notifications::unsubscribe_profile),
        )
        .route(
            "/profiles/{username}/stories",
            get(profiles::stories_by_username),
        )
        .route(
            "/profiles/{username}/universes",
            get(profiles::universes_by_username),
        )
        .route("/stories", post(stories::create))
        .route("/stories/search", get(stories::search))
        .route("/stories/me", get(stories::list_mine))
        .route(
            "/stories/{id}",
            get(stories::by_id).patch(story_content::update_story),
        )
        .route(
            "/stories/{id}/chapters",
            get(story_content::list_chapters).post(story_content::create_chapter),
        )
        .route(
            "/stories/{id}/chapters/count",
            get(story_content::chapter_count),
        )
        .route(
            "/stories/{id}/chapters/by-number",
            get(story_content::chapter_by_number),
        )
        .route(
            "/stories/{story_id}/chapters/{chapter_id}",
            patch(story_content::update_chapter),
        )
        .route(
            "/stories/{id}/comic-pages",
            get(story_content::list_comic_pages).put(story_content::replace_comic_pages),
        )
        .route(
            "/stories/{id}/comic-pages/append",
            post(story_content::insert_comic_page),
        )
        .route(
            "/stories/{id}/blocks",
            get(story_content::list_blocks).put(story_content::replace_blocks),
        )
        .route(
            "/stories/{id}/comments",
            get(story_content::list_comments).post(story_content::create_comment),
        )
        .route(
            "/stories/{story_id}/comments/{comment_id}/like",
            get(story_content::comment_like_status).post(story_content::toggle_comment_like),
        )
        .route(
            "/stories/{id}/like",
            get(story_content::like_status).post(story_content::toggle_like),
        )
        .route("/stories/{id}/library-status", get(library::library_status))
        .route("/library/liked-stories", get(library::liked_stories))
        .route(
            "/library/collections",
            get(library::list_collections).post(library::create_collection),
        )
        .route(
            "/library/collections/{id}",
            patch(library::update_collection).delete(library::delete_collection),
        )
        .route(
            "/library/collections/{id}/stories",
            get(library::list_collection_stories),
        )
        .route(
            "/library/collections/{id}/stories/order",
            axum::routing::put(library::reorder_collection_stories),
        )
        .route(
            "/library/collections/{collection_id}/stories/{story_id}",
            post(library::add_story).delete(library::remove_story),
        )
        .route("/universes", post(universes::create))
        .route("/universes/me", get(universes::list_mine))
        .route(
            "/universes/{id}",
            get(universes::by_id).patch(universes::update),
        )
        .route(
            "/universes/{id}/follow",
            get(universes::follow_status)
                .post(universes::follow)
                .delete(universes::unfollow),
        )
        .route(
            "/universes/{id}/notification-subscription",
            get(notifications::universe_subscription_status)
                .post(notifications::subscribe_universe)
                .delete(notifications::unsubscribe_universe),
        )
        .route(
            "/universes/{id}/arcs",
            get(universes::arcs).post(arcs::create_for_universe),
        )
        .route("/universes/{id}/stories", get(universes::stories))
        .route(
            "/arcs/{id}",
            get(arcs::by_id).patch(arcs::update).delete(arcs::delete),
        )
        .route("/arcs/{id}/stories", get(arcs::stories))
        .route("/notifications/stream", get(notifications::stream))
        .route("/notifications", get(notifications::list))
        .route(
            "/notifications/unread-count",
            get(notifications::unread_count),
        )
        .route("/notifications/{id}/consume", post(notifications::consume));

    if !is_production() {
        api = api.route("/db/ping", get(db::ping));
    }

    security_headers::apply(
        api.layer(DefaultBodyLimit::max(2 * 1024 * 1024))
            .layer(middleware::from_fn(request_context::middleware))
            .layer(cors)
            .with_state(state),
    )
}
