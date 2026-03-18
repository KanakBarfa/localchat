## Local Chat


A simple socket based chatting application

### Persistent Message Storage

Messages are persisted in PostgreSQL.

In Docker Compose, the app connects to the `db` service and stores data in a named volume (`pgdata`), so messages survive container restarts and redeploys.

### Configuration

- `DATABASE_URL`: PostgreSQL connection string (default: `postgres://chat:chat@db:5432/chatapp`)
- `MAX_PERSISTED_MESSAGES`: Maximum number of messages kept on disk (default: `500`)
