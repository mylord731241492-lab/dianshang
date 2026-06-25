(function () {
  const TOKEN_KEY = "auth_token";
  const HANDLED = "galleryDeleteSynced";

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function toast(message, type) {
    if (window.$message && typeof window.$message[type || "info"] === "function") {
      window.$message[type || "info"](message);
      return;
    }
    console.log(`[gallery] ${message}`);
  }

  function isGalleryDialog(node) {
    const dialog = node && node.closest ? node.closest(".n-modal, [role='dialog']") : null;
    return !!dialog && /图片生成历史/.test(dialog.innerText || "");
  }

  function isDeleteButton(node) {
    const button = node && node.closest ? node.closest("button") : null;
    if (!button) return null;
    return button.innerText && button.innerText.trim() === "删除" ? button : null;
  }

  function isSaveButton(node) {
    const button = node && node.closest ? node.closest("button") : null;
    if (!button) return null;
    const text = button.innerText ? button.innerText.trim() : "";
    return text === "保存链接" || text === "保存全部链接" ? button : null;
  }

  function absoluteUrl(value) {
    if (!value) return "";
    try {
      return new URL(value, window.location.origin).href;
    } catch {
      return value;
    }
  }

  function articleUrl(button) {
    const article = button.closest("article");
    const image = article ? article.querySelector("img") : null;
    return absoluteUrl(image ? image.getAttribute("src") || "" : "");
  }

  function allDialogUrls(button) {
    const dialog = button.closest(".n-modal, [role='dialog']");
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll("article img"))
      .map((image) => absoluteUrl(image.getAttribute("src") || ""))
      .filter(Boolean);
  }

  function normalizeHistoryItem(item) {
    const url = absoluteUrl(item.url || item.imageUrl || item.resultUrl || item.result_url || "");
    return {
      id: item.id || "",
      url,
      resultUrl: url,
      prompt: item.prompt || "",
      label: item.label || (item.prompt ? String(item.prompt).slice(0, 30) : "生成图片"),
      model: item.model || item.modelKey || item.model_key || "",
      size: item.size || item.requestedSize || "1024x1024"
    };
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchGalleryItems() {
    const authToken = token();
    if (!authToken) return [];
    const response = await fetch("/api/user/generations", {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
    return rows.map(normalizeHistoryItem).filter((item) => item.url);
  }

  async function copyText(text) {
    if (!text) throw new Error("没有可保存的图片链接");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "readonly");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    if (!ok) throw new Error("浏览器拒绝复制链接");
  }

  function getPayload(button) {
    const article = button.closest("article");
    if (!article) return null;
    const image = article.querySelector("img");
    const title = article.querySelector(".text-sm") || article.querySelector("[class*='text-sm']");
    return {
      resultUrl: image ? image.getAttribute("src") || "" : "",
      prompt: title ? title.textContent.trim() : ""
    };
  }

  async function syncDelete(payload) {
    const authToken = token();
    if (!authToken) return { skipped: true };
    const res = await fetch("/api/user/generations", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `删除失败：HTTP ${res.status}`);
    }
    return data;
  }

  document.addEventListener("click", (event) => {
    const button = isDeleteButton(event.target);
    if (!button || button.dataset[HANDLED] === "1" || !isGalleryDialog(button)) return;

    const payload = getPayload(button);
    if (!payload || (!payload.resultUrl && !payload.prompt)) return;

    button.dataset[HANDLED] = "1";
    syncDelete(payload)
      .then((result) => {
        if (result.skipped) return;
        if (result.deleted) {
          toast("图库记录已删除", "success");
        } else {
          toast("本地列表已移除，未找到对应后端记录", "warning");
        }
      })
      .catch((error) => {
        toast(error.message || "图库记录删除失败", "error");
      });
  }, true);

  document.addEventListener("click", (event) => {
    const button = isSaveButton(event.target);
    if (!button || !isGalleryDialog(button)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const text = button.innerText.trim();
    const links = text === "保存全部链接" ? allDialogUrls(button) : [articleUrl(button)].filter(Boolean);
    copyText(links.join("\n"))
      .then(() => {
        toast(text === "保存全部链接" ? `已复制 ${links.length} 条图片链接` : "图片链接已复制", "success");
      })
      .catch((error) => {
        toast(error.message || "保存链接失败", "error");
      });
  }, true);

  function installMobileGalleryStyles() {
    if (document.getElementById("gallery-mobile-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "gallery-mobile-bridge-style";
    style.textContent = `
      .gallery-mobile-bridge-button,
      .gallery-mobile-bridge-modal {
        display: none;
      }

      @media (max-width: 720px) {
        .gallery-mobile-bridge-button {
          align-items: center;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(15, 118, 110, 0.14);
          border-radius: 16px;
          bottom: 18px;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
          color: #0f766e;
          display: inline-flex;
          font-size: 13px;
          font-weight: 900;
          gap: 6px;
          left: 18px;
          min-height: 44px;
          padding: 0 16px;
          position: fixed;
          z-index: 60;
        }

        .gallery-mobile-bridge-modal {
          align-items: center;
          background: rgba(15, 23, 42, 0.46);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 18px;
          position: fixed;
          z-index: 100;
        }

        .gallery-mobile-bridge-panel {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 22px;
          box-shadow: 0 26px 60px rgba(15, 23, 42, 0.22);
          max-height: 76vh;
          overflow: auto;
          padding: 20px;
          width: min(100%, 350px);
        }

        .gallery-mobile-bridge-header {
          align-items: center;
          display: flex;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .gallery-mobile-bridge-header strong {
          color: #111827;
          font-size: 17px;
        }

        .gallery-mobile-bridge-actions {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .gallery-mobile-bridge-actions button,
        .gallery-mobile-bridge-card button {
          border: 1px solid #dbe3ea;
          border-radius: 999px;
          color: #334155;
          font-size: 12px;
          font-weight: 800;
          min-height: 30px;
          padding: 0 10px;
        }

        .gallery-mobile-bridge-actions button:disabled {
          color: #94a3b8;
        }

        .gallery-mobile-bridge-grid {
          display: grid;
          gap: 12px;
        }

        .gallery-mobile-bridge-card {
          border: 1px solid #dbe3ea;
          border-radius: 16px;
          overflow: hidden;
        }

        .gallery-mobile-bridge-card img {
          aspect-ratio: 1 / 1;
          display: block;
          object-fit: cover;
          width: 100%;
        }

        .gallery-mobile-bridge-card-body {
          padding: 12px;
        }

        .gallery-mobile-bridge-card-title {
          color: #1f2937;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.35;
        }

        .gallery-mobile-bridge-card-meta,
        .gallery-mobile-bridge-empty {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isMobileHome() {
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches && window.location.pathname === "/";
  }

  function closeMobileGallery() {
    document.querySelector(".gallery-mobile-bridge-modal")?.remove();
  }

  async function openMobileGallery() {
    installMobileGalleryStyles();
    closeMobileGallery();
    const items = await fetchGalleryItems();
    const modal = document.createElement("div");
    modal.className = "gallery-mobile-bridge-modal";
    modal.setAttribute("role", "dialog");
    modal.innerHTML = `
      <section class="gallery-mobile-bridge-panel">
        <div class="gallery-mobile-bridge-header">
          <strong>图片生成历史</strong>
          <button type="button" data-gallery-mobile-close>×</button>
        </div>
        <div class="gallery-mobile-bridge-actions">
          <span>共 ${items.length} 张</span>
          <button type="button" ${items.length ? "" : "disabled"} data-gallery-mobile-save-all>保存全部链接</button>
        </div>
        ${
          items.length
            ? `<div class="gallery-mobile-bridge-grid">${items.map((item) => `
                <article class="gallery-mobile-bridge-card">
                  <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}">
                  <div class="gallery-mobile-bridge-card-body">
                    <div class="gallery-mobile-bridge-card-title">${escapeHtml(item.label)}</div>
                    <div class="gallery-mobile-bridge-card-meta">${escapeHtml(item.prompt)}</div>
                    <div class="gallery-mobile-bridge-card-meta">${escapeHtml(item.model)} · ${escapeHtml(item.size)}</div>
                    <button type="button" data-gallery-mobile-save="${escapeHtml(item.url)}">保存链接</button>
                  </div>
                </article>
              `).join("")}</div>`
            : `<div class="gallery-mobile-bridge-empty">还没有图片生成历史</div>`
        }
      </section>
    `;
    modal.addEventListener("click", async (event) => {
      const target = event.target;
      if (target === modal || target.closest("[data-gallery-mobile-close]")) {
        closeMobileGallery();
        return;
      }
      const saveAll = target.closest("[data-gallery-mobile-save-all]");
      if (saveAll) {
        await copyText(items.map((item) => item.url).join("\n"));
        toast(`已复制 ${items.length} 条图片链接`, "success");
        return;
      }
      const saveOne = target.closest("[data-gallery-mobile-save]");
      if (saveOne) {
        await copyText(saveOne.getAttribute("data-gallery-mobile-save") || "");
        toast("图片链接已复制", "success");
      }
    });
    document.body.appendChild(modal);
  }

  function ensureMobileGalleryButton() {
    installMobileGalleryStyles();
    if (!isMobileHome()) {
      document.querySelector(".gallery-mobile-bridge-button")?.remove();
      return;
    }
    if (document.querySelector(".gallery-mobile-bridge-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-mobile-bridge-button";
    button.textContent = "图库";
    button.addEventListener("click", openMobileGallery);
    document.body.appendChild(button);
  }

  ensureMobileGalleryButton();
  window.addEventListener("resize", ensureMobileGalleryButton);
  window.addEventListener("popstate", () => window.setTimeout(ensureMobileGalleryButton, 120));
  window.setInterval(ensureMobileGalleryButton, 1200);
})();
