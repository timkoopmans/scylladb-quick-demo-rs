use crate::web::routes::*;
use rocket::fs::FileServer;
use rocket::{___internal_relative as relative, routes, Build, Rocket};
use scylla::Session;
use std::sync::Arc;

pub async fn init(session: Arc<Session>) -> Rocket<Build> {
    rocket::build()
        .mount("/", routes![index, metrics])
        .mount("/", FileServer::from(relative!("public/")))
        .manage(session)
}
