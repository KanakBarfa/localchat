const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { createChatStore } = require('./backend/chatStore');
const { createRequireAdminAuth, registerApiRoutes } = require('./backend/apiRoutes');
const { registerSocketHandlers } = require('./backend/socketHandlers');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://chat:chat@db:5432/chatapp';
const MAX_PERSISTED_MESSAGES = Number(process.env.MAX_PERSISTED_MESSAGES || 500);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const store = createChatStore({
    databaseUrl: DATABASE_URL,
    maxPersistedMessages: MAX_PERSISTED_MESSAGES
});

const requireAdminAuth = createRequireAdminAuth(ADMIN_PASSWORD);

app.use(express.json());

app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
});

async function refreshHistoryForAllClients() {
    const history = await store.loadRecentMessages();
    io.emit('history', history);
}

registerApiRoutes(app, {
    store,
    requireAdminAuth,
    refreshHistoryForAllClients,
    maxPersistedMessages: MAX_PERSISTED_MESSAGES
});

store.initDatabase().then(() => {
    http.listen(PORT, '0.0.0.0', () => {
        console.log(`Chat server running on port ${PORT}`);
        console.log('Message store: PostgreSQL');
        console.log(ADMIN_PASSWORD ? 'Admin page enabled at /admin' : 'Admin page disabled: ADMIN_PASSWORD is missing');
    });
}).catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

registerSocketHandlers(io, {
    store,
    refreshHistoryForAllClients
});

