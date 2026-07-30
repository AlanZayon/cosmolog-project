use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ViewerId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ItemId(pub Uuid);

impl From<Uuid> for ViewerId {
    fn from(value: Uuid) -> Self {
        Self(value)
    }
}

impl From<Uuid> for ItemId {
    fn from(value: Uuid) -> Self {
        Self(value)
    }
}
