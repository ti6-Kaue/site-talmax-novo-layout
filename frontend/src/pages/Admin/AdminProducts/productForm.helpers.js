export const createInitialFormState = () => ({
  sku: '',
  name: '',
  is_active: true,
  category_ids: [],
  sub_category_ids: [],
  description: '',
  descriptionTabLabel: '',
  descriptionAsList: false,
  technicalTabLabel: '',
  productTabs: [],
  showFeatures: false,
  hideModelData: false,
  showModelSection: true,
  showQuoteButton: true,
  productBanner: null,
  productBannerUrl: '',
  images: [],
  features: [''],
  techSpecs: [{ label: '', value: '' }],
  modelTables: [{
    title: '',
    modelTable: { headers: ['Tipo / Referencia', 'Codigo'], rows: [['', '']] }
  }]
});

export const createEmptyModelTable = () => ({
  headers: ['Tipo / Referencia', 'Codigo'],
  rows: [['', '']],
  mergedHeader: false,
  mergedHeaderEndColumn: null,
  mergeRanges: []
});

export const createTechnicalTable = () => ({
  title: '',
  modelTable: createEmptyModelTable()
});

export const clampTableDimension = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) return fallback;
  return Math.min(Math.max(parsedValue, 1), 20);
};

export const getSpreadsheetColumnLabel = (index) => {
  let value = index + 1;
  let label = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
};

export const sanitizeMergeRanges = (mergeRanges, rowCount, columnCount) => {
  if (!Array.isArray(mergeRanges) || rowCount <= 0 || columnCount <= 0) {
    return [];
  }

  const uniqueRanges = new Map();

  mergeRanges.forEach((range) => {
    const rawStartRow = Number.parseInt(range?.startRow ?? range?.row, 10);
    const rawEndRow = Number.parseInt(range?.endRow ?? range?.row, 10);
    const rawStart = Number.parseInt(range?.startCol, 10);
    const rawEnd = Number.parseInt(range?.endCol, 10);

    if (!Number.isInteger(rawStartRow) || !Number.isInteger(rawEndRow) || !Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) {
      return;
    }

    const startRow = Math.min(Math.max(Math.min(rawStartRow, rawEndRow), 0), rowCount - 1);
    const endRow = Math.min(Math.max(Math.max(rawStartRow, rawEndRow), 0), rowCount - 1);
    const startCol = Math.min(Math.max(Math.min(rawStart, rawEnd), 0), columnCount - 1);
    const endCol = Math.min(Math.max(Math.max(rawStart, rawEnd), 0), columnCount - 1);

    if (endCol <= startCol && endRow <= startRow) {
      return;
    }

    uniqueRanges.set(`${startRow}-${endRow}-${startCol}-${endCol}`, { startRow, endRow, startCol, endCol });
  });

  return Array.from(uniqueRanges.values()).sort((left, right) => {
    if (left.startRow !== right.startRow) {
      return left.startRow - right.startRow;
    }

    if (left.endRow !== right.endRow) {
      return left.endRow - right.endRow;
    }

    if (left.startCol !== right.startCol) {
      return left.startCol - right.startCol;
    }

    return left.endCol - right.endCol;
  });
};

export const getLegacyMergedHeaderRange = (modelTable, columnCount) => {
  if (!modelTable?.mergedHeader || columnCount <= 1) {
    return [];
  }

  const endCol = Number.isInteger(modelTable.mergedHeaderEndColumn)
    ? Math.max(0, Math.min(modelTable.mergedHeaderEndColumn, columnCount - 1))
    : columnCount - 1;

  if (endCol <= 0) {
    return [];
  }

  return [{ startRow: 0, endRow: 0, startCol: 0, endCol }];
};

export const getMergedHeaderRange = (mergeRanges) => (
  Array.isArray(mergeRanges)
    ? mergeRanges.find((range) => range.startRow === 0 && range.endRow === 0 && range.startCol === 0) || null
    : null
);

export const getMergeRangeForCell = (mergeRanges, rowIndex, colIndex) => (
  Array.isArray(mergeRanges)
    ? mergeRanges.find((range) => (
      range.startRow <= rowIndex
      && range.endRow >= rowIndex
      && range.startCol <= colIndex
      && range.endCol >= colIndex
    )) || null
    : null
);

export const removeOverlappingMergeRanges = (mergeRanges, startRow, endRow, startCol, endCol) => (
  (Array.isArray(mergeRanges) ? mergeRanges : []).filter((range) => (
    range.endRow < startRow
    || range.startRow > endRow
    || range.endCol < startCol
    || range.startCol > endCol
  ))
);

export const adjustMergeRangesForRemovedColumn = (mergeRanges, removedColumnIndex, rowCount, columnCount) => (
  sanitizeMergeRanges(
    (Array.isArray(mergeRanges) ? mergeRanges : []).map((range) => {
      if (removedColumnIndex < range.startCol) {
        return {
          ...range,
          startCol: range.startCol - 1,
          endCol: range.endCol - 1
        };
      }

      if (removedColumnIndex > range.endCol) {
        return range;
      }

      return {
        ...range,
        endCol: range.endCol - 1
      };
    }),
    rowCount,
    columnCount
  )
);

export const adjustMergeRangesForRemovedRow = (mergeRanges, removedRowIndex, rowCount, columnCount) => (
  sanitizeMergeRanges(
    (Array.isArray(mergeRanges) ? mergeRanges : [])
      .filter((range) => !(range.startRow === removedRowIndex && range.endRow === removedRowIndex))
      .map((range) => (
        removedRowIndex < range.startRow
          ? { ...range, startRow: range.startRow - 1, endRow: range.endRow - 1 }
          : removedRowIndex > range.endRow
            ? range
            : { ...range, endRow: range.endRow - 1 }
      )),
    rowCount,
    columnCount
  )
);

export const createDragSelectionState = () => ({
  tableIndex: null,
  startRow: null,
  startCol: null,
  endRow: null,
  endCol: null,
  isDragging: false,
  hasMoved: false
});

export const createDynamicSection = () => ({
  title: '',
  content: '',
  contentAsList: false,
  videoUrl: '',
  showContentWithVideo: true
});

export const normalizeModelTable = (modelTable) => {
  const fallback = createEmptyModelTable();

  if (!modelTable || !Array.isArray(modelTable.headers) || !Array.isArray(modelTable.rows)) {
    return fallback;
  }

  const headers = modelTable.headers.length > 0
    ? modelTable.headers.map((header) => (typeof header === 'string' ? header : ''))
    : fallback.headers;

  const rows = modelTable.rows.length > 0
    ? modelTable.rows.map((row) => {
      const normalizedRow = Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : [];
      while (normalizedRow.length < headers.length) {
        normalizedRow.push('');
      }
      return normalizedRow.slice(0, headers.length);
    })
    : [];

  const mergeRanges = sanitizeMergeRanges(
    Array.isArray(modelTable.mergeRanges) && modelTable.mergeRanges.length > 0
      ? modelTable.mergeRanges
      : getLegacyMergedHeaderRange(modelTable, headers.length),
    rows.length + 1,
    headers.length
  );

  const mergedHeaderRange = getMergedHeaderRange(mergeRanges);

  return {
    headers,
    rows,
    mergeRanges,
    mergedHeader: Boolean(mergedHeaderRange),
    mergedHeaderEndColumn: mergedHeaderRange?.endCol ?? headers.length - 1
  };
};

export const normalizeTechnicalTables = (tables, legacyTitle = '', legacyTable = null) => {
  if (Array.isArray(tables) && tables.length > 0) {
    return tables.map((table) => ({
      title: typeof table?.title === 'string' ? table.title : '',
      modelTable: normalizeModelTable(table?.modelTable || table?.table || table)
    }));
  }

  return [{
    title: typeof legacyTitle === 'string' ? legacyTitle : '',
    modelTable: normalizeModelTable(legacyTable)
  }];
};

export const normalizeDynamicSections = (sections) => (
  Array.isArray(sections)
    ? sections.map((section) => ({
      title: typeof section?.title === 'string' ? section.title : '',
      content: typeof section?.content === 'string' ? section.content : '',
      contentAsList: Boolean(section?.contentAsList),
      videoUrl: typeof (section?.videoUrl || section?.video_url) === 'string'
        ? (section.videoUrl || section.video_url).trim()
        : '',
      showContentWithVideo: section?.showContentWithVideo ?? section?.show_content_with_video ?? true
    }))
    : []
);

export const normalizeProductTabs = (tabs, legacySections = []) => {
  if (Array.isArray(tabs) && tabs.length > 0) {
    return tabs.map((tab) => ({
      id: tab?.id,
      title: typeof tab?.title === 'string' ? tab.title : '',
      content: typeof tab?.content === 'string' ? tab.content : '',
      contentAsList: Boolean(tab?.contentAsList || tab?.content_as_list),
      videoUrl: typeof (tab?.videoUrl || tab?.video_url) === 'string'
        ? (tab.videoUrl || tab.video_url).trim()
        : '',
      showContentWithVideo: tab?.showContentWithVideo ?? tab?.show_content_with_video ?? true
    }));
  }

  return normalizeDynamicSections(legacySections);
};

export const buildInitialPreviewList = (mainImage, extraImages) => {
  const normalizedImages = Array.isArray(extraImages)
    ? extraImages.filter(Boolean)
    : [];

  if (!mainImage) {
    return Array.from(new Set(normalizedImages));
  }

  return Array.from(new Set([mainImage, ...normalizedImages]));
};

export const autoResizeTableTextarea = (element) => {
  if (!(element instanceof HTMLTextAreaElement)) return;

  element.style.height = '48px';
  element.style.height = `${Math.max(element.scrollHeight, 48)}px`;
};

export const parseBulkTablePaste = (rawText, expectedColumnCount) => {
  const normalizedText = typeof rawText === 'string' ? rawText.replace(/\r/g, '').trim() : '';
  if (!normalizedText) return [];

  const rowChunks = normalizedText
    .split('\n')
    .map((line) => line.split('\t').map((cell) => cell.trim()).filter(Boolean))
    .filter((cells) => cells.length > 0);

  if (rowChunks.length === 0) return [];

  const isRectangularPaste = rowChunks.every((cells) => cells.length === rowChunks[0].length) && rowChunks[0].length > 1;
  if (isRectangularPaste) {
    return rowChunks;
  }

  const flatTokens = normalizedText
    .split(/[\n\t]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (flatTokens.length <= 1) return [];

  const columnCount = Math.max(expectedColumnCount || 1, 1);
  const parsedRows = [];

  for (let index = 0; index < flatTokens.length; index += columnCount) {
    parsedRows.push(flatTokens.slice(index, index + columnCount));
  }

  return parsedRows;
};
