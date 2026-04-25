function registerSocketHandlers(io, { store, refreshHistoryForAllClients }) {
    io.on('connection', (socket) => {
        socket.on('join', async (name) => {
            socket.data.name = name;
            socket.data.joinMessageId = null;
            console.log(`${name} joined the chat`);

            try {
                const history = await store.loadRecentMessages();
                socket.emit('history', history);
            } catch (error) {
                console.error('Failed to load message history:', error);
                socket.emit('history', []);
            }

            try {
                const joinEvent = await store.persistMessage({
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
                const savedMessage = await store.persistMessage(message);
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
                        await store.deleteMessageById(socket.data.joinMessageId);
                        await refreshHistoryForAllClients();
                    } catch (error) {
                        console.error('Failed to cancel persisted join event on disconnect:', error);
                    }
                }

                io.emit('message', { user: null, message: `${socket.data.name} has left the chat`, type: 'leave' });
            }
        });
    });
}

module.exports = {
    registerSocketHandlers
};