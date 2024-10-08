var Connoisseur = () => ({
  // Static
  getChannelSafeSpells: () => [
    'Transfusion',
    'Channeled',
    'Tick',
    'Viscosity',
    'Volatile Erruption',
    'Spreading Appetite',
    'Reforming Tissues'
  ],
  // Automation
  onFormat: ({ sheet, grid, firstRowSize = 1 }) => {
    const isBonusAction = sheet.getName() === 'Bonus Actions';
    for (let row = firstRowSize; row < grid.length; row++) {
      const ability = grid[row][0];
      const channeledAbilities = [
        'Crimson Cone',
        'Scarlet Sphere',
        'Living Tendrils',
        'Bursting Wounds',
        'Blood Spike',
        'Scarlet Bomb',
        'Bloodbath'
      ];
      if (!channeledAbilities.includes(ability)) continue;
      const isSingleRow = ['Scarlet Bomb', 'Bloodbath'].includes(ability);
      sheet
        .getRange(row + 1, 1, isSingleRow ? 1 : 2, grid[0].length)
        .setBackground(isBonusAction ? '#FFEBB2' : '#C7E0BD');
      if (!isSingleRow) row++;
    }
    return true;
  },
  onLevelUp: ({
    nextLevel,
    descriptions = [],
    assimilationLevelCap = 5,
    mobile = false,
    trackHistory
  }) => {
    if (!nextLevel || nextLevel < 2) return true;
    const Generic_ = Generic();
    const spellLevelUpData = [], validOptions = [], excludeOptions = [];
    Object.entries(Parse().getData()).forEach(([sheet, typeData]) => {
      Object.entries(typeData).forEach(([ability, abilityData]) => {
        if (typeof abilityData !== 'object') return;
        const cell = abilityData.spellLevel;
        if (!cell) return;
        const spellLevel = Generic_.getValue(cell, sheet);
        ability = ability.replace(' Immediate', '');
        if (spellLevel < assimilationLevelCap) validOptions.push(ability);
        else excludeOptions.push(ability);
        spellLevelUpData.push({ ability, spellLevel });
      });
    });
    if (!validOptions.length) return true;

    const IO_ = IO();
    const newLine = IO_.getNewLineChar(mobile);
    const selectedAbility = validOptions.length === 1
      ? validOptions[0]
      : IO_.askForAnswerFromList({
          title: 'Leveling up...',
          message: `Select a spell to level up via Assimilation`,
          options: spellLevelUpData.map(({ ability }) => ability),
          optionModifier: (option) => {
            const foundAbility = descriptions.find(({ name }) => name === option);
            if (!foundAbility) return option;
            return `${option} (Level ${
              spellLevelUpData.find(({ ability }) => ability === option).spellLevel
            }): ${foundAbility.description}${newLine}`;
          },
          excludeOptions,
          mobile
        });

    if (!selectedAbility) return;
    trackHistory({
      ...Generic_.getNamedRange(`${selectedAbility.replace(' ', '_')}_Level`),
      value: 1,
      relative: true
    });
    return true;
  },
  // Utilities
  getSpellVersion: (name) => {
    const splitName = name.split(' ');
    return splitName.at(-1);
  },
  // Callbacks
  checkForLinkedTargets: ({ mobile }) => {
    if (Generic().getNamedRange('Linked').value) return true;
    return IO().notify({
      message: 'You need to be casting Transfusion and have ' +
        'at least 1 linked target to cast a channeled ability.',
      mobile
    });
  },
  resetLinkedCounter: ({ spellName = '', trackHistory }) => {
    if (Connoisseur().getChannelSafeSpells().some((tag) => spellName.includes(tag))) return true;
    return trackHistory({ ...Generic().getNamedRange('Linked'), value: 0 });
  },
  resetViscosityHealth: ({ trackHistory }) => {
    const Generic_ = Generic();
    return trackHistory({
      ...Generic_.getNamedRange('HP'),
      max: () => Generic_.getNamedRange('Max_HP').value
    });
  },
  resetLivingHostDuration: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Living_Host_Duration'),
    value: 0
  }),
  reduceLivingHostDuration: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Living_Host_Duration'),
    value: -1,
    relative: true
  }),
  validateLivingHostAbilities: ({ spellName, mobile }) => {
    const { value: livingHostDuration = 0 } = Generic().getNamedRange('Living_Host_Duration');
    if (
      !livingHostDuration
        || [
          ...Connoisseur().getChannelSafeSpells(),
          'Let Go of Living Host'
        ].some((tag) => spellName.includes(tag))
    ) return true;
    return IO().notify({
      message: `You need to Let Go of your Living Host, in order to cast ${spellName}`,
      mobile
    });
  },
  reduceCrimsonFiestaRecharge: ({ trackHistory }, amount = 1) => trackHistory({
    ...Generic().getNamedRange('Crimson_Fiesta_Recharge'),
    value: -amount,
    relative: true,
    min: 0
  }),
  onKillingBlow: () => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Succulent Morsels', 'Passives')) return;
    return ({ killingBlows, mobile, trackHistory }) => {
      if (killingBlows <= 0) return true;
      const IO_ = IO();
      const message = 'How many stacks of Succulent Morsels did you receive?';
      const stacksGained = mobile
        ? IO_.askForAnswerFromList({
            message,
            options: [...Array(101).keys()],
            hideOptions: true,
            mobile
          })
        : IO_.notify({ type: 'inputBox', message, mobile });
      if (isNaN(stacksGained)) return;
      if (stacksGained <= 0) return true;
      trackHistory({
        ...Generic_.getNamedRange('Succulent_Morsels_Stacks'),
        value: parseInt(stacksGained),
        relative: true
      });
      const command = 'Succulent Morsels';
      const customConfig = {
        passives: () => ({
          [command]: () => ({ trackHistory })
        })
      };
      Controller().useCommand({
        command,
        type: 'passives',
        selectedClass: 'Connoisseur',
        customConfig,
        mobile
      });
      return true;
    };
  },
  // Abstract methods
  abstractTransfusion: (options = {}) => {
    const Generic_ = Generic(), IO_ = IO();
    const { spellName } = options;
    const version = Connoisseur().getSpellVersion(spellName);
    const linkedData = Generic_.getNamedRange('Linked');
    const { value: linkedTargets = 0 } = linkedData;
    const hasBloodVessel = Generic_.doesValueExist('Blood Vessel', 'Passives');
    let linkedLimit =
      Math.max(Generic_.getNamedRange('CHA_Modifier').value || 0, 0) +
      (Generic_.doesValueExist('Regal Resonance', 'Passives') ? 2 : 0) +
      1;
    if (hasBloodVessel) {
      linkedLimit = version === 'Single'
        ? linkedLimit + 1
        : linkedLimit * 2;
    }

    return Helper().abstractUseAbility({
      mainEffectOutput: 'Damage / Healing done',
      ...((version === 'AoE' || (version === 'Single' && hasBloodVessel)) && {
        aoe: true,
        cost: Generic_.doesValueExist('Insatiable Hunger', 'Passives') && linkedTargets ? 0 : 1,
        beforeHitCalculation: ({ mobile, trackHistory }) => {
          const targetsHit = IO_.notify({
            type: 'inputBox',
            title: 'Transfusion targets',
            message: 'With how many hemorrhaging or willing targets in range '
              + `do you want to link with (up to ${linkedLimit})?`,
            mobile,
            isMobileAnswerInputType: true
          });
          if (isNaN(targetsHit) || targetsHit <= 0) return;
          if (targetsHit > linkedLimit) {
            return IO_.notify({
              message: `You don't have enough CHA to be linked with ${
                targetsHit
              } targets, limit is ${linkedLimit}.`,
              mobile
            });
          }
          trackHistory({ ...linkedData, value: targetsHit });
          return { targetsHit };
        }
      }),
      ...((version === 'Single' && !hasBloodVessel) && {
        onSuccess: ({ trackHistory }) => {
          return trackHistory({
            ...Generic_.getNamedRange('Linked'),
            value: 1
          });
        }
      }),
      ...(version === 'Tick' && {
        aoe: true,
        targetsHit: Math.min(linkedTargets, linkedLimit),
        onCheck: ({ mobile }) => {
          if (linkedTargets) return true;
          return IO_.notify({
            message: 'You need to be casting Transfusion and have '
              + 'at least 1 linked target to cast its Tick version.',
            mobile
          });
        }
      }),
      options
    });
  },
  abstractCrimsonCone: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      aoe: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      ...(!isImmediate && {
        targetsHit: Math.max(
          Math.min(
            Generic().getNamedRange('Linked').value,
            Parse().getValue('Actions', 'Crimson Cone Immediate', 'spellLevel'),
            5
          ),
          1
        ),
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractScarletSphere: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      ...(isImmediate ? {
        aoeSecondary: true,
        applyHitToBothEffects: true,
        mainEffectOutput: 'Damage done',
        secondaryEffectOutput: 'Splash damage done'
      } : {
        aoeMain: true,
        mainEffectOutput: 'Damage / Healing done',
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractLivingTendrils: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      aoe: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      ...(!isImmediate && {
        targetsHit: Math.max(
          Math.min(
            Generic().getNamedRange('Linked').value,
            Parse().getValue('Actions', 'Living Tendrils Immediate', 'spellLevel'),
            5
          ),
          1
        ),
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractBurstingWounds: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      aoe: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      ...(!isImmediate && {
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractBloodSpike: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      skipSecondaryEffect: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      ...(!isImmediate && {
        aoe: true,
        targetsHit: Generic().getNamedRange('Linked').value,
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractScarletBomb: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      aoe: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      onUse: ({ trackHistory }) => {
        const isAction = options.type === 'Action';
        const { currentSlots } = Parse().getStateData(
          `${isAction ? 'Bonus ' : ''}Actions`,
          `Scarlet Bomb ${isAction ? 'Channeled' : 'Immediate'}`,
          'currentSlots'
        );
        return trackHistory({
          ...currentSlots,
          value: -1,
          relative: true,
          min: 0
        });
      },
      ...(!isImmediate && {
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractBloodbath: (options = {}) => {
    const Connoisseur_ = Connoisseur();
    const isImmediate = Connoisseur_.getSpellVersion(options.spellName) === 'Immediate';
    return Helper().abstractUseAbility({
      aoe: true,
      mainEffectOutput: isImmediate
        ? 'Damage done'
        : 'Damage / Healing done',
      onUse: ({ trackHistory }) => {
        const isAction = options.type === 'Action';
        const { currentSlots } = Parse().getStateData(
          `${isAction ? 'Bonus ' : ''}Actions`,
          `Bloodbath ${isAction ? 'Channeled' : 'Immediate'}`,
          'currentSlots'
        );
        return trackHistory({
          ...currentSlots,
          value: -1,
          relative: true,
          min: 0
        });
      },
      ...(!isImmediate && {
        onCheck: Connoisseur_.checkForLinkedTargets
      }),
      options
    });
  },
  abstractReformingTissues: (options = {}) => {
    const Helper_ = Helper();
    return Helper_.abstractUseAbility({
      onUse: ({ mobile, trackHistory }) => {
        const damageTaken = IO().notify({
          type: 'inputBox',
          title: 'Reforming Tissues damage taken',
          message: 'How much damage did the provoking creature do to you this turn?',
          mobile,
          isMobileAnswerInputType: true
        });
        if (isNaN(damageTaken)) return;
        return Helper_.heal({ amount: Math.floor(damageTaken / 2), trackHistory });
      },
      options
    });
  },
  abstractLivingHost: (options = {}) => Helper().abstractUseAbility({
    mainEffectOutput: 'Damage / Healing done',
    onOutput: ({ mainResult, mobile, trackHistory }) => {
      const Generic_ = Generic(), IO_ = IO();
      const newLine = IO_.getNewLineChar(mobile);
      const [
        currentHealthState,
        { value: maxHealth = 1 }
      ] = Generic_.getNamedRange(['HP', 'Max_HP']);
      const { value: currentHealth = 1 } = currentHealthState;

      const isHealing = IO_.askForYesOrNo({
        title: 'Living Host healing',
        message: 'Are you healing your target?',
        mobile
      });
      if (isHealing === undefined) return;
      let targetCurrentHealth = IO_.notify({
        type: 'inputBox',
        title: 'Living Host target health',
        message: "What's the current health of your target?",
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(targetCurrentHealth)) return;
      targetCurrentHealth = parseInt(targetCurrentHealth);
      if (!isHealing && targetCurrentHealth <= mainResult) {
        return {
          text: `${newLine}${newLine}You've killed your target.`,
          killingBlow: true
        };
      }

      let targetMaxHealth = IO_.notify({
        type: 'inputBox',
        title: 'Living Host target max health',
        message: "What's the max health of your target?",
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(targetMaxHealth)) return;
      targetMaxHealth = parseInt(targetMaxHealth);
      if (targetMaxHealth < targetCurrentHealth) {
        return IO_.notify({
          message: "Your target's current health cannot exceed their maximum",
          mobile
        });
      }
      targetCurrentHealth = Math.min(
        parseInt(targetCurrentHealth) + mainResult * (isHealing ? 1 : -1),
        targetMaxHealth
      );

      let newCurrentHealth = 0, newTargetCurrentHealth = 0;
      const averageHealth = Math.floor((currentHealth + targetCurrentHealth) / 2);
      if (averageHealth <= maxHealth && averageHealth <= targetMaxHealth) {
        newCurrentHealth = averageHealth;
        newTargetCurrentHealth = averageHealth;
      } else if (averageHealth > maxHealth) {
        newCurrentHealth = maxHealth;
        newTargetCurrentHealth = targetCurrentHealth - (maxHealth - currentHealth);
      } else {
        newCurrentHealth = currentHealth - (targetMaxHealth - targetCurrentHealth);
        newTargetCurrentHealth = targetMaxHealth;
      }

      const [
        { value: charisma = 0 },
        durationState
      ] = Generic_.getNamedRange(['CHA_Modifier', 'Living_Host_Duration']);
      trackHistory([
        { ...durationState, value: Math.max(charisma, 0) + 1 },
        {
          ...currentHealthState,
          value: newCurrentHealth,
          max: () => Generic_.getNamedRange('Max_HP').value
        }
      ]);
      return {
        text: `${newLine}${newLine}Your new health is ${
          newCurrentHealth
        }, while your target's new health is ${newTargetCurrentHealth}`,
        skipKillingBlow: true
      };
    },
    options
  }),
  abstractCrimsonFiesta: (options = {}) => Helper().abstractUseAbility({
    ...(Connoisseur().getSpellVersion(options.spellName) === 'Tick' ? {
      cost: 0,
      skipActionCost: true,
      aoe: true,
      mainEffectOutput: 'Damage / Healing done'
    } : {
      delayedEffect: true,
      onUse: ({ trackHistory }) => {
        const Generic_ = Generic();
        const rechargeData = Generic_.getNamedRange('Crimson_Fiesta_Recharge');
        const { value: recharge } = rechargeData;
        if (recharge) {
          return IO().notify({
            message: `Crimson Fiesta has not fully recharged yet, it requires ${
              Math.ceil(recharge / 2)
            }x Long Rests or ${recharge}x Short Rests`,
            mobile
          });
        }
        return trackHistory([
          { ...rechargeData, value: 4 },
          { ...Generic_.getNamedRange('STR'), value: -2, relative: true, min: 1 },
          { ...Generic_.getNamedRange('DEX'), value: -2, relative: true, min: 1 }
        ]);
      }
    }),
    options
  }),
  // Config
  getButtonConfig: () => {
    const Connoisseur_ = Connoisseur();
    return {
      attributes: () => ({
        'Start Turn': () => ({ onUse: Connoisseur_.reduceLivingHostDuration }),
        'Short Rest': () => ({
          onUse: [
            Connoisseur_.resetLinkedCounter,
            Connoisseur_.resetLivingHostDuration,
            Connoisseur_.reduceCrimsonFiestaRecharge
          ]
        }),
        'Long Rest': () => ({
          onUse: [
            Connoisseur_.resetLinkedCounter,
            Connoisseur_.resetViscosityHealth,
            Connoisseur_.resetLivingHostDuration,
            ({ trackHistory }) => Connoisseur_.reduceCrimsonFiestaRecharge({ trackHistory }, 2)
          ]
        })
      }),
      actions: () => ({
        defaultArguments: {
          onUse: [Connoisseur_.validateLivingHostAbilities, Connoisseur_.resetLinkedCounter],
          onKillingBlow: Connoisseur_.onKillingBlow()
        },
        'Cannibalize': () => ({ checkType: 'Insight' }),
        'Crimson Cone Immediate': () => ({ callback: Connoisseur_.abstractCrimsonCone }),
        'Crimson Cone Channeled': () => ({ callback: Connoisseur_.abstractCrimsonCone }),
        'Transfusion AoE': () => ({ callback: Connoisseur_.abstractTransfusion }),
        'Transfusion Single': () => ({ callback: Connoisseur_.abstractTransfusion }),
        'Transfusion Tick': () => ({ callback: Connoisseur_.abstractTransfusion, skipActionCost: true }),
        'Scarlet Sphere Immediate': () => ({ callback: Connoisseur_.abstractScarletSphere }),
        'Scarlet Sphere Channeled': () => ({ callback: Connoisseur_.abstractScarletSphere }),
        'Living Tendrils Immediate': () => ({ callback: Connoisseur_.abstractLivingTendrils }),
        'Living Tendrils Channeled': () => ({ callback: Connoisseur_.abstractLivingTendrils }),
        'Bursting Wounds Immediate': () => ({ callback: Connoisseur_.abstractBurstingWounds }),
        'Bursting Wounds Channeled': () => ({ callback: Connoisseur_.abstractBurstingWounds }),
        'Blood Spike Immediate': () => ({ callback: Connoisseur_.abstractBloodSpike }),
        'Blood Spike Channeled': () => ({ callback: Connoisseur_.abstractBloodSpike }),
        'Scarlet Bomb Immediate': () => ({ callback: Connoisseur_.abstractScarletBomb }),
        'Bloodbath Immediate': () => ({ callback: Connoisseur_.abstractBloodbath }),
        'Living Host': () => ({ callback: Connoisseur_.abstractLivingHost }),
        'Crimson Fiesta': () => ({ callback: Connoisseur_.abstractCrimsonFiesta }),
        'Crimson Fiesta Tick': () => ({ callback: Connoisseur_.abstractCrimsonFiesta })
      }),
      bonusActions: () => ({
        defaultArguments: {
          onUse: [Connoisseur_.validateLivingHostAbilities, Connoisseur_.resetLinkedCounter],
          onKillingBlow: Connoisseur_.onKillingBlow()
        },
        'Viscosity': () => ({ onUse: Helper().setTracker }),
        'Scarlet Bomb Channeled': () => ({ callback: Connoisseur_.abstractScarletBomb }),
        'Bloodbath Channeled': () => ({ callback: Connoisseur_.abstractBloodbath }),
        'Let Go of Living Host': () => ({ onUse: Connoisseur_.resetLivingHostDuration })
      }),
      reactions: () => ({
        defaultArguments: {
          onUse: [Connoisseur_.validateLivingHostAbilities, Connoisseur_.resetLinkedCounter],
          onKillingBlow: Connoisseur_.onKillingBlow()
        },
        'Volatile Eruption': () => ({}),
        'Spreading Appetite': () => ({}),
        'Reforming Tissues': () => ({ callback: Connoisseur_.abstractReformingTissues })
      }),
      interactions: () => ({
        defaultArguments: {
          onUse: [Connoisseur_.validateLivingHostAbilities, Connoisseur_.resetLinkedCounter],
          onKillingBlow: Connoisseur_.onKillingBlow()
        }
      }),
      movement: () => ({
        defaultArguments: {
          onUse: [Connoisseur_.validateLivingHostAbilities, Connoisseur_.resetLinkedCounter],
          onKillingBlow: Connoisseur_.onKillingBlow()
        }
      }),
      passives: () => ({
        defaultArguments: { onKillingBlow: Connoisseur_.onKillingBlow() },
        'Succulent Morsels': () => ({ aoe: true })
      }),
      automation: () => ({
        'Update Actions Sheet': () => ({ onFormat: Connoisseur_.onFormat }),
        'Update Bonus Actions Sheet': () => ({ onFormat: Connoisseur_.onFormat }),
        'Level Up': () => ({ onLevelUp: Connoisseur_.onLevelUp })
      })
    };
  },
  getCacheConfig: () => {
    const baseSpellConfig = [
      { version: 'Immediate' },
      { version: 'Channeled', deletions: ['spellLevel'] }
    ];
    return {
      actions: {
        'Crimson Cone': baseSpellConfig,
        'Scarlet Sphere': baseSpellConfig,
        'Living Tendrils': baseSpellConfig,
        'Bursting Wounds': baseSpellConfig,
        'Blood Spike': baseSpellConfig,
        'Scarlet Bomb': [{ version: 'Immediate' }],
        'Bloodbath': [{ version: 'Immediate' }],
        'Transfusion': [
          { version: 'AoE' },
          { version: 'Single', deletions: ['currentSlots', 'maxSlots', 'refresh'] },
          { version: 'Tick', deletions: ['currentSlots', 'maxSlots', 'refresh'] }
        ],
        'Crimson Fiesta': [{}, { version: 'Tick', deletions: ['currentSlots', 'maxSlots'] }]
      },
      bonusActions: {
        'Scarlet Bomb': [{ version: 'Channeled' }],
        'Bloodbath': [{ version: 'Channeled' }]
      }
    };
  }
});
