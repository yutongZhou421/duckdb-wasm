use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct AnalyzedQuery {
    #[serde(rename = "recommendedDriver")]
    pub recommended_driver: String,
}

impl Default for AnalyzedQuery {
    fn default() -> Self {
        Self {
            recommended_driver: "local".to_string(),
        }
    }
}
