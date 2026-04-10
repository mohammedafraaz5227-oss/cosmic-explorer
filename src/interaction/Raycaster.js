/**
 * Raycaster.js — Click and hover detection on planet meshes.
 */
import * as THREE from 'three';

export class Raycaster {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement — renderer canvas
   * @param {Array<THREE.Mesh>} clickables — meshes to test against
   * @param {Function} onSelect — callback(planetData) when a planet is clicked
   */
  constructor(camera, domElement, clickables, onSelect) {
    this.camera = camera;
    this.domElement = domElement;
    this.clickables = clickables;
    this.onSelect = onSelect;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;

    this._onClick = this._onClick.bind(this);
    this._onMove = this._onMove.bind(this);

    this.domElement.addEventListener('click', this._onClick);
    this.domElement.addEventListener('pointermove', this._onMove);
  }

  _onClick(event) {
    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.clickables, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const data = hit.userData;
      if (data && data.planetData && this.onSelect) {
        this.onSelect(data.planetData, hit);
      }
    }
  }

  _onMove(event) {
    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.clickables, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (this.hoveredObject !== hit) {
        this._unhover();
        this.hoveredObject = hit;
        this.domElement.style.cursor = 'pointer';

        // Subtle emissive boost on hover
        if (hit.material && hit.material.emissiveIntensity !== undefined) {
          hit.userData._origEmissive = hit.material.emissiveIntensity;
          hit.material.emissiveIntensity = 0.4;
        }
      }
    } else {
      this._unhover();
    }
  }

  _unhover() {
    if (this.hoveredObject) {
      this.domElement.style.cursor = 'default';
      if (this.hoveredObject.material && this.hoveredObject.userData._origEmissive !== undefined) {
        this.hoveredObject.material.emissiveIntensity = this.hoveredObject.userData._origEmissive;
      }
      this.hoveredObject = null;
    }
  }

  _updateMouse(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  dispose() {
    this.domElement.removeEventListener('click', this._onClick);
    this.domElement.removeEventListener('pointermove', this._onMove);
  }
}
