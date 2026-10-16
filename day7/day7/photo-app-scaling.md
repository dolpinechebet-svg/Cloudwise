# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow. This plan estimates the load and describes an architecture that can handle it.

## Assumptions

- 10 million registered users.
- 10% of registered users are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB.
- Each photo also gets a thumbnail of 50 KB.
- One day has 86,400 seconds (24 x 60 x 60).
- Peak traffic is 5 times the average.
- Storage is counted with decimal units (1 TB = 1,000,000 MB), and the estimates are rounded.

## Estimates

### Daily active users (DAU)

10,000,000 users x 10% = **1,000,000 daily active users**

### Uploads per second

- Uploads per day: 1,000,000 users x 1 photo = 1,000,000 uploads.
- Average: 1,000,000 / 86,400 = about **11.6 uploads per second**.
- Peak (5x): 11.6 x 5 = about **58 uploads per second**.

### Feed views per second

- Feed views per day: 1,000,000 users x 50 pages = 50,000,000 views.
- Average: 50,000,000 / 86,400 = about **579 feed views per second**.
- Peak (5x): 579 x 5 = about **2,900 feed views per second**.

### Storage per year

- Photos per day: 1,000,000 x 2 MB = 2,000,000 MB = **2 TB per day**.
- Thumbnails per day: 1,000,000 x 50 KB = 50,000,000 KB = **50 GB per day**.
- Photos per year: 2 TB x 365 = **730 TB**.
- Thumbnails per year: 50 GB x 365 = about **18 TB**.
- Total per year: about **748 TB** (roughly 0.75 PB).

| Measure | Average | Peak (5x) |
|---|---|---|
| Uploads per second | 11.6 | 58 |
| Feed views per second | 579 | 2,900 |

| Storage | Per day | Per year |
|---|---|---|
| Original photos | 2 TB | 730 TB |
| Thumbnails | 50 GB | about 18 TB |
| Total | about 2.05 TB | about 748 TB |

## Read-heavy or write-heavy?

**SnapShare is read-heavy.** There are 50 million feed views per day and only 1 million uploads per day, so there are about **50 reads for every write**. At peak, the system handles about 2,900 reads per second but only 58 writes per second.

What this means for the design:

- Make reads fast and cheap first. Serve photos from a CDN and keep hot data in a cache.
- Add a read replica of the database, so most queries do not hit the main database.
- Keep the write path simple and reliable. Uploads are fewer, so one primary database can handle them for a long time.
- Do slow work (such as thumbnails) in the background, so a write never makes a user wait.

## Why photos must not be stored inside the database

Photos are large files. At 2 TB per day, storing them in the database would make it huge, slow to back up, slow to copy to replicas, and very expensive, because database storage costs more than file storage. The database is good at small, structured data and queries, not at serving big files.

Instead, photo files go into **object storage**, which is cheap, durable and built for large files. The database stores only the **metadata**: the photo id, the owner, the caption, the time, and the **URL or key** that points to the file in object storage. Users then download the photo from the CDN, not through the app servers.

## Architecture diagram

```
                         +------------------+
                         |      Users       |
                         |  (phone / web)   |
                         +--------+---------+
                                  |
              +-------------------+--------------------+
              |                                        |
              | photos and thumbnails (reads)          | API requests
              v                                        v
      +---------------+                       +-----------------+
      |      CDN      |                       |  Load Balancer  |
      +-------+-------+                       +--------+--------+
              |                                        |
              | cache miss                +------------+------------+
              v                           |            |            |
   +---------------------+          +-----v----+ +-----v----+ +-----v----+
   |   Object Storage    |          |   App    | |   App    | |   App    |
   |  (photos, thumbs)   |          | Server 1 | | Server 2 | | Server N |
   +----------+----------+          +-----+----+ +-----+----+ +-----+----+
              ^                           |            |            |
              |                           +------+-----+------+-----+
              |                                  |            |
              |                       +----------v--+   +-----v--------------+
              |                       |    Cache    |   |   Message Queue    |
              |                       |   (Redis)   |   | (thumbnail jobs)   |
              |                       +------+------+   +-----+--------------+
              |                              |                |
              |                              | cache miss     v
              |                       +------v------+   +-----------------+
              |                       |  Database   |   | Thumbnail Worker|
              |                       |  (Primary)  |   +--------+--------+
              |                       +------+------+            |
              |                              | replication       |
              |                       +------v------+            |
              |                       |    Read     |            |
              |                       |   Replica   |            |
              |                       +-------------+            |
              |                                                  |
              +--------------------------------------------------+
                  worker reads the original, saves the thumbnail

   Writes (uploads, new rows)  -> Primary database
   Reads (feed queries)        -> Cache first, then Read Replica
```

## What each component does

- **CDN:** it solves slow photo loading by keeping copies of photos and thumbnails on servers close to users, so the app servers and storage do less work.
- **Load balancer:** it solves overload and single points of failure by spreading requests across many app servers and skipping any server that is down.
- **App servers:** they solve the need for business logic (login, uploads, building the feed) and can be scaled by simply adding more servers, because they keep no data of their own.
- **Cache:** it solves repeated database reads by keeping popular data, such as feed results and photo metadata, in fast memory.
- **Database (primary):** it solves the need for reliable, structured storage of users, follows, photo metadata and comments, and it takes all the writes.
- **Read replica:** it solves read overload on the primary database by holding a copy that answers feed queries.
- **Object storage:** it solves the problem of storing hundreds of terabytes of photos cheaply and safely, with the files kept outside the database.
- **Message queue:** it solves slow uploads by holding thumbnail jobs, so the app server can answer the user straight away and the work happens later.
- **Thumbnail worker:** it solves the cost of resizing images by creating thumbnails in the background, and more workers can be added when the queue grows.

## Upload flow, step by step

1. The user picks a photo in the app and taps upload. The request goes through the CDN or directly to the **load balancer**.
2. The load balancer sends the request to one healthy **app server**.
3. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
4. The app server saves the original photo file in **object storage** and gets back a storage key (a URL).
5. The app server writes a new row in the **primary database** with the photo id, owner, caption, time, the storage key, and a status of "processing".
6. The app server puts a "create thumbnail" job (with the photo id and key) on the **message queue**.
7. The app server answers the user with "upload successful". The user does not wait for the thumbnail.
8. The **thumbnail worker** takes the job from the queue, reads the original from object storage, and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the database row with the thumbnail key and a status of "ready". If the job fails, it goes back on the queue and is tried again.
10. The affected feed entries in the **cache** are cleared or updated, so followers see the new photo on their next feed load. Photos and thumbnails are then served through the **CDN**.

## Trade-offs

1. **Caching and read replicas: speed versus freshness.** The cache and the read replica make the feed much faster and protect the main database. But replicas copy data with a small delay, and cached results can be old. A follower may not see a new photo for a few seconds. For a photo feed this is acceptable. For something like a payment it would not be. The cost is extra complexity: the team must decide when to clear the cache.

2. **Background thumbnails: fast uploads versus a short wait for the thumbnail.** Using a queue and a worker means the user gets a quick answer and the system can absorb upload spikes. But the thumbnail is not ready instantly, so the feed may briefly show a placeholder or the large photo. It also adds more parts to run and monitor (the queue and the workers) and jobs must be safe to retry.

3. **CDN and object storage: speed and low cost versus ongoing bills.** Serving photos from a CDN makes pages load fast worldwide and protects the app servers. But the CDN and 748 TB of new storage each year cost real money. Old or rarely viewed photos could be moved to cheaper storage to reduce the cost, at the price of slower access.

4. **A single primary database: simplicity versus a write limit.** One primary database is simple and keeps data consistent. At 58 writes per second it is fine. If the app grew much larger, the writes would need to be split across several databases (sharding), which is much harder to build and to query.