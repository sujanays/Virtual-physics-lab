import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { OpticalBenchScene } from './scene/OpticalBenchScene.js';
import { LensObject } from './scene/LensObject.js';
import { LightObject } from './scene/LightObject.js';
import { ScreenObject } from './scene/ScreenObject.js';
import { RayTracerVisualizer } from './scene/RayTracerVisualizer.js';
import { OpticsEngine, Matrix3x3 } from './math/OpticsMath.js';
import { DiagnosticPanel } from './ui/DiagnosticPanel.js';
import { GuiManager } from './ui/GuiManager.js';

class OpticsLabApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // System parameters (Aligned with Python MFAD Virtual Optics Lab)
    this.params = {
      // Optical Element
      element: 'Convex Lens', // 'Convex Lens', 'Concave Lens', 'Concave Mirror', 'Convex Mirror'

      // Bench positions (cm)
      u: 100.0,            // Object distance from lens/mirror (z = -u)
      vScreen: 100.0,      // Screen distance from lens (z = +vScreen)
      f: 50.0,             // Focal length (or Radius R for mirrors)
      height: 8.0,         // Object height (h)
      aperture: 12.0,      // Element aperture / diameter (D)
      objectType: 'Default Letter F', // 'Default Letter F', 'Device Image (Uploaded)', 'Light Arrow', 'USAF Test Target', 'Point Source Grid'
      uploadedImageName: '',

      // Goniometer 3x3 Orthogonal Matrix tilts
      tiltXDeg: 0.0,
      tiltYDeg: 0.0,

      // Ray Tracing
      rayCount: 15,
      rayMode: 'Aperture Fan',
      rayTheme: 'Cyan Glow',
      showVirtualExtensions: true
    };

    this.clock = new THREE.Clock();
    this.initThree();
    this.initSceneObjects();
    this.initUI();
    this.setupEventListeners();

    // Initial calculation & rendering
    this.updateOpticsSystem();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090e);
    this.scene.fog = new THREE.FogExp2(0x07090e, 0.003);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.5,
      2000
    );
    // Initial isometric perspective view of optical bench
    this.camera.position.set(70, 45, 95);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't go too far below bench floor
    this.controls.minDistance = 8;
    this.controls.maxDistance = 500;
    this.controls.target.set(0, 6, 0); // Focus on element optical center
  }

  initSceneObjects() {
    // 1. Realistic Optical Bench & Lab Lighting
    this.bench = new OpticalBenchScene(this.scene);

    // 2. 3D Optical Element (Convex/Concave Lens, Concave Spoon/Convex Dome Mirror)
    this.lens = new LensObject(this.scene);

    // 3. Emitting Light Object (Arrow, USAF Target, Point Grid, or Device Image)
    this.lightObject = new LightObject(this.scene);

    // 4. Dynamic Projection Screen with Gaussian Blur Texture (used for Lenses)
    this.screen = new ScreenObject(this.scene);

    // 5. Linear Algebra Ray Tracer Visualizer
    this.rayTracer = new RayTracerVisualizer(this.scene);
  }

  initUI() {
    // Diagnostic Panel HUD (Left Sidebar)
    const diagContainer = document.getElementById('diagnostic-panel-container');
    this.diagnosticPanel = new DiagnosticPanel({
      containerElement: diagContainer,
      onElementChange: (elem) => {
        this.params.element = elem;
        this.guiManager.updateElementLabel(elem.includes('Mirror'));
        this.guiManager.updateDisplay();
        this.updateOpticsSystem();
      },
      onParamChange: (key, val) => {
        this.params[key] = val;
        this.guiManager.updateDisplay();
        this.updateOpticsSystem();
      },
      onUploadImage: () => this.handleUploadImage(),
      onSnapFocus: () => this.snapScreenToFocus(),
      onShowLinearAlgebra: () => this.showLinearAlgebraModal()
    });

    // lil-gui Parametric Controls (Right Floating Panel)
    this.guiManager = new GuiManager({
      params: this.params,
      onChange: () => {
        this.guiManager.updateElementLabel(this.params.element.includes('Mirror'));
        this.updateOpticsSystem();
      },
      onPreset: (name) => this.applyPreset(name),
      onCameraView: (name) => this.setCameraView(name),
      onSnapFocus: () => this.snapScreenToFocus(),
      onUploadImage: () => this.handleUploadImage(),
      onShowLinearAlgebra: () => this.showLinearAlgebraModal()
    });

    // Camera bar buttons
    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        this.setCameraView(view);
      });
    });
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /**
   * Handles image upload from device and passes it to LightObject.
   * Updates object on the bench, screen projection, and mirror reflection.
   */
  handleUploadImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          this.params.objectType = 'Device Image (Uploaded)';
          this.params.uploadedImageName = file.name;
          this.lightObject.loadFromDevice(img, file.name);
          document.body.removeChild(input);

          // Update displays & simulation
          this.guiManager.updateDisplay();
          this.updateOpticsSystem();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    input.click();
  }

  /**
   * Displays the Linear Algebra Matrix Engine modal dialog (matching Python app)
   */
  showLinearAlgebraModal() {
    const modal = document.getElementById('linalg-modal');
    const codeEl = document.getElementById('linalg-modal-content');
    const closeBtn = document.getElementById('modal-close-btn');
    if (!modal || !codeEl) return;

    const physics = OpticsEngine.calculatePhysics(
      this.params.element,
      this.params.u,
      this.params.f,
      this.params.vScreen
    );
    const { P_obj, E_mat, P_img, System_mat, A_mat } = physics;

    const formatMat2 = (m) => `[[ ${m.a.toFixed(2).padStart(6)}, ${m.b.toFixed(2).padStart(8)} ]\n [ ${m.c.toFixed(4).padStart(6)}, ${m.d.toFixed(2).padStart(8)} ]]`;
    const formatMat3 = (m) => `[[ ${m[0][0].toFixed(2).padStart(6)}, ${m[0][1].toFixed(2).padStart(6)}, ${m[0][2].toFixed(2).padStart(6)} ]\n [ ${m[1][0].toFixed(2).padStart(6)}, ${m[1][1].toFixed(2).padStart(6)}, ${m[1][2].toFixed(2).padStart(6)} ]\n [ ${m[2][0].toFixed(2).padStart(6)}, ${m[2][1].toFixed(2).padStart(6)}, ${m[2][2].toFixed(2).padStart(6)} ]]`;

    let content = `=== VIRTUAL OPTICS LAB: MATRIX ENGINE ===\n\n`;
    content += `Optical Element        : ${this.params.element}\n`;
    content += `Base Matrix Resolution : 400 × 400 (uint8)\n`;
    content += `Input Object Source    : ${this.params.uploadedImageName ? this.params.uploadedImageName : this.params.objectType}\n`;
    content += `Formed Image Location  : ${physics.isMirror ? 'Formed directly ON CURVED MIRROR FACE' : 'Projected ON PROJECTION SCREEN'}\n\n`;

    content += `1. Object Propagation Matrix P(u) [u = ${this.params.u.toFixed(1)} cm]:\n`;
    content += `${formatMat2(P_obj)}\n\n`;

    content += `2. Optical Element Matrix E [${physics.isMirror ? 'Curvature R = ' + physics.R.toFixed(1) : 'Focal f = ' + physics.f.toFixed(1)} cm]:\n`;
    content += `${formatMat2(E_mat)}\n\n`;

    content += `3. Image Propagation Matrix P(v) [v = ${isFinite(physics.v) ? physics.v.toFixed(1) : '∞'} cm]:\n`;
    content += `${formatMat2(P_img)}\n\n`;

    content += `4. Total System Matrix System_mat = P(v) @ E @ P(u):\n`;
    content += `${formatMat2(System_mat)}\n`;
    content += `   Determinant: det(M) = ${System_mat.determinant().toFixed(3)} (Symplectic conservation of etendue)\n\n`;

    content += `5. Affine Transformation Matrix (Scaling & Zoom):\n`;
    content += `${formatMat3(A_mat)}\n\n`;

    content += `6. Optical Imaging Proof Condition:\n`;
    content += `   System_mat.B = ${System_mat.b.toFixed(2)} (Target ray convergence condition B = 0)\n`;
    content += `   System_mat.A = ${System_mat.a.toFixed(2)} (Paraxial transverse magnification m)\n`;

    codeEl.textContent = content;
    modal.classList.remove('hidden');

    closeBtn.onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    };
  }

  /**
   * Recalculates physical optical state and updates all 3D geometries, materials, and HUD
   */
  updateOpticsSystem() {
    const {
      element,
      u,
      vScreen,
      f,
      height,
      aperture,
      objectType,
      tiltXDeg,
      tiltYDeg,
      rayCount,
      rayMode,
      rayTheme,
      showVirtualExtensions,
      uploadedImageName
    } = this.params;

    // Convert tilt angles to radians
    const tiltXRad = (tiltXDeg * Math.PI) / 180.0;
    const tiltYRad = (tiltYDeg * Math.PI) / 180.0;

    // 1. Update 3D Optical Element (Shape: Spoon concave bowl, Spoon convex dome, or Glass lens)
    if (this.lens.element !== element) {
      this.lens.setElement(element);
    }
    this.lens.setFocalLength(f);
    this.lens.setAperture(aperture);
    this.lens.setTilt(tiltXRad, tiltYRad);

    // 2. Update Object on Bench
    this.lightObject.setDistance(u);
    this.lightObject.setHeight(height);
    if (this.lightObject.type !== objectType) {
      this.lightObject.setType(objectType);
    }

    // 3. Update Screen Position
    this.screen.setDistance(vScreen);

    // 4. Full Physics Calculation (ABCD matrices & paraxial ray transfer)
    const physics = OpticsEngine.calculatePhysics(element, u, f, vScreen);

    // 5. Conditional Projection / Reflection Behavior:
    // "for convex and concave mirrors - the images must be on the mirror and not on the screen"
    // "for lenses it should project on the screen"
    if (physics.isMirror) {
      // Hide screen on optical bench for mirrors (not used)
      this.screen.setVisible(false);
      // Project formed reflection directly onto the mirror face
      this.lens.updateMirrorReflection(this.lightObject.getSourceCanvas(), physics);
    } else {
      // Screen is active for lenses
      this.screen.setVisible(true);
      // Project onto physical screen with Gaussian blur based on focus error
      this.screen.updateProjection(
        this.lightObject.getSourceCanvas(),
        physics,
        aperture,
        height
      );
    }

    // 6. Update Ray Tracer (passes full physics object and 3D endpoints)
    const lensRotationMatrix = this.lens.getRotationMatrix();
    this.rayTracer.rayCount = rayCount;
    this.rayTracer.rayMode = rayMode;
    this.rayTracer.colorTheme = rayTheme;
    this.rayTracer.showVirtualExtensions = showVirtualExtensions;
    this.rayTracer.updateRays({
      element,
      physics,
      u,
      f,
      vScreen,
      height,
      aperture,
      lensRotationMatrix,
      objectTip: this.lightObject.getTipPoint(),
      objectMid: this.lightObject.getMidPoint(),
      objectBase: this.lightObject.getBasePoint()
    });

    // 7. Update Diagnostic HUD with full physics info, source canvas, and active formed canvas
    this.diagnosticPanel.update({
      element,
      physics,
      u,
      f,
      vScreen,
      height,
      aperture,
      lensRotationMatrix,
      sourceCanvas: this.lightObject.getSourceCanvas(),
      activeCanvas: physics.isMirror ? this.lens.getMirrorCanvas() : this.screen.getScreenCanvas(),
      uploadedImageName
    });

    // 8. Update top header badge
    const headerTag = document.getElementById('header-element-tag');
    if (headerTag) {
      headerTag.textContent = element.toUpperCase();
    }
  }

  /**
   * Snaps the physical screen directly to theoretical image focal plane v_focus (for lenses)
   */
  snapScreenToFocus() {
    const physics = OpticsEngine.calculatePhysics(this.params.element, this.params.u, this.params.f, this.params.vScreen);
    if (!physics.isMirror && physics.v > 0 && isFinite(physics.v)) {
      this.params.vScreen = Math.min(500, Math.max(5, parseFloat(physics.v.toFixed(1))));
      this.guiManager.updateDisplay();
      this.updateOpticsSystem();
    }
  }

  /**
   * Classical Optics Presets
   */
  applyPreset(presetName) {
    if (presetName === 'convex_equal_conjugate') {
      // Convex Lens: u = 2f (1:1 inverted image at v = 2f)
      this.params.element = 'Convex Lens';
      this.params.f = 50.0;
      this.params.u = 100.0;
      this.params.vScreen = 100.0;
      this.params.height = 8.0;
    } else if (presetName === 'convex_magnified') {
      // Convex Lens: f < u < 2f (Macro magnified image)
      this.params.element = 'Convex Lens';
      this.params.f = 50.0;
      this.params.u = 75.0;
      this.params.vScreen = 150.0;
      this.params.height = 6.0;
    } else if (presetName === 'convex_magnifier') {
      // Convex Lens: u < f (Magnifying glass, virtual upright)
      this.params.element = 'Convex Lens';
      this.params.f = 50.0;
      this.params.u = 30.0;
      this.params.vScreen = 75.0;
      this.params.height = 5.0;
    } else if (presetName === 'concave_mirror_real') {
      // Concave Mirror: u = 2f = R (Real inverted image formed on mirror)
      this.params.element = 'Concave Mirror';
      this.params.f = 50.0; // R = 100
      this.params.u = 100.0;
      this.params.height = 8.0;
    } else if (presetName === 'concave_mirror_virtual') {
      // Concave Mirror: u < f (Shaving mirror: upright magnified reflection)
      this.params.element = 'Concave Mirror';
      this.params.f = 50.0; // R = 100
      this.params.u = 30.0;
      this.params.height = 6.0;
    } else if (presetName === 'convex_mirror_dome') {
      // Convex Mirror: Wide Angle Dome / Security mirror (upright diminished)
      this.params.element = 'Convex Mirror';
      this.params.f = 50.0; // R = 100
      this.params.u = 80.0;
      this.params.height = 8.0;
    } else if (presetName === 'concave_lens_diverge') {
      // Concave Lens: Diverging Virtual image
      this.params.element = 'Concave Lens';
      this.params.f = 50.0;
      this.params.u = 80.0;
      this.params.vScreen = 80.0;
      this.params.height = 8.0;
    }

    this.guiManager.updateElementLabel(this.params.element.includes('Mirror'));
    this.guiManager.updateDisplay();
    this.updateOpticsSystem();
  }

  /**
   * Camera Viewport Presets
   */
  setCameraView(viewName) {
    if (viewName === 'perspective') {
      // 3D Perspective Isometric
      this.animateCameraTo(
        new THREE.Vector3(70, 45, 95),
        new THREE.Vector3(0, 6, 0)
      );
    } else if (viewName === 'side') {
      // 2D Side Elevation View (Y-Z Bench plane)
      this.animateCameraTo(
        new THREE.Vector3(120, 6, 0),
        new THREE.Vector3(0, 6, 0)
      );
    } else if (viewName === 'top') {
      // Top Down Orthogonal-style View (X-Z plane)
      this.animateCameraTo(
        new THREE.Vector3(0, 140, 0.1),
        new THREE.Vector3(0, 0, 0)
      );
    } else if (viewName === 'screen') {
      // Looking directly at projection screen face or mirror face
      if (this.params.element.includes('Mirror')) {
        this.animateCameraTo(
          new THREE.Vector3(0, 8, -40),
          new THREE.Vector3(0, 8, 0)
        );
      } else {
        this.animateCameraTo(
          new THREE.Vector3(0, 12, this.params.vScreen - 35),
          new THREE.Vector3(0, 12, this.params.vScreen)
        );
      }
    } else if (viewName === 'lens') {
      // Looking through/at element from behind the object
      this.animateCameraTo(
        new THREE.Vector3(0, this.params.height * 0.8, -this.params.u - 30),
        new THREE.Vector3(0, 6, 0)
      );
    }
  }

  animateCameraTo(targetPos, targetLookAt) {
    const startPos = this.camera.position.clone();
    const startLookAt = this.controls.target.clone();
    const startTime = performance.now();
    const duration = 650; // ms

    const ease = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = ease(progress);

      this.camera.position.lerpVectors(startPos, targetPos, eased);
      this.controls.target.lerpVectors(startLookAt, targetLookAt, eased);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.controls.update();

    // Animate subtle laser pulses & focus glows
    this.rayTracer.animate(delta);

    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new OpticsLabApp();
});
