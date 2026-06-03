use std::collections::HashSet;

use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::profiles;
use crate::domain::stories::model::Story;

#[derive(Debug, Clone, Serialize)]
pub struct ProfileSnippet {
    pub username: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryWithProfile {
    #[serde(flatten)]
    pub story: Story,
    pub profiles: Option<ProfileSnippet>,
}

pub async fn attach_profiles(
    pool: &PgPool,
    stories: Vec<Story>,
) -> Result<Vec<StoryWithProfile>, sqlx::Error> {
    let author_ids: Vec<Uuid> = stories
        .iter()
        .map(|s| s.author_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    let profiles = profiles::find_by_user_ids(pool, &author_ids).await?;
    let profile_map: std::collections::HashMap<Uuid, ProfileSnippet> = profiles
        .into_iter()
        .map(|p| {
            (
                p.user_id,
                ProfileSnippet {
                    username: p.username,
                    avatar_url: p.avatar_url,
                },
            )
        })
        .collect();

    Ok(stories
        .into_iter()
        .map(|story| {
            let profiles = profile_map.get(&story.author_id).cloned();
            StoryWithProfile { story, profiles }
        })
        .collect())
}
