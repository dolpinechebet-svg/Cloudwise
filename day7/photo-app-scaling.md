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

## Photo upload flow

1. The user submits an upload request to an app server through the load balancer; the app authenticates the user, validates the file details, and creates a pending photo record in the primary database.
2. The app returns a short-lived, authorized upload URL for the original in object storage, so the large file does not need to pass through an app server.
3. The client uploads the original photo directly to object storage, which confirms that the object was stored.
4. After a successful upload, the app (or an object-storage event handler) places a thumbnail job containing the photo ID and object key on the queue.
5. A thumbnail worker takes the job, reads the original from object storage, generates the 50 KB thumbnail, and saves it back to object storage.
6. The worker updates the photo record in the primary database to mark processing complete and record the thumbnail object key; the update replicates to the read replica.
7. Feed requests can now include the photo, and the CDN delivers the original or thumbnail from object storage, caching it when appropriate.

## Trade-offs

- **Direct-to-object-storage uploads reduce app-server bandwidth and scale better for large files, but require short-lived upload authorization and careful validation so users can only upload permitted objects.**
- **Asynchronous thumbnailing keeps uploads responsive and handles traffic bursts, but a newly uploaded photo may appear without its thumbnail until the worker finishes; the feed should show a processing state or use the original temporarily.**
- **Caching and read replicas increase feed throughput and reduce latency, but cached feeds can be briefly stale and replica lag can delay the visibility of recent changes.**
- **Retaining every original and thumbnail makes old photos available, but the estimated storage grows by about 748.25 TB per year before replication and backups, so retention and lifecycle policies may be needed as the app grows.**
