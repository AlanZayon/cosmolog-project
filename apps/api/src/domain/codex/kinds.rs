use crate::error::AppError;

pub const LORE_KINDS: &[&str] = &[
    "episode",
    "era",
    "event",
    "faction",
    "institution",
    "social_class",
    "place",
    "creature",
    "system",
    "glossary_term",
    "vehicle",
    "character",
    "drama_synopsis",
    "side_tale",
    "meta_essay",
    "custom",
];

pub const CANON_STATUSES: &[&str] = &["canon", "apocrypha", "meta"];

pub const PUBLISH_STATES: &[&str] = &["draft", "published"];

pub const REL_TYPES: &[&str] = &[
    "related",
    "causes",
    "caused_by",
    "member_of",
    "rules",
    "subordinate_to",
    "allied_with",
    "at_war_with",
    "located_in",
    "habitat",
    "defines",
    "depends_on",
    "part_of",
    "piloted_by",
    "variant_of",
    "knows",
    "family",
    "rival",
    "serves",
    "reincarnation_of",
    "appears_with",
    "custom",
];

pub const BLOCK_TYPES: &[&str] = &["text", "image"];

pub const TIMELINE_CONFIDENCE: &[&str] = &["confirmed", "uncertain", "legendary"];

pub const ART_KINDS: &[&str] = &["final", "sketch", "map", "diagram"];

pub const TOC_HREF_KINDS: &[&str] = &[
    "cover", "timeline", "gallery", "index", "maps", "entry", "kind",
];

fn validate_in(allowed: &[&str], value: &str, field: &str) -> Result<(), AppError> {
    if !allowed.contains(&value) {
        return Err(AppError::BadRequest(format!("invalid {field}")));
    }
    Ok(())
}

pub fn validate_lore_kind(kind: &str) -> Result<(), AppError> {
    validate_in(LORE_KINDS, kind, "kind")
}

pub fn validate_canon_status(value: &str) -> Result<(), AppError> {
    validate_in(CANON_STATUSES, value, "canon_status")
}

pub fn validate_publish_state(value: &str) -> Result<(), AppError> {
    validate_in(PUBLISH_STATES, value, "publish_state")
}

pub fn validate_rel_type(value: &str) -> Result<(), AppError> {
    validate_in(REL_TYPES, value, "rel_type")
}

pub fn validate_block_type(value: &str) -> Result<(), AppError> {
    validate_in(BLOCK_TYPES, value, "block_type")
}

pub fn validate_timeline_confidence(value: &str) -> Result<(), AppError> {
    validate_in(TIMELINE_CONFIDENCE, value, "confidence")
}

pub fn validate_art_kind(value: &str) -> Result<(), AppError> {
    validate_in(ART_KINDS, value, "art_kind")
}

pub fn validate_toc_href_kind(value: &str) -> Result<(), AppError> {
    validate_in(TOC_HREF_KINDS, value, "href_kind")
}

pub fn normalize_slug(slug: &str) -> Result<String, AppError> {
    let trimmed = slug.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("slug is required".into()));
    }
    if trimmed.len() > 120 {
        return Err(AppError::BadRequest(
            "slug must be at most 120 characters".into(),
        ));
    }
    Ok(trimmed.to_lowercase())
}
