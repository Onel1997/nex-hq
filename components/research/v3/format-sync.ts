import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export function formatRelativeSync(
  iso: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!iso) return "—";
  const sync = getDictionary(locale).research.studio.sync;
  try {
    const then = new Date(iso).getTime();
    const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diffSec < 10) return sync.justNow;
    if (diffSec < 60) {
      return sync.secondsAgo.replace("{count}", String(diffSec));
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return sync.minutesAgo.replace("{count}", String(diffMin));
    }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
      return sync.hoursAgo.replace("{count}", String(diffHr));
    }
    const diffDay = Math.floor(diffHr / 24);
    return sync.daysAgo.replace("{count}", String(diffDay));
  } catch {
    return "—";
  }
}
