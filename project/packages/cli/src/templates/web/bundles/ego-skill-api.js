(() => {
  if (globalThis.__EGO_SKILL_API__) return;

  function findRecords({ status, selector = "[data-status]" } = {}) {
    const records = [...document.querySelectorAll(selector)]
      .filter((element) => !status || element.getAttribute("data-status") === status)
      .map((element) => ({
        id: element.id || null,
        status: element.getAttribute("data-status"),
        text: element.textContent?.trim() || "",
      }));
    return { url: location.href, count: records.length, records };
  }

  globalThis.__EGO_SKILL_API__ = Object.freeze({
    version: "0.1.0",
    findRecords,
  });
})();

