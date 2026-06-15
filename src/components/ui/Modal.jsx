import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Button from './Button';

/**
 * Modal — portal rendu dans document.body, z-index 1000.
 *
 * Props:
 *   isOpen        : boolean
 *   onClose       : () => void
 *   title         : string
 *   size          : 'sm' | 'md' | 'lg' (défaut: 'md')
 *   children      : ReactNode — corps du modal
 *   footer        : ReactNode — footer personnalisé (remplace le footer par défaut)
 *   confirmLabel  : string — si défini, affiche boutons Confirmer + Annuler
 *   onConfirm     : () => void
 *   confirmVariant: variant du bouton de confirmation (défaut: 'primary')
 *   cancelLabel   : string — libellé du bouton Annuler
 *   hideClose     : boolean — masque le ✖ dans l'en-tête
 *   danger        : boolean — raccourci pour confirmVariant='danger'
 */
function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  confirmLabel,
  onConfirm,
  confirmVariant,
  cancelLabel,
  hideClose = false,
  danger = false,
}) {
  const { t } = useTranslation();

  const resolvedVariant = confirmVariant ?? (danger ? 'danger' : 'primary');

  // Fermeture sur Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Bloquer le scroll du body
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const showFooter = footer || confirmLabel;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-container modal-${size}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          {!hideClose && (
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Fermer"
            >
              ✖
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body">{children}</div>

        {/* Footer */}
        {showFooter && (
          <div className="modal-footer">
            {footer ?? (
              <>
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {cancelLabel || t('common.cancel')}
                </Button>
                <Button variant={resolvedVariant} size="sm" onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
