import multer from 'multer';
import path from 'path';
import { getUploadsDir } from '../utils/fileStorage.js';

// Disk storage engine using unified uploads directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, getUploadsDir());
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter for documents & media
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /pdf|doc|docx|png|jpg|jpeg|webp/;
  const extname = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = /application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|image\/(png|jpeg|jpg|webp)/.test(
    file.mimetype
  );

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only PDF, DOC, DOCX, PNG, JPG, JPEG files are permitted.'
      ),
      false
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});

