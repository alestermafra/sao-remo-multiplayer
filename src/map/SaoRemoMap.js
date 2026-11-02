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
        color: 0x6e7075,
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
    const linesGroup = new THREE.Group();
    const sidewalkGroup = new THREE.Group();

    geoData.features.forEach(feature => {
      const name = feature.properties.name || 'Rua sem nome';
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      let streetWidth = 8.0;
      if (name.startsWith('Av.')) {
        streetWidth = 11.0;
      } else if (name.includes('Arrozal') || name.includes('Paineiras') || name.includes('Pires')) {
        streetWidth = 6.4;
      }

      const halfW = streetWidth / 2;
      const curbExtra = 0.8;
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

        // 1. Calçada
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

        // 2. Asfalto
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

        // Discos de calçada
        const swDiscGeo = new THREE.CircleGeometry(swWidth, 20);
        swDiscGeo.rotateX(-Math.PI / 2);
        const swDisc1 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc1.position.set(p1.x, 0.035, p1.y);
        sidewalkGroup.add(swDisc1);

        const swDisc2 = new THREE.Mesh(swDiscGeo, this.materials.sidewalk);
        swDisc2.position.set(p2.x, 0.035, p2.y);
        sidewalkGroup.add(swDisc2);

        // 3. Faixas amarelas
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

  buildBuildingsFromGeoJSON() {
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

        // Pintar algumas vagas de estacionamento em linhas brancas
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

        // Linhas de cal e traves de futebol
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
      }

      // 7. ÁREA DOS BARRACOS DA SÃO REMO
      else if (name.includes('Barracos')) {
        this.buildBarracosArea(pts);
      }
    });
  }

  buildBarracosArea(pts) {
    const group = new THREE.Group();

    // Pavimentação da base sob o bloco de barracos
    const shape = this.createShapeFromPoints(pts);
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(geom, this.materials.barracoGround);
    groundMesh.position.y = 0.012;
    groundMesh.receiveShadow = true;
    group.add(groundMesh);

    // Orientação do quarteirão para preenchimento contínuo e colado
    const p0 = pts[0], p1 = pts[1], p3 = pts[3];
    const uX = (p1.x - p0.x), uY = (p1.y - p0.y);
    const vX = (p3.x - p0.x), vY = (p3.y - p0.y);
    const lenU = Math.hypot(uX, uY);
    const lenV = Math.hypot(vX, vY);
    const dirU = { x: uX / lenU, y: uY / lenU };
    const dirV = { x: vX / lenV, y: vY / lenV };
    const gridAngle = Math.atan2(dirU.y, dirU.x);

    const houseMaterials = [
      this.materials.brickWall,
      this.materials.brickWall,
      this.materials.yellowWall,
      this.materials.blueWall,
      this.materials.greenWall,
      this.materials.pinkWall,
      this.materials.whiteWall
    ];

    // Dimensões do barraco colado
    const bw = 5.0;
    const bd = 5.0;
    const halfH = 2.5;

    let seed = 91;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    let houseIndex = 0;

    for (let u = 0.5; u <= lenU - bw; u += bw) {
      for (let v = 0.5; v <= lenV - bd; v += bd) {
        const uCenter = u + (bw / 2);
        const vCenter = v + (bd / 2);
        const posX = p0.x + dirU.x * uCenter + dirV.x * vCenter;
        const posZ = p0.y + dirU.y * uCenter + dirV.y * vCenter;

        if (!this.isPointInPolygon(posX, posZ, pts)) continue;

        // Vértices dos 4 cantos do barraco para garantir que nenhum canto invade a rua/calçada
        const corners = [
          { x: posX + dirU.x * halfH + dirV.x * halfH, z: posZ + dirU.y * halfH + dirV.y * halfH },
          { x: posX - dirU.x * halfH + dirV.x * halfH, z: posZ - dirU.y * halfH + dirV.y * halfH },
          { x: posX + dirU.x * halfH - dirV.x * halfH, z: posZ + dirU.y * halfH - dirV.y * halfH },
          { x: posX - dirU.x * halfH - dirV.x * halfH, z: posZ - dirU.y * halfH - dirV.y * halfH }
        ];

        let hitsStreet = false;
        for (const seg of this.streetSegments) {
          const segHalfW = (seg.streetWidth / 2) + 1.2; // Largura da rua + calçada
          const dCenter = this.pointToSegmentDistance(posX, posZ, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
          if (dCenter < segHalfW + 2.8) {
            hitsStreet = true;
            break;
          }
          for (const c of corners) {
            const dCorner = this.pointToSegmentDistance(c.x, c.z, seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y);
            if (dCorner < segHalfW + 0.6) {
              hitsStreet = true;
              break;
            }
          }
          if (hitsStreet) break;
        }

        // Se invadir a rua ou calçada, pula
        if (hitsStreet) continue;

        houseIndex++;
        const rand = pseudoRandom();
        const rand2 = pseudoRandom();

        // Andares variados (1 a 3 pavimentos) para criar o relevo da laje
        let floors = 1;
        if (rand > 0.38) floors = 2;
        if (rand > 0.80) floors = 3;
        const height = floors * 2.8;

        // Barraco maciço colado
        const houseGeo = new THREE.BoxGeometry(bw, height, bd);
        const mat = houseMaterials[(houseIndex + Math.floor(rand * 3)) % houseMaterials.length];
        const houseMesh = new THREE.Mesh(houseGeo, mat);
        houseMesh.position.set(posX, height / 2, posZ);
        houseMesh.rotation.y = -gridAngle;
        houseMesh.castShadow = true;
        houseMesh.receiveShadow = true;
        group.add(houseMesh);

        // Laje de concreto no topo
        const slabGeo = new THREE.BoxGeometry(bw, 0.2, bd);
        const slabMesh = new THREE.Mesh(slabGeo, this.materials.slabConcrete);
        slabMesh.position.set(posX, height + 0.1, posZ);
        slabMesh.rotation.y = -gridAngle;
        slabMesh.castShadow = true;
        group.add(slabMesh);

        // Caixa d'água azul na laje (em ~65% das lajes)
        if (rand2 > 0.35) {
          const tankGeo = new THREE.CylinderGeometry(0.7, 0.62, 0.95, 10);
          const tankMesh = new THREE.Mesh(tankGeo, this.materials.waterTankBlue);
          tankMesh.position.set(
            posX + (rand - 0.5) * (bw * 0.45),
            height + 0.2 + 0.475,
            posZ + (rand2 - 0.5) * (bd * 0.45)
          );
          tankMesh.castShadow = true;
          group.add(tankMesh);
        }

        // Registrar colisor do barraco para o jogador colidir na parede externa
        this.barracoColliders.push({
          x: posX,
          z: posZ,
          radius: 2.8
        });
      }
    }

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

    // Colisores individuais dos barracos colados
    for (let i = 0; i < this.barracoColliders.length; i++) {
      const b = this.barracoColliders[i];
      const dx = x - b.x;
      if (dx > 2.8 || dx < -2.8) continue;
      const dz = z - b.z;
      if (dz > 2.8 || dz < -2.8) continue;
      if (dx * dx + dz * dz < 2.8 * 2.8) {
        return true;
      }
    }

    return false;
  }
}
