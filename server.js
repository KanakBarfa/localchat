const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://chat:chat@db:5432/chatapp';
const MAX_PERSISTED_MESSAGES = Number(process.env.MAX_PERSISTED_MESSAGES || 500);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const pool = new Pool({ connectionString: DATABASE_URL });

app.use(express.json());

app.get('/healthz', (_req, res) => {
    res.status(200).send('ok');
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id BIGSERIAL PRIMARY KEY,
            user_name TEXT,
            message TEXT NOT NULL,
            event_type TEXT NOT NULL DEFAULT 'chat',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_type TEXT');
    await pool.query("UPDATE messages SET event_type = 'chat' WHERE event_type IS NULL");
    await pool.query("ALTER TABLE messages ALTER COLUMN event_type SET DEFAULT 'chat'");
    await pool.query('ALTER TABLE messages ALTER COLUMN event_type SET NOT NULL');
}

async function loadRecentMessages(limit = MAX_PERSISTED_MESSAGES) {
    const { rows } = await pool.query(
        `
            SELECT id, user_name, message, event_type, created_at
            FROM (
                SELECT id, user_name, message, event_type, created_at
                FROM messages
                ORDER BY id DESC
                LIMIT $1
            ) recent
            ORDER BY id ASC
        `,
        [limit]
    );

    return rows.map((row) => ({
        id: row.id,
        user: row.user_name,
        message: row.message,
        type: row.event_type,
        timestamp: row.created_at
    }));
}

async function persistMessage(message) {
    const { rows } = await pool.query(
        'INSERT INTO messages (user_name, message, event_type) VALUES ($1, $2, $3) RETURNING id, user_name, message, event_type, created_at',
        [message.user, message.message, message.type || 'chat']
    );

    return {
        id: rows[0].id,
        user: rows[0].user_name,
        message: rows[0].message,
        type: rows[0].event_type,
        timestamp: rows[0].created_at
    };
}

async function deleteMessageById(id) {
    const result = await pool.query('DELETE FROM messages WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
}

function getPasswordFromRequest(req) {
    const headerPassword = req.get('x-admin-password');
    if (headerPassword) {
        return headerPassword;
    }

    const authorization = req.get('authorization');
    if (!authorization || !authorization.startsWith('Basic ')) {
        return '';
    }

    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
        return '';
    }

    return decoded.slice(separatorIndex + 1);
}

function requireAdminAuth(req, res, next) {
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({ error: 'Admin page is disabled: ADMIN_PASSWORD is not configured.' });
    }

    const providedPassword = getPasswordFromRequest(req);
    if (providedPassword !== ADMIN_PASSWORD) {
        res.set('WWW-Authenticate', 'Basic realm="localchat-admin"');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
}

async function refreshHistoryForAllClients() {
    const history = await loadRecentMessages();
    io.emit('history', history);
}

app.get('/api/admin/messages', requireAdminAuth, async (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || MAX_PERSISTED_MESSAGES, 5000));

    try {
        const history = await loadRecentMessages(limit);
        return res.json({ messages: history });
    } catch (error) {
        console.error('Failed to load admin message list:', error);
        return res.status(500).json({ error: 'Failed to load messages' });
    }
});

app.delete('/api/admin/messages/all', requireAdminAuth, async (_req, res) => {
    try {
        const result = await pool.query('DELETE FROM messages');
        await refreshHistoryForAllClients();
        return res.json({ deletedCount: result.rowCount || 0 });
    } catch (error) {
        console.error('Failed to delete all messages:', error);
        return res.status(500).json({ error: 'Failed to delete all messages' });
    }
});

app.delete('/api/admin/messages/client/:clientName', requireAdminAuth, async (req, res) => {
    const clientName = String(req.params.clientName || '').trim();

    if (!clientName) {
        return res.status(400).json({ error: 'Client name is required' });
    }

    try {
        const result = await pool.query('DELETE FROM messages WHERE user_name = $1', [clientName]);
        await refreshHistoryForAllClients();
        return res.json({ deletedCount: result.rowCount || 0 });
    } catch (error) {
        console.error('Failed to delete messages by client:', error);
        return res.status(500).json({ error: 'Failed to delete client messages' });
    }
});

app.delete('/api/admin/messages/selected', requireAdminAuth, async (req, res) => {
    const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = incomingIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);

    if (ids.length === 0) {
        return res.status(400).json({ error: 'A non-empty ids array is required' });
    }

    try {
        const result = await pool.query('DELETE FROM messages WHERE id = ANY($1::bigint[])', [ids]);
        await refreshHistoryForAllClients();
        return res.json({ deletedCount: result.rowCount || 0 });
    } catch (error) {
        console.error('Failed to delete selected messages:', error);
        return res.status(500).json({ error: 'Failed to delete selected messages' });
    }
});

initDatabase().then(() => {
    http.listen(PORT, '0.0.0.0', () => {
        console.log(`Chat server running on port ${PORT}`);
        console.log('Message store: PostgreSQL');
        console.log(ADMIN_PASSWORD ? 'Admin page enabled at /admin' : 'Admin page disabled: ADMIN_PASSWORD is missing');
    });
}).catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

io.on('connection', (socket) => {
    socket.on('join', async (name) => {
        socket.data.name = name;
        socket.data.joinMessageId = null;
        console.log(`${name} joined the chat`);

        try {
            const history = await loadRecentMessages();
            socket.emit('history', history);
        } catch (error) {
            console.error('Failed to load message history:', error);
            socket.emit('history', []);
        }

        try {
            const joinEvent = await persistMessage({
                user: name,
                message: `${name} has joined the chat`,
                type: 'join'
            });
            socket.data.joinMessageId = joinEvent.id;
            io.emit('message', joinEvent);
        } catch (error) {
            console.error('Failed to persist join event:', error);
            io.emit('message', { user: null, message: `${name} has joined the chat`, type: 'join' });
        }
    });

    socket.on('message', async (data) => {
        if (data.message.length > 200) {
            data.message = data.message.substring(0, 200) + '...';
        }
        console.log(`${data.user}: ${data.message}`);
        const message = { user: data.user, message: data.message, type: 'chat' };

        try {
            const savedMessage = await persistMessage(message);
            io.emit('message', savedMessage);
        } catch (error) {
            console.error('Failed to persist message:', error);
            io.emit('message', message);
        }
    });

    socket.on('disconnect', async () => {
        if (socket.data.name) {
            console.log(`${socket.data.name} left the chat`);

            if (socket.data.joinMessageId) {
                try {
                    await deleteMessageById(socket.data.joinMessageId);
                    await refreshHistoryForAllClients();
                } catch (error) {
                    console.error('Failed to cancel persisted join event on disconnect:', error);
                }
            }

            io.emit('message', { user: null, message: `${socket.data.name} has left the chat`, type: 'leave' });
        }
    });

});

