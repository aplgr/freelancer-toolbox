// Tool list loader for the landing page.
// Uses Alpine.js state and renders cards from tools.json.

window.toolbox = function toolbox() {
  return {
    tools: [],
    loading: true,
    error: "",

    updateLdJson(tools) {
      const target = document.getElementById("toolboxLdJson");
      if (!target) return;

      const itemListElement = (tools || []).map((t, idx) => {
        const href = String(t.href || "");
        let url = href;

        try {
          url = new URL(href, document.baseURI).href;
        } catch (_) {
          // Keep fallback url as-is.
        }

        return {
          "@type": "ListItem",
          position: idx + 1,
          name: String(t.title || ""),
          description: String(t.description || ""),
          url
        };
      });

      const payload = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Freelancer Business Toolbox",
        itemListElement
      };

      target.textContent = JSON.stringify(payload);
    },

    async init() {
      try {
        const res = await fetch("tools.json", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} while loading tools.json`);
        }

        const data = await res.json();
        const tools = Array.isArray(data.tools) ? data.tools : [];

        // Sort defensively even though tools.json is already ordered.
        tools.sort((a, b) => {
          const ao = Number.isFinite(a.order) ? a.order : 10000;
          const bo = Number.isFinite(b.order) ? b.order : 10000;
          if (ao !== bo) return ao - bo;
          return String(a.title || "").localeCompare(String(b.title || ""));
        });

        this.tools = tools;
        this.updateLdJson(tools);
      } catch (err) {
        this.error = "Could not load the tool list. Please refresh or open a tool directly from /tools/.";
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        this.loading = false;
      }
    }
  };
};
