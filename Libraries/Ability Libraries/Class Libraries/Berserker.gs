var Berserker = () => ({
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
      Berserker().getButtonConfig(),
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
      Berserker().getAllButtonConfigs({ configCallbacks, customConfig }),
      mobile
    );
  },
  // Static
  getPostures: () => ['Vicious Posture', 'Unbreakable Posture'],
  // Automation
  addConditionalFormatting: ({ sheet, grid, metadata = [], firstRowSize = 2 }) => {
    const hitColumn = metadata.indexOf('hit') + 1;
    const effectColumn = metadata.indexOf('mainEffect') + 1;
    const conditionalFormattingConfig = {
      'Main-hand': {
        hit: '=AND(INDIRECT("Boon_of_Agony_Attack_Modifier"), ' +
          'INDIRECT("Main_hand") <> "-")',
        effect: '=AND(OR(INDIRECT("Boon_of_Agony_Damage_Modifier"), ' +
          'IFERROR(INDIRECT("Main_Thrill_of_the_Kill") <> "")), INDIRECT("Main_hand") <> "-")'
      },
      'Off-hand': {
        hit: '=AND(INDIRECT("Boon_of_Agony_Attack_Modifier"), ' +
          'INDIRECT(ADDRESS(ROW(),COLUMN())) <> "Pick")',
        effect: '=AND(OR(INDIRECT("Boon_of_Agony_Damage_Modifier"), ' +
          'IFERROR(INDIRECT("Off_Thrill_of_the_Kill") <> "")), ' +
          'INDIRECT(ADDRESS(ROW(),COLUMN())) <> "a weapon")'
      },
      'Unarmed Strike': {
        hit: '=AND(INDIRECT("Boon_of_Agony_Attack_Modifier"), ' +
          'INDIRECT("Main_hand") = "-")',
        effect: '=AND(INDIRECT("Boon_of_Agony_Damage_Modifier"), ' +
          'INDIRECT("Main_hand") = "-")'
      },
      meleeAttack: {
        hit: '=AND(INDIRECT("Boon_of_Agony_Attack_Modifier"), ' +
          'INDIRECT(ADDRESS(ROW(),COLUMN())) <> "Pick")',
        effect: '=AND(OR(INDIRECT("Boon_of_Agony_Damage_Modifier"), ' +
          'IFERROR(INDIRECT("Main_Thrill_of_the_Kill") <> "")), ' +
          'INDIRECT(ADDRESS(ROW(),COLUMN())) <> "a melee weapon")'
      }
    };
    const meleeAttacks = [
      'Opportunity Attack',
      'Rupture',
      'Bloodthirst',
      'Tempestrike',
      'Dominant Blow'
    ];

    grid.slice(firstRowSize).forEach(([ability], row) => {
      const key = meleeAttacks.includes(ability)
        ? 'meleeAttack'
        : Object.keys(conditionalFormattingConfig).find((name) => {
          return ability.includes(name);
        });
      if (!key) return;
      const { hit, effect } = conditionalFormattingConfig[key];
      const hitRule = SpreadsheetApp
        .newConditionalFormatRule()
        .whenFormulaSatisfied(hit)
        .setFontColor('#FF0000')
        .setBold(true)
        .setRanges([sheet.getRange(row + firstRowSize + 1, hitColumn, 1, 1)])
        .build();
      const effectRule = SpreadsheetApp
        .newConditionalFormatRule()
        .whenFormulaSatisfied(effect)
        .setFontColor('#3CBF3C')
        .setBold(true)
        .setRanges([sheet.getRange(row + firstRowSize + 1, effectColumn, 1, 1)])
        .build();
      sheet.setConditionalFormatRules([
        ...sheet.getConditionalFormatRules(),
        hitRule,
        effectRule
      ]);
    });
    return true;
  },
  onLevelUp: ({ nextLevel, mobile, trackHistory }) => {
    if (nextLevel === 5) return { 'Bonus Actions': {} };
    if (nextLevel !== 18) return true;
    const Generic_ = Generic(), IO_ = IO();
    const sheet = 'Checks';
    const options = [], excludeOptions = [], selectedOptions = [];
    const checkData = Object.entries(Parse().getSheetData(sheet))
      .reduce((total, [check, { proficiency }]) => {
        if (!proficiency) return total;
        options.push(check);
        const proficiencyValue = Generic_.getValue(proficiency, sheet);
        if (proficiencyValue === 'Expert') {
          excludeOptions.push(check);
        }
        return {
          ...total,
          [check]: {
            sheet,
            range: proficiency,
            value: proficiencyValue
          }
        };
      }, {});

    for (let iteration = 1; iteration <= 3; iteration++) {
      const skillSelected = IO_.askForAnswerFromList({
        title: 'Herculean Aptitude',
        message: `(${iteration} / 3) Pick a skill to gain Expertise on`,
        options,
        excludeOptions,
        optionModifier: (option) => {
          const { value: proficiency } = checkData[option];
          if (proficiency === '-') return option;
          return `${option}: ${proficiency}`;
        },
        mobile
      });
      if (!skillSelected) return;
      selectedOptions.push(skillSelected);
      excludeOptions.push(skillSelected);
    }

    trackHistory([
      ...['STR', 'CON'].map((attribute) => {
        return {
          ...Generic_.getNamedRange(attribute),
          value: 4,
          relative: true
        };
      }),
      ...selectedOptions.map((option) => {
        return {
          ...checkData[option],
          value: 'Expert'
        };
      })
    ]);
    return true;
  },
  // Utilities
  cachePostureCell: () => {
    const sheet = Generic().getSheet('Bonus Actions');
    if (!sheet) return 'A2';
    const dataValidations = sheet.getDataRange().getDataValidations();
    for (let i = 0; i < dataValidations.length; i++) {
      for (let j = 0; j < dataValidations[i].length; j++) {
        const rule = dataValidations[i][j];
        if (
          rule !== null
            && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST
        ) {
          const values = rule.getCriteriaValues()[0];
          if (Berserker().getPostures().every((posture) => values.includes(posture))) {
            return sheet.getRange(i + 1, j + 1).getA1Notation();
          }
        }
      }
    }
  },
  getPostureState: () => {
    for (let posture of Berserker().getPostures()) {
      const postureState = Parse().getState('Bonus Actions', posture, 'name');
      if (Object.keys(postureState).length) {
        return postureState;
      }
    }
  },
  getAttackAdvantage: () => {
    const Generic_ = Generic(), Berserker_ = Berserker();
    let result = 0;
    const [
      { value: currentHealth },
      { value: maxHealth }
    ] = Generic_.getNamedRange(['HP', 'Max_HP']);
    const { value: postureValue } = Berserker_.getPostureState();
    if (Helper().getTracker('Offensive Surge', 'Bonus Actions')) result++;
    if (
      postureValue === Berserker_.getPostures()[0]
        && currentHealth <= Math.ceil(maxHealth / 4)
    ) result++;
    if (Generic_.doesValueExist('Relentless Momentum', 'Passives')) {
      return result > 0
        ? 2
        : result;
    }
    return Generic_.doesValueExist('Ruthless Frenzy', 'Passives')
      ? result
      : Math.min(result, 1);
  },
  // Callbacks
  resetOffensiveSurge: ({ trackHistory }) => Helper().resetTracker({
    spellName: 'Offensive Surge',
    sheet: 'Bonus Actions',
    trackHistory
  }),
  resetDefensiveSurge: ({ trackHistory }) => Helper().resetTracker({
    spellName: 'Defensive Surge',
    sheet: 'Bonus Actions',
    trackHistory
  }),
  carnageMultiplier: () => {
    const Generic_ = Generic();
    if (
      Generic_.doesValueExist('Carnage', 'Passives')
        && Generic_.getNamedRange('HP').value === 1
    ) return 2;
    return 1;
  },
  onKillingBlow: () => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Blood Rush', 'Passives')) return;
    return ({ killingBlows, mobile, trackHistory }) => {
      if (killingBlows <= 0) return true;
      const Helper_ = Helper();
      if (Helper_.getTracker('Primal Rage', 'Bonus Actions')) {
        trackHistory(
          Generic_.getNamedRange(['Action', 'Bonus_Action', 'Reaction', 'Interaction', 'Movement'])
            .map((actionData) => ({ ...actionData, value: true }))
        );
      }
      Helper_.heal({
        amount: 5
          * Math.max((Generic_.getNamedRange('CON_Modifier').value || 0), 1)
          * killingBlows,
        trackHistory
      });
      return Buttons().HitDice({ ask: true, apply: false, mobile, trackHistory });
    };
  },
  // Abstract methods
  abstractAttack: (options = {}) => {
    const Berserker_ = Berserker();
    return Helper().abstractUseAbility({
      attackAdvantage: Berserker_.getAttackAdvantage(),
      onUse: Berserker_.resetOffensiveSurge,
      options
    });
  },
  abstractChangePosture: ({ mobile = false, trackHistory, changes = [] } = {}) => {
    const IO_ = IO(), History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    const bonusActionData = Generic().getNamedRange('Bonus_Action');
    if (!bonusActionData.value) {
      return IO_.notify({
        message: `You have already used a Bonus Action this turn.`,
        mobile
      });
    }

    const Berserker_ = Berserker();
    const postures = Berserker_.getPostures();
    const postureState = Berserker_.getPostureState();
    const newPosture = postureState.value === postures[0]
      ? postures[1]
      : postures[0];
    History_.applyChanges(
      trackHistory([
        {...bonusActionData, value: false },
        { ...postureState, value: newPosture }
      ])
    );
    IO_.notify({
      message: `Successfully changed your Posture to ${newPosture}`,
      mobile
    });
    return changes;
  },
  abstractRuptureTick: (options = {}) => Helper().abstractUseAbility({
    skipActionCost: true,
    beforeHitCalculation: ({ secondaryEffect, mobile }) => {
      const feet = IO().notify({
        type: 'inputBox',
        title: 'Rupture bleed damage',
        message: 'How many feet did your Rupture target move?',
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(feet)) return;
      const [rolls, dice] = secondaryEffect.split('d');
      return {
        mainEffect: `${Math.floor(feet / 5) * rolls}d${dice}`,
        secondaryEffect: null
      };
    },
    options
  }),
  abstractBloodthirst: (options = {}) => Berserker().abstractAttack({
    melee: true,
    onSuccess: ({ mobile, trackHistory }) => {
      return Buttons().HitDice({
        ask: true,
        apply: false,
        mobile,
        trackHistory
      });
    },
    ...options
  }),
  abstractDominantBlow: (options = {}) => Berserker().abstractAttack({
    melee: true,
    skipSecondaryEffect: true,
    afterHitCalculation: ({ mainEffect, secondaryEffect, mobile }) => {
      const targetStrength = IO().notify({
        type: 'inputBox',
        title: 'Dominant Blow STR difference',
        message: "What's the STR modifier of your target?",
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(targetStrength)) return;
      const { value: strengthModifier = 0 } = Generic().getNamedRange('STR_Modifier');
      if (targetStrength >= strengthModifier) {
        return { mainEffect };
      }
      const [rolls, dice] = secondaryEffect.split('d');
      return {
        mainEffect: `${
          (strengthModifier - Math.floor(targetStrength)) * rolls
        }d${dice} + ${mainEffect}`
      };
    },
    ...options
  }),
  abstractCrimsonBarrier: (options = {}) => Helper().abstractUseAbility({
    onUse: ({ mobile, trackHistory }) => {
      const Generic_ = Generic(), IO_ = IO();
      const {
        value: constitutionModifier = 0
      } = Generic_.getNamedRange('CON_Modifier');
      const currentHealthData = Generic_.getNamedRange('HP');
      const minimumConstitution = Math.max(constitutionModifier, 1);
      if (!currentHealthData.range || (currentHealthData.value <= minimumConstitution)) {
        return IO_.notify({
          message: 'You do not have enough health to spend ' +
            `(minimum of ${minimumConstitution}).`,
          mobile
        });
      }

      const { value: level = 1 } = Generic_.getNamedRange('Level');
      const options = Array.from(
        { length: level },
        (_, index) => (index + 1) * minimumConstitution
      );
      const excludeOptions = options.filter((option) => {
        return option >= currentHealthData.value;
      });
      const healthAnswer = IO_.askForAnswerFromList({
        title: 'Crimson Barrier Health cost',
        message: 'How much health would you like to convert to temporary?',
        options,
        excludeOptions,
        mobile
      });
      if (!healthAnswer) return;
      const healthSpent = parseInt(healthAnswer);
      return trackHistory([
        {
          ...Generic_.getNamedRange('Temp'),
          value: healthSpent,
          relative: true
        },
        {
          ...currentHealthData,
          value: -healthSpent,
          relative: true
        }
      ]);
    },
    options
  }),
  // Config
  getButtonConfig: () => {
    const Berserker_ = Berserker();
    return {
      attributes: () => ({
        'Start Turn': () => ({
          onUse: [
            Berserker_.resetOffensiveSurge,
            Berserker_.resetDefensiveSurge
          ]
        }),
        'End Turn': () => ({
          onUse: ({ trackHistory }) => {
            const Helper_ = Helper();
            if (!Helper_.getTracker('Primal Rage', 'Bonus Actions')) return true;
            Helper_.resetTracker({
              spellName: 'Primal Rage',
              sheet: 'Bonus Actions',
              trackHistory
            });
            return trackHistory({
              ...Generic().getNamedRange('HP'),
              value: 0
            });
          }
        }),
        'Short Rest': () => ({
          onUse: ({ trackHistory }) => {
            return Helper().restoreAllClassSpellSlots({
              percentageRestored: 0.5,
              trackHistory
            });
          }
        }),
        'Long Rest': () => ({
          onUse: Helper().restoreAllClassSpellSlots,
          hitDiceRestored: 1
        })
      }),
      actions: () => ({
        defaultArguments: {
          multiplier: Berserker_.carnageMultiplier(),
          onKillingBlow: Berserker_.onKillingBlow()
        },
        'Main-hand': () => ({ callback: Berserker_.abstractAttack }),
        'Unarmed Strike': () => ({ callback: Berserker_.abstractAttack }),
        'Rupture': () => ({ callback: Berserker_.abstractAttack, melee: true }),
        'Rupture Tick': () => ({ callback: Berserker_.abstractRuptureTick }),
        'Tempestrike': () => ({
          callback: Berserker_.abstractAttack,
          melee: true,
          aoeSecondary: true
        }),
        'Indomitable Spirit': () => ({}),
        'Dominant Blow': () => ({ callback: Berserker_.abstractDominantBlow }),
        'Trample': () => ({ aoe: true }),
        'Blitz': () => ({ aoe: true }),
        'Unrelenting': () => ({ skipActionCost: true })
      }),
      bonusActions: () => ({
        defaultArguments: {
          multiplier: Berserker_.carnageMultiplier(),
          onKillingBlow: Berserker_.onKillingBlow()
        },
        'Off-hand': () => ({ callback: Berserker_.abstractAttack }),
        'Change Posture': () => ({ callback: Berserker_.abstractChangePosture }),
        'Offensive Surge': () => ({ onUse: Helper().setTracker }),
        'Defensive Surge': () => ({ onUse: Helper().setTracker }),
        'Defiant Roar': () => ({}),
        'Crimson Barrier': () => ({ callback: Berserker_.abstractCrimsonBarrier }),
        'Primal Rage': () => ({ onUse: Helper().setTracker })
      }),
      reactions: () => ({
        defaultArguments: {
          multiplier: Berserker_.carnageMultiplier(),
          onKillingBlow: Berserker_.onKillingBlow()
        },
        'Opportunity Attack': () => ({ callback: Berserker_.abstractAttack }),
        'Bloodthirst': () => ({ callback: Berserker_.abstractBloodthirst })
      }),
      interactions: () => ({
        defaultArguments: { onKillingBlow: Berserker_.onKillingBlow() }
      }),
      movement: () => ({
        defaultArguments: { onKillingBlow: Berserker_.onKillingBlow() }
      }),
      automation: () => ({
        'Update Actions Sheet': () => ({ onFormat: Berserker_.addConditionalFormatting }),
        'Update Bonus Actions Sheet': () => ({
          namedRangesConfig: { row: Berserker_.getPostures(), column: 1, name: 'Posture' },
          onFormat: Berserker_.addConditionalFormatting
        }),
        'Update Reactions Sheet': () => ({ onFormat: Berserker_.addConditionalFormatting }),
        'Level Up': () => ({ onLevelUp: Berserker_.onLevelUp })
      })
    };
  },
  getCacheConfig: (configCallbacks = []) => {
    const Berserker_ = Berserker();
    const name = Berserker_.cachePostureCell();
    const classConfig = {
      actions: {
        'Rupture': [
          { deletions: ['secondaryEffect'] },
          { version: 'Tick', deletions: ['slotCost', 'hit', 'mainEffect'] }
        ]
      },
      bonusActions: Berserker_.getPostures().reduce((total, posture) => {
        return { ...total, [posture]: [{ name }] };
      }, {})
    };
    return Automation().getCacheConfig({ configCallbacks, classConfig });
  }
});
