import * as THREE from 'three';

/**
 * Procedurally generates a photorealistic millimeter & centimeter optical bench ruler texture.
 * Range: -120 cm to +120 cm (total 240 cm = 2.4 meters)
 */
export function createRulerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Background: Brushed stainless steel / matte satin silver
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#e6e8ec');
  grad.addColorStop(0.5, '#f4f5f7');
  grad.addColorStop(1, '#d5d8de');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle metallic horizontal grain
  ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Draw ruler markings
  // Total span: -120 cm to +120 cm (240 cm = 2400 mm)
  const minCm = -120;
  const maxCm = 120;
  const totalCm = maxCm - minCm; // 240
  const pxPerCm = canvas.width / totalCm; // ~17.06 px / cm

  ctx.strokeStyle = '#1a1d20';
  ctx.fillStyle = '#1a1d20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let cm = minCm; cm <= maxCm; cm++) {
    const xCm = (cm - minCm) * pxPerCm;

    // Draw millimeter ticks (10 per cm)
    for (let mm = 0; mm < 10; mm++) {
      if (cm === maxCm && mm > 0) break;
      const xMm = xCm + (mm * pxPerCm) / 10;

      let tickHeight = 18;
      let tickWidth = 1.0;

      if (mm === 0) {
        // Full Centimeter Mark
        tickHeight = 55;
        tickWidth = 2.2;
      } else if (mm === 5) {
        // Half Centimeter Mark (5 mm)
        tickHeight = 35;
        tickWidth = 1.5;
      }

      ctx.lineWidth = tickWidth;
      ctx.beginPath();
      ctx.moveTo(xMm, 0);
      ctx.lineTo(xMm, tickHeight);
      ctx.stroke();

      // Bottom symmetric ticks
      ctx.beginPath();
      ctx.moveTo(xMm, canvas.height);
      ctx.lineTo(xMm, canvas.height - tickHeight * 0.7);
      ctx.stroke();
    }

    // Numbering every 10 cm, plus 0 cm emphasized
    if (cm % 10 === 0) {
      ctx.font = 'bold 26px "JetBrains Mono", "Courier New", monospace';
      if (cm === 0) {
        ctx.fillStyle = '#c92a2a'; // Red for center 0 (lens position)
        ctx.font = 'bold 30px "JetBrains Mono", "Courier New", monospace';
      } else {
        ctx.fillStyle = '#1e293b';
      }
      ctx.fillText(`${cm > 0 ? '+' : ''}${cm}`, xCm, 65);

      // Subtitle 'cm'
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('cm', xCm, 98);
    }
  }

  // Border lines
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}
