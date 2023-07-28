use anyhow::{anyhow, Result};
use scylla::{Session, SessionBuilder};
use std::path::Path;
use std::{env, fs};
use tokio::fs::File;
use tokio::io::AsyncReadExt;
use tracing::info;

pub async fn builder() -> Result<Session> {
    let database_url = env::var("DATABASE_URL")?;

    info!("Connecting to ScyllaDB at {}", database_url);

    let session = SessionBuilder::new()
        .known_node(&database_url)
        .build()
        .await?;

    let migration_dir = if database_url.starts_with("127.0.0.1") {
        Path::new("./migrations")
    } else {
        Path::new("/app/migrations")
    };

    let files = fs::read_dir(migration_dir)
        .map_err(|e| anyhow!("Error reading migration directory: {}", e))?;

    let mut migration_queries = Vec::new();

    for file in files {
        let file = file.map_err(|e| anyhow!("Error accessing migration file: {}", e))?;
        let file_path = file.path();
        if file_path.is_file() && file_path.extension().map_or(false, |ext| ext == "cql") {
            let mut file = File::open(file_path).await?;
            let mut contents = String::new();
            file.read_to_string(&mut contents).await?;
            migration_queries.push(contents);
        }
    }

    for migration_query in migration_queries {
        let schema_query = migration_query.trim().replace('\n', " ");
        for q in schema_query.split(';') {
            let query = q.to_owned() + ";";
            if !query.starts_with("--") && query.len() > 1 {
                info!("Running Query {}", query);
                session
                    .query(query, &[])
                    .await
                    .map_err(|e| anyhow!("Error executing migration query: {}", e))?;
            }
        }
    }

    Ok(session)
}
