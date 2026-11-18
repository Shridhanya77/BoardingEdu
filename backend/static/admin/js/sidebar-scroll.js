(() => {
  const sidebars = [
    { selector: ".be-side nav", key: "boardingedu:admin-platform-sidebar" },
    { selector: "#jazzy-sidebar", key: "boardingedu:admin-jazzy-sidebar" },
    { selector: "#nav-sidebar", key: "boardingedu:admin-model-sidebar" },
  ];

  for (const { selector, key } of sidebars) {
    const container = document.querySelector(selector);
    if (!container) continue;

    const savedPosition = window.sessionStorage.getItem(key);
    const [savedTop, savedLeft] = savedPosition?.split(",").map(Number) || [];
    const hasSavedPosition =
      Number.isFinite(savedTop) || Number.isFinite(savedLeft);
    const restorePosition = () => {
      if (Number.isFinite(savedTop)) container.scrollTop = Math.max(0, savedTop);
      if (Number.isFinite(savedLeft)) container.scrollLeft = Math.max(0, savedLeft);
    };

    if (hasSavedPosition) restorePosition();

    const savePosition = () => {
      window.sessionStorage.setItem(key, `${container.scrollTop},${container.scrollLeft}`);
    };
    const saveBeforeNavigation = (event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link && container.contains(link)) {
        savePosition();
      }
    };

    container.addEventListener("scroll", savePosition, { passive: true });
    document.addEventListener("click", saveBeforeNavigation, true);
    window.addEventListener("pagehide", savePosition);
    window.addEventListener("beforeunload", savePosition);
    requestAnimationFrame(() => {
      restorePosition();
      savePosition();
    });
  }
})();
