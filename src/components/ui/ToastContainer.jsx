import { createPortal } from 'react-dom';
import { useToastStore } from '../../store/useToastStore';

const TYPE_STYLES = {
  success: {
    background:  '#f0fdf4',
    border:      '1px solid #86efac',
    borderLeft:  '4px solid #16a34a',
    icon:        '✓',
    iconColor:   '#16a34a',
    textColor:   '#14532d',
  },
  error: {
    background:  '#fef2f2',
    border:      '1px solid #fca5a5',
    borderLeft:  '4px solid #dc2626',
    icon:        '✕',
    iconColor:   '#dc2626',
    textColor:   '#7f1d1d',
  },
  warning: {
    background:  '#fffbeb',
    border:      '1px solid #fcd34d',
    borderLeft:  '4px solid #d97706',
    icon:        '!',
    iconColor:   '#d97706',
    textColor:   '#78350f',
  },
  info: {
    background:  '#eff6ff',
    border:      '1px solid #93c5fd',
    borderLeft:  '4px solid #2563eb',
    icon:        'i',
    iconColor:   '#2563eb',
    textColor:   '#1e3a8a',
  },
};

function ToastItem({ id, message, type }) {
  const remove = useToastStore(s => s._remove);
  const s = TYPE_STYLES[type] || TYPE_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display:        'flex',
        alignItems:     'flex-start',
        gap:            10,
        background:     s.background,
        border:         s.border,
        borderLeft:     s.borderLeft,
        borderRadius:   6,
        padding:        '12px 14px',
        boxShadow:      '0 4px 12px rgba(0,0,0,0.12)',
        minWidth:       260,
        maxWidth:       380,
        animation:      'dz-toast-in 0.2s ease',
      }}
    >
      {/* Icône */}
      <span style={{
        flexShrink:      0,
        width:           20,
        height:          20,
        borderRadius:    '50%',
        backgroundColor: s.iconColor,
        color:           'white',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        11,
        fontWeight:      900,
        marginTop:       1,
      }}>
        {s.icon}
      </span>

      {/* Message */}
      <span style={{
        flex:       1,
        fontSize:   13,
        fontWeight: 500,
        color:      s.textColor,
        lineHeight: 1.45,
      }}>
        {message}
      </span>

      {/* Fermer */}
      <button
        onClick={() => remove(id)}
        aria-label="Fermer la notification"
        style={{
          flexShrink:  0,
          background:  'none',
          border:      'none',
          cursor:      'pointer',
          color:       s.iconColor,
          fontSize:    18,
          lineHeight:  1,
          padding:     '0 2px',
          opacity:     0.6,
        }}
      >
        ×
      </button>
    </div>
  );
}

function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);

  return createPortal(
    <>
      <style>{`
        @keyframes dz-toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes dz-toast-in { from { opacity: 0; } to { opacity: 1; } }
        }
      `}</style>
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position:        'fixed',
          bottom:          24,
          right:           24,
          zIndex:          9999,
          display:         'flex',
          flexDirection:   'column',
          gap:             10,
          pointerEvents:   'none',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem id={t.id} message={t.message} type={t.type} />
          </div>
        ))}
      </div>
    </>,
    document.body
  );
}

export default ToastContainer;
