use crate::db::{models, queries};
use anyhow::anyhow;
use scylla::Session;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error};

pub async fn writer(session: Arc<Session>) -> Result<models::Metric, anyhow::Error> {
    let metrics = session.get_metrics();

    let latency_avg_ms = match metrics.get_latency_avg_ms() {
        Ok(latency_avg_ms) => latency_avg_ms as i64,
        Err(e) => {
            error!("Failed to get mean latency: {:?}", e);
            return Err(anyhow!("Failed to get mean latency: {:?}", e));
        }
    };

    let latency_percentile_ms = match metrics.get_latency_percentile_ms(99.9) {
        Ok(latency_percentile_ms) => latency_percentile_ms as i64,
        Err(e) => {
            error!("Failed to get p99 latency: {:?}", e);
            return Err(anyhow!("Failed to get p99 latency: {:?}", e));
        }
    };

    let metric = models::Metric {
        node_id: "ABCD".parse().unwrap(),
        timestamp: chrono::Utc::now().timestamp_millis(),
        queries_num: metrics.get_queries_num() as i64,
        queries_iter_num: metrics.get_queries_iter_num() as i64,
        errors_num: metrics.get_errors_num() as i64,
        errors_iter_num: metrics.get_errors_iter_num() as i64,
        latency_avg_ms,
        latency_percentile_ms,
    };

    let cql = queries::write_metrics(&session).await?;

    match session
        .execute(
            &cql,
            (
                metric.node_id.clone(),
                metric.timestamp,
                metric.queries_num,
                metric.queries_iter_num,
                metric.errors_num,
                metric.errors_iter_num,
                metric.latency_avg_ms,
                metric.latency_percentile_ms,
            ),
        )
        .await
    {
        Ok(_) => Ok(metric),
        Err(e) => {
            error!("Failed to execute metrics write: {:?}", e);
            Err(anyhow!("Failed to execute metrics write: {:?}", e))
        }
    }
}

pub async fn worker(session: Arc<Session>) {
    let mut interval = tokio::time::interval(Duration::from_secs(1));
    loop {
        interval.tick().await;
        match writer(session.clone()).await {
            Ok(_) => debug!("Metrics written successfully"),
            Err(e) => error!("Error writing metrics: {}", e),
        }
    }
}
