(() => {
  const sidebars = [
    { selector: ".be-side nav", key: "boardingedu:admin-platform-sidebar" },
    { selector: "#jazzy-sidebar", key: "boardingedu:admin-jazzy-sidebar" },
    { selector: "#nav-sidebar", key: "boardingedu:admin-model-sidebar" },
  ];

  function ensureActiveItemVisible(container) {
    const activeItem = container.querySelector(
      '[aria-current="page"], .is-active, a.active, .current-model > a, .current-app > a',
    );
    if (!activeItem) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeItem.getBoundingClientRect();
    if (activeRect.top < containerRect.top) {
      container.scrollTop += activeRect.top - containerRect.top;
    } else if (activeRect.bottom > containerRect.bottom) {
      container.scrollTop += activeRect.bottom - containerRect.bottom;
    }
    if (activeRect.left < containerRect.left) {
      container.scrollLeft += activeRect.left - containerRect.left;
    } else if (activeRect.right > containerRect.right) {
      container.scrollLeft += activeRect.right - containerRect.right;
    }
  }

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
    else ensureActiveItemVisible(container);

    const savePosition = () => {
      window.sessionStorage.setItem(key, `${container.scrollTop},${container.scrollLeft}`);
    };
    const saveBeforeNavigation = (event) => {
      if (event.target instanceof Element && event.target.closest("a") && container.contains(event.target.closest("a"))) {
        savePosition();
      }
    };

    container.addEventListener("scroll", savePosition, { passive: true });
    document.addEventListener("click", saveBeforeNavigation);
    window.addEventListener("pagehide", savePosition);
    requestAnimationFrame(() => {
      if (hasSavedPosition) restorePosition();
      else ensureActiveItemVisible(container);
      savePosition();
    });
  }
})();
