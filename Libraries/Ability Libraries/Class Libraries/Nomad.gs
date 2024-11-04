var Nomad = () => ({
  // Static
  getMeleeAttacks: () => [
    'Main-hand',
    'Unarmed Strike',
    'Dark Blade',
    'Savage Flurry',
    "Charon's Embrace",
    'Ravage',
    'Crunch',
    'Fury Swipes',
    'Wild Cleave',
    'Bolstering Blow',
    'Retaliate',
    'Opportunity Attack'
  ],
  // Automation
  getSpellNameConfig: () => {
    const Nomad_ =  Nomad();
    return {
      'Form': Nomad_.getFormName(),
      'Crunch': Nomad_.getCrunchName(),
      'Beam Main-hand': `${Nomad_.getBeamName()} Main-hand`,
      'Beam Two-hand': `${Nomad_.getBeamName()} Two-hand`,
      'Beam Off-hand': `${Nomad_.getBeamName()} Off-hand`
    };
  },
  onActionSheetFormat: ({
    sheet,
    grid,
    firstRowSize = 1,
    level,
    path,
  }) => {
    const Data_ = Data();
    if (!level) level = Data_.level();
    if (!path) path = Data_.path();

    const isBonusAction = sheet.getName() === 'Bonus Actions';
    if (!level || !path || level < 3 || path !== 'Wildheart') {
      return true;
    }

    const coloredAbilities = [
      'Vile Crunch',
      'Heavenly Crunch',
      'Fury Swipes',
      'Wild Cleave',
      'Bolstering Blow',
      'Malignant Beam',
      'Angelic Beam'
    ];
    grid.slice(firstRowSize).forEach(([ability], row) => {
      if (coloredAbilities.includes(ability)) {
        sheet
          .getRange(row + firstRowSize + 1, 1, 1, grid[0].length)
          .setBackground(isBonusAction ? '#FFEBB2' : '#C7E0BD');
      }
    });
    return true;
  },
  onLevelUp: ({ nextLevel, path, mobile, trackHistory }) => {
    const Generic_ = Generic();
    if (nextLevel === 5) return { 'Bonus Actions': {} };
    if (nextLevel === 18) {
      trackHistory(['DEX', 'CON'].map((attribute) => {
        return {
          ...Generic_.getNamedRange(attribute),
          value: 4,
          relative: true
        };
      }));
      return true;
    }
    if (nextLevel !== 3 || path !== 'Wildheart') return true;

    const pathType = IO().askForAnswerFromList({
      title: 'Wildheart type',
      message: 'Which "flavor" of your selected [Wildheart] path would you prefer?',
      options: ['Wicked', 'Celestial'],
      optionModifier: (option) => {
        if (option === 'Wicked') {
          return `${option}: Embrace your dark shamanistic aspect, ` +
            'imbued with tribal elements, learning abilities that deal Necrotic damage';
        }
        return `${option}: Embrace your pure, yet ferocious divine essence, ` +
          'learning abilities that deal Radiant damage';
      },
      mobile
    });
    if (!pathType) return;
    if (pathType === 'Wicked') return true;

    const characterSetupData = Generic_.getNamedRange('Character_Setup');
    const characterSetup = JSON.parse(characterSetupData.value || '{}');
    trackHistory({
      ...characterSetupData,
      value: JSON.stringify({
        ...characterSetup,
        abilities: [...(characterSetup?.abilities || []), 'Celestial Form']
      })
    });
    return true;
  },
  // Utilities
  isRadiantPath: () => Generic().getNamedRange('Celestial_Form_Selected').value,
  getFormName: () => `${Nomad().isRadiantPath() ? 'Celestial' : 'Wicked'} Form`,
  getCrunchName: () => `${Nomad().isRadiantPath() ? 'Heavenly' : 'Vile'} Crunch`,
  getBeamName: () => `${Nomad().isRadiantPath() ? 'Angelic' : 'Malignant'} Beam`,
  getStolenAttributes: () => {
    return Generic().getNamedRange(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
      .map((attribute) => `Stolen_${attribute}`));
  },
  getVigilanceSkip: () => Generic().doesValueExist('Vigilance', 'Passives'),
  // Callbacks
  resetSpectralSteed: ({ spellName, trackHistory }) => {
    if (Generic().doesValueExist('Ethereal Charge', 'Passives')) return true;
    const nonOffensiveActions = ['Dash', 'Disengage', 'Dodge', 'Hide', 'Search', 'Help', 'Ready',
      'Use Object', 'Major Skill Check', 'Improvise', 'Spectral Steed', 'Shamanic Insight',
      'Tribal Senses', 'Grave Omen On Kill', 'Penumbral Showdown On Kill', 'Major Equip',
      'Minor Skill Check', 'Agile Reflexes', 'Let Go of Lasso', 'Leader of the Pack',
      'Against all Odds', 'Ready Trigger', undefined];
    if (nonOffensiveActions.includes(spellName)) return true;
    return Helper().resetTracker({
      spellName: 'Spectral Steed',
      sheet: 'Actions',
      trackHistory
    });
  },
  checkForFormAbility: ({ spellName, mobile }) => {
    if (Helper().getTracker('Form', 'Actions')) return true;
    return IO().notify({
      message: `You need to be in ${Nomad().getFormName()} to use ${spellName}.`,
      mobile
    });
  },
  startFormDuration: ({ duration, trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Form_Duration'),
    value: duration,
    relative: true
  }),
  resetFormDuration: ({ trackHistory }) => {
    const Generic_ = Generic();
    trackHistory([
      { ...Generic_.getNamedRange('Temp'), value: 0 },
      { ...Generic_.getNamedRange('Form_Duration'), value: 0 },
      ...Nomad().getStolenAttributes().map((attributeData) => ({ ...attributeData, value: 0 }))
    ]);
    return Helper().resetTracker({
      spellName: 'Form',
      sheet: 'Actions',
      trackHistory
    });
  },
  reduceFormDuration: ({ trackHistory }) => {
    const formDurationData = Generic().getNamedRange('Form_Duration');
    if (formDurationData.value === 1) {
      return Nomad().resetFormDuration({ trackHistory });
    }
    return trackHistory({
      ...formDurationData,
      value: -1,
      relative: true,
      min: 0
    });
  },
  increaseGraveOmenExtensions: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Grave_Omen_Extensions'),
    value: 1,
    relative: true
  }),
  resetGraveOmenExtensions: ({ spellName = '', trackHistory }) => {
    if (spellName.includes('Grave Omen')) return true;
    return trackHistory({
      ...Generic().getNamedRange('Grave_Omen_Extensions'),
      value: 0
    });
  },
  graveOmenKillingBlow: ({ isWildheart, trackHistory }) => {
    const Generic_ = Generic(), Parse_ = Parse(), Nomad_ = Nomad();
    const currentSlotsState = Parse_.getState('Actions', 'Grave Omen', 'currentSlots');
    const { maxSlots, mainEffect, secondaryEffect } = Parse_.getValueData(
      'Actions',
      'Grave Omen',
      ['maxSlots', 'mainEffect', 'secondaryEffect']
    );
    Nomad_.resetGraveOmenExtensions({ trackHistory });
    if (isWildheart) {
      Nomad_.abstractForm({
        spellName: 'Form',
        type: 'Action',
        cost: 0,
        formDuration: 2,
        skipActionCost: true,
        trackHistory
      });
    }
    return trackHistory([
      { ...currentSlotsState, value: 1, relative: true, max: maxSlots },
      {
        ...Generic_.getNamedRange('HP'),
        value: isWildheart ? secondaryEffect : mainEffect,
        relative: true,
        max: () => Generic_.getNamedRange('Max_HP').value
      },
      { ...Generic_.getNamedRange('Grave_Omen_Stacks'), value: 1, relative: true }
    ]);
  },
  essenceFeastHealing: ({ spellName, targetsHit, trackHistory }) => {
    const Generic_ = Generic();
    if (
      !Generic_.doesValueExist('Essence Feast', 'Passives')
        || !Nomad().getMeleeAttacks().some((attack) => spellName.includes(attack))
    ) return true;
    const { value: savageFlurryHeal } = Generic_.getNamedRange('Essence_Feast');
    return Helper().heal({ amount: targetsHit * savageFlurryHeal, trackHistory });
  },
  resetOffensiveRiposteStacks: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Offensive_Riposte_Stacks'),
    value: 0
  }),
  resetDefensiveRiposteStacks: ({ trackHistory }) => trackHistory({
    ...Generic().getNamedRange('Defensive_Riposte_Stacks'),
    value: 0
  }),
  lassoOfDominationCheck: ({ spellName, sheet, mobile }) => {
    const lassoTracker = Helper().getTracker('Lasso of Domination', 'Actions');
    if (!lassoTracker || !['Actions', 'Reactions'].includes(sheet)) {
      return true;
    }
    const freeHandActions = ['Breath Weapon', "Dragon's Eye", 'Dash', 'Disengage', 'Dodge',
      'Ready', 'Ready Trigger', 'Improvise', 'Shamanic Insight', 'Tribal Senses', 'Warcry'];
    if (!freeHandActions.includes(spellName)) {
      return IO().notify({
        message: 'Your main-hand is busy grappling a creature via Lasso of Domination',
        mobile
      });
    }
    return true;
  },
  etherealChargeModifier: ({ spellName, mainEffect, mobile }) => {
    const Generic_ = Generic();
    if (
      !Generic_.doesValueExist('Ethereal Charge', 'Passives')
        || !Nomad().getMeleeAttacks().some((attack) => spellName.includes(attack))
    ) return true;
    const feetTraveled = IO().notify({
      type: 'inputBox',
      title: `Ethereal Charge distance - ${spellName}`,
      message: 'How many feet did you ride before attacking?',
      mobile,
      isMobileAnswerInputType: true
    });
    if (isNaN(feetTraveled)) return;
    return {
      mainEffect: `${
        Math.floor(feetTraveled / 10) *
          Math.max(Generic_.getNamedRange('DEX_Modifier').value || 1, 1)
      } + ${mainEffect}`
    };
  },
  onKillingBlow: () => {
    if (!Generic().doesValueExist('Leader of the Pack', 'Bonus Actions')) {
      return;
    }
    return ({ killingBlows, mobile, trackHistory }) => {
      if (killingBlows <= 0) return true;
      Nomad().abstractLeaderOfThePack({
        spellName: 'Leader of the Pack',
        type: 'Bonus Action',
        skipActionCost: true,
        mobile,
        trackHistory
      });
      return true;
    };
  },
  // Abstract methods
  abstractEstrangedResilienceAction: (options = {}) => Helper().abstractUseAbility({
    onCheck: ({ mobile }) => {
      const [
        { value: rangeFromAlly },
        { value: rangeFromTargetsAlly }
      ] = Generic().getNamedRange(['You', 'Target']);
      if (
        rangeFromTargetsAlly !== 'no enemy'
          && (rangeFromAlly === 'more' || rangeFromAlly > 5)
      ) return true;
      return IO().notify({
        message: `Cannot use ${
          options.spellName
        } as a Bonus Action, unless you have an enemy and no ally within 5 feet of you.`,
        mobile
      });
    },
    options
  }),
  abstractAgileReflexes: (options = {}) => {
    const Helper_ = Helper();
    return Helper_.abstractUseAbility({
      onUse: ({ spellName, sheet, mobile, trackHistory }) => {
        const Generic_ = Generic();
        Helper_.setTracker({ spellName, sheet, trackHistory });
        const { value: level = 1 } = Generic_.getNamedRange('Level');
        if (level < 8) return true;
        const nearbyFoes = IO().notify({
          type: 'inputBox',
          title: 'Agile Reflexes foes',
          message: 'How many foes are within 5 feet of you (capped at 4)?',
          mobile,
          isMobileAnswerInputType: true
        });
        if (isNaN(nearbyFoes)) return;
        return trackHistory({
          ...Generic_.getNamedRange('Agile_Reflexes', { includeFormulas: true }),
          value: formula.replace(/(\+\s*)\d+/, `$1${1 + Math.max(Math.min(nearbyFoes, 4), 0)}`),
          isFormula: true
        });
      },
      options
    });
  },
  abstractForm: (options = {}) => {
    const Helper_ = Helper(), Nomad_ = Nomad();
    return Helper_.abstractUseAbility({
      outputName: Nomad_.getFormName(),
      mainEffectOutput: 'Temporary Hit Points gained',
      onUse: ({ sheet, trackHistory }) => {
        Nomad_.startFormDuration({
          duration: options.formDuration
            || Math.max(Generic().getNamedRange('CHA_Modifier').value || 0, 0) + 1,
          trackHistory
        });
        return Helper_.setTracker({ spellName: 'Form', sheet, trackHistory });
      },
      onSuccess: ({ result, trackHistory }) => trackHistory({
        ...Generic().getNamedRange('Temp'),
        value: result,
        relative: true
      }),
      options
    });
  },
  abstractCrunch: (options = {}) => {
    const Nomad_ = Nomad();
    return Helper().abstractUseAbility({
      outputName: Nomad_.getCrunchName(),
      onCheck: [
        Nomad_.checkForFormAbility,
        ({ spellName, mobile }) => {
          if (Inventory().checkWeaponAttribute({ attribute: 'two-handed' })) {
            return true;
          }
          return IO().notify({
            message: `You need to equip a two-handed weapon first to use ${spellName}.`,
            mobile
          });
        }
      ],
      onSuccess: ({ spellName, mobile, trackHistory }) => {
        const Generic_ = Generic();
        const attributesChosen = [], currentAttributes = {}, stolenAttributes = {};
        const attributes = [
          'Strength',
          'Dexterity',
          'Constitution',
          'Intelligence',
          'Wisdom',
          'Charisma'
        ];
        const abbreviations = attributes.reduce((total, attribute) => {
          const abbreviation = attribute.slice(0, 3).toUpperCase();
          currentAttributes[attribute] = Generic_.getNamedRange(abbreviation).value || 0;
          stolenAttributes[attribute] = Generic_.getNamedRange(`Stolen_${abbreviation}`).value || 0;
          return { ...total, [attribute]: abbreviation };
        }, {});

        const IO_ = IO();
        const iterationCount = 2;
        for (let iteration = 0; iteration < iterationCount; iteration++) {
          const attributeStolen = IO_.askForAnswerFromList({
            title: `${spellName} attributes`,
            message: `(${iteration + 1} / ${iterationCount}) Which attribute would you like to steal?`,
            options: attributes,
            optionModifier: (option) => `${option}${
              currentAttributes[option]
                ? `: ${currentAttributes[option]}${
                  stolenAttributes[option]
                    ? ` (+${stolenAttributes[option]})`
                    : ''
                  }`
                : ''
            }`,
            mobile
          });
          if (!attributeStolen) return;
          stolenAttributes[attributeStolen]++;
          attributesChosen.push(attributeStolen);
        }

        return trackHistory(attributesChosen.map((attribute) => {
          return {
            ...Generic_.getNamedRange(`Stolen_${abbreviations[attribute]}`),
            value: 1,
            relative: true
          };
        }));
      },
      options
    });
  },
  abstractFurySwipes: (options = {}) => Helper().abstractUseAbility({
    attacks: 3,
    onCheck: [
      Nomad().checkForFormAbility,
      ({ spellName, sheet, mobile }) => {
        const Inventory_ = Inventory();
        const isOffHand = sheet === 'Bonus Actions';
        if (
          !Inventory_.checkWeaponAttribute({ attribute: 'two-handed' })
            && Inventory_.checkWeaponAttribute({ attribute: 'weapon', isOffHand })
        ) return true;
        return IO().notify({
          message: `You need to equip a single-handed weapon in your ${
            isOffHand ? 'Off' : 'Main'
          }-hand first to use ${spellName}.`,
          mobile
        });
      }
    ],
    options
  }),
  abstractWildCleave: (options = {}) => Helper().abstractUseAbility({
    aoe: true,
    onCheck: [
      Nomad().checkForFormAbility,
      ({ spellName, sheet, mobile }) => {
        const handType = sheet === 'Bonus Actions'
          ? 'Off-hand'
          : 'Main-hand';
        if (
          !Inventory().checkWeaponAttribute({ attribute: 'two-handed' })
            && Generic().getNamedRange(handType.replace('-', '_')).value === '-'
        ) return true;
        return IO().notify({
          message: `You need to remove your equipped ${handType} weapon first to use ${spellName}.`,
          mobile
        });
      }
    ],
    options
  }),
  abstractBolsteringBlow: (options = {}) => Helper().abstractUseAbility({
    onCheck: [
      Nomad().checkForFormAbility,
      ({ spellName, mobile }) => {
        if (Inventory().checkWeaponAttribute({ attribute: 'shield', isOffHand: true })) {
          return true;
        }
        return IO().notify({
          message: `You need to equip a shield first to use ${spellName}.`,
          mobile
        });
      }
    ],
    onSuccess: ({ result, trackHistory }) => trackHistory({
      ...Generic().getNamedRange('Temp'),
      value: Math.floor(result / 2),
      relative: true
    }),
    options
  }),
  abstractBeam: (options = {}) => {
    const Nomad_ = Nomad();    
    return Helper().abstractUseAbility({
      outputName: `${Nomad_.getBeamName()} ${options.spellName.split('Beam ')[1] || 'Off-hand'}`,
      aoe: true,
      onCheck: Nomad_.checkForFormAbility,
      onCheck: [
        Nomad_.checkForFormAbility,
        ({ spellName, mobile }) => {
          if (!spellName.includes('Two-hand')) return true;
          if (Inventory().checkWeaponAttribute({ attribute: 'two-handed' })) {
            return true;
          }
          return IO().notify({
            message: `You need to equip a two-handed weapon first to use ${spellName}.`,
            mobile
          });
        }
      ],
      options
    });
  },
  abstractGraveOmen: (options = {}) => {
    const Nomad_ = Nomad();
    const { value: extensions } = Generic().getNamedRange('Grave_Omen_Extensions');
    return Helper().abstractUseAbility({
      cost: extensions ? 0 : 1,
      beforeHitCalculation: () => {
        if (extensions) return { hit: null };
        return true;
      },
      onSuccess: Nomad_.increaseGraveOmenExtensions,
      ...(Data().path() === 'Wildheart' ? {
        skipSecondaryEffect: true,
        onKillingBlow: ({ killingBlows, trackHistory }) => {
          if (killingBlows <= 0) return true;
          return Nomad_.graveOmenKillingBlow({ isWildheart: true, trackHistory });
        }
      } : {
        skipMainEffect: true
      }),
      options
    });
  },
  abstractGraveOmenOnKill: (options = {}) => {
    const isWildheart = Data().path() === 'Wildheart';
    return Helper().abstractUseAbility({
      healing: true,
      skipActionCost: true,
      skipMainEffect: isWildheart,
      onUse: ({ trackHistory }) => {
        return Nomad().graveOmenKillingBlow({ isWildheart, trackHistory });
      },
      options
    });
  },
  abstractSpiritFunnel: (options = {}) => {
    const Nomad_ = Nomad();
    return Helper().abstractUseAbility({
      onSuccess: ({ trackHistory }) => {
        Nomad_.abstractForm({
          ...options,
          spellName: 'Form',
          cost: 0,
          formDuration: 2,
          skipActionCost: true,
          trackHistory
        });
        return trackHistory(
          Nomad_.getStolenAttributes().map((attributeData) => {
            return { ...attributeData, value: 3, relative: true };
          })
        );
      },
      options
    });
  },
  abstractLeaderOfThePack: (options = {}) => {
    const Helper_ = Helper();
    return Helper_.abstractUseAbility({
      onUse: Helper_.setTracker,
      options
    });
  },
  abstractAgainstAllOdds: (options = {}) => {
    const Helper_ = Helper();
    return Helper_.abstractUseAbility({
      onUse: ({ spellName, sheet, mobile, trackHistory }) => {
        const { value } = Generic().getNamedRange('You');
        if (!value || value === 5) {
          return IO().notify({
            message: `You need to be Isolated from allies to cast ${spellName}`,
            mobile
          });
        }
        return Helper_.setTracker({ spellName, sheet, trackHistory });
      },
      options
    });
  },
  abstractTransferVitality: (options = {}) => Helper().abstractUseAbility({
    aoe: true,
    onSuccess: ({ targetsHit, mobile, trackHistory }) => {
      const Generic_ = Generic(), IO_ = IO(), Nomad_ = Nomad();
      const nearbyAllies = IO_.notify({
        type: 'inputBox',
        title: 'Transfer Vitality allies',
        message: 'How many allies are within range, other than you?',
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(nearbyAllies) || nearbyAllies < 0) return;
      const stealCount = 2 * targetsHit;
      const divideCount = parseInt(nearbyAllies) + 1;
      const share = Math.floor(stealCount / divideCount);
      const leftovers = stealCount % divideCount;

      const message = nearbyAllies === '0'
        ? `You gain ${share} attributes and AC`
        : share && leftovers
          ? `You${leftovers > 1 ? ` and ${leftovers - 1} all${
              leftovers > 2 ? 'ies' : 'y'} within range` : ''
            } gain ${share + 1} attributes and AC, while the rest ${
              divideCount - leftovers
            } all${divideCount - leftovers > 1 ? 'ies' : 'y'} gain ${share}`
          : `Both you and ${
              share
                ? `${nearbyAllies > 1 ? `all ${nearbyAllies} allies` : `your ally`}`
                : `${leftovers - 1} / ${nearbyAllies} allies`
            } within range gain ${Math.max(share, 1)} attribute${share > 1 ? 's' : ''} and AC`;
      const myShare = share + (leftovers ? 1 : 0);
      const duration = Math.max(Generic_.getNamedRange('CHA_Modifier').value || 1, 1);
      IO_.notify({
        type: 'msgBox',
        title: 'Transfer Vitality attributes',
        message: `${message} for ${duration} turn${duration > 1 ? 's' : ''}.`,
        mobile
      });
      Nomad_.abstractForm({
        ...options,
        spellName: 'Form',
        cost: 0,
        formDuration: 2,
        skipActionCost: true,
        trackHistory
      });
      return trackHistory([
        ...Nomad_.getStolenAttributes(),
        Generic_.getNamedRange('Stolen_AC')
      ].map((attributeData) => {
        return { ...attributeData, value: myShare, relative: true };
      }));
    },
    options
  }),
  abstractRetaliate: (options = {}) => Helper().abstractUseAbility({
    melee: true,
    onSuccess: ({ trackHistory }) => {
      const Generic_ = Generic();
      const changes = [];
      if (Generic_.doesValueExist('Offensive Riposte', 'Passives')) {
        changes.push({
          ...Generic_.getNamedRange('Offensive_Riposte_Stacks'),
          value: 1,
          relative: true
        });
      }
      if (Generic_.doesValueExist('Defensive Riposte', 'Passives')) {
        changes.push({
          ...Generic_.getNamedRange('Defensive_Riposte_Stacks'),
          value: 1,
          relative: true
        });
      }
      if (Generic_.doesValueExist('Frenzied Riposte', 'Passives')) {
        const isFormActive = Helper().getTracker('Form', 'Actions');
        const temporaryHealthState = Generic_.getNamedRange('Temp');
        const { value: frenziedRiposteValue } = Generic_.getNamedRange('Frenzied_Riposte');
        changes.push({
          ...temporaryHealthState,
          value: isFormActive
            ? frenziedRiposteValue
            : Math.max(frenziedRiposteValue, temporaryHealthState.value),
          relative: isFormActive
        });
      }
      if (!changes.length) return true;
      return trackHistory(changes);
    },
    options
  }),
  abstractCharonsEmbrace: (options = {}) => Helper().abstractUseAbility({
    melee: true,
    onUse: Nomad().resetOffensiveRiposteStacks,
    onOutput: ({ mainResult, mobile }) => {
      if (!mainResult) return '';
      const newLine = IO().getNewLineChar(mobile);
      return `${newLine}${newLine}If the remaining health of your target is ${
        Generic().getNamedRange('HP').value || 0
      } or lower, they die.`;
    },
    options
  }),
  abstractPenumbralShowdownOnKill: (options = {}) => Helper().abstractUseAbility({
    skipActionCost: true,
    onUse: ({ trackHistory }) => {
      Nomad().abstractForm({
        ...options,
        spellName: 'Form',
        cost: 0,
        formDuration: 2,
        skipActionCost: true,
        trackHistory
      });
      return true;
    },
    options
  }),
  // Config
  getButtonConfig: () => {
    const Nomad_ = Nomad();
    return {
      attributes: () => ({
        'Start Turn': () => ({
          onUse: ({ trackHistory }) => {
            const Generic_ = Generic(), Helper_ = Helper();
            ['Agile Reflexes', 'Leader of the Pack', 'Against all Odds'].forEach((spellName) => {
              Helper_.resetTracker({
                spellName,
                sheet: 'Bonus Actions',
                trackHistory
              });
            });
            if (!Generic_.doesValueExist('Phantom Ride', 'Passives')) {
              Helper_.resetTracker({
                spellName: 'Phantom Ride',
                sheet: 'Bonus Actions',
                trackHistory
              });
            }
            Nomad_.reduceFormDuration({ trackHistory });
            return Nomad_.resetDefensiveRiposteStacks({ trackHistory });
          }
        }),
        'End Turn': () => ({ onUse: Nomad_.resetOffensiveRiposteStacks }),
        'Short Rest': () => ({
          onUse: [
            Nomad_.resetFormDuration,
            Nomad_.resetGraveOmenExtensions,
            Nomad_.resetOffensiveRiposteStacks,
            Nomad_.resetDefensiveRiposteStacks
          ]
        }),
        'Long Rest': () => ({
          onUse: [
            Nomad_.resetFormDuration,
            Nomad_.resetGraveOmenExtensions,
            Nomad_.resetOffensiveRiposteStacks,
            Nomad_.resetDefensiveRiposteStacks
          ]
        })
      }),
      actions: () => ({
        defaultArguments: {
          onUse: [
            Nomad_.resetSpectralSteed,
            Nomad_.resetGraveOmenExtensions,
            Nomad_.lassoOfDominationCheck
          ],
          afterHitCalculation: Nomad_.etherealChargeModifier,
          onSuccess: Nomad_.essenceFeastHealing,
          onKillingBlow: Nomad_.onKillingBlow()
        },
        'Main-hand': () => ({ onUse: Nomad_.resetOffensiveRiposteStacks }),
        'Spectral Steed': () => ({ onUse: Helper().setTracker }),
        'Shamanic Insight': () => ({ checkType: 'Investigation' }),
        'Tribal Senses': () => ({ checkType: 'Investigation' }),
        'Dark Blade': () => ({
          melee: true,
          healSecondaryEffectModifier: 1,
          healingSecondary: true,
          onUse: Nomad_.resetOffensiveRiposteStacks
        }),
        'Form': () => ({ callback: Nomad_.abstractForm, healing: true }),
        'Crunch': () => ({ callback: Nomad_.abstractCrunch }),
        'Fury Swipes': () => ({ callback: Nomad_.abstractFurySwipes }),
        'Wild Cleave': () => ({ callback: Nomad_.abstractWildCleave }),
        'Beam Main-hand': () => ({ callback: Nomad_.abstractBeam }),
        'Beam Two-hand': () => ({ callback: Nomad_.abstractBeam }),
        'Grave Omen': () => ({ callback: Nomad_.abstractGraveOmen }),
        'Grave Omen On Kill': () => ({ callback: Nomad_.abstractGraveOmenOnKill }),
        'Savage Flurry': () => ({
          melee: true,
          aoe: true,
          onUse: Nomad_.resetOffensiveRiposteStacks
        }),
        'Spirit Funnel': () => ({ callback: Nomad_.abstractSpiritFunnel }),
        'Horrifying Apparition': () => ({}),
        'Lasso of Domination': () => ({ onSuccess: Helper().setTracker }),
        'Ravage': () => ({ aoe: true }),
        'Transfer Vitality': () => ({ callback: Nomad_.abstractTransferVitality }),
        "Charon's Embrace": () => ({ callback: Nomad_.abstractCharonsEmbrace }),
        'Warcry': () => ({ aoe: true }),
        'Penumbral Showdown': () => ({}),
        'Penumbral Showdown On Kill': () => ({ callback: Nomad_.abstractPenumbralShowdownOnKill })
      }),
      bonusActions: () => ({
        defaultArguments: {
          onUse: Nomad_.resetSpectralSteed,
          afterHitCalculation: Nomad_.etherealChargeModifier,
          onSuccess: Nomad_.essenceFeastHealing,
          onKillingBlow: Nomad_.onKillingBlow()
        },
        'Off-hand': () => ({ onUse: Nomad_.resetOffensiveRiposteStacks }),
        'Dash': () => ({ callback: Nomad_.abstractEstrangedResilienceAction }),
        'Disengage': () => ({ callback: Nomad_.abstractEstrangedResilienceAction }),
        'Agile Reflexes': () => ({ callback: Nomad_.abstractAgileReflexes }),
        'Fury Swipes': () => ({ callback: Nomad_.abstractFurySwipes }),
        'Wild Cleave': () => ({ callback: Nomad_.abstractWildCleave }),
        'Bolstering Blow': () => ({ callback: Nomad_.abstractBolsteringBlow }),
        'Beam': () => ({ callback: Nomad_.abstractBeam }),
        'Phantom Ride': () => ({ onUse: Helper().setTracker }),
        'Let Go of Lasso':() => ({
          onUse: ({ trackHistory }) => {
            return Helper().resetTracker({
              spellName: 'Lasso of Domination',
              sheet: 'Actions',
              trackHistory
            });
          }
        }),
        'Leader of the Pack': () => ({ callback: Nomad_.abstractLeaderOfThePack }),
        'Against all Odds': () => ({ callback: Nomad_.abstractAgainstAllOdds })
      }),
      reactions: () => ({
        defaultArguments: {
          skipActionCost: Nomad_.getVigilanceSkip(),
          onUse: [Nomad_.resetSpectralSteed, Nomad_.lassoOfDominationCheck],
          afterHitCalculation: Nomad_.etherealChargeModifier,
          onSuccess: Nomad_.essenceFeastHealing,
          onKillingBlow: Nomad_.onKillingBlow()
        },
        'Retaliate': () => ({ callback: Nomad_.abstractRetaliate })
      }),
      interactions: () => ({
        defaultArguments: { onKillingBlow: Nomad_.onKillingBlow() }
      }),
      movement: () => ({
        defaultArguments: { onKillingBlow: Nomad_.onKillingBlow() }
      }),
      passives: () => ({
        'Strikes of Dread': () => ({ aoe: true }),
        'Grim Resolve': () => ({})
      }),
      automation: () => ({
        'Update Mobile Sheet': () => ({ spellNameConfig: Nomad_.getSpellNameConfig() }),
        'Update Actions Sheet': () => ({ onFormat: Nomad_.onActionSheetFormat }),
        'Update Bonus Actions Sheet': () => ({ onFormat: Nomad_.onActionSheetFormat }),
        'Level Up': () => ({ onLevelUp: Nomad_.onLevelUp })
      })
    };
  },
  getCacheConfig: () => {
    const onKillConfig = [
      {},
      {
        version: 'On Kill',
        deletions: ['currentSlots', 'maxSlots', 'refresh', 'hit']
      }
    ];
    return {
      actions: {
        'Wicked Form': [{ rename: 'Form' }],
        'Celestial Form': [{ rename: 'Form' }],
        'Vile Crunch': [{ rename: 'Crunch' }],
        'Heavenly Crunch': [{ rename: 'Crunch' }],
        'Malignant Beam': [
          { rename: 'Beam Main-hand' },
          { rename: 'Beam Two-hand' }
        ],
        'Angelic Beam': [
          { rename: 'Beam Main-hand' },
          { rename: 'Beam Two-hand' }
        ],
        'Grave Omen': onKillConfig,
        'Penumbral Showdown': onKillConfig
      },
      bonusActions: {
        'Malignant Beam': [{ rename: 'Beam' }],
        'Angelic Beam': [{ rename: 'Beam' }]
      }
    };
  }
});
