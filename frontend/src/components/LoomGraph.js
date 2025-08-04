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

    // Initialize LiteGraph
    const graph = new window.LiteGraph.LGraph();
    const canvas = new window.LiteGraph.LGraphCanvas(canvasRef.current, graph);
    
    graphRef.current = graph;
    
    // Configure LiteGraph settings
    canvas.background_image = null;
    canvas.render_canvas_border = false;
    canvas.render_connections_shadows = false;
    canvas.render_connection_arrows = false;
    
    // Custom LoomNode class
    function LoomNode(title) {
      this.title = title || "Loom Node";
      this.size = [200, 100];
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
      const maxLength = 50;
      const displayContent = content.length > maxLength ? 
        content.substring(0, maxLength) + "..." : content;
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px Arial";
      
      const lines = displayContent.split('\n');
      let y = 30;
      for (let line of lines) {
        ctx.fillText(line, 10, y);
        y += 15;
      }
      
      // Draw metadata
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "10px Arial";
      ctx.fillText(`Author: ${this.properties.author.substring(0, 8)}...`, 10, this.size[1] - 20);
      ctx.fillText(`Time: ${new Date(this.properties.timestamp * 1000).toLocaleTimeString()}`, 10, this.size[1] - 8);
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

    // Helper function to add nodes from blockchain data
    const addLoomNode = (nodeData) => {
      const node = window.LiteGraph.createNode("loom/node");
      node.title = nodeData.content.substring(0, 20) + (nodeData.content.length > 20 ? "..." : "");
      node.properties = {
        content: nodeData.content,
        nodeId: nodeData.nodeId,
        parentId: nodeData.parentId,
        author: nodeData.author,
        timestamp: nodeData.timestamp
      };
      
      // Position node based on tree structure
      const parentNode = findNodeById(nodeData.parentId);
      if (parentNode) {
        const childrenCount = graph.findNodesByType("loom/node")
          .filter(n => n.properties.parentId === nodeData.parentId).length;
        node.pos = [
          parentNode.pos[0] + 250,
          parentNode.pos[1] + (childrenCount * 120) - 60
        ];
        
        // Connect to parent
        parentNode.connect(0, node, 0);
      } else {
        // Root node
        node.pos = [50, 50];
      }
      
      graph.add(node);
      canvas.setDirty(true);
    };

    const findNodeById = (nodeId) => {
      return graph.findNodesByType("loom/node")
        .find(node => node.properties.nodeId === nodeId);
    };

    // Store reference to addLoomNode function
    graph.addLoomNode = addLoomNode;

    // Cleanup
    return () => {
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
    
    // Add nodes from current tree
    if (currentTree.nodes) {
      currentTree.nodes.forEach(nodeData => {
        if (graph.addLoomNode) {
          graph.addLoomNode(nodeData);
        }
      });
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
      width="800"
      height="600"
      style={{ width: '100%', height: '100%' }}
    />
  );
});

export default LoomGraph;