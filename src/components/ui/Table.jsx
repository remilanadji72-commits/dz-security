import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Table — wraps les classes .table du design system.
 * Pattern render-prop : le parent contrôle le rendu de chaque ligne.
 *
 * Props:
 *   headers      : string[] | ReactNode[] — en-têtes de colonnes
 *   data         : any[]                 — tableau de données
 *   renderRow    : (row, index) => <tr>  — render prop pour chaque ligne
 *   size         : undefined | 'sm' | 'xs'
 *   emptyMessage : string | ReactNode    — texte quand data est vide
 *   colSpan      : number                — colspan de la ligne vide (défaut = headers.length)
 *   stickyHeader : boolean               — thead sticky lors du scroll
 *   className    : string
 */
function Table({
  headers = [],
  data,
  renderRow,
  size,
  emptyMessage,
  colSpan,
  stickyHeader = false,
  className = '',
}) {
  const { t } = useTranslation();

  const cls = ['table', size ? `table-${size}` : '', className]
    .filter(Boolean).join(' ');

  const isEmpty = !data || data.length === 0;
  const spanCount = colSpan ?? headers.length;
  const empty = emptyMessage ?? t('common.no_data');

  const theadStyle = stickyHeader
    ? { position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }
    : undefined;

  return (
    <table className={cls}>
      <thead style={theadStyle}>
        <tr>
          {headers.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isEmpty ? (
          <tr>
            <td colSpan={spanCount} className="empty-state">
              {empty}
            </td>
          </tr>
        ) : (
          data.map((row, i) => renderRow(row, i))
        )}
      </tbody>
    </table>
  );
}

export default Table;
