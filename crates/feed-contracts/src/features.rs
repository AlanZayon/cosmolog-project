use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeatureName(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FeatureValue {
    Float(f64),
    Int(i64),
    Bool(bool),
    String(String),
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FeatureVector {
    pub values: HashMap<String, FeatureValue>,
}

impl FeatureVector {
    pub fn get_f64(&self, name: &str) -> Option<f64> {
        match self.values.get(name)? {
            FeatureValue::Float(v) => Some(*v),
            FeatureValue::Int(v) => Some(*v as f64),
            _ => None,
        }
    }
}
