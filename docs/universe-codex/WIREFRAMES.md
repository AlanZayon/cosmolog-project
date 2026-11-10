# Codex hub wireframes (v1)

ASCII IA for Perfect Works–style Universe Codex. Implementation lives under `src/page-components/Codex*.tsx`.

## Universe hub modes

```text
┌─────────────────────────────────────────────────────────┐
│ Header                                                   │
│ [ Stories | Codex ]  ← CodexModeToggle                   │
│                                                          │
│ Universe cover / title / follow / edit                   │
│ Stories shelves  OR  Codex sections grid                 │
└─────────────────────────────────────────────────────────┘
```

## Codex hub

```text
┌─────────────────────────────────────────────────────────┐
│ Codex · Universe title                    [Export .md]   │
│ [ Stories | Codex ]                                      │
│                                                          │
│ ┌ Saga premise ───────────────────────────────────────┐  │
│ │ Truth of this universe…                             │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌ History ┐ ┌ Society ┐ ┌ Geography ┐ ┌ Characters ┐    │
│ └─────────┘ └─────────┘ └───────────┘ └────────────┘    │
│ … Science / Glossary / Vehicles / Drama / Gallery / TOC  │
└─────────────────────────────────────────────────────────┘
```

## Lore entry (ficha)

```text
┌─────────────────────────────────────────────────────────┐
│ ← Hub · Kind                            [Edit] [Delete]  │
│ Cover                                                    │
│ Title / summary                                          │
│ Illustrated blocks (text | image)                        │
│ Profile fields (character/vehicle custom_fields)         │
│ Relations list + add                                     │
│ Appearances (story links) + add                          │
│ Prev ← TOC → Next                                        │
└─────────────────────────────────────────────────────────┘
```

## Timeline / Maps / Gallery / TOC

- Timeline: vertical rail of dated events (`occurred_at_label` + body).
- Maps: image + click-to-place pins (`x_norm`/`y_norm`).
- Gallery: collections → assets (`final|sketch|map|diagram`).
- TOC: ordered editorial path; prev/next between items (artbook reader).
