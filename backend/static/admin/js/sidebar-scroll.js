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

  const getNavigationShell = (documentNode = document) => {
    const jazzySidebar = documentNode.querySelector("#jazzy-sidebar");
    const jazzyNavigation = jazzySidebar?.querySelector("#jazzy-navigation");
    const jazzyMain = documentNode.querySelector(".app-main");
    if (jazzySidebar && jazzyNavigation && jazzyMain) {
      return {
        type: "jazzy",
        scrollContainer: jazzySidebar,
        navigation: jazzyNavigation,
        main: jazzyMain,
      };
    }

    const platformSidebar = documentNode.querySelector(".be-side");
    const platformNavigation = platformSidebar?.querySelector("nav");
    const platformMain = documentNode.querySelector(".be-main");
    if (platformSidebar && platformNavigation && platformMain) {
      return {
        type: "platform",
        scrollContainer: platformNavigation,
        navigation: platformNavigation,
        main: platformMain,
      };
    }

    return null;
  };

  const navigationShell = getNavigationShell();
  if (!navigationShell) return;

  let navigationRequest = 0;
  const supportedScriptTypes = new Set([
    "",
    "application/javascript",
    "module",
    "text/javascript",
  ]);

  const loadPageAssets = async (nextDocument, existingScripts, inlineScripts) => {
    const existingStyles = new Set(
      Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).map(
        (link) => link.href,
      ),
    );
    const existingStyleText = new Set(
      Array.from(document.head.querySelectorAll("style")).map((style) =>
        style.textContent.trim(),
      ),
    );

    nextDocument
      .querySelectorAll('link[rel="stylesheet"]')
      .forEach((link) => {
        if (!existingStyles.has(link.href)) {
          document.head.append(document.importNode(link, true));
          existingStyles.add(link.href);
        }
      });

    nextDocument.querySelectorAll("style").forEach((style) => {
      const text = style.textContent.trim();
      if (text && !existingStyleText.has(text)) {
        document.head.append(document.importNode(style, true));
        existingStyleText.add(text);
      }
    });

    for (const script of nextDocument.scripts) {
      const type = (script.getAttribute("type") || "").toLowerCase();
      if (!supportedScriptTypes.has(type)) continue;

      if (script.src) {
        const source = script.src;
        const reloadForNewPage =
          new URL(source).pathname.endsWith("/admin/js/filters.js");
        if (existingScripts.has(source) && !reloadForNewPage) continue;

        await new Promise((resolve, reject) => {
          const nextScript = document.createElement("script");
          nextScript.src = source;
          nextScript.async = false;
          if (type) nextScript.type = type;
          nextScript.onload = resolve;
          nextScript.onerror = () =>
            reject(new Error(`Unable to load admin script: ${source}`));
          document.head.append(nextScript);
        });
        existingScripts.add(source);
        continue;
      }

      const text = script.textContent.trim();
      if (!text || inlineScripts.has(text)) continue;

      const nextScript = document.createElement("script");
      if (type) nextScript.type = type;
      nextScript.textContent = script.textContent;
      document.head.append(nextScript);
      nextScript.remove();
      inlineScripts.add(text);
    }
  };

  const navigate = async (url, addHistoryEntry) => {
    const requestId = ++navigationRequest;
    const currentShell = getNavigationShell();
    if (!currentShell) {
      window.location.assign(url);
      return;
    }

    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok || response.redirected) {
        window.location.assign(response.url || url);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        window.location.assign(url);
        return;
      }

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, "text/html");
      const nextShell = getNavigationShell(nextDocument);
      if (!nextShell || nextShell.type !== currentShell.type) {
        window.location.assign(response.url || url);
        return;
      }

      if (requestId !== navigationRequest) return;

      const existingScripts = new Set(
        Array.from(document.scripts)
          .filter((script) => script.src)
          .map((script) => script.src),
      );
      const inlineScripts = new Set(
        Array.from(document.scripts)
          .filter((script) => !script.src)
          .map((script) => script.textContent.trim()),
      );
      const actionsAlreadyLoaded = typeof window.Actions === "function";
      const sidebarScrollTop = currentShell.scrollContainer.scrollTop;
      const sidebarScrollLeft = currentShell.scrollContainer.scrollLeft;
      currentShell.main.replaceWith(
        document.importNode(nextShell.main, true),
      );
      currentShell.navigation.innerHTML = nextShell.navigation.innerHTML;
      document.title = nextDocument.title;
      document.body.className = nextDocument.body.className;

      await loadPageAssets(nextDocument, existingScripts, inlineScripts);
      if (requestId !== navigationRequest) return;

      if (actionsAlreadyLoaded && typeof window.Actions === "function") {
        const actionCheckboxes = document.querySelectorAll(
          "tr input.action-select",
        );
        if (actionCheckboxes.length) window.Actions(actionCheckboxes);
      }

      currentShell.scrollContainer.scrollTop = sidebarScrollTop;
      currentShell.scrollContainer.scrollLeft = sidebarScrollLeft;
      if (addHistoryEntry) {
        window.history.pushState({}, "", response.url || url);
      }
      window.scrollTo(0, 0);
    } catch (error) {
      console.error(
        "Admin partial navigation failed; loading the page normally.",
        error,
      );
      window.location.assign(url);
    }
  };

  navigationShell.navigation.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      !(event.target instanceof Element) ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const link = event.target.closest("a[href]");
    if (
      !link ||
      !navigationShell.navigation.contains(link) ||
      (link.target && link.target !== "_self") ||
      link.hasAttribute("download")
    ) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (
      url.origin !== window.location.origin ||
      (url.pathname === window.location.pathname &&
        url.search === window.location.search)
    ) {
      return;
    }

    event.preventDefault();
    navigate(url.href, true);
  });

  window.addEventListener("popstate", () => {
    navigate(window.location.href, false);
  });
})();
