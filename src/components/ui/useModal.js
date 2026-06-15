import { useState, useCallback } from 'react';

/**
 * Hook de commodité pour gérer l'état ouvert/fermé d'un Modal.
 *
 * Usage:
 *   const { isOpen, open, close } = useModal();
 *   const deleteModal = useModal();
 *
 *   <Button onClick={deleteModal.open}>Supprimer</Button>
 *   <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close} ... />
 */
function useModal(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const open   = useCallback(() => setIsOpen(true),  []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);
  return { isOpen, open, close, toggle };
}

export default useModal;
