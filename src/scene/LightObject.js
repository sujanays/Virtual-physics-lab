import * as THREE from 'three';
import { OpticalBenchScene } from './OpticalBenchScene.js';

export class LightObject {
  constructor(scene) {
    this.scene = scene;
    this.u = 40;       // cm distance to lens (z = -u)
    this.height = 8;   // cm
    this.type = 'Default Letter F'; // 'Default Letter F', 'Device Image (Uploaded)', 'Light Arrow', 'USAF Test Target', 'Point Source Grid'
    this.color = 0x22c55e;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Bench Rider Mount
    this.rider = OpticalBenchScene.createMountRider('OBJECT', 0x22c55e);
    this.group.add(this.rider);

    // Assembly that sits on top of rider at (0, 0, -u)
    this.assemblyGroup = new THREE.Group();
    this.group.add(this.assemblyGroup);

    // Reusable offscreen source canvas for screen & mirror projection
    this.sourceCanvas = document.createElement('canvas');
    this.sourceCanvas.width = 400;
    this.sourceCanvas.height = 400;
    this.sourceCtx = this.sourceCanvas.getContext('2d');

    // Custom uploaded image from device
    this.uploadedImage = null;
    this.uploadedImageName = '';

    // Texture for 3D plate
    this.plateTexture = new THREE.CanvasTexture(this.sourceCanvas);
    this.plateTexture.anisotropy = 4;

    this.renderSourceCanvas();
    this.rebuildObject();
    this.updatePosition();
  }

  setDistance(u) {
    this.u = Math.max(5, Math.min(100, u));
    this.updatePosition();
  }

  setHeight(h) {
    this.height = Math.max(1, Math.min(15, h));
    this.rebuildObject();
  }

  setType(type) {
    this.type = type;
    this.renderSourceCanvas();
    this.rebuildObject();
  }

  /**
   * Loads an image from user's device via FileReader or Image element
   */
  loadFromDevice(imageElement, fileName = 'uploaded_image.png') {
    this.uploadedImage = imageElement;
    this.uploadedImageName = fileName;
    this.type = 'Device Image (Uploaded)';
    this.renderSourceCanvas();
    this.rebuildObject();
  }

  updatePosition() {
    // Optical bench convention: element at z = 0, object at negative z = -u
    this.group.position.z = -this.u;
  }

  rebuildObject() {
    while (this.assemblyGroup.children.length > 0) {
      const child = this.assemblyGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.assemblyGroup.remove(child);
    }

    const h = this.height;

    if (this.type === 'Light Arrow') {
      this.buildLightArrow(h);
    } else if (this.type === 'Point Source Grid') {
      this.buildPointGrid(h);
    } else {
      // Default Letter F, Device Image, or USAF Target: 3D illuminated slide target
      this.buildImageSlidePlate(h);
    }

    // Height indicator tick marks
    const rulerStemGeo = new THREE.CylinderGeometry(0.08, 0.08, h, 8);
    const rulerStemMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
    const rulerStem = new THREE.Mesh(rulerStemGeo, rulerStemMat);
    rulerStem.position.set(-0.8, h / 2, 0);
    this.assemblyGroup.add(rulerStem);
  }

  /**
   * 3D illuminated target slide plate representing the physical object on the bench
   */
  buildImageSlidePlate(h) {
    const boxGroup = new THREE.Group();
    const size = Math.max(h * 1.15, 5);

    // Target Box Bezel
    const boxGeo = new THREE.BoxGeometry(size, size, 1.2);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.8,
      roughness: 0.25
    });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.y = size / 2;
    boxMesh.castShadow = true;
    boxGroup.add(boxMesh);

    // Target Texture Plate facing +Z (towards the optical element at z = 0)
    this.plateTexture.needsUpdate = true;
    const plateGeo = new THREE.PlaneGeometry(size * 0.9, size * 0.9);
    const plateMat = new THREE.MeshStandardMaterial({
      map: this.plateTexture,
      roughness: 0.2,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveMap: this.plateTexture,
      emissiveIntensity: 0.85,
      side: THREE.FrontSide
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, size / 2, 0.61);
    boxGroup.add(plateMesh);

    // Light source bracket & subtle glow
    const glow = new THREE.PointLight(0xffffff, 1.2, 35);
    glow.position.set(0, size / 2, 1.0);
    boxGroup.add(glow);

    // Support rod to rider
    const rodGeo = new THREE.CylinderGeometry(0.6, 0.6, 4, 16);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.y = 0;
    boxGroup.add(rodMesh);

    this.assemblyGroup.add(boxGroup);
  }

  buildLightArrow(h) {
    const arrowGroup = new THREE.Group();

    // Glowing Neon Material
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 2.5,
      roughness: 0.2,
      metalness: 0.1
    });

    const glowCoreMat = new THREE.MeshBasicMaterial({
      color: 0x86efac
    });

    // Arrow Shaft (from y = 0 to y = h * 0.72)
    const shaftHeight = h * 0.72;
    const shaftRadius = Math.max(0.18, h * 0.035);
    const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 24);
    const shaft = new THREE.Mesh(shaftGeo, neonMat);
    shaft.position.y = shaftHeight / 2;
    arrowGroup.add(shaft);

    // Glowing core
    const coreGeo = new THREE.CylinderGeometry(shaftRadius * 0.45, shaftRadius * 0.45, shaftHeight * 0.98, 16);
    const core = new THREE.Mesh(coreGeo, glowCoreMat);
    core.position.y = shaftHeight / 2;
    arrowGroup.add(core);

    // Arrow Head Cone (from y = h * 0.72 to y = h)
    const headHeight = h * 0.28;
    const headRadius = Math.max(0.45, h * 0.085);
    const headGeo = new THREE.ConeGeometry(headRadius, headHeight, 32);
    const head = new THREE.Mesh(headGeo, neonMat);
    head.position.y = shaftHeight + headHeight / 2;
    arrowGroup.add(head);

    // Head Tip Pip
    const tipGeo = new THREE.SphereGeometry(shaftRadius * 0.6, 16, 16);
    const tipMesh = new THREE.Mesh(tipGeo, glowCoreMat);
    tipMesh.position.y = h;
    arrowGroup.add(tipMesh);

    // Local point light at the tip
    const pointLight = new THREE.PointLight(0x22c55e, 1.5, 35);
    pointLight.position.set(0, h, 0.5);
    arrowGroup.add(pointLight);

    this.assemblyGroup.add(arrowGroup);
  }

  buildPointGrid(h) {
    const gridGroup = new THREE.Group();
    const rows = 5;
    const cols = 5;
    const spacingY = h / (rows - 1);
    const spacingX = (h * 0.8) / (cols - 1);

    const emitterGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const emitterMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * spacingX;
        const y = r * spacingY;
        const emitter = new THREE.Mesh(emitterGeo, emitterMat);
        emitter.position.set(x, y, 0);
        gridGroup.add(emitter);
      }
    }

    // Border Frame
    const frameGeo = new THREE.RingGeometry(h * 0.55, h * 0.58, 32);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, side: THREE.DoubleSide });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(0, h / 2, 0);
    gridGroup.add(frame);

    this.assemblyGroup.add(gridGroup);
  }

  /**
   * Renders the 2D source pattern to the offscreen canvas.
   * This represents the ground-truth image matrix emitted by the object.
   */
  renderSourceCanvas() {
    const ctx = this.sourceCtx;
    const w = this.sourceCanvas.width;
    const h = this.sourceCanvas.height;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (this.type === 'Device Image (Uploaded)' && this.uploadedImage) {
      // Draw user uploaded image scaled to fit canvas neatly
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const img = this.uploadedImage;
      const aspect = img.width / img.height;
      let dw, dh, dx, dy;

      if (aspect > 1) {
        dw = w;
        dh = w / aspect;
        dx = 0;
        dy = (h - dh) / 2;
      } else {
        dh = h;
        dw = h * aspect;
        dx = (w - dw) / 2;
        dy = 0;
      }

      ctx.drawImage(img, dx, dy, dw, dh);

      // Subtle indicator badge in corner
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, h - 28, w, 28);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`DEVICE IMAGE: ${this.uploadedImageName || 'CUSTOM'}`, w / 2, h - 9);

    } else if (this.type === 'Default Letter F') {
      // EXACT MATRIX FROM PYTHON LAB SCRIPT:
      // img = np.ones((400, 400), dtype=np.uint8) * 255
      // cv2.rectangle(img, (100, 40), (160, 360), 0, -1)    # Vertical stem
      // cv2.rectangle(img, (160, 40), (300, 100), 0, -1)    # Top bar
      // cv2.rectangle(img, (160, 160), (260, 220), 0, -1)   # Middle bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Black 'F' shape
      ctx.fillStyle = '#0f172a';
      // Vertical stem: x: 100 to 160 (w=60), y: 40 to 360 (h=320)
      ctx.fillRect(100, 40, 60, 320);
      // Top bar: x: 160 to 300 (w=140), y: 40 to 100 (h=60)
      ctx.fillRect(160, 40, 140, 60);
      // Middle bar: x: 160 to 260 (w=100), y: 160 to 220 (h=60)
      ctx.fillRect(160, 160, 100, 60);

      // Orientation tags to clearly verify upright/inverted/lateral inversion
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 16px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TOP ↑', 200, 28);
      ctx.fillStyle = '#dc2626';
      ctx.fillText('BOTTOM ↓', 200, 390);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 12px "JetBrains Mono", sans-serif';
      ctx.fillText('MFAD ASYMMETRIC TEST MATRIX [400×400]', w / 2, h - 8);

    } else if (this.type === 'Light Arrow') {
      // Dark background with neon green arrow
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h * 0.9);

      const arrowLen = h * 0.75;
      const shaftWidth = 28;
      const headWidth = 75;
      const headLen = 65;

      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 24;

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-shaftWidth / 2, -arrowLen + headLen, shaftWidth, arrowLen - headLen);

      ctx.beginPath();
      ctx.moveTo(0, -arrowLen);
      ctx.lineTo(headWidth / 2, -arrowLen + headLen);
      ctx.lineTo(-headWidth / 2, -arrowLen + headLen);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#dcfce7';
      ctx.fillRect(-shaftWidth / 4, -arrowLen + headLen + 10, shaftWidth / 2, arrowLen - headLen - 15);

      ctx.restore();

      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 20px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LIGHT ARROW (UP ↑)', w / 2, h * 0.96);

    } else if (this.type === 'USAF Test Target') {
      // High-precision Siemens Star & USAF pattern
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2, h / 2);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      for (let r = 25; r <= 180; r += 30) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#f8fafc';
      for (let i = 0; i < 36; i += 2) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 160, (i * Math.PI) / 18, ((i + 1) * Math.PI) / 18);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 64px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', 0, 0);

      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 24px "JetBrains Mono", sans-serif';
      ctx.fillText('TOP ↑', 0, -170);

      ctx.restore();

    } else if (this.type === 'Point Source Grid') {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      const rows = 5;
      const cols = 5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 50 + (c * (w - 100)) / (cols - 1);
          const y = 50 + (r * (h - 100)) / (rows - 1);

          const radGrad = ctx.createRadialGradient(x, y, 2, x, y, 16);
          radGrad.addColorStop(0, '#38bdf8');
          radGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
          radGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POINT SOURCE GRID', w / 2, h - 16);
    }

    if (this.plateTexture) {
      this.plateTexture.needsUpdate = true;
    }
  }

  getTipPoint() {
    return new THREE.Vector3(0, this.height, -this.u);
  }

  getMidPoint() {
    return new THREE.Vector3(0, this.height / 2, -this.u);
  }

  getBasePoint() {
    return new THREE.Vector3(0, 0, -this.u);
  }

  getSourceCanvas() {
    return this.sourceCanvas;
  }
}
