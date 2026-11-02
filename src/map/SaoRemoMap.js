import * as THREE from 'three';
import { mapData } from './mapData.js';

export class SaoRemoMap {
  constructor(scene) {
    this.scene = scene;

    // Projection center and scale
    this.initProjection();

    // Materials
    this.initMaterials();

    // Map structures
    this.streetSegments = [];
    this.vielaSegments = [];
    this.solidColliders = [];
    this.landmarkPolygons = [];
    this.barracoColliders = [];
    this.barracoGrid = new Map();

    this.buildGround();
    this.buildElementsFromGeoJSON();
  }

  initProjection() {
    let lats = [];
    let lons = [];

    const extractCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        lons.push(coords[0]);
        lats.push(coords[1]);
      } else {
        coords.forEach(extractCoords);
      }
    };

    mapData.features.forEach(f => {
      if (f.geometry && f.geometry.coordinates) {
        extractCoords(f.geometry.coordinates);
      }
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
      // Pistas, calçadas e vielas
      asphalt: new THREE.MeshLambertMaterial({
        color: 0x242426,
        side: THREE.DoubleSide
      }),
      sidewalk: new THREE.MeshLambertMaterial({
        color: 0xb5b8be, // Concreto claro de calçada
        side: THREE.DoubleSide
      }),
      curb: new THREE.MeshLambertMaterial({
        color: 0xe2e4e8, // Guia de meio-fio em pedra clara
        side: THREE.DoubleSide
      }),
      viela: new THREE.MeshLambertMaterial({
        color: 0x8e9196, // Passagem de pedestres/vielas em cimento
        side: THREE.DoubleSide
      }),
      lineWhite: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide
      }),
      ground: new THREE.MeshLambertMaterial({
        color: 0x3d4e32 // Terreno verde escuro / grama
      }),

      // Pontos de referência
      roldaoWall: new THREE.MeshLambertMaterial({ color: 0x1e3f73 }),
      roldaoRoof: new THREE.MeshLambertMaterial({ color: 0x4a4d52, side: THREE.DoubleSide }),
      parkingAsphalt: new THREE.MeshLambertMaterial({ color: 0x2c2d30, side: THREE.DoubleSide }),
      dirtField: new THREE.MeshLambertMaterial({ color: 0xa86036, side: THREE.DoubleSide }),
      greenCourt: new THREE.MeshLambertMaterial({ color: 0x2e7d32, side: THREE.DoubleSide }),
      blueCourt: new THREE.MeshLambertMaterial({ color: 0x1565c0, side: THREE.DoubleSide }),
      circusGround: new THREE.MeshLambertMaterial({ color: 0x485a3a, side: THREE.DoubleSide }),
      circusWall: new THREE.MeshLambertMaterial({ color: 0xd32f2f }),
      circusRoof: new THREE.MeshLambertMaterial({ color: 0xfbc02d, side: THREE.DoubleSide }),
      circusWhite: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      metalGoal: new THREE.MeshLambertMaterial({ color: 0xeeeeee }),
      bleachers: new THREE.MeshLambertMaterial({ color: 0x75787d, side: THREE.DoubleSide }),

      // UBS e Construções
      ubsWall: new THREE.MeshLambertMaterial({ color: 0xebedf0 }),
      ubsGreen: new THREE.MeshLambertMaterial({ color: 0x00897b, side: THREE.DoubleSide }),
      playgroundSand: new THREE.MeshLambertMaterial({ color: 0xc89e74, side: THREE.DoubleSide }),
      playgroundRed: new THREE.MeshLambertMaterial({ color: 0xd32f2f }),
      playgroundYellow: new THREE.MeshLambertMaterial({ color: 0xfbc02d }),
      masonryWall: new THREE.MeshLambertMaterial({ color: 0x9c523b }),
      masonryWall2: new THREE.MeshLambertMaterial({ color: 0xc99b53 }),

      // Barracos da comunidade
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

  buildElementsFromGeoJSON() {
    const roadGroup = new THREE.Group();
    const curbGroup = new THREE.Group();
    const sidewalkGroup = new THREE.Group();
    const vielaGroup = new THREE.Group();

    const barracoPolygons = [];

    mapData.features.forEach(feature => {
      const name = feature.properties?.name || '';
      if (!feature.geometry || !feature.geometry.coordinates) return;

      // ==========================================
      // 1. VIAS (Ruas, Avenidas, Vielas e Becos)
      // ==========================================
      if (feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        if (coords.length < 2) return;

        const isVielaOrBeco = name.includes('Viela') || name.includes('Beco') || name.includes('Acesso');
        const projectedPoints = coords.map(([lon, lat]) => this.project(lon, lat));

        let streetWidth = 8.0;
        let sidewalkWidth = 1.8;
        if (name.startsWith('Av.')) {
          streetWidth = 11.0;
          sidewalkWidth = 2.2;
        } else if (name.includes('Arrozal') || name.includes('Paineiras') || name.includes('Pires')) {
          streetWidth = 6.4;
          sidewalkWidth = 1.4;
        } else if (isVielaOrBeco) {
          streetWidth = 2.4;
          sidewalkWidth = 0.0;
        }

        const halfW = streetWidth / 2;

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

          const segInfo = {
            name: name || (isVielaOrBeco ? 'Viela da São Remo' : 'Rua sem nome'),
            p1,
            p2,
            streetWidth,
            sidewalkWidth,
            len,
            isViela: isVielaOrBeco
          };

          if (isVielaOrBeco) {
            this.vielaSegments.push(segInfo);
            this.streetSegments.push(segInfo);

            // Passagem pavimentada de viela/beco (cimento claro)
            const vGeom = new THREE.BufferGeometry();
            const vVertices = new Float32Array([
              p1.x + nx * halfW, 0.038, p1.y + nz * halfW,
              p2.x - nx * halfW, 0.038, p2.y - nz * halfW,
              p1.x - nx * halfW, 0.038, p1.y - nz * halfW,

              p1.x + nx * halfW, 0.038, p1.y + nz * halfW,
              p2.x + nx * halfW, 0.038, p2.y + nz * halfW,
              p2.x - nx * halfW, 0.038, p2.y - nz * halfW,
            ]);
            vGeom.setAttribute('position', new THREE.BufferAttribute(vVertices, 3));
            vGeom.computeVertexNormals();
            const vMesh = new THREE.Mesh(vGeom, this.materials.viela);
            vMesh.receiveShadow = true;
            vielaGroup.add(vMesh);

            // Discos de união nas esquinas/vértices da viela
            const vDiscGeo = new THREE.CircleGeometry(halfW, 16);
            vDiscGeo.rotateX(-Math.PI / 2);
            const vd1 = new THREE.Mesh(vDiscGeo, this.materials.viela);
            vd1.position.set(p1.x, 0.039, p1.y);
            vd1.receiveShadow = true;
            vielaGroup.add(vd1);

            const vd2 = new THREE.Mesh(vDiscGeo, this.materials.viela);
            vd2.position.set(p2.x, 0.039, p2.y);
            vd2.receiveShadow = true;
            vielaGroup.add(vd2);
          } else {
            this.streetSegments.push(segInfo);

            const swWidth = halfW + sidewalkWidth;
            const curbWidth = halfW + 0.25;

            // 1. Calçada
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

            // 2. Meio-fio
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

            // Discos nos vértices
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

            const curbDiscGeo = new THREE.CircleGeometry(curbWidth, 24);
            curbDiscGeo.rotateX(-Math.PI / 2);
            const curbDisc1 = new THREE.Mesh(curbDiscGeo, this.materials.curb);
            curbDisc1.position.set(p1.x, 0.052, p1.y);
            curbGroup.add(curbDisc1);

            const curbDisc2 = new THREE.Mesh(curbDiscGeo, this.materials.curb);
            curbDisc2.position.set(p2.x, 0.052, p2.y);
            curbGroup.add(curbDisc2);

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
        }
      }

      // ==========================================
      // 2. CONSTRUÇÕES E ÁREAS (Polígonos)
      // ==========================================
      else if (feature.geometry.type === 'Polygon') {
        const ring = feature.geometry.coordinates[0];
        if (!ring || ring.length < 3) return;

        // Descartar polígonos colapsados de área zero
        const pts = ring.map(([lon, lat]) => this.project(lon, lat));
        let cX = 0, cZ = 0;
        pts.forEach(p => { cX += p.x; cZ += p.y; });
        cX /= pts.length;
        cZ /= pts.length;

        let maxDist = 0;
        pts.forEach(p => { maxDist = Math.max(maxDist, Math.hypot(p.x - cX, p.y - cZ)); });
        if (maxDist < 0.5) return;

        // BARRRACOS
        if (name === 'Barracos') {
          barracoPolygons.push(pts);
        }

        // ROLDÃO ATACADISTA
        else if (name.includes('Roldão') && !name.includes('Estacionamento')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ExtrudeGeometry(shape, { depth: 8.5, bevelEnabled: false });
          geom.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geom, this.materials.roldaoWall);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.solidColliders.push(pts);
          this.landmarkPolygons.push({ name, pts });
          this.buildRoldaoSign(cX, 9.5, cZ);
        }

        // ESTACIONAMENTO
        else if (name.includes('Estacionamento')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ShapeGeometry(shape);
          geom.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geom, this.materials.parkingAsphalt);
          mesh.position.y = 0.02;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.landmarkPolygons.push({ name, pts });
          this.buildParkingStrips(pts);
        }

        // CIRCO ESCOLA SÃO REMO
        else if (name.includes('Circo Escola')) {
          let radius = 0;
          pts.forEach(p => { radius += Math.hypot(p.x - cX, p.y - cZ); });
          radius /= pts.length;
          if (radius < 5) radius = 13.5;

          const circusGroup = new THREE.Group();
          const wallGeo = new THREE.CylinderGeometry(radius, radius, 4.2, 32);
          const wallMesh = new THREE.Mesh(wallGeo, this.materials.circusWall);
          wallMesh.position.y = 2.1;
          wallMesh.castShadow = true;
          circusGroup.add(wallMesh);

          const roofGeo = new THREE.ConeGeometry(radius + 1.2, 7.5, 32);
          const roofMesh = new THREE.Mesh(roofGeo, this.materials.circusRoof);
          roofMesh.position.y = 7.95;
          roofMesh.castShadow = true;
          circusGroup.add(roofMesh);

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

          this.solidColliders.push(pts);
          this.landmarkPolygons.push({ name, pts });
        }

        // CAMPO DA SÃO REMO
        else if (name.includes('Campo') && !name.includes('Arquibancada')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ShapeGeometry(shape);
          geom.rotateX(-Math.PI / 2);
          const fieldMesh = new THREE.Mesh(geom, this.materials.dirtField);
          fieldMesh.position.y = 0.02;
          fieldMesh.receiveShadow = true;
          this.scene.add(fieldMesh);

          this.landmarkPolygons.push({ name, pts });
          this.buildSoccerFieldAccents(pts, cX, cZ, true);
        }

        // ARQUIBANCADA DO CAMPO
        else if (name.includes('Arquibancada')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false });
          geom.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geom, this.materials.bleachers);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.solidColliders.push(pts);
          this.landmarkPolygons.push({ name, pts });
        }

        // UNIDADE BÁSICA DE SAÚDE (UBS SÃO REMO)
        else if (name.includes('Unidade Básica') || name.includes('Saúde') || name.includes('UBS')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ExtrudeGeometry(shape, { depth: 4.8, bevelEnabled: false });
          geom.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geom, this.materials.ubsWall);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.solidColliders.push(pts);
          this.landmarkPolygons.push({ name, pts });
          this.buildUBSSign(cX, 5.4, cZ);
        }

        // QUADRA POLIESPORTIVA & QUADRA DO CIRCO
        else if (name.includes('Quadra')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ShapeGeometry(shape);
          geom.rotateX(-Math.PI / 2);
          const isCirco = name.includes('Circo');
          const courtMesh = new THREE.Mesh(geom, isCirco ? this.materials.blueCourt : this.materials.greenCourt);
          courtMesh.position.y = 0.025;
          courtMesh.receiveShadow = true;
          this.scene.add(courtMesh);

          this.landmarkPolygons.push({ name, pts });
          this.buildSoccerFieldAccents(pts, cX, cZ, false);
        }

        // PARQUINHO DO CIRCO
        else if (name.includes('Parquinho')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ShapeGeometry(shape);
          geom.rotateX(-Math.PI / 2);
          const sandMesh = new THREE.Mesh(geom, this.materials.playgroundSand);
          sandMesh.position.y = 0.018;
          sandMesh.receiveShadow = true;
          this.scene.add(sandMesh);

          this.landmarkPolygons.push({ name, pts });
          this.buildPlaygroundEquipment(cX, cZ);
        }

        // CONSTRUÇÕES / SOBRADOS DE ALVENARIA
        else if (name.includes('Construções')) {
          const shape = this.createShapeFromPoints(pts);
          const geom = new THREE.ExtrudeGeometry(shape, { depth: 6.8, bevelEnabled: false });
          geom.rotateX(-Math.PI / 2);
          const mesh = new THREE.Mesh(geom, this.materials.masonryWall);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);

          this.solidColliders.push(pts);
          this.landmarkPolygons.push({ name, pts });
        }
      }
    });

    this.scene.add(sidewalkGroup);
    this.scene.add(curbGroup);
    this.scene.add(roadGroup);
    this.scene.add(vielaGroup);

    // Gerar todos os barracos integrados
    if (barracoPolygons.length > 0) {
      this.buildAllBarracos(barracoPolygons, this.landmarkPolygons.map(l => l.pts));
    }
  }

  buildAllBarracos(barracoPolygons, landmarkPolygons) {
    const group = new THREE.Group();

    // 1. Pavimentação da base sob os blocos de barracos
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

    // Gerar casas em grade unificada global de 5m x 5m (100% coladas, sem vãos internos)
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

          // 1. Não invadir pontos de referência (Circo, Campo, UBS, etc.)
          let inLandmark = false;
          for (const lm of landmarkPolygons) {
            if (this.isPointInPolygon(x, z, lm)) {
              inLandmark = true;
              break;
            }
          }
          if (inLandmark) continue;

          // Vértices dos 4 cantos para conferência de limites
          const corners = [
            { x: x + halfH, z: z + halfH },
            { x: x - halfH, z: z + halfH },
            { x: x + halfH, z: z - halfH },
            { x: x - halfH, z: z - halfH }
          ];

          // 2. Não invadir ruas nem calçadas
          let hitsStreet = false;
          for (const seg of this.streetSegments) {
            if (seg.isViela) continue;
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

          // 3. Não invadir vielas nem becos (deixa os corredores navegáveis entre as casas!)
          let hitsViela = false;
          for (const seg of this.vielaSegments) {
            const segHalfW = seg.streetWidth / 2; // 1.2m
            const dCenter = this.pointToSegmentDistance(x, z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            if (dCenter < segHalfW + 2.2) {
              hitsViela = true;
              break;
            }
            for (const c of corners) {
              const dCorner = this.pointToSegmentDistance(c.x, c.z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
              if (dCorner < segHalfW + 0.3) {
                hitsViela = true;
                break;
              }
            }
            if (hitsViela) break;
          }
          if (hitsViela) continue;

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

    // 3. Renderização com THREE.InstancedMesh (5 draw calls para todos os barracos)
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

    // Caixas d'água azuis
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

    // 4. Cadastrar casas de borda no spatial grid para colisões instantâneas (<0.001ms)
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

  buildUBSSign(x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#00897b';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 114, 512, 14);

    // Cruz da saúde
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 44, 40, 40);
    ctx.fillStyle = '#00897b';
    ctx.fillRect(40, 56, 40, 16);
    ctx.fillRect(52, 44, 16, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('UBS SÃO REMO', 100, 75);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

    const signGeo = new THREE.PlaneGeometry(12, 3);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(x, y, z);
    this.scene.add(sign);
  }

  buildParkingStrips(pts) {
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

  buildPlaygroundEquipment(cX, cZ) {
    const group = new THREE.Group();

    // 1. Escorregador infantil
    const slideGroup = new THREE.Group();
    const ladderGeo = new THREE.BoxGeometry(0.6, 2.0, 0.6);
    const ladder = new THREE.Mesh(ladderGeo, this.materials.playgroundYellow);
    ladder.position.set(-1.5, 1.0, 0);

    const rampGeo = new THREE.PlaneGeometry(0.8, 2.8);
    const ramp = new THREE.Mesh(rampGeo, this.materials.playgroundRed);
    ramp.rotation.x = -Math.PI / 4;
    ramp.position.set(0, 1.0, 0);

    slideGroup.add(ladder, ramp);
    slideGroup.position.set(cX - 3, 0, cZ - 2);
    group.add(slideGroup);

    // 2. Balanço
    const swingGroup = new THREE.Group();
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    const beam = new THREE.Mesh(beamGeo, this.materials.playgroundRed);
    beam.rotation.z = Math.PI / 2;
    beam.position.set(0, 2.2, 0);

    const post1 = new THREE.Mesh(beamGeo, this.materials.playgroundYellow);
    post1.position.set(-1.5, 1.1, 0);
    const post2 = new THREE.Mesh(beamGeo, this.materials.playgroundYellow);
    post2.position.set(1.5, 1.1, 0);

    swingGroup.add(beam, post1, post2);
    swingGroup.position.set(cX + 3, 0, cZ + 2);
    group.add(swingGroup);

    this.scene.add(group);
  }

  buildSoccerFieldAccents(pts, cX, cZ, isDirt) {
    const group = new THREE.Group();

    // Linha limite branca
    const points3D = pts.map(p => new THREE.Vector3(p.x, 0.03, p.y));
    const borderGeo = new THREE.BufferGeometry().setFromPoints(points3D);
    const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const border = new THREE.Line(borderGeo, borderMat);
    group.add(border);

    // Traves de futebol
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
    // 1. Checa se o jogador está dentro de algum ponto de referência
    for (const lm of this.landmarkPolygons) {
      if (this.isPointInPolygon(x, z, lm.pts)) {
        return lm.name;
      }
    }

    // 2. Busca por proximidade de vielas/becos (raio menor: 5m)
    for (const seg of this.vielaSegments) {
      const dist = this.pointToSegmentDistance(x, z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
      if (dist <= 5.0) {
        return seg.name;
      }
    }

    // 3. Busca por ruas e avenidas principais
    let closestStreet = 'Comunidade São Remo';
    let minDistance = Infinity;

    for (const seg of this.streetSegments) {
      if (seg.isViela) continue;
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

    // Colisores sólidos poligonais (Roldão, Circo, UBS, Arquibancada, Sobrados, etc.)
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
