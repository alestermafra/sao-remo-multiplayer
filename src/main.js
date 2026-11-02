import * as THREE from 'three';
import { SaoRemoMap } from './map/SaoRemoMap.js';
import { Player } from './entities/Player.js';
import { NetworkManager } from './network/NetworkManager.js';
import { InputManager } from './ui/TouchControls.js';
import { ChatUI } from './ui/ChatUI.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.initScene();
    this.initLights();

    // Map: Ruas da São Remo geradas do mapa.geojson
    this.map = new SaoRemoMap(this.scene);

    // Spawn do jogador no coração da Favela São Remo (Rua Grande Arrozal / miolo dos barracos)
    const spawnX = 15.0;
    const spawnZ = -28.0;

    // Network & Local Player
    this.network = new NetworkManager(this.scene);
    this.player = new Player(this.scene, true, {
      name: 'Morador',
      x: spawnX,
      y: 0,
      z: spawnZ
    });
    window.localPlayer = this.player;

    // Controls & Chat
    this.input = new InputManager();
    this.chatUI = new ChatUI(this.network, this.player);

    this.bindEvents();
    this.setupNetworkCallbacks();
    this.network.connect();

    this.clock = new THREE.Clock();
    this.lastNetworkTick = 0;

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Céu azul
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(15.0, 4, -20.0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffaed, 1.25);
    sun.position.set(60, 150, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -300;
    sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300;
    sun.shadow.camera.bottom = -300;
    this.scene.add(sun);
  }

  bindEvents() {
    // Modal inicial: pedir nome antes de começar a se mexer
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const nameInput = document.getElementById('login-name-input');
    const nameDisplay = document.getElementById('player-name-display');

    if (loginForm && loginModal && nameInput) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const chosenName = nameInput.value.trim().slice(0, 16);
        if (chosenName) {
          this.player.setName(chosenName);
          if (nameDisplay) nameDisplay.textContent = chosenName;
          this.network.sendRename(chosenName);

          // Ativa tela inteira no celular
          this.requestFullscreen();

          // Libera os controles e fecha o modal
          this.input.enabled = true;
          loginModal.style.display = 'none';

          // Mensagem de boas-vindas no chat
          this.player.showSpeech(`Salve! Cheguei na São Remo.`);
        }
      });
    }

    // Botão de alternar Tela Cheia no HUD
    const fullscreenBtn = document.getElementById('btn-fullscreen-toggle');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // Jump trigger (Space or Mobile Button)
    this.input.onJump = () => {
      this.player.jump();
    };

    // Chat open
    this.input.onChatOpen = () => {
      this.chatUI.openInput();
    };
  }

  setupNetworkCallbacks() {
    this.network.onChatMessage = (msg) => {
      this.chatUI.addMessage(msg);
    };
  }

  requestFullscreen() {
    const doc = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (doc.requestFullscreen) {
        doc.requestFullscreen().catch(() => {});
      } else if (doc.webkitRequestFullscreen) {
        doc.webkitRequestFullscreen();
      }
    }
    // Tenta travar orientação na horizontal no celular
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      this.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  updatePhysics(delta) {
    const p = this.player;

    // Walk / Sprint speed
    const maxSpeed = this.input.isSprinting ? p.maxSpeedRun : p.maxSpeedWalk;
    const accel = 2.2;
    const friction = 0.86;

    // Steering / Turning
    if (this.input.turn !== 0) {
      p.rotationY += this.input.turn * p.turnSpeed;
    }

    // Forward / Backward movement
    if (this.input.forward !== 0) {
      p.speed += this.input.forward * accel * delta;
      p.speed = THREE.MathUtils.clamp(p.speed, -maxSpeed * 0.6, maxSpeed);
    } else {
      p.speed *= friction;
      if (Math.abs(p.speed) < 0.005) p.speed = 0;
    }

    // Horizontal Proposed Movement
    const moveX = Math.sin(p.rotationY) * p.speed;
    const moveZ = Math.cos(p.rotationY) * p.speed;

    const nextX = p.position.x + moveX;
    const nextZ = p.position.z + moveZ;

    // Check street boundary collision (stays within Rua Baltazar Rabelo)
    if (!this.map.checkCollision(nextX, nextZ)) {
      p.position.x = nextX;
      p.position.z = nextZ;
    } else {
      p.speed = 0;
    }

    // Vertical Physics: Gravity & Jumping on the ladeira slope
    const groundY = this.map.getGroundHeight(p.position.x, p.position.z);

    if (!p.isGrounded) {
      p.velocityY += p.gravity * delta;
      p.position.y += p.velocityY * delta;

      if (p.position.y <= groundY) {
        p.position.y = groundY;
        p.velocityY = 0;
        p.isGrounded = true;
      }
    } else {
      // Follow the slope smoothly while walking on ground
      p.position.y = THREE.MathUtils.lerp(p.position.y, groundY, 0.4);
    }

    p.updateTransform();
    p.animateMovement(delta, Math.abs(p.speed) > 0.01);

    // Update Current Street Name HUD
    this.updateStreetIndicator();

    // Update Discreet Coordinates Badge
    const coordsEl = document.getElementById('coords-display');
    if (coordsEl) {
      coordsEl.textContent = `X: ${p.position.x.toFixed(1)} | Z: ${p.position.z.toFixed(1)}`;
    }
  }

  updateStreetIndicator() {
    const currentStreet = this.map.getCurrentStreet(this.player.position.x, this.player.position.z);
    const tagEl = document.getElementById('street-tag-display');
    const newText = `📍 ${currentStreet.toUpperCase()}`;
    if (tagEl && tagEl.textContent.trim() !== newText) {
      tagEl.textContent = newText;
    }
  }

  updateCamera() {
    const p = this.player;
    // Third-person camera following behind the character
    const camDistance = 5.5;
    const camHeight = 3.2;

    const targetCamX = p.position.x - Math.sin(p.rotationY) * camDistance;
    const targetCamZ = p.position.z - Math.cos(p.rotationY) * camDistance;
    const targetCamY = p.position.y + camHeight;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.12);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.12);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 0.12);

    const lookTarget = new THREE.Vector3(p.position.x, p.position.y + 1.6, p.position.z);
    this.camera.lookAt(lookTarget);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.updatePhysics(delta);
    this.updateCamera();

    // Network position sync (20 ticks per second)
    const now = performance.now();
    if (now - this.lastNetworkTick > 50) {
      this.network.sendUpdate(this.player);
      this.lastNetworkTick = now;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
