import * as THREE from 'three';
import { createRulerTexture } from './RulerTexture.js';

export class OpticalBenchScene {
  constructor(scene) {
    this.scene = scene;
    this.benchLength = 240; // cm (-120 to +120)
    this.railSpacing = 8;   // cm between dual rails
    this.railRadius = 1.2;  // cm

    this.initEnvironment();
    this.initOpticalBench();
  }

  initEnvironment() {
    // Laboratory Floor / Surface
    const floorGeo = new THREE.PlaneGeometry(350, 250);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1017,
      roughness: 0.35,
      metalness: 0.25,
      dithering: true
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -18;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle grid on floor
    const grid = new THREE.GridHelper(300, 30, 0x1e293b, 0x0f172a);
    grid.position.y = -17.95;
    this.scene.add(grid);

    // Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xdce7f5, 0.7);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(40, 70, 50);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 250;
    keyLight.shadow.camera.left = -100;
    keyLight.shadow.camera.right = 100;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -100;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    fillLight.position.set(-60, 40, -40);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(0, 30, -120);
    this.scene.add(rimLight);
  }

  initOpticalBench() {
    this.benchGroup = new THREE.Group();
    this.scene.add(this.benchGroup);

    // Materials
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd4d8e0,
      metalness: 0.92,
      roughness: 0.18,
      envMapIntensity: 1.5
    });

    const blackAnodizedMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      metalness: 0.7,
      roughness: 0.4
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25
    });

    // 1. Dual Polished Steel Optical Rails (along Z axis)
    const railGeo = new THREE.CylinderGeometry(this.railRadius, this.railRadius, this.benchLength, 32);
    railGeo.rotateX(Math.PI / 2); // align with Z axis

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-this.railSpacing / 2, -6, 0);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    this.benchGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(this.railSpacing / 2, -6, 0);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;
    this.benchGroup.add(rightRail);

    // 2. Central Millimeter/Centimeter Precision Ruler Inlay
    const rulerGeo = new THREE.BoxGeometry(3.6, 0.25, this.benchLength);
    const rulerTex = createRulerTexture();
    rulerTex.center.set(0.5, 0.5);
    rulerTex.rotation = Math.PI / 2; // Orient along Z

    const rulerMat = new THREE.MeshStandardMaterial({
      map: rulerTex,
      metalness: 0.4,
      roughness: 0.35
    });

    // Custom face materials so ruler texture only appears on top face
    const rulerMaterials = [
      blackAnodizedMat, // right
      blackAnodizedMat, // left
      rulerMat,         // top
      blackAnodizedMat, // bottom
      blackAnodizedMat, // front
      blackAnodizedMat  // back
    ];

    const rulerMesh = new THREE.Mesh(rulerGeo, rulerMaterials);
    rulerMesh.position.set(0, -6.1, 0);
    rulerMesh.castShadow = true;
    this.benchGroup.add(rulerMesh);

    // 3. Heavy-Duty Base Bed & Channel Plates
    const bedGeo = new THREE.BoxGeometry(16, 2.5, this.benchLength + 4);
    const bedMesh = new THREE.Mesh(bedGeo, blackAnodizedMat);
    bedMesh.position.set(0, -8, 0);
    bedMesh.castShadow = true;
    bedMesh.receiveShadow = true;
    this.benchGroup.add(bedMesh);

    // 4. Bench Support End-Stands and Leveling Feet
    const supportPositions = [-115, 0, 115]; // Left, center, right supports
    supportPositions.forEach((zPos) => {
      const supportGeo = new THREE.BoxGeometry(22, 6, 8);
      const supportMesh = new THREE.Mesh(supportGeo, blackAnodizedMat);
      supportMesh.position.set(0, -11.5, zPos);
      supportMesh.castShadow = true;
      this.benchGroup.add(supportMesh);

      // Leveling feet
      [-9, 9].forEach((xOffset) => {
        const footStemGeo = new THREE.CylinderGeometry(0.7, 0.7, 4, 16);
        const footStem = new THREE.Mesh(footStemGeo, brassMat);
        footStem.position.set(xOffset, -15, zPos);
        this.benchGroup.add(footStem);

        const footPadGeo = new THREE.CylinderGeometry(2.2, 2.6, 1.2, 24);
        const footPadMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 });
        const footPad = new THREE.Mesh(footPadGeo, footPadMat);
        footPad.position.set(xOffset, -17, zPos);
        footPad.castShadow = true;
        this.benchGroup.add(footPad);
      });
    });

    // 5. Optical Bench Axis Reference Guide
    const axisMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 2,
      gapSize: 1.5,
      opacity: 0.35,
      transparent: true
    });
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, -125),
      new THREE.Vector3(0, 0, 125)
    ]);
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.computeLineDistances();
    this.scene.add(axisLine);
  }

  /**
   * Helper to create a realistic laboratory bench rider mount
   * Clamps onto the optical rail, carries vertical post and vernier index pointer
   */
  static createMountRider(label = '', colorAccent = 0x3b82f6) {
    const group = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      metalness: 0.8,
      roughness: 0.3
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.15
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.25
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: colorAccent,
      metalness: 0.5,
      roughness: 0.3
    });

    // Rider Base Block (clamps over the two rails)
    const baseGeo = new THREE.BoxGeometry(12, 3.5, 7);
    const baseMesh = new THREE.Mesh(baseGeo, darkMetal);
    baseMesh.position.y = -5;
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // Accent Stripe
    const stripeGeo = new THREE.BoxGeometry(12.1, 0.4, 7.1);
    const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
    stripeMesh.position.y = -4;
    group.add(stripeMesh);

    // Rail Guide Grooves (visual underneath)
    [-4, 4].forEach(x => {
      const clampGeo = new THREE.CylinderGeometry(1.4, 1.4, 7.1, 16);
      clampGeo.rotateX(Math.PI / 2);
      const clampMesh = new THREE.Mesh(clampGeo, darkMetal);
      clampMesh.position.set(x, -6, 0);
      group.add(clampMesh);
    });

    // Vernier Precision Pointer (pointing directly down to the center ruler at y = -5.9)
    const pointerGeo = new THREE.ConeGeometry(0.5, 1.4, 4);
    pointerGeo.rotateZ(Math.PI);
    const pointerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 }); // Bright red indicator
    const pointerMesh = new THREE.Mesh(pointerGeo, pointerMat);
    pointerMesh.position.set(0, -5.2, 3.6);
    group.add(pointerMesh);

    // NOTE: Socket and sleeve removed — they caused a vertical stick through the lens aperture.

    // Knurled Locking Knob (Lab clamping screw)
    const knobGeo = new THREE.CylinderGeometry(1.1, 1.1, 1.4, 20);
    const knobMesh = new THREE.Mesh(knobGeo, brassMat);
    knobMesh.rotation.z = Math.PI / 2;
    knobMesh.position.set(2.4, -2.4, 0);
    knobMesh.castShadow = true;
    group.add(knobMesh);

    return group;
  }
}
