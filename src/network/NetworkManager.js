import { io } from 'socket.io-client';
import { Player } from '../entities/Player.js';

export class NetworkManager {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.selfId = null;
    this.remotePlayers = new Map();
    this.onChatMessage = null;
  }

  connect() {
    // Na rede local (porta 3000 do Vite), conecta direto no servidor Node (porta 3001)
    // Se estiver rodando o build de produção ou porta unificada, conecta na mesma origem
    const socketUrl = (window.location.port === '3000')
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : undefined;

    this.socket = io(socketUrl, {
      reconnectionAttempts: 10,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log(' Conectado à São Remo:', this.socket.id);
      this.selfId = this.socket.id;
    });

    this.socket.on('init', (data) => {
      this.selfId = data.selfId;
      data.players.forEach(pData => {
        if (pData.id !== this.selfId && !this.remotePlayers.has(pData.id)) {
          const remotePlayer = new Player(this.scene, false, pData);
          this.remotePlayers.set(pData.id, remotePlayer);
        }
      });
    });

    this.socket.on('player_joined', (pData) => {
      if (pData.id !== this.selfId && !this.remotePlayers.has(pData.id)) {
        const remotePlayer = new Player(this.scene, false, pData);
        this.remotePlayers.set(pData.id, remotePlayer);
      }
    });

    this.socket.on('player_moved', (data) => {
      const p = this.remotePlayers.get(data.id);
      if (p) {
        p.position.set(data.x, data.y, data.z);
        p.rotationY = data.rotationY;
        p.speed = data.speed;
        p.isGrounded = data.isGrounded !== undefined ? data.isGrounded : true;
        p.updateTransform();
        p.animateMovement(0.016, Math.abs(data.speed) > 0.02);
      }
    });

    this.socket.on('player_renamed', (data) => {
      const p = this.remotePlayers.get(data.id);
      if (p) p.setName(data.name);
    });

    this.socket.on('chat_broadcast', (msg) => {
      if (this.onChatMessage) {
        this.onChatMessage(msg);
      }
      if (msg.id === this.selfId && window.localPlayer) {
        window.localPlayer.showSpeech(msg.text);
      } else {
        const p = this.remotePlayers.get(msg.id);
        if (p) p.showSpeech(msg.text);
      }
    });

    this.socket.on('player_left', (id) => {
      const p = this.remotePlayers.get(id);
      if (p) {
        p.destroy();
        this.remotePlayers.delete(id);
      }
    });
  }

  sendUpdate(player) {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('player_update', {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      rotationY: player.rotationY,
      speed: player.speed,
      isGrounded: player.isGrounded
    });
  }

  sendChat(text) {
    if (this.socket) {
      this.socket.emit('chat_message', text);
    }
  }

  sendRename(newName) {
    if (this.socket) {
      this.socket.emit('change_name', newName);
    }
  }
}
