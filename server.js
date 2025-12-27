const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Uploads klasörü
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Video to Audio endpoint
app.post('/api/video-to-audio', upload.single('file'), (req, res) => {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const inputPath = req.file.path;
    const outputPath = path.join(uploadsDir, 'audio_' + Date.now() + '.mp3');

    ffmpeg(inputPath)
      .toFormat('mp3')
      .on('end', () => {
        res.download(outputPath, 'audio.mp3', () => {
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
        });
      })
      .on('error', (err) => {
        console.error(err);
        res.status(500).send('Conversion error');
      })
      .save(outputPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audio Clean endpoint
app.post('/api/audio-clean', upload.single('file'), (req, res) => {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const inputPath = req.file.path;
    const outputPath = path.join(uploadsDir, 'cleaned_' + Date.now() + '.mp3');

    ffmpeg(inputPath)
      .audioFilters('highpass=f=200,lowpass=f=3000')
      .on('end', () => {
        res.download(outputPath, 'cleaned.mp3', () => {
          fs.unlinkSync(inputPath);
          fs.unlinkSync(outputPath);
        });
      })
      .on('error', (err) => {
        res.status(500).send('Cleaning error');
      })
      .save(outputPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Word to PDF endpoint
app.post('/api/word-to-pdf', upload.single('file'), async (req, res) => {
  try {
    const mammoth = require('mammoth');
    const { PDFDocument } = require('pdf-lib');
    
    const result = await mammoth.convertToHtml({ path: req.file.path });
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    
    page.drawText(result.value.substring(0, 500), { x: 50, y: 700 });
    
    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(uploadsDir, 'output_' + Date.now() + '.pdf');
    
    fs.writeFileSync(outputPath, pdfBytes);
    
    res.download(outputPath, 'document.pdf', () => {
      fs.unlinkSync(req.file.path);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Diğer endpointler için placeholder
const endpoints = [
  'pdf-to-word',
  'video-trim',
  'audio-merge',
  'video-compress',
  'audio-converter',
  'pdf-merge'
];

endpoints.forEach(endpoint => {
  app.post(`/api/${endpoint}`, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'file2', maxCount: 1 }
  ]), (req, res) => {
    res.status(501).json({ 
      error: 'Bu özellik henüz aktif değil. FFmpeg kurulumu gerekli.' 
    });
  });
});

// Server başlat
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  🌍 GLOBAL MEDIA CONVERTER ÇALIŞIYOR!    ║
╚═══════════════════════════════════════════╝

✅ Server: http://localhost:${PORT}
✅ API: http://localhost:${PORT}/api
✅ Status: ACTIVE

📝 Çalışan Özellikler:
   - Text to Speech (tarayıcıda)
   - Image Compress (tarayıcıda)
   - Image Convert (tarayıcıda)
   
⚠️  Backend Özellikleri:
   - FFmpeg kurulumu gerekli
   - npm install fluent-ffmpeg
   - ffmpeg yükle (sistem)
  `);
});
