mod model;
mod repository;

pub use model::ComicPage;
pub use repository::{list_by_story_id, replace_for_story};
