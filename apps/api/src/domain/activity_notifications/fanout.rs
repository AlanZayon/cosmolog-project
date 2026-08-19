use std::collections::HashSet;

use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::comments;
use crate::domain::stories;

use super::deliver::deliver_optional;
use super::mentions::resolve_mentioned_user_ids;
use super::realtime::ActivityNotificationEventBus;
use super::repository::{
    insert_comment_mention, insert_comment_reply, insert_story_comment,
    DeliveredActivityNotification,
};

async fn notify(
    pool: &PgPool,
    bus: &ActivityNotificationEventBus,
    notified: &mut HashSet<Uuid>,
    delivered: Option<DeliveredActivityNotification>,
) -> Result<(), sqlx::Error> {
    if let Some(d) = delivered {
        if notified.insert(d.recipient_id) {
            deliver_optional(pool, bus, Some(d)).await;
        }
    }
    Ok(())
}

pub async fn fanout_comment_activity(
    pool: &PgPool,
    bus: &ActivityNotificationEventBus,
    actor_id: Uuid,
    story_id: Uuid,
    comment_id: Uuid,
    content: &str,
    reply_to_comment_id: Option<Uuid>,
) -> Result<(), sqlx::Error> {
    let mut notified = HashSet::new();
    let story = stories::find_by_id(pool, story_id).await?;

    let mut parent_author_id: Option<Uuid> = None;

    // Most specific first so dedupe does not drop reply/mention in favor of story_comment.
    if let Some(parent_id) = reply_to_comment_id {
        if let Some((author_id, parent_story_id)) =
            comments::find_author_and_story(pool, parent_id).await?
        {
            if parent_story_id == story_id {
                parent_author_id = Some(author_id);
                let delivered =
                    insert_comment_reply(pool, author_id, actor_id, story_id, comment_id).await?;
                notify(pool, bus, &mut notified, delivered).await?;
            }
        }
    }

    for user_id in resolve_mentioned_user_ids(pool, content).await? {
        let delivered =
            insert_comment_mention(pool, user_id, actor_id, story_id, comment_id).await?;
        notify(pool, bus, &mut notified, delivered).await?;
    }

    if let Some(story) = story {
        let notify_story_author = match reply_to_comment_id {
            None => true,
            Some(_) => parent_author_id != Some(story.author_id),
        };
        if notify_story_author {
            let delivered =
                insert_story_comment(pool, story.author_id, actor_id, story_id, comment_id).await?;
            notify(pool, bus, &mut notified, delivered).await?;
        }
    }

    Ok(())
}
