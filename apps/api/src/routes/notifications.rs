use std::convert::Infallible;
use std::time::Duration;

use axum::extract::{Path, Query, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use futures_util::{future, Stream, StreamExt};
use serde::Deserialize;
use tokio_stream::wrappers::BroadcastStream;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::domain::limits::MAX_NOTIFICATIONS_LIST_LIMIT;
use crate::domain::notifications::{
    self, ConsumeNotificationResponse, NotificationListResponse, SubscriptionStatus,
    UnreadCountResponse,
};
use crate::domain::profiles;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListNotificationsQuery {
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    notifications::default_list_limit()
}

/// Status of profile notification subscription for the authenticated user.
pub async fn profile_subscription_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(username): Path<String>,
) -> Result<Json<SubscriptionStatus>, AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    let status = notifications::profile_subscription_status(
        &state.pool,
        user.user_id,
        profile.user_id,
    )
    .await
    .map_err(AppError::from_db)?;

    Ok(Json(status))
}

/// Activate or reactivate profile notification subscription.
pub async fn subscribe_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Path(username): Path<String>,
) -> Result<Json<SubscriptionStatus>, AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    if user.user_id == profile.user_id {
        return Err(AppError::BadRequest(
            "cannot subscribe to your own profile".into(),
        ));
    }

    let story_count = notifications::count_stories_by_author(&state.pool, profile.user_id)
        .await
        .map_err(AppError::from_db)?;
    if story_count < 1 {
        return Err(AppError::BadRequest(
            "profile must have at least one published story".into(),
        ));
    }

    let row = notifications::upsert_profile_subscription(
        &state.pool,
        user.user_id,
        profile.user_id,
    )
    .await
    .map_err(AppError::from_db)?;

    Ok(Json(SubscriptionStatus::from_row(&row)))
}

/// Deactivate profile notification subscription (manual).
pub async fn unsubscribe_profile(
    State(state): State<AppState>,
    user: AuthUser,
    Path(username): Path<String>,
) -> Result<(), AppError> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("username is required".into()));
    }

    let profile = profiles::find_by_username(&state.pool, username)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    notifications::deactivate_profile_subscription(&state.pool, user.user_id, profile.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(())
}

/// Status of universe notification subscription for the authenticated user.
pub async fn universe_subscription_status(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SubscriptionStatus>, AppError> {
    if notifications::find_universe_owner(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .is_none()
    {
        return Err(AppError::NotFound);
    }

    let status = notifications::universe_subscription_status(&state.pool, user.user_id, id)
        .await
        .map_err(AppError::from_db)?;
    Ok(Json(status))
}

/// Activate or reactivate universe notification subscription.
pub async fn subscribe_universe(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<SubscriptionStatus>, AppError> {
    let owner_id = notifications::find_universe_owner(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    if user.user_id == owner_id {
        return Err(AppError::BadRequest(
            "cannot subscribe to notifications for your own universe".into(),
        ));
    }

    let row = notifications::upsert_universe_subscription(
        &state.pool,
        user.user_id,
        owner_id,
        id,
    )
    .await
    .map_err(AppError::from_db)?;

    let mut status = SubscriptionStatus::from_row(&row);
    status.universe_id = Some(id);
    Ok(Json(status))
}

/// Deactivate universe notification subscription (manual).
pub async fn unsubscribe_universe(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    if notifications::find_universe_owner(&state.pool, id)
        .await
        .map_err(AppError::from_db)?
        .is_none()
    {
        return Err(AppError::NotFound);
    }

    notifications::deactivate_universe_subscription(&state.pool, user.user_id, id)
        .await
        .map_err(AppError::from_db)?;

    Ok(())
}

/// SSE stream of notification events for the authenticated user only.
pub async fn stream(
    State(state): State<AppState>,
    user: AuthUser,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let user_id = user.user_id;
    let bus_rx = state.notification_events.subscribe();

    let events = BroadcastStream::new(bus_rx).filter_map(move |message| {
        future::ready(match message {
            Ok(event) if event.recipient_id == user_id => {
                let payload = event.to_client_event();
                match Event::default().event("message").json_data(payload) {
                    Ok(sse_event) => Some(Ok(sse_event)),
                    Err(err) => {
                        tracing::warn!(
                            event = "notifications.stream.serialize_failed",
                            error = %err,
                            "failed to serialize notification realtime event"
                        );
                        None
                    }
                }
            }
            Ok(_) => None,
            Err(_) => {
                tracing::debug!(
                    event = "notifications.stream.lagged",
                    recipient_id = %user_id,
                    "notification stream consumer lagged"
                );
                None
            }
        })
    });

    let keep_alive = KeepAlive::new()
        .interval(Duration::from_secs(25))
        .text("ping");

    Sse::new(events).keep_alive(keep_alive)
}

/// List notifications for the authenticated user.
pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ListNotificationsQuery>,
) -> Result<Json<NotificationListResponse>, AppError> {
    if query.limit > MAX_NOTIFICATIONS_LIST_LIMIT {
        return Err(AppError::BadRequest(format!(
            "limit must be at most {MAX_NOTIFICATIONS_LIST_LIMIT}"
        )));
    }

    let items = notifications::list_for_recipient(&state.pool, user.user_id, query.limit)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(NotificationListResponse { items }))
}

/// Count unread notifications (read_at IS NULL).
pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<UnreadCountResponse>, AppError> {
    let count = notifications::unread_count(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(UnreadCountResponse { count }))
}

/// Mark notification as consumed and reset subscription unconsumed_count.
pub async fn consume(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsumeNotificationResponse>, AppError> {
    let result = notifications::consume(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(result))
}
