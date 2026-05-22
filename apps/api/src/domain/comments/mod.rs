mod model;
mod repository;

pub use model::CommentWithAuthor;
pub use repository::{insert, list_by_story_id};
