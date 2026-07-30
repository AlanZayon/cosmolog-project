use feed_contracts::registry::FeatureRegistry;

const EMBEDDED_REGISTRY: &str = include_str!("../../../../docs/feed-platform/feature-registry.json");

pub fn load_feature_registry() -> FeatureRegistry {
    FeatureRegistry::from_yaml_str(EMBEDDED_REGISTRY).unwrap_or_else(|err| {
        tracing::error!(
            event = "feed.registry.load_failed",
            error = %err,
            "failed to parse feature registry; using empty"
        );
        FeatureRegistry::default()
    })
}
