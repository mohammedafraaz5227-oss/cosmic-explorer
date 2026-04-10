/**
 * OrbitLines.js — Renders orbital path rings for each planet.
 */
import * as THREE from 'three';
import { PLANETS } from '../data/planetData.js';
import { SCENE_CONFIG } from '../data/constants.js';

export class OrbitLines {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    this.lines = [];
    this._create();
  }

  _create() {
    PLANETS.forEach((planet) => {
      const segments = SCENE_CONFIG.orbitSegments;
      const radius = planet.visualDistance;

      const points = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        ));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x3355aa,
        transparent: true,
        opacity: SCENE_CONFIG.orbitOpacity,
        depthWrite: false,
      });

      const line = new THREE.Line(geometry, material);
      this.scene.add(line);
      this.lines.push(line);
    });
  }
}
