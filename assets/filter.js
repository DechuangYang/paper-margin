const filters = document.querySelector(".filters");

if (filters) {
  const buttons = Array.from(filters.querySelectorAll("button"));
  const posts = Array.from(document.querySelectorAll(".post-row"));
  const status = document.querySelector("#result-count");
  const empty = document.querySelector("#empty");

  filters.hidden = false;
  filters.addEventListener("click", (event) => {
    const selected = event.target.closest("button");
    if (!selected) return;

    const category = selected.dataset.filter;
    for (const button of buttons) {
      button.setAttribute("aria-pressed", button === selected);
    }
    for (const post of posts) {
      post.hidden = category !== "all" && category !== post.dataset.category;
    }

    const count = posts.filter((post) => !post.hidden).length;
    empty.hidden = count !== 0;
    status.textContent = `显示 ${count} 篇文章`;
  });
}
