import React from 'react';

/**
 * Badge — wraps les classes .badge du design system.
 *
 * Props:
 *   variant : 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'dark'
 *   size    : undefined | 'xs'
 */
function Badge({ children, variant = 'neutral', size, style, className = '' }) {
  const cls = [
    size === 'xs' ? 'badge-xs' : 'badge',
    `badge-${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

export default Badge;
