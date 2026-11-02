import * as THREE from 'three';
import { geoData } from './mapData.js';
import { buildingsData } from './buildingsData.js';

export class SaoRemoMap {
  constructor(scene) {
    this.scene = scene;

    // Geographic projection center and scale (calibrated from mapData + buildings)
    this.initProjection();

    // Materials
    this.initMaterials();

    // Map structures
    this.streetSegments = [];
    this.solidColliders = [];
    this.barracoColliders = [];
    this.barracoGrid = new Map();

    this.buildGround();
    this.buildStreetsFromGeoJSON();
    this.buildBuildingsFromGeoJSON();
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
        color: 0x242426,
        side: THREE.DoubleSide
      }),
      sidewalk: new THREE.MeshLambertMaterial({
        color: 0xb5b8be, // Concreto de calçada claro e bem nítido
        side: THREE.DoubleSide
      }),
      curb: new THREE.MeshLambertMaterial({
        color: 0xe2e4e8, // Guia de meio-fio em pedra clara
        side: THREE.DoubleSide
      }),
      lineYellow: new THREE.MeshBasicMaterial({
        color: 0xffcc00,
        side: THREE.DoubleSide
      }),
      lineWhite: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
      }),
      ground: new THREE.MeshLambertMaterial({
        color: 0x3d4e32
      }),
      // Buildings & Areas
      roldaoWall: new THREE.MeshLambertMaterial({
        color: 0x1e3f73 // Azul característico do Roldão
      }),
      roldaoRoof: new THREE.MeshLambertMaterial({
        color: 0x4a4d52,
        side: THREE.DoubleSide
      }),
      parkingAsphalt: new THREE.MeshLambertMaterial({
        color: 0x2c2d30,
        side: THREE.DoubleSide
      }),
      dirtField: new THREE.MeshLambertMaterial({
        color: 0xa86036, // Terra batida avermelhada
        side: THREE.DoubleSide
      }),
      greenCourt: new THREE.MeshLambertMaterial({
        color: 0x2e7d32, // Quadra verde
        side: THREE.DoubleSide
      }),
      blueCourt: new THREE.MeshLambertMaterial({
        color: 0x1565c0, // Quadra azul
        side: THREE.DoubleSide
      }),
      circusGround: new THREE.MeshLambertMaterial({
        color: 0x485a3a,
        side: THREE.DoubleSide
      }),
      circusWall: new THREE.MeshLambertMaterial({
        color: 0xd32f2f // Lona vermelha com detalhes
      }),
      circusRoof: new THREE.MeshLambertMaterial({
        color: 0xfbc02d, // Amarelo clássico de circo
        side: THREE.DoubleSide
      }),
      circusWhite: new THREE.MeshLambertMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
      }),
      metalGoal: new THREE.MeshLambertMaterial({
        color: 0xeeeeee
      }),
      // Materiais dos Barracos da São Remo
      brickWall: new THREE.MeshLambertMaterial({ color: 0xba5136 }),
      yellowWall: new THREE.MeshLambertMaterial({ color: 0xd9ae52 }),
      blueWall: new THREE.MeshLambertMaterial({ color: 0x4a7599 }),
      greenWall: new THREE.MeshLambertMaterial({ color: 0x4d7e57 }),
      pinkWall: new THREE.MeshLambertMaterial({ color: 0xb5606d }),
      whiteWall: new THREE.MeshLambertMaterial({ color: 0xd4cfc7 }),
      slabConcrete: new THREE.MeshLambertMaterial({ color: 0x85888c }),
      waterTankBlue: new THREE.MeshLambertMaterial({ color: 0x0d47a1, roughness: 0.3 }),
      barracoGround: new THREE.MeshLambertMaterial({ color: 0x52504b, side: THREE.DoubleSide })
    };
  }

  buildGround() {
    const groundGeo = new THREE.PlaneGeometry(1200, 1200);
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildStreetsFromGeoJSON() {
    const roadGroup = new THREE.Group();
    const curbGroup = new THREE.Group();
    const sidewalkGroup = new THREE.Group();

    geoData.features.forEach(feature => {
      const name = feature.properties.name || 'Rua sem nome';
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      let streetWidth = 8.0;
      let sidewalkWidth = 1.8;
      if (name.startsWith('Av.')) {
        streetWidth = 11.0;
        sidewalkWidth = 2.2;
      } else if (name.includes('Arrozal') || name.includes('Paineiras') || name.includes('Pires')) {
        streetWidth = 6.4;
        sidewalkWidth = 1.4;
      }

      const halfW = streetWidth / 2;
      const swWidth = halfW + sidewalkWidth;
      const curbWidth = halfW + 0.25;
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
          sidewalkWidth,
          len
        });

        // 1. Calçada (concreto claro ao redor da rua inteira)
        const swGeom = new THREE.BufferGeometry();
        const swVertices = new Float32Array([
          p1.x + nx * swWidth, 0.04, p1.y + nz * swWidth,
          p2.x - nx * swWidth, 0.04, p2.y - nz * swWidth,
          p1.x - nx * swWidth, 0.04, p1.y - nz * swWidth,

          p1.x + nx * swWidth, 0.04, p1.y + nz * swWidth,
          p2.x + nx * swWidth, 0.04, p2.y + nz * swWidth,
          p2.x - nx * swWidth, 0.04, p2.y - nz * swWidth,
        ]);
        swGeom.setAttribute('position', new THREE.BufferAttribute(swVertices, 3));
        swGeom.computeVertexNormals();
        const swMesh = new THREE.Mesh(swGeom, this.materials.sidewalk);
        swMesh.receiveShadow = true;
        sidewalkGroup.add(swMesh);

        // 2. Guia de meio-fio (pedra clara entre pista e calçada)
        const curbGeom = new THREE.BufferGeometry();
        const curbVertices = new Float32Array([
          p1.x + nx * curbWidth, 0.05, p1.y + nz * curbWidth,
          p2.x - nx * curbWidth, 0.05, p2.y - nz * curbWidth,
          p1.x - nx * curbWidth, 0.05, p1.y - nz * curbWidth,

          p1.x + nx * curbWidth, 0.05, p1.y + nz * curbWidth,
          p2.x + nx * curbWidth, 0.05, p2.y + nz * curbWidth,
          p2.x - nx * curbWidth, 0.05, p2.y - nz * curbWidth,
        ]);
        curbGeom.setAttribute('position', new THREE.BufferAttribute(curbVertices, 3));
        curbGeom.computeVertexNormals();
        const curbMesh = new THREE.Mesh(curbGeom, this.materials.curb);
        curbMesh.receiveShadow = true;
        curbGroup.add(curbMesh);

        // 3. Pista de asfalto
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

        // Discos nos vértices da calçada
        const swDiscGeo = new THREE.CircleGeometry(swWidth, 24);
        swDiscGeo.rotateX(-Math.PI / 2);
        const swDisc1 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc1.position.set(p1.x, 0.042, p1.y);
        swDisc1.receiveShadow = true;
        sidewalkGroup.add(swDisc1);

        const swDisc2 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc2.position.set(p2.x, 0.042, p2.y);
        swDisc2.receiveShadow = true;
        sidewalkGroup.add(swDisc2);

        // Discos nos vértices do meio-fio
        const curbDiscGeo = new THREE.CircleGeometry(curbWidth, 24);
        curbDiscGeo.rotateX(-Math.PI / 2);
        const curbDisc1 = new THREE.Mesh(curbDiscGeo, this.materials.curb);
        curbDisc1.position.set(p1.x, 0.052, p1.y);
        curbGroup.add(curbDisc1);

        const curbDisc2 = new THREE.Mesh(curbDiscGeo, this.materials.curb);
        curbDisc2.position.set(p2.x, 0.052, p2.y);
        curbGroup.add(curbDisc2);

        // Discos nos vértices do asfalto
        const discGeo = new THREE.CircleGeometry(halfW, 24);
        discGeo.rotateX(-Math.PI / 2);
        const disc1 = new THREE.Mesh(discGeo, this.materials.asphalt);
        disc1.position.set(p1.x, 0.065, p1.y);
        disc1.receiveShadow = true;
        roadGroup.add(disc1);

        const disc2 = new THREE.Mesh(discGeo, this.materials.asphalt);
        disc2.position.set(p2.x, 0.065, p2.y);
        disc2.receiveShadow = true;
        roadGroup.add(disc2);
      }
    });

    this.scene.add(sidewalkGroup);
    this.scene.add(curbGroup);
    this.scene.add(roadGroup);
  }

  buildBuildingsFromGeoJSON() {
    const barracoPolygons = [];
    const landmarkPolygons = [];

    buildingsData.features.forEach(feature => {
      const name = feature.properties.name || '';
      const ring = feature.geometry.coordinates[0];
      if (!ring || ring.length < 3) return;

      const pts = ring.map(([lon, lat]) => this.project(lon, lat));

      // Calculate centroid
      let cX = 0, cZ = 0;
      pts.forEach(p => { cX += p.x; cZ += p.y; });
      cX /= pts.length;
      cZ /= pts.length;

      // 1. ROLDÃO ATACADISTA
      if (name.includes('Roldão Atacadista') && !name.includes('Estacionamento')) {
        const shape = this.createShapeFromPoints(pts);
        const extrudeSettings = { depth: 8.5, bevelEnabled: false };
        const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geom.rotateX(-Math.PI / 2);

        const buildingMesh = new THREE.Mesh(geom, this.materials.roldaoWall);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        this.scene.add(buildingMesh);

        // Register solid collider
        this.solidColliders.push(pts);
        landmarkPolygons.push(pts);

        // Billboard Letreiro do Roldão na fachada voltada para a rua
        this.buildRoldaoSign(cX, 9.5, cZ);
      }

      // 2. ESTACIONAMENTO DO ROLDÃO
      else if (name.includes('Estacionamento')) {
        const shape = this.createShapeFromPoints(pts);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);

        const parkingMesh = new THREE.Mesh(geom, this.materials.parkingAsphalt);
        parkingMesh.position.y = 0.02;
        parkingMesh.receiveShadow = true;
        this.scene.add(parkingMesh);

        landmarkPolygons.push(pts);
        this.buildParkingStrips(pts);
      }

      // 3. CIRCO ESCOLA (Lona de circo circular)
      else if (name.includes('Circo Escola')) {
        // Calculate radius from points to center
        let radius = 0;
        pts.forEach(p => { radius += Math.hypot(p.x - cX, p.y - cZ); });
        radius /= pts.length;
        if (radius < 5) radius = 13.5;

        const circusGroup = new THREE.Group();

        // Paredes cilíndricas do circo
        const wallGeo = new THREE.CylinderGeometry(radius, radius, 4.2, 32);
        const wallMesh = new THREE.Mesh(wallGeo, this.materials.circusWall);
        wallMesh.position.y = 2.1;
        wallMesh.castShadow = true;
        circusGroup.add(wallMesh);

        // Cúpula cônica da lona do circo
        const roofGeo = new THREE.ConeGeometry(radius + 1.2, 7.5, 32);
        const roofMesh = new THREE.Mesh(roofGeo, this.materials.circusRoof);
        roofMesh.position.y = 7.95;
        roofMesh.castShadow = true;
        circusGroup.add(roofMesh);

        // Mastro central com bandeira no topo
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.5, 8);
        const poleMesh = new THREE.Mesh(poleGeo, this.materials.metalGoal);
        poleMesh.position.y = 12.8;
        circusGroup.add(poleMesh);

        const flagGeo = new THREE.PlaneGeometry(1.4, 0.8);
        const flagMat = new THREE.MeshBasicMaterial({ color: 0x00e676, side: THREE.DoubleSide });
        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        flagMesh.position.set(0.7, 13.8, 0);
        circusGroup.add(flagMesh);

        circusGroup.position.set(cX, 0, cZ);
        this.scene.add(circusGroup);

        // Collider sólido circular
        this.solidColliders.push(pts);
        landmarkPolygons.push(pts);
      }

      // 4. CAMPO DE FUTEBOL DE TERRA
      else if (name.includes('Campo de Futebol')) {
        const shape = this.createShapeFromPoints(pts);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);

        const fieldMesh = new THREE.Mesh(geom, this.materials.dirtField);
        fieldMesh.position.y = 0.02;
        fieldMesh.receiveShadow = true;
        this.scene.add(fieldMesh);

        landmarkPolygons.push(pts);
        this.buildSoccerFieldAccents(pts, cX, cZ, true);
      }

      // 5. QUADRAS DE FUTEBOL
      else if (name.includes('Quadra de Futebol')) {
        const shape = this.createShapeFromPoints(pts);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);

        const isCirco = name.includes('Circo');
        const courtMesh = new THREE.Mesh(geom, isCirco ? this.materials.blueCourt : this.materials.greenCourt);
        courtMesh.position.y = 0.025;
        courtMesh.receiveShadow = true;
        this.scene.add(courtMesh);

        landmarkPolygons.push(pts);
        this.buildSoccerFieldAccents(pts, cX, cZ, false);
      }

      // 6. TERRENO DO CIRCO
      else if (name.includes('Terreno')) {
        const shape = this.createShapeFromPoints(pts);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);

        const groundMesh = new THREE.Mesh(geom, this.materials.circusGround);
        groundMesh.position.y = 0.015;
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);
        landmarkPolygons.push(pts);
      }

      // 7. ÁREAS DE BARRACOS DA SÃO REMO
      else if (name.includes('Barracos')) {
        barracoPolygons.push(pts);
      }
    });

    if (barracoPolygons.length > 0) {
      this.buildAllBarracos(barracoPolygons, landmarkPolygons);
    }
  }

  buildAllBarracos(barracoPolygons, landmarkPolygons) {
    const group = new THREE.Group();

    // 1. Pavimentação da base sob cada polígono de barracos
    barracoPolygons.forEach(pts => {
      try {
        const shape = this.createShapeFromPoints(pts);
        const geom = new THREE.ShapeGeometry(shape);
        geom.rotateX(-Math.PI / 2);
        const groundMesh = new THREE.Mesh(geom, this.materials.barracoGround);
        groundMesh.position.y = 0.012;
        groundMesh.receiveShadow = true;
        group.add(groundMesh);
      } catch (e) {
        // Ignora polígono inválido
      }
    });

    // 2. Cores da paleta para os barracos da comunidade
    const colorPalette = [
      new THREE.Color(0xba5136), // tijolo exposto
      new THREE.Color(0xba5136),
      new THREE.Color(0xd9ae52), // ocre/amarelo
      new THREE.Color(0x4a7599), // azul claro
      new THREE.Color(0x4d7e57), // verde esperança
      new THREE.Color(0xb5606d), // rosa
      new THREE.Color(0xd4cfc7)  // reboco branco
    ];

    const bw = 5.0;
    const bd = 5.0;
    const halfH = 2.5;

    let seed = 91;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const visited = new Set();
    const houses = [];

    // Gerar casas em grade global unificada de 5m x 5m (100% coladas, sem vãos entre blocos)
    barracoPolygons.forEach(pts => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      pts.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minZ) minZ = p.y; if (p.y > maxZ) maxZ = p.y;
      });

      const startX = Math.floor(minX / bw) * bw + halfH;
      const startZ = Math.floor(minZ / bd) * bd + halfH;

      for (let x = startX; x <= maxX; x += bw) {
        for (let z = startZ; z <= maxZ; z += bd) {
          const key = Math.round(x) + '_' + Math.round(z);
          if (visited.has(key)) continue;
          if (!this.isPointInPolygon(x, z, pts)) continue;

          // Não sobrepor construções de referência (Circo, Campo, etc.)
          let inLandmark = false;
          for (const lm of landmarkPolygons) {
            if (this.isPointInPolygon(x, z, lm)) {
              inLandmark = true;
              break;
            }
          }
          if (inLandmark) continue;

          // Vértices dos 4 cantos para garantir que não invada nenhuma rua nem calçada
          const corners = [
            { x: x + halfH, z: z + halfH },
            { x: x - halfH, z: z + halfH },
            { x: x + halfH, z: z - halfH },
            { x: x - halfH, z: z - halfH }
          ];

          let hitsStreet = false;
          for (const seg of this.streetSegments) {
            const segTotalW = (seg.streetWidth / 2) + (seg.sidewalkWidth || 1.8);
            const dCenter = this.pointToSegmentDistance(x, z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            if (dCenter < segTotalW + 2.5) {
              hitsStreet = true;
              break;
            }
            for (const c of corners) {
              const dCorner = this.pointToSegmentDistance(c.x, c.z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
              if (dCorner < segTotalW + 0.4) {
                hitsStreet = true;
                break;
              }
            }
            if (hitsStreet) break;
          }

          if (hitsStreet) continue;

          visited.add(key);

          const rand = pseudoRandom();
          const rand2 = pseudoRandom();
          let floors = 1;
          if (rand > 0.38) floors = 2;
          if (rand > 0.80) floors = 3;

          const colorIdx = Math.floor(rand * colorPalette.length);
          const color = colorPalette[colorIdx];
          const hasTank = rand2 > 0.35;

          houses.push({
            x,
            z,
            key,
            floors,
            height: floors * 2.8,
            color,
            hasTank,
            tankOffset: {
              x: (rand - 0.5) * (bw * 0.45),
              z: (rand2 - 0.5) * (bd * 0.45)
            }
          });
        }
      }
    });

    // 3. Renderização ultra-otimizada com THREE.InstancedMesh (apenas 5 draw calls para todos os barracos)
    const houses1 = houses.filter(h => h.floors === 1);
    const houses2 = houses.filter(h => h.floors === 2);
    const houses3 = houses.filter(h => h.floors === 3);
    const tankHouses = houses.filter(h => h.hasTank);

    const dummy = new THREE.Object3D();

    const createFloorMesh = (houseList, floorHeight) => {
      if (houseList.length === 0) return null;
      const geo = new THREE.BoxGeometry(bw, floorHeight, bd);
      const mesh = new THREE.InstancedMesh(geo, this.materials.whiteWall, houseList.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (let i = 0; i < houseList.length; i++) {
        const h = houseList[i];
        dummy.position.set(h.x, floorHeight / 2, h.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, h.color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return mesh;
    };

    const mesh1 = createFloorMesh(houses1, 2.8);
    const mesh2 = createFloorMesh(houses2, 5.6);
    const mesh3 = createFloorMesh(houses3, 8.4);
    if (mesh1) group.add(mesh1);
    if (mesh2) group.add(mesh2);
    if (mesh3) group.add(mesh3);

    // Lajes de concreto
    if (houses.length > 0) {
      const slabGeo = new THREE.BoxGeometry(bw, 0.2, bd);
      const slabMesh = new THREE.InstancedMesh(slabGeo, this.materials.slabConcrete, houses.length);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      for (let i = 0; i < houses.length; i++) {
        const h = houses[i];
        dummy.position.set(h.x, h.height + 0.1, h.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        slabMesh.setMatrixAt(i, dummy.matrix);
      }
      slabMesh.instanceMatrix.needsUpdate = true;
      group.add(slabMesh);
    }

    // Caixas d'água azuis no teto
    if (tankHouses.length > 0) {
      const tankGeo = new THREE.CylinderGeometry(0.7, 0.62, 0.95, 10);
      const tankMesh = new THREE.InstancedMesh(tankGeo, this.materials.waterTankBlue, tankHouses.length);
      tankMesh.castShadow = true;
      for (let i = 0; i < tankHouses.length; i++) {
        const h = tankHouses[i];
        dummy.position.set(
          h.x + h.tankOffset.x,
          h.height + 0.2 + 0.475,
          h.z + h.tankOffset.z
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tankMesh.setMatrixAt(i, dummy.matrix);
      }
      tankMesh.instanceMatrix.needsUpdate = true;
      group.add(tankMesh);
    }

    // 4. Cadastrar apenas casas de BORDA no spatial grid para colisões instantâneas (<0.001ms)
    houses.forEach(h => {
      const neighbors = [
        Math.round(h.x + bw) + '_' + Math.round(h.z),
        Math.round(h.x - bw) + '_' + Math.round(h.z),
        Math.round(h.x) + '_' + Math.round(h.z + bd),
        Math.round(h.x) + '_' + Math.round(h.z - bd)
      ];
      const isBoundary = neighbors.some(n => !visited.has(n));
      if (isBoundary) {
        const cx = Math.floor(h.x / 15);
        const cz = Math.floor(h.z / 15);
        const key = `${cx}_${cz}`;
        let list = this.barracoGrid.get(key);
        if (!list) {
          list = [];
          this.barracoGrid.set(key, list);
        }
        list.push({ x: h.x, z: h.z, radius: 2.8 });
      }
    });

    this.scene.add(group);
  }

  createShapeFromPoints(pts) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x, -pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      shape.lineTo(pts[i].x, -pts[i].y);
    }
    shape.closePath();
    return shape;
  }

  buildRoldaoSign(x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f3875';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#f57c00';
    ctx.fillRect(0, 114, 512, 14);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ROLDÃO ATACADISTA', 256, 75);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

    const signGeo = new THREE.PlaneGeometry(16, 4);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(x, y, z);
    this.scene.add(sign);
  }

  buildParkingStrips(pts) {
    // Generate simple white dashed parking lane markers
    const group = new THREE.Group();
    const p1 = pts[0];
    const p2 = pts[1];
    const dx = p2.x - p1.x;
    const dz = p2.y - p1.y;
    const len = Math.hypot(dx, dz);
    if (len < 5) return;

    for (let i = 4; i < len - 4; i += 6) {
      const t = i / len;
      const px = p1.x + dx * t;
      const pz = p1.y + dz * t;

      const lineGeo = new THREE.PlaneGeometry(3.5, 0.15);
      const lineMesh = new THREE.Mesh(lineGeo, this.materials.lineWhite);
      lineMesh.rotation.x = -Math.PI / 2;
      lineMesh.position.set(px, 0.025, pz);
      group.add(lineMesh);
    }
    this.scene.add(group);
  }

  buildSoccerFieldAccents(pts, cX, cZ, isDirt) {
    const group = new THREE.Group();

    // Boundary border
    const points3D = pts.map(p => new THREE.Vector3(p.x, 0.03, p.y));
    const borderGeo = new THREE.BufferGeometry().setFromPoints(points3D);
    const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const border = new THREE.Line(borderGeo, borderMat);
    group.add(border);

    // Goalposts (Traves de futebol) on the short ends
    const makeGoal = (gx, gz, rot) => {
      const goalGroup = new THREE.Group();
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6);
      const crossbarGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.0, 6);

      const p1 = new THREE.Mesh(postGeo, this.materials.metalGoal);
      p1.position.set(-2.0, 1.1, 0);

      const p2 = new THREE.Mesh(postGeo, this.materials.metalGoal);
      p2.position.set(2.0, 1.1, 0);

      const bar = new THREE.Mesh(crossbarGeo, this.materials.metalGoal);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.2, 0);

      goalGroup.add(p1, p2, bar);
      goalGroup.position.set(gx, 0, gz);
      goalGroup.rotation.y = rot;
      return goalGroup;
    };

    if (pts.length >= 4) {
      const g1 = makeGoal(pts[0].x * 0.9 + pts[1].x * 0.1, pts[0].y * 0.9 + pts[1].y * 0.1, 0);
      const g2 = makeGoal(pts[2].x * 0.9 + pts[3].x * 0.1, pts[2].y * 0.9 + pts[3].y * 0.1, Math.PI);
      group.add(g1, g2);
    }

    this.scene.add(group);
  }

  getGroundHeight(x, z) {
    return 0;
  }

  getCurrentStreet(x, z) {
    // Check if player is inside or near any specific building/landmark
    for (const f of buildingsData.features) {
      const name = f.properties.name;
      const ring = f.geometry.coordinates[0];
      if (ring && ring.length >= 3) {
        const poly = ring.map(([lon, lat]) => this.project(lon, lat));
        if (this.isPointInPolygon(x, z, poly)) {
          return name;
        }
      }
    }

    // Street search
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

  isPointInPolygon(px, pz, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].y;
      const xj = poly[j].x, zj = poly[j].y;
      const intersect = ((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  checkCollision(x, z) {
    // Map radius
    if (Math.hypot(x, z) > 550) return true;

    // Colisores sólidos poligonais (Roldão, Circo, etc.)
    for (const poly of this.solidColliders) {
      if (this.isPointInPolygon(x, z, poly)) {
        return true;
      }
    }

    // Colisores dos barracos (spatial hashing em células de 15x15m para máxima performance)
    const cx = Math.floor(x / 15);
    const cz = Math.floor(z / 15);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.barracoGrid.get(`${cx + dx}_${cz + dz}`);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          const diffX = x - b.x;
          if (diffX > 2.8 || diffX < -2.8) continue;
          const diffZ = z - b.z;
          if (diffZ > 2.8 || diffZ < -2.8) continue;
          if (diffX * diffX + diffZ * diffZ < 2.8 * 2.8) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
