# Weekly ops checks

No dashboards. Once a week: run the SQL in Neon (or the Postgres MCP), then skim Render JSON logs.

## Postgres (volume)

```sql
SELECT count(*) FILTER (WHERE created_at > now() - interval '7 days') AS users_7d,
       count(*) AS users_total
FROM public.users;

SELECT count(*) FILTER (WHERE created_at > now() - interval '7 days') AS stories_7d,
       count(*) AS stories_total
FROM public.stories;

SELECT count(*) AS outbox_total,
       count(*) FILTER (WHERE published_at IS NULL) AS unpublished
FROM event_outbox;
```

`stories_total = 0` means Home is empty for everyone. Personalized empty Home shows up as `feed.served` with `empty=true` in logs.

`unpublished` should stay small: the API deletes `event_outbox` rows older than 14 days on boot (`outbox.pruned`). A growing unpublished count between deploys is expected while there is no `feed-relay`.

## Render logs (last few days)

JSON fields (`APP_ENV=production` defaults `LOG_FORMAT=json`):

| Look for | Meaning |
|----------|---------|
| `event=http.request.completed` and `status` ≥ 500 | 5xx (logged at error) |
| `path=/feed` and `latency_ms` | sort, take ~95th for p95 |
| `event=feed.served` and `empty=true` | empty Home responses |
| `event=auth.sign_up` / `auth.oauth_signup` | signups (cross-check SQL) |
| `event=story.created` | new stories (cross-check SQL) |
| `event=outbox.pruned` | startup dropped stale outbox rows |

Do not persist these as counters. Feed engine cutover is still in [feed-platform/RUNBOOK.md](./feed-platform/RUNBOOK.md).
