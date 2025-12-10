export function formatDateDisplay(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatPrice(min?: number, max?: number): string {
  if (!min && !max) return "";

  const formatNumber = (n: number) => {
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1)}tr`;
    }
    if (n >= 1000) {
      return `${Math.round(n / 1000)}k`;
    }
    return n.toString();
  };

  if (min && max) {
    return `${formatNumber(min)} - ${formatNumber(max)}`;
  }
  if (min) {
    return `Từ ${formatNumber(min)}`;
  }
  if (max) {
    return `Đến ${formatNumber(max)}`;
  }
  return "";
}

export function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
}
