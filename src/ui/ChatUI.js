export class ChatUI {
  constructor(network, player) {
    this.network = network;
    this.player = player;

    this.container = document.getElementById('chat-container');
    this.messagesList = document.getElementById('chat-messages');
    this.inputBar = document.getElementById('chat-input-bar');
    this.input = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.toggleBtn = document.getElementById('btn-chat-toggle');

    this.init();
  }

  init() {
    if (this.sendBtn && this.input) {
      this.sendBtn.addEventListener('click', () => this.sendMessage());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.sendMessage();
        } else if (e.key === 'Escape') {
          this.closeInput();
        }
      });
    }

    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleInput();
      });
    }

    // Clicking on messages area on mobile can also open input
    if (this.container) {
      this.container.addEventListener('click', () => {
        if (this.inputBar && this.inputBar.style.display === 'none') {
          this.openInput();
        }
      });
    }

    // Nickname change button in HUD
    const nickBtn = document.getElementById('change-nick-btn');
    if (nickBtn) {
      nickBtn.addEventListener('click', () => {
        const newNick = prompt('Digite seu novo apelido na São Remo:', this.player ? this.player.name : '');
        if (newNick && newNick.trim()) {
          const clean = newNick.trim().slice(0, 16);
          if (this.player) this.player.setName(clean);
          this.network.sendRename(clean);
          const nameEl = document.getElementById('player-name-display');
          if (nameEl) nameEl.textContent = clean;
        }
      });
    }
  }

  openInput() {
    if (this.inputBar) {
      this.inputBar.style.display = 'flex';
      if (this.input) {
        this.input.focus();
      }
    }
  }

  closeInput() {
    if (this.inputBar) {
      this.inputBar.style.display = 'none';
      if (this.input) this.input.blur();
    }
  }

  toggleInput() {
    if (this.inputBar && this.inputBar.style.display !== 'none') {
      this.closeInput();
    } else {
      this.openInput();
    }
  }

  sendMessage() {
    if (!this.input) return;
    const text = this.input.value.trim();
    if (text) {
      this.network.sendChat(text);
      if (this.player) this.player.showSpeech(text);
      this.input.value = '';
    }
    this.closeInput();
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

    // Keep only last 8 messages in discreet log
    while (this.messagesList.children.length > 8) {
      this.messagesList.removeChild(this.messagesList.children[0]);
    }
  }
}
