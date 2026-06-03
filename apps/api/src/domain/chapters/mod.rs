mod model;
mod repository;

pub use model::Chapter;
pub use repository::{
    count_by_story_id, find_by_id, find_by_story_and_number, insert, list_by_story_id, update_title,
};
