## Local Chat

A self-hosted, real-time chat application for private networks.

Local Chat is designed for teams, homes, labs, and classrooms that want instant messaging without relying on public chat services. You host it on your own machine or server, and your traffic stays in your environment.

## Why This Repository Is Useful

- Local-first communication: run chat entirely in your own network.
- No third-party relay: no external SaaS chat provider is required.
- Fast real-time delivery: Socket.IO pushes messages instantly to connected clients.
- Persistent history: PostgreSQL stores messages so chat survives restarts.
- Simple operations: start with Docker Compose or plain Node.js.

## Core Highlights

- Private-network friendly: ideal for LAN usage where control and low latency matter.
- Secure by architecture: messages are handled by your own server and database.
- Admin controls included: review and delete persisted messages when needed.
- Minimal stack: Express + Socket.IO + PostgreSQL.

## Architecture

- Backend: Node.js + Express
- Realtime: Socket.IO
- Persistence: PostgreSQL
- Frontend: static files served by Nginx in a separate container
- Browser entrypoint: Nginx proxies `/api` and `/socket.io` to the backend

In Docker Compose, the app connects to the `db` service and stores data in a named volume (`pgdata`), so messages survive container restarts and redeploys.

## Quick Start

### Option 1: Docker Compose (recommended)

1. Build and start:

	```bash
	docker compose up -d --build
	```

2. Open chat:

	```
	http://localhost:3000
	```

3. Open admin page:

	```
	http://localhost:3000/admin
	```

The frontend container serves the UI and forwards chat/API requests to the backend container on the same Compose network.

### Option 2: Run with Node.js

1. Install dependencies:

	```bash
	npm install
	```

2. Start server:

	```bash
	npm start
	```

3. Open:

	```
	http://localhost:3000
	```

Note: When running without Docker, ensure `DATABASE_URL` points to a reachable PostgreSQL instance.

## Configuration

- `DATABASE_URL`: PostgreSQL connection string.
  - Default: `postgres://chat:chat@db:5432/chatapp`
- `MAX_PERSISTED_MESSAGES`: maximum number of messages loaded from storage.
  - Default: `500`
- `ADMIN_PASSWORD`: enables admin APIs and `/admin` when set.

## Admin Features

Open `/admin` in your browser.

The admin page supports:

- Deleting all persisted messages.
- Deleting all persisted messages from one client username.
- Selecting individual messages and deleting only those.

All admin API calls require the admin password and accept it through:

- `x-admin-password` header, or
- HTTP Basic Auth password.

## Security Notes

- This project avoids third-party chat infrastructure by design.
- For true transport security, place it behind TLS (for example, a reverse proxy with HTTPS) when used beyond a trusted local network.
- Use a strong `ADMIN_PASSWORD` and keep it private.

## License

Distributed under the MIT License. See `LICENSE` for details.
