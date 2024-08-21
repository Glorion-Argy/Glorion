var Convert = () => ({
  toSingular: (word) => {
    if (word.at(-1) === 's') return word.slice(0, -1);
    return word;
  },
  toA1Notation: (row, column) => {
    let columnLetters = '';
    while (column > 0) {
      columnLetters = String.fromCharCode(65 + (column - 1) % 26) + columnLetters;
      column = Math.floor((column - 1) / 26);
    }
    return `${columnLetters}${row}`;
  },
  toRowColumnNotation: (a1Notation) => {
    const cellConversion = (cellA1Notation) => {
      const match = cellA1Notation.match(/([A-Z]+)(\d+)/);
      if (match) {
        const columnLetters = match[1];
        const row = parseInt(match[2]);
        let column = 0;
        for (let i = 0; i < columnLetters.length; i++) {
          column = column * 26 + columnLetters.charCodeAt(i) - 64;
        }
        return { row, column };
      } else throw new Error('Invalid A1 notation');
    };
    const rangeConversion = (rangeA1Notation) => {
      let rowColumnNotation = {};
      if (rangeA1Notation) {
        const [startCell, endCell] = rangeA1Notation.split(':').map((cell) => {
          return cellConversion(cell);
        });
        if (startCell) {
          rowColumnNotation = {
            startRow: startCell.row,
            startColumn: startCell.column
          };
        }
        if (endCell) {
          rowColumnNotation = {
            ...rowColumnNotation,
            endRow: endCell.row,
            endColumn: endCell.column
          };
        }
      }
      return rowColumnNotation;
    };

    if (a1Notation.includes(':')) return rangeConversion(a1Notation);
    return cellConversion(a1Notation);
  },
  toCamelCase: (inputString) => {
    return inputString
      .replace(
        /(?:^\w|[A-Z]|\b\w)/g,
        (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()
      )
      .replace(/\s+|[.?]/g, '');
  },
  toPascalCase: (inputString) => {
    return inputString
      .trim()
      .split(/[\s_]+/)
      .map((word) => word.at(0).toUpperCase() + word.slice(1))
      .join('');
  },
  toAdvantageNumber: (advantage) => {
    switch(advantage) {
      case 'M. Disadvantage':
        return -2;
      case 'Disadvantage':
        return -1;
      case '-':
        return 0;
      case 'Advantage':
        return 1;
      case 'M. Advantage':
        return 2;
      default:
        throw 'Wrong advantage type. It must be one of the following: ' +
          '[M. Disadvantage, Disadvantage, -, Advantage, M. Advantage].';
    };
  }
});
