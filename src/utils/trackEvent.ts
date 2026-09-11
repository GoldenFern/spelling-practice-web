/**
 * 本项目定制：上游使用 Vercel Analytics / gtag 上报，离线或国内网络下会挂起请求。
 * 保留函数签名，不再发送数据。
 */
export const trackPromotionEvent = (_event: string, _properties: Record<string, string>) => {
  // no-op
}
