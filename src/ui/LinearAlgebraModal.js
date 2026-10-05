export class LinearAlgebraModal {
  constructor() {
    this.createDOM();
    this.isOpen = false;
    this.latestPhysics = null;
  }

  createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'linalg-modal-overlay hidden';
    this.overlay.innerHTML = `
      <div class="linalg-modal-window">
        <div class="linalg-modal-header">
          <div class="modal-title-group">
            <span class="terminal-dot red"></span>
            <span class="terminal-dot yellow"></span>
            <span class="terminal-dot green"></span>
            <span class="modal-title">VIRTUAL OPTICS LAB: MATRIX ENGINE</span>
          </div>
          <div class="modal-actions">
            <button class="modal-btn-copy" id="btn-copy-linalg" title="Copy Matrix Data">Copy</button>
            <button class="modal-btn-close" id="btn-close-linalg" title="Close Window">✕</button>
          </div>
        </div>
        <div class="linalg-modal-body">
          <pre id="linalg-terminal-content" class="linalg-code"></pre>
        </div>
        <div class="linalg-modal-footer">
          <span>MFAD Mini Project — Paraxial Ray Transfer Mechanics</span>
          <span class="math-tag">det(System_mat) = 1.0 (Symplectic)</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    document.getElementById('btn-close-linalg').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.getElementById('btn-copy-linalg').addEventListener('click', () => {
      const code = document.getElementById('linalg-terminal-content').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-linalg');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  open(physics) {
    this.latestPhysics = physics;
    this.renderContent();
    this.overlay.classList.remove('hidden');
    this.isOpen = true;
  }

  close() {
    this.overlay.classList.add('hidden');
    this.isOpen = false;
  }

  update(physics) {
    this.latestPhysics = physics;
    if (this.isOpen) {
      this.renderContent();
    }
  }

  renderContent() {
    if (!this.latestPhysics) return;
    const p = this.latestPhysics;

    const format2x2 = (m, prec = 2) => {
      return `[[ ${m.a.toFixed(prec).padStart(6)}  ${m.b.toFixed(prec).padStart(6)} ]\n [ ${m.c.toFixed(prec).padStart(6)}  ${m.d.toFixed(prec).padStart(6)} ]]`;
    };

    const format3x3 = (arr, prec = 2) => {
      return `[[ ${arr[0][0].toFixed(prec)}  ${arr[0][1].toFixed(prec)}  ${arr[0][2].toFixed(prec)} ]\n [ ${arr[1][0].toFixed(prec)}  ${arr[1][1].toFixed(prec)}  ${arr[1][2].toFixed(prec)} ]\n [ ${arr[2][0].toFixed(prec)}  ${arr[2][1].toFixed(prec)}  ${arr[2][2].toFixed(prec)} ]]`;
    };

    let content = `=== VIRTUAL OPTICS LAB: MATRIX ENGINE ===\n\n`;
    content += `Optical Element        : ${p.element}\n`;
    content += `Base Panel Matrix Shape: (400, 400)\n`;
    content += `Matrix Data Type       : uint8 (RGB Emissive Texture)\n\n`;

    content += `1. Object Propagation Matrix P(u) [u = ${p.u.toFixed(1)} cm]:\n`;
    content += `${format2x2(p.P_obj, 2)}\n\n`;

    content += `2. Optical Element Matrix E (${p.isMirror ? `R = ${p.R.toFixed(1)}, f = ${p.f.toFixed(1)}` : `f = ${p.f.toFixed(1)}`}):\n`;
    content += `${format2x2(p.E_mat, 4)}\n\n`;

    content += `3. Image Propagation Matrix P(v) [v = ${!isFinite(p.v) ? '∞ (Infinity)' : `${p.v.toFixed(1)} cm`}]:\n`;
    content += `${format2x2(p.P_img, 2)}\n\n`;

    content += `4. System Matrix = P(v) @ E @ P(u):\n`;
    content += `${format2x2(p.System_mat, 4)}\n`;
    content += `   Determinant det(M)  : ${p.System_mat.determinant().toFixed(4)} (Liouville / Symplectic Invariant)\n\n`;

    content += `5. Affine Transformation Matrix (Scaling & Zoom):\n`;
    content += `${format3x3(p.A_mat, 2)}\n\n`;

    content += `6. Optical State Telemetry:\n`;
    content += `   • Image Nature      : ${p.nature}\n`;
    content += `   • Orientation       : ${p.orientation} (Flip vertical: ${p.m < 0 ? 'YES' : 'NO'})\n`;
    content += `   • Magnification     : ${isFinite(p.m) ? `${Math.abs(p.m).toFixed(3)}×` : '∞'}\n`;
    content += `   • Size Classification: ${p.sizeDesc}\n`;
    content += `   • Image Formed On   : ${p.isMirror ? 'Curved Mirror Reflective Surface' : 'Projection Screen'}\n`;
    content += `   • Screen Required   : ${p.screenReq ? 'YES' : 'NO'}\n`;
    content += `   • Observer Required : ${p.observerReq ? 'YES' : 'NO'}\n`;
    if (p.screenReq) {
      content += `   • Focus Error       : ${p.focusError.toFixed(2)} units (Screen: ${p.screenDist.toFixed(1)} cm)\n`;
    }

    const pre = document.getElementById('linalg-terminal-content');
    if (pre) pre.textContent = content;
  }
}
