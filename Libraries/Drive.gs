var Drive = () => ({
  parseDataFromDrive: (folderID, fileName) => {
    return DriveApp.getFolderById(folderID)
      .getFilesByName(fileName)
      .next()
      .getBlob()
      .getDataAsString();
  },
  storeDataInDrive: (data, folderID, fileName) => {
    const folder = DriveApp.getFolderById(folderID);
    const fileList = folder.getFilesByName(fileName);
    if (fileList.hasNext()) fileList.next().setContent(JSON.stringify(data));
    else folder.createFile(fileName, JSON.stringify(data));
  },
  createButton: ({
    databaseID,
    databaseSheet = 'Buttons',
    sheet,
    cell,
    imageID,
    imageTag,
    script,
    scale = 1,
    xOffset,
    yOffset,
    rowHeight,
    columnWidth
  }) => {
    const Generic_ = Generic();
    const databaseSheetObject = Generic_.getSheet(databaseSheet, databaseID);
    const images = databaseSheetObject
      ? databaseSheetObject
        .getDataRange()
        .getValues()
        .slice(1)
        .reduce((total, [name, id]) => ({ ...total, [name]: id }), {})
      : {};

    let row, column;
    if (Array.isArray(cell)) [row, column] = cell;
    else ({ row, column } = Convert().toRowColumnNotation(cell));
    const button = Generic_.getSheet(sheet).insertImage(
      DriveApp.getFileById(imageID || images[imageTag]).getBlob(),
      column,
      row
    );
    return button
      .setHeight(button.getHeight() * scale)
      .setWidth(button.getWidth() * scale)
      .setAnchorCellXOffset(
        xOffset || (columnWidth ? (columnWidth - button.getWidth()) / 2 - 1 : 0)
      )
      .setAnchorCellYOffset(
        yOffset || (rowHeight ? (rowHeight - button.getHeight()) / 2 - 1 : 0)
      )
      .assignScript(script);
  }
});
