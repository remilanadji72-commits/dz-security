import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';

const imagesDir = path.resolve('./tests/ocr/user_images');
const outDir = path.resolve('./tests/ocr/fixtures');

if (!fs.existsSync(imagesDir)) {
  console.error('Dossier images introuvable:', imagesDir);
  console.error('Créez le dossier et déposez-y les images (jpg/png).');
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const worker = createWorker({ logger: (m) => console.log(m) });

async function run() {
  await worker.load();
  await worker.loadLanguage('fra+eng');
  await worker.initialize('fra+eng');

  const files = fs.readdirSync(imagesDir).filter((f) => /\.(jpg|jpeg|png|tif|tiff)$/i.test(f));
  if (files.length === 0) {
    console.error('Aucune image trouvée dans', imagesDir);
    await worker.terminate();
    process.exit(1);
  }

  for (const f of files) {
    const p = path.join(imagesDir, f);
    console.log('Traitement de', p);
    try {
      const { data } = await worker.recognize(p);
      const text = data.text || '';
      const outName = `contract_user_${path.basename(f).replace(/[^a-z0-9]/gi, '_')}.txt`;
      const outPath = path.join(outDir, outName);
      fs.writeFileSync(outPath, text, 'utf-8');
      console.log('Fixture écrit:', outPath);
    } catch (err) {
      console.error('Erreur OCR sur', p, err.message || err);
    }
  }

  await worker.terminate();
  console.log('Terminé. Exécutez `npm run test:run -- tests/ocr/parseContract.test.js` pour valider.');
}

run().catch((e) => { console.error(e); process.exit(1); });
