import shortcutsConfig from '../config/keyboardShortcuts.json';

export class KeyboardShortcutsManager {
  constructor() {
    this.config = shortcutsConfig;
    this.isGenerating = false;
  }

  // Set generation state to prevent shortcuts during generation
  setGenerating(isGenerating) {
    this.isGenerating = isGenerating;
  }

  // Check if a key event matches a shortcut
  matchShortcut(event, shortcutKey) {
    const shortcut = this.getShortcut(shortcutKey);
    if (!shortcut) return false;

    // Check if key matches
    if (event.key !== shortcut.key) return false;

    // Check modifiers
    const requiredModifiers = shortcut.modifiers || [];
    const hasShift = requiredModifiers.includes('shift');
    const hasCtrl = requiredModifiers.includes('ctrl') || requiredModifiers.includes('control');
    const hasAlt = requiredModifiers.includes('alt');
    const hasMeta = requiredModifiers.includes('meta') || requiredModifiers.includes('cmd');

    return (
      event.shiftKey === hasShift &&
      event.ctrlKey === hasCtrl &&
      event.altKey === hasAlt &&
      event.metaKey === hasMeta
    );
  }

  // Get shortcut configuration by key
  getShortcut(shortcutKey) {
    for (const category of Object.values(this.config)) {
      if (category[shortcutKey]) {
        return category[shortcutKey];
      }
    }
    return null;
  }

  // Check if shortcut can be executed
  canExecuteShortcut(shortcutKey, selectedNode = null) {
    const shortcut = this.getShortcut(shortcutKey);
    if (!shortcut) return false;

    // Check if generation is in progress and shortcut should be prevented
    if (shortcut.preventDuringGeneration && this.isGenerating) {
      return false;
    }

    // Check if shortcut requires a selected node
    if (shortcut.requiresSelection && !selectedNode) {
      return false;
    }

    // Check if shortcut requires non-root node (for siblings)
    if (shortcut.requiresNonRoot && selectedNode) {
      const isRoot = !selectedNode.parentId || 
        selectedNode.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000';
      if (isRoot) return false;
    }

    return true;
  }

  // Get all shortcuts grouped by category
  getShortcutsByCategory() {
    const result = {};
    for (const [categoryKey, shortcuts] of Object.entries(this.config)) {
      for (const [shortcutKey, shortcut] of Object.entries(shortcuts)) {
        const category = shortcut.category;
        if (!result[category]) {
          result[category] = [];
        }
        result[category].push({
          key: shortcutKey,
          ...shortcut
        });
      }
    }
    return result;
  }

  // Get display text for a shortcut
  getShortcutDisplayText(shortcutKey) {
    const shortcut = this.getShortcut(shortcutKey);
    if (!shortcut) return '';

    // If symbol exists, check if it needs + formatting
    if (shortcut.symbol) {
      // Check if it's a combination (has modifier symbols followed by other keys)
      const modifierSymbols = ['⇧', '⌃', '⌥', '⌘'];
      const symbol = shortcut.symbol;
      
      // If it starts with a modifier and has more characters, add +
      if (modifierSymbols.some(mod => symbol.startsWith(mod)) && symbol.length > 1) {
        // Find the modifier and split
        for (const mod of modifierSymbols) {
          if (symbol.startsWith(mod)) {
            const rest = symbol.substring(mod.length);
            if (rest.length > 0) {
              return mod + '+' + rest;
            }
          }
        }
      }
      return symbol;
    }

    // Otherwise, build from key and modifiers
    let displayText = shortcut.key;
    
    // Add modifier symbols
    if (shortcut.modifiers) {
      const modifierSymbols = {
        shift: '⇧',
        ctrl: '⌃',
        control: '⌃', 
        alt: '⌥',
        meta: '⌘',
        cmd: '⌘'
      };
      
      const modifiers = shortcut.modifiers.map(mod => modifierSymbols[mod] || mod).join('+');
      displayText = modifiers + '+' + displayText;
    }

    return displayText;
  }

  // Check if user is typing in an input field
  isTypingInInput() {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
  }
}

export default KeyboardShortcutsManager;