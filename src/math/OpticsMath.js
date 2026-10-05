/**
 * OpticsMath.js
 * 
 * Core computational physics and linear algebra engine for Virtual Optics Lab (MFAD Mini Project).
 * Implements:
 * 1. 2D Ray Transfer Matrix Mechanics (ABCD Matrices & State Vectors r = [y, θ]^T)
 *    - Drift matrix P(d)
 *    - Thin lens matrix E_lens(f)
 *    - Spherical mirror matrix E_mirror(R)
 *    - Total system matrix System_mat = P(v) @ E @ P(u)
 *    - Affine scaling matrix A_mat
 * 2. 3x3 Orthogonal Rotation Matrices (R^T * R = I, det(R) = +1)
 * 3. Paraxial Lens and Mirror Imaging, Magnification & Circle of Confusion (CoC)
 * 4. Image Nature (Real / Virtual / At Infinity), Orientation, and Size description
 */

export class Vector2D {
  constructor(y = 0, theta = 0) {
    this.y = y;         // Transverse distance from optical axis (cm)
    this.theta = theta; // Paraxial angle with respect to optical axis (rad)
  }

  clone() {
    return new Vector2D(this.y, this.theta);
  }

  toArray() {
    return [this.y, this.theta];
  }
}

export class Matrix2x2 {
  constructor(a = 1, b = 0, c = 0, d = 1) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }

  static identity() {
    return new Matrix2x2(1, 0, 0, 1);
  }

  /**
   * Free Space Drift Matrix P(d) / M_drift(d)
   * [ 1   d ]
   * [ 0   1 ]
   */
  static drift(d) {
    return new Matrix2x2(1, d, 0, 1);
  }

  /**
   * Thin Lens Matrix E_lens(f)
   * [    1      0 ]
   * [ -1 / f    1 ]
   */
  static thinLens(f) {
    const power = f !== 0 && isFinite(f) ? -1.0 / f : 0;
    return new Matrix2x2(1, 0, power, 1);
  }

  /**
   * Spherical Mirror Matrix E_mirror(R, isConcave)
   * Concave: [1, 0; -2/R, 1]
   * Convex:  [1, 0; +2/R, 1]
   */
  static sphericalMirror(R, isConcave = true) {
    const power = R !== 0 && isFinite(R) ? (isConcave ? -2.0 / R : 2.0 / R) : 0;
    return new Matrix2x2(1, 0, power, 1);
  }

  /**
   * 2D Inversion / Reflection Matrix T_reflect
   * [ -1   0 ]
   * [  0  -1 ]
   */
  static reflection() {
    return new Matrix2x2(-1, 0, 0, -1);
  }

  multiply(other) {
    return new Matrix2x2(
      this.a * other.a + this.b * other.c,
      this.a * other.b + this.b * other.d,
      this.c * other.a + this.d * other.c,
      this.c * other.b + this.d * other.d
    );
  }

  /**
   * Transforms a state vector r = [y, θ]^T
   * r_out = M * r_in
   */
  transform(v) {
    return new Vector2D(
      this.a * v.y + this.b * v.theta,
      this.c * v.y + this.d * v.theta
    );
  }

  determinant() {
    return this.a * this.d - this.b * this.c;
  }

  inverse() {
    const det = this.determinant();
    if (Math.abs(det) < 1e-12) {
      throw new Error("Matrix is singular and cannot be inverted.");
    }
    const invDet = 1.0 / det;
    return new Matrix2x2(
      this.d * invDet,
      -this.b * invDet,
      -this.c * invDet,
      this.a * invDet
    );
  }

  toArray() {
    return [
      [this.a, this.b],
      [this.c, this.d]
    ];
  }
}

/**
 * 3x3 Orthogonal Matrix for 3D Vector Rotations & Basis Transformations
 * Satisfies R^T * R = I and det(R) = +1
 */
export class Matrix3x3 {
  constructor(elements = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ]) {
    this.elements = [...elements];
  }

  static identity() {
    return new Matrix3x3();
  }

  static rotationX(rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Matrix3x3([
      1, 0, 0,
      0, c, -s,
      0, s, c
    ]);
  }

  static rotationY(rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Matrix3x3([
      c, 0, s,
      0, 1, 0,
      -s, 0, c
    ]);
  }

  static rotationZ(rad) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Matrix3x3([
      c, -s, 0,
      s, c, 0,
      0, 0, 1
    ]);
  }

  /**
   * Combined Euler Rotation R = R_y * R_x * R_z
   */
  static fromEuler(thetaX, thetaY, thetaZ = 0) {
    const Rx = Matrix3x3.rotationX(thetaX);
    const Ry = Matrix3x3.rotationY(thetaY);
    const Rz = Matrix3x3.rotationZ(thetaZ);
    return Ry.multiply(Rx).multiply(Rz);
  }

  multiply(other) {
    const a = this.elements;
    const b = other.elements;
    const r = new Array(9);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        r[row * 3 + col] =
          a[row * 3 + 0] * b[0 * 3 + col] +
          a[row * 3 + 1] * b[1 * 3 + col] +
          a[row * 3 + 2] * b[2 * 3 + col];
      }
    }
    return new Matrix3x3(r);
  }

  transpose() {
    const e = this.elements;
    return new Matrix3x3([
      e[0], e[3], e[6],
      e[1], e[4], e[7],
      e[2], e[5], e[8]
    ]);
  }

  determinant() {
    const e = this.elements;
    return (
      e[0] * (e[4] * e[8] - e[5] * e[7]) -
      e[1] * (e[3] * e[8] - e[5] * e[6]) +
      e[2] * (e[3] * e[7] - e[4] * e[6])
    );
  }

  /**
   * Transform a 3D vector v: v_out = R * v
   */
  transformVector(v) {
    const e = this.elements;
    const x = e[0] * v.x + e[1] * v.y + e[2] * v.z;
    const y = e[3] * v.x + e[4] * v.y + e[5] * v.z;
    const z = e[6] * v.x + e[7] * v.y + e[8] * v.z;
    return { x, y, z };
  }

  /**
   * Verify orthogonality: R^T * R ≈ I and det(R) ≈ 1
   */
  checkOrthogonality() {
    const Rt = this.transpose();
    const product = Rt.multiply(this);
    const p = product.elements;
    let maxError = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const expected = r === c ? 1 : 0;
        const diff = Math.abs(p[r * 3 + c] - expected);
        if (diff > maxError) maxError = diff;
      }
    }
    return {
      isOrthogonal: maxError < 1e-5,
      maxOrthogonalError: maxError,
      determinant: this.determinant()
    };
  }
}

/**
 * Optical Calculations & Ray Transfer Matrix Engine
 * Matches Python MFAD Virtual Optics Lab matrix physics
 */
export class OpticsEngine {
  /**
   * Complete physical computation conforming to the Python VirtualOpticsLab logic:
   * u: object distance (positive cm)
   * fVal: slider focal length / radius
   * screenDist: slider screen distance
   * element: 'Convex Lens' | 'Concave Lens' | 'Concave Mirror' | 'Convex Mirror'
   */
  static calculatePhysics(element, u, fVal, screenDist) {
    const isMirror = element.includes('Mirror');
    let R = fVal;
    let f = fVal;

    if (isMirror) {
      R = fVal;
      f = R / 2.0;
    } else {
      f = fVal;
    }

    if (element === 'Concave Lens' || element === 'Convex Mirror') {
      f = -f;
    }

    let v, m, nature, orientation, sizeDesc, screenReq, focusError;

    if (Math.abs(u - f) < 1e-5) {
      v = Infinity;
      m = Infinity;
      nature = 'At Infinity';
      orientation = 'Undefined';
      sizeDesc = 'Extremely large';
      screenReq = false;
      focusError = 0;
    } else {
      v = (f * u) / (u - f);
      m = -v / u;

      if (v > 0) {
        nature = 'Real';
        orientation = m < 0 ? 'Inverted' : 'Upright';
        // For lenses: Real image is captured on screen. For mirrors: images are formed/observed on mirror
        screenReq = !isMirror;
      } else {
        nature = 'Virtual';
        orientation = 'Upright';
        screenReq = false;
      }

      const absM = Math.abs(m);
      if (absM > 1.05) {
        sizeDesc = 'Magnified';
      } else if (absM < 0.95) {
        sizeDesc = 'Diminished';
      } else {
        sizeDesc = 'Same size';
      }

      if (screenReq) {
        focusError = Math.abs(v - screenDist);
      } else {
        focusError = 0.0;
      }
    }

    // 2. Matrix Multiplication Model
    // Object propagation P_obj = [[1, u], [0, 1]]
    const P_obj = new Matrix2x2(1, u, 0, 1);

    // Optical element matrix E_mat
    let E_mat;
    if (isMirror) {
      const isConcave = element.includes('Concave');
      const power = isConcave ? -2.0 / R : 2.0 / R;
      E_mat = new Matrix2x2(1, 0, power, 1);
    } else {
      E_mat = new Matrix2x2(1, 0, -1.0 / f, 1);
    }

    // Image propagation P_img = [[1, v], [0, 1]]
    const vEffective = !isFinite(v) ? 9999 : v;
    const P_img = new Matrix2x2(1, vEffective, 0, 1);

    // System matrix = P(v) @ E @ P(u)
    const System_mat = P_img.multiply(E_mat).multiply(P_obj);

    // 3. Affine transformation matrix (scaling & zoom)
    let scale = !isFinite(m) ? 5.0 : Math.abs(m);
    scale = Math.min(Math.max(scale, 0.1), 5.0);

    const A_mat = [
      [scale, 0, 0],
      [0, scale, 0],
      [0, 0, 1]
    ];

    return {
      element,
      isMirror,
      u,
      fVal,
      R,
      f,
      v,
      m,
      nature,
      orientation,
      sizeDesc,
      screenReq,
      observerReq: !screenReq,
      screenDist,
      focusError,
      scale,
      P_obj,
      E_mat,
      P_img,
      System_mat,
      A_mat
    };
  }

  static calculateImageDistance(u, f) {
    const denom = u - f;
    if (Math.abs(denom) < 1e-6) return Infinity;
    return (f * u) / denom;
  }

  static calculateMagnification(u, vFocus) {
    if (!isFinite(vFocus)) return Infinity;
    return -vFocus / u;
  }

  static calculateCircleOfConfusion(vScreen, vFocus, aperture, u, f) {
    if (!isFinite(vFocus)) return aperture;
    if (vFocus > 0) {
      const ratio = Math.abs((vScreen - vFocus) / vFocus);
      return ratio * aperture;
    } else {
      const distFromVirtual = vScreen - vFocus;
      const virtualToLens = Math.abs(vFocus) || 1e-4;
      return (distFromVirtual / virtualToLens) * aperture;
    }
  }

  static computeSystemMatrices(u, f, vScreen) {
    const M_drift_u = Matrix2x2.drift(u);
    const M_lens = Matrix2x2.thinLens(f);
    const M_drift_v = Matrix2x2.drift(vScreen);
    const M_through_lens = M_lens.multiply(M_drift_u);
    const M_total = M_drift_v.multiply(M_through_lens);

    return {
      M_drift_u,
      M_lens,
      M_drift_v,
      M_total
    };
  }

  static calculatePower(fCm) {
    if (fCm === 0 || !isFinite(fCm)) return 0;
    return 100.0 / fCm;
  }
}
