import React from 'react';
import { Plus, Table, Trash2 } from 'lucide-react';
import { getSpreadsheetColumnLabel } from '../productForm.helpers';

const TableSizePicker = ({
  tableIndex,
  tableConfig,
  tablePickerPreview,
  clearTablePickerPreview,
  updateTablePickerPreview,
  resizeTable,
  pickerKeyPrefix = 'picker'
}) => {
  const rowCount = tableConfig.modelTable.rows.length;
  const columnCount = tableConfig.modelTable.headers.length;
  const preview = tablePickerPreview[tableIndex] || {
    rows: rowCount,
    columns: columnCount
  };

  return (
    <div
      className="table-size-picker"
      onMouseLeave={() => clearTablePickerPreview(tableIndex, rowCount, columnCount)}
    >
      <span className="table-size-picker__label">Criar grade visual</span>
      <div className="table-size-picker__grid">
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          Array.from({ length: 8 }).map((__, columnIndex) => {
            const isActive = rowIndex < preview.rows && columnIndex < preview.columns;

            return (
              <button
                key={`${pickerKeyPrefix}-${tableIndex}-${rowIndex}-${columnIndex}`}
                type="button"
                className={`table-size-picker__cell ${isActive ? 'is-active' : ''}`}
                onMouseEnter={() => updateTablePickerPreview(tableIndex, rowIndex + 1, columnIndex + 1)}
                onFocus={() => updateTablePickerPreview(tableIndex, rowIndex + 1, columnIndex + 1)}
                onClick={() => resizeTable(tableIndex, rowIndex + 1, columnIndex + 1)}
                aria-label={`Criar tabela ${rowIndex + 1} por ${columnIndex + 1}`}
              />
            );
          })
        ))}
      </div>
      <span className="table-size-picker__summary">
        {(tablePickerPreview[tableIndex]?.rows || rowCount)} x {(tablePickerPreview[tableIndex]?.columns || columnCount)}
      </span>
    </div>
  );
};

const TableGrid = ({
  tableIndex,
  tableConfig,
  renderBuilderCells,
  addTableHeader,
  addTableRow,
  removeTableRow
}) => (
  <div className="table-builder-scroll-wrapper">
    <table className="builder-table" style={{ '--table-column-count': tableConfig.modelTable.headers.length }}>
      <colgroup>
        <col className="builder-table__col-number" />
        {tableConfig.modelTable.headers.map((_, headerIndex) => (
          <col key={`col-${tableIndex}-${headerIndex}`} className="builder-table__col-data" />
        ))}
        <col className="builder-table__col-action" />
      </colgroup>

      <thead>
        <tr className="builder-table__sheet-row builder-table__sheet-row--labels">
          <th className="builder-table__corner-cell" aria-hidden="true" />
          {tableConfig.modelTable.headers.map((_, headerIndex) => (
            <th key={`sheet-label-${tableIndex}-${headerIndex}`} className="builder-table__sheet-label">
              {getSpreadsheetColumnLabel(headerIndex)}
            </th>
          ))}
          <th className="table-action-spacer table-action-spacer--adder">
            <button
              type="button"
              className="table-grid-plus"
              onClick={() => addTableHeader(tableIndex)}
              aria-label={tableIndex === 0 ? 'Adicionar coluna' : `Adicionar coluna na tabela ${tableIndex + 1}`}
            >
              <Plus size={14} />
            </button>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr>
          <td className="builder-table__row-number">1</td>
          {renderBuilderCells({
            tableIndex,
            rowNumber: 1,
            values: tableConfig.modelTable.headers,
            isHeaderRow: true
          })}
          <td className="table-action-cell table-action-cell--adder">
            <button
              type="button"
              className="table-grid-plus"
              onClick={() => addTableRow(tableIndex)}
              aria-label={tableIndex === 0 ? 'Adicionar linha' : `Adicionar linha na tabela ${tableIndex + 1}`}
            >
              <Plus size={14} />
            </button>
          </td>
        </tr>

        {tableConfig.modelTable.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <td className="builder-table__row-number">{rowIndex + 2}</td>
            {renderBuilderCells({
              tableIndex,
              rowNumber: rowIndex + 2,
              values: row
            })}
            <td className="table-action-cell">
              <button type="button" className="btn-icon delete" onClick={() => removeTableRow(tableIndex, rowIndex)}>
                <Trash2 size={16} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TechnicalTablesSection = ({
  formData,
  setFormData,
  isTableSizeOpen,
  setIsTableSizeOpen,
  tablePickerPreview,
  clearTablePickerPreview,
  updateTablePickerPreview,
  resizeTable,
  addTableHeader,
  addTableRow,
  removeTableRow,
  renderBuilderCells,
  renderSelectionActions,
  updateTechnicalTableTitle,
  addTechnicalTable,
  removeTechnicalTable
}) => {
  const mainTableConfig = formData.modelTables[0];

  if (!mainTableConfig) {
    return null;
  }

  return (
    <div className="admin-section-group">
      <span className="section-label">5. Configuração da Tabela</span>

      <div className="table-title-group table-title-group--split">
        <div className="form-group">
          <label>Nome da aba técnica</label>
          <input
            value={formData.technicalTabLabel}
            placeholder="Ex.: Informação Técnica, Técnico, Especificações"
            onChange={(e) => setFormData((current) => ({ ...current, technicalTabLabel: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label>Título da Tabela</label>
          <p className="product-form-helper">
            Defina o nome que será exibido acima da tabela técnica do produto.
          </p>
          <input
            value={mainTableConfig.title || ''}
            placeholder="Ex.: Tabela Técnica / Modelos Disponíveis"
            onChange={(e) => updateTechnicalTableTitle(0, e.target.value)}
          />
        </div>
      </div>

      <div
        className={[
          'table-builder-container',
          isTableSizeOpen ? 'table-builder-container--size-open' : ''
        ].filter(Boolean).join(' ')}
      >
        <div className="table-builder-toolbar">
          <div className="table-builder-toolbar-copy">
            <span className="table-builder-kicker">Configuração da tabela</span>
            <h4>Organize colunas e linhas com mais clareza</h4>
            <p>Cadastre os títulos principais e preencha as informações técnicas que serão exibidas no site.</p>
          </div>

          <div className="table-builder-toolbar-actions">
            <div className="table-config-icon-dropdown">
              <button
                type="button"
                className={`table-config-icon-trigger ${isTableSizeOpen ? 'is-active' : ''}`}
                onClick={() => setIsTableSizeOpen((current) => !current)}
                title="Ajustar Tamanho da Grade"
              >
                <Table size={20} />
              </button>

              {isTableSizeOpen && (
                <div className="multi-select-options table-config-dropdown-panel">
                  <TableSizePicker
                    tableIndex={0}
                    tableConfig={mainTableConfig}
                    tablePickerPreview={tablePickerPreview}
                    clearTablePickerPreview={clearTablePickerPreview}
                    updateTablePickerPreview={updateTablePickerPreview}
                    resizeTable={resizeTable}
                    pickerKeyPrefix="picker-main"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <TableGrid
          tableIndex={0}
          tableConfig={mainTableConfig}
          renderBuilderCells={renderBuilderCells}
          addTableHeader={addTableHeader}
          addTableRow={addTableRow}
          removeTableRow={removeTableRow}
        />

        {renderSelectionActions(0)}
      </div>

      {formData.modelTables.slice(1).map((tableConfig, extraIndex) => {
        const tableIndex = extraIndex + 1;

        return (
          <div key={`technical-table-${tableIndex}`} className="table-builder-container">
            <div className="dynamic-section-card__header">
              <strong>Tabela {tableIndex + 1}</strong>
              <button
                type="button"
                className="btn-icon delete"
                onClick={() => removeTechnicalTable(tableIndex)}
                aria-label={`Remover tabela ${tableIndex + 1}`}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="form-group table-title-group">
              <label>Título da Tabela</label>
              <p className="product-form-helper">
                Defina o nome que será exibido acima desta tabela técnica do produto.
              </p>
              <input
                value={tableConfig.title}
                placeholder="Ex.: Tabela Técnica / Modelos Disponíveis"
                onChange={(e) => updateTechnicalTableTitle(tableIndex, e.target.value)}
              />
            </div>

            <div className="table-builder-toolbar">
              <div className="table-builder-toolbar-copy">
                <span className="table-builder-kicker">Configuração da tabela</span>
                <h4>Organize colunas e linhas com mais clareza</h4>
                <p>Cadastre os títulos principais e preencha as informações técnicas que serão exibidas no site.</p>
              </div>

              <TableSizePicker
                tableIndex={tableIndex}
                tableConfig={tableConfig}
                tablePickerPreview={tablePickerPreview}
                clearTablePickerPreview={clearTablePickerPreview}
                updateTablePickerPreview={updateTablePickerPreview}
                resizeTable={resizeTable}
              />
            </div>

            <TableGrid
              tableIndex={tableIndex}
              tableConfig={tableConfig}
              renderBuilderCells={renderBuilderCells}
              addTableHeader={addTableHeader}
              addTableRow={addTableRow}
              removeTableRow={removeTableRow}
            />

            {renderSelectionActions(tableIndex)}
          </div>
        );
      })}

      <button type="button" className="btn-add" onClick={addTechnicalTable}>
        <Plus size={16} /> Adicionar Nova Tabela
      </button>

      <div className="product-form-toggle-bar table-config-visibility-toggle">
        <div className="product-form-toggle-copy">
          <strong>Exibir tabela no site</strong>
          <span>Status atual: {formData.showModelSection ? 'ON' : 'OFF'}</span>
        </div>
        <button
          type="button"
          className={`btn-secondary product-form-toggle-button ${formData.showModelSection ? 'is-on' : 'is-off'}`}
          onClick={() => setFormData((current) => ({ ...current, showModelSection: !current.showModelSection }))}
        >
          {formData.showModelSection ? 'Ocultar no site' : 'Exibir no site'}
        </button>
      </div>
    </div>
  );
};

export default TechnicalTablesSection;
