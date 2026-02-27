const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

http.listen(3000, '0.0.0.0', () => {
    console.log('Chat server running on port 3000');
});

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        socket.data.name = name;
        console.log(`${name} joined the chat`);
        io.emit('message', { user: null, message: `${name} has joined the chat` });
    });

    socket.on('message', (data) => {
        if (data.message.length > 200) {
            data.message = data.message.substring(0, 200) + '...';
        }
        console.log(`${data.user}: ${data.message}`);
        io.emit('message', { user: data.user, message: data.message });
    });

    socket.on('disconnect', () => {
        if (socket.data.name) {
            console.log(`${socket.data.name} left the chat`);
            io.emit('message', { user: null, message: `${socket.data.name} has left the chat` });
        }
    });

});

