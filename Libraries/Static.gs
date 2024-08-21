var Static = () => ({
  attributeAbbreviations: () => ({
    'STR': 'Strength',
    'DEX': 'Dexterity',
    'CON': 'Constitution',
    'INT': 'Intelligence',
    'WIS': 'Wisdom',
    'CHA': 'Charisma'
  }),
  actionTypes: () => [
    'Action',
    'Bonus_Action',
    'Reaction',
    'Interaction',
    'Movement'
  ],
  actionSheets: () => [
    'Actions',
    'Bonus Actions',
    'Reactions',
    'Interactions',
    'Movement',
    'Passives'
  ],
  allSheets: () => [
    'Variables',
    'Character',
    'Attributes',
    'Checks',
    'Passives',
    'Proficiencies',
    'Inventory',
    'Actions',
    'Bonus Actions',
    'Reactions',
    'Interactions',
    'Movement',
    'Mobile'
  ],
  damageTypes: () => [
    'Slashing',
    'Piercing',
    'Bludgeoning',
    'Cold',
    'Poison',
    'Acid',
    'Psychic',
    'Fire',
    'Necrotic',
    'Radiant',
    'Force',
    'Thunder',
    'Lightning'
  ],
  hooks: () => [
    'onCheck',
    'onHigherCost',
    'onUse',
    'beforeHitCalculation',
    'afterHitCalculation',
    'onFail',
    'onSuccess',
    'onMainSuccess',
    'onSecondarySuccess',
    'onOutput',
    'onKillingBlow',
    'onLevelUp'
  ]
});
