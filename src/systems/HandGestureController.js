/**
 * HandGestureController.js — Real-time hand tracking via MediaPipe.
 *
 * Detects hand landmarks from the webcam video feed and translates
 * gestures into scene controls:
 *
 *   ✊ Pinch (thumb + index close)  →  zoom in / zoom out
 *   🖐️ Open palm                     →  visual feedback, no action
 *
 * Draws a neon-styled skeleton overlay on a transparent canvas so the
 * user can see their tracked hand.
 */
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ── MediaPipe hand landmark indices ──
const THUMB_TIP  = 4;
const INDEX_TIP  = 8;
const MIDDLE_TIP = 12;
const RING_TIP   = 16;
const PINKY_TIP  = 20;
const WRIST      = 0;

// Connections to draw the hand skeleton
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],           // thumb
  [0,5],[5,6],[6,7],[7,8],           // index
  [5,9],[9,10],[10,11],[11,12],      // middle
  [9,13],[13,14],[14,15],[15,16],    // ring
  [13,17],[0,17],[17,18],[18,19],[19,20], // pinky
];

// ── Configuration ──
const GESTURE_CONFIG = {
  /** Normalised distance below which a pinch is detected */
  pinchEngageThreshold: 0.08,
  /** Normalised distance above which a pinch is released */
  pinchReleaseThreshold: 0.11,
  /** Speed of zooming from dragging hand up/down */
  verticalDragSpeed: 6.0,
  /** Minimum frames of detection before acting (avoids flicker) */
  minDetectionFrames: 4,
  /** Colours */
  skeletonColor: 'rgba(0, 255, 220, 0.7)',
  jointColor: 'rgba(0, 255, 220, 0.9)',
  pinchActiveColor: 'rgba(255, 200, 0, 0.9)',
  pinchLineColor: 'rgba(255, 200, 0, 0.5)',
};

export class HandGestureController {
  /**
   * @param {HTMLVideoElement} videoElement — the webcam <video>
   * @param {Function} onZoom — callback: (scaleDelta: number) => void
   */
  constructor(videoElement, onZoom, onRotate) {
    this.video = videoElement;
    this.onZoom = onZoom;
    this.onRotate = onRotate;
    this.handLandmarker = null;
    this.isRunning = false;
    this.lastTimestamp = -1;

    // Pinch state machine
    this.isPinching = false;
    this.prevPinchY = null;
    this.smoothedDist = null;
    this.smoothedY = null;
    this.stableFrames = 0;

    // Palm / Rotate state
    this.prevOpenX = null;
    this.prevOpenY = null;

    // Overlay canvas
    this.canvas = null;
    this.ctx = null;

    // Gesture indicator element
    this.gestureIndicator = null;
  }

  // ─────────────── Lifecycle ───────────────

  async init() {
    try {
      this._showStatus('Loading hand tracking model…');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        numHands: 1,
        runningMode: 'VIDEO',
      });

      this._createOverlay();
      this._createGestureIndicator();
      this._showStatus('✋ Hand tracking ready');

      console.log('✅ Hand landmark model loaded');
    } catch (e) {
      console.error('Failed to init hand tracking:', e);
      this._showStatus('Hand tracking unavailable');
    }
  }

  start() {
    if (!this.handLandmarker) return;
    this.isRunning = true;
    this._detect();
    console.log('Hand gesture detection started');
  }

  stop() {
    this.isRunning = false;
    this.prevPinchY = null;
    this.isPinching = false;
    this.stableFrames = 0;
    this.prevOpenX = null;
    this.prevOpenY = null;
    if (this.canvas) { this.canvas.remove(); this.canvas = null; }
    if (this.gestureIndicator) { this.gestureIndicator.remove(); this.gestureIndicator = null; }
    console.log('Hand gesture detection stopped');
  }

  // ─────────────── Detection loop ───────────────

  _detect() {
    if (!this.isRunning || !this.handLandmarker) return;

    const now = performance.now();
    if (this.video.readyState >= 2 && now !== this.lastTimestamp) {
      this.lastTimestamp = now;
      try {
        const results = this.handLandmarker.detectForVideo(this.video, now);
        this._processResults(results);
      } catch (_) {
        // Occasional frame drops are okay
      }
    }

    requestAnimationFrame(() => this._detect());
  }

  _processResults(results) {
    if (!this.ctx) return;

    // Clear overlay
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!results.landmarks || results.landmarks.length === 0) {
      this.prevPinchY = null;
      this.isPinching = false;
      this.stableFrames = 0;
      this.prevOpenX = null;
      this.prevOpenY = null;
      this._updateGestureIndicator(null);
      return;
    }

    const landmarks = results.landmarks[0];

    // ── Draw hand ──
    this._drawSkeleton(landmarks);
    this._drawJoints(landmarks);

    // ── Pinch gesture detection ──
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_TIP];
    const rawDist = this._dist(thumbTip, indexTip);
    
    // Vertical position of the pinch
    const rawY = (thumbTip.y + indexTip.y) / 2;

    // Apply Exponential Moving Average (EMA) for reliable tracking
    if (this.smoothedDist === null) {
      this.smoothedDist = rawDist;
      this.smoothedY = rawY;
    } else {
      this.smoothedDist = this.smoothedDist * 0.6 + rawDist * 0.4;
      this.smoothedY = this.smoothedY * 0.6 + rawY * 0.4;
    }
    const dist = this.smoothedDist;
    const posY = this.smoothedY;

    // Draw pinch line
    this._drawPinchFeedback(thumbTip, indexTip, dist);

    // State machine
    if (!this.isPinching && dist < GESTURE_CONFIG.pinchEngageThreshold) {
      this.stableFrames++;
      if (this.stableFrames >= GESTURE_CONFIG.minDetectionFrames) {
        this.isPinching = true;
        this.prevPinchY = posY;
        this.prevOpenX = null;
        this.prevOpenY = null;
        this._updateGestureIndicator('pinch');
      }
    } else if (this.isPinching) {
      if (dist > GESTURE_CONFIG.pinchReleaseThreshold) {
        // Released pinch
        this.isPinching = false;
        this.prevPinchY = null;
        this.stableFrames = 0;
        this.prevOpenX = null;
        this.prevOpenY = null;
        this._updateGestureIndicator('open');
      } else {
        // Active pinch — Calculate vertical drag delta to zoom!
        if (this.prevPinchY !== null) {
          const deltaY = this.prevPinchY - posY;
          // deltaY is positive when moving hand UP, negative when DOWN
          this.onZoom(deltaY * GESTURE_CONFIG.verticalDragSpeed);
        }
        this.prevPinchY = posY;
        this._updateGestureIndicator('pinch');
      }
    } else {
      this.stableFrames = 0;
      this._updateGestureIndicator('open');

      // ── Palm rotation detection ──
      const handCenterX = landmarks[0].x; // Wrist is 0
      const handCenterY = landmarks[0].y;
      
      if (this.prevOpenX !== null && this.prevOpenY !== null) {
        const dx = handCenterX - this.prevOpenX;
        const dy = handCenterY - this.prevOpenY;
        
        // Threshold to avoid micro-jitter while resting hand
        if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) {
          if (this.onRotate) {
             // Multiplied by canvas dims to act like pixel panning
             // dx is inverted because webcam mirrors the user
            this.onRotate(-dx * this.canvas.width * 2.0, dy * this.canvas.height * 2.0);
          }
        }
      }
      this.prevOpenX = handCenterX;
      this.prevOpenY = handCenterY;
    }
  }

  // ─────────────── Drawing ───────────────

  _createOverlay() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2',
      pointerEvents: 'none',
      transform: 'scaleX(-1)',  // mirror to match webcam
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    this._resizeHandler = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  _drawSkeleton(landmarks) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.strokeStyle = GESTURE_CONFIG.skeletonColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    HAND_CONNECTIONS.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      ctx.beginPath();
      ctx.moveTo(pa.x * w, pa.y * h);
      ctx.lineTo(pb.x * w, pb.y * h);
      ctx.stroke();
    });
  }

  _drawJoints(landmarks) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    landmarks.forEach((lm, i) => {
      const isTip = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP].includes(i);
      const radius = isTip ? 6 : 3;

      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, radius, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? GESTURE_CONFIG.jointColor : GESTURE_CONFIG.skeletonColor;
      ctx.fill();

      // Glow on fingertips
      if (isTip) {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 220, 0.15)';
        ctx.fill();
      }
    });
  }

  _drawPinchFeedback(thumb, index, dist) {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const tx = thumb.x * w;
    const ty = thumb.y * h;
    const ix = index.x * w;
    const iy = index.y * h;
    const midX = (tx + ix) / 2;
    const midY = (ty + iy) / 2;

    const isPinching = dist < GESTURE_CONFIG.pinchEngageThreshold;

    // Draw line between thumb and index
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ix, iy);
    ctx.strokeStyle = isPinching
      ? GESTURE_CONFIG.pinchActiveColor
      : GESTURE_CONFIG.pinchLineColor;
    ctx.lineWidth = isPinching ? 3 : 1.5;
    ctx.stroke();

    // Draw circle at midpoint — size proportional to distance
    const circleRadius = Math.max(4, dist * 120);
    ctx.beginPath();
    ctx.arc(midX, midY, circleRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isPinching
      ? GESTURE_CONFIG.pinchActiveColor
      : 'rgba(255, 200, 0, 0.3)';
    ctx.lineWidth = isPinching ? 2.5 : 1;
    ctx.stroke();

    if (isPinching) {
      // Pulsing glow when actively pinching
      ctx.beginPath();
      ctx.arc(midX, midY, circleRadius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 0, 0.1)';
      ctx.fill();
    }
  }

  // ─────────────── Gesture indicator ───────────────

  _createGestureIndicator() {
    this.gestureIndicator = document.createElement('div');
    Object.assign(this.gestureIndicator.style, {
      position: 'fixed',
      top: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      color: '#00ffdc',
      fontFamily: "'Orbitron', 'JetBrains Mono', monospace",
      fontSize: '13px',
      fontWeight: '600',
      letterSpacing: '1px',
      padding: '8px 20px',
      borderRadius: '20px',
      border: '1px solid rgba(0, 255, 220, 0.3)',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.3s ease, background 0.3s ease, color 0.3s ease',
    });
    document.body.appendChild(this.gestureIndicator);
  }

  _updateGestureIndicator(state) {
    if (!this.gestureIndicator) return;

    if (state === 'pinch') {
      this.gestureIndicator.textContent = '🤏 PINCH & DRAG TO ZOOM';
      this.gestureIndicator.style.color = '#ffc800';
      this.gestureIndicator.style.borderColor = 'rgba(255, 200, 0, 0.5)';
      this.gestureIndicator.style.opacity = '1';
    } else if (state === 'open') {
      this.gestureIndicator.textContent = '✋ DRAG PALM TO PAN AROUND';
      this.gestureIndicator.style.color = '#00ffdc';
      this.gestureIndicator.style.borderColor = 'rgba(0, 255, 220, 0.3)';
      this.gestureIndicator.style.opacity = '0.8';
    } else {
      this.gestureIndicator.style.opacity = '0';
    }
  }

  // ─────────────── Status toast ───────────────

  _showStatus(message) {
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      top: '130px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      fontSize: '13px',
      padding: '8px 20px',
      borderRadius: '20px',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.4s ease',
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = '1'));
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 2500);
  }

  // ─────────────── Utilities ───────────────

  /** Normalised Euclidean distance between two landmarks */
  _dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
