use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    StoryCreated,
    StoryUpdated,
    StoryLiked,
    StoryUnliked,
    UniverseFollowed,
    UniverseUnfollowed,
}

impl EventType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::StoryCreated => "story.created",
            Self::StoryUpdated => "story.updated",
            Self::StoryLiked => "story.liked",
            Self::StoryUnliked => "story.unliked",
            Self::UniverseFollowed => "universe.followed",
            Self::UniverseUnfollowed => "universe.unfollowed",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope<T> {
    pub event_id: Uuid,
    pub event_type: String,
    pub occurred_at: OffsetDateTime,
    pub producer: String,
    pub schema_version: u16,
    pub payload: T,
}

impl EventEnvelope<Value> {
    pub fn new(event_type: EventType, payload: Value) -> Self {
        Self {
            event_id: Uuid::new_v4(),
            event_type: event_type.as_str().to_string(),
            occurred_at: OffsetDateTime::now_utc(),
            producer: "api".to_string(),
            schema_version: 1,
            payload,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryCreatedPayload {
    pub story_id: Uuid,
    pub author_id: Uuid,
    pub universe_id: Option<Uuid>,
    pub arc_id: Option<Uuid>,
    pub story_type: String,
    pub tags: Option<Vec<String>>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryLikedPayload {
    pub story_id: Uuid,
    pub user_id: Uuid,
    pub liked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniverseFollowedPayload {
    pub universe_id: Uuid,
    pub user_id: Uuid,
    pub following: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DomainEvent {
    StoryCreated(StoryCreatedPayload),
    StoryLiked(StoryLikedPayload),
    UniverseFollowed(UniverseFollowedPayload),
}
