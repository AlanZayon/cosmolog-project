use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FeatureValueType {
    Float,
    Int,
    Bool,
    String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureRegistryEntry {
    pub name: String,
    pub entity: String,
    pub value_type: FeatureValueType,
    pub owner: String,
    pub doc: String,
    pub version: u16,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FeatureRegistry {
    pub features: Vec<FeatureRegistryEntry>,
}

impl FeatureRegistry {
    pub fn from_yaml_str(yaml: &str) -> Result<Self, String> {
        // Minimal YAML-ish parser avoided — registry ships as JSON for Phase A.
        serde_json::from_str(yaml).map_err(|e| e.to_string())
    }

    pub fn get(&self, name: &str) -> Option<&FeatureRegistryEntry> {
        self.features.iter().find(|f| f.name == name)
    }
}
