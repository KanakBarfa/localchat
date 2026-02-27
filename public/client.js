const socket = io();

const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const form = document.getElementById('chat-form');
const input = document.getElementById('m');
const messages = document.getElementById('messages');

let username = '';

joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        username = name;
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        socket.emit('join', username);
    }
});

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinBtn.click();
    }
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        socket.emit('message', { user: username, message: input.value });
        input.value = '';
    }
});

socket.on('message', (data) => {
    const item = document.createElement('li');
    const strong = document.createElement('strong');

    strong.textContent = data.user + ':';

    if (data.user === null) {
        item.appendChild(document.createTextNode(data.message));
        item.style.fontStyle = 'italic';
        item.style.color = 'gray';
        item.style.background = 'transparent';
    }
    else {
        item.appendChild(strong);
        item.appendChild(document.createTextNode(' ' + data.message));
    }

    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});