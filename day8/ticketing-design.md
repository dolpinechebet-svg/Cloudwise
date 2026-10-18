# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part design framework: requirements, estimates, API, data model, architecture and trade-offs. Because preventing double-booking is the hardest problem in this system, it has its own section after the data model.

## 1. Requirements

### Functional requirements

- Users can sign up and log in.
- Users can browse and search events.
- Users can see the seat map of an event and which seats are free.
- Users can hold seats for a short time (10 minutes) while they pay.
- Users can pay for held seats and receive tickets with a QR code.
- Users can see their tickets.
- Users can release seats they no longer want.
- When a popular event goes on sale, users enter a waiting room first.

### Non-functional requirements

- **Speed:** browsing pages load in under 300 ms. During a big sale, the seat map and the hold request answer in under 1 second for users who have been admitted.
- **Correctness:** a seat is never sold to two people. A customer is never charged without getting a ticket, and never gets a ticket without paying. This matters more than speed.
- **Fairness:** sales are first come, first served through the waiting room. One person can buy at most 4 tickets for an event, and bots are limited by rate limits and CAPTCHA.
- **Availability:** the site should be up 99.9% of the time, and it must not crash when 200,000 people arrive at once.
- **Scalability:** it must handle a normal day and a big sale that is hundreds of times busier.
- **Durability:** a paid order and its tickets must never be lost.
- **Security:** all traffic uses HTTPS, passwords are stored as hashes, and card details are handled only by the payment provider.

## 2. Estimates

### Assumptions

- 2,000,000 registered users.
- One day has 86,400 seconds.
- Peak traffic on a normal day is 5 times the average.
- In a big sale, each person makes about 10 requests (open the event, load the seat map a few times, hold seats, pay) and about 3 hold attempts.
- A ticket and its order take about 1 KB of storage.

### Normal day

| Measure | Working | Average | Peak (5x) |
|---|---|---|---|
| Page views per day | 50,000 visitors x 10 pages | 500,000 | |
| Page views per second | 500,000 / 86,400 | about 5.8 | about 29 |
| Tickets sold per day | given | 5,000 | |
| Tickets sold per second | 5,000 / 86,400 | about 0.06 | about 0.3 |
| Storage per year | 5,000 x 365 x 1 KB | about 1.8 GB | |

On a normal day there are about 100 page views for every ticket sold, so the system is **read-heavy**. A normal day is easy for one small database.

### Big sale (popular concert)

200,000 people try to buy 20,000 seats within the first 10 minutes (600 seconds).

| Measure | Working | Average over the 10 minutes | Peak (5x, first seconds) |
|---|---|---|---|
| People arriving | 200,000 / 600 | about 333 per second | about 1,700 per second |
| Requests | 200,000 x 10 / 600 | about 3,300 per second | about 16,700 per second |
| Hold attempts | 200,000 x 3 / 600 | about 1,000 per second | about 5,000 per second |
| Tickets sold | 20,000 / 600 | about 33 per second | about 170 per second |

Only 20,000 of 200,000 people can get a seat, so about **90% of the people will not get a ticket**. The sold-out experience matters as much as the buying experience.

### Comparison

| Measure | Normal day | Big sale | How much bigger |
|---|---|---|---|
| Requests per second (average) | about 5.8 | about 3,300 | about 575 times |
| Tickets sold per second (average) | about 0.06 | about 33 | about 575 times |

The big sale is about **575 times busier** than a normal day, and it happens in a few minutes. A design that works for a normal day will fail. The system also changes from read-heavy to **contention-heavy**: thousands of people fight for the same 20,000 rows at the same time, so correctness under concurrent writes is the main problem.

## 3. API

Base URL: `https://api.tickethub.example/v1`. All endpoints except login need `Authorization: Bearer <token>`.

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/auth/login` | Log in and receive a token. | 200 OK |
| GET | `/events` | Browse events. Supports `?q=`, `?page=` and `?limit=`. | 200 OK |
| GET | `/events/{id}` | Get the details of one event. | 200 OK |
| GET | `/events/{id}/seats` | View the seat map with the status of each seat (available, held or sold). | 200 OK |
| POST | `/events/{id}/queue` | Join the waiting room for a popular event. | 202 Accepted |
| GET | `/events/{id}/queue/me` | Check your place in the waiting room and receive an admission token when it is your turn. | 200 OK |
| POST | `/holds` | Hold one or more seats for 10 minutes. | 201 Created |
| DELETE | `/holds/{id}` | Release a hold. | 204 No Content |
| POST | `/orders` | Pay for the seats in a hold and create the order and tickets. | 201 Created |
| GET | `/me/tickets` | View your tickets. | 200 OK |

### Example: hold seats

```
POST /holds
Authorization: Bearer eyJhbGciOi...
```

```json
{
  "eventId": 15,
  "seatIds": [1204, 1205]
}
```

**Response: 201 Created**

```json
{
  "holdId": "h_8f3a21",
  "eventId": 15,
  "seatIds": [1204, 1205],
  "expiresAt": "2026-11-01T18:10:00Z"
}
```

### Example: pay for the hold

```
POST /orders
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 5c1d2f7e-9b44-4a0e-8a3b-1d77c0c1e9aa
```

```json
{
  "holdId": "h_8f3a21",
  "paymentToken": "tok_visa_123"
}
```

**Response: 201 Created**

```json
{
  "orderId": 90412,
  "totalCents": 24000,
  "status": "paid",
  "tickets": [
    { "ticketId": 55001, "seatId": 1204, "qrCode": "TH-15-1204-X9K2" },
    { "ticketId": 55002, "seatId": 1205, "qrCode": "TH-15-1205-M4Q7" }
  ]
}
```

The `Idempotency-Key` makes sure that if the client sends the payment twice (for example after a slow network), the customer is charged only once.

### Error codes

| Status | When it happens | Example body |
|---|---|---|
| 400 Bad Request | A request has missing or invalid data, or asks for more than 4 seats. | `{"error":{"code":"VALIDATION_ERROR","message":"You can hold at most 4 seats."}}` |
| 401 Unauthorized | The token is missing or expired. | `{"error":{"code":"UNAUTHORIZED","message":"Please log in."}}` |
| 402 Payment Required | The payment was declined. | `{"error":{"code":"PAYMENT_FAILED","message":"Your card was declined."}}` |
| 403 Forbidden | The user has not been admitted from the waiting room yet. | `{"error":{"code":"NOT_ADMITTED","message":"Please wait for your turn."}}` |
| 404 Not Found | The event, seat or hold does not exist. | `{"error":{"code":"NOT_FOUND","message":"Event 999 was not found."}}` |
| 409 Conflict | A seat was taken by someone else. | `{"error":{"code":"SEAT_TAKEN","message":"Seat 1204 was just taken. Please choose another seat."}}` |
| 410 Gone | The hold has expired. | `{"error":{"code":"HOLD_EXPIRED","message":"Your hold has expired."}}` |
| 429 Too Many Requests | The user or IP sent too many requests. | `{"error":{"code":"RATE_LIMITED","message":"Please slow down."}}` |
| 503 Service Unavailable | The system is overloaded and cannot take the request. | `{"error":{"code":"BUSY","message":"We are very busy. Please try again shortly."}}` |

## 4. Data model

Five tables: `users`, `events`, `seats`, `orders` and `tickets`. The assignment asks for users, events, seats and orders, and `tickets` is an extra table that links orders to seats. Holds are stored as columns on `seats`.

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| users | One row for each account. | `user_id` (PK), `name`, `email` (UNIQUE), `password_hash` |
| events | One row for each concert or event. | `event_id` (PK), `title`, `venue`, `starts_at`, `on_sale_at`, `max_tickets_per_user` |
| seats | One row for each seat of each event. It also stores the seat status and any hold. | `seat_id` (PK), `event_id` (FK), `section`, `row_label`, `seat_number`, `price_cents`, `status`, `held_by` (FK), `hold_expires_at` |
| orders | One row for each completed payment. | `order_id` (PK), `user_id` (FK), `event_id` (FK), `total_cents`, `payment_ref` (UNIQUE), `status` |
| tickets | One row for each sold seat. | `ticket_id` (PK), `order_id` (FK), `seat_id` (FK, UNIQUE), `qr_code` (UNIQUE) |

### Relationships

- **events to seats: one-to-many.** One event has many seats, and each seat belongs to one event.
- **users to orders: one-to-many.** One user can place many orders, and each order belongs to one user.
- **orders to tickets: one-to-many.** One order contains one or more tickets.
- **seats to tickets: one-to-one (at most one).** A seat can have at most one ticket. The UNIQUE rule on `tickets.seat_id` enforces this.
- **users to events: many-to-many** through orders and tickets, because a user can buy tickets for many events and an event is bought by many users.
- **users to seats (holds):** `seats.held_by` points to the user who currently holds the seat. It is empty when no one holds it.

### CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id       INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  event_id             INTEGER PRIMARY KEY,
  title                TEXT NOT NULL,
  venue                TEXT NOT NULL,
  starts_at            TEXT NOT NULL,
  on_sale_at           TEXT NOT NULL,
  max_tickets_per_user INTEGER NOT NULL DEFAULT 4
);

CREATE TABLE seats (
  seat_id         INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL,
  section         TEXT NOT NULL,
  row_label       TEXT NOT NULL,
  seat_number     INTEGER NOT NULL,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by         INTEGER,
  hold_expires_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(event_id),
  FOREIGN KEY (held_by)  REFERENCES users(user_id),
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  event_id    INTEGER NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  payment_ref TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL CHECK (status IN ('paid', 'refunded')),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(user_id),
  FOREIGN KEY (event_id) REFERENCES events(event_id)
);

CREATE TABLE tickets (
  ticket_id INTEGER PRIMARY KEY,
  order_id  INTEGER NOT NULL,
  seat_id   INTEGER NOT NULL UNIQUE,
  qr_code   TEXT NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  FOREIGN KEY (seat_id)  REFERENCES seats(seat_id)
);

-- Indexes
CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_seats_hold_expiry  ON seats(status, hold_expires_at);
CREATE INDEX idx_orders_user        ON orders(user_id);
```

The `payment_ref` column is UNIQUE, so the same payment can never create two orders. A refund removes the order's tickets and sets the seats back to `available` in one transaction.

### Why SQL

I choose SQL because this system needs strong correctness. Transactions, row locks and UNIQUE constraints are exactly the tools that stop a seat being sold twice and keep orders and tickets in step. The data is also structured and connected, and a relational database can easily handle the 33 to 170 ticket sales per second of a big sale.

### Indexes

- `seats(event_id, status)` makes the seat map and "how many seats are left" queries fast.
- `seats(status, hold_expires_at)` lets the worker find expired holds quickly.
- `orders(user_id)` makes "show my orders and tickets" fast.

## 5. How the design prevents two people buying the same seat

The danger is a **race condition**. Two people, Amina and Brian, click seat A12 at the same moment. If the server first reads "A12 is available" for both, and then writes "held by Amina" and "held by Brian", the second write silently replaces the first, and both people think the seat is theirs. The design uses several layers to stop this.

### Layer 1: an atomic conditional update (check and set in one statement)

The server never reads the status first and writes later. It checks and changes the seat in a single SQL statement:

```sql
UPDATE seats
SET status = 'held',
    held_by = :user_id,
    hold_expires_at = :expires_at
WHERE seat_id = :seat_id
  AND event_id = :event_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < :now));
```

The database locks the seat row while the update runs. Amina's update changes the row (1 row affected). Brian's update waits for the lock, then checks the `WHERE` condition again, sees `status = 'held'` and changes **0 rows**. The server sees 0 rows affected and returns `409 Conflict: Seat just taken`. Exactly one person wins, no matter how many app servers receive the requests.

### Layer 2: a transaction for several seats

When a user holds two or more seats, all the updates run in one transaction. If any seat returns 0 rows affected, the server runs `ROLLBACK` and none of the seats is held. This stops a user from getting half of what they asked for.

```sql
BEGIN;
-- one UPDATE like the one above for each seat
-- if every update changed exactly 1 row: COMMIT
-- otherwise: ROLLBACK and return 409
COMMIT;
```

### Layer 3: holds that expire

A hold lasts 10 minutes. If the user does not pay, the seat must return to the pool, or one person could lock seats forever. A worker runs every 30 seconds and releases expired holds. The hold query in Layer 1 also treats an expired hold as available, so a seat never stays blocked while it waits for the worker.

### Layer 4: a transaction when paying

Before charging the card, the server checks that the hold still belongs to the user and has not expired, and extends it by 2 minutes so it cannot expire during the payment. After the payment succeeds, one transaction creates the order and the tickets and marks the seats as sold:

```sql
BEGIN;

-- The seats must still be held by this user and not expired
SELECT COUNT(*) FROM seats
WHERE seat_id IN (1204, 1205)
  AND status = 'held'
  AND held_by = :user_id
  AND hold_expires_at >= :now;
-- The count must equal the number of seats, otherwise ROLLBACK

INSERT INTO orders (user_id, event_id, total_cents, payment_ref, status)
VALUES (:user_id, :event_id, :total, :payment_ref, 'paid');

INSERT INTO tickets (order_id, seat_id, qr_code) VALUES
  (:order_id, 1204, :qr1),
  (:order_id, 1205, :qr2);

UPDATE seats
SET status = 'sold', held_by = NULL, hold_expires_at = NULL
WHERE seat_id IN (1204, 1205) AND held_by = :user_id;

COMMIT;
```

Either all of these steps happen or none of them do. If the transaction fails after the card was charged, the server refunds the payment.

### Layer 5: a constraint as the last line of defence

`tickets.seat_id` is UNIQUE. Even if a bug in the code tried to sell a seat twice, the database would reject the second ticket and the transaction would fail. Constraints protect the data even when the application code is wrong.

### Layer 6: never trust the cache for decisions

The seat map shown to users comes from the cache and may be 1 or 2 seconds old, so a user may click a seat that was just taken. That is acceptable, because the cache is only used for **display**. The real decision is always made by the primary database in Layer 1. The user simply sees "Seat just taken, please choose another".

### Payment safety

The `Idempotency-Key` header and the UNIQUE `payment_ref` column make sure that a retried payment request does not charge the customer twice or create two orders.

## 6. Architecture

### Diagram

```
 +-----------+   1. find address    +---------+
 |  Client   | -------------------> |   DNS   |
 | (browser) | <------------------- |         |
 +-----+-----+                      +---------+
       |
       |  static files, images                  API calls
       v                                           |
 +-----------+                                     v
 |    CDN    |                         +---------------------+
 +-----------+                         |    Waiting Room     |
                                       |  (virtual queue)    |
                                       +----------+----------+
                                                  | admitted users only
                                       +----------v----------+
                                       |   Load Balancer     |
                                       |  + Rate Limiter     |
                                       +----------+----------+
                                                  |
                  +-------------------------------+-------------------------------+
                  |                               |                               |
          +-------v------+                +-------v------+                +-------v------+
          | App Server 1 |                | App Server 2 |                | App Server N |
          +-------+------+                +-------+------+                +-------+------+
                  |                               |                               |
                  +---------------+---------------+--------------+----------------+
                                  |                              |
                        +---------v---------+          +---------v----------+
                        |  Cache (Redis)    |          |   Message Queue    |
                        |  event pages,     |          |  (emails, tickets, |
                        |  seat map,        |          |   release holds)   |
                        |  sold-out flag    |          +---------+----------+
                        +---------+---------+                    |
                                  | cache miss                   v
                        +---------v---------+          +--------------------+
          holds, orders |   Primary DB      | <------- |      Workers       |
          ------------> |  seats, orders,   |  updates |  (send emails,     |
                        |  tickets          |          |   expire holds)    |
                        +---------+---------+          +--------------------+
                                  | replication
                        +---------v---------+
          browse events |   Read Replica    |      App servers also call the
          ------------> |  events, venues   |      external Payment Provider
                        +-------------------+      to charge cards
```

### What each component does

- **Client:** it solves the need for a simple interface by letting people browse events, pick seats and pay from a browser or phone.
- **DNS:** it solves the problem of finding the service by turning `api.tickethub.example` into the address of the entry point.
- **CDN:** it solves slow pages and overload by serving images, scripts and public event pages from servers near the user, so the big sale's browsing traffic never reaches our servers.
- **Waiting room:** it solves the sudden crowd of 200,000 people by letting users in a small batch at a time in the order they arrived, which keeps the system working and the sale fair.
- **Load balancer and rate limiter:** it solves overload and bots by spreading requests across app servers, skipping broken servers, and blocking anyone who sends too many requests.
- **App servers:** they solve the need to run the business rules (login, holds, orders) and, because they keep no local data, we can add many more of them before a big sale.
- **Cache (Redis):** it solves repeated reads by keeping event pages, a short-lived copy of the seat map and a "sold out" flag in fast memory, so most requests never touch the database.
- **Primary database:** it solves the need for correct, consistent seat and order data by taking all holds and orders using transactions and constraints.
- **Read replica:** it solves read overload on the primary by answering browsing queries, such as event lists and details, from a copy.
- **Message queue:** it solves slow responses by holding background jobs, so the app server can answer as soon as the order is saved.
- **Workers:** they solve the need for slow or repeated work, such as sending confirmation emails, creating the QR codes and releasing expired holds, and they retry failed jobs.
- **Payment provider (external):** it solves the need for safe card payments, so TicketHub never stores card numbers.

### How the design survives the big sale

1. **Prepare before the sale.** The team adds extra app servers before the on-sale time, fills the cache with the event page, and load-tests the system with the expected 3,300 requests per second.
2. **The CDN takes the browsing load.** Images, scripts and the public event page come from the CDN, so they do not reach our servers.
3. **The waiting room controls the crowd.** Instead of 200,000 people hitting the buying API at once, only a limited number of admitted users, for example 500 every 10 seconds, reach the seat and payment APIs. This keeps hold attempts to hundreds per second instead of thousands.
4. **The cache absorbs the seat map reads.** The seat map is cached for 1 to 2 seconds, so thousands of people can look at it without thousands of database queries.
5. **The write path stays small.** Only 33 sales per second (about 170 at peak) reach the database as real writes, which a primary database can handle with row-level locks.
6. **A "sold out" flag stops useless work.** When the last seat is sold, the app sets a flag in the cache. All later requests get "sold out" immediately, without touching the database.
7. **Rate limits and bot protection.** The limit of 4 tickets per person, the per-user and per-IP limits and a CAPTCHA keep the sale fair.
8. **Slow work is moved to the queue.** Emails and QR codes are created in the background, so they never slow down the buying path.
9. **It fails safely.** If the system is overloaded, it answers `503` or places users in the waiting room, instead of selling seats wrongly. Browsing keeps working through the CDN and the replica.

## 7. Trade-offs

1. **Waiting room: fairness and stability versus user experience.** The waiting room protects the system and makes the sale fair, but people have to wait and some will give up. We accept this because a crashed site, or a site where bots win, is much worse.

2. **Cached seat map: speed versus accuracy.** A seat map that is 1 or 2 seconds old makes the page fast and cheap to serve, but some users will click a seat that was just taken and see "Seat just taken". We accept this because the real check is always made in the database, so the cache can never cause a double sale.

3. **Holds with an expiry: fairness versus unsold seats.** A 10-minute hold gives people time to pay and prevents two people paying for the same seat, but a seat held by someone who never pays is unavailable for a while. A short expiry frees seats faster but rushes buyers. We chose 10 minutes as a balance.

4. **One primary database: correctness versus a limit on writes.** Keeping all seat writes in one primary database makes locks and transactions simple and correct. The cost is that it is the one place that cannot be spread across many machines easily. At 170 writes per second at peak, it is well within its limits. For a much larger system, the seats could be split across databases by `event_id` (sharding), at the price of more complexity.

5. **Queue for emails and tickets: fast checkout versus delay.** Sending emails in the background keeps the payment fast, but the customer may wait a few seconds for the email. The tickets are visible in `GET /me/tickets` immediately.