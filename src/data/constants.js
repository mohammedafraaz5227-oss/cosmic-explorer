/**
 * constants.js — Global configuration for scene, camera, and simulation.
 */

export const SCENE_CONFIG = {
  // Renderer
  antialias: true,
  toneMapping: 'ACESFilmic',
  toneMappingExposure: 1.2,
  pixelRatioMax: 2,

  // Camera defaults
  camera: {
    fov: 55,
    near: 0.1,
    far: 5000,
    // Overview position
    defaultPosition: { x: 20, y: 40, z: 80 },
    defaultTarget: { x: 0, y: 0, z: 0 },
  },

  // Controls
  controls: {
    dampingFactor: 0.08,
    minDistance: 3,
    maxDistance: 300,
    autoRotateSpeed: 0.3,
    enablePan: true,
    panSpeed: 0.5,
    rotateSpeed: 0.6,
    zoomSpeed: 1.2,
  },

  // Time
  time: {
    orbitMultiplier: 0.1,     // Global orbit speed scale
    rotationMultiplier: 1.0,  // Global rotation speed scale
  },

  // Starfield
  starfield: {
    count: 12000,
    radius: 1500,
    layers: 3,
  },

  // Asteroid belt
  asteroidBelt: {
    count: 2500,
    innerRadius: 26,    // Between Mars and Jupiter
    outerRadius: 32,
    heightSpread: 1.5,
    minSize: 0.02,
    maxSize: 0.1,
  },

  // Orbit lines
  orbitSegments: 128,
  orbitOpacity: 0.15,

  // Atmosphere glow
  atmosphereScale: 1.15,
  atmosphereOpacity: 0.25,

  // Camera animation
  flyTo: {
    duration: 2.0,
    ease: 'power3.inOut',
    offsetMultiplier: 3.5,   // Camera distance = planet radius * this
  },

  // FPS counter
  fpsUpdateInterval: 500,    // ms
};
