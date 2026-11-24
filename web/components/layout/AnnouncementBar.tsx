import { siteConfig } from "@/config/site";

export function AnnouncementBar() {
  const items = siteConfig.announcements.filter((a) => a.enabled);
  if (!items.length) return null;
  return (
    <div className="bg-gold text-[#17110a]">
      <p className="az-container flex min-h-8 items-center justify-center gap-2.5 py-1.5 text-center text-[0.6rem] font-extrabold tracking-[0.2em] uppercase sm:text-[0.625rem]">
        {items.map((item, i) => (
          // One message on very small phones, two on phones, all from tablet up — keeps the bar on a single line.
          <span key={item.id} className={i === 0 ? "whitespace-nowrap" : i === 1 ? "hidden whitespace-nowrap min-[380px]:inline" : "hidden whitespace-nowrap sm:inline"}>
            {i > 0 && <span className="mr-2.5 opacity-60" aria-hidden="true">/</span>}
            {item.label}
          </span>
        ))}
      </p>
    </div>
  );
}
