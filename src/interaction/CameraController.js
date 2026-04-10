/**
 * CameraController.js — GSAP-powered cinematic camera transitions.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { SCENE_CONFIG } from '../data/constants.js';

export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
   */
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.isAnimating = false;
    this.currentTimeline = null;
  }

  /**
   * Fly the camera to focus on a planet mesh.
   * @param {THREE.Mesh} mesh — the planet mesh to fly to
   * @param {Function} [onComplete] — callback when animation finishes
   */
  flyTo(mesh, onComplete) {
    if (this.isAnimating) {
      this.currentTimeline?.kill();
    }

    this.isAnimating = true;

    // Get the world position of the planet
    const targetPos = new THREE.Vector3();
    mesh.getWorldPosition(targetPos);

    // Calculate camera offset based on planet size
    const planetData = mesh.userData.planetData;
    const radius = planetData?.visualRadius || 1;
    const offset = radius * SCENE_CONFIG.flyTo.offsetMultiplier;

    // Position camera at an angle above and to the side
    const cameraTarget = new THREE.Vector3(
      targetPos.x + offset * 0.5,
      targetPos.y + offset * 0.4,
      targetPos.z + offset
    );

    // Calculate dynamic duration based on travel distance to emphasize scale!
    // Near planets will take ~2 seconds, distant exoplanets will take up to ~8 seconds.
    const travelDistance = this.camera.position.distanceTo(cameraTarget);
    let { duration, ease } = SCENE_CONFIG.flyTo;
    
    // Add 1 second of travel time for every 80 units of distance, up to a max of 8 seconds total.
    if (travelDistance > 50) {
      duration += Math.min(6.0, (travelDistance - 50) * 0.0125);
    }

    this.currentTimeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        onComplete?.();
      },
    });

    // Animate camera position
    this.currentTimeline.to(this.camera.position, {
      x: cameraTarget.x,
      y: cameraTarget.y,
      z: cameraTarget.z,
      duration,
      ease,
    }, 0);

    // Animate orbit controls target (what camera looks at)
    this.currentTimeline.to(this.controls.target, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration,
      ease,
      onUpdate: () => {
        this.controls.update();
      },
    }, 0);
  }

  /**
   * Reset camera to default overview position.
   * @param {Function} [onComplete]
   */
  resetToOverview(onComplete) {
    if (this.isAnimating) {
      this.currentTimeline?.kill();
    }

    this.isAnimating = true;

    const { defaultPosition, defaultTarget } = SCENE_CONFIG.camera;
    const { duration, ease } = SCENE_CONFIG.flyTo;

    this.currentTimeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        onComplete?.();
      },
    });

    this.currentTimeline.to(this.camera.position, {
      x: defaultPosition.x,
      y: defaultPosition.y,
      z: defaultPosition.z,
      duration: duration * 1.2,
      ease,
    }, 0);

    this.currentTimeline.to(this.controls.target, {
      x: defaultTarget.x,
      y: defaultTarget.y,
      z: defaultTarget.z,
      duration: duration * 1.2,
      ease,
      onUpdate: () => {
        this.controls.update();
      },
    }, 0);
  }

  /**
   * @returns {boolean} — true if camera is currently in a GSAP animation
   */
  get animating() {
    return this.isAnimating;
  }
}
