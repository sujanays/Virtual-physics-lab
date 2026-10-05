import GUI from 'lil-gui';

export class GuiManager {
  constructor({ params, onChange, onPreset, onCameraView, onSnapFocus, onUploadImage, onShowLinearAlgebra }) {
    this.params = params;
    this.onChange = onChange;
    this.onPreset = onPreset;
    this.onCameraView = onCameraView;
    this.onSnapFocus = onSnapFocus;
    this.onUploadImage = onUploadImage;
    this.onShowLinearAlgebra = onShowLinearAlgebra;

    this.gui = new GUI({ title: 'VIRTUAL OPTICS LAB (MFAD)', width: 330 });
    this.buildGui();
  }

  buildGui() {
    // 1. Optical Element Selection (Core requirement)
    const elemFolder = this.gui.addFolder('Optical Element Selection');
    
    this.elemController = elemFolder.add(this.params, 'element', [
      'Convex Lens',
      'Concave Lens',
      'Concave Mirror',
      'Convex Mirror'
    ])
      .name('Element Type')
      .listen()
      .onChange(() => this.onChange());

    elemFolder.add({ showLinalg: () => this.onShowLinearAlgebra() }, 'showLinalg')
      .name('⚡ Show Linear Algebra');

    // 2. Bench & Geometry Folder (Matching Python lab ranges)
    const benchFolder = this.gui.addFolder('Bench Positions & Optics');
    
    this.uController = benchFolder.add(this.params, 'u', 10, 300, 0.5)
      .name('Object Dist (u) [cm]')
      .listen()
      .onChange(() => this.onChange());

    this.fController = benchFolder.add(this.params, 'f', 10, 300, 0.5)
      .name('Focal / Radius [cm]')
      .listen()
      .onChange(() => this.onChange());

    this.screenController = benchFolder.add(this.params, 'vScreen', 10, 500, 0.5)
      .name('Screen Dist (v) [cm]')
      .listen()
      .onChange(() => this.onChange());

    benchFolder.add({ snap: () => this.onSnapFocus() }, 'snap')
      .name('🎯 Snap Screen to Focus');

    benchFolder.add(this.params, 'aperture', 4, 20, 0.5)
      .name('Aperture (D) [cm]')
      .listen()
      .onChange(() => this.onChange());

    // 3D Goniometer Tilts
    benchFolder.add(this.params, 'tiltXDeg', -15, 15, 0.5)
      .name('Tilt θ_x [deg]')
      .listen()
      .onChange(() => this.onChange());

    benchFolder.add(this.params, 'tiltYDeg', -15, 15, 0.5)
      .name('Tilt θ_y [deg]')
      .listen()
      .onChange(() => this.onChange());

    // 3. Object & Device Image Folder
    const objFolder = this.gui.addFolder('Object Configuration');

    objFolder.add({ upload: () => this.onUploadImage() }, 'upload')
      .name('📁 Upload Image from Device');

    this.objTypeController = objFolder.add(this.params, 'objectType', [
      'Default Letter F',
      'Device Image (Uploaded)',
      'Light Arrow',
      'USAF Test Target',
      'Point Source Grid'
    ])
      .name('Object Type')
      .listen()
      .onChange(() => this.onChange());

    objFolder.add(this.params, 'height', 2, 20, 0.5)
      .name('Object Height (h) [cm]')
      .listen()
      .onChange(() => this.onChange());

    // 4. Ray Tracing Visualizer Folder
    const rayFolder = this.gui.addFolder('Ray Tracing Engine');

    rayFolder.add(this.params, 'rayCount', 3, 40, 1)
      .name('Ray Density (N)')
      .listen()
      .onChange(() => this.onChange());

    rayFolder.add(this.params, 'rayMode', ['Aperture Fan', 'Cardinal Rays', 'Multi-Source Bundle'])
      .name('Ray Bundle Mode')
      .listen()
      .onChange(() => this.onChange());

    rayFolder.add(this.params, 'rayTheme', ['Cyan Glow', 'Laser Green', 'Sodium Amber', 'Spectrum'])
      .name('Laser Color')
      .listen()
      .onChange(() => this.onChange());

    rayFolder.add(this.params, 'showVirtualExtensions')
      .name('Show Virtual Rays')
      .listen()
      .onChange(() => this.onChange());

    // 5. Presets Folder
    const presetFolder = this.gui.addFolder('Classical Optics Presets');
    
    presetFolder.add({ p: () => this.onPreset('convex_equal_conjugate') }, 'p').name('1. Convex Lens: u = 2f (1:1 Inv)');
    presetFolder.add({ p: () => this.onPreset('convex_magnified') }, 'p').name('2. Convex Lens: f < u < 2f (Macro)');
    presetFolder.add({ p: () => this.onPreset('convex_magnifier') }, 'p').name('3. Convex Lens: u < f (Virtual)');
    presetFolder.add({ p: () => this.onPreset('concave_mirror_real') }, 'p').name('4. Concave Mirror: u = 2f (In Spoon)');
    presetFolder.add({ p: () => this.onPreset('concave_mirror_virtual') }, 'p').name('5. Concave Mirror: u < f (Shaving)');
    presetFolder.add({ p: () => this.onPreset('convex_mirror_dome') }, 'p').name('6. Convex Mirror: Wide Angle Dome');
    presetFolder.add({ p: () => this.onPreset('concave_lens_diverge') }, 'p').name('7. Concave Lens: Diverging Virtual');

    // 6. Camera Viewpoints Folder
    const camFolder = this.gui.addFolder('Camera Viewpoints');
    camFolder.add({ v: () => this.onCameraView('perspective') }, 'v').name('🎥 3D Orbit Perspective');
    camFolder.add({ v: () => this.onCameraView('side') }, 'v').name('📐 Side Elevation (2D Y-Z)');
    camFolder.add({ v: () => this.onCameraView('top') }, 'v').name('⬆ Top Down View (X-Z)');
    camFolder.add({ v: () => this.onCameraView('element') }, 'v').name('🔍 Look At Mirror / Lens');
    camFolder.add({ v: () => this.onCameraView('screen') }, 'v').name('🎯 Screen Detector POV');

    elemFolder.open();
    benchFolder.open();
    objFolder.open();
  }

  updateElementLabel(isMirror) {
    if (this.fController) {
      this.fController.name(isMirror ? 'Radius of Curvature (R)' : 'Focal Length (f)');
    }
    if (this.screenController) {
      if (isMirror) {
        this.screenController.name('Screen Dist (N/A Mirror)');
      } else {
        this.screenController.name('Screen Dist (v) [cm]');
      }
    }
  }

  updateDisplay() {
    this.gui.controllersRecursive().forEach(c => c.updateDisplay());
  }

  destroy() {
    this.gui.destroy();
  }
}
