const tones = new Set(['sun', 'cyan', 'coral', 'pink', 'mint', 'lavender']);

export default function PopCard({ as: Element = 'section', tone = 'plain', className = '', children, ...props }) {
  const safeTone = tones.has(tone) ? tone : 'plain';

  return (
    <Element className={`admin-pop-card admin-pop-card--${safeTone} ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
}
