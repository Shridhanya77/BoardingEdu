(() => {
  const script = document.currentScript;
  const endpoint = script?.dataset.endpoint;
  const userId = script?.dataset.userId;
  if (!endpoint || !userId) {
    console.error("Admin notification polling requires an endpoint and user id.");
    return;
  }

  const storageKey = `boardingedu-admin-notifications-${userId}`;
  let cursor = null;
  let polling = false;
  let container;

  try {
    const storedValue = window.sessionStorage.getItem(storageKey);
    if (storedValue !== null) {
      const storedCursor = Number(storedValue);
      if (Number.isSafeInteger(storedCursor) && storedCursor >= 0) {
        cursor = storedCursor;
      }
    }
  } catch (error) {
    console.error("Could not restore the admin notification cursor.", error);
  }

  function saveCursor(value) {
    cursor = value;
    try {
      window.sessionStorage.setItem(storageKey, String(value));
    } catch (error) {
      console.error("Could not save the admin notification cursor.", error);
    }
  }

  function getContainer() {
    if (container?.isConnected) return container;
    container = document.createElement("div");
    container.className = "be-admin-notifications";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "New submission notifications");
    container.setAttribute("aria-live", "polite");
    document.body.append(container);
    return container;
  }

  function showNotification(notification) {
    const toast = document.createElement("article");
    toast.className = "be-admin-notification";
    toast.setAttribute("role", "status");

    const heading = document.createElement("strong");
    heading.className = "be-admin-notification__title";
    heading.textContent = notification.title;
    toast.append(heading);

    if (notification.body) {
      const body = document.createElement("p");
      body.className = "be-admin-notification__body";
      body.textContent = notification.body;
      toast.append(body);
    }

    if (notification.url) {
      try {
        const target = new URL(notification.url, window.location.origin);
        if (target.origin === window.location.origin && target.pathname.startsWith("/admin/")) {
          const link = document.createElement("a");
          link.className = "be-admin-notification__link";
          link.href = target.href;
          link.textContent = "Open";
          toast.append(link);
        }
      } catch (error) {
        console.error("An admin notification had an invalid link.", error);
      }
    }

    const dismiss = document.createElement("button");
    dismiss.className = "be-admin-notification__close";
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Dismiss notification");
    dismiss.textContent = "×";
    toast.append(dismiss);

    const timeout = window.setTimeout(() => toast.remove(), 9000);
    dismiss.addEventListener("click", () => {
      window.clearTimeout(timeout);
      toast.remove();
    });
    getContainer().append(toast);
  }

  async function poll() {
    if (polling || document.visibilityState === "hidden") return;
    polling = true;
    try {
      const url = new URL(endpoint, window.location.href);
      if (cursor !== null) url.searchParams.set("after", String(cursor));
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Notification request failed with HTTP ${response.status}.`);
      }

      const payload = await response.json();
      if (!Number.isSafeInteger(payload.cursor) || payload.cursor < 0 || !Array.isArray(payload.results)) {
        throw new Error("The notification response had an invalid format.");
      }
      if (cursor === null) {
        saveCursor(payload.cursor);
        return;
      }

      for (const notification of payload.results) {
        showNotification(notification);
      }
      saveCursor(payload.cursor);
    } catch (error) {
      console.error("Could not check for new BoardingEdu submissions.", error);
    } finally {
      polling = false;
    }
  }

  void poll();
  window.setInterval(() => void poll(), 12000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void poll();
  });
})();
