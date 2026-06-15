import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../components/ui/Button';

describe('Button', () => {
  it('affiche les enfants', () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByText('Enregistrer')).toBeInTheDocument();
  });

  it('appelle onClick au clic', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Cliquer</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('est désactivé quand disabled=true', () => {
    render(<Button disabled>Bloqué</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('ne déclenche pas onClick quand disabled', () => {
    const handler = vi.fn();
    render(<Button onClick={handler} disabled>Bloqué</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('affiche le spinner ⏳ quand loading=true', () => {
    render(<Button loading>Envoi</Button>);
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });

  it('est désactivé quand loading=true', () => {
    render(<Button loading>Envoi</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applique la classe btn-danger avec variant="danger"', () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });

  it('applique la classe btn-sm avec size="sm"', () => {
    render(<Button size="sm">Petit</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');
  });

  it('a toujours la classe btn', () => {
    render(<Button>Base</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn');
  });

  it('type par défaut est "button"', () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('type="submit" est transmis', () => {
    render(<Button type="submit">Valider</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('affiche l\'icône quand icon est fourni et loading=false', () => {
    render(<Button icon="📎">Joindre</Button>);
    expect(screen.getByText('📎')).toBeInTheDocument();
  });

  it('n\'affiche pas l\'icône quand loading=true', () => {
    render(<Button icon="📎" loading>Joindre</Button>);
    expect(screen.queryByText('📎')).not.toBeInTheDocument();
  });
});
