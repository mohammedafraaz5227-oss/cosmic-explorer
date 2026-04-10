/**
 * UIManager.js — Manages HUD elements, planet info panel, labels, loading, and FPS.
 */
import * as THREE from 'three';
import { SCENE_CONFIG } from '../data/constants.js';

export class UIManager {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(camera, renderer) {
    this.camera = camera;
    this.renderer = renderer;

    // DOM elements
    this.loadingScreen = document.getElementById('loading-screen');
    this.loaderProgress = document.getElementById('loader-progress');
    this.loaderPercent = document.getElementById('loader-percent');
    this.planetPanel = document.getElementById('planet-panel');
    this.planetPanelClose = document.getElementById('planet-panel-close');
    this.hudFps = document.getElementById('hud-fps');
    this.hudObjects = document.getElementById('hud-objects');
    this.labelsContainer = document.getElementById('planet-labels');

    // Planet panel fields
    this.elPlanetName = document.getElementById('planet-name');
    this.elPlanetIcon = document.getElementById('planet-icon');
    this.elRadius = document.getElementById('stat-radius');
    this.elDistance = document.getElementById('stat-distance');
    this.elOrbital = document.getElementById('stat-orbital');
    this.elRotation = document.getElementById('stat-rotation');
    this.elGravity = document.getElementById('stat-gravity');
    this.elTemp = document.getElementById('stat-temp');
    this.elAtmosphere = document.getElementById('stat-atmosphere');
    this.elMoons = document.getElementById('stat-moons');
    this.askAiBtn = document.getElementById('ask-ai-btn');

    // State
    this.selectedPlanet = null;
    this.labels = [];
    this.fpsFrames = 0;
    this.fpsTime = 0;

    // Event listeners
    this.planetPanelClose.addEventListener('click', () => this.hidePlanetPanel());
  }

  // ── Loading Screen ──

  /**
   * Update loading progress.
   * @param {number} percent — 0 to 100
   */
  setLoadingProgress(percent) {
    const p = Math.min(100, Math.max(0, percent));
    this.loaderProgress.style.width = `${p}%`;
    this.loaderPercent.textContent = `${Math.round(p)}%`;
  }

  /**
   * Fade out and remove loading screen.
   */
  hideLoadingScreen() {
    this.loadingScreen.style.opacity = '0';
    setTimeout(() => {
      this.loadingScreen.style.display = 'none';
    }, 1000);
  }

  // ── Planet Info Panel ──

  /**
   * Show the planet info panel populated with data.
   * @param {Object} planetData — from planetData.js
   */
  showPlanetPanel(planetData) {
    this.selectedPlanet = planetData;

    this.elPlanetName.textContent = planetData.name;

    // Color swatch
    const color = new THREE.Color(planetData.color || planetData.emissiveColor || 0xffffff);
    this.elPlanetIcon.style.background = `radial-gradient(circle, #${color.getHexString()}, #${new THREE.Color(planetData.emissive || 0x000000).getHexString()})`;
    this.elPlanetIcon.style.width = '50px';
    this.elPlanetIcon.style.height = '50px';
    this.elPlanetIcon.style.borderRadius = '50%';
    this.elPlanetIcon.style.boxShadow = `0 0 15px #${color.getHexString()}40`;

    // Populate stats
    const d = planetData.data;
    this.elRadius.textContent = d.radius;
    this.elDistance.textContent = d.distance;
    this.elOrbital.textContent = d.orbitalPeriod;
    this.elRotation.textContent = d.rotation;
    this.elGravity.textContent = d.gravity;
    this.elTemp.textContent = d.temperature;
    this.elAtmosphere.textContent = d.atmosphere;
    this.elMoons.textContent = d.moons;

    this.planetPanel.classList.remove('hidden');
  }

  hidePlanetPanel() {
    this.planetPanel.classList.add('hidden');
    this.selectedPlanet = null;
  }

  /**
   * @returns {Object|null} — currently selected planet data, if any
   */
  getSelectedPlanet() {
    return this.selectedPlanet;
  }

  // ── Planet Labels (3D → 2D projection) ──

  /**
   * Initialize labels for planets.
   * @param {Array<Object>} planets — planet runtime objects from PlanetFactory
   */
  createLabels(planets) {
    this.labelPlanets = planets;
    this.labelsContainer.innerHTML = '';
    this.labels = [];

    planets.forEach((planet) => {
      const label = document.createElement('div');
      label.className = 'planet-label';
      label.textContent = planet.data.name;
      label.dataset.name = planet.data.name;
      this.labelsContainer.appendChild(label);
      this.labels.push({ element: label, planet });
    });
  }

  /**
   * Update label positions to follow planets on screen.
   * Call every frame.
   */
  updateLabels() {
    if (!this.labels.length) return;

    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    this.labels.forEach(({ element, planet }) => {
      // Get world position of the planet mesh
      const worldPos = new THREE.Vector3();
      planet.mesh.getWorldPosition(worldPos);

      // Project to screen
      const projected = worldPos.clone().project(this.camera);

      // Check if behind camera
      if (projected.z > 1) {
        element.style.display = 'none';
        return;
      }

      const x = (projected.x * halfW) + halfW;
      const y = -(projected.y * halfH) + halfH;

      // Offset label above planet
      const offsetY = -30;
      element.style.left = `${x}px`;
      element.style.top = `${y + offsetY}px`;
      element.style.display = 'block';

      // Fade based on distance
      const dist = worldPos.distanceTo(this.camera.position);
      const opacity = THREE.MathUtils.clamp(1 - dist / 200, 0.1, 0.9);
      element.style.opacity = opacity;
    });
  }

  // ── FPS Counter ──

  /**
   * Track FPS.
   * @param {number} delta — frame delta in seconds
   */
  updateFPS(delta) {
    this.fpsFrames++;
    this.fpsTime += delta * 1000; // Convert to ms

    if (this.fpsTime >= SCENE_CONFIG.fpsUpdateInterval) {
      const fps = Math.round((this.fpsFrames / this.fpsTime) * 1000);
      this.hudFps.textContent = `${fps} FPS`;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  /**
   * Update object count display.
   * @param {THREE.Scene} scene
   */
  updateObjectCount(scene) {
    const info = this.renderer.info;
    const triangles = info.render.triangles;
    const calls = info.render.calls;
    this.hudObjects.textContent = `${calls} draws · ${(triangles / 1000).toFixed(1)}k △`;
  }
}
