(function () {
  const ROOT_CLASS = "uc-data-bridge";
  const TOKEN_KEY = "auth_token";
  let timer = 0;
  let rendering = false;

  const css = `
    .${ROOT_CLASS} {
      border: 1px solid rgba(228, 228, 231, 0.82);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      color: #18181b;
      padding: 20px;
    }
    .${ROOT_CLASS} * { letter-spacing: 0; }
    .${ROOT_CLASS}__head {
      align-items: center;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .${ROOT_CLASS}__title {
      color: #18181b;
      font-size: 16px;
      font-weight: 900;
      line-height: 1.25;
    }
    .${ROOT_CLASS}__meta {
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .${ROOT_CLASS}__grid {
      display: grid;
      gap: 10px;
    }
    .${ROOT_CLASS}__row {
      align-items: center;
      background: #f8fafc;
      border-radius: 18px;
      display: grid;
      gap: 8px;
      grid-template-columns: 1fr auto;
      padding: 12px 14px;
    }
    .${ROOT_CLASS}__name {
      color: #27272a;
      font-size: 13px;
      font-weight: 900;
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${ROOT_CLASS}__desc {
      color: #71717a;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.45;
      margin-top: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${ROOT_CLASS}__value {
      color: #f97316;
      font-size: 13px;
      font-weight: 900;
      white-space: nowrap;
    }
    .${ROOT_CLASS}__empty {
      background: #f8fafc;
      border-radius: 18px;
      color: #71717a;
      font-size: 12px;
      font-weight: 800;
      padding: 14px;
      text-align: center;
    }
    .${ROOT_CLASS}__form {
      display: grid;
      gap: 10px;
    }
    .${ROOT_CLASS}__input {
      border: 1px solid #e4e4e7;
      border-radius: 18px;
      color: #18181b;
      font-size: 14px;
      font-weight: 800;
      outline: none;
      padding: 12px 14px;
      width: 100%;
    }
    .${ROOT_CLASS}__input:focus {
      border-color: #fb923c;
      box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.16);
    }
    .${ROOT_CLASS}__button {
      background: linear-gradient(135deg, #ffb11b, #ff7b1a);
      border: 0;
      border-radius: 18px;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
      font-weight: 900;
      min-height: 44px;
      padding: 0 16px;
    }
    .${ROOT_CLASS}__button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }
    .${ROOT_CLASS}__notice {
      border-radius: 16px;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.55;
      padding: 10px 12px;
    }
    .${ROOT_CLASS}__notice.is-ok {
      background: #ecfdf5;
      color: #047857;
    }
    .${ROOT_CLASS}__notice.is-error {
      background: #fef2f2;
      color: #dc2626;
    }
    @media (min-width: 960px) {
      body.uc-user-page #app .mx-auto.flex.h-full {
        border-left: 0 !important;
        border-right: 0 !important;
        max-width: 980px !important;
      }
      body.uc-user-page #app main.flex-1 {
        align-content: start;
        display: grid !important;
        gap: 16px;
        grid-template-columns: minmax(0, 1fr) minmax(360px, 0.95fr);
        padding-left: 24px !important;
        padding-right: 24px !important;
      }
      body.uc-user-page #app main.flex-1 > section {
        margin: 0 !important;
      }
      body.uc-user-page #app main.flex-1 > section:first-child {
        grid-column: 1 / -1;
      }
      body.uc-user-page #app footer.sticky {
        border-radius: 24px 24px 0 0;
        margin-left: 24px;
        margin-right: 24px;
      }
    }
  `;

  function ensureStyle() {
    if (document.getElementById("uc-data-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "uc-data-bridge-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shortText(value, fallback) {
    const text = String(value || fallback || "").replace(/\s+/g, " ").trim();
    return text.length > 36 ? `${text.slice(0, 36)}...` : text;
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  async function api(path, options) {
    const headers = {
      "Content-Type": "application/json",
    };
    const authToken = token();
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options && options.headers ? options.headers : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `请求失败：HTTP ${res.status}`);
    }
    return data;
  }

  function removeBridge() {
    document.querySelectorAll(`.${ROOT_CLASS}`).forEach((node) => node.remove());
  }

  function mainEl() {
    return document.querySelector("main.flex-1") || document.querySelector("main");
  }

  function rowsHtml(rows, type) {
    if (!rows.length) {
      return `<div class="${ROOT_CLASS}__empty">暂无${type === "generation" ? "生成记录" : "余额流水"}</div>`;
    }
    return rows
      .slice(0, 3)
      .map((row) => {
        if (type === "generation") {
          const prompt = shortText(row.prompt || row.title, "生成任务");
          const model = row.model || row.route_name || "mock";
          const cost = Number(row.cost ?? row.credits ?? 0);
          return `
            <div class="${ROOT_CLASS}__row">
              <div>
                <div class="${ROOT_CLASS}__name">${escapeHtml(prompt)}</div>
                <div class="${ROOT_CLASS}__desc">${escapeHtml(model)} · ${escapeHtml(row.status || "completed")} · ${escapeHtml(formatTime(row.created_at || row.createdAt))}</div>
              </div>
              <div class="${ROOT_CLASS}__value">-${escapeHtml(cost)} 算力</div>
            </div>
          `;
        }
        const amount = Number(row.change_amount ?? row.amount ?? 0);
        const mark = amount >= 0 ? "+" : "";
        return `
          <div class="${ROOT_CLASS}__row">
            <div>
              <div class="${ROOT_CLASS}__name">${escapeHtml(row.remark || row.type || "余额变更")}</div>
              <div class="${ROOT_CLASS}__desc">余额 ${escapeHtml(row.after_balance ?? row.balance ?? "-")} · ${escapeHtml(formatTime(row.created_at || row.createdAt))}</div>
            </div>
            <div class="${ROOT_CLASS}__value">${mark}${escapeHtml(amount)} 算力</div>
          </div>
        `;
      })
      .join("");
  }

  async function renderRecords(container) {
    const card = document.createElement("section");
    card.className = ROOT_CLASS;
    card.innerHTML = `
      <div class="${ROOT_CLASS}__head">
        <div class="${ROOT_CLASS}__title">真实记录</div>
        <div class="${ROOT_CLASS}__meta">加载中</div>
      </div>
      <div class="${ROOT_CLASS}__empty">正在读取生成记录和余额流水...</div>
    `;
    container.appendChild(card);

    try {
      const [generations, logs] = await Promise.all([
        api("/user/generations"),
        api("/user/balance-logs"),
      ]);
      const generationRows = generations.items || generations.list || generations.data || [];
      const logRows = logs.items || logs.list || logs.data || [];
      card.innerHTML = `
        <div class="${ROOT_CLASS}__head">
          <div class="${ROOT_CLASS}__title">真实记录</div>
          <div class="${ROOT_CLASS}__meta">生成 ${generationRows.length} · 流水 ${logRows.length}</div>
        </div>
        <div class="${ROOT_CLASS}__grid">
          ${rowsHtml(generationRows, "generation")}
          ${rowsHtml(logRows, "log")}
        </div>
      `;
    } catch (error) {
      card.innerHTML = `
        <div class="${ROOT_CLASS}__head">
          <div class="${ROOT_CLASS}__title">真实记录</div>
          <div class="${ROOT_CLASS}__meta">读取失败</div>
        </div>
        <div class="${ROOT_CLASS}__notice is-error">${escapeHtml(error.message || "接口暂不可用")}</div>
      `;
    }
  }

  function renderRedeem(container) {
    const card = document.createElement("section");
    card.className = ROOT_CLASS;
    card.innerHTML = `
      <div class="${ROOT_CLASS}__head">
        <div class="${ROOT_CLASS}__title">兑换码提交</div>
        <div class="${ROOT_CLASS}__meta">已接后端</div>
      </div>
      <form class="${ROOT_CLASS}__form">
        <input class="${ROOT_CLASS}__input" name="code" autocomplete="off" placeholder="输入兑换码，例如 WELCOME50" />
        <button class="${ROOT_CLASS}__button" type="submit">立即兑换</button>
        <div class="${ROOT_CLASS}__notice is-ok">当前走本地后端兑换接口，成功后会写入余额流水。</div>
      </form>
    `;
    const form = card.querySelector("form");
    const input = card.querySelector("input");
    const button = card.querySelector("button");
    const notice = card.querySelector(`.${ROOT_CLASS}__notice`);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = input.value.trim();
      if (!code) {
        notice.className = `${ROOT_CLASS}__notice is-error`;
        notice.textContent = "请输入兑换码。";
        return;
      }
      button.disabled = true;
      button.textContent = "兑换中...";
      try {
        const result = await api("/user/redeem", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        notice.className = `${ROOT_CLASS}__notice is-ok`;
        notice.textContent = `兑换成功，增加 ${result.amount || 0} 算力，当前余额 ${result.balance || "-"}。`;
      } catch (error) {
        notice.className = `${ROOT_CLASS}__notice is-error`;
        notice.textContent = error.message || "兑换失败。";
      } finally {
        button.disabled = false;
        button.textContent = "立即兑换";
      }
    });
    container.appendChild(card);
  }

  async function render() {
    if (rendering) return;
    const path = window.location.pathname;
    document.body.classList.toggle("uc-user-page", path.startsWith("/user/"));
    if (!path.startsWith("/user/")) {
      removeBridge();
      return;
    }
    const container = mainEl();
    if (!container) return;
    const existing = document.querySelector(`.${ROOT_CLASS}`);
    if (existing && existing.dataset.path === path) return;
    rendering = true;
    removeBridge();
    ensureStyle();
    try {
      if (path === "/user/records") {
        await renderRecords(container);
      } else if (path === "/user/redeem") {
        renderRedeem(container);
      }
      const inserted = document.querySelector(`.${ROOT_CLASS}`);
      if (inserted) inserted.dataset.path = path;
    } finally {
      rendering = false;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }

  ["pushState", "replaceState"].forEach((name) => {
    const original = history[name];
    history[name] = function () {
      const result = original.apply(this, arguments);
      schedule();
      return result;
    };
  });
  window.addEventListener("popstate", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  document.addEventListener("error", (event) => {
    if (!window.location.pathname.startsWith("/user/")) return;
    const target = event.target;
    if (!target || target.tagName !== "IMG") return;
    target.style.visibility = "hidden";
  }, true);

  const app = document.getElementById("app");
  if (app) {
    new MutationObserver(() => {
      const path = window.location.pathname;
      if ((path === "/user/records" || path === "/user/redeem") && !document.querySelector(`.${ROOT_CLASS}`)) {
        schedule();
      }
    }).observe(app, { childList: true, subtree: true });
  }
})();
