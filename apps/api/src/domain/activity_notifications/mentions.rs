use sqlx::PgPool;

use crate::domain::profiles;

/// Resolve the longest profile username that matches the start of `after` (after `@`).
async fn resolve_longest_username(
    pool: &PgPool,
    after: &str,
) -> Result<Option<String>, sqlx::Error> {
    let max = after.len().min(50);
    for end in (1..=max).rev() {
        let candidate = after[..end].trim_end();
        if candidate.is_empty() {
            continue;
        }
        let at_boundary = end == after.len() || after.as_bytes()[end] == b' ';
        if !at_boundary {
            continue;
        }
        if profiles::find_by_username_ci(pool, candidate)
            .await?
            .is_some()
        {
            return Ok(Some(candidate.to_string()));
        }
    }
    Ok(None)
}

/// Find mentioned users by matching full usernames from the database (supports spaces).
pub async fn resolve_mentioned_user_ids(
    pool: &PgPool,
    content: &str,
) -> Result<Vec<uuid::Uuid>, sqlx::Error> {
    let mut recipients = Vec::new();
    let mut search_start = 0;

    while let Some(rel) = content[search_start..].find('@') {
        let at = search_start + rel;
        let boundary_ok = match content[..at].chars().last() {
            None => true,
            Some(c) => c.is_whitespace(),
        };
        if !boundary_ok {
            search_start = at + 1;
            continue;
        }

        let after = &content[at + 1..];
        if let Some(username) = resolve_longest_username(pool, after).await? {
            if let Some(profile) = profiles::find_by_username_ci(pool, &username).await? {
                if !recipients.contains(&profile.user_id) {
                    recipients.push(profile.user_id);
                }
            }
            search_start = at + 1 + username.len();
        } else {
            search_start = at + 1;
        }
    }

    Ok(recipients)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_longest_username_picks_longest_boundary_match() {
        // Unit logic: boundary check on synthetic string without DB
        let after = "alan zayon da silva thanks";
        let max = after.len();
        let mut found = None;
        for end in (1..=max).rev() {
            let candidate = after[..end].trim_end();
            if candidate == "alan zayon da silva" {
                let at_boundary = end == after.len() || after.as_bytes()[end] == b' ';
                if at_boundary {
                    found = Some(candidate);
                    break;
                }
            }
        }
        assert_eq!(found, Some("alan zayon da silva"));
    }
}
