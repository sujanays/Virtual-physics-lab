import * as THREE from 'three';
import { OpticalBenchScene } from './OpticalBenchScene.js';
import { Matrix3x3 } from '../math/OpticsMath.js';

export class LensObject {
  constructor(scene) {
    this.scene = scene;
    this.element = 'Convex Lens'; // 'Convex Lens', 'Concave Lens', 'Concave Mirror', 'Convex Mirror'
    this.focalLength = 20; // cm
    this.radius = 40;      // cm (for mirrors: R = 2f)
    this.aperture = 8;     // cm
    this.tiltX = 0;        // rad
    this.tiltY = 0;        // rad
    this.ior = 1.52;       // Crown glass refractive index

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Bench mount rider at Z = 0
    this.rider = OpticalBenchScene.createMountRider('CONVEX LENS', 0x38bdf8);
    this.group.add(this.rider);

    // Gimbal assembly that tilts with the element
    // Lifted to y=3.5 so the lens bottom edge (y≈-0.5 world) clears the rider top (y≈-3.25)
    this.gimbalGroup = new THREE.Group();
    this.gimbalGroup.position.set(0, 3.5, 0);
    this.group.add(this.gimbalGroup);

    // Dynamic mirror reflection canvas (for convex and concave mirrors)
    this.mirrorCanvas = document.createElement('canvas');
    this.mirrorCanvas.width = 512;
    this.mirrorCanvas.height = 512;
    this.mirrorCtx = this.mirrorCanvas.getContext('2d');
    this.mirrorTexture = new THREE.CanvasTexture(this.mirrorCanvas);
    this.mirrorTexture.anisotropy = 4;

    // Glass material for lenses
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.96,
      opacity: 1.0,
      transparent: true,
      roughness: 0.03,
      metalness: 0.0,
      ior: this.ior,
      thickness: 1.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      attenuationColor: new THREE.Color(0xdbeafe),
      attenuationDistance: 12.0,
      dispersion: 0.025
    });

    // Highly polished reflective mirror material (DoubleSide so geometry is always lit)
    this.mirrorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.92,
      map: this.mirrorTexture,
      emissive: 0xffffff,
      emissiveMap: this.mirrorTexture,
      emissiveIntensity: 0.95,
      side: THREE.FrontSide   // front face = mirror image
    });

    // "SILVERED" label canvas — shown on the non-reflective (back) face of mirrors
    const silvCanvas = document.createElement('canvas');
    silvCanvas.width = 512;
    silvCanvas.height = 512;
    const silvCtx = silvCanvas.getContext('2d');
    // White background
    silvCtx.fillStyle = '#ffffff';
    silvCtx.fillRect(0, 0, 512, 512);
    // Thin light-grey border
    silvCtx.strokeStyle = '#cccccc';
    silvCtx.lineWidth = 6;
    silvCtx.strokeRect(10, 10, 492, 492);
    // Bold "SILVERED" text centred
    silvCtx.fillStyle = '#000000';
    silvCtx.font = 'bold 80px Arial, sans-serif';
    silvCtx.textAlign = 'center';
    silvCtx.textBaseline = 'middle';
    silvCtx.fillText('SILVERED', 256, 256);
    // Sub-label
    silvCtx.font = '32px Arial, sans-serif';
    silvCtx.fillStyle = '#444444';
    silvCtx.fillText('(non-reflecting side)', 256, 340);

    this.silveredTexture = new THREE.CanvasTexture(silvCanvas);
    this.silveredTexture.anisotropy = 4;

    // BackSide material so it only shows on the back face of the mirror mesh
    this.silveredMaterial = new THREE.MeshStandardMaterial({
      map: this.silveredTexture,
      side: THREE.BackSide,
      roughness: 0.9,
      metalness: 0.0
    });

    // Dark metallic back casing for mirrors
    this.spoonCasingMaterial = new THREE.MeshStandardMaterial({
      color: 0x242d38,
      metalness: 0.88,
      roughness: 0.22
    });

    // Focal markers group
    this.focalMarkersGroup = new THREE.Group();
    this.scene.add(this.focalMarkersGroup);

    this.rebuildElement();
    this.updateFocalMarkers();
  }

  setElement(element) {
    this.element = element;
    // Update rider badge text
    const badgeColor = element.includes('Mirror') ? 0xf59e0b : 0x38bdf8;
    this.group.remove(this.rider);
    this.rider = OpticalBenchScene.createMountRider(element.toUpperCase(), badgeColor);
    this.group.add(this.rider);

    this.rebuildElement();
    this.updateFocalMarkers();
  }

  setFocalLength(f) {
    this.focalLength = Math.max(5, Math.min(100, f));
    this.radius = this.focalLength * 2.0;
    this.rebuildElement();
    this.updateFocalMarkers();
  }

  setAperture(D) {
    this.aperture = Math.max(2, Math.min(20, D));
    this.rebuildElement();
  }

  setTilt(tiltXRad, tiltYRad) {
    this.tiltX = tiltXRad;
    this.tiltY = tiltYRad;
    this.rotationMatrix = Matrix3x3.fromEuler(this.tiltX, this.tiltY, 0);
    this.gimbalGroup.rotation.x = this.tiltX;
    this.gimbalGroup.rotation.y = this.tiltY;
  }

  getRotationMatrix() {
    return this.rotationMatrix || Matrix3x3.fromEuler(this.tiltX, this.tiltY, 0);
  }

  /**
   * Rebuilds 3D mesh geometry based on selected optical element:
   * 1. Convex Lens: Biconvex solid
   * 2. Concave Lens: Biconcave solid
   * 3. Concave Mirror: Inside of a spoon shaped bowl (inward curve)
   * 4. Convex Mirror: Outside of a spoon shaped dome (outward curve)
   */
  rebuildElement() {
    while (this.gimbalGroup.children.length > 0) {
      const child = this.gimbalGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.gimbalGroup.remove(child);
    }

    const D = this.aperture;
    const radiusAperture = D / 2.0;

    if (this.element === 'Convex Lens') {
      this.buildConvexLens(radiusAperture);
    } else if (this.element === 'Concave Lens') {
      this.buildConcaveLens(radiusAperture);
    } else if (this.element === 'Concave Mirror') {
      this.buildConcaveMirror(radiusAperture);
    } else if (this.element === 'Convex Mirror') {
      this.buildConvexMirror(radiusAperture);
    }
  }

  /**
   * 1. 3D Biconvex Glass Lens — matches reference image:
   *    Circular, thick bulging center, very thin rim edge,
   *    dark metallic lab-mount bezel ring around circumference.
   */
  buildConvexLens(radiusAperture) {
    // Use a tighter sphere radius for more pronounced central bulge
    const R = Math.max(radiusAperture * 1.1, 2.0 * (this.ior - 1.0) * this.focalLength);
    const sagitta = R - Math.sqrt(Math.max(0.1, R * R - radiusAperture * radiusAperture));
    const rimThickness = 0.15; // Very thin edge — matches image

    const points = [];
    const segments = 64;

    // Front convex surface: bulges toward -Z (incoming light side)
    // At r=0: z = +sagitta + rimThickness/2  (peak of dome)
    // At r=radiusAperture: z = +rimThickness/2  (thin rim)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * radiusAperture;
      const z = (Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta)) + rimThickness / 2;
      points.push(new THREE.Vector2(r, z));
    }
    // Thin outer rim transition
    points.push(new THREE.Vector2(radiusAperture, -rimThickness / 2));
    // Back convex surface: symmetric, bulges toward +Z
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const r = t * radiusAperture;
      const z = -((Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta)) + rimThickness / 2);
      points.push(new THREE.Vector2(r, z));
    }

    const latheGeo = new THREE.LatheGeometry(points, 64);
    latheGeo.rotateX(Math.PI / 2);
    latheGeo.computeVertexNormals();

    const lensMesh = new THREE.Mesh(latheGeo, this.glassMaterial);
    lensMesh.castShadow = true;
    this.gimbalGroup.add(lensMesh);

    // No bezel ring — clean glass-only lens

    this.buildBottomSupport(radiusAperture, rimThickness);
  }

  /**
   * 2. 3D Biconcave Glass Lens — matches reference image:
   *    Portrait orientation (taller than wide), flat top & bottom faces,
   *    deeply concave front & back surfaces, thick rectangular side edges.
   *    Looks like a tall hourglass / ) ( shape from the side.
   */
  buildConcaveLens(radiusAperture) {
    // Portrait: significantly taller than the lens is wide
    const halfH  = radiusAperture * 1.35;  // Half-height Y — tall
    const lensW  = radiusAperture * 1.0;   // X width of the lens block
    const tCenter = 0.28;                   // Minimum center thickness (Z)

    // Sagitta computed against the full half-height to get proper arc depth
    const R = Math.max(halfH * 1.6, 2.0 * (this.ior - 1.0) * this.focalLength);
    const sagittaZ = R - Math.sqrt(Math.max(0.1, R * R - halfH * halfH));
    const tEdge = tCenter + 2.0 * sagittaZ; // Thick edge at top & bottom

    // Profile in the Shape XY plane → extruded along Z → rotated so Z becomes lens width (X)
    // Shape X = lens thickness (Z in world), Shape Y = lens height (Y in world)
    const shape = new THREE.Shape();
    const segs = 56;

    // Start: back-face top-right corner  (shapeX=+tEdge/2, shapeY=+halfH)
    shape.moveTo(+tEdge / 2, +halfH);

    // Flat horizontal TOP face  (back → front)
    shape.lineTo(-tEdge / 2, +halfH);

    // FRONT concave arc: from (−tEdge/2, +halfH) down to (−tEdge/2, −halfH)
    // Arc bows INWARD (toward +X / back of lens) reaching −tCenter/2 at center y=0
    for (let i = 1; i <= segs; i++) {
      const y    = halfH - (2 * halfH * i) / segs;
      const yN   = y / halfH;                          // -1 → +1
      const zFront = -(tCenter / 2) - sagittaZ * (1.0 - yN * yN);
      shape.lineTo(zFront, y);
    }

    // Flat horizontal BOTTOM face  (front → back)
    shape.lineTo(+tEdge / 2, -halfH);

    // BACK concave arc: from (+tEdge/2, −halfH) up to (+tEdge/2, +halfH)
    // Mirror of front arc, reaching +tCenter/2 at center y=0
    for (let i = 1; i <= segs; i++) {
      const y    = -halfH + (2 * halfH * i) / segs;
      const yN   = y / halfH;
      const zBack = +(tCenter / 2) + sagittaZ * (1.0 - yN * yN);
      shape.lineTo(zBack, y);
    }
    shape.closePath();

    // Extrude = lens width; no bevel so corners stay rectangular like the image
    const concaveGeo = new THREE.ExtrudeGeometry(shape, {
      depth: lensW,
      bevelEnabled: false
    });
    concaveGeo.center();
    concaveGeo.rotateY(Math.PI / 2); // thickness (shapeX) → world Z; extrude dir → world X
    concaveGeo.computeVertexNormals();

    const lensMesh = new THREE.Mesh(concaveGeo, this.glassMaterial);
    lensMesh.castShadow = true;
    this.gimbalGroup.add(lensMesh);

    this.buildBottomSupport(halfH, tEdge);
  }

  /**
   * 3. 3D Concave Mirror — bowl opens toward −Z (toward incoming light)
   * Reflective concave face is the INSIDE of the bowl (spoon interior).
   * At center (r=0): z = +sagitta  (deepest point, recessed away from object)
   * At rim (r=radiusAperture): z = 0  (mouth of bowl)
   * The bowl mouth faces −Z so the reflection forms in FRONT of the mirror.
   */
  buildConcaveMirror(radiusAperture) {
    const R = Math.max(radiusAperture * 1.25, this.radius);
    const sagitta = R - Math.sqrt(Math.max(0.1, R * R - radiusAperture * radiusAperture));
    const shellThickness = 0.4;
    const segments = 48;

    // ── Front reflective bowl surface ──────────────────────────────────────
    // z(r) = sqrt(R²−r²) − (R−sagitta)
    //  r=0              → R − (R−sagitta)              = sagitta   (deepest, +Z)
    //  r=radiusAperture → (R−sagitta) − (R−sagitta)   = 0         (rim, Z=0)
    const frontPoints = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * radiusAperture;
      const z = Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta);
      frontPoints.push(new THREE.Vector2(r, z));
    }

    const frontGeo = new THREE.LatheGeometry(frontPoints, 64);
    frontGeo.rotateX(Math.PI / 2);
    frontGeo.computeVertexNormals();

    // Planar UV mapping so reflected image appears undistorted on the bowl face
    const posF = frontGeo.attributes.position;
    const uvsF = frontGeo.attributes.uv;
    for (let i = 0; i < posF.count; i++) {
      uvsF.setXY(i,
        posF.getX(i) / (2 * radiusAperture) + 0.5,
        posF.getY(i) / (2 * radiusAperture) + 0.5
      );
    }
    uvsF.needsUpdate = true;

    const mirrorFrontMesh = new THREE.Mesh(frontGeo, this.mirrorMaterial);
    mirrorFrontMesh.castShadow = true;
    this.gimbalGroup.add(mirrorFrontMesh);

    // Back face of the bowl surface — shows "SILVERED" label in black on white
    const silveredMeshC = new THREE.Mesh(frontGeo, this.silveredMaterial);
    this.gimbalGroup.add(silveredMeshC);

    // ── Protective back shell (opaque housing behind the reflective bowl) ──
    // Same profile as front face but offset by shellThickness toward +Z
    const backPoints = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * (radiusAperture + 0.1);
      const z = Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta) + shellThickness;
      backPoints.push(new THREE.Vector2(r, z));
    }

    const backGeo = new THREE.LatheGeometry(backPoints, 64);
    backGeo.rotateX(Math.PI / 2);
    backGeo.computeVertexNormals();

    const spoonBackMesh = new THREE.Mesh(backGeo, this.spoonCasingMaterial);
    spoonBackMesh.castShadow = true;
    this.gimbalGroup.add(spoonBackMesh);

    // Horizontal bezel rim removed — keeps lens aperture unobstructed
    this.buildBottomSupport(radiusAperture, shellThickness);
  }

  /**
   * 4. 3D Convex Mirror — dome bulges toward −Z (toward incoming light)
   * Exact OPPOSITE of concave: reflective face is the OUTSIDE of the dome.
   * At center (r=0): z = −sagitta  (tip of dome, closest to object)
   * At rim (r=radiusAperture): z = 0  (base edge of dome)
   */
  buildConvexMirror(radiusAperture) {
    const R = Math.max(radiusAperture * 1.25, this.radius);
    const sagitta = R - Math.sqrt(Math.max(0.1, R * R - radiusAperture * radiusAperture));
    const shellThickness = 0.4;
    const segments = 48;

    // ── Front reflective dome surface ─────────────────────────────────────
    // z(r) = −(sqrt(R²−r²) − (R−sagitta))   i.e. exact negative of concave
    //  r=0              → −sagitta   (dome tip, closest to −Z / object)
    //  r=radiusAperture → 0          (base rim)
    const frontPoints = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * radiusAperture;
      const z = -(Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta));
      frontPoints.push(new THREE.Vector2(r, z));
    }

    const frontGeo = new THREE.LatheGeometry(frontPoints, 64);
    frontGeo.rotateX(Math.PI / 2);
    frontGeo.computeVertexNormals();

    // Planar UV mapping for undistorted reflection display
    const posF = frontGeo.attributes.position;
    const uvsF = frontGeo.attributes.uv;
    for (let i = 0; i < posF.count; i++) {
      uvsF.setXY(i,
        posF.getX(i) / (2 * radiusAperture) + 0.5,
        posF.getY(i) / (2 * radiusAperture) + 0.5
      );
    }
    uvsF.needsUpdate = true;

    const mirrorFrontMesh = new THREE.Mesh(frontGeo, this.mirrorMaterial);
    mirrorFrontMesh.castShadow = true;
    this.gimbalGroup.add(mirrorFrontMesh);

    // Back face of the dome surface — shows "SILVERED" label in black on white
    const silveredMeshV = new THREE.Mesh(frontGeo, this.silveredMaterial);
    this.gimbalGroup.add(silveredMeshV);

    // ── Opaque rear housing (sits behind the dome toward +Z) ──────────────
    // Same dome profile shifted by shellThickness toward +Z
    const backPoints = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const r = t * (radiusAperture + 0.1);
      const z = -(Math.sqrt(Math.max(0.01, R * R - r * r)) - (R - sagitta)) + shellThickness;
      backPoints.push(new THREE.Vector2(r, z));
    }

    const backGeo = new THREE.LatheGeometry(backPoints, 64);
    backGeo.rotateX(Math.PI / 2);
    backGeo.computeVertexNormals();

    const backMesh = new THREE.Mesh(backGeo, this.spoonCasingMaterial);
    backMesh.castShadow = true;
    this.gimbalGroup.add(backMesh);

    // Horizontal bezel rim removed — keeps lens aperture unobstructed
    this.buildBottomSupport(radiusAperture, shellThickness);
  }

  /**
   * Slim laboratory bottom support post and clamp.
   * gimbalGroup is at world y=+3.5, so this post (in local coords) must reach
   * far enough down to connect to the rider base (world y≈−5 → local y≈−8.5).
   * The lens bottom edge is at local y=−radiusAperture, so the cradle starts just below that.
   * Post is thin (radius 0.3) and sits 100% outside the optical aperture.
   */
  buildBottomSupport(radiusAperture, thickness = 0.5) {
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2
    });

    const clampMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });

    // 1. Slim U-cradle clamp — hugs the bottom edge of the lens/mirror
    const cradleWidth = Math.min(radiusAperture * 1.2, 5.5);
    const cradleGeo = new THREE.BoxGeometry(cradleWidth, 0.5, Math.max(thickness + 0.4, 0.9));
    const cradleMesh = new THREE.Mesh(cradleGeo, clampMat);
    cradleMesh.position.set(0, -radiusAperture - 0.25, 0); // local: just below lens
    cradleMesh.castShadow = true;
    this.gimbalGroup.add(cradleMesh);

    // 2. Thin vertical stem — connects cradle to rider base deep below
    // Local postTop is just below cradle; postBottom reaches world y≈−5 (local y≈−8.5)
    const postTop    = -radiusAperture - 0.5;
    const postBottom = -8.5;  // world y = 3.5 + (-8.5) = -5.0, inside rider base
    const postHeight = Math.abs(postTop - postBottom);
    const postCenterY = (postTop + postBottom) / 2;

    const stemGeo = new THREE.CylinderGeometry(0.32, 0.32, postHeight, 16);
    const stemMesh = new THREE.Mesh(stemGeo, postMat);
    stemMesh.position.set(0, postCenterY, 0);
    stemMesh.castShadow = true;
    this.gimbalGroup.add(stemMesh);

    // Collar lock ring at top of stem for visual accuracy
    const collarGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16);
    const collarMesh = new THREE.Mesh(collarGeo, clampMat);
    collarMesh.position.set(0, postTop - 0.25, 0);
    this.gimbalGroup.add(collarMesh);
  }

  /**
   * For Convex and Concave Mirrors:
   * Updates the formed image directly on the mirror reflective face!
   */
  updateMirrorReflection(sourceCanvas, physics) {
    if (!this.element.includes('Mirror')) return;

    const ctx = this.mirrorCtx;
    const w = this.mirrorCanvas.width;
    const h = this.mirrorCanvas.height;

    // Clear mirror canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Metallic mirror silver background with subtle radial gradient
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(0.7, '#cbd5e1');
    bgGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();

    const m = physics.m;
    const absM = Math.abs(m);
    const scale = Math.min(Math.max(absM, 0.15), 4.0);

    ctx.save();
    // Clip to circular mirror face
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
    ctx.clip();

    // Transform to center of mirror
    ctx.translate(w / 2, h / 2);

    // Inversion: if m < 0, image is inverted! (e.g. Concave mirror when u > f)
    const scaleY = m < 0 ? -scale : scale;
    // Mirrors have lateral reflection (horizontal flip)
    const scaleX = -scale;

    ctx.scale(scaleX, scaleY);

    // If focus is at infinity or error, apply blur
    if (physics.nature === 'At Infinity') {
      ctx.filter = 'blur(16px)';
    }

    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    ctx.drawImage(sourceCanvas, -sw / 2, -sh / 2, sw, sh);

    ctx.restore();

    // Mirror surface gloss highlight (curved reflection sheen)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.35, h * 0.35, w * 0.25, h * 0.12, -Math.PI / 4, 0, Math.PI * 2);
    const sheen = ctx.createRadialGradient(w * 0.35, h * 0.35, 0, w * 0.35, h * 0.35, w * 0.25);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.restore();

    // Status label at bottom of mirror face
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    const tag = `${this.element.toUpperCase()} REFLECTION`;
    ctx.fillText(tag, w / 2, h - 22);

    ctx.font = '13px "JetBrains Mono", sans-serif';
    ctx.fillText(`${physics.nature} • ${physics.orientation} • ${absM.toFixed(2)}×`, w / 2, h - 6);

    this.mirrorTexture.needsUpdate = true;
  }

  /**
   * 3D Focal Ring Markers on optical bench
   */
  updateFocalMarkers() {
    while (this.focalMarkersGroup.children.length > 0) {
      const child = this.focalMarkersGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      this.focalMarkersGroup.remove(child);
    }

    const f = this.focalLength;
    const isMirror = this.element.includes('Mirror');
    const ringRadius = 1.4;

    const ringGeo = new THREE.TorusGeometry(ringRadius, 0.08, 12, 32);
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 8);

    if (!isMirror) {
      // LENSES: F1 at -f, F2 at +f
      const markerMatF1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const markerMatF2 = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

      // F1 at z = -f
      const f1Group = new THREE.Group();
      f1Group.position.set(0, 0, -f);
      f1Group.add(new THREE.Mesh(ringGeo, markerMatF1));
      const stemF1 = new THREE.Mesh(stemGeo, markerMatF1);
      stemF1.position.y = -3;
      f1Group.add(stemF1);
      const s1 = this.createTextSprite('F₁ (-f)', '#38bdf8');
      s1.position.set(0, ringRadius + 1.2, 0);
      f1Group.add(s1);
      this.focalMarkersGroup.add(f1Group);

      // F2 at z = +f
      const f2Group = new THREE.Group();
      f2Group.position.set(0, 0, f);
      f2Group.add(new THREE.Mesh(ringGeo, markerMatF2));
      const stemF2 = new THREE.Mesh(stemGeo, markerMatF2);
      stemF2.position.y = -3;
      f2Group.add(stemF2);
      const s2 = this.createTextSprite('F₂ (+f)', '#f59e0b');
      s2.position.set(0, ringRadius + 1.2, 0);
      f2Group.add(s2);
      this.focalMarkersGroup.add(f2Group);

    } else {
      // MIRRORS: Focus F and Center of Curvature C
      // Concave Mirror: F at -f, C at -2f (in front of mirror)
      // Convex Mirror: F at +f, C at +2f (behind mirror)
      const sign = this.element.includes('Concave') ? -1 : 1;
      const markerMatF = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const markerMatC = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

      // Focus F
      const fGroup = new THREE.Group();
      fGroup.position.set(0, 0, sign * f);
      fGroup.add(new THREE.Mesh(ringGeo, markerMatF));
      const stemF = new THREE.Mesh(stemGeo, markerMatF);
      stemF.position.y = -3;
      fGroup.add(stemF);
      const sF = this.createTextSprite(`F (${sign > 0 ? '+' : '-'}f)`, '#f59e0b');
      sF.position.set(0, ringRadius + 1.2, 0);
      fGroup.add(sF);
      this.focalMarkersGroup.add(fGroup);

      // Center of Curvature C (R = 2f)
      const cGroup = new THREE.Group();
      cGroup.position.set(0, 0, sign * (2 * f));
      cGroup.add(new THREE.Mesh(ringGeo, markerMatC));
      const stemC = new THREE.Mesh(stemGeo, markerMatC);
      stemC.position.y = -3;
      cGroup.add(stemC);
      const sC = this.createTextSprite(`C (R=2f)`, '#a855f7');
      sC.position.set(0, ringRadius + 1.2, 0);
      cGroup.add(sC);
      this.focalMarkersGroup.add(cGroup);
    }
  }

  createTextSprite(text, color = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(8, 8, 240, 64, 10);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 26px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4, 1.3, 1);
    return sprite;
  }

  getMirrorCanvas() {
    return this.mirrorCanvas;
  }
}
