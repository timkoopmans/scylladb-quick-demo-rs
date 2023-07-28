use crate::db::models::*;
use rocket::fs::NamedFile;
use rocket::http::Status;
use rocket::response::status;
use rocket::serde::json::Json;
use rocket::{get, State};
use scylla::query::Query;
use scylla::{IntoTypedRows, Session};
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;

#[get("/")]
pub async fn index() -> Option<NamedFile> {
    NamedFile::open(Path::new("public/index.html")).await.ok()
}

#[get("/metrics", rank = 1)]
pub async fn metrics(
    session: &State<Arc<Session>>,
) -> Result<Json<Vec<RateMetric>>, status::Custom<String>> {
    let timestamp_now = chrono::Utc::now().timestamp_millis();
    let timestamp_minute_ago = timestamp_now - 60 * 1000;

    let cql_query = Query::new("SELECT * FROM metrics WHERE timestamp > ? AND timestamp <= ?;");

    let rows = session
        .query(cql_query, (timestamp_minute_ago, timestamp_now))
        .await
        .map_err(|err| status::Custom(Status::InternalServerError, err.to_string()))?
        .rows
        .unwrap_or_default();

    let metrics: Vec<Metric> = rows.into_typed().filter_map(Result::ok).collect();

    let mut rate_metrics: Vec<RateMetric> = Vec::new();

    for windows in metrics.windows(2) {
        if let [prev, curr] = windows {
            if curr.timestamp == prev.timestamp {
                continue;
            }

            let rate_metric = RateMetric {
                node_id: curr.node_id.clone(),
                timestamp: curr.timestamp,
                queries_rate: (curr.queries_num - prev.queries_num) as f64
                    / ((curr.timestamp - prev.timestamp) as f64 / 1000.0)
                    * 100.0, // conversion from millis to seconds
                queries_iter_rate: (curr.queries_iter_num - prev.queries_iter_num) as f64
                    / ((curr.timestamp - prev.timestamp) as f64 / 1000.0)
                    * 100.0, // conversion from millis to seconds
                errors_rate: (curr.errors_num - prev.errors_num) as f64
                    / ((curr.timestamp - prev.timestamp) as f64 / 1000.0)
                    * 100.0, // conversion from millis to seconds
                errors_iter_rate: (curr.errors_iter_num - prev.errors_iter_num) as f64
                    / ((curr.timestamp - prev.timestamp) as f64 / 1000.0)
                    * 100.0, // conversion from millis to seconds
                latency_avg_ms: curr.latency_avg_ms,
                latency_percentile_ms: curr.latency_percentile_ms,
                // Add the total fields
                total_queries: curr.queries_num,
                total_queries_iter: curr.queries_iter_num,
                total_errors: curr.errors_num,
                total_errors_iter: curr.errors_iter_num,
            };
            rate_metrics.push(rate_metric);
        }
    }

    Ok(Json(rate_metrics))
}

#[derive(Serialize)]
pub struct RateMetric {
    pub node_id: String,
    pub timestamp: i64,
    pub queries_rate: f64,
    pub queries_iter_rate: f64,
    pub errors_rate: f64,
    pub errors_iter_rate: f64,
    pub latency_avg_ms: i64,
    pub latency_percentile_ms: i64,
    pub total_queries: i64,
    pub total_queries_iter: i64,
    pub total_errors: i64,
    pub total_errors_iter: i64,
}
