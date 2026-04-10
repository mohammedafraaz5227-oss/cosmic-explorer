/**
 * WebXRManager.js — Optional AR mode via WebXR Device API.
 * Gracefully detects support and provides a toggle.
 */
import * as THREE from 'three';

export class WebXRManager {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.session = null;
    this.arToggle = document.getElementById('ar-toggle');

    this._init();
  }

  async _init() {
    // Check WebXR AR support
    if (!navigator.xr) {
      console.log('WebXR not available — AR mode disabled');
      return;
    }

    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (supported) {
        this.arToggle.classList.remove('hidden');
        this.arToggle.addEventListener('click', () => this.toggleAR());
        console.log('WebXR AR supported — toggle visible');
      } else {
        console.log('WebXR AR not supported on this device');
      }
    } catch (e) {
      console.log('WebXR check failed:', e.message);
    }
  }

  async toggleAR() {
    if (this.session) {
      await this.session.end();
      this.session = null;
      this.arToggle.querySelector('span').textContent = '📱';
      return;
    }

    try {
      // Enable XR on the renderer
      this.renderer.xr.enabled = true;

      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'local-floor'],
        optionalFeatures: ['dom-overlay'],
      });

      this.session = session;
      this.renderer.xr.setSession(session);
      this.arToggle.querySelector('span').textContent = '🔙';

      // Scale scene down considerably for AR (room scale)
      this.scene.scale.setScalar(0.02);

      session.addEventListener('end', () => {
        this.session = null;
        this.renderer.xr.enabled = false;
        this.scene.scale.setScalar(1);
        this.arToggle.querySelector('span').textContent = '📱';
      });

      console.log('AR session started');
    } catch (e) {
      console.error('Failed to start AR:', e);
    }
  }
}
