document.addEventListener("DOMContentLoaded", () => {
  const field = document.getElementById("id_content");
  if (!field || field.dataset.blogEditorReady === "true") return;
  field.dataset.blogEditorReady = "true";

  const toolbar = document.createElement("div");
  toolbar.className = "blog-editor-toolbar";
  const actions = [
    ["Heading", "<h2>Heading</h2>\n"],
    ["Subheading", "<h3>Subheading</h3>\n"],
    ["Paragraph", "<p>Paragraph</p>\n"],
    ["List", "<ul>\n  <li>Point</li>\n</ul>\n"],
    ["Link", '<p><a href="https://www.boardingedu.com/india/">Explore schools</a></p>\n'],
    ["Image", '<figure><img src="https://" alt="Describe the image"><figcaption>Caption</figcaption></figure>\n'],
  ];
  actions.forEach(([label, snippet]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "blog-editor-toolbar__button";
    button.textContent = label;
    button.addEventListener("click", () => {
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? start;
      field.value = `${field.value.slice(0, start)}${snippet}${field.value.slice(end)}`;
      field.focus();
      field.selectionStart = field.selectionEnd = start + snippet.length;
    });
    toolbar.appendChild(button);
  });
  field.before(toolbar);
});
