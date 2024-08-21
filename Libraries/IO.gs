var IO = () => ({
  getNewLineChar: (mobile = false) => mobile ? '\n' : '\\n',
  notify: ({
    type = 'toast',
    title,
    message,
    toastTimeout = 12,
    msgBoxButtons = Browser.Buttons.OK,
    mobile = false,
    mobileAnswerList,
    isMobileAnswerInputType
  }) => {
    const Generic_ = Generic();
    const getMobileAnswer = (cell, sheet, { loopLimit = 200, samplingTime = 0.2 } = {}) => {
      let loops = 0;
      let value = Generic_.getValue(cell, sheet);
      while (value === '' && loops < loopLimit) {
        Generic_.wait(samplingTime);
        value = Generic_.getValue(cell, sheet);
        loops++;
      }
      return value;
    };

    if (!mobile) {
      if (type !== 'toast') return Browser[type](title || 'Notification', message, msgBoxButtons);
      return SpreadsheetApp.getActiveSpreadsheet().toast(
        message.replace('\\n', ''),
        title || 'Notification',
        toastTimeout
      );
    }

    let mobileSheet = Generic_.getSheet('Mobile');
    const characterCreationSheet = Generic_.getSheet('Character Creation');
    const mobileMessage = `${title ? `${title}${IO().getNewLineChar(mobile)}` : ''}${message}`;
    if (mobileSheet) Generic_.setValue(`A${mobileSheet.getMaxRows() - 2}`, mobileMessage, mobileSheet);
    if (characterCreationSheet) {
      Generic_.setValue(
        `A${characterCreationSheet.getMaxRows() - 2}`,
        mobileMessage,
        characterCreationSheet
      );
    }
    if (!mobileAnswerList && !isMobileAnswerInputType) return;

    mobileSheet = mobileSheet || characterCreationSheet;
    const lastRow = mobileSheet.getMaxRows();
    const mobileAnswerRow = lastRow - (mobileAnswerList ? 1 : 0);
    const mobileAnswerCell = `A${mobileAnswerRow}`;
    if (mobileAnswerList?.length) {
      mobileSheet.getRange(mobileAnswerCell).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(mobileAnswerList)
          .setAllowInvalid(false)
          .build()
      );
    }
    Generic_.showRows([mobileAnswerRow], mobileSheet);
    mobileSheet.setActiveSelection(mobileAnswerCell);
    const answer = getMobileAnswer(mobileAnswerCell, mobileSheet);
    Generic_.setValue(mobileAnswerCell, '');
    Generic_.hideRows([mobileAnswerRow], mobileSheet);
    if (answer === '') {
      Generic_.setValue(
        `A${lastRow - 2}`,
        'Timeout error, please answer faster next time...',
        mobileSheet
      );
    }
    return answer.toString();
  },
  askForYesOrNo: ({ title, message, mobile = false, loopLimit = 3 }) => {
    const IO_ = IO();
    let loopCount = 0;
    while (loopCount < loopLimit) {
      const answer = IO_.notify({
        type: 'msgBox',
        title: loopCount ? `Please select Yes or No${title ? ` - ${title}` : ''}` : title,
        message,
        msgBoxButtons: Browser.Buttons.YES_NO,
        mobile,
        mobileAnswerList: ['Yes', 'No']
      });
      if (answer.toLowerCase() === 'yes') return true;
      if (answer.toLowerCase() === 'no') return false;
      loopCount++;
    }

    IO_.notify({
      title: 'Error',
      message: "You've reached the maximum wrong inputs. Need to pick either Yes or No next time.",
      mobile
    });
  },
  askForAnswerFromList: ({
    title,
    message,
    options = [],
    excludeOptions,
    hiddenOptions = [],
    optionModifier,
    hideOptions = false,
    mobile = false,
    loopLimit = 3
  }) => {
    const IO_ = IO();
    const newLine = `${IO_.getNewLineChar(mobile)}\u00A0\u00A0`;
    const exclusions = Generic().unwrap(excludeOptions);
    const optionsString = `${!message ? '\u00A0\u00A0' : ''}` + options.map((option, index) => {
      return `(${index + 1}) ${exclusions
        ? (exclusions.includes(option) ? '\u274C ' : '\u2705 ')
        : ''
      }${optionModifier ? optionModifier(option) : option}`;
    }).join(newLine).trim();

    let loopCount = 0;
    while (loopCount < loopLimit) {
      let answer = IO_.notify({
        type: 'inputBox',
        title: loopCount ? `Please pick a valid option${title ? ` - ${title}` : ''}` : title,
        message: `${message ? message : ''}${
          hideOptions
            ? ''
            : `${(message || mobile) ? newLine : ''}${message ? newLine : ''}${optionsString}`
        }`,
        mobile,
        mobileAnswerList: hiddenOptions.length ? undefined : options,
        isMobileAnswerInputType: hiddenOptions.length
      });
      const hiddenOptionIndex = hiddenOptions.findIndex((option) => {
        return option.toString().toLowerCase() === answer.toString().toLowerCase()
      });
      if (hiddenOptionIndex !== -1) return hiddenOptions[hiddenOptionIndex];
      const index = options.findIndex((option) => {
        return option.toString().toLowerCase() === answer.toString().toLowerCase();
      });
      answer = index !== -1 ? options[index] : options[answer - 1];
      if (answer !== undefined && (!exclusions || !exclusions.includes(answer))) {
        return answer.toString();
      }
      loopCount++;
    }

    IO_.notify({
      title: 'Error',
      message: "You've reached the maximum wrong inputs. Need to pick a valid option next time.",
      mobile
    });
  }
});
