mod db;
mod util;
mod web;

use db::connection;

use futures::{stream::FuturesUnordered, StreamExt};
use std::error::Error;
use std::sync::Arc;
use util::devices;
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

    // Spawn device simulator tasks.
    let device_futures: FuturesUnordered<_> = (0..5)
        .map(|_| devices::simulator(session.clone(), 80, 20))
        .collect();

    // Spawn metrics worker task.
    let metrics_future = metrics::worker(session.clone());

    tokio::select! {
        _ = metrics_future => {
            println!("Metrics worker completed.");
        }
        _ = device_futures.for_each_concurrent(None, |result| async {
            match result {
                Ok(_) => println!("Device simulator task finished successfully."),
                Err(e) => eprintln!("Device simulator task failed with error: {}", e),
            }
        }) => {
            println!("All device simulator tasks completed.");
        }
    }

    Ok(())
}
