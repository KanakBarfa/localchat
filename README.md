## Local Chat


A simple socket based chatting application

### Persistent Message Storage

Messages are persisted in PostgreSQL.

In Docker Compose, the app connects to the `db` service and stores data in a named volume (`pgdata`), so messages survive container restarts and redeploys.

### Configuration

- `DATABASE_URL`: PostgreSQL connection string (default: `postgres://chat:chat@db:5432/chatapp`)
- `MAX_PERSISTED_MESSAGES`: Maximum number of messages kept on disk (default: `500`)
- `ADMIN_PASSWORD`: Enables the admin page when set. Required for all admin actions.

### Admin Page

Open `/admin` in your browser.

The admin page supports:

- Deleting all persisted messages.
- Deleting all persisted messages from one client username.
- Selecting individual messages and deleting only those.

All admin API calls require the admin password and use the `x-admin-password` header.
