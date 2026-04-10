let mermaidApi: typeof import('mermaid').default | null = null;

async function getMermaid() {
  if (!mermaidApi) {
    const mod = await import('mermaid');
    mermaidApi = mod.default;
  }
  return mermaidApi;
}

let renderCounter = 0;

/**
 * 将 Mermaid 源码渲染为 SVG（与 Typora / GitHub 等一致：客户端 mermaid API）。
 */
export async function renderMermaidToSvg(
  code: string,
  theme: 'default' | 'dark',
): Promise<{ svg: string } | { error: string }> {
  const trimmed = code.trim();
  const mermaid = await getMermaid();
  const id = `zq-mermaid-${++renderCounter}-${Date.now()}`;
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel: 'strict',
  });
  try {
    const { svg } = await mermaid.render(id, trimmed);
    return { svg };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
