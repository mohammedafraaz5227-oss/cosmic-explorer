/**
 * WebcamAR.js — Pseudo-AR experience using the device webcam.
 *
 * Replaces the starfield background with the live camera feed and overlays
 * the 3D solar system on top.  Supports multiple input methods:
 *
 *   📷 Webcam hand gestures (pinch-to-zoom via MediaPipe)
 *   🤏 Touch pinch-to-zoom (mobile / trackpad)
 *   🖱️ Scroll-wheel zoom (desktop)
 */
import * as THREE from 'three';
import { HandGestureController } from './HandGestureController.js';

// ── AR configuration ──
const AR_CONFIG = {
  /** Base scale applied when entering AR (1.0 = same as desktop view) */
  defaultScale: 0.35,
  /** Smallest allowed scale via any zoom method */
  minScale: 0.02,
  /** Largest allowed scale via any zoom method */
  maxScale: 6.0,
  /** Speed multiplier for touch-pinch gestures */
  pinchSensitivity: 0.004,
};

export class WebcamAR {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {Object} starfield — Starfield instance (layers hidden in AR)
   */
  constructor(renderer, scene, camera, starfield, controls) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.starfield = starfield;
    this.controls = controls;

    this.isActive = false;
    this.video = null;
    this.stream = null;
    this.originalBackground = this.scene.background;
    this.originalScale = new THREE.Vector3().copy(this.scene.scale);

    // Scale state
    this.currentScale = AR_CONFIG.defaultScale;

    // Touch-pinch state
    this._prevPinchDist = 0;
    this._pinchActive = false;

    // Hand gesture controller (initialised lazily on first AR session)
    this.handGesture = null;

    this.arToggle = document.getElementById('ar-toggle');

    // Bound handlers
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onWheel = this._handleWheel.bind(this);

    this._init();
  }

  // ─────────────────── initialisation ───────────────────

  _init() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log('Webcam API not supported — AR mode disabled');
      return;
    }

    this.arToggle.classList.remove('hidden');
    this.arToggle.querySelector('span').textContent = '📷';
    this.arToggle.addEventListener('click', () => this.toggleAR());
    console.log('Webcam AR available — toggle visible');
  }

  // ─────────────────── toggle ───────────────────

  async toggleAR() {
    if (this.isActive) {
      this._stopAR();
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // ── Video element (behind canvas) ──
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = true;
      Object.assign(this.video.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        objectFit: 'cover',
        zIndex: '-1',
        transform: 'scaleX(-1)',  // mirror for front-facing camera
      });
      document.body.appendChild(this.video);

      // Wait for video to start playing
      await new Promise((resolve) => {
        this.video.onloadeddata = resolve;
      });

      // ── Transparent canvas ──
      this.scene.background = null;

      // ── Hide starfield ──
      if (this.starfield?.layers) {
        this.starfield.layers.forEach((l) => (l.visible = false));
      }

      // ── Apply AR scale ──
      this.currentScale = AR_CONFIG.defaultScale;
      this.scene.scale.setScalar(this.currentScale);

      // ── Attach touch / scroll listeners ──
      this._addGestureListeners();

      // ── Initialise hand gesture tracking ──
      await this._startHandTracking();

      // ── Update button ──
      this.arToggle.querySelector('span').textContent = '🔙';
      this.isActive = true;

      this._showToast('🤏 Pinch and drag UP/DOWN in air to zoom · Touch-pinch also works');

      console.log('Webcam AR session started');
    } catch (e) {
      console.error('Failed to start Webcam AR:', e);
      alert(
        `Could not access webcam: ${e.message}\nPlease allow camera access in your browser settings.`
      );
    }
  }

  _stopAR() {
    // ── Stop hand tracking ──
    if (this.handGesture) {
      this.handGesture.stop();
    }

    // ── Stop camera ──
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.remove();
      this.video = null;
    }

    // ── Restore scene ──
    this.scene.background = this.originalBackground;
    if (this.starfield?.layers) {
      this.starfield.layers.forEach((l) => (l.visible = true));
    }
    this.scene.scale.copy(this.originalScale);

    // ── Remove touch / scroll listeners ──
    this._removeGestureListeners();

    // ── Reset button ──
    this.arToggle.querySelector('span').textContent = '📷';
    this.isActive = false;

    console.log('Webcam AR session ended');
  }

  // ─────────────────── hand tracking ───────────────────

  async _startHandTracking() {
    if (!this.video) return;

    this.handGesture = new HandGestureController(
      this.video,
      (delta) => this._applyZoom(delta),
      (dx, dy) => this._applyRotation(dx, dy)
    );

    await this.handGesture.init();
    this.handGesture.start();
  }

  // ─────────────────── zoom (shared by all inputs) ───────────────────

  _applyZoom(delta) {
    this.currentScale += delta;
    this.currentScale = THREE.MathUtils.clamp(
      this.currentScale,
      AR_CONFIG.minScale,
      AR_CONFIG.maxScale
    );
    this.scene.scale.setScalar(this.currentScale);
  }

  _applyRotation(dx, dy) {
    if (!this.controls) return;
    const speed = 0.005;
    
    // Convert current camera position to spherical coordinates relative to the target
    const cartesian = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(cartesian);
    
    // Apply deltas
    spherical.theta -= dx * speed;
    spherical.phi -= dy * speed;
    
    // Prevent the camera from doing a backflip over the poles
    spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
    
    // Back to cartesian
    this.camera.position.setFromSpherical(spherical).add(this.controls.target);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  // ─────────────────── touch & scroll gestures ───────────────────

  _addGestureListeners() {
    const el = this.renderer.domElement;
    el.addEventListener('touchstart', this._onTouchStart, { passive: false });
    el.addEventListener('touchmove', this._onTouchMove, { passive: false });
    el.addEventListener('touchend', this._onTouchEnd);
    el.addEventListener('wheel', this._onWheel, { passive: false });
  }

  _removeGestureListeners() {
    const el = this.renderer.domElement;
    el.removeEventListener('touchstart', this._onTouchStart);
    el.removeEventListener('touchmove', this._onTouchMove);
    el.removeEventListener('touchend', this._onTouchEnd);
    el.removeEventListener('wheel', this._onWheel);
  }

  _handleTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this._prevPinchDist = this._touchDistance(e.touches[0], e.touches[1]);
      this._pinchActive = true;
    }
  }

  _handleTouchMove(e) {
    if (!this._pinchActive || e.touches.length !== 2) return;
    e.preventDefault();
    const dist = this._touchDistance(e.touches[0], e.touches[1]);
    const delta = dist - this._prevPinchDist;
    this._prevPinchDist = dist;
    this._applyZoom(delta * AR_CONFIG.pinchSensitivity);
  }

  _handleTouchEnd(e) {
    if (e.touches.length < 2) this._pinchActive = false;
  }

  _handleWheel(e) {
    if (!this.isActive) return;
    e.preventDefault();
    this._applyZoom(-e.deltaY * 0.0008);
  }

  // ─────────────────── helpers ───────────────────

  _touchDistance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      color: '#fff',
      padding: '10px 24px',
      borderRadius: '24px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      zIndex: '9999',
      opacity: '0',
      transition: 'opacity 0.4s ease',
      pointerEvents: 'none',
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = '1'));
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }
}
