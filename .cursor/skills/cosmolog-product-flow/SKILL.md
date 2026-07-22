---
name: cosmolog-product-flow
description: Guides Cosmolog product domain flows — universes, arcs, stories, library, feed, avisos vs activity notifications, follows, and comments. Use when designing or debugging user-facing product behavior, notifs, or content hierarchy.
---

# Cosmolog product flows

## Content

```text
Universe (owner_id)
  └── Arc (type: character|era|planet|event|custom)
        └── Story (author_id; type: short_story|chapters|comic)
              ├── chapters + illustrated_blocks
              └── comic_pages
```

Creating/updating a story with `universe_id`/`arc_id` requires the caller to own that universe (and matching arc).

## Social / library (keep separate)

| Flow | Mechanism |
|------|-----------|
| Like story | `likes` → library “liked” shelf |
| Collections | `library_collections` + items + public saves |
| Follow universe | `universe_follows` → feed only |
| Avisos | subscribe profile/universe → `notifications` (+ SSE `/notifications/stream`) |
| Activity | comments/mentions/likes/saves → `activity_notifications` (+ SSE `/activity-notifications/stream`) |

Hooks: `useNotificationInbox`, `useActivityNotificationInbox`.

## Feed

`GET /feed` → SQL `get_feed(limit, viewer_id)`; optional JWT personalizes. Client: `src/lib/api/feed.ts`.

## Comments

Nested via `parent_id`; likes via `comment_likes`. No edit/delete API yet — do not invent without product decision.

## When stuck

Trace: UI hook → `src/lib/api/<module>.ts` → `/api/proxy/...` → `apps/api/src/routes/` → domain repo.
