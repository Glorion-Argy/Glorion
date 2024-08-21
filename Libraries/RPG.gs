var RPG = () => ({
  roundDown: (value) => -Math.round(-value),
  getAbilityModifier: (score) => Math.max(Math.min(Math.ceil((score - 11) / 2), 5), -5),
  getLevelIncrement: (level, start = 1, increment = 1, levelsArray = [[4, 8, 12, 16, 19]]) => {
    return start + increment * levelsArray[0].filter((item) => item <= level).length;
  },
  getCustomDice: (modifier, dicePower = 0) => {
    const result = Math.min(2 * (modifier + dicePower + 1), 12);
    if (result < 4) return 1;
    else return result;
  },
  getDice: (number, type) => `${number}d${type}`,
  getDamageType: (diceString) => {
    const foundType = diceString.match(
      new RegExp(Static().damageTypes().map((type) => `(${type})`).join('|'))
    );
    if (!foundType) return;
    return diceString.substring(foundType.index);
  },
  splitDiceStringByType: (diceString) => {
    let start = 0;
    const substrings = [], indexes = [];
    for (let splitWord of Static().damageTypes()) {
      let lastIndex = -1;
      while ((lastIndex = diceString.indexOf(splitWord, lastIndex + 1)) !== -1) {
        indexes.push(lastIndex + splitWord.length - 1);
      }
    }

    for (let index of indexes.sort((a, b) => a - b)) {
      let substring = diceString.substring(start, index + 1).trim();
      if (substring[0] === '+') substring = substring.slice(1).trim();
      else if (substring[0] === '-') substring = `0${substring}`;
      if (substring.startsWith('and')) {
        substrings[substrings.length - 1] = `${substrings.at(-1)} ${substring}`;
      } else if (substring !== '') substrings.push(substring);
      start = index + 1;
    }
    const lastSubstring = diceString.substring(start).trim();
    if (lastSubstring !== '') substrings.push(lastSubstring);
    return substrings;
  },
  splitDiceStringIntoIndividualRolls: (diceString) => {
    const individualRolls = [];
    diceString.replaceAll(' ', '').split('+').forEach((item) => {
      const splitItems = item.split('-');
      for (let i = 0; i < splitItems.length; i++) {
        individualRolls.push(`${!i ? '+' : '-'}${splitItems[i]}`);
      }
    });
    return individualRolls;
  },
  getDiceResultText: ({ rolls, result, modifier, damageType, advantage = 0, multiplier = 1 }) => {
    const getModifierText = () => {
      if (modifier > 0) return ` + ${modifier}`;
      if (modifier < 0) return ` - ${-modifier}`;
      return ``;
    };
    const getPrintedRolls = () => {
      let printedRolls = '';
      rolls.forEach((roll) => {
        if (typeof roll === 'number') printedRolls += `, ${roll}`;
        else {
          if (advantage > 0) printedRolls += `, {${roll.join(', ')}}`;
          else if (advantage < 0) printedRolls += `, <${roll.join(', ')}>`;
          else printedRolls += `, ${roll}`;
        }
      });
      return printedRolls.slice(2);
    };

    if (isNaN(advantage)) advantage = Convert().toAdvantageNumber(advantage);
    const printedDamageType = damageType ? ` ${damageType}` : '';
    return `${result}${printedDamageType} = ${`[${getPrintedRolls()}]${getModifierText()}`}${
      multiplier !== 1 ? ` ~ ${multiplier * 100}%` : ''
    }`;
  },
  rollDice: ({ type, modifier = 0, advantage = 0, loggerMethod }) => {
    if (isNaN(advantage)) advantage = Convert().toAdvantageNumber(advantage);
    let result, rolls = [];
    for (let i = 0; i < Math.abs(advantage) + 1; i++) rolls.push(Math.ceil(Math.random() * type));
    if (advantage >= 0) result = Math.max(...rolls);
    else result = Math.min(...rolls);
    if (Math.abs(advantage)) rolls = [rolls];
    result += modifier;

    if (loggerMethod) {
      loggerMethod(RPG().getDiceResultText({ rolls, result, modifier, advantage }));
    }
    return { rolls, result, modifier };
  },
  getDiceResult: ({
    diceData,
    advantage = 0,
    critical = false,
    criticalThreshold = 20,
    criticalCalculator = (number, critical) => number * (critical ? 2 : 1),
    multiplier = 1,
    loggerMethod
  }) => {
    const RPG_ = RPG();
    const convertDiceToNumbers = (dice) => {
      let modifier = 0;
      const [number, type] = dice.split('d').map((i) => parseInt(i));
      if (dice.includes('+')) modifier = parseInt(dice.split('+')[1]);
      else if (dice.includes('-') && dice[0] !== '-') modifier = - parseInt(dice.split('-')[1]);
      return { number: number || number === 0 ? number : 1, type, modifier };
    };

    if (isNaN(advantage)) advantage = Convert().toAdvantageNumber(advantage);
    const rolls = [];
    let number, type, modifier, result = 0;
    let criticalFail = false, criticalHit = false;

    if (typeof diceData === 'string') ({ number, type, modifier } = convertDiceToNumbers(diceData));
    else ({ number, type, modifier } = diceData);

    if (type) {
      for (let i = 0; i < criticalCalculator(number, critical); i++) {
        const diceRoll = RPG_.rollDice({ type, advantage });
        rolls.push(...diceRoll.rolls);
        result += diceRoll.result;
      }
      result += modifier;
      if (type === 20 && rolls.length === 1) {
        if (!advantage) {
          criticalFail = rolls[0] === 1;
          criticalHit = rolls[0] >= criticalThreshold;
        } else if (advantage > 0) {
          criticalFail = Math.max(...rolls[0]) === 1;
          criticalHit = Math.max(...rolls[0]) >= criticalThreshold;
        } else if (advantage < 0) {
          criticalFail = Math.min(...rolls[0]) === 1;
          criticalHit = Math.min(...rolls[0]) >= criticalThreshold;
        }
      }
    } else {
      result = number + modifier;
      modifier = result;
    }

    result = RPG_.roundDown(result * multiplier);
    const text = RPG_.getDiceResultText({ rolls, result, modifier, advantage, multiplier });
    if (loggerMethod) loggerMethod(text);
    return { rolls, result, modifier, critical: criticalHit, fail: criticalFail, text };
  },
  getMultipleDiceResult: ({
    diceData,
    advantage = 0,
    critical = false,
    criticalThreshold = 20,
    criticalCalculator = (number, critical) => number * (critical ? 2 : 1),
    multipliers,
    loggerMethod
  }) => {
    const RPG_ = RPG();
    if (isNaN(advantage)) advantage = Convert().toAdvantageNumber(advantage);
    const splitDataByType = RPG_.splitDiceStringByType(diceData);
    if (splitDataByType.length > 1) {
      return splitDataByType.reduce((total, data) => {
        const {
          rolls,
          modifier,
          result,
          critical: isCritical,
          fail,
          text
        } = RPG_.getMultipleDiceResult({
          diceData: data,
          advantage,
          critical,
          criticalThreshold,
          criticalCalculator,
          multipliers,
          loggerMethod
        });
        return {
          rolls: [...total.rolls, rolls],
          modifier: [...total.modifier, modifier],
          result: total.result + result,
          critical: total.critical && isCritical,
          fail: total.fail && fail,
          text: total.text.length ? `${total.text} and ${text}` : text
        };
      }, { rolls: [], modifier: [], result: 0, critical: false, fail: false, text: '' });
    }

    const totalRolls = [];
    let totalResult = 0, totalModifier = 0, isCritical = true, isFail = true;
    RPG_.splitDiceStringIntoIndividualRolls(diceData).forEach((item) => {
      const sign = item[0];
      const roll = item.slice(1);
      const {
        rolls,
        result,
        modifier,
        critical: criticalHit,
        fail: criticalFail
      } = RPG_.getDiceResult({
        diceData: roll,
        advantage,
        critical,
        criticalThreshold,
        criticalCalculator
      });
      totalRolls.push(...rolls);
      totalResult = totalResult + (sign === '+' ? result : -result);
      totalModifier = totalModifier + (sign === '+' ? modifier : -modifier);
      if (!modifier) {
        isCritical = isCritical && criticalHit;
        isFail = isFail && criticalFail;
      }
    });

    if (typeof multipliers !== 'object') {
      if (multipliers) totalResult = RPG_.roundDown(totalResult * multipliers);
      const text = RPG_.getDiceResultText({
        rolls: totalRolls,
        result: totalResult,
        modifier: totalModifier,
        damageType: RPG_.getDamageType(diceData),
        advantage,
        multiplier: multipliers
      });
      if (loggerMethod) loggerMethod(text);
      return {
        rolls: totalRolls,
        modifier: totalModifier,
        result: totalResult,
        critical: isCritical,
        fail: isFail,
        text
      };
    }

    const text = [], totalResults = [];
    multipliers.forEach((multiplier) => {
      const multiplierResult = RPG_.roundDown(totalResult * multiplier);
      const multiplierText = RPG_.getDiceResultText({
        rolls: totalRolls,
        result: multiplierResult,
        modifier: totalModifier,
        advantage,
        multiplier
      });
      text.push(multiplierText);
      totalResults.push(multiplierResult);
    });
    if (loggerMethod) loggerMethod(text);
    return {
      rolls: totalRolls,
      modifier: totalModifier,
      result: totalResults,
      critical: isCritical,
      fail: isFail,
      text
    };
  }
});
