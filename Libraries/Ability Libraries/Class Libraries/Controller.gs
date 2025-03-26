var Controller = () => ({
  getCacheConfig: ({
    selectedClass = Data().selectedClass(),
    configCallbacks = [Race(), Background(), Items()],
    customConfig = {}
  }) => {
    return Automation().getCacheConfig({
      configCallbacks,
      classConfig: this[selectedClass]?.()?.getCacheConfig?.(),
      customConfig
    });
  },
  getAllButtonConfigs: ({
    selectedClass = Data().selectedClass(),
    configCallbacks = [Race(), Background(), Items()],
    customConfig = {}
  }) => {
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
      this[selectedClass]?.()?.getButtonConfig?.() || [],
      Generic_.unwrap(customConfig)
    ];
  },
  useMobileCommand: ({
    command,
    range,
    customConfigCallback,
    createCharacterCallback,
    resetCallback
  }) => {
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    if (!['Mobile', 'Character Creation'].includes(sheetName)) return;

    const selectedClass = Data().selectedClass();
    const buttonConfigsCallback = () => Controller().getAllButtonConfigs({
      selectedClass,
      customConfig: customConfigCallback
    });
    Mobile().useCommand({
      command,
      range,
      sheet,
      sheetName,
      selectedClass,
      buttonConfigsCallback,
      createCharacterCallback,
      resetCallback
    });
  },
  useCommand: ({
    command,
    type,
    selectedClass = Data().selectedClass(),
    configCallbacks = [Race(), Background(), Items()],
    customConfig = {},
    mobile = false
  }) => {
    if (!command) {
      throw 'You need a command name first, to use an ability.';
    }
    const buttonConfigs = Controller().getAllButtonConfigs({
      selectedClass,
      configCallbacks,
      customConfig
    });
    Helper().useCommand(command, type, buttonConfigs, mobile);
  }
});
