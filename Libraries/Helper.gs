const _helperPrivate = () => ({
  useAbility: ({
    spellName,
    outputName,
    type = 'Action',
    cost = 1,
    attacks = 1,
    melee = false,
    ranged = false,
    aoe = false,
    aoeMain = false,
    aoeSecondary = false,
    applyHitToBothEffects = false,
    singleHit = false,
    healing = false,
    healingMain = false,
    healingSecondary = false,
    stopOnAttackFail = false,
    stopOnHitFail = false,
    delayedEffect = false,
    skipCosts = false,
    skipActionCost = false,
    skipAmmo = false,
    skipMainEffect = false,
    skipSecondaryEffect = false,
    isOffHand = false,
    apply = true,
    attackAdvantage = 0,
    mainEffectAdvantage = 0,
    secondaryEffectAdvantage = 0,
    criticalThreshold = 20,
    criticalDamageCalculator = (number, critical) => (critical ? 2 : 1) * number,
    multiplier = 1,
    onFailMultiplier = 0,
    checkType,
    checkTypeMain,
    checkTypeSecondary,
    healMainEffectModifier = 0,
    healSecondaryEffectModifier = 0,
    healthAttributeOverwrite = 'HP',
    temporaryMainEffectModifier = 0,
    temporarySecondaryEffectModifier = 0,
    temporaryAttributeOverwrite = 'Temp',
    targetCap,
    targetsHit,
    customCost,
    mainEffectOutput,
    secondaryEffectOutput,
    overwriteObject,
    onCheck,
    onHigherCost,
    onUse,
    beforeHitCalculation,
    afterHitCalculation,
    onFail,
    onSuccess,
    onMainSuccess,
    onSecondarySuccess,
    onOutput,
    onKillingBlow,
    hookMemory = {},
    mobile = false,
    trackHistory,
    changes = []
  }) => {
    const Generic_ = Generic(), IO_ = IO();
    const outputSpellName = outputName || spellName;
    const spellTypeData = Generic_.getNamedRange(type.replace(' ', '_'));
    const notify = (options = {}) => {
      return IO_.notify({
        ...(!['toast', undefined].includes(options.type) && { title: outputSpellName }),
        mobile,
        ...options
      });
    };
    if (!skipActionCost && spellTypeData.value === false) {
      return notify({ message: `You have already used a(n) ${type} this turn.` });
    }

    const Inventory_ = Inventory();
    Generic_.refreshSheet('Inventory');
    if (melee || ranged) {
      const { validation, outputMessage } = Inventory_.validateWeapon({ melee, ranged, type });
      if (!validation) return notify({ message: outputMessage });
    }

    const Parse_ = Parse(), History_ = History();
    if (!trackHistory) {
      trackHistory = (newChanges) => History_.trackHistory(changes, newChanges);
    }
    const sheet = ['action', 'passive'].some((sheet) => type.toLowerCase().includes(sheet))
      ? `${type}s`
      : type;
    if (!skipAmmo) {
      const ammo = Parse_.getValue(sheet, spellName, 'ammo');
      if (ammo && ammo !== '-') {
        const { value: equippedWeapon } = Generic_.getNamedRange(isOffHand ? 'Off_hand' : 'Main_hand');
        if (
          equippedWeapon !== '-' && Inventory_.getItemAttribute({
            itemName: equippedWeapon,
            attribute: 'ranged'
          }
        )) {
          if (ammo === 'No ammo') {
            return notify({ message: "Don't forget to pick which ammo you want to use." });
          }
          if (
            Inventory_.getItemAttribute({ itemName: equippedWeapon, attribute: 'ammo' }) !==
            Inventory_.getItemAttribute({ itemName: ammo, attribute: 'ammo' })
          ) return notify({ message: "You're using wrong ammo for this weapon." });
          if (!Inventory_.getItemData({ itemName: ammo, attribute: '#' })) {
            return notify({ message: `You ran out of ${ammo}s.` });
          }
          Inventory_.removeItem({
            itemName: ammo,
            deleteOnZero: false,
            apply: false,
            skipOutput: true,
            mobile,
            trackHistory
          });
        }
      }
    }

    const executeHook = (hook, options = {}) => {
      const allOptions = {
        spellName: outputSpellName,
        sheet,
        memory: hookMemory,
        mobile,
        trackHistory,
        ...options
      };
      for (let callback of Array.isArray(hook) ? hook : [hook]) {
        const hookResult = callback(allOptions);
        if (!hookResult) return;
        Object.assign(hookMemory, hookResult?.memory || {});
      }
      return true;
    };
    if (onCheck && !executeHook(onCheck)) return;

    if (!mainEffectOutput && (healing || healingMain)) {
      mainEffectOutput = 'Healing done';
    }
    if (!secondaryEffectOutput && (healing || healingSecondary)) {
      secondaryEffectOutput = 'Healing done';
    }
    if (checkType || checkTypeMain) {
      const checkName = checkType || checkTypeMain;
      mainEffectOutput = `${checkName} check result`;
      ({ value: mainEffectAdvantage = 0 } = Generic_.getNamedRange(
        `${checkName.replace(' ', '_')}_Check_Advantage`
      ));
    }
    if (checkType || checkTypeSecondary) {
      const checkName = checkType || checkTypeSecondary;
      secondaryEffectOutput = `${checkName} check result`;
      ({ value: secondaryEffectAdvantage } = Generic_.getNamedRange(
        `${checkName.replace(' ', '_')}_Check_Advantage`
      ));
    }
    if (!mainEffectOutput) mainEffectOutput = 'Damage done';
    if (!secondaryEffectOutput) secondaryEffectOutput = 'Damage done';

    let isSuccessfulMain = false, isSuccessfulSecondary = false, isForcedKillingBlow = false;
    let totalTargetsHit = 0;
    const allMainResults = [], allSecondaryResults = [];
    const spellData = overwriteObject || Parse_.getCommandData(spellName, sheet);
    const newLine = IO_.getNewLineChar(mobile);
    const getValueData = (...attributeData) => {
      const ranges = Object.fromEntries(
        Object.entries(spellData || {}).filter(([key]) => {
          return attributeData.includes(key);
        })
      );
      return Object.fromEntries(
        Object.entries(ranges).map(([key, range]) => {
          return [key, Generic_.getValue(range, sheet)];
        })
      );
    };
    const getStateData = (...attributeData) => {
      const ranges = Object.fromEntries(
        Object.entries(spellData || {}).filter(([key]) => {
          return attributeData.includes(key);
        })
      );
      return Object.fromEntries(
        Object.entries(ranges).map(([key, range]) => [
          key,
          { sheet, range, value: Generic_.getValue(range, sheet) }
        ])
      );
    };

    let { hit, mainEffect, secondaryEffect } = getValueData('hit', 'mainEffect', 'secondaryEffect');
    if (applyHitToBothEffects) hit = `${hit}, ${hit}`;

    const askForYesOrNo = (options = {}) => {
      return IO_.askForYesOrNo({ title: outputSpellName, mobile, ...options });
    };
    const askForAnswerFromList = (options = {}) => {
      return IO_.askForAnswerFromList({ title: outputSpellName, mobile, ...options });
    };
    const pickTargetsMobile = (options = {}) => {
      return askForAnswerFromList({ options: [...Array(101).keys()], hideOptions: true, ...options });
    }

    const RPG_ = RPG(), Helper_ = Helper();
    const calculateTotalEffect = () => {
      const onCalculation = (callbacks, attack, options = {}) => {
        for (let callback of Array.isArray(callbacks) ? callbacks : [callbacks]) {
          const calculationResult = callback({
            hit,
            mainEffect,
            secondaryEffect,
            attack,
            spellName: outputSpellName,
            sheet,
            memory: hookMemory,
            mobile,
            trackHistory,
            ...options
          });
          if (!calculationResult) return;

          const {
            hit: hitCalculation,
            mainEffect: mainEffectCalculation,
            secondaryEffect: secondaryEffectCalculation,
            targetsHit: targetsHitCalculation,
            memory = {}
          } = calculationResult;
          if (hitCalculation) hit = hitCalculation
          else if (hitCalculation === null) hit = undefined;
          if (mainEffectCalculation) mainEffect = mainEffectCalculation
          else if (mainEffectCalculation === null) mainEffect = undefined;
          if (secondaryEffectCalculation) secondaryEffect = secondaryEffectCalculation
          else if (secondaryEffectCalculation === null) secondaryEffect = undefined;
          if (targetsHitCalculation) targetsHit = targetsHitCalculation
          else if (targetsHitCalculation === null) targetsHit = undefined;
          Object.assign(hookMemory, memory);
        };
        return true;
      };

      if (delayedEffect) {
        return 'This effect is delayed, calculations should be done at a later stage.';
      }
      const getStartingText = (attack) => `${attacks > 1 ? ` (${attack + 1} / ${attacks}) ` : ''}`;

      const logData = [];
      let hitRollType = hit
        ? (hit.includes(',') ? hit.split(', ') : [hit])
          .map((item) => item.includes('d20') ? 'attack' : 'save')
        : undefined;
      let spellHit = targetsHit || true;
      let effectMessage = '';
      let totalMain = 0, totalSecondary = 0;

      for (let attack = 0; (attack < attacks) && (!stopOnAttackFail || spellHit); attack++) {
        let hitResult = '';
        let critical = false;
        let fail = false;
        let targetsMissed = 0;
        let onSuccessCalled = false;
        if (beforeHitCalculation && !onCalculation(beforeHitCalculation, attack + 1)) return;
        spellHit = targetsHit || true;
        hitRollType = hit
          ? (hit.includes(',') ? hit.split(', ') : [hit])
            .map((item) => item.includes('d20') ? 'attack' : 'save')
          : undefined;

        const prepareForCalculations = (effectType = 'main') => {
          const effect = effectType === 'main' ? mainEffect : secondaryEffect;
          if (Array.isArray(effect)) {
            for (let iteration = 0; iteration < effect.length; iteration++) {
              if (!calculateEffect(effectType, iteration)) return;
            }
          } else if (!calculateEffect(effectType)) return;
          return true;
        };
        const calculateEffect = (effectType = 'main', iteration = 0) => {
          let currentEffect, currentTargets = spellHit;
          const applySuccessHooksAndMessages = ({
            successOptions = {},
            includeMainSuccess = true,
            includeSecondarySuccess = true,
            includeEffectMessage = false,
            includeLogData = false
          } = {}) => {
            if (onSuccess && !onSuccessCalled) {
              if (!executeHook(onSuccess, successOptions)) return;
              onSuccessCalled = true;
            }
            if (
              includeMainSuccess
                && onMainSuccess
                && effectType === 'main'
                && !executeHook(onMainSuccess, successOptions)
            ) return;
            if (
              includeSecondarySuccess
                && onSecondarySuccess
                && effectType === 'secondary'
                && !executeHook(onSecondarySuccess, successOptions)
            ) return;
            if (includeEffectMessage) {
              effectMessage += `${effectMessage ? newLine : ''}${
                (attacks > 1 && !mobile) ? `\u00A0\u00A0\u00A0` : ''
              }${
                effectType === 'main'
                  ? mainEffectOutput
                  : secondaryEffectOutput
              }${critical ? ' (critical)' : ''}${
                includeEffectMessage !== true ? `: ${includeEffectMessage}` : ''
              }`;
            }
            if (includeLogData) {
              logData.push(
                `${outputSpellName} - ${
                  effectType === 'main' ? mainEffectOutput : secondaryEffectOutput
                }${critical ? ' (critical)' : ''}${getStartingText(attack)}${
                  includeLogData !== true ? `:\n${includeLogData}` : ''
                }`
              );
            }
            return true;
          };
          const checkForEffect = (effect, skipCondition) => {
            if (skipCondition) return true;
            if (!effect) {
              if (
                !applySuccessHooksAndMessages({
                  includeMainSuccess: false,
                  includeSecondarySuccess: false
                })
              ) return false;
              return true;
            }
            if (typeof effect === 'object') {
              ({
                effect: currentEffect,
                targets: currentTargets
              } = Array.isArray(effect) ? effect[iteration] : effect);
            } else currentEffect = effect;
          };

          const checkResult = effectType === 'main'
            ? checkForEffect(mainEffect, skipMainEffect)
            : checkForEffect(secondaryEffect, skipSecondaryEffect);
          if (checkResult === true) return true;
          if (checkResult === false) return;

          const effectAoe = aoe
            || (effectType === 'main' && aoeMain)
            || (effectType === 'secondary' && aoeSecondary);
          const effectHealing = healing
            || (effectType === 'main' && healingMain)
            || (effectType === 'secondary' && healingSecondary);
          const effectSuccess = currentTargets || effectHealing;
          totalTargetsHit += currentTargets || 0;

          let multipliers;
          if (!onFailMultiplier) multipliers = multiplier;
          else if (!effectAoe) multipliers = effectSuccess ? multiplier : onFailMultiplier;
          else if (effectSuccess) {
            multipliers = targetsMissed
              ? [multiplier, onFailMultiplier]
              : onFailMultiplier;
          }

          if (currentEffect === 'Kill') {
            const successOptions = {
              targetsHit: currentTargets
                ? (currentTargets === true ? 1 : currentTargets)
                : 0,
              targetsMissed
            };
            if (
              !applySuccessHooksAndMessages({
                successOptions,
                includeEffectMessage: `Direct kill${effectAoe ? 's' : ''}`
            })) return;
            isForcedKillingBlow = true;
            return true;
          }

          const { result, text } = RPG_.getMultipleDiceResult({
            diceData: currentEffect.toString(),
            advantage: effectType === 'main'
              ? mainEffectAdvantage
              : secondaryEffectAdvantage,
            critical,
            criticalCalculator: criticalDamageCalculator,
            multipliers
          });
          const getResultText = (logging = false) => {
            if (typeof multipliers !== 'object') {
              return `${text}${effectAoe ? `${
                logging ? '\n' : ' to each of '
              }${currentTargets || targetsMissed} target(s)` : ''}`;
            } else {
              return `${text[0]} ${logging ? '=>' : 'to each of'} ${currentTargets} target(s)${
                logging ? '\n' : ' and '
              }${result[1]} ${logging ? '=>' : 'to each of'} ${targetsMissed} target(s)`;
            }
          };

          const totalIncrement = typeof multipliers !== 'object'
            ? result * (currentTargets || targetsMissed)
            : result[0] * currentTargets + result[1] * targetsMissed;
          if (effectType === 'main') totalMain += totalIncrement;
          else totalSecondary += totalIncrement;
          if (!effectSuccess) {
            if (onFailMultiplier && !applySuccessHooksAndMessages({
              includeEffectMessage: getResultText(),
              includeLogData: getResultText(true)
            })) return;
            return true;
          }

          const successOptions = {
            result,
            targetsHit: currentTargets
              ? (currentTargets === true ? 1 : currentTargets)
              : 0,
            targetsMissed
          };
          if (
            !applySuccessHooksAndMessages({
              successOptions,
              includeEffectMessage: getResultText(),
              includeLogData: getResultText(true)
            })
          ) return;
          if (effectType === 'main') allMainResults.push(result);
          else allSecondaryResults.push(result);
          return true;
        };

        if (hitRollType) {
          for (let iteration = 0; iteration < hitRollType.length; iteration++) {
            const allHits = hit.toString().split(', ');
            const currentHit = allHits[iteration];
            const isSingleHit = !singleHit || !iteration;
            if (isSingleHit) {
              critical = false;
              fail = false;
              hitResult = '';
            }
            targetsMissed = 0;
            spellHit = targetsHit || true;

            if (hitRollType[iteration] === 'attack' && isSingleHit) {
              ({
                critical,
                fail,
                text: hitResult
              } = RPG_.getMultipleDiceResult({
                diceData: currentHit,
                advantage: attackAdvantage,
                criticalThreshold
              }));
              if (critical || fail) {
                notify({ message: `Your attack was a Critical ${critical ? 'Hit' : 'Miss'}.` });
              }
              logData.push(`${outputSpellName} - Attack${getStartingText(attack)}:\n${hitResult}`);
            }
            if (hitRollType[iteration] === 'save') hitResult = currentHit;

            const isAoe = aoe || (
              hitRollType.length > 1
                ? (iteration ? aoeSecondary : aoeMain)
                : aoeMain
              || aoeSecondary
            );
            if (fail) {
              spellHit = false;
              if (onFailMultiplier) targetsMissed = 1;
            } else if (isAoe || !critical) {
              if (!spellHit || spellHit === true) {
                const startMessage = `${getStartingText(attack)}Your ${
                  hitRollType[iteration] === 'attack'
                    ? `attack roll is ${hitResult}`
                    : `${isAoe ? 'targets have' : 'target has'} to make a ${hitResult} save DC`
                }. `
                const aoeQuestionMessage = `${startMessage}How many targets did you hit${
                  targetCap ? ` (up to ${targetCap})` : ''
                }?`;
                const singleQuestionMessage = `${startMessage}Was it a successful hit ?`;
                spellHit = isAoe
                  ? mobile
                    ? pickTargetsMobile({ message: aoeQuestionMessage })
                    : notify({ type: 'inputBox', message: aoeQuestionMessage })
                  : askForYesOrNo({ message: singleQuestionMessage });
              }
              if (spellHit === '' || spellHit === 'cancel') return;
              if (spellHit === false && onFailMultiplier) targetsMissed = 1;
              if (typeof spellHit !== 'boolean') {
                if (isNaN(spellHit)) return;
                spellHit = Math.max(parseInt(spellHit || 0), 0);
              }
              if (targetCap && isAoe && spellHit > targetCap) {
                return notify({
                  message: `Cannot target ${spellHit} targets, as you're capped at ${targetCap}.`
                });
              }
            }
            if (isAoe && onFailMultiplier && !critical) {
              const missedMessage = `${getStartingText(attack)}And how many targets did you miss for ${
                hitRollType[iteration] === 'attack'
                  ? `your ${hitResult} attack roll`
                  : `your targets' ${currentHit} save DCs`
              }?`;
              targetsMissed = mobile
                ? pickTargetsMobile({ message: missedMessage })
                : notify({ type: 'inputBox', message: missedMessage })
              if (targetsMissed === '' || isNaN(targetsMissed)) return;
              targetsMissed = Math.max(parseInt(targetsMissed || 0), 0);
            }

            if (!spellHit && onFail && !executeHook(onFail)) return;
            const successCondition = spellHit || healing;
            effectMessage += `${attack + iteration ? newLine : ''}${
              getStartingText(attack)
            }${spellHit || healing ? 'S' : 'Uns'}uccessful ${
              hitRollType[iteration] === 'attack'
                ? 'attack roll:'
                : 'hit for save DC:'
            } ${hitResult}`;
            if (
              !successCondition
                && (iteration || !healingMain)
                && !targetsMissed
                && (hitRollType.length === 1 || stopOnHitFail)
            ) break;

            const calculationTargets = typeof spellHit === 'boolean'
              ? (spellHit ? 1 : 0)
              : parseInt(spellHit);
            if (afterHitCalculation && !onCalculation(
              afterHitCalculation,
              attack + 1,
              { targetsHit: calculationTargets }
            )) return;
            if (hitRollType.length > 1) {
              if (!prepareForCalculations(iteration ? 'secondary' : 'main')) return;
            } else {
              if (!prepareForCalculations('main')) return;
              if (!prepareForCalculations('secondary')) return;
            }
          };
        } else {
          if ((aoe || aoeMain || aoeSecondary) && (!spellHit || spellHit === true)) {
            const questionMessage = `How many targets did you hit${
              targetCap ? ` (up to ${targetCap})` : ''
            }?`;
            spellHit = mobile
              ? pickTargetsMobile({ message: questionMessage })
              : notify({ type: 'inputBox', message: questionMessage });
          }
          if (afterHitCalculation && !onCalculation(afterHitCalculation, attack + 1)) return;
          if (!prepareForCalculations('main')) return;
          if (!prepareForCalculations('secondary')) return;
        }
      }

      if (totalMain) isSuccessfulMain = true;
      if (totalSecondary) isSuccessfulSecondary = true;
      Helper_.heal({
        amount: totalMain * healMainEffectModifier +
          totalSecondary * healSecondaryEffectModifier,
        attributeOverwrite: healthAttributeOverwrite,
        trackHistory
      });
      Helper_.gainTemporaryHealth({
        amount: totalMain * temporaryMainEffectModifier +
          totalSecondary * temporarySecondaryEffectModifier,
        attributeOverwrite: temporaryAttributeOverwrite,
        trackHistory
      });
      Helper_.logRollHistory(logData);

      let hasMainTotal = false;
      if (mainEffect && (
        aoe || aoeMain || attacks > 1 || typeof mainEffect === 'object'
      )) {
        hasMainTotal = true;
        effectMessage += `${newLine}${newLine}Total ${mainEffectOutput} is ${totalMain}`;
      }
      if (secondaryEffect && (
        aoe || aoeSecondary || attacks > 1 || typeof secondaryEffect === 'object'
      )) {
        effectMessage += `${newLine}${hasMainTotal ? '' : newLine}Total ${
          secondaryEffectOutput
        } is ${totalSecondary}`;
      }
      return effectMessage;
    };
    const useAbility = () => {
      if (!skipActionCost) trackHistory({ ...spellTypeData, value: false });
      if (onUse && !executeHook(onUse)) return;
      const effectMessage = calculateTotalEffect();
      if (effectMessage === undefined) return;
      const shortMessage = !effectMessage || delayedEffect;

      let trackKillingBlow = true;
      const totalTargetsFromEffects = [mainEffect, secondaryEffect].reduce((total, effect) => {
        if (typeof effect !== 'object') return total;
        return total + (Array.isArray(effect) ? effect : [effect])
          .forEach((total, { targets = 1 }) => total + targets, 0);
      }, 0);
      const isAoE = aoe || aoeMain || aoeSecondary || totalTargetsFromEffects > 1;
      let customOutput = '';
      if (onOutput) {
        for (let callback of (Array.isArray(onOutput) ? onOutput : [onOutput])) {
          const outputResult = callback({
            spellName: outputSpellName,
            mainResult: allMainResults.length
              ? (allMainResults.length === 1 ? allMainResults[0] : allMainResults)
              : undefined,
            secondaryResult: allSecondaryResults.length
              ? (allSecondaryResults.length === 1 ? allSecondaryResults[0] : allSecondaryResults)
              : undefined,
            sheet,
            memory: hookMemory,
            mobile,
            trackHistory
          });
          if (typeof outputResult === 'string') customOutput += outputResult;
          else {
            if (!outputResult) return;
            const { text, killingBlow, skipKillingBlow, memory = {} } = outputResult;
            if (!text && text !== '') return;
            if (killingBlow) isForcedKillingBlow = true;
            if (skipKillingBlow) trackKillingBlow = false;
            customOutput += text;
            Object.assign(hookMemory, memory);
          }
        }
      }

      trackKillingBlow = trackKillingBlow && onKillingBlow && (
        isForcedKillingBlow || (
          !healing && !checkType && (
            (isSuccessfulMain && !healingMain && !checkTypeMain) ||
            (isSuccessfulSecondary && !healingSecondary && !checkTypeSecondary)
          )
        )
      );
      const title = `${shortMessage ? 'Successfully u' : 'U'}sed ${outputSpellName}`;
      const killingBlowMessage = `${newLine}${newLine}${
        isAoE
          ? 'How many killing blows did you achieve'
          : 'Was it a killing blow'
      }?`;
      const message = `${effectMessage}${customOutput}${
        trackKillingBlow && !isForcedKillingBlow
          ? killingBlowMessage
          : ''
      }`;

      let answer = isAoE
        ? (trackKillingBlow && !isForcedKillingBlow && mobile)
          ? pickTargetsMobile({ title, message })
          : notify({
              type: (trackKillingBlow && !isForcedKillingBlow)
                ? 'inputBox'
                : (effectMessage ? 'msgBox' : 'toast'),
              ...((trackKillingBlow || effectMessage) && { title }),
              message
            })
        : (trackKillingBlow && !isForcedKillingBlow)
          ? askForYesOrNo({ title, message })
          : notify({
            type: effectMessage ? 'msgBox' : 'toast',
            ...(effectMessage && { title }),
            message: effectMessage
              ? message
              : `${title}${customOutput ? `. ${customOutput}` : ''}`
          });

      if (trackKillingBlow && !isForcedKillingBlow && isNaN(answer)) return;
      if (typeof answer === 'boolean') answer = answer ? 1 : 0;
      if (trackKillingBlow && !executeHook(
        onKillingBlow,
        { killingBlows: isForcedKillingBlow ? totalTargetsHit : parseInt(answer) }
      )) return;
      if (apply) History_.applyChanges(changes);
    };
    const checkForCost = () => {
      const notifyData = [];
      const { currentSlots } = getStateData('currentSlots');
      const {
        slotCost,
        slotType,
        healthCost
      } = getValueData('slotCost', 'slotType', 'healthCost');
      if (skipCosts || (
        !currentSlots && !slotCost && !healthCost && !customCost
      )) return useAbility();

      const executeHigherSlotsHook = () => {
        const getHigherSlots = () => {
          const slotTypes = ['1st', '2nd', '3d'];
          const higherSlots = [];
          let lookForMoreSlots = true;
          for (let slot = parseInt(slotType[0]) + 1; lookForMoreSlots; slot++) {
            const [
              currentSlots,
              maxSlots
            ] = Generic_.getNamedRange([`Slots_${slot}`, `Max_Slots_${slot}`]);
            if (currentSlots.range && maxSlots.range) {
              higherSlots.push({
                currentSlots,
                maxSlots,
                slotType: slotTypes[slot - 1] || `${slot}th`
              });
            }
            else lookForMoreSlots = false;
          }
          if (
            !higherSlots.length || !higherSlots.reduce((total, { currentSlots }) => {
              return total || currentSlots.value;
            }, false)
          ) return [];
          return higherSlots;
        };
        const execute = (callbacks, cost) => {
          for (let callback of Array.isArray(callbacks) ? callbacks : [callbacks]) {
            const higherSlotResult = callback({
              cost,
              hit,
              mainEffect,
              secondaryEffect,
              spellName: outputSpellName,
              sheet,
              memory: hookMemory,
              mobile,
              trackHistory
            });
            if (!higherSlotResult) return;

            const {
              aoe: aoeResult,
              targetCap: targetCapResult,
              targetsHit: targetsHitResult,
              hit: hitResult,
              mainEffect: mainEffectResult,
              secondaryEffect: secondaryEffectResult,
              memory = {}
            } = higherSlotResult;
            if (aoeResult !== undefined) aoe = aoeResult;
            if (targetCapResult !== undefined) targetCap = targetCapResult;
            if (targetsHitResult !== undefined) targetsHit = targetsHitResult;
            if (hitResult) hit = hitResult;
            else if (hitResult === null) hit = undefined;
            if (mainEffectResult) mainEffect = mainEffectResult;
            else if (mainEffectResult === null) mainEffect = undefined;
            if (secondaryEffectResult) secondaryEffect = secondaryEffectResult;
            else if (secondaryEffectResult === null) secondaryEffect = undefined;
            Object.assign(hookMemory, memory);
          };
          return true;
        };

        const higherSlots = getHigherSlots();
        if (!higherSlots.length) return true;
        const haltKeyword = 'Do not use higher slot';
        const higherSlotAnswer = askForAnswerFromList({
          title: `${outputSpellName} higher cost`,
          message: `Do you want to spend a higher spell slot to cast ${outputSpellName}?`,
          options: [haltKeyword, ...higherSlots.map(({ slotType }) => slotType)],
          excludeOptions:
            higherSlots.reduce((total, { currentSlots, slotType }) => {
              return currentSlots.value ? total : [...total, slotType];
            }, []),
          optionModifier: (option) => {
            if (option === haltKeyword) {
              return `${option}: Just ${slotType}${newLine}`;
            }
            const {
              currentSlots,
              maxSlots
            } = higherSlots.find(({ slotType }) => option === slotType);
            return `${option}: (${currentSlots.value} / ${maxSlots.value})`;
          }
        });
        if (!higherSlotAnswer || higherSlotAnswer === 'cancel') return;
        if (higherSlotAnswer === haltKeyword) return true;
        if (!execute(onHigherCost, parseInt(higherSlotAnswer[0]))) return;
        return true;
      };

      if (onHigherCost && slotType && !executeHigherSlotsHook()) return;
      let meetsCostRequirements = true;
      if (currentSlots) {
        if (currentSlots.value >= cost) {
          trackHistory({
            ...currentSlots,
            value: -cost,
            relative: true,
            min: 0
          });
        } else {
          notifyData.push(`You have no more spell slots for ${outputSpellName}.`);
          meetsCostRequirements = false;
        }
      }
      if (slotCost) {
        let slotsData = Generic_.getNamedRange(`Slots${slotType ? `_${slotType[0]}` : ''}`);
        if (slotsData.value >= slotCost) {
          trackHistory({
            ...slotsData,
            value: -slotCost,
            relative: true,
            min: 0
          });
        } else {
          notifyData.push(
            `You have no more spell slots ${
              slotType ? `of the ${slotType} level ` : ''
            }for ${outputSpellName}.`
          );
          meetsCostRequirements = false;
        }
      }
      if (healthCost) {
        const currentHealthData = Generic_.getNamedRange('HP');
        if (currentHealthData.value > healthCost) {
          trackHistory({
            ...currentHealthData,
            value: -healthCost,
            relative: true,
            min: 0
          });
        }
        else {
          notifyData.push(`You do not have enough health for ${outputSpellName}.`);
          meetsCostRequirements = false;
        }
      }
      if (customCost) {
        const { costName, currentCostName, onFailNotification } = customCost;
        const currentCostData = Generic_.getNamedRange(currentCostName);
        const { [costName]: cost } = getValueData(costName);
        if (currentCostData.value >= cost) {
          trackHistory({
            ...currentCostData,
            value: -cost,
            relative: true,
            min: 0
          });
        }
        else {
          notifyData.push(onFailNotification);
          meetsCostRequirements = false;
        }
      }

      if (meetsCostRequirements) return useAbility();
      return notify({ message: notifyData.join(' ') });
    };

    checkForCost();
    return changes;
  }
});

var Helper = () => ({
  logRollHistory: (messageData) => History().logRollHistory(
    messageData,
    Parse().getCommandData('Roll History', 'Attributes')
  ),
  resetAllActions: ({ trackHistory, changes = [] } = {}) => {
    const newChanges = Generic()
      .getNamedRange(Static().actionTypes())
      .map((actionData) => ({ ...actionData, value: true }));
    return trackHistory
      ? trackHistory(newChanges)
      : History().trackHistory(changes, newChanges);
  },
  resetSpellSlots: ({ refreshType = 'Short', trackHistory, changes = [] } = {}) => {
    const Parse_ = Parse();
    const newChanges = [];
    Static().actionSheets().forEach((sheet) => {
      Object.keys(Parse_.getSheetData(sheet) || {}).forEach((command) => {
        const currentSlotsState = Parse_.getState(sheet, command, 'currentSlots');
        const { maxSlots, refresh } = Parse_.getValueData(sheet, command, ['maxSlots', 'refresh']);
        if (currentSlotsState && maxSlots && refresh === refreshType) {
          newChanges.push({ ...currentSlotsState, value: maxSlots });
        }
      });
    });
    return trackHistory
      ? trackHistory(newChanges)
      : History().trackHistory(changes, newChanges);
  },
  gainSpellSlot: ({ type, amount = 1, trackHistory, changes = [] } = {}) => {
    if (amount <= 0) return changes;
    const Generic_ = Generic();
    const slotType = type ? `_${type.toString()[0]}` : '';
    const newChange = {
      ...Generic_.getNamedRange(`Slots${slotType}`),
      value: amount,
      relative: true,
      max: Generic_.getNamedRange(`Max_Slots${slotType}`).value
    };
    return trackHistory
      ? trackHistory(newChange)
      : History().trackHistory(changes, newChange);
  },
  restoreAllClassSpellSlots: ({
    slotLimit,
    percentageRestored = 1,
    trackHistory,
    changes = []
  } = {}) => {
    const Generic_ = Generic(), History_ = History();
    if (!slotLimit) {
      const { value: maxSlots } = Generic_.getNamedRange(`Max_Slots`);
      const newChange = {
        ...Generic_.getNamedRange(`Slots`),
        value: Math.ceil(maxSlots * percentageRestored),
        relative: true,
        max: maxSlots
      };
      return trackHistory
        ? trackHistory(newChange)
        : History_.trackHistory(changes, newChange);
    }

    const newChanges = [];
    const currentSlotData = Generic_.getNamedRange(
      Array.from({ length: slotLimit }, (_, i) => `Slots_${i + 1}`)
    );
    const maxSlotData = Generic_.getNamedRange(
      Array.from({ length: slotLimit }, (_, i) => `Max_Slots_${i + 1}`)
    );
    currentSlotData.forEach((slotData, index) => {
      const maxSlots = maxSlotData[index].value || 0;
      newChanges.push({
        ...slotData,
        value: Math.ceil(maxSlots * percentageRestored),
        relative: true,
        max: maxSlots
      });
    });
    return trackHistory
      ? trackHistory(newChanges)
      : History_.trackHistory(changes, newChanges);
  },
  resetDeathSaves: ({ trackHistory, changes = [] } = {}) => {
    const Generic_ = Generic();
    const [
      { sheet: successSheet, range: successRange },
      { sheet: failureSheet, range: failureRange }
    ] = Generic_.getNamedRange(['Death_Save_Successes', 'Death_Save_Failures']);
    const newChanges = ([
      ...Generic_.splitRange(successRange).map((range) => ({ sheet: successSheet, range, value: false })),
      ...Generic_.splitRange(failureRange).map((range) => ({ sheet: failureSheet, range, value: false }))
    ]);
    return trackHistory
      ? trackHistory(newChanges)
      : History().trackHistory(changes, newChanges);
  },
  resetTracker: ({ spellName, sheet, trackHistory, changes = [] }) => {
    const newChange = {
      ...Parse().getState(sheet, spellName, 'tracker'),
      value: false
    };
    return trackHistory
      ? trackHistory(newChange)
      : History().trackHistory(changes, newChange);
  },
  setTracker: ({ spellName, sheet, trackHistory, changes = [] }) => {
    const newChange = {
      ...Parse().getState(sheet, spellName, 'tracker'),
      value: true
    };
    return trackHistory
      ? trackHistory(newChange)
      : History().trackHistory(changes, newChange);
  },
  getTracker: (spellName, sheet) => Parse().getValue(sheet, spellName, 'tracker'),
  resetAllTrackers: ({ exceptions = [], trackHistory, changes = [] }) => {
    const Parse_ = Parse();
    const newChanges = [];
    Static().actionSheets().forEach((sheet) => {
      const sheetData = Parse_.getSheetData(sheet);
      if (!sheetData) return;
      Object.entries(sheetData).forEach(([ability, abilityData]) => {
        if (abilityData.tracker === undefined || exceptions.includes(ability)) {
          return;
        }
        newChanges.push({
          ...Parse_.getState(sheet, ability, 'tracker'),
          value: false
        });
      });
    });
    return trackHistory
      ? trackHistory(newChanges)
      : History().trackHistory(changes, newChanges);
  },
  heal: ({
    amount = 0,
    roundDown = true,
    attributeOverwrite = 'HP',
    trackHistory,
    changes = []
  } = {}) => {
    if (amount <= 0) return changes;
    const Generic_ = Generic();
    const newChange = {
      ...Generic_.getNamedRange(attributeOverwrite),
      value: roundDown ? -Math.round(-amount) : Math.round(amount),
      relative: true,
      max: () => Generic_.getNamedRange('Max_HP').value
    };
    return trackHistory
      ? trackHistory(newChange)
      : History().trackHistory(changes, newChange);
  },
  gainTemporaryHealth: ({
    amount = 0,
    roundDown = true,
    attributeOverwrite = 'Temp',
    trackHistory,
    changes = []
  } = {}) => {
    if (amount <= 0) return changes;
    const newChange = {
      ...Generic().getNamedRange(attributeOverwrite),
      value: roundDown ? -Math.round(-amount) : Math.round(amount),
      relative: true
    };
    return trackHistory
      ? trackHistory(newChange)
      : History().trackHistory(changes, newChange);
  },
  abstractCheck: ({ checkType, isSavingThrow = false, mobile = false }) => {
    const RPG_ = RPG();
    const { modifier, advantage } = Parse().getCheckData(checkType, isSavingThrow);
    const rollResult = RPG_.rollDice({ type: 20, modifier, advantage });
    const title = `${checkType} ${isSavingThrow ? 'Saving Throw' : 'Check'}`;
    const resultText = RPG_.getDiceResultText({ ...rollResult, advantage });
    Helper().logRollHistory(`${title}:\n${resultText}`);
    IO().notify({
      type: 'msgBox',
      title,
      message: `${isSavingThrow ? 'Saving throw': 'Check'} result: ${resultText}`,
      mobile
    });
  },
  abstractUseAbility: ({ options = {}, ...rest } = {}) => {
    const hooks = Static().hooks();
    Object.entries(options).forEach(([option, config]) => {
      if (!hooks.includes(option)) {
        rest[option] = config;
        return;
      }
      const restHook = rest[option];
      if (!restHook) {
        rest[option] = config;
        return;
      }
      const restHookList = Array.isArray(restHook) ? restHook : [restHook];
      rest[option] = [...restHookList, ...(Array.isArray(config) ? config : [config])];
    });
    _helperPrivate().useAbility(rest);
  },
  useCommand: (command, type, buttonConfigs, mobile = false) => {
    const Convert_ = Convert(), Generic_ = Generic();
    const hooks = Static().hooks();
    const normalizeType = (type) => {
      if (type === 'passives') return 'Passive';
      type = Convert_.toPascalCase(type).replace(/([A-Z])/g, ' $1').trim();
      if (type.toLowerCase().includes('action') && type.at(-1) === 's') {
        return type.slice(0, -1);
      }
      return type;
    };
    const customHookBasedMerge = (firstObject, secondObject) => {
      const secondObjectHooks = Object.keys(secondObject).filter((hook) => {
        return hooks.includes(hook);
      });
      if (!secondObjectHooks.length) return { ...firstObject, ...secondObject };

      const mergedObject = { ...firstObject };
      Object.keys(secondObject).forEach((key) => {
        if (!secondObjectHooks.includes(key)) {
          mergedObject[key] = secondObject[key];
          return;
        }
        const firstHook = mergedObject[key] || [];
        const secondHook = secondObject[key];
        mergedObject[key] = [
          ...(Array.isArray(firstHook) ? firstHook : [firstHook]),
          ...(Array.isArray(secondHook) ? secondHook : [secondHook])
        ].filter(Boolean);
      });
      return mergedObject;
    };
    const filterEmptyHooks = (arguments = {}) => {
      return Object.entries(arguments).reduce((total, [option, config]) => {
        if (hooks.includes(option) && Array.isArray(config) && !config.length) {
          return total;
        }
        return { ...total, [option]: config };
      }, {});
    };

    const allCommandData = [];
    let defaultArguments = {}, defaultCallback = Helper().abstractUseAbility;
    const updateValues = (typeData, currentType = type) => {
      const unwrappedTypeData = Generic_.unwrap(typeData);
      const commandData = unwrappedTypeData[command];
      if (unwrappedTypeData.defaultCallback) {
        defaultCallback = unwrappedTypeData.defaultCallback;
      }
      if (unwrappedTypeData.defaultArguments) {
        defaultArguments = customHookBasedMerge(
          defaultArguments,
          unwrappedTypeData.defaultArguments
        );
      }
      if (!commandData) return;
      const unwrappedCommandData = Generic_.unwrap(commandData);
      allCommandData.push({
        type: normalizeType(currentType),
        ...unwrappedCommandData
      });
      return true;
    };

    for (let buttonConfig of buttonConfigs) {
      if (type) {
        const typeData = buttonConfig[type];
        if (typeData) updateValues(typeData);
      } else {
        for (let [type, typeData] of Object.entries(buttonConfig)) {
          if (updateValues(typeData, type)) break;
        }
      }
    }

    if (!allCommandData.length) {
      throw `The command [${command}] does not appear in any config given.`;
    }
    const {
      callback = defaultCallback,
      ...arguments
    } = allCommandData.reduce((total, commandData) => {
      return customHookBasedMerge(total, commandData);
    }, {});
    callback(
      filterEmptyHooks({
        spellName: command,
        ...customHookBasedMerge(defaultArguments, arguments),
        mobile
      })
    );
  }
});
