import React from 'react';

/**
 * Button — wraps les classes .btn du design system.
 *
 * Props:
 *   variant  : 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'dark'
 *   size     : undefined | 'sm' | 'xs' | 'full'
 *   loading  : boolean — désactive + affiche spinner
 *   type     : 'button' | 'submit' | 'reset'
 *   icon     : string | ReactNode — placé avant children
 */
function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size,
  disabled = false,
  loading = false,
  icon,
  className = '',
  style,
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size ? `btn-${size}` : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cls}
      style={style}
    >
      {loading && <span style={{ marginInlineEnd: '6px' }}>⏳</span>}
      {!loading && icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

export default Button;
