import * as THREE from 'three';
import { OpticsEngine, Vector2D, Matrix3x3 } from '../math/OpticsMath.js';

export class RayTracerVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.rayCount = 15;
    this.rayMode = 'Aperture Fan'; // 'Aperture Fan', 'Cardinal Rays', 'Multi-Source Bundle'
    this.colorTheme = 'Cyan Glow';  // 'Cyan Glow', 'Laser Green', 'Sodium Amber', 'Spectrum'
    this.showVirtualExtensions = true;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Glowing lines groups
    this.incidentLinesGroup = new THREE.Group();
    this.refractedLinesGroup = new THREE.Group();
    this.virtualLinesGroup = new THREE.Group();
    this.focusGlowGroup = new THREE.Group();

    this.group.add(this.incidentLinesGroup);
    this.group.add(this.refractedLinesGroup);
    this.group.add(this.virtualLinesGroup);
    this.group.add(this.focusGlowGroup);

    this.time = 0;
    this.sampleRayIn = new Vector2D(0, 0);
    this.sampleRayOut = new Vector2D(0, 0);
  }

  getColor(index = 0, total = 1) {
    if (this.colorTheme === 'Laser Green') {
      return new THREE.Color(0x22c55e);
    } else if (this.colorTheme === 'Sodium Amber') {
      return new THREE.Color(0xf59e0b);
    } else if (this.colorTheme === 'Spectrum') {
      const hue = (index / Math.max(1, total)) * 0.7;
      return new THREE.Color().setHSL(hue, 1.0, 0.55);
    }
    return new THREE.Color(0x38bdf8);
  }

  clearGroup(g) {
    while (g.children.length > 0) {
      const child = g.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      g.remove(child);
    }
  }

  /**
   * Main ray tracing computation for both Lenses and Mirrors
   */
  updateRays({
    element,
    physics,
    u,
    f,
    vScreen,
    height,
    aperture,
    lensRotationMatrix,
    objectTip,
    objectMid,
    objectBase
  }) {
    this.clearGroup(this.incidentLinesGroup);
    this.clearGroup(this.refractedLinesGroup);
    this.clearGroup(this.virtualLinesGroup);
    this.clearGroup(this.focusGlowGroup);

    const isMirror = element.includes('Mirror');
    const isConcaveMirror = element === 'Concave Mirror';
    const isConvexMirror = element === 'Convex Mirror';

    const R = lensRotationMatrix || Matrix3x3.identity();
    const Rt = R.transpose();
    const elementNormal = R.transformVector({ x: 0, y: 0, z: 1 });
    const maxApertureRadius = aperture / 2.0;

    const v = physics.v;
    const m = physics.m;
    const effectiveF = physics.f;

    // Generate ray configurations
    let rayConfigs = [];

    if (this.rayMode === 'Cardinal Rays') {
      // 1. Parallel Ray (parallel to optical axis from tip)
      rayConfigs.push({
        origin: objectTip.clone(),
        targetAtElement: new THREE.Vector3(0, height, 0),
        type: 'parallel'
      });
      // 2. Chief Ray (towards optical center 0,0,0)
      rayConfigs.push({
        origin: objectTip.clone(),
        targetAtElement: new THREE.Vector3(0, 0, 0),
        type: 'chief'
      });
      // 3. Focal Ray
      const focalZ = isMirror ? (isConcaveMirror ? -effectiveF : effectiveF) : -effectiveF;
      const slope = (0 - height) / (focalZ - (-u));
      const yAtElem = height + slope * (0 - (-u));
      if (Math.abs(yAtElem) <= maxApertureRadius * 1.3) {
        rayConfigs.push({
          origin: objectTip.clone(),
          targetAtElement: new THREE.Vector3(0, yAtElem, 0),
          type: 'focal'
        });
      }
    } else if (this.rayMode === 'Multi-Source Bundle') {
      const origins = [
        { pt: objectTip, count: Math.ceil(this.rayCount * 0.45) },
        { pt: objectMid, count: Math.ceil(this.rayCount * 0.35) },
        { pt: objectBase, count: Math.ceil(this.rayCount * 0.20) }
      ];

      origins.forEach(({ pt, count }) => {
        for (let i = 0; i < count; i++) {
          const frac = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
          const yElem = frac * maxApertureRadius * 0.95;
          rayConfigs.push({
            origin: pt.clone(),
            targetAtElement: new THREE.Vector3(0, yElem, 0),
            type: 'fan'
          });
        }
      });
    } else {
      // 'Aperture Fan' from object tip
      const N = this.rayCount;
      for (let i = 0; i < N; i++) {
        const frac = N > 1 ? (i / (N - 1)) * 2 - 1 : 0;
        const yElem = frac * maxApertureRadius * 0.96;
        const xElem = Math.sin(i * 1.5) * (maxApertureRadius * 0.12);
        rayConfigs.push({
          origin: objectTip.clone(),
          targetAtElement: new THREE.Vector3(xElem, yElem, 0),
          type: 'fan'
        });
      }
    }

    const incidentVertices = [];
    const incidentColors = [];
    const outgoingVertices = [];
    const outgoingColors = [];
    const virtualVertices = [];
    const virtualColors = [];

    let sampleSelected = false;

    rayConfigs.forEach((cfg, idx) => {
      const orig = cfg.origin;
      const target = cfg.targetAtElement;
      const baseColor = this.getColor(idx, rayConfigs.length);

      // 1. Ray plane intersection with tilted element plane
      const rayDir = new THREE.Vector3().subVectors(target, orig).normalize();
      const normVec = new THREE.Vector3(elementNormal.x, elementNormal.y, elementNormal.z);
      const denom = rayDir.dot(normVec);

      if (Math.abs(denom) < 1e-6) return;

      const tElem = -orig.dot(normVec) / denom;
      if (tElem <= 0) return;

      const pElem = orig.clone().addScaledVector(rayDir, tElem);
      const pElemLocal = Rt.transformVector(pElem);
      const rAperture = Math.sqrt(pElemLocal.x * pElemLocal.x + pElemLocal.y * pElemLocal.y);
      const isClipped = rAperture > maxApertureRadius;

      // Incident ray: Object -> Element
      incidentVertices.push(orig.x, orig.y, orig.z);
      incidentVertices.push(pElem.x, pElem.y, pElem.z);
      incidentColors.push(baseColor.r, baseColor.g, baseColor.b);
      incidentColors.push(baseColor.r, baseColor.g, baseColor.b);

      if (isClipped) return;

      // 2. Direction after element
      const dInLocal = Rt.transformVector(rayDir);
      const thetaXIn = dInLocal.x / (dInLocal.z || 1e-6);
      const thetaYIn = dInLocal.y / (dInLocal.z || 1e-6);

      let dOutWorld;

      if (!isMirror) {
        // === LENS REFRACTION ===
        // Continues forward into +Z
        const power = 1.0 / effectiveF;
        const thetaXOut = thetaXIn - pElemLocal.x * power;
        const thetaYOut = thetaYIn - pElemLocal.y * power;

        const dOutLocalRaw = new THREE.Vector3(thetaXOut, thetaYOut, 1.0).normalize();
        const dOutWorldObj = R.transformVector(dOutLocalRaw);
        dOutWorld = new THREE.Vector3(dOutWorldObj.x, dOutWorldObj.y, dOutWorldObj.z).normalize();

        // Sample ray for HUD
        if (!sampleSelected && (cfg.type === 'chief' || idx === Math.floor(rayConfigs.length / 2))) {
          this.sampleRayIn = new Vector2D(pElemLocal.y, thetaYIn);
          this.sampleRayOut = new Vector2D(pElemLocal.y, thetaYOut);
          sampleSelected = true;
        }

        // Trace forward to screen at z = vScreen
        if (Math.abs(dOutWorld.z) > 1e-5) {
          const sScreen = (vScreen - pElem.z) / dOutWorld.z;
          if (sScreen > 0) {
            const pScreen = pElem.clone().addScaledVector(dOutWorld, sScreen);
            outgoingVertices.push(pElem.x, pElem.y, pElem.z);
            outgoingVertices.push(pScreen.x, pScreen.y, pScreen.z);
            outgoingColors.push(baseColor.r, baseColor.g, baseColor.b);
            outgoingColors.push(baseColor.r, baseColor.g, baseColor.b);
          }
        }

        // Virtual extensions for lenses (if v < 0)
        if (this.showVirtualExtensions && v < 0 && isFinite(v)) {
          const sVirtual = (v - pElem.z) / dOutWorld.z;
          const pVirtual = pElem.clone().addScaledVector(dOutWorld, sVirtual);
          virtualVertices.push(pElem.x, pElem.y, pElem.z);
          virtualVertices.push(pVirtual.x, pVirtual.y, pVirtual.z);
          virtualColors.push(0.9, 0.3, 0.3);
          virtualColors.push(0.9, 0.3, 0.3);
        }

      } else {
        // === MIRROR REFLECTION ===
        // Reflects backwards towards -Z!
        const power = isConcaveMirror ? (2.0 / physics.R) : (-2.0 / physics.R);
        // Incoming ray has dz > 0. Reflected ray has dz < 0.
        const thetaXOut = -thetaXIn - pElemLocal.x * power;
        const thetaYOut = -thetaYIn - pElemLocal.y * power;

        // Local reflected vector travels in -Z
        const dOutLocalRaw = new THREE.Vector3(thetaXOut, thetaYOut, -1.0).normalize();
        const dOutWorldObj = R.transformVector(dOutLocalRaw);
        dOutWorld = new THREE.Vector3(dOutWorldObj.x, dOutWorldObj.y, dOutWorldObj.z).normalize();

        // Sample ray for HUD
        if (!sampleSelected && (cfg.type === 'chief' || idx === Math.floor(rayConfigs.length / 2))) {
          this.sampleRayIn = new Vector2D(pElemLocal.y, thetaYIn);
          this.sampleRayOut = new Vector2D(pElemLocal.y, thetaYOut);
          sampleSelected = true;
        }

        // Reflected rays propagate back into -Z
        // Ray length: reach beyond the object or real image plane
        const distBack = Math.max(u * 1.5, Math.abs(v) + 20, 80);
        const pReflectEnd = pElem.clone().addScaledVector(dOutWorld, distBack);

        outgoingVertices.push(pElem.x, pElem.y, pElem.z);
        outgoingVertices.push(pReflectEnd.x, pReflectEnd.y, pReflectEnd.z);
        outgoingColors.push(baseColor.r, baseColor.g, baseColor.b);
        outgoingColors.push(baseColor.r, baseColor.g, baseColor.b);

        // Virtual extensions behind the mirror (into +Z) when image is virtual
        if (this.showVirtualExtensions && (!isFinite(v) || v < 0 || isConvexMirror || (isConcaveMirror && u < effectiveF))) {
          const virtualZ = Math.abs(v) < 150 ? Math.abs(v) : 60;
          // Virtual ray continues backward behind mirror along -dOutWorld (i.e. into +Z)
          const sVirt = (virtualZ - pElem.z) / (-dOutWorld.z);
          if (sVirt > 0) {
            const pVirt = pElem.clone().addScaledVector(dOutWorld.clone().negate(), sVirt);
            virtualVertices.push(pElem.x, pElem.y, pElem.z);
            virtualVertices.push(pVirt.x, pVirt.y, pVirt.z);
            virtualColors.push(0.95, 0.45, 0.2);
            virtualColors.push(0.95, 0.45, 0.2);
          }
        }
      }
    });

    // Create Incident Mesh
    if (incidentVertices.length > 0) {
      const incGeo = new THREE.BufferGeometry();
      incGeo.setAttribute('position', new THREE.Float32BufferAttribute(incidentVertices, 3));
      incGeo.setAttribute('color', new THREE.Float32BufferAttribute(incidentColors, 3));
      const incMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      this.incidentLinesGroup.add(new THREE.LineSegments(incGeo, incMat));
    }

    // Create Outgoing (Refracted or Reflected) Mesh
    if (outgoingVertices.length > 0) {
      const outGeo = new THREE.BufferGeometry();
      outGeo.setAttribute('position', new THREE.Float32BufferAttribute(outgoingVertices, 3));
      outGeo.setAttribute('color', new THREE.Float32BufferAttribute(outgoingColors, 3));
      const outMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      this.refractedLinesGroup.add(new THREE.LineSegments(outGeo, outMat));
    }

    // Create Virtual Dashed Extensions Mesh
    if (virtualVertices.length > 0) {
      const virtGeo = new THREE.BufferGeometry();
      virtGeo.setAttribute('position', new THREE.Float32BufferAttribute(virtualVertices, 3));
      virtGeo.setAttribute('color', new THREE.Float32BufferAttribute(virtualColors, 3));
      const virtMat = new THREE.LineDashedMaterial({
        vertexColors: true,
        dashSize: 1.2,
        gapSize: 0.8,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      const virtLines = new THREE.LineSegments(virtGeo, virtMat);
      virtLines.computeLineDistances();
      this.virtualLinesGroup.add(virtLines);
    }

    // Real Focus Convergence Indicator (when real image is formed)
    if (physics.nature === 'Real' && isFinite(v)) {
      const focusZ = isMirror ? -v : v;
      const focusY = height * m;
      const focusPt = new THREE.Vector3(0, focusY, focusZ);

      const glowGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: isMirror ? 0xf59e0b : 0x22c55e,
        transparent: true,
        opacity: 0.85
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(focusPt);
      this.focusGlowGroup.add(glow);

      // Pin indicator
      const pinGeo = new THREE.CylinderGeometry(0.12, 0.12, Math.abs(focusY), 8);
      const pinMesh = new THREE.Mesh(pinGeo, glowMat);
      pinMesh.position.set(0, focusY / 2, focusZ);
      this.focusGlowGroup.add(pinMesh);
    }
  }

  animate(delta) {
    this.time += delta;
  }

  getSampleRayData() {
    return {
      rIn: this.sampleRayIn,
      rOut: this.sampleRayOut
    };
  }
}
