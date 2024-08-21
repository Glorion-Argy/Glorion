const _historyCommands = () => ({
  getOppositeCommand: (command) => {
    const commandConfig = {
      'set': 'set',
      'hide': 'unhide',
      'unhide': 'hide',
      'insert': 'delete',
      'delete': 'insert',
      'merge': 'unmerge',
      'unmerge': 'merge'
    };
    return commandConfig[command.toLowerCase()];
  },
  normalizeOptions: (command, sheet, options) => {
    const optionsConfig = {
      setBackground: ({ target }) => ({
        target,
        input: Generic().getBackground(target, sheet)
      }),
      setHorizontalAlignment: ({ target }) => ({
        target,
        input: Generic().getHorizontalAlignment(target, sheet)
      }),
      setRowBorder: ({ target }) => {
        const Generic_ = Generic();
        const topBorder = Generic_.getBorderStyle(`A${target}`, 'top', sheet);
        if (topBorder) return { target, input: topBorder.toString() };
        const bottomBorder = Generic_.getBorderStyle(`A${target - 1}`, 'bottom', sheet);
        if (bottomBorder) return { target, input: bottomBorder.toString() };
      },
      hideRow: ({ target }) => ({ target }),
      unhideRow: ({ target }) => ({ target }),
      insertRow: ({ target }) => ({ target: target + 1 }),
      deleteRow: ({ target }) => {
        const Generic_ = Generic();
        const sheetObject = Generic_.getSheet(sheet);
        const grid = sheetObject.getDataRange().getValues();
        const formulas = sheetObject.getDataRange().getFormulas();
        const values = [];
        for (let column = 0; column < grid[0].length; column++) {
          for (let row = 0; row < target; row++) {
            const formula = formulas[row][column];
            if (row === target - 1) {
              values[column] = formula || grid[row][column];
              break;
            }
            if (formula && formula.includes('ARRAYFORMULA')) {
              values.push(null);
              break;
            }
          }
        }
        return {
          target: target - 1,
          ...Generic_.getSerializableRowData(target, sheet),
          values: [values]
        };
      },
      hideColumn: ({ target }) => ({ target }),
      unhideColumn: ({ target }) => ({ target }),
      insertColumn: ({ target }) => ({ target: target + 1 }),
      deleteColumn: ({ target }) => {
        const Generic_ = Generic();
        const sheetObject = Generic_.getSheet(sheet);
        const grid = sheetObject.getDataRange().getValues();
        const formulas = sheetObject.getDataRange().getFormulas();
        const values = [];
        for (let row = 0; row < grid.length; row++) {
          const formula = formulas[row][target - 1];
          if (formula && formula.includes('ARRAYFORMULA')) {
            values.push([formula], ...new Array(grid.length - row - 1).fill([null]));
            break;
          }
          values.push(formula ? [formula] : [grid[row][target - 1]]);
        }
        return {
          target: target - 1,
          ...Generic_.getSerializableColumnData(target, sheet),
          values: values
        };

      },
      mergeRange: ({ target }) => {
        const Convert_ = Convert();
        const {
          startRow,
          startColumn,
          endRow,
          endColumn
        } = Convert_.toRowColumnNotation(target);
        const mergedRanges = Generic()
          .getSheet(sheet)
          .getRange(target)
          .getMergedRanges()
          .reduce((total, range) => {
            const {
              startRow: x1,
              startColumn: y1,
              endRow: x2,
              endColumn: y2
            } = Convert_.toRowColumnNotation(range.getA1Notation());
            if (startRow <= x1 && startColumn <= y1 && endRow >= x2 && endColumn >= y2) {
              return [...total, range.getA1Notation()];
            }
            return total;
          }, []);
        return { target, mergedRanges };
      },
      unmergeRange: ({ target }) => ({ target })
    };
    const optionsCallback = optionsConfig[command];
    if (!optionsCallback) throw `Command [${command}] does not exist`;
    return optionsCallback(options);
  },
  setBackground: (sheet, { target, input }) => {
    return Generic().setBackground(target, input, sheet);
  },
  setHorizontalAlignment: (sheet, { target, input }) => {
    return Generic().setHorizontalAlignment(target, input, sheet)
  },
  setRowBorder: (sheet, { target, input }) => {
    return Generic().addHorizontalBorder({ sheet, row: target, type: input });
  },
  hideRow: (sheet, { target }) => Generic().hideRows(target, sheet),
  unhideRow: (sheet, { target }) => Generic().showRows(target, sheet),
  insertRow: (sheet, {
    target,
    values,
    backgrounds,
    fontColors,
    fontFamilies,
    fontSizes,
    fontLines,
    fontStyles,
    fontWeights,
    horizontalAlignments,
    verticalAlignments,
    textDirections,
    textRotations,
    wrapStrategies,
    mergedRanges,
    borders = [],
  }) => {
    const Generic_ = Generic();
    Generic_.insertRows(target, sheet);
    const rowRange = Generic_
      .getSheet(sheet)
      .getRange(`${target + 1}:${target + 1}`);

    borders.forEach((border, column) => {
      if (!border) return;
      const { top, bottom } = border;
      const cell = [target + 1, column + 1];
      if (top) {
        Generic_.setBorderStyle(cell, 'top', top, sheet);
      }
      if (bottom) {
        Generic_.setBorderStyle(cell, 'bottom', bottom, sheet);
      }
    });

    if (values) rowRange.setValues(values);
    if (backgrounds) rowRange.setBackgrounds(backgrounds);
    if (fontColors) rowRange.setFontColors(fontColors);
    if (fontFamilies) rowRange.setFontFamilies(fontFamilies);
    if (fontSizes) rowRange.setFontSizes(fontSizes);
    if (fontLines) rowRange.setFontLines(fontLines);
    if (fontStyles) rowRange.setFontStyles(fontStyles);
    if (fontWeights) rowRange.setFontWeights(fontWeights);
    if (horizontalAlignments) rowRange.setHorizontalAlignments(horizontalAlignments);
    if (verticalAlignments) rowRange.setVerticalAlignments(verticalAlignments);
    if (textDirections) rowRange.setTextDirections(textDirections);
    if (textRotations) {
      const rotations = textRotations[0];
      for (var column = 0; column < rotations.length; column++) {
        rowRange.getCell(1, column + 1).setTextRotation(rotations[column]);
      }
    }
    if (wrapStrategies) {
      const strategies = wrapStrategies[0];
      rowRange.setWrapStrategies([strategies.map((strategy) => {
        return SpreadsheetApp.WrapStrategy[strategy];
      })]);
    }
    if (mergedRanges) {
      mergedRanges.forEach((range) => {
        Generic_.getSheet(sheet).getRange(range).merge();
      });
    }
  },
  deleteRow: (sheet, { target }) => Generic().deleteRows(target, sheet),
  hideColumn: (sheet, { target }) => Generic().hideColumns(target, sheet),
  unhideColumn: (sheet, { target }) => Generic().showColumns(target, sheet),
  insertColumn: (sheet, {
    target,
    values,
    backgrounds,
    fontColors,
    fontFamilies,
    fontSizes,
    fontLines,
    fontStyles,
    fontWeights,
    horizontalAlignments,
    verticalAlignments,
    textDirections,
    textRotations,
    wrapStrategies,
    mergedRanges,
    columnWidth,
    borders = [],
  }) => {
    const Generic_ = Generic();
    Generic_.insertColumns(target, sheet);
    const columnInA1 = Convert().toA1Notation(1, target + 1).slice(0, -1);
    const sheetObject = Generic_.getSheet(sheet);
    const columnRange = sheetObject.getRange(`${columnInA1}:${columnInA1}`);

    borders.forEach((border, row) => {
      if (!border) return;
      const { top, left, bottom, right } = border;
      const cell = [row + 1, target + 1];
      if (top) {
        Generic_.setBorderStyle(cell, 'top', top, sheet);
      }
      if (left) {
        Generic_.setBorderStyle(cell, 'left', left, sheet);
      }
      if (bottom) {
        Generic_.setBorderStyle(cell, 'bottom', bottom, sheet);
      }
      if (right) {
        Generic_.setBorderStyle(cell, 'right', right, sheet);
      }
    });

    if (values) columnRange.setValues(values);
    if (backgrounds) columnRange.setBackgrounds(backgrounds);
    if (fontColors) columnRange.setFontColors(fontColors);
    if (fontFamilies) columnRange.setFontFamilies(fontFamilies);
    if (fontSizes) columnRange.setFontSizes(fontSizes);
    if (fontLines) columnRange.setFontLines(fontLines);
    if (fontStyles) columnRange.setFontStyles(fontStyles);
    if (fontWeights) columnRange.setFontWeights(fontWeights);
    if (horizontalAlignments) columnRange.setHorizontalAlignments(horizontalAlignments);
    if (verticalAlignments) columnRange.setVerticalAlignments(verticalAlignments);
    if (textDirections) columnRange.setTextDirections(textDirections);
    if (textRotations) {
      textRotations.forEach(([rotation], row) => {
        columnRange.getCell(row + 1, 1).setTextRotation(rotation);
      });
    }
    if (wrapStrategies) {
      columnRange.setWrapStrategies(wrapStrategies.map(([strategy]) => {
        return [SpreadsheetApp.WrapStrategy[strategy]];
      }));
    }
    if (mergedRanges) {
      mergedRanges.forEach((range) => {
        Generic_.getSheet(sheet).getRange(range).merge();
      });
    }
    if (columnWidth) sheetObject.setColumnWidth(target + 1, columnWidth);
  },
  deleteColumn: (sheet, { target }) => Generic().deleteColumns(target, sheet),
  mergeRange: (sheet, { target }) => {
    return Generic().getSheet(sheet).getRange(target).merge();
  },
  unmergeRange: (sheet, { target, mergedRanges = [] }) => {
    const sheetObject = Generic().getSheet(sheet)
    sheetObject.getRange(target).breakApart();
    mergedRanges.forEach((range) => sheetObject.getRange(range).merge());
  }
});

var History = () => ({
  getChangesHistory: () => JSON.parse(Generic().getNamedRange('History').value || '[]'),
  setChangesHistory: (changes) => {
    const Generic_ = Generic();
    const { sheet, range } = Generic_.getNamedRange('History');
    if (!sheet || !range) {
      throw 'Your [History] named range could not be found. Please check your Variables sheet.';
    }
    return Generic_.setValue(range, JSON.stringify(changes), sheet);
  },
  pushToChangesHistory: (change) => {
    const History_ = History();
    const changesHistory = History_.getChangesHistory();
    changesHistory.push(change);
    History_.setChangesHistory(changesHistory);
  },
  popFromChangesHistory: (mobile = false) => {
    const History_ = History();
    const changesHistory = History_.getChangesHistory();
    if (!changesHistory.length) {
      return IO().notify({ message: 'There are no more changes left to undo.', mobile });
    }
    const latestChange = changesHistory.pop();
    History_.setChangesHistory(changesHistory);
    return latestChange;
  },
  trackHistory: (changes, newChanges) => {
    const Convert_ = Convert(), Generic_ = Generic(), Commands = _historyCommands();
    for (let {
      sheet,
      range,
      value,
      relative,
      min = Number.MIN_SAFE_INTEGER,
      max = Number.MAX_SAFE_INTEGER,
      isFormula = false,
      command,
      type,
      options
    } of Array.isArray(newChanges) ? newChanges : [newChanges]) {
      if (!sheet || ((!range || value === undefined) && (!command || !type))) continue;

      if (command) {
        const singularType = Convert_.toSingular(type);
        const commandName = Convert_.toCamelCase(`${command} ${singularType}`);
        const commandCallback = Commands[commandName];
        if (!commandCallback) throw `Command [${command} ${type}] does not exist`;
        const normalizedOptions = Commands.normalizeOptions(commandName, sheet, options);
        if (normalizedOptions) {
          changes.push({
            sheet,
            commandCallback: () => commandCallback(sheet, options),
            oppositeCommand: Convert_.toCamelCase(
              `${Commands.getOppositeCommand(command)} ${singularType}`
            ),
            options: normalizedOptions
          });
        }
        continue;
      }

      const limit = (amount) => (isNaN(amount) || typeof amount === 'boolean')
        ? amount
        : Math.min(Math.max(amount || 0, Generic_.unwrap(min)), Generic_.unwrap(max));
      const calculateNewValue = (currentValue) => {
        const wrapper = () => relative
          ? limit(parseFloat(currentValue || 0) + parseFloat(Generic_.unwrap(value) || 0))
          : limit(Generic_.unwrap(value));
        if ([typeof value, typeof min, typeof max].includes('function')) return wrapper;
        return wrapper();
      };

      const existingChange = changes.find(({ sheet: changeSheet, range: changeRange }) => {
        return changeSheet === sheet && changeRange === range;
      });
      if (existingChange) {
        existingChange.newValue = calculateNewValue(existingChange.newValue);
      } else {
        const currentValue = isFormula
          ? Generic_.getFormula(range, sheet)
          : Generic_.getValue(range, sheet);
        changes.push({
          sheet,
          range,
          value: currentValue,
          newValue: calculateNewValue(currentValue)
        });
      }
    }
    return changes;
  },
  applyChanges: (changes) => {
    const Generic_ = Generic();
    const changesHistory = [];
    changes.forEach(({
      sheet,
      range,
      value,
      newValue,
      commandCallback,
      oppositeCommand,
      options
    }) => {
      newValue = Generic_.unwrap(newValue);
      const sheetName = typeof sheet === 'string'
        ? sheet
        : sheet.getName();
      if (commandCallback) {
        changesHistory.push({
          sheet: sheetName,
          command: oppositeCommand,
          options
        });
        return commandCallback();
      }

      if (newValue === Generic_.getValue(range, sheet)) return;
      changesHistory.push({ sheet: sheetName, range, value });
      Generic_.setValue(range, newValue, sheet);
    });
    if (changesHistory.length) {
      History().pushToChangesHistory(changesHistory);
    }
  },
  logRollHistory: (messageData, historyCells) => {
    const Generic_ = Generic();
    const messages = (typeof messageData === 'object' ? [...messageData] : [messageData]).slice(-5);
    for (let i = 4; i >= messages.length; i--) {
      Generic_.setValueBasedOnCell(historyCells[i], historyCells[i - messages.length], 'Attributes');
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      Generic_.setValue(historyCells[i], messages[messages.length - i - 1], 'Attributes');
    }
  },
  useCommand: ({ sheet, command, options = {} }) => {
    return _historyCommands()[command]?.(sheet, options);
  }
});
