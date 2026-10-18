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
- **Correctness:** a seat is never sold or held by two people at the same time. A customer is never charged without getting a ticket, and never gets a ticket without paying. This matters more than speed.
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
- A sold seat and its order take about 1 KB of storage.

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
| POST | `/orders` | Pay for the seats in a hold and create the order. | 201 Created |
| GET | `/me/tickets` | View your tickets (the sold seats of your orders, each with its QR code). | 200 OK |

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
    { "seatId": 1204, "qrCode": "TH-15-1204-X9K2" },
    { "seatId": 1205, "qrCode": "TH-15-1205-M4Q7" }
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

The data model has the four required tables: **users**, **events**, **seats** and **orders**. The hold on a seat and the ticket QR code are stored as columns on the `seats` table, so a seat's whole state (free, held or sold) lives in one row. That single row is what the database locks to stop double-booking.

### The four tables

#### users
One row for each account.

| Column | Type | Key / rule |
|---|---|---|
| user_id | INTEGER | Primary key |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT | NOT NULL, defaults to the current time |

#### events
One row for each concert or event.

| Column | Type | Key / rule |
|---|---|---|
| event_id | INTEGER | Primary key |
| title | TEXT | NOT NULL |
| venue | TEXT | NOT NULL |
| starts_at | TEXT | NOT NULL |
| on_sale_at | TEXT | NOT NULL |
| max_tickets_per_user | INTEGER | NOT NULL, defaults to 4 |

#### seats
One row for each seat of each event. It stores the seat's status and who holds or owns it.

| Column | Type | Key / rule |
|---|---|---|
| seat_id | INTEGER | Primary key |
| event_id | INTEGER | Foreign key to `events(event_id)`, NOT NULL |
| section, row_label, seat_number | TEXT, TEXT, INTEGER | NOT NULL. Together with `event_id` they are UNIQUE, so a seat cannot be listed twice |
| price_cents | INTEGER | NOT NULL, 0 or more |
| status | TEXT | NOT NULL, one of `available`, `held`, `sold` |
| held_by | INTEGER | Foreign key to `users(user_id)`. The user who holds the seat, or empty |
| hold_expires_at | TEXT | When the hold ends, or empty |
| order_id | INTEGER | Foreign key to `orders(order_id)`. The order that bought the seat, or empty |
| qr_code | TEXT | UNIQUE. The ticket code, set when the seat is sold |

#### orders
One row for each completed payment.

| Column | Type | Key / rule |
|---|---|---|
| order_id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users(user_id)`, NOT NULL |
| event_id | INTEGER | Foreign key to `events(event_id)`, NOT NULL |
| total_cents | INTEGER | NOT NULL, 0 or more |
| payment_ref | TEXT | NOT NULL, UNIQUE (the payment provider's reference) |
| status | TEXT | NOT NULL, `paid` or `refunded` |
| created_at | TEXT | NOT NULL, defaults to the current time |

### Relationships

- **events to seats: one-to-many.** One event has many seats, and each seat belongs to one event (`seats.event_id`).
- **users to orders: one-to-many.** One user can place many orders, and each order belongs to one user (`orders.user_id`).
- **events to orders: one-to-many.** One event has many orders (`orders.event_id`).
- **orders to seats: one-to-many.** One order buys one or more seats (`seats.order_id`). A seat has a single `order_id` column, so it can belong to at most one order.
- **users to seats (holds): one-to-many.** One user can hold several seats at the same time (`seats.held_by`).
- **users to events: many-to-many**, through orders and seats. A user can buy seats for many events, and an event has buyers from many users.

### CREATE TABLE statements

These statements were tested in SQLite and also run in an SQLite playground such as sqliteonline.com.

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
  order_id        INTEGER,
  qr_code         TEXT UNIQUE,
  FOREIGN KEY (event_id) REFERENCES events(event_id),
  FOREIGN KEY (held_by)  REFERENCES users(user_id),
  FOREIGN KEY (order_id) REFERENCES orders(order_id),
  UNIQUE (event_id, section, row_label, seat_number),

  -- A seat can only be in one valid state at a time
  CONSTRAINT seat_state_valid CHECK (
    (status = 'available'
       AND held_by IS NULL AND hold_expires_at IS NULL AND order_id IS NULL)
    OR (status = 'held'
       AND held_by IS NOT NULL AND hold_expires_at IS NOT NULL AND order_id IS NULL)
    OR (status = 'sold'
       AND order_id IS NOT NULL AND held_by IS NULL AND hold_expires_at IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_seats_event_status ON seats(event_id, status);
CREATE INDEX idx_seats_hold_expiry  ON seats(status, hold_expires_at);
CREATE INDEX idx_orders_user        ON orders(user_id);
```

### Sample data

```sql
INSERT INTO users (user_id, name, email, password_hash) VALUES
  (1, 'Amina Wanjiru', 'amina@example.com', 'hash1'),
  (2, 'Brian Otieno',  'brian@example.com', 'hash2');

INSERT INTO events (event_id, title, venue, starts_at, on_sale_at) VALUES
  (15, 'Big Concert', 'City Arena', '2026-12-01 19:00:00', '2026-11-01 18:00:00');

INSERT INTO seats (seat_id, event_id, section, row_label, seat_number, price_cents) VALUES
  (1204, 15, 'A', '12', 4, 12000),
  (1205, 15, 'A', '12', 5, 12000),
  (1206, 15, 'A', '12', 6, 12000);
```

### Indexes and reasons

- `seats(event_id, status)` makes the seat map and "how many seats are left" queries fast.
- `seats(status, hold_expires_at)` lets the worker find expired holds quickly.
- `orders(user_id)` makes "show my orders and tickets" fast.

### Why SQL

I choose SQL because this system needs strong correctness. Transactions, row locks and constraints are exactly the tools that stop a seat being held or sold twice and keep orders and seats in step. The data is also structured and connected, and a relational database can easily handle the 33 to 170 ticket sales per second of a big sale.

## 5. How the design prevents two people holding or buying the same seat

The danger is a **race condition**. Two people, Amina and Brian, click seat 1204 in the same second. If the server first reads "1204 is available" for both, and then writes "held by Amina" and "held by Brian", the second write silently replaces the first, and both people think the seat is theirs.

The design stops this with **a transaction, a row lock, and a conditional update that checks and changes the seat in one statement**. The exact SQL is below.

### The exact hold transaction (PostgreSQL or MySQL)

This runs when `POST /holds` asks for seats 1204 and 1205 for user 1 (Amina). `now()` is the database clock, so all servers agree on the time.

```sql
BEGIN;

-- Step 1: LOCK the requested seat rows.
-- ORDER BY seat_id means every transaction locks seats in the same order,
-- so two people asking for overlapping seats can never deadlock.
-- Any other transaction that wants these rows now WAITS here
-- until we COMMIT or ROLLBACK.
SELECT seat_id, status, held_by, hold_expires_at
FROM seats
WHERE event_id = 15
  AND seat_id IN (1204, 1205)
ORDER BY seat_id
FOR UPDATE;

-- Step 2: Check and change the seats in ONE statement.
-- Only seats that are free (or whose old hold has expired) are changed.
UPDATE seats
SET status          = 'held',
    held_by         = 1,
    hold_expires_at = now() + INTERVAL '10 minutes'
WHERE event_id = 15
  AND seat_id IN (1204, 1205)
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < now()));

-- Step 3: The application checks the number of rows changed.
--   2 rows changed -> both seats are ours -> COMMIT;  (return 201)
--   fewer than 2   -> someone else has a seat -> ROLLBACK;  (return 409)
COMMIT;
```

`FOR UPDATE` takes a row-level lock. The `UPDATE` in Step 2 changes a row only if the `WHERE` condition is still true at that moment, so even without Step 1 it would never let two people win. Step 1 adds a clear lock order, which avoids deadlocks when two people ask for different groups of seats that overlap.

### What happens when two people click in the same second

| Time | Amina (user 1) | Brian (user 2) | Seat 1204 |
|---|---|---|---|
| t0 | `BEGIN` | `BEGIN` | available |
| t1 | `SELECT ... FOR UPDATE` gets the lock | | locked by Amina |
| t2 | | `SELECT ... FOR UPDATE` **waits** for the lock | locked by Amina |
| t3 | `UPDATE` changes 1 row (2 rows for two seats) | still waiting | held by Amina |
| t4 | `COMMIT`, lock released | | held by Amina |
| t5 | | His `SELECT` continues and now sees `status = 'held'`, `held_by = 1` | held by Amina |
| t6 | | `UPDATE` changes **0 rows**, because the `WHERE` no longer matches | held by Amina |
| t7 | | App sees 0 rows, runs `ROLLBACK`, returns `409 Seat just taken` | held by Amina |

Exactly one person wins, however many app servers receive the two requests. This works because the lock and the check happen **inside the database**, not in the application code. App servers cannot protect a seat with a variable in memory, because there are many of them and they do not share memory.

### The same transaction in SQLite

SQLite has no `FOR UPDATE`. It uses `BEGIN IMMEDIATE`, which takes the write lock for the whole database before any change, so only one hold transaction runs at a time. This version was tested with the sample data above.

```sql
BEGIN IMMEDIATE;

UPDATE seats
SET status          = 'held',
    held_by         = 1,
    hold_expires_at = '2026-11-01 18:10:00'
WHERE event_id = 15
  AND seat_id IN (1204, 1205)
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < '2026-11-01 18:00:00'));

-- 2 rows changed -> COMMIT;   fewer than 2 -> ROLLBACK;
COMMIT;
```

In the test, Amina's hold changed 2 rows. When Brian ran the same statement for the same seats, it changed **0 rows**, so his transaction was rolled back. After the hold expired (10 minutes later), Brian's hold changed 2 rows and succeeded.

### The exact payment transaction

Before charging the card, the server checks that the hold still belongs to the user and adds 2 minutes to it, so it cannot expire during the payment. After the payment provider confirms the charge, one transaction creates the order and marks the seats as sold:

```sql
BEGIN;

-- The seats must still be held by this user and not expired. Lock them.
SELECT seat_id
FROM seats
WHERE seat_id IN (1204, 1205)
  AND status = 'held'
  AND held_by = 1
  AND hold_expires_at >= now()
ORDER BY seat_id
FOR UPDATE;
-- The application checks that 2 rows came back. If not: ROLLBACK and refund.

INSERT INTO orders (user_id, event_id, total_cents, payment_ref, status)
VALUES (1, 15, 24000, 'pay_9d2c41', 'paid')
RETURNING order_id;                       -- for example 90412

UPDATE seats
SET status = 'sold', held_by = NULL, hold_expires_at = NULL,
    order_id = 90412, qr_code = 'TH-15-1204-X9K2'
WHERE seat_id = 1204 AND status = 'held' AND held_by = 1;

UPDATE seats
SET status = 'sold', held_by = NULL, hold_expires_at = NULL,
    order_id = 90412, qr_code = 'TH-15-1205-M4Q7'
WHERE seat_id = 1205 AND status = 'held' AND held_by = 1;

-- The application checks that each UPDATE changed 1 row.
COMMIT;
```

Either all of these steps happen or none of them do. If the transaction fails after the card was charged, the server refunds the payment. In the SQLite test, a user who had lost the hold (Amina, after Brian took the seats) ran the same sale `UPDATE` and it changed **0 rows**, so she could not sell seats she did not hold.

### Releasing expired holds

A hold lasts 10 minutes, so a seat is not locked forever by someone who never pays. A worker runs every 30 seconds:

```sql
UPDATE seats
SET status = 'available', held_by = NULL, hold_expires_at = NULL
WHERE status = 'held'
  AND hold_expires_at < now();
```

The hold `UPDATE` above also treats an expired hold as available, so a seat never stays blocked while it waits for the worker.

### Layers of protection

1. **Row lock (`SELECT ... FOR UPDATE`):** other transactions wait for the seat rows instead of reading them at the same time.
2. **Conditional update (`WHERE status = 'available' ...`):** the check and the change happen in one statement, so there is no gap between reading and writing.
3. **Transaction (`BEGIN` ... `COMMIT` or `ROLLBACK`):** a user who asks for several seats gets all of them or none.
4. **Hold expiry:** seats return to the pool if the user does not pay.
5. **Payment transaction:** the sale only works if the seat is still held by that user.
6. **Constraints:** the `seat_state_valid` CHECK makes it impossible to store a seat that is both held and sold, and a seat has a single `order_id` column, so it can never belong to two orders. The UNIQUE `qr_code` and UNIQUE `payment_ref` stop duplicate tickets and duplicate payments.
7. **The cache is never used for the decision.** The seat map is cached for 1 or 2 seconds for display, so a user may click a seat that was just taken. The real decision is always made by the primary database, and the user simply sees "Seat just taken".

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
          ------------> |  users, events,   |  updates |  (send emails,     |
                        |  seats, orders    |          |   expire holds)    |
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
- **Primary database:** it solves the need for correct, consistent seat and order data by taking all holds and orders using row locks, transactions and constraints.
- **Read replica:** it solves read overload on the primary by answering browsing queries, such as event lists and details, from a copy.
- **Message queue:** it solves slow responses by holding background jobs, so the app server can answer as soon as the order is saved.
- **Workers:** they solve the need for slow or repeated work, such as sending confirmation emails, creating the QR codes and releasing expired holds, and they retry failed jobs.
- **Payment provider (external):** it solves the need for safe card payments, so TicketHub never stores card numbers.

### How the design survives the big sale

1. **Prepare before the sale.** The team adds extra app servers before the on-sale time, fills the cache with the event page, and load-tests the system with the expected 3,300 requests per second.
2. **The CDN takes the browsing load.** Images, scripts and the public event page come from the CDN, so they do not reach our servers.
3. **The waiting room controls the crowd.** Instead of 200,000 people hitting the buying API at once, only a limited number of admitted users, for example 500 every 10 seconds, reach the seat and payment APIs. This keeps hold attempts to hundreds per second instead of thousands.
4. **The cache absorbs the seat map reads.** The seat map is cached for 1 to 2 seconds, so thousands of people can look at it without thousands of database queries.
5. **The write path stays small.** Only 33 sales per second (about 170 at peak) reach the database as real writes, which a primary database can handle with row-level locks. The locks are held only for a few milliseconds, because each transaction is short.
6. **A "sold out" flag stops useless work.** When the last seat is sold, the app sets a flag in the cache. All later requests get "sold out" immediately, without touching the database.
7. **Rate limits and bot protection.** The limit of 4 tickets per person, the per-user and per-IP limits and a CAPTCHA keep the sale fair.
8. **Slow work is moved to the queue.** Emails and QR codes are created in the background, so they never slow down the buying path.
9. **It fails safely.** If the system is overloaded, it answers `503` or places users in the waiting room, instead of selling seats wrongly. Browsing keeps working through the CDN and the replica.

## 7. Trade-offs

1. **Waiting room: fairness and stability versus user experience.** The waiting room protects the system and makes the sale fair, but people have to wait and some will give up. We accept this because a crashed site, or a site where bots win, is much worse.

2. **Cached seat map: speed versus accuracy.** A seat map that is 1 or 2 seconds old makes the page fast and cheap to serve, but some users will click a seat that was just taken and see "Seat just taken". We accept this because the real check is always made in the database, so the cache can never cause a double sale.

3. **Row locks and holds: correctness versus waiting.** Locking seat rows guarantees that only one person wins, but the losing request has to wait a few milliseconds for the lock, and a seat held by someone who never pays is unavailable for up to 10 minutes. A shorter hold frees seats faster but rushes buyers. We chose 10 minutes as a balance.

4. **One primary database: correctness versus a limit on writes.** Keeping all seat writes in one primary database makes locks and transactions simple and correct. The cost is that it is the one place that cannot be spread across many machines easily. At 170 writes per second at peak, it is well within its limits. For a much larger system, the seats could be split across databases by `event_id` (sharding), at the price of more complexity.

5. **Queue for emails and tickets: fast checkout versus delay.** Sending emails in the background keeps the payment fast, but the customer may wait a few seconds for the email. The tickets are visible in `GET /me/tickets` immediately.