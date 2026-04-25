function createRequireAdminAuth(adminPassword) {
    return function requireAdminAuth(req, res, next) {
        if (!adminPassword) {
            return res.status(503).json({ error: 'Admin page is disabled: ADMIN_PASSWORD is not configured.' });
        }

        const headerPassword = req.get('x-admin-password');
        if (headerPassword && headerPassword === adminPassword) {
            return next();
        }

        const authorization = req.get('authorization');
        if (!authorization || !authorization.startsWith('Basic ')) {
            res.set('WWW-Authenticate', 'Basic realm="localchat-admin"');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
        const separatorIndex = decoded.indexOf(':');
        const providedPassword = separatorIndex === -1 ? '' : decoded.slice(separatorIndex + 1);

        if (providedPassword !== adminPassword) {
            res.set('WWW-Authenticate', 'Basic realm="localchat-admin"');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        return next();
    };
}

function registerApiRoutes(app, { store, requireAdminAuth, refreshHistoryForAllClients, maxPersistedMessages }) {
    app.get('/api/admin/messages', requireAdminAuth, async (req, res) => {
        const limit = Math.max(1, Math.min(Number(req.query.limit) || maxPersistedMessages, 5000));

        try {
            const history = await store.loadRecentMessages(limit);
            return res.json({ messages: history });
        } catch (error) {
            console.error('Failed to load admin message list:', error);
            return res.status(500).json({ error: 'Failed to load messages' });
        }
    });

    app.delete('/api/admin/messages/all', requireAdminAuth, async (_req, res) => {
        try {
            const deletedCount = await store.deleteAllMessages();
            await refreshHistoryForAllClients();
            return res.json({ deletedCount });
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
            const deletedCount = await store.deleteMessagesByClient(clientName);
            await refreshHistoryForAllClients();
            return res.json({ deletedCount });
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
            const deletedCount = await store.deleteSelectedMessages(ids);
            await refreshHistoryForAllClients();
            return res.json({ deletedCount });
        } catch (error) {
            console.error('Failed to delete selected messages:', error);
            return res.status(500).json({ error: 'Failed to delete selected messages' });
        }
    });
}

module.exports = {
    createRequireAdminAuth,
    registerApiRoutes
};