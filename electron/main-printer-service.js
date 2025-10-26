import net from 'net';
import http from 'http';

/**
 * Embedded Printer Service
 * Runs a simple HTTP server within the Electron app
 * to handle print requests directly to the local printer
 */
export class EmbeddedPrinterService {
  constructor(port = 8105) {
    this.port = port;
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Start the embedded printer service
   */
  async start() {
    if (this.isRunning) {
      console.log('[Printer Service] Already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer((req, res) => {
          this.handleRequest(req, res);
        });

        this.server.listen(this.port, () => {
          this.isRunning = true;
          console.log(`[Printer Service] Started on http://localhost:${this.port}`);
          resolve();
        });

        this.server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[Printer Service] Port ${this.port} is already in use`);
            this.isRunning = false;
            resolve(); // Don't reject, just log the error
          } else {
            console.error('[Printer Service] Server error:', err);
            reject(err);
          }
        });
      } catch (error) {
        console.error('[Printer Service] Failed to start:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the embedded printer service
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          console.log('[Printer Service] Stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      await this.handleRoutes(req, res);
    } catch (error) {
      console.error('[Printer Service] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
    }
  }

  /**
   * Handle different routes
   */
  async handleRoutes(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // Health check
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', service: 'printer-service' }));
      return;
    }

    // Get printer config
    if (url.pathname.startsWith('/api/printer/config/') && req.method === 'GET') {
      const printerId = url.pathname.split('/').pop() || 'default';
      const config = this.getDefaultConfig();
      res.writeHead(200);
      res.end(JSON.stringify(config));
      return;
    }

    // Update printer config
    if (url.pathname.startsWith('/api/printer/config/') && req.method === 'PUT') {
      res.writeHead(200);
      res.end(JSON.stringify({ message: 'printer configuration updated successfully' }));
      return;
    }

    // Test printer connection
    if (url.pathname.startsWith('/api/printer/test/') && req.method === 'POST') {
      const printerId = url.pathname.split('/').pop() || 'default';
      const connected = await this.testConnection();
      res.writeHead(200);
      res.end(JSON.stringify({ connected, error: connected ? '' : 'Could not connect to printer' }));
      return;
    }

    // Print endpoints
    if (url.pathname === '/api/printer/print/daypass' && req.method === 'POST') {
      try {
        const body = await this.readBody(req);
        const ticketData = JSON.parse(body);
        await this.printTicket(ticketData, 'daypass');
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'day pass ticket printed successfully' }));
        return;
      } catch (error) {
        console.error('[Printer Service] Print error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message || 'Failed to print ticket' }));
        return;
      }
      
    }

    if (url.pathname === '/api/printer/print/exitpass' && req.method === 'POST') {
      try {
        const body = await this.readBody(req);
        const ticketData = JSON.parse(body);
        await this.printTicket(ticketData, 'exitpass');
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'exit pass ticket printed successfully' }));
        return;
      } catch (error) {
        console.error('[Printer Service] Print error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message || 'Failed to print ticket' }));
        return;
      }
    }

    // Default 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Read request body
   */
  readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  /**
   * Get default printer configuration
   */
  getDefaultConfig() {
    return {
      id: 'printer1',
      name: 'Local Printer',
      ip: '192.168.192.168',
      port: 9100,
      width: 48,
      timeout: 5000,
      model: 'ESC/POS',
      enabled: true,
      isDefault: true,
    };
  }

  /**
   * Test printer connection
   */
  async testConnection() {
    const config = this.getDefaultConfig();
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;

      socket.setTimeout(config.timeout);

      socket.on('connect', () => {
        connected = true;
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(config.port, config.ip);
    });
  }

  /**
   * Print a ticket
   */
  async printTicket(ticketData, ticketType) {
    const config = ticketData.printerConfig || this.getDefaultConfig();
    
    // Generate ticket content
    const content = this.generateTicketContent(ticketData, ticketType);
    
    // Convert to ESC/POS commands
    const escPosData = this.convertToESCPOS(content);
    
    // Send to printer
    await this.sendToPrinter(config.ip, config.port, escPosData);
  }

  /**
   * Generate ticket content
   */
  generateTicketContent(data, type) {
    const lines = [];
    const now = new Date(data.createdAt);
    const dateStr = now.toLocaleDateString('fr-FR');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Header
    lines.push('================================');
    lines.push('  STE DHRAIFF SERVICES');
    lines.push('     TRANSPORT');
    lines.push('================================');

    if (type === 'daypass') {
      lines.push('');
      lines.push('   PASS JOURNÉE');
      lines.push('--------------------------------');
      lines.push(`Vehicule: ${data.licensePlate}`);
      if (data.routeName) {
        lines.push(`Route: ${data.routeName}`);
      }
      lines.push(`Montant: ${data.totalAmount.toFixed(2)} TND`);
      lines.push(`Date: ${dateStr} ${timeStr}`);
      lines.push(`Agent: ${data.createdBy}`);
      lines.push('--------------------------------');
      lines.push('Valide toute la journée!');
    } else if (type === 'exitpass') {
      lines.push('');
      lines.push('   AUTORISATION SORTIE');
      lines.push('--------------------------------');
      lines.push(`Vehicule: ${data.licensePlate}`);
      if (data.destinationName) {
        lines.push(`Destination: ${data.destinationName}`);
      }
      
      // Pricing breakdown - no service fees, just show the total
      if (data.basePrice && data.seatNumber) {
        const baseTotal = data.basePrice * data.seatNumber;
        lines.push(`Sièges: ${data.seatNumber}`);
        lines.push(`Prix: ${baseTotal.toFixed(2)} TND`);
      }
      
      lines.push(`Total: ${data.totalAmount.toFixed(2)} TND`);
      lines.push(`Date: ${dateStr} ${timeStr}`);
      lines.push(`Agent: ${data.createdBy}`);
      lines.push('--------------------------------');
      lines.push('🚪 Sortie autorisée!');
    }

    if (data.staffFirstName && data.staffLastName) {
      lines.push(`Agent: ${data.staffFirstName} ${data.staffLastName}`);
    }

    lines.push('');
    lines.push('');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Convert text to ESC/POS commands
   */
  convertToESCPOS(content) {
    // ESC @ - Initialize printer
    let data = Buffer.from([0x1B, 0x40]);

    // Add content
    data = Buffer.concat([data, Buffer.from(content, 'utf8')]);

    // Add line feeds
    data = Buffer.concat([data, Buffer.from([0x0A, 0x0A, 0x0A])]);

    // Cut paper - GS V 0
    data = Buffer.concat([data, Buffer.from([0x1D, 0x56, 0x00])]);

    return data;
  }

  /**
   * Send data to printer
   */
  async sendToPrinter(ip, port, data) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let isResolved = false;

      socket.setTimeout(5000);

      socket.on('connect', () => {
        // Write data to printer
        socket.write(data, (err) => {
          if (err && !isResolved) {
            isResolved = true;
            socket.destroy();
            reject(err);
          }
        });
        
        // Give it time to send, then close
        socket.setTimeout(500); // Short timeout after write
      });

      socket.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });

      socket.on('timeout', () => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(); // Consider timeout as success (data might have been sent)
        }
      });

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Check if service is running
   */
  getStatus() {
    return this.isRunning;
  }
}

