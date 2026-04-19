const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nameOk = /\.xlsx$/i.test(file.originalname || '');
    const mimeOk =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream';
    if (nameOk || mimeOk) return cb(null, true);
    cb(new Error('Нужен файл .xlsx'));
  },
});

module.exports = upload;
