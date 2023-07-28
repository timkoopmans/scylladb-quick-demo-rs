USE demo;

DROP TABLE IF EXISTS devices;
CREATE TABLE IF NOT EXISTS devices (
                                        device_id uuid,
                                        timestamp timestamp,
                                        sensor_data bigint,
                                        PRIMARY KEY (device_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp ASC)
   AND COMPACTION = {'class': 'TimeWindowCompactionStrategy', 'base_time_seconds': 3600, 'max_sstable_age_days': 1};