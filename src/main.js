/**
 * main.js — Entry point for Cosmic Explorer.
 *
 * Bootstraps the Three.js scene, creates all modules,
 * and runs the animation loop.
 */
import * as THREE from 'three';
import { SceneSetup } from './systems/SceneSetup.js';
import { Starfield } from './systems/Starfield.js';
import { Sun } from './solar-system/Sun.js';
import { PlanetFactory } from './solar-system/PlanetFactory.js';
import { OrbitLines } from './solar-system/OrbitLines.js';
import { AsteroidBelt } from './solar-system/AsteroidBelt.js';
import { Raycaster } from './interaction/Raycaster.js';
import { CameraController } from './interaction/CameraController.js';
import { UIManager } from './ui/UIManager.js';
import { AIChat } from './ui/AIChat.js';
import { WebcamAR } from './systems/WebcamAR.js';

class CosmicExplorer {
  constructor() {
    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this._init();
  }

  _init() {
    // ── Scene setup ──
    const container = document.getElementById('canvas-container');
    this.sceneSetup = new SceneSetup(container);
    const { scene, camera, renderer, controls } = this.sceneSetup;

    // ── UI Manager ──
    this.ui = new UIManager(camera, renderer);
    this.ui.setLoadingProgress(10);

    // ── Starfield ──
    this.starfield = new Starfield(scene);
    this.ui.setLoadingProgress(25);

    // ── Sun ──
    this.sun = new Sun(scene);
    this.ui.setLoadingProgress(35);

    // ── Orbit lines ──
    this.orbitLines = new OrbitLines(scene);
    this.ui.setLoadingProgress(45);

    // ── Planets ──
    this.planetFactory = new PlanetFactory(scene);
    this.ui.setLoadingProgress(65);

    // ── Asteroid belt ──
    this.asteroidBelt = new AsteroidBelt(scene);
    this.ui.setLoadingProgress(80);

    // ── Camera controller ──
    this.cameraController = new CameraController(camera, controls);

    // ── Raycasting ──
    const allClickables = [
      this.sun.getMesh(),
      ...this.planetFactory.getClickables(),
    ];

    this.raycaster = new Raycaster(
      camera,
      renderer.domElement,
      allClickables,
      (planetData, mesh) => this._onPlanetSelected(planetData, mesh)
    );
    this.ui.setLoadingProgress(90);

    // ── Labels ──
    this.ui.createLabels(this.planetFactory.getPlanets());

    // ── AI Chat ──
    this.aiChat = new AIChat();

    // ── Webcam AR ──
    this.webcamAR = new WebcamAR(renderer, scene, camera, this.starfield);

    // ── Reset camera button ──
    document.getElementById('reset-camera').addEventListener('click', () => {
      this.cameraController.resetToOverview();
      this.ui.hidePlanetPanel();
    });

    // ── Finish loading ──
    this.ui.setLoadingProgress(100);
    setTimeout(() => {
      this.ui.hideLoadingScreen();
    }, 800);

    // ── Start animation loop ──
    this._animate();
  }

  /**
   * Called when a planet/sun is clicked.
   */
  _onPlanetSelected(planetData, mesh) {
    // Fly camera to the planet
    this.cameraController.flyTo(mesh);

    // Show info panel
    this.ui.showPlanetPanel(planetData);

    // Update AI chat context
    this.aiChat.setContext(planetData);
  }

  /**
   * Main animation loop.
   */
  _animate() {
    requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();
    this.elapsed += delta;

    // Update all systems
    this.sceneSetup.update();
    this.starfield.update(delta);
    this.sun.update(this.elapsed, delta);
    this.planetFactory.update(this.elapsed, delta);
    this.asteroidBelt.update(delta);
    
    // Smooth camera tracking
    this.cameraController.update();

    // Update UI
    this.ui.updateLabels();
    this.ui.updateFPS(delta);
    this.ui.updateObjectCount(this.sceneSetup.scene);

    // Render
    this.sceneSetup.render();
  }
}

// ── Bootstrap ──
window.addEventListener('DOMContentLoaded', () => {
  new CosmicExplorer();
});
