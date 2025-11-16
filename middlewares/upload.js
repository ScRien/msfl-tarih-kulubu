import multer from "multer";
import fs from "fs";
import path from "path";

// TMP klasörü yoksa otomatik oluştur
const uploadDir = "tmp";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Güvenli dosya adı oluşturma fonksiyonu
function sanitizeFilename(filename) {
  return filename
    .normalize("NFD") // unicode normalize
    .replace(/[\u0300-\u036f]/g, "") // aksan temizle
    .replace(/[^a-zA-Z0-9._-]/g, "_"); // özel karakterleri _ yap
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    const uniqueName = Date.now() + "-" + safeName;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

export default upload;
