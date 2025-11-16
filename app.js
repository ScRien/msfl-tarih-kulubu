import bodyParser from "body-parser";
import express from "express";
import router from "./routes/main.js";
import "dotenv/config";
import { create } from "express-handlebars";
import generateDate from "./helpers/generateDate.js";
import mongoose from "mongoose";
import blogs from "./routes/blogs.js";
import admin from "./routes/admin.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import eq from "./helpers/eq.js";
import kullaniciRouter from "./routes/kullanici.js";
import hesapRouter from "./routes/hesap.js";
import publicProfile from "./routes/publicProfile.js";
import handlebarsHelpers from "./helpers/handlebarsHelpers.js";

const app = express();

const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || "127.0.0.1";

await mongoose.connect(process.env.MONGO_URL);
console.log("MongoDB bağlantısı başarılı.");

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.static("public"));

// ==== SESSION ====
app.use(
  session({
    secret: "tarih-kulubu-gizli",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 hafta
    },
  })
);

// Navbar için global template değişkenleri
app.use((req, res, next) => {
  res.locals.isAuth = !!req.session.userId;
  res.locals.currentUser = req.session.username || null;
  res.locals.currentUserId = req.session.userId || null;
  res.locals.currentRole = req.session.role || null;
  next();
});

// ==== HANDLEBARS ====
const hbs = create({
  defaultLayout: "main",
  partialsDir: ["views/partials"],
  helpers: { generateDate, eq },
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  },
});

hbs.handlebars.registerHelper("toString", function (value) {
  return value ? value.toString() : "";
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", "./views");

// ==== BODY PARSER ====
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 1) Kullanıcı
app.use("/kullanici", kullaniciRouter);

// 2) Hesap
app.use("/hesap", hesapRouter);

// 3) Blog
app.use("/blog", blogs);

// 4) Admin
app.use("/admin", admin);

// 5) Statik sayfalar / anasayfa
app.use("/", router);

// 6) PUBLIC PROFILE (EN SONA)
app.use("/", publicProfile);

app.use((req, res) => {
  res.status(404).render("pages/404");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server http://0.0.0.0:${PORT} portunda çalışıyor.`);
});
