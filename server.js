import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');
const useDist = fs.existsSync(distPath);

if (useDist) {
  console.log(`[Express 5] Serving production build from: ${distPath}`);
  app.use(express.static(distPath));
  // Fallback for single page application in Express 5
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log(`[Express 5] Serving static files from workspace root: ${__dirname}`);
  app.use(express.static(__dirname));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Convex Lens Optics Lab Server running at:`);
  console.log(` http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
