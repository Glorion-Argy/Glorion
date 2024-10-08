var Pathfinder = () => ({
  // Static
  getExcludedAttributes: () => ['Silent DC', 'Reveal', 'Aware', 'Range', 'Trap'],
  // Automation
  onActionsFormat: ({
    sheet,
    grid,
    metadata = [],
    firstRowSize = 1
  }) => {
    const rangeColumn = metadata.indexOf('range') + 1;
    const traps = [
      'Woodland Snag',
      'Foliage Fetter',
      'Explosive Caltrops',
      'Dense Foliage',
      'Landmine',
      'Obscuring Mound'
    ];
    const attacks = [
      'Main-hand',
      'Aimed Barrage',
      'Fiery Salvo',
      "Sniper's Flurry",
      'Bullseye',
      'Spray and Pray'
    ];

    grid.slice(firstRowSize).forEach(([ability], row) => {
      if (traps.includes(ability)) {
        return sheet
          .getRange(row + firstRowSize + 1, 1, 1, grid[0].length)
          .setBackground('#C7E0BD');
      }
      if (!attacks.some((attack) => ability.includes(attack))) return;
      const rule = SpreadsheetApp
        .newConditionalFormatRule()
        .whenFormulaSatisfied(
          '=ISNUMBER(SEARCH("ranged", IFERROR(VLOOKUP(INDIRECT("Main_hand"), ' +
          'INDIRECT("Inventory_All"), 7, FALSE), "")))'
        )
        .setFontColor('#3CBF3C')
        .setBold(true)
        .setRanges([sheet.getRange(row + firstRowSize + 1, rangeColumn, 1, 1)])
        .build();
      sheet.setConditionalFormatRules([...sheet.getConditionalFormatRules(), rule]);
    });
    return true;
  },
  onLevelUp: ({ nextLevel, path, trackHistory }) => {
    if (nextLevel !== 3 || path !== 'Deadeye') return true;
    const Generic_ = Generic();
    trackHistory([
      {
        ...Generic_.getNamedRange('CON'),
        value: 4,
        relative: true
      },
      {
        ...Generic_.getNamedRange('CON_Max_Modifier'),
        value: 2,
        relative: true
      }
    ]);
    return true;
  },
  // Utilities
  getItemCount: (itemName, mobile) => {
    const IO_ = IO();
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
    return parseInt(itemRow[2] || 0);
  },
  // Callbacks
  gainMarksmanPoints: (trackHistory, amount = 1) => {
    const Generic_ = Generic();
    const multiplier = ((
      Generic_.doesValueExist('Grim Harvest', 'Passives')
        && Generic_.getNamedRange('Unaware').value
    ) ? 2 : 1);
    return trackHistory({
      ...Generic_.getNamedRange('Points'),
      value: multiplier * amount,
      relative: true,
      max: 20
    });
  },
  resetMarksmanPoints: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Points'),
    value: 0
  }),
  marksmanPointsCalculation: ({
    spellName,
    mainEffect,
    secondaryEffect,
    mobile,
    trackHistory
  }) => {
    const Generic_ = Generic(), IO_ = IO();
    const [
      marksmanPointsData,
      { value: strength = 0 }
    ] = Generic_.getNamedRange(['Points', 'STR_Modifier']);
    const { value: marksmanPoints } = marksmanPointsData;
    const minimumPoints = Generic_.doesValueExist('Robust Flourish', 'Passives')
      ? Math.max(strength, 0) + 2
      : 0;
    let gain = 0;
    if (
      Generic_.doesValueExist('Execution', 'Passives')
        && Generic_.getNamedRange('Unaware').value
    ) {
      IO_.notify({
        message: `You gain ${strength} Marksman Points from Execution`,
        mobile
      });
      gain = strength;
    }

    const calculateAndReturn = (effect = mainEffect) => {
      if (gain) {
        trackHistory({
          ...marksmanPointsData,
          value: gain,
          relative: true,
          max: 20
        });
      }
      return { mainEffect: effect };
    };
    if (!marksmanPoints && !minimumPoints) {
      return calculateAndReturn();
    }

    let pointsSpent = IO_.notify({
      type: 'inputBox',
      title: `Using ${spellName}`,
      message:
        `You have ${marksmanPoints} Marksman Points, how many do you want to spend${
          minimumPoints ? ` (minimum of ${minimumPoints} from Robust Flourish)` : ''
        }?`,
      mobile,
      isMobileAnswerInputType: true
    });
    if (isNaN(pointsSpent)) return;
    if (pointsSpent > marksmanPoints) {
      return IO_.notify({
        message: `You do not have ${pointsSpent} Marksman Points.`,
        mobile
      });
    }
    pointsSpent = Math.floor(parseInt(pointsSpent));
    if (!pointsSpent && !minimumPoints) {
      return calculateAndReturn();
    }

    if (pointsSpent > minimumPoints) {
      const neverendingResourcesActive =
        Generic_.doesValueExist('Neverending Resources', 'Passives')
          && pointsSpent >= 10;
      if (neverendingResourcesActive) {
        IO_.notify({
          message: 'You gain 5 Marksman Points back from Neverending Resources',
          mobile
        });
      }
      trackHistory({
        ...marksmanPointsData,
        value: -pointsSpent + (neverendingResourcesActive ? 5 : 0),
        relative: true
      });
    } else if (pointsSpent) {
      IO_.notify({
        message: `No Marksman Points shall be spent, as you have a minimum of ${minimumPoints})`,
        mobile
      });
    }

    const [rolls, dice] = secondaryEffect.split('d');
    return calculateAndReturn(
      `${Math.max(pointsSpent, minimumPoints) * rolls}d${dice} + ${mainEffect}`
    );
  },
  applyTrapExtraCosts: ({ spellName, trapMaterials, memory, mobile }) => {
    const Generic_ = Generic(), IO_ = IO();
    let { materialCost } = memory;
    const hasSnaringProficiency = Generic_.doesValueExist('Snaring Proficiency', 'Passives');
    const calculateCost = (cost) => hasSnaringProficiency ? cost / 2 : cost;
    const trapData = {
      'Impulse': { cost: calculateCost(10), effect: 'Knocks targets away' },
      'Incendiary': { cost: calculateCost(20), effect: 'Causes extra Fire damage' },
      'Toxin': { cost: calculateCost(30), effect: 'Applies the Poison condition' },
      'Dazing': { cost: calculateCost(40), effect: 'Gives advantage on attacks' },
      'Tar': { cost: calculateCost(40), effect: 'Causes disadvantage on saving throws' },
      'Flare': { cost: calculateCost(50), effect: 'Applies the Incapacitated condition' },
      'Bramble': { cost: calculateCost(50), effect: 'Roots targets in place' },
      'Basilisk': { cost: calculateCost(50), effect: 'Applies the Petrified condition' }
    };
    const getUnavailableOptions = () => {
      return Object.entries(trapData).reduce((total, [trap, { cost }]) => {
        return trapMaterials < materialCost + cost
          ? [...total, trap]
          : total;
      }, []);
    };

    const options = Object.keys(trapData);
    let excludeOptions = getUnavailableOptions();
    let availableOptionCount = options.filter((option) => {
      return!excludeOptions.includes(option);
    }).length;
    const iterationCap = Generic_.doesValueExist('Salt and Pepper', 'Passives')
      ? 2 :
      1;
    const newLine = IO_.getNewLineChar(mobile);
    for (let iteration = 1; iteration <= iterationCap && availableOptionCount; iteration++) {
      const haltKeyword = `No ${iteration > 1 ? 'further ' : ''}trap enhancement`;
      const extraSpice = IO_.askForAnswerFromList({
        title: `Extra Spice - Trap Materials left: ${trapMaterials - materialCost}sp`,
        message:
          `${
            iterationCap > 1 ? `(${iteration} / ${iterationCap}) ` : ''
          }Do you want to enhance your ${spellName} with any of the following effects?`,
        options: [haltKeyword, ...options],
        optionModifier: (option) => {
          if (option === haltKeyword) return `${option}${newLine}`;
          const { cost, effect } = trapData[option];
          return `${option}: ${effect} (${cost % 10 ? `${cost}sp` : `${cost / 10}gp`})`;
        },
        excludeOptions,
        mobile
      });
      if (!extraSpice) return;
      if (extraSpice === haltKeyword) break;
      materialCost += trapData[extraSpice].cost;
      excludeOptions = [...new Set([
        ...excludeOptions,
        ...getUnavailableOptions(),
        extraSpice
      ])];
      availableOptionCount = options.filter((option) => {
        return!excludeOptions.includes(option);
      }).length;
    }

    const usePassive = ({ ability, cost, item, effect }) => {
      if (
        !Generic_.doesValueExist(ability, 'Passives')
          || trapMaterials < materialCost + cost
      ) return true;
      const isUsing = IO_.askForYesOrNo({
        title: `${ability} - Trap Materials left: ${trapMaterials - materialCost}sp`,
        message: `Do you want to use ${item} to ${effect}? (${
          cost % 10 ? `${cost}sp` : `${cost / 10}gp`
        })`,
        mobile
      });
      if (isUsing === undefined) return;
      if (isUsing) materialCost += cost;
      return true;
    };

    const { value: wisdom = 0 } = Generic_.getNamedRange('WIS_Modifier');
    const flyingTraps = usePassive({
      ability: 'Flying Traps',
      cost: 30,
      item: 'an Iron Casing', 
      effect: `throw your trap up to ${Math.max(wisdom, 1) * 5} feet away`
    });
    if (!flyingTraps) return;
    const universalGizmo = usePassive({
      ability: 'Universal Gizmo',
      cost: 50,
      item: 'a Silver Casing', 
      effect: 'ignore all terrain requirements'
    });
    if (!universalGizmo) return;

    memory.materialCost = materialCost;
    return true;
  },
  resetInstantPitfall: ({ trackHistory }) => Helper().resetTracker({
    spellName: 'Instant Pitfall',
    sheet: 'Actions',
    trackHistory
  }),
  setShadowedEscape: ({ trackHistory }) => Helper().setTracker({
    spellName: 'Shadowed Escape',
    sheet: 'Passives',
    trackHistory
  }),
  resetShadowedEscape: ({ trackHistory }) => Helper().resetTracker({
    spellName: 'Shadowed Escape',
    sheet: 'Passives',
    trackHistory
  }),
  trappingCheffEffect: ({ trapMaterials, memory, mobile, trackHistory }) => {
    if (
      !Generic().doesValueExist('Trapping Cheff', 'Passives')
        || memory?.trappingCheffUsed
    ) return true;

    let { materialCost } = memory;
    const trapData = {
      'Woodland Snag': {
        cost: 5,
        effect: 'Deals Bludgeoning damage and knocks prone'
      },
      'Foliage Fetter': {
        cost: 10,
        effect: 'Deals Psychic damage and reveals resistances, immunities and AC'
      },
      'Explosive Caltrops': {
        cost: 20,
        effect: 'Deals fire damage in the surrounding area'
      },
      'Dense Foliage': {
        cost: 3,
        effect: 'Allowing you to make Stealth (DEX) checks during combat with advantage.'
      },
      'Landmine': {
        cost: 100,
        effect: 'Deals Piercing damage that can be increased via spending Marksman Points'
      }
    };
    const options = Object.keys(trapData);
    const excludeOptions = Object.entries(trapData).reduce((total, [trap, { cost }]) => {
      return trapMaterials < materialCost + cost
        ? [...total, trap]
        : total;
    }, []);
    if (!options.filter((option) => !excludeOptions.includes(option)).length) {
      return true;
    }

    const IO_ = IO();
    const haltKeyword = 'No bonus Trap';
    const newLine = IO_.getNewLineChar(mobile);
    const bonusTrap = IO_.askForAnswerFromList({
      title: `Trapping Cheff - Trap Materials left: ${trapMaterials - materialCost}sp`,
      message: 'Select a bonus Trap to cast within your single Action',
      options: [haltKeyword, ...options],
      optionModifier: (option) => {
        if (option === haltKeyword) return `${option}${newLine}`;
        const { cost, effect } = trapData[option];
        return `${option}: ${effect} (${cost % 10 ? `${cost}sp` : `${cost / 10}gp`})`;
      },
      excludeOptions,
      mobile
    });
    if (!bonusTrap) return;
    if (bonusTrap === haltKeyword) return true;

    memory.trappingCheffUsed = true;
    const type = 'actions';
    const customConfig = {
      [type]: () => ({
        [bonusTrap]: () => ({
          skipActionCost: true,
          apply: false,
          hookMemory: memory,
          trackHistory
        })
      })
    };
    Controller().useCommand({
      command: bonusTrap,
      type,
      selectedClass: 'Pathfinder',
      customConfig,
      mobile
    });
    return true;
  },
  onKillingBlow: () => {
    const Generic_ = Generic();
    if (!Generic_.doesValueExist('Lethal Momentum', 'Passives')) return;
    return ({ killingBlows, trackHistory }) => {
      if (killingBlows <= 0) return true;
      return trackHistory({
        ...Generic_.getNamedRange('Action'),
        value: true
      });
    };
  },
  // Abstract methods
  abstractAttack: (options = {}) => {
    const Generic_ = Generic(), Helper_ = Helper(), Pathfinder_ = Pathfinder();
    return Helper_.abstractUseAbility({
      attackAdvantage: Generic_.getNamedRange('Unaware').value ? 1 : 0,
      beforeHitCalculation: () => {
        if (
          Generic_.doesValueExist('Phantom Assault', 'Passives')
            && Generic_.getNamedRange('Surprise').value
        ) return { hit: null };
        return true;
      },
      onMainSuccess: ({ spellName, targetsHit, trackHistory }) => {
        const oneWithTheShadowsActive = Helper_.getTracker('One with the Shadows', 'Bonus Actions');
        if (spellName === 'Aimed Barrage') {
          return Pathfinder_.gainMarksmanPoints(
            trackHistory,
            3 * (oneWithTheShadowsActive ? targetsHit : 1)
          );
        }
        if (['Fiery Salvo', 'Spray and Pray'].includes(spellName)) {
          return Pathfinder_.gainMarksmanPoints(trackHistory, targetsHit);
        }
        if (
          Inventory().checkWeaponAttribute({ attribute: 'ranged' })
          && (
            Generic_.getNamedRange('Hidden').value
              || Generic_.doesValueExist("Reaper's Vigor", 'Passives')
          )
        ) {
          return Pathfinder_.gainMarksmanPoints(
            trackHistory,
            oneWithTheShadowsActive ? targetsHit : 1
          );
        }
        return true;
      },
      ...(Helper_.getTracker('One with the Shadows', 'Bonus Actions') && {
        aoe: true,
        skipAmmo: true
      }),
      options
    });
  },
  abstractChildOfNature: (options = {}) => Helper().abstractUseAbility({
    onUse: ({ mobile }) => {
      const itemName = 'Tinderbox';
      if (Pathfinder().getItemCount(itemName, mobile)) return true;
      return IO().notify({
        message: `You need a ${itemName} for Child of Nature.`,
        mobile
      });
    },
    options
  }),
  abstractDeadlyFlourish: (options = {}) => {
    const Generic_ = Generic(), Pathfinder_ = Pathfinder();
    return Pathfinder_.abstractAttack({
      melee: true,
      skipSecondaryEffect: true,
      onUse: Pathfinder_.setShadowedEscape,
      afterHitCalculation: [
        ({ mainEffect }) => {
          if (
            !Generic_.doesValueExist("Assassin's Guile", 'Passives')
              || (Generic_.getNamedRange('Points').value || 0) < 5
          ) return true;
          const [
            { value: level = 1 },
            { value: strength = 0 }
          ] = Generic_.getNamedRange(['Level', 'STR_Modifier']);
          const strengthResult = Math.min(2 * (strength + 2), 12);
          const assassinsGuileEffect = `${
            4 + [12, 16, 19].filter((item) => item <= level).length
          }${strengthResult < 4 ? '' : `d${strengthResult}`}`;
          return { mainEffect: `${assassinsGuileEffect} + ${mainEffect}` };
        },
        ({ mainEffect }) => {
          if (
            !Generic_.doesValueExist('Silent Assassin', 'Passives')
              || !Generic_.getNamedRange('Unaware').value
          ) return true;
          const [
            { value: level = 1 },
            { value: strength = 0 }
          ] = Generic_.getNamedRange(['Level', 'STR_Modifier']);
          const strengthResult = Math.min(2 * (strength + 1), 12);
          const silentAssassinEffect = `${
            level < 19 ? 10 : 14
          }${strengthResult < 4 ? '' : `d${strengthResult}`}`;
          return { mainEffect: `${silentAssassinEffect} + ${mainEffect}` };
        },
        Pathfinder_.marksmanPointsCalculation
      ],
      ...options
    });
  },
  abstractTrap: (options = {}) => Helper().abstractUseAbility({
    delayedEffect: !['Dense Foliage', 'Obscuring Mound'].includes(options.spellName),
    onUse: ({ spellName, memory, mobile, trackHistory }) => {
      const Pathfinder_ = Pathfinder();
      let { materialCost: totalMaterialCost = 0 } = memory;
      const { materialCost = 0 } = options;
      totalMaterialCost += materialCost;
      const trapMaterials = Pathfinder_.getItemCount('Trap Material', mobile);
      if (trapMaterials === null) return;
      if (trapMaterials < totalMaterialCost) {
        return IO().notify({
          message: `You don't have enough Trap Materials in your Inventory (you have ${
            trapMaterials
          } out of ${totalMaterialCost}).`,
          mobile
        });
      }
      memory.materialCost = totalMaterialCost;

      if (!Pathfinder_.applyTrapExtraCosts({ spellName, trapMaterials, memory, mobile })) return;
      if (!Pathfinder_.trappingCheffEffect({ trapMaterials, memory, mobile, trackHistory })) return;
      if (memory?.materialsRemoved) return true;

      memory.materialsRemoved = true;
      Inventory().removeItem({
        itemName: 'Trap Material',
        count: memory.materialCost,
        deleteOnZero: false,
        apply: false,
        skipOutput: true,
        trackHistory
      });
      return Pathfinder_.resetInstantPitfall({ trackHistory });
    },
    options
  }),
  abstractTrapTrigger: (options = {}) => {
    const Generic_ = Generic();
    return Helper().abstractUseAbility({
      skipActionCost: true,
      onUse: ({ trackHistory }) => {
        if (!Generic_.doesValueExist("Trapmaster's Bounty", 'Passives')) {
          return true;
        }
        return Pathfinder().gainMarksmanPoints(
          trackHistory,
          5 + Math.max(Generic_.getNamedRange('WIS_Modifier').value || 0, 0)
        );
      },
      afterHitCalculation: ({ spellName, mainEffect, mobile }) => {
        const isIncendiary = IO().askForYesOrNo({
          title: spellName,
          message: `Did you enhance your ${
            spellName.replace(' Trigger', '')
          } with the Incendiary effect of Extra Spice?`,
          mobile
        });
        if (isIncendiary === undefined) return;
        if (!isIncendiary) return true;
        const { value: level = 1 } = Generic_.getNamedRange('Level');
        return {
          mainEffect: `${mainEffect} + ${
            3 + [4, 8, 12, 16, 19].filter((item) => item <= level).length
          }d10 Fire`
        };
      },
      options
    });
  },
  abstractFierySalvo: (options = {}) => {
    const Pathfinder_ = Pathfinder();
    return Pathfinder_.abstractAttack({
      ranged: true,
      aoeSecondary: true,
      applyHitToBothEffects: true,
      singleHit: true,
      targetCap: Helper().getTracker('One with the Shadows', 'Bonus Actions')
        ? undefined
        : Generic().getNamedRange('DEX_Modifier').value || 1,
      onSecondarySuccess: ({ targetsHit, trackHistory }) => {
        return Pathfinder_.gainMarksmanPoints(trackHistory, targetsHit);
      },
      ...options
    });
  },
  abstractSnipersFlurry: (options = {}) => Pathfinder().abstractAttack({
    ranged: true,
    skipSecondaryEffect: true,
    afterHitCalculation: ({ secondaryEffect, mobile }) => {
      const feet = IO().notify({
        type: 'inputBox',
        title: "Sniper's Flurry range",
        message: "What's your distance in feet from your target?",
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(feet)) return;
      const [rolls, dice] = secondaryEffect.split('d');
      return {
        mainEffect: `${Math.floor(feet / 5) * rolls}d${dice} + ${mainEffect}`
      };
    },
    ...options
  }),
  // Config
  getButtonConfig: () => {
    const Pathfinder_ = Pathfinder();
    return {
      attributes: () => ({
        'Start Turn': () => ({ onUse: Pathfinder_.resetShadowedEscape }),
        'End Turn': () => ({ onUse: Pathfinder_.resetInstantPitfall }),
        'Short Rest': () => ({
          onUse: ({ trackHistory }) => {
            Helper().restoreAllClassSpellSlots({
              percentageRestored: 0.5,
              trackHistory
            });
            Pathfinder_.resetMarksmanPoints({ trackHistory });
            return Pathfinder_.resetShadowedEscape({ trackHistory });
          }
        }),
        'Long Rest': () => ({
          onUse: [
            Helper().restoreAllClassSpellSlots,
            Pathfinder_.resetMarksmanPoints,
            Pathfinder_.resetShadowedEscape
          ]
        })
      }),
      actions: () => ({
        defaultArguments: { onKillingBlow: Pathfinder_.onKillingBlow() },
        'Main-hand': () => ({ callback: Pathfinder_.abstractAttack }),
        'Unarmed Strike': () => ({ callback: Pathfinder_.abstractAttack }),
        'Child of Nature': () => ({ callback: Pathfinder_.abstractChildOfNature }),
        'Forager': () => ({ delayedEffect: true }),
        'Forager Trigger': () => ({ skipCosts: true, skipActionCost: true, healing: true }),
        'Deadly Flourish': () => ({ callback: Pathfinder_.abstractDeadlyFlourish }),
        'Woodland Snag': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 5 }),
        'Woodland Snag Trigger': () => ({ callback: Pathfinder_.abstractTrapTrigger }),
        'Umbral Cloak': () => ({ checkType: 'Stealth' }),
        'Aimed Barrage': () => ({ callback: Pathfinder_.abstractAttack, ranged: true }),
        'Instant Pitfall': () => ({ onUse: Helper().setTracker, skipActionCost: true }),
        'Foliage Fetter': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 10 }),
        'Foliage Fetter Trigger': () => ({ callback: Pathfinder_.abstractTrapTrigger }),
        'Fiery Salvo': () => ({ callback: Pathfinder_.abstractFierySalvo }),
        'Explosive Caltrops': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 20 }),
        'Explosive Caltrops Trigger': () => ({
          callback: Pathfinder_.abstractTrapTrigger,
          aoe: true
        }),
        "Sniper's Flurry": () => ({ callback: Pathfinder_.abstractSnipersFlurry }),
        'Dense Foliage': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 3 }),
        'Bullseye': () => ({
          callback: Pathfinder_.abstractAttack,
          ranged: true,
          skipSecondaryEffect: true,
          afterHitCalculation: Pathfinder_.marksmanPointsCalculation
        }),
        'Landmine': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 100 }),
        'Landmine Trigger': () => ({
          callback: Pathfinder_.abstractTrapTrigger,
          skipSecondaryEffect: true,
          afterHitCalculation: Pathfinder_.marksmanPointsCalculation
        }),
        'Obscuring Mound': () => ({ callback: Pathfinder_.abstractTrap, materialCost: 20 }),
        'Spray and Pray': () => ({
          callback: Pathfinder_.abstractAttack,
          ranged: true,
          aoe: true
        })
      }),
      bonusActions: () => ({
        defaultArguments: { onKillingBlow: Pathfinder_.onKillingBlow() },
        'Grave Whisper': () => ({}),
        'One with the Shadows': () => ({ onUse: Helper().setTracker })
      }),
      reactions: () => ({
        defaultArguments: { onKillingBlow: Pathfinder_.onKillingBlow() },
        'Opportunity Attack': () => ({ callback: Pathfinder_.abstractAttack })
      }),
      interactions: () => ({
        defaultArguments: { onKillingBlow: Pathfinder_.onKillingBlow() }
      }),
      movement: () => ({
        defaultArguments: { onKillingBlow: Pathfinder_.onKillingBlow() }
      }),
      passives: () => ({
        'Ghostly Barrage': () => ({ checkType: 'Insight' })
      }),
      automation: () => ({
        'Update Attributes Sheet': () => ({
          cacheArguments: { ignoredColumns: Pathfinder_.getExcludedAttributes() }
        }),
        'Update Actions Sheet': () => ({ onFormat: Pathfinder_.onActionsFormat }),
        'Generate Variables': () => ({ excludedVariables: Pathfinder_.getExcludedAttributes() }),
        'Generate Cache': () => ({
          ignoredColumns : { attributes: Pathfinder_.getExcludedAttributes() }
        }),
        'Level Up': () => ({ onLevelUp: Pathfinder_.onLevelUp })
      })
    };
  },
  getCacheConfig: () => {
    const baseTrapConfig = [
      { deletions: ['hit', 'mainEffect', 'secondaryEffect'] },
      { version: 'Trigger', deletions: ['slotCost'] }
    ];
    return {
      actions: {
        'Forager': [
          { deletions: ['mainEffect'] },
          { version: 'Trigger', deletions: ['slotCost'] }
        ],
        'Woodland Snag': baseTrapConfig,
        'Foliage Fetter': baseTrapConfig,
        'Explosive Caltrops': baseTrapConfig,
        'Landmine': baseTrapConfig
      }
    };
  }
});
