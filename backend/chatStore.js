const { Pool } = require('pg');

function createChatStore({ databaseUrl, maxPersistedMessages }) {
    const pool = new Pool({ connectionString: databaseUrl });

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

    async function loadRecentMessages(limit = maxPersistedMessages) {
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

    async function deleteMessagesByClient(clientName) {
        const result = await pool.query('DELETE FROM messages WHERE user_name = $1', [clientName]);
        return result.rowCount || 0;
    }

    async function deleteAllMessages() {
        const result = await pool.query('DELETE FROM messages');
        return result.rowCount || 0;
    }

    async function deleteSelectedMessages(ids) {
        const result = await pool.query('DELETE FROM messages WHERE id = ANY($1::bigint[])', [ids]);
        return result.rowCount || 0;
    }

    return {
        initDatabase,
        loadRecentMessages,
        persistMessage,
        deleteMessageById,
        deleteMessagesByClient,
        deleteAllMessages,
        deleteSelectedMessages
    };
}

module.exports = {
    createChatStore
};