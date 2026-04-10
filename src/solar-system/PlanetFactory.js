/**
 * PlanetFactory.js — Creates all planet meshes, moons, atmospheres, and rings.
 *
 * Hierarchical structure per planet:
 *   orbitGroup (rotates around Y for orbit)
 *     └─ planetGroup (offset by visualDistance)
 *          ├─ mesh (the planet sphere)
 *          ├─ atmosphereMesh (if hasAtmosphere)
 *          ├─ ringMesh (if hasRings — Saturn)
 *          └─ moonOrbitGroup (per moon)
 *               └─ moonMesh
 */
import * as THREE from 'three';
import { PLANETS } from '../data/planetData.js';
import { SCENE_CONFIG } from '../data/constants.js';

export class PlanetFactory {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    /** @type {Array<Object>} — planet runtime objects for animation */
    this.planets = [];

    /** @type {Array<THREE.Mesh>} — all clickable meshes for raycasting */
    this.clickables = [];

    this._createAll();
  }

  _createAll() {
    PLANETS.forEach((data) => {
      const planetObj = this._createPlanet(data);
      this.planets.push(planetObj);
    });
  }

  /**
   * Build a complete planet hierarchy.
   * @param {Object} data — planet data from planetData.js
   * @returns {Object} — runtime planet object
   */
  _createPlanet(data) {
    // ── Orbit group — rotates to simulate orbital motion ──
    const orbitGroup = new THREE.Group();
    orbitGroup.name = `${data.name}-orbit`;

    // Random starting orbit angle so planets don't all align
    const startAngle = Math.random() * Math.PI * 2;
    orbitGroup.rotation.y = startAngle;

    // ── Planet group — offset from center by orbital distance ──
    const planetGroup = new THREE.Group();
    planetGroup.name = data.name;
    planetGroup.position.x = data.visualDistance;
    planetGroup.userData = { name: data.name, type: 'planet', planetData: data };

    // Axial tilt
    planetGroup.rotation.z = data.axialTilt || 0;

    // ── Planet mesh ──
    const geometry = new THREE.SphereGeometry(data.visualRadius, 48, 48);
    const texture = this._createProceduralTexture(data);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.8,
      metalness: 0.1,
      emissive: new THREE.Color(data.emissive),
      emissiveIntensity: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { name: data.name, type: 'planet', planetData: data };
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    planetGroup.add(mesh);
    this.clickables.push(mesh);

    // ── Atmosphere glow ──
    if (data.hasAtmosphere) {
      const atmoMesh = this._createAtmosphere(data);
      planetGroup.add(atmoMesh);
    }

    // ── Saturn rings ──
    if (data.hasRings) {
      const ringMesh = this._createRings(data);
      planetGroup.add(ringMesh);
    }

    // ── Moons ──
    const moonObjects = [];
    if (data.moons && data.moons.length > 0) {
      data.moons.forEach((moonData) => {
        const moonObj = this._createMoon(moonData, planetGroup);
        moonObjects.push(moonObj);
      });
    }

    orbitGroup.add(planetGroup);
    this.scene.add(orbitGroup);

    return {
      data,
      orbitGroup,
      planetGroup,
      mesh,
      moonObjects,
      orbitAngle: startAngle,
    };
  }

  /**
   * Generate a procedural canvas texture for a planet.
   */
  _createProceduralTexture(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const color = new THREE.Color(data.color);
    const baseR = Math.floor(color.r * 255);
    const baseG = Math.floor(color.g * 255);
    const baseB = Math.floor(color.b * 255);

    // Fill base color
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    ctx.fillRect(0, 0, 512, 256);

    // Add planet-specific surface detail
    if (data.name === 'Jupiter' || data.name === 'Saturn') {
      // Gas giant bands
      this._drawBands(ctx, baseR, baseG, baseB, 512, 256);
    } else if (data.name === 'Earth') {
      // Simplified continents
      this._drawEarthLike(ctx, 512, 256);
    } else if (data.name === 'Mars') {
      // Reddish terrain with darker regions
      this._drawMarsTerrain(ctx, baseR, baseG, baseB, 512, 256);
    } else {
      // Generic noise for rocky/icy worlds
      this._drawNoise(ctx, baseR, baseG, baseB, 512, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  _drawBands(ctx, r, g, b, w, h) {
    const bandCount = 12 + Math.floor(Math.random() * 6);
    for (let i = 0; i < bandCount; i++) {
      const y = (i / bandCount) * h;
      const bandH = h / bandCount + Math.random() * 4;
      const variation = Math.floor(Math.random() * 40 - 20);
      ctx.fillStyle = `rgba(${r + variation}, ${g + variation}, ${b + variation}, 0.6)`;
      ctx.fillRect(0, y, w, bandH);
    }
    // Add swirl detail
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rx = 5 + Math.random() * 15;
      const ry = 2 + Math.random() * 5;
      const variation = Math.floor(Math.random() * 30 - 15);
      ctx.fillStyle = `rgba(${r + variation}, ${g + variation}, ${b + variation}, 0.3)`;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawEarthLike(ctx, w, h) {
    // Ocean
    ctx.fillStyle = '#2a5c8a';
    ctx.fillRect(0, 0, w, h);

    // Random landmasses
    ctx.fillStyle = '#3a7a3a';
    for (let i = 0; i < 12; i++) {
      const cx = Math.random() * w;
      const cy = h * 0.15 + Math.random() * h * 0.7;
      const sw = 40 + Math.random() * 100;
      const sh = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sw, sh, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ice caps
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(0, 0, w, 15);
    ctx.fillRect(0, h - 15, w, 15);

    // Clouds (semi-transparent white swirls)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 30; i++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20 + Math.random() * 50, 5 + Math.random() * 15, Math.random(), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMarsTerrain(ctx, r, g, b, w, h) {
    // Base already filled. Add darker regions + craters
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 2 + Math.random() * 8;
      const darkness = Math.random() * 40;
      ctx.fillStyle = `rgba(${r - darkness}, ${g - darkness}, ${b - darkness}, 0.5)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Polar caps
    ctx.fillStyle = 'rgba(220, 210, 200, 0.4)';
    ctx.fillRect(0, 0, w, 12);
    ctx.fillRect(0, h - 12, w, 12);
  }

  _drawNoise(ctx, r, g, b, w, h) {
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 1 + Math.random() * 6;
      const variation = Math.floor(Math.random() * 30 - 15);
      ctx.fillStyle = `rgba(${r + variation}, ${g + variation}, ${b + variation}, 0.4)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Atmosphere glow — a slightly larger semi-transparent sphere.
   */
  _createAtmosphere(data) {
    const atmoRadius = data.visualRadius * SCENE_CONFIG.atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmoRadius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: data.atmosphereColor,
      transparent: true,
      opacity: SCENE_CONFIG.atmosphereOpacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Saturn rings — flat RingGeometry with semi-transparent gradient.
   */
  _createRings(data) {
    const geometry = new THREE.RingGeometry(
      data.ringInnerRadius,
      data.ringOuterRadius,
      128
    );

    // Rotate UV so the texture maps radially
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      const normalised = (dist - data.ringInnerRadius) / (data.ringOuterRadius - data.ringInnerRadius);
      uv.setXY(i, normalised, 0.5);
    }

    // Procedural ring texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, 'rgba(180, 160, 120, 0.0)');
    grad.addColorStop(0.1, 'rgba(200, 180, 140, 0.7)');
    grad.addColorStop(0.25, 'rgba(160, 140, 100, 0.3)');
    grad.addColorStop(0.35, 'rgba(200, 185, 150, 0.8)');
    grad.addColorStop(0.5, 'rgba(170, 150, 110, 0.4)');
    grad.addColorStop(0.65, 'rgba(190, 175, 140, 0.6)');
    grad.addColorStop(0.8, 'rgba(150, 130, 90, 0.2)');
    grad.addColorStop(1, 'rgba(100, 80, 60, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 16);

    // Add gap lines (Cassini Division)
    ctx.clearRect(120, 0, 8, 16);
    ctx.clearRect(250, 0, 3, 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const ringMesh = new THREE.Mesh(geometry, material);
    ringMesh.rotation.x = -Math.PI / 2; // Flat ring around equator
    return ringMesh;
  }

  /**
   * Create a moon orbiting its parent planet.
   */
  _createMoon(moonData, parentGroup) {
    const moonOrbit = new THREE.Group();
    moonOrbit.rotation.y = Math.random() * Math.PI * 2;
    moonOrbit.rotation.x = (Math.random() - 0.5) * 0.3; // Slight inclination

    const geometry = new THREE.SphereGeometry(moonData.visualRadius, 24, 24);
    const material = new THREE.MeshStandardMaterial({
      color: moonData.color,
      roughness: 0.9,
      metalness: 0.0,
    });

    const moonMesh = new THREE.Mesh(geometry, material);
    moonMesh.position.x = moonData.orbitRadius;
    moonMesh.userData = { name: moonData.name, type: 'moon' };

    moonOrbit.add(moonMesh);
    parentGroup.add(moonOrbit);

    return {
      data: moonData,
      orbitGroup: moonOrbit,
      mesh: moonMesh,
    };
  }

  /**
   * Animate all planets: orbits, rotations, and moons.
   * @param {number} elapsed — total time
   * @param {number} delta — frame delta
   */
  update(elapsed, delta) {
    const { orbitMultiplier, rotationMultiplier } = SCENE_CONFIG.time;

    this.planets.forEach((planet) => {
      // Orbit
      planet.orbitGroup.rotation.y += delta * planet.data.orbitalSpeed * orbitMultiplier;

      // Self-rotation
      planet.mesh.rotation.y += delta * planet.data.rotationSpeed * rotationMultiplier;

      // Moons
      planet.moonObjects.forEach((moon) => {
        moon.orbitGroup.rotation.y += delta * moon.data.orbitalSpeed * orbitMultiplier;
        moon.mesh.rotation.y += delta * moon.data.rotationSpeed * rotationMultiplier;
      });
    });
  }

  /**
   * Get all clickable meshes (for raycaster).
   */
  getClickables() {
    return this.clickables;
  }

  /**
   * Get all planet runtime objects.
   */
  getPlanets() {
    return this.planets;
  }
}
