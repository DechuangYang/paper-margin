# 纸间 GitHub Pages 实现计划

使用静态 HTML 继续提供首页、分类筛选和归档。网页编辑器负责 Markdown 预览、剪贴板图片和保存在当前浏览器的草稿。发布时通过 GitHub REST API 把 Markdown 和图片放入同一个 Git 提交，由 GitHub Actions 构建 Pages。验证路径前缀、草稿恢复和发布提交的一致性。
