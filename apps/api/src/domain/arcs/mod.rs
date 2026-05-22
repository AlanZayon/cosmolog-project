pub mod model;
pub mod repository;

pub use model::Arc;
pub use repository::{delete_by_id, find_by_id, insert, list_by_universe_id, update};
