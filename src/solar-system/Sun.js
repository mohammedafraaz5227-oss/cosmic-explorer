/**
 * Sun.js — Emissive sun mesh with animated corona glow and pulsing light.
 */
import * as THREE from 'three';
import { SUN_DATA } from '../data/planetData.js';

export class Sun {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.userData = { name: 'Sun', type: 'star', planetData: SUN_DATA };
    this.time = 0;

    this._createSunMesh();
    this._createCorona();
    this._createGlowSprite();

    this.scene.add(this.group);
  }

  _createSunMesh() {
    const geometry = new THREE.SphereGeometry(SUN_DATA.visualRadius, 64, 64);

    // Procedural sun texture via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base gradient
    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, '#fff8e0');
    grad.addColorStop(0.3, '#ffcc33');
    grad.addColorStop(0.6, '#ff9900');
    grad.addColorStop(0.85, '#ff6600');
    grad.addColorStop(1, '#cc3300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Add noise-like granulation
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = Math.random() * 3;
      const alpha = Math.random() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffdd44,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.userData = { name: 'Sun', type: 'star', planetData: SUN_DATA };
    this.group.add(this.mesh);
  }

  _createCorona() {
    // Multiple semi-transparent shells for corona effect
    const coronaColors = [0xffaa33, 0xff8800, 0xff6600];
    const coronaScales = [1.15, 1.25, 1.4];

    this.coronas = [];

    coronaColors.forEach((color, i) => {
      const geo = new THREE.SphereGeometry(SUN_DATA.visualRadius * coronaScales[i], 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.08 - i * 0.02,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const coronaMesh = new THREE.Mesh(geo, mat);
      this.group.add(coronaMesh);
      this.coronas.push(coronaMesh);
    });
  }

  _createGlowSprite() {
    // Soft glow disc behind the sun
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 200, 50, 0.6)');
    grad.addColorStop(0.3, 'rgba(255, 150, 30, 0.3)');
    grad.addColorStop(0.6, 'rgba(255, 100, 0, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.glow = new THREE.Sprite(material);
    this.glow.scale.set(25, 25, 1);
    this.group.add(this.glow);
  }

  /**
   * Animate corona pulsing and sun rotation.
   * @param {number} elapsed — total elapsed time
   * @param {number} delta — frame delta
   */
  update(elapsed, delta) {
    this.time = elapsed;

    // Rotate sun slowly
    this.mesh.rotation.y += delta * 0.05;

    // Pulse corona
    this.coronas.forEach((corona, i) => {
      const pulse = 1.0 + Math.sin(elapsed * (1.5 + i * 0.5)) * 0.03;
      corona.scale.setScalar(pulse);
      corona.material.opacity = (0.08 - i * 0.02) + Math.sin(elapsed * 2 + i) * 0.01;
    });

    // Pulse glow sprite
    const glowPulse = 25 + Math.sin(elapsed * 1.2) * 2;
    this.glow.scale.set(glowPulse, glowPulse, 1);
  }

  /** @returns {THREE.Mesh} — the clickable sun mesh */
  getMesh() {
    return this.mesh;
  }
}
