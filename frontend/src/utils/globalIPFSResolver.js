import { resolveNodeContent } from './ipfsUtils';

// Global IPFS request queue and rate limiter
class GlobalIPFSResolver {
  constructor(delayMs) {
    this.queue = [];
    this.isProcessing = false;
    this.delayMs = delayMs;
    this.activeResolutions = new Map(); // Track active tree resolutions
  }

  // Add IPFS resolution request to global queue
  enqueueRequest(nodeId, content, treeAddress, updateCallback) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        nodeId,
        content,
        treeAddress,
        updateCallback,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  // Process queue with global rate limiting
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    console.log('🌐 Global IPFS resolver: Starting queue processing');

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      const { nodeId, content, treeAddress, updateCallback, resolve, reject } = request;
      
      try {
        console.log(`🌐 Global IPFS resolver: Processing request for tree ${treeAddress.substring(0, 8)}... node ${nodeId.substring(0, 8)}...`);
        const resolvedContent = await resolveNodeContent(content);
        
        // Call the update callback to update the specific tree
        if (updateCallback) {
          updateCallback(resolvedContent);
        }
        
        resolve(resolvedContent);
        console.log(`✅ Global IPFS resolver: Resolved content for node ${nodeId.substring(0, 8)}...`);
      } catch (error) {
        console.warn(`❌ Global IPFS resolver: Failed to resolve node ${nodeId.substring(0, 8)}...`, error.message);
        reject(error);
      }

      // Apply global rate limiting delay
      if (this.queue.length > 0) {
        console.log(`⏳ Global IPFS resolver: Waiting ${this.delayMs}ms before next request (${this.queue.length} remaining)`);
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    this.isProcessing = false;
    console.log('🌐 Global IPFS resolver: Queue processing complete');
  }

  // Cancel all pending requests for a specific tree
  cancelTreeResolution(treeAddress) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(request => {
      if (request.treeAddress === treeAddress) {
        request.reject(new Error('Tree resolution cancelled'));
        return false;
      }
      return true;
    });
    
    const cancelled = initialLength - this.queue.length;
    if (cancelled > 0) {
      console.log(`🚫 Global IPFS resolver: Cancelled ${cancelled} pending requests for tree ${treeAddress.substring(0, 8)}...`);
    }
    
    this.activeResolutions.delete(treeAddress);
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      activeResolutions: this.activeResolutions.size
    };
  }
}

export default GlobalIPFSResolver;