use scylla::prepared_statement::PreparedStatement;
use scylla::transport::errors::QueryError;
use scylla::Session;
use std::sync::Arc;

pub async fn write_metrics(
    session: &Arc<Session>,
) -> anyhow::Result<PreparedStatement, QueryError> {
    session
        .prepare(
            "INSERT INTO demo.metrics \
            (node_id, timestamp, queries_num, queries_iter_num, errors_num, errors_iter_num, latency_avg_ms, latency_percentile_ms) \
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .await
}
