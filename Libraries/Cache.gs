const _cachePrivate = () => ({
  unwrapCacheConfig: (cacheConfig, sheet) => {
    if (typeof cacheConfig !== 'function') return cacheConfig;
    cacheConfig = Generic().unwrap(cacheConfig);
    const sheetName = Convert().toCamelCase(sheet);
    if (cacheConfig?.[sheetName]) return cacheConfig[sheetName];
    return cacheConfig;
  },
  applyConfig: (commands, callback, config) => {
    const abstractCacheCallback = (commands, config) => {
      const Generic_ = Generic();
      const data = {};
      Object.entries(commands).forEach(([name, info]) => {
        const originalName = name.replace(/\d+$/, '');
        const occurenceCount = parseInt(name.replace(/^\D+/g, '')) || 0;
        let newName = name;

        const configItem = config[originalName];
        if (configItem) {
          const configDetails = configItem[occurenceCount];
          const { rename, version, deletions, ...rest } = configDetails;
          newName = rename ? rename : `${originalName}${version ? ` ${version}` : ''}`;
          (deletions || []).forEach((keyToBeDeleted) => delete info[keyToBeDeleted]);
          info = {
            ...info,
            ...Object.entries(rest).reduce((total, [key, value]) => {
              return { ...total, [key]: Generic_.unwrap(value) };
            }, {})
          };
        }

        data[newName] = info;
      });
      return data;
    };

    if (!Object.keys(commands).length) return {};
    if (callback) return callback(commands);
    if (config) return abstractCacheCallback(commands, config);
    return commands;
  }
});

var Cache = () => ({
  getCache: ({ sheet, fallback, variableName = 'Cache' } = {}) => {
    const Generic_ = Generic();
    if (sheet && !Generic_.getSheet(sheet)) return fallback?.() || {};
    let { value: variablesValue } = Generic_.getNamedRange(variableName);
    if (variablesValue === undefined) {
      const variablesSheet = Generic_.getSheet('Variables');
      if (variablesSheet) {
        variablesValue = variablesSheet
          .getDataRange()
          .getValues()
          .find(([variable]) => variable === variableName)?.[1] || '{}';
      } else variablesValue = '{}';
    }

    let cacheValue = '{}';
    const characterCreationSheet = Generic_.getSheet('Character Creation');
    if (characterCreationSheet) {
      cacheValue = characterCreationSheet
        .getDataRange()
        .getValues()
        .find(([variable]) => variable === variableName)?.[2] || '{}';
    }
    const entireCache = {
      ...JSON.parse(variablesValue || '{}'),
      ...JSON.parse(cacheValue)
    };

    if (!sheet) {
      return Object.keys(entireCache).length
        ? entireCache
        : (fallback?.() || {});
    }
    return entireCache[Generic_.getSheet(sheet).getName()] || fallback?.() || {};
  },
  saveCache: (cache, { sheetName, variableName = 'Cache' } = {}) => {
    const Generic_ = Generic();
    let { range: variablesCell } = Generic_.getNamedRange(variableName);
    const variablesSheet = Generic_.getSheet('Variables');
    if (variablesSheet && !variablesCell) {
      const cacheRow = variablesSheet
        .getDataRange()
        .getValues()
        .findIndex(([variable]) => variable === variableName) + 1;
      if (cacheRow) variablesCell = `B${cacheRow}`;
    }

    let cacheCell;
    const characterCreationSheet = Generic_.getSheet('Character Creation');
    if (characterCreationSheet) {
      const cacheRow = characterCreationSheet
        .getDataRange()
        .getValues()
        .findIndex(([variable]) => variable === variableName) + 1;
      if (cacheRow) cacheCell = `C${cacheRow}`;
    }

    const cacheToBeSaved = sheetName
      ? { ...Cache().getCache(), [sheetName]: cache }
      : cache;
    const stringifiedCache = typeof cache === 'string'
      ? cacheToBeSaved
      : JSON.stringify(cacheToBeSaved);
    if (variablesCell) Generic_.setValue(variablesCell, stringifiedCache, variablesSheet);
    if (cacheCell) Generic_.setValue(cacheCell, stringifiedCache, characterCreationSheet);
  },
  cacheMobileData: ({
    cacheConfig,
    callback,
    sheetName = 'Mobile',
    saveToMemory = false,
    mobile = false
  } = {}) => {
    const mobileData = {};
    const sheet = Generic().getSheet(sheetName);
    if (!sheet) return mobileData;

    const Convert_ = Convert();
    IO().notify({ message: 'Caching mobile data...', mobile });
    const grid = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getValues();
    for (let row = 0; row < grid.length - 3; row += 2) {
      const value = grid[row][0];
      if (value !== '') mobileData[`A${row + 2}`] = Convert_.toCamelCase(value);
    }

    const Private = _cachePrivate();
    const cache = Private.applyConfig(
      mobileData,
      callback,
      Private.unwrapCacheConfig(cacheConfig, sheetName)
    );
    if (saveToMemory) Cache().saveCache(cache, { sheetName });
    return cache;
  },
  cacheAttributeData: ({
    cacheConfig,
    callback,
    attributeMetadataConfig = {},
    ignoredRows = [],
    ignoredColumns = [],
    sheetName = 'Attributes',
    saveToMemory = false,
    mobile = false
  } = {}) => {
    const Generic_ = Generic();
    const attributeData = {};
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet) return attributeData;

    const Convert_ = Convert();
    IO().notify({ message: 'Caching attribute data...', mobile });
    const metadataConfig = {
      'Slots': ['Max Slots'],
      'HP': ['Max HP'],
      'Hit Dice': ['Max Hit Dice', 'Hit Dice Type'],
      'STR': ['STR Modifier'],
      'DEX': ['DEX Modifier'],
      'CON': ['CON Modifier'],
      'INT': ['INT Modifier'],
      'WIS': ['WIS Modifier'],
      'CHA': ['CHA Modifier'],
      ...attributeMetadataConfig
    };
    const occurenceData = { lastKeyFound: '', emptyCounter: 0 };
    const grid = sheet.getDataRange().getValues();
    for (let row = 0; row < grid.length - 1; row += 2) {
      if (
        ['Death Saves', 'Roll History', ...ignoredRows]
          .some((rowTag) => grid[row][0].startsWith(rowTag))
      ) continue;

      for (let column = 0; column < grid[row].length; column++) {
        const titleMergedRange = Generic_.getMergedCells([row + 1, column + 1], sheet);
        if (
          titleMergedRange
            && titleMergedRange === Generic_.getMergedCells([row + 2, column + 1], sheet)
        ) continue;

        const currentValue = grid[row][column];
        if (
          ignoredColumns.some((columnTag) => currentValue.startsWith(columnTag))
            || (currentValue === '' && grid[row + 1][column] === '')
        ) continue;

        const cell = Convert_.toA1Notation(row + 2, column + 1);
        if (currentValue !== '') {
          attributeData[currentValue] = cell;
          const keys = Object.keys(attributeData);
          occurenceData.lastKeyFound = keys.at(-1);
          occurenceData.emptyCounter = 0;
        } else {
          attributeData[metadataConfig[occurenceData.lastKeyFound][occurenceData.emptyCounter]] = cell;
          occurenceData.emptyCounter++;
        }
      }
    }

    const successes = [], failures = [];
    const deathSaveIndex = grid.findIndex(([firstColumn]) => firstColumn === 'Death Saves');
    if (deathSaveIndex !== -1) {
      const checkboxIndex = grid[deathSaveIndex].findIndex((item) => typeof item === 'boolean');
      if (checkboxIndex !== -1) {
        for (let column = checkboxIndex; column < grid[0].length; column++) {
          const successCheck = typeof grid[deathSaveIndex][column] === 'boolean';
          const failureCheck = typeof grid[deathSaveIndex + 1][column] === 'boolean';
          if (successCheck) successes.push(Convert_.toA1Notation(deathSaveIndex + 1, column + 1));
          if (failureCheck) failures.push(Convert_.toA1Notation(deathSaveIndex + 2, column + 1));
          if (!successCheck && !failureCheck) break;
        }
        attributeData['Death Saves'] = { 'Successes': successes, 'Failures': failures };
      }
    }

    const Private = _cachePrivate();
    const rollHistoryCellList = [];
    sheet.getRange(`${grid.length}:${grid.length}`).getMergedRanges().forEach((range) => {
      const cell = range.getCell(1,1).getA1Notation();
      if (!cell.startsWith('A')) rollHistoryCellList.push(cell);
    });
    const cache = Private.applyConfig(
      { ...attributeData, ['Roll History']: rollHistoryCellList.sort() },
      callback,
      Private.unwrapCacheConfig(cacheConfig, sheetName)
    );
    if (saveToMemory) Cache().saveCache(cache, { sheetName });
    return cache;
  },
  cacheCheckData: ({
    cacheConfig,
    callback,
    sheetName = 'Checks',
    saveToMemory = false,
    mobile = false
  } = {}) => {
    const Generic_ = Generic();
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet) return {};

    const Convert_ = Convert();
    IO().notify({ message: 'Caching checks data...', mobile });
    const grid = sheet.getDataRange().getValues();
    const checksData = { 'Saving Throws': {} };
    const attributeColumn = Generic_.getColumnIndex('Attribute', 1, sheet) - 1;
    const typeColumn = Generic_.getColumnIndex('Type', 1, sheet) - 1;
    const proficiencyColumn = Generic_.getColumnIndex('Proficiency', 1, sheet) - 1;
    const advantageColumn = Generic_.getColumnIndex('Advantage', 1, sheet) - 1;
    const modifierColumn = Generic_.getColumnIndex('Modifier', 1, sheet) - 1;

    const Private = _cachePrivate();
    for (let row = 1; row < grid.length; row++) {
      const attribute = grid[row][attributeColumn];
      const type = grid[row][typeColumn];
      const checkData = {
        proficiency: Convert_.toA1Notation(row + 1, proficiencyColumn + 1),
        modifier: Convert_.toA1Notation(row + 1, modifierColumn + 1),
        advantage: Convert_.toA1Notation(row + 1, advantageColumn + 1)
      };

      if (type === 'Saving Throws') checksData[type][attribute] = checkData;
      else checksData[type] = checkData;
    }
    const cache = Private.applyConfig(
      checksData,
      callback,
      Private.unwrapCacheConfig(cacheConfig, sheetName)
    );
    if (saveToMemory) Cache().saveCache(cache, { sheetName });
    return cache;
  },
  cacheCharacterData: ({
    cacheConfig,
    callback,
    sheetName = 'Character',
    saveToMemory = false,
    mobile = false
  }) => {
    const Generic_ = Generic();
    const characterData = {};
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet) return characterData;

    const Convert_ = Convert(), Private = _cachePrivate();
    IO().notify({ message: 'Caching Character data...', mobile });
    const grid = sheet.getDataRange().getValues();
    let parsedPersonality = false;
    for (let row = 0; row < grid.length; row += parsedPersonality ? 1 : 2) {
      if (grid[row][0] === 'Personality') parsedPersonality = true;
      for (let column = 0; column < grid[row].length; column++) {
        const value = grid[row][column];
        if (!value) continue;

        const saveToData = (row, column, key = value) => {
          characterData[key] = Convert_.toA1Notation(row, column);
        };

        if (!parsedPersonality) {
          saveToData(row + 2, column + 1);
          continue;
        }

        const mergedRange = Generic_.getMergedCells([row + 1, column + 1], sheetName);
        if (mergedRange) {
          const rightmostMergedCell = Convert_.toRowColumnNotation(mergedRange.split(':')[1]);
          saveToData(rightmostMergedCell.row, rightmostMergedCell.column + 1);
        } else saveToData(row + 1, column + 2);
        if (value === 'Flaws') {
          saveToData(row + 2, column + 1, 'Backstory');
          saveToData(row + 3, column + 1, 'Image');
          return characterData;
        }
        if (parsedPersonality) break;
      }
    }
    const cache = Private.applyConfig(
      characterData,
      callback,
      Private.unwrapCacheConfig(cacheConfig, sheetName)
    );
    if (saveToMemory) Cache().saveCache(cache, { sheetName });
    return cache;
  },
  generateMetadata: ({ sheet, rowLength, metadataConfig = {} }) => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject) return {};

    const mergeMetadata = (array, cutoff) => {
      const mergedMetadata = [];
      for (let row = 0; row < cutoff; row++) {
        let lastNonEmpty = '';
        for (let column = 0; column < array[row].length; column++) {
          if (Generic_.getAboveMergedCell([row + 1, column + 1], sheetObject)) continue;
          if (array[row][column] !== '') lastNonEmpty = array[row][column];
          if (lastNonEmpty !== '') {
            if (mergedMetadata[column]) mergedMetadata[column] += ` ${lastNonEmpty}`;
            else mergedMetadata[column] = lastNonEmpty;
          }
        }
      }
      return mergedMetadata;
    };

    const Convert_ = Convert();
    const grid = sheetObject.getRange(
      1,
      1,
      sheetObject.getMaxRows(),
      sheetObject.getMaxColumns()
    ).getValues();
    const startingRow = rowLength
      || (grid.slice(1).findIndex((row) => row.at(-1) !== '') + 1)
      || 1;
    const totalMetadataConfig = {
      'Slots': ['currentSlots', 'maxSlots'],
      'Cost': ['slotCost'],
      'Cost Slots': ['slotCost'],
      'Cost Type': ['slotType'],
      'Cost HP': ['healthCost'],
      'Ammo': ['ammo', '', ''],
      'Effect': ['mainEffect', 'secondaryEffect'],
      ...metadataConfig
    };

    let emptyCounter = 0, lastKeyFound = '';
    const metadata = mergeMetadata(grid, startingRow).map((data) => {
      const configResult = totalMetadataConfig[data];
      if (!configResult) {
        emptyCounter = 0;
        lastKeyFound = data;
        return Convert_.toCamelCase(data);
      } else {
        if (data === lastKeyFound) emptyCounter++;
        else {
          emptyCounter = 0;
          lastKeyFound = data;
        }
        return Convert_.toCamelCase(configResult[emptyCounter]);
      }
    });

    return { grid, startingRow, metadata };
  },
  cacheSpellData: ({
    cacheConfig,
    callback,
    sheetName,
    ignoredColumns = [],
    metadataConfig = {},
    saveToMemory = false,
    mobile = false
  }) => {
    const Generic_ = Generic();
    const spellData = {};
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet || Generic_.getBackground('A1', sheet) === '#ffffff') {
      return spellData;
    }

    const addUniqueKey = (key, value) => {
      if (!spellData.hasOwnProperty(key)) {
        spellData[key] = value;
        return;
      }

      const originalKey = key.replace(/\d+$/, '');
      const numericPart = parseInt(key.replace(/^\D+/g, ''));
      let counter = isNaN(numericPart) ? 1 : numericPart;
      while (spellData.hasOwnProperty(`${originalKey}${counter}`)) counter++;
      spellData[`${originalKey}${counter}`] = value;
    };

    const Convert_ = Convert(), Cache_ = Cache(), Private = _cachePrivate();
    IO().notify({ message: `Caching ${sheetName} data...`, mobile });
    ignoredColumns = [
      'action',
      'bonusAction',
      'reaction',
      'interaction',
      'movement',
      'passive',
      'range',
      'description',
      ...ignoredColumns
    ];
    const { grid, startingRow, metadata } = Cache_.generateMetadata({ sheet, metadataConfig });
    for (let row = startingRow; row < grid.length; row++) {
      const currentSpell = {};
      let name = grid[row][0] || Object.keys(spellData).at(-1);
      if (name.includes(':')) name = name.split(':')[0];
      for (let column = 0; column < grid[row].length; column++) {
        const currentValue = grid[row][column];
        if (currentValue === '-') continue;

        const cell = Convert_.toA1Notation(row + 1, column + 1);
        if (typeof currentValue === 'boolean') {
          currentSpell.tracker = cell;
          continue;
        }

        const key = metadata[column];
        if ([...ignoredColumns, ''].includes(key)) continue;

        const firstMergedCell = Generic_.getFirstMergedCell(cell, sheet);
        if (!firstMergedCell || firstMergedCell === cell) {
          currentSpell[key] = cell;
          continue;
        }

        if (cell.replace(/[0-9]/g, '') === firstMergedCell.replace(/[0-9]/g, '')) {
          const {
            row: mergedRow,
            column: mergedColumn
          } = Convert_.toRowColumnNotation(firstMergedCell);
          if (grid[mergedRow - 1][mergedColumn - 1] !== '-') {
            currentSpell[key] = firstMergedCell;
          }
        }
      }
      addUniqueKey(name, currentSpell);
    }
    const cache = Private.applyConfig(
      spellData,
      callback,
      Private.unwrapCacheConfig(cacheConfig, sheetName)
    );
    if (saveToMemory) Cache_.saveCache(cache, { sheetName });
    return cache;
  },
  getEntireCache: ({
    cacheCallbacks = {},
    cacheConfig = {},
    attributeMetadataConfig = {},
    ignoredAttributeRows,
    ignoredColumns = {},
    metadataConfig = {},
    mobile = false
  }) => {
    const Cache_ = Cache();
    cacheConfig = Generic().unwrap(cacheConfig);
    return {
      ['Mobile']: Cache_.cacheMobileData({
        cacheConfig: cacheConfig.mobile,
        callback: cacheCallbacks.mobile,
        mobile
      }),
      ['Attributes']: Cache_.cacheAttributeData({
        cacheConfig: cacheConfig.attributes,
        callback: cacheCallbacks.attributes,
        attributeMetadataConfig,
        ignoredRows: ignoredAttributeRows,
        ignoredColumns: ignoredColumns.attributes,
        mobile
      }),
      ['Checks']: Cache_.cacheCheckData({
        cacheConfig: cacheConfig.checks,
        callback: cacheCallbacks.checks,
        mobile
      }),
      ['Actions']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.actions,
        callback: cacheCallbacks.actions,
        sheetName: 'Actions',
        ignoredColumns: ignoredColumns.actions,
        metadataConfig: metadataConfig.actions,
        mobile
      }),
      ['Bonus Actions']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.bonusActions,
        callback: cacheCallbacks.bonusActions,
        sheetName: 'Bonus Actions',
        ignoredColumns: ignoredColumns.bonusActions,
        metadataConfig: metadataConfig.bonusActions,
        mobile
      }),
      ['Reactions']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.reactions,
        callback: cacheCallbacks.reactions,
        sheetName: 'Reactions',
        ignoredColumns: ignoredColumns.reactions,
        metadataConfig: metadataConfig.reactions,
        mobile
      }),
      ['Interactions']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.interactions,
        callback: cacheCallbacks.interactions,
        sheetName: 'Interactions',
        ignoredColumns: ignoredColumns.interactions,
        metadataConfig: metadataConfig.interactions,
        mobile
      }),
      ['Movement']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.movement,
        callback: cacheCallbacks.movement,
        sheetName: 'Movement',
        ignoredColumns: ignoredColumns.movement,
        metadataConfig: metadataConfig.movement,
        mobile
      }),
      ['Passives']: Cache_.cacheSpellData({
        cacheConfig: cacheConfig.passives,
        callback: cacheCallbacks.passives,
        sheetName: 'Passives',
        ignoredColumns: ignoredColumns.passives,
        metadataConfig: metadataConfig.passives,
        mobile
      }),
      ['Character']: Cache_.cacheCharacterData({
        cacheConfig: cacheConfig.character,
        callback: cacheCallbacks.character,
        mobile
      })
    };
  }
});
