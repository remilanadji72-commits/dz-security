import React from 'react';

/**
 * Card — wraps les classes .card du design system.
 *
 * Props:
 *   title    : string — affiche un <h3> en en-tête
 *   variant  : undefined | 'blue' | 'red' | 'green' | 'dark' | 'yellow'
 *              Ajoute une bordure colorée en haut (border-top)
 *   action   : ReactNode — bouton/lien affiché à droite du titre
 *   padding  : 'normal' (défaut) | 'none' — désactive le padding interne
 */
function Card({
  children,
  title,
  variant,
  action,
  padding = 'normal',
  style,
  className = '',
}) {
  const cls = [
    'card',
    variant ? `card-${variant}` : '',
    className,
  ].filter(Boolean).join(' ');

  const bodyStyle = padding === 'none' ? { padding: 0 } : undefined;

  return (
    <div className={cls} style={style}>
      {(title || action) && (
        <div className="flex-between mb-15">
          {title && <h3 className="section-title">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}

export default Card;
