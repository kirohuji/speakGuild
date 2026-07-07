/**
 * 确保 **用法提示：** 前有换行，避免粘连。
 */
export function extractCoreUsage(md: string): string {
  return md.replace(/\*\*用法提示：\*\*/g, '\n\n**用法提示：** \n')
}