import * as THREE from 'three';
import { geoData } from './mapData.js';

export class SaoRemoMap {
  constructor(scene) {
    this.scene = scene;

    // Geographic projection center and scale
    this.initProjection();

    // Materials
    this.initMaterials();

    // Build the flat terrain and streets from GeoJSON
    this.streetSegments = [];
    this.buildGround();
    this.buildStreetsFromGeoJSON();
  }

  initProjection() {
    let lats = [];
    let lons = [];

    geoData.features.forEach(f => {
      f.geometry.coordinates.forEach(([lon, lat]) => {
        lons.push(lon);
        lats.push(lat);
      });
    });

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    this.centerLat = (minLat + maxLat) / 2;
    this.centerLon = (minLon + maxLon) / 2;

    this.metersPerLat = 111139;
    this.metersPerLon = 111139 * Math.cos((this.centerLat * Math.PI) / 180);
  }

  project(lon, lat) {
    const x = (lon - this.centerLon) * this.metersPerLon;
    const z = - (lat - this.centerLat) * this.metersPerLat;
    return new THREE.Vector2(x, z);
  }

  initMaterials() {
    this.materials = {
      asphalt: new THREE.MeshLambertMaterial({
        color: 0x242426, // Asfalto escuro contrastante
        side: THREE.DoubleSide
      }),
      sidewalk: new THREE.MeshLambertMaterial({
        color: 0x6e7075, // Guia / calçada cinza clara
        side: THREE.DoubleSide
      }),
      lineYellow: new THREE.MeshBasicMaterial({
        color: 0xffcc00, // Amarelo vibrante
        side: THREE.DoubleSide
      }),
      ground: new THREE.MeshLambertMaterial({
        color: 0x3d4e32 // Chão / vegetação ao redor
      })
    };
  }

  buildGround() {
    // Terreno base plano cobrindo toda a região
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildStreetsFromGeoJSON() {
    const roadGroup = new THREE.Group();
    const linesGroup = new THREE.Group();
    const sidewalkGroup = new THREE.Group();

    geoData.features.forEach(feature => {
      const name = feature.properties.name || 'Rua sem nome';
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      // Largura da rua por tipo
      let streetWidth = 8.0;
      if (name.startsWith('Av.')) {
        streetWidth = 11.0;
      } else if (name.includes('Arrozal') || name.includes('Paineiras') || name.includes('Pires')) {
        streetWidth = 6.4;
      }

      const halfW = streetWidth / 2;
      const curbExtra = 0.8; // Calçada lateral
      const projectedPoints = coords.map(([lon, lat]) => this.project(lon, lat));

      for (let i = 0; i < projectedPoints.length - 1; i++) {
        const p1 = projectedPoints[i];
        const p2 = projectedPoints[i + 1];

        const dx = p2.x - p1.x;
        const dz = p2.y - p1.y;
        const len = Math.hypot(dx, dz);
        if (len < 0.1) continue;

        const ux = dx / len;
        const uz = dz / len;
        const nx = -uz;
        const nz = ux;

        this.streetSegments.push({
          name,
          p1,
          p2,
          streetWidth,
          len
        });

        // 1. Faixa de calçada lateral (cinza claro) embaixo do asfalto para contorno
        const swWidth = halfW + curbExtra;
        const swGeom = new THREE.BufferGeometry();
        const swVertices = new Float32Array([
          p1.x + nx * swWidth, 0.03, p1.y + nz * swWidth,
          p2.x - nx * swWidth, 0.03, p2.y - nz * swWidth,
          p1.x - nx * swWidth, 0.03, p1.y - nz * swWidth,

          p1.x + nx * swWidth, 0.03, p1.y + nz * swWidth,
          p2.x + nx * swWidth, 0.03, p2.y + nz * swWidth,
          p2.x - nx * swWidth, 0.03, p2.y - nz * swWidth,
        ]);
        swGeom.setAttribute('position', new THREE.BufferAttribute(swVertices, 3));
        swGeom.computeVertexNormals();
        const swMesh = new THREE.Mesh(swGeom, this.materials.sidewalk);
        swMesh.receiveShadow = true;
        sidewalkGroup.add(swMesh);

        // 2. Malha de Asfalto (preto escuro) com normais corretas apontadas para cima
        const geom = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          p1.x + nx * halfW, 0.06, p1.y + nz * halfW,
          p2.x - nx * halfW, 0.06, p2.y - nz * halfW,
          p1.x - nx * halfW, 0.06, p1.y - nz * halfW,

          p1.x + nx * halfW, 0.06, p1.y + nz * halfW,
          p2.x + nx * halfW, 0.06, p2.y + nz * halfW,
          p2.x - nx * halfW, 0.06, p2.y - nz * halfW,
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geom.computeVertexNormals();

        const roadMesh = new THREE.Mesh(geom, this.materials.asphalt);
        roadMesh.receiveShadow = true;
        roadGroup.add(roadMesh);

        // Discos nos vértices para curvas e esquinas sem buracos
        const discGeo = new THREE.CircleGeometry(halfW, 20);
        discGeo.rotateX(-Math.PI / 2);

        const disc1 = new THREE.Mesh(discGeo, this.materials.asphalt);
        disc1.position.set(p1.x, 0.065, p1.y);
        disc1.receiveShadow = true;
        roadGroup.add(disc1);

        const disc2 = new THREE.Mesh(discGeo, this.materials.asphalt);
        disc2.position.set(p2.x, 0.065, p2.y);
        disc2.receiveShadow = true;
        roadGroup.add(disc2);

        // Discos de calçada nas pontas
        const swDiscGeo = new THREE.CircleGeometry(swWidth, 20);
        swDiscGeo.rotateX(-Math.PI / 2);
        const swDisc1 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc1.position.set(p1.x, 0.035, p1.y);
        sidewalkGroup.add(swDisc1);

        const swDisc2 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc2.position.set(p2.x, 0.035, p2.y);
        sidewalkGroup.add(swDisc2);

        // 3. Faixas amarelas centrais (seccionadas)
        const dashLen = 3.5;
        const gapLen = 3.0;
        const cycle = dashLen + gapLen;
        const numDashes = Math.floor(len / cycle);
        const angle = Math.atan2(dz, dx);

        for (let d = 0; d < numDashes; d++) {
          const cx = p1.x + ux * (d * cycle + dashLen / 2);
          const cz = p1.y + uz * (d * cycle + dashLen / 2);

          const dashGeo = new THREE.PlaneGeometry(dashLen, 0.32);
          const dashMesh = new THREE.Mesh(dashGeo, this.materials.lineYellow);
          dashMesh.rotation.x = -Math.PI / 2;
          dashMesh.rotation.z = -angle;
          dashMesh.position.set(cx, 0.09, cz);
          linesGroup.add(dashMesh);
        }
      }
    });

    this.scene.add(sidewalkGroup);
    this.scene.add(roadGroup);
    this.scene.add(linesGroup);
  }

  getGroundHeight(x, z) {
    return 0;
  }

  getCurrentStreet(x, z) {
    let closestStreet = 'Comunidade São Remo';
    let minDistance = Infinity;

    for (const seg of this.streetSegments) {
      const dist = this.pointToSegmentDistance(x, z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestStreet = seg.name;
      }
    }

    if (minDistance <= 14.0) {
      return closestStreet;
    }

    return 'Comunidade São Remo';
  }

  pointToSegmentDistance(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return Math.hypot(px - x1, pz - z1);

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;
    return Math.hypot(px - projX, pz - projZ);
  }

  checkCollision(x, z) {
    if (Math.hypot(x, z) > 450) return true;
    return false;
  }
}
