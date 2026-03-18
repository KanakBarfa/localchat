const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs/promises');

const PORT = Number(process.env.PORT || 3000);
const MESSAGE_STORE_PATH = process.env.MESSAGE_STORE_PATH || path.join(__dirname, 'data', 'messages.json');
const MAX_PERSISTED_MESSAGES = Number(process.env.MAX_PERSISTED_MESSAGES || 500);

let persistedMessages = [];
let writeQueue = Promise.resolve();

async function ensureStoreReady() {
    const storeDir = path.dirname(MESSAGE_STORE_PATH);
    await fs.mkdir(storeDir, { recursive: true });
    try {
        const raw = await fs.readFile(MESSAGE_STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            persistedMessages = parsed;
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(MESSAGE_STORE_PATH, '[]\n', 'utf8');
            return;
        }
        console.error('Failed to initialize message store:', error);
    }
}

function queueStoreWrite() {
    writeQueue = writeQueue
        .then(() => fs.writeFile(MESSAGE_STORE_PATH, JSON.stringify(persistedMessages, null, 2) + '\n', 'utf8'))
        .catch((error) => {
            console.error('Failed to persist messages:', error);
        });

    return writeQueue;
}

function persistMessage(message) {
    persistedMessages.push({
        user: message.user,
        message: message.message,
        timestamp: new Date().toISOString()
    });

    if (persistedMessages.length > MAX_PERSISTED_MESSAGES) {
        persistedMessages = persistedMessages.slice(-MAX_PERSISTED_MESSAGES);
    }

    return queueStoreWrite();
}

app.use(express.static(path.join(__dirname, 'public')));

ensureStoreReady().then(() => {
    http.listen(PORT, '0.0.0.0', () => {
        console.log(`Chat server running on port ${PORT}`);
        console.log(`Message store: ${MESSAGE_STORE_PATH}`);
    });
});

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        socket.data.name = name;
        console.log(`${name} joined the chat`);
        socket.emit('history', persistedMessages);
        io.emit('message', { user: null, message: `${name} has joined the chat` });
    });

    socket.on('message', (data) => {
        if (data.message.length > 200) {
            data.message = data.message.substring(0, 200) + '...';
        }
        console.log(`${data.user}: ${data.message}`);
        const message = { user: data.user, message: data.message };
        persistMessage(message);
        io.emit('message', message);
    });

    socket.on('disconnect', () => {
        if (socket.data.name) {
            console.log(`${socket.data.name} left the chat`);
            io.emit('message', { user: null, message: `${socket.data.name} has left the chat` });
        }
    });

});

