## Local Chat


A simple socket based chatting application

### Persistent Message Storage

Messages are persisted to a JSON file.

In Docker Compose, MESSAGE_STORE_PATH is set to `/data/messages.json` and backed by a named volume (`chat-data`), so messages survive container restarts and redeploys.

### Configuration

- `MESSAGE_STORE_PATH`: Path to the JSON message store (default outside Docker: `./data/messages.json`)
- `MAX_PERSISTED_MESSAGES`: Maximum number of messages kept on disk (default: `500`)
