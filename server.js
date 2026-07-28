const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3010);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "vraaAdmin28";
const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const META_FILE = path.join(UPLOADS, "meta.json");

fs.mkdirSync(UPLOADS, { recursive: true });

function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveMeta(items) {
  fs.writeFileSync(META_FILE, JSON.stringify(items, null, 2), "utf8");
}

function requireAdmin(req, res) {
  const password =
    req.get("x-admin-password") ||
    (req.body && req.body.password) ||
    "";
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Неверный пароль" });
    return false;
  }
  return true;
}

function sanitizeTitle(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().slice(0, 10);
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(ext)
      ? ext
      : ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only images are allowed"));
      return;
    }
    cb(null, true);
  },
});

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

app.use(express.static(path.join(ROOT, "public")));
app.use("/uploads", express.static(UPLOADS, { maxAge: "7d" }));

app.get("/api/images", (_req, res) => {
  const items = loadMeta().sort((a, b) => b.createdAt - a.createdAt);
  res.json(items);
});

app.get("/api/download/:id", (req, res) => {
  const items = loadMeta();
  const item = items.find((x) => x.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }
  const filePath = path.join(UPLOADS, item.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File missing" });
  }
  const title = sanitizeTitle(item.title) || "painting";
  const ext = path.extname(item.filename) || ".jpg";
  const safeName = `${title.replace(/[\\/:*?"<>|]+/g, "_")}${ext}`;
  res.download(filePath, safeName);
});

app.post("/api/upload", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const title =
      sanitizeTitle(req.body && req.body.title) ||
      path.parse(req.file.originalname || "Без названия").name;

    const item = {
      id: path.parse(req.file.filename).name,
      filename: req.file.filename,
      title,
      originalName: req.file.originalname || req.file.filename,
      url: `/uploads/${req.file.filename}`,
      createdAt: Date.now(),
    };

    const items = loadMeta();
    items.push(item);
    saveMeta(items);
    res.status(201).json(item);
  });
});

app.post("/api/admin/login", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true });
});

app.delete("/api/images/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const items = loadMeta();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Not found" });
  }

  const [removed] = items.splice(idx, 1);
  saveMeta(items);

  const filePath = path.join(UPLOADS, removed.filename);
  fs.unlink(filePath, () => {});
  res.json({ ok: true, id: removed.id });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`rasmusvraa gallery listening on 127.0.0.1:${PORT}`);
});
