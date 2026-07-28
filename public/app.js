const galleryEl = document.getElementById("gallery");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");
const adminBadge = document.getElementById("admin-badge");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");

const uploadDialog = document.getElementById("upload-dialog");
const uploadForm = document.getElementById("upload-form");
const uploadTitle = document.getElementById("upload-title");
const uploadFile = document.getElementById("upload-file");

const adminDialog = document.getElementById("admin-dialog");
const adminForm = document.getElementById("admin-form");
const adminPasswordInput = document.getElementById("admin-password");

const ADMIN_KEY = "rasmusvraa_admin_password";

function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_KEY) || "";
}

function isAdmin() {
  return Boolean(getAdminPassword());
}

function setAdminPassword(password) {
  if (password) sessionStorage.setItem(ADMIN_KEY, password);
  else sessionStorage.removeItem(ADMIN_KEY);
  adminBadge.classList.toggle("hidden", !isAdmin());
  loadImages().catch(() => {});
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

function displayTitle(item) {
  return item.title || item.originalName || "Без названия";
}

function openLightbox(src, alt) {
  lightboxImg.src = src;
  lightboxImg.alt = alt || "";
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.removeAttribute("src");
}

function renderImages(items) {
  galleryEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", items.length > 0);
  const admin = isAdmin();

  for (const item of items) {
    const title = displayTitle(item);
    const figure = document.createElement("figure");
    figure.className = "painting";

    const frame = document.createElement("div");
    frame.className = "painting__frame";
    frame.tabIndex = 0;
    frame.setAttribute("role", "button");
    frame.setAttribute("aria-label", `Открыть ${title}`);

    const mat = document.createElement("div");
    mat.className = "painting__mat";

    const img = document.createElement("img");
    img.src = item.url;
    img.alt = title;
    img.loading = "lazy";

    mat.appendChild(img);
    frame.appendChild(mat);
    figure.appendChild(frame);

    const caption = document.createElement("figcaption");
    caption.textContent = title;
    figure.appendChild(caption);

    const actions = document.createElement("div");
    actions.className = "painting__actions";

    const download = document.createElement("a");
    download.className = "action-btn";
    download.href = `/api/download/${encodeURIComponent(item.id)}`;
    download.setAttribute("download", "");
    download.textContent = "Скачать";
    actions.appendChild(download);

    if (admin) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "action-btn action-btn--danger";
      del.textContent = "Удалить";
      del.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Удалить «${title}»?`)) return;
        try {
          await deleteImage(item.id);
          setStatus("Картина удалена.");
          await loadImages();
          setTimeout(() => setStatus(""), 2000);
        } catch (err) {
          setStatus(err.message || "Ошибка удаления");
        }
      });
      actions.appendChild(del);
    }

    figure.appendChild(actions);

    const open = () => openLightbox(item.url, title);
    frame.addEventListener("click", open);
    frame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    galleryEl.appendChild(figure);
  }
}

async function loadImages() {
  const res = await fetch("/api/images");
  if (!res.ok) throw new Error("Не удалось загрузить галерею");
  const items = await res.json();
  renderImages(items);
}

async function uploadImage(file, title) {
  const form = new FormData();
  form.append("image", file);
  form.append("title", title);
  setStatus("Загрузка…");

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка загрузки");

  setStatus("Готово — картина на стене.");
  await loadImages();
  setTimeout(() => setStatus(""), 2500);
}

async function loginAdmin(password) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": password,
    },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Неверный пароль");
  setAdminPassword(password);
}

async function deleteImage(id) {
  const password = getAdminPassword();
  const res = await fetch(`/api/images/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Admin-Password": password },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setAdminPassword("");
    throw new Error("Сессия админа истекла");
  }
  if (!res.ok) throw new Error(data.error || "Ошибка удаления");
}

document.getElementById("open-upload").addEventListener("click", () => {
  uploadForm.reset();
  uploadDialog.showModal();
  uploadTitle.focus();
});

document.getElementById("upload-cancel").addEventListener("click", () => {
  uploadDialog.close();
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = uploadFile.files && uploadFile.files[0];
  const title = uploadTitle.value.trim();
  if (!file || !title) return;

  uploadDialog.close();
  try {
    await uploadImage(file, title);
  } catch (err) {
    setStatus(err.message || "Ошибка");
  }
});

document.getElementById("open-admin").addEventListener("click", () => {
  if (isAdmin()) {
    setStatus("Вы уже в режиме админа.");
    setTimeout(() => setStatus(""), 2000);
    return;
  }
  adminForm.reset();
  adminDialog.showModal();
  adminPasswordInput.focus();
});

document.getElementById("admin-cancel").addEventListener("click", () => {
  adminDialog.close();
});

document.getElementById("admin-logout").addEventListener("click", () => {
  setAdminPassword("");
  setStatus("Вышли из админки.");
  setTimeout(() => setStatus(""), 2000);
});

adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = adminPasswordInput.value;
  try {
    await loginAdmin(password);
    adminDialog.close();
    setStatus("Админ-режим включён.");
    setTimeout(() => setStatus(""), 2000);
  } catch (err) {
    setStatus(err.message || "Ошибка");
  }
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox || e.target.classList.contains("lightbox__close")) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
});

adminBadge.classList.toggle("hidden", !isAdmin());
loadImages().catch(() => {
  setStatus("Не удалось загрузить галерею");
});
