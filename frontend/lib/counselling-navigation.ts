export const counsellingScrollStorageKey = "boardingeu:scroll-to-counselling";

export function scrollToCounselling() {
  const section = document.getElementById("counselling");
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}
