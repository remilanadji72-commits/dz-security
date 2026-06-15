import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../../components/ui/Badge';

describe('Badge', () => {
  it('affiche le texte du badge', () => {
    render(<Badge>ACTIF</Badge>);
    expect(screen.getByText('ACTIF')).toBeInTheDocument();
  });

  it('a la classe badge par défaut (taille normale)', () => {
    render(<Badge>test</Badge>);
    expect(screen.getByText('test')).toHaveClass('badge');
  });

  it('a la classe badge-xs avec size="xs"', () => {
    render(<Badge size="xs">mini</Badge>);
    expect(screen.getByText('mini')).toHaveClass('badge-xs');
  });

  it('n\'a pas badge quand size="xs"', () => {
    render(<Badge size="xs">mini</Badge>);
    expect(screen.getByText('mini')).not.toHaveClass('badge');
  });

  it('applique badge-success avec variant="success"', () => {
    render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK')).toHaveClass('badge-success');
  });

  it('applique badge-danger avec variant="danger"', () => {
    render(<Badge variant="danger">KO</Badge>);
    expect(screen.getByText('KO')).toHaveClass('badge-danger');
  });

  it('applique badge-neutral par défaut (variant omis)', () => {
    render(<Badge>neutre</Badge>);
    expect(screen.getByText('neutre')).toHaveClass('badge-neutral');
  });

  it('rend un élément <span>', () => {
    render(<Badge>span</Badge>);
    expect(screen.getByText('span').tagName).toBe('SPAN');
  });
});
