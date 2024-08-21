const _buttonsPrivate = () => ({
  askForAction: (message, mobile) => IO().askForYesOrNo({ message, mobile }),
  executeHook: (hook, options = {}, memory = {}) => {
    const allOptions = { memory, ...options };
    for (const callback of Array.isArray(hook) ? hook : [hook]) {
      const hookResult = callback(allOptions);
      if (!hookResult) return;
      Object.assign(memory, hookResult?.memory || {});
    }
    return true;
  }
});

var Buttons = () => ({
  HitDice: ({
    ask = false,
    apply = true,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to use a Hit Dice?', mobile)) {
      return changes;
    }
    const Generic_ = Generic(), IO_ = IO();
    const hitDiceData = Generic_.getNamedRange('Hit_Dice');
    if (!hitDiceData.value) {
      return IO_.notify({ message: 'You have no more Hit Dice.', mobile });
    }

    const History_ = History(), Helper_ = Helper();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    trackHistory({ ...hitDiceData, value: -1, relative: true, min: 0 });
    const [
      { value: hitDiceType = 'd6' },
      { value: constitutionModifier = 0 }
    ] = Generic_.getNamedRange(['Hit_Dice_Type', 'CON_Modifier']);
    const diceResultData = RPG().getDiceResult({
      diceData: `${hitDiceType} + ${constitutionModifier}`,
      multiplier: Generic_.getNamedRange('Race').value === 'Troll' ? 1.5 : 1,
      loggerMethod: (result) => Helper_.logRollHistory(`Hit Dice:\n${result}`)
    });
    Helper_.heal({ amount: diceResultData.result, trackHistory });
    if (
      onUse && !Private.executeHook(
        onUse,
        { ...diceResultData, mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    IO_.notify({
      title: 'Hit Dice roll',
      message: `You heal for ${diceResultData.text}.`,
      type: 'msgBox',
      mobile
    });
    return changes;
  },
  Initiative: ({
    ask = false,
    apply = true,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to make an Initiative roll?', mobile)) {
      return changes;
    }

    const History_ = History();
    const diceResultData = RPG().getDiceResult({
      diceData: Generic().getNamedRange('Initiative').value || 'd20',
      loggerMethod: (result) => Helper().logRollHistory(`Initiative:\n${result}`)
    });
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    if (
      onUse && !Private.executeHook(
        onUse,
        { ...diceResultData, mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    IO().notify({
      title: 'Initiative roll',
      message: `The result is ${diceResultData.text}.`,
      type: 'msgBox',
      mobile
    });
    return changes;
  },
  DeathSave: ({
    ask = false,
    apply = true,
    diceData = 'd20',
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Generic_ = Generic(), IO_ = IO();
    const currentHealthData = Generic_.getNamedRange('HP');
    if (currentHealthData.value !== 0) {
      return IO_.notify({
        message: 'You can only make a Death Saving Throw with no health left.',
        mobile
      });
    }
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to make a Death Saving Throw?', mobile)) {
      return changes;
    }

    const History_ = History();
    const diceResultData = RPG().getDiceResult({
      diceData,
      loggerMethod: (result) => Helper().logRollHistory(`Death Save:\n${result}`)
    });
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    if (
      onUse && !Private.executeHook(
        onUse,
        { ...diceResultData, mobile, trackHistory },
        memory
      )
    ) return;

    const [
      { sheet: successSheet, range: successRange },
      { sheet: failureSheet, range: failureRange }
    ] = Generic_.getNamedRange(['Death_Save_Successes', 'Death_Save_Failures']);
    const successValues = Generic_.getSheet(successSheet).getRange(successRange).getValues().flat();
    const currentSuccessPoints = successValues.reduce((total, value) => total + value, 0);
    const failureValues = Generic_.getSheet(failureSheet).getRange(failureRange).getValues().flat();
    const currentFailurePoints = failureValues.reduce((total, value) => total + value, 0);
    const successCells = Generic_.splitRange(successRange);
    const failureCells = Generic_.splitRange(failureRange);

    const { result } = diceResultData;
    let numericalChange;
    if (result === 1) numericalChange = -2;
    else if (result < 10) numericalChange = -1;
    else if (result < 20) numericalChange = 1;
    else numericalChange = 3;

    let title, message;
    const deathSaveChanges = [];
    if (numericalChange > 0) {
      title = 'Successful Death Saving Throw';
      message = `You have rolled ${diceResultData.text}${
        numericalChange === 3 ? ' (Critical)' : ''
      }.`;
      for (let iteration = 0; iteration < numericalChange; iteration++) {
        const index = successValues.findIndex((value) => !value);
        if (index === -1) break;
        successValues[index] = true;
        deathSaveChanges.push({
          sheet: successSheet,
          range: successCells[index],
          value: true
        });
      }
      if (currentSuccessPoints + numericalChange > 2) {
        message += ' Your critical condition has been stabilized!';
        deathSaveChanges.push({ ...currentHealthData, value: 1 });
      } else message += ` You've gained a success point.`;
    } else {
      title = 'Unsuccessful Death Saving Throw';
      numericalChange *= -1;
      message = `You have rolled ${diceResultData.text}${
        numericalChange === 2 ? ' (Critical Fail)' : ''
      }.`;
      for (let iteration = 0; iteration < numericalChange; iteration++) {
        const index = failureValues.findIndex((value) => !value);
        if (index === -1) break;
        failureValues[index] = true;
        deathSaveChanges.push({
          sheet: failureSheet,
          range: failureCells[index],
          value: true
        });
      }
      if (currentFailurePoints + numericalChange > 2) {
        const newLine = IO_.getNewLineChar(mobile);
        message += ` You have died and shall live through the memories of your party.${
          newLine
        }${newLine}May your soul rest in peace!`;
      } else {
        message += ` You've gained ${
          numericalChange === 1 ? 'a failure point' : 'two failure points'
        }.`;
      }
    }

    trackHistory(deathSaveChanges);
    if (apply) History_.applyChanges(changes);
    IO_.notify({ title, message, type: 'msgBox', mobile });
    return changes;
  },
  StartTurn: ({
    ask = false,
    apply = true,
    onUse, memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to Start your Turn?', mobile)) {
      return changes;
    }

    const History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    const { value: currentHealth } = Generic().getNamedRange('HP');
    if (currentHealth === 0) {
      Buttons().DeathSave({ ask: true, apply: false, memory, mobile, trackHistory });
    } else Helper().resetDeathSaves({ trackHistory });
    if (
      onUse && !Private.executeHook(
        onUse,
        { mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    IO().notify({ message: 'Your action to begin your turn was successful.', mobile });
    return changes;
  },
  EndTurn: ({
    ask = false,
    apply = true,
    skipOutput = false,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to End your Turn?', mobile)) {
      return changes;
    }

    const History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    Helper().resetAllActions({ trackHistory });
    if (
      onUse && !Private.executeHook(
        onUse,
        { mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    if (!skipOutput) {
      IO().notify({ message: 'You have ended your turn successfully.', mobile });
    }
    return changes;
  },
  ShortRest: ({
    ask = false,
    apply = true,
    skipOutput = false,
    skipTrackers = [],
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to have a Short Rest?', mobile)) {
      return changes;
    }

    const History_ = History(), Helper_ = Helper();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    Buttons().EndTurn({ apply: false, skipOutput: true, trackHistory });
    Helper_.resetSpellSlots({ trackHistory });
    Helper_.resetDeathSaves({ trackHistory });
    Helper_.resetAllTrackers({ exceptions: skipTrackers, trackHistory });
    if (
      onUse && !Private.executeHook(
        onUse,
        { mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    if (!skipOutput) {
      IO().notify({ message: 'You have successfully finished a Short Rest.', mobile });
    }
    return changes;
  },
  LongRest: ({
    ask = false,
    apply = true,
    skipOutput = false, 
    hitDiceRestored = 0.5,
    skipTrackers = [],
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const Private = _buttonsPrivate();
    if (ask && !Private.askForAction('Do you want to have a Long Rest?', mobile)) {
      return changes;
    }

    const Generic_ = Generic(), History_ = History(), Helper_ = Helper();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    Buttons().ShortRest({ apply: false, skipOutput: true, trackHistory });
    Helper_.heal({ amount: Number.MAX_SAFE_INTEGER, trackHistory });
    const { value: maxHitDice = 0 } = Generic_.getNamedRange('Max_Hit_Dice');
    trackHistory({
      ...Generic_.getNamedRange('Hit_Dice'),
      value: Math.max(Math.floor(maxHitDice * hitDiceRestored), 1),
      relative: true,
      max: maxHitDice
    });
    Helper_.resetSpellSlots({ refreshType: 'Long', trackHistory });
    Helper_.resetAllTrackers({ exceptions: skipTrackers, trackHistory });
    if (
      onUse && !Private.executeHook(
        onUse,
        { mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    if (!skipOutput) {
      IO().notify({ message: 'You have successfully finished a Long Rest.', mobile });
    }
    return changes;
  },
  RollCustomDice: ({
    apply = true,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const IO_ = IO();
    const [
      { value: customRoll },
      { value: advantage = '-' },
      { value: critical }
    ] = Generic().getNamedRange(['Custom_Roll_Input', 'Advantage', 'Critical']);
    if (!customRoll) {
      return IO_.notify({ message: 'Please, fill in "Custom Roll Input".', mobile });
    }

    const History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    const diceResultData = RPG().getMultipleDiceResult({
      diceData: customRoll.toString(),
      advantage: Convert().toAdvantageNumber(advantage),
      critical
    });
    if (
      onUse && !_buttonsPrivate().executeHook(
        onUse,
        { ...diceResultData, mobile, trackHistory },
        memory
      )
    ) return;

    if (apply) History_.applyChanges(changes);
    Helper().logRollHistory(`Custom Dice Roll:\n${diceResultData.text}`);
    IO_.notify({
      title: 'Custom Dice roll',
      message: `The result is ${diceResultData.text}.`,
      type: 'msgBox',
      mobile
    });
    return changes;
  },
  LootItem: ({
    apply = true,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    const answer = IO_.notify({
      title: 'Loot Item',
      message:
        `What's the item(s) you want to loot?${
          newLine
        }${newLine}You can follow these examples:${
          newLine
        }\u00A0\u00A0- Dagger${newLine}\u00A0\u00A0- Arrow: 3${
          newLine
        }\u00A0\u00A0- Hempen Rope: 50ft`,
      type: 'inputBox',
      mobile,
      isMobileAnswerInputType: true
    });
    if (!answer || answer === 'cancel') return;

    if (!trackHistory) {
      trackHistory = (newChanges) => History().trackHistory(changes, newChanges);
    }
    const [itemName, stringCount = ''] = answer.split(':').map((item) => item.trim());
    const numberCount = parseInt(stringCount.replace(/[^0-9]/g, '')) || 1;
    const count = !stringCount.includes('ft') ? numberCount : undefined;
    const feet = !count ? numberCount : undefined;
    const itemData = { itemName, ...(feet ? { feet } : { count }) };
    if (
      onUse && !_buttonsPrivate().executeHook(
        onUse,
        { ...itemData, mobile, trackHistory },
        memory
      )
    ) return;

    return Inventory().lootItem({ ...itemData, apply, mobile, trackHistory, changes });
  },
  RemoveItem: ({
    apply = true,
    onUse,
    memory = {},
    mobile = false,
    trackHistory,
    changes = []
  } = {}) => {
    const IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    const answer = IO_.notify({
      title: 'Remove Item',
      message:
        `What's the item(s) you want to remove from your Inventory?${
          newLine
        }${newLine}You can follow these examples:${
          newLine
        }\u00A0\u00A0- Dagger${newLine}\u00A0\u00A0- Arrow: 3${
          newLine
        }\u00A0\u00A0- Hempen Rope: 50ft`,
      type: 'inputBox',
      mobile,
      isMobileAnswerInputType: true
    });
    if (!answer || answer === 'cancel') return;

    if (!trackHistory) {
      trackHistory = (newChanges) => History().trackHistory(changes, newChanges);
    }
    const [itemName, stringCount = ''] = answer.split(':').map((item) => item.trim());
    const numberCount = parseInt(stringCount.replace(/[^0-9]/g, '')) || 1;
    const count = !stringCount.includes('ft') ? numberCount : undefined;
    const feet = !count ? numberCount : undefined;
    const itemData = { itemName, ...(feet ? { feet } : { count }) };
    if (
      onUse && !_buttonsPrivate().executeHook(
        onUse,
        { ...itemData, mobile, trackHistory },
        memory
      )
    ) return;

    return Inventory().removeItem({ ...itemData, apply, mobile, trackHistory, changes });
  },
  Undo: ({ mobile = false } = {}) => {
    const Generic_ = Generic(), History_ = History();
    const latestChange = History_.popFromChangesHistory(mobile);
    if (latestChange) {
      latestChange.reverse().forEach(({ sheet, range, value, command, options }) => {
        if (command) {
          return History_.useCommand({ sheet, command, options });
        }
        Generic_.setValue(range, value, sheet);
      });
      IO().notify({ message: 'Latest change has been reverted.', mobile });
    }
  },
  getButtonConfig: () => ({
    attributes: () => ({
      'Use Hit Dice': () => ({ callback: Buttons().HitDice }),
      'Roll Initiative': () => ({ callback: Buttons().Initiative }),
      'Death Save': () => ({ callback: Buttons().DeathSave }),
      'Start Turn': () => ({ callback: Buttons().StartTurn }),
      'End Turn': () => ({ callback: Buttons().EndTurn }),
      'Short Rest': () => ({ callback: Buttons().ShortRest }),
      'Long Rest': () => ({ callback: Buttons().LongRest }),
      'Roll Custom Dice': () => ({ callback: Buttons().RollCustomDice }),
      'Loot Item': () => ({ callback: Buttons().LootItem }),
      'Remove Item': () => ({ callback: Buttons().RemoveItem }),
      'Undo': () => ({ callback: Buttons().Undo })
    }),
    checks: () => ({
      defaultCallback: Helper().abstractCheck,
      'STR Saving Throw': () => ({ checkType: 'STR', isSavingThrow: true }),
      'Athletics': () => ({ checkType: 'Athletics' }),
      'DEX Saving Throw': () => ({ checkType: 'DEX', isSavingThrow: true }),
      'Acrobatics': () => ({ checkType: 'Acrobatics' }),
      'Sleight of Hand': () => ({ checkType: 'Sleight of Hand' }),
      'Stealth': () => ({ checkType: 'Stealth' }),
      'CON Saving Throw': () => ({ checkType: 'CON', isSavingThrow: true }),
      'INT Saving Throw': () => ({ checkType: 'INT', isSavingThrow: true }),
      'Arcana': () => ({ checkType: 'Arcana' }),
      'History': () => ({ checkType: 'History' }),
      'Investigation': () => ({ checkType: 'Investigation' }),
      'Nature': () => ({ checkType: 'Nature' }),
      'Religion': () => ({ checkType: 'Religion' }),
      'WIS Saving Throw': () => ({ checkType: 'WIS', isSavingThrow: true }),
      'Animal Handling': () => ({ checkType: 'Animal Handling' }),
      'Insight': () => ({ checkType: 'Insight' }),
      'Medicine': () => ({ checkType: 'Medicine' }),
      'Perception': () => ({ checkType: 'Perception' }),
      'Survival': () => ({ checkType: 'Survival' }),
      'CHA Saving Throw': () => ({ checkType: 'CHA', isSavingThrow: true }),
      'Deception': () => ({ checkType: 'Deception' }),
      'Intimidation': () => ({ checkType: 'Intimidation' }),
      'Performance': () => ({ checkType: 'Performance' }),
      'Persuasion': () => ({ checkType: 'Persuasion' })
    }),
    actions: () => ({
      'Main-hand': () => ({
        onCheck: ({ mobile }) => {
          if (Inventory().checkWeaponAttribute({ attribute: 'weapon' })) {
            return true;
          }
          return IO().notify({
            message: 'You need to equip a weapon in your Main-hand first.',
            mobile
          });
        }
      }),
      'Unarmed Strike': () => ({
        onCheck: ({ mobile }) => {
          if (Generic().getNamedRange('Main_hand').value === '-') {
            return true;
          }
          return IO().notify({
            message: 'You need to remove your equipped Main-hand weapon first.',
            mobile
          });
        }
      }),
      'Dash': () => ({}),
      'Disengage': () => ({}),
      'Dodge': () => ({}),
      'Grapple': () => ({ checkType: 'Athletics' }),
      'Shove': () => ({ checkType: 'Athletics' }),
      'Hide': () => ({ checkType: 'Stealth' }),
      'Search': () => ({ checkTypeMain: 'Perception', checkTypeSecondary: 'Investigation' }),
      'Help': () => ({}),
      'Ready': () => ({}),
      'Use Object': () => ({}),
      'Equip': () => ({}),
      'Improvise': () => ({})
    }),
    bonusActions: () => ({
      'Off-hand': () => ({
        onCheck: ({ mobile }) => {
          if (Inventory().checkWeaponAttribute({ attribute: 'weapon', isOffHand: true })) {
            return true;
          }
          return IO().notify({
            message: 'You need to equip a weapon in your Off-hand first.',
            mobile
          });
        }
      }),
      'Dodge': () => ({}),
      'Hide': () => ({ checkType: 'Stealth' })
    }),
    reactions: () => ({
      'Opportunity Attack': () => ({ 
        onCheck: ({ mobile }) => {
          const { validation, outputMessage } = Inventory().validateWeapon({ melee: true });
          if (validation) return true;
          return IO().notify({ message: outputMessage, mobile });
        }
      }),
      'Ready Trigger': () => ({})
    }),
    interactions: () => ({
      'Trivial Action': () => ({}),
      'Minor Equip': () => ({})
    }),
    movement: () => ({
      'Move': () => ({})
    })
  })
});
