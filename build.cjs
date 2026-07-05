const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'images'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'api'), { recursive: true });

['index.html'].forEach(file => {
  if (fs.existsSync(path.join(srcDir, file))) {
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
    console.log(`Copied: ${file}`);
  }
});

fs.readdirSync(path.join(srcDir, 'images')).forEach(img => {
  fs.copyFileSync(path.join(srcDir, 'images', img), path.join(distDir, 'images', img));
  console.log(`Copied: images/${img}`);
});

if (fs.existsSync(path.join(srcDir, 'api', '[[default]].js'))) {
  fs.copyFileSync(path.join(srcDir, 'api', '[[default]].js'), path.join(distDir, 'api', '[[default]].js'));
  console.log('Copied: api/[[default]].js');
}

console.log('Build completed successfully!');
