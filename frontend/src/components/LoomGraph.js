import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const LoomGraph = forwardRef(({ currentTree, onNodeSelect, onAddNode }, ref) => {
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
      
      const content = this.properties.content || "";
      const maxLength = 100;
      const displayContent = content.length > maxLength ? 
        content.substring(0, maxLength) + "..." : content;
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      
      // Wrap text to fit in the larger node
      const words = displayContent.split(' ');
      const lines = [];
      let currentLine = '';
      const maxWidth = this.size[0] - 20; // Leave padding
      
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
      
      let y = 35;
      for (let line of lines.slice(0, 6)) { // Limit to 6 lines
        ctx.fillText(line, 10, y);
        y += 18;
      }
      
      // Draw metadata
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "11px Arial";
      ctx.fillText(`Author: ${this.properties.author.substring(0, 10)}...`, 10, this.size[1] - 25);
      ctx.fillText(`Time: ${new Date(this.properties.timestamp * 1000).toLocaleTimeString()}`, 10, this.size[1] - 10);
    };

    LoomNode.prototype.onMouseDown = function(e, localpos, canvas) {
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
      const newContent = prompt("Edit node content:", this.properties.content);
      if (newContent !== null) {
        this.properties.content = newContent;
        this.title = newContent.substring(0, 20) + (newContent.length > 20 ? "..." : "");
      }
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
      if (canvas) {
        canvas.setGraph(null);
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Load tree data when currentTree changes
  useEffect(() => {
    if (!graphRef.current || !currentTree) return;

    const graph = graphRef.current;
    
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