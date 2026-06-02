import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { useMemo } from 'react';
import {
  adjustMergeRangesForRemovedRow,
  buildInitialPreviewList,
  clampTableDimension,
  createDragSelectionState,
  createDynamicSection,
  createInitialFormState,
  createTechnicalTable,
  getMergeRangeForCell,
  getSpreadsheetColumnLabel,
  normalizeModelTable,
  normalizeProductTabs,
  normalizeTechnicalTables,
  parseBulkTablePaste,
  removeOverlappingMergeRanges,
  sanitizeMergeRanges
} from './productForm.helpers';
import BasicInfoSection from './sections/BasicInfoSection';
import DescriptionFeaturesSection from './sections/DescriptionFeaturesSection';
import GallerySection from './sections/GallerySection';
import ProductTabsSection from './sections/ProductTabsSection';
import TechnicalTablesSection from './sections/TechnicalTablesSection';
import { parseSafeExtraData } from '../../../utils/contentSafety';

const ButtonSavingIndicator = () => (
  <span className="loader loader_bubble admin-button-loader" aria-hidden="true" />
);

const buildProductEditorState = (initialData) => {
  if (!initialData) {
    return {
      formData: createInitialFormState(),
      existingImages: [],
      newImagePreviews: [],
      primaryPreview: '',
      removedExistingImages: []
    };
  }

  const extra = parseSafeExtraData(initialData.extra_data);
  const initialPreviews = buildInitialPreviewList(initialData.main_image, extra.images);

  return {
    formData: {
      sku: initialData.sku || '',
      name: initialData.name || '',
      is_active: initialData.is_active !== false,
      category_ids: initialData.category_ids || [],
      sub_category_ids: initialData.sub_category_ids || [],
      description: initialData.description || '',
      descriptionTabLabel: extra.descriptionTabLabel || '',
      descriptionAsList: extra.descriptionAsList || false,
      technicalTabLabel: extra.technicalTabLabel || '',
      productTabs: normalizeProductTabs(initialData.product_tabs, extra.dynamicSections),
      showFeatures: extra.showFeatures !== false && Boolean(extra.features && extra.features.length > 0),
      hideModelData: false,
      showModelSection: extra.showModelSection !== false,
      showQuoteButton: extra.showQuoteButton !== false,
      productBanner: null,
      productBannerUrl: extra.productBannerUrl || '',
      images: [],
      features: (extra.features && extra.features.length > 0) ? extra.features : [''],
      techSpecs: (extra.techSpecs && extra.techSpecs.length > 0) ? extra.techSpecs : [{ label: '', value: '' }],
      modelTitle: extra.modelTitle || '',
      modelTable: extra.modelTable || { headers: ['Tipo / ReferÃªncia', 'CÃ³digo'], rows: [['', '']] },
      modelTables: normalizeTechnicalTables(extra.modelTables, extra.modelTitle, extra.modelTable).map((table, index) => ({
        ...table,
        modelTable: normalizeModelTable(
          index === 0 && extra.singleCellFirstRow
            ? {
                ...table.modelTable,
                mergedHeader: true,
                mergedHeaderEndColumn: table.modelTable.mergedHeaderEndColumn ?? (table.modelTable.headers.length - 1)
              }
            : table.modelTable
        )
      }))
    },
    existingImages: initialPreviews,
    newImagePreviews: [],
    primaryPreview: initialData.main_image || initialPreviews[0] || '',
    productBannerPreview: extra.productBannerUrl || '',
    removedExistingImages: []
  };
};

const ProductForm = ({
  initialData,
  mainCategories,
  subCategories,
  products = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  onExistingSkuFound,
  onSkuNotFound,
  onSkuAlreadyLoaded,
  onValidationError
}) => {
  const initialEditorState = useMemo(() => buildProductEditorState(initialData), [initialData]);
  const [formData, setFormData] = useState(() => initialEditorState.formData);
  const [existingImages, setExistingImages] = useState(() => initialEditorState.existingImages);
  const [newImagePreviews, setNewImagePreviews] = useState(() => initialEditorState.newImagePreviews);
  const [primaryPreview, setPrimaryPreview] = useState(() => initialEditorState.primaryPreview);
  const [productBannerPreview, setProductBannerPreview] = useState(() => initialEditorState.productBannerPreview || '');
  const [removedExistingImages, setRemovedExistingImages] = useState(() => initialEditorState.removedExistingImages);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
  const [isTableSizeOpen, setIsTableSizeOpen] = useState(false);
  const [tablePickerPreview, setTablePickerPreview] = useState({});
  const [dragSelection, setDragSelection] = useState(createDragSelectionState);
  const [activeSheetCell, setActiveSheetCell] = useState(null);
  const cellInputRefs = useRef({});
  const previews = [...existingImages, ...newImagePreviews];

  const handleSkuLookup = (sku) => {
    const normalizedSku = String(sku || '').trim().toLocaleLowerCase('pt-BR');

    if (!normalizedSku) {
      return;
    }

    if (
      initialData?.id
      && String(initialData.sku || '').trim().toLocaleLowerCase('pt-BR') === normalizedSku
    ) {
      onSkuAlreadyLoaded?.(sku);
      return;
    }

    const matchedProduct = products.find((product) => (
      String(product.sku || '').trim().toLocaleLowerCase('pt-BR') === normalizedSku
      && product.id !== initialData?.id
    ));

    if (matchedProduct) {
      onExistingSkuFound?.(matchedProduct);
      return;
    }

    onSkuNotFound?.(sku);
  };

  useEffect(() => {
    const handlePointerUp = () => {
      setDragSelection((current) => (
        current.isDragging
          ? { ...current, isDragging: false }
          : current
      ));
    };

    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, []);

  const getFilteredSubCategories = () => {
    // Se nenhuma categoria principal selecionada, mostra todas as subcategorias
    if (formData.category_ids.length === 0) return subCategories;
    // Se hÃ¡ categorias principais selecionadas, mostra apenas as subcategorias dessas categorias
    return subCategories.filter((s) => formData.category_ids.includes(Number(s.parent_id)));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const addedPreviews = files.map((file) => URL.createObjectURL(file));
    setFormData((current) => ({ ...current, images: [...current.images, ...files] }));
    setNewImagePreviews((current) => [...current, ...addedPreviews]);

    if (!primaryPreview && previews.length === 0) {
      setPrimaryPreview(addedPreviews[0]);
    }
  };

  const handleProductBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (productBannerPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(productBannerPreview);
    }

    setProductBannerPreview(URL.createObjectURL(file));
    setFormData((current) => ({
      ...current,
      productBanner: file,
      productBannerUrl: ''
    }));
  };

  const removeProductBanner = () => {
    if (productBannerPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(productBannerPreview);
    }

    setProductBannerPreview('');
    setFormData((current) => ({
      ...current,
      productBanner: null,
      productBannerUrl: ''
    }));
  };

  const removeImage = (index) => {
    const previewToRemove = previews[index];
    const isBlobPreview = previewToRemove?.startsWith('blob:');
    let remainingPreviews = previews.filter((_, previewIndex) => previewIndex !== index);

    if (isBlobPreview) {
      URL.revokeObjectURL(previewToRemove);
      const blobIndex = newImagePreviews.indexOf(previewToRemove);
      setNewImagePreviews((current) => current.filter((preview) => preview !== previewToRemove));

      setFormData((current) => ({
        ...current,
        images: current.images.filter((_, fileIndex) => fileIndex !== blobIndex)
      }));
    } else if (previewToRemove) {
      setExistingImages((current) => current.filter((imagePath) => imagePath !== previewToRemove));
      setRemovedExistingImages((current) => Array.from(new Set([...current, previewToRemove])));
    }

    if (primaryPreview === previewToRemove) {
      setPrimaryPreview(remainingPreviews[0] || '');
    }
  };

  const updateTechnicalTable = (tableIndex, updater) => {
    setFormData((current) => ({
      ...current,
      modelTables: current.modelTables.map((table, currentIndex) => (
        currentIndex === tableIndex
          ? updater({
            ...table,
            modelTable: normalizeModelTable(table.modelTable)
          })
          : table
      ))
    }));
  };

  const addTechnicalTable = () => {
    setFormData((current) => ({
      ...current,
      modelTables: [...current.modelTables, createTechnicalTable()]
    }));
  };

  const removeTechnicalTable = (tableIndex) => {
    if (formData.modelTables.length <= 1) return;

    setFormData((current) => ({
      ...current,
      modelTables: current.modelTables.filter((_, currentIndex) => currentIndex !== tableIndex)
    }));
  };

  const updateTechnicalTableTitle = (tableIndex, value) => {
    updateTechnicalTable(tableIndex, (table) => ({
      ...table,
      title: value
    }));
  };

  const addTableHeader = (tableIndex) => {
    updateTechnicalTable(tableIndex, (table) => {
      const newHeaders = [...table.modelTable.headers, 'Nova Coluna'];
      const newRows = table.modelTable.rows.map((row) => [...row, '']);

      return {
        ...table,
        modelTable: { headers: newHeaders, rows: newRows }
      };
    });
  };

  const resizeTable = (tableIndex, nextRowCount, nextColumnCount) => {
    updateTechnicalTable(tableIndex, (table) => {
      const columnCount = clampTableDimension(nextColumnCount, table.modelTable.headers.length || 1);
      const rowCount = clampTableDimension(nextRowCount, table.modelTable.rows.length || 1);

      const headers = Array.from({ length: columnCount }, (_, index) => (
        table.modelTable.headers[index] ?? `Coluna ${index + 1}`
      ));

      const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
        const sourceRow = Array.isArray(table.modelTable.rows[rowIndex]) ? table.modelTable.rows[rowIndex] : [];
        return Array.from({ length: columnCount }, (_, columnIndex) => sourceRow[columnIndex] ?? '');
      });

      return {
        ...table,
        modelTable: {
          headers,
          rows,
          mergeRanges: sanitizeMergeRanges(table.modelTable.mergeRanges, rows.length + 1, headers.length)
        }
      };
    });
  };

  const updateTablePickerPreview = (tableIndex, rows, columns) => {
    setTablePickerPreview((current) => ({
      ...current,
      [tableIndex]: { rows, columns }
    }));
  };

  const clearTablePickerPreview = (tableIndex, fallbackRows, fallbackColumns) => {
    setTablePickerPreview((current) => ({
      ...current,
      [tableIndex]: { rows: fallbackRows, columns: fallbackColumns }
    }));
  };

  const updateTableHeader = (tableIndex, headerIndex, value) => {
    updateTechnicalTable(tableIndex, (table) => {
      const newHeaders = [...table.modelTable.headers];
      newHeaders[headerIndex] = value;

      return {
        ...table,
        modelTable: { ...table.modelTable, headers: newHeaders }
      };
    });
  };

  const startDragSelection = (tableIndex, rowIndex, colIndex) => {
    setDragSelection({
      tableIndex,
      startRow: rowIndex,
      startCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex,
      isDragging: true,
      hasMoved: false
    });
  };

  const updateDragSelection = (tableIndex, rowIndex, colIndex) => {
    setDragSelection((current) => {
      if (!current.isDragging || current.tableIndex !== tableIndex || current.startRow === null || current.startCol === null) {
        return current;
      }

      const nextSelection = {
        ...current,
        endRow: rowIndex,
        endCol: colIndex,
        hasMoved: current.hasMoved
          || current.startRow !== rowIndex
          || current.startCol !== colIndex
      };

      return nextSelection;
    });
  };

  const focusCellInput = (tableIndex, rowIndex, colIndex) => {
    const key = `${tableIndex}-${rowIndex}-${colIndex}`;
    const target = cellInputRefs.current[key];

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      requestAnimationFrame(() => {
        target.focus();
        target.select?.();
      });
    }
  };

  const finishDragSelection = (tableIndex, rowIndex, colIndex) => {
    setDragSelection((current) => {
      if (!current.isDragging || current.tableIndex !== tableIndex) {
        return current;
      }

      const hasMoved = current.hasMoved
        || current.startRow !== rowIndex
        || current.startCol !== colIndex;

      if (!hasMoved) {
        focusCellInput(tableIndex, rowIndex, colIndex);
      }

      return {
        ...current,
        endRow: rowIndex,
        endCol: colIndex,
        isDragging: false,
        hasMoved
      };
    });
  };

  const clearDragSelection = () => {
    setDragSelection(createDragSelectionState());
  };

  const getSelectedMergeRange = (tableIndex) => {
    if (dragSelection.tableIndex !== tableIndex || dragSelection.startRow === null || dragSelection.startCol === null || dragSelection.endCol === null) {
      return null;
    }

    return {
      startRow: Math.min(dragSelection.startRow, dragSelection.endRow ?? dragSelection.startRow),
      endRow: Math.max(dragSelection.startRow, dragSelection.endRow ?? dragSelection.startRow),
      startCol: Math.min(dragSelection.startCol, dragSelection.endCol),
      endCol: Math.max(dragSelection.startCol, dragSelection.endCol)
    };
  };

  const isCellInsideDragSelection = (tableIndex, rowIndex, colIndex) => {
    const selectedRange = getSelectedMergeRange(tableIndex);

    if (!selectedRange) {
      return false;
    }

    return rowIndex >= selectedRange.startRow
      && rowIndex <= selectedRange.endRow
      && colIndex >= selectedRange.startCol
      && colIndex <= selectedRange.endCol;
  };

  const applyMergeRange = (tableIndex) => {
    const table = formData.modelTables[tableIndex];
    if (!table) return;

    const selection = getSelectedMergeRange(tableIndex);
    if (!selection) return;

    const { startRow, endRow, startCol, endCol } = selection;

    if (endCol <= startCol && endRow <= startRow) {
      return;
    }

    updateTechnicalTable(tableIndex, (currentTable) => ({
      ...currentTable,
      modelTable: normalizeModelTable({
        ...currentTable.modelTable,
        mergeRanges: [
          ...removeOverlappingMergeRanges(currentTable.modelTable.mergeRanges, startRow, endRow, startCol, endCol),
          { startRow, endRow, startCol, endCol }
        ]
      })
    }));
    clearDragSelection();
  };

  const removeMergeRange = (tableIndex) => {
    const table = formData.modelTables[tableIndex];
    if (!table) return;

    const selection = getSelectedMergeRange(tableIndex);
    if (!selection) return;

    const mergeRange = getMergeRangeForCell(table.modelTable.mergeRanges, selection.startRow, selection.startCol) || selection;
    const startRow = mergeRange.startRow;
    const endRow = mergeRange.endRow;
    const startCol = mergeRange.startCol;
    const endCol = mergeRange.endCol;

    updateTechnicalTable(tableIndex, (currentTable) => ({
      ...currentTable,
      modelTable: normalizeModelTable({
        ...currentTable.modelTable,
        mergeRanges: removeOverlappingMergeRanges(currentTable.modelTable.mergeRanges, startRow, endRow, startCol, endCol)
      })
    }));
    clearDragSelection();
  };

  const clearSelectedRange = (tableIndex) => {
    const table = formData.modelTables[tableIndex];
    if (!table) return;

    const selection = getSelectedMergeRange(tableIndex);
    if (!selection) return;

    updateTechnicalTable(tableIndex, (currentTable) => {
      const headers = [...currentTable.modelTable.headers];
      const rows = currentTable.modelTable.rows.map((row) => [...row]);
      const cellsToClear = new Set();

      for (let rowIndex = selection.startRow; rowIndex <= selection.endRow; rowIndex += 1) {
        for (let colIndex = selection.startCol; colIndex <= selection.endCol; colIndex += 1) {
          const mergeRange = getMergeRangeForCell(currentTable.modelTable.mergeRanges, rowIndex, colIndex);
          const targetRow = mergeRange ? mergeRange.startRow : rowIndex;
          const targetCol = mergeRange ? mergeRange.startCol : colIndex;

          cellsToClear.add(`${targetRow}-${targetCol}`);
        }
      }

      cellsToClear.forEach((cellKey) => {
        const [targetRow, targetCol] = cellKey.split('-').map((value) => Number.parseInt(value, 10));

        if (targetRow === 0) {
          headers[targetCol] = '';
          return;
        }

        if (rows[targetRow - 1]) {
          rows[targetRow - 1][targetCol] = '';
        }
      });

      return {
        ...currentTable,
        modelTable: {
          ...currentTable.modelTable,
          headers,
          rows
        }
      };
    });

    clearDragSelection();
  };

  const handleSelectionDeleteKey = (event, tableIndex) => {
    if (event.key !== 'Delete') {
      return;
    }

    const selection = getSelectedMergeRange(tableIndex);
    if (!selection) {
      return;
    }

    const hasMultiCellSelection = selection.endRow > selection.startRow || selection.endCol > selection.startCol;
    if (!hasMultiCellSelection) {
      return;
    }

    event.preventDefault();
    clearSelectedRange(tableIndex);
  };

  const addTableRow = (tableIndex) => {
    const currentTable = formData.modelTables[tableIndex];
    if (!currentTable) return;

    const newRow = new Array(currentTable.modelTable.headers.length).fill('');
    updateTechnicalTable(tableIndex, (table) => ({
      ...table,
      modelTable: {
        ...table.modelTable,
        rows: [...table.modelTable.rows, newRow]
      }
    }));
  };

  const removeTableRow = (tableIndex, rowIndex) => {
    const currentTable = formData.modelTables[tableIndex];
    if (!currentTable || currentTable.modelTable.rows.length === 0) return;

    updateTechnicalTable(tableIndex, (table) => ({
      ...table,
      modelTable: {
        ...table.modelTable,
        rows: table.modelTable.rows.filter((_, index) => index !== rowIndex),
        mergeRanges: adjustMergeRangesForRemovedRow(
          table.modelTable.mergeRanges,
          rowIndex + 1,
          table.modelTable.rows.length,
          table.modelTable.headers.length
        )
      }
    }));
  };

  const updateTableCell = (tableIndex, rowIndex, colIndex, value) => {
    updateTechnicalTable(tableIndex, (table) => {
      const newRows = table.modelTable.rows.map((row) => [...row]);
      newRows[rowIndex][colIndex] = value;

      return {
        ...table,
        modelTable: { ...table.modelTable, rows: newRows }
      };
    });
  };

  const renderBuilderCells = ({
    tableIndex,
    rowNumber,
    values,
    isHeaderRow = false
  }) => {
    const table = formData.modelTables[tableIndex];
    if (!table) return null;

    return table.modelTable.headers.map((_, colIndex) => {
      const mergeRange = getMergeRangeForCell(table.modelTable.mergeRanges, rowNumber - 1, colIndex);
      const cellRefKey = `${tableIndex}-${rowNumber - 1}-${colIndex}`;
      const isMergedOrigin = Boolean(
        mergeRange
        && mergeRange.startCol === colIndex
        && mergeRange.startRow === rowNumber - 1
      );
      const isMergedCovered = Boolean(mergeRange && !isMergedOrigin);
      const sharedProps = {
        className: [
          'builder-table__cell',
          isHeaderRow ? 'builder-table__cell--header' : '',
          mergeRange ? 'builder-table__cell--merged' : '',
          isMergedOrigin ? 'builder-table__cell--merged-origin' : '',
          isMergedCovered ? 'builder-table__cell--merged-covered' : '',
          isCellInsideDragSelection(tableIndex, rowNumber - 1, colIndex) ? 'is-selection-preview' : '',
          !isHeaderRow
            && activeSheetCell?.tableIndex === tableIndex
            && activeSheetCell?.rowIndex === rowNumber - 2
            && activeSheetCell?.colIndex === colIndex
            ? 'is-active'
            : ''
        ].filter(Boolean).join(' '),
        onMouseDown: (event) => {
          event.preventDefault();
          startDragSelection(tableIndex, rowNumber - 1, colIndex);
        },
        onMouseEnter: () => updateDragSelection(tableIndex, rowNumber - 1, colIndex),
        onMouseUp: () => finishDragSelection(tableIndex, rowNumber - 1, colIndex)
      };

      if (isHeaderRow) {
        return (
          <td key={`${tableIndex}-${rowNumber}-${colIndex}`} {...sharedProps}>
            <input
              ref={(node) => {
                if (node) {
                  cellInputRefs.current[cellRefKey] = node;
                } else {
                  delete cellInputRefs.current[cellRefKey];
                }
              }}
              value={values[colIndex] || ''}
              onChange={(e) => updateTableHeader(tableIndex, colIndex, e.target.value)}
              onKeyDown={(event) => handleSelectionDeleteKey(event, tableIndex)}
            />
          </td>
        );
      }

      return (
        <td key={`${tableIndex}-${rowNumber}-${colIndex}`} {...sharedProps}>
          <input
            ref={(node) => {
              if (node) {
                cellInputRefs.current[cellRefKey] = node;
              } else {
                delete cellInputRefs.current[cellRefKey];
              }
            }}
            type="text"
            disabled={isMergedCovered}
            value={values[colIndex] || ''}
            onFocus={() => setActiveSheetCell({ tableIndex, rowIndex: rowNumber - 2, colIndex })}
            onChange={(e) => updateTableCell(tableIndex, rowNumber - 2, colIndex, e.target.value)}
            onPaste={(e) => handleTableCellPaste(e, tableIndex, rowNumber - 2, colIndex)}
            onKeyDown={(event) => handleSelectionDeleteKey(event, tableIndex)}
          />
        </td>
      );
    });
  };

  const renderSelectionActions = (tableIndex) => {
    const selectedRange = getSelectedMergeRange(tableIndex);
    const table = formData.modelTables[tableIndex];

    if (!selectedRange || !table) {
      return null;
    }

    const selectedMergeRange = getMergeRangeForCell(
      table.modelTable.mergeRanges,
      selectedRange.startRow,
      selectedRange.startCol
    );
    const canMergeSelection = selectedRange.endCol > selectedRange.startCol;
    const canMergeVerticalSelection = selectedRange.endRow > selectedRange.startRow;
    const canClearSelection = selectedRange.endCol > selectedRange.startCol || selectedRange.endRow > selectedRange.startRow;
    const canUnmergeSelection = Boolean(
      selectedMergeRange
      && selectedRange.startRow >= selectedMergeRange.startRow
      && selectedRange.endRow <= selectedMergeRange.endRow
      && selectedRange.startCol >= selectedMergeRange.startCol
      && selectedRange.endCol <= selectedMergeRange.endCol
    );

    if (!canMergeSelection && !canMergeVerticalSelection && !canUnmergeSelection && !canClearSelection) {
      return null;
    }

    const labelRange = canUnmergeSelection ? selectedMergeRange : selectedRange;

    return (
      <div className="table-selection-actions">
        <span className="table-selection-actions__label">
          Seleção {getSpreadsheetColumnLabel(labelRange.startCol)}{labelRange.startRow + 1}:{getSpreadsheetColumnLabel(labelRange.endCol)}{labelRange.endRow + 1}
        </span>
        {canClearSelection && (
          <button
            type="button"
            className="btn-secondary table-builder-toolbar-button table-builder-toolbar-button--remove"
            onClick={() => clearSelectedRange(tableIndex)}
          >
            Apagar células
          </button>
        )}
        {(canMergeSelection || canMergeVerticalSelection) && (
          <button
            type="button"
            className="btn-secondary table-builder-toolbar-button table-builder-toolbar-button--merge"
            onClick={() => applyMergeRange(tableIndex)}
          >
            Mesclar células
          </button>
        )}
        {canUnmergeSelection && (
          <button
            type="button"
            className="btn-secondary table-builder-toolbar-button table-builder-toolbar-button--remove"
            onClick={() => removeMergeRange(tableIndex)}
          >
            Desfazer mescla
          </button>
        )}
        <button
          type="button"
          className="btn-secondary table-builder-toolbar-button table-builder-toolbar-button--remove"
          onClick={clearDragSelection}
        >
          Cancelar seleção
        </button>
      </div>
    );
  };

  const handleTableCellPaste = (event, tableIndex, rowIndex, colIndex) => {
    const pastedText = event.clipboardData?.getData('text');
    const currentTable = formData.modelTables[tableIndex];
    const parsedRows = parseBulkTablePaste(pastedText, currentTable?.modelTable?.headers.length || 1);

    if (parsedRows.length === 0) {
      return;
    }

    event.preventDefault();

    updateTechnicalTable(tableIndex, (table) => {
      const existingColumnCount = table.modelTable.headers.length;
      const requiredColumnCount = Math.max(
        existingColumnCount,
        colIndex + Math.max(...parsedRows.map((row) => row.length))
      );

      const headers = [...table.modelTable.headers];
      while (headers.length < requiredColumnCount) {
        headers.push(`Nova Coluna ${headers.length + 1}`);
      }

      const rows = table.modelTable.rows.map((row) => {
        const normalizedRow = [...row];
        while (normalizedRow.length < requiredColumnCount) {
          normalizedRow.push('');
        }
        return normalizedRow;
      });

      const requiredRowCount = rowIndex + parsedRows.length;
      while (rows.length < requiredRowCount) {
        rows.push(new Array(requiredColumnCount).fill(''));
      }

      parsedRows.forEach((parsedRow, parsedRowIndex) => {
        parsedRow.forEach((value, parsedColIndex) => {
          rows[rowIndex + parsedRowIndex][colIndex + parsedColIndex] = value;
        });
      });

      return {
        ...table,
        modelTable: { headers, rows }
      };
    });
  };

  const addDynamicSection = () => {
    setFormData((current) => ({
      ...current,
      productTabs: [...current.productTabs, createDynamicSection()]
    }));
  };

  const updateDynamicSection = (index, field, value) => {
    setFormData((current) => ({
      ...current,
      productTabs: current.productTabs.map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, [field]: value } : section
      ))
    }));
  };

  const removeDynamicSection = (index) => {
    setFormData((current) => ({
      ...current,
      productTabs: current.productTabs.filter((_, sectionIndex) => sectionIndex !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (formData.category_ids.length === 0) {
      onValidationError?.('Selecione pelo menos uma categoria principal antes de salvar o produto.');
      return;
    }

    if (previews.length === 0) {
      onValidationError?.('Adicione pelo menos uma foto antes de salvar o produto.');
      return;
    }

    const primaryImageIndex = previews.findIndex((preview) => preview === primaryPreview);

    const data = new FormData();
    data.append('sku', formData.sku);
    data.append('name', formData.name);
    data.append('is_active', String(formData.is_active));
    data.append('description', formData.description);
    data.append('primary_image_index', String(primaryImageIndex >= 0 ? primaryImageIndex : 0));

    const combinedCategoryIds = formData.category_ids;
    const combinedSubCategoryIds = formData.sub_category_ids;
    data.append('category_ids', JSON.stringify(combinedCategoryIds));
    data.append('sub_category_ids', JSON.stringify(combinedSubCategoryIds));

    const extraData = {
      descriptionTabLabel: formData.descriptionTabLabel.trim(),
      descriptionAsList: formData.descriptionAsList,
      technicalTabLabel: formData.technicalTabLabel.trim(),
      product_tabs: formData.productTabs
        .map((section) => ({
          id: section.id,
          title: section.title.trim(),
          content: section.content.trim(),
          contentAsList: section.contentAsList,
          videoUrl: (section.videoUrl || '').trim(),
          showContentWithVideo: section.showContentWithVideo !== false
        }))
        .filter((section) => (
          section.title
          && (section.content || section.videoUrl)
        )),
      showFeatures: formData.showFeatures,
      hideModelData: false,
      showModelSection: formData.showModelSection,
      showQuoteButton: formData.showQuoteButton,
      productBannerUrl: formData.productBannerUrl || '',
      features: formData.showFeatures ? formData.features.filter((f) => f.trim() !== '') : [],
      techSpecs: formData.techSpecs.filter((s) => s.label.trim() !== '' || s.value.trim() !== ''),
      modelTables: formData.modelTables.map((table) => ({
        title: table.title?.trim() || '',
        modelTable: normalizeModelTable({
          ...table.modelTable,
          mergedHeader: Boolean(table.modelTable?.mergedHeader)
        })
      })),
      modelTitle: formData.modelTables[0]?.title || '',
      modelTable: normalizeModelTable(formData.modelTables[0]?.modelTable),
      images: existingImages,
      removedImages: removedExistingImages
    };
    data.append('extra_data', JSON.stringify(extraData));

    formData.images.forEach((img) => {
      data.append('images', img);
    });

    if (formData.productBanner) {
      data.append('product_banner', formData.productBanner);
    }

    onSubmit(data);
  };

  const filteredSubCategories = getFilteredSubCategories();

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      <BasicInfoSection
        formData={formData}
        setFormData={setFormData}
        mainCategories={mainCategories}
        subCategories={subCategories}
        filteredSubCategories={filteredSubCategories}
        isCategoryDropdownOpen={isCategoryDropdownOpen}
        setIsCategoryDropdownOpen={setIsCategoryDropdownOpen}
        isSubCategoryDropdownOpen={isSubCategoryDropdownOpen}
        setIsSubCategoryDropdownOpen={setIsSubCategoryDropdownOpen}
        onSkuLookup={handleSkuLookup}
      />

      <DescriptionFeaturesSection
        formData={formData}
        setFormData={setFormData}
      />

      <GallerySection
        previews={previews}
        primaryPreview={primaryPreview}
        setPrimaryPreview={setPrimaryPreview}
        productBannerPreview={productBannerPreview}
        handleProductBannerChange={handleProductBannerChange}
        removeProductBanner={removeProductBanner}
        handleFileChange={handleFileChange}
        removeImage={removeImage}
      />

      <ProductTabsSection
        formData={formData}
        setFormData={setFormData}
        updateDynamicSection={updateDynamicSection}
        removeDynamicSection={removeDynamicSection}
        addDynamicSection={addDynamicSection}
      />

      <TechnicalTablesSection
        formData={formData}
        setFormData={setFormData}
        isTableSizeOpen={isTableSizeOpen}
        setIsTableSizeOpen={setIsTableSizeOpen}
        tablePickerPreview={tablePickerPreview}
        clearTablePickerPreview={clearTablePickerPreview}
        updateTablePickerPreview={updateTablePickerPreview}
        resizeTable={resizeTable}
        addTableHeader={addTableHeader}
        addTableRow={addTableRow}
        removeTableRow={removeTableRow}
        renderBuilderCells={renderBuilderCells}
        renderSelectionActions={renderSelectionActions}
        updateTechnicalTableTitle={updateTechnicalTableTitle}
        addTechnicalTable={addTechnicalTable}
        removeTechnicalTable={removeTechnicalTable}
      />
      <div className="product-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="btn-primary product-submit-button" disabled={isSubmitting}>
          {isSubmitting ? <ButtonSavingIndicator /> : <Save size={20} />}
          {isSubmitting ? 'Salvando' : 'Finalizar e salvar produto'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
