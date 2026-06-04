use sqlx::PgPool;
use time::OffsetDateTime;

use crate::domain::stories::{attach_profiles, model::Story, StoryWithProfile};

use super::model::LibraryStoryItem;

pub async fn build_library_story_items(
    pool: &PgPool,
    stories: Vec<Story>,
    library_added_at: Vec<Option<OffsetDateTime>>,
    liked_at: Vec<Option<OffsetDateTime>>,
    universe_titles: Vec<Option<String>>,
) -> Result<Vec<LibraryStoryItem>, sqlx::Error> {
    debug_assert_eq!(stories.len(), library_added_at.len());
    debug_assert_eq!(stories.len(), liked_at.len());
    debug_assert_eq!(stories.len(), universe_titles.len());

    let with_profiles = attach_profiles(pool, stories).await?;
    Ok(with_profiles
        .into_iter()
        .zip(library_added_at)
        .zip(liked_at)
        .zip(universe_titles)
        .map(|(((story, library_added_at), liked_at), universe_title)| LibraryStoryItem {
            story,
            library_added_at,
            liked_at,
            universe_title,
        })
        .collect())
}

pub fn story_with_profile_to_item(
    story: StoryWithProfile,
    library_added_at: Option<OffsetDateTime>,
    liked_at: Option<OffsetDateTime>,
    universe_title: Option<String>,
) -> LibraryStoryItem {
    LibraryStoryItem {
        story,
        library_added_at,
        liked_at,
        universe_title,
    }
}
