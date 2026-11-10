# Universe Codex — Perfect Works coverage

Canonical product spec for elevating each Cosmolog Universe to a Perfect Works–level encyclopedia.

Related plan: hybrid architecture — keep `Universe → Arc → Story` for narrative publishing; add **Universe Codex** for lore.

## Frozen enums (v1)

### `lore_entries.kind`

| Kind | Perfect Works chapter | Hub section |
|------|----------------------|-------------|
| `episode` | Preface / saga frame | Cover |
| `era` | Cap. I History | History |
| `event` | Cap. I History | History |
| `faction` | Cap. II Social | Society |
| `institution` | Cap. II Social | Society |
| `social_class` | Cap. II Social | Society |
| `place` | Cap. III Geography | Geography |
| `creature` | Cap. IV Monster | Bestiary |
| `system` | Cap. V Science | Science |
| `glossary_term` | Cap. V + Glossary | Glossary |
| `vehicle` | Cap. VI Gear / vessels | Vehicles |
| `character` | Cap. VII Character | Characters |
| `drama_synopsis` | Cap. VIII Drama | Drama |
| `side_tale` | Dark Summer / If… | Drama |
| `meta_essay` | Staff / afterword | Meta |
| `custom` | Escape hatch | Index |

### `lore_entries.canon_status`

`canon` | `apocrypha` | `meta`

### `lore_entries.publish_state`

`draft` | `published`

### `lore_relations.rel_type`

`related` · `causes` · `caused_by` · `member_of` · `rules` · `subordinate_to` · `allied_with` · `at_war_with` · `located_in` · `habitat` · `defines` · `depends_on` · `part_of` · `piloted_by` · `variant_of` · `knows` · `family` · `rival` · `serves` · `reincarnation_of` · `appears_with` · `custom`

### `gallery_assets.art_kind`

`final` | `sketch` | `map` | `diagram`

### `vehicle` custom_fields hint

`vehicle_class`: `gear` | `ship` | `other` (stored in `custom_fields`)

## Matrix: book → model → API → UI

| Book case | Tables | Primary API | UI |
|-----------|--------|-------------|-----|
| Saga preface / Episodes I–VI | `universes.saga_premise`, `lore_entries` kind=`episode` | `GET/PATCH /universes/{id}`, codex entries | Codex cover |
| Timeline History | `timeline_events` | `/universes/{id}/codex/timeline` | `/codex/timeline` |
| Society / factions | `lore_entries` + relations | entries CRUD + relations | `/codex/faction` etc. |
| Geography + maps | `place`, `maps`, `map_pins` | maps CRUD | `/codex/maps/[id]` |
| Bestiary | `creature` | entries | `/codex/creature` |
| Science systems | `system`, diagrams in gallery/blocks | entries | `/codex/system` |
| Glossary | `glossary_term` + index search | `GET …/codex/entries?q=` | `/codex/glossary_term`, Index |
| Gears / ships | `vehicle` | entries | `/codex/vehicle` |
| Characters | `character` + `custom_fields` + appearances | entries + appearances | `/codex/character` |
| Drama / side tales | `drama_synopsis`/`side_tale` + story link | appearances → story | `/codex/drama_synopsis` |
| Gallery | `gallery_*` | gallery CRUD | `/codex/gallery` |
| Meta / afterword | `meta_essay`, `universes.afterword` | entries + universe patch | Meta section |
| Artbook TOC reader | `codex_toc_items` | TOC CRUD + export | prev/next + export MD |

## Authz

- Public read for published lore (and drafts only for universe owner).
- Write: universe `owner_id` only (same as arcs).
- Do not merge with avisos / activity / follows / library.

## Storage buckets

`codex-covers` · `codex-maps` · `codex-gallery` (plus existing cover buckets for reuse).

## Out of scope (backlog)

- Multi-author collaboration on Codex (explicitly deferred; ownership remains universe `owner_id` only)
- Feed ranking changes
- PDF binary export (Markdown export is v1)

## Implementation status

Ship complete for phases 0–10: schema + Rust routes/tests (`api_codex`), BFF `src/lib/api/codex.ts`, Codex hub/kind/entry/timeline/maps/gallery/index/toc pages, Universe Stories↔Codex toggle, arc lore links, i18n `pt|en|ja|es`, buckets `codex-covers|codex-maps|codex-gallery`.
