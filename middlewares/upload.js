import multer from "multer";
import path from "path";

// TEMP klasörüne kaydediyoruz
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "tmp/"); // tmp klasörü oluşturulacak
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

export default upload;
