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
})();
