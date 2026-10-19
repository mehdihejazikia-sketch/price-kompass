document.getElementById("v").textContent = chrome.runtime.getManifest().version;
for (const b of document.querySelectorAll("button[data-site]")) {
  b.addEventListener("click", async () => {
    const out = document.getElementById("out");
    out.textContent = "…";
    const term = document.getElementById("term").value;
    const res = await chrome.runtime.sendMessage({ type: "test-check", site: b.dataset.site, product: { search_term: term, model: term, name: term } });
    out.textContent = JSON.stringify(res, null, 2);
  });
}
