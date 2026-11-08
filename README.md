# 纸间 · GitHub Pages 版

这是独立的静态博客，首页、归档、阅读和写作页都由 GitHub Pages 提供。示例内容在 content/。当前项目默认计划部署到 DechuangYang/paper-margin。

## 本地运行

    python -m pip install -r requirements.txt
    npm.cmd ci
    $env:GITHUB_REPOSITORY = 'DechuangYang/paper-margin'
    npm.cmd run build
    python -c "import mimetypes, runpy; mimetypes.add_type('image/svg+xml', '.svg'); runpy.run_module('http.server', run_name='__main__')" 8765 --bind 127.0.0.1 --directory dist

在浏览器打开 http://127.0.0.1:8765/。构建生成的页面也能部署到 GitHub Pages 项目子路径。

## 发布网站

1. 在自己的 GitHub 账号下创建公开仓库 paper-margin。
2. 在仓库 Settings → Pages 中，将 Build and deployment 的 Source 设为 GitHub Actions。
3. 将本项目推送到 main 分支。在 Actions 里打开 Publish Paper Margin 工作流检查状态。如果第一次推送发生在配置 Pages 之前，可从 Actions 手动运行工作流。
4. 构建成功后，在 Pages 设置页查看实际网址。

## 网页写文章

点「写文章」，填写标题、分类、可选摘要和 Markdown 正文。复制截图，在正文中直接粘贴，再点「预览」。草稿和草稿图片保存在当前浏览器，使用同一个网站地址和浏览器才能重新打开。

发布时打开「发布到 GitHub」，在 GitHub 创建细粒度令牌，资源所有者选自己的账号，Repository access 只选这个仓库，仓库权限 Contents 设为 Read and write。使用短有效期。令牌只在发布请求中发送给 GitHub API，编辑器不保存它。

发布把 Markdown 和正文引用的本机图片合成一次提交。Actions 构建成功后，文章会出现在首页和归档。也可以直接把 Markdown 放入 content/，把图片放入 assets/，然后提交到 main。

新版包含源码内的示例。原 Sites 版数据库中的文章、草稿和上传图片需要按所选内容单独导出，公开部署只应提交准备公开的文章和图片。

MIT 许可适用于项目代码。自行添加的文章和图片保留其原有权利。
