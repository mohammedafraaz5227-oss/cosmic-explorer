/**
 * AsteroidBelt.js — InstancedMesh asteroid belt between Mars and Jupiter.
 * Uses instancing for maximum performance (1 draw call for 2500 asteroids).
 */
import * as THREE from 'three';
import { SCENE_CONFIG } from '../data/constants.js';

export class AsteroidBelt {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this._create();
  }

  _create() {
    const {
      count,
      innerRadius,
      outerRadius,
      heightSpread,
      minSize,
      maxSize,
    } = SCENE_CONFIG.asteroidBelt;

    // Use a small irregular shape — dodecahedron at low detail
    const baseGeometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8a8070,
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true,
    });

    this.instancedMesh = new THREE.InstancedMesh(baseGeometry, material, count);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Random position in a ring
      const angle = Math.random() * Math.PI * 2;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const y = (Math.random() - 0.5) * heightSpread;

      dummy.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );

      // Random rotation for each asteroid
      dummy.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Random scale
      const scale = minSize + Math.random() * (maxSize - minSize);
      dummy.scale.setScalar(scale);

      dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, dummy.matrix);

      // Per-instance color variation
      const brightness = 0.3 + Math.random() * 0.3;
      color.setRGB(brightness + 0.05, brightness, brightness - 0.03);
      this.instancedMesh.setColorAt(i, color);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    this.instancedMesh.frustumCulled = false; // Belt is always partially in view

    this.scene.add(this.instancedMesh);
  }

  /**
   * Slowly rotate the entire belt for visual effect.
   * @param {number} delta
   */
  update(delta) {
    this.instancedMesh.rotation.y += delta * 0.003;
  }
}
