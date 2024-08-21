const _inventoryPrivate = () => ({
  reformTypeRange: (
    itemRow,
    typeColumn,
    endRangeModifier = 0,
    typesCache = []
  ) => {
    const grid = Generic().getSheetValues('Inventory');
    if (!typeColumn) typeColumn = grid[0].indexOf('Type') + 1;
    if (!typeColumn) {
      throw 'Your Inventory sheet does not have a "Type" column.';
    }

    let types;
    if (typesCache?.length) types = typesCache;
    else {
      types = grid.map((row) => row[typeColumn - 1]).flat();
      typesCache.push(...types);
    }

    let startRow = 2, endRow = types.length;
    for (let i = itemRow - 1; i >= 0; i--) {
      if (!types[i]) continue;
      startRow = i + 1;
      break;
    }
    for (let i = itemRow; i <= endRow; i++) {
      if (!types[i]) continue;
      endRow = i + 1;
      break;
    }

    const Convert_ = Convert();
    return `${
      Convert_.toA1Notation(startRow, typeColumn)
    }:${Convert_.toA1Notation(endRow + endRangeModifier, typeColumn)}`;
  },
  lootItem: ({
    itemName,
    count = 1,
    feet,
    note,
    typesCache = [],
    apply = true,
    skipOutput = false,
    ignoreHistoryCommands = false,
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    const Generic_ = Generic(), History_ = History();
    const trackHistoryMissing = !trackHistory;
    const formatCountFeetValue = (value) => {
      if (feet === undefined) return count + (value || 0);
      if (feet === '') return (value === undefined || value === '') ? '' : `${value}ft`;
      return `${feet + (value || 0)}ft`; 
    };
    const output = () => {
      if (apply) {
        History().applyChanges(trackHistoryMissing ? changes : trackHistory([], changes));
      }
      if (!skipOutput) {
        IO().notify({
          message: `You have successfully looted: ${
            feet ? `${feet}ft of ` : ''
          }${itemName}${count > 1 ? ` (x${count})` : ''}.`,
          mobile
        });
      }
      return changes;
    };
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }

    const sheet = 'Inventory';
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject) throw 'There is no Inventory sheet.';

    const {
      row,
      name,
      exists,
      type,
      color
    } = Inventory().getInventoryRow({ itemName });
    itemName = name || itemName;
    const metadata = sheetObject.getDataRange().getValues()[0];
    const typeColumn = metadata.indexOf('Type') + 1;
    if (!typeColumn) throw 'Your Inventory sheet does not have a "Type" column.';
    const nameColumn = metadata.indexOf('Name') + 1;
    if (!nameColumn) throw 'Your Inventory sheet does not have a "Name" column.';
    const countColumn = metadata.indexOf('#') + 1;
    if (!countColumn) throw 'Your Inventory sheet does not have a "#" column.';
    const noteColumn = metadata.indexOf('Notes') + 1;
    if (!noteColumn && note) throw 'Your Inventory sheet does not have a "Notes" column.';

    if (exists) {
      const countRange = [row, countColumn];
      let value = Generic_.getValue(countRange, sheetObject);
      if (typeof value === 'string' && value) {
        value = parseInt(value.replace(/[^0-9]/g, '')) || 0;
      }
      if (ignoreHistoryCommands && trackHistoryMissing) {
        Generic_.setValue(countRange, formatCountFeetValue(value), sheetObject);
        if (note) Generic_.setValue([row, noteColumn], note, sheetObject);
        return output();
      }
      trackHistory([
        {
          sheet: sheetObject,
          range: countRange,
          value: feet ? `${value + feet}ft` : count,
          relative: !feet
        },
        ...(note ? [{
          sheet: sheetObject,
          range: [row, noteColumn],
          value: note
        }] : [])
      ]);
      return output();
    }

    const reformedTypeRange = _inventoryPrivate()
      .reformTypeRange(row, typeColumn, 0, typesCache);
    const includeNewType = type && !typesCache.includes(type);
    typesCache.splice(row, 0, includeNewType ? type : '');

    if (ignoreHistoryCommands) sheetObject.insertRowAfter(row);
    else {
      trackHistory({
        sheet: sheetObject,
        command: 'insert',
        type: 'row',
        options: { target: row }
      });
    }
    if (ignoreHistoryCommands && trackHistoryMissing) {
      Generic_.setValue([row + 1, nameColumn], itemName, sheetObject);
      Generic_.setValue([row + 1, countColumn], formatCountFeetValue(), sheetObject);
      if (note) Generic_.setValue([row + 1, noteColumn], note, sheetObject);
    } else {
      trackHistory([
        {
          sheet: sheetObject,
          range: [row + 1, nameColumn],
          value: itemName
        },
        {
          sheet: sheetObject,
          range: [row + 1, countColumn],
          value: feet ? `${feet}ft` : count
        },
        ...(note ? [{
          sheet: sheetObject,
          range: [row + 1, noteColumn],
          value: note
        }] : [])
      ]);
    }

    if (includeNewType) {
      if (ignoreHistoryCommands && trackHistoryMissing) {
        Generic_.setValue([row + 1, typeColumn], type, sheetObject);
      } else {
        trackHistory({
          sheet: sheetObject,
          range: [row + 1, typeColumn],
          value: type
        });
      }
      
      if (ignoreHistoryCommands) {
        sheetObject
          .getRange(row + 1, typeColumn)
          .setBackground(color)
          .setHorizontalAlignment('right');
        Generic_.addHorizontalBorder({ sheet: sheetObject, row: row + 1 });
        Generic_.addHorizontalBorder({ sheet: sheetObject, row: row + 2 });
        return output();
      }
      trackHistory([
        {
          sheet: sheetObject,
          command: 'set',
          type: 'background',
          options: { target: [row + 1, typeColumn], input: color }
        },
        {
          sheet: sheetObject,
          command: 'set',
          type: 'horizontalAlignment',
          options: { target: [row + 1, typeColumn], input: 'right' }
        },
        {
          sheet: sheetObject,
          command: 'set',
          type: 'rowBorder',
          options: { target: row + 1 }
        },
        {
          sheet: sheetObject,
          command: 'set',
          type: 'rowBorder',
          options: { target: row + 2 }
        }
      ]);
      return output();
    }

    if (ignoreHistoryCommands) {
      sheetObject
        .getRange(reformedTypeRange)
        .merge()
        .setHorizontalAlignment('center');
      Generic_.addHorizontalBorder({
        sheet: sheetObject,
        row: row + 1,
        type: SpreadsheetApp.BorderStyle.SOLID
      });
      Generic_.addHorizontalBorder({ sheet: sheetObject, row: row + 2 });
      return output();
    }
    trackHistory([
      {
        sheet: sheetObject,
        command: 'merge',
        type: 'range',
        options: { target: reformedTypeRange }
      },
      {
        sheet: sheetObject,
        command: 'set',
        type: 'horizontalAlignment',
        options: { target: reformedTypeRange, input: 'center' }
      },
      {
        sheet: sheetObject,
        command: 'set',
        type: 'rowBorder',
        options: {
          target: row + 1,
          input: SpreadsheetApp.BorderStyle.SOLID
        }
      },
      {
        sheet: sheetObject,
        command: 'set',
        type: 'rowBorder',
        options: { target: row + 2 }
      }
    ]);
    return output();
  },
  removeItem: ({
    itemName,
    count = 1,
    feet,
    addToOutput,
    deleteOnZero = true,
    apply = true,
    skipOutput = false,
    ignoreHistoryCommands = false,
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    const Generic_ = Generic(), History_ = History();
    const trackHistoryMissing = !trackHistory;
    const formatCountFeetValue = (value) => {
      if (feet === undefined) return (value || 0) - count;
      if (feet === '') return (value === undefined || value === '') ? '' : `${value}ft`;
      return `${(value || 0) - feet}ft`; 
    };
    const output = (message) => {
      if (!message) {
        message = `You have successfully removed from your Inventory: ${
          feet ? `${feet}ft of ` : ''
        }${itemName}${count > 1 ? ` (x${count})` : ''}.`;
        if (addToOutput) addToOutput(itemName, count, feet);
      }

      if (apply) {
        History().applyChanges(trackHistoryMissing ? changes : trackHistory([], changes));
      }
      if (!skipOutput) IO().notify({ message, mobile });
      return changes;
    };
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }

    const sheet = 'Inventory';
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject) throw 'There is no Inventory sheet.';

    const { row, name, exists } = Inventory().getInventoryRow({ itemName });
    itemName = name || itemName;
    const metadata = sheetObject.getDataRange().getValues()[0];
    const typeColumn = metadata.indexOf('Type') + 1;
    if (!typeColumn) throw 'Your Inventory sheet does not have a "Type" column.';
    const nameColumn = metadata.indexOf('Name') + 1;
    if (!nameColumn) throw 'Your Inventory sheet does not have a "Name" column.';
    const countColumn = metadata.indexOf('#') + 1;
    if (!countColumn) throw 'Your Inventory sheet does not have a "#" column.';

    if (!exists) {
      return output(`There is no item called ${itemName} in your Inventory.`);
    }

    const countRange = [row, countColumn];
    const value = Generic_.getValue(countRange, sheetObject);
    const feetValue = typeof value === 'string'
      ? parseInt(value.replace(/[^0-9]/g, ''))
      : undefined;
    if (!value || value === '0ft') {
      return output(`You have no more ${itemName} in your Inventory.`);
    }
    if ((feet && feet > feetValue) || count > value) {
      return output(`You don't have enough (${
        feet ? `${feet}ft` : `${count}`
      }) ${itemName} in your Inventory.`);
    }

    if (value > count || feetValue > feet || !deleteOnZero) {
      if (ignoreHistoryCommands && trackHistoryMissing) {
        Generic_.setValue(countRange, formatCountFeetValue(value), sheetObject);
        return output();
      }
      trackHistory({
        sheet: sheetObject,
        range: countRange,
        value: feet ? `${feetValue - feet}ft` : -count,
        relative: !feet
      });
      return output();
    }

    const typeCell = [row, typeColumn];
    const type = Generic_.getValue(typeCell, sheetObject);
    const reformedTypeRange = _inventoryPrivate().reformTypeRange(
      row,
      typeColumn,
      -1
    );
    const [fromRow, toRow] = reformedTypeRange
      .split(':')
      .map((cell) => parseInt(cell.replace(/[^0-9]/g, '')));
    if (ignoreHistoryCommands) {
      if (toRow - fromRow === 1) {
        sheetObject.getRange(reformedTypeRange).setHorizontalAlignment('right');
      }
      sheetObject.deleteRow(row);
      if (row === fromRow && row !== toRow) {
        Generic_.addHorizontalBorder({ sheet: sheetObject, row });
      }
    } else {
      trackHistory([
        ...(toRow - fromRow === 1 ? [{
          sheet: sheetObject,
          command: 'set',
          type: 'horizontalAlignment',
          options: { target: reformedTypeRange, input: 'right' }
        }] : []),
        {
          sheet: sheetObject,
          command: 'delete',
          type: 'row',
          options: { target: row }
        },
        ...(row === fromRow && row !== toRow ? [{
          sheet: sheetObject,
          command: 'set',
          type: 'rowBorder',
          options: { target: row }
        }] : []),
      ]);
    }

    if (row === fromRow && row !== toRow) {
      if (ignoreHistoryCommands) {
        Generic_.setValue(typeCell, type, sheetObject);
      } else {
        trackHistory({
          sheet: sheetObject,
          range: typeCell,
          value: type
        });
      }
    }
    return output();
  }
});

var Inventory = () => ({
  getItemType: ({ itemName, databaseID, itemsKey }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();

    if (!itemName) return;
    const sheet = SpreadsheetApp.openById(databaseID)?.getSheetByName?.(itemsKey);
    if (!sheet) return {};
    const grid = sheet.getRange('A:B').getValues();
    const types = [];
    let currentType, type, name;
    for (let i = 1; i < grid.length; i++) {
      if (grid[i][0]) {
        currentType = grid[i][0];
        types.push({ type: currentType, color: sheet.getRange(i + 1, 1, 1, 1).getBackground() });
      }
      if (grid[i][1].toLowerCase() === itemName.toLowerCase()) {
        type = currentType;
        name = grid[i][1];
      }
    };
    return { type, name, types };
  },
  getInventoryRow: ({ itemName, databaseID, itemsKey }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();

    if (!itemName) return;
    const {
      type = 'Miscellaneous',
      name,
      types
    } = Inventory().getItemType({ itemName, databaseID, itemsKey });
    const inventorySheet = SpreadsheetApp.getActive().getSheetByName('Inventory');
    if (!inventorySheet) return {};
    const grid = inventorySheet.getDataRange().getValues();
    const currentSheetTypes = [];
    for (let row = 1; row < grid.length - 1; row++) {
      if (grid[row][0]) {
        if (currentSheetTypes.length) currentSheetTypes.at(-1).row = row;
        currentSheetTypes.push({ type: grid[row][0], row: row + 1 });
      }
      if (grid[row][0] === type) {
        do {
          if (grid[row][1].toLowerCase() === itemName.toLowerCase()) {
            return {
              row: row + 1,
              name,
              exists: true,
              sheet: inventorySheet,
              grid
            };
          }
          row++;
        } while (!grid[row][0]);

        return {
          row,
          name,
          exists: false,
          sheet: inventorySheet,
          grid
        };
      }
    }

    let row, previousType = type;
    do {
      const index = types.findIndex(({ type: currentType }) => currentType === previousType);
      if (!index) row = 2;
      else {
        previousType = types[index - 1].type;
        row = currentSheetTypes.find(({ type: currentType }) => currentType === previousType)?.row;
      }
    } while (!row);

    return {
      row,
      name,
      exists: false,
      ...types.find(({ type: currentType }) => currentType === type),
      sheet: inventorySheet,
      grid
    };
  },
  getItemData: ({ itemName, attribute, databaseID, itemsKey }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();

    if (!itemName) return;
    const {
      row,
      exists,
      sheet,
      grid
    } = Inventory().getInventoryRow({ itemName, databaseID, itemsKey });
    if (!exists) return;
    const itemIndex = grid[0].indexOf(attribute);
    if (itemIndex === -1) return;
    return sheet.getRange(row, itemIndex + 1).getValue();
  },
  hasItemAttribute: ({ itemName, attribute, databaseID, itemsKey }) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();

    if (!itemName) return;
    const itemData = Inventory().getItemData({
      itemName,
      attribute: 'Metadata',
      databaseID,
      itemsKey
    });
    if (itemData === undefined) return false;
    return itemName !== '-' && itemData.includes(attribute);
  },
  getItemAttribute: ({ itemName, attribute, databaseID, itemsKey }) => {
    const Data_ = Data(), Inventory_ = Inventory();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!itemsKey) itemsKey = Data_.itemsKey();

    if (
      !itemName
        || itemName === '-'
        || !Inventory_.hasItemAttribute({ itemName, attribute, databaseID, itemsKey })
    ) return;
    const attributeMetadata = Inventory_.getItemData({
      itemName,
      attribute: 'Metadata',
      databaseID,
      itemsKey
    }).split(', ').find((data) => data.includes(attribute));
    if (!attributeMetadata.includes(':')) return true;
    return attributeMetadata.split(':')[1].trim();
  },
  findItemWithAttribute: ({ attribute, value }) => {
    if (!attribute) return;
    const inventorySheet = SpreadsheetApp.getActive().getSheetByName('Inventory');
    if (!inventorySheet) return;
    const grid = inventorySheet.getDataRange().getValues();
    const metadataIndex = grid[0].indexOf('Metadata');
    if (metadataIndex === -1) return;
    const itemIndex = grid.slice(1).map((row) => row[metadataIndex]).findIndex((metadata) => {
      if (!metadata.includes(attribute)) return;
      if (!value) return true;
      return metadata
        .split(', ')
        .find((subData) => subData.includes(attribute))
        .split(': ')[1] === value;
    }) + 1;
    if (!itemIndex) return;
    return { item: grid[itemIndex][1], row: itemIndex + 1 };
  },
  checkWeaponAttribute: ({ attribute, isOffHand = false }) => {
    const { value: itemName } = Generic().getNamedRange(isOffHand ? 'Off_hand' : 'Main_hand');
    return itemName !== '-' && !!Inventory().getItemAttribute({ itemName, attribute });
  },
  validateWeapon: ({ melee, ranged, type } = {}) => {
    if (!melee && !ranged) return {};
    const attribute = melee ? 'melee' : 'ranged';
    const isOffHand = type === 'Bonus Action';
    return {
      validation: Inventory().checkWeaponAttribute({ attribute, isOffHand }),
      outputMessage: `You need to equip a ${attribute} weapon in your ${
        isOffHand ? 'Off' : 'Main'
      }-hand first.`
    };
  },
  lootItem: (options) => _inventoryPrivate().lootItem(options),
  removeItem: (options) => _inventoryPrivate().removeItem(options),
  lootItems: ({
    items,
    apply = true,
    skipOutput = false,
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    const getItemOutput = (name, count, feet) => {
      return `${feet ? `${feet}ft of ` : ''}${
        name
      }${count > 1 ? ` (x${count})` : ''}`;
    };

    const Private = _inventoryPrivate();
    const typesCache = [];
    items.forEach(({ name, count, feet, note }) => {
      Private.lootItem({
        itemName: name,
        count,
        feet,
        note,
        typesCache,
        apply: false,
        skipOutput: true,
        ignoreHistoryCommands: true,
        mobile,
        trackHistory
      });
    });

    if (apply) {
      History().applyChanges(trackHistory ? trackHistory([], changes) : changes);
    }
    if (!skipOutput) {
      IO().notify({
        message: `You have successfully looted: ${
          items.map(({ name, count, feet }) => getItemOutput(name, count, feet)).join(', ')
        }.`,
        mobile
      });
    }
    return changes;
  },
  removeItems: ({
    items,
    apply = true,
    skipOutput = false,
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    let totalItemOutput = '';
    const addToOutput = (name, count, feet) => {
      const itemOutput = `${feet ? `${feet}ft of ` : ''}${
        name
      }${count > 1 ? ` (x${count})` : ''}`;
      totalItemOutput += `${totalItemOutput.length ? ', ' : ''}${itemOutput}`;
    };

    const Private = _inventoryPrivate();
    items.forEach(({ name, count, feet }) => {
      Private.removeItem({
        itemName: name,
        count,
        feet,
        addToOutput,
        deleteOnZero: false,
        apply: false,
        skipOutput: true,
        ignoreHistoryCommands: true,
        mobile,
        trackHistory
      });
    });

    if (apply) {
      History().applyChanges(trackHistory ? trackHistory([], changes) : changes);
    }
    if (!skipOutput) {
      IO().notify({
        message: totalItemOutput.length
          ? `You have successfully removed from your Inventory: ${totalItemOutput}.` 
          : 'You could not remove any of the given items from your Inventory.',
        mobile
      });
    }
    return changes;
  }
});
