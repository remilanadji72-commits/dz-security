import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useModal from '../../components/ui/useModal';

describe('useModal', () => {
  it('est fermé par défaut', () => {
    const { result } = renderHook(() => useModal());
    expect(result.current.isOpen).toBe(false);
  });

  it('open() ouvre le modal', () => {
    const { result } = renderHook(() => useModal());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it('close() ferme le modal', () => {
    const { result } = renderHook(() => useModal(true));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle() inverse l\'état — false → true', () => {
    const { result } = renderHook(() => useModal());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });

  it('toggle() inverse l\'état — true → false', () => {
    const { result } = renderHook(() => useModal(true));
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('initialOpen=true démarre ouvert', () => {
    const { result } = renderHook(() => useModal(true));
    expect(result.current.isOpen).toBe(true);
  });

  it('expose open, close et toggle', () => {
    const { result } = renderHook(() => useModal());
    expect(typeof result.current.open).toBe('function');
    expect(typeof result.current.close).toBe('function');
    expect(typeof result.current.toggle).toBe('function');
  });
});
