const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://chat:chat@db:5432/chatapp';
const MAX_PERSISTED_MESSAGES = Number(process.env.MAX_PERSISTED_MESSAGES || 500);

const pool = new Pool({ connectionString: DATABASE_URL });

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id BIGSERIAL PRIMARY KEY,
            user_name TEXT,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function loadRecentMessages(limit = MAX_PERSISTED_MESSAGES) {
    const { rows } = await pool.query(
        `
            SELECT user_name, message, created_at
            FROM (
                SELECT user_name, message, created_at
                FROM messages
                ORDER BY id DESC
                LIMIT $1
            ) recent
            ORDER BY created_at ASC, user_name ASC
        `,
        [limit]
    );

    return rows.map((row) => ({
        user: row.user_name,
        message: row.message,
        timestamp: row.created_at
    }));
}

async function persistMessage(message) {
    await pool.query(
        'INSERT INTO messages (user_name, message) VALUES ($1, $2)',
        [message.user, message.message]
    );
}

app.use(express.static(path.join(__dirname, 'public')));

initDatabase().then(() => {
    http.listen(PORT, '0.0.0.0', () => {
        console.log(`Chat server running on port ${PORT}`);
        console.log('Message store: PostgreSQL');
    });
}).catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

io.on('connection', (socket) => {
    socket.on('join', async (name) => {
        socket.data.name = name;
        console.log(`${name} joined the chat`);

        try {
            const history = await loadRecentMessages();
            socket.emit('history', history);
        } catch (error) {
            console.error('Failed to load message history:', error);
            socket.emit('history', []);
        }

        io.emit('message', { user: null, message: `${name} has joined the chat` });
    });

    socket.on('message', async (data) => {
        if (data.message.length > 200) {
            data.message = data.message.substring(0, 200) + '...';
        }
        console.log(`${data.user}: ${data.message}`);
        const message = { user: data.user, message: data.message };

        try {
            await persistMessage(message);
        } catch (error) {
            console.error('Failed to persist message:', error);
        }

        io.emit('message', message);
    });

    socket.on('disconnect', () => {
        if (socket.data.name) {
            console.log(`${socket.data.name} left the chat`);
            io.emit('message', { user: null, message: `${socket.data.name} has left the chat` });
        }
    });

});

