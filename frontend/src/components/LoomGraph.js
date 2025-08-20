import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import KeyboardShortcutsManager from '../utils/keyboardShortcuts';

const LoomGraph = forwardRef(({ 
  currentTree, 
  onNodeSelect, 
  onAddNode, 
  onUpdateNode, 
  onGenerateSiblings,
  onCreateTree,
  isGeneratingChildren,
  setIsGeneratingChildren,
  isGeneratingSiblings,
  setIsGeneratingSiblings,
  lightweightMode
}, ref) => {
  const canvasRef = useRef(null);
  const graphRef = useRef(null);
  
  // Log whenever lightweightMode prop changes and update graph object
  useEffect(() => {
    console.log('🔍 [LoomGraph] lightweightMode prop updated to:', lightweightMode);
    if (graphRef.current) {
      graphRef.current.lightweightMode = lightweightMode;
      console.log('🔍 [LoomGraph] Updated graph.lightweightMode to:', lightweightMode);
    }
  }, [lightweightMode]);
  
  // Helper function to extract clean content from NFT JSON metadata
  const extractCleanContent = (rawContent) => {
    if (!rawContent) return '';
    
    try {
      // First attempt: Fix malformed JSON by escaping control characters
      let fixedContent = rawContent
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\b/g, ''); // Remove backspace characters

      try {
        const metadata = JSON.parse(fixedContent);
        const description = metadata.description || rawContent;
        return typeof description === 'string' ? description.replace(/\b/g, '') : description;
      } catch (firstError) {
        // Second attempt: Also escape unescaped quotes within string values
        fixedContent = rawContent
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
          .replace(/\f/g, '\\f')
          .replace(/\b/g, '')
          // Fix unescaped quotes within JSON string values
          .replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":')
          .replace(/:"([^"]*)"([^"]*)"([^"]*)"([,}])/g, ':"$1\\"$2\\"$3"$4');
        
        try {
          const metadata = JSON.parse(fixedContent);
          const description = metadata.description || rawContent;
          return typeof description === 'string' ? description.replace(/\b/g, '').replace(/\\"/g, '"') : description;
        } catch (secondError) {
          // Third attempt: Extract description using regex as fallback
          try {
            const descriptionMatch = rawContent.match(/"description"\s*:\s*"([^"]+)"/);
            if (descriptionMatch) {
              return descriptionMatch[1].replace(/\\n/g, '\n').replace(/\b/g, '');
            }
          } catch (regexError) {
            // Fallback: return cleaned raw content
            return typeof rawContent === 'string' ? rawContent.replace(/\b/g, '') : rawContent;
          }
        }
      }
    } catch (e) {
      // Final fallback: return cleaned raw content
      return typeof rawContent === 'string' ? rawContent.replace(/\b/g, '') : rawContent;
    }
    
    return rawContent;
  };
  
  useImperativeHandle(ref, () => ({
    addNodeFromBlockchain: (nodeData) => {
      if (graphRef.current) {
        addLoomNode(nodeData);
      }
    },
    reorganizeNodes: (targetNodeId = null) => {
      if (graphRef.current && graphRef.current.reorganizeNodes) {
        graphRef.current.reorganizeNodes(targetNodeId);
      }
    },
    reselectNode: (nodeId) => {
      if (graphRef.current) {
        const graph = graphRef.current;
        // Find the node by nodeId
        const updatedNode = graph.findNodesByType("loom/node").find(node => 
          node.properties?.nodeId === nodeId
        );
        
        if (updatedNode) {
          console.log('Re-selecting edited node:', nodeId.substring(0, 8) + '...');
          graph.selectedNodeForKeyboard = updatedNode;
          
          // Use the same selection method as post-generation
          if (typeof graph.canvasInstance?.selectNode === 'function') {
            graph.canvasInstance.selectNode(updatedNode);
          } else if (typeof graph.canvasInstance?.selectNodeByKeyboard === 'function') {
            graph.canvasInstance.selectNodeByKeyboard(updatedNode);
          }
          
          // IMPORTANT: Update React state by calling onNodeSelect
          if (onNodeSelect && updatedNode.properties) {
            const nodeData = {
              id: updatedNode.properties.nodeId,
              content: updatedNode.properties.content,
              parentId: updatedNode.properties.parentId,
              author: updatedNode.properties.author,
              timestamp: updatedNode.properties.timestamp
            };
            onNodeSelect(nodeData);
          }
          
          return true;
        }
      }
      return false;
    },
    findNodeById: (nodeId) => {
      if (graphRef.current) {
        return graphRef.current.findNodesByType("loom/node")
          .find(node => node.properties.nodeId === nodeId);
      }
      return null;
    },
    selectNodeByKeyboard: (node) => {
      if (graphRef.current && node) {
        const graph = graphRef.current;
        const canvas = graph.canvasInstance;
        
        // Set keyboard selection
        graph.selectedNodeForKeyboard = node;
        
        // Use LiteGraph's built-in selection
        if (canvas && typeof canvas.selectNode === 'function') {
          canvas.selectNode(node);
        } else {
          // Fallback selection
          graph.findNodesByType("loom/node").forEach(n => { n.selected = false; });
          node.selected = true;
        }
        
        // Center on the node for keyboard navigation
        if (typeof graph.centerOnNodeHiDPI === 'function') {
          graph.centerOnNodeHiDPI(node);
        } else if (canvas && typeof canvas.centerOnNode === 'function') {
          canvas.centerOnNode(node);
        }
        
        // Trigger selection callback
        if (onNodeSelect) {
          onNodeSelect({
            id: node.properties.nodeId,
            content: node.properties.content,
            author: node.properties.author,
            timestamp: node.properties.timestamp,
            parentId: node.properties.parentId
          });
        }
        
        // Mark canvas as dirty
        canvas && canvas.setDirty && canvas.setDirty(true, true);
      }
    }
  }));

  // Initialize LiteGraph canvas (only once)
  useEffect(() => {
    if (!canvasRef.current || !window.LiteGraph) return;

    // Clear any existing classes to prevent accumulation
    canvasRef.current.className = 'litegraph';

    // Set proper canvas dimensions for high DPI displays
    const rect = canvasRef.current.parentElement.getBoundingClientRect();
    const dpr = (window.devicePixelRatio || 1) * 2; // Double the resolution for crisp graphics
    
    canvasRef.current.width = rect.width * dpr;
    canvasRef.current.height = rect.height * dpr;
    canvasRef.current.style.width = rect.width + 'px';
    canvasRef.current.style.height = rect.height + 'px';

    // Initialize LiteGraph
    const graph = new window.LiteGraph.LGraph();
    let canvas = new window.LiteGraph.LGraphCanvas(canvasRef.current, graph);
    
    // Set proper pixel ratio for LiteGraph to handle high DPI correctly
    canvas.pixel_ratio = dpr;
    
    graphRef.current = graph;
    // Expose canvas instance to other effects
    graph.canvasInstance = canvas;
    
    // Configure LiteGraph settings
    canvas.background_image = null;
    canvas.render_canvas_border = false;
    canvas.render_connections_shadows = false;
    canvas.render_connection_arrows = false;
    
    
    // Constrain context menu to canvas bounds
    canvas.allow_dragnodes = true;
    canvas.allow_interaction = true;

    // Global link color green
    canvas.default_link_color = '#4CAF50';
    
    // Override context menu positioning to prevent full-screen dialog
    const originalShowContextMenu = canvas.showContextMenu;
    canvas.showContextMenu = function(options, e) {
      if (options && options.callback) {
        // Constrain menu size and position
        const menu = originalShowContextMenu.call(this, options, e);
        if (menu && menu.root) {
          menu.root.style.maxWidth = '300px';
          menu.root.style.maxHeight = '400px';
          menu.root.style.overflow = 'auto';
          menu.root.style.fontSize = '14px';
        }
        return menu;
      }
      return originalShowContextMenu.call(this, options, e);
    };
    
    // Custom LoomNode class
    function LoomNode(title) {
      this.title = title || "Loom Node";
      this.size = [300, 150];
      this.properties = {
        content: "",
        nodeId: "",
        parentId: "",
        author: "",
        timestamp: 0
      };
      
      // Add output for children
      this.addOutput("child", "text");
      // Add input for parent (except root)
      if (title !== "Root") {
        this.addInput("parent", "text");
      }
    }

    LoomNode.prototype.onDrawForeground = function(ctx) {
      if (this.flags.collapsed) return;
      
      const content = this.properties.content || "";
      const maxLength = 150; // Increased for better readability
      const displayContent = content.length > maxLength ? 
        content.substring(0, maxLength) + "..." : content;
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Inconsolata, monospace";
      
      // Wrap text to fit in the larger node
      const words = displayContent.split(' ');
      const lines = [];
      let currentLine = '';
      const maxWidth = this.size[0] - 30; // More padding for better appearance
      
      for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      // Draw text content
      let y = 35;
      for (let line of lines.slice(0, 6)) { // Back to 6 lines since edit indicator moved
        ctx.fillText(line, 15, y);
        y += 18;
      }
      
      // Draw metadata
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "11px Inconsolata, monospace";
      ctx.fillText(`Author: ${this.properties.author.substring(0, 10)}...`, 15, this.size[1] - 25);
      ctx.fillText(`Time: ${new Date(this.properties.timestamp * 1000).toLocaleTimeString()}`, 15, this.size[1] - 10);
      
    };

    LoomNode.prototype.onMouseDown = function(e, localpos, canvas) {
      // Use LiteGraph built-in selection behavior
      if (canvas && typeof canvas.selectNode === 'function') {
        canvas.selectNode(this);
      } else {
        this.selected = true;
      }
      // Track selection for keyboard navigation
      const currentGraph = this.graph;
      if (currentGraph) {
        currentGraph.selectedNodeForKeyboard = this;
      }

      if (onNodeSelect) {
        onNodeSelect({
          id: this.properties.nodeId,
          content: this.properties.content,
          author: this.properties.author,
          timestamp: this.properties.timestamp,
          parentId: this.properties.parentId
        });
      }
      return true;
    };

    LoomNode.prototype.onDblClick = function() {
      // Check if we have required data before opening dialog
      if (!this.properties.nodeId) {
        console.error('Cannot edit node: missing nodeId');
        return;
      }
      
      const originalContent = this.properties.content;
      
      // Create a more user-friendly edit dialog
      const editDialog = document.createElement('div');
      editDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2a2a2a;
        border: 1px solid #666;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      
      editDialog.innerHTML = `
        <div style="color: #fff; margin-bottom: 15px; font-family: 'Inconsolata', monospace;">
          <h3 style="margin: 0 0 10px 0; color: #4CAF50;">Edit Node Content</h3>
          <p style="margin: 0; color: #ccc; font-size: 12px;">Modify the text content for this node. Changes will be automatically saved to the blockchain.</p>
        </div>
        <textarea id="nodeContentEditor" style="
          width: 100%;
          height: 90px;
          background: #1a1a1a;
          color: #fff;
          border: 2px solid #4CAF50;
          border-radius: 4px;
          padding: 10px;
          font-family: 'Inconsolata', monospace;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
        ">${originalContent}</textarea>
        <style>
          #nodeContentEditor::selection {
            background-color: #4CAF50;
            color: #fff;
          }
          #nodeContentEditor::-moz-selection {
            background-color: #4CAF50;
            color: #fff;
          }
        </style>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <button id="cancelEdit" style="
              background: #666;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Cancel</button>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="childAtCursor" style="
              background: #4CAF50;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Child at Cursor</button>
            <button id="siblingAtCursor" style="
              background: #4CAF50;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Sibling at Cursor</button>
            <button id="saveEdit" style="
              background: #4CAF50;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Update Text</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(editDialog);
      
      const textarea = document.getElementById('nodeContentEditor');
      const saveBtn = document.getElementById('saveEdit');
      const cancelBtn = document.getElementById('cancelEdit');
      const childAtCursorBtn = document.getElementById('childAtCursor');
      const siblingAtCursorBtn = document.getElementById('siblingAtCursor');
      
      // Auto-resize textarea to fit content on modal open
      const autoResize = () => {
        textarea.style.height = 'auto';
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 90), 400);
        textarea.style.height = newHeight + 'px';
      };
      
      // Resize on modal open
      autoResize();
      
      // Focus and select text
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      
      let dialogClosed = false;
      let clickOutsideHandler = null;
      
      const cleanup = () => {
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler);
          clickOutsideHandler = null;
        }
        // Remove keyboard handler
        document.removeEventListener('keydown', handleEditModalKeydown);
      };
      
      const closeDialog = () => {
        if (!dialogClosed && document.body.contains(editDialog)) {
          dialogClosed = true;
          cleanup();
          document.body.removeChild(editDialog);
        }
      };
      
      const saveChanges = async () => {
        const newContent = textarea.value.trim();
        if (newContent && newContent !== originalContent) {
          // Show saving state
          saveBtn.textContent = 'Saving...';
          saveBtn.disabled = true;
          textarea.disabled = true;
          
          try {
            // Save to blockchain
            if (!onUpdateNode) {
              throw new Error('Update functionality is not available');
            }
            
            // Get current tree address from the graph reference
            const graph = this.graph;
            const treeAddress = graph?.currentTreeAddress;
            
            if (!treeAddress) {
              throw new Error('No current tree address available');
            }
            
            // Get the current onUpdateNode function from the graph (not closure)
            const currentUpdateNode = graph?.onUpdateNode;
            if (!currentUpdateNode) {
              throw new Error('Update function not available');
            }
            
            await currentUpdateNode(treeAddress, this.properties.nodeId, newContent);
            closeDialog();
          } catch (error) {
            console.error('Failed to save node update:', error);
            
            // Show error state
            saveBtn.textContent = 'Save Failed - Retry';
            saveBtn.style.background = '#f44336';
            saveBtn.disabled = false;
            textarea.disabled = false;
            
            // Create error message
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
              color: #f44336;
              font-size: 12px;
              margin: 10px 0;
              text-align: center;
              width: 100%;
              display: block;
            `;
            // Extract clean error text from blockchain errors
            let displayMessage = error.message;
            
            // Try to extract revert reason first
            const reasonMatch = error.message.match(/reason="([^"]+)"/);
            if (reasonMatch) {
              displayMessage = reasonMatch[1];
            } else if (error.message.includes('execution reverted')) {
              // Look for other patterns in execution reverted errors
              const revertMatch = error.message.match(/execution reverted: "?([^"]+)"?/);
              if (revertMatch) {
                displayMessage = revertMatch[1];
              }
            }
            
            errorMsg.textContent = displayMessage;
            saveBtn.parentElement.insertBefore(errorMsg, saveBtn.parentElement.firstChild);
            
            // Remove error message after 3 seconds
            setTimeout(() => {
              if (errorMsg.parentElement) {
                errorMsg.parentElement.removeChild(errorMsg);
              }
              saveBtn.textContent = 'Save Changes';
              saveBtn.style.background = '#4CAF50';
            }, 3000);
          }
        } else {
          closeDialog();
        }
      };
      
      const createSiblingAtCursor = async () => {
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPosition).trim();
        const textAfterCursor = textarea.value.substring(cursorPosition).trim();
        
        if (!textBeforeCursor && !textAfterCursor) {
          alert('Cannot split empty content');
          return;
        }
        
        if (!textAfterCursor) {
          alert('No text after cursor to create sibling node');
          return;
        }
        
        // Check if this node has a parent (root nodes cannot have siblings)
        if (!this.properties.parentId || this.properties.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          alert('Root node cannot have siblings');
          return;
        }
        
        // Show processing state
        siblingAtCursorBtn.textContent = 'Creating...';
        siblingAtCursorBtn.disabled = true;
        childAtCursorBtn.disabled = true;
        saveBtn.disabled = true;
        textarea.disabled = true;
        
        try {
          const graph = this.graph;
          const treeAddress = graph?.currentTreeAddress;
          const currentUpdateNode = graph?.onUpdateNode;
          
          if (!treeAddress || !currentUpdateNode) {
            throw new Error('Required functions not available');
          }
          
          // Use the backend update function with additional sibling creation data
          const options = {
            createSibling: true,
            siblingContent: textAfterCursor,
            parentId: this.properties.parentId,
            lightweightMode: graph.lightweightMode // Get current value from graph
          };
          
          console.log('Calling currentUpdateNode with sibling options:', options);
          await currentUpdateNode(treeAddress, this.properties.nodeId, textBeforeCursor, options);
          
          closeDialog();
        } catch (error) {
          console.error('Failed to create sibling at cursor:', error);
          
          // Show error state
          siblingAtCursorBtn.textContent = 'Failed - Retry';
          siblingAtCursorBtn.style.background = '#f44336';
          siblingAtCursorBtn.disabled = false;
          childAtCursorBtn.disabled = false;
          saveBtn.disabled = false;
          textarea.disabled = false;
          
          // Create error message
          const errorMsg = document.createElement('div');
          errorMsg.style.cssText = `
            color: #f44336;
            font-size: 12px;
            margin: 10px 0;
            text-align: center;
            width: 100%;
            display: block;
          `;
          
          let displayMessage = error.message;
          const reasonMatch = error.message.match(/reason="([^"]+)"/);
          if (reasonMatch) {
            displayMessage = reasonMatch[1];
          } else if (error.message.includes('execution reverted')) {
            const revertMatch = error.message.match(/execution reverted: "?([^"]+)"?/);
            if (revertMatch) {
              displayMessage = revertMatch[1];
            }
          }
          
          errorMsg.textContent = displayMessage;
          siblingAtCursorBtn.parentElement.parentElement.insertBefore(errorMsg, siblingAtCursorBtn.parentElement);
          
          // Remove error message after 3 seconds
          setTimeout(() => {
            if (errorMsg.parentElement) {
              errorMsg.parentElement.removeChild(errorMsg);
            }
            siblingAtCursorBtn.textContent = 'Sibling at Cursor';
            siblingAtCursorBtn.style.background = '#4CAF50';
          }, 3000);
        }
      };

      const createChildAtCursor = async () => {
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPosition).trim();
        const textAfterCursor = textarea.value.substring(cursorPosition).trim();
        
        if (!textBeforeCursor && !textAfterCursor) {
          alert('Cannot split empty content');
          return;
        }
        
        if (!textAfterCursor) {
          alert('No text after cursor to create child node');
          return;
        }
        
        // Show processing state
        childAtCursorBtn.textContent = 'Creating...';
        childAtCursorBtn.disabled = true;
        saveBtn.disabled = true;
        textarea.disabled = true;
        
        try {
          const graph = this.graph;
          const treeAddress = graph?.currentTreeAddress;
          const currentUpdateNode = graph?.onUpdateNode;
          
          if (!treeAddress || !currentUpdateNode) {
            throw new Error('Required functions not available');
          }
          
          // Use the backend update function with additional child creation data
          // This will update the current node and create a child in a single backend operation
          const options = {
            createChild: true,
            childContent: textAfterCursor,
            lightweightMode: graph.lightweightMode // Get current value from graph
          };
          
          console.log('Calling currentUpdateNode with options:', options);
          await currentUpdateNode(treeAddress, this.properties.nodeId, textBeforeCursor, options);
          
          closeDialog();
        } catch (error) {
          console.error('Failed to create child at cursor:', error);
          
          // Show error state
          childAtCursorBtn.textContent = 'Failed - Retry';
          childAtCursorBtn.style.background = '#f44336';
          childAtCursorBtn.disabled = false;
          saveBtn.disabled = false;
          textarea.disabled = false;
          
          // Create error message
          const errorMsg = document.createElement('div');
          errorMsg.style.cssText = `
            color: #f44336;
            font-size: 12px;
            margin: 10px 0;
            text-align: center;
            width: 100%;
            display: block;
          `;
          
          let displayMessage = error.message;
          const reasonMatch = error.message.match(/reason="([^"]+)"/);
          if (reasonMatch) {
            displayMessage = reasonMatch[1];
          } else if (error.message.includes('execution reverted')) {
            const revertMatch = error.message.match(/execution reverted: "?([^"]+)"?/);
            if (revertMatch) {
              displayMessage = revertMatch[1];
            }
          }
          
          errorMsg.textContent = displayMessage;
          childAtCursorBtn.parentElement.parentElement.insertBefore(errorMsg, childAtCursorBtn.parentElement);
          
          // Remove error message after 3 seconds
          setTimeout(() => {
            if (errorMsg.parentElement) {
              errorMsg.parentElement.removeChild(errorMsg);
            }
            childAtCursorBtn.textContent = 'Child at Cursor';
            childAtCursorBtn.style.background = '#4CAF50';
          }, 3000);
        }
      };

      // Event listeners
      saveBtn.addEventListener('click', saveChanges);
      cancelBtn.addEventListener('click', closeDialog);
      childAtCursorBtn.addEventListener('click', createChildAtCursor);
      siblingAtCursorBtn.addEventListener('click', createSiblingAtCursor);
      
      // Keyboard shortcuts for edit modal
      const handleEditModalKeydown = (e) => {
        // Import shortcutsManager for these checks
        const shortcutsManager = this.graph?.shortcutsManager;
        if (!shortcutsManager) return;
        
        // Check for edit modal specific shortcuts
        if (shortcutsManager.matchShortcut(e, 'childAtCursor')) {
          e.preventDefault();
          e.stopPropagation();
          createChildAtCursor();
          return;
        }
        
        if (shortcutsManager.matchShortcut(e, 'siblingAtCursor')) {
          e.preventDefault();
          e.stopPropagation();
          createSiblingAtCursor();
          return;
        }
        
        if (shortcutsManager.matchShortcut(e, 'updateText')) {
          e.preventDefault();
          e.stopPropagation();
          saveChanges();
          return;
        }
        
        // Existing shortcuts
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveChanges();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog();
        }
      };
      
      // Add keyboard listeners to both textarea and document for modal-wide shortcuts
      textarea.addEventListener('keydown', handleEditModalKeydown);
      document.addEventListener('keydown', handleEditModalKeydown);
      
      // Close on click outside
      setTimeout(() => {
        clickOutsideHandler = (e) => {
          if (!dialogClosed && !editDialog.contains(e.target)) {
            closeDialog();
          }
        };
        document.addEventListener('click', clickOutsideHandler);
      }, 100);
    };

    // Override computeSize to enforce our custom size
    LoomNode.prototype.computeSize = function() {
      return [300, 150];
    };

    // Override onResize to prevent size changes
    LoomNode.prototype.onResize = function() {
      this.size = [300, 150];
    };

    // Register the node type
    window.LiteGraph.registerNodeType("loom/node", LoomNode);
    // Disable LiteGraph's box selection to make single select match mouse default
    if (canvas) {
      canvas.allow_multiselection = false;
    }



    // Add context menu for creating nodes
    canvas.onMenuAdd = function(node, options, e, prev_menu, callback) {
      const menu = [
        {
          content: "Add Child Node",
          callback: () => {
            if (node && node.properties && node.properties.nodeId) {
              const content = prompt("Enter content for new node:");
              if (content && onAddNode) {
                onAddNode(node.properties.nodeId, content);
              }
            }
          }
        },
        null, // separator
        {
          content: "Reorganize All Nodes",
          callback: () => {
            if (graph.reorganizeNodes) {
              graph.reorganizeNodes();
            }
          }
        },
        null, // separator
        ...options
      ];
      return menu;
    };

    // Scale the context according to device pixel ratio
    const ctx = canvasRef.current.getContext('2d');
    ctx.scale(dpr, dpr);

    // Overlap detection utility
    const checkNodeOverlap = (nodeA, nodeB) => {
      const marginX = 20; // Minimum horizontal spacing
      const marginY = 20; // Minimum vertical spacing
      
      const rectA = {
        left: nodeA.pos[0] - marginX,
        right: nodeA.pos[0] + nodeA.size[0] + marginX,
        top: nodeA.pos[1] - marginY,
        bottom: nodeA.pos[1] + nodeA.size[1] + marginY
      };
      
      const rectB = {
        left: nodeB.pos[0],
        right: nodeB.pos[0] + nodeB.size[0],
        top: nodeB.pos[1],
        bottom: nodeB.pos[1] + nodeB.size[1]
      };
      
      return !(rectA.right < rectB.left || 
               rectA.left > rectB.right || 
               rectA.bottom < rectB.top || 
               rectA.top > rectB.bottom);
    };

    // Auto-reorganize nodes to avoid overlaps - optimized for partial updates
    const reorganizeNodes = (targetNodeId = null) => {
      const allNodes = graph.findNodesByType("loom/node");
      if (allNodes.length <= 1) return;

      let nodesToReorganize;
      
      if (targetNodeId) {
        // Partial reorganization: only reorganize the subtree starting from targetNodeId
        const targetNode = findNodeById(targetNodeId);
        if (!targetNode) return;
        
        // Get all descendants of the target node
        const getDescendants = (nodeId) => {
          const descendants = [];
          const children = allNodes.filter(n => n.properties.parentId === nodeId);
          
          for (const child of children) {
            descendants.push(child);
            descendants.push(...getDescendants(child.properties.nodeId));
          }
          
          return descendants;
        };
        
        nodesToReorganize = [targetNode, ...getDescendants(targetNodeId)];
      } else {
        // Full reorganization
        nodesToReorganize = allNodes;
      }

      // nodesToReorganize = allNodes;


      // Group affected nodes by depth level (distance from root)
      const levels = new Map();
      const rootNodes = nodesToReorganize.filter(node => 
        node.properties.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
        node.properties.parentId === '0x0' || 
        node.properties.parentId === null ||
        !findNodeById(node.properties.parentId)
      );

      // Build level structure for nodes to reorganize
      const visited = new Set();
      const assignLevel = (node, level) => {
        if (visited.has(node.properties.nodeId)) return;
        visited.add(node.properties.nodeId);
        
        if (!levels.has(level)) levels.set(level, []);
        levels.get(level).push(node);
        
        const children = nodesToReorganize.filter(n => n.properties.parentId === node.properties.nodeId);
        children.forEach(child => assignLevel(child, level + 1));
      };

      // If we're doing partial reorganization, start from the target node's level
      if (targetNodeId && rootNodes.length === 0) {
        const targetNode = findNodeById(targetNodeId);
        if (targetNode) {
          // Find the target node's depth by traversing up to root
          let depth = 0;
          let currentNode = targetNode;
          while (currentNode && currentNode.properties.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000' && 
                 currentNode.properties.parentId !== '0x0' && currentNode.properties.parentId) {
            const parent = findNodeById(currentNode.properties.parentId);
            if (!parent) break;
            currentNode = parent;
            depth++;
          }
          
          assignLevel(targetNode, depth);
        }
      } else {
        rootNodes.forEach(root => assignLevel(root, 0));
      }

      // Position nodes by level - only animate nodes that actually need to move
      const levelSpacing = 400; // Horizontal spacing between levels
      const nodeSpacing = 200;  // Vertical spacing between nodes
      const animatingNodes = new Set();

      for (let [level, nodes] of levels.entries()) {
        // For partial reorganization, preserve existing positions where possible
        if (targetNodeId && level > 0) {
          // Get the parent's position to anchor the layout
          const parentNodes = nodes.map(node => {
            const parentId = node.properties.parentId;
            return parentId ? findNodeById(parentId) : null;
          }).filter(Boolean);
          
          if (parentNodes.length > 0) {
            // Group nodes by their parent for better organization
            const nodesByParent = new Map();
            nodes.forEach(node => {
              const parentId = node.properties.parentId || 'root';
              if (!nodesByParent.has(parentId)) {
                nodesByParent.set(parentId, []);
              }
              nodesByParent.get(parentId).push(node);
            });
            
            // Position each parent's children
            for (let [parentId, children] of nodesByParent.entries()) {
              const parentNode = parentId === 'root' ? null : findNodeById(parentId);
              const baseX = parentNode ? parentNode.pos[0] + 350 : 50 + (level * levelSpacing);
              const baseY = parentNode ? parentNode.pos[1] : 50;
              
              children.forEach((node, index) => {
                const newPos = [baseX, baseY + (index * nodeSpacing) - ((children.length - 1) * nodeSpacing / 2)];
                animateNodeToPosition(node, newPos, animatingNodes);
              });
            }
          }
        } else {
          // Standard level-based positioning
          const x = 50 + (level * levelSpacing);
          const totalHeight = nodes.length * nodeSpacing;
          const startY = Math.max(50, totalHeight / 2);
          
          nodes.forEach((node, index) => {
            const newPos = [x, startY + (index * nodeSpacing) - (totalHeight / 2)];
            animateNodeToPosition(node, newPos, animatingNodes);
          });
        }
      }
    };

    // Helper function to animate a single node to a new position
    const animateNodeToPosition = (node, newPos, animatingNodes) => {
      const currentPos = [...node.pos];
      const deltaX = newPos[0] - currentPos[0];
      const deltaY = newPos[1] - currentPos[1];
      
      // Only animate if the position change is significant
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        animatingNodes.add(node.properties.nodeId);
        
        let step = 0;
        const steps = 8; // Reduced steps for faster animation
        
        const animateStep = () => {
          step++;
          const progress = step / steps;
          const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          
          node.pos = [
            currentPos[0] + (deltaX * easeProgress),
            currentPos[1] + (deltaY * easeProgress)
          ];
          
          // Only update connections for this specific node and its immediate connections
          updateNodeConnections(node);
          
          if (step < steps) {
            setTimeout(animateStep, 40); // Slightly faster animation
          } else {
            animatingNodes.delete(node.properties.nodeId);
            // Final position adjustment
            node.pos = newPos;
            updateNodeConnections(node);
          }
        };
        
        animateStep();
      }
    };

    // Helper function to update connections for a specific node
    const updateNodeConnections = (node) => {
      node.setDirtyCanvas(true, true);
      
      // Update connected nodes
      if (node.inputs) {
        for (let input of node.inputs) {
          if (input.link) {
            const link = graph.links[input.link];
            if (link && link.origin_id) {
              const originNode = graph.getNodeById(link.origin_id);
              if (originNode) {
                originNode.setDirtyCanvas(true, true);
              }
            }
          }
        }
      }
      
      if (node.outputs) {
        for (let output of node.outputs) {
          if (output.links) {
            for (let linkId of output.links) {
              const link = graph.links[linkId];
              if (link && link.target_id) {
                const targetNode = graph.getNodeById(link.target_id);
                if (targetNode) {
                  targetNode.setDirtyCanvas(true, true);
                }
              }
            }
          }
        }
      }
      
      // Request canvas redraw
      canvas.setDirty(true, true);
    };

    // Find optimal position to avoid overlaps
    const findNonOverlappingPosition = (newNode, preferredPos) => {
      const allNodes = graph.findNodesByType("loom/node").filter(n => n !== newNode);
      let position = [...preferredPos];
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts) {
        // Test current position
        const testNode = { pos: position, size: newNode.size };
        const hasOverlap = allNodes.some(existingNode => checkNodeOverlap(testNode, existingNode));
        
        if (!hasOverlap) {
          return position;
        }
        
        // Try different positions in a spiral pattern
        const angle = (attempts * 0.5) * Math.PI;
        const radius = 50 + (attempts * 20);
        position = [
          preferredPos[0] + Math.cos(angle) * radius,
          preferredPos[1] + Math.sin(angle) * radius
        ];
        
        attempts++;
      }
      
      // If we can't find a good position, use the preferred one anyway
      return preferredPos;
    };

    // Helper function to add nodes from blockchain data
    const addLoomNode = (nodeData) => {
      const node = window.LiteGraph.createNode("loom/node");
      
      // Extract clean content from NFT JSON metadata
      const cleanContent = extractCleanContent(nodeData.content);
      node.title = cleanContent.substring(0, 20) + (cleanContent.length > 20 ? "..." : "");
      
      // Force the size after creation
      node.size = [300, 150];
      
      node.properties = {
        content: cleanContent, // Store the clean content instead of raw JSON
        rawContent: nodeData.content, // Keep raw content for reference if needed
        nodeId: nodeData.nodeId,
        parentId: nodeData.parentId,
        author: nodeData.author,
        timestamp: nodeData.timestamp
      };
      
      // Position node based on tree structure
      const isRootParent = nodeData.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
                           nodeData.parentId === '0x0' || 
                           nodeData.isRoot;
      
      let preferredPos;
      if (isRootParent || nodeData.isRoot) {
        // Root node
        preferredPos = [50, 50];
      } else {
        const parentNode = findNodeById(nodeData.parentId);
        if (parentNode) {
          const childrenCount = graph.findNodesByType("loom/node")
            .filter(n => n.properties.parentId === nodeData.parentId).length;
          preferredPos = [
            parentNode.pos[0] + 350,
            parentNode.pos[1] + (childrenCount * 200) - 90
          ];
          
          // Connect to parent
          parentNode.connect(0, node, 0);
        } else {
          // Fallback position if parent not found
          console.warn('Parent node not found for:', nodeData.nodeId, 'parent:', nodeData.parentId);
          preferredPos = [200, 200 + Math.random() * 100];
        }
      }
      
      // Find position that doesn't overlap
      node.pos = findNonOverlappingPosition(node, preferredPos);
      
      graph.add(node);
      
      // Force size again after adding to graph
      node.size = [300, 150];
      node.setDirtyCanvas(true);
      
      canvas.setDirty(true);
    };

    const findNodeById = (nodeId) => {
      return graph.findNodesByType("loom/node")
        .find(node => node.properties.nodeId === nodeId);
    };

    // Store reference to addLoomNode function and reorganize function
    graph.addLoomNode = addLoomNode;
    graph.reorganizeNodes = reorganizeNodes;
    
    // Function to show tree creation modal
    const showCreateTreeModal = () => {
      // Check if we have the required function
      if (!graph.onCreateTree) {
        console.error('Create tree function not available');
        return;
      }

      // Create tree creation dialog with same styling as edit modal
      const createDialog = document.createElement('div');
      createDialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2a2a2a;
        border: 1px solid #666;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      
      createDialog.innerHTML = `
        <div style="color: #fff; margin-bottom: 15px; font-family: 'Inconsolata', monospace;">
          <h3 style="margin: 0 0 10px 0; color: #4CAF50;">Create New Tree</h3>
          <p style="margin: 0; color: #ccc; font-size: 12px;">Enter the root content for your new tree. This will be saved to the blockchain.</p>
        </div>
        <textarea id="treeContentEditor" style="
          width: 100%;
          height: 90px;
          background: #1a1a1a;
          color: #fff;
          border: 2px solid #4CAF50;
          border-radius: 4px;
          padding: 10px;
          font-family: 'Inconsolata', monospace;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
        " placeholder="Enter root content for new tree..."></textarea>
        <style>
          #treeContentEditor::selection {
            background-color: #4CAF50;
            color: #fff;
          }
          #treeContentEditor::-moz-selection {
            background-color: #4CAF50;
            color: #fff;
          }
        </style>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <button id="cancelCreate" style="
              background: #666;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Cancel</button>
          </div>
          <div>
            <button id="createTree" style="
              background: #4CAF50;
              color: #fff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-family: 'Inconsolata', monospace;
              font-size: 12px;
            ">Create Tree</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(createDialog);
      
      const textarea = document.getElementById('treeContentEditor');
      const createBtn = document.getElementById('createTree');
      const cancelBtn = document.getElementById('cancelCreate');
      
      // Auto-resize textarea to fit content on modal open
      const autoResize = () => {
        textarea.style.height = 'auto';
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 90), 400);
        textarea.style.height = newHeight + 'px';
      };
      
      // Resize on modal open
      autoResize();
      
      // Focus textarea
      textarea.focus();
      
      let dialogClosed = false;
      let clickOutsideHandler = null;
      
      const cleanup = () => {
        if (clickOutsideHandler) {
          document.removeEventListener('click', clickOutsideHandler);
          clickOutsideHandler = null;
        }
        // Remove keyboard handler
        document.removeEventListener('keydown', handleCreateModalKeydown);
      };
      
      const closeDialog = () => {
        if (!dialogClosed && document.body.contains(createDialog)) {
          dialogClosed = true;
          cleanup();
          document.body.removeChild(createDialog);
        }
      };
      
      const createNewTree = async () => {
        const content = textarea.value.trim();
        if (!content) {
          alert('Please enter content for the tree');
          return;
        }
        
        // Show creating state
        createBtn.textContent = 'Creating...';
        createBtn.disabled = true;
        textarea.disabled = true;
        
        try {
          // Get the create tree function from the graph
          const createTreeFn = graph.onCreateTree;
          if (!createTreeFn) {
            throw new Error('Create tree functionality not available');
          }
          
          await createTreeFn(content);
          closeDialog();
        } catch (error) {
          console.error('Failed to create tree:', error);
          
          // Show error state
          createBtn.textContent = 'Create Failed - Retry';
          createBtn.style.background = '#f44336';
          createBtn.disabled = false;
          textarea.disabled = false;
          
          // Create error message
          const errorMsg = document.createElement('div');
          errorMsg.style.cssText = `
            color: #f44336;
            font-size: 12px;
            margin: 10px 0;
            text-align: center;
            width: 100%;
            display: block;
          `;
          // Extract clean error text from blockchain errors
          let displayMessage = error.message;
          
          // Try to extract revert reason first
          const reasonMatch = error.message.match(/reason="([^"]+)"/);
          if (reasonMatch) {
            displayMessage = reasonMatch[1];
          } else if (error.message.includes('execution reverted')) {
            // Look for other patterns in execution reverted errors
            const revertMatch = error.message.match(/execution reverted: "?([^"]+)"?/);
            if (revertMatch) {
              displayMessage = revertMatch[1];
            }
          }
          
          errorMsg.textContent = displayMessage;
          createBtn.parentElement.insertBefore(errorMsg, createBtn.parentElement.firstChild);
          
          // Remove error message after 3 seconds
          setTimeout(() => {
            if (errorMsg.parentElement) {
              errorMsg.parentElement.removeChild(errorMsg);
            }
            createBtn.textContent = 'Create Tree';
            createBtn.style.background = '#4CAF50';
          }, 3000);
        }
      };
      
      // Event listeners
      createBtn.addEventListener('click', createNewTree);
      cancelBtn.addEventListener('click', closeDialog);
      
      // Keyboard shortcuts for create modal
      const handleCreateModalKeydown = (e) => {
        // Import shortcutsManager for these checks
        const shortcutsManager = graph?.shortcutsManager;
        if (!shortcutsManager) return;
        
        // Existing shortcuts
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          createNewTree();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog();
        }
      };
      
      // Add keyboard listeners to both textarea and document for modal-wide shortcuts
      textarea.addEventListener('keydown', handleCreateModalKeydown);
      document.addEventListener('keydown', handleCreateModalKeydown);
      
      // Close on click outside
      setTimeout(() => {
        clickOutsideHandler = (e) => {
          if (!dialogClosed && !createDialog.contains(e.target)) {
            closeDialog();
          }
        };
        document.addEventListener('click', clickOutsideHandler);
      }, 100);
    };
    
    // Add keyboard navigation with shortcuts manager
    graph.selectedNodeForKeyboard = null;
    const shortcutsManager = new KeyboardShortcutsManager();
    
    // Store shortcutsManager on graph for access from edit modal
    graph.shortcutsManager = shortcutsManager;
    
    const handleKeyDown = (e) => {
      // Don't interfere if user is typing in an input field
      if (shortcutsManager.isTypingInInput()) {
        return;
      }

      // Update generation state in shortcuts manager
      shortcutsManager.setGenerating(isGeneratingChildren || isGeneratingSiblings);

      const selectedNode = graph.selectedNodeForKeyboard;
      const selectedNodeData = selectedNode ? {
        id: selectedNode.properties.nodeId,
        parentId: selectedNode.properties.parentId
      } : null;

      // Handle navigation shortcuts
      if (shortcutsManager.matchShortcut(e, 'up') || 
          shortcutsManager.matchShortcut(e, 'down') || 
          shortcutsManager.matchShortcut(e, 'left') || 
          shortcutsManager.matchShortcut(e, 'right')) {
        
        
        e.preventDefault();
        
        const allNodes = graph.findNodesByType("loom/node");
        if (allNodes.length === 0) return;
        
        // If no node is currently selected, select the first one
        if (!selectedNode) {
          graph.selectedNodeForKeyboard = allNodes[0];
          selectNodeByKeyboard(graph.selectedNodeForKeyboard);
          return;
        }
        
        let targetNode = null;
        
        if (shortcutsManager.matchShortcut(e, 'left')) {
          // Left: Navigate to parent
          targetNode = findParent(allNodes, selectedNode);
        } else if (shortcutsManager.matchShortcut(e, 'right')) {
          // Right: Navigate to first child
          targetNode = findFirstChild(allNodes, selectedNode);
        } else if (shortcutsManager.matchShortcut(e, 'down')) {
          // Down: Navigate to next sibling
          targetNode = findNextSibling(allNodes, selectedNode);
        } else if (shortcutsManager.matchShortcut(e, 'up')) {
          // Up: Navigate to previous sibling
          targetNode = findPreviousSibling(allNodes, selectedNode);
        }
        
        if (targetNode && targetNode !== selectedNode) {
          graph.selectedNodeForKeyboard = targetNode;
          selectNodeByKeyboard(graph.selectedNodeForKeyboard);
        }
        return;
      }

      // Handle generation shortcuts
      if (shortcutsManager.matchShortcut(e, 'generateChildren')) {
        if (shortcutsManager.canExecuteShortcut('generateChildren', selectedNodeData)) {
          e.preventDefault();
          
          // Update sidebar state
          if (setIsGeneratingChildren) {
            setIsGeneratingChildren(true);
          }
          
          const generateChildren = graph.onGenerateSiblings;
          if (generateChildren) {
            generateChildren(selectedNodeData.id, 3)
              .then((result) => {
                if (setIsGeneratingChildren) {
                  setIsGeneratingChildren(false);
                }
                // Only reorganize if nodes were actually created
                if (result && result.successCount > 0) {
                  // Reorganize nodes after generation completes - only the affected subtree
                  setTimeout(() => {
                    // Re-select the same node without moving camera
                    const node = findNodeById(selectedNodeData.id);
                    if (node) {
                      graph.selectedNodeForKeyboard = node;
                      selectNodeProgrammatically(node);
                    }
                  }, 500); // Small delay to ensure nodes are fully added
                }
              })
              .catch(() => {
                if (setIsGeneratingChildren) {
                  setIsGeneratingChildren(false);
                }
              });
          }
        }
        return;
      }

      if (shortcutsManager.matchShortcut(e, 'generateSiblings')) {
        if (shortcutsManager.canExecuteShortcut('generateSiblings', selectedNodeData)) {
          e.preventDefault();
          
          // Update sidebar state
          if (setIsGeneratingSiblings) {
            setIsGeneratingSiblings(true);
          }
          
          const generateSiblings = graph.onGenerateSiblings;
          if (generateSiblings) {
            generateSiblings(selectedNodeData.parentId, 3)
              .then((result) => {
                if (setIsGeneratingSiblings) {
                  setIsGeneratingSiblings(false);
                }
                // Only reorganize if nodes were actually created
                if (result && result.successCount > 0) {
                  // Reorganize nodes after generation completes - only the affected subtree
                  setTimeout(() => {
                    // Re-select the parent node without moving camera
                    const parentNode = findNodeById(selectedNodeData.parentId);
                    if (parentNode) {
                      graph.selectedNodeForKeyboard = parentNode;
                      selectNodeProgrammatically(parentNode);
                    }
                  }, 500); // Small delay to ensure nodes are fully added
                }
              })
              .catch(() => {
                if (setIsGeneratingSiblings) {
                  setIsGeneratingSiblings(false);
                }
              });
          }
        }
        return;
      }

      // Handle edit shortcut (F2)
      if (shortcutsManager.matchShortcut(e, 'editNode')) {
        if (shortcutsManager.canExecuteShortcut('editNode', selectedNodeData)) {
          e.preventDefault();
          if (selectedNode && selectedNode.onDblClick) {
            selectedNode.onDblClick();
          }
        }
        return;
      }

      // Handle deselect shortcut (Escape)
      if (shortcutsManager.matchShortcut(e, 'deselect')) {
        if (selectedNode) {
          e.preventDefault();
          
          const canvas = graph.canvasInstance;
          
          // Use LiteGraph's native deselection method
          if (canvas && typeof canvas.deselectAllNodes === 'function') {
            canvas.deselectAllNodes();
          } else {
            // Fallback: manually clear selection
            const allNodes = graph.findNodesByType("loom/node");
            allNodes.forEach(node => { node.selected = false; });
          }
          
          // Clear our custom selection state
          graph.selectedNodeForKeyboard = null;
          
          // Clear the sidebar selection state
          if (onNodeSelect) {
            onNodeSelect(null);
          }
          
          // Mark canvas as dirty to redraw
          if (canvas && canvas.setDirty) {
            canvas.setDirty(true, true);
          }
        }
        return;
      }

      // Handle create tree modal shortcut (T)
      if (shortcutsManager.matchShortcut(e, 'createTreeModal')) {
        e.preventDefault();
        showCreateTreeModal();
        return;
      }
    };
    
    // Tree-based navigation functions
    const findFirstChild = (nodes, currentNode) => {
      const children = nodes.filter(node => 
        node.properties.parentId === currentNode.properties.nodeId
      );
      
      if (children.length === 0) return null;
      
      // Sort children by Y position (top to bottom) to get consistent "first" child
      children.sort((a, b) => a.pos[1] - b.pos[1]);
      return children[0];
    };
    
    const findParent = (nodes, currentNode) => {
      const parentId = currentNode.properties.parentId;
      if (!parentId || 
          parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
          parentId === '0x0') {
        return null; // No parent (root node)
      }
      
      return nodes.find(node => node.properties.nodeId === parentId) || null;
    };
    
    const findNextSibling = (nodes, currentNode) => {
      const parentId = currentNode.properties.parentId;
      if (!parentId || 
          parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
          parentId === '0x0') {
        return null; // Root node has no siblings
      }
      
      // Get all siblings (including current node)
      const siblings = nodes.filter(node => 
        node.properties.parentId === parentId
      );
      
      if (siblings.length <= 1) return null; // No other siblings
      
      // Sort siblings by Y position (top to bottom)
      siblings.sort((a, b) => a.pos[1] - b.pos[1]);
      
      // Find current node index
      const currentIndex = siblings.findIndex(node => 
        node.properties.nodeId === currentNode.properties.nodeId
      );
      
      if (currentIndex === -1 || currentIndex === siblings.length - 1) {
        return null; // Current node not found or is last sibling
      }
      
      return siblings[currentIndex + 1];
    };
    
    const findPreviousSibling = (nodes, currentNode) => {
      const parentId = currentNode.properties.parentId;
      if (!parentId || 
          parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
          parentId === '0x0') {
        return null; // Root node has no siblings
      }
      
      // Get all siblings (including current node)
      const siblings = nodes.filter(node => 
        node.properties.parentId === parentId
      );
      
      if (siblings.length <= 1) return null; // No other siblings
      
      // Sort siblings by Y position (top to bottom)
      siblings.sort((a, b) => a.pos[1] - b.pos[1]);
      
      // Find current node index
      const currentIndex = siblings.findIndex(node => 
        node.properties.nodeId === currentNode.properties.nodeId
      );
      
      if (currentIndex === -1 || currentIndex === 0) {
        return null; // Current node not found or is first sibling
      }
      
      return siblings[currentIndex - 1];
    };
    
    // High-DPI aware centering on a node (manual implementation)
    const centerOnNodeHiDPI = (node) => {
      if (!node || !canvas || !canvasRef.current) return;

      const nodeCenter = [
        node.pos[0] + node.size[0] / 2,
        node.pos[1] + node.size[1] / 2
      ];

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const canvasCenter = [
        canvasRect.width / 2,
        canvasRect.height / 2
      ];

      const newOffset = [
        canvasCenter[0] - nodeCenter[0],
        canvasCenter[1] - nodeCenter[1]
      ];

      if (canvas.ds) {
        canvas.ds.offset[0] = newOffset[0];
        canvas.ds.offset[1] = newOffset[1];
        canvas.setDirty(true, true);
      } else if (typeof canvas.centerOnNode === 'function') {
        // Fallback to built-in if drag-scale state not available
        canvas.centerOnNode(node);
        canvas.setDirty(true, true);
      } else if (canvas.setDirty) {
        canvas.setDirty(true, true);
      }
    };
    // Expose for use in deferred callbacks
    graph.centerOnNodeHiDPI = centerOnNodeHiDPI;

    // Function for keyboard navigation (with camera centering)
    const selectNodeByKeyboard = (node) => {
      selectNodeProgrammatically(node);
      // Center the canvas on the selected node with high-DPI aware method
      centerOnNodeHiDPI(node);
    };
    
    // Function for programmatic selection (without camera centering)
    const selectNodeProgrammatically = (node) => {
      // Use LiteGraph's built-in selection
      if (canvas && typeof canvas.selectNode === 'function') {
        canvas.selectNode(node);
      } else {
        // Fallback if API unavailable
        graph.findNodesByType("loom/node").forEach(n => { n.selected = false; });
        node.selected = true;
      }
      // Trigger the node selection callback
      if (onNodeSelect) {
        onNodeSelect({
          id: node.properties.nodeId,
          content: node.properties.content,
          author: node.properties.author,
          timestamp: node.properties.timestamp,
          parentId: node.properties.parentId
        });
      }
    };
    
    // Add event listener for keyboard navigation
    document.addEventListener('keydown', handleKeyDown);
    
    // Store reference to cleanup function
    graph.keyboardCleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
    };

    // Handle window resize by recreating canvas from scratch
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement && graph) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        const newDpr = (window.devicePixelRatio || 1) * 2;
        
        // Store current graph state
        const currentSelectedNode = graph.selectedNodeForKeyboard;
        
        // Clean up old canvas
        if (canvas) {
          canvas.setGraph(null);
        }
        
        // Set new canvas dimensions with high DPI
        canvasRef.current.width = rect.width * newDpr;
        canvasRef.current.height = rect.height * newDpr;
        canvasRef.current.style.width = rect.width + 'px';
        canvasRef.current.style.height = rect.height + 'px';
        
        // Scale the context
        const ctx = canvasRef.current.getContext('2d');
        ctx.scale(newDpr, newDpr);
        
        // Create new LiteGraph canvas
        const newCanvas = new window.LiteGraph.LGraphCanvas(canvasRef.current, graph);
        newCanvas.pixel_ratio = newDpr;
        
        // Restore canvas settings
        newCanvas.background_image = null;
        newCanvas.render_canvas_border = false;
        newCanvas.render_connections_shadows = false;
        newCanvas.render_connection_arrows = false;
        newCanvas.allow_dragnodes = true;
        newCanvas.allow_interaction = true;
        newCanvas.default_link_color = '#4CAF50';
        
        // Update global canvas reference
        canvas = newCanvas;
        graph.canvasInstance = canvas;
        
        // Restore keyboard selection if it existed (and re-apply built-in selection)
        if (currentSelectedNode) {
          graph.selectedNodeForKeyboard = currentSelectedNode;
          if (typeof canvas.selectNode === 'function') {
            canvas.selectNode(currentSelectedNode);
          }
          // Re-center view on the selected node for consistency - DISABLED
          // centerOnNodeHiDPI(currentSelectedNode);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (graph && graph.keyboardCleanup) {
        graph.keyboardCleanup();
      }
      if (canvas) {
        canvas.setGraph(null);
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Load tree data when currentTree changes
  useEffect(() => {
    if (!graphRef.current || !currentTree) return;
    

    const graph = graphRef.current;
    
    // Store current tree address and functions on the graph for access in node functions
    graph.currentTreeAddress = currentTree.address;
    graph.onUpdateNode = onUpdateNode;
    graph.onAddNode = onAddNode;
    graph.onGenerateSiblings = onGenerateSiblings;
    graph.onCreateTree = onCreateTree;
    graph.lightweightMode = lightweightMode;
    
    // Clear existing nodes
    graph.clear();
    
    // Add nodes from current tree in proper order (parents first)
    if (currentTree.nodes) {
      
      // Sort nodes: root first, then by dependency order
      const sortedNodes = [...currentTree.nodes].sort((a, b) => {
        // Root nodes come first
        if (a.isRoot && !b.isRoot) return -1;
        if (!a.isRoot && b.isRoot) return 1;
        if (a.isRoot && b.isRoot) return 0;
        
        // For non-root nodes, try to ensure parents come before children
        // This is a simple heuristic - in a full implementation you'd do topological sort
        return 0;
      });
      
      // Add root nodes first
      sortedNodes.filter(node => node.isRoot).forEach(nodeData => {
        if (graph.addLoomNode) {
          graph.addLoomNode(nodeData);
        }
      });
      
      // Then add non-root nodes in multiple passes to handle dependencies
      const nonRootNodes = sortedNodes.filter(node => !node.isRoot);
      let addedNodes = new Set();
      let passes = 0;
      const maxPasses = 10; // Prevent infinite loops
      
      while (nonRootNodes.length > addedNodes.size && passes < maxPasses) {
        passes++;
        
        nonRootNodes.forEach(nodeData => {
          if (addedNodes.has(nodeData.nodeId)) return;
          
          // Check if parent exists in graph or is root (parentId = 0x0...0)
          const isRootParent = nodeData.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
                               nodeData.parentId === '0x0';
          const parentExists = isRootParent ||
                             graph.findNodesByType("loom/node").some(n => n.properties.nodeId === nodeData.parentId);
          
          if (parentExists) {
            graph.addLoomNode(nodeData);
            addedNodes.add(nodeData.nodeId);
          } else {
            console.log('Waiting for parent of node:', nodeData.nodeId, 'parent:', nodeData.parentId);
          }
        });
      }
      
      if (passes >= maxPasses) {
        console.warn('Max passes reached, some nodes may not have been added');
      }
      
      console.log(`Loaded ${graph.findNodesByType("loom/node").length} nodes to graph`);
      
      // Auto-reorganize nodes after loading to fix any overlaps
      setTimeout(() => {
        if (graph.reorganizeNodes) {
          graph.reorganizeNodes();
        }
        // If there is a pending node to reselect (post-generation), apply it now
        setTimeout(() => {
          if (graph.pendingReSelectNodeId) {
            const node = graph.findNodesByType("loom/node").find(n => n.properties?.nodeId === graph.pendingReSelectNodeId);
            if (node) {
              graph.selectedNodeForKeyboard = node;
              const activeCanvas = graph.canvasInstance;
              try {
                if (activeCanvas && typeof activeCanvas.selectNode === 'function') {
                  activeCanvas.selectNode(node);
                }
                // Center with high-DPI aware helper if available on graph, else via canvas API - DISABLED
                // if (typeof graph.centerOnNodeHiDPI === 'function') {
                //   graph.centerOnNodeHiDPI(node);
                // } else if (activeCanvas && typeof activeCanvas.centerOnNode === 'function') {
                //   activeCanvas.centerOnNode(node);
                // }
                activeCanvas && activeCanvas.setDirty && activeCanvas.setDirty(true, true);
              } catch (err) {
                try { selectNodeProgrammatically(node); } catch {}
              }
            }
            graph.pendingReSelectNodeId = null;
          }
        }, 200);
      }, 100); // Small delay to ensure all nodes are rendered
    }
  }, [currentTree]);

  // Update function references when they change
  useEffect(() => {
    if (graphRef.current) {
      if (onUpdateNode) {
        graphRef.current.onUpdateNode = onUpdateNode;
      }
      if (onAddNode) {
        graphRef.current.onAddNode = onAddNode;
      }
      if (onGenerateSiblings) {
        graphRef.current.onGenerateSiblings = onGenerateSiblings;
      }
      if (onCreateTree) {
        graphRef.current.onCreateTree = onCreateTree;
      }
    }
  }, [onUpdateNode, onAddNode, onGenerateSiblings, onCreateTree]);

  // Re-select active node after generation completes (works for UI or socket-driven flows)
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (!graph.__genPrev) {
      graph.__genPrev = { children: !!isGeneratingChildren, siblings: !!isGeneratingSiblings };
    }
    const prev = graph.__genPrev;
    const started = (!prev.children && isGeneratingChildren) || (!prev.siblings && isGeneratingSiblings);
    const stopped = (prev.children && !isGeneratingChildren) || (prev.siblings && !isGeneratingSiblings);
    if (started) {
      const sel = graph.selectedNodeForKeyboard;
      graph.lastGenerationSelectedNodeId = sel?.properties?.nodeId || null;
    }
    if (stopped) {
      // Schedule reselect after tree updates propagate
      graph.pendingReSelectNodeId = graph.lastGenerationSelectedNodeId || graph.pendingReSelectNodeId;
      setTimeout(() => {
        if (!graph.pendingReSelectNodeId) return;
        const node = graph.findNodesByType('loom/node').find(n => n.properties?.nodeId === graph.pendingReSelectNodeId);
        if (node) {
          graph.selectedNodeForKeyboard = node;
          try { selectNodeProgrammatically(node); } catch {}
          graph.pendingReSelectNodeId = null;
        }
      }, 300);
    }
    graph.__genPrev = { children: !!isGeneratingChildren, siblings: !!isGeneratingSiblings };
  }, [isGeneratingChildren, isGeneratingSiblings]);

  const addLoomNode = (nodeData) => {
    if (graphRef.current && graphRef.current.addLoomNode) {
      graphRef.current.addLoomNode(nodeData);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="litegraph"
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'block'
      }}
    />
  );
});

export default LoomGraph;