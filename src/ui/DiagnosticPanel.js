import { OpticsEngine } from '../math/OpticsMath.js';

export class DiagnosticPanel {
  constructor({
    containerElement,
    onElementChange,
    onParamChange,
    onUploadImage,
    onSnapToFocus,
    onShowLinearAlgebra
  }) {
    this.container = containerElement;
    this.onElementChange = onElementChange;
    this.onParamChange = onParamChange;
    this.onUploadImage = onUploadImage;
    this.onSnapToFocus = onSnapToFocus;
    this.onShowLinearAlgebra = onShowLinearAlgebra;

    this.isUpdatingFromInternal = false;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="diag-header">
        <div class="diag-title">
          <span class="pulse-dot"></span>
          <span id="element-display-title">OPTICS LAB TELEMETRY</span>
        </div>
        <div class="diag-badge" id="image-type-badge">REAL & INVERTED</div>
      </div>

      <!-- Quick Interactive Bench Controls (Python Lab Sidebar Equivalent) -->
      <div class="quick-controls-card">
        <div class="ctrl-group">
          <label class="ctrl-label" for="diag-element-select">Optical Element:</label>
          <select id="diag-element-select" class="ctrl-select">
            <option value="Convex Lens">Convex Lens (Converging)</option>
            <option value="Concave Lens">Concave Lens (Diverging)</option>
            <option value="Concave Mirror">Concave Mirror (Inside of Spoon)</option>
            <option value="Convex Mirror">Convex Mirror (Outside of Spoon / Dome)</option>
          </select>
        </div>

        <div class="ctrl-slider-block">
          <div class="slider-row-header">
            <span class="ctrl-label">Object Dist (u):</span>
            <span class="slider-num-val" id="ctrl-val-u">100.0 cm</span>
          </div>
          <input type="range" id="ctrl-slider-u" class="ctrl-slider" min="10" max="300" step="0.5" value="100">
        </div>

        <div class="ctrl-slider-block">
          <div class="slider-row-header">
            <span class="ctrl-label" id="ctrl-label-f">Focal Length (f):</span>
            <span class="slider-num-val" id="ctrl-val-f">50.0 cm</span>
          </div>
          <input type="range" id="ctrl-slider-f" class="ctrl-slider" min="10" max="300" step="0.5" value="50">
        </div>

        <div class="ctrl-slider-block" id="ctrl-block-screen">
          <div class="slider-row-header">
            <span class="ctrl-label" id="ctrl-label-screen">Screen Dist (v):</span>
            <span class="slider-num-val" id="ctrl-val-screen">100.0 cm</span>
          </div>
          <input type="range" id="ctrl-slider-screen" class="ctrl-slider" min="10" max="500" step="0.5" value="100">
        </div>

        <div class="action-buttons-group">
          <button id="btn-select-image" class="btn-action cyan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>SELECT INPUT IMAGE FROM DEVICE</span>
          </button>
          <div id="upload-status-tag" class="upload-tag">Source: Default Letter F (Asymmetric MFAD Matrix)</div>

          <div class="dual-action-row">
            <button id="btn-show-linalg" class="btn-action purple">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              <span>SHOW LINEAR ALGEBRA</span>
            </button>
            <button id="btn-snap-focus" class="btn-action amber">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span id="snap-btn-text">SNAP FOCUS</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Key Metrics Strip -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Object Distance (u)</div>
          <div class="metric-val" id="metric-u">100.0 <span class="unit">cm</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-label" id="metric-f-label">Focal Length (f)</div>
          <div class="metric-val" id="metric-f">50.0 <span class="unit">cm</span></div>
          <div class="metric-sub" id="metric-power">Power: +2.00 D</div>
        </div>
        <div class="metric-card highlight">
          <div class="metric-label">Image Distance (v)</div>
          <div class="metric-val" id="metric-vfocus">+100.0 <span class="unit">cm</span></div>
          <div class="metric-sub" id="metric-delta">Δv to Screen: 0.0 cm</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Magnification (m)</div>
          <div class="metric-val" id="metric-m">-1.00 <span class="unit">×</span></div>
          <div class="metric-sub" id="metric-size">Same size</div>
        </div>
      </div>

      <!-- Physics Image Formation Status Box (from Python Lab) -->
      <div class="python-status-card">
        <div class="status-card-header">
          <span>IMAGE FORMATION DIAGNOSTIC</span>
          <span id="img-location-badge" class="location-badge screen">ON SCREEN</span>
        </div>
        <div class="status-grid">
          <div class="status-item">
            <span class="s-label">Nature:</span>
            <strong id="stat-nature" class="text-green">Real Image</strong>
          </div>
          <div class="status-item">
            <span class="s-label">Orientation:</span>
            <strong id="stat-orientation">↓ Inverted</strong>
          </div>
          <div class="status-item">
            <span class="s-label">Size:</span>
            <strong id="stat-size">Same size</strong>
          </div>
          <div class="status-item">
            <span class="s-label">Formed At:</span>
            <strong id="stat-formed">Projection Screen</strong>
          </div>
          <div class="status-item">
            <span class="s-label">Screen Req:</span>
            <strong id="stat-screen-req" class="text-amber">YES</strong>
          </div>
          <div class="status-item">
            <span class="s-label">Observer Req:</span>
            <strong id="stat-obs-req">NO</strong>
          </div>
        </div>
        <div class="status-focus-line" id="stat-focus-error">Focus Error: 0.0 units</div>
      </div>

      <!-- Circle of Confusion / Sharpness Strip -->
      <div class="coc-strip" id="coc-container">
        <div class="coc-header">
          <span id="coc-title">CIRCLE OF CONFUSION (CoC)</span>
          <span id="coc-value" class="coc-tag">0.00 mm (PIN SHARP)</span>
        </div>
        <div class="coc-bar-bg">
          <div class="coc-bar-fill" id="coc-bar-fill" style="width: 2%;"></div>
        </div>
      </div>

      <!-- Dual Matrix Image Viewports (Original Input vs Formed Image) -->
      <div class="dual-viewport-card">
        <div class="section-title">
          <span>MATRIX IMAGE TRANSFORMATION</span>
          <span class="math-sub">Affine Scaling & Inversion</span>
        </div>
        <div class="dual-canvas-grid">
          <div class="canvas-item">
            <div class="canvas-tag">INPUT OBJECT MATRIX</div>
            <div class="canvas-wrap">
              <canvas id="mini-input-canvas" width="160" height="160"></canvas>
            </div>
            <div class="canvas-desc">Source [400×400]</div>
          </div>
          <div class="canvas-item">
            <div class="canvas-tag" id="formed-canvas-tag">FORMED IMAGE</div>
            <div class="canvas-wrap">
              <canvas id="mini-detector-canvas" width="160" height="160"></canvas>
            </div>
            <div class="canvas-desc" id="formed-canvas-desc">Scaled & Inverted</div>
          </div>
        </div>
      </div>

      <!-- Ray Transfer Matrix (ABCD) Mechanics -->
      <div class="collapsible-section">
        <div class="section-title">
          <span>RAY TRANSFER MATRIX MECHANICS</span>
          <span class="math-sub">r_out = System_mat · r_in</span>
        </div>
        
        <div class="matrix-math-box">
          <div class="formula-line" id="formula-math-line">
            System_mat = P(v) · E(f) · P(u)
          </div>

          <div class="matrices-display">
            <!-- Drift u -->
            <div class="matrix-card">
              <div class="m-label">P(u) [Object]</div>
              <div class="m-bracket">
                <div class="m-row"><span id="m-u-a">1.00</span><span id="m-u-b">100.0</span></div>
                <div class="m-row"><span id="m-u-c">0.00</span><span id="m-u-d">1.00</span></div>
              </div>
            </div>

            <span class="m-op">×</span>

            <!-- Element E -->
            <div class="matrix-card">
              <div class="m-label" id="m-elem-label">E [Element]</div>
              <div class="m-bracket">
                <div class="m-row"><span id="m-l-a">1.00</span><span id="m-l-b">0.00</span></div>
                <div class="m-row"><span id="m-l-c">-0.02</span><span id="m-l-d">1.00</span></div>
              </div>
            </div>

            <span class="m-op">×</span>

            <!-- Drift v -->
            <div class="matrix-card">
              <div class="m-label">P(v) [Image]</div>
              <div class="m-bracket">
                <div class="m-row"><span id="m-v-a">1.00</span><span id="m-v-b">100.0</span></div>
                <div class="m-row"><span id="m-v-c">0.00</span><span id="m-v-d">1.00</span></div>
              </div>
            </div>

            <span class="m-op">=</span>

            <!-- Total System Matrix -->
            <div class="matrix-card total">
              <div class="m-label">System_mat</div>
              <div class="m-bracket">
                <div class="m-row"><span id="m-tot-a">-1.00</span><span id="m-tot-b">0.00</span></div>
                <div class="m-row"><span id="m-tot-c">-0.02</span><span id="m-tot-d">-1.00</span></div>
              </div>
              <div class="m-det" id="m-tot-det">det = 1.000 (Symplectic)</div>
            </div>
          </div>

          <div class="imaging-proof" id="imaging-proof-text">
            ★ Imaging condition: <strong>B = 0</strong> (All rays arrive at y_out = A · y regardless of angle θ).
          </div>
        </div>
      </div>
    `;

    // Bind Select & Sliders
    const selectElem = document.getElementById('diag-element-select');
    selectElem.addEventListener('change', (e) => {
      if (this.onElementChange) this.onElementChange(e.target.value);
    });

    const sliderU = document.getElementById('ctrl-slider-u');
    sliderU.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('ctrl-val-u').textContent = `${val.toFixed(1)} cm`;
      if (this.onParamChange) this.onParamChange('u', val);
    });

    const sliderF = document.getElementById('ctrl-slider-f');
    sliderF.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('ctrl-val-f').textContent = `${val.toFixed(1)} cm`;
      if (this.onParamChange) this.onParamChange('f', val);
    });

    const sliderScreen = document.getElementById('ctrl-slider-screen');
    sliderScreen.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('ctrl-val-screen').textContent = `${val.toFixed(1)} cm`;
      if (this.onParamChange) this.onParamChange('vScreen', val);
    });

    // Buttons
    document.getElementById('btn-select-image').addEventListener('click', () => {
      if (this.onUploadImage) this.onUploadImage();
    });

    document.getElementById('btn-snap-focus').addEventListener('click', () => {
      if (this.onSnapToFocus) this.onSnapToFocus();
    });

    document.getElementById('btn-show-linalg').addEventListener('click', () => {
      if (this.onShowLinearAlgebra) this.onShowLinearAlgebra();
    });

    this.miniInputCanvas = document.getElementById('mini-input-canvas');
    this.miniInputCtx = this.miniInputCanvas.getContext('2d');

    this.miniCanvas = document.getElementById('mini-detector-canvas');
    this.miniCtx = this.miniCanvas.getContext('2d');
  }

  update({
    element,
    physics,
    u,
    f,
    vScreen,
    height,
    aperture,
    lensRotationMatrix,
    sourceCanvas,
    activeCanvas,
    uploadedImageName
  }) {
    const isMirror = physics.isMirror;

    // Synchronize UI Select and Sliders without infinite triggers
    const selectElem = document.getElementById('diag-element-select');
    if (selectElem && selectElem.value !== element) {
      selectElem.value = element;
    }

    const sliderU = document.getElementById('ctrl-slider-u');
    if (sliderU && Math.abs(parseFloat(sliderU.value) - u) > 0.4) {
      sliderU.value = u;
    }
    document.getElementById('ctrl-val-u').textContent = `${u.toFixed(1)} cm`;

    const sliderF = document.getElementById('ctrl-slider-f');
    if (sliderF && Math.abs(parseFloat(sliderF.value) - f) > 0.4) {
      sliderF.value = f;
    }
    document.getElementById('ctrl-label-f').textContent = isMirror ? 'Radius of Curv (R):' : 'Focal Length (f):';
    document.getElementById('ctrl-val-f').textContent = `${f.toFixed(1)} cm`;

    const screenBlock = document.getElementById('ctrl-block-screen');
    const sliderScreen = document.getElementById('ctrl-slider-screen');
    if (isMirror) {
      if (screenBlock) screenBlock.style.opacity = '0.35';
      if (sliderScreen) sliderScreen.disabled = true;
      document.getElementById('ctrl-label-screen').textContent = 'Screen (Not used):';
      document.getElementById('ctrl-val-screen').textContent = 'N/A';
    } else {
      if (screenBlock) screenBlock.style.opacity = '1.0';
      if (sliderScreen) sliderScreen.disabled = false;
      document.getElementById('ctrl-label-screen').textContent = 'Screen Dist (v):';
      if (sliderScreen && Math.abs(parseFloat(sliderScreen.value) - vScreen) > 0.4) {
        sliderScreen.value = vScreen;
      }
      document.getElementById('ctrl-val-screen').textContent = `${vScreen.toFixed(1)} cm`;
    }

    // Source image tag
    const uploadTag = document.getElementById('upload-status-tag');
    if (uploadTag) {
      if (uploadedImageName) {
        uploadTag.textContent = `Source: 📁 ${uploadedImageName}`;
        uploadTag.classList.add('custom');
      } else {
        uploadTag.textContent = `Source: Default Letter F (Asymmetric MFAD Matrix)`;
        uploadTag.classList.remove('custom');
      }
    }

    // Header title
    document.getElementById('element-display-title').textContent = `${element.toUpperCase()} TELEMETRY`;

    // 1. Core Metrics Readouts
    const elU = document.getElementById('metric-u');
    const elF = document.getElementById('metric-f');
    const elFLabel = document.getElementById('metric-f-label');
    const elPower = document.getElementById('metric-power');
    const elVFocus = document.getElementById('metric-vfocus');
    const elDelta = document.getElementById('metric-delta');
    const elM = document.getElementById('metric-m');
    const elSize = document.getElementById('metric-size');
    const elBadge = document.getElementById('image-type-badge');

    elU.innerHTML = `${u.toFixed(1)} <span class="unit">cm</span>`;

    if (isMirror) {
      elFLabel.textContent = `Radius / Focus (R, f)`;
      elF.innerHTML = `R=${physics.R.toFixed(1)} <span class="unit">f=${Math.abs(physics.f).toFixed(1)}cm</span>`;
      elPower.textContent = `Focal Length: ${physics.f.toFixed(1)} cm`;
    } else {
      elFLabel.textContent = `Focal Length (f)`;
      elF.innerHTML = `${f.toFixed(1)} <span class="unit">cm</span>`;
      elPower.textContent = `Power: ${OpticsEngine.calculatePower(f).toFixed(2)} D`;
    }

    const v = physics.v;
    const m = physics.m;

    if (!isFinite(v)) {
      elVFocus.innerHTML = `∞ <span class="unit">(Infinity)</span>`;
      elDelta.textContent = `Parallel Beam (u = f)`;
      elM.innerHTML = `∞`;
      elSize.textContent = `Extremely large`;
      elBadge.textContent = 'AT INFINITY';
      elBadge.className = 'diag-badge collimated';
    } else if (v > 0) {
      elVFocus.innerHTML = `${v.toFixed(1)} <span class="unit">cm</span>`;
      elDelta.textContent = isMirror ? `Formed on mirror face` : `Δv: ${physics.focusError.toFixed(1)} cm`;
      elM.innerHTML = `${Math.abs(m).toFixed(2)} <span class="unit">× (${m < 0 ? 'Inv' : 'Erect'})</span>`;
      elSize.textContent = physics.sizeDesc;
      elBadge.textContent = `${physics.nature.toUpperCase()} & ${physics.orientation.toUpperCase()}`;
      elBadge.className = 'diag-badge real';
    } else {
      elVFocus.innerHTML = `${v.toFixed(1)} <span class="unit">cm</span>`;
      elDelta.textContent = `Virtual (${isMirror ? 'Behind mirror' : 'Behind lens'})`;
      elM.innerHTML = `${Math.abs(m).toFixed(2)} <span class="unit">× (Upright)</span>`;
      elSize.textContent = physics.sizeDesc;
      elBadge.textContent = 'VIRTUAL & UPRIGHT';
      elBadge.className = 'diag-badge virtual';
    }

    // Python Status Card
    const arrow = physics.orientation === 'Upright' ? '↑' : (physics.orientation === 'Inverted' ? '↓' : '∞');
    document.getElementById('stat-nature').textContent = `${physics.nature} Image`;
    document.getElementById('stat-nature').className = physics.nature === 'Real' ? 'text-green' : 'text-amber';
    document.getElementById('stat-orientation').textContent = `${arrow} ${physics.orientation}`;
    document.getElementById('stat-size').textContent = physics.sizeDesc;

    const locBadge = document.getElementById('img-location-badge');
    if (isMirror) {
      locBadge.textContent = 'ON MIRROR';
      locBadge.className = 'location-badge mirror';
      document.getElementById('stat-formed').textContent = 'Curved Mirror Surface';
      document.getElementById('stat-screen-req').textContent = 'NO';
      document.getElementById('stat-screen-req').className = 'text-green';
      document.getElementById('stat-obs-req').textContent = 'YES (Look in mirror)';
      document.getElementById('stat-focus-error').textContent = `Mirror Surface: 3D ${element} (${physics.nature} Reflection)`;
      document.getElementById('snap-btn-text').textContent = 'SCREEN NOT USED';
      document.getElementById('btn-snap-focus').style.opacity = '0.4';
    } else {
      locBadge.textContent = 'ON SCREEN';
      locBadge.className = 'location-badge screen';
      document.getElementById('stat-formed').textContent = 'Projection Screen';
      document.getElementById('stat-screen-req').textContent = physics.screenReq ? 'YES' : 'NO';
      document.getElementById('stat-screen-req').className = physics.screenReq ? 'text-amber' : 'text-green';
      document.getElementById('stat-obs-req').textContent = physics.screenReq ? 'NO' : 'YES';
      document.getElementById('stat-focus-error').textContent = `Focus Error: ${physics.focusError.toFixed(1)} units`;
      document.getElementById('snap-btn-text').textContent = 'SNAP FOCUS';
      document.getElementById('btn-snap-focus').style.opacity = '1.0';
    }

    // CoC Bar Readout
    const cocValEl = document.getElementById('coc-value');
    const cocBarEl = document.getElementById('coc-bar-fill');
    if (!isMirror && physics.screenReq) {
      document.getElementById('coc-title').textContent = 'CIRCLE OF CONFUSION (CoC)';
      const coc = OpticsEngine.calculateCircleOfConfusion(vScreen, v, aperture, u, f);
      const isSharp = Math.abs(vScreen - v) < 0.6;
      cocValEl.textContent = isSharp ? `${(coc * 10).toFixed(2)} mm (★ PIN SHARP)` : `${(coc * 10).toFixed(2)} mm (DEFOCUSED)`;
      cocValEl.className = isSharp ? 'coc-tag sharp' : 'coc-tag blur';
      const pct = Math.min(100, (coc / 5.0) * 100);
      cocBarEl.style.width = `${pct}%`;
      cocBarEl.style.backgroundColor = isSharp ? '#22c55e' : '#f59e0b';
    } else if (isMirror) {
      document.getElementById('coc-title').textContent = 'MIRROR REFLECTION SHARPNESS';
      cocValEl.textContent = 'Formed on Mirror Surface';
      cocValEl.className = 'coc-tag mirror';
      cocBarEl.style.width = '100%';
      cocBarEl.style.backgroundColor = '#38bdf8';
    } else {
      document.getElementById('coc-title').textContent = 'CIRCLE OF CONFUSION (CoC)';
      cocValEl.textContent = 'Virtual / Divergent';
      cocValEl.className = 'coc-tag blur';
      cocBarEl.style.width = '100%';
      cocBarEl.style.backgroundColor = '#ef4444';
    }

    // Matrices Readout
    if (physics.P_obj && physics.E_mat && physics.P_img && physics.System_mat) {
      const { P_obj, E_mat, P_img, System_mat } = physics;

      document.getElementById('m-u-a').textContent = P_obj.a.toFixed(2);
      document.getElementById('m-u-b').textContent = P_obj.b.toFixed(1);
      document.getElementById('m-u-c').textContent = P_obj.c.toFixed(2);
      document.getElementById('m-u-d').textContent = P_obj.d.toFixed(2);

      document.getElementById('m-elem-label').textContent = isMirror ? `E_mirror(${physics.R.toFixed(0)})` : `E_lens(${physics.f.toFixed(0)})`;
      document.getElementById('m-l-a').textContent = E_mat.a.toFixed(2);
      document.getElementById('m-l-b').textContent = E_mat.b.toFixed(2);
      document.getElementById('m-l-c').textContent = E_mat.c.toFixed(4);
      document.getElementById('m-l-d').textContent = E_mat.d.toFixed(2);

      document.getElementById('m-v-a').textContent = P_img.a.toFixed(2);
      document.getElementById('m-v-b').textContent = !isFinite(v) ? '9999' : P_img.b.toFixed(1);
      document.getElementById('m-v-c').textContent = P_img.c.toFixed(2);
      document.getElementById('m-v-d').textContent = P_img.d.toFixed(2);

      document.getElementById('m-tot-a').textContent = System_mat.a.toFixed(2);
      document.getElementById('m-tot-b').textContent = System_mat.b.toFixed(2);
      document.getElementById('m-tot-c').textContent = System_mat.c.toFixed(4);
      document.getElementById('m-tot-d').textContent = System_mat.d.toFixed(2);

      const det = System_mat.determinant();
      document.getElementById('m-tot-det').textContent = `det(M) = ${det.toFixed(3)} (Symplectic)`;
    }

    // Dual 2D Viewports: Input Matrix vs Formed Matrix
    if (sourceCanvas && this.miniInputCtx) {
      this.miniInputCtx.clearRect(0, 0, 160, 160);
      this.miniInputCtx.drawImage(sourceCanvas, 0, 0, 160, 160);
    }

    const formedTag = document.getElementById('formed-canvas-tag');
    const formedDesc = document.getElementById('formed-canvas-desc');
    if (isMirror) {
      if (formedTag) formedTag.textContent = 'ON MIRROR FACE';
      if (formedDesc) formedDesc.textContent = `${physics.nature} Reflection • ${Math.abs(m).toFixed(2)}×`;
    } else {
      if (formedTag) formedTag.textContent = 'ON SCREEN';
      if (formedDesc) formedDesc.textContent = `${physics.nature} Image • ${Math.abs(m).toFixed(2)}×`;
    }

    if (activeCanvas && this.miniCtx) {
      this.miniCtx.clearRect(0, 0, 160, 160);
      this.miniCtx.drawImage(activeCanvas, 0, 0, 160, 160);
    }
  }
}
