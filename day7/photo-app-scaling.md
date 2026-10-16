# SnapShare Scaling Plan

## Assumptions and estimates

- SnapShare has 10 million registered users, and 10% are active on a typical day.
- Each daily active user uploads one photo and views 50 feed pages per day.
- The average original photo is 2 MB, and each photo also has one 50 KB thumbnail.
- A day has 86,400 seconds and a year has 365 days; average request rates are spread evenly across each day.
- Peak feed traffic is five times the average. Storage estimates assume every photo and thumbnail is retained for a year and use decimal units (1 TB = 1,000,000 MB); they exclude replicas, backups, and other data.

Daily active users:

`10,000,000 × 10% = 1,000,000 daily active users`

| Measure | Calculation | Estimate |
| --- | --- | ---: |
| Photo uploads per day | 1,000,000 users × 1 upload | 1,000,000 |
| Uploads per second (average) | 1,000,000 ÷ 86,400 | 11.6 |
| Feed views per day | 1,000,000 users × 50 views | 50,000,000 |
| Feed views per second (average) | 50,000,000 ÷ 86,400 | 579 |
| Feed views per second (peak) | (50,000,000 ÷ 86,400) × 5 | 2,894 |
| Original-photo storage per year | 1,000,000 × 365 × 2 MB | 730 TB |
| Thumbnail storage per year | 1,000,000 × 365 × 50 KB | 18.25 TB |
| Total photo-file storage per year | 730 TB + 18.25 TB | 748.25 TB |

SnapShare is **read-heavy**: users request about 50 feed pages for every photo they upload, so feed reads greatly outnumber uploads. The design should scale feed delivery with caches, read replicas, and a CDN, while keeping photo processing asynchronous so upload requests do not have to wait for thumbnail creation.

## Photo storage

Photo files should not be stored as database blobs: large files would consume database capacity, make backups and database replication heavier, and compete with feed metadata queries. Store originals and thumbnails in durable object storage, and keep only metadata (such as owner, object key, dimensions, and timestamps) in the database; serve the files through the CDN.

## Architecture

```text
+-------+   feed/API   +-----+   API cache miss   +----------------+   +-------------+
| Users | -----------> | CDN | -----------------> | Load Balancer  |-> | App Servers |
+---+---+               +--+--+                    +----------------+   +--+--+--+----+
    |                      |                                            |  |  |  |
    | photo bytes via      | photo cache miss                           |  |  |  +--> +----------+
    | signed upload URL    +-------------------------------------------> |  |  |       | Job Queue|
    v                                                                   |  |  |       +----+-----+
+---+----------------+                                                   |  |  |            |
| Object Storage     | <-------------------------------------------------+  |  +------------v
| originals + thumbs |         worker reads original / stores thumbnail     |        +-----+----------+
+--------------------+                                                       |        | Thumbnail Worker|
                                                                             |        +---+----------+--+
                                                                             |            |          |
                                                                             |            |          +--> Object Storage
                                                                             |            +--> Primary DB (processing status)
                                                                             |
                                                                             +--> Feed Cache --miss--> Read Replica
                                                                             |
                                                                             +--> Primary DB (metadata writes)
                                                                                      |
                                                                                replication
                                                                                      v
                                                                               +------+------+
                                                                               | Read Replica|
                                                                               +-------------+

CDN -- photo cache miss --> Object Storage
```

Feed requests served by the app read cached results first and use the database read replica on a cache miss; the primary database handles writes and replicates changes to the read replica. The CDN caches feed responses and image files where appropriate, and forwards cache misses to the application or object storage.

## Component responsibilities

- **CDN:** Caches feed responses and photo files near users to reduce latency and take repeated delivery traffic off the app servers and object storage.
- **Load balancer:** Distributes incoming API requests across healthy app servers so traffic can scale horizontally and a single server failure does not stop the service.
- **App servers:** Authenticate users, validate uploads, manage feed requests, write photo metadata, and issue authorized upload instructions.
- **Cache:** Keeps frequently requested feed data available in memory to reduce repeated database reads and improve response time.
- **Primary database:** Stores durable, structured user, follow, and photo metadata and accepts application writes.
- **Read replica:** Serves read-only feed and metadata queries so read traffic does not overwhelm the primary database.
- **Object storage:** Holds the large original photo and thumbnail files durably without filling the relational database with blobs.
- **Job queue:** Buffers thumbnail tasks so image processing can run asynchronously and absorb bursts without delaying upload responses.
- **Thumbnail worker:** Consumes queued jobs, creates a smaller thumbnail from each original, stores it in object storage, and updates the photo metadata when processing finishes.

## Photo upload lifecycle

1. The client sends an upload-initiation request through the load balancer; an app server authenticates the user, validates the requested file type and size, creates a `pending` photo record in the primary database, and returns a short-lived upload URL scoped to that photo's object key.
2. The client uploads the original directly to object storage, keeping the large file off the app servers; the storage service confirms the completed object.
3. The client reports completion to the app, which verifies the object exists and matches the expected owner and upload constraints, then changes the photo state to `uploaded`.
4. The app enqueues a thumbnail job with the photo ID and object key; the job is safe to retry, so a repeated notification does not create duplicate photo records or corrupt the final state.
5. A thumbnail worker consumes the job, reads the original from object storage, creates the 50 KB thumbnail, and saves it under the photo's thumbnail key.
6. Once the thumbnail is stored, the worker updates the primary database record with its key and changes the state to `ready`; queue retries handle transient processing errors, while permanent failures are recorded for recovery rather than marking an incomplete photo ready.
7. The app includes `ready` photos in feed results, and the CDN serves the original or thumbnail from object storage, caching it where appropriate; the owner can be shown an upload/processing state before then.
8. If the client never completes its upload, the record remains `pending`; an expiry/cleanup process can remove the abandoned record and any partial object.

## Trade-offs

- **Read replicas and feed caches increase read capacity and reduce latency, but replication lag or stale cache entries can hide a newly uploaded photo from a feed immediately after upload. For read-your-writes consistency, the app can temporarily include the owner's new photo from a write-through cache or route that owner's feed reads to the primary; this adds cache invalidation or primary-database load, so ordinary feed reads can continue using the replica and accept brief staleness.**
- **Asynchronous thumbnailing makes upload responses fast and absorbs processing bursts, but photos are not fully ready immediately. Keep the photo in a visible `processing` state until both the original and thumbnail are available, and use retries and failure reporting rather than blocking the upload on image processing.**
- **Direct-to-object-storage uploads reduce app-server bandwidth, but short-lived signed URLs and completion-time object validation are needed to prevent unauthorized or oversized uploads.**
- **Retaining every original and thumbnail makes old photos available, but storage grows by about 748.25 TB per year before replicas and backups; lifecycle or retention policies control cost but may remove older content.**
