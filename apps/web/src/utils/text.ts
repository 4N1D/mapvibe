/**
 * Strip HTML tags from a string, returning plain text
 */
export function stripHtml(html: string): string {
  if (typeof window !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}
