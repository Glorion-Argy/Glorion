var Items = () => ({
  // Callbacks
  getCriticalDamageCalculator: () => {
    const { exists } = Inventory().getInventoryRow({ itemName: "Fury's Girdle" });
    return (number, critical) => {
      return critical ?
        2 * number + (exists ? 1 : 0)
        : number;
    };
  },
  // Abstract methods
  abstractConsumable: (options = {}) => {
    const Generic_ = Generic(), IO_ = IO(), Inventory_ = Inventory();
    const { spellName } = options;
    const itemRowData = Inventory_.getInventoryRow({ itemName: spellName });
    const foundItem = Inventory_.findItemWithAttribute({
      attribute: 'Ability',
      value: spellName
    });
    const itemName = foundItem?.item || spellName;

    return Helper().abstractUseAbility({
      onCheck: ({ mobile }) => {
        const checkForCount = (row) => {
          if (!row) return false;
          const grid = Generic_.getSheet('Inventory').getDataRange().getValues();
          const countColumn = grid[0].indexOf('#') + 1;
          if (!countColumn) {
            return IO_.notify({
              message: `There is no count (#) column in your Inventory.`,
              mobile
            });
          }
          const count = Generic_.getValue([row, countColumn], 'Inventory');
          return count && count !== '0';
        };

        if (
          checkForCount(
            itemRowData.exists
              ? itemRowData?.row
              : foundItem?.row
          )
        ) return true;
        return IO_.notify({
          message: `You have no more ${itemName} in your Inventory.`,
          mobile
        });
      },
      onUse: ({ trackHistory }) => {
        return Inventory_.removeItem({
          itemName,
          deleteOnZero: false,
          apply: false,
          skipOutput: true,
          trackHistory
        });
      },
      options
    });
  },
  abstractSafeguardBracelet: (options = {}) => Helper().abstractUseAbility({
    healing: true,
    beforeHitCalculation: ({ mobile, trackHistory }) => {
      const Generic_ = Generic(), IO_ = IO();
      const { value: level = 1 } = Generic_.getNamedRange('Level');
      const currentHealthData = Generic_.getNamedRange('HP');
      const healthCap = Math.min(10 + 2 * level, (currentHealthData.value || 1) - 1);
      const healthSpent = IO_.notify({
        type: 'inputBox',
        title: 'Safeguard Bracelet Health spent',
        message: `How much health do you want to spend, up to ${healthCap}?`,
        mobile,
        isMobileAnswerInputType: true
      });
      if (isNaN(healthSpent)) return;
      if (healthSpent > healthCap) {
        return IO_.notify({
          message: `You can only spend up to ${healthCap} Health.`,
          mobile
        });
      }
      trackHistory({
        ...currentHealthData,
        value: -healthSpent,
        relative: true,
        min: 1
      });
      return {
        mainEffect: parseInt(healthSpent)
          + Math.max(Generic_.getNamedRange('CON_Modifier').value || 0, 0)
      };
    },
    options
  }),
  // Config
  getButtonConfig: () => ({
    actions: () => ({
      defaultArguments: { criticalDamageCalculator: Items().getCriticalDamageCalculator() },
      'Bandage': () => ({ callback: Items().abstractConsumable, healing: true }),
      'Arcane Wrap': () => ({ callback: Items().abstractConsumable, healing: true }),
      'Burning Solution': () => ({ callback: Items().abstractConsumable }),
      'Fiery Coating': () => ({ callback: Items().abstractConsumable, delayedEffect: true }),
      'Fiery Coating Tick': () => ({ skipActionCost: true }),
      'Venom Coating': () => ({ callback: Items().abstractConsumable, delayedEffect: true }),
      'Venom Coating Tick': () => ({ skipActionCost: true }),
      'Fetid Coating': () => ({ callback: Items().abstractConsumable, delayedEffect: true }),
      'Fetid Coating Tick': () => ({ skipActionCost: true }),
      'Flask of Oil': () => ({ callback: Items().abstractConsumable }),
      'Flask of Moonshine': () => ({ callback: Items().abstractConsumable }),
      'Keg of Beer': () => ({ callback: Items().abstractConsumable }),
      'Ball Bearings': () => ({ callback: Items().abstractConsumable, delayedEffect: true }),
      'Arcane Control': () => ({ checkType: 'Arcana' })
    }),
    bonusActions: () => ({
      defaultArguments: { criticalDamageCalculator: Items().getCriticalDamageCalculator() },
      'Bandage': () => ({ callback: Items().abstractConsumable, healing: true }),
      'Arcane Wrap': () => ({ callback: Items().abstractConsumable, healing: true }),
      'Stoneskin Potion': () => ({ callback: Items().abstractConsumable, onUse: Helper().setTracker }),
      'Lightfoot Potion': () => ({ callback: Items().abstractConsumable, onUse: Helper().setTracker }),
      'Potion of Arcana': () => ({ callback: Items().abstractConsumable, onUse: Helper().setTracker }),
      'Adrenaline Potion': () => ({ callback: Items().abstractConsumable }),
      'Potion of Invigoration': () => ({ callback: Items().abstractConsumable }),
      'Stonebreaker Potion': () => ({ callback: Items().abstractConsumable }),
      'Antitoxin Vial': () => ({ callback: Items().abstractConsumable }),
      'Bondlink Vambraces': () => ({}),
      'Safeguard Bracelet': () => ({ callback: Items().abstractSafeguardBracelet })
    }),
    reactions: () => ({
      defaultArguments: { criticalDamageCalculator: Items().getCriticalDamageCalculator() }
    }),
    interactions: () => ({
      defaultArguments: { criticalDamageCalculator: Items().getCriticalDamageCalculator() }
    }),
    movement: () => ({
      defaultArguments: { criticalDamageCalculator: Items().getCriticalDamageCalculator() },
    })
  }),
  getCacheConfig: () => {
    const coatingConfigs = [
      { deletions: ['mainEffect'] },
      { version: 'Tick' }
    ];
    return {
      actions: {
        'Fiery Coating': coatingConfigs,
        'Venom Coating': coatingConfigs,
        'Fetid Coating': coatingConfigs
      }
    };
  }
});
