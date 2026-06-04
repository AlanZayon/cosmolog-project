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
use crate::domain::activity_notifications::{
    self, ActivityNotificationListResponse, ActivityNotificationRealtimeEvent,
    ActivityUnreadCountResponse, MarkActivityNotificationReadResponse,
    MarkAllActivityNotificationsReadResponse,
};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListActivityNotificationsQuery {
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    activity_notifications::default_list_limit()
}

pub async fn stream(
    State(state): State<AppState>,
    user: AuthUser,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let user_id = user.user_id;
    let bus_rx = state.activity_notification_events.subscribe();

    let events = BroadcastStream::new(bus_rx).filter_map(move |message| {
        future::ready(match message {
            Ok(event) if event.recipient_id == user_id => {
                let payload = event.to_client_event();
                match Event::default().event("message").json_data(payload) {
                    Ok(sse_event) => Some(Ok(sse_event)),
                    Err(err) => {
                        tracing::warn!(
                            event = "activity_notifications.stream.serialize_failed",
                            error = %err,
                            "failed to serialize activity notification realtime event"
                        );
                        None
                    }
                }
            }
            Ok(_) => None,
            Err(_) => {
                tracing::debug!(
                    event = "activity_notifications.stream.lagged",
                    recipient_id = %user_id,
                    "activity notification stream consumer lagged"
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

pub async fn list(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ListActivityNotificationsQuery>,
) -> Result<Json<ActivityNotificationListResponse>, AppError> {
    if query.limit > activity_notifications::max_list_limit() {
        return Err(AppError::BadRequest(format!(
            "limit must be at most {}",
            activity_notifications::max_list_limit()
        )));
    }

    let items = activity_notifications::list_for_recipient(&state.pool, user.user_id, query.limit)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(ActivityNotificationListResponse { items }))
}

pub async fn unread_count(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<ActivityUnreadCountResponse>, AppError> {
    let count = activity_notifications::unread_count(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;

    Ok(Json(ActivityUnreadCountResponse { count }))
}

pub async fn mark_read(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<MarkActivityNotificationReadResponse>, AppError> {
    let result = activity_notifications::mark_read(&state.pool, id, user.user_id)
        .await
        .map_err(AppError::from_db)?
        .ok_or(AppError::NotFound)?;

    Ok(Json(result))
}

/// Mark all activity notifications as read for the authenticated user.
pub async fn mark_all_read(
    State(state): State<AppState>,
    user: AuthUser,
) -> Result<Json<MarkAllActivityNotificationsReadResponse>, AppError> {
    let result = activity_notifications::mark_all_read(&state.pool, user.user_id)
        .await
        .map_err(AppError::from_db)?;

    if result.marked_count > 0 {
        if let Err(err) = state
            .activity_notification_events
            .publish(ActivityNotificationRealtimeEvent {
                recipient_id: user.user_id,
                notification_id: Uuid::nil(),
                unread_count: 0,
            })
            .await
        {
            tracing::warn!(
                event = "activity_notifications.mark_all_read.publish_failed",
                error = %err,
                recipient_id = %user.user_id,
                "failed to publish realtime event after mark all read"
            );
        }
    }

    Ok(Json(result))
}
