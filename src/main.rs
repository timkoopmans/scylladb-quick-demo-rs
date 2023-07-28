mod db;
mod util;
mod web;

use crate::db::connection;
use crate::util::devices;
use std::error::Error;
use std::sync::Arc;
use structopt::StructOpt;
use tokio::{task, try_join};
use util::metrics;
use web::server;

#[derive(Debug, Clone, StructOpt)]
pub struct Opt {
    /// read ratio
    #[structopt(default_value = "50")]
    read_ratio: u8,
    /// write ratio
    #[structopt(default_value = "50")]
    write_ratio: u8,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv::dotenv().ok();
    util::logging::init();
    let opt = Opt::from_args();

    let metrics_session = Arc::new(
        connection::builder()
            .await
            .expect("Failed to connect to database"),
    );
    let devices_session = Arc::new(
        connection::builder()
            .await
            .expect("Failed to connect to database"),
    );

    let web = server::init(metrics_session.clone(), opt.clone()).await;
    tokio::spawn(async { web.launch().await.unwrap() });

    let metrics_task = task::spawn(metrics::worker(
        metrics_session.clone(),
        devices_session.clone(),
    ));
    let devices_task = task::spawn(devices::simulator(
        devices_session.clone(),
        opt.read_ratio,
        opt.write_ratio,
    ));
    let (metrics_result, devices_result) = try_join!(metrics_task, devices_task)?;

    metrics_result?;
    devices_result?;

    Ok(())
}
