use axum::{
    http::{header, HeaderName, Method},
    middleware,
    routing::{get, patch, post},
    Router,
};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::Config;
use crate::middleware::request_context;
use crate::routes::{arcs, auth, db, feed, health, profiles, storage, stories, story_content, universes};
use crate::state::AppState;

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
        .expose_headers([HeaderName::from_static(
            request_context::REQUEST_ID_HEADER,
        )]);

    Router::new()
        .route("/health", get(health::health))
        .route("/db/ping", get(db::ping))
        .route("/auth/sign-in", post(auth::sign_in))
        .route("/auth/sign-up", post(auth::sign_up))
        .route("/auth/refresh", post(auth::refresh))
        .route("/auth/me", get(auth::me))
        .route("/feed", get(feed::list))
        .route("/storage/upload", post(storage::upload))
        .route(
            "/profiles/me",
            get(profiles::me).patch(profiles::update_me),
        )
        .route("/profiles/batch", get(profiles::batch))
        .route("/profiles/user/{user_id}", get(profiles::by_user_id))
        .route("/profiles/{username}", get(profiles::by_username))
        .route("/stories", post(stories::create))
        .route("/stories/search", get(stories::search))
        .route("/stories/me", get(stories::list_mine))
        .route(
            "/stories/{id}",
            get(stories::by_id).patch(story_content::update_story),
        )
        .route("/stories/{id}/chapters", get(story_content::list_chapters).post(story_content::create_chapter))
        .route("/stories/{id}/chapters/count", get(story_content::chapter_count))
        .route("/stories/{id}/chapters/by-number", get(story_content::chapter_by_number))
        .route(
            "/stories/{story_id}/chapters/{chapter_id}",
            patch(story_content::update_chapter),
        )
        .route("/stories/{id}/comic-pages", get(story_content::list_comic_pages).put(story_content::replace_comic_pages))
        .route("/stories/{id}/comic-pages/append", post(story_content::insert_comic_page))
        .route(
            "/stories/{id}/blocks",
            get(story_content::list_blocks).put(story_content::replace_blocks),
        )
        .route(
            "/stories/{id}/comments",
            get(story_content::list_comments).post(story_content::create_comment),
        )
        .route("/stories/{id}/like", get(story_content::like_status).post(story_content::toggle_like))
        .route("/universes", post(universes::create))
        .route("/universes/me", get(universes::list_mine))
        .route(
            "/universes/{id}",
            get(universes::by_id).patch(universes::update),
        )
        .route("/universes/{id}/follow", get(universes::follow_status).post(universes::follow).delete(universes::unfollow))
        .route("/universes/{id}/arcs", get(universes::arcs).post(arcs::create_for_universe))
        .route("/universes/{id}/stories", get(universes::stories))
        .route(
            "/arcs/{id}",
            get(arcs::by_id).patch(arcs::update).delete(arcs::delete),
        )
        .route("/arcs/{id}/stories", get(arcs::stories))
        .layer(middleware::from_fn(request_context::middleware))
        .layer(cors)
        .with_state(state)
}
