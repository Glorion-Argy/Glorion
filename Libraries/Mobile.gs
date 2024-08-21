const _mobilePrivate = () => ({
  mobileCommand: (command, range, sheet, getAllButtonConfigsCallback, spellNameConfig) => {
    if (!command) return;

    const Generic_ = Generic();
    const getMobileData = () => {
      const getCache = () => {
        const variableName = 'Cache';
        const {
          range: cacheRange,
          value: cacheValue
        } = Generic_.getNamedRange(variableName);
        if (cacheRange) return cacheValue;
        return Generic_.getSheet('Variables')
          ?.getDataRange?.()
          ?.getValues?.()
          ?.find(([variable]) => variable === variableName)?.[1] || '{}';
      };

      const mobileData = JSON.parse(getCache() || '{}')?.['Mobile'];
      if (!mobileData) {
        if (command === 'Generate Cache') {
          const index = Generic_.getSheet('Mobile')
            .getDataRange()
            .getValues()
            .findIndex(([attribute]) => attribute === 'Automation');
          if (index === -1) return {};
          return { [`A${index + 2}`]: 'automation' };
        }
        throw 'You need to cache your spreadsheet first, ' +
         'to be able to apply Mobile commands';
      }
      return mobileData;
    };
    const type = getMobileData()[range.getA1Notation()];
    if (!type) return;

    if (spellNameConfig) {
      command = Object.entries(spellNameConfig).find(([_, shownName]) => {
        return command === shownName;
      })?.[0] || command;
    }
    Helper().useCommand(command, type, getAllButtonConfigsCallback(), true);
    if (sheet.getSheetId() === Generic_.getSheet('Mobile')?.getSheetId?.()) {
      range.clearContent();
    }
  },
  characterCreationCommand: (command, range, sheet, createCharacterCallback, resetCallback) => {
    const inputCell = `A${sheet.getMaxRows() - 3}`;
    const crateCharacterOption = 'Create Character (Mobile)';
    const resetOption = 'Reset (Mobile)';
    if (
      range.getA1Notation() !== inputCell
        || ![crateCharacterOption, resetOption].includes(command)
    ) return;
    sheet.getRange(inputCell).setValue('Select a Command (Mobile)');
    if (command === crateCharacterOption) createCharacterCallback({ mobile: true });
    else resetCallback({ mobile: true });
  }
});

var Mobile = () => ({
  useAppropriateDefaultCommand: (
    command,
    range,
    getAllButtonConfigsCallback,
    spellNameConfig,
    createCharacterCallback,
    resetCallback
  ) => {
    const Private = _mobilePrivate();
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    try {
      if (sheetName === 'Mobile') {
        Private.mobileCommand(command, range, sheet, getAllButtonConfigsCallback, spellNameConfig);
      } else if (sheetName === 'Character Creation') {
        Private.characterCreationCommand(command, range, sheet, createCharacterCallback, resetCallback);
      }
    } catch (error) {
      IO().notify({
        message: typeof error === 'object'
          ? error.stack
          : error,
        mobile: true
      });
    }
  }
});
