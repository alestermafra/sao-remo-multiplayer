import * as THREE from 'three';
import { sounds } from '../audio.js';

export class DeliverySystem {
  constructor(scene, network) {
    this.scene = scene;
    this.network = network;
    this.currentMission = null;
    this.stage = 'idle'; // 'idle' | 'pickup' | 'drop'

    // Visual Beacon Marker
    this.beaconGroup = new THREE.Group();
    this.buildBeacon();
    this.scene.add(this.beaconGroup);
    this.beaconGroup.visible = false;
  }

  buildBeacon() {
    // Vertical beam of light
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 16, 16);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.position.y = 8;

    // Glowing base ring
    const ringGeo = new THREE.RingGeometry(1.5, 2.2, 24);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.ring = new THREE.Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;

    // Floating diamond indicator
    const diamondGeo = new THREE.OctahedronGeometry(0.8);
    this.diamond = new THREE.Mesh(diamondGeo, this.ringMat);
    this.diamond.position.y = 2.8;

    this.beaconGroup.add(beam, this.ring, this.diamond);
  }

  setMissions(missions, playerPos) {
    if (!missions || missions.length === 0) return;
    // If not in a mission, pick the closest available one
    if (this.stage === 'idle') {
      let closest = null;
      let minDist = Infinity;
      missions.forEach(m => {
        const d = playerPos.distanceTo(new THREE.Vector3(m.pickup.x, m.pickup.y, m.pickup.z));
        if (d < minDist) {
          minDist = d;
          closest = m;
        }
      });

      if (closest) {
        this.currentMission = closest;
        this.stage = 'pickup';
        this.updateBeaconTarget(closest.pickup, 0xffaa00); // Yellow/Orange for pickup
      }
    }
  }

  updateBeaconTarget(point, colorHex) {
    this.beaconGroup.position.set(point.x, point.y || 0, point.z);
    this.beamMat.color.setHex(colorHex);
    this.ringMat.color.setHex(colorHex);
    this.beaconGroup.visible = true;
  }

  update(player, delta) {
    if (!this.currentMission || this.stage === 'idle') return;

    // Animate beacon
    this.ring.rotation.z += delta * 1.5;
    this.diamond.rotation.y += delta * 2;
    this.diamond.position.y = 2.8 + Math.sin(Date.now() * 0.004) * 0.3;

    const targetPos = (this.stage === 'pickup') 
      ? new THREE.Vector3(this.currentMission.pickup.x, this.currentMission.pickup.y, this.currentMission.pickup.z)
      : new THREE.Vector3(this.currentMission.drop.x, this.currentMission.drop.y, this.currentMission.drop.z);

    const dist = player.position.distanceTo(targetPos);

    // Distance HUD update
    const hudDist = document.getElementById('delivery-distance');
    const hudItem = document.getElementById('delivery-item');
    const hudDest = document.getElementById('delivery-dest');
    if (hudDist) hudDist.textContent = `${Math.round(dist)}m`;
    if (hudItem) hudItem.textContent = this.currentMission.item;
    if (hudDest) {
      hudDest.textContent = (this.stage === 'pickup') 
        ? `Coleta: ${this.currentMission.pickup.name}`
        : `Entrega: ${this.currentMission.drop.name}`;
    }

    // Trigger check
    if (dist < 3.2) {
      if (this.stage === 'pickup') {
        this.stage = 'drop';
        sounds.playBikeBell();
        this.updateBeaconTarget(this.currentMission.drop, 0x00ff88); // Green for delivery drop
        this.showToast(`📦 Pacote coletado: ${this.currentMission.item}! Leve para: ${this.currentMission.drop.name}`);
      } else if (this.stage === 'drop') {
        sounds.playDeliverySuccess();
        this.showToast(`🎉 Entrega concluída! +R$ ${this.currentMission.reward}`);
        this.network.socket.emit('complete_delivery', this.currentMission.id);
        this.stage = 'idle';
        this.currentMission = null;
        this.beaconGroup.visible = false;
        if (hudDest) hudDest.textContent = 'Procurando novo pedido...';
      }
    }
  }

  showToast(msg) {
    const toast = document.getElementById('game-toast');
    if (toast) {
      toast.textContent = msg;
      toast.style.opacity = '1';
      toast.style.transform = 'translate(-50%, 0)';
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -20px)';
      }, 4000);
    }
  }
}

