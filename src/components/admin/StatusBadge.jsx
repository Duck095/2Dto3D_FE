const tones = new Set(['neutral', 'success', 'warning', 'danger', 'info']);

export default function StatusBadge({ tone = 'neutral', className = '', children, ...props }) {
  const safeTone = tones.has(tone) ? tone : 'neutral';

  return (
    <span className={`admin-status-badge admin-status-badge--${safeTone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
