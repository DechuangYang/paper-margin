const apiOrigin = "https://api.github.com";

export function githubClient(repository, token) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token.startsWith("github_pat_")) {
    throw new Error("请填写此仓库的 GitHub 细粒度访问令牌。");
  }
  return async (path, method = "GET", body) => {
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
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("无法访问目标仓库。请确认令牌未过期，且对此仓库有 Contents 读写权限。");
    }
    if (!response.ok) {
      throw new Error("GitHub 没有接受提交（" + response.status + "）。草稿仍保存在当前浏览器，可以稍后重试。");
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
  const refPath = "/git/refs/heads/" + encodeURIComponent(branch);
  const ref = await api(refPath);
  const head = ref.object.sha;
  const current = await api("/git/commits/" + head);
  const tree = [{ path, content: markdown, mode: "100644", type: "blob" }];
  for (const file of files) {
    const blob = await api("/git/blobs", "POST", { content: await base64(file.blob), encoding: "base64" });
    tree.push({ path: file.path, sha: blob.sha, mode: "100644", type: "blob" });
  }
  const next = await api("/git/trees", "POST", { base_tree: current.tree.sha, tree });
  if (next.sha === current.tree.sha) return head;
  const commit = await api("/git/commits", "POST", {
    message: "Publish blog post",
    tree: next.sha,
    parents: [head],
  });
  // GitHub refuses to overwrite a branch that moved during the upload.
  await api(refPath, "PATCH", { sha: commit.sha, force: false });
  return commit.sha;
}
