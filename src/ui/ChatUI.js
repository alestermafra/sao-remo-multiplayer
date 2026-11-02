export class ChatUI {
  constructor(network, player) {
    this.network = network;
    this.player = player;

    this.container = document.getElementById('chat-container');
    this.messagesList = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.toggleBtn = document.getElementById('btn-chat-toggle');
    this.quickChips = document.querySelectorAll('.chat-chip');

    this.init();
  }

  init() {
    if (this.sendBtn && this.input) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage();
        }
      });
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        this.container.classList.toggle('minimized');
        if (!this.container.classList.contains('minimized')) {
          this.input.focus();
        }
      });
    }

    this.quickChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-msg');
        if (text) {
          this.network.sendChat(text);
          if (this.player) this.player.showSpeech(text);
        }
      });
    });

    // Nickname change button
    const nickBtn = document.getElementById('change-nick-btn');
    if (nickBtn) {
      nickBtn.addEventListener('click', () => {
        const newNick = prompt('Digite seu novo apelido na São Remo:', this.player ? this.player.name : '');
        if (newNick && newNick.trim()) {
          const clean = newNick.trim().slice(0, 15);
          if (this.player) this.player.setName(clean);
          this.network.socket.emit('change_name', clean);
          const nameEl = document.getElementById('player-name-display');
          if (nameEl) nameEl.textContent = clean;
        }
      });
    }
  }

  sendMessage() {
    if (!this.input) return;
    const text = this.input.value.trim();
    if (text) {
      this.network.sendChat(text);
      if (this.player) this.player.showSpeech(text);
      this.input.value = '';
      this.input.blur();
    }
  }

  addMessage(msg) {
    if (!this.messagesList) return;
    const item = document.createElement('div');
    item.className = 'chat-item';
    
    if (msg.id === 'system') {
      item.classList.add('system');
      item.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`;
    } else {
      item.innerHTML = `<span class="nick">${msg.name}:</span> <span class="text">${msg.text}</span>`;
    }

    this.messagesList.appendChild(item);
    this.messagesList.scrollTop = this.messagesList.scrollHeight;

    // Remove oldest if more than 30
    if (this.messagesList.children.length > 30) {
      this.messagesList.removeChild(this.messagesList.children[0]);
    }
  }
}

