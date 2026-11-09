from datetime import date
from html import escape
from itertools import groupby
from pathlib import Path
import re
import os
from shutil import copytree

from markdown_it import MarkdownIt


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
CATEGORIES = {"essay": "随笔", "tech": "技术笔记"}
MARKDOWN = MarkdownIt("commonmark", {"html": False})


def read_post(path):
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        raise ValueError(f"{path.name} 缺少文章元数据")
    end = lines.index("---", 1)
    meta = dict(line.split(":", 1) for line in lines[1:end])
    meta = {key.strip(): value.strip() for key, value in meta.items()}
    for key in ("title", "date", "category"):
        if not meta.get(key):
            raise ValueError(f"{path.name} 缺少 {key}")
    if meta["category"] not in CATEGORIES or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", path.stem):
        raise ValueError(f"{path.name} 的分类或文件名不符合约定")
    meta.setdefault("summary", "")
    meta["date"] = date.fromisoformat(meta["date"])
    meta["filename"] = path.name
    meta["url"] = f"./{path.stem}.html"
    if path.stem in {"index", "archive", "write", "404"}:
        raise ValueError(f"{path.name} 使用了保留名称")
    meta["body"] = MARKDOWN.render("\n".join(lines[end + 1:]))
    return meta


def layout(title, description, main, current=""):
    home_current = ' aria-current="page"' if current == "home" else ""
    archive_current = ' aria-current="page"' if current == "archive" else ""
    write_current = ' aria-current="page"' if current == "write" else ""
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; connect-src https://api.github.com; base-uri 'none'; form-action 'none'">
<title>{escape(title)}</title>
<meta name="description" content="{escape(description)}">
<link rel="icon" href="./assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="./assets/site.css">
<script src="./assets/filter.js" defer></script>
</head>
<body>
<a href="#main" class="skip">跳到正文</a>
<header class="masthead wrap">
  <a class="brand" href="./index.html"><img src="./assets/mark.svg" alt="" width="27" height="27"><span>纸间</span><small>PAPER MARGIN</small></a>
  <nav aria-label="主导航"><a href="./index.html"{home_current}>首页</a><a href="./archive.html"{archive_current}>归档</a><a class="write-link" href="./write.html"{write_current}>写文章</a></nav>
</header>
<main id="main" class="wrap">{main}</main>
<footer class="footer wrap"><a href="./index.html">纸间 <span>PAPER MARGIN</span></a><span>随笔与技术笔记</span></footer>
</body>
</html>
"""


def tag(post):
    sample = '<span class="sample">示例文章</span>' if post.get("sample") == "true" else ""
    return f'<span class="category {post["category"]}">{CATEGORIES[post["category"]]}</span>{sample}'


def post_row(post):
    return f"""
<li class="post-row" data-category="{post['category']}">
  <time datetime="{post['date']}">{post['date']:%m.%d}<small>{post['date']:%Y}</small></time>
  <div class="post-info"><div class="tags">{tag(post)}</div>
    <h3><a href="{post['url']}">{escape(post['title'])}</a></h3>
    <p>{escape(post['summary'])}</p>
  </div>
  <span class="row-arrow" aria-hidden="true">↗</span>
</li>"""


def home(posts):
    rows = "".join(map(post_row, posts))
    return layout("纸间 · 随笔与技术笔记", "一个收录随笔与技术笔记的个人写作站。", f"""
<section class="intro" aria-labelledby="intro-title">
  <div class="intro-copy">
    <p class="eyebrow"><span></span> 随笔与技术笔记</p>
    <h1 id="intro-title">纸间<span>。</span></h1>
    <p class="lead">写一点日常，也写一点技术。</p>
    <a class="intro-link" href="#recent">浏览文章 <span aria-hidden="true">↓</span></a>
  </div>
  <figure class="hero-art"><img src="./assets/paper.svg" alt="墨绿格纸上的折角信笺，画着枝叶，盖有朱红色印章" width="560" height="388"></figure>
</section>
<section id="recent" class="recent" aria-labelledby="recent-title">
  <div class="section-head">
    <div><p class="eyebrow">THE JOURNAL</p><h2 id="recent-title">最近更新</h2></div>
    <a class="text-link" href="./archive.html">查看归档 <span aria-hidden="true">↗</span></a>
  </div>
  <div class="filters" role="group" aria-label="筛选文章分类" hidden>
    <button type="button" aria-pressed="true" data-filter="all">全部</button>
    <button type="button" aria-pressed="false" data-filter="essay">随笔</button>
    <button type="button" aria-pressed="false" data-filter="tech">技术笔记</button>
  </div>
  <p class="sr-only" role="status" id="result-count"></p>
  <ul class="post-list">{rows}</ul>
  <p id="empty" hidden>这个分类暂时没有文章。</p>
</section>""", "home")


def archive(posts):
    sections = []
    for year, entries in groupby(posts, key=lambda post: post["date"].year):
        rows = "".join(map(post_row, entries))
        sections.append(f'<section class="year"><h2>{year}</h2><ul class="post-list">{rows}</ul></section>')
    return layout("归档 · 纸间", "按年份浏览纸间的随笔与技术笔记。", f"""
<div class="page-heading"><p class="eyebrow">THE ARCHIVE</p><h1>归档</h1>
<p>按年份查找文章，共 {len(posts)} 篇。</p></div>
{"".join(sections)}""", "archive")


def article(post):
    return layout(f"{post['title']} · 纸间", post["summary"], f"""
<article class="reading">
  <a class="text-link back" href="./index.html#recent"><span aria-hidden="true">←</span> 返回文章列表</a>
  <header class="article-head"><div class="tags">{tag(post)}</div>
    <h1>{escape(post['title'])}</h1>
    <time datetime="{post['date']}">{post['date']:%Y.%m.%d}</time>
    <p>{escape(post['summary'])}</p>
  </header>
  <div class="prose">{post['body']}</div>
  <a class="text-link article-end" href="./archive.html">查看全部归档 <span aria-hidden="true">↗</span></a>
</article>""")


def main():
    posts = sorted(
        map(read_post, sorted((ROOT / "content").glob("*.md"))),
        key=lambda post: post["date"],
        reverse=True,
    )
    copytree(ROOT / "assets", DIST / "assets", dirs_exist_ok=True)
    (DIST / "index.html").write_text(home(posts), encoding="utf-8")
    (DIST / "archive.html").write_text(archive(posts), encoding="utf-8")
    for post in posts:
        (DIST / post["url"]).write_text(article(post), encoding="utf-8")
    editor = (ROOT / "editor" / "write.html").read_text(encoding="utf-8")
    published_options = []
    for post in posts:
        title = post["title"] + ("（示例）" if post.get("sample") == "true" else "")
        label = f'{post["date"].isoformat()} · {title}'
        published_options.append(f'<option value="{escape(post["filename"])}">{escape(label)}</option>')
    editor = editor.replace("<!-- PUBLISHED_POST_OPTIONS -->", "\n".join(published_options))
    repository = escape(os.environ.get("GITHUB_REPOSITORY", ""))
    branch = escape(os.environ.get("GITHUB_REF_NAME", "main"))
    config = f'<div id="pages-config" data-repository="{repository}" data-branch="{branch}" hidden></div>'
    (DIST / "write.html").write_text(layout("写文章 · 纸间", "在浏览器写 Markdown", config + editor, "write"), encoding="utf-8")
    (DIST / ".nojekyll").touch()
    # A rebuild should remove any pages whose Markdown sources were removed.
    live_pages = {"index.html", "archive.html", "write.html", *(post["url"][2:] for post in posts)}
    for old in DIST.glob("*.html"):
        if old.name not in live_pages:
            old.unlink()
    print(f"Built {len(posts)} posts and 2 index pages.")


if __name__ == "__main__":
    main()
