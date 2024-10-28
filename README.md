# Welcome to Glorion
A versatile Apps Script project designed to enhance your Tabletop Role-Playing Game (TTRPG) experience using Google Sheets. Glorion provides both Dungeon Masters (DMs) and players with powerful tools for customization and interaction, with the goal of supporting various TTRPG systems. As of right now, the tool supports **D&D 5e**.

## Overview
Glorion supports extensive customization and interaction in your TTRPG campaigns through two primary Google Sheets documents:
- **Database Spreadsheet**: Managed by the DM, this spreadsheet stores all campaign data, including custom classes, races, backgrounds, abilities, items, and more. It's the primary data source for the campaign, with each **Character Spreadsheet** linked to it. One Database can serve multiple campaigns, with options to differentiate between them.
- **Character Spreadsheet**: Used by players to generate and manage their characters. It allows players to issue commands, perform dice rolls, undo actions, level up, and more, while drawing from the DM's Database.

## Key Features
### Mobile Functionality
- **Mobile-Friendly Design**: Glorion is fully optimized for mobile use within the Google Sheets app, allowing players and DMs to manage campaigns and characters easily from their phones or tablets.

### Flexible Customization Options
- **Database Sheet Customization**: Customize your Database Sheet to add new game elements (classes, races etc.). No coding required, just fill in the cells as per the provided sheet structure to make changes to your campaign content.
- **Advanced Argument Customization**: For more detailed customization, use up to 50 arguments to refine abilities. Examples include `healing: true` or `attacks: 3`. These adjustments are made through the Apps Script editor (Extensions > Apps Script) but still require no coding skills. Detailed documentation for these customization options will be provided in the future.
- **Hooks and Custom Code**: For ultimate flexibility, Glorion supports 12 hooks and a `hookMemory` argument to embed custom code snippets throughout the ability process. While this requires some coding knowledge, example snippets will be available for ease of use. Comprehensive guides and examples will be provided to help with implementing custom code in a future update.

## Installation
1. **Requirements**: You'll need a **Google Drive** account, so make sure you have a **Gmail**.
2. **Copy the Spreadsheets**: Each DM should copy one **Database Spreadsheet**, and each player should copy one **Character Spreadsheet**:
    - **Database Spreadsheet**: https://tinyurl.com/glorion-database-copy
    - **Character Spreadsheet**: https://tinyurl.com/glorion-copy
3. Grant **View Access** to the **Database Spreadsheet**:
    - While inside the Database, select **File** at the top, hover over **Share** and then click on **Share with others** from the sub-menu. Under **General Access**, change the default **Restricted** setting to **Anyone with the link** (which grants **View Access**). Click **Copy Link** and share this link with your players.
4. **Setup for Character Spreadsheets**: Each **Character Spreadsheet** requires a few setup steps with information provided by the DM:
    - **Database ID**: Extract the **Database ID** from the Database link provided by your DM. For example, in `https://docs.google.com/spreadsheets/d/1NiCEk_88ws2IHuwH7PiyiUKIeDzaw0LcaGzo0F4Z8XI/edit?gid=0#gid=0`, the ID is the part between `/d/` and `/edit`, in this case `1NiCEk_88ws2IHuwH7PiyiUKIeDzaw0LcaGzo0F4Z8XI`. By default, **Character Spreadsheets** point to the original Database, which remains functional, but cannot be edited.
    - **Items Key**: This key is the name of the sheet within the Database that contains the item list for the campaign. By default, it’s named **The Vault**, a starter list of items provided by Glorion, ready to be edited to the liking of any DM. My suggestion is that a DM should have a unique and customized item list for each of their campaigns, which by default should be copies of **The Vault** sheet with surgical modifications, each with their own name (**Items key**), e.g., "*Wonderworks*", or "*Equinox*".

## Roadmap and Future Plans
- **Ongoing Maintenance**: Glorion will be continuously maintained, with new features added to enrich functionality and user experience.
- **Community Contributions**: Expect an expanding library of classes, races, backgrounds, and other assets, some of them being Glorion Homebrew, while others being user-generated content. Certain community contributions will be featured after the blessing of their creator, along with full credits to them.
- **Documentation**: The entirety of the Glorion library, as well as the Google Sheet named (custom) functions will be documented thoroughly.
- **Professional Artwork**: All AI-generated artwork will be replaced by human-made art as funding allows.
- **Website and Dedicated Server**: Plans include developing a dedicated server and standalone website for Glorion, providing a project hub beyond Discord.
- **Multi-System Compatibility**: Although currently only supporting D&D 5e, Glorion is designed to expand compatibility with other TTRPG systems.
- **Original System Development**: With ongoing community support, the ultimate vision is for Glorion to evolve into its own TTRPG system, drawing inspiration from user feedback and other systems.
- **Standalone App**: With sufficient funding, Glorion may transition into a standalone app, broadening its potential beyond Google Sheets.

## About the Project
Glorion is named after the world I’ve been building for over a decade, embodying years of personal design and world-building efforts. As Glorion grows, I’ll share more insights into this world and the philosophy behind its design to inspire users to create their own unique content.

## Contact
For questions, feedback, or support, please join our Discord community
https://tinyurl.com/glorion-discord

---

Happy adventuring, and may Glorion be a companion in all your epic quests!
