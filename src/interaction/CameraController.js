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
    this.trackingMesh = null;
    this.lerpProgress = { value: 0 };
    this.startCamPos = new THREE.Vector3();
    this.startTargetPos = new THREE.Vector3();
  }

  /**
   * Called every frame from main loop
   */
  update() {
    if (this.trackingMesh && !this.isAnimating) {
      // Once arrived, permanently track the moving planet
      const currentPos = new THREE.Vector3();
      this.trackingMesh.getWorldPosition(currentPos);
      this.controls.target.copy(currentPos);
      this.controls.update();

      // We don't lock camera position, user can still rotate around it,
      // orbit controls naturally handles the camera moving if the target moves!
    } else if (this.isAnimating && this.trackingMesh && this.lerpProgress.value < 1) {
      // During flight, dynamically lerp to the moving destination
      const idealTarget = new THREE.Vector3();
      this.trackingMesh.getWorldPosition(idealTarget);
      
      const planetData = this.trackingMesh.userData.planetData;
      const radius = planetData?.visualRadius || 1;
      const offsetMultiplier = SCENE_CONFIG.flyTo.offsetMultiplier;
      
      const idealCamPos = new THREE.Vector3(
        idealTarget.x + radius * offsetMultiplier * 0.5,
        idealTarget.y + radius * offsetMultiplier * 0.4,
        idealTarget.z + radius * offsetMultiplier
      );

      this.camera.position.lerpVectors(this.startCamPos, idealCamPos, this.lerpProgress.value);
      this.controls.target.lerpVectors(this.startTargetPos, idealTarget, this.lerpProgress.value);
      this.controls.update();
    }
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

    this.trackingMesh = mesh;
    this.startCamPos.copy(this.camera.position);
    this.startTargetPos.copy(this.controls.target);
    this.lerpProgress.value = 0;

    // Get initial distance to scale duration
    const targetPos = new THREE.Vector3();
    mesh.getWorldPosition(targetPos);
    const travelDistance = this.camera.position.distanceTo(targetPos);
    
    let { duration, ease } = SCENE_CONFIG.flyTo;
    
    if (travelDistance > 50) {
      duration += Math.min(6.0, (travelDistance - 50) * 0.0125);
    }

    this.currentTimeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        this.lerpProgress.value = 1; // ensure we finish tracking cleanly
        onComplete?.();
      },
    });

    // Tween the progress value instead of fixed coordinates
    this.currentTimeline.to(this.lerpProgress, {
      value: 1,
      duration,
      ease,
    }, 0);

    this.isAnimating = true;
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
    this.trackingMesh = null; // stop tracking moving objects

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
