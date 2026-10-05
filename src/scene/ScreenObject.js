import * as THREE from 'three';
import { OpticalBenchScene } from './OpticalBenchScene.js';
import { OpticsEngine } from '../math/OpticsMath.js';

export class ScreenObject {
  constructor(scene) {
    this.scene = scene;
    this.vScreen = 40;     // cm distance from element (z = +vScreen)
    this.screenWidth = 24; // cm
    this.screenHeight = 24;// cm
    this.isActive = true;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Bench Rider Mount
    this.rider = OpticalBenchScene.createMountRider('SCREEN', 0xf59e0b);
    this.group.add(this.rider);

    // Screen Assembly
    this.assemblyGroup = new THREE.Group();
    this.group.add(this.assemblyGroup);

    // Dynamic projection canvas
    this.projCanvas = document.createElement('canvas');
    this.projCanvas.width = 1024;
    this.projCanvas.height = 1024;
    this.projCtx = this.projCanvas.getContext('2d');

    this.projTexture = new THREE.CanvasTexture(this.projCanvas);
    this.projTexture.anisotropy = 8;

    this.buildScreenMesh();
    this.updatePosition();
  }

  setDistance(v) {
    this.vScreen = Math.max(5, Math.min(100, v));
    this.updatePosition();
  }

  updatePosition() {
    this.group.position.z = this.vScreen;
  }

  setVisible(visible) {
    this.isActive = visible;
    this.group.visible = visible;
  }

  buildScreenMesh() {
    while (this.assemblyGroup.children.length > 0) {
      const child = this.assemblyGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.assemblyGroup.remove(child);
    }

    const w = this.screenWidth;
    const h = this.screenHeight;

    // 1. Black Matte Lab Frame
    const frameGeo = new THREE.BoxGeometry(w + 2.2, h + 2.2, 0.8);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e242c,
      metalness: 0.6,
      roughness: 0.4
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.y = h / 2;
    frameMesh.castShadow = true;
    this.assemblyGroup.add(frameMesh);

    // 2. Diffuse Projection Canvas (Facing -Z, towards the lens)
    const screenGeo = new THREE.PlaneGeometry(w, h);
    screenGeo.rotateY(Math.PI);

    const screenMat = new THREE.MeshStandardMaterial({
      map: this.projTexture,
      roughness: 0.85,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveMap: this.projTexture,
      emissiveIntensity: 0.55
    });

    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, h / 2, -0.41);
    this.assemblyGroup.add(this.screenMesh);

    // 3. Support Rod to Rider
    const rodGeo = new THREE.CylinderGeometry(0.7, 0.7, 5, 16);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.y = 0;
    rodMesh.castShadow = true;
    this.assemblyGroup.add(rodMesh);
  }

  /**
   * Updates projection screen texture in real time for LENSES.
   * If element is a mirror, screen is not used and shows inactive notice.
   */
  updateProjection(sourceCanvas, physics, aperture, objectHeight) {
    const ctx = this.projCtx;
    const cw = this.projCanvas.width;
    const ch = this.projCanvas.height;

    // Reset transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // If mirror, screen is deactivated per requirements
    if (physics.isMirror) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 36px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCREEN DEACTIVATED FOR MIRRORS', cw / 2, ch / 2 - 40);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText('Reflected image is formed & observed directly ON the mirror', cw / 2, ch / 2 + 15);
      ctx.fillText('(Look at the curved mirror surface on the optical bench)', cw / 2, ch / 2 + 55);

      this.projTexture.needsUpdate = true;
      return;
    }

    // LENSES: Diffuse white matte projection screen with subtle crosshair grid
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, cw, ch);

    // Screen Grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    const step = 64;
    for (let x = 0; x <= cw; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = 0; y <= ch; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // Optical Axis Center Crosshair
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0);
    ctx.lineTo(cw / 2, ch);
    ctx.moveTo(0, ch / 2);
    ctx.lineTo(cw, ch / 2);
    ctx.stroke();

    // Centimeter concentric rings on screen
    ctx.strokeStyle = '#cbd5e1';
    for (let r = 80; r <= 450; r += 80) {
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const { u, f, v, m, nature, orientation, focusError } = physics;
    const pxPerCm = cw / this.screenWidth;

    if (physics.element === 'Concave Lens' || nature === 'Virtual') {
      // DIVERGING RAYS / VIRTUAL IMAGE (no real focus on screen)
      const glowRadius = Math.min(cw * 0.45, 120);
      const grad = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, glowRadius);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
      grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.05)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 30px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NO REAL IMAGE ON SCREEN', cw / 2, ch / 2 - 50);

      ctx.fillStyle = '#334155';
      ctx.font = '22px sans-serif';
      ctx.fillText(
        physics.element === 'Concave Lens'
          ? 'Concave Lens diverges all incident light'
          : `u < f (${u.toFixed(1)} cm < ${f.toFixed(1)} cm): Rays diverge after lens`,
        cw / 2,
        ch / 2
      );
      ctx.fillText(`Virtual Upright Image perceived behind lens at v = ${v.toFixed(1)} cm`, cw / 2, ch / 2 + 40);
      ctx.fillStyle = '#2563eb';
      ctx.font = 'italic 20px sans-serif';
      ctx.fillText('(Observer must look directly through the lens)', cw / 2, ch / 2 + 80);

    } else if (nature === 'At Infinity') {
      // Collimated beam
      const beamRadiusPx = (aperture / 2) * pxPerCm;
      const grad = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, beamRadiusPx);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.4)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 28px "JetBrains Mono", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COLLIMATED BEAM (u = f)', cw / 2, ch / 2 - 40);
      ctx.font = '22px sans-serif';
      ctx.fillText(`Beam Diameter = Aperture (${aperture} cm)`, cw / 2, ch / 2 + 20);

    } else {
      // REAL INVERTED IMAGE FORMED ON SCREEN!
      const absM = Math.abs(m);
      const coc = OpticsEngine.calculateCircleOfConfusion(this.vScreen, v, aperture, u, f);
      const blurPx = Math.max(0.5, (coc / 2) * pxPerCm);

      // Energy Conservation: peak intensity is inversely proportional to blur area
      const blurFactor = blurPx / 3.0;
      const alpha = Math.min(1.0, 1.0 / (1.0 + blurFactor * 0.35));

      ctx.save();

      // Gaussian blur based on focus error
      if (blurPx > 1.2) {
        ctx.filter = `blur(${Math.min(45, blurPx.toFixed(1))}px)`;
      }

      ctx.globalAlpha = alpha;
      ctx.translate(cw / 2, ch / 2);

      // Apply Inversion:
      // In lenses, real images are inverted both vertically and horizontally
      ctx.scale(-1, -1);

      // Scale by magnification magnitude |m|
      ctx.scale(absM, absM);

      const sw = sourceCanvas.width;
      const sh = sourceCanvas.height;

      // Draw source image centered
      ctx.drawImage(sourceCanvas, -sw / 2, -sh / 2, sw, sh);

      ctx.restore();

      // Sharpness indicator overlay on the screen
      const deltaV = Math.abs(this.vScreen - v);
      const isFocused = deltaV < 0.6;

      ctx.save();
      if (isFocused) {
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 26px "JetBrains Mono", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ IN PIN-SHARP FOCUS ★', cw / 2, 60);

        ctx.font = '20px "JetBrains Mono", sans-serif';
        ctx.fillText(`v_screen = ${this.vScreen.toFixed(1)} cm ≈ v_focus = ${v.toFixed(1)} cm | m = ${m.toFixed(2)}x`, cw / 2, 95);
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 22px "JetBrains Mono", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`DEFOCUSED (Focus Error Δv = ${deltaV.toFixed(1)} cm)`, cw / 2, 60);

        ctx.font = '18px "JetBrains Mono", sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`CoC Blur = ${(coc * 10).toFixed(1)} mm | Theoretical v_focus = ${v.toFixed(1)} cm`, cw / 2, 92);
      }
      ctx.restore();
    }

    this.projTexture.needsUpdate = true;
  }

  getScreenCanvas() {
    return this.projCanvas;
  }
}
