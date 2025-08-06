import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import KeyboardShortcutsManager from '../utils/keyboardShortcuts';

const LoomGraph = forwardRef(({ 
  currentTree, 
  onNodeSelect, 
  onAddNode, 
  onUpdateNode, 
  onGenerateSiblings,
  isGeneratingChildren,
  setIsGeneratingChildren,
  isGeneratingSiblings,
  setIsGeneratingSiblings
}, ref) => {
  const canvasRef = useRef(null);
  const graphRef = useRef(null);
  
  useImperativeHandle(ref, () => ({
    addNodeFromBlockchain: (nodeData) => {
      if (graphRef.current) {
        addLoomNode(nodeData);
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
    const dpr = window.devicePixelRatio || 1;
    
    canvasRef.current.width = rect.width * dpr;
    canvasRef.current.height = rect.height * dpr;
    canvasRef.current.style.width = rect.width + 'px';
    canvasRef.current.style.height = rect.height + 'px';

    // Initialize LiteGraph
    const graph = new window.LiteGraph.LGraph();
    const canvas = new window.LiteGraph.LGraphCanvas(canvasRef.current, graph);
    
    graphRef.current = graph;
    
    // Configure LiteGraph settings
    canvas.background_image = null;
    canvas.render_canvas_border = false;
    canvas.render_connections_shadows = false;
    canvas.render_connection_arrows = false;
    
    // Constrain context menu to canvas bounds
    canvas.allow_dragnodes = true;
    canvas.allow_interaction = true;
    
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
      
      // Draw keyboard selection border
      if (this.keyboardSelected) {
        ctx.strokeStyle = "#4CAF50"; // Green color for keyboard selection
        ctx.lineWidth = 1; // Very thin line
        ctx.strokeRect(-1, -1, this.size[0] + 2, this.size[1] + 2);
      }
      
      const content = this.properties.content || "";
      const maxLength = 150; // Increased for better readability
      const displayContent = content.length > maxLength ? 
        content.substring(0, maxLength) + "..." : content;
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      
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
      ctx.font = "11px Arial";
      ctx.fillText(`Author: ${this.properties.author.substring(0, 10)}...`, 15, this.size[1] - 25);
      ctx.fillText(`Time: ${new Date(this.properties.timestamp * 1000).toLocaleTimeString()}`, 15, this.size[1] - 10);
      
      // Draw edit indicator in bottom right
      ctx.fillStyle = "#4CAF50";
      ctx.font = "10px Arial";
      const editText = "✏️ Edit";
      const editMetrics = ctx.measureText(editText);
      ctx.fillText(editText, this.size[0] - editMetrics.width - 10, this.size[1] - 5);
      
    };

    LoomNode.prototype.onMouseDown = function(e, localpos, canvas) {
      // Update keyboard selection when clicking on a node
      const currentGraph = this.graph;
      if (currentGraph) {
        currentGraph.findNodesByType("loom/node").forEach(n => {
          n.keyboardSelected = false;
        });
        this.keyboardSelected = true;
        // Update the selected node reference stored on the graph
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
        border: 2px solid #4CAF50;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      `;
      
      editDialog.innerHTML = `
        <div style="color: #fff; margin-bottom: 15px; font-family: Arial, sans-serif;">
          <h3 style="margin: 0 0 10px 0; color: #4CAF50;">Edit Node Content</h3>
          <p style="margin: 0; color: #ccc; font-size: 12px;">Modify the text content for this node. Changes will be automatically saved to the blockchain.</p>
        </div>
        <textarea id="nodeContentEditor" style="
          width: 100%;
          height: 120px;
          background: #1a1a1a;
          color: #fff;
          border: 1px solid #555;
          border-radius: 4px;
          padding: 10px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          resize: vertical;
          box-sizing: border-box;
        ">${originalContent}</textarea>
        <div style="margin-top: 15px; text-align: right;">
          <button id="cancelEdit" style="
            background: #666;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            margin-right: 10px;
            cursor: pointer;
            font-family: Arial, sans-serif;
          ">Cancel</button>
          <button id="saveEdit" style="
            background: #4CAF50;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-family: Arial, sans-serif;
          ">Save Changes</button>
        </div>
      `;
      
      document.body.appendChild(editDialog);
      
      const textarea = document.getElementById('nodeContentEditor');
      const saveBtn = document.getElementById('saveEdit');
      const cancelBtn = document.getElementById('cancelEdit');
      
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
              margin-top: 5px;
              text-align: center;
            `;
            errorMsg.textContent = `Failed to save: ${error.message}`;
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
      
      // Event listeners
      saveBtn.addEventListener('click', saveChanges);
      cancelBtn.addEventListener('click', closeDialog);
      
      // Save on Enter (Ctrl+Enter or Cmd+Enter)
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveChanges();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog();
        }
      });
      
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
        ...options
      ];
      return menu;
    };

    // Scale the context according to device pixel ratio
    const ctx = canvasRef.current.getContext('2d');
    ctx.scale(dpr, dpr);

    // Helper function to add nodes from blockchain data
    const addLoomNode = (nodeData) => {
      const node = window.LiteGraph.createNode("loom/node");
      node.title = nodeData.content.substring(0, 20) + (nodeData.content.length > 20 ? "..." : "");
      
      // Force the size after creation
      node.size = [300, 150];
      
      node.properties = {
        content: nodeData.content,
        nodeId: nodeData.nodeId,
        parentId: nodeData.parentId,
        author: nodeData.author,
        timestamp: nodeData.timestamp
      };
      
      // Position node based on tree structure
      const isRootParent = nodeData.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
                           nodeData.parentId === '0x0' || 
                           nodeData.isRoot;
      
      if (isRootParent || nodeData.isRoot) {
        // Root node
        node.pos = [50, 50];
      } else {
        const parentNode = findNodeById(nodeData.parentId);
        if (parentNode) {
          const childrenCount = graph.findNodesByType("loom/node")
            .filter(n => n.properties.parentId === nodeData.parentId).length;
          node.pos = [
            parentNode.pos[0] + 350,
            parentNode.pos[1] + (childrenCount * 200) - 90
          ];
          
          // Connect to parent
          parentNode.connect(0, node, 0);
        } else {
          // Fallback position if parent not found
          console.warn('Parent node not found for:', nodeData.nodeId, 'parent:', nodeData.parentId);
          node.pos = [200, 200 + Math.random() * 100];
        }
      }
      
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

    // Store reference to addLoomNode function
    graph.addLoomNode = addLoomNode;
    
    // Add keyboard navigation with shortcuts manager
    graph.selectedNodeForKeyboard = null;
    const shortcutsManager = new KeyboardShortcutsManager();
    
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
              .finally(() => {
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
              .finally(() => {
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
    
    const selectNodeByKeyboard = (node) => {
      // Clear previous selection visual
      graph.findNodesByType("loom/node").forEach(n => {
        n.keyboardSelected = false;
      });
      
      // Mark new selection
      node.keyboardSelected = true;
      
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
      
      // Center the canvas on the selected node
      canvas.centerOnNode(node);
      canvas.setDirty(true);
    };
    
    // Add event listener for keyboard navigation
    document.addEventListener('keydown', handleKeyDown);
    
    // Store reference to cleanup function
    graph.keyboardCleanup = () => {
      document.removeEventListener('keydown', handleKeyDown);
    };

    // Handle window resize
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        canvasRef.current.style.width = rect.width + 'px';
        canvasRef.current.style.height = rect.height + 'px';
        
        const ctx = canvasRef.current.getContext('2d');
        ctx.scale(dpr, dpr);
        
        if (canvas) {
          canvas.resize();
          canvas.setDirty(true);
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
    graph.onGenerateSiblings = onGenerateSiblings;
    
    // Clear existing nodes
    graph.clear();
    
    // Add nodes from current tree in proper order (parents first)
    if (currentTree.nodes) {
      console.log('Loading tree with nodes:', currentTree.nodes.length);
      
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
          console.log('Adding root node:', nodeData.nodeId, nodeData.content.substring(0, 30));
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
        console.log(`Pass ${passes}: trying to add ${nonRootNodes.length - addedNodes.size} remaining nodes`);
        
        nonRootNodes.forEach(nodeData => {
          if (addedNodes.has(nodeData.nodeId)) return;
          
          // Check if parent exists in graph or is root (parentId = 0x0...0)
          const isRootParent = nodeData.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' || 
                               nodeData.parentId === '0x0';
          const parentExists = isRootParent ||
                             graph.findNodesByType("loom/node").some(n => n.properties.nodeId === nodeData.parentId);
          
          if (parentExists) {
            console.log('Adding child node:', nodeData.nodeId, nodeData.content.substring(0, 30));
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
    }
  }, [currentTree]);

  // Update function references when they change
  useEffect(() => {
    if (graphRef.current) {
      if (onUpdateNode) {
        graphRef.current.onUpdateNode = onUpdateNode;
      }
      if (onGenerateSiblings) {
        graphRef.current.onGenerateSiblings = onGenerateSiblings;
      }
    }
  }, [onUpdateNode, onGenerateSiblings]);

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