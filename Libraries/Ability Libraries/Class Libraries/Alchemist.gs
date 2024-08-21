var Alchemist = () => ({
  // Commands
  getAllButtonConfigs: ({ configCallbacks = [], customConfig = {} }) => {
    const Generic_ = Generic();
    return [
      Buttons().getButtonConfig(),
      Automation().getButtonConfig(),
      ...configCallbacks.reduce((total, callback) => {
        const result = Generic_.unwrap(callback);
        if (!result) return total;
        if (!result.getButtonConfig) return [...total, result];
        return [...total, result.getButtonConfig()];
      }, []),
      Alchemist().getButtonConfig(),
      customConfig
    ];
  },
  useCommand: ({
    command,
    type,
    configCallbacks = [],
    customConfig = {},
    mobile = false
  }) => {
    if (!command) {
      throw 'You need a command name first, to use an ability.';
    }
    Helper().useCommand(
      command,
      type,
      Alchemist().getAllButtonConfigs({ configCallbacks, customConfig }),
      mobile
    );
  },
  // Static
  getHerbList: () => [
    'Bogtail',
    'Cinderthorn',
    'Dirtshroom',
    'Earthroot',
    'Seaweed',
    'Springkelp',
    'Starflower',
    'Wintersage',
    'Aetheriss'
  ],
  getHerbsLevelRequirement: () => 1,
  // Automation
  getCustomMobileConfig: () => ({
    listTitle: 'Herbs',
    options: ['Locate Herbs', 'Smoke'],
    afterList: 'Checks'
  }),
  getHerbsCachingConfig: (sheetName = 'Herbs') => {
    const Convert_ = Convert();
    const grid = Generic().getSheetValues(sheetName);
    if (!grid.length) throw 'Could not find the sheet [Herbs]';
    const smokeRow = grid.findIndex(([item]) => item === 'Smoke') + 2;
    const slotsColumn = grid[0].indexOf('Slots') + 1;
    if (!slotsColumn) throw 'Could not find the column [Slots] in your [Herbs] sheet';

    const createRange = (row, endRow) => {
      const range = `${sheetName}!${Convert_.toA1Notation(row, slotsColumn)}`;
      if (!endRow) return range;
      return `${range}:${Convert_.toA1Notation(endRow, slotsColumn)}`;
    };
    return [
      { name: 'Smoke_Range', range: createRange(smokeRow, smokeRow + 4) },
      { name: 'Smoke_CHA_Stacks', range: createRange(smokeRow) },
      { name: 'Smoke_INT_Stacks', range: createRange(smokeRow + 1) },
      { name: 'Smoke_AC_Stacks', range: createRange(smokeRow + 2) },
      { name: 'Smoke_Unarmed_Stacks', range: createRange(smokeRow + 3) },
      { name: 'Smoke_Proficiency_Stacks', range: createRange(smokeRow + 4) }
    ];
  },
  getCustomMenuConfig: () => {
    return {
      customSheetName: 'Herbs',
      inMenu: 'Action Sheets',
      afterItemIndex: 0,
      afterMobileIndex: 3
    };
  },
  getCustomSheetLevelConfig: () => ({ 'Herbs': Alchemist().getHerbsLevelRequirement() }),
  getSpellConfig: ({ level, path } = {}) => {
    const Data_ = Data();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    return {
      path: (value) => (getColumn) => {
        if (!value || (path && value.includes(path)) || value === 'Item') {
          return true;
        }
        return Generic().doesValueExist('Versatile Apothecary', 'Passives')
          && (getColumn('Level') <= (level || 0) + 1 - 4);
      }
    };
  },
  onActionsFormat: ({ sheet, grid, metadata = [], firstRowSize = 1 }) => {
    const unarmedStrikeRow = grid.slice(firstRowSize).findIndex(([ability]) => {
      return ability === 'Unarmed Strike';
    }) + 1;
    if (!unarmedStrikeRow) return true;
    const newRules = [
      metadata.indexOf('hit') + 1,
      metadata.indexOf('mainEffect') + 1
    ].reduce((total, column) => {
      const rule = SpreadsheetApp
        .newConditionalFormatRule()
        .whenFormulaSatisfied(
          '=AND(INDIRECT("Main_hand") = "-", ' +
            'INDIRECT("Smoke_Unarmed_Stacks"))'
        )
        .setFontColor('#3CBF3C')
        .setBold(true)
        .setRanges([sheet.getRange(unarmedStrikeRow + firstRowSize, column, 1, 1)])
        .build();
      return [...total, rule];
    }, []);
    sheet.setConditionalFormatRules([
      ...sheet.getConditionalFormatRules(),
      ...newRules
    ]);
    return true;
  },
  onLevelUp: ({ nextLevel, path, attributesIncreased = {}, trackHistory }) => {
    const Generic_ = Generic();
    const sheetUpdateData = {};
    if (!(nextLevel % 3)) sheetUpdateData['Herbs'] = [];
    else {
      const constitution = attributesIncreased['Constitution'];
      if (constitution && (
        constitution.value > 1
          || Generic_.getNamedRange('CON').value % 2
      )) sheetUpdateData['Herbs'] = [];
    }

    if (path !== 'Pilgrim' || ![3, 13].includes(nextLevel)) return sheetUpdateData;
    const Parse_ = Parse();
    trackHistory({ ...Generic_.getNamedRange('CON'), value: 2, relative: true });
    if (nextLevel === 13) {
      trackHistory([
        { ...Parse_.getState('Checks', 'Nature', 'proficiency'), value: 'Expert' },
        { ...Parse_.getState('Checks', 'Persuasion', 'proficiency'), value: 'Expert' }
      ]);
    }
    return { 'Herbs': [] };
  },
  updateHerbsSheet: ({
    databaseID = Data().databaseID(),
    sheetName = 'Herbs',
    mobile = false
  } = {}) => {
    const Generic_ = Generic();
    const getExistingHerbData = () => {
      const sheet = Generic_.getSheet(sheetName);
      if (!sheet || Generic_.getSheet('Character Creation')) return {};

      const grid = sheet.getDataRange().getValues();
      const firstRow = grid[0];
      const firstColumn = grid.map(([firstItem]) => firstItem);
      const slotsColumn = firstRow.indexOf('Slots') + 1;
      const reagentsColumn = firstRow.indexOf('Reagents') + 1;
      const grinderRow = firstColumn.indexOf('Grinder') + 1;
      const smokeRow = firstColumn.indexOf('Smoke') + 1;

      const groundHerbs = [];
      for (let row = grinderRow; row < smokeRow; row++) {
        const firstGroundHerb = Generic_.getValue([row, slotsColumn], sheet);
        if (firstGroundHerb && firstGroundHerb !== '-') {
          groundHerbs.push(firstGroundHerb);
        }
        const secondGroundHerb = Generic_.getValue([row, reagentsColumn], sheet);
        if (secondGroundHerb && secondGroundHerb !== '-') {
          groundHerbs.push(secondGroundHerb);
        }
      }
      const smokedHerbs = [];
      for (let row = smokeRow + 1; row < smokeRow + 6; row++) {
        smokedHerbs.push(Generic_.getValue([row, slotsColumn], sheet));
      }
      return { groundHerbs, smokedHerbs };
    };

    const Automation_ = Automation(), Alchemist_ = Alchemist();
    const { groundHerbs = [], smokedHerbs = [] } = getExistingHerbData();
    const sheet = Automation_.generateAbilitiesSheet({
      databaseID,
      sheetName,
      nextToSheet: 'Checks, Attributes, Mobile',
      backgroundColor: '#E5ECE3',
      firstRowColor: '#CCffE7',
      lastColumnWidth: 825,
      skipCaching: true,
      mobile
    });
    const grid = sheet.getDataRange().getValues();
    const firstRow = grid[0];
    const firstColumn = grid.map(([firstItem]) => firstItem);
    const slotsIndex = firstRow.indexOf('Slots');
    const reagentsIndex = firstRow.indexOf('Reagents');
    const descriptionIndex = firstRow.indexOf('Description');
    const grinderIndex = firstColumn.indexOf('Grinder');
    const smokeIndex = firstColumn.indexOf('Smoke');
    const herbList = Alchemist_.getHerbList();

    const IO_ = IO();
    IO_.notify({ message: `Formatting ${sheetName} sheet again...`, mobile });
    sheet.getRange(
      smokeIndex + 1,
      slotsIndex + 1,
      1,
      descriptionIndex - slotsIndex
    ).clearContent();
    sheet.getRange(
      smokeIndex + 1,
      slotsIndex + 1,
      1,
      descriptionIndex - slotsIndex + 1
    ).merge();
    sheet.getRange(smokeIndex + 1, 1, 6, 1).merge();
    sheet.getRange(smokeIndex + 1, 2, 6, 1).merge();

    for (row = smokeIndex + 2; row < smokeIndex + 7; row++) {
      const value = smokedHerbs?.[row - smokeIndex - 2] || 0;
      sheet
        .getRange(row, slotsIndex + 1, 1, reagentsIndex - slotsIndex)
        .clearContent()
        .merge()
        .setFontWeight('bold')
        .setValue(value);
      Generic_.createDropdown({
        cell: [row, slotsIndex + 1],
        options: [0, 1, 2, 3, 4, 5],
        sheet
      });
    }
    sheet.setRowHeights(smokeIndex + 2, 5, 28);
    Generic_.addHorizontalBorder({
      sheet,
      row: grinderIndex + 1,
      lastColumn: descriptionIndex + 1
    });
    Drive().createButton({
      databaseID,
      sheet,
      cell: [smokeIndex + 3, 2],
      imageTag: 'Use',
      script: 'UseSmoke',
      scale: 0.7,
      yOffset: 25,
      columnWidth: 50
    });

    const grinderSlots = !Generic_.doesValueExist('Neverending Alchemy', 'Passives')
      ? 3 +
        Math.max((Generic_.getNamedRange('CON_Modifier').value || 0), 0) +
        Math.floor((Generic_.getNamedRange('Level').value || 1) / 3)
      : 20;
    const grinderRows = Math.ceil(grinderSlots / 2);
    sheet.insertRowsAfter(grinderIndex + 1, grinderRows - 1);
    sheet.getRange(grinderIndex + 1, 1, grinderRows, 2).merge();
    sheet.getRange(grinderIndex + 1, descriptionIndex + 1, grinderRows, 1).merge();
    for (row = grinderIndex + 1; row <= grinderIndex + grinderRows; row++) {
      const value = groundHerbs.length
        ? groundHerbs.shift()
        : '-';
      sheet
        .getRange(row, slotsIndex + 1, 1, reagentsIndex - slotsIndex)
        .clearContent()
        .merge()
        .setFontWeight('bold')
        .setValue(value);
      Generic_.createDropdown({
        cell: [row, slotsIndex + 1],
        options: ['-', ...herbList],
        sheet
      });
      const grinderItem = sheet
        .getRange(row, reagentsIndex + 1, 1, descriptionIndex - reagentsIndex)
        .clearContent()
        .merge();
      if (row === grinderIndex + grinderRows && grinderSlots % 2) {
        grinderItem.setBackground('#666666');
      } else {
        grinderItem
          .setFontWeight('bold')
          .setValue(groundHerbs.length ? groundHerbs.shift() : '-');
        Generic_.createDropdown({
          cell: [row, reagentsIndex + 1],
          options: ['-', ...herbList],
          sheet
        });
      }
    }
    sheet.setRowHeights(grinderIndex + 1, grinderRows, 28);
    const smokeRow = smokeIndex + grinderRows;
    Generic_.addHorizontalBorder({
      sheet,
      row: smokeRow,
      lastColumn: descriptionIndex + 1
    });
    const rule = SpreadsheetApp
      .newConditionalFormatRule()
      .whenFormulaSatisfied(`=SUM(C${smokeRow + 1}:C${smokeRow + 5}) > 5`)
      .setBackground('#EA9999')
      .setBold(true)
      .setRanges([sheet.getRange(smokeIndex + grinderRows, slotsIndex + 1, 1, 1)])
      .build();
    sheet.setConditionalFormatRules([...sheet.getConditionalFormatRules(), rule]);

    Alchemist_.getHerbsCachingConfig().forEach(({ name, range }) => {
      Generic_.createOrUpdateNamedRange(name, range);
    });
    Alchemist_.cacheHerbData({ sheetName, saveToMemory: true, mobile });
    Generic_.refreshSheet('Variables');
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    IO_.notify({ message: `Successfully updated ${sheetName} sheet.`, mobile });
  },
  // Caching
  cacheHerbData: ({
    sheetName = 'Herbs',
    saveToMemory = false,
    mobile = false
  } = {}) => {
    const herbData = {};
    const sheet = Generic().getSheet(sheetName);
    if (!sheet) return herbData;

    const saveInfo = (structure, row, column, key) => {
      const cell = Convert().toA1Notation(row + 1, column + 1);
      if (Array.isArray(structure)) structure.push(cell);
      else structure[key] = cell;
    };
    const saveGrinderData = (index) => {
      const grinderData = [];
      for (let row = 0; !row || grid[row + index][0] === ''; row++) {
        for (let column = 0; column < grid[row + index].length; column++) {
          const metadataValue = metadata[column];
          if (
            !metadataValue
              || ['ability', 'description'].includes(metadataValue)
              || grid[row + index][column] === ''
          ) continue;
          saveInfo(grinderData, row + index, column);
        }
      }
      herbData['Grinder'] = grinderData;
    };
    const saveSmokeData = (index) => {
      const smokeConfig = ['CHA', 'INT', 'AC', 'Damage', 'Proficiency'];
      const smokeData = {};
      for (let row = 1; row < smokeConfig.length + 1; row++) {
        const spellData = {};
        for (let column = 0; column < grid[row + index].length; column++) {
          const metadataValue = metadata[column];
          if (
            !metadataValue
              || !['currentSlots', 'reagents'].includes(metadataValue)
          ) continue;
          saveInfo(
            spellData,
            row + index,
            column,
            metadataValue === 'reagents'
              ? 'reagents'
              : 'smokeValue'
          );
        }
        smokeData[smokeConfig[row - 1]] = spellData;
      }
      herbData['Smoke'] = smokeData;
    };
    const saveSpellData = (row, name) => {
      const spellData = {};
      for (let column = 0; column < grid[row].length; column++) {
        const currentValue = grid[row][column];
        if (currentValue === '-') continue;
        const metadataValue = metadata[column];
        if (
          !metadataValue
            || ['ability', 'range', 'description'].includes(metadataValue)
        ) continue;
        saveInfo(spellData, row, column, metadataValue);
      }
      herbData[name] = spellData;
    };

    const Cache_ = Cache();
    IO().notify({ message: 'Caching Herb data...', mobile });
    const { grid, metadata } = Cache_.generateMetadata({ sheet });
    for (let row = 1; row < grid.length; row++) {
      const abilityName = grid[row][0];
      if (abilityName === '') continue;
      if (abilityName === 'Grinder') saveGrinderData(row);
      else if (abilityName === 'Smoke') saveSmokeData(row);
      else saveSpellData(row, abilityName);
    }
    
    if (saveToMemory) Cache_.saveCache(herbData, { sheetName });
    return herbData;
  },
  // Utilities
  getGrinderData: () => {
    const Generic_ = Generic();
    return Parse().getCommandData('Grinder', 'Herbs')
      ?.map((range) => {
        return { range, value: Generic_.getValue(range, 'Herbs') };
      });
  },
  getHerbsInInventory: () => {
    const herbList = Alchemist().getHerbList();
    return Generic().getSheetValues('Inventory').reduce((items, [_, item, count]) => {
      if (herbList.includes(item) && count && count !== '0') {
        return [...items, { item, count }];
      }
      return items;
    }, []);
  },
  getStonedMeterLevel: () => {
    const Generic_ = Generic();
    const { sheet, range } = Generic_.getNamedRange('Smoke_Range');
    if (!sheet) return;
    return Generic_.getSheet(sheet)
      .getRange(range)
      .getValues()
      .reduce((total, [value]) => total + value, 0);
  },
  calculateLexicon: (input) => {
    const herbList = Alchemist().getHerbList();
    if (input === 'Each') {
      return {
        lexicon: herbList.map((herb) => ({ count: 1, herbs: [herb] })),
        isAndLogic: true,
        herbInputs: herbList
      };
    }

    const lexicon = [];
    const herbInputs = [];
    for (let herbInput of input.split(/ or | and /)) {
      let count = 1;
      let herbs = [];
      const originalHerbInput = herbInput;
      const countMatch = herbInput.match(/^\d+(?= x)/);
      if (countMatch) {
        count = parseInt(countMatch[0]);
        herbInput = herbInput.replace(/^\d+ x /, '');
      }

      if (herbInput.toLowerCase() === 'any') herbs = herbList;
      else {
        herbs = herbInput.split(' or ');
        if (herbs.length === 1) {
          herbs = herbInput.split(' and ');
          if (herbs.length > 1) {
            herbs = herbs.map((herb) => ({ count: 1, herbs: [herb] }));
          }
        }
      }

      let insertIndex = lexicon.findIndex(({ herbs: h }) => h.length > herbs.length);
      if (insertIndex === -1) insertIndex = lexicon.length;
      lexicon.splice(insertIndex, 0, { count, herbs });
      herbInputs.splice(insertIndex, 0, originalHerbInput);
    }
    return {
      lexicon,
      isAndLogic: !input.toLowerCase().includes(' or '),
      herbInputs
    };
  },
  getEnvironmentData: (databaseID = Data().databaseID(), sheet = 'Environment') => {
    const Generic_ = Generic();
    const sheetObject = Generic_.getSheet(sheet, databaseID);
    if (!sheetObject) return {};

    const metadataConfig = {
      'Flora Herb': ['herbs'],
      'Flora Weight': ['weights'],
      'Thresholds No Herb': ['noHerb'],
      'Thresholds One Herb': ['', 'oneHerb'],
      'Thresholds Two Herbs': ['', 'twoHerbs'],
      'Thresholds Rare': ['rare']
    };
    const { grid, metadata } = Cache().generateMetadata({
      sheet: sheetObject,
      rowLength: 2,
      metadataConfig
    });
    const environmentIndex = metadata.indexOf('environment');
    const askIndex = metadata.indexOf('ask');
    const herbsIndex = metadata.indexOf('herbs');
    const weightsIndex = metadata.indexOf('weights');
    const noHerbIndex = metadata.indexOf('noHerb');
    const oneHerbIndex = metadata.indexOf('oneHerb');
    const twoHerbsIndex = metadata.indexOf('twoHerbs');
    const rareIndex = metadata.indexOf('rare');

    const environmentData = {};
    for (let row = 2; row < grid.length; row++) {
      const environment = grid[row][environmentIndex];
      const data = {
        ask: grid[row][askIndex],
        noHerbThreshold: grid[row][noHerbIndex],
        oneHerbThreshold: grid[row][oneHerbIndex],
        twoHerbsThreshold: grid[row][twoHerbsIndex],
        rareDifficulty: grid[row][rareIndex]
      };

      const mergedRange = Generic_.getMergedCells([row + 1, 1], sheetObject);
      const flora = [];
      if (mergedRange) {
        const nextRow = mergedRange.split(':')[1].replace(/[^0-9]/g, '');
        for (let innerRow = row; innerRow < nextRow; innerRow++) {
          flora.push({
            herb: grid[innerRow][herbsIndex],
            weight: grid[innerRow][weightsIndex]
          });
        }
        row = nextRow - 1;
      }
      environmentData[environment] = { ...data, flora};
    }
    return environmentData;
  },
  generateHerbLoot: (diceRolls, overgrowthTracker, mobile = false) => {
    const Alchemist_ = Alchemist();
    const environmentData = Alchemist_.getEnvironmentData();
    if (!environmentData) return;
    const hiddenOptions = [];
    const options = Object.entries(environmentData).reduce((total, [environment, { ask }]) => {
      if (ask) return [...total, environment];
      hiddenOptions.push(environment);
      return total;
    }, []);

    const answer = IO().askForAnswerFromList({
      title: 'Casting Locate Herbs',
      message: 'Select an environment',
      options,
      hiddenOptions,
      mobile
    });
    if (!answer) return;

    const {
      flora,
      rareDifficulty,
      noHerbThreshold,
      oneHerbThreshold,
      twoHerbsThreshold
    } = environmentData[answer];
    const lootTable = flora.map(({ herb, weight }) => ({ herb, totalWeight: weight }));
    for (let i = 1; i < lootTable.length; i++) {
      lootTable[i].totalWeight += lootTable[i - 1].totalWeight;
    }
    const { totalWeight } = lootTable.at(-1);

    const herbList = Alchemist_.getHerbList();
    const results = (Array.isArray(diceRolls) ? diceRolls : [diceRolls])
      .map(({ mainResult, secondaryResult }) => {
        if (overgrowthTracker) mainResult = Number.MAX_SAFE_INTEGER;
        if (mainResult < 1 || secondaryResult < 1 || rareDifficulty < 1) return null;
        if (mainResult <= noHerbThreshold) return [];

        const rareHerbs = secondaryResult >= rareDifficulty
          ? 1
          : 0;
        const commonHerbs = mainResult <= oneHerbThreshold
          ? 1
          : (mainResult <= twoHerbsThreshold ? 2 : 3) - rareHerbs;
        const herbs = herbList.map((herb) => ({ name: herb, count: 0 }));
        const addHerb = (key) => herbs[herbs.findIndex(({ name }) => name === key)].count++;

        for (let counter = 0; counter < commonHerbs; counter++) {
          const lootRoll = Math.floor(Math.random() * totalWeight);
          addHerb(lootTable.find(({ totalWeight }) => lootRoll < totalWeight).herb);
        }
        if (rareHerbs) addHerb('Aetheriss');

        return herbs.filter(({ count }) => count);
      }).flat();

    const map = new Map(results.map(({ name }) => [name, { name, count: 0 }]));
    for (let { name, count } of results) {
      map.get(name).count += count;
    }
    return [...map.values()].sort(({ count: c1 }, { count: c2 }) => c2 - c1);
  },
  getLearnableSpells: ({
    databaseID,
    selectedClass = 'Alchemist',
    level,
    path
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Generic_ = Generic(), Automation_ = Automation(), Alchemist_ = Alchemist();
    const learnableSpells = [];
    ['Actions', 'Bonus Actions', 'Reactions', 'Interactions', 'Movement'].forEach((sheet) => {
      const sheetObject = Generic_.getSheet(sheet, databaseID);
      if (!sheetObject) return;
      const abilityColumn = sheetObject
        .getDataRange()
        .getValues()[0]
        .indexOf(Convert().toSingular(sheet)) + 1;
      Automation_.query({
        sourceID: databaseID,
        source: sheet,
        conditions: {
          'Class': (value) => value === selectedClass,
          'Choice': (value) => value === true,
          'Path': Alchemist_.getSpellConfig({ level: level - 1, path }).path,
          'Tags': (value) => value,
          'Level': (value, row) => (getColumn) => {
            if ((value || 0) <= level) {
              const path = getColumn('Path');
              learnableSpells.push({
                ability: getColumn(abilityColumn),
                sheet,
                ...(path !== 'Basic' && { path }),
                tag: getColumn('Tags'),
                row
              });
            }
          }
        }
      });
    });
    return learnableSpells;
  },
  learnSpell: ({
    databaseID = Data().databaseID(),
    updateCallback,
    apply,
    mobile,
    trackHistory
  }) => {
    const Generic_ = Generic(), IO_ = IO();
    const learnableSpells = Alchemist().getLearnableSpells({ databaseID });
    const options = learnableSpells.map(({ ability }) => ability);
    const descriptions = Generic_.getSheet('Descriptions', databaseID)
      .getDataRange()
      .getValues()
      .map(([name, description]) => ({ name, description })).slice(1);
    const characterSetupData = Generic_.getNamedRange('Character_Setup');
    const characterSetup = JSON.parse(characterSetupData.value || '{}');
    const { abilities = [] } = characterSetup;
    const newLine = IO_.getNewLineChar(mobile);

    const spellToLearn = IO_.askForAnswerFromList({
      title: 'Sudden Clarity',
      message: 'Select an ability to learn',
      options,
      excludeOptions: abilities,
      optionModifier: (option) => {
        const { sheet, path, tag } = learnableSpells.find(({ ability }) => option === ability);
        const { description = '' } = descriptions.find(({ name }) => name === option) || {};
        return `${option} (${path ? `${path} ` : ''}${tag} - ${
          Convert().toSingular(sheet)
        }): ${description ? `${description} ` : ''}${newLine}`;
      },
      mobile
    });
    if (!spellToLearn) return;

    const { sheet } = learnableSpells.find(({ ability }) => spellToLearn === ability);
    Automation().modifyUpdatesLeft({ updates: sheet, remove: false });
    const changes = trackHistory({
      ...characterSetupData,
      value: JSON.stringify({
        ...characterSetup,
        abilities: [...abilities, spellToLearn]
      })
    });
    if (apply) History().applyChanges(changes);
    if (!updateCallback) return true;

    const applyUpdates = IO_.askForYesOrNo({
      title: 'Are you sure you want to proceed?',
      message: 'The following sheets will be updated ' +
        `and you won't be able to use Undo: [${sheet}]`,
      mobile
    });
    if (applyUpdates === undefined) return;
    if (applyUpdates) updateCallback(`Update ${sheet} Sheet`, mobile);
    return true;
  },
  // Callbacks
  resetLocateHerbsSlots: ({ trackHistory }) => {
    const Parse_ = Parse();
    return trackHistory({
      ...Parse_.getState('Herbs', 'Locate Herbs', 'currentSlots'),
      value: Parse_.getValue('Herbs', 'Locate Herbs', 'maxSlots')
    });
  },
  checkForReagents: ({ spellName, sheet, memory, mobile, trackHistory }) => {
    if (memory.lastDropCopy) return true;
    let reagents = Parse().getValue(sheet, spellName, 'reagents');
    if (!reagents || reagents === '-') return true;
    const Alchemist_ = Alchemist();
    const grinderData = Alchemist_.getGrinderData()?.filter(({ value }) => value && value !== '-');
    if (!grinderData) return;

    const Generic_ = Generic(), IO_ = IO();
    if (spellName === 'Energy Salve' && Generic_.doesValueExist('Potent Salve', 'Passives')) {
      const extraSpending = IO_.askForYesOrNo({
        title: 'Potent Energy Salve',
        message: 'Do you want to spend an extra herb ' +
          'to grant an extra Action, instead of a Bonus one?',
        mobile
      });
      if (extraSpending === undefined) return;
      if (extraSpending) reagents = '2 x Any';
    } else if (spellName === 'Draught of Sustenance') {
      const reducedCost = IO_.askForYesOrNo({
        title: spellName,
        message: `Do you want cut the reagent cost in half by casting ${
          spellName
        } over a minute?`,
        mobile
      });
      if (reducedCost === undefined) return;
      if (reducedCost) reagents = 'Earthroot and Seaweed';
    }

    let discountedFromPassive = false;
    if (Alchemist_.getStonedMeterLevel() > 1) {
      const spellTypes = [
        {
          passive: 'Preventive Mixology',
          spells: [
            'Extract',
            'Infusion',
            'Ampoule',
            'Ointment',
            'Potion',
            'Remedy',
            'Elixir',
            'Draught'
          ]
        },
        {
          passive: 'Disruptive Mixology',
          spells: [
            'Extract',
            'Infusion',
            'Ampoule',
            'Mixture',
            'Solution',
            'Bottle',
            'Serum'
          ]
        }
      ];
      ({ passive: discountedFromPassive } = spellTypes.find(({ passive, spells }) => {
        return Generic_.doesValueExist(passive, 'Passives')
          && spells.some((spell) => spellName.includes(spell));
      }) || {});
    } 

    const lexiconData = Alchemist_.calculateLexicon(reagents);
    const { lexicon, isAndLogic } = lexiconData;
    let { herbInputs } = lexiconData;
    let minHerbsRequired = isAndLogic
      ? lexicon.reduce((total, { count }) => total + count, 0)
      : Math.min(...lexicon.map(({ count }) => count));
    if (discountedFromPassive && minHerbsRequired > 1) {
      minHerbsRequired--;
    }
    const grinder = grinderData.map(({ value }) => value);
    if (grinder.length < minHerbsRequired) {
      return IO_.notify({
        message: `You have ${
          grinder.length ? `only ${grinder.length}` : 'no'
        } herbs in your Grinder, while ${spellName} requires ${
          isAndLogic ? '' : 'at least '
        }${minHerbsRequired}.`,
        mobile
      });
    }

    const herbsSpent = [];
    const getGrinderList = (grinderData = grinder) => {
      return Object.entries(
        grinderData.reduce((counts, herb) => {
          counts[herb] = (counts[herb] || 0) + 1;
          return counts;
        }, {})
      ).map(([herb, count]) => {
        return count > 1
          ? `${count}x ${herb}`
          : herb;
      }).join(', ');
    };
    const calculateDiscount = () => {
      if (!discountedFromPassive) return true;
      if (!isAndLogic) {
        lexicon.forEach(({ count }, index) => {
          const reducedCount = Math.max(count - 1, 1);
          lexicon[index].count = reducedCount;
          const currentHerbInput = herbInputs[index];
          if (
            !currentHerbInput.includes(' x ')
              || currentHerbInput.includes('1 x ')
          ) return;
          herbInputs[index] = `${reducedCount >= 2 ? `${reducedCount} x ` : ''}${
            currentHerbInput.split(' x ')[1]
          }`;
        });
        return true;
      }
      if (lexicon.length === 1) {
        lexicon[0].count = Math.max(lexicon[0].count - 1, 1);
        return true;
      }

      const requirements = [];
      for (let { count, herbs } of lexicon) {
        if (herbs.length > 1) continue;
        const [herb] = herbs;
        const countDifference = count - grinder.filter((grinderHerb) => {
          return herb === grinderHerb;
        }).length;
        if (countDifference > 1 || (countDifference === 1 && requirements.length)) {
          return IO_.notify({
            message: `A single herb discount is not enough to cast ${spellName}.`,
            mobile
          });
        }
        if (countDifference === 1) requirements.push(herb);
      }

      const grinderList = getGrinderList();
      const options = lexicon.reduce((total, { herbs: herbs }) => {
        if (herbs.length > 1) return total;
        return [...total, herbs[0]];
      }, []);
      let discount;
      if (requirements.length) discount = requirements[0];
      else if (options.length < 2) discount = options[0];
      else {
        discount = IO_.askForAnswerFromList({
          title: `Pick a herb discount for ${discountedFromPassive}`,
          message: `Herbs left in grinder: ${grinderList ? `[${grinderList}]` : '-'}`,
          options,
          optionModifier: (option) => {
            const { count } = lexicon.find(({ herbs: [herb] }) => option === herb);
            return `${option}: (x${
              grinder.filter((herb) => option === herb).length
            }) - Requires ${count}`;
          },
          mobile
        });
      }
      if (!discount) return;

      const lexiconIndex = lexicon.findIndex(({ herbs: [herb] }) => discount === herb);
      if (lexicon[lexiconIndex].count < 2) {
        lexicon.splice(lexiconIndex, 1);
      } else lexicon[lexiconIndex].count--;
      return true;
    };
    const askForHerbs = ({ herbs, lexicon, count, iteration }) => {
      const doEnoughHerbsExist = (option, index) => {
        if (option.replace(/^\d+ x /, '') === 'Any') {
          return grinder.length >= (lexicon ? lexicon[index].count : 1);
        }
        if (!lexicon) return grinder.includes(option);
        return grinder
          .filter((herb) => herb === option.replace(/^\d+ x /, ''))
          .length >= lexicon[index].count;
      };

      const excludeOptions = herbs.reduce((total, option, index) => {
        return doEnoughHerbsExist(option, index)
          ? total
          : [...total, option];
      }, []);
      const availableOptions = herbs.filter((option) => !excludeOptions.includes(option));
      if (!availableOptions.length) {
        return IO_.notify({
          message: 'You have no valid herbs in your Grinder.',
          mobile
        });
      }
      if (availableOptions.length === 1 || grinder.length === count - iteration) {
        return availableOptions[0];
      }
      
      const grinderList = getGrinderList(grinder);
      return IO_.askForAnswerFromList({
        title: `To cast ${spellName}, pick one of:`,
        message: `${count > 1 ? `(${iteration + 1} / ${count}) ` : ''}${
          discountedFromPassive ? `Discounted from ${discountedFromPassive} - ` : ''
        }Herbs left in grinder: ${grinderList ? `[${grinderList}]` : '-'}`,
        options: herbs,
        optionModifier: (option) => {
          const herb = option.split(' ').at(-1);
          const herbsInGrinderCount = grinder.filter((grinderHerb) => {
            return herb === grinderHerb;
          }).length;
          if (!herbsInGrinderCount) return option;
          return `${option}: (x${herbsInGrinderCount})`;
        },
        excludeOptions,
        mobile
      });
    };
    const checkForGrinderHerbs = (herbs, count) => {
      if (herbs.length > 1) {
        for (let iteration = 0; iteration < count; iteration++) {
          const selectedHerb = askForHerbs({ herbs, count, iteration });
          if (!selectedHerb) return;
          const herb = herbs.includes(selectedHerb)
            ? selectedHerb
            : herbs[selectedHerb - 1];
          if (!grinder.includes(herb)) {
            return IO_.notify({
              message: `You do not have enough ${herb} in your Grinder.`,
              mobile
            });
          }
          herbsSpent.push(herb);
          grinder.splice(grinder.indexOf(herb), 1);
        }
      } else {
        const herb = herbs[0];
        if (count > grinder.filter((grinderHerb) => grinderHerb === herb).length) {
          return IO_.notify({
            message: `You do not have enough ${herb} in your Grinder.`,
            mobile
          });
        }
        for (let iteration = 0; iteration < count; iteration++) {
          herbsSpent.push(herb);
          grinder.splice(grinder.indexOf(herb), 1);
        }
      }
      return true;
    };

    if (!calculateDiscount()) return;
    if (isAndLogic) {
      for (let { count, herbs } of lexicon) {
        if (!checkForGrinderHerbs(herbs, count)) return;
      }
    } else {
      const selectedHerb = askForHerbs({ herbs: herbInputs, lexicon });
      if (!selectedHerb) return;

      const optionIndex = herbInputs.findIndex((herbInput) => herbInput === selectedHerb);
      const { count, herbs } = lexicon[optionIndex < 0 ? selectedHerb - 1 : optionIndex];
      if (!checkForGrinderHerbs(herbs, count)) return;
    }

    const trackHistoryData = [];
    herbsSpent.forEach((herb) => {
      const grinderIndex = grinderData.findIndex(({ value }) => herb === value);
      const { range } = grinderData[grinderIndex];
      grinderData.splice(grinderIndex, 1);
      trackHistoryData.push({ sheet: 'Herbs', range, value: '-' });
    });
    trackHistory(trackHistoryData);
    if (spellName === 'Warding Ointment') {
      const resistances = {
        'Dirtshroom': 'Acid',
        'Seaweed': 'Lightning',
        'Cinderthorn': 'Fire',
        'Earthroot': 'Poison',
        'Wintersage': 'Cold'
      };
      return { memory: { resistance: resistances[herbsSpent[0]] } };
    }
    return true;
  },
  lastDrop: ({ spellName, sheet, memory, mobile, trackHistory }) => {
    if (!Generic().doesValueExist('Last Drop', 'Passives')) return true;
    if (
      ['Cask', 'Energy Salve', 'Revivification Salve', 'Resurgence', 'Overgrowth', 'Tick', 'Trigger']
        .some((ability) => spellName.includes(ability))
    ) return true;
    if (memory.lastDropCopy) return true;

    const reagents = Parse().getValue(sheet, spellName, 'reagents');
    if (!reagents || reagents === '-') return true;
    const copySpell = IO().askForYesOrNo({
      title: 'Last Drop',
      message: `Do you want to copy your ${spellName} at half the throughput?`,
      mobile
    });
    if (copySpell === undefined) return;
    if (!copySpell) return true;

    const type = Convert().toCamelCase(sheet);
    const customConfig = {
      [type]: () => ({
        [spellName]: () => ({
          skipActionCost: true,
          apply: false,
          multiplier: 0.5,
          hookMemory: { ...memory, lastDropCopy: true },
          trackHistory
        })
      })
    };
    Alchemist().useCommand({ command: spellName, type, customConfig, mobile });
    return true;
  },
  reduceOvergrowthRecharge: ({ trackHistory }, amount = 1) => trackHistory({
    ...Generic().getNamedRange('Overgrowth_Recharge'),
    value: -amount,
    relative: true,
    min: 0
  }),
  // Abstract methods
  abstractLocateHerbs: (options = {}) => {
    const Parse_ = Parse();
    return Helper().abstractUseAbility({
      skipActionCost: true,
      checkTypeMain: 'Nature',
      secondaryEffectAdvantage: Parse_.getState('Actions', 'Fertility Brew', 'tracker').value,
      secondaryEffectOutput: 'Quality WIS result',
      onOutput: ({ mainResult, secondaryResult, mobile, trackHistory }) => {
        const {
          value: overgrowthTracker
        } = Parse_.getState('Actions', 'Overgrowth', 'tracker');
        const loot = Alchemist().generateHerbLoot(
          { mainResult, secondaryResult },
          overgrowthTracker,
          mobile
        );
        if (!loot) return '';

        const IO_ = IO();
        let herbMessage = loot.map(({ name, count }) => `${count} ${name}`).join(', ');
        const newLine = IO_.getNewLineChar(mobile);
        const lastIndex = herbMessage.lastIndexOf(',');
        if (lastIndex !== -1) {
          herbMessage = herbMessage.substring(0, lastIndex) + ' and' +
            herbMessage.substring(lastIndex + 1);
        }
        if (!loot.length) {
          return `${newLine}${newLine}You could not find any herbs nearby.`;
        }

        const message = `You have located ${herbMessage}${
          overgrowthTracker ? ', your max yield due to Overgrowth' : ''
        }.`;
        const herbCount = loot.reduce((total, { count }) => total + count, 0);
        const autoLoot = IO_.askForYesOrNo({
          title: 'Locate Herbs',
          message: message + ` Do you want to loot them directly (it costs ${
            herbCount
          } Actions to do so)?`,
          mobile
        });
        if (!autoLoot) {
          return `${newLine}${newLine}${message} ` +
            'Please note all herbs found to loot them at a later point.';
        }

        Inventory().lootItems({
          items: loot,
          apply: false,
          skipOutput: true,
          trackHistory
        });
        return `${newLine}${newLine}${message}`;
      },
      options
    });
  },
  abstractSmoke: (options = {}) => Helper().abstractUseAbility({
    onUse: ({ mobile, trackHistory }) => {
      const IO_ = IO(), Alchemist_ = Alchemist();
      const smokeDataValues = Object.values(Parse().getCommandData('Smoke', 'Herbs') || {});
      const grinderData = Alchemist_.getGrinderData()?.filter(({ value }) => value && value !== '-');
      const grinder = [...new Set(grinderData.map(({ value }) => value))];
      if (!grinder.length) {
        return IO_.notify({
          message: 'You have no herbs in your grinder.',
          mobile
        });
      }

      const Generic_ = Generic();
      if (
        smokeDataValues.reduce((total, { smokeValue }) => {
          return total + Generic_.getValue(smokeValue, 'Herbs');
        }, 0) >= 5
      ) {
        return IO_.notify({
          message: 'You have reached the maximum stacks in the Stoned Meter.',
          mobile
        });
      }

      const smokeBonus = Generic_.doesValueExist('Herbal Sobriety', 'Passives') ? 2 : 1;
      const { value: strength = 0 } = Generic_.getNamedRange('STR_Modifier');
      const smokeDescriptions = {
        'Bogtail': `+${smokeBonus} CHA`,
        'Cinderthorn': `+${Math.max(strength, 1) * smokeBonus} Unarmed and Improvised weapon attacks`,
        'Dirtshroom': `+${smokeBonus} INT`,
        'Earthroot': `+${smokeBonus} AC`,
        'Seaweed': `+${smokeBonus} AC`,
        'Springkelp': `+${smokeBonus} INT`,
        'Starflower': `+${smokeBonus} CHA`,
        'Wintersage': `+${Math.max(strength, 1) * smokeBonus} Unarmed and Improvised weapon attacks`,
        'Aetheriss': `+Proficiency / Expertise on ${smokeBonus === 1 ? 'a skill' : 'two skills'}`
      };

      const options = Alchemist_.getHerbList();
      const herbSelected = IO_.askForAnswerFromList({
        title: 'Smoke',
        message: 'Select a herb to smoke',
        options,
        optionModifier: (option) => `${option}: ${smokeDescriptions[option]}`,
        excludeOptions: options.filter((herb) => !grinder.includes(herb)),
        mobile
      });
      if (!herbSelected) return;

      const { smokeValue } = smokeDataValues.find(({ reagents }) => {
        return Generic_.getValue(reagents, 'Herbs').includes(herbSelected);
      });
      return trackHistory([
        {
          sheet: 'Herbs',
          range: grinderData.find(({ value }) => value === herbSelected).range,
          value: '-'
        },
        {
          sheet: 'Herbs',
          range: smokeValue,
          value: Math.min(Generic_.getValue(smokeValue, 'Herbs') + 1, 5)
        }
      ]);
    },
    options
  }),
  abstractGrind: (options = {}) => {
    const { repeat = 0 } = options;
    return Helper().abstractUseAbility({
      onUse: ({ spellName, mobile, trackHistory }) => {
        const IO_ = IO(), Alchemist_ = Alchemist();
        const emptyGrinderData = Alchemist_.getGrinderData()?.filter(({ value }) => {
          return !value || value === '-';
        });
        if (emptyGrinderData.length < repeat + 1) {
          return IO_.notify({
            message: "There isn't enough space left in your grinder.",
            mobile
          });
        }

        let herbsSelected = [];
        const inventory = Alchemist_.getHerbsInInventory();
        const options = Alchemist_.getHerbList();
        const availableHerbCount = inventory.reduce((total, { count }) => {
          return total += parseInt(count);
        }, 0);
        if (availableHerbCount <= repeat + 1) {
          herbsSelected = inventory.reduce((total, { item, count }) => {
            return [...total, ...Array.from({ length: count }, () => item)];
          }, []);
        } else {
          for (let iteration = 0; iteration <= repeat; iteration++) {
            const herbSelected = IO_.askForAnswerFromList({
              title: spellName,
              message: `${repeat ? `(${iteration + 1} / ${repeat + 1})` : ''}` +
                ' Select a herb to grind',
              options,
              optionModifier: (option) => {
                const { count = 0 } = inventory.find(({ item }) => item === option) || {};
                return `${option}: (x${count})`;
              },
              excludeOptions: options.filter((herb) => {
                return !inventory.map(({ item }) => item).includes(herb);
              }),
              mobile
            });
            if (!herbSelected) return;
            herbsSelected.push(herbSelected);
            const itemIndex = inventory.findIndex(({ item }) => item === herbSelected);
            const itemFound = inventory[itemIndex];
            if (itemFound.count > 1) itemFound.count--;
            else inventory.splice(itemIndex, 1);
          }
        }

        const Inventory_ = Inventory();
        return trackHistory(herbsSelected.map((herb, index) => {
          Inventory_.removeItem({
            itemName: herb,
            deleteOnZero: false,
            apply: false,
            skipOutput: true,
            trackHistory
          });
          return {
            sheet: 'Herbs',
            range: emptyGrinderData[index].range,
            value: herb
          };
        }));
      },
      options
    });
  },
  abstractPotionOfRecuperation: (options = {}) => Helper().abstractUseAbility({
    healing: true,
    beforeHitCalculation: ({ mainEffect, mobile }) => {
      const targetCasks = IO().notify({
        type: 'inputBox',
        title: 'Potion of Recuperation Casks',
        message: 'How many active Casks does your target have?',
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(targetCasks)) return;
      const [rolls, dice] = mainEffect.split('d');
      return { mainEffect: `${Math.max(targetCasks, 1) * rolls}d${dice}` };
    },
    options
  }),
  abstractDragonstoneBrew: (options = {}) => Helper().abstractUseAbility({
    onUse: ({ mobile, trackHistory }) => {
      const IO_ = IO();
      const itemName = 'Dragonstone';
      const inventorySheet = Generic().getSheet('Inventory');
      if (!inventorySheet) {
        return IO_.notify({
          message: 'Could not find your Inventory sheet.',
          mobile
        });
      }
      const itemRow = inventorySheet
        .getDataRange()
        .getValues()
        .find(([_, item]) => item === itemName);
      if (!itemRow) {
        return IO_.notify({
          message: `You have no ${itemName}s in your Inventory.`,
          mobile
        });
      }
      if (!parseInt(itemRow[2] || 0)) {
        return IO_.notify({
          message: `You need to consume a ${itemName} for Dragonstone Brew.`,
          mobile
        });
      }
      return Inventory().removeItem({
        itemName,
        deleteOnZero: false,
        apply: false,
        skipOutput: true,
        trackHistory
      });
    },
    options
  }),
  abstractBouncingPotion: (options = {}) => {
    const level = Data().level();
    return Helper().abstractUseAbility({
      aoe: true,
      targetsHit: 3 + [8, 12, 16, 19].filter((threshold) => level >= threshold).length,
      healing: true,
      options
    });
  },
  abstractSoberUp: (options = {}) => {
    const Generic_ = Generic(), IO_ = IO();
    const { updateCallback } = options;
    const herbalSobriety = Generic_.doesValueExist('Herbal Sobriety', 'Passives');
    const suddenClarity = Generic_.doesValueExist('Sudden Clarity', 'Passives');
    if (!herbalSobriety && !suddenClarity) {
      return IO_.notify({
        message: 'You need either Herbal Sobriety or Sudden Clarity to use Sober Up',
        mobile
      });
    }

    const Alchemist_ = Alchemist();
    const fromHerbalSobriety = !suddenClarity || Generic_.getNamedRange('HP').value !== 0;
    const canLearnAbility = !fromHerbalSobriety && Alchemist_.getStonedMeterLevel() >= 5;
    return Helper().abstractUseAbility({
      skipActionCost: !fromHerbalSobriety,
      apply: !canLearnAbility,
      onUse: ({ mobile, trackHistory }) => {
        const isValid = IO_.askForYesOrNo({
          title: `${fromHerbalSobriety ? 'Herbal Sobriety' : 'Sudden Clarity'} sobering up`,
          message: `${fromHerbalSobriety
            ? 'Has at least half of the duration of your Smoke effect elapsed'
            : 'Did you just receive fatal damage from an enemy source'
          }?`,
          mobile
        });
        if (isValid === undefined) return;
        if (isValid === false) {
          return IO_.notify({
            message: `You can only Sober Up after ${fromHerbalSobriety
              ? 'half of the duration of your Smoke effect has passed'
              : 'receiving fatal damage from an enemy source'
            }.`,
            mobile
          });
        }
        const sheet = 'Herbs';
        trackHistory(
          Object.values(Parse().getCommandData('Smoke', sheet)).map(({ smokeValue }) => {
            return { sheet, range: smokeValue, value: 0 };
          })
        );
        if (
          canLearnAbility
            && !Alchemist_.learnSpell({ updateCallback, apply: true, mobile, trackHistory })
        ) return;
        return true;
      },
      options
    });
  },
  abstractOvergrowth: (options = {}) => {
    const Helper_ = Helper();
    return Helper_.abstractUseAbility({
      onUse: ({ spellName, sheet, mobile, trackHistory }) => {
        const Generic_ = Generic(), IO_ = IO();
        const rechargeData = Generic_.getNamedRange('Overgrowth_Recharge');
        const { value: recharge } = rechargeData;
        if (recharge) {
          return IO_.notify({
            message: `${spellName} has not fully recharged yet, it requires ${
              Math.ceil(recharge / 2)
            }x Long Rests or ${recharge}x Short Rests`,
            mobile
          });
        }
        trackHistory({ ...rechargeData, value: 6 });

        Helper_.setTracker({ spellName, sheet, trackHistory });
        const targetsResurrected = IO_.notify({
          type: 'inputBox',
          title: 'Overgrowth resurrections',
          message: 'How many creatures did you resurrect?',
          mobile,
          isMobileAnswerInputType: true
        });
        if (isNaN(targetsResurrected)) return;
        if (targetsResurrected === '0') return true;

        const maxHealthCost = 25 * targetsResurrected;
        const { value: maxHealth = 1 } = Generic_.getNamedRange('Max_HP');
        if (maxHealth <= maxHealthCost) return IO_.notify({
          message: `You do not have enough Maximum Health to resurrect ${
            targetsResurrected
          } targets (Requirement: ${maxHealthCost})`,
          mobile
        });
        return trackHistory([
          {
            ...Generic_.getNamedRange('Overgrowth_Resurrections'),
            value: parseInt(targetsResurrected),
            relative: true
          },
          {
            ...Generic_.getNamedRange('HP'),
            max: () => Generic_.getNamedRange('Max_HP').value
          }
        ]);
      },
      options
    });
  },
  // Config
  getButtonConfig: () => {
    const Alchemist_ = Alchemist();
    return {
      attributes: () => ({
        'Short Rest': () => ({ onUse: Alchemist_.reduceOvergrowthRecharge }),
        'Long Rest': () => ({
          onUse: [
            Alchemist_.resetLocateHerbsSlots,
            ({ trackHistory }) => Alchemist_.reduceOvergrowthRecharge({ trackHistory }, 2)
          ]
        })
      }),
      herbs: () => ({
        'Locate Herbs': () => ({ callback: Alchemist_.abstractLocateHerbs }),
        'Smoke': () => ({ callback: Alchemist_.abstractSmoke, skipActionCost: true })
      }),
      actions: () => ({
        defaultArguments: { onCheck: Alchemist_.checkForReagents, onUse: Alchemist_.lastDrop },
        'Careful Grind': () => ({
          callback: Alchemist_.abstractGrind,
          repeat: 1,
          skipActionCost: Generic().doesValueExist('Neverending Alchemy', 'Passives')
        }),
        'Energy Salve': () => ({ healing: true }),
        'Cask of Clearcasting': () => ({}),
        'Everbreathing Cask': () => ({}),
        'Emberpuff Cask': () => ({}),
        'Cask of Farstriding': () => ({}),
        'Cask of Sharpness': () => ({}),
        'Arrowreach Cask': () => ({}),
        'Giantplume Cask': () => ({}),
        'Glyphed Cask of Farseeing': () => ({}),
        'Earthen Mixture': () => ({}),
        'Flowery Mixture': () => ({}),
        'Burning Mixture': () => ({}),
        'Rejuvenating Potion': () => ({ healing: true, aoeSecondary: Data().level() >= 12 }),
        'Potion of Recuperation': () => ({ callback: Alchemist_.abstractPotionOfRecuperation }),
        'Gleaming Catalyst': () => ({}),
        'Umbral Cask': () => ({}),
        'Firestep Cask': () => ({}),
        'Toughhide Cask': () => ({ healing: true, mainEffectOutput: 'Temporary HP given' }),
        'Thornwood Cask': () => ({}),
        'Thornwood Cask Tick': () => ({ skipActionCost: true }),
        'Ripplewalk Cask': () => ({}),
        'Soarstone Glyphed Cask': () => ({}),
        'Cask of Leathality': () => ({}),
        'Blazing Mixture': () => ({}),
        'Mixture of Veiled Eyesight': () => ({}),
        'Bottled Cry': () => ({ aoe: true }),
        'Bottled Storm': () => ({}),
        'Identification Serum': () => ({}),
        'Fortifying Ointment': () => ({}),
        'Remedy of Endurance': () => ({
          healing: true,
          mainEffectOutput: 'Max HP increased'
        }),
        'Dragonstone Brew': () => ({ callback: Alchemist_.abstractDragonstoneBrew }),
        'Twilight Catalyst': () => ({ aoe: true }),
        'Bouncing Potion': () => ({ callback: Alchemist_.abstractBouncingPotion }),
        'Frostbite Extract': () => ({}),
        'Frostbite Extract Tick': () => ({ skipActionCost: true, healing: true }),
        'Infernal Mixture': () => ({ skipSecondaryEffect: true }),
        'Infernal Mixture Tick': () => ({ skipActionCost: true, skipMainEffect: true }),
        'Mindwarp Mixture': () => ({}),
        'Cask of Arcane Reach': () => ({}),
        'Cask of Nourishment': () => ({
          healing: true,
          mainEffectOutput: 'Increased healing taken'
        }),
        'Ironclad Cask': () => ({}),
        'Trueshot Cask': () => ({}),
        'Purespring Glyphed Cask': () => ({ delayedEffect: true }),
        'Fateforge Cask': () => ({}),
        'Prickly Vines Mixture': () => ({}),
        'Virulent Blend Mixture': () => ({}),
        'Pyroclasmic Mixture': () => ({}),
        'Debilitating Solution': () => ({ aoe: true }),
        'Bottled Thunder': () => ({ aoe: true }),
        'Spellbane Serum': () => ({}),
        'Soulbound Remedy': () => ({ healing: true }),
        'Soulbound Remedy Trigger': () => ({ skipActionCost: true, healing: true }),
        'Remedy of Recovery': () => ({
          healing: true,
          aoe: true,
          mainEffectOutput: 'Healing done per Cask'
        }),
        'Splash of Remedy': () => ({ healing: true, aoe: true }),
        'Ether Veil Draught': () => ({}),
        'Brew of Transmogrification': () => ({ checkType: 'Arcana' }),
        'Shadowfall Catalyst': () => ({}),
        "David's Infusion": () => ({ skipMainEffect: true }),
        'Hushdrop Ampoule': () => ({}),
        'Subjugating Solution': () => ({}),
        'Bottled Verdancy': () => ({ mainEffectOutput: 'Attack roll penalty' }),
        'Draught of Sustenance': () => ({
          healing: true,
          mainEffectOutput: 'Healing done and Max HP increased'
        }),
        'Brew of Lethargy': () => ({}),
        'Brew of Lethargy Antidote': () => ({}),
        'Manaflow Cask': () => ({}),
        "Artisan's Cask": () => ({}),
        'Everguard Cask': () => ({}),
        'Glyphed Cask of Protection': () => ({ delayedEffect: true }),
        'Pureflux Cask': () => ({}),
        'Fireflash Mixture': () => ({}),
        'Toxinshock Mixture': () => ({}),
        'Dreadpulse Solution': () => ({}),
        'Bottled Agony': () => ({ aoe: true, onFailMultiplier: 1 }),
        'Bottled Thornscape': () => ({}),
        'Bottled Thornscape Tick': () => ({ skipActionCost: true }),
        'Acid Immunity Ointment': () => ({}),
        'Lightning Immunity Ointment': () => ({}),
        'Fire Immunity Ointment': () => ({}),
        'Poison Immunity Ointment': () => ({}),
        'Cold Immunity Ointment': () => ({}),
        'Phial of Cryptic Echoes': () => ({}),
        'Emberleak Extract': () => ({ healingMain: true, aoeSecondary: true }),
        "Goliath's Infusion": () => ({ skipMainEffect: true }),
        'Potion of Lingering Vitality': () => ({
          healing: true,
          mainEffectOutput: 'Healing done next turn'
        }),
        'Remedy of Absorption': () => ({}),
        'Enthrallment Solution': () => ({}),
        'Elixir of Augmentation': () => ({}),
        "Jester's Solution": () => ({}),
        'Cask of Healing Overflow': () => ({ delayedEffect: true }),
        'Spellward Cask': () => ({}),
        'Lifelink Glyphed Cask': () => ({}),
        'Cask of the Arcanist': () => ({}),
        'Ardorflame Mixture': () => ({}),
        'Dreamweave Solution': () => ({ aoe: true }),
        'Commanding Solution': () => ({ aoe: true }),
        'Warding Ointment': () => ({
          onOutput: ({ memory }) => {
            return `You gave your target ${memory.resistance} resistance.`;
          }
        }),
        'Soulshape Ointment': () => ({
          healing: true,
          aoe: true,
          targetsHit: 2,
          mainEffectOutput: 'Damage reduction'
        }),
        'Steelskin Ointment': () => ({}),
        'Spellbreaking Ointment': () => ({}),
        'Dreadbane Remedy': () => ({
          healing: true,
          aoe: true,
          mainEffectOutput: 'Temporary HP given'
        }),
        'Elemental Extract': () => ({ healingMain: true, aoeSecondary: true }),
        'Unending Walz Solution': () => ({}),
        'Solution of Languor': () => ({}),
        'Solution of Havoc': () => ({}),
        'Fertility Brew': () => ({ onUse: Helper().setTracker }),
        'Rebirth Salve': () => ({}),
        'Resurgence': () => ({}),
        'Cask of Vampirism': () => ({ delayedEffect: true }),
        'Sunburst Glyphed Cask': () => ({ delayedEffect: true }),
        'Primeskill Cask': () => ({}),
        'Pyrotoxin Mixture': () => ({}),
        'Enslaving Solution': () => ({ aoe: true }),
        'Mindguard Potion': () => ({ healing: true }), 
        'Ampoule of Abolition': () => ({ checkType: 'Arcana' }),
        'Lifeblood Potion': () => ({ healing: true, aoe: true, targetsHit: 2 }),
        'Potion of Renewal': () => ({ healing: true }),
        'Potion of Renewal Tick': () => ({ skipActionCost: true, healing: true }),
        'Gloomspike Mixture': () => ({}),
        'Cask of the Deadeye': () => ({}),
        'Cask of Veneration': () => ({}),
        'Stygian Mixture': () => ({}),
        'Burning Zeal Elixir': () => ({ healing: true }),
        'Potion of Full Restoration': () => ({}),
        'Bottled Miasma': () => ({}),
        'Bottled Miasma Tick': () => ({ skipActionCost: true, aoe: true }),
        'Mixture of Cognitive Annihilation': () => ({ onFailMultiplier: 1 }),
        'Overgrowth': () => ({ callback: Alchemist_.abstractOvergrowth })
      }),
      bonusActions: () => ({
        defaultArguments: { onCheck: Alchemist_.checkForReagents, onUse: Alchemist_.lastDrop },
        'Quick Grind': () => ({ callback: Alchemist_.abstractGrind }),
        'Wormtongue Solution': () => ({}),
        'Solution of Amnesia': () => ({}),
        'Elixir of Aptitude': () => ({}),
        'Phialed Messenger': () => ({}),
        'Mesmerizing Solution': () => ({}),
        'Potion of Mending': () => ({ healing: true, aoe: true, targetsHit: 2 }),
        'Liquid Remedy': () => ({}),
        'Liquid Remedy Drink': () => ({
          skipActionCost: true,
          healing: true,
          mainEffectOutput: 'Percentage healing done'
        }),
        'Phial of Omnilingualism': () => ({}),
        'Naturetongue Phial': () => ({}),
        'Catalyst of True Sight': () => ({}),
        'Elixir of Nimbleness': () => ({}),
        'Truth Serum': () => ({}),
        'Mountainspring Draught': () => ({}),
        'Runebound Brew': () => ({ checkType: 'Arcana' }),
        'Flamestride Elixir': () => ({}),
        'Illusory Appraisal Brew': () => ({}),
        'Sober Up': () => ({ callback: Alchemist_.abstractSoberUp }),
        'Hexbreaking Draught': () => ({}),
        'Mental Respite Remedy': () => ({ aoe: true }),
        'Daydream Draught': () => ({}),
        'Alluring Elixir': () => ({}),
        'Enslaving Solution Direction': () => ({})
      }),
      reactions: () => ({
        'Cask of Farseeing Trigger': () => ({}),
        'Soarstone Cask Trigger': () => ({}),
        'Reactive Grind': () => ({ callback: Alchemist_.abstractGrind }),
        'Purespring Cask Trigger': () => ({ healing: true }),
        'Lifelink Cask Trigger': () => ({}),
        'Sunburst Cask Trigger': () => ({ aoe: true })
      }),
      passives: () => ({
        'Vial Mastery': () => ({ aoe: true, healing: true })
      }),
      automation: () => ({
        'Learn Ability': () => ({ spellConfig: Alchemist_.getSpellConfig() }),
        'Update Mobile Sheet': () => ({
          customMobileConfig: Alchemist_.getCustomMobileConfig(),
          customMenuConfig: Alchemist_.getCustomMenuConfig(),
          spellConfig: Alchemist_.getSpellConfig()
        }),
        'Update Herbs Sheet': () => ({ callback: Alchemist_.updateHerbsSheet }),
        'Update Actions Sheet': () => ({
          onFormat: Alchemist_.onActionsFormat,
          spellConfig: Alchemist_.getSpellConfig()
        }),
        'Update Bonus Actions Sheet': () => ({ spellConfig: Alchemist_.getSpellConfig() }),
        'Generate Variables': () => ({ additionalVariables: Alchemist_.getHerbsCachingConfig() }),
        'Generate Cache': () => ({
          customSheetCaching: [{ name: 'Herbs', callback: Alchemist_.cacheHerbData }]
        }),
        'Level Up': () => ({ 
          customSheetLevelConfig: Alchemist_.getCustomSheetLevelConfig(),
          customMenuConfig: Alchemist_.getCustomMenuConfig(),
          spellConfigCallback: Alchemist_.getSpellConfig,
          onLevelUp: Alchemist_.onLevelUp
        })
      })
    };
  },
  getCacheConfig: (configCallbacks = []) => {
    const onlyMainEffectSpell = ({ version = 'Tick', includeHit = false } = {}) => [
      { deletions: [...(includeHit ? ['hit'] : []), 'mainEffect'] },
      { version, deletions: ['reagents'] }
    ];
    const bothEffectsSpell = ({ version = 'Tick', includeHit = false } = {}) => [
      { deletions: ['secondaryEffect'] },
      {
        version,
        deletions: ['reagents', ...(includeHit ? ['hit'] : []), 'mainEffect']
      }
    ];
    const classConfig = {
      actions: {
        'Thornwood Cask': onlyMainEffectSpell(),
        'Mixture of Involuntary Assistance': bothEffectsSpell({ includeHit: true }),
        'Mixture of Amplification': bothEffectsSpell({ includeHit: true }),
        'Potion of Soul Incense': bothEffectsSpell({ version: 'Trigger' }),
        'Serum of Lethargy': [{}, { version: 'Antidote' }],
        'Barbed Thorns': onlyMainEffectSpell(),
        'Potion of Regeneration': bothEffectsSpell(),
        'Putrid Cloud': onlyMainEffectSpell({ includeHit: true })
      },
      bonusActions: {
        'Create Draught': onlyMainEffectSpell({ version: 'Drink' })
      }
    };
    return Automation().getCacheConfig({ configCallbacks, classConfig });
  }
});
