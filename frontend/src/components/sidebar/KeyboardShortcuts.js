import React from 'react';

const KeyboardShortcuts = ({ shortcutsManager }) => {
  return (
    <div className="section">
      <h3>Keyboard Shortcuts</h3>
      <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.3' }}>
        {Object.entries(shortcutsManager.getShortcutsByCategory()).map(([category, shortcuts]) => (
          <div key={category} style={{ marginBottom: '12px' }}>
            <div style={{ 
              color: '#4CAF50', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              marginBottom: '6px' 
            }}>
              {category}
            </div>
            {shortcuts.map((shortcut, index) => (
              <div key={`${category}-${shortcut.key}-${index}`} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '3px',
                padding: '2px 0'
              }}>
                <span>{shortcut.description}</span>
                <span style={{ 
                  backgroundColor: '#333', 
                  color: '#4CAF50',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold'
                }}>
                  {(() => {
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
                    if (shortcut.modifiers && shortcut.modifiers.length > 0) {
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
                  })()}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyboardShortcuts;