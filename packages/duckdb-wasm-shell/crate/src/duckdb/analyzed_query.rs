use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[repr(u8)]
pub enum QueryDriver {
    Local = 0,
    Remote = 1,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AnalyzedQuery {
    #[serde(rename = "recommendedQuery")]
    pub recommended_driver: QueryDriver,
}

impl Default for AnalyzedQuery {
    fn default() -> Self {
        Self {
            recommended_driver: QueryDriver::Local,
        }
    }
}
