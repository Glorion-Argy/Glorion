var Race = () => ({
  // Utilities
  validateItem: ({ itemName, count = 1, spellName, customFailMessage = '', mobile }) => {
    if (!itemName) return;

    const IO_ = IO();
    const inventorySheet = Generic().getSheet('Inventory');
    if (!inventorySheet) {
      return IO_.notify({ message: 'Could not find your Inventory sheet.', mobile });
    }
    const itemRow = inventorySheet.getDataRange().getValues().find(([_, item]) => {
      return item === itemName;
    });
    if (!itemRow) {
      return IO_.notify({ message: `You have no ${itemName} in your Inventory.`, mobile });
    }
    if (parseInt(itemRow[2] || 0) < count) {
      return IO_.notify({
        message: customFailMessage || `${spellName} requires ${count} ${itemName}.`,
        mobile
      });
    }
    return true;
  },
  // Callbacks
  getCriticalThreshold: () => {
    const { value: race } = Generic().getNamedRange('Race');
    return race === 'Orc' ? 19 : 20;
  },
  onCraftingRacialUse: (count = 1, { spellName, mobile, trackHistory }) => {
    const useCaseData = {
      'Craft': `Tinker's Tools and ${count}gp`,
      'Maintain': "Tinker's Tools",
      'Disassemble': "Tinker's Tools",
      'Use': ''
    };
    const useCaseChosen = IO().askForAnswerFromList({
      title: spellName,
      message: 'Pick a use case',
      options: Object.keys(useCaseData),
      optionModifier: (option) => {
        const requirements = useCaseData[option];
        if (!requirements) return option;
        return `${option}: Requires ${requirements}`
      },
      mobile
    });
    if (useCaseChosen === 'Use') return true;

    const Race_ = Race();
    let itemName = "Tinker's Tools";
    const useCaseGerund = `${useCaseChosen.at(-1) === 'e'
      ? useCaseChosen.slice(0, -1)
      : useCaseChosen}}ing`;
    if (!Race_.validateItem({
      itemName,
      customFailMessage: `${useCaseGerund} a ${spellName} requires ${itemName}`,
      mobile
    })) return;
    if (useCaseChosen === 'Maintain') return true;

    const Inventory_ = Inventory();
    itemName = 'Gold';
    let callback;
    if (useCaseChosen === 'Craft') {
      if (!Race_.validateItem({ itemName, count, spellName, mobile })) return;
      callback = Inventory_.removeItem;
    } else callback = Inventory_.lootItem;
    return callback({
      itemName,
      count,
      deleteOnZero: false,
      apply: false,
      skipOutput: true,
      trackHistory
    });
  },
  // Config
  getButtonConfig: () => ({
    actions: () => ({
      defaultArguments: { criticalThreshold: Race().getCriticalThreshold() },
      'Scry': () => ({}),
      'Polyglot Amplifier': () => ({
        onUse: (hookArguments) => Race().onCraftingRacialUse(15, hookArguments)
      }),
      'Draconic Echo': () => ({ aoe: true }),
      'Wyrmgaze': () => ({}),
      'Mechanized Creations': () => ({
        onUse: (hookArguments) => Race().onCraftingRacialUse(5, hookArguments)
      }),
      'Weywalk': () => ({}),
      'Peaceful Bind': () => ({})
    }),
    bonusActions: () => ({
      defaultArguments: { criticalThreshold: Race().getCriticalThreshold() },
      'Towering Gloom': () => ({}),
      'Dodge': () => ({}),
      'Hide': () => ({ checkType: 'Stealth' })
    }),
    reactions: () => ({
      defaultArguments: { criticalThreshold: Race().getCriticalThreshold() }
    }),
    interactions: () => ({
      defaultArguments: { criticalThreshold: Race().getCriticalThreshold() }
    }),
    movement: () => ({
      defaultArguments: { criticalThreshold: Race().getCriticalThreshold() }
    })
  })
});
