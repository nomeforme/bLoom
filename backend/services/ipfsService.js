const axios = require('axios');

// IPFS service using Pinata for permanent pinning - Backend implementation
class IPFSService {
  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY;
    this.pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
    this.pinataJwt = process.env.PINATA_JWT;
    
    if (!this.pinataApiKey && !this.pinataJwt) {
      console.warn('⚠️  IPFS: No Pinata credentials found. IPFS functionality will be disabled.');
      console.warn('   Set PINATA_JWT or PINATA_API_KEY + PINATA_SECRET_API_KEY environment variables.');
    } else {
      console.log('✅ IPFS: Service initialized with Pinata credentials');
    }
    
    this.baseURL = 'https://api.pinata.cloud';
    this.gatewayURL = 'https://gateway.pinata.cloud/ipfs';
  }

  // Check if IPFS service is properly configured
  isConfigured() {
    return !!(this.pinataApiKey || this.pinataJwt);
  }

  // Pin JSON content to IPFS via Pinata
  async pinJSON(content, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('IPFS service not configured. Please set Pinata credentials.');
    }

    try {
      const data = {
        pinataContent: content,
        pinataMetadata: {
          name: options.name || `loom-node-${Date.now()}`,
          keyvalues: {
            type: 'loom-node',
            timestamp: new Date().toISOString(),
            treeAddress: options.treeAddress || '',
            parentId: options.parentId || '',
            ...options.metadata
          }
        },
        pinataOptions: {
          cidVersion: 1,
          wrapWithDirectory: false
        }
      };

      const headers = this._getHeaders();
      
      const response = await axios.post(
        `${this.baseURL}/pinning/pinJSONToIPFS`,
        data,
        { headers }
      );

      console.log(`📌 IPFS: Pinned content to ${response.data.IpfsHash}`);
      
      return {
        hash: response.data.IpfsHash,
        pinSize: response.data.PinSize,
        timestamp: response.data.Timestamp,
        gatewayUrl: `${this.gatewayURL}/${response.data.IpfsHash}`
      };
    } catch (error) {
      console.error('❌ IPFS: Failed to pin JSON to IPFS:', error.response?.data || error.message);
      throw new Error(`IPFS pinning failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Pin text content to IPFS via Pinata
  async pinText(text, options = {}) {
    return this.pinJSON({ text, timestamp: new Date().toISOString() }, options);
  }

  // Retrieve content from IPFS
  async getContent(hash) {
    try {
      const response = await axios.get(`${this.gatewayURL}/${hash}`, {
        timeout: 10000 // 10 second timeout
      });
      return response.data;
    } catch (error) {
      console.error(`❌ IPFS: Failed to retrieve content from IPFS hash ${hash}:`, error.message);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  // Retrieve text content from IPFS (for text-only pins)
  async getText(hash) {
    try {
      const content = await this.getContent(hash);
      if (typeof content === 'object' && content.text) {
        return content.text;
      }
      return content;
    } catch (error) {
      console.error(`❌ IPFS: Failed to retrieve text from IPFS hash ${hash}:`, error.message);
      throw error;
    }
  }

  // List pinned files with filtering options
  async listPins(options = {}) {
    if (!this.isConfigured()) {
      throw new Error('IPFS service not configured. Please set Pinata credentials.');
    }

    try {
      const headers = this._getHeaders();
      const params = {
        status: 'pinned',
        pageLimit: options.limit || 100,
        metadata: options.metadata || {},
        ...options.filters
      };

      const response = await axios.get(
        `${this.baseURL}/data/pinList`,
        { headers, params }
      );

      return response.data;
    } catch (error) {
      console.error('❌ IPFS: Failed to list pins:', error.response?.data || error.message);
      throw new Error(`Failed to list pins: ${error.response?.data?.message || error.message}`);
    }
  }

  // Remove a pin from IPFS (use with caution)
  async unpin(hash) {
    if (!this.isConfigured()) {
      throw new Error('IPFS service not configured. Please set Pinata credentials.');
    }

    try {
      const headers = this._getHeaders();
      
      await axios.delete(
        `${this.baseURL}/pinning/unpin/${hash}`,
        { headers }
      );

      console.log(`🗑️  IPFS: Unpinned hash ${hash}`);
      return true;
    } catch (error) {
      console.error(`❌ IPFS: Failed to unpin hash ${hash}:`, error.response?.data || error.message);
      throw new Error(`IPFS unpinning failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get authorization headers for Pinata API
  _getHeaders() {
    if (this.pinataJwt) {
      return {
        'Authorization': `Bearer ${this.pinataJwt}`,
        'Content-Type': 'application/json'
      };
    } else if (this.pinataApiKey && this.pinataSecretApiKey) {
      return {
        'pinata_api_key': this.pinataApiKey,
        'pinata_secret_api_key': this.pinataSecretApiKey,
        'Content-Type': 'application/json'
      };
    } else {
      throw new Error('No valid Pinata credentials found');
    }
  }

  // Generate IPFS gateway URL
  getGatewayUrl(hash) {
    return `${this.gatewayURL}/${hash}`;
  }

  // Validate IPFS hash format
  isValidHash(hash) {
    // Basic validation for IPFS hash format
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^bafy[a-z2-7]{56}$/.test(hash);
  }

  // Resolve content that might be an IPFS hash reference
  async resolveNodeContent(content) {
    if (!content) return content;
    
    // Check if content is an IPFS hash reference
    if (typeof content === 'string' && content.startsWith('ipfs:')) {
      const hash = content.substring(5); // Remove 'ipfs:' prefix
      
      if (this.isValidHash(hash)) {
        try {
          return await this.getText(hash);
        } catch (error) {
          console.error('❌ IPFS: Failed to resolve IPFS content:', error);
          return `[IPFS Error: ${error.message}]`;
        }
      }
    }
    
    return content;
  }

  // Check if content is an IPFS reference
  isIPFSReference(content) {
    return typeof content === 'string' && content.startsWith('ipfs:') && 
           content.length > 5 && this.isValidHash(content.substring(5));
  }

  // Extract IPFS hash from content reference
  extractIPFSHash(content) {
    if (this.isIPFSReference(content)) {
      return content.substring(5);
    }
    return null;
  }

  // Health check for IPFS service
  async healthCheck() {
    if (!this.isConfigured()) {
      return {
        status: 'disabled',
        message: 'IPFS service not configured'
      };
    }

    try {
      const headers = this._getHeaders();
      await axios.get(`${this.baseURL}/data/testAuthentication`, { headers });
      return {
        status: 'healthy',
        message: 'IPFS service is operational'
      };
    } catch (error) {
      return {
        status: 'error',
        message: `IPFS service error: ${error.message}`
      };
    }
  }
}

// Export singleton instance
const ipfsService = new IPFSService();

module.exports = {
  IPFSService,
  ipfsService
};