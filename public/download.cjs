const https = require('https');
const fs = require('fs');
const path = require('path');

const files = [
  '2k_sun.jpg',
  '2k_mercury.jpg',
  '2k_venus_surface.jpg',
  '2k_venus_atmosphere.jpg',
  '2k_earth_daymap.jpg',
  '2k_earth_clouds.jpg',
  '2k_mars.jpg',
  '2k_jupiter.jpg',
  '2k_saturn.jpg',
  '2k_saturn_ring_alpha.png',
  '2k_uranus.jpg',
  '2k_neptune.jpg',
  '2k_moon.jpg'
];

const dir = path.join(__dirname, 'textures');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function download() {
  for (const file of files) {
    const url = `https://www.solarsystemscope.com/textures/download/${file}`;
    const dest = path.join(dir, file);
    if (fs.existsSync(dest)) continue;
    
    console.log(`Downloading ${file}...`);
    await new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode !== 200) {
          console.log(`Failed: ${res.statusCode} for ${file}`);
          resolve();
          return;
        }
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Saved ${file}`);
          resolve();
        });
      }).on('error', (err) => {
        console.error(`Error: ${err.message}`);
        resolve();
      });
    });
  }
}
download();
