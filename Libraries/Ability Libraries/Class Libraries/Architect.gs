var Architect = () => ({
  // Static
  getWeapons: () => ['Glaive Saber', 'Phase Blade', 'Scepter'],
  getSummonsWithActionablePassives: () => [
    'Moss Golem',
    'Lava Golem',
    'Flame Revenant'
  ],
  getMultipleRowSummonSpellConfig: () => [{
    summon: 'Flame Revenant',
    multipleRowSpell: 'Infernal Beacons',
    version: 'Trigger',
    distanceFromBottom: 2,
    bonusAction: 2
  }],
  getSummonsLevelRequirement: () => 2,
  // Automation
  getCustomMobileConfig: ({
    databaseID,
    sheetName = 'Summons',
    summons
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!databaseID) return;
    const summonsSheet = Generic().getSheet(sheetName, databaseID);
    if (!summonsSheet) return;

    const Architect_ = Architect();
    const level = Data_.level();
    if (!level || level < Architect_.getSummonsLevelRequirement()) return;
    const grid = summonsSheet.getDataRange().getValues();
    const metadata = grid[0];
    const nameIndex = metadata.indexOf('Name');
    if (nameIndex === -1) return;
    const abilitiesIndex = metadata.indexOf('Abilities');
    if (abilitiesIndex === -1) return;
    const typeIndex = metadata.indexOf('Type');
    if (typeIndex === -1) return;

    if (!summons) summons = Data_.choices().map((summon) => summon.replace('Summon ', ''));
    let lastSummon, lastType;
    const options = [];
    const summonsWithActionablePassives = Architect_.getSummonsWithActionablePassives();
    const multipleRowSummonSpellConfig = Architect_.getMultipleRowSummonSpellConfig();
    for (let row = 1; row < grid.length; row++) {
      const summonName = grid[row][nameIndex];
      if (summonName) lastSummon = summonName;
      if (!summons.includes(lastSummon)) continue;
      const type = grid[row][typeIndex];
      if (type) lastType = type;
      if ((lastType === 'Bonus Action' && level < 5)) continue;
      if (
        lastType === 'Passive'
          && (level < 7 || !summonsWithActionablePassives.includes(lastSummon))
      ) continue;
      const {
        version,
        multipleRowSpell
      } = multipleRowSummonSpellConfig.find(({ summon }) => lastSummon === summon) || {};
      options.push(
        type
          ? grid[row][abilitiesIndex]
          : `${multipleRowSpell} ${version}`
      );
    }
    return { listTitle: sheetName, options, afterList: 'Bonus Actions' };
  },
  getCustomMenuConfig: (levelingUp = false) => {
    const level = Data().level() + (levelingUp ? 1 : 0);
    if (!level || level < Architect().getSummonsLevelRequirement()) return;
    return {
      customSheetName: 'Summons',
      inMenu: 'Action Sheets',
      afterItemIndex: 2,
      afterMobileIndex: 5
    };
  },
  getCustomSheetLevelConfig: () => ({ 'Summons': Architect().getSummonsLevelRequirement() }),
  getAttributeMetadataConfig: () => ({
    '(1) Slots': ['(1) Max Slots'],
    '(2) Slots': ['(2) Max Slots'],
    '(3) Slots': ['(3) Max Slots'],
    '(4) Slots': ['(4) Max Slots'],
    'Points': ['Max Points']
  }),
  updateSummonsSheet: ({
    databaseID,
    sheetName = 'Summons',
    level,
    path,
    summons,
    mobile = false
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();
    if (!summons) summons = Data_.choices().reduce((total, choice) => {
      if (!choice.includes('Summon ')) return total;
      return [...total, choice.replace('Summon ', '')];
    }, []);

    const Architect_ = Architect();
    if (
      !summons
        || !summons.length
        || !level
        || level < Architect_.getSummonsLevelRequirement()
    ) return;

    const Generic_ = Generic(), Automation_ = Automation();
    const sheet = Automation_.copySheet({
      sourceID: databaseID,
      sheetName,
      nextToSheet: 'Bonus Actions, Actions, Checks, Attributes, Mobile'
    });
    let grid = sheet.getDataRange().getValues();
    let metadata = grid[0];
    let healthColumn = metadata.indexOf('HP') + 1;
    let maxHealthColumn = metadata.indexOf('HP') + 3;
    let abilitiesColumn = metadata.indexOf('Abilities') + 1;
    let buttonColumn = abilitiesColumn + 3;
    const durationColumn = metadata.indexOf('Duration') + 1;
    if (level < 18 || path !== 'Summoner') {
      if (!abilitiesColumn || !durationColumn || !healthColumn) return;
      Generic_.deleteColumns(
        [durationColumn + 1, healthColumn + 1, abilitiesColumn + 2],
        sheet
      );
      sheet
        .setColumnWidth(durationColumn, 70)
        .getRange(1, durationColumn)
        .setFontSize(11);
      grid = grid.map((row) => row.filter((_, index) => {
        return ![durationColumn, healthColumn, abilitiesColumn + 1].includes(index);
      }));
      metadata = grid[0];
      healthColumn--;
      maxHealthColumn -= 2;
      abilitiesColumn -= 2;
      buttonColumn -= 3;
    }

    const typeColumn = metadata.indexOf('Type') + 1;
    const descriptionColumn = metadata.indexOf('Description') + 1;
    const summonsWithActionablePassives = Architect_.getSummonsWithActionablePassives();
    const multipleRowSummonSpellConfig = Architect_.getMultipleRowSummonSpellConfig();

    const Convert_ = Convert(), Drive_ = Drive();
    const createButtons = ({
      summonRow,
      summonName,
      level,
      multipleRowSpell,
      version,
      distanceFromBottom
    }) => {
      const isSummonWithActionablePassive = summonsWithActionablePassives.includes(summonName);
      let rowCount = 1;
      if (level >= 5) {
        rowCount++;
        if (version) rowCount++;
      }
      if (level >= 7 && isSummonWithActionablePassive) rowCount++;
      for (let row = summonRow; row < summonRow + rowCount; row++) {
        let imageTag = 'Use';
        if (
          isSummonWithActionablePassive
            && level >= 7 && row === summonRow + rowCount - 1
        ) {
          imageTag = 'Tick';
        } else if (version && row === summonRow + rowCount - distanceFromBottom) {
          imageTag = version;
        }

        let useVersion = false;
        let currentRow = row - 1;
        let spellName = grid[currentRow][abilitiesColumn - 1];
        while (!spellName) {
          currentRow--;
          useVersion = true;
          spellName = grid[currentRow][abilitiesColumn - 1];
        }

        Drive_.createButton({
          databaseID,
          sheet,
          cell: [row, buttonColumn],
          imageTag,
          script: `Use${
            Convert_.toPascalCase(spellName.replaceAll("'", ''))
          }${useVersion ? version : ''}`,
          scale: 0.7,
          rowHeight: level < 5
            ? 50
            : spellName === multipleRowSpell
              ? sheet.getRowHeight(currentRow + 1)
              : Math.max(
                Generic_.getEstimatedCellHeight([currentRow + 1, descriptionColumn], sheet),
                grid[currentRow][typeColumn - 1] === 'Passive' ? 25 : 29
              ),
          columnWidth: 55
        });
      }
    };

    const IO_ = IO();
    IO_.notify({
      message: `Formatting ${sheetName} sheet and generating buttons...`,
      mobile
    });
    const lastColumn = grid[0].length;
    for (row = grid.length - 1; row > 0; row -= 3) {
      let summonName = grid[row][0], rowCount = 0;
      while (!summonName) {
        row--;
        rowCount++;
        summonName = grid[row][0];
      }
      if (!summons.includes(summonName)) {
        sheet.deleteRows(row + 1, summonName === 'Echo' ? 1 : 3 + rowCount);
        continue;
      }
      if (summonName === 'Echo') continue;

      const { value: level = 1 } = Generic_.getNamedRange('Level');
      const {
        multipleRowSpell,
        version,
        distanceFromBottom,
        action = 1,
        bonusAction = 1,
        passive = 1
      } = multipleRowSummonSpellConfig.find(({ summon }) => summonName === summon) || {};
      createButtons({
        summonRow: row + 1,
        summonName,
        level,
        multipleRowSpell,
        version,
        distanceFromBottom
      });
      if (level >= 7) continue;
      sheet.deleteRows(
        row + action + (level >= 5 ? bonusAction : 0) + 1,
        passive + (level < 5 ? bonusAction : 0)
      );
      Generic_.addHorizontalBorder(({ sheet, row: row + 1, lastColumn }));
      if (level < 5) sheet.setRowHeight(row + 1, 50);
    }

    grid = sheet.getDataRange().getValues();
    const skipRows = grid.reduce((total, row, index) => {
      if (!['', 'Passive'].includes(row[typeColumn - 1])) return total;
      return [...total, index + 1];
    }, [1]);
    sheet.setColumnWidth(
      abilitiesColumn,
      Generic_.getEstimatedColumnWidth({
        column: abilitiesColumn,
        sheet,
        skipRows
      })
    );
    sheet
      .getDataRange()
      .setBorder(
        true,
        true,
        true,
        true,
        null,
        null,
        '#000000',
        SpreadsheetApp.BorderStyle.SOLID_THICK
      );
    Generic_.hideColumns(
      metadata[durationColumn]
        ? durationColumn
        : [durationColumn, durationColumn + 1],
      sheet
    );
    Architect_.cacheSummonData({
      sheetName,
      multipleRowSummonSpellConfig,
      saveToMemory: true,
      mobile
    });
    Generic_.refreshSheet(sheet);
    for (let row = 2; row <= grid.length; row++) {
      const maxHealth = Generic_.getValue([row, maxHealthColumn], sheet);
      if (maxHealth) {
        for (let column = healthColumn; column < maxHealthColumn; column++) {
          Generic_.setValue([row, column], maxHealth, sheet);
        }
      }
    }
    Automation_.modifyUpdatesLeft({ updates: sheetName });
    IO_.notify({ message: `Successfully updated ${sheetName} sheet.`, mobile });
  },
  getWeaponColors: ({ includeWarpblade = false }) => [
    { weapon: 'Glaive Saber', color: '#22C069' },
    { weapon: 'Phase Blade', color: '#B80202' },
    { weapon: 'Scepter', color: '#FF00FF' },
    ...(includeWarpblade ? [{ weapon: 'Warpblade', color: '#49007A' }] : [])
  ],
  addWeaponColors: ({ sheet, range, includeWarpblade }) => {
    const rules = [];
    Architect().getWeaponColors({ includeWarpblade }).forEach(({ weapon, color }) => {
      rules.push(
        SpreadsheetApp
          .newConditionalFormatRule()
          .whenFormulaSatisfied(`=INDIRECT(ADDRESS(ROW(), COLUMN())) = "${weapon}"`)
          .setFontColor(color)
          .setBold(true)
          .setRanges(Array.isArray(range) ? range : [range])
          .build()
      );
    });
    sheet.setConditionalFormatRules([...sheet.getConditionalFormatRules(), ...rules]);
    return rules;
  },
  onAttributesFormat: ({ sheet }) => {
    if (!sheet) return;
    const grid = sheet.getDataRange().getValues();
    const getRange = (value) => {
      for (let row = 0; row < grid.length; row++) {
        for (let column = 0; column < grid[row].length; column++) {
          if (grid[row][column] === value) {
            return sheet.getRange(row + 2, column + 1);
          }
        }
      }
    };
    return Architect().addWeaponColors({
      sheet,
      range: [getRange('Main-hand'), getRange('Off-hand')],
      includeWarpblade: true
    });
  },
  addWeaponConditionalFormatting: ({ sheet, grid, metadata = [] }) => {
    const requiresColumn = metadata.indexOf('requires') + 1;
    if (!requiresColumn) return true;
    return Architect().addWeaponColors({
      sheet,
      range: sheet.getRange(1, requiresColumn, grid.length, 1)
    });
  },
  beforeActionsFormat: ({
    sheet,
    grid,
    metadata = [],
    level,
    path
  }) => {
    const Data_ = Data();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    if (!level || !path || level < 7 || path !== 'Artificer') return true;
    const slotTypeColumn = metadata.indexOf('slotType') + 1;
    if (!slotTypeColumn) throw 'There is no [Slot Type] column';

    sheet.insertColumnAfter(slotTypeColumn);
    Generic().setValue([1, slotTypeColumn + 1], 'Points', sheet);
    for (let [index, row] of grid.entries()) {
      row.splice(slotTypeColumn, 0, index ? '' : 'Points');
    }
    return true;
  },
  onActionsFormat: ({
    sheet,
    grid,
    metadata = [],
    firstRowSize = 2,
    level,
    path
  }) => {
    const Data_ = Data();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const Architect_ = Architect();
    Architect_.addWeaponConditionalFormatting({ sheet, grid, metadata });
    if (!level || !path || level < 7 || path !== 'Artificer') return true;
    const slotCostColumn = metadata.indexOf('slotCost') + 1;
    const slotTypeColumn = metadata.indexOf('slotType') + 1;
    const pointsColumn = metadata.indexOf('points') + 1;
    const requiresColumn = metadata.indexOf('requires') + 1;
    const {
      firstSlotSpells,
      secondSlotSpells,
      thirdSlotSpells
    } = Architect_.getAttunedSpells();

    const Generic_ = Generic();
    grid.slice(firstRowSize).forEach(([ability], row) => {
      if (
        ![
          ...firstSlotSpells,
          ...secondSlotSpells,
          ...thirdSlotSpells
        ].includes(ability)
      ) return;

      Generic_.setValue([row + firstRowSize + 1, slotCostColumn], '-', sheet);
      Generic_.setValue([row + firstRowSize + 1, slotTypeColumn], '', sheet);
      Generic_.setValue([row + firstRowSize + 1, requiresColumn], '-', sheet);
      sheet.getRange(row + firstRowSize + 1, slotCostColumn, 1, 2).merge();
      Generic_.setValue(
        [row + firstRowSize + 1, pointsColumn],
        firstSlotSpells.includes(ability)
          ? 1
          : (secondSlotSpells.includes(ability) ? 3 : 5),
        sheet
      );
      sheet
        .getRange(row + firstRowSize + 1, 1, 1, grid[0].length)
        .setBackground('#C7E0BD');
    });
    return true;
  },
  learnAttunedSpells: ({
    databaseID,
    selectedClass = 'Architect',
    nextLevel,
    path,
    oldChoices = [],
    newChoices = [],
    descriptions = [],
    levelConfig = {
      7: ['First Slot'],
      10: ['Second Slot'],
      14: ['Third Slot'],
      18: ['First Slot', 'Second Slot', 'Third Slot']
    },
    mobile = false,
    trackHistory
  } = {}) => {
    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!path) path = Data_.path();

    if (path !== 'Artificer') return true;
    const attunementSlots = levelConfig[nextLevel];
    if (!attunementSlots) return true;

    const Convert_ = Convert(), Generic_ = Generic(), Automation_ = Automation();
    const learnableAttunements = [];
    ['Actions', 'Bonus Actions', 'Reactions', 'Interactions', 'Movement'].forEach((sheet) => {
      const sheetObject = Generic_.getSheet(sheet, databaseID);
      if (!sheetObject) return;
      const abilityColumn = sheetObject
        .getDataRange()
        .getValues()[0]
        .indexOf(Convert_.toSingular(sheet)) + 1;
      Automation_.query({
        sourceID: databaseID,
        source: sheet,
        conditions: {
          [abilityColumn]: (ability, row) => (getColumn) => {
            if (!['Scepter', 'Glaive Saber'].includes(getColumn('Requires'))) return;
            const tag = getColumn('Tags');
            if (!attunementSlots.includes(tag)) return;
            if (![...oldChoices, ...newChoices].includes(ability)) return true;
            learnableAttunements.push({ ability, sheet, tag, row });
          },
          'Choice': (value) => value === true,
          'Class': (value) => value === selectedClass,
          'Level': (value, row) => (getColumn) => {
            if ((value || 0) <= nextLevel) {
              learnableAttunements.push({
                ability: getColumn(abilityColumn),
                sheet,
                tag: getColumn('Tags'),
                row
              });
            }
          }
        }
      });
    });
    if (!learnableAttunements.length) return true;

    const IO_ = IO();
    const selectedAttunements = [];
    const attunementSlotsCount = attunementSlots.length;
    const newLine = IO_.getNewLineChar(mobile);
    for (let [index, slot] of attunementSlots.entries()) {
      const selectedAttunement = IO_.askForAnswerFromList({
        title: 'Ability Attunements',
        message: `${
          attunementSlotsCount > 1 ? `(${index + 1} / ${attunementSlotsCount}) - ` : ''
        }Select a ${slot} spell to become attuned with`,
        options: learnableAttunements.reduce((total, { ability, tag }) => {
          if (slot !== tag) return total;
          return [...total, ability];
        }, []),
        optionModifier: (option) => {
          const foundAbility = descriptions.find(({ name }) => name === option);
          if (!foundAbility) return option;
          return `${option}: ${foundAbility.description}${newLine}`;
        },
        excludeOptions: [...oldChoices, ...newChoices, ...selectedAttunements],
        mobile
      });
      if (!selectedAttunement) return;
      selectedAttunements.push(selectedAttunement);
    }

    const sheetsToBeUpdated = {};
    const firstSlotAttunements = [], secondSlotAttunements = [], thirdSlotAttunements = [];
    selectedAttunements.forEach((name) => {
      const { sheet, row, tag } = learnableAttunements.find(({ ability }) => name === ability);
      if (tag === 'First Slot') firstSlotAttunements.push(name);
      else if (tag === 'Second Slot') secondSlotAttunements.push(name);
      else if (tag === 'Third Slot') thirdSlotAttunements.push(name);
      if (sheetsToBeUpdated[sheet]) sheetsToBeUpdated[sheet][name] = row;
      else sheetsToBeUpdated[sheet] = { [name]: row };
    });

    const characterSetupData = Generic_.getNamedRange('Character_Setup');
    const characterSetup = JSON.parse(characterSetupData.value || '{}');
    trackHistory({
      ...characterSetupData,
      value: JSON.stringify({
        ...characterSetup,
        abilities: [
          ...(characterSetup?.abilities || []),
          ...newChoices,
          ...selectedAttunements
        ],
        ...(firstSlotAttunements.length && { firstSlotAttunements }),
        ...(secondSlotAttunements.length && { secondSlotAttunements }),
        ...(thirdSlotAttunements.length && { thirdSlotAttunements })
      })
    });
    if (selectedAttunements.some((ability) => ability.includes('Summon'))) {
      sheetsToBeUpdated['Summons'] = {};
      sheetsToBeUpdated['Mobile'] = {};
    }

    return { sheetsToBeUpdated, selectedAttunements };
  },
  replaceLearnedSpells: ({
    databaseID,
    selectedClass = 'Architect',
    nextLevel,
    path,
    choiceData = [],
    oldChoices = [],
    newChoices = [],
    selectedAttunements = [],
    descriptions = [],
    abilityChangeCount = 2,
    mobile = false,
    trackHistory
  } = {}) => {
    const checkForSummons = (abilityList = newChoices) => {
      return abilityList.some((ability) => ability.includes('Summon'))
        ? { 'Summons': [], 'Mobile': [] }
        : {};
    };

    if (!oldChoices.length || !newChoices.length) {
      return checkForSummons();
    }
    const spellChoices = choiceData[1][choiceData[0].indexOf('Unlock Spell Tags')];
    const slots = ['First', 'Second', 'Third', 'Fourth'].map((slot) => slot + ' Slot');
    if (!slots.some((slot) => spellChoices.includes(slot))) {
      return checkForSummons();
    }

    const Data_ = Data();
    if (!databaseID) databaseID = Data_.databaseID();
    if (!path) path = Data_.path();

    const Convert_ = Convert(), Generic_ = Generic(), Automation_ = Automation();
    const learnableAbilities = [], replaceableAbilities = [];
    ['Actions', 'Bonus Actions', 'Reactions', 'Interactions', 'Movement'].forEach((sheet) => {
      const sheetObject = Generic_.getSheet(sheet, databaseID);
      if (!sheetObject) return total;
      const abilityColumn = sheetObject
        .getDataRange()
        .getValues()[0]
        .indexOf(Convert_.toSingular(sheet)) + 1;
      Automation_.query({
        sourceID: databaseID,
        source: sheet,
        conditions: {
          [abilityColumn]: (ability, row) => (getColumn) => {
            const tag = getColumn('Tags');
            if (!slots.includes(tag)) return;
            if (!oldChoices.includes(ability)) return true;
            const abilityData = { ability, sheet, tag, row };
            learnableAbilities.push(abilityData);
            replaceableAbilities.push(abilityData);
          },
          'Choice': (value) => value,
          'Class': (value) => value === selectedClass,
          'Level': (value) => (value || 0) <= nextLevel,
          'Path': (value, row) => (getColumn) => {
            if (!value || (path && value.includes(path))) {
              learnableAbilities.push({
                ability: getColumn(abilityColumn),
                sheet,
                tag: getColumn('Tags'),
                row
              });
            }
          }
        }
      });
    });
    if (!replaceableAbilities.length || !learnableAbilities.length) {
      return checkForSummons();
    }

    const noChangesOption = 'No Changes';
    const abilitiesToBeReplaced = [], abilityReplacements = [];
    const getSheetsToBeUpdated = () => {
      const sheetsToBeUpdated = {};
      const populateSheetsToBeUpdated = (abilityNames, abilityData) => {
        abilityNames.forEach((name) => {
          const { sheet, row } = abilityData.find(({ ability }) => name === ability);
          if (sheetsToBeUpdated[sheet]) sheetsToBeUpdated[sheet][name] = row;
          else sheetsToBeUpdated[sheet] = { [name]: row };
        });
      };

      const characterSetupData = Generic_.getNamedRange('Character_Setup');
      const characterSetup = JSON.parse(characterSetupData.value || '{}');
      const { abilities = [] } = characterSetup;
      abilitiesToBeReplaced.forEach((ability) => {
        abilities.splice(abilities.indexOf(ability), 1);
      });
      trackHistory({
        ...characterSetupData,
        value: JSON.stringify({
          ...characterSetup,
          abilities: [
            ...abilities,
            ...newChoices,
            ...abilityReplacements,
            ...selectedAttunements
          ]
        }),
      });

      populateSheetsToBeUpdated(abilitiesToBeReplaced, replaceableAbilities);
      populateSheetsToBeUpdated(abilityReplacements, learnableAbilities);
      return {
        ...sheetsToBeUpdated,
        ...checkForSummons([
          ...newChoices,
          ...abilitiesToBeReplaced,
          ...abilityReplacements
        ])
      };
    };

    const IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    for (let iteration = 0; iteration < abilityChangeCount; iteration++) {
      const abilityToBeReplaced = IO_.askForAnswerFromList({
        title: 'Replacing old abilities...',
        message: `(${iteration + 1} / ${abilityChangeCount}) - ` +
          'Select a spell to replace with another of the same level',
        options: [noChangesOption, ...replaceableAbilities.map(({ ability }) => ability)],
        optionModifier: (option) => {
          if (option === noChangesOption) return `${option}${newLine}`;
          const { sheet, tag } = replaceableAbilities.find(({ ability }) => ability === option);
          const type = Convert_.toSingular(sheet);
          const abilityDescription = descriptions.find(({ name }) => name === option);
          if (!abilityDescription) return `${option} (${tag} ${type})`;
          return `${option} (${tag} ${type}): ${abilityDescription.description}${newLine}`;
        },
        excludeOptions: abilitiesToBeReplaced,
        mobile
      });
      if (!abilityToBeReplaced) return;
      if (abilityToBeReplaced === noChangesOption) {
        if (!abilitiesToBeReplaced.length) return checkForSummons();
        return getSheetsToBeUpdated();
      }
      abilitiesToBeReplaced.push(abilityToBeReplaced);

      const { tag } = replaceableAbilities.find(({ ability }) => ability === abilityToBeReplaced);
      const options = learnableAbilities.filter(({ tag: currentTag }) => currentTag === tag);
      const selectedAbility = IO_.askForAnswerFromList({
        title: 'Replacing old abilities...',
        message: `(${iteration + 1} / ${abilityChangeCount}) - Select a ${
          tag
        } spell to replace ${abilityToBeReplaced}`,
        options: options.map(({ ability }) => ability),
        optionModifier: (option) => {
          const foundAbility = descriptions.find(({ name }) => name === option);
          if (!foundAbility) return option;
          return `${option}: ${foundAbility.description}${newLine}`;
        },
        excludeOptions: [
          ...oldChoices,
          ...newChoices,
          ...abilityReplacements,
          ...selectedAttunements
        ],
        mobile
      });
      abilityReplacements.push(selectedAbility);
    }

    return getSheetsToBeUpdated();
  },
  onLearnAbility: ({ spellName }) => {
    if (!spellName || !spellName.includes('Summon')) return true;
    return { 'Summons': {} };
  },
  onLevelUp: (options) => {
    const Architect_ = Architect();
    const attunedSpellData = Architect_.learnAttunedSpells(options);
    if (!attunedSpellData) return;
    const {
      sheetsToBeUpdated = {},
      selectedAttunements = []
    } = attunedSpellData;
    const moreSheetsToBeUpdated = Architect_.replaceLearnedSpells({
      ...options,
      selectedAttunements
    });
    if (!moreSheetsToBeUpdated) return;
    
    return Data().deepObjectMerge(
      [
        sheetsToBeUpdated,
        moreSheetsToBeUpdated,
        [5, 7].includes(options.nextLevel)
          ? { 'Summons': {}, 'Mobile': {} }
          : {}
      ],
      { mergeArrays: true, uniqueMergedArrays: true }
    );
  },
  // Caching
  cacheSummonData: ({
    sheetName = 'Summons',
    multipleRowSummonSpellConfig,
    saveToMemory = false,
    mobile = false
  } = {}) => {
    const Architect_ = Architect();
    if (!multipleRowSummonSpellConfig) {
      multipleRowSummonSpellConfig = Architect_.getMultipleRowSummonSpellConfig();
    }

    const Generic_ = Generic();
    const summonData = {};
    const sheet = Generic_.getSheet(sheetName);
    if (!sheet) return summonData;

    IO().notify({ message: 'Caching Summons data...', mobile });
    const summonsWithActionablePassives = Architect_.getSummonsWithActionablePassives();
    const ignoredColumns = ['Abilities', 'Range', 'Description'];
    const grid = sheet.getDataRange().getValues();
    const metadata = grid[0];
    const durationIndex = metadata.indexOf('Duration');
    const healthIndex = metadata.indexOf('HP');
    const abilitiesIndex = metadata.indexOf('Abilities');
    const typeIndex = metadata.indexOf('Type');
    const effectIndex = metadata.indexOf('Effect');
    const firstSummon = Generic_.getMergedCells('A2', sheet);
    const abilitiesKnownPerSummon = firstSummon
      ? firstSummon.split(':')[1].replace(/[^0-9]/g, '') - 1
      : 1;
    metadata[abilitiesIndex + 1] = 'Tracker';
    metadata[effectIndex] = 'MainEffect';
    metadata[effectIndex + 1] = 'SecondaryEffect';
    if (!metadata[durationIndex + 1]) metadata[durationIndex + 1] = 'DurationMultiplicity';
    if (!metadata[healthIndex + 2]) metadata[healthIndex + 1] = 'HPMultiplicity';
    if (!metadata[abilitiesIndex + 3]) metadata[abilitiesIndex + 2] = 'TrackerMultiplicity';
    metadata[healthIndex + (metadata[healthIndex + 2] ? 1 : 2)] = 'Max HP';

    const Convert_ = Convert();
    const saveInfo = (object, key, row, column) => {
      object[key] = Convert_.toA1Notation(row + 1, column + 1);
    };

    for (let summonRow = 1; summonRow < grid.length; summonRow += abilitiesKnownPerSummon) {
      const summonName = grid[summonRow][0];
      const {
        action = 1,
        bonusAction = 1
      } = multipleRowSummonSpellConfig.find(({ summon }) => summonName === summon) || {};
      const extraRowCount = action + bonusAction - 2;
      const currentSummonData = {};
      for (let column = 1; column < abilitiesIndex; column++) {
        saveInfo(currentSummonData, metadata[column], summonRow, column);
      }
      const abilityData = {};
      if (summonName === 'Echo') {
        summonData[summonName] = { ...currentSummonData, 'Abilities': {} };
        break;
      }

      const rowBalancer = [
        ...Array.from({ length: action }, (_, index) => index),
        ...Array.from({ length: bonusAction }, (_, index) => index),
        0
      ];
      const isSummonWithActionablePassive = summonsWithActionablePassives.includes(summonName);
      for (let row = summonRow; row < summonRow + abilitiesKnownPerSummon + extraRowCount; row++) {
        if (
          grid[row][typeIndex] === 'Passive'
            && !isSummonWithActionablePassive
        ) continue;
        const spellName = grid[row][abilitiesIndex];
        const currentRowBalancer = rowBalancer[row - summonRow];
        const currentAbilityData = {};
        for (let column = abilitiesIndex; column < grid[summonRow].length; column++) {
          const currentValue = grid[row - (spellName ? 0 : 1)][column];
          const columnName = metadata[column];
          if (
            ['', '-'].includes(currentValue)
              || ignoredColumns.includes(columnName)
          ) continue;
          if (typeof currentValue === 'boolean' && currentRowBalancer) continue;
          if (!spellName && columnName === 'Type') continue;
          saveInfo(
            currentAbilityData,
            Convert_.toCamelCase(columnName),
            row - currentRowBalancer,
            column
          );
        }
        abilityData[
          spellName || `${grid[row - 1][abilitiesIndex]} Trigger`
        ] = currentAbilityData;
      }
      summonRow += extraRowCount;
      summonData[summonName] = { ...currentSummonData, 'Abilities': abilityData };
    }

    if (saveToMemory) Cache().saveCache(summonData, { sheetName });
    return summonData;
  },
  // Utilities
  getLevelIncrement: ({ start = 1, increment = 1, levelsArray = [4, 8, 12, 16, 19] }) => {
    const { value: currentLevel = 1 } = Generic().getNamedRange('Level');
    return start + increment * levelsArray.filter((item) => item <= currentLevel).length;
  },
  getArchitectCustomRequiredArguments: ({ spellName, type, skipActionCost }) => {
    const Architect_ = Architect();
    const arcaneSurgeArguments = {};
    if (type === 'Bonus Action') {
      arcaneSurgeArguments.skipActionCost = Architect_.getArcaneSurgeStacks()?.value;
      if (!skipActionCost) arcaneSurgeArguments.onUse = Architect_.reduceArcaneSurgeStacks;
    }
    const {
      firstSlotSpells,
      secondSlotSpells,
      thirdSlotSpells
    } = Architect_.getAttunedSpells();
    const isSpellAttuned = [
      ...firstSlotSpells,
      ...secondSlotSpells,
      ...thirdSlotSpells
    ].includes(spellName);
    if (isSpellAttuned) return {
      ...arcaneSurgeArguments,
      customCost: {
        costName: 'points',
        currentCostName: 'Points',
        onFailNotification: `You do not have enough Attunement Points for ${spellName}.`
      }
    };

    return {
      ...arcaneSurgeArguments,
      onCheck: ({ spellName, sheet, mobile }) => {
        const requiredWeapon = Parse().getValue(sheet, spellName, 'requires');
        if (!requiredWeapon || requiredWeapon === '-') return true;
        const [
          { value: mainHand },
          { value: offHand }
        ] = Generic().getNamedRange(['Main_hand', 'Off_hand']);
        if (
          [mainHand, offHand].filter((weapon) => {
            return [requiredWeapon, 'Warpblade'].includes(weapon);
          }).length
        ) return true;
        return IO().notify({
          message: `You need to equip your ${requiredWeapon} to ${
            requiredWeapon === spellName ? `attack with it` : `use ${spellName}`
          }.`,
          mobile
        });
      }
    };
  },
  getEmptyHand: (mobile) => {
    const Generic_ = Generic();
    if (
      !Generic_.doesValueExist('Armamental Duality', 'Passives')
        || Inventory().checkWeaponAttribute({ attribute: 'two-handed' })
    ) return 'Main_hand';
    const { value: mainHand = '-' } = Generic_.getNamedRange('Main_hand');
    if (mainHand === '-') return 'Main_hand';
    const { value: offHand = '-' } = Generic_.getNamedRange('Off_hand');
    if (offHand === '-') return 'Off_hand';
    const hand = IO().askForAnswerFromList({
      title: 'Conjured Arsenal hand',
      message: 'Select for which hand you want to conjure a weapon',
      options: ['Main-hand', 'Off-hand'],
      optionModifier: (option) => `${option}: (${option === 'Main-hand' ? mainHand : offHand})`,
      mobile
    });
    if (!hand) return;
    return hand.replace('-', '_');
  },
  getSummonsData: (sheetName = 'Summons') => {
    if (!Generic().getSheet(sheetName)) return;
    const summonsData = Parse().getSheetData(sheetName);
    if (!summonsData) throw 'You need to cache the Summons sheet first';
    return summonsData;
  },
  getActiveSummons: ({
    sheetName = 'Summons',
    summonsData,
    includeMetadata = false
  } = {}) => {
    if (!summonsData) {
      summonsData = Architect().getSummonsData();
      if (!summonsData) return [];
    }

    const Generic_ = Generic(), Parse_ = Parse();;
    const addData = (key, range, value) => {
      if (!range) return {};
      if (value === undefined) value = Generic_.getValue(range, sheetName);
      return { [key]: { sheet: sheetName, range, value } };
    };

    const activeSummonsData = Object.entries(summonsData).reduce((total, [summon, summonData]) => {
      const {
        'Duration': durationRange,
        'DurationMultiplicity': durationMultiplicityRange,
        'HP': currentHealthRange,
        'HPMultiplicity': currentHealthMultiplicityRange,
        'Max HP': maxHealthRange
      } = summonData;
      const duration = durationRange
        ? Generic_.getValue(durationRange, sheetName)
        : undefined;
      const durationMultiplicity = durationMultiplicityRange
        ? Generic_.getValue(durationMultiplicityRange, sheetName)
        : undefined;
      const currentHealth = currentHealthRange
        ? Generic_.getValue(currentHealthRange, sheetName)
        : undefined;
      const currentHealthMultiplicity = currentHealthMultiplicityRange
        ? Generic_.getValue(currentHealthMultiplicityRange, sheetName)
        : undefined;
      const defaultData = {
        level: parseInt((Parse_.getValue('Actions', `Summon ${summon}`, 'slotType') || '0')[0]),
        ...addData('maxHealthData', maxHealthRange)
      };

      if (duration && currentHealth) {
        total[summon] = includeMetadata ? {
          ...defaultData,
          ...addData('durationData', durationRange, duration),
          ...addData('currentHealthData', currentHealthRange, currentHealth)
        } : {};
      }
      if (durationMultiplicity) {
        total[`${summon} Multiplicity`] = includeMetadata ? {
          ...defaultData,
          ...addData('durationData', durationMultiplicityRange, durationMultiplicity),
          ...addData('currentHealthData', currentHealthMultiplicityRange, currentHealthMultiplicity)
        } : {};
      }
      return total;
    }, {});
    return includeMetadata
      ? activeSummonsData
      : Object.keys(activeSummonsData);
  },
  getSummonTrackerState: ({
    summon,
    summonsData,
    spellName,
    sheet = 'Summons'
  }) => {
    if (!summonsData) {
      summonsData = Architect().getSummonsData();
      if (!summonsData) return {};
    }

    const {
      tracker,
      trackerMultiplicity
    } = summonsData[summon]['Abilities'][spellName];
    if (!tracker) return [];

    const Generic_ = Generic();
    const trackerState = {
      sheet,
      range: tracker,
      value: Generic_.getValue(tracker, sheet)
    };
    if (!trackerMultiplicity) return [trackerState];
    return [
      trackerState,
      {
        sheet,
        range: trackerMultiplicity,
        value: Generic_.getValue(trackerMultiplicity, sheet)
      }
    ];
  },
  getAttunedSpells: () => {
    const Generic_ = Generic();
    let { value: firstSlotSpells = '' } = Generic_.getNamedRange('Attuned_First_Slot_Spells');
    let { value: secondSlotSpells = '' } = Generic_.getNamedRange('Attuned_Second_Slot_Spells');
    let { value: thirdSlotSpells = '' } = Generic_.getNamedRange('Attuned_Thurd_Slot_Spells');
    firstSlotSpells = firstSlotSpells ? firstSlotSpells.split(',') : [];
    secondSlotSpells = secondSlotSpells ? secondSlotSpells.split(',') : [];
    thirdSlotSpells = thirdSlotSpells ? thirdSlotSpells.split(',') : [];
    return { firstSlotSpells,  secondSlotSpells, thirdSlotSpells };
  },
  getArcaneSurgeStacks: () => Generic().getNamedRange('Arcane_Surge_Bonus_Actions'),
  selectAvailableSlotSpell: ({ spellName, slot, mobile }) => {
    const Generic_ = Generic(), IO_ = IO();
    if (slot && slot !== 'Cantrip') {
      const currentSlotData = Generic_.getNamedRange(`Slots_${slot}`);
      if (!Object.keys(currentSlotData).length) {
        IO_.notify({
          type: 'msgBox',
          title: `${spellName} chain casting`,
          message: `Level ${slot} slots do not exist`,
          mobile
        });
        return true;
      }
      if (!currentSlotData.value) {
        IO_.notify({
          type: 'msgBox',
          title: `${spellName} chain casting`,
          message: `You have no more level ${slot} slots`,
          mobile
        });
        return true;
      }
    }

    const cantrips = ['Summon Fairy', 'Ethereal Slash', 'Phase Edge'];
    const slotTypes = ['Cantrip', '1st', '2nd', '3d', '4th'];
    const slotType = slotTypes?.[slot] || 'Cantrip';
    const spellData = Parse().query({
      sheet: ['Actions', 'Bonus Actions'],
      select: 'requires',
      ...(slotType === 'Cantrip'
        ? { where: { '$name': (value) => cantrips.includes(value) } }
        : { where: { 'slotType': (value) => parseInt(value[0]) === slot } }
      )
    });
    const equipedWeapons = Generic_.getNamedRange(['Main_hand', 'Off_hand'])
      .reduce((total, { value }) => [...total, value], []);
    const options = Object.keys(spellData);
    const excludeOptions = equipedWeapons.includes('Warpblade')
      ? []
      : Object.entries(spellData).reduce((total, [spell, { requires }]) => {
          if (equipedWeapons.includes(requires)) return total;
          return [...total, spell];
        }, []);
    const availableOptions = options.filter((option) => !excludeOptions.includes(option));
    const generateOutput = (command) => {
      return {
        command,
        type: Convert().toCamelCase(spellData[command].sheet)
      };
    };

    if (!availableOptions.length) return true;
    if (availableOptions.length === 1) {
      return generateOutput(availableOptions[0]);
    }
    const haltKeyword = 'No chain casting';
    const newLine = IO_.getNewLineChar(mobile);
    const spellCast = IO_.askForAnswerFromList({
      title: `${spellName} chain casting`,
      message: `Select a ${
        slotType === 'Cantrip'
          ? slotType
          : `${slotType} Slot`
      } spell to cast`,
      options: [haltKeyword, ...options],
      excludeOptions,
      optionModifier: (option) => {
        if (option === haltKeyword) return `${option}${newLine}`;
        const { sheet } = spellData[option];
        return `${option}: ${sheet.slice(0, -1)}`;
      },
      mobile
    });
    if (!spellCast) return;
    if (spellCast === haltKeyword) return true;
    return generateOutput(spellCast);
  },
  // Callbacks
  restoreAllSpellSlots: ({ trackHistory }) => Helper().restoreAllClassSpellSlots({
    slotLimit: 4,
    trackHistory
  }),
  gainSpellSlot: ({
    spellName,
    sheet,
    excludeLevel1,
    excludeLevel2,
    excludeLevel3,
    excludeLevel4,
    repeat = 0,
    fromArcaneInfusion = false,
    memory = {},
    mobile,
    trackHistory
  }) => {
    let availableSlotCount = 0;
    const options = [], excludeOptions = [];
    const slotType = Parse().getValue(sheet, spellName, 'slotType')?.[0];
    memory.slotTypes = [...(memory?.slotTypes || []), slotType];
    const [
      slotData1,
      slotData2,
      slotData3,
      slotData4,
      { value: maxSlots1 },
      { value: maxSlots2 },
      { value: maxSlots3 },
      { value: maxSlots4 }
    ] = Generic().getNamedRange([
      'Slots_1',
      'Slots_2',
      'Slots_3',
      'Slots_4',
      'Max_Slots_1',
      'Max_Slots_2',
      'Max_Slots_3',
      'Max_Slots_4'
    ]);
    const slotsConfig = {
      'Level 1 Slot': {
        currentData: slotData1,
        max: maxSlots1,
        excludeCondition: excludeLevel1,
        spent: memory.slotTypes.filter((type) => type === '1').length,
        gain: memory?.['Level 1 Slot'] || 0
      },
      'Level 2 Slot': {
        currentData: slotData2,
        max: maxSlots2,
        excludeCondition: excludeLevel2,
        spent: memory.slotTypes.filter((type) => type === '2').length,
        gain: memory?.['Level 2 Slot'] || 0
      },
      'Level 3 Slot': {
        currentData: slotData3,
        max: maxSlots3,
        excludeCondition: excludeLevel3,
        spent: memory.slotTypes.filter((type) => type === '3').length,
        gain: memory?.['Level 3 Slot'] || 0
      },
      'Level 4 Slot': {
        currentData: slotData4,
        max: maxSlots4,
        excludeCondition: excludeLevel4,
        spent: memory.slotTypes.filter((type) => type === '4').length,
        gain: memory?.['Level 4 Slot'] || 0
      }
    };
    Object.entries(slotsConfig).forEach(([
      slot,
      { currentData, max, excludeCondition, spent, gain }
    ]) => {
      if (!max || excludeCondition) return;
      options.push(slot);
      const slotDifference = max - currentData.value + (spent ? 1 : 0) - gain;
      if (slotDifference > 0) availableSlotCount += slotDifference;
      else excludeOptions.push(slot);
    });

    const pickSlotChoice = (choice) => {
      const config = slotsConfig[choice];
      config.gain++;
      const { currentData, max, spent, gain } = config;
      if (currentData.value + gain - (spent ? 1 : 0) >= max) {
        excludeOptions.push(choice);
      }
      trackHistory({ ...currentData, value: 1, relative: true, max });
    };

    if (availableSlotCount <= repeat + 1) {
      const memory = {};
      trackHistory(
        Object.values(slotsConfig).reduce((
          total,
          { currentData, max, excludeCondition, spent, gain },
          index
        ) => {
          if (!max || excludeCondition) return total;
          const currentGain = max - currentData.value + (spent ? 1 : 0) - gain;
          if (currentGain) memory[`Level ${index + 1} Slot`] = currentGain;
          return [...total, { ...currentData, value: max }];
        }, [])
      );
      return memory;
    }
    const IO_ = IO();
    for (let iteration = 0; iteration <= repeat; iteration++) {
      if (!options.length || options.length === excludeOptions.length) return true;
      const validOptions = options.filter((option) => !excludeOptions.includes(option));
      if (validOptions.length === 1) {
        pickSlotChoice(validOptions[0]);
        continue;
      }

      const spellSlotPicked = IO_.askForAnswerFromList({
        title: `${
          fromArcaneInfusion
            ? 'Arcane Infusion '
            : `${spellName ? `${spellName} ` : ''}`
        }Spell Slot gain`,
        message: `${
          repeat ? `(${iteration + 1} / ${repeat + 1}) ` : ''
        }Pick the Spell Slot you want to gain${fromArcaneInfusion ? ` from ${spellName}` : ''}`,
        options,
        excludeOptions,
        optionModifier: (option) => {
          const { currentData, max, spent, gain } = slotsConfig[option];
          return `${option}: ${
            currentData.value - (spent ? 1 : 0)
          } / ${max}${gain ? ` (+${gain})` : ''}`;
        },
        mobile
      });
      if (!spellSlotPicked) return;
      pickSlotChoice(spellSlotPicked);
    }

    return Object.entries(slotsConfig).reduce((total, [slot, { gain }]) => {
      if (!gain) return total;
      return {...total, [slot]: gain };
    }, {});
  },
  resetWeapons: ({ trackHistory }) => {
    const weapons = Architect().getWeapons();
    return trackHistory(
      Generic().getNamedRange(['Main_hand', 'Off_hand']).reduce((total, itemData) => {
        if (!weapons.includes(itemData.value)) return total;
        return [...total, { ...itemData, value: '-' }];
      }, [])
    );
  },
  getSummonDurations: ({ summon, sheet = 'Summons' }) => {
    const Generic_ = Generic(), Parse_ = Parse();
    return ['Duration', 'DurationMultiplicity'].reduce((total, duration) => {
      const durationRange = Parse_.getCommandAttributeCell(summon, duration, sheet);
      if (!durationRange) return [...total, false];
      return [...total, Generic_.getValue(durationRange, sheet)];
    }, []);
  },
  reduceAllSummonDuration: ({
    summonsData,
    sheet = 'Summons',
    trackHistory
  }) => {
    if (!summonsData) {
      summonsData = Architect().getSummonsData();
      if (!summonsData) return true;
    }

    const Generic_ = Generic();
    let conditionToHide = true;
    const durationColumns = [];
    const historyChanges = Object.values(summonsData).map(({
      'Duration': duration,
      'DurationMultiplicity': durationMultiplicity
    }) => {
      if (!durationColumns.length) {
        durationColumns.push(Generic_.getColumnFromA1Notation(duration));
        if (durationMultiplicity) {
          durationColumns.push(Generic_.getColumnFromA1Notation(durationMultiplicity));
        }
      }
      if (
        conditionToHide && (
          Generic_.getValue(duration, sheet) > 1 ||
          (durationMultiplicity && Generic_.getValue(durationMultiplicity, sheet))
        )
      ) conditionToHide = false;
      const changes = [{
        sheet,
        range: duration,
        value: -1,
        relative: true,
        min: 0
      }];
      if (durationMultiplicity) {
        changes.push({
          sheet,
          range: durationMultiplicity,
          value: -1,
          relative: true,
          min: 0
        });
      }
      return changes;
    }).flat();
    if (conditionToHide) {
      historyChanges.push({
        sheet,
        command: 'hide',
        type: 'columns',
        options: { target: durationColumns }
      });
    }
    return trackHistory(historyChanges);
  },
  resetSpecificSummonDuration: ({
    summons = [],
    summonsData,
    sheet = 'Summons',
    trackHistory
  }) => {
    if (!summonsData) {
      summonsData = Architect().getSummonsData();
      if (!summonsData) return true;
    }

    const Generic_ = Generic();
    const durationColumns = [];
    return trackHistory((Array.isArray(summons) ? summons : [summons]).reduce((total, summon) => {
      const {
        'Duration': duration,
        'DurationMultiplicity': durationMultiplicity
      } = summonsData[summon.replace(' Multiplicity', '')];
      if (!duration) return total;
      if (!durationColumns.length) {
        durationColumns.push(Generic_.getColumnFromA1Notation(duration));
        if (durationMultiplicity) {
          durationColumns.push(Generic_.getColumnFromA1Notation(durationMultiplicity));
        }
        const noDurationsLeft = !Generic_.getSheet(sheet)
          .getDataRange()
          .getValues()
          .slice(1)
          .find((row) => {
            return durationColumns.find((column, index) => {
              return row[column - 1]
                && !summons.includes(row[0] + (index ? ' Multiplicity' : ''));
            });
          });
        if (noDurationsLeft) {
          trackHistory({
            sheet,
            command: 'hide',
            type: 'columns',
            options: { target: durationColumns }
          });
        }
      }
      if (!summon.includes('Multiplicity')) {
        total.push({ sheet, range: duration, value: 0 });
      } else if (durationMultiplicity) {
        total.push({ sheet, range: durationMultiplicity, value: 0 });
      }
      return total;
    }, []));
  },
  resetAllSummonDuration: ({
    summonsData,
    sheet = 'Summons',
    trackHistory
  }) => {
    if (!summonsData) {
      summonsData = Architect().getSummonsData();
      if (!summonsData) return true;
    }

    const Generic_ = Generic();
    const durationColumns = [];
    const historyChanges = Object.values(summonsData).map(({
      'Duration': duration,
      'DurationMultiplicity': durationMultiplicity
    }) => {
      if (!durationColumns.length) {
        durationColumns.push(Generic_.getColumnFromA1Notation(duration));
        if (durationMultiplicity) {
          durationColumns.push(Generic_.getColumnFromA1Notation(durationMultiplicity));
        }
      }
      const changes = [{ sheet, range: duration, value: 0 }];
      if (durationMultiplicity) {
        changes.push({ sheet, range: durationMultiplicity, value: 0 });
      }
      return changes;
    }).flat();
    historyChanges.push({
      sheet,
      command: 'hide',
      type: 'columns',
      options: { target: durationColumns }
    });
    return trackHistory(historyChanges);
  },
  resetAllSummonActions: ({
    summonsData,
    includeBonusActions = true,
    trackHistory
  }) => {
    const Architect_ = Architect();
    if (!summonsData) {
      summonsData = Architect_.getSummonsData();
      if (!summonsData) return true;
    }

    const Generic_ = Generic();
    const sheetName = 'Summons';
    const evocationMastery = Generic_.doesValueExist('Evocation Mastery', 'Passives');
    return trackHistory(
      Object.entries(summonsData).map(([summon, { 'Abilities': spellData }]) => {
        return Object.entries(spellData).map(([spellName, { type: typeRange }]) => {
          if (!typeRange) return {};
          const type = Generic_.getValue(typeRange, sheetName);
          if (
            type === 'Passive'
              || (type === 'Bonus Action' && !includeBonusActions && !evocationMastery)
          ) return {};
          return Architect_.getSummonTrackerState({
            summon,
            summonsData,
            spellName
          }).map((state) => ({ ...state, value: false }));
        }).flat();
      }).flat()
    );
  },
  castSummonSpell: ({
    summon,
    summonsData,
    doubleDuration = false,
    sheet = 'Summons',
    trackHistory
  }) => {
    const Architect_ = Architect();
    if (!summonsData) {
      summonsData = Architect_.getSummonsData();
      if (!summonsData) return true;
    }

    const Generic_ = Generic();
    const {
      'Duration': duration,
      'DurationMultiplicity': durationMultiplicity,
      'HP': currentHealth,
      'HPMultiplicity': currentHealthMultiplicity,
      'Max HP': maxHealth,
      'Abilities': abilityData
    } = summonsData[summon];
    const durationColumns = [Generic_.getColumnFromA1Notation(duration)];
    if (durationMultiplicity) {
      durationColumns.push(Generic_.getColumnFromA1Notation(durationMultiplicity));
    }
    trackHistory({
      sheet,
      command: 'unhide',
      type: 'columns',
      options: { target: durationColumns }
    });
    const summonDurations = Architect_.getSummonDurations({ summon, sheet });
    const firstAvailableSummonCastIndex = durationMultiplicity ?
      summonDurations.findIndex((duration) => !duration) :
      0;
    const durationRanges = [duration, durationMultiplicity];
    const currentHealthRanges = [currentHealth, currentHealthMultiplicity];
    const evocationMasterySummonNames = [summon, `${summon} Multiplicity`];
    const durationValue = (Math.max(Generic_.getNamedRange('WIS_Modifier').value || 0, 0) + 2) *
      (1 + doubleDuration);
    const maxHealthValue = Generic_.getValue(maxHealth, sheet);
    const evocationMasteryListData = Generic_.getNamedRange('Evocation_Mastery_List');
    const trackerData = Object.keys(abilityData).reduce((total, spellName) => {
      const summonTrackerState = Architect_.getSummonTrackerState({
        summon,
        summonsData,
        spellName
      }).map((state) => ({ ...state, value: false }));
      return summonTrackerState.length
        ? [...total, summonTrackerState]
        : total;
    }, []);
    let evocationMasteryList = (evocationMasteryListData.value || '').split(', ');

    const summonsAffected = [];
    if (
      firstAvailableSummonCastIndex === -1
        || firstAvailableSummonCastIndex === 0
    ) summonsAffected.push(0);
    if (
      firstAvailableSummonCastIndex === -1
        || firstAvailableSummonCastIndex === 1
    ) summonsAffected.push(1);
    const historyChanges = summonsAffected.map((summonIndex) => {
      const targetSummon = evocationMasterySummonNames[summonIndex];
      evocationMasteryList = evocationMasteryList.filter((summon) => targetSummon !== summon);
      return [
        { sheet, range: durationRanges[summonIndex], value: durationValue },
        { sheet, range: currentHealthRanges[summonIndex], value: maxHealthValue },
        ...trackerData.map((data) => data[summonIndex])
      ];
    }).flat();
    return trackHistory([
      ...historyChanges,
      {
        ...evocationMasteryListData,
        value: evocationMasteryList.join(', ')
      }
    ]);
  },
  resetApparitionalHostsCheck: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Apparitional_Hosts_Check'),
    value: true
  }),
  gainACFromGraniteSmash: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Stone_Golem_Granite_Smash_AC'),
    value: 2,
    relative: true
  }),
  resetACFromGraniteSmash: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Stone_Golem_Granite_Smash_AC'),
    value: 0
  }),
  reduceArcaneSurgeStacks: ({ trackHistory }) => trackHistory({
    ...Architect().getArcaneSurgeStacks(),
    value: -1,
    relative: true,
    min: 0
  }),
  resetArcaneSurgeStacks: ({ trackHistory }) => trackHistory({
    ...Architect().getArcaneSurgeStacks(),
    value: 0
  }),
  resetEvocationMasteryList: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Evocation_Mastery_List'),
    value: ''
  }),
  ephemeralMark: ({ spellName, sheet, mainEffect, mobile }) => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Ephemeral Mark', 'Passives')) return true;
    const {
      value: ephemeralMarkDamage
    } = Generic_.getNamedRange('Ephemeral_Mark_Damage');
    if (!ephemeralMarkDamage) return true;
    if (
      !['Glaive Saber', 'Phase Blade', 'Ethereal Slash', 'Phase Edge'].includes(spellName) && !(
        sheet === 'Bonus Actions' && Parse().getValue(sheet, spellName, 'requires') === 'Phase Blade'
      )
    ) return true;

    const consumeMark = IO().askForYesOrNo({
      title: 'Ephemeral Mark',
      message: `Does your target have an Ephemeral Mark that you want to consume for ${
        ephemeralMarkDamage
      } extra Psychic damage, teleporting yourself next to them?`,
      mobile
    });
    if (consumeMark === undefined) return;
    return {
      ...(consumeMark && {
        mainEffect: `${mainEffect} + ${ephemeralMarkDamage} Psychic`
      })
    };
  },
  illusoryMarks: ({ spellName, attack, targetsHit, mainEffect, mobile }) => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Arcane and Illusory Marks', 'Passives')) return true;
    if (attack > 1) {
      if (typeof mainEffect !== 'object') return true;
      return {
        mainEffect: mainEffect[0]
          .effect
          .split(' + ')
          .slice(0, -1)
          .join(' + ')
      };
    }
    const { value: illusoryMarkDamage } = Generic_.getNamedRange('Illusory_Mark_Damage');
    if (!illusoryMarkDamage) return true;
    if (
      ['Glaive Saber', 'Ethereal Slash', 'Mindmeld Dome', 'Solarflare'].some((ability) => {
        return spellName.includes(ability);
      })
    ) return true;
    if (
      !['Scepter', 'Arcane Discharge', 'Anima Explosion'].includes(spellName) &&
        Parse().getValue('Actions', spellName, 'requires') !== 'Glaive Saber'
    ) return true;

    const IO_ = IO();
    const notificationArguments = {
      type: 'inputBox',
      title: `Illusory Mark${targetsHit > 1 ? 's consumed' : ''}`,
      message: `${
        targetsHit > 1 ?
          `How many of these ${targetsHit} targets have Illusory Marks`
          : `Does your target have an Illusory Mark`
      } that you want to consume for ${illusoryMarkDamage} extra Psychic damage?`,
      mobile,
      isMobileAnswerInputType: true
    };
    let marksConsumed;
    if (targetsHit > 1) {
      marksConsumed = IO_.notify(notificationArguments);
      if (isNaN(marksConsumed)) return;
    } else {
      marksConsumed = IO_.askForYesOrNo(notificationArguments);
      if (marksConsumed === undefined) return;
      marksConsumed = marksConsumed ? 1 : 0;
    }
    const targetsLeft = (targetsHit || 1) - marksConsumed;
    if (targetsLeft < 0) {
      return IO_.notify({
        message: `You can consume up to ${
          targetsHit
        } Illusory Mark${targetsHit > 1 ? 's' : ''}.`,
        mobile
      });
    }

    const effects = [];
    if (marksConsumed > 0) {
      effects.push({
        effect: `${mainEffect} + ${illusoryMarkDamage} Psychic`,
        targets: targetsHit ? marksConsumed : 0
      });
    }
    if (targetsLeft) {
      effects.push({
        effect: mainEffect,
        targets: targetsHit ? targetsLeft : 0
      });
    }
    return { mainEffect: effects };
  },
  phantasmalOnslaught: ({ spellName, mobile, trackHistory }) => {
    const Generic_ = Generic();
    if (
      Math.random() < 0.5 ||
        !Generic_.doesValueExist('Phantasmal Onslaught', 'Passives') ||
        !Parse().getValue('Bonus Actions', spellName, 'slotType')
    ) return true;
    IO().notify({
      message: 'Your Action Cost was refunded thanks to Phantasmal Onslaught.',
      mobile
    });
    return trackHistory({
      ...Generic_.getNamedRange('Bonus_Action'),
      value: true
    });
  },
  chainCast: ({ spellName, slot, memory, mobile, trackHistory }) => {
    if ((memory.stopChaining === spellName)) return true;
    const selectedSpell = Architect().selectAvailableSlotSpell({ spellName, slot, mobile });
    if (!selectedSpell) return;
    if (selectedSpell === true) return true;

    const { command, type } = selectedSpell;
    const customConfig = {
      [type]: () => ({
        [command]: () => ({
          skipActionCost: true,
          apply: false,
          hookMemory: memory,
          trackHistory
        })
      })
    };
    Controller().useCommand({
      command,
      type,
      selectedClass: 'Architect',
      customConfig,
      mobile
    });
    return true;
  },
  checkForArcaneResurgence: ({ spellName, sheet, mobile, trackHistory }) => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Arcane Resurgence', 'Passives')) return true;
    const Architect_ = Architect();
    if (spellName === 'Spellblade Thrust') {
      return {
        memory: Architect_.gainSpellSlot({
          spellName,
          sheet,
          excludeLevel2: true,
          excludeLevel3: true,
          excludeLevel4: true,
          mobile,
          trackHistory
        })
      };
    }
    if (Math.random() < 0.5) return true;
    const {
      slotType = '0',
      requires
    } = Parse().getValueData(sheet, spellName, ['slotType', 'requires']);
    if (requires !== 'Phase Blade') return true;
    const slot = parseInt((slotType)[0]);
    const { value: level = 1 } = Generic_.getNamedRange('Level');
    if (
      (!slot || slot === 2 && level < 12)
        || (slot === 3 && level < 16)
        || slot === 4
    ) return true;
    IO().notify({
      message: 'Your Slot Cost was refunded thanks to Arcane Resurgence.',
      mobile
    });
    return {
      memory: Architect_.gainSpellSlot({
        spellName,
        sheet,
        excludeLevel1: slot !== 1,
        excludeLevel2: slot !== 2,
        excludeLevel3: slot !== 3,
        excludeLevel4: true,
        mobile,
        trackHistory
      })
    };
  },
  checkForEcho: ({ spellName, sheet, memory, mobile, trackHistory }) => {
    const activeEchoes = Architect().getActiveSummons()
      .filter((summon) => summon.includes('Echo'))
      .length;
    if (!activeEchoes) return true;
    if (
      ['Summon', 'Arcane Surge', 'Phantasmal Legion', 'Warpblade']
        .some((ability) => spellName.includes(ability))
    ) return true;
    const {
      slotType,
      requires
    } = Parse().getValueData(sheet, spellName, ['slotType', 'requires']);
    if (slotType === undefined && requires === undefined) return true;
    const { spellsEchoed = [] } = memory;
    if (spellsEchoed.includes(spellName)) return true;

    const Convert_ = Convert(), IO_ = IO();
    for (let echoNumber = 0; echoNumber < activeEchoes; echoNumber++) {
      const startMessage = activeEchoes > 1
        ? `(${echoNumber + 1} / ${activeEchoes}) `
        : '';
      const copySpell = IO_.askForYesOrNo({
        title: `Echo ${spellName}`,
        message: `${startMessage}Do you want your Echo ${
          echoNumber ? 'Multiplicity ' : ''
        }summon to copy your ${spellName} at half the throughput?`,
        mobile
      });
      if (copySpell === undefined) return;
      if (!copySpell) return true;
      Object.assign(
        memory,
        {
          spellsEchoed: [...spellsEchoed, spellName],
          stopChaining: spellName
        }
      );
      const type = Convert_.toCamelCase(sheet);
      const customConfig = {
        [type]: () => ({
          [spellName]: () => ({
            skipCosts: true,
            skipActionCost: true,
            apply: false,
            multiplier: 0.5,
            hookMemory: memory,
            trackHistory
          })
        })
      }
      Controller().useCommand({
        command: spellName,
        type,
        selectedClass: 'Architect',
        customConfig,
        mobile
      });
    }
    delete memory.stopChaining;
    return { memory };
  },
  useFourthLevelSpell: ({ spellName, mobile, trackHistory }) => {
    const Generic_ = Generic();
    const rechargeData = Generic_.getNamedRange('Level_4_Recharge');
    const { value: recharge } = rechargeData;
    if (recharge) {
      return IO().notify({
        message: `${spellName} has not fully recharged yet, it requires ${
          Math.ceil(recharge / 2)
        }x Long Rests or ${recharge}x Short Rests`,
        mobile
      });
    }
    const [
      maxHealthMultiplierData,
      currentHealthData
    ] = Generic_.getNamedRange(['Max_Health_Multiplier', 'HP']);
    return trackHistory([
      { ...rechargeData, value: 6 },
      { ...maxHealthMultiplierData, value: maxHealthMultiplierData.value / 2 },
      { ...currentHealthData, max: () => Generic_.getNamedRange('Max_HP').value }
    ]);
  },
  reduceFourthLevelRecharge: ({ trackHistory }, amount = 1) => trackHistory({
    ...Generic().getNamedRange('Level_4_Recharge'),
    value: -amount,
    relative: true,
    min: 0
  }),
  onKillingBlow: () => {
    if (!Generic().doesValueExist('Arcane Infusion', 'Passives')) return;
    return ({ killingBlows, ...rest }) => {
      if (killingBlows <= 0) return true;
      return {
        memory: Architect().gainSpellSlot({
          ...rest,
          fromArcaneInfusion: true
        })
      };
    }
  },
  // Abstract methods
  abstractArchitectSpell: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    options
  }),
  abstractConjuredArsenal: (options = {}) => Helper().abstractUseAbility({
    onUse: ({ mobile, trackHistory }) => {
      const Architect_ = Architect();
      const hand = Architect_.getEmptyHand(mobile);
      if (!hand) return;
      const handData = Generic().getNamedRange(hand);
      const weapon = IO().askForAnswerFromList({
        title: 'Conjured Arsenal',
        message: 'Select a weapon to equip',
        options: Architect_.getWeapons(),
        excludeOptions: handData.value,
        mobile
      });
      if (!weapon) return;
      return trackHistory({ ...handData, value: weapon });
    },
    options
  }),
  abstractEtherealSlash: (options = {}) => {
    const Generic_ = Generic(), Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      aoe: Generic_.doesValueExist('Ethereal Flurry', 'Passives'),
      attackAdvantage: Generic_.doesValueExist('Ethereal Assault', 'Passives'),
      afterHitCalculation: ({ targetsHit, mainEffect, mobile }) => {
        if (!Generic_.doesValueExist('Arcane and Illusory Marks', 'Passives')) return true;
        const { value: arcaneMarkDamage } = Generic_.getNamedRange('Arcane_Mark_Damage');
        if (!arcaneMarkDamage) return true;

        const IO_ = IO();
        const notificationArguments = {
          type: 'inputBox',
          title: `Arcane Mark${targetsHit > 1 ? 's consumed' : ''}`,
          message: `${
            targetsHit > 1
              ? `How many of these ${targetsHit} targets have Arcane Marks`
              : `Does your target have an Arcane Mark`
          } that you want to consume for ${arcaneMarkDamage} extra Psychic damage?`,
          mobile,
          isMobileAnswerInputType: true
        };
        let marksConsumed;
        if (targetsHit > 1) {
          marksConsumed = IO_.notify(notificationArguments);
          if (isNaN(marksConsumed)) return;
        } else {
          marksConsumed = IO_.askForYesOrNo(notificationArguments);
          if (marksConsumed === undefined) return;
          marksConsumed = marksConsumed ? 1 : 0;
        }
        if (marksConsumed > targetsHit) {
          return IO_.notify({
            message: `You can consume up to ${
              targetsHit
            } Arcane Mark${targetsHit > 1 ? 's' : ''}.`,
            mobile
          });
        }

        const effects = [];
        if (marksConsumed > 0) {
          effects.push({
            effect: `${mainEffect} + ${arcaneMarkDamage} Psychic`,
            targets: marksConsumed
          });
        }
        if (targetsHit - marksConsumed) {
          effects.push({
            effect: mainEffect,
            targets: targetsHit - marksConsumed
          });
        }
        return { mainEffect: effects };
      },
      onMainSuccess: (hookArguments) => {
        const { value: level = 1 } = Generic_.getNamedRange('Level');
        return {
          memory: Architect_.gainSpellSlot({
            ...hookArguments,
            excludeLevel2: level < 12,
            excludeLevel3: level < 16,
            excludeLevel4: true,
            repeat: hookArguments.targetsHit - 1
          })
        };
      },
      options
    });
  },
  abstractArcaneDischarge: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    aoe: true,
    onHigherCost: ({ cost, mainEffect, secondaryEffect }) => {
      const [rolls, dice] = secondaryEffect.split('d');
      return { mainEffect: `${(cost - 1) * rolls}d${dice} + ${mainEffect}` };
    },
    beforeHitCalculation: () => ({ secondaryEffect: null }),
    options
  }),
  abstractSummon: (options = {}) => {
    const Generic_ = Generic(), Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onUse: ({ trackHistory, mobile }) => {
        const apparitionalHostsCheckData = Generic_.getNamedRange('Apparitional_Hosts_Check');
        const boundlessInvocation = Generic_.doesValueExist('Boundless Invocation', 'Passives');
        if (!apparitionalHostsCheckData.value && !boundlessInvocation) {
          return IO().notify({
            message: "You've already casted a summoning spell this turn.",
            mobile
          });
        }
        const sheet = 'Summons';
        const summon = options.spellName.replace('Summon ', '');
        const summonsData = Architect_.getSummonsData(sheet);
        if (!boundlessInvocation) {
          trackHistory({ ...apparitionalHostsCheckData, value: false });
        }
        return Architect_.castSummonSpell({
          summon,
          summonsData,
          doubleDuration: options.doubleDuration,
          sheet,
          trackHistory
        });
      },
      options
    });
  },
  abstractSummonAbility: (options = {}) => {
    const  { spellName, summon } = options;
    if (!summon) return;

    const Architect_ = Architect();
    const sheet = 'Summons';
    const summonsData = Architect_.getSummonsData(sheet);
    const abilityData = summonsData?.[summon]?.['Abilities'] || {};
    const summonTrackerState = Architect_.getSummonTrackerState({
      summon,
      summonsData,
      spellName,
      sheet
    });
    const summonDurations = Architect_.getSummonDurations({ summon, sheet });
    let firstAvailableSummonCastIndex = summonTrackerState.findIndex(({ value }, index) => {
      return summonDurations[index] && !value;
    });

    return Helper().abstractUseAbility({
      skipActionCost: true,
      onCheck: ({ mobile, trackHistory }) => {
        const Generic_ = Generic(), IO_ = IO();
        if (summonDurations.every((duration) => !duration)) {
          return IO_.notify({
            message: `You must summon a ${summon} first.`,
            mobile
          });
        }
        if (!summonTrackerState.length) return true;
        if (firstAvailableSummonCastIndex === -1) {
          return IO_.notify({
            message: `You have already used ${spellName}${
              summonTrackerState.length > 1
              ? ` with every available ${summon}`
              : ''
            }.`,
            mobile
          });
        }
        if (!Generic_.doesValueExist('Evocation Mastery', 'Passives')) return true;

        const otherSpellData = Object.entries(abilityData).find(([
          spell,
          { tracker, trackerMultiplicity }
        ]) => {
          if (spell === spellName) return;
          if (firstAvailableSummonCastIndex) return trackerMultiplicity;
          return tracker;
        })[1];
        if (
          !Generic_.getValue(
            otherSpellData[
              firstAvailableSummonCastIndex
                ? 'trackerMultiplicity'
                : 'tracker'
            ],
            sheet
          )
        ) return true;

        const evocationMasteryListData = Generic_.getNamedRange('Evocation_Mastery_List');
        const { value: evocationMasteryList = '' } = evocationMasteryListData;
        let targetSummon = `${summon}${firstAvailableSummonCastIndex ? ' Multiplicity' : ''}`;
        if (evocationMasteryList.split(', ').includes(targetSummon)) {
          const exit = () => IO_.notify({
            message: `You can only cast both abilities of your ${
              summon
            } once, in a single turn, during their lifespan.`,
            mobile
          });
          if (firstAvailableSummonCastIndex) return exit();
          if (!summonDurations[1]) return exit();
          if (Generic_.getValue(abilityData[spellName].trackerMultiplicity, sheet)) {
            return exit();
          }
          const isOtherSpellMultiplicityCast = Generic_.getValue(
            otherSpellData.trackerMultiplicity,
            sheet
          );
          const isMultiplicityIncluded = evocationMasteryList
            .split(', ')
            .includes(`${summon} Multiplicity`);
          if (isOtherSpellMultiplicityCast && isMultiplicityIncluded) {
            return exit();
          }
          firstAvailableSummonCastIndex = 1;
          targetSummon = isOtherSpellMultiplicityCast
            ? `${targetSummon} Multiplicity`
            : '';
        }

        if (targetSummon) {
          trackHistory({
            ...evocationMasteryListData,
            value: evocationMasteryList
              ? `${evocationMasteryList}, ${targetSummon}`
              : targetSummon
          });
        }
        return {zmemory: { summonIndex: firstAvailableSummonCastIndex } };
      },
      onUse: ({ memory, trackHistory }) => {
        const { summonIndex = firstAvailableSummonCastIndex } = memory;
        if (summonIndex === -1) return true;
        return trackHistory({
          ...summonTrackerState[summonIndex],
          value: true
        });
      },
      overwriteObject: abilityData[spellName],
      options
    });
  },
  abstractSacrificialRefurbishment: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      healing: true,
      beforeHitCalculation: ({
        mainEffect,
        secondaryEffect,
        memory,
        mobile,
        trackHistory
      }) => {
        const IO_ = IO();
        const summonsData = Architect_.getSummonsData();
        const activeSummonData = memory.activeSummonData
          || Architect_.getActiveSummons({ summonsData, includeMetadata: true });
        const activeSummons = Object.keys(activeSummonData);
        const excludeOptions = Object.entries(activeSummonData)
          .reduce((total, [summon, { currentHealthData }]) => {
            if (currentHealthData?.value) return total;
            return [...total, summon];
          }, []);
        const availableOptions = activeSummons.filter((summon) => {
          return !excludeOptions.includes(summon);
        });
        if (availableOptions.length <= 1) {
          return IO_.notify({
            message: 'You need to have at least two active summons ' +
              'to use Sacrificial Refurbishment',
            mobile
          });
        }

        const optionModifier = (option) => {
          const {
            level,
            durationData: { value: duration } = {},
            currentHealthData: { value: currentHealth } = {},
            maxHealthData: { value: maxHealth } = {}
          } = activeSummonData[option] || {};
          if (
            level === undefined
              || !duration
              || currentHealth === undefined
              || !maxHealth
          ) return option;
          return `${option}: ${
            level ? `Level ${level}` : 'Cantrip'
          }, ${duration} turn${
            duration > 1 ? 's' : ''
          } left, (${currentHealth} / ${maxHealth})`;
        };
        const summonToSacrifice = IO_.askForAnswerFromList({
          title: 'Sacrificial Refurbishment summon selection',
          message: 'Select which active summon you want to sacrifice to heal another',
          options: activeSummons,
          excludeOptions,
          optionModifier,
          mobile
        });
        if (!summonToSacrifice) return;
        activeSummonData[summonToSacrifice].currentHealthData.value = 0;
        Architect_.resetSpecificSummonDuration({
          summons: summonToSacrifice,
          summonsData,
          trackHistory
        });
        const summonToHeal = availableOptions.length > 2
          ? IO_.askForAnswerFromList({
              title: 'Sacrificial Refurbishment summon selection',
              message: 'Select which active summon you want to heal',
              options: activeSummons,
              excludeOptions: [...excludeOptions, summonToSacrifice],
              optionModifier,
              mobile
            })
          : availableOptions.find((summon) => summon !== summonToSacrifice);
        if (!summonToHeal) return;

        const {
          currentHealthData,
          maxHealthData
        } = activeSummonData[summonToHeal];
        return {
          mainEffect: [
            ...mainEffect.split(', '),
            ...secondaryEffect.split(', ')
          ][activeSummonData[summonToSacrifice].level],
          secondaryEffect: null,
          memory: {
            activeSummonData,
            summonToHeal,
            healHistoryChanges: {
              ...currentHealthData,
              relative: true,
              max: maxHealthData.value
            }
          }
        };
      },
      onSuccess: ({ result, memory, trackHistory }) => {
        trackHistory({ ...memory.healHistoryChanges, value: result });
        const { activeSummonData, summonToHeal } = memory;
        const {
          currentHealthData,
          maxHealthData: { value: maxHealth }
        } = activeSummonData[summonToHeal];
        currentHealthData.value = Math.min(currentHealthData.value + result, maxHealth);
        return { memory };
      },
      ...options
    });
  },
  abstractEphemeralShard: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onKillingBlow: ({ killingBlows, ...rest }) => {
        if (killingBlows <= 0) return true;
        return {
          memory: Architect_.gainSpellSlot({
            ...rest,
            excludeLevel2: true,
            excludeLevel3: true,
            excludeLevel4: true
          })
        };
      },
      options
    });
  },
  abstractAnimaBlast: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onFailMultiplier: 0.5,
      beforeHitCalculation: ({
        mainEffect,
        secondaryEffect,
        memory,
        mobile,
        trackHistory
      }) => {
        const summonsData = Architect_.getSummonsData();
        const activeSummonData = memory.activeSummonData
          || Architect_.getActiveSummons({ summonsData, includeMetadata: true });
        const activeSummons = Object.keys(activeSummonData);
        const excludeOptions = Object.entries(activeSummonData)
          .reduce((total, [summon, { currentHealthData }]) => {
            if (currentHealthData?.value) return total;
            return [...total, summon];
        }, []);
        const availableOptions = activeSummons.filter((summon) => {
          return !excludeOptions.includes(summon);
        });
        if (!availableOptions.length) {
          return { secondaryEffect: null };
        }

        const IO_ = IO();
        let selectedSummons = [];
        const allKeyword = 'All', haltKeyword = 'Done spending health';
        const newLine = IO_.getNewLineChar(mobile);
        for (let iteration = 0; iteration < availableOptions.length; iteration++) {
          const selectedSummon = IO_.askForAnswerFromList({
            title: 'Anima Blast summon selection',
            message: 'Select which of your active summons ' +
              'you want to spend health in order to deal extra damage.',
            options: [allKeyword, haltKeyword, ...activeSummons],
            excludeOptions: [...excludeOptions, ...selectedSummons],
            optionModifier: (option) => {
              if (option === haltKeyword) return `${option}${newLine}`;
              const {
                currentHealthData: { value: currentHealth } = {},
                maxHealthData: { value: maxHealth } = {}
              } = activeSummonData[option] || {};
              if (currentHealth === undefined || !maxHealth) return option;

              if (!currentHealth) return `${option}: (0 / ${maxHealth})`;
              const healthSpent = Math.ceil(maxHealth / 4);
              const newHealth = currentHealth - healthSpent;
              return `${option}: (${currentHealth}${newHealth <= 0 ? ` / ${maxHealth}` : ''} => ${
                newHealth <= 0 ? 'Dead' : `${newHealth} / ${maxHealth}`
              }) [-${healthSpent}]`;
            },
            mobile
          });
          if (!selectedSummon) return;
          if (selectedSummon === haltKeyword) break;
          if (selectedSummon === allKeyword) {
            selectedSummons = availableOptions;
            break;
          }
          selectedSummons.push(selectedSummon);
        }

        if (!selectedSummons.length) return { secondaryEffect: null };
        const dyingSummons = [];
        trackHistory(
          selectedSummons.map((summon) => {
            const {
              currentHealthData,
              maxHealthData: { value: maxHealth } = {}
            } = activeSummonData[summon];
            if (currentHealthData?.value === undefined || !maxHealth) {
              return {};
            }
            const healthCost = Math.ceil(maxHealth / 4);
            const newHealth = currentHealthData.value - healthCost;
            if (newHealth <= 0) dyingSummons.push(summon);
            currentHealthData.value = Math.max(newHealth, 0);
            return {
              ...currentHealthData,
              value: -healthCost,
              relative: true,
              min: 0
            };
          })
        );
        Architect_.resetSpecificSummonDuration({
          summons: [...excludeOptions, ...dyingSummons],
          summonsData,
          trackHistory
        });
        const [rolls, diceData] = secondaryEffect.split('d');
        const [dice, damageType] = diceData.split(' ');
        return {
          mainEffect: `${mainEffect} + ${
            selectedSummons.length * rolls
          }d${dice} ${damageType}`,
          secondaryEffect: null,
          memory: { activeSummonData }
        };
      },
      ...options
    });
  },
  abstractDimensionalRift: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    onHigherCost: ({ cost }) => ({ aoe: true, targetCap: cost - 1 }),
    ...options
  }),
  abstractAetherSlice: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    beforeHitCalculation: ({ mobile }) => {
      const hasStacks = IO().askForYesOrNo({
        title: 'Aether Slice',
        message: 'Does your target have any stacks of Phase Edge?',
        mobile
      });
      if (hasStacks === undefined) return;
      return { ...(hasStacks && { hit: null }) };
    },
    options
  }),
  abstractAnimaExplosion: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      aoe: true,
      beforeHitCalculation: ({
        mainEffect,
        secondaryEffect,
        memory,
        mobile,
        trackHistory
      }) => {
        const IO_ = IO();
        const summonsData = Architect_.getSummonsData();
        const activeSummonData = memory.activeSummonData
          || Architect_.getActiveSummons({ summonsData, includeMetadata: true });
        const activeSummons = Object.keys(activeSummonData);
        const excludeOptions = Object.entries(activeSummonData)
          .reduce((total, [summon, { currentHealthData }]) => {
            if (currentHealthData?.value) return total;
            return [...total, summon];
        }, []);
        const availableOptions = activeSummons.filter((summon) => {
          return !excludeOptions.includes(summon);
        });
        if (!availableOptions.length) {
          return IO_.notify({
            message: 'You need to have an active summon to use Anima Explosion',
            mobile
          });
        }

        const summonToSacrifice = availableOptions.length > 1
          ? IO_.askForAnswerFromList({
              title: 'Anima Explosion summon selection',
              message: 'Select which active summon you want to sacrifice to deal damage around it',
              options: activeSummons,
              excludeOptions,
              optionModifier: (option) => {
                const {
                  level,
                  durationData: { value: duration } = {},
                  currentHealthData: { value: currentHealth } = {},
                  maxHealthData: { value: maxHealth } = {}
                } = activeSummonData[option] || {};
                if (
                  level === undefined
                    || !duration
                    || currentHealth === undefined
                    || !maxHealth
                ) return option;
                return `${option}: ${level ? `Level ${level}` : 'Cantrip'}, ${
                  duration
                } turn${duration > 1 ? 's' : ''} left, (${currentHealth} / ${maxHealth})`;
              },
              mobile
            })
          : availableOptions[0];
        if (!summonToSacrifice) return;
        activeSummonData[summonToSacrifice].currentHealthData.value = 0;
        Architect_.resetSpecificSummonDuration({
          summons: summonToSacrifice,
          summonsData,
          trackHistory
        });
        return {
          mainEffect: [
            ...mainEffect.split(', '),
            ...secondaryEffect.split(', ')
          ][activeSummonData[summonToSacrifice].level],
          secondaryEffect: null,
          memory: { activeSummonData }
        };
      },
      options
    });
  },
  abstractArcaneSurge: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onHigherCost: ({ cost, memory }) => ({ memory: { ...memory, cost } }),
      onUse: ({ memory: { cost }, trackHistory }) => {
        return trackHistory({
          ...Architect_.getArcaneSurgeStacks(),
          value: 2 + (cost ? (cost - 2) : 0)
        });
      },
      options
    });
  },
  abstractTetheringSlamTrigger: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    beforeHitCalculation: ({ secondaryEffect }) => {
      return {
        mainEffect: secondaryEffect,
        secondaryEffect: null
      };
    },
    options
  }),
  abstractQuintessenceOfArcana: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    attacks: 6,
    beforeHitCalculation: ({ hit, attack }) => {
      const savingThrowTypes = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
      return { hit: `${hit.split(' ')[0]} ${savingThrowTypes[attack - 1]}` };
    },
    afterHitCalculation: ({ mainEffect, attack }) => {
      const damageTypes = ['Cold', 'Fire', 'Necrotic', 'Radiant', 'Lightning', 'Psychic'];
      return { mainEffect: `${mainEffect.split(' ')[0]} ${damageTypes[attack - 1]}` };
    },
    options
  }),
  abstractPhaseBurst: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    skipSecondaryEffect: true,
    afterHitCalculation: ({ secondaryEffect, mobile }) => {
      const hasStacks = IO().askForYesOrNo({
        title: 'Phase Burst',
        message: 'Does your target have 5 stacks of Phase Edge?',
        mobile
      });
      if (hasStacks === undefined) return;
      return { ...(hasStacks && { mainEffect: secondaryEffect }) };
    },
    options
  }),
  abstractEssenceStrike: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onSuccess: (hookArguments) => {
        if (!Generic().doesValueExist('Ephemeral Mark', 'Passives')) return true;
        const hasMark = IO().askForYesOrNo({
          title: 'Essence Strike',
          message: 'Was an Ephemeral Mark consumed?',
          mobile: hookArguments.mobile
        });
        if (hasMark === undefined) return;
        if (!hasMark) return true;
        return {
          memory: Architect_.gainSpellSlot({
            ...hookArguments,
            excludeLevel3: true,
            excludeLevel4: true
          })
        };
      },
      options
    });
  },
  abstractPhantasmalLegion: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onUse: ({ spellName, mobile, trackHistory }) => {
        if (!Architect_.useFourthLevelSpell({ spellName, mobile, trackHistory })) return;
        Object.keys(Architect_.getSummonsData()).forEach((summon) => {
          const command = `Summon ${summon}`;
          const customConfig = {
            actions: () => ({
              [command]: () => ({
                doubleDuration: true,
                skipCosts: true,
                skipActionCost: true,
                apply: false,
                trackHistory
              })
            })
          };
          Controller().useCommand({
            command,
            type: 'actions',
            selectedClass: 'Architect',
            customConfig,
            mobile
          });
        });
        return true;
      },
      options
    });
  },
  abstractSolarflare: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onUse: Architect_.useFourthLevelSpell,
      beforeHitCalculation: ({ mainEffect, secondaryEffect, mobile }) => {
        const IO_ = IO();
        const targets = [];
        for (let radius of [100, 300, 600]) {
          const hit = IO_.notify({
            type: 'inputBox',
            title: 'Solarflare targets',
            message: `How many targets are within ${
              radius
            } feet of the center of the effect?`,
            mobile,
            isMobileAnswerInputType: true
          });
          if (isNaN(hit)) return;
          targets.push(parseInt(hit));
        }
        const [effect300, effect600] = secondaryEffect.split(', ');
        return {
          mainEffect: { effect: mainEffect, targets: targets[0] },
          secondaryEffect: [
            { effect: effect300, targets: targets[1] },
            { effect: effect600, targets: targets[2] }
          ]
        };
      },
      options
    });
  },
  abstractWarpblade: (options = {}) => {
    const Architect_ = Architect();
    return Helper().abstractUseAbility({
      ...Architect_.getArchitectCustomRequiredArguments(options),
      onUse: Architect_.useFourthLevelSpell,
      onSuccess: ({ mobile, trackHistory }) => {
        const options = ['Main-hand', 'Off-hand'];
        const handData = Generic().getNamedRange(
          options.map((hand) => hand.replace('-', '_'))
        );
        const emptyHands = handData.reduce((total, { value }) => {
          if (value !== '-') return total;
          return [...total, value];
        }, []);
        const handSelected = !emptyHands.length
          ? IO().askForAnswerFromList({
              title: 'Warpblade hand',
              message: 'Select a hand to equip your Warpblade',
              options,
              optionModifier: (option) => {
                return `${option}: ${
                  handData[option === 'Main-hand' ? 0 : 1].value
                }`;
              },
              mobile
            })
          : emptyHands[0];
        if (!handSelected) return;
        return trackHistory({
          ...handData[handSelected === 'Main-hand' ? 0 : 1],
          value: 'Warpblade'
        });
      },
      options
    });
  },
  abstractWarpbladeTick: (options = {}) => Helper().abstractUseAbility({
    ...Architect().getArchitectCustomRequiredArguments(options),
    skipActionCost: true,
    beforeHitCalculation: ({ mainEffect, secondaryEffect, mobile }) => {
      const IO_ = IO();
      if (
        !Generic().getNamedRange(['Main_hand', 'Off_hand'])
          .find(({ value }) => value === 'Warpblade')
      ) {
        return IO_.notify({
          message: 'You need to equip your Warpblade first',
          mobile
        });
      }

      const options = ['Gargantuan', 'Huge', 'Large', 'Medium', 'Small', 'Tiny'];
      const effects = [...mainEffect.split(', '), ...secondaryEffect.split(', ')];
      const config = options.reduce((total, size, index) => {
        return { ...total, [size]: effects[index] };
      }, {});
      const targetSize = IO_.askForAnswerFromList({
        title: 'Warpblade Tick target size',
        message: 'Which of the following sizes is the size of your target?',
        options,
        optionModifier: (option) => {
          const diceData = config[option];
          return `${option}: ${diceData ? diceData : 'Instant death'}`
        },
        mobile
      });
      if (!targetSize) return;
      return {
        mainEffect: config[targetSize] || 'Kill',
        secondaryEffect: null
      };
    },
    options
  }),
  // Config
  getButtonConfig: () => {
    const Architect_ = Architect();
    return {
      attributes: () => ({
        'Start Turn': () => ({
          onUse: [
            Architect_.reduceAllSummonDuration,
            Architect_.resetACFromGraniteSmash
          ]
        }),
        'End Turn': () => ({
          onUse: [
            ({ trackHistory }) => Architect_.resetAllSummonActions({
              includeBonusActions: false,
              trackHistory
            }),
            Architect_.resetApparitionalHostsCheck,
            Architect_.resetArcaneSurgeStacks
          ]
        }),
        'Short Rest': () => ({
          onUse: [
            Architect_.restoreAllSpellSlots,
            Architect_.resetAllSummonActions,
            Architect_.resetAllSummonDuration,
            Architect_.resetApparitionalHostsCheck,
            Architect_.resetACFromGraniteSmash,
            Architect_.resetArcaneSurgeStacks,
            Architect_.resetEvocationMasteryList,
            Architect_.reduceFourthLevelRecharge
          ]
        }),
        'Long Rest': () => ({
          onUse: [
            Architect_.resetWeapons,
            Architect_.restoreAllSpellSlots,
            Architect_.resetAllSummonActions,
            Architect_.resetAllSummonDuration,
            Architect_.resetApparitionalHostsCheck,
            Architect_.resetACFromGraniteSmash,
            Architect_.resetArcaneSurgeStacks,
            Architect_.resetEvocationMasteryList,
            ({ trackHistory }) => Architect_.reduceFourthLevelRecharge({ trackHistory }, 2)
          ]
        })
      }),
      actions: () => ({
        defaultArguments: {
          onUse: [Architect_.checkForArcaneResurgence, Architect_.checkForEcho],
          afterHitCalculation: [Architect_.ephemeralMark, Architect_.illusoryMarks],
          onKillingBlow: Architect_.onKillingBlow()
        },
        defaultCallback: Architect_.abstractArchitectSpell,
        'Spectral Servant': () => ({}),
        'Temporal Anomaly': () => ({}),
        'Glaive Saber': () => ({}),
        'Phase Blade': () => ({}),
        'Scepter': () => ({}),
        'Ethereal Slash': () => ({ callback: Architect_.abstractEtherealSlash }),
        'Phase Edge': () => ({}),
        'Summon Fairy': () => ({ callback: Architect_.abstractSummon }),
        'Ethereal Shift': () => ({}),
        'Sacrificial Refurbishment': () => ({
          callback: Architect_.abstractSacrificialRefurbishment
        }),
        'Arcane Discharge': () => ({ callback: Architect_.abstractArcaneDischarge }),
        'Ephemeral Shard': () => ({ callback: Architect_.abstractEphemeralShard }),
        'Astral Spike': () => ({}),
        'Ghostly Spear': () => ({ aoe: true }),
        'Enchanted Daggers': () => ({
          attacks: Architect_.getLevelIncrement({ start: 3, increment: 2 }),
          stopOnAttackFail: true
        }),
        'Anima Blast': () => ({ callback: Architect_.abstractAnimaBlast }),
        'Celestial Barrage': () => ({
          aoe: true,
          attacks: Architect_.getLevelIncrement({ start: 2 })
        }),
        'Summon Stone Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Ice Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Moss Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Water Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Lava Golem': () => ({ callback: Architect_.abstractSummon }),
        'Dimensional Rift': () => ({ callback: Architect_.abstractDimensionalRift }),
        'Anima Explosion': () => ({ callback: Architect_.abstractAnimaExplosion }),
        'Mind Spike': () => ({ onFailMultiplier: 0.5 }),
        'Phantom Barrage': () => ({ attacks: 3, stopOnAttackFail: true }),
        'Spectral Grasp': () => ({ onFailMultiplier: 1, aoe: true }),
        'Force Nova': () => ({ onFailMultiplier: 1, aoe: true }),
        'Astral Barricade': () => ({ aoe: true }),
        'Celestial Monolith': () => ({ onFailMultiplier: 0.5 }),
        'Mindmeld Dome': () => ({ delayedEffect: true }),
        'Mindmeld Dome Tick': () => ({ skipActionCost: true, aoe: true }),
        'Spectral Lunge': () => ({ aoe: true }),
        'Arcane Surge': () => ({ callback: Architect_.abstractArcaneSurge }),
        'Summon Sphynx': () => ({ callback: Architect_.abstractSummon }),
        'Summon Giant': () => ({ callback: Architect_.abstractSummon }),
        'Summon Flame Revenant': () => ({ callback: Architect_.abstractSummon }),
        'Summon Windlord': () => ({ callback: Architect_.abstractSummon }),
        'Summon Dryad': () => ({ callback: Architect_.abstractSummon }),
        'Spatial Displacement': () => ({ aoe: true }),
        'Cosmic Cascade': () => ({ aoe: true, onFailMultiplier: 0.5 }),
        'Celestial Blaze': () => ({ aoe: true, onFailMultiplier: 0.5 }),
        'Ephemeral Warping': () => ({ aoe: true, onFailMultiplier: 0.5 }),
        'Titanic Palm': () => ({ aoe: true, onFailMultiplier: 0.5 }),
        'Enchanted Cage': () => ({ aoe: true, onFailMultiplier: 0.5 }),
        'Quintessence of Arcana': () => ({ callback: Architect_.abstractQuintessenceOfArcana }),
        'Summon Djin': () => ({ callback: Architect_.abstractSummon }),
        'Summon Wurm': () => ({ callback: Architect_.abstractSummon }),
        'Summon Archangel': () => ({ callback: Architect_.abstractSummon }),
        'Summon Echo': () => ({ callback: Architect_.abstractSummon }),
        'Solarflare': () => ({ callback: Architect_.abstractSolarflare }),
        'Warpblade': () => ({ callback: Architect_.abstractWarpblade }),
        'Warpblade Tick': () => ({ callback: Architect_.abstractWarpbladeTick }),
        'Phantasmal Legion': () => ({ callback: Architect_.abstractPhantasmalLegion })
      }),
      bonusActions: () => ({
        defaultArguments: {
          onUse: [
            Architect_.checkForArcaneResurgence,
            Architect_.checkForEcho,
            Architect_.phantasmalOnslaught
          ],
          afterHitCalculation: Architect_.ephemeralMark,
          onKillingBlow: Architect_.onKillingBlow()
        },
        defaultCallback: Architect_.abstractArchitectSpell,
        'Conjured Arsenal': () => ({ callback: Architect_.abstractConjuredArsenal }),
        'Aether Slice': () => ({ callback: Architect_.abstractAetherSlice }),
        'Astral Crippling': () => ({}),
        'Siphoning Blow': () => ({ temporaryMainEffectModifier: 1 }),
        'Spellblade Thrust': () => ({}),
        'Ghastly Shatter': () => ({}),
        'Mirrored Bash': () => ({ attacks: 2 }),
        'Phasma Blitz': () => ({ onSuccess: Architect_.chainCast }),
        'Summon Fairy': () => ({ callback: Architect_.abstractSummon }),
        'Summon Stone Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Ice Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Moss Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Water Golem': () => ({ callback: Architect_.abstractSummon }),
        'Summon Lava Golem': () => ({ callback: Architect_.abstractSummon }),
        'Phantasmal Rend': () => ({}),
        'Tethering Slam': () => ({}),
        'Tethering Slam Trigger': () => ({
          callback: Architect_.abstractTetheringSlamTrigger,
          skipActionCost: true
        }),
        'Exposing Slash': () => ({}), 
        'Plasmic Charge': () => ({}),
        'Phasma Assault': () => ({
          onSuccess: (hookArguments) => Architect_.chainCast({ slot: 1, ...hookArguments })
        }),
        'Summon Sphynx': () => ({ callback: Architect_.abstractSummon }),
        'Summon Giant': () => ({ callback: Architect_.abstractSummon }),
        'Summon Flame Revenant': () => ({ callback: Architect_.abstractSummon }),
        'Summon Windlord': () => ({ callback: Architect_.abstractSummon }),
        'Summon Dryad': () => ({ callback: Architect_.abstractSummon }),
        'Ethereal Slash': () => ({ callback: Architect_.abstractEtherealSlash }),
        'Neural Rupture': () => ({}),
        'Void Blade': () => ({}),
        'Phase Burst': () => ({ callback: Architect_.abstractPhaseBurst }),
        'Essence Strike': () => ({ callback: Architect_.abstractEssenceStrike }),
        'Phasma Onslaught': () => ({
          onSuccess: (hookArguments) => Architect_.chainCast({ slot: 2, ...hookArguments })
        }),
        'Summon Djin': () => ({ callback: Architect_.abstractSummon }),
        'Summon Wurm': () => ({ callback: Architect_.abstractSummon }),
        'Summon Archangel': () => ({ callback: Architect_.abstractSummon }),
        'Summon Echo': () => ({ callback: Architect_.abstractSummon })
      }),
      summons: () => ({
        defaultArguments: { onKillingBlow: Architect_.onKillingBlow() },
        defaultCallback: Architect_.abstractSummonAbility,
        'Fey Bolt': () => ({ summon: 'Fairy' }),
        "Sprite's Blessing": () => ({ summon: 'Fairy' }),
        'Granite Smash': () => ({
          summon: 'Stone Golem',
          onUse: Architect_.gainACFromGraniteSmash
        }),
        'Bedrock Blast': () => ({ summon: 'Stone Golem' }),
        'Frigid Punch': () => ({ summon: 'Ice Golem' }),
        'Avalanche': () => ({ summon: 'Ice Golem', aoe: true }),
        'Bog Sweep': () => ({
          summon: 'Moss Golem',
          healingSecondary: true,
          stopOnHitFail: true
        }),
        'Fungal Fog': () => ({ summon: 'Moss Golem', aoe: true }),
        'Thistle Ward': () => ({ summon: 'Moss Golem' }),
        'Riptide': () => ({ summon: 'Water Golem' }),
        'Torrent': () => ({ summon: 'Water Golem', healing: true }),
        'Flame Cannon': () => ({ summon: 'Lava Golem', aoe: true }),
        'Implode': () => ({ summon: 'Lava Golem', aoe: true }),
        'Blazing Might': () => ({ summon: 'Lava Golem' }),
        'Divine Smack': () => ({ summon: 'Sphynx' }),
        'Sacred Counsel': () => ({ summon: 'Sphynx' }),
        'Colossal Sweep': () => ({ summon: 'Giant', aoe: true }),
        'Chain Hook': () => ({ summon: 'Giant' }),
        'Pyroclasm': () => ({ summon: 'Flame Revenant', aoe: true }),
        'Infernal Beacons': () => ({ summon: 'Flame Revenant', delayedEffect: true }),
        'Infernal Beacons Trigger': () => ({
          summon: 'Flame Revenant',
          onFailMultiplier: 0.5
        }),
        'Aspect of Fire': () => ({ summon: 'Flame Revenant', aoe: true }),
        'Rushing Gale': () => ({ summon: 'Windlord', aoe: true }),
        'Tempest': () => ({ summon: 'Windlord', aoe: true }),
        'Spirit Touch': () => ({
          summon: 'Dryad',
          aoeSecondary: true,
          healingSecondary: true
        }),
        'Incorporeal Form': () => ({ summon: 'Dryad' }),
        'Smite': () => ({ summon: 'Djin' }),
        'Walz of Fate': () => ({ summon: 'Djin' }),
        'Tectonic Descent': () => ({ summon: 'Wurm', aoe: true }),
        'Unfathomable Maw': () => ({ summon: 'Wurm' }),
        'Seraphic Resonance': () => ({
          summon: 'Archangel',
          aoe: true,
          targetCap: 3,
          mainEffectOutput: 'Damage / Healing done'
        }),
        'Divine Trial': () => ({ summon: 'Archangel' })
      }),
      reactions: () => ({
        defaultArguments: {
          onUse: Architect_.checkForArcaneResurgence,
          onKillingBlow: Architect_.onKillingBlow()
        },
        defaultCallback: Architect_.abstractArchitectSpell,
        'Glaive Saber': () => ({}),
        'Phase Blade': () => ({}),
        'Ethereal Slash': () => ({ callback: Architect_.abstractEtherealSlash }),
        'Celestial Reprisal': () => ({}),
        'Cosmic Vengeance': () => ({})
      }),
      interactions: () => ({
        defaultArguments: { onKillingBlow: Architect_.onKillingBlow() }
      }),
      movement: () => ({
        defaultArguments: { onKillingBlow: Architect_.onKillingBlow() }
      }),
      passives: () => ({
        defaultArguments: { onKillingBlow: Architect_.onKillingBlow() },
        'Ephemeral Mark': () => ({}),
        'Arcane and Illusory Marks': () => ({ aoe: true })
      }),
      automation: () => ({
        'Learn Ability': () => ({ onLearn: Architect_.onLearnAbility }),
        'Update Mobile Sheet': () => ({
          customMobileConfig: Architect_.getCustomMobileConfig(),
          customMenuConfig: Architect_.getCustomMenuConfig()
        }),
        'Update Attributes Sheet': () => ({
          cacheArguments: { attributeMetadataConfig: Architect_.getAttributeMetadataConfig() },
          finalizeValuesConfig: [
            { current: 'Slots_1', max: 'Max_Slots_1' },
            { current: 'Slots_2', max: 'Max_Slots_2' },
            { current: 'Slots_3', max: 'Max_Slots_3' },
            { current: 'Slots_4', max: 'Max_Slots_4' }
          ],
          onFormat: Architect_.onAttributesFormat
        }),
        'Update Actions Sheet': () => ({
          beforeFormat: Architect_.beforeActionsFormat,
          onFormat: Architect_.onActionsFormat
        }),
        'Update Bonus Actions Sheet': () => ({
          onFormat: Architect_.addWeaponConditionalFormatting
        }),
        'Update Summons Sheet': () => ({ callback: Architect_.updateSummonsSheet }),
        'Update Reactions Sheet': () => ({
          onFormat: Architect_.addWeaponConditionalFormatting
        }),
        'Generate Cache': () => ({
          customSheetCaching: [{ name: 'Summons', callback: Architect_.cacheSummonData }],
          attributeMetadataConfig: Architect_.getAttributeMetadataConfig()
        }),
        'Level Up': () => ({
          customSheetLevelConfig: Architect_.getCustomSheetLevelConfig(),
          customMenuConfig: Architect_.getCustomMenuConfig(true),
          onLevelUp: Architect_.onLevelUp
        })
      })
    };
  },
  getCacheConfig: () => {
    const tickConfig = [
      { deletions: ['hit', 'mainEffect', 'secondaryEffect'] },
      { version: 'Tick', deletions: ['slotCost', 'slotType', 'requires'] }
    ];
    return {
      actions: {
        'Mindmeld Dome': tickConfig,
        'Warpblade': tickConfig
      },
      bonusActions: {
        'Tethering Slam': [
          { deletions: ['secondaryEffect'] },
          {
            version: 'Trigger',
            deletions: ['slotCost', 'slotType', 'requires', 'hit', 'mainEffect']
          }
        ]
      }
    };
  }
});
