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
})();
