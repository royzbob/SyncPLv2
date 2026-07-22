# SyncPL Trading Dashboard - Agent Instructions

This file contains critical, immutable project-specific rules that all future AI coders, assistants, and agents must strictly adhere to.

## ⚠️ CRITICAL RULES

### 1. Protect the Tauri Icon Directory
* **DO NOT** modify, replace, delete, regenerate, or touch the contents of the `/src-tauri/icons` folder.
* **DO NOT** edit, remove, or modify any file inside `/src-tauri/icons/` (including `.png`, `.ico`, `.icns` files or subdirectories).
* The user has custom-configured and fixed these icons on their local machine. Any modification or regeneration will break the build or corrupt the files on their system.
* Leave the icon files, configurations, and scripts referencing them completely alone.

### 2. Desktop & Tauri Integration
* When modifying Vite or frontend configurations, make sure not to break compatibility with the Tauri desktop environment.
* Keep any updater scripts or modules clean and robust.
