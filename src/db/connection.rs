use crate::db::ddl::DDL;
use anyhow::{anyhow, Result};
use scylla::{Session, SessionBuilder};
use std::env;
use tokio_retry::{strategy::FixedInterval, Retry};
use tracing::info;

pub async fn builder(migrate: bool) -> Result<Session> {
    let database_url = env::var("DATABASE_URL")?;

    info!("Connecting to ScyllaDB at {}", database_url);

    let strategy = FixedInterval::from_millis(5000).take(12);

    let session = Retry::spawn(strategy, || async {
        SessionBuilder::new()
            .known_node(&database_url)
            .build()
            .await
    })
    .await
    .map_err(|e| anyhow!("Error connecting to the database: {}", e))?;

    if migrate {
        let schema_query = DDL.trim().replace('\n', " ");
        for q in schema_query.split(';') {
            let query = q.to_owned() + ";";
            if !query.starts_with("--") && query.len() > 1 {
                info!("Running Migration {}", query);
                session
                    .query(query, &[])
                    .await
                    .map_err(|e| anyhow!("Error executing migration query: {}", e))?;
            }
        }
    }

    Ok(session)
}
