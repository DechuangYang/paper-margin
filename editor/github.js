const apiOrigin = "https://api.github.com";

export function githubClient(repository, token) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token.startsWith("github_pat_")) {
    throw new Error("请填写此仓库的 GitHub 细粒度访问令牌。");
  }
  return async (step, path, method = "GET", body) => {
    const response = await fetch(apiOrigin + "/repos/" + repository + path, {
      method,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const hints = {
        401: "GitHub 无法验证令牌。请检查是否复制完整，以及令牌是否已过期或被撤销。",
        403: "GitHub 拒绝了该操作。请核对令牌已选中 paper-margin，且 Contents 为 Read and write。",
        404: "GitHub 找不到目标资源，或该令牌无权访问。请核对令牌的资源所有者和仓库范围。",
        409: "仓库状态已变化，请稍后重试。",
        422: "GitHub 未接受此次提交。请检查分支是否有保护规则，或稍后重试。",
      };
      const hint = hints[response.status] ?? "请稍后重试。";
      throw new Error(step + "失败（GitHub HTTP " + response.status + "）。" + hint);
    }
    return response.json();
  };
}

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = [];
  for (let start = 0; start < bytes.length; start += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 8192)));
  }
  return btoa(chunks.join(""));
}

export async function publishArticle(api, branch, path, markdown, files) {
  const branchRef = "heads/" + encodeURIComponent(branch);
  const ref = await api("读取发布分支", "/git/ref/" + branchRef);
  const head = ref.object.sha;
  const current = await api("读取当前提交", "/git/commits/" + head);
  const tree = [{ path, content: markdown, mode: "100644", type: "blob" }];
  for (const file of files) {
    const blob = await api("上传正文图片", "/git/blobs", "POST", { content: await base64(file.blob), encoding: "base64" });
    tree.push({ path: file.path, sha: blob.sha, mode: "100644", type: "blob" });
  }
  const next = await api("写入文章和图片", "/git/trees", "POST", { base_tree: current.tree.sha, tree });
  if (next.sha === current.tree.sha) return head;
  const commit = await api("创建文章提交", "/git/commits", "POST", {
    message: "Publish blog post",
    tree: next.sha,
    parents: [head],
  });
  // GitHub refuses to overwrite a branch that moved during the upload.
  await api("更新发布分支", "/git/refs/" + branchRef, "PATCH", { sha: commit.sha, force: false });
  return commit.sha;
}
export async function deleteArticle(api, branch, filename) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) {
    throw new Error("请选择一篇已发布文章。");
  }
  const path = "/contents/content/" + encodeURIComponent(filename);
  const file = await api("读取待删除文章", path + "?ref=" + encodeURIComponent(branch));
  if (file.type !== "file" || file.path !== "content/" + filename || !file.sha) {
    throw new Error("无法确认要删除的文章，请刷新后重试。");
  }
  await api("删除文章", path, "DELETE", {
    message: "Unpublish blog post",
    sha: file.sha,
    branch,
  });
}
