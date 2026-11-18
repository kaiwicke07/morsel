const P: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  camera: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  barcode: 'M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12',
  label: 'M6 3.5h12v17H6zM9 7.5h6M9 11h6M9 14.5h4',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  bookmark: 'M7 4h10v16l-5-3.5L7 20z',
  run: 'M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM7 21l3-5.5 3 2.5v4M10 15.5l1.5-6L8 11v3M11.5 9.5l3 2.5 3-.5',
  lift: 'M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  today: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 9.5h16M8.5 2.5v3M15.5 2.5v3',
  chart: 'M4 20h16M7 16.5V11M12 16.5V6M17 16.5v-3.5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2 1.2L14.8 21h-4l-.3-2.4a7 7 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.4L4.6 9.9l2-3.4 1.9.7a7 7 0 0 1 2-1.2L10.8 3h4l.3 2.4a7 7 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.4z',
  drop: 'M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  image: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM4 16l4.5-4.5L13 16l2.5-2.5L20 18M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  flash: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  scale: 'M5 20h14M12 4v16M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0zM6 8h12',
  photo: 'M4 7h3l1.5-2h7L17 7h3v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  type: 'M5 6h14M12 6v13M9 19h6',
  key: 'M14.5 9.5a4 4 0 1 0-4 4M10.5 13.5L4 20M6.5 17.5l2 2M14.5 9.5h.01',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14',
  heart: 'M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z',
  medal: 'M8 3h8l-2 6h-4zM12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 12.5v5',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  refresh: 'M19 12a7 7 0 1 1-2.1-5M19 4v4h-4',
};

export function Icon({ name, size = 22, stroke = 1.8, className }: { name: keyof typeof P | string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'dots' ? 3.2 : stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={P[name] || ''} />
    </svg>
  );
}
