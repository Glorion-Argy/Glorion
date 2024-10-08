const _automationPrivate = () => ({
  getExistingAttributeData: ({ sheet = 'Attributes', cache }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    return Object.entries(cache).reduce((total, [attribute, cell]) => {
      if (attribute === 'Death Saves') {
        const deathSaveData = Object.entries(cell).reduce((total, [cellType, cellList]) => {
          return {
            ...total,
            [cellType]: cellList.map((cellItem) => Generic_.getValue(cellItem, sheetObject))
          };
        }, []);
        return { ...total, [attribute]: deathSaveData };
      }
      if (typeof cell !== 'string' || sheetObject.getRange(cell).getFormula()) {
        return total;
      }
      return { ...total, [attribute]: Generic_.getValue(cell, sheetObject) };
    }, {});
  },
  getExistingCheckProficiencies: ({ sheet = 'Checks', cache }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    const skills = {}, savingThrows = {};
    const saveProficiency = (name, cell, objectToSave) => {
      if (!name || !cell || !objectToSave) return;
      const proficiency = Generic_.getValue(cell, sheetObject);
      if (proficiency !== '-') objectToSave[name] = proficiency;
    };

    Object.entries(cache).forEach(([name, data]) => {
      if (name === 'Saving Throws') {
        Object.entries(data).forEach(([name, { proficiency }]) => {
          saveProficiency(name, proficiency, savingThrows);
        });
      } else saveProficiency(name, data.proficiency, skills);
    });
    return { skills, savingThrows };
  },
  getExistingItems: (sheet = 'Inventory') => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    const grid = sheetObject.getDataRange().getValues();
    const itemData = {};
    for (const [_, name, count, ...rest] of grid) {
      if (!name || name === 'Name') continue;
      const note = rest.at(-1).toString();
      const actualCount = (!count || isNaN(count))
        ? count
        : parseInt(count);
      itemData[name] = note
        ? { count: actualCount, note }
        : actualCount;
    }
    return itemData;
  },
  getExistingCharacterData: ({ sheet = 'Character', cache }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    return Object.entries(cache).reduce((total, [attribute, cell]) => {
      return { ...total, [attribute]: Generic_.getValue(cell, sheetObject) };
    }, {});
  },
  getExistingProficiencyData: (sheet = 'Proficiencies') => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    const existingProficiencies = [], exoticWeapons = [];
    const grid = sheetObject.getDataRange().getValues();
    const names = grid.map(([proficiency]) => proficiency);
    const exoticIndex = names.indexOf('Exotic');
    const toolsIndex = names.indexOf('Tools');
    for (const [row, [proficiency, toggle]] of grid.entries()) {
      if (toggle === true) {
        if (row > exoticIndex && row < toolsIndex) {
          exoticWeapons.push(proficiency);
        } else existingProficiencies.push(proficiency);
      }
    }
    return { existingProficiencies, exoticWeapons };
  },
  getExistingVariables: (sheet = 'Variables') => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject || Generic_.getSheet('Character Creation')) return {};

    const variableData = {};
    const dataRange = sheetObject.getDataRange();
    const formulas = dataRange.getFormulas();
    dataRange.getValues().forEach(([name, value], row) => {
      variableData[name] = formulas[row][1] || value;
    });
    return variableData;
  },
  createMenuButton: ({ callback, setupDataNormalizer, ...rest }) => {
    const Data_ = Data(), IO_ = IO();
    const databaseID = Data_.databaseID();
    if (!databaseID) {
      return IO_.notify({ message: 'Please fill in your Database ID' });
    }
    const itemsKey = Data_.itemsKey();
    if (!itemsKey) {
      return IO_.notify({ message: 'Please fill in your Items Key' });
    }
    const characterSetup = Data_.characterSetup();
    if (!Object.keys(characterSetup).length) {
      return IO_.notify({
        message: 'Please make your character choices by clicking on "Create Character"'
      });
    }

    callback({
      databaseID,
      itemsKey,
      ...(setupDataNormalizer
        ? setupDataNormalizer(characterSetup)
        : characterSetup
      ),
      ...rest
    });
    Generic().refreshAllSheets();
    const { sheetName, mobile } = rest;
    if (sheetName) {
      IO_.notify({ message: `Successfully updated ${sheetName} sheet.`, mobile });
    }
  },
  createClassSpecificFieldsForAttributes: ({
    databaseID,
    sourceSheetName = 'Class Attributes',
    sheetName = 'Attributes',
    choices,
    selectedClass,
    race,
    level,
    path
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const validQueryRows = [];
    const { sourceSheet } = Automation().query({
      sourceID: databaseID,
      source: sourceSheetName,
      conditions: {
        'Class': (value) => ['', selectedClass].includes(value),
        'Race': (value) => !value || value.includes(race),
        'Level': (value) => (value || 0) <= level,
        'Path': (value) => !value || (path && value.includes(path)),
        'Choice': (value, row) => {
          if (!value || choices.includes(value)) validQueryRows.push(row);
        }
      },
      includeFormulas: true
    });

    const Generic_ = Generic();
    const destinationSheet = Generic_.getSheet(sheetName);
    if (!destinationSheet) return;
    const grid = sourceSheet.getRange(
      1,
      1,
      sourceSheet.getMaxRows(),
      sourceSheet.getMaxColumns()
    ).getValues();
    const metadata = grid[0];
    const cellColumn = metadata.indexOf('Cell') + 1;
    if (!cellColumn) return;
    const fieldsColumn = metadata.indexOf('Fields') + 1;
    if (!fieldsColumn) return;

    const isCellMergedOrHasContent = ({ value, row, column, sheet }) => {
      return (value === undefined ? grid[row][column] : value) !== ''
        || Generic_.isCellMerged([row + 1, column + 1], sheet);
    };

    const Convert_ = Convert();
    for (let row = 1; row < grid.length; row += 2) {
      if (!validQueryRows.includes(row + 1)) continue;
      let lastColumn = grid[row].length;
      for (let column = fieldsColumn; column < grid[row].length; column++) {
        if (!isCellMergedOrHasContent({ row, column, sheet: sourceSheet })) {
          lastColumn = column;
          break;
        }
      }
      const sourceRange = sourceSheet.getRange(
        row + 1,
        fieldsColumn,
        2,
        lastColumn - fieldsColumn + 1
      );
      const {
        row: destinationRow,
        column: destinationColumn
      } = Convert_.toRowColumnNotation(Generic_.getValue([row + 1, cellColumn], sourceSheet));
      const destinationRange = destinationSheet.getRange(
        destinationRow,
        destinationColumn,
        sourceRange.getNumRows(),
        sourceRange.getNumColumns()
      );
      Generic_.copyRange({
        sourceID: databaseID,
        sourceSheet,
        sourceRange,
        destinationSheet,
        destinationRange
      });
    }

    const emptyRows = [];
    destinationSheet.getDataRange().getValues().forEach(([firstValue], row) => {
      if (
        !isCellMergedOrHasContent({
          value: firstValue,
          row,
          column: 0,
          sheet: destinationSheet
        })
      ) emptyRows.push(row + 1);
    });
    if (emptyRows.length) {
      Generic_.deleteRows(emptyRows, destinationSheet);
    }
  },
  initializeAttributeValues: ({
    sheet = 'Attributes',
    level,
    attributes,
    existingAttributeData = {},
    extraConfig = {},
    onInitializeAttribute
  }) => {
    const Generic_ = Generic();
    Generic_.refreshSheet('Inventory');
    const sheetObject = Generic_.getSheet(sheet);
    const grid = sheetObject.getDataRange().getValues();
    const attributesConfig = {
      'Level': level,
      'Hit Dice': level,
      'HP': 1,
      'STR': attributes['Strength'],
      'DEX': attributes['Dexterity'],
      'CON': attributes['Constitution'],
      'INT': attributes['Intelligence'],
      'WIS': attributes['Wisdom'],
      'CHA': attributes['Charisma'],
      ...extraConfig
    };

    for (let row = 0; row < grid.length; row += 2) {
      for (let column = 0; column < grid[row].length; column++) {
        const value = grid[row][column];
        if (value === 'Death Saves') {
          const {
            'Successes': successes,
            'Failures': failures
          } = existingAttributeData[value] || {};
          if (!successes || !failures) continue;
          const firstThrowColumn = grid[row].findIndex((item) => {
            return typeof item === 'boolean';
          });
          if (firstThrowColumn === -1) continue;
          for (let index = 0; index < successes.length; index++) {
            Generic_.setValue(
              [row + 1, index + firstThrowColumn + 1],
              successes[index],
              sheetObject
            );
            Generic_.setValue(
              [row + 2, index + firstThrowColumn + 1],
              failures[index],
              sheetObject
            );
          }
          continue;
        }
        if (onInitializeAttribute && onInitializeAttribute({
          sheet: sheetObject,
          grid,
          value,
          row,
          column,
          existingAttributeData
        })) continue;
        const attributeFound = existingAttributeData[value] ?? attributesConfig[value];
        if (attributeFound !== undefined) {
          Generic_.setValue([row + 2, column + 1], attributeFound, sheetObject);
        }
      } 
    }
  },
  finalizeAttributeValues: ({ sheet = 'Attributes', finalizeValuesConfig = [] }) => {
    const Generic_ = Generic();
    if (!Generic_.getSheet('Character Creation')) return;

    const allValuesConfig = [
      { current: 'HP', max: 'Max_HP' },
      { current: 'Hit_Dice', max: 'Max_Hit_Dice' },
      { current: 'Slots', max: 'Max_Slots' },
      ...finalizeValuesConfig
    ];
    allValuesConfig.forEach(({ current, max }) => {
      const [
        { range: currentRange } = {},
        { value: maxValue } = {}
      ] = Generic_.getNamedRange([current, max]);
      if (currentRange && maxValue && maxValue !== '#REF!') {
        Generic_.setValue(currentRange, maxValue, sheet);
      }
    });
  },
  formatAttributesSheet: ({ sheet = 'Attributes', mobile = false }) => {
    const Generic_ = Generic();
    IO().notify({ message: 'Formatting Attributes sheet...', mobile });
    const sheetObject = Generic_.getSheet(sheet);
    const maxColumns = sheetObject.getMaxColumns();
    const allRange = sheetObject.getRange(1, 1, sheetObject.getMaxRows(), maxColumns);
    const grid = allRange.getValues();
    const isCellMergedOrHasContent = (row, column) => {
      return grid[row][column] !== ''
        || Generic_.isCellMerged([row + 1, column + 1], sheetObject);
    };

    const filledRanges = [], emptyRanges = [];
    for (let row = 0; row < grid.length - 1; row += 2) {
      for (let column = 0; column < grid[row].length; column++) {
        if (isCellMergedOrHasContent(row, column) || isCellMergedOrHasContent(row + 1, column)) {
          if (column === grid[row].length - 1) {
            filledRanges.push(sheetObject.getRange(row + 1, 1, 2, column));
          }
          continue;
        }
        filledRanges.push(sheetObject.getRange(row + 1, 1, 2, column));
        emptyRanges.push(sheetObject.getRange(row + 1, column + 1, 2, maxColumns - column));
        break;
      }
    }

    for (let i = 0; i < emptyRanges.length; i++) {
      const ranges = [emptyRanges[i].getA1Notation()];
      for (let j = i + 1; j < emptyRanges.length; j++) {
        if (emptyRanges[i].getNumColumns() !== emptyRanges[j].getNumColumns()) {
          i = j - 1;
          break;
        }
        ranges.push(emptyRanges[j].getA1Notation());
      }
      sheetObject
        .getRange(`${ranges[0].split(':')[0]}:${ranges.at(-1).split(':')[1]}`)
        .merge()
        .setBorder(false, false, false, false, false, false);
    }

    for (let i = 0; i < filledRanges.length; i++) {
      filledRanges[i].setBorder(
        true,
        true,
        true,
        true,
        null,
        null,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );
    }
    allRange.setBorder(
      true,
      true,
      true,
      true,
      null,
      null,
      '#000000',
      SpreadsheetApp.BorderStyle.SOLID_THICK
    );
    sheetObject
      .getRange(grid.length, 1, 1, maxColumns)
      .setBorder(
        true,
        null,
        null,
        null,
        null,
        null,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );
    return { filledRanges, emptyRanges };
  },
  getAttributeButtonData: ({
    databaseID,
    selectedClass,
    sheet = 'Attribute Buttons'
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!selectedClass) selectedClass = Data_.selectedClass();

    const sheetObject = Generic().getSheet(sheet, databaseID);
    const metadataConfig = {
      'Offset X': ['xOffset'],
      'Offset Y': ['yOffset'],
      'Row Transpose After Row': ['afterRow'],
      'Row Transpose Increment': ['rowIncrement']
    };
    const { grid, metadata } = Cache().generateMetadata({
      sheet: sheetObject,
      rowLength: 2, metadataConfig
    });

    const nameIndex = metadata.indexOf('name');
    if (nameIndex === -1) {
      throw `${sheetObject.getName()} sheet requires a "Name" column`;
    }
    const classIndex = metadata.indexOf('class');
    if (classIndex === -1) {
      throw `${sheetObject.getName()} sheet requires a "Class" column`;
    }
    const cellIndex = metadata.indexOf('cell');
    const scriptIndex = metadata.indexOf('script');
    const scaleIndex = metadata.indexOf('scale');
    const xOffsetIndex = metadata.indexOf('xOffset');
    const yOffsetIndex = metadata.indexOf('yOffset');
    const afterRowIndex = metadata.indexOf('afterRow');
    const rowIncrementIndex = metadata.indexOf('rowIncrement');

    const buttonData = {};
    grid.slice(2).forEach((row) => {
      const name = row[nameIndex];
      const currentClass = row[classIndex];
      if ((!name && !currentClass) || !['', selectedClass].includes(currentClass)) {
        return;
      }

      if (!name) {
        buttonData.transpose = {
          ...(afterRowIndex !== -1 && { afterRow: row[afterRowIndex] }),
          ...(rowIncrementIndex !== -1 && { rowIncrement: row[rowIncrementIndex] })
        };
      } else if (currentClass || !buttonData[selectedClass]) {
        buttonData[name] = {
          ...(cellIndex !== -1 && { cell: row[cellIndex] }),
          ...(scriptIndex !== -1 && { script: row[scriptIndex] }),
          ...(scaleIndex !== -1 && { scale: row[scaleIndex] }),
          ...(xOffsetIndex !== -1 && { xOffset: row[xOffsetIndex] }),
          ...(yOffsetIndex !== -1 && { yOffset: row[yOffsetIndex] })
        };
      }
    });
    return buttonData;
  },
  createButtonsForAttributesSheet: ({
    databaseID = Data().databaseID(),
    sheet = 'Attributes',
    buttonData = {},
    mobile = false
  }) => {
    IO().notify({ message: 'Creating attribute buttons...', mobile });
    const sheetObject = Generic().getSheet(sheet);
    if (!sheetObject) return;

    const { transpose, ...restData } = buttonData;
    if (transpose) {
      const { afterRow, rowIncrement } = transpose;
      if (afterRow !== undefined && rowIncrement) {
        Object.values(restData).forEach((data) => {
          data.cell = data.cell.replace(/\d+$/, (match) => {
            const row = parseInt(match);
            return row + (row >= afterRow ? rowIncrement : 0);
          });
        });
      }
    }

    const Drive_ = Drive();
    Object.entries(restData).forEach(([imageTag, { cell, script, scale, xOffset, yOffset }]) => {
      Drive_.createButton({
        databaseID,
        sheet: sheetObject,
        cell,
        imageTag,
        script,
        scale,
        xOffset,
        yOffset
      });
    });
  },
  getActionableItems: ({
    sheetName = 'Inventory',
    categories = ['Consumables', 'Attunements']
  } = {}) => {
    const inventoryValues = Generic().getSheetValues(sheetName);
    const actionableItems = [];
    let currentCategory;
    inventoryValues.forEach((row) => {
      if (row[0]) currentCategory = row[0];
      if (categories.includes(currentCategory) && row[2]) {
        actionableItems.push(row[1]);
      }
    });
    return actionableItems;
  },
  generateSpellDataForButtons: ({ sheet, grid, firstRowSize = 1 }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const firstGridRow = grid[0];
    const scriptIndex = firstGridRow.indexOf('Script');
    if (scriptIndex === -1) return {};

    const spells = {};
    const imageIndex = firstGridRow.indexOf('Image');
    const scaleIndex = firstGridRow.indexOf('Scale');
    const widthIndex = firstGridRow.indexOf('Width');
    const allIndexes = [
      scriptIndex,
      imageIndex,
      scaleIndex,
      widthIndex
    ].filter((index) => index > -1);
    for (let row = firstRowSize; row < grid.length; row++) {
      const script = grid[row][scriptIndex];
      if (!script) continue;
      const imageTag = grid[row][imageIndex] || 'Use';
      const scale = grid[row][scaleIndex] || 0.7;
      const width = grid[row][widthIndex] || 50;
      spells[script] = { imageTag, scale, width, row: row + 1 };
    }

    Generic_.deleteColumns(allIndexes.map((index) => index + 1), sheet);
    grid.forEach((row) => {
      for (let index = allIndexes.length - 1; index >= 0; index--) {
        row.splice(allIndexes[index], 1);
      }
    });
    return spells;
  },
  addItemsAndBaselineHorizontalBorders: ({
    sheet,
    grid,
    items,
    lastRow,
    lastColumn,
    firstRowSize = 1,
    baselineAbilityCount,
    firstBaselineAbilityName,
    raceAbilityCount = 0,
    backgroundAbilityCount = 0,
    extraClassAbilityCount = 0
  }) => {
    const Generic_ = Generic();
    const addBorder = (row, type) => {
      Generic_.addHorizontalBorder({ sheet, row, type, lastColumn });
    };
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const abilities = grid.map(([row]) => row);
    lastRow = lastRow || sheetObject.getLastRow();
    lastColumn = lastColumn || sheetObject.getLastColumn();

    let firstItemRow;
    for (const [row, ability] of abilities.entries()) {
      if (!ability) continue;
      const itemRow = items.findIndex((item) => item === ability);
      if (itemRow !== -1) {
        firstItemRow = row + 1;
        break;
      }
    }
    if (firstItemRow) addBorder(firstItemRow);

    let firstBaselineAbilityRow;
    if (baselineAbilityCount) {
      firstBaselineAbilityRow = lastRow - baselineAbilityCount + 1;
    } else if (firstBaselineAbilityName) {
      for (const [row, ability] of abilities.entries()) {
        if (!ability) continue;
        if (ability === firstBaselineAbilityName) {
          firstBaselineAbilityRow = row + 1;
          break;
        }
      }
    }
    if (firstBaselineAbilityRow && firstBaselineAbilityRow > firstRowSize + 1) {
      addBorder(firstBaselineAbilityRow, SpreadsheetApp.BorderStyle.SOLID_THICK);
    }
    if (raceAbilityCount && !firstBaselineAbilityRow) {
      addBorder(lastRow - backgroundAbilityCount - raceAbilityCount + 1);
    }
    if (backgroundAbilityCount) {
      addBorder(lastRow - backgroundAbilityCount + 1, SpreadsheetApp.BorderStyle.DOUBLE);
    }
    if (extraClassAbilityCount) {
      addBorder(
        lastRow - backgroundAbilityCount - raceAbilityCount - extraClassAbilityCount + 1,
        SpreadsheetApp.BorderStyle.DOUBLE
      );
    }
  },
  getMobileDropdownOptions: ({
    databaseID,
    sheetName,
    choices,
    spellConfig = {},
    selectedClass,
    race,
    level,
    path
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheetName, databaseID);
    if (!sheetObject) return [];
    const mobileColumn = sheetObject
      .getDataRange()
      .getValues()[0]
      .indexOf('Mobile') + 1;
    if (!mobileColumn) return [];
    const actionableItems = _automationPrivate().getActionableItems();
    const titleColumnName = Convert().toSingular(sheetName);

    const { results } = Automation().query({
      sourceID: databaseID,
      source: sheetName,
      conditions: {
        'Tags': spellConfig.tags || ((value) => (getColumn) => {
          if (getColumn('Path') !== 'Item') return true;
          return actionableItems.find((item) => {
            return item === (value || getColumn(titleColumnName));
          });
        }),
        'Class': spellConfig.selectedClass || ((value) => ['', selectedClass].includes(value)),
        'Race': spellConfig.race || ((value) => !value || value.includes(race)),
        'Level': spellConfig.level || ((value) => (value || 0) <= level),
        'Path': spellConfig.path || ((value) => {
          return !value
            || (path && value.includes(path))
            || (actionableItems.length && value === 'Item');
        }),
        'Choice': (value) => (getColumn) => {
          const title = getColumn(titleColumnName);
          return !value
            || choices.includes(value)
            || (value === true && choices.some((choice) => ['All', title].includes(choice)));
        },
        'Script': (value) => {
          if (sheetName.includes('Bonus Actions')
            && !Generic_.doesValueExist('Off-handed Combat', 'Passives')
          ) return value !== 'OffHand';
          return true;
        }
      },
      ignoreColumns: Array.from(
        { length: sheetObject.getLastColumn() },
        (_, i) => i + 1
      ).filter((number) => number !== mobileColumn)
    });
    return results.flat().filter(Boolean);
  },
  mergeRangesBasedOnQuery: ({
    sheet,
    sourceSheet,
    mergedRows = {},
    mergedColumns = {},
    firstRowSize = 1
  }) => {
    const Convert_ = Convert(), Generic_ = Generic();
    Object.values(mergedRows).forEach(({ row, sourceRow, length: rowLength }) => {
      Object.values(mergedColumns).forEach(({ column, sourceColumn, length: columnLength }) => {
        Generic_.getSheet(sourceSheet)
          .getRange(sourceRow, sourceColumn, rowLength, columnLength)
          .getMergedRanges()
          .forEach((range) => {
            const {
              startRow,
              startColumn,
              endRow,
              endColumn
            } = Convert_.toRowColumnNotation(range.getA1Notation());
            Generic_.getSheet(sheet).getRange(
              startRow - sourceRow + row + firstRowSize,
              startColumn - sourceColumn + column,
              endRow - startRow + 1,
              endColumn - startColumn + 1
            ).merge();
          });
      });
    });
  },
  trimSheet: (sheet) => {
    const sheetObject = Generic().getSheet(sheet);
    const lastRow = sheetObject.getLastRow();
    const lastColumn = sheetObject.getLastColumn();
    const maxRows = sheetObject.getMaxRows();
    const maxColumns = sheetObject.getMaxColumns();
    if (lastRow < maxRows) {
      sheetObject.deleteRows(lastRow + 1, maxRows - lastRow);
    }
    if (lastColumn < maxColumns) {
      sheetObject.deleteColumns(lastColumn + 1, maxColumns - lastColumn);
    }
    return { lastRow, lastColumn };
  },
  formatSheet: ({
    sheet,
    fontSize = 10,
    fontStyle = 'normal',
    fontWeight = 'normal',
    color
  }) => {
    const range = Generic().getSheet(sheet).getDataRange();
    range
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID
      )
      .setBorder(
        true,
        true,
        true,
        true,
        null,
        null,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID_THICK
      )
      .setVerticalAlignment('middle')
      .setFontFamily('Arial')
      .setFontSize(fontSize)
      .setFontStyle(fontStyle)
      .setFontWeight(fontWeight)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    if (color) range.setBackground(color);
  },
  formatFirstColumn: ({
    sheet,
    columnSize = 1,
    fontSize = 12,
    fontStyle = 'normal',
    fontWeight = 'bold',
    color,
    lastRow
  }) => {
    const sheetObject = Generic().getSheet(sheet);
    const range = sheetObject.getRange(
      1,
      1,
      lastRow || sheetObject.getLastRow(),
      columnSize
    );
    range.setBorder(
      null,
      null,
      null,
      true,
      false,
      null,
      '#000000',
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
    range.setFontSize(fontSize);
    range.setFontStyle(fontStyle);
    range.setFontWeight(fontWeight);
    if (color) range.setBackground(color);
  },
  formatFirstRow: ({
    sheet,
    grid,
    rowSize = 1,
    fontSize = 14,
    fontStyle = 'normal',
    fontWeight = 'bold',
    color,
    lastColumn,
    firstRowSize = 1,
    exceptions = {}
  }) => {
    const sheetObject = Generic().getSheet(sheet);
    const range = sheetObject.getRange(
      1,
      1,
      rowSize,
      lastColumn || sheetObject.getLastColumn()
    );
    range.setBorder(
      null,
      null,
      true,
      null,
      null,
      null,
      '#000000',
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
    range.setFontSize(fontSize);
    range.setFontStyle(fontStyle);
    range.setFontWeight(fontWeight);
    if (color) range.setBackground(color);

    if (!grid) grid = sheetObject.getDataRange().getValues();
    Object.entries(exceptions).forEach(([
      key,
      { multipleLined, fontSize, fontStyle, fontWeight, color }
    ]) => {
      if (multipleLined && firstRowSize === 1) return;
      const index = grid[0].indexOf(key);
      if (index === -1) return;
      let columnLength = 1;
      for (let column = index + 1; (column < grid[0].length) && !grid[0][column]; column++) {
        columnLength++;
      }
      const range = sheetObject.getRange(1, index + 1, firstRowSize, columnLength);
      if (fontSize) range.setFontSize(fontSize);
      if (fontStyle) range.setFontStyle(fontStyle);
      if (fontWeight) range.setFontWeight(fontWeight);
      if (color) range.setBackground(color);
    });
  },
  formatLastColumn: ({ sheet, lastColumn }) => {
    const sheetObject = Generic().getSheet(sheet);
    const range = sheetObject.getRange(
      1,
      lastColumn || sheetObject.getLastColumn(),
      sheetObject.getMaxRows(),
      1
    );
    range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  },
  formatCentralColumns: ({ sheet, firstColumnSize = 2, lastRow, lastColumn }) => {
    const sheetObject = Generic().getSheet(sheet);
    lastRow = lastRow || sheetObject.getLastRow();
    lastColumn = lastColumn || sheetObject.getLastColumn();
    if (lastColumn - firstColumnSize < 2) return;
    sheetObject.getRange(
      1,
      firstColumnSize + 1,
      lastRow,
      lastColumn - firstColumnSize - 1
    ).setHorizontalAlignment('center');
  },
  formatEffectColumns: ({ sheet, grid, lastRow, firstRowSize = 1 }) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const metadata = grid[0];
    const effectColumn = metadata.indexOf('Effect') + 1;
    if (effectColumn) {
      const range = sheetObject.getRange(
        firstRowSize + 1,
        effectColumn,
        (lastRow || sheetObject.getLastRow()) - firstRowSize,
        metadata[effectColumn] ? 1 : 2
      );
      range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    }
  },
  formatAmmoColumns: ({ sheet, grid, lastRow, firstRowSize = 1 }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const ammoIndex = grid[0].indexOf('Ammo');
    lastRow = lastRow || sheetObject.getLastRow();
    if (ammoIndex === -1) return;

    const Convert_ = Convert();
    for (let row = firstRowSize; row < lastRow; row++) {
      if (!grid[row][ammoIndex]) continue;
      const dropdownCell = sheet.getRange(row + 1, ammoIndex + 1);
      const validationStartCell = Convert_.toA1Notation(firstRowSize + 1, ammoIndex + 3);
      const validationRange = sheet.getRange(
        `${validationStartCell}:${validationStartCell.replace(/\d/g, '')}`
      );
      dropdownCell.setDataValidation(
        SpreadsheetApp
          .newDataValidation()
          .requireValueInRange(validationRange)
      );
    }
    sheet.setColumnWidth(ammoIndex + 1, sheet.getColumnWidth(ammoIndex + 1) + 20);
    Generic_.hideColumns([ammoIndex + 3], sheetObject);
  },
  formatSpellLevelColumn: ({ sheet, grid, firstRowSize = 1 }) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const spellLevelIndex = grid[0].indexOf('Spell Level');
    if (spellLevelIndex === -1) return;

    for (let row = firstRowSize; row < grid.length; row++) {
      const spellLevel = grid[row][spellLevelIndex];
      if (!spellLevel) continue;
      sheet
        .getRange(row + 1, spellLevelIndex + 1)
        .setFontSize(18)
        .setFontWeight('bold');
    }
  },
  formatSlotsColumn: ({ sheet, grid, firstRowSize = 1 }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const slotsColumn = grid[0].indexOf('Slots') + 1;
    if (!slotsColumn) return 0;

    const rowCount = grid.length;
    sheetObject.insertColumns(slotsColumn);
    for (const [index, row] of grid.entries()) {
      row.splice(slotsColumn, 0, grid[index][slotsColumn - 1]);
    }
    Generic_.mergeRange({
      sheet: sheetObject,
      startCell: [1, slotsColumn],
      rowLength: 1,
      columnLength: 2,
      outOfBoundsCheck: false
    });
    sheetObject.setColumnWidths(slotsColumn, 2, 32);
    sheetObject
      .getRange(1, slotsColumn, rowCount, 1)
      .setBorder(
        null,
        null,
        null,
        true,
        null,
        null,
        '#000000',
        SpreadsheetApp.BorderStyle.DASHED
      );

    for (let row = firstRowSize; row < rowCount; row++) {
      const mergedRange = Generic_.getMergedCells([row + 1, slotsColumn + 1], sheetObject);
      const slotsValue = grid[row][slotsColumn - 1];
      if (slotsValue && slotsValue !== '-') {
        Generic_.setValue([row + 1, slotsColumn], slotsValue, sheet);
        if (mergedRange) {
          const [startRow, endRow] = mergedRange
            .split(':')
            .map((cell) => cell.replace(/[^0-9]/g, ''));
          sheetObject.getRange(row + 1, slotsColumn, endRow - startRow + 1, 1).merge();
          row += endRow - startRow;
        }
        if (Generic_.isCellMerged([row + 1, 1]) && row >= firstRowSize && row < rowCount - 1) {
          Generic_.setBorderStyle(
            [row + 1, slotsColumn],
            'bottom',
            SpreadsheetApp.BorderStyle.SOLID,
            sheetObject
          );
        }
      } else {
        if (mergedRange) {
          const [startRow, endRow] = mergedRange
            .split(':')
            .map((cell) => cell.replace(/[^0-9]/g, ''));
          sheetObject.getRange(row + 1, slotsColumn, endRow - startRow + 1, 2).merge();
          row += endRow - startRow;
        } else sheetObject.getRange(row + 1, slotsColumn, 1, 2).merge();
      }
    }
    return 1;
  },
  formatMetadata: ({ sheet, grid, firstRowSize = 1 }) => {
    const sheetObject = Generic().getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    for (let column = 0; column < grid[0].length; column++) {
      let rowLength = 1;
      let columnLength = 1;
      for (let r = 1; r < firstRowSize && !grid[r][column]; r++) {
        columnLength++;
      }
      for (let c = column + 1; c < grid[0].length && !grid[0][c]; c++) {
        rowLength++;
      }
      if (rowLength !== 1 || columnLength !== 1) {
        sheet.getRange(1, column + 1, columnLength, rowLength).merge();
      }
      column += rowLength - 1;
    }
  },
  createAttributesNamedRanges: ({
    cache,
    sheet = 'Attributes',
    excludedNamedRanges = [],
    mobile = false
  }) => {
    const Generic_ = Generic();
    if (!Generic_.getSheet(sheet)) return;
    if (!cache) cache = Cache().getCache({ sheet });
    IO().notify({ message: 'Creating attribute variables...', mobile });
    const totalExcludedNamedRanges = [
      'Death Saves',
      'Roll History',
      ...excludedNamedRanges
    ];
    for (const [name, cell] of Object.entries(cache)) {
      if (totalExcludedNamedRanges.includes(name)) continue;
      Generic_.createOrUpdateNamedRange(name, `Attributes!${cell}`);
    }

    const Convert_ = Convert();
    const attributeCells = [];
    const abbreviations = Object.keys(Static().attributeAbbreviations());
    abbreviations.forEach((abbreviation) => {
      attributeCells.push(cache[abbreviation]);
      attributeCells.push(cache[`${abbreviation} Modifier`]);
    });
    if (attributeCells.length) {
      const getRangeAbove = (range) => {
        const { row, column } = Convert_.toRowColumnNotation(range);
        return Convert_.toA1Notation(row - 1, column);
      };

      attributeCells.sort();
      const fromRange = attributeCells[0];
      const toRange = attributeCells.at(-1);
      Generic_.createOrUpdateNamedRange(
        'Attributes_Names',
        `Attributes!${getRangeAbove(fromRange)}:${getRangeAbove(toRange)}`
      );
      Generic_.createOrUpdateNamedRange(
        'Attributes_Modifiers',
        `Attributes!${fromRange}:${toRange}`
      );
    }
    const {
      'Successes': successes,
      'Failures': failures
    } = cache['Death Saves'];
    if (successes) {
      successes.sort();
      Generic_.createOrUpdateNamedRange(
        'Death_Save_Successes',
        `Attributes!${successes[0]}:${successes.at(-1)}`
      );
    }
    if (failures) {
      failures.sort()
      Generic_.createOrUpdateNamedRange(
        'Death_Save_Failures',
        `Attributes!${failures[0]}:${failures.at(-1)}`
      );
    }
  },
  createChecksNamedRanges: ({ cache, sheet = 'Checks', mobile = false }) => {
    const Generic_ = Generic();
    if (!Generic_.getSheet(sheet)) return;
    if (!cache) cache = Cache().getCache({ sheet });
    IO().notify({ message: 'Creating checks variables...', mobile });
    for (const [checkType, checkInfo] of Object.entries(cache)) {
      if (checkType === 'Saving Throws') {
        for (const [savingThrowType, { modifier }] of Object.entries(checkInfo)) {
          Generic_.createOrUpdateNamedRange(
            `${savingThrowType}_Save_Modifier`,
            `Checks!${modifier}`
          );
        }
        continue;
      }
      Generic_.createOrUpdateNamedRange(
        `${checkType}_Modifier`,
        `Checks!${checkInfo.modifier}`
      );
    }
  },
  createAbilitiesNamedRanges: ({ sheetName, namedRangesConfig = {} }) => {
    const Generic_ = Generic();
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet) return;

    const Convert_ = Convert();
    const grid = sheet.getDataRange().getValues();
    const firstRow = grid[0];
    const firstColumn = grid.map(([firstItem]) => firstItem);
    const getIndex = (item, list) => {
      if (typeof item === 'number') return item;
      if (typeof item === 'string') return list.indexOf(item) + 1;
      if (Array.isArray(item)) {
        for (const itemPart of item) {
          const answer = getIndex(itemPart, list);
          if (answer) return answer;
        }
      }
    };

    (Array.isArray(namedRangesConfig) ? namedRangesConfig : [namedRangesConfig])
      .forEach(({ row, column, name }) => {
        if (!row || !column || !name) return;
        const columnIndex = getIndex(column, firstRow);
        if (!columnIndex) return;
        const rowIndex = getIndex(row, firstColumn);
        if (!rowIndex) return;
        Generic_.createOrUpdateNamedRange(
          name,
          `${sheetName}!${Convert_.toA1Notation(rowIndex, columnIndex)}`
        );
      });
    Generic_.createOrUpdateNamedRange(
      `${Convert_.toSingular(sheetName)}_Abilities`.replace(' ', '_'),
      `${sheetName}!A:A`
    );
  },
  createCharacterNamedRanges: ({ cache, sheet = 'Character', mobile = false }) => {
    const Generic_ = Generic();
    if (!Generic_.getSheet(sheet)) return;
    if (!cache) cache = Cache().getCache({ sheet });
    IO().notify({ message: 'Creating character variables...', mobile });
    Object.entries(cache).forEach(([name, cell]) => {
      Generic_.createOrUpdateNamedRange(name, `Character!${cell}`);
    });
  },
  createVariableNamedRanges: ({ mobile = false }) => {
    const Generic_ = Generic();
    const sheet = Generic_.getSheet('Variables');
    if (!sheet) return;
    IO().notify({ message: 'Creating variables...', mobile });
    for (const [index, [variable]] of sheet.getDataRange().getValues().entries()) {
      if (variable) {
        Generic_.createOrUpdateNamedRange(variable, `Variables!B${index + 1}`);
      }
    }
  },
  createAdditionalVariables: (extraAdditionalVariables = []) => {
    const Convert_ = Convert(), Generic_ = Generic();
    const getRange = (
      columnName,
      defaultValue,
      {
        sheetName = 'Inventory',
        rowCountModifier = -1,
        startFromRow = 2,
        rowTranspose = 0,
        endColumnName
      } = {}
    ) => {
      const sheet = Generic_.getSheet(sheetName);
      const metadata = sheet.getDataRange().getValues()[0];
      const rowCount = sheet.getLastRow() + rowCountModifier;
      const column = metadata.indexOf(columnName) + 1 + rowTranspose;
      const startCell = Convert_.toA1Notation(startFromRow, column || defaultValue);
      const endCell = endColumnName !== undefined
        ? Convert_.toA1Notation(
          startFromRow,
          (metadata.indexOf(endColumnName) + 1) || defaultValue
        )
        : startCell;
      return `${sheetName}!${startCell}:${endCell.replaceAll(/[0-9]/g, '')}${rowCount}`;
    };

    const additionalVariables = [
      ...Static().actionSheets().map((sheet) => {
        const singularName = Convert_.toSingular(sheet);
        return {
          name: `${singularName}_Abilities`.replace(' ', '_'),
          range: getRange(singularName, 1, {
            sheetName: sheet, rowCountModifier: -0, startFromRow: 1
          })
        };
      }),
      { name: 'Proficiencies_All', range: getRange('Armor', 1, {
        sheetName: 'Proficiencies', rowCountModifier: 0, startFromRow: 1, endColumnName: ''
      }) },
      { name: 'Inventory_All', range: getRange('Name', 2, { endColumnName: 'Metadata' }) },
      { name: 'Inventory_Items', range: getRange('Name', 2) },
      { name: 'Inventory_Counts', range: getRange('#', 3) },
      { name: 'Inventory_Costs', range: getRange('Cost', 4) },
      { name: 'Inventory_Weights', range: getRange('Weight', 5) },
      { name: 'Inventory_Metadata', range: getRange('Metadata', 8) },
      { name: 'Inventory_Armor', range: getRange('Armor', 9) },
      { name: 'Inventory_Armor_Helper', range: getRange('Armor', 10, { rowTranspose: 1 }) },
      { name: 'Inventory_Main-Hand', range: getRange('Main-hand', 11) },
      { name: 'Inventory_Off_Hand', range: getRange('Off-hand', 12) },
      ...extraAdditionalVariables
    ];
    additionalVariables.forEach(({ name, range }) => {
      Generic_.createOrUpdateNamedRange(name, range);
    });
  },
  mergeWithNextColumn: ({ sheet, grid, columnName, startAfterRow }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    const column = grid[0].indexOf(columnName);
    if (column === -1 || grid[0][column + 1]) return;

    const Convert_ = Convert();
    startAfterRow = startAfterRow || (!grid[0][1] ? 2 : 1);
    for (let row = startAfterRow; row < grid.length; row++) {
      const firstMergedCell = Generic_.getFirstMergedCell([row + 1, column + 2], sheetObject);
      if (
        grid[row][column + 1] === '' && (
          !firstMergedCell
            || firstMergedCell === Convert_.toA1Notation(row + 1, column + 2)
        )
      ) {
        const { rowLength } = Generic_.mergeRange({
          sheet: sheetObject,
          startCell: [row + 1, column + 1],
          rowLength: 1,
          columnLength: 2,
          outOfBoundsCheck: false
        });
        row += rowLength - 1;
      }
    }
  },
  mergeMultipleRowAbilities: ({
    sheet,
    grid,
    mergedRows = {},
    startAfterRow,
    startAfterColumn,
    lastColumn,
    ignoreColumns = []
  }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    if (!Array.isArray(ignoreColumns)) ignoreColumns = [ignoreColumns];
    const formattedIgnoreColumns = ignoreColumns.map((key) => {
      return Generic_.findKeyColumn(key, grid[0]);
    });
    startAfterRow = startAfterRow || (!grid[0][1] ? 2 : 1);
    startAfterColumn = startAfterColumn || (!grid[1][0] ? 3 : 2);
    lastColumn = lastColumn || sheetObject.getLastColumn();
    const firstColumn = grid.map(([row]) => row);

    const duplicates = Object.values(mergedRows).map(({ row, length }) => {
      return { row: row + startAfterRow, length };
    });
    if (!duplicates.length) {
      for (let row = startAfterRow; row < firstColumn.length; row++) {
        const previousItem = firstColumn[row - 1];
        if (firstColumn[row] === previousItem) {
          let length = 2;
          for (let innerRow = row + 1; innerRow < firstColumn.length; innerRow++) {
            if (firstColumn[innerRow] === firstColumn[row - 1]) {
              length++;
            } else break;
          }
          duplicates.push({ row, length });
          row += length - 1;
        }
      }
    }

    const fillInHeights = (row, length) => {
      const estimatedRowHeights = [];
      for (let innerRow = row; innerRow < row + length; innerRow++) {
        estimatedRowHeights.push(
          Generic_.getEstimatedRowHeight({
            row: innerRow,
            sheet: sheetObject,
            lastColumn,
            skipColumns: lastColumn
          })
        );
      }

      const descriptionCellHeight = Generic_.getEstimatedCellHeight(
        [row, lastColumn],
        sheetObject
      );
      const totalEstimatedRowHeight = estimatedRowHeights.reduce((total, height) => {
        return total + height;
      }, 0);
      if (descriptionCellHeight >= Math.max(...estimatedRowHeights) * length) {
        for (let i = 0; i < length; i++) {
          estimatedRowHeights[i] = descriptionCellHeight / length;
        }
      } else if (descriptionCellHeight > totalEstimatedRowHeight) {
        let heightLeft = descriptionCellHeight - totalEstimatedRowHeight;
        estimatedRowHeights.sort((a, b) => a - b);
        for (let i = 0; i < length - 1; i++) {
          const currentHeight = estimatedRowHeights[i];
          const nextHeight = estimatedRowHeights?.[i + 1];
          const heightDifference = nextHeight - currentHeight;
          const heightIncrement = heightLeft / (i + 1);
          const heightCost = heightDifference * (i + 1);
          if (heightLeft < heightCost) {
            for (let j = 0; j <= i; j++) {
              estimatedRowHeights[j] += heightIncrement;
            }
            break;
          }
          for (let j = 0; j <= i; j++) {
            estimatedRowHeights[j] += heightDifference;
          }
          heightLeft -= heightCost;
        }
      }
      estimatedRowHeights.forEach((height, index) => {
        sheetObject.setRowHeight(row + index, height);
      });
    };

    duplicates.forEach(({ row, length }) => {
      fillInHeights(row, length);
      Generic_.mergeRange({
        sheet: sheetObject,
        startCell: [row, 1],
        rowLength: length,
        overwriteValues: true
      });
      for (let column = startAfterColumn; column < lastColumn; column++) {
        if (
          formattedIgnoreColumns.includes(column + 1)
            || Generic_.isCellMerged([row, column + 1], sheetObject)
        ) continue;
        let mergedLength = 1;
        for (let innerRow = row; innerRow < row + length - 1; innerRow++) {
          if (
            grid[innerRow][column]
              || Generic_.isCellMerged([innerRow + 1, column + 1], sheetObject)
          ) break;
          mergedLength++;
        }
        if (mergedLength > 1) {
          sheetObject.getRange(row, column + 1, mergedLength, 1).merge();
        }
      }
    });
  },
  mergeTrackersAndAddDashes: ({
    sheet,
    grid,
    startAfterRow,
    startAfterColumn,
    ignoreColumns = []
  }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!grid) grid = sheetObject.getDataRange().getValues();
    if (!Array.isArray(ignoreColumns)) ignoreColumns = [ignoreColumns];
    const trackerColumnExists = !grid[0][2];
    const formattedIgnoreColumns = ignoreColumns.map((key) => {
      return Generic_.findKeyColumn(key, grid[0]);
    });
    startAfterRow = startAfterRow || (trackerColumnExists ? 2 : 1);
    startAfterColumn = startAfterColumn || (!grid[1][0] ? 3 : 2);
    if (trackerColumnExists) {
      sheetObject.getRange(1, 2, grid.length, 1).setFontSize(15);
    }

    const ignoreRows = [];
    for (let row = startAfterRow; row < grid.length; row++) {
      if (grid[row][1] === '' && !ignoreRows.includes(row + 1)) {
        const mergedRange = Generic_.getMergedCells([row + 1, 1], sheetObject);
        if (mergedRange) {
          const [startRow, endRow] = mergedRange.split(':').map((cell) => {
            return cell.replace(/[^0-9]/g, '');
          });
          if (trackerColumnExists) {
            sheetObject.getRange(row + 1, 1, endRow - startRow + 1, 2).merge();
          }
          sheetObject
            .getRange(row + 1, startAfterColumn, endRow - startRow + 1, 1)
            .setBorder(null, null, null, null, null, false);
          ignoreRows.push(
            ...Array.from({ length: endRow - startRow }, (_, index) => index + row + 2)
          );
        } else if (trackerColumnExists) {
          sheetObject.getRange(row + 1, 1, 1, 2).merge();
        }
      }
      for (let column = startAfterColumn; column < grid[row].length; column++) {
        if (formattedIgnoreColumns.includes(column + 1)) continue;
        if (grid[row][column] === '') {
          Generic_.setValue([row + 1, column + 1], '-', sheet);
        }
      }
    }
    return grid;
  },
  normalizeChoiceList: ({
    data,
    type,
    config,
    callback,
    allowChoice = true,
    uniqueResult = false
  }) => {
    if (!data) return [];
    const getGroup = (item) => {
      const itemWithoutCount = item.replace(/[0-9]/g, '').trim();
      for (const group in config) {
        if (itemWithoutCount !== group) continue;
        const groupFound = config[group];
        if (groupFound) {
          return { tag: group, data: groupFound };
        }
      }
      return {};
    };

    const dataArray = [], titles = [];
    (typeof data === 'string' ? data.split(', ') : data).forEach((data) => {
      if (!data.includes(':')) {
        dataArray.push(data);
        titles.push(undefined);
        return;
      }
      const [tag, item] = data.split(':').map((d) => d.trim());
      titles.push(tag);
      dataArray.push(item);
    });

    const Private = _automationPrivate();
    const result = dataArray.reduce((total, item, index) => {
      const title = titles[index];
      const { tag, data } = getGroup(item);
      if (data) {
        const count = item.replace(/[^0-9]/g, '');
        const dataWithoutCount = allowChoice
          ? {
            data: callback
              ? data.map((item) => callback(item))
              : data,
            type,
            tag,
            ...(title && { title })
          }
          : data.map((item) => {
            return {
              data: callback
                ? callback(item)
                : item,
              type,
              tag,
              ...(title && { title })
            };
          });
        if (!count) {
          return allowChoice
            ? [...total, dataWithoutCount]
            : [...total, ...dataWithoutCount];
        }
        const dataWithCount = Array.from(
          { length: parseInt(count) },
          () => dataWithoutCount
        );
        return allowChoice
          ? [...total, ...dataWithCount]
          : [...total, ...dataWithCount.flat()];
      }
      if (item.includes(' or ')) {
        const itemChoice = Private.normalizeChoiceList({
          data: item.split(' or '),
          type,
          config,
          callback,
          allowChoice,
          uniqueResult
        });
        const tag = itemChoice.reduce((total, { tag }) => {
          if (tag && total !== undefined) {
            return `${total} or ${tag}`;
          }
        }, '');
        return allowChoice
          ? [...total, {
              data: itemChoice.reduce((total, { data }) => {
                return [
                  ...total,
                  ...(typeof data === 'string' ? [data]: data)
                ];
              }, []),
              type,
              ...(tag && { tag: tag.slice(4) }),
              ...(title && { title })
            }]
          : [...total, ...itemChoice];
      }
      return [
        ...total,
        {
          data: callback
            ? callback(item)
            : item,
          type,
          ...(title && { title })
        }
      ];
    }, []);

    if (uniqueResult) {
      return [
        ...new Set(result.map((item) => JSON.stringify(item)))
      ].map((item) => JSON.parse(item));
    }
    return result;
  },
  askForChoices: ({
    inputData,
    ascending,
    excludeResults = true,
    choiceType,
    ignoreTags = false,
    messageCallback,
    optionModifier,
    selectedClass,
    race,
    background,
    mobile = false
  }) => {
    if (!inputData) return;
    if (!inputData.length) return [];

    const getSelectionType = (type) => {
      switch (type) {
        case 'Class':
          return `${type} (${selectedClass})`;
        case 'Race':
          return `${type}  (${race})`;
        case 'Background':
          return `${type}  (${background})`;
        default:
          return type;
      }
    };

    const choices = [], choiceData = [];
    inputData.forEach((inputItem) => {
      if (typeof inputItem.data === 'string') {
        choices.push(inputItem.data);
      } else choiceData.push(inputItem);
    });
    if (ascending !== undefined) {
      choiceData.sort(({ data: d1 }, { data: d2 }) => {
        return (ascending ? 1 : -1) * (d1.length - d2.length);
      });
    }

    const IO_ = IO();
    for (const { data, type, tag, title } of choiceData) {
      if (!data.length) continue;
      const options = data.filter((option) => !choices.includes(option));
      if (!options.length) continue;
      if (options.length === 1) {
        choices.push(options[0]);
        continue;
      }
      const selectedOption = IO_.askForAnswerFromList({
        title: `${title ? `${title} ` : ''}${
          (tag && !ignoreTags) ? `${tag} ` : ''
        }${choiceType} - ${getSelectionType(type)}`,
        ...(messageCallback && { message: messageCallback({ choices, data, title }) }),
        options: data,
        optionModifier,
        ...(excludeResults && { excludeOptions: choices }),
        mobile,
        loopLimit: 10
      });
      if (!selectedOption) return;
      choices.push(title ? `${title}: ${selectedOption}` : selectedOption);
    }

    return choices;
  },
  abstractSetupMethod: ({
    classConfig = {},
    raceConfig = {},
    backgroundConfig = {},
    title,
    normalizeConfig = {},
    choiceConfig = {},
    extraInputData = [],
    uniqueChoices = false,
    mobile = false
  }) => {
    const Private = _automationPrivate();
    const getSelectionData = (config) => {
      const { data, metadata } = config;
      if (data && data.length) {
        return data[metadata.indexOf(title)];
      }
      return [];
    };
    const uniquefy = (data) => {
      const uniqueKeys = new Set(), uniqueData = [];
      for (const item of data) {
        const dataValue = item.data;
        if (typeof dataValue !== 'string') uniqueData.push(item);
        else if (!uniqueKeys.has(dataValue)) {
          uniqueKeys.add(dataValue);
          uniqueData.push(item);
        }
      }
      return uniqueData;
    };
    const normalize = (data, type) => {
      return Private.normalizeChoiceList({
        data: getSelectionData(data),
        type,
        ...normalizeConfig
      });
    };

    const inputData = [
      ...normalize(classConfig, 'Class'),
      ...normalize(raceConfig, 'Race'),
      ...normalize(backgroundConfig, 'Background'),
      ...extraInputData
    ];
    const choices = Private.askForChoices({
      inputData: uniqueChoices
        ? uniquefy(inputData)
        : inputData,
      selectedClass: classConfig.selection,
      race: raceConfig.selection,
      background: backgroundConfig.selection,
      mobile,
      ...choiceConfig
    });
    if (!choices) return;
    return choices;
  },
  setupClassRaceBackground: ({
    classGrid,
    classMetadata,
    raceGrid,
    raceMetadata,
    backgroundGrid,
    backgroundMetadata,
    setupResult,
    updateResult,
    descriptions = [],
    classes = [],
    races = [],
    backgrounds = [],
    mobile = false
  } = {}) => {
    let { background, backgroundVariant } = setupResult;
    if (backgroundVariant || backgroundVariant === '') return true;

    const IO_ = IO();
    const classDescriptionIndex = classMetadata.indexOf('Descriptions');
    const classDescriptions = classGrid.slice(1).reduce((total, row) => {
      return { ...total, [row[0]]: row[classDescriptionIndex] };
    }, {});
    const raceDescriptionIndex = raceMetadata.indexOf('Descriptions');
    const raceDescriptions = raceGrid.slice(1).reduce((total, row) => {
      return { ...total, [row[0]]: row[raceDescriptionIndex] };
    }, {});
    const backgroundDescriptionIndex = backgroundMetadata.indexOf('Descriptions');
    const backgroundDescriptions = backgroundGrid.slice(1).reduce((total, row) => {
      return { ...total, [row[0]]: row[backgroundDescriptionIndex] };
    }, {});
    const variantsIndex = backgroundMetadata.indexOf('Variants');
    const allVariants = backgroundGrid.slice(1).reduce((total, row) => {
      const variants = row[variantsIndex];
      if (!variants) return total;
      return [...total, ...variants.split(', ')];
    }, []);
    const newLine = IO_.getNewLineChar(mobile);
    const spacedNewLine = `${newLine}\u00A0\u00A0\u00A0\u00A0`;

    const classRaceBackgroundConfig = [
      {
        type: 'Class',
        options: classes,
        descriptions: classDescriptions,
        key: 'selectedClass'
      },
      {
        type: 'Race',
        options: races,
        descriptions: raceDescriptions,
        key: 'race'
      },
      {
        type: 'Background',
        options: backgrounds.filter((background) => {
          return !allVariants.includes(background);
        }),
        descriptions: backgroundDescriptions,
        key: 'background'
      }
    ];
    for (const { type, options, descriptions, key } of classRaceBackgroundConfig) {
      if (Object.keys(setupResult).includes(key)) continue;
      const answer = IO_.askForAnswerFromList({
        title: `Select a ${type}`,
        options,
        optionModifier: (option) => {
          const description = descriptions[option];
          if (!description) return `${option}${spacedNewLine}`;
          return `${option}: ${description}${spacedNewLine}`;
        },
        mobile,
        loopLimit: 10
      });
      if (!answer) return;
      if (key === 'background') background = answer;
      updateResult({ [key]: answer });
    }

    const backgroundData = backgroundGrid[
      backgroundGrid.map(([row]) => row).indexOf(background)
    ];
    const variants = backgroundData[variantsIndex];
    if (!variants) {
      updateResult({ backgroundVariant: '' });
      return true;
    }

    const variantList = variants.split(', ');
    if (variantList.length === 1) {
      const variant = variantList[0];
      const description = descriptions.find(({ name }) => name === variant)?.description
        || backgroundDescriptions[variant];
      const question = `Would you like to choose the ${variant} variant instead?`;
      const variantAnswer = IO_.askForYesOrNo({
        title: `${variant} Variant - Background (${background})?`,
        message: description
          ? `${description}${newLine}${newLine}${question}`
          : question,
        mobile,
        loopLimit: 10
      });
      if (variantAnswer === undefined) return;
      updateResult({ backgroundVariant: variantAnswer ? variant : '' });
      return true;
    }

    const noVariantOption = 'No Variant';
    const variantAnswer = IO_.askForAnswerFromList({
      title: `Variant - Background (${background})?`,
      options: [noVariantOption, ...variantList],
      optionModifier: (option) => {
        const description = descriptions.find(({ name }) => name === option)?.description
          || backgroundDescriptions[option];
        if (!description) return `${option}${newLine}`;
        return `${option}: ${description}${newLine}`;
      },
      mobile,
      loopLimit: 10
    });
    if (!variantAnswer) return;
    updateResult({
      backgroundVariant: variantAnswer === noVariantOption
        ? ''
        : variantAnswer
    });
    return true;
  },
  setupClassRaceChoices: ({
    classConfig,
    raceConfig,
    descriptions = [],
    extraConfig = {},
    mobile = false
  }) => {
    const Private = _automationPrivate();
    const newLine = IO().getNewLineChar(mobile);
    const normalizeConfig = {
      config: { ...extraConfig }
    };
    const choiceConfig = {
      excludeResults: false,
      choiceType: 'Ability',
      messageCallback: ({ title }) => {
        if (!title) return;
        const foundAbility = descriptions.find(({ name }) => name === title);
        if (!foundAbility) return;
        return foundAbility.description;
      },
      optionModifier: (option) => {
        const foundAbility = descriptions.find(({ name }) => name === option);
        if (!foundAbility) return option;
        return `${option}: ${foundAbility.description}${newLine}`;
      }
    };
    const classAbilities = Private.abstractSetupMethod({
      classConfig,
      title: 'Abilities',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!classAbilities) return;
    const raceAbilities = Private.abstractSetupMethod({
      raceConfig,
      title: 'Abilities',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!raceAbilities) return;
    return { abilities: [...classAbilities, ...raceAbilities] };
  },
  setupAttributes: ({
    raceConfig,
    standardArray = [15, 14, 13, 12, 10, 8],
    attributeOptions = [],
    mobile = false
  }) => {
    const IO_ = IO();
    const {
      data: raceData,
      metadata: raceMetadata,
      selection: race
    } = raceConfig;
    const attributes = {
      'Strength': 0,
      'Dexterity': 0,
      'Constitution': 0,
      'Intelligence': 0,
      'Wisdom': 0,
      'Charisma': 0
    };
    const attributesIncreased = { ...attributes };
    const strengthIndex = raceMetadata.indexOf('Strength');
    const raceAttributes = raceData.slice(strengthIndex, attributeOptions.length + 1);
    const raceAttributeMetadata = raceMetadata.slice(
      strengthIndex,
      attributeOptions.length + 1
    );
    for (let i = 0; i < raceAttributeMetadata.length; i++) {
      attributesIncreased[raceAttributeMetadata[i]] += raceAttributes[i];
    }

    const attributeOptionsUsed = [];
    for (const [index, attributeNumber] of standardArray.entries()) {
      if (index === standardArray.length - 1) {
        attributes[
          attributeOptions.filter((attribute) => {
            return !attributeOptionsUsed.includes(attribute);
          })
        ] += attributeNumber;
        break;
      }
      const attributeChosen = IO_.askForAnswerFromList({
        title: `Select your [${attributeNumber}] Attribute`,
        options: attributeOptions,
        excludeOptions: attributeOptionsUsed,
        optionModifier: (attribute) => {
          const increment = attributesIncreased[attribute];
          return `${attribute}: ${attributes[attribute]}${
            increment ? ` (${increment > 0 ? '+' : ''}${increment})` : ''
          }`; 
        },
        mobile,
        loopLimit: 10
      });
      if (!attributeChosen) return;
      const attributeName = attributeChosen.split(':')[0];
      attributeOptionsUsed.push(attributeName);
      attributes[attributeName] += attributeNumber;
    }

    const chooseIndex = raceMetadata.indexOf('Choose Attribute');
    const [chooseCount, chooseOptions] = raceData
    .slice(chooseIndex, chooseIndex + 2)
    .map((item) => {
        if (item) return (typeof item === 'number' ? item : item.split(', '));
      });
    if (chooseCount) {
      const attributeOptionsIncreased = attributeOptions.filter((option) => {
        return !chooseOptions.includes(option);
      });
      for (let i = 0; i < chooseCount; i++) {
        const attributeChosen = IO_.askForAnswerFromList({
          title: `Select ${i ? 'another' : 'an'} attribute to give a +1 score, ` +
            `based on chosen race (${race})`,
          options: attributeOptions,
          excludeOptions: attributeOptionsIncreased,
          optionModifier: (attribute) => {
            const increment = attributesIncreased[attribute];
            return `${attribute}: ${attributes[attribute]}${
              increment ? ` (${increment > 0 ? '+' : ''}${increment})` : ''
            }`; 
          },
          mobile,
          loopLimit: 10
        });
        if (!attributeChosen) return;
        const attributeName = attributeChosen.split(':')[0];
        attributeOptionsIncreased.push(attributeName);
        attributesIncreased[attributeName]++;
      }
    }

    Object.entries(attributesIncreased).forEach(([attribute, value]) => {
      attributes[attribute] += value;
    });
    return { attributes };
  },
  setupSkills: ({
    classConfig,
    raceConfig,
    backgroundConfig,
    skillOptions = [],
    extraConfig = {},
    mobile = false
  }) => {
    const formatSkills = (skills) => skills.reduce((total, skill) => {
      return { ...total, [skill]: 'Proficient' };
    }, {});
    const { data: classData, metadata: classMetadata } = classConfig;
    const normalizeConfig = {
      config: { 'Choose': skillOptions, ...extraConfig }
    };
    const choiceConfig = {
      ascending: true,
      choiceType: 'Skill Proficiency',
      ignoreTags: true,
      messageCallback: ({ choices: skills }) => {
        return `Skills learned: ${skills.length ? `[${skills.join(', ')}]` : ''}`;
      }
    };
    const chooseIndex = classMetadata.indexOf('Choose Skill');
    const [chooseCount, chooseOptions] = classData
      .slice(chooseIndex, chooseIndex + 2)
      .map((skill) => {
        return typeof skill === 'number'
          ? skill
          : skill.split(', ');
      });
    const extraInputData = Array.from(
      { length: parseInt(chooseCount) },
      () => ({ data: chooseOptions, type: 'Class' })
    );

    const skills = _automationPrivate().abstractSetupMethod({
      classConfig,
      raceConfig,
      backgroundConfig,
      title: 'Skills',
      normalizeConfig,
      choiceConfig,
      extraInputData,
      uniqueChoices: true,
      mobile
    });
    if (!skills) return;
    return {
      skills: formatSkills(skills),
      savingThrows: formatSkills(
        classData[classMetadata.indexOf('Saving Throws')].split(', ')
      )
    };
  },
  setupProficiencies: ({
    classConfig,
    raceConfig,
    backgroundConfig,
    simpleMelee = [],
    simpleRanged = [],
    martialMelee = [],
    martialRanged = [],
    landVehicles = [],
    mechanicalVehicles = [],
    waterborneVehicles = [],
    extraConfig = {},
    mobile = false
  }) => {
    const normalizeConfig = {
      config: {
        'Simple Melee': simpleMelee,
        'Simple Ranged': simpleRanged,
        'Martial Melee': martialMelee,
        'Martial Ranged': martialRanged,
        'Simple': [...simpleMelee, ...simpleRanged],
        'Martial': [...martialMelee, ...martialRanged],
        'Land Vehicles': landVehicles,
        'Mechanical Vehicles': mechanicalVehicles,
        'Waterborne Vehicles': waterborneVehicles,
        ...extraConfig
      },
      allowChoice: false
    };
    const choiceConfig = { ascending: true, choiceType: 'Proficiency' };
    const proficiencies = _automationPrivate().abstractSetupMethod({
      classConfig,
      raceConfig,
      backgroundConfig,
      title: 'Proficiencies',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!proficiencies) return;
    return { 'proficiencies': [...new Set(proficiencies)] };
  },
  setupTools: ({
    classConfig,
    raceConfig,
    backgroundConfig,
    artisanTools = [],
    instruments = [],
    gamingSets = [],
    miscellaneous = [],
    extraConfig = {},
    mobile = false
  }) => {
    const normalizeConfig = {
      config: {
        "Artisan's Tool": artisanTools,
        'Instrument': instruments,
        'Gaming Set': gamingSets,
        'Miscellaneous': miscellaneous,
        ...extraConfig
      }
    };
    const choiceConfig = { ascending: true, choiceType: 'Tool Proficiency' };
    const tools = _automationPrivate().abstractSetupMethod({
      classConfig,
      raceConfig,
      backgroundConfig,
      title: 'Tools',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!tools) return;
    return { tools };
  },
  setupLanguages: ({
    raceConfig,
    backgroundConfig,
    standard = [],
    exotic = [],
    extraConfig = {},
    mobile = false
  }) => {
    const normalizeConfig = {
      config: {
        'Standard': standard,
        'Exotic': [...standard, ...exotic],
        ...extraConfig
      }
    };
    const choiceConfig = { ascending: true, choiceType: 'Language Proficiency' };
    const languages = _automationPrivate().abstractSetupMethod({
      raceConfig,
      backgroundConfig,
      title: 'Languages',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!languages) return;
    return {
      'languages': languages.includes('Common Illiterate')
        ? languages.filter((language) => language !== 'Common Illiterate')
        : ['Common', ...languages]
    };
  },
  setupItems: ({
    classConfig,
    backgroundConfig,
    simpleMelee = [],
    simpleRanged = [],
    martialMelee = [],
    martialRanged = [],
    extraConfig = {},
    mobile = false
  }) => {
    const convertToValueItemFormat = (item) => {
      if (!item.includes(' + ')) {
        return `${item.replace(/[^0-9]/g, '') || 1}x ${item.replace(/[0-9]/g, '').trim()}`;
      }
      return item.split(' + ').reduce((total, itemPart) => {
        return `${total} + ${convertToValueItemFormat(itemPart)}`;
      }, '').slice(3);
    };
    const normalizeConfig = {
      config: {
        'Simple Melee': simpleMelee,
        'Simple Ranged': simpleRanged,
        'Martial Melee': martialMelee,
        'Martial Ranged': martialRanged,
        'Simple': [...simpleMelee, ...simpleRanged],
        'Martial': [...martialMelee, ...martialRanged],
        ...extraConfig
      },
      callback: convertToValueItemFormat
    };
    const choiceConfig = { ascending: true, excludeResults: false, choiceType: 'Item' };
    const items = _automationPrivate().abstractSetupMethod({
      classConfig,
      backgroundConfig,
      title: 'Items',
      normalizeConfig,
      choiceConfig,
      mobile
    });
    if (!items) return;

    const addToTotal = (item, total) => {
      const [_, count, name] = item.match(/(\d+)x\s+(.+)/i);
      const trimmedName = name.trim();
      total[trimmedName] = (total[trimmedName] || 0) + parseInt(count);
    };
    return {
      'items': items.reduce((total, item) => {
        if (item.includes(' + ')) {
          item.split(' + ').forEach((splitItem) => {
            addToTotal(splitItem, total);
          });
        } else addToTotal(item, total);
        return total;
      }, {})
    };
  },
  setupEquipmentPack: ({ classConfig, listData = {}, mobile = false }) => {
    const IO_ = IO();
    const { data, metadata, selection } = classConfig;
    const newLine = `${IO_.getNewLineChar(mobile)}\u00A0\u00A0\u00A0\u00A0`;

    const selectedPack = IO_.askForAnswerFromList({
      title: `Equipment Pack - Class (${selection})`,
      options: data[metadata.indexOf('Equipment Packs')].split(' or '),
      optionModifier: (option) => {
        const list = listData[option];
        if (!list) {
          throw `The equipment pack [${option}] does not exist in your [Lists] sheet.`;
        }
        return `${option}:${newLine}~ ${list.replaceAll(', ', `${newLine}~ `)}${newLine}`;
      },
      mobile,
      loopLimit: 10
    });
    if (!selectedPack) return;

    return {
      'pack': listData[selectedPack].split(', ').reduce((total, item) => {
        if (!item.includes(' ') || !item.replace(/[^0-9]/g, '')) {
          return { ...total, [item]: 1 };
        }
        const [count, ...name] = item.split(' ');
        return {
          ...total,
          [name.join(' ')]: count.includes('ft')
            ? count
            : parseInt(count)
        };
      }, {})
    };
  },
  getNextLevelChoiceOptions: ({
    databaseID,
    selectedClass,
    race,
    level,
    path,
    lists = [],
    spellConfig = {},
    actionSheets = Static().actionSheets()
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const consolidate = (choiceData, index) => {
      const consolidatedChoices = {};
      choiceData.forEach((data) => {
        const choice = data[index];
        if (!choice) return;
        choice.split(', ').forEach((choiceItem) => {
          const splitChoice = choiceItem.split(' ');
          let count = 1, key;
          if (splitChoice.length > 1 && !isNaN(splitChoice[0])) {
            count = parseInt(splitChoice[0], 10);
            key = splitChoice.slice(1).join(' ');
          } else key = choiceItem;
          consolidatedChoices[key] = count + (consolidatedChoices[key] || 0);
        });
      });

      return Object.entries(consolidatedChoices).reduce((total, [key, count]) => {
        return `${total ? `${total}, ` : ''}${count > 1 ? `${count} ` : ''}${key}`;
      }, '');
    };

    const Automation_ = Automation();
    const { results: choiceData } = Automation_.query({
      sourceID: databaseID,
      source: 'Level Up',
      conditions: {
        'Level': (value, row) => row === 1 || ((value || 0) === level + 1),
        'Class': (value, row) => row === 1 || value === selectedClass,
        'Path': (value, row) => row === 1 || !value || (path && value.includes(path))
      },
      ignoreColumns: ['Class', 'Level', 'Path']
    });
    const [metadata, ...restChoiceData] = choiceData;
    if (!restChoiceData.length) return {};

    const choiceOptions = {};
    const attributeIndex = metadata.indexOf('Attribute');
    if (attributeIndex !== -1) {
      const attributeChoices = consolidate(restChoiceData, attributeIndex);
      if (attributeChoices) {
        const count = parseInt(attributeChoices.match(/[0-9]+/g, '')?.[0] || 1);
        const tag = attributeChoices.replace(/[0-9]/g, '').trim();
        const foundList = lists.find(({ name }) => name === tag);
        if (foundList) {
          choiceOptions.attributeChoices = {
            count,
            choiceList: foundList.list.split(', ')
          };
        }
      }
    }

    const pathIndex = metadata.indexOf('Unlock Path');
    if (pathIndex !== -1) {
      const pathChoices = consolidate(restChoiceData, pathIndex).split(' or');
      if (pathChoices[0]) {
        choiceOptions.pathChoices = pathChoices.map((path) => path.trim());
      }
    }

    const spellIndex = metadata.indexOf('Unlock Spell Tags');
    if (spellIndex !== -1) {
      const spellChoices = consolidate(restChoiceData, spellIndex);
      if (spellChoices) {
        const Convert_ = Convert(), Generic_ = Generic();
        const spellChoiceOptions = [];
        spellChoices.split(', ').forEach((choice) => {
          const count = parseInt(choice.match(/[0-9]+/g, '')?.[0] || 1);
          const tag = choice.replace(/[0-9]/g, '').trim();
          const choices = tag.includes(' or ')
            ? tag.split(' or ')
            : [tag];
          const choiceList = actionSheets.reduce((total, sheet) => {
            const sheetObject = Generic_.getSheet(sheet, databaseID);
            if (!sheetObject) return total;

            const abilityColumn = sheetObject
              .getDataRange()
              .getValues()[0]
              .indexOf(Convert_.toSingular(sheet)) + 1;
            if (!abilityColumn) return total;

            const { results: sheetChoices } = Automation_.query({
              sourceID: databaseID,
              source: sheet,
              conditions: {
                'Tags': spellConfig.tags || ((value) => choices.includes(value)),
                'Choice': spellConfig.choice || ((value) => value === true),
                'Class': spellConfig.selectedClass || ((value) => ['', selectedClass].includes(value)),
                'Race': spellConfig.race || ((value) => !value || value.includes(race)),
                'Level': spellConfig.level || ((value) => (value || 0) <= (level + 1)),
                'Path': spellConfig.path || ((value) => !value || (path && value.includes(path)))
              },
              ignoreColumns: Array.from(
                { length: sheetObject.getLastColumn() },
                (_, i) => i + 1).filter((number) => number !== abilityColumn
              )
            });
            if (!sheetChoices.length) return total;

            return [
              ...total,
              ...sheetChoices.flat().map((ability) => ({ ability, sheet }))
            ];
          }, []);
          spellChoiceOptions.push({ count, choiceList, tag });
        });
        choiceOptions.spellChoices = spellChoiceOptions;
      }
    }

    return { choiceOptions, choiceData };
  },
  askForNextLevelChoices: ({
    choiceOptions = {},
    choices = Data().choices(),
    descriptions = [],
    maxAttributes = {},
    mobile = false,
    trackHistory
  }) => {
    const Generic_ = Generic(), IO_ = IO();
    const nextLevelChoices = {};
    const { attributeChoices, pathChoices, spellChoices } = choiceOptions;
    const newLine = IO_.getNewLineChar(mobile);

    if (attributeChoices) {
      const attributesIncreased = {};
      const { count, choiceList } = attributeChoices;
      const attributeData = choiceList.map((attribute) => {
        const abbreviation = attribute.slice(0, 3).toUpperCase();
        return {
          ...Generic_.getNamedRange(abbreviation),
          name: attribute,
          abbreviation,
          maxValue: maxAttributes[attribute] || maxAttributes[abbreviation] || 20
        };
      });

      for (let iteration = 0; iteration < count; iteration++) {
        const validOptions = [];
        const excludeOptions = attributeData.reduce((total, { name, value, maxValue }) => {
          if (value >= maxValue) return [...total, name];
          validOptions.push(name);
          return total;
        }, []);
        if (!validOptions.length) break;

        const selectedAttribute = validOptions.length === 1
          ? validOptions[0]
          : IO_.askForAnswerFromList({
              title: 'Leveling up...',
              message: `${count > 1 ? `(${iteration + 1} / ${count}) - ` : ''}Select an attribute`,
              options: choiceList,
              optionModifier: (option) => {
                const foundAttribute = attributeData.find(({ name }) => name === option);
                if (!foundAttribute) return option;
                return `${option}: ${foundAttribute.value}`;
              },
              excludeOptions,
              mobile
            });

        if (!selectedAttribute) return;
        const attributeFound = attributeData.find(({ name }) => name === selectedAttribute);
        attributeFound.value++;
        if (attributesIncreased[selectedAttribute]) {
          attributesIncreased[selectedAttribute].value++;
        } else {
          attributesIncreased[selectedAttribute] = {
            value: 1,
            sheet: attributeFound.sheet,
            range: attributeFound.range
          };
        }
      }
      nextLevelChoices.attributesIncreased = attributesIncreased;
      trackHistory(
        Object.values(attributesIncreased).map((attributeData) => {
          return { ...attributeData, relative: true };
        })
      );
    }

    if (pathChoices) {
      const selectedPath = IO_.askForAnswerFromList({
        title: 'Leveling up...',
        message: 'Select a path',
        options: pathChoices,
        optionModifier: (option) => {
          const descriptionFound = descriptions.find(({ name }) => name === option);
          if (!descriptionFound) return option;
          return `${option}: ${descriptionFound.description}${newLine}`;
        },
        mobile
      });

      if (!selectedPath) return;
      nextLevelChoices.selectedPath = selectedPath;
      trackHistory({ ...Generic_.getNamedRange('Path'), value: selectedPath });
    }

    if (spellChoices) {
      const Convert_ = Convert();
      let newChoices = [];
      let totalChoices = [...choices];
      const sheetUpdates = [];
      for (
        const { count, choiceList, tag }
        of spellChoices.sort(({ choiceList: cl1 }, { choiceList: cl2 }) => {
          return cl1.length - cl2.length;
        })
      ) {
        const abilities = choiceList.map(({ ability }) => ability);
        const validOptions = abilities.filter((ability) => {
          return !totalChoices.includes(ability);
        });
        if (count >= validOptions.length) {
          newChoices = [...newChoices, ...validOptions];
          totalChoices = [...totalChoices, ...validOptions];
          validOptions.forEach((option) => {
            sheetUpdates.push(choiceList.find(({ ability }) => {
              return ability === option;
            }).sheet);
          });
        } else {
          for (let iteration = 0; iteration < count; iteration++) {
            if (!validOptions.length) break;
            const selectedAbility = validOptions.length === 1
              ? validOptions[0]
              : IO_.askForAnswerFromList({
                  title: 'Leveling up...',
                  message: `${
                    count > 1 ? `(${iteration + 1} / ${count}) - ` : ''
                  }Select a ${tag ? `${tag} ` : ''}spell`,
                  options: abilities,
                  optionModifier: (option) => {
                    const foundAbility = descriptions.find(({ name }) => name === option);
                    const { sheet } = choiceList.find(({ ability }) => ability === option);
                    option += ` (${Convert_.toSingular(sheet)})`;
                    if (!foundAbility) return option;
                    return `${option}: ${foundAbility.description}${newLine}`;
                  },
                  excludeOptions: totalChoices,
                  mobile
                });
            
            if (!selectedAbility) return;
            validOptions.splice(validOptions.indexOf(selectedAbility), 1);
            newChoices.push(selectedAbility);
            totalChoices.push(selectedAbility);
            sheetUpdates.push(
              choiceList.find(({ ability }) => {
                return ability === selectedAbility;
              }).sheet
            );
          }
        }
      }

      nextLevelChoices.newChoices = newChoices;
      nextLevelChoices.totalChoices = totalChoices;
      nextLevelChoices.sheetUpdates = [...new Set(sheetUpdates)];
      const characterSetup = Generic_.getNamedRange('Character_Setup');
      trackHistory({
        ...characterSetup,
        value: JSON.stringify({
          ...JSON.parse(characterSetup.value),
          abilities: totalChoices
        })
      });
    }

    return nextLevelChoices;
  },
  getNextLevelSheetUpdates: ({
    databaseID,
    choices,
    selectedClass,
    race,
    level,
    path,
    spellConfig = {},
    sheets = ['Class Variables', 'Class Attributes', ...Static().actionSheets()]
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Convert_ = Convert(), Automation_ = Automation();
    const sheetUpdateData = {};
    sheets.forEach((sheet) => {
      let includeSheet = false, includeMobile = false;
      const sheetName = sheet.replace('Class ', '');
      const titleColumnName = Convert_.toSingular(sheetName);

      const validQueryData = {};
      Automation_.query({
        sourceID: databaseID,
        source: sheet,
        conditions: {
          'Level': spellConfig.level || ((value) => (getColumn) => {
            return getColumn('Choice')
              ? (value || 0) <= level + 1
              : (value || 0) === level + 1;
          }),
          'Class': spellConfig.selectedClass || ((value) => ['', selectedClass].includes(value)),
          'Race': spellConfig.race || ((value) => !value || value.includes(race)),
          'Path': spellConfig.path || ((value) => !value || (path && value.includes(path))),
          'Choice': (value, row) => (getColumn) => {
            const title = getColumn(titleColumnName);
            if (!title) {
              if (!value || choices.includes(value)) {
                includeSheet = true;
              }
              return;
            }
            if (sheet === 'Passives' && getColumn('Script')) {
              includeMobile = true;
            }
            if (
              !value
                || choices.includes(value)
                || (value === true && choices.some((choice) => {
                  return ['All', title].includes(choice);
                }))
            ) validQueryData[title] = row;
          }
        },
        includeFormulas: true,
        ...(sheetName === 'Variables' && { metadataRowLength: 1 })
      });
      if (includeMobile) sheetUpdateData['Mobile'] = {};
      if (Object.keys(validQueryData).length || includeSheet) {
        sheetUpdateData[sheetName] = validQueryData;
      }
    });
    return sheetUpdateData;
  }
});

var Automation = () => ({
  query: ({
    sourceID,
    source,
    destination,
    conditions = {},
    ignoreColumns = [],
    includeFormulas = false,
    metadataRowLength
  }) => {
    const Generic_ = Generic();
    const [sourceSheet, sourceRange] = source.split('!');
    const sourceSheetObject = Generic_.getSheet(sourceSheet, sourceID);
    if (!sourceSheetObject) {
      throw `The sheet ${sourceSheet} in [${sourceID}] does not exist.`;
    }

    const Convert_ = Convert();
    let sourceRangeValues;
    if (sourceRange) {
      const [sourceRangeStart, sourceRangeEnd] = sourceRange.split(':');
      if (sourceRangeEnd) sourceRangeValues = sourceSheetObject.getRange(sourceRange);
      else {
        const { row, column } = Convert_.toRowColumnNotation(sourceRangeStart);
        sourceRangeValues = sourceSheetObject.getRange(
          row,
          column,
          sourceSheetObject.getLastRow() - row + 1,
          sourceSheetObject.getLastColumn() - column + 1
        );
      }
    } else {
      sourceRangeValues = sourceSheetObject.getRange(
        1,
        1,
        sourceSheetObject.getLastRow(),
        sourceSheetObject.getLastColumn()
      );
    }

    const {
      row: sourceRowTranspose,
      column: sourceColumnTranspose
    } = Convert_.toRowColumnNotation(sourceRangeValues.getA1Notation().split(':')[0]);
    const sourceRangeFormulas = includeFormulas
      ? sourceRangeValues.getFormulas()
      : null;
    const grid = sourceRangeValues.getValues();
    const { metadata } = Cache().generateMetadata({
      sheet: sourceSheetObject,
      rowLength: metadataRowLength
    });

    const convertColumn = (column) => {
      if (!isNaN(column)) return column;
      return (metadata.indexOf(Convert_.toCamelCase(column)) + 1) || undefined;
    };
    const normalizedIgnoredColumns = (
      Array.isArray(ignoreColumns)
        ? ignoreColumns
        : [ignoreColumns]
    ).reduce((total, column) => {
      column = convertColumn(column);
      return column ? [...total, column] : total;
    }, []);

    const results = [], emptyColumns = [], checkboxes = [], dropdowns = [];
    for (let row = 0; row < grid.length; row++) {
      let match = true;
      for (let [column, callback] of Object.entries(conditions)) {
        column = convertColumn(column);
        if (!column) continue;
        const callbackResult = callback(grid[row][column - 1], row + 1);
        if (typeof callbackResult === 'function'
          ? !callbackResult((innerColumn = column, innerRow = row + 1) => {
              innerColumn = convertColumn(innerColumn);
              if (innerColumn) return grid[innerRow - 1][innerColumn - 1];
            })
          : !callbackResult
        ) {
          match = false;
          break;
        }
      }
      if (!match) continue;

      const rowResults = [];
      for (let column = 0; column < grid[row].length; column++) {
        if (normalizedIgnoredColumns.includes(column + 1)) continue;
        const formula = sourceRangeFormulas
          ? sourceRangeFormulas[row][column]
          : null;
        let cellValue = includeFormulas && formula
          ? formula
          : grid[row][column];
        if (includeFormulas && formula && cellValue.startsWith('=INVOKE("')) {
          cellValue = cellValue.replace('=INVOKE("', '').slice(0, -2);
        }
        rowResults.push(cellValue);
        const {
          values: dropdownValues,
          range: dropdownRange
        } = Generic_.getCellDropdown(
          [row + sourceRowTranspose, column + sourceColumnTranspose],
          sourceSheetObject
        );
        if (dropdownValues && !dropdownRange) {
          dropdowns.push([results.length + 1, rowResults.length, dropdownValues]);
        }
        if (typeof cellValue === 'boolean') {
          checkboxes.push([results.length + 1, rowResults.length, cellValue]);
        }
      }
      results.push(rowResults);
    }
    if (!results.length) {
      return {
        results,
        emptyColumns,
        ...(destination && { nextCell: destination.split('!')[1] }),
        sourceSheet: sourceSheetObject
      };
    }

    const getMergedCells = () => {
      let lastKey = '', formulas = [];
      const keys = [], keyHistory = [];
      const mergedRows = {}, mergedColumns = {};

      const name = sourceSheetObject.getName();
      const grid = sourceSheetObject.getDataRange().getValues();
      const index = grid[0].indexOf(Convert_.toSingular(name));
      if (index === -1) return {};
      results.forEach(([item], row) => {
        if (item !== lastKey) lastKey = item;
        else if (mergedRows[lastKey]) mergedRows[lastKey].length++;
        else {
          const sourceRow = grid.findIndex((row) => row[index] === lastKey) + 1;
          if (sourceRow) mergedRows[lastKey] = { row, sourceRow, length: 2 };
          else {
            if (!formulas.length) {
              formulas = sourceSheetObject.getDataRange().getFormulas();
            }
            const sourceRow = formulas.findIndex((row) => row[index] === lastKey) + 1;
            mergedRows[grid[sourceRow - 1][index]] = { row, sourceRow, length: 2 };
          }
        }
      });

      lastKey = '';
      results[0].forEach((item, column) => {
        if (item !== '') {
          lastKey = item;
          if (keys.length) keys.at(-1).done = true;
          keys.push({
            firstRowKey: item,
            secondRowKeys: results.length > 1
              ? [results[1][column]]
              : []
          });
          if (keyHistory.includes(item)) {
            const { secondRowKeys } = keys.findLast(({ firstRowKey, done }) => {
              return firstRowKey === item && done;
            });
            mergedColumns[`${item} - ${secondRowKeys.join(', ')}`] = {
              ...mergedColumns[item],
              sourceColumn: grid[0].findIndex((name, i) => {
                return name === item
                  && JSON.stringify(grid[1].slice(i, i + secondRowKeys.length))
                    === JSON.stringify(secondRowKeys);
              }) + 1
            };
            delete mergedColumns[item];
          } else keyHistory.push(item);
          return;
        }

        if (results.length > 1) {
          keys
            .find(({ firstRowKey, done }) => firstRowKey === lastKey && !done)
            ?.secondRowKeys
            ?.push(results[1][column]);
        }
        if (mergedColumns[lastKey]) mergedColumns[lastKey].length++;
        else {
          mergedColumns[lastKey] = {
            column,
            sourceColumn: grid[0].findIndex((name) => name === lastKey) + 1,
            length: 2
          };
        }
      });

      return { mergedRows, mergedColumns };
    };

    for (let column = 0; column < results[0].length; column++) {
      let emptyColumn = true;
      for (let row = 0; row < results.length; row++) {
        if (results[row][column] !== '') {
          emptyColumn = false;
          break;
        }
      }
      if (emptyColumn) emptyColumns.push(column + 1);
    }

    const nextCellData = {};
    if (destination) {
      const [destinationSheet, destinationCell] = destination.split('!');
      const destinationSheetObject = Generic_.getSheet(destinationSheet);
      const startingCell = destinationSheetObject.getRange(destinationCell);
      const destinationRange = destinationSheetObject.getRange(
        startingCell.getRow(),
        startingCell.getColumn(),
        results.length,
        results[0].length
      );
      destinationRange.setValues(results);
      nextCellData.nextCell = `${destinationCell.replace(/\d+/, '')}${
        startingCell.getRow() + results.length
      }`;

      for (const [row, column, value] of checkboxes) {
        const checkboxValidation = SpreadsheetApp
          .newDataValidation()
          .requireCheckbox()
          .build();
        destinationRange
          .getCell(row, column)
          .setValue(value)
          .setDataValidation(checkboxValidation);
      }
      
      for (const [row, column, dropdownValues] of dropdowns) {
        const dropdownValidation = SpreadsheetApp
          .newDataValidation()
          .requireValueInList(dropdownValues)
          .build();
        destinationRange.getCell(row, column).setDataValidation(dropdownValidation);
      }
    }

    return {
      results,
      emptyColumns,
      ...nextCellData,
      ...getMergedCells(),
      sourceSheet: sourceSheetObject
    };
  },
  generateButtons: ({
    databaseID = Data().databaseID(),
    spells,
    sheet,
    lastRow,
    lastColumn,
    firstColumnSize = 2,
    buttonColumnWidth = 50
  }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!Object.keys(spells).length) {
      Generic_.deleteColumns(firstColumnSize, sheetObject);
      return sheetObject
        .getRange(1, firstColumnSize, lastRow || sheetObject.getLastRow(), 1)
        .setBorder(
          null,
          true,
          null,
          null,
          null,
          null,
          '#000000',
          SpreadsheetApp.BorderStyle.SOLID_MEDIUM
        );
    }

    const Drive_ = Drive();
    return Object.entries(spells).forEach(([
      spell,
      { script, imageID, imageTag, scale, row }
    ]) => {
      if (!script) script = `Use${spell.replace(/\s/g, '')}`;
      if (script === 'Use') return;
      const defaultRowHeight = sheetObject.getRowHeight(row);
      const rowHeight = defaultRowHeight === 21
        ? Generic_.getEstimatedRowHeight({
          sheet: sheetObject,
          row,
          lastColumn: lastColumn || sheetObject.getLastColumn()
        })
        : defaultRowHeight;
      Drive_.createButton({
        databaseID,
        sheet: sheetObject,
        cell: [row, firstColumnSize],
        imageID,
        imageTag: imageTag || 'Use',
        script,
        scale: scale || 0.7,
        rowHeight,
        columnWidth: buttonColumnWidth
      });
    });
  },
  modifyUpdatesLeft: ({ pendingUpdatesData, updates = [], remove = true } = {}) => {
    const Generic_ = Generic();
    if (!pendingUpdatesData) {
      pendingUpdatesData = Generic_.getNamedRange('Pending_Updates');
    }

    const {
      sheet: pendingUpdatesSheet,
      range: pendingUpdatesRange,
      value: pendingUpdates = '[]'
    } = pendingUpdatesData;
    if (!pendingUpdatesSheet) return;
    if (!Array.isArray(updates)) updates = [updates];
    const pendingUpdateList = typeof pendingUpdates === 'string'
      ? JSON.parse(pendingUpdates || '[]')
      : pendingUpdates;
    const newUpdates = remove
      ? pendingUpdateList.filter((sheet) => !updates.includes(sheet))
      : [...new Set([...pendingUpdateList, ...updates])];
    Generic_.setValue(
      pendingUpdatesRange,
      JSON.stringify(newUpdates),
      pendingUpdatesSheet
    );
    return newUpdates;
  },
  checkForMissingUpdates: ({ pendingUpdatesData, updateCallback, mobile }) => {
    if (!pendingUpdatesData) {
      pendingUpdatesData = Generic().getNamedRange('Pending_Updates');
    }
    let pendingUpdates = JSON.parse(pendingUpdatesData.value || '[]');
    if (!pendingUpdates.length) return false;

    const IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    const applyUpdates = IO_.askForYesOrNo({
      title: 'Pending updates',
      message:
        `You're missing the following sheet updates: [${pendingUpdates.join(', ')}]${
          newLine
        }${newLine}Do you want to update them now? Remember that you won't be able to use Undo.`,
      mobile
    });
    if (applyUpdates === undefined) return;
    if (!applyUpdates) return false;
    pendingUpdates.forEach((sheet) => updateCallback(`Update ${sheet} Sheet`, mobile));
    IO_.notify({ message: 'All pending updates were finished', mobile });
    return true;
  },
  updateSheets: ({
    level,
    sheetUpdateData = {},
    updateCallback,
    customSheetLevelConfig = {},
    mobile = false
  }) => {
    if (level === undefined) level = Data().level();
    let sheetNames = Object.keys(sheetUpdateData);
    Object.entries(customSheetLevelConfig).forEach(([sheet, levelRequirement]) => {
      if (levelRequirement === level + 1) sheetNames.push(sheet);
    });
    if (!sheetNames.length) return true;
    const actionSheets = Static().actionSheets().slice(0, -1);
    if (sheetNames.some((sheet) => actionSheets.includes(sheet))) {
      sheetNames.push('Mobile');
    }
    sheetNames = [...new Set(sheetNames)];
    Automation().modifyUpdatesLeft({ updates: sheetNames, remove: false });

    const Convert_ = Convert(), IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    const newAbilities = Object.entries(sheetUpdateData).reduce((total, [sheet, sheetData]) => {
      if (sheet === 'Variables') return total;
      return [
        ...total,
        ...Object.keys(sheetData).map((ability) => {
          return `${ability} (${Convert_.toSingular(sheet)})`;
        })
      ];
    }, []);
    const messageEnd = newAbilities.length
      ? `${newLine}${newLine}Abilities learned${
          level ? ` / modified on Level ${level + 1}` : ''
        }:${newLine}${newAbilities.join(newLine)}`
      : '';
    const applyUpdates = IO_.askForYesOrNo({
      title: 'Are you sure you want to proceed?',
      message: "The following sheets will be updated and you won't be able to use Undo: " +
        `[${sheetNames.join(', ')}]${messageEnd}`,
      mobile
    });
    if (applyUpdates === undefined) return;
    if (applyUpdates) {
      sheetNames.forEach((sheet) => updateCallback(`Update ${sheet} Sheet`, mobile));
    }
    return true;
  },
  copySheet: ({ sourceID, sheetName, nextToSheet }) => {
    const Generic_ = Generic();
    Generic_.deleteSheet(sheetName);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = Generic_.getSheet(sheetName, sourceID);
    const newSheet = sheet
      .copyTo(spreadsheet)
      .setName(sheetName)
      .setTabColorObject(sheet.getTabColorObject())
      .activate();
    const sheetIndex = nextToSheet
      ? nextToSheet === '$'
        ? spreadsheet.getSheets().length
        : spreadsheet.getSheetByName(
            nextToSheet.split(', ').find((sheet) => Generic_.getSheet(sheet))
          )?.getIndex?.() + 1
      : 1;
    spreadsheet.moveActiveSheet(sheetIndex || 1);
    return newSheet;
  },
  generateMobileSheet: ({
    databaseID,
    sheetName = 'Mobile',
    nextToSheet,
    cacheConfig = {},
    cacheArguments = {},
    customMobileConfig = [],
    customMenuConfig = {},
    spellNameConfig = {},
    spellConfig = {},
    selectedClass,
    race,
    level,
    path,
    choices,
    onFormat,
    mobile = false
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const filterOptions = (options) => options.map((option) => {
      return spellNameConfig[option] || option;
    });

    const Generic_ = Generic(), Automation_ = Automation();
    const sheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet
    });
    let gridLength = sheet.getMaxRows();
    const grid = sheet.getRange(1, 1, gridLength, 1).getValues();
    Generic_.hideRows([gridLength - 1, gridLength], sheet);
    const remainingActionSheets = Static().actionSheets();

    const Private = _automationPrivate();
    const rowsToBeDeleted = [];
    for (let row = 0; row < grid.length; row += 2) {
      const [value] = grid[row];
      if (!remainingActionSheets.includes(value)) continue;
      remainingActionSheets.splice(remainingActionSheets.indexOf(value), 1);
      const options = Private.getMobileDropdownOptions({
        databaseID,
        sheetName: value,
        choices,
        spellConfig,
        selectedClass,
        race,
        level,
        path
      });
      if (options.length) {
        Generic_.createDropdown({
          cell: [row + 2, 1],
          options: filterOptions(options),
          sheet
        });
      } else rowsToBeDeleted.push(row + 1, row + 2);
      if (!remainingActionSheets.length) break;
    }
    if (rowsToBeDeleted.length) Generic_.deleteRows(rowsToBeDeleted);

    if (Object.keys(customMenuConfig).length) {
      const automationIndex = grid.findIndex(([name]) => name === 'Automation') + 1;
      if (automationIndex) {
        const cell = `A${automationIndex + 1}`;
        const { values: options } = Generic_.getCellDropdown(cell, sheet);
        (Array.isArray(customMenuConfig) ? customMenuConfig : [customMenuConfig])
          .forEach(({ customSheetName, afterMobileIndex }) => {
            return options.splice(afterMobileIndex, 0, `Update ${customSheetName} Sheet`);
          });
        Generic_.createDropdown({ cell, options: filterOptions(options), sheet });
      }
    }

    (Array.isArray(customMobileConfig) ? customMobileConfig : [customMobileConfig])
      .forEach(({ listTitle, options, afterList = 'Movement' }) => {
        const index = sheet.getRange(1, 1, gridLength, 1)
          .getValues()
          .flat()
          .indexOf(afterList) + 1;
        if (!index) return;
        sheet.insertRows(index + 1, 2);
        sheet.getRange(index + 2, 1)
          .setDataValidation(null)
          .setBackground('#CCCCCC')
          .setFontStyle('normal')
          .setFontWeight('bold')
          .setFontSize(14)
          .setValue(listTitle);
        sheet.setRowHeight(index + 2, 27);
        Generic_.addHorizontalBorder({ sheet, row: index + 2, lastColumn: 1 });
        Generic_.createDropdown({
          cell: [index + 3, 1],
          options: filterOptions(options),
          sheet
        });
        gridLength += 2;
      });
    if (onFormat && !onFormat({ sheet })) return;
    Cache().cacheMobileData({
      cacheConfig,
      ...cacheArguments,
      sheetName,
      saveToMemory: true,
      mobile
    });
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return sheet;
  },
  generateAttributesSheet: ({
    databaseID,
    sheetName = 'Attributes',
    nextToSheet = 'Mobile',
    cacheConfig = {},
    cacheArguments = {},
    excludedNamedRanges = [],
    finalizeValuesConfig = [],
    choices,
    selectedClass,
    race,
    level,
    path,
    attributes = {},
    onInitializeAttribute,
    beforeFormat,
    onFormat,
    mobile = false
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Generic_ = Generic(), Cache_ = Cache(), Private = _automationPrivate();
    let existingAttributeData = {};
    if (!Generic_.getSheet('Character Creation')) {
      existingAttributeData = Private.getExistingAttributeData({
        sheet: sheetName,
        cache: Cache_.getCache({
          sheet: sheetName,
          fallback: () => Cache_.cacheAttributeData({
            cacheConfig,
            ...cacheArguments,
            sheetName,
            mobile
          })
        })
      });
    }

    const Automation_ = Automation();
    const attributesSheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet
    });

    IO().notify({
      message: 'Creating class specific attribute fields...',
      mobile
    });
    Private.createClassSpecificFieldsForAttributes({
      databaseID,
      sheetName,
      selectedClass,
      race,
      level,
      path,
      choices
    });
    Private.initializeAttributeValues({
      sheet: attributesSheet,
      level,
      attributes,
      existingAttributeData,
      onInitializeAttribute
    });
    if (beforeFormat && !beforeFormat({ sheet: attributesSheet })) return;
    Private.formatAttributesSheet({ mobile });
    if (onFormat && !onFormat({ sheet: attributesSheet })) return;
    const cache = Cache_.cacheAttributeData({
      cacheConfig,
      ...cacheArguments,
      sheetName,
      saveToMemory: true,
      mobile
    });
    Private.createAttributesNamedRanges({
      cache,
      sheet: attributesSheet,
      excludedNamedRanges,
      mobile
    });
    Generic_.refreshSheet(attributesSheet);
    Generic_.refreshSheet('Variables');
    Private.finalizeAttributeValues({ sheet: attributesSheet, finalizeValuesConfig });
    const buttonData = Private.getAttributeButtonData({ databaseID, selectedClass });
    Private.createButtonsForAttributesSheet({
      databaseID,
      sheet: attributesSheet,
      buttonData,
      mobile
    });
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return attributesSheet;
  },
  generateChecksSheet: ({
    databaseID = Data().databaseID(),
    sheetName = 'Checks',
    nextToSheet = 'Attributes, Mobile',
    cacheConfig = {},
    cacheArguments = {},
    skills = {},
    savingThrows = {},
    onFormat,
    mobile = false
  }) => {
    const Generic_ = Generic(), Cache_ = Cache(), Private = _automationPrivate();
    let existingProficiencies = {};
    if (!Generic_.getSheet('Character Creation')) {
      existingProficiencies = Private.getExistingCheckProficiencies({
        sheet: sheetName,
        cache: Cache_.getCache({
          sheet: sheetName,
          fallback: () => Cache_.cacheCheckData({
            cacheConfig,
            ...cacheArguments,
            mobile
          })
        })
      });
    }

    const Automation_ = Automation();
    const proficientSkills = existingProficiencies.skills || skills;
    const proficientSavingThrows = existingProficiencies.savingThrows || savingThrows;
    const checksSheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet
    });

    const grid = checksSheet.getDataRange().getValues();
    const metadata = grid[0];
    const attributeIndex = metadata.indexOf('Attribute');
    const typeIndex = metadata.indexOf('Type');
    const proficiencyIndex = metadata.indexOf('Proficiency');

    const getProficiency = (proficiencies, proficiency) => {
      return Object.entries(proficiencies).find(([name]) => name === proficiency)?.[1];
    };
    for (let row = 1; row < grid.length; row++) {
      const currentRow = grid[row];
      const save = currentRow[attributeIndex];
      const proficiency = getProficiency(proficientSkills, currentRow[typeIndex])
        || getProficiency(proficientSavingThrows, save)
        || getProficiency(proficientSavingThrows, Static().attributeAbbreviations()[save]);
      if (proficiency) {
        Generic_.setValue([row + 1, proficiencyIndex + 1], proficiency, checksSheet);
      }
    }
    if (onFormat && !onFormat({ sheet: checksSheet })) return;
    const cache = Cache_.cacheCheckData({
      cacheConfig,
      ...cacheArguments,
      sheetName,
      saveToMemory: true,
      mobile
    });
    Private.createChecksNamedRanges({ cache, sheet: checksSheet, mobile });
    Generic_.refreshSheet(checksSheet);
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return checksSheet;
  },
  generateAbilitiesSheet: ({
    databaseID,
    sheetName,
    nextToSheet,
    backgroundColor = '#EFEFEF',
    firstRowColor = '#CCCCCC',
    nonTitleFontColor = '#3C4040',
    lastColumnWidth = 675,
    baselineAbilityCount,
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    choices,
    selectedClass,
    race,
    level,
    background,
    path,
    skipCaching = false,
    beforeFormat,
    onFormat,
    mobile = false
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!background) background = Data_.background();
    if (!path) path = Data_.path();

    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheetName, databaseID);
    if (!sheetObject) return;
    Generic_.deleteSheet(sheetName);
    const sheet = Generic_.insertSheet(sheetName, nextToSheet)
      .setTabColorObject(sheetObject.getTabColorObject());

    const IO_ = IO(), Private = _automationPrivate();
    IO_.notify({ message: `Fetching data for ${sheetName} sheet...`, mobile });
    const actionableItems = Private.getActionableItems();
    if (!Array.isArray(choices)) choices = [choices];
    const baselineAbilityCounts = {
      'Actions': 13,
      'Reactions': 2,
      'Interactions': 2,
      'Movement': 1
    };
    if (['Nyx', 'Halfling', 'Arbor Elf'].includes(race)) {
      baselineAbilityCounts['Bonus Actions'] = 1;
    }
    if (selectedClass === 'Nomad' && level >= 2) {
      baselineAbilityCounts['Bonus Actions'] = (baselineAbilityCounts['Bonus Actions'] || 0) + 2;
    }

    const Convert_ = Convert(), Automation_ = Automation();
    let firstRowSize = 1;
    const { mergedColumns } = Automation_.query({
      sourceID: databaseID,
      source: sheetName,
      destination: `${sheetName}!A1`,
      conditions: { 'Class': (_, row) => (getColumn) => {
        if (getColumn('Description', 2) !== '') return row === 1;
        firstRowSize = 2;
        return [1, 2].includes(row);
      }},
      ignoreColumns: ['Class', 'Race', 'Level', 'Background', 'Path', 'Choice', 'Tags', 'Mobile']
    });
    const titleColumnName = Convert_.toSingular(sheetName);
    let extraClassAbilityCount = 0, raceAbilityCount = 0, backgroundAbilityCount = 0;
    const { results, emptyColumns, mergedRows, sourceSheet } = Automation_.query({
      sourceID: databaseID,
      source: `${sheetName}!A${firstRowSize + 1}`,
      destination: `${sheetName}!A${firstRowSize + 1}`,
      conditions: {
        'Tags': spellConfig.tags || ((value) => (getColumn) => {
          if (getColumn('Path') !== 'Item') return true;
          return actionableItems.find((item) => {
            return item === (value || getColumn(titleColumnName));
          });
        }),
        'Class': spellConfig.selectedClass || ((value) => (getColumn) => {
          const choice = getColumn('Choice'), title = getColumn(titleColumnName), tag = getColumn('Tags');
          if (
            tag === 'Extra' &&
            choice && (
              choices.includes(choice)
                || (choice === true && choices.some((choice) => ['All', title].includes(choice)))
            )
          ) extraClassAbilityCount++;
          return ['', selectedClass].includes(value);
        }),
        'Race': spellConfig.race || ((value) => (getColumn) => {
          const choice = getColumn('Choice'), title = getColumn(titleColumnName);
          if (
            choice &&
            !choices.includes(choice) &&
            (choice !== true || !choices.some((choice) => ['All', title].includes(choice)))
          ) return;
          if (!value) return true;
          if (!value.includes(race)) return;
          raceAbilityCount++;
          return true;
        }),
        'Background': spellConfig.background || ((value) => {
          if (value === background) backgroundAbilityCount++;
          return ['', background].includes(value);
        }),
        'Level': spellConfig.level || ((value) => (value || 0) <= level),
        'Path': spellConfig.path || ((value) => {
          return !value
            || (path && value.includes(path))
            || (actionableItems.length && value === 'Item');
        }),
        'Script': (value) => {
          if (sheetName.includes('Bonus Actions')
            && !Generic_.doesValueExist('Off-handed Combat', 'Passives')
          ) return value !== 'OffHand';
          return true;
        }
      },
      ignoreColumns: ['Class', 'Race', 'Level', 'Background', 'Path', 'Choice', 'Tags', 'Mobile'],
      includeFormulas: true
    });
    if (!results.length) return sheet.hideSheet();

    IO_.notify({ message: `Formatting ${sheetName} sheet...`, mobile });
    Private.mergeRangesBasedOnQuery({
      sheet,
      sourceSheet,
      mergedRows,
      mergedColumns,
      firstRowSize
    });
    Generic_.deleteColumns(emptyColumns, sheet);
    const grid = Generic_.getSheetValues(sheetName);
    if (grid[1].every((item) => !item)) {
      firstRowSize = 1;
      Generic_.deleteRows([2], sheet);
      grid.splice(1, 1);
    }
    const firstColumnSize = !!grid[0][1] ? 2 : 3;
    sheet.insertColumnBefore(firstColumnSize);
    grid.forEach((row) => row.splice(firstColumnSize - 1, 0, ''));
    const spells = Private.generateSpellDataForButtons({ sheet, grid, firstRowSize });
    const buttonColumnWidth = Object.values(spells).reduce((min, { width }) => {
      return Math.max(min, width);
    }, 50);

    const Cache_ = Cache();
    if (
      beforeFormat && !beforeFormat({
        sheet,
        grid,
        metadata: Cache_.generateMetadata({ sheet, rowLength: firstRowSize })?.metadata || [],
        firstRowSize,
        firstColumnSize
      })
    ) return;

    let { lastRow, lastColumn } = Private.trimSheet(sheet);
    sheet.getRange(
      firstRowSize + 1,
      firstColumnSize + 1,
      lastRow - firstRowSize,
      lastColumn - firstColumnSize
    ).setFontColor(nonTitleFontColor);
    Private.formatSheet({ sheet, fontStyle: 'italic', color: backgroundColor });
    Private.formatFirstColumn({ sheet, columnSize: firstColumnSize, lastRow });
    Private.formatFirstRow({
      sheet,
      grid,
      rowSize: firstRowSize,
      color: firstRowColor,
      lastColumn,
      firstRowSize,
      exceptions: { 'Cost': { multipleLined: true, fontSize: 12 } }
    });
    Private.formatLastColumn({ sheet, lastColumn });
    Private.addItemsAndBaselineHorizontalBorders({
      sheet,
      grid,
      items: actionableItems,
      lastRow,
      lastColumn,
      firstRowSize,
      baselineAbilityCount: baselineAbilityCount || baselineAbilityCounts[sheetName],
      raceAbilityCount,
      backgroundAbilityCount,
      extraClassAbilityCount
    });
    Private.formatAmmoColumns({ sheet, grid, lastRow, firstRowSize });
    Private.formatCentralColumns({ sheet, firstColumnSize, lastRow, lastColumn });
    Generic_.resizeColumns({
      grid,
      manualChanges: {
        ...(firstColumnSize === 2
          ? { 2: buttonColumnWidth }
          : { 2: 40, 3: buttonColumnWidth }
        ),
        'Ammo+1': 22,
        'Effect': { max: 100 },
        'Effect+1': { max: 100 },
        'Description': lastColumnWidth
      },
      lastRow,
      lastColumn
    });
    Private.formatEffectColumns({ sheet, grid, lastRow, firstRowSize });
    ['Cost', 'Effect'].forEach((columnName) => {
      Private.mergeWithNextColumn({
        sheet,
        grid,
        columnName,
        startAfterRow: firstRowSize
      });
    });
    Private.mergeMultipleRowAbilities({
      sheet,
      grid,
      mergedRows,
      startAfterRow: firstRowSize,
      startAfterColumn: firstColumnSize,
      lastColumn,
      ignoreColumns: ['Ammo+1', 'Ammo+2']
    });
    Private.mergeTrackersAndAddDashes({
      sheet,
      grid,
      startAfterRow: firstRowSize,
      startAfterColumn: firstColumnSize,
      ignoreColumns: ['Ammo+2', 'Effect+1']
    });
    Private.formatSpellLevelColumn({ sheet, grid, firstRowSize });
    Private.formatMetadata({ sheet, grid, firstRowSize });
    lastColumn += Private.formatSlotsColumn({ sheet, grid, firstRowSize });
    if (
      onFormat && !onFormat({
        sheet,
        grid,
        metadata: Cache_.generateMetadata({ sheet, rowLength: firstRowSize })?.metadata || [],
        firstRowSize,
        firstColumnSize
      })
    ) return;

    Generic_.freezeRowsAndColumns({
      sheet,
      rows: firstRowSize,
      columns: firstColumnSize
    });
    Private.createAbilitiesNamedRanges({ sheetName, namedRangesConfig });
    if (!skipCaching) {
      Cache_.cacheSpellData({
        cacheConfig,
        ...cacheArguments,
        sheetName,
        saveToMemory: true,
        mobile
      });
    }
    if (Object.keys(spells).length) {
      IO_.notify({
        message: `Creating buttons for ${sheetName} sheet...`,
        mobile
      });
    }
    Automation_.generateButtons({
      databaseID,
      spells,
      sheet,
      lastRow,
      lastColumn,
      firstColumnSize,
      buttonColumnWidth
    });
    Automation_.modifyUpdatesLeft({ updates: sheetName });

    return sheet;
  },
  generateProficienciesSheet: ({
    databaseID = Data().databaseID(),
    sheetName = 'Proficiencies',
    nextToSheet = 'Passives, Movement, Interactions, Reactions' +
      ', Bonus Actions, Actions, Checks, Attributes, Mobile',
    proficiencies = [],
    onFormat
  }) => {
    const Automation_ = Automation();
    const {
      existingProficiencies,
      exoticWeapons = []
    } = _automationPrivate().getExistingProficiencyData();
    const allProficiencies = existingProficiencies || proficiencies;
    const allExoticWeapons = proficiencies.includes('Exotic')
      ? ['All']
      : exoticWeapons;
    const sheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet
    });
    const grid = sheet.getDataRange().getValues();
    const names = grid.map(([name]) => name);
    const exoticIndex = names.indexOf('Exotic');
    const toolsIndex = names.indexOf('Tools');

    const Generic_ = Generic();
    const rowsToHide = [];
    let lastTitleRow = 1, notFoundAnyProficiency = true;
    for (let row = 0; row < grid.length; row++) {
      const [proficiency, toggle] = grid[row];
      if (row && (toggle === '' && grid[row - 1][1] === '') || (row === grid.length - 1)) {
        if (notFoundAnyProficiency) {
          rowsToHide.push(
            ...Array.from(
              { length: row - lastTitleRow - 1 },
              (_, index) => lastTitleRow + index + 1
            )
          );
        } else notFoundAnyProficiency = true;
        lastTitleRow = row;
      }
      if (allExoticWeapons.length && row > exoticIndex && row < toolsIndex) {
        allExoticWeapons.forEach((weapon, index) => {
          if (index) {
            sheet.insertRowsAfter(row, 1);
            grid.splice(row, 0, [weapon, true]);
          }
          row++;
          sheet.getRange(row, 1).setFontColor('black').setValue(weapon);
          sheet.getRange(row, 2).setValue(true);
        });
        row--;
        notFoundAnyProficiency = false;
        sheet
          .getRange(exoticIndex + 2, 1, allExoticWeapons.length, 2)
          .setBorder(null, null, null, null, true, true);
        continue;
      }
      if (toggle === '') continue;
      if (allProficiencies.includes(proficiency)) {
        Generic_.setValue([row + 1, 2], true, sheet);
        notFoundAnyProficiency = false;
      } else rowsToHide.push(row + 1);
    }

    Generic_.hideRows([...new Set(rowsToHide)], sheet);
    let lastShownRow = grid.length;
    while (lastShownRow > 0) {
      if (!sheet.isRowHiddenByFilter(lastShownRow) && !sheet.isRowHiddenByUser(lastShownRow)) {
        break;
      }
      lastShownRow--;
    }
    if (lastShownRow !== grid.length) {
      sheet
        .getRange(lastShownRow, 1, 1, 2)
        .setBorder(
          null,
          null,
          true,
          null,
          null,
          null,
          '#000000',
          SpreadsheetApp.BorderStyle.SOLID_THICK
        );
    }
    if (onFormat && !onFormat({ sheet })) return;
    Generic_.createOrUpdateNamedRange('Proficiencies_All', 'Proficiencies!A:B');
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return sheet;
  },
  generateInventorySheet: ({
    databaseID = Data().databaseID(),
    sheetName = 'Inventory',  
    nextToSheet = 'Proficiencies, Passives, Movement, Interactions' +
      ', Reactions, Bonus Actions, Actions, Checks, Attributes, Mobile',
    items = {},
    pack = {},
    tools = [],
    onFormat,
    mobile = false
  }) => {
    const mergeAndNormalizeItemObjects = (itemList) => {
      const merge = (itemData, otherItemData) => {
        itemData.forEach(({ name, count, feet }, index) => {
          const foundItem = otherItemData.find(({ name: otherName }) => {
            return name === otherName;
          });
          if (!foundItem) return;

          const { count: otherCount, feet: otherFeet, ...rest } = foundItem;
          if (count !== undefined && otherCount !== undefined) {
            itemData[index].count += otherCount;
          }
          if (feet !== undefined && otherFeet !== undefined) {
            itemData[index].feet += otherFeet;
          }
          Object.assign(itemData[index], rest);
        });
        otherItemData.forEach(({ name, ...rest }) => {
          const foundItem = itemData.find(({ name: otherName }) => {
            return name === otherName;
          });
          if (!foundItem) itemData.push({ name, ...rest });
        });
        return itemData;
      };
      const normalize = (itemData) => {
        const getNormalizedItem = (item, data) => {
          if (typeof data === 'number') {
            return { name: item, count: data };
          }
          if (typeof data === 'string') {
            return { name: item, feet: data ? parseInt(data) : '' };
          }
          const { count, ...restMetadata } = data;
          return { ...getNormalizedItem(item, count), ...restMetadata };
        };

        const normalizedItemData = [];
        Object.entries(itemData).forEach(([item, data]) => {
          normalizedItemData.push(getNormalizedItem(item, data));
        });
        return normalizedItemData;
      };
      return itemList.reduce((total, itemData) => {
        return merge(total, normalize(itemData));
      }, []);
    };

    const Inventory_ = Inventory(), Automation_ = Automation();
    const existingItems = _automationPrivate().getExistingItems(sheetName);
    const allItems = mergeAndNormalizeItemObjects(
      Object.keys(existingItems).length
        ? [existingItems]
        : [items, pack, Object.fromEntries(tools.map((tool) => [tool, 1]))]
    );
    const sheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet
    });

    const Generic_ = Generic();
    IO().notify({ message: 'Adding items to the Inventory sheet...', mobile });
    allItems.forEach(({ name, count, feet, note }) => {
      Inventory_.lootItem({
        itemName: name,
        count,
        feet,
        note,
        apply: false,
        skipOutput: true,
        ignoreHistoryCommands: true
      });
    });
    for (let column = 4; column < 13; column++) {
      sheet
        .getRange(3, column)
        .setFormula(sheet.getRange(2, column).getFormula());
    }
    Generic_.deleteRows([2], sheet);
    Generic_.hideColumns([8, 9, 10, 11, 12], sheet);
    if (onFormat && !onFormat({ sheet })) return;
    const finalRow = sheet.getLastRow() - 1;
    const namedRangesConfig = [
      { tag: 'All', fromColumn: 'B', toColumn: 'H' },
      { tag: 'Items', column: 'B' },
      { tag: 'Counts', column: 'C' },
      { tag: 'Costs', column: 'D' },
      { tag: 'Weights', column: 'E' },
      { tag: 'Metadata', column: 'H' },
      { tag: 'Armor', column: 'I' },
      { tag: 'Armor_Helper', column: 'J' },
      { tag: 'Main_Hand', column: 'K' },
      { tag: 'Off_Hand', column: 'L' },
    ];
    namedRangesConfig.forEach(({ tag, column, fromColumn, toColumn }) => {
      Generic_.createOrUpdateNamedRange(
        `Inventory_${tag}`,
        `Inventory!${column || fromColumn}2:${column || toColumn}${finalRow}`
      );
    });
    Generic_.refreshSheet(sheet);

    const equipmentConfig = [
      { dropdown: 'Armor', values: 'Inventory_Armor' },
      { dropdown: 'Main_hand', values: 'Inventory_Main_Hand' },
      { dropdown: 'Off_hand', values: 'Inventory_Off_Hand' }
    ];
    equipmentConfig.forEach(({ dropdown, values }) => {
      const [
        { sheet: dropdownSheet, range: dropdownRange },
        { sheet: valuesSheet, range: valuesRange }
      ] = Generic_.getNamedRange([dropdown, values]);
      Generic_.createDropdown({
        cell: dropdownRange,
        sheet: dropdownSheet,
        valuesInRange: Generic_.getSheet(valuesSheet)?.getRange?.(valuesRange)
      });
    });
    Automation_.modifyUpdatesLeft({ updates: sheetName });

    return sheet;
  },
  generateCharacterSheet: ({
    databaseID,
    sheetName = 'Character',
    nextToSheet = 'Inventory, Proficiencies, Passives, Movement, Interactions' +
      ', Reactions, Bonus Actions, Actions, Checks, Attributes, Mobile',
    cacheConfig = {},
    cacheArguments = {},
    selectedClass,
    race,
    background,
    onFormat,
    mobile = false
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!background) background = Data_.background();

    const Generic_ = Generic(), Cache_ = Cache(), Private = _automationPrivate();
    let existingCharacterData = {};
    if (!Generic_.getSheet('Character Creation')) {
      existingCharacterData = Private.getExistingCharacterData({
        sheetName,
        cache: Cache_.getCache({
          sheet: sheetName,
          fallback: () => Cache_.cacheCharacterData({
            cacheConfig,
            ...cacheArguments,
            mobile
          })
        })
      });
    }

    const Automation_ = Automation();
    const characterSheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName: sheetName,
      nextToSheet
    });

    const Convert_ = Convert();
    const grid = characterSheet.getDataRange().getValues();
    const characterData = {
      ['Class']: selectedClass,
      ['Race']: race,
      ['Background']: background,
      ...existingCharacterData
    };
    const backstory = characterData['Backstory'];
    for (let row = 0; row < grid.length; row++) {
      for (let column = 0; column < grid[row].length; column++) {
        const value = grid[row][column];
        if (!value) continue;
        const mergedRange = Generic_.getMergedCells([row + 1, column + 1], characterSheet);
        const rightmostCell = mergedRange
          ? Object.values(Convert_.toRowColumnNotation(mergedRange.split(':')[1]))
          : [row + 1, column + 1];
        if (!column && rightmostCell[1] === grid[0].length) {
          if (backstory && value.toLowerCase().includes('backstory')) {
            Generic_.setValue([row + 1, column + 1], backstory, characterSheet);
          }
          continue;
        }
        const attributeValue = characterData[value];
        if (!attributeValue) continue;
        if (grid[row + 1]?.[column] === '') {
          Generic_.setValue([row + 2, column + 1], attributeValue, characterSheet);
        } else {
          Generic_.setValue(
            [rightmostCell[0], rightmostCell[1] + 1],
            attributeValue,
            characterSheet
          );
        }
      }
    }
    if (onFormat && !onFormat({ sheet: characterSheet })) return;

    const cache = Cache_.cacheCharacterData({ cacheConfig, ...cacheArguments, mobile });
    Cache_.saveCache(cache, { sheetName: characterSheet.getName() });
    Private.createCharacterNamedRanges({ cache, sheet: characterSheet, mobile });
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return characterSheet;
  },
  generateVariablesSheet: ({
    databaseID,
    itemsKey,
    sheetName = 'Variables',
    characterSetup,
    selectedClass,
    level,
    path,
    onFormat,
    mobile = false
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();
    if (!characterSetup) characterSetup = Data_.characterSetup();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Generic_ = Generic(), Private = _automationPrivate();
    const existingVariables = Private.getExistingVariables(sheetName);
    Generic_.deleteSheet(sheetName);
    const sheet = Generic_.insertSheet(sheetName, '$');
    const choices = (characterSetup?.abilities || []);
    const addHorizontalBorder = (row, type = SpreadsheetApp.BorderStyle.SOLID) => {
      Generic_.addHorizontalBorder({ sheet, row, type, lastColumn: 2 });
    };

    const Automation_ = Automation();
    let keepValueRowCount = 0;
    const { results: baseResults } = Automation_.query({
      sourceID: databaseID,
      source: 'Base Variables!A2',
      conditions: {
        'Keep Value': (value) => {
          if (value) keepValueRowCount++;
          return true;
        }
      },
      includeFormulas: true,
      metadataRowLength: 1
    });
    if (keepValueRowCount) addHorizontalBorder(keepValueRowCount + 1);
    let choiceNodeVariableCount = 0;
    const { results: classResults } = Automation_.query({
      sourceID: databaseID,
      source: 'Class Variables',
      conditions: {
        'Class': (value) => value === selectedClass,
        'Level': (value) => (value || 0) <= level,
        'Path': (value) => !value || (path && value.includes(path)),
        'Choice': (value) => (getColumn) => {
          const includedChoice = choices.includes(value);
          if (value && includedChoice && getColumn('Tags') === 'Extra') {
            choiceNodeVariableCount++;
          }
          return !value || includedChoice;
        }
      },
      ignoreColumns: ['Class', 'Level', 'Path', 'Choice', 'Tags'],
      includeFormulas: true,
      metadataRowLength: 1
    });
    if (classResults.length) addHorizontalBorder(baseResults.length + 1);

    const variableData = [];
    baseResults.forEach(([name, keepValue, calculation]) => {
      const classResultIndex = classResults.findIndex(([name2]) => name2 === name);
      if (classResultIndex === -1) {
        variableData.push([
          name,
          keepValue ? (existingVariables[name] || calculation) : calculation
        ]);
      } else {
        const [_, keepValue, calculation] = classResults[classResultIndex];
        classResults.splice(classResultIndex, 1);
        variableData.push([
          name,
          keepValue ? (existingVariables[name] || calculation) : calculation
        ]);
      }
    });
    classResults.forEach(([name, keepValue, calculation]) => {
      variableData.push([
        name,
        keepValue ? (existingVariables[name] || calculation) : calculation
      ]);
    });
    sheet.getRange(1, 1, variableData.length, 2).setValues(variableData);
    if (choiceNodeVariableCount) {
      addHorizontalBorder(
        variableData.length - choiceNodeVariableCount + 1,
        SpreadsheetApp.BorderStyle.DOUBLE
      );
    }

    const { lastRow, lastColumn } = Private.trimSheet(sheet);
    const range = sheet.getDataRange();
    const grid = range.getValues();
    const databaseIDRow = grid.findIndex(([name]) => name === 'Database_ID') + 1;
    if (databaseIDRow && !Generic_.getValue([databaseIDRow, 2], sheet)) {
      Generic_.setValue([databaseIDRow, 2], databaseID, sheet);
    }
    const itemsKeyRow = grid.findIndex(([name]) => name === 'Items_Key') + 1;
    if (itemsKeyRow && !Generic_.getValue([itemsKeyRow, 2], sheet)) {
      Generic_.setValue([itemsKeyRow, 2], itemsKey, sheet);
    }
    const characterSetupRow = grid.findIndex(([name]) => name === 'Character_Setup') + 1;
    if (characterSetupRow && Generic_.getValue([characterSetupRow, 2], sheet) === '{}') {
      Generic_.setValue([characterSetupRow, 2], JSON.stringify(characterSetup), sheet);
    }
    const checksRow = grid.findIndex(([name]) => name === 'STR_Throw_Advantage') + 1;
    if (checksRow) addHorizontalBorder(checksRow);

    range
      .setVerticalAlignment('middle')
      .setFontFamily('Arial')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setBackground('#D9D9D9');
    sheet.getRange(1, 2, lastRow, 1).setHorizontalAlignment('left');
    Generic_.resizeColumns({
      sheet,
      manualChanges: { 1: 265, 2: 1240 },
      lastRow,
      lastColumn
    });
    if (onFormat && !onFormat({ sheet })) return;
    Private.createVariableNamedRanges({ mobile });
    Generic_.refreshSheet(sheet);
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    return sheet.hideSheet();
  },
  createCustomMenu: (customMenuConfig = {}) => {
    const Data_ = Data();
    const databaseID = Data_.databaseID();
    if (!databaseID) return;
    const itemsKey = Data_.itemsKey();
    if (!itemsKey) return;

    const createArguments = (sheet, customCallbackName) => [
      `${Generic().getSheet(sheet) ? 'Update' : 'Generate'} ${sheet} Sheet`,
      customCallbackName || `Update${sheet.replace(' ', '')}Sheet`
    ];
    const findMenu = (menuConfig, menuName) => {
      if (menuConfig.name === menuName) return menuConfig;
      else {
        for (const item of menuConfig.items) {
          if (item?.name && item?.items) {
            const result = findMenu(item, menuName);
            if (result) return result;
          }
        }
      }
      return;
    };
    const createMenuFromConfig = ({ name, items }) => {
      const ui = SpreadsheetApp.getUi();
      const menu = ui.createMenu(name)
        .addItem('Refresh Spreadsheet', 'RefreshSpreadsheet')
        .addItem('Check for Updates', 'CheckForUpdates')
        .addItem('Learn Ability', 'LearnAbility')
        .addSeparator();
      const addItemOrSubMenu = ({ itemConfig, parentMenu = menu, index, itemCount }) => {
        if (typeof itemConfig === 'string') {
          parentMenu.addItem(...createArguments(itemConfig));
        } else if (itemConfig?.sheet && itemConfig?.callback) {
          parentMenu.addItem(...createArguments(itemConfig.sheet, itemConfig.callback));
        } else {
          const { name, items } = itemConfig;
          if (index) parentMenu.addSeparator();
          const subMenu = ui.createMenu(name);
          items.forEach((subItem, index) => {
            addItemOrSubMenu({
              itemConfig: subItem,
              parentMenu: subMenu,
              index,
              itemCount: items.length
            });
          });
          parentMenu.addSubMenu(subMenu);
          if (index < itemCount - 1) parentMenu.addSeparator();
        }
      };
      items.forEach((itemConfig, index) => {
        addItemOrSubMenu({
          itemConfig,
          index,
          itemCount: items.length
        });
      });
      return menu;
    };

    const menuConfig = {
      name: 'Automation',
      items: [
        'Mobile',
        'Attributes',
        'Checks',
        {
          name: 'Action Sheets',
          items: Static().actionSheets()
        },
        'Proficiencies',
        'Inventory',
        'Character',
        'Variables'
      ]
    };
    (Array.isArray(customMenuConfig) ? customMenuConfig : [customMenuConfig]).forEach(({
      customSheetName,
      customCallbackName,
      inMenu = 'Automation',
      afterItemIndex = menuConfig.items.length - 1
    }) => {
      if (!customSheetName) return;
      const targetMenu = findMenu(menuConfig, inMenu);
      if (targetMenu) {
        const { items } = targetMenu;
        const index = items?.indexOf(customSheetName);
        items.splice(
          afterItemIndex,
          index === -1 ? 0 : 1,
          customCallbackName
            ? { sheet: customSheetName, callback: customCallbackName }
            : customSheetName,
        );
      }
    });
    return createMenuFromConfig(menuConfig)
      .addSeparator()
      .addItem('Generate Variables', 'GenerateVariables')
      .addItem('Generate Cache', 'GenerateCache')
      .addToUi();
  },
  getCharacterChoices: ({ databaseID, mobile = false }) => {    
    const Data_ = Data(), IO_ = IO();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!databaseID) {
      return IO_.notify({ message: 'Please add your database ID.', mobile });
    }

    const Generic_ = Generic();
    const characterCreationSheet = Generic_.getSheet('Character Creation');
    if (!characterCreationSheet) {
      return IO_.notify({
        message: 'Cannot find your Character Creation sheet. Did you delete it?',
        mobile
      });
    }
    const characterSetupRow = characterCreationSheet
      .getDataRange()
      .getValues()
      .findIndex(([key]) => key === 'Character_Setup') + 1;
    if (!characterSetupRow) {
      return IO_.notify({
        message: 'Cannot find the Character_Setup row in your Character Creation sheet.',
        mobile
      });
    }

    const characterSetupCell = `C${characterSetupRow}`;
    let setupResult = JSON.parse(
      Generic_.getValue(characterSetupCell, characterCreationSheet) || '{}'
    );
    const updateResult = (newData) => {
      setupResult = { ...setupResult, ...newData };
      Generic_.setValue(
        characterSetupCell,
        JSON.stringify(setupResult),
        characterCreationSheet
      );
      SpreadsheetApp.flush();
    };

    const getList = (sheet, name) => Data_.listOfItems({ databaseID, sheet, name });
    const classGrid = Generic_.getSheet('Class Data', databaseID)
      .getDataRange()
      .getValues();
    const classMetadata = classGrid[0];
    const raceGrid = Generic_.getSheet('Race Data', databaseID)
      .getDataRange()
      .getValues();
    const raceMetadata = raceGrid[0];
    const backgroundGrid = Generic_.getSheet('Background Data', databaseID)
      .getDataRange()
      .getValues();
    const backgroundMetadata = backgroundGrid[0];
    const descriptions = Generic_.getSheet('Descriptions', databaseID)
      .getDataRange()
      .getValues()
      .map(([name, description]) => ({ name, description }))
      .slice(1);
    const listData = Generic_.getSheet('Lists', databaseID)
      .getDataRange()
      .getValues()
      .slice(1)
      .reduce((total, [name, list]) => ({ ...total, [name]: list }), {});

    const Private = _automationPrivate();
    const wasSetupSuccessful = Private.setupClassRaceBackground({ 
      classGrid,
      classMetadata,
      raceGrid,
      raceMetadata,
      backgroundGrid,
      backgroundMetadata,
      setupResult,
      updateResult,
      descriptions,
      classes: getList('Class Data'),
      races: getList('Race Data'),
      backgrounds: getList('Background Data'),
      mobile
    });
    if (!wasSetupSuccessful) return;

    const { selectedClass, race, background, backgroundVariant } = setupResult;
    const allBackgrounds = backgroundGrid.map(([row]) => row);
    const backgroundVariantIndex = allBackgrounds.indexOf(backgroundVariant);
    const classConfig = {
      data: classGrid[classGrid.map(([row]) => row).indexOf(selectedClass)],
      metadata: classMetadata,
      selection: selectedClass
    };
    const raceConfig = {
      data: raceGrid[raceGrid.map(([row]) => row).indexOf(race)],
      metadata: raceMetadata,
      selection: race
    };
    const backgroundConfig = {
      data: backgroundGrid[
        backgroundVariantIndex === -1
          ? allBackgrounds.indexOf(background)
          : backgroundVariantIndex
      ],
      metadata: backgroundMetadata,
      selection: backgroundVariant || background
    };
    const allConfigs = { classConfig, raceConfig, backgroundConfig };

    const weapons = [
      { argument: 'simpleMelee', listName: 'Simple Melee' },
      { argument: 'simpleRanged', listName: 'Simple Ranged' },
      { argument: 'martialMelee', listName: 'Martial Melee' },
      { argument: 'martialRanged', listName: 'Martial Ranged' }
    ];
    const characterCreationCallbacks = [
      { callback: Private.setupClassRaceChoices, descriptions, keys: 'abilities' },
      { callback: Private.setupAttributes, lists: [
        { argument: 'attributeOptions', listName: 'Attributes' }
      ], keys: 'attributes' },
      { callback: Private.setupSkills, lists: [
        { argument: 'skillOptions', listName: 'Skills' }
      ], keys: ['skills', 'savingThrows'] },
      { callback: Private.setupProficiencies, lists: [
        ...weapons,
        { argument: 'landVehicles', listName: 'Land Vehicles' },
        { argument: 'mechanicalVehicles', listName: 'Mechanical Vehicles' },
        { argument: 'waterborneVehicles', listName: 'Waterborne Vehicles' }
      ], keys: 'proficiencies' },
      { callback: Private.setupTools, lists: [
        { argument: 'artisanTools', listName: "Artisan's Tools" },
        { argument: 'instruments', listName: 'Instruments' },
        { argument: 'gamingSets', listName: 'Gaming Sets' },
        { argument: 'miscellaneous', listName: 'Miscellaneous Tools' }
      ], keys: 'tools' },
      { callback: Private.setupLanguages, lists: [
        { argument: 'standard', listName: 'Standard Languages' },
        { argument: 'exotic', listName: 'Exotic Languages' }
      ], keys: 'languages' },
      { callback: Private.setupItems, lists: weapons, keys: 'items' },
      { callback: Private.setupEquipmentPack, keys: 'pack', listData }
    ];
    for (let { callback, lists = [], keys, ...extraArguments } of characterCreationCallbacks) {
      if (
        Object.keys(setupResult).some((key) => {
          return (typeof keys === 'string' ? [keys] : keys).includes(key);
        })
      ) continue;
      const callbackResult = callback({
        ...allConfigs,
        ...extraArguments,
        ...lists.reduce((total, { argument, listName }) => {
          return { ...total, [argument]: getList('Lists', listName) };
        }, {}),
        mobile
      });
      if (!callbackResult) return;
      updateResult(callbackResult);
    }

    IO_.notify({ message: 'Successfully completed the character setup.', mobile });
    return setupResult;
  },
  createSheetsFromCharacterChoices: ({
    databaseID,
    itemsKey,
    updateCallback,
    customMenuConfig,
    customSheetLevelConfig = {},
    mobile = false
  }) => {
    const Data_ = Data(), IO_ = IO();
    if (!databaseID) {
      databaseID = Data_.databaseID();
      if (!databaseID) {
        return IO_.notify({ message: 'Please add your database ID.', mobile });
      }
    }
    if (!itemsKey) {
      itemsKey = Data_.itemsKey();
      if (!itemsKey) {
        return IO_.notify({ message: 'Please add your items key.', mobile });
      }
    }

    const Generic_ = Generic();
    const allSheets = Static().allSheets();
    Object.entries(customSheetLevelConfig).forEach(([sheet, levelRequirement]) => {
      if (levelRequirement <= 1) allSheets.push(sheet);
    });
    allSheets.forEach((sheet, index) => {
      if (
        (index === allSheets.length - 1)
          || !Generic_.getSheet(sheet)
          || !Generic_.getSheet(allSheets[index + 1])
      ) updateCallback(`Update ${sheet} Sheet`, mobile);
    });
    Generic_.refreshAllSheets();
    Automation().createCustomMenu(customMenuConfig);
    // Generic_.deleteSheet('Character Creation');
    IO_.notify({
      message: 'Successfully completed the creation of the entire sheet. Have fun !!!',
      mobile
    });
  },
  Authorize: () => IO().notify({
    message: 'Scripts have been authorized successfully.'
  }),
  CreateCharacter: ({ updateCallback, mobile = false } = {}) => {
    const Automation_ = Automation();
    const getSelectedClass = () => {
      if (Generic().getSheet('Character')) {
        return Data().selectedClass();
      }
      const choices = Automation_.getCharacterChoices({ mobile });
      if (!choices) return;
      IO().notify({
        type: 'msgBox',
        message: 'Now, hold on tight as we generate your spreadsheet, ' +
          'based on your choices. This might take a few moments.',
        mobile
      });
      return choices.selectedClass;
    };

    const selectedClass = getSelectedClass();
    if (!selectedClass) return;
    Automation_.createSheetsFromCharacterChoices({
      updateCallback,
      customMenuConfig: this[selectedClass]?.()?.getCustomMenuConfig?.(),
      customSheetLevelConfig: this[selectedClass]?.()?.getCustomSheetLevelConfig?.(),
      mobile
    });
  },
  Reset: ({ mobile = false } = {}) => {
    const Generic_ = Generic(), IO_ = IO();
    const characterCreationSheet = Generic_.getSheet('Character Creation');
    if (!characterCreationSheet) {
      return IO_.notify({
        message: 'Cannot find your Character Creation sheet. Did you delete it?',
        mobile
      });
    }
    const characterSetupRow = characterCreationSheet
      .getDataRange()
      .getValues()
      .findIndex(([key]) => key === 'Character_Setup') + 1;
    if (characterSetupRow) {
      Generic_.setValue(`C${characterSetupRow}`, '', characterCreationSheet);
    }
    const cacheRow = characterCreationSheet
      .getDataRange()
      .getValues()
      .findIndex(([key]) => key === 'Cache') + 1;
    if (cacheRow) {
      Generic_.setValue(`C${cacheRow}`, '', characterCreationSheet);
    }
    Generic_.removeAllNamedRanges();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet.getSheets().forEach((sheet) => {
      if (sheet.getName() !== 'Character Creation') {
        spreadsheet.deleteSheet(sheet);
      }
    });
    IO_.notify({
      message: 'Everything has been wiped clean, you are free to start over.',
      mobile
    });
  },
  RefreshSpreadsheet: ({ mobile = false }) => {
    const IO_ = IO();
    IO_.notify({ message: 'Refreshing all sheets of the Spreadsheet', mobile });
    Generic().refreshAllSheets();
    IO_.notify({ message: 'Refreshing is complete', mobile });
  },
  CheckForUpdates: ({ updateCallback, mobile = false }) => {
    const pendingUpdatesData = Generic().getNamedRange('Pending_Updates');
    if (!pendingUpdatesData.value || pendingUpdatesData.value === '[]') {
      IO().notify({ message: 'There are no pending updates.', mobile });
    }
    Automation().checkForMissingUpdates({ pendingUpdatesData, updateCallback, mobile });
  },
  LearnAbility: ({ 
    databaseID,
    choices,
    selectedClass,
    race,
    level,
    path,
    spellConfig = {},
    updateCallback,
    sheets = ['Class Variables', 'Class Attributes', ...Static().actionSheets()],
    onLearn,
    apply = true,
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const IO_ = IO();
    const abilityToLearn = IO_.notify({
      message: 'Which ability do you want to learn?',
      type: 'inputBox',
      mobile,
      isMobileAnswerInputType: true
    });
    const lowerCaseAbility = abilityToLearn.toLowerCase();
    if (!abilityToLearn || abilityToLearn === 'cancel') return;
    const alreadyLearnedAbility = choices.find((choice) => {
      return lowerCaseAbility === choice.toLowerCase();
    });
    if (alreadyLearnedAbility) {
      return IO_.notify({
        message: `You have already learned ${alreadyLearnedAbility}.`,
        mobile
      });
    }

    const Convert_ = Convert(), Automation_ = Automation();
    let actualAbilityName = '';
    let sheetUpdateData = {};
    sheets.forEach((sheet) => {
      let includeSheet = false;
      const sheetName = sheet.replace('Class ', '');
      const titleColumnName = Convert_.toSingular(sheetName);
      const validQueryData = {};
      Automation_.query({
        sourceID: databaseID,
        source: sheet,
        conditions: {
          'Class': spellConfig.selectedClass || ((value) => ['', selectedClass].includes(value)),
          'Level': spellConfig.level || ((value) => (value || 0) <= level),
          'Race': spellConfig.race || ((value) => !value || value.includes(race)),
          'Path': spellConfig.path || ((value) => !value || (path && value.includes(path))),
          'Choice': (value, row) => (getColumn) => {
            if (!value) return;
            const title = getColumn(titleColumnName);
            if (value === true) {
              if (title.toLowerCase() === lowerCaseAbility) {
                actualAbilityName = title;
                validQueryData[title] = row;
              }
              return;
            }
            if (value.toLowerCase() === lowerCaseAbility) {
              if (title) validQueryData[title] = row;
              else includeSheet = true;
            }
          }
        },
        includeFormulas: true,
        ...(sheetName === 'Variables' && { metadataRowLength: 1 })
      });
      if (Object.keys(validQueryData).length || includeSheet) {
        sheetUpdateData[sheetName] = validQueryData;
      }
    });
    if (!Object.keys(sheetUpdateData).length) {
      return IO_.notify({
        message: `Could not find a valid ability called: ${abilityToLearn}`,
        mobile
      });
    }

    const Generic_ = Generic(), History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    const characterSetupData = Generic_.getNamedRange('Character_Setup');
    const characterSetup = JSON.parse(characterSetupData.value || '{}');
    trackHistory({
      ...characterSetupData,
      value: JSON.stringify({
        ...characterSetup,
        abilities: [...(characterSetup?.abilities || []), actualAbilityName]
      })
    });

    if (onLearn) {
      const onLearnSheetUpdateData = [];
      for (const callback of Array.isArray(onLearn) ? onLearn : [onLearn]) {
        const callbackData = callback({
          spellName: actualAbilityName,
          mobile,
          trackHistory
        });
        if (!callbackData) return;
        if (typeof callbackData === 'object') {
          onLearnSheetUpdateData.push(callbackData);
        }
      }
      sheetUpdateData = Data_.deepObjectMerge([
        sheetUpdateData,
        ...onLearnSheetUpdateData
      ]);
    }

    if (apply) {
      History_.applyChanges(changes);
      if (
        !Automation_.updateSheets({
          level: null,
          sheetUpdateData,
          updateCallback,
          mobile
        })
      ) return;
    }

    Generic_.refreshAllSheets();
    IO_.notify({
      message: `You have successfully finished learning ${actualAbilityName}.`,
      mobile
    });
    return { changesHistory: changes, sheetUpdateData };
  },
  GenerateVariables: ({
    additionalVariables = [],
    excludedVariables = [],
    mobile = false
  } = {}) => {
    const Private = _automationPrivate();
    Private.createAttributesNamedRanges({ excludedNamedRanges: excludedVariables, mobile });
    Private.createChecksNamedRanges({ mobile });
    Private.createCharacterNamedRanges({ mobile });
    Private.createVariableNamedRanges({ mobile });
    Private.createAdditionalVariables(additionalVariables);
    Generic().refreshAllSheets();
    IO().notify({ message: 'Successfully generated all variables.', mobile });
  },
  GenerateCache: ({
    cacheCallbacks = {},
    cacheConfig = {},
    attributeMetadataConfig = {},
    ignoredAttributeRows,
    ignoredColumns = {},
    metadataConfig = {},
    customSheetCaching = [],
    mobile = false
  } = {}) => {
    const Generic_ = Generic(), Cache_ = Cache();
    const { sheet, range } = Generic_.getNamedRange('Cache');
    if (!sheet || !range) return;
    const cache = Cache_.getEntireCache({
      cacheCallbacks,
      cacheConfig,
      attributeMetadataConfig,
      ignoredAttributeRows,
      ignoredColumns,
      metadataConfig,
      mobile
    });
    customSheetCaching.forEach(({ name, callback }) => cache[name] = callback({ mobile }));
    Generic_.setValue(range, JSON.stringify(cache), sheet);
    IO().notify({ message: 'Successfully generated the cache.', mobile });
  },
  LevelUp: ({
    databaseID,
    choices,
    selectedClass,
    race,
    level,
    path,
    maxAttributes = {},
    customSheetLevelConfig = {},
    customMenuConfig = {},
    spellConfigCallback,
    updateCallback,
    onLevelUp,
    apply = true,
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!choices) choices = Data_.choices();
    if (!selectedClass) selectedClass = Data_.selectedClass();
    if (!race) race = Data_.race();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const IO_ = IO(), Automation_ = Automation();
    const updatesCheck = Automation_.checkForMissingUpdates({ updateCallback, mobile });
    if (updatesCheck === undefined) return;
    if (updatesCheck) {
      const continueLevelUp = IO_.askForYesOrNo({
        title: 'All sheets updated',
        message: `Do you still want to level up to Level ${level + 1}?`,
        mobile
      });
      if (!continueLevelUp) return;
    }

    const Generic_ = Generic(), History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    trackHistory({
      ...Generic_.getNamedRange('Level'),
      value: 1,
      relative: true,
      max: 20
    });
    const lists = Generic_.getSheet('Lists', databaseID)
      .getDataRange()
      .getValues()
      .map(([name, list]) => ({ name, list })).slice(1);
    const descriptions = Generic_.getSheet('Descriptions', databaseID)
      .getDataRange()
      .getValues()
      .map(([name, description]) => ({ name, description }))
      .slice(1);

    const Private = _automationPrivate();
    const { choiceOptions, choiceData } = Private.getNextLevelChoiceOptions({
      databaseID,
      selectedClass,
      race,
      level,
      path,
      lists,
      ...(spellConfigCallback && {
        spellConfig: spellConfigCallback({ level: level + 1 })
      })
    });
    const nextLevelChoices = Private.askForNextLevelChoices({
      choiceOptions,
      choices,
      descriptions,
      maxAttributes,
      mobile,
      trackHistory
    });
    if (!nextLevelChoices) return;

    const chosenPath = nextLevelChoices.selectedPath || path;
    let sheetUpdateData = Private.getNextLevelSheetUpdates({
      databaseID,
      choices: nextLevelChoices.newChoices || [],
      selectedClass,
      race,
      level,
      path: chosenPath,
      ...(spellConfigCallback && {
        spellConfig: spellConfigCallback({
          level: level + 1,
          path: chosenPath
        })
      })
    });
    if (onLevelUp) {
      const onLevelUpSheetUpdateData = [];
      for (const callback of Array.isArray(onLevelUp) ? onLevelUp : [onLevelUp]) {
        const callbackData = callback({
          selectedClass,
          race,
          nextLevel: level + 1,
          path: path || nextLevelChoices.selectedPath,
          attributesIncreased: nextLevelChoices.attributesIncreased,
          choiceData,
          oldChoices: choices,
          newChoices: nextLevelChoices.newChoices,
          descriptions,
          mobile,
          trackHistory
        });
        if (!callbackData) return;
        if (typeof callbackData === 'object') {
          onLevelUpSheetUpdateData.push(callbackData);
        }
      }
      sheetUpdateData = Data_.deepObjectMerge([
        sheetUpdateData,
        ...onLevelUpSheetUpdateData
      ]);
    }

    if (apply) {
      History_.applyChanges(changes);
      if (
        !Automation_.updateSheets({
          level,
          sheetUpdateData,
          updateCallback,
          customSheetLevelConfig,
          mobile
        })
      ) return;
    }

    Automation_.createCustomMenu(customMenuConfig);
    Generic_.refreshAllSheets();
    IO_.notify({
      message: `You have successfully leveled up from level ${level} to ${level + 1}.`,
      mobile
    });
    return { changesHistory: changes, sheetUpdateData };
  },
  UpdateMobileSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    customMobileConfig = [],
    customMenuConfig = {},
    spellNameConfig = {},
    spellConfig = {},
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateMobileSheet,
      sheetName: 'Mobile',
      cacheConfig,
      cacheArguments,
      customMobileConfig,
      customMenuConfig,
      spellNameConfig,
      spellConfig,
      onFormat,
      mobile
    });
  },
  UpdateAttributesSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    excludedNamedRanges = [],
    finalizeValuesConfig = [],
    onInitializeAttribute,
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAttributesSheet,
      sheetName: 'Attributes',
      cacheConfig,
      cacheArguments,
      excludedNamedRanges,
      finalizeValuesConfig,
      onInitializeAttribute,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateChecksSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateChecksSheet,
      sheetName: 'Checks',
      cacheConfig,
      cacheArguments,
      onFormat,
      mobile
    });
  },
  UpdateActionsSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Actions',
      nextToSheet: 'Checks, Attributes, Mobile',
      backgroundColor: '#D9EAD3',
      firstRowColor: '#B6D7A8',
      lastColumnWidth: 825,
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateBonusActionsSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Bonus Actions',
      nextToSheet: 'Actions, Checks, Attributes, Mobile',
      backgroundColor: '#FFF2CC',
      firstRowColor: '#FFE599',
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateReactionsSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Reactions',
      nextToSheet: 'Bonus Actions, Actions, Checks, Attributes, Mobile',
      backgroundColor: '#F4CCCC',
      firstRowColor: '#EA9999',
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateInteractionsSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Interactions',
      nextToSheet: 'Reactions, Bonus Actions, Actions, Checks, Attributes, Mobile',
      backgroundColor: '#D9D2E9',
      firstRowColor: '#B4A7D6',
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateMovementSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Movement',
      nextToSheet: 'Interactions, Reactions, Bonus Actions, Actions, Checks, Attributes, Mobile',
      backgroundColor: '#CCFFE7',
      firstRowColor: '#A8EBD3',
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdatePassivesSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    namedRangesConfig = {},
    spellConfig = {},
    beforeFormat,
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateAbilitiesSheet,
      setupDataNormalizer: ({ background, backgroundVariant, abilities, ...rest }) => ({
        background: backgroundVariant || background,
        choices: abilities,
        ...rest
      }),
      sheetName: 'Passives',
      nextToSheet: 'Movement, Interactions, Reactions, Bonus Actions, Actions, Checks, Attributes, Mobile',
      backgroundColor: '#FCE5CD',
      firstRowColor: '#F9CB9C',
      lastColumnWidth: 1200,
      cacheConfig,
      cacheArguments,
      namedRangesConfig,
      spellConfig,
      beforeFormat,
      onFormat,
      mobile
    });
  },
  UpdateProficienciesSheet: ({ onFormat ,mobile = false } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateProficienciesSheet,
      setupDataNormalizer: ({
        proficiencies = [],
        tools = [],
        vehicles = [],
        languages = [],
        ...rest
      }) => {
        return {
          proficiencies: [...proficiencies, ...tools, ...vehicles, ...languages],
          ...rest
        };
      },
      sheetName: 'Proficiencies',
      onFormat,
      mobile
    });
  },
  UpdateInventorySheet: ({ onFormat, mobile = false } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateInventorySheet,
      sheetName: 'Inventory',
      onFormat,
      mobile
    });
  },
  UpdateCharacterSheet: ({
    cacheConfig = {},
    cacheArguments = {},
    onFormat,
    mobile = false
  } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateCharacterSheet,
      setupDataNormalizer: ({ background, backgroundVariant, ...rest }) => ({
        background: backgroundVariant || background,
        ...rest
      }),
      sheetName: 'Character',
      cacheConfig,
      cacheArguments,
      onFormat,
      mobile
    });
  },
  UpdateVariablesSheet: ({ onFormat, mobile = false } = {}) => {
    _automationPrivate().createMenuButton({
      callback: Automation().generateVariablesSheet,
      sheetName: 'Variables',
      onFormat,
      mobile
    });
  },
  getButtonConfig: () => ({
    automation: () => ({
      'Refresh Spreadsheet': () => ({ callback: Automation().RefreshSpreadsheet }),
      'Check for Updates': () => ({ callback: Automation().CheckForUpdates }),
      'Learn Ability': () => ({ callback: Automation().LearnAbility }),
      'Update Mobile Sheet': () => ({ callback: Automation().UpdateMobileSheet }),
      'Update Attributes Sheet': () => ({ callback: Automation().UpdateAttributesSheet }),
      'Update Checks Sheet': () => ({ callback: Automation().UpdateChecksSheet }),
      'Update Actions Sheet': () => ({ callback: Automation().UpdateActionsSheet }),
      'Update Bonus Actions Sheet': () => ({ callback: Automation().UpdateBonusActionsSheet }),
      'Update Reactions Sheet': () => ({ callback: Automation().UpdateReactionsSheet }),
      'Update Interactions Sheet': () => ({ callback: Automation().UpdateInteractionsSheet }),
      'Update Movement Sheet': () => ({ callback: Automation().UpdateMovementSheet }),
      'Update Passives Sheet': () => ({ callback: Automation().UpdatePassivesSheet }),
      'Update Proficiencies Sheet': () => ({ callback: Automation().UpdateProficienciesSheet }),
      'Update Inventory Sheet': () => ({ callback: Automation().UpdateInventorySheet }),
      'Update Character Sheet': () => ({ callback: Automation().UpdateCharacterSheet }),
      'Update Variables Sheet': () => ({ callback: Automation().UpdateVariablesSheet }),
      'Generate Variables': () => ({ callback: Automation().GenerateVariables }),
      'Generate Cache': () => ({ callback: Automation().GenerateCache }),
      'Level Up': () => ({ callback: Automation().LevelUp })
    })
  }),
  getCacheConfig: ({ configCallbacks = [], classConfig = {}, customConfig = {} }) => {
    const Generic_ = Generic();
    return Data().deepObjectMerge([
      ...configCallbacks.reduce((total, callback) => {
        const result = Generic_.unwrap(callback);
        if (!result) return total;
        if (!result.getCacheConfig) return [...total, result];
        return [...total, result.getCacheConfig()];
      }, []),
      classConfig,
      customConfig
    ]);
  }
});
