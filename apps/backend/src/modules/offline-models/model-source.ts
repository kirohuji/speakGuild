/** Keep metadata and pinned file downloads on the same configured Hugging Face source. */
export function modelSourceEndpoint(): string {
  const endpoint = new URL(process.env.HF_ENDPOINT?.trim() || 'https://hf-mirror.com');
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('HF_ENDPOINT 必须是无账号、查询参数的 HTTPS 下载源地址');
  }
  return endpoint.href.replace(/\/+$/, '');
}
