/**
 * Starfield.js — Multi-layer particle starfield for deep-space background.
 */
import * as THREE from 'three';
import { SCENE_CONFIG } from '../data/constants.js';

export class Starfield {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
    this._create();
  }

  _create() {
    const { count, radius, layers } = SCENE_CONFIG.starfield;
    const perLayer = Math.floor(count / layers);

    for (let l = 0; l < layers; l++) {
      const positions = new Float32Array(perLayer * 3);
      const colors = new Float32Array(perLayer * 3);
      const sizes = new Float32Array(perLayer);

      const layerRadius = radius * (0.6 + l * 0.3); // Each layer is further out

      for (let i = 0; i < perLayer; i++) {
        // Uniform spherical distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = layerRadius * (0.8 + Math.random() * 0.2);

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        // Star color variation — blue/white/yellow tints
        const colorChoice = Math.random();
        if (colorChoice < 0.15) {
          // Blue-white (hot stars)
          colors[i * 3] = 0.7 + Math.random() * 0.3;
          colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
          colors[i * 3 + 2] = 1.0;
        } else if (colorChoice < 0.25) {
          // Yellow-orange (cool stars)
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
          colors[i * 3 + 2] = 0.4 + Math.random() * 0.3;
        } else {
          // White (majority)
          const brightness = 0.6 + Math.random() * 0.4;
          colors[i * 3] = brightness;
          colors[i * 3 + 1] = brightness;
          colors[i * 3 + 2] = brightness + Math.random() * 0.1;
        }

        sizes[i] = 0.5 + Math.random() * 2.0;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.8 + l * 0.3,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9 - l * 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      this.scene.add(points);
      this.layers.push(points);
    }
  }

  /**
   * Optional: subtle twinkle by rotating layers slowly.
   * @param {number} delta — frame delta time
   */
  update(delta) {
    this.layers.forEach((layer, i) => {
      layer.rotation.y += delta * 0.001 * (i + 1) * 0.3;
    });
  }
}
