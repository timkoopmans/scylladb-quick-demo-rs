mod db;
mod util;
mod web;

use crate::db::connection;
use std::error::Error;
use std::sync::Arc;
use tokio::task;
use util::metrics;
use web::server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv::dotenv().ok();
    util::logging::init();

    let session = Arc::new(
        connection::builder()
            .await
            .expect("Failed to connect to database"),
    );

    let web = server::init(session.clone()).await;
    tokio::spawn(async { web.launch().await.unwrap() });

    let metrics = task::spawn(metrics::worker(session.clone()));
    metrics.await?;

    Ok(())
}
