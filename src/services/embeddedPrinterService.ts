import * as net from 'net';
import * as http from 'http';

interface PrinterConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  width: number;
  timeout: number;
  model: string;
  enabled: boolean;
  isDefault?: boolean;
}

interface TicketData {
  licensePlate: string;
  destinationName?: string;
  routeName?: string;
  seatNumber: number;
  totalAmount: number;
  createdBy: string;
  createdAt: Date;
  stationName?: string;
  vehicleCapacity?: number;
  basePrice?: number;
  exitPassCount?: number;
  companyName?: string;
  companyLogo?: string;
  staffFirstName?: string;
  staffLastName?: string;
  printerConfig?: {
    ip: string;
    port: number;
  };
}

/**
 * Embedded Printer Service
 * Runs a simple HTTP server within the Electron app
 * to handle print requests directly to the local printer
 */
export class EmbeddedPrinterService {
  private server: http.Server | null = null;
  private port: number = 8105;
  private isRunning: boolean = false;

  constructor(port?: number) {
    if (port) {
      this.port = port;
    }
  }

  /**
   * Start the embedded printer service
   */
  async start(): Promise<void> {
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

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`[Printer Service] Port ${this.port} is already in use`);
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
  async stop(): Promise<void> {
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
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
    } catch (error: any) {
      console.error('[Printer Service] Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
    }
  }

  /**
   * Handle different routes
   */
  private async handleRoutes(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // Health check
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', service: 'printer-service' }));
      return;
    }

    // Get printer config
    if (url.pathname.startsWith('/api/printer/config/') && req.method === 'GET') {
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
      const connected = await this.testConnection();
      res.writeHead(200);
      res.end(JSON.stringify({ connected, error: connected ? '' : 'Could not connect to printer' }));
      return;
    }

    // Print endpoints
    if (url.pathname === '/api/printer/print/daypass' && req.method === 'POST') {
      const body = await this.readBody(req);
      const ticketData = JSON.parse(body) as TicketData;
      await this.printTicket(ticketData, 'daypass');
      res.writeHead(200);
      res.end(JSON.stringify({ message: 'day pass ticket printed successfully' }));
      return;
    }

    if (url.pathname === '/api/printer/print/exitpass' && req.method === 'POST') {
      const body = await this.readBody(req);
      const ticketData = JSON.parse(body) as TicketData;
      await this.printTicket(ticketData, 'exitpass');
      res.writeHead(200);
      res.end(JSON.stringify({ message: 'exit pass ticket printed successfully' }));
      return;
    }

    // Default 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
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
  private getDefaultConfig(): PrinterConfig {
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
  private async testConnection(): Promise<boolean> {
    const config = this.getDefaultConfig();
    
    return new Promise((resolve) => {
      const socket = new net.Socket();

      socket.setTimeout(config.timeout);

      socket.on('connect', () => {
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
  private async printTicket(ticketData: TicketData, ticketType: string): Promise<void> {
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
  private generateTicketContent(data: TicketData, type: string): string {
    const lines: string[] = [];
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
      
      // Pricing breakdown
      if (data.basePrice && data.seatNumber) {
        if (data.vehicleCapacity && data.seatNumber === data.vehicleCapacity) {
          // Empty vehicle
          const serviceFeePerSeat = 0.15;
          const serviceTotal = serviceFeePerSeat * data.vehicleCapacity;
          lines.push(`Capacité véhicule: ${data.vehicleCapacity} sièges`);
          lines.push(`Frais de service: ${serviceTotal.toFixed(2)} TND`);
        } else {
          // Vehicle with bookings
          const baseTotal = data.basePrice * data.seatNumber;
          lines.push(`Sièges réservés: ${data.seatNumber}`);
          lines.push(`Prix de base: ${baseTotal.toFixed(2)} TND`);
        }
      }
      
      lines.push(`Montant Total: ${data.totalAmount.toFixed(2)} TND`);
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
  private convertToESCPOS(content: string): Buffer {
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
  private async sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let isResolved = false;

      socket.setTimeout(5000);

      socket.on('connect', () => {
        socket.write(data);
      });

      socket.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Printer connection timeout'));
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
  public getStatus(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const embeddedPrinterService = new EmbeddedPrinterService();

