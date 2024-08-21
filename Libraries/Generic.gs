var Generic = () => ({
  getSheet: (sheet, spreadsheetID) => {
    if (!sheet) return SpreadsheetApp.getActiveSheet();
    if (typeof sheet === 'string') {
      const spreadsheet = spreadsheetID
        ? SpreadsheetApp.openById(spreadsheetID)
        : SpreadsheetApp.getActive();
      return spreadsheet.getSheetByName(sheet);
    }
    return sheet;
  },
  insertSheet: (sheet, nextToSheet) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (sheetObject) return sheetObject;
    SpreadsheetApp.flush();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetIndex = nextToSheet
      ? nextToSheet === '$'
        ? spreadsheet.getSheets().length
        : spreadsheet.getSheetByName(
          nextToSheet.split(', ').find((sheet) => Generic_.getSheet(sheet))
        )?.getIndex?.()
      : 0;
    return spreadsheet.insertSheet(sheet, sheetIndex || 0);
  },
  deleteSheet: (sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!sheetObject) return;
    SpreadsheetApp.getActive().deleteSheet(sheetObject);
    return true;
  },
  refreshSheet: (sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!sheetObject) return;

    const range = sheetObject.getDataRange();
    const formulas = range.getFormulas();
    for (let row = 0; row < formulas.length; row++) {
      for (let column = 0; column < formulas[row].length; column++) {
        const formula = formulas[row][column];
        if (formula) sheetObject.getRange(row + 1, column + 1).setValue(formula);
      }
    }

    const rules = sheetObject.getConditionalFormatRules();
    sheetObject.clearConditionalFormatRules();
    sheetObject.setConditionalFormatRules(rules);
  },
  refreshAllSheets: () => {
    const Generic_ = Generic();
    SpreadsheetApp.getActiveSpreadsheet()
      .getSheets()
      .forEach((sheet) => Generic_.refreshSheet(sheet.getName()));
  },
  getSheetValues: (sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!sheetObject) return [];
    return sheetObject.getDataRange().getValues();
  },
  getRow: (rowNumber, sheet) => {
    return Generic().getSheetValues(sheet)[rowNumber - 1];
  },
  getColumn: (columnNumber, sheet) => {
    return Generic().getSheetValues(sheet).map((row) => row[columnNumber - 1]);
  },
  getRowIndex: (value, column = 1, sheet) => {
    return Generic().getColumn(column, sheet).indexOf(value) + 1;
  },
  getColumnIndex: (value, row = 1, sheet) => {
    return Generic().getRow(row, sheet).indexOf(value) + 1;
  },
  getColumnFromA1Notation: (cell) => {
    const columnLetter = cell.match(/[A-Z]+/)[0];
    let columnNumber = 0;
    for (let i = 0; i < columnLetter.length; i++) {
      columnNumber = columnNumber * 26 + columnLetter.charCodeAt(i) - 64;
    }
    return columnNumber;
  },
  getCell: (rowValue, columnValue, sheet, interpolation = { row: 0, column: 0 }, row = 1, column = 1) => {
    const Generic_ = Generic();
    const rowIndex = Generic_.getRowIndex(rowValue, column, sheet);
    const columnIndex = Generic_.getColumnIndex(columnValue, row, sheet);
    return [rowIndex + interpolation.row, columnIndex + interpolation.column];
  },
  splitRange: (range, inA1Notation = true) => {
    const Convert_ = Convert();
    const [start, end] = range.split(':');
    const { row: startRow, column: startColumn } = Convert_.toRowColumnNotation(start);
    const { row: endRow, column: endColumn } = Convert_.toRowColumnNotation(end);
    const cells = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let column = startColumn; column <= endColumn; column++) {
        cells.push(inA1Notation ? Convert_.toA1Notation(row, column) : { row, column });
      }
    }
    return cells;
  },
  isCellInRange: (cell, range) => {
    const Convert_ = Convert();
    const [rangeStart, rangeEnd] = range.split(':');
    const currentCell = Convert_.toRowColumnNotation(cell);
    const start = Convert_.toRowColumnNotation(rangeStart);
    const end = Convert_.toRowColumnNotation(rangeEnd);

    return (
      currentCell.row >= start.row &&
      currentCell.row <= end.row &&
      currentCell.column >= start.column &&
      currentCell.column <= end.column
    );
  },
  isCellDropdown: (cell, sheet) => {
    const dataValidation = Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).getDataValidation();
    if (!dataValidation) return false;
    const CRITERIA = SpreadsheetApp.DataValidationCriteria;
    return [CRITERIA.VALUE_IN_LIST, CRITERIA.VALUE_IN_RANGE].includes(dataValidation.getCriteriaType());
  },
  getCellDropdown: (cell, sheet) => {
    const dataValidation = Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).getDataValidation();
    if (!dataValidation) return {};
    const criteriaType = dataValidation.getCriteriaType();
    const criteriaValues = dataValidation.getCriteriaValues()[0];
    if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      return { values: criteriaValues };
    }
    if (criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) return {
      range: `${criteriaValues.getSheet().getName()}!${criteriaValues.getA1Notation()}`,
      values: criteriaValues.getValues()[0]
    };
    return {};
  },
  createDropdown: ({ range, cell, options, valuesInRange, sheet }) => {
    if ((!range && (!cell || !sheet)) || (!options && !valuesInRange)) return;
    const rule = options
      ? SpreadsheetApp.newDataValidation().requireValueInList(options, true).build()
      : SpreadsheetApp.newDataValidation().requireValueInRange(valuesInRange, true).build();
    const dropwdownRange = range || Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    );
    dropwdownRange.setDataValidation(rule);
  },
  isCellMerged: (cell, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!sheetObject) return;
    return sheetObject.getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).isPartOfMerge();
  },
  getMergedCells: (cell, sheet) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject) return;
    const cellInA1 = typeof cell === 'string'
      ? cell
      : Convert().toA1Notation(...cell);
    for (const range of sheetObject.getRange(cellInA1).getMergedRanges()) {
      const rangeInA1 = range.getA1Notation();
      if (Generic_.isCellInRange(cellInA1, rangeInA1)) return rangeInA1;
    }
  },
  getFirstMergedCell: (cell, sheet) => {
    const cellInA1 = typeof cell === 'string'
      ? cell
      : Convert().toA1Notation(...cell);
    const mergedCells = Generic().getMergedCells(cellInA1, sheet);
    if (mergedCells === undefined) return undefined;
    return mergedCells.split(':')[0];
  },
  getAboveMergedCell: (cell, sheet) => {
    const cellInA1 = typeof cell === 'string'
      ? cell
      : Convert().toA1Notation(...cell);
    const firstMergedCell = Generic().getFirstMergedCell(cellInA1, sheet);
    if (firstMergedCell === undefined) return undefined;
    const cellRow = cellInA1.match(/\d+/)[0];
    const firstMergedCellRow = firstMergedCell.match(/\d+/)[0];
    if (cellRow === firstMergedCellRow) return undefined;
    return firstMergedCell;
  },
  mergeRange: ({
    sheet,
    startCell,
    rowLength = 1,
    columnLength = 1,
    outOfBoundsCheck = true,
    overwriteValues = false
  }) => {
    const hasMultipleValues = (values, maxCount = 1) => {
      let count = 0;
      for (const row of values) {
        for (const value of row) {
          if (value !== '' && ++count > maxCount) return true;
        }
      }
      return false;
    };

    const Convert_ = Convert(), Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    const [startRow, startColumn] = typeof startCell === 'string'
      ? Object.values(Convert_.toRowColumnNotation(startCell))
      : startCell;
    let maxRow = startRow + rowLength - 1;
    let maxColumn = startColumn + columnLength - 1;
    for (let row = startRow; row < startRow + rowLength; row++) {
      for (let column = startColumn; column < startColumn + columnLength; column++) {
        const mergedRange = Generic_.getMergedCells([row, column], sheetObject);
        if (!mergedRange) continue;
        const {
          row: mergedRow,
          column: mergedColumn
        } = Convert_.toRowColumnNotation(mergedRange.split(':')[1]);
        maxRow = Math.max(maxRow, mergedRow);
        maxColumn = Math.max(maxColumn, mergedColumn);
      }
    }
    const range = sheetObject.getRange(
      startRow,
      startColumn,
      maxRow - startRow + 1,
      maxColumn - startColumn + 1
    );
    const rangeA1Notation = range.getA1Notation();

    if (
      outOfBoundsCheck
        && ((maxRow > startRow + rowLength - 1) || (maxColumn > startColumn + columnLength - 1))
    ) {
      throw `There are merged ranges within ${
        rangeA1Notation
      } that would cause your merged range to go out of its original bounds.`;
    }
    if (!overwriteValues && hasMultipleValues(range.getValues())) {
      throw `You're trying to merge the range ${rangeA1Notation}, but values will be overwritten.`;
    }
    range.merge();
    if (rangeA1Notation.includes(':')) {
      const [
        { row: startRow, column: startColumn },
        { row: endRow, column: endColumn }
      ] = rangeA1Notation.split(':').map((cell) => Convert_.toRowColumnNotation(cell));
      return {
        range: rangeA1Notation,
        rowLength: endRow - startRow + 1,
        columnLength: endColumn - startColumn + 1
      };
    }
    return { range: rangeA1Notation, rowLength: 1, columnLength: 1 };
  },
  compareRangeSizes: (range1, range2) => {
    const Convert_ = Convert();
    const {
      startRow: x11,
      startColumn: y11,
      endRow: x12,
      endColumn: y12
    } = Convert_.toRowColumnNotation(range1);
    const {
      startRow: x21,
      startColumn: y21,
      endRow: x22,
      endColumn: y22
    } = Convert_.toRowColumnNotation(range2);
    if (
      x11 === undefined && x21 !== undefined
        || x11 !== undefined && x21 === undefined
        || x12 === undefined && x22 !== undefined
        || x12 !== undefined && x22 === undefined
    ) return false;
    if (x11 === undefined || x12 === undefined) return true;
    return (x11 - x12 === x21 - x22) && (y11 - y12 === y21 - y22);
  },
  doesValueExist: (value, sheet, column = 1) => {
    return !!Generic().getSheetValues(sheet).find((row) => row[column - 1] === value);
  },
  getValue: (cell, sheet) => {
    const spreadsheet = Generic().getSheet(sheet);
    if (!spreadsheet) return;
    if (typeof cell === 'string') return spreadsheet.getRange(cell).getValue();
    return spreadsheet.getRange(...cell).getValue();
  },
  getFormula: (cell, sheet) => {
    const spreadsheet = Generic().getSheet(sheet);
    if (!spreadsheet) return;
    if (typeof cell === 'string') return spreadsheet.getRange(cell).getFormula();
    return spreadsheet.getRange(...cell).getFormula();
  },
  setValue: (cell, value, sheet) => {
    const Generic_ = Generic();
    if (typeof cell === 'string') {
      Generic_.getSheet(sheet).getRange(cell).setValue(value);
      return value;
    }
    Generic_.getSheet(sheet).getRange(...cell).setValue(value);
    return value;
  },
  setValueBasedOnCell: (targetCell, fromCell, sheet) => {
    const Generic_ = Generic();
    return Generic_.setValue(targetCell, Generic_.getValue(fromCell, sheet), sheet);
  },
  increaseValue: (cell, by = 1, maximum, sheet) => {
    const Generic_ = Generic();
    if (maximum !== undefined) {
      return Generic_.setValue(
        cell,
        Math.min(parseInt(Generic_.getValue(cell, sheet)) + by, maximum),
        sheet
      );
    }
    return Generic_.setValue(
      cell,
      parseInt(Generic_.getValue(cell, sheet)) + by,
      sheet
    );
  },
  decreaseValue: (cell, by = 1, zeroMinimum = true, sheet) => {
    const Generic_ = Generic();
    if (zeroMinimum) {
      return Generic_.setValue(
        cell,
        Math.max(Generic_.getValue(cell, sheet) - by, 0),
        sheet
      );
    }
    return Generic_.setValue(
      cell,
      Generic_.getValue(cell, sheet) - by,
      sheet
    );
  },
  getBackground: (cell, sheet) => {
    return Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).getBackground();
  },
  setBackground: (cell, background, sheet) => {
    return Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).setBackground(background);
  },
  getHorizontalAlignment: (cell, sheet) => {
    return Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).getHorizontalAlignment();
  },
  setHorizontalAlignment: (cell, alignment, sheet) => {
    return Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).setHorizontalAlignment(alignment);
  },
  findKeyColumn: (key, metadata) => {
    if (typeof key !== 'string') return key.toString();
    const match = key.match(/^([a-zA-Z]+)([-+]\d+)?$/);
    if (!match) return key;
    const stringPart = match[1];
    const numberPart = match[2] ? parseInt(match[2]) : 0;
    const index = metadata.indexOf(stringPart);
    if (index === -1) return -1;
    return index + numberPart + 1;
  },
  hideRows: (rows, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(rows)) rows = [rows];
    rows.forEach((row) => sheetObject.hideRows(row));
    return sheetObject;
  },
  showRows: (rows, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(rows)) rows = [rows];
    rows.forEach((row) => sheetObject.showRows(row));
    return sheetObject;
  },
  insertRows: (rows, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(rows)) rows = [rows];
    rows.toSorted((a, b) => b - a).forEach((row) => {
      sheetObject.insertRowAfter(row);
    });
    return sheetObject;
  },
  deleteRows: (rows, sheet) => {
    let deletedRows = 0;
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(rows)) rows = [rows];
    rows.toSorted((a, b) => a - b).forEach((row) => {
      sheetObject.deleteRow(row - deletedRows);
      deletedRows++;
    });
    return sheetObject;
  },
  hideColumns: (columns, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(columns)) columns = [columns];
    columns.forEach((column) => sheetObject.hideColumns(column));
    return sheetObject;
  },
  showColumns: (columns, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(columns)) columns = [columns];
    columns.forEach((column) => sheetObject.showColumns(column));
    return sheetObject;
  },
  insertColumns: (columns, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(columns)) columns = [columns];
    columns.toSorted((a, b) => b - a).forEach((column) => {
      sheetObject.insertColumnAfter(column);
    });
    return sheetObject;
  },
  deleteColumns: (columns, sheet) => {
    let deletedColumns = 0;
    const sheetObject = Generic().getSheet(sheet);
    if (!Array.isArray(columns)) columns = [columns];
    columns.toSorted((a, b) => a - b).forEach((column) => {
      sheetObject.deleteColumn(column - deletedColumns);
      deletedColumns++;
    });
    return sheetObject;
  },
  resizeColumns: ({ sheet, grid, manualChanges = {}, lastRow, lastColumn, minimum = 16 }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    Object.entries(manualChanges).forEach(([key, size]) => {
      if (isNaN(key)) manualChanges[Generic_.findKeyColumn(key, grid[0])] = size;
    });
    Array.from(
      { length: lastColumn || sheetObject.getLastColumn() - 1 },
      (_, index) => index + 1
    ).forEach((column) => {
      let size;
      const manualChange = manualChanges[column];
      if (!manualChange) {
        size = Math.max(
          Generic_.getEstimatedColumnWidth({
            column,
            sheet,
            lastRow: lastRow || sheetObject.getLastRow()
          }),
          minimum
        );
      }
      else if (typeof manualChange === 'number') size = manualChange;
      else {
        const { value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = manualChange;
        size = Math.max(
          Math.min(
            value || Generic_.getEstimatedColumnWidth({
              column,
              sheet,
              lastRow: lastRow || sheetObject.getLastRow()
            }),
            max
          ),
          min,
          minimum
        );
      }
      sheetObject.setColumnWidth(column, size);
    });
    return sheetObject;
  },
  freezeRowsAndColumns: ({ sheet, rows, columns }) => {
    const sheetObject = Generic().getSheet(sheet);
    if (rows) sheetObject.setFrozenRows(rows);
    if (columns) sheetObject.setFrozenColumns(columns);
    return sheetObject;
  },
  getCharLengthWeight: (character) => {
    const characterWeights = { 'a': 2.3333, 'b': 2.6111, 'c': 2.5000, 'd': 2.6111, 'e': 2.3333, 'f': 1.3333,
      'g': 2.6111, 'h': 2.6111, 'i': 1.0000, 'j': 1.0000, 'k': 2.3333, 'l': 1.0000, 'm': 4.0000, 'n': 2.6111,
      'o': 2.6111, 'p': 2.6111, 'q': 2.6111, 'r': 1.6667, 's': 2.0556, 't': 1.3333, 'u': 2.6111, 'v': 2.3333,
      'w': 3.3333, 'x': 2.3333, 'y': 2.3333, 'z': 2.0556, 'A': 3.7222, 'B': 3.7222, 'C': 3.7222, 'D': 4.0000,
      'E': 3.3333, 'F': 3.0556, 'G': 4.0000, 'H': 3.7222, 'I': 1.0000, 'J': 2.6667, 'K': 3.3333, 'L': 3.0556,
      'M': 4.2778, 'N': 3.7222, 'O': 4.0000, 'P': 3.3333, 'Q': 4.0000, 'R': 3.7222, 'S': 3.3333, 'T': 3.3333,
      'U': 3.7222, 'V': 3.3333, 'W': 5.0000, 'X': 3.3333, 'Y': 3.3333, 'Z': 3.0556, '0': 2.6111, '1': 2.3333,
      '2': 2.6111, '3': 2.6111, '4': 2.6111, '5': 2.6111, '6': 2.6111, '7': 2.6111, '8': 2.6111, '9': 2.6111,
      '.': 1.0000, ',': 1.0000, '-': 1.3333, '_': 1.6666, '+': 2.3333, '(': 1.3333, ')': 1.3333, "'": 1.0000,
      ' ': 1.3333, ':': 1.0000, '/': 1.3333, '\'': 1.3333, '#': 2.3333, '!': 1.0000, '?': 2.6111, '%': 2.3333,
    };
    const weight = characterWeights[character];
    if (!weight) throw `Need to add [${character}] to the characterWeights`;
    return weight;
  },
  getCellWidth: (cell, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    const cellObject = typeof cell === 'string'
      ? sheetObject.getRange(cell)
      : sheetObject.getRange(...cell);
    return sheetObject.getColumnWidth(cellObject.getColumn());
  },
  // Estimation made for Arial characters. Not that great with wrapping text or merged ranges
  getEstimatedCellWidth: (cell, sheet) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    const cellObject = typeof cell === 'string'
      ? sheetObject.getRange(cell)
      : sheetObject.getRange(...cell);
    const fontSize = cellObject.getFontSize();
    if (!cellObject.getWrap() || Generic_.isCellMerged(cell, sheet)) {
      return (cellObject.getFontWeight() === 'bold' ? 1.12 : 1.08)
        * Array.from(cellObject.getValue().toString()).reduce((sum, value) => {
          return sum + (0.29622 * fontSize - 0.00082) * Generic_.getCharLengthWeight(value);
        }, 0);
    }

    const averageLetterWidth = (cellObject.getFontWeight() === 'bold' ? 1.25 : 1.18)
      * (-0.00044 * fontSize * fontSize + 0.73133 * fontSize - 1.58596);
    const columnWidth = sheetObject.getColumnWidth(cellObject.getColumn());
    const maxCharsPerLine = columnWidth / averageLetterWidth;
    return 0.75 * fontSize * maxCharsPerLine;
  },
  getEstimatedColumnWidth: ({ column, sheet, lastRow, skipRows = [] }) => {
    const Generic_ = Generic();
    if (!Array.isArray(skipRows)) skipRows = [skipRows];
    return Array.from(
      { length: lastRow || Generic_.getSheet(sheet).getLastRow() },
      (_, index) => index + 1
    ).reduce((maxWidth, row) => {
      if (skipRows.includes(row)) return maxWidth;
      return Math.max(maxWidth, Generic_.getEstimatedCellWidth([row, column], sheet));
    }, 0);
  },
  // Estimation made for Arial characters. Not that great with wrapping text
  getEstimatedCellHeight: (cell, sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    const cellObject = typeof cell === 'string'
      ? sheetObject.getRange(cell)
      : sheetObject.getRange(...cell);
    const fontSize = cellObject.getFontSize();
    if (!cellObject.getWrap()) return 0.95 * (1.56185 * fontSize + 6.76107);

    const averageLetterWidth =
      (cellObject.getFontWeight() === 'bold' ? 1.25 : 1.18)
      * (-0.00044 * fontSize * fontSize + 0.73133 * fontSize - 1.58596);
    const columnWidth = sheetObject.getColumnWidth(cellObject.getColumn());
    const maxCharsPerLine = columnWidth / averageLetterWidth;
    const lineCount = Math.ceil(cellObject.getValue().toString().length / maxCharsPerLine);
    return 0.85 * (1.56185 * fontSize + 6.76107) * lineCount;
  },
  getEstimatedRowHeight: ({ row, sheet, lastColumn, skipColumns = [] }) => {
    const Generic_ = Generic();
    if (!Array.isArray(skipColumns)) skipColumns = [skipColumns];
    return Array.from(
      { length: lastColumn || Generic_.getSheet(sheet).getLastColumn() },
      (_, index) => index + 1
    ).reduce((maxHeight, column) => {
      if (skipColumns.includes(column)) return maxHeight;
      return Math.max(maxHeight, Generic_.getEstimatedCellHeight([row, column], sheet));
    }, 0);
  },
  getNamedRange: (names, { includeFormulas = false } = {}) => {
    const Generic_ = Generic();
    const getSpecificNamedRange = (name) => {
      const namedRangeFound = SpreadsheetApp.getActiveSpreadsheet()
        .getNamedRanges()
        .find((namedRange) => namedRange.getName() === name);
      if (!namedRangeFound) return {};

      const rangeFound = namedRangeFound.getRange();
      const sheet = rangeFound.getSheet().getName();
      const range = rangeFound.getA1Notation();
      return {
        sheet,
        range,
        value: Generic_.getValue(range, sheet),
        ...(includeFormulas && { formula: Generic_.getFormula(range, sheet) })
      };
    };
    const namedRanges = (Array.isArray(names) ? names : [names]).map((name) => {
      return getSpecificNamedRange(name);
    });
    return namedRanges.length > 1 ? namedRanges : namedRanges[0];
  },
  createOrUpdateNamedRange: (name, range) => {
    const [sheetName, targetRangeA1Notation] = range.split('!');
    const sheet = Generic().getSheet(sheetName);
    if (!sheet) return;

    const targetRange = sheet.getRange(targetRangeA1Notation);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    name = name.replace(/[-\s]/g, '_').replace(/[()]/g, '');
    if (/^\d/.test(name)) {
      const parts = name.split('_');
      name = [parts[1], ...parts.slice(2), parts[0]].join('_');
    }

    const namedRangeFound = spreadsheet.getNamedRanges().find((namedRange) => {
      return namedRange.getName() === name;
    });
    if (namedRangeFound) {
      const rangeFound = namedRangeFound.getRange();
      if (range !== `${rangeFound.getSheet().getName()}!${rangeFound.getA1Notation()}`) {
        namedRangeFound.setRange(targetRange);
      }
    } else spreadsheet.setNamedRange(name, targetRange);
  },
  removeAllNamedRanges: () => {
    SpreadsheetApp.getActiveSpreadsheet()
      .getNamedRanges()
      .forEach((range) => range.remove());
  },
  addConditionalFormatting: ({
    sheet,
    range,
    formula,
    fontColor = null,
    backgroundColor = null,
    bold = false,
    italic = false,
    underline = false,
    strikethrough = false
  }) => {
    const sheetObject = Generic().getSheet(sheet);
    const rule = SpreadsheetApp
      .newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setFontColor(fontColor)
      .setBackground(backgroundColor)
      .setBold(bold)
      .setItalic(italic)
      .setUnderline(underline)
      .setStrikethrough(strikethrough)
      .setRanges([sheetObject.getRange(range)])
      .build();
    sheetObject.setConditionalFormatRules([...sheetObject.getConditionalFormatRules(), rule]);
  },
  copyConditionalValidation: ({
    sourceID,
    sourceSheet,
    sourceRange = '',
    destinationSheet,
    destinationRange = ''
  }) => {
    const Convert_ = Convert(), Generic_ = Generic();
    const sourceRangeA1Notation = typeof sourceRange === 'object'
      ? sourceRange.getA1Notation()
      : sourceRange;
    const destinationRangeA1Notation = typeof destinationRange === 'object'
      ? destinationRange.getA1Notation()
      : destinationRange;
    if (!Generic_.compareRangeSizes(sourceRangeA1Notation, destinationRangeA1Notation)) {
      throw 'Both ranges must have the same dimensions and sizes';
    }

    const destinationSheetObject = Generic_.getSheet(destinationSheet || sourceSheet);
    const {
      startRow: startRowSource,
      startColumn: startColumnSource,
      endRow: endRowSource,
      endColumn: endColumnSource
    } = Convert_.toRowColumnNotation(sourceRangeA1Notation);
    const {
      startRow: startRowDestination,
      startColumn: startColumnDestination
    } = Convert_.toRowColumnNotation(destinationRangeA1Notation);
    const xTranspose = startRowSource !== undefined
      ? startRowDestination - startRowSource
      : 0;
    const yTranspose = startRowSource !== undefined
      ? startColumnDestination - startColumnSource
      : 0;
    const rules = [];
    Generic_.getSheet(sourceSheet, sourceID).getConditionalFormatRules().forEach((rule) => {
      const ruleRanges = [];
      rule.getRanges().forEach((range) => {
        const { row, column } = Convert_.toRowColumnNotation(range.getA1Notation());
        if (
          row >= (startRowSource || 1)
            && row <= (endRowSource || Number.MAX_SAFE_INTEGER)
            && column >= (startColumnSource || 1)
            && column <= (endColumnSource || Number.MAX_SAFE_INTEGER)
        ) ruleRanges.push([row + xTranspose, column + yTranspose]);
      });
      if (ruleRanges.length) {
        const condition = rule.getBooleanCondition();
        rules.push(
          SpreadsheetApp.newConditionalFormatRule()
            .whenFormulaSatisfied(condition.getCriteriaValues()[0])
            .setFontColor(condition.getFontColor())
            .setBackground(condition.getBackground())
            .setBold(condition.getBold())
            .setItalic(condition.getItalic())
            .setUnderline(condition.getUnderline())
            .setStrikethrough(condition.getStrikethrough())
            .setRanges(ruleRanges.map(([row, column]) => destinationSheetObject.getRange(row, column)))
            .build()
        );
      }
    });
    if (rules.length) {
      destinationSheetObject.setConditionalFormatRules([
        ...destinationSheetObject.getConditionalFormatRules(),
        ...rules
      ]);
    }
    return destinationSheetObject.getConditionalFormatRules();
  },
  copyRange: ({ sourceID, sourceSheet, sourceRange, destinationSheet, destinationRange }) => {
    const Convert_ = Convert(), Generic_ = Generic();
    if (typeof sourceSheet === 'string') sourceSheet = Generic_.getSheet(sourceSheet, sourceID);
    if (!destinationSheet || typeof destinationSheet === 'string') {
      destinationSheet = Generic_.getSheet(destinationSheet || sourceSheet);
    }
    if (typeof sourceRange === undefined) sourceRange = sourceSheet.getDataRange();
    if (typeof sourceRange === 'string') sourceRange = sourceSheet.getRange(sourceRange);
    if (typeof destinationRange === undefined) destinationRange = destinationSheet.getDataRange();
    if (typeof destinationRange === 'string') destinationRange = destinationSheet.getRange(destinationRange);
    if (!Generic_.compareRangeSizes(sourceRange.getA1Notation(), destinationRange.getA1Notation())) {
      throw 'Both ranges must have the same dimensions and sizes';
    }

    const {
      startRow: sourceRow,
      startColumn: sourceColumn
    } = Convert_.toRowColumnNotation(sourceRange.getA1Notation());
    const {
      startRow: destinationRow,
      startColumn: destinationColumn
    } = Convert_.toRowColumnNotation(destinationRange.getA1Notation());
    const xTranspose = sourceRow !== undefined ? destinationRow - sourceRow : 0;
    const yTranspose = sourceRow !== undefined ? destinationColumn - sourceColumn : 0;

    const sourceValues = sourceRange.getValues();
    const sourceFormulas = sourceRange.getFormulas();
    for (let row = 0; row < sourceValues.length; row++) {
      for (let column = 0; column < sourceValues[row].length; column++) {
        const formula = sourceFormulas[row][column];
        if (formula) sourceValues[row][column] = formula;
      }
    }
    const borderStyles = Generic_.getBorderStyles(sourceRange, sourceSheet);

    destinationRange
      .setValues(sourceValues)
      .setFontSizes(sourceRange.getFontSizes())
      .setFontColors(sourceRange.getFontColors())
      .setBackgrounds(sourceRange.getBackgrounds())
      .setFontWeights(sourceRange.getFontWeights())
      .setFontStyles(sourceRange.getFontStyles())
      .setHorizontalAlignments(sourceRange.getHorizontalAlignments())
      .setVerticalAlignments(sourceRange.getVerticalAlignments())
      .setWrapStrategies(sourceRange.getWrapStrategies())
      .setDataValidations(sourceRange.getDataValidations());
    Generic_.setBorderStyles(destinationRange, borderStyles, destinationSheet);
    Generic_.copyConditionalValidation({
      sourceID,
      sourceSheet,
      sourceRange,
      destinationSheet,
      destinationRange
    });

    const sourceMergedRanges = sourceRange.getMergedRanges();
    for (let i = 0; i < sourceMergedRanges.length; i++) {
      const sourceMergedRange = sourceMergedRanges[i];
      destinationSheet.getRange(
        sourceMergedRange.getRow() + xTranspose,
        sourceMergedRange.getColumn() + yTranspose,
        sourceMergedRange.getNumRows(),
        sourceMergedRange.getNumColumns()
      ).merge();
    }
  },
  getBorderStyle: (cell, direction, sheet) => {
    const borderTypes = ['top', 'left', 'bottom', 'right'];
    if (!borderTypes.includes(direction.toLowerCase())) {
      throw `Border direction has to be one of: ${borderTypes.join(', ')}`;
    }

    const Convert_ = Convert();
    const border = Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert_.toA1Notation(...cell)
    ).getBorder();
    if (!border) return;
    return border[`get${Convert_.toPascalCase(direction)}`]().getBorderStyle();
  },
  setBorderStyle: (cell, direction, type, sheet) => {
    const lowerCaseDirection = direction.toLowerCase();
    const borderTypes = ['top', 'left', 'bottom', 'right'];
    if (!borderTypes.includes(lowerCaseDirection)) {
      throw `Border direction has to be one of: ${borderTypes.join(', ')}`;
    }

    if (typeof type === 'string') type = SpreadsheetApp.BorderStyle[type.toUpperCase()];
    Generic().getSheet(sheet).getRange(
      typeof cell === 'string'
        ? cell
        : Convert().toA1Notation(...cell)
    ).setBorder(
      ...borderTypes.map((type) => {
        if (type === lowerCaseDirection) return true;
        return null;
      }),
      null,
      null,
      '#000000',
      type
    );
  },
  getBorderStyles: (range, sheet) => {
    const Convert_ = Convert(), Generic_ = Generic();
    const {
      startRow,
      startColumn,
      endRow,
      endColumn
    } = Convert_.toRowColumnNotation(
      typeof range === 'string'
        ? range
        : range.getA1Notation()
    );

    const borderData = {};
    for (let row = startRow; row <= endRow; row++) {
      for (let column = startColumn; column <= endColumn; column++) {
        const cellBorderData = {};
        ['top', 'left', 'bottom', 'right'].forEach((direction) => {
          cellBorderData[direction] = Generic_.getBorderStyle(
            [row, column],
            direction,
            sheet
          );
        });
        borderData[Convert_.toA1Notation(row, column)] = cellBorderData;
      }
    }
    return borderData;
  },
  setBorderStyles: (range, types = {}, sheet) => {
    const Convert_ = Convert(), Generic_ = Generic();
    const normalizedTypes = Object.values(JSON.parse(JSON.stringify(types)));
    const {
      startRow,
      startColumn,
      endRow,
      endColumn
    } = Convert_.toRowColumnNotation(
      typeof range === 'string'
        ? range
        : range.getA1Notation()
    );

    let index = 0;
    for (let row = startRow; row <= endRow; row++) {
      for (let column = startColumn; column <= endColumn; column++) {
        const cell = Convert_.toA1Notation(row, column);
        const { top, left, bottom, right } = normalizedTypes[index++];
        if (top) Generic_.setBorderStyle(cell, 'top', top, sheet);
        if (left) Generic_.setBorderStyle(cell, 'left', left, sheet);
        if (bottom) Generic_.setBorderStyle(cell, 'bottom', bottom, sheet);
        if (right) Generic_.setBorderStyle(cell, 'right', right, sheet);
      }
    }
  },
  addHorizontalBorder: ({
    sheet,
    row,
    aboveRange,
    type = SpreadsheetApp.BorderStyle.SOLID_MEDIUM,
    lastColumn
  }) => {
    const sheetObject = Generic().getSheet(sheet);
    const range = sheetObject.getRange(
      row || sheetObject.getRange(aboveRange).getRowIndex(),
      1,
      1,
      lastColumn || sheetObject.getLastColumn()
    );
    if (typeof type === 'string') type = SpreadsheetApp.BorderStyle[type];
    range.setBorder(true, null, null, null, null, null, '#000000', type);
  },
  getSerializableRowData: (row, sheet) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    const rowRange = sheetObject.getRange(`${row}:${row}`);
    const rowLength = rowRange.getWidth();

    const borders = [];
    for (let column = 0; column < rowLength; column++) {
      const cell = [row, column + 1];
      const top = Generic_.getBorderStyle(cell, 'top', sheetObject)
        || Generic_.getBorderStyle([row - 1, column + 1], 'bottom', sheet);
      const bottom = Generic_.getBorderStyle(cell, 'bottom', sheetObject)
        || Generic_.getBorderStyle([row + 1, column + 1], 'top', sheet);
      borders.push({ ...(top && { top }), ...(bottom && { bottom }) });
    }

    return {
      values: rowRange.getValues(),
      formulas: rowRange.getFormulas(),
      backgrounds: rowRange.getBackgrounds(),
      fontColors: rowRange.getFontColorObjects()
        .map((row) => row.map((cell) => cell.asRgbColor().asHexString())),
      fontFamilies: rowRange.getFontFamilies(),
      fontSizes: rowRange.getFontSizes(),
      fontLines: rowRange.getFontLines(),
      fontStyles: rowRange.getFontStyles(),
      fontWeights: rowRange.getFontWeights(),
      horizontalAlignments: rowRange.getHorizontalAlignments(),
      verticalAlignments: rowRange.getVerticalAlignments(),
      textDirections: rowRange.getTextDirections(),
      textRotations: rowRange.getTextRotations()
        .map((row) => row.map((cell) => cell.getDegrees())),
      wrapStrategies: rowRange.getWrapStrategies(),
      mergedRanges: rowRange.getMergedRanges().map((range) => {
        return range.getA1Notation();
      }),
      borders
    };
  },
  getSerializableColumnData: (column, sheet) => {
    const Generic_ = Generic();
    const columnInA1 = Convert().toA1Notation(1, column).slice(0, -1);
    const sheetObject = Generic_.getSheet(sheet);
    const columnRange = sheetObject.getRange(`${columnInA1}:${columnInA1}`);
    const columnLength = columnRange.getHeight();

    const borders = [];
    for (let row = 0; row < columnLength; row++) {
      const cell = [row + 1, column];
      const top = Generic_.getBorderStyle(cell, 'top', sheetObject)
        || Generic_.getBorderStyle([row, column], 'bottom', sheet);
      const left = Generic_.getBorderStyle(cell, 'left', sheetObject)
        || Generic_.getBorderStyle([row + 1, column - 1], 'right', sheet);
      const bottom = Generic_.getBorderStyle(cell, 'bottom', sheetObject)
        || Generic_.getBorderStyle([row + 2, column], 'top', sheet);
      const right = Generic_.getBorderStyle(cell, 'right', sheetObject)
        || Generic_.getBorderStyle([row + 1, column + 1], 'left', sheet);
      borders.push({
        ...(top && { top }),
        ...(left && { left }),
        ...(bottom && { bottom }),
        ...(right && { right })
      });
    }

    return {
      values: columnRange.getValues(),
      formulas: columnRange.getFormulas(),
      backgrounds: columnRange.getBackgrounds(),
      fontColors: columnRange.getFontColorObjects()
        .map((row) => row.map((cell) => cell.asRgbColor().asHexString())),
      fontFamilies: columnRange.getFontFamilies(),
      fontSizes: columnRange.getFontSizes(),
      fontLines: columnRange.getFontLines(),
      fontStyles: columnRange.getFontStyles(),
      fontWeights: columnRange.getFontWeights(),
      horizontalAlignments: columnRange.getHorizontalAlignments(),
      verticalAlignments: columnRange.getVerticalAlignments(),
      textDirections: columnRange.getTextDirections(),
      textRotations: columnRange.getTextRotations()
        .map((row) => row.map((cell) => cell.getDegrees())),
      wrapStrategies: columnRange.getWrapStrategies(),
      mergedRanges: columnRange.getMergedRanges().map((range) => {
        return range.getA1Notation();
      }),
      columnWidth: sheetObject.getColumnWidth(column),
      borders
    };
  },
  unwrap: (value) => typeof value === 'function' ? value() : value,
  countMethodExecuteTime: ({ callback, notification = true }) => {
    const start = new Date().getTime();
    const returnValue = callback();
    const end = new Date().getTime();
    const executeTime = (end - start) / 1000;
    if (notification) console.log(`Execution time was: ${executeTime} seconds.`);
    return { returnValue, executeTime };
  },
  wait: (seconds) => {
    SpreadsheetApp.flush();
    Utilities.sleep(seconds * 1000);
  }
});
