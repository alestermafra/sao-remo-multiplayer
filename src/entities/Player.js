import * as THREE from 'three';
import { sounds } from '../audio.js';

export class Player {
  constructor(scene, isLocal = false, initialData = {}) {
    this.scene = scene;
    this.isLocal = isLocal;
    this.id = initialData.id || null;
    this.name = initialData.name || 'Morador';
    this.color = initialData.avatarColor || '#3388ff';

    // Movement & Physics state
    this.position = new THREE.Vector3(initialData.x || 0, initialData.y || 0, initialData.z || -105);
    this.rotationY = initialData.rotationY || 0;
    this.speed = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.jumpForce = 9.2;
    this.gravity = -24.0;

    this.maxSpeedWalk = 0.16;
    this.maxSpeedRun = 0.28;
    this.turnSpeed = 0.055;
    this.animTime = 0;

    // 3D Groups
    this.group = new THREE.Group();
    this.characterGroup = new THREE.Group();

    this.buildCharacter();
    this.buildNameTag();
    this.buildSpeechBubble();

    this.group.add(this.characterGroup);
    this.scene.add(this.group);

    this.updateTransform();
  }

  buildCharacter() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x8d5524 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: this.color });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1a2b4c });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Torso (Sem bag de entrega, apenas o personagem!)
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.35;
    this.torso.castShadow = true;
    this.characterGroup.add(this.torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 2.05;
    this.head.castShadow = true;
    this.characterGroup.add(this.head);

    // Cap (Boné de lado / Aba reta)
    const capGeo = new THREE.BoxGeometry(0.5, 0.16, 0.5);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 2.3, 0);

    const brimGeo = new THREE.BoxGeometry(0.46, 0.05, 0.35);
    const brim = new THREE.Mesh(brimGeo, capMat);
    brim.position.set(0, 2.24, 0.38);
    this.characterGroup.add(cap, brim);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.9, 0.26);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.2, 0.45, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.2, 0.45, 0);
    this.rightLeg.castShadow = true;

    this.characterGroup.add(this.leftLeg, this.rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-0.46, 1.35, 0);

    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(0.46, 1.35, 0);

    this.characterGroup.add(this.leftArm, this.rightArm);
  }

  buildNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.roundRect ? ctx.roundRect(10, 10, 236, 44, 12) : ctx.fillRect(10, 10, 236, 44);
    ctx.fill();

    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = this.isLocal ? '#44ff88' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.nameSprite = new THREE.Sprite(spriteMat);
    this.nameSprite.position.y = 2.8;
    this.nameSprite.scale.set(2.4, 0.6, 1);
    this.group.add(this.nameSprite);
  }

  buildSpeechBubble() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    this.speechCanvas = canvas;
    this.speechCtx = canvas.getContext('2d');
    this.speechTexture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: this.speechTexture, transparent: true });
    this.speechSprite = new THREE.Sprite(spriteMat);
    this.speechSprite.position.y = 3.6;
    this.speechSprite.scale.set(4.2, 1.05, 1);
    this.speechSprite.visible = false;
    this.group.add(this.speechSprite);
    this.speechTimer = null;
  }

  showSpeech(text) {
    if (!text) return;
    const ctx = this.speechCtx;
    ctx.clearRect(0, 0, 512, 128);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(12, 12, 488, 86, 18) : ctx.fillRect(12, 12, 488, 86);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(240, 98);
    ctx.lineTo(256, 118);
    ctx.lineTo(272, 98);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    const display = text.length > 32 ? text.slice(0, 30) + '...' : text;
    ctx.fillText(`"${display}"`, 256, 60);

    this.speechTexture.needsUpdate = true;
    this.speechSprite.visible = true;

    if (this.speechTimer) clearTimeout(this.speechTimer);
    this.speechTimer = setTimeout(() => {
      this.speechSprite.visible = false;
    }, 6000);
  }

  jump() {
    if (this.isGrounded) {
      this.velocityY = this.jumpForce;
      this.isGrounded = false;
      sounds.playJump();
    }
  }

  setName(newName) {
    this.name = newName;
    const canvas = this.nameSprite.material.map.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, 10, 236, 44);
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = this.isLocal ? '#44ff88' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 40);
    this.nameSprite.material.map.needsUpdate = true;
  }

  updateTransform() {
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
  }

  animateMovement(delta, isMoving) {
    if (!this.isGrounded) {
      // Jumping pose: legs tucked slightly up
      this.leftLeg.rotation.x = 0.35;
      this.rightLeg.rotation.x = -0.2;
      this.leftArm.rotation.x = -0.5;
      this.rightArm.rotation.x = -0.5;
      return;
    }

    if (isMoving) {
      this.animTime += delta * 12;
      const swing = Math.sin(this.animTime) * 0.6;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
