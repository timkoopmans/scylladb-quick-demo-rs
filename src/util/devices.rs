use crate::db::queries;
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use scylla::batch::Batch;
use scylla::transport::session::Session;
use scylla::IntoTypedRows;
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error, info};
use uuid::Uuid;

pub async fn simulator(
    session: Arc<Session>,
    read_ratio: u8,
    write_ratio: u8,
) -> Result<(), anyhow::Error> {
    let total_ratio = read_ratio + write_ratio;
    let mut rng = StdRng::from_entropy();
    loop {
        let mut batch: Batch = Default::default();
        let mut batch_values = Vec::with_capacity(100);
        for _ in 0..100 {
            let rand_num: u8 = rng.gen_range(0..total_ratio);
            if rand_num < read_ratio {
                // Simulate a read operation.
                match session
                    .query("SELECT sensor_data FROM devices LIMIT 1", &[])
                    .await
                {
                    Ok(response) => {
                        let rows = response.rows.unwrap_or_default();
                        for row in rows.into_typed::<(i64,)>() {
                            // Parse row as float
                            match row {
                                Ok((sensor_data,)) => debug!("Sensor data: {}", sensor_data),
                                Err(e) => error!("Failed to parse row: {}", e),
                            }
                        }
                    }
                    Err(e) => error!("Failed to perform read operation: {}", e),
                }
            } else {
                // Simulate a write operation.
                let uuid = Uuid::new_v4();
                let sensor_data: i64 = rng.gen(); // Generate random sensor data.
                batch.append_statement(
                    "INSERT INTO devices (device_id, timestamp, sensor_data) VALUES (?, ?, ?)",
                );

                batch_values.push((uuid, chrono::Utc::now().timestamp_millis(), sensor_data));
            }
        }
        let prepared_batch: Batch = session.prepare_batch(&batch).await?;
        session.batch(&prepared_batch, batch_values).await?;
        info!("Batch written successfully!");

        tokio::time::sleep(Duration::from_millis(5)).await;
    }
}
