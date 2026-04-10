/**
 * SceneSetup.js — Initializes the Three.js renderer, camera, controls, and lighting.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_CONFIG } from '../data/constants.js';

export class SceneSetup {
  /**
   * @param {HTMLElement} container — DOM element to mount the canvas
   */
  constructor(container) {
    this.container = container;

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      antialias: SCENE_CONFIG.antialias,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, SCENE_CONFIG.pixelRatioMax));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = SCENE_CONFIG.toneMappingExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false; // Skip shadows for performance
    this.container.appendChild(this.renderer.domElement);

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020408);

    // ── Camera ──
    const { fov, near, far, defaultPosition } = SCENE_CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(
      fov,
      window.innerWidth / window.innerHeight,
      near,
      far
    );
    this.camera.position.set(
      defaultPosition.x,
      defaultPosition.y,
      defaultPosition.z
    );

    // ── Controls ──
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const c = SCENE_CONFIG.controls;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = c.dampingFactor;
    this.controls.minDistance = c.minDistance;
    this.controls.maxDistance = c.maxDistance;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = c.autoRotateSpeed;
    this.controls.enablePan = c.enablePan;
    this.controls.panSpeed = c.panSpeed;
    this.controls.rotateSpeed = c.rotateSpeed;
    this.controls.zoomSpeed = c.zoomSpeed;
    
    // Add WASD keys for panning
    this.controls.listenToKeyEvents(window);
    this.controls.keys = {
      LEFT: 'KeyA',
      UP: 'KeyW',
      RIGHT: 'KeyD',
      BOTTOM: 'KeyS'
    };
    this.controls.keyPanSpeed = 15.0;

    // ── Lighting ──
    // Ambient — brighter for better visibility of dark sides
    this.ambientLight = new THREE.AmbientLight(0x2a3040, 1.2);
    this.scene.add(this.ambientLight);

    // Hemisphere light - adds a nice color gradient to planets based on "up" vs "down"
    this.hemiLight = new THREE.HemisphereLight(0xe6f0ff, 0x080820, 1.0);
    this.scene.add(this.hemiLight);

    // Sun point light — main illumination from the center
    this.sunLight = new THREE.PointLight(0xfffff0, 3.5, 0, 0.5);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);

    // Secondary fill — subtle top/side light for depth modeling
    this.fillLight = new THREE.DirectionalLight(0x556688, 0.8);
    this.fillLight.position.set(30, 50, 30);
    this.scene.add(this.fillLight);

    // ── Resize handler ──
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Call every frame before rendering.
   */
  update() {
    this.controls.update();
  }

  /**
   * Render the scene.
   */
  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
