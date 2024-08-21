var Parse = () => ({
  getData: () => {
    const variableName = 'Cache';
    const namedRangeFound = SpreadsheetApp.getActiveSpreadsheet()
      .getNamedRanges()
      .find((namedRange) => namedRange.getName() === variableName);
    if (namedRangeFound) return JSON.parse(namedRangeFound.getRange().getValue());
    const variablesSheet = SpreadsheetApp.getActive().getSheetByName('Variables');
    if (variablesSheet) {
      return JSON.parse(
        variablesSheet.getDataRange().getValues()
          .find(([variable]) => variable === variableName)?.[1] || '{}'
      );
    }
  },
  getSheetData: (sheet = 'Actions') => Parse().getData()?.[sheet],
  getMobileCell: (type) => {
    const mobileData = Parse().getSheetData('Mobile');
    if (!mobileData) return;
    return Object.keys(mobileData).find((cell) => mobileData[cell] === type);
  },
  getCheckData: (type, isSavingThrow = false) => {
    const Generic_ = Generic();
    const checkData = Parse().getSheetData('Checks');
    if (!checkData) return;
    const { modifier, advantage } = (isSavingThrow
      ? checkData['Saving Throws'][type]
      : checkData[type]
    ) || {};
    if (modifier === undefined || advantage === undefined) return;
    return {
      modifier: parseInt(Generic_.getValue(modifier, 'Checks')),
      advantage: Convert().toAdvantageNumber(Generic_.getValue(advantage, 'Checks'))
    };
  },
  getCommandData: (name, sheet = 'Actions') => Parse().getSheetData(sheet)?.[name],
  getCommandAttributeCell: (name, attribute, sheet = 'Actions') => {
    return Parse().getCommandData(name, sheet)?.[attribute];
  },
  getCommandAttributeData: (name, attributeData, sheet = 'Actions') => {
    const commandData = Parse().getCommandData(name, sheet);
    if (!commandData) return;
    const attributes = typeof attributeData === 'string'
      ? [attributeData]
      : attributeData;
    return Object.fromEntries(Object.entries(commandData).filter(([key]) => {
      return attributes.includes(key);
    }));
  },
  getAttributeData: (attributeData) => {
    const attributeSheetData = Parse().getSheetData('Attributes');
    if (!attributeSheetData) return;
    const attributes = typeof attributeData === 'string'
      ? [attributeData]
      : attributeData;
    return Object.fromEntries(Object.entries(attributeSheetData).filter(([key]) => {
      return attributes.includes(key);
    }));
  },
  getValue: (sheet, name, attribute) => {
    const Parse_ = Parse();
    const range = ['Attributes', 'Character'].includes(sheet)
      ? Parse_.getCommandData(name, sheet)
      : Parse_.getCommandAttributeCell(name, attribute, sheet);
    if (!range) return;
    return Generic().getValue(range, sheet);
  },
  getValueData: (sheet, nameData, attributeData) => {
    const Generic_ = Generic(), Parse_ = Parse();
    const ranges = ['Attributes', 'Character'].includes(sheet)
      ? Parse_.getAttributeData(nameData)
      : Parse_.getCommandAttributeData(nameData, attributeData, sheet);
    return Object.fromEntries(
      Object.entries(ranges).map(([key, range]) => [key, Generic_.getValue(range, sheet)])
    );
  },
  getState: (sheet, name, attribute) => {
    const Parse_ = Parse();
    const range = ['Attributes', 'Character'].includes(sheet)
      ? Parse_.getCommandData(name, sheet)
      : Parse_.getCommandAttributeCell(name, attribute, sheet);
    if (!range) return {};
    return { sheet, range, value: Generic().getValue(range, sheet) };
  },
  getStateData: (sheet, nameData, attributeData) => {
    const Generic_ = Generic(), Parse_ = Parse();
    const stateData = {};
    const iterationList = ['Attributes', 'Character'].includes(sheet)
      ? typeof nameData === 'string' ? [nameData] : nameData
      : typeof attributeData === 'string' ? [attributeData] : attributeData;
    iterationList.forEach((item) => {
      const range = ['Attributes', 'Character'].includes(sheet)
        ? Parse_.getCommandData(item, sheet)
        : Parse_.getCommandAttributeCell(nameData, item, sheet);
      if (range !== undefined) {
        stateData[item] = { sheet, range, value: Generic_.getValue(range, sheet) };
      }
    });
    return stateData;
  },
  query: ({ sheet = 'Actions', select = [], where = {}, includeEmpty = false } = {}) => {
    const Generic_ = Generic();
    const checkForConditions = (spell, spellData, sheet) => {
      for (let [keyword, callback] of Object.entries(where)) {
        if (keyword === '$name') {
          if (!callback(spell)) return;
          continue;  
        }
        const keywordRange = spellData[keyword];
        if (!keywordRange) {
          if (includeEmpty) continue;
          return;
        }
        if (!callback(Generic_.getValue(keywordRange, sheet))) return;
      }
      return true;
    };

    const Parse_ = Parse();
    return (Array.isArray(sheet) ? sheet : [sheet]).reduce((total, sheet) => {
      const sheetData = Object.entries(Parse_.getSheetData(sheet)).reduce((total, [spell, spellData]) => {
        if (!checkForConditions(spell, spellData, sheet)) return total;
        return {
          ...total,
          [spell]: (Array.isArray(select) ? select : [select]).reduce((total, keyword) => {
            const keywordRange = spellData[keyword];
            return keywordRange
              ? { ...total, [keyword]: Generic_.getValue(keywordRange, sheet) }
              : total;
          }, { sheet })
        };
      }, {});
      return { ...total, ...sheetData };
    }, {});
  }
});
