import MarkdownIt from "markdown-it";
import { githubClient, publishArticle } from "./github.js";

const form = document.querySelector("#editor-form");
const list = document.querySelector("#editor-posts");
const notice = document.querySelector("#editor-status");
const publishNotice = document.querySelector("#publish-status");
const publishConfirm = document.querySelector("#publish-confirm");
const preview = document.querySelector("#editor-preview");
const commitLink = document.querySelector("#editor-link");
const tokenField = document.querySelector("#publish-token");
const { repository, branch } = document.querySelector("#pages-config").dataset;
const markdown = new MarkdownIt({ html: false });
const fields = ["title", "category", "summary", "body"];
const textArea = form.elements.body;
const newPost = document.querySelector("#new-post");
const publish = document.querySelector("#publish-post");
const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const databaseName = "paper-margin:" + new URL(".", location.href).pathname;

let draft;
let dirty = false;
let busy = false;
let previewUrls = [];

function status(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle("error", error);
}

function publishStatus(message, error = false) {
  publishNotice.textContent = message;
  publishNotice.classList.toggle("error", error);
}

const database = new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("无法访问浏览器的草稿存储。"));
});

async function storage(mode, work) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", mode);
    const request = work(transaction.objectStore("drafts"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(new Error("本机草稿存储失败，请检查浏览器的存储空间。"));
  });
}

function dateToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function clearPreview() {
  preview.hidden = true;
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
}

function load(post) {
  draft = post ?? { id: crypto.randomUUID(), date: dateToday(), title: "", category: "essay", summary: "", body: "", images: [] };
  for (const field of fields) form.elements[field].value = draft[field];
  clearPreview();
  commitLink.hidden = true;
  publishConfirm.checked = false;
  publishStatus("");
  dirty = false;
}

async function refresh() {
  const drafts = await storage("readonly", (store) => store.getAll());
  list.replaceChildren();
  for (const post of drafts.sort((a, b) => b.updated - a.updated)) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = post.id;
    button.textContent = post.title || "无标题草稿";
    if (draft.id === post.id) button.setAttribute("aria-current", "true");
    item.append(button);
    list.append(item);
  }
  if (!drafts.length) {
    const empty = document.createElement("li");
    empty.textContent = "这里还没有草稿。";
    list.append(empty);
  }
}

async function save() {
  const fieldsValue = Object.fromEntries(fields.map((field) => [field, form.elements[field].value]));
  const current = { ...draft, ...fieldsValue, updated: Date.now() };
  await storage("readwrite", (store) => store.put(current));
  draft = current;
  dirty = false;
  return current;
}

async function run(work, report = status) {
  if (busy) return;
  busy = true;
  const controls = [...form.elements, newPost];
  for (const control of controls) control.disabled = true;
  try {
    await work();
  } catch (error) {
    report(error.message || "操作失败，请稍后重试。", true);
  } finally {
    for (const control of controls) control.disabled = false;
    publish.disabled = !repository;
    busy = false;
  }
}

function canSwitch() {
  return !busy && (!dirty || window.confirm("当前修改还没保存。要离开这篇草稿吗？"));
}

function render(body) {
  const template = document.createElement("template");
  template.innerHTML = markdown.render(body);
  return template.content;
}

function imagesIn(body) {
  const paths = new Set(Array.from(render(body).querySelectorAll("img"), (img) => img.getAttribute("src")));
  return draft.images.filter((image) => paths.has("./" + image.path));
}

textArea.addEventListener("paste", (event) => {
  const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
  if (!file) return;
  event.preventDefault();
  if (busy) return;
  const ext = extensions[file.type];
  if (!ext || !file.size || file.size > 8 * 1024 * 1024) {
    status("请粘贴 8 MB 以内的 PNG、JPEG、GIF 或 WebP 图片。", true);
    return;
  }
  const path = "assets/uploads/" + crypto.randomUUID() + "." + ext;
  const [start, end] = [textArea.selectionStart, textArea.selectionEnd];
  const before = textArea.value.slice(0, start);
  const after = textArea.value.slice(end);
  const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  const suffix = after.startsWith("\n\n") ? "" : (after.startsWith("\n") ? "\n" : "\n\n");
  const insert = prefix + "![图片](./" + path + ")" + suffix;
  if (textArea.textLength - (end - start) + insert.length > textArea.maxLength) {
    status("正文空间不足，无法插入图片。", true);
    return;
  }
  draft.images.push({ path, blob: file.slice(0, file.size, file.type) });
  textArea.setRangeText(insert, start, end, "end");
  dirty = true;
  status("图片已插入，可以点击「预览」。");
});

form.addEventListener("input", (event) => { if (fields.includes(event.target.name)) dirty = true; });
window.addEventListener("beforeunload", (event) => { if (dirty) event.preventDefault(); });
newPost.addEventListener("click", () => {
  if (!canSwitch()) return;
  load();
  status("");
  run(refresh);
});
list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button || !canSwitch()) return;
  run(async () => {
    const post = await storage("readonly", (store) => store.get(button.dataset.id));
    if (post) load(post);
    await refresh();
    status("");
  });
});
document.querySelector("#save-post").addEventListener("click", () => run(async () => {
  await save();
  await refresh();
  status("草稿已保存到当前浏览器。");
}));
document.querySelector("#preview-post").addEventListener("click", () => {
  clearPreview();
  const fragment = render(textArea.value);
  const files = new Map(draft.images.map((file) => ["./" + file.path, file.blob]));
  for (const img of fragment.querySelectorAll("img")) {
    const file = files.get(img.getAttribute("src"));
    if (!file) continue;
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    img.src = url;
  }
  preview.querySelector(".prose").replaceChildren(fragment);
  preview.hidden = false;
  status("预览已更新。");
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy || !repository) return;
  if (!form.elements.title.value.trim() || !textArea.value.trim()) {
    publishStatus("发布前请填写标题和正文。", true);
    return;
  }
  if (!tokenField.value.trim()) {
    publishStatus("请输入此仓库的细粒度 GitHub 令牌。", true);
    return;
  }
  if (!publishConfirm.checked) {
    publishStatus("请先勾选公开发布确认。", true);
    publishConfirm.focus();
    return;
  }
  commitLink.hidden = true;
  publishStatus("正在保存草稿…");
  const token = tokenField.value.trim();
  tokenField.value = "";
  run(async () => {
    const saved = await save();
    await refresh();
    publishStatus("正在提交文章和图片…");
    const line = (value) => value.replace(/\s+/g, " ").trim();
    const post = [
      "---", "title: " + line(saved.title), "date: " + saved.date, "category: " + saved.category,
      "summary: " + line(saved.summary), "---", "", saved.body, "",
    ].join("\n");
    const sha = await publishArticle(githubClient(repository, token), branch, "content/p-" + saved.id + ".md", post, imagesIn(saved.body));
    commitLink.href = "https://github.com/" + repository + "/commit/" + sha;
    commitLink.hidden = false;
    publishConfirm.checked = false;
    publishStatus("已提交到 GitHub。GitHub Actions 构建完成后，文章会出现在网站上。");
  }, publishStatus);
});

document.querySelector("#publish-target").textContent = repository ? "目标仓库：" + repository : "当前预览没有配置 GitHub 仓库。";
load();
run(refresh);
