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

    this.textureLoader = new THREE.TextureLoader();

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
    // Increased segments for smoother spheres
    const geometry = new THREE.SphereGeometry(data.visualRadius, 64, 64);
    const texture = data.textureFile ? this.textureLoader.load(data.textureFile) : null;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    
    // Fallback colour if texture fails or isn't loaded
    const baseColor = texture ? 0xffffff : data.color;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: baseColor,
      // Adjusted materials for better visual pop under the new lighting
      roughness: 0.6,
      metalness: 0.15,
      emissive: new THREE.Color(data.emissive),
      emissiveIntensity: 0.3,
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
   * Atmosphere glow — a slightly larger semi-transparent sphere.
   */
  _createAtmosphere(data) {
    const atmoRadius = data.visualRadius * SCENE_CONFIG.atmosphereScale;
    const geometry = new THREE.SphereGeometry(atmoRadius, 32, 32);
    
    // Specific atmospheric textures for Earth and Venus if provided
    let material;
    if (data.atmosphereTexture) {
      const texture = this.textureLoader.load(data.atmosphereTexture);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (data.name === 'Earth') {
        // Earth clouds
        material = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
      } else {
        // Venus thick atmosphere
        material = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 0.95,
        });
      }
    } else {
      material = new THREE.MeshBasicMaterial({
        color: data.atmosphereColor,
        transparent: true,
        opacity: SCENE_CONFIG.atmosphereOpacity,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    }

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Saturn rings — flat RingGeometry with semi-transparent gradient or texture.
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
    
    let ringMaterial;
    if (data.ringTexture) {
      const texture = this.textureLoader.load(data.ringTexture);
      texture.colorSpace = THREE.SRGBColorSpace;
      
      ringMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        alphaMap: texture,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
    } else {
      // Fallback Procedural ring texture
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

      ringMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
    }

    const ringMesh = new THREE.Mesh(geometry, ringMaterial);
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

    const geometry = new THREE.SphereGeometry(moonData.visualRadius, 32, 32);
    const texture = moonData.textureFile ? this.textureLoader.load(moonData.textureFile) : null;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: texture ? 0xffffff : moonData.color,
      roughness: 0.7,
      metalness: 0.1,
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
