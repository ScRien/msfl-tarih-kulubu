import express from "express";
import auth from "../middlewares/auth.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import cloudinary from "../helpers/cloudinary.js";
import upload from "../middlewares/upload.js";
import Comment from "../models/Comment.js";
import { sendMail } from "../helpers/mail.js";
import { verificationMailTemplate } from "../helpers/mailTemplates.js";

const router = express.Router();

/* ============================================================
   HESAP SAYFASI (GET)
============================================================ */
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).lean();

    res.render("pages/hesap", {
      user,
      success: req.query.success || null,
      error: req.query.error || null,
    });
  } catch (err) {
    console.log(err);
    res.render("pages/hesap", { error: "Hesap yüklenemedi" });
  }
});

/* ============================================================
   PROFİL BİLGİLERİ + BİYOGRAFİ GÜNCELLE
============================================================ */
router.post("/profil", auth, async (req, res) => {
  try {
    const { name, surname, email, bio } = req.body;

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect("/hesap?error=Kullanıcı+bulunamadı");
    }

    // Email başka biri tarafından kullanılıyor mu?
    if (email !== user.email) {
      const exists = await User.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (exists) {
        return res.redirect("/hesap?error=Bu+email+başka+bir+hesapta+kayıtlı");
      }
    }

    // Güncelleme
    user.name = name;
    user.surname = surname;
    user.email = email;
    user.bio = bio?.trim() || "";

    await user.save();

    return res.redirect("/hesap?success=Profil+bilgileri+güncellendi");
  } catch (err) {
    console.log(err);
    return res.redirect("/hesap?error=Güncelleme+başarısız");
  }
});

/* ============================================================
   ÇEREZ AYARLARI (/hesap/cookies)
============================================================ */
router.post("/cookies", auth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    user.analyticsCookies = !!req.body.analyticsCookies;
    user.personalizationCookies = !!req.body.personalizationCookies;

    await user.save();

    res.redirect("/hesap?success=Çerez+ayarları+güncellendi");
  } catch (err) {
    console.log(err);
    res.redirect("/hesap?error=Çerez+ayarları+kaydedilemedi");
  }
});

/* ============================================================
   VERİ KULLANIMI (/hesap/data-usage)
============================================================ */
router.post("/data-usage", auth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    user.serviceDataUsage = !!req.body.serviceDataUsage;
    user.personalizedContent = !!req.body.personalizedContent;

    await user.save();
    res.redirect("/hesap?success=Veri+ayarları+güncellendi");
  } catch (err) {
    console.log(err);
    res.redirect("/hesap?error=Veri+ayarları+kaydedilemedi");
  }
});

/* ============================================================
   AVATAR UPLOAD
============================================================ */
router.post(
  "/avatar-yukle",
  auth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.redirect("/hesap?error=Dosya+seçilmedi");
      }

      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "avatars",
          public_id: `avatar_${req.session.userId}`,
          overwrite: true,
        });

        await User.findByIdAndUpdate(req.session.userId, {
          avatar: uploadResult.secure_url,
        });

        return res.redirect("/hesap?success=Profil+fotoğrafı+güncellendi");
      } catch (err) {
        // 🔥 Dosya boyutu hatası
        if (err.message.includes("File size too large")) {
          return res.redirect("/hesap?error=Görsel+10MB'den+küçük+olmalıdır");
        }

        console.error("Avatar upload error:", err);
        return res.redirect("/hesap?error=Avatar+yüklenemedi");
      }
    } catch (err) {
      console.log(err);
      return res.redirect("/hesap?error=Avatar+yüklenemedi");
    }
  }
);

/* ============================================================
   COVER UPLOAD
============================================================ */
router.post("/kapak-yukle", auth, upload.single("cover"), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect("/hesap?error=Dosya+seçilmedi");
    }

    try {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "covers",
        public_id: `cover_${req.session.userId}`,
        overwrite: true,
      });

      await User.findByIdAndUpdate(req.session.userId, {
        coverPhoto: uploadResult.secure_url,
      });

      return res.redirect("/hesap?success=Kapak+fotoğrafı+güncellendi");
    } catch (err) {
      if (err.message.includes("File size too large")) {
        return res.redirect("/hesap?error=Görsel+10MB'den+küçük+olmalıdır");
      }

      console.error("Cover upload error:", err);
      return res.redirect("/hesap?error=Kapak+yüklenemedi");
    }
  } catch (err) {
    console.log(err);
    return res.redirect("/hesap?error=Kapak+yüklenemedi");
  }
});

router.post("/social", auth, async (req, res) => {
  try {
    const { instagram, x, github } = req.body;

    await User.findByIdAndUpdate(req.session.userId, {
      social: {
        instagram,
        x,
        github,
      },
    });

    return res.redirect("/hesap?success=Sosyal+medya+güncellendi");
  } catch (err) {
    console.log(err);
    return res.redirect("/hesap?error=Güncellenemedi");
  }
});

/* ============================================================
   HESAP SİL — Her şeyi temizler
============================================================ */
router.post("/sil", auth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/hesap?error=Kullanıcı+bulunamadı");
    }

    /* ===============================
       1) KULLANICI BLOGLARI SİL
    =============================== */
    const blogs = await Post.find({ user_id: userId });

    for (const blog of blogs) {
      // Blog görselleri Cloudinary'den silinsin (varsa)
      if (blog.images && blog.images.length) {
        for (const img of blog.images) {
          const publicId = img.split("/").pop().split(".")[0];
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (e) {}
        }
      }
    }

    await Post.deleteMany({ user_id: userId });

    /* ===============================
       2) KULLANICI YORUMLARI SİL
    =============================== */
    await Comment.deleteMany({ user_id: userId });

    /* ===============================
       3) PROFİL FOTOĞRAFI & KAPAK SİL
    =============================== */
    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    }
    if (user.coverPublicId) {
      await cloudinary.uploader.destroy(user.coverPublicId);
    }

    /* ===============================
       4) HESABI VERİTABANINDAN SİL
    =============================== */
    await User.findByIdAndDelete(userId);

    /* ===============================
       5) OTURUMU KAPAT
    =============================== */
    req.session.destroy(() => {
      res.redirect("/?success=Hesap+başarıyla+silindi");
    });
  } catch (err) {
    console.log(err);
    res.redirect("/hesap?error=Hesap+silinemedi");
  }
});

router.get("/sifre-yeni", auth, (req, res) => {
  if (!req.session.allowPasswordChange) {
    return res.redirect("/hesap?error=Yetkisiz+işlem");
  }

  res.render("pages/sifreYeni");
});

router.post("/sifre-kod", auth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user.email) {
      return res.redirect("/hesap?error=E-posta+adresiniz+bulunamadı");
    }

    // 6 haneli kod
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const html = verificationMailTemplate(user.name, code);

    // Kullanıcıya kaydet
    user.resetCode = code;
    user.resetCodeExpires = Date.now() + 5 * 60 * 1000; // 5 dakika
    await user.save();

    // Mail gönder
    await sendMail(user.email, "Tarih Kulübü • Şifre Doğrulama Kodu", html);

    return res.redirect("/hesap?success=Kod+gönderildi&showVerify=1");
  } catch (err) {
    console.log("Mail send error:", err);
    return res.redirect("/hesap?error=Kod+gönderilemedi");
  }
});

router.post("/sifre-kod-dogrula", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.session.userId);

    // Kod hiç istenmemişse
    if (!user.resetCode || !user.resetCodeExpires) {
      return res.redirect("/hesap?error=Kod+isteyin+lütfen");
    }

    // Süresi dolmuşsa
    if (Date.now() > user.resetCodeExpires) {
      user.resetCode = null;
      user.resetCodeExpires = null;
      await user.save();
      return res.redirect("/hesap?error=Kodun+süresi+dolmuş");
    }

    // Kod yanlışsa
    if (code.trim() !== user.resetCode) {
      return res.redirect("/hesap?error=Kod+yanlış&showVerify=1");
    }

    // Kod doğru
    req.session.allowPasswordChange = true;
    return res.redirect("/hesap/sifre-yeni");
  } catch (err) {
    console.log(err);
    return res.redirect("/hesap?error=Doğrulama+başarısız");
  }
});

router.post("/sifre-yeni", auth, async (req, res) => {
  try {
    if (!req.session.allowPasswordChange) {
      return res.redirect("/hesap?error=Yetkisiz+işlem");
    }

    const { password1, password2 } = req.body;

    if (!password1 || !password2) {
      return res.redirect("/hesap/sifre-yeni?error=Şifreler+boş+olamaz");
    }

    if (password1 !== password2) {
      return res.redirect("/hesap/sifre-yeni?error=Şifreler+eşleşmiyor");
    }

    const bcrypt = await import("bcrypt");
    const hashed = await bcrypt.hash(password1, 10);

    await User.findByIdAndUpdate(req.session.userId, {
      password: hashed,
      resetCode: null,
      resetCodeExpires: null,
    });

    req.session.allowPasswordChange = false;

    return res.redirect("/hesap?success=Şifre+başarıyla+değiştirildi");
  } catch (err) {
    console.log(err);
    return res.redirect("/hesap?error=Şifre+değiştirilemedi");
  }
});

export default router;
