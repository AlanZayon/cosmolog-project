use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::domain::stories::present::StoryWithProfile;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LibraryCollection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: String,
    pub visibility: String,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct LibraryCollectionSummary {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: String,
    pub visibility: String,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub item_count: i32,
    pub ownership: String,
    pub owner_username: Option<String>,
    pub saved_at: Option<OffsetDateTime>,
    pub is_saved_by_me: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryStoryItem {
    #[serde(flatten)]
    pub story: StoryWithProfile,
    pub library_added_at: Option<OffsetDateTime>,
    pub liked_at: Option<OffsetDateTime>,
    pub universe_title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryCollectionSaveStatus {
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryStatusCollection {
    pub id: Uuid,
    pub name: String,
    pub icon: String,
    pub description: Option<String>,
    pub contains_story: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LibraryStatus {
    pub liked: bool,
    pub collections: Vec<LibraryStatusCollection>,
}
