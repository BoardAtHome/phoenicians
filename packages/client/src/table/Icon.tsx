// Stroke icons from the UI mockup (24×24, currentColor).
const PATHS = {
  buildingMaterials: '<rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1"/><path d="M12 5v6M8 13v6M16 13v6"/>',
  warriors: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
  grain: '<path d="M12 21V7"/><path d="M12 9c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.5 4.5 3.5zM12 9c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.5-4.5 3.5zM12 14c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.5 4.5 3.5zM12 14c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.5-4.5 3.5zM12 19c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.5 4.5 3.5zM12 19c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.5-4.5 3.5z"/>',
  purpleDye: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  civic: '<path d="M3 21h18M4 10h16M12 3l9 5H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  military: '<path d="M5 21V8h3V5h3v3h2V5h3v3h3v13z"/><path d="M10 21v-5h4v5"/>',
  agricultural: '<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 5 6c0 4 3 6 7 6zM12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  commercial: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  curse: '<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ritual: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1.5 1 2 2 2 3 0-3 0-5 1-7z"/>',
  attack: '<path d="M4 4l10 10M20 4L10 14M6 14l4 4M18 14l-4 4M7 17l-3 3M17 17l3 3"/>',
  ship: '<path d="M3 17l2 4h14l2-4z"/><path d="M12 3v14M12 4l6 9h-6"/>',
  shop: '<path d="M3 9l2-5h14l2 5z"/><path d="M5 9v11h14V9M10 20v-5h4v5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.6M12 17h.01"/>',
  cards: '<rect x="6" y="3" width="13" height="17" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h9"/>',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
