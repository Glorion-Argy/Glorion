var Data = () => ({
  variable: (variableConfig = {}) => {
    const Generic_ = Generic();
    for (
      const { key, sheet, rowOffset = 0, columnOffset = 1 }
      of Array.isArray(variableConfig) ? variableConfig : [variableConfig]
    ) {
      if (!key || !sheet) continue;
      const sheetObject = Generic_.getSheet(sheet);
      if (!sheetObject) continue;
      const grid = sheetObject.getDataRange().getValues();
      for (let row = 0; row < grid.length; row++) {
        for (let column = 0; column < grid[row].length; column++) {
          if (grid[row][column] === key) return grid[row + rowOffset][column + columnOffset];
        }
      }
    }
  },
  databaseID: () => Data().variable([
    { key: 'Database_ID', sheet: 'Variables' },
    { key: 'ID', sheet: 'Character Creation' }
  ]),
  itemsKey: () => Data().variable([
    { key: 'Items_Key', sheet: 'Variables' },
    { key: 'Items key', sheet: 'Character Creation' }
  ]),
  characterSetup: (prioritizeVariables = true) => {
    const characterCreationConfig = { key: 'Character_Setup', sheet: 'Character Creation' };
    const variablesConfig = { key: 'Character_Setup', sheet: 'Variables' };
    return JSON.parse(
      Data().variable(
        prioritizeVariables
          ? [variablesConfig, characterCreationConfig]
          : [characterCreationConfig, variablesConfig]
      ) || '{}'
    );
  },
  choices: (prioritizeVariables = true) => {
    return Data().characterSetup(prioritizeVariables)?.abilities || [];
  },
  attributeValue: ({ attribute, cachedName, sheet = 'Character', prioritizeVariables = true }) => {
    const Generic_ = Generic();
    const { value: attributeValue } = Generic_.getNamedRange(attribute);
    if (attributeValue !== undefined) return attributeValue;
    const cachedAttribute = Data()
      .characterSetup(prioritizeVariables)
      ?.[cachedName || attribute];
    if (cachedAttribute !== undefined) return cachedAttribute;
    const sheetObject = Generic_.getSheet(sheet);
    if (!sheetObject) return;
    const grid = sheetObject.getDataRange().getValues();
    for (let row = 0; row < grid.length - 1; row += 2) {
      for (let column = 0; column < grid[row].length; column++) {
        if (grid[row][column] === attribute) return grid[row + 1][column];
      }
    }
  },
  selectedClass: () => Data().attributeValue({ attribute: 'Class', cachedName: 'selectedClass' }),
  race: () => Data().attributeValue({ attribute: 'Race', cachedName: 'race' }),
  background: () => Data().attributeValue({ attribute: 'Background', cachedName: 'background' }),
  level: () => Data().attributeValue({ attribute: 'Level', sheet: 'Attributes' }) || 1,
  path: () => Data().attributeValue({ attribute: 'Path' }),
  listOfItems: ({
    databaseID,
    sheet,
    column = 1,
    listColumn = 2,
    firstRowSize = 1,
    name
  }) => {
    if (!databaseID) databaseID = Data().databaseID();
    if (!databaseID || !sheet) return;
    const sheetObject = Generic().getSheet(sheet, databaseID);
    if (!sheetObject) return;
    const grid = sheetObject.getDataRange().getValues();
    if (!name) return grid.map((row) => row[column - 1]).slice(firstRowSize);
    try {
      return grid.find((row) => row[column - 1] === name)[listColumn - 1].split(', ');
    } catch(_) {
      return [];
    }
  },
  spellRequirements: ({ databaseID, sourceSheet, spellName, spellNameTag }) => {
    if (!databaseID) databaseID = Data().databaseID();
    const sheetObject = Generic().getSheet(sourceSheet, databaseID);
    if (!sheetObject) return;
    const grid = sheetObject.getDataRange().getValues();
    const firstRow = grid[0];
    const spellIndex = firstRow.indexOf(
      spellNameTag || (
        sourceSheet.at(-1) === 's'
          ? sourceSheet.slice(0, -1)
          : sourceSheet
        )
    );
    if (spellIndex === -1) return {};
    const spellRow = grid.find((row) => row[spellIndex] === spellName);
    if (!spellRow) return {};
    
    const classIndex = firstRow.indexOf('Class');
    const raceIndex = firstRow.indexOf('Race');
    const levelIndex = firstRow.indexOf('Level');
    const pathIndex = firstRow.indexOf('Path');
    const choiceIndex = firstRow.indexOf('Choice');
    return {
      ...(classIndex !== -1 && { 'class': spellRow[classIndex] }),
      ...(raceIndex !== -1 && { 'race': spellRow[raceIndex] }),
      ...(levelIndex !== -1 && { 'level': spellRow[levelIndex] }),
      ...(pathIndex !== -1 && { 'path': spellRow[pathIndex] }),
      ...(choiceIndex !== -1 && { 'choice': spellRow[choiceIndex] })
    };
  },
  deepObjectMerge: (objects, { depthLimit = 0, mergeArrays = false, uniqueMergedArrays = false } = {}) => {
    const mergeUpToDepthLimit = (target, source, currentDepth) => {
      for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];
        if (mergeArrays && Array.isArray(sourceValue) && Array.isArray(targetValue)) {
          const mergedArrays = [...targetValue, ...sourceValue];
          target[key] = uniqueMergedArrays ? [...new Set(mergedArrays)] : mergedArrays;
        } else if (typeof sourceValue !== 'object' || typeof targetValue !== 'object') {
          target[key] = sourceValue;
        } else if (currentDepth < depthLimit || !depthLimit) {
          target[key] = mergeUpToDepthLimit(targetValue, sourceValue, currentDepth + 1);
        }
      }
      return target;
    };

    let result = {};
    objects.forEach((object) => result = mergeUpToDepthLimit(result, object, 1));
    return result;
  }
});
