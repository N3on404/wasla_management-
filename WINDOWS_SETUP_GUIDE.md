# Wasla Management Desktop - Windows 11 Setup Guide

Complete guide to set up the Wasla backend and management-desktop app on Windows 11.

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install Go](#2-install-go)
3. [Install Node.js and npm](#3-install-nodejs-and-npm)
4. [Setup Wasla Backend](#4-setup-wasla-backend)
5. [Setup Management Desktop](#5-setup-management-desktop)
6. [Configure Local Printer Service](#6-configure-local-printer-service)
7. [Running the Application](#7-running-the-application)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

### System Requirements
- Windows 11
- Internet connection
- Administrator privileges
- Ethernet connection to the printer (192.168.192.168)
- WiFi connection to server network (192.168.0.x)

### Required Tools
- **Git**: For cloning repositories
- **Go**: For backend services
- **Node.js**: For management-desktop app
- **PostgreSQL** (if running backend locally)
- **Redis** (if running backend locally)

---

## 2. Install Go

### Download Go
1. Visit https://go.dev/dl/
2. Download **go1.21.x.windows-amd64.msi** (latest stable version)
3. Run the installer
4. Follow the installation wizard

### Verify Installation
Open **Command Prompt** or **PowerShell** and run:
```powershell
go version
```

You should see something like:
```
go version go1.21.x windows/amd64
```

### Set GOPATH (Optional)
Go should work out of the box, but if needed:
1. Open **Environment Variables**
2. Add `GOPATH` = `C:\Users\YourUsername\go`
3. Add `%GOPATH%\bin` to your PATH

---

## 3. Install Node.js and npm

### Download Node.js
1. Visit https://nodejs.org/
2. Download the **LTS version** (recommended: v20.x)
3. Run the installer
4. Follow the installation wizard
5. Make sure to check "Add to PATH" during installation

### Verify Installation
Open **Command Prompt** or **PowerShell** and run:
```powershell
node --version
npm --version
```

You should see:
```
v20.x.x
10.x.x
```

---

## 4. Setup Wasla Backend

### Step 1: Clone the Repository

Open **Command Prompt** or **PowerShell** in your desired directory:

```powershell
cd C:\Users\YourUsername\Documents
git clone https://github.com/Samer-Gassouma/wasla_backend.git
cd wasla_backend
```

### Step 2: Build the Printer Service

We only need the printer service for this setup:

```powershell
# Build the printer service for Windows
go build -o bin\printer-service.exe .\cmd\printer-service\
```

### Step 3: Verify the Build

```powershell
dir bin\printer-service.exe
```

You should see the executable file.

---

## 5. Setup Management Desktop

### Step 1: Clone the Repository

```powershell
cd C:\Users\YourUsername\Documents
git clone https://github.com/N3on404/wasla_management-.git
cd wasla_management-
```

### Step 2: Install Dependencies

```powershell
npm install
```

This will install all required dependencies including:
- React
- Electron
- Tailwind CSS
- TypeScript

### Step 3: Build the Application

For development:
```powershell
npm run dev
```

For production build:
```powershell
npm run build
```

### Step 4: Install the Application (Windows Installer)

After building, you'll find the installer in the `release` folder:
```
release\0.1.0\Wasla Management-Windows-0.1.0-Setup.exe
```

Run the installer and install the application.

---

## 6. Configure Local Printer Service

### Step 1: Create Startup Script

Create a file named `start-printer-service.bat` in `C:\Users\YourUsername\Documents\wasla_backend`:

```batch
@echo off
echo Starting Wasla Printer Service...
echo.

cd /d "%~dp0"

REM Check if printer service is already running
netstat -an | find "8105" >nul
if %errorlevel% == 0 (
    echo ERROR: Printer service is already running on port 8105
    echo Stop it first or use a different port
    pause
    exit /b 1
)

REM Start the printer service
set PRINTER_SERVICE_PORT=8105
start "" "bin\printer-service.exe"

echo.
echo Printer service started successfully!
echo Listening on: http://localhost:8105
echo.
echo To stop the service, run: taskkill /F /IM printer-service.exe
echo.
pause
```

### Step 2: Configure Printer IP

Edit `management-desktop\src\services\printerIpConfigService.ts`:

```typescript
private readonly DEFAULT_CONFIG: PrinterIpConfig = {
  ip: '192.168.192.168',  // Your printer's IP
  port: 9100
};
```

Or change it later in the app UI by pressing **F3**.

### Step 3: Test Printer Connection

Start the printer service:
```powershell
cd C:\Users\YourUsername\Documents\wasla_backend
.\start-printer-service.bat
```

Test the connection:
```powershell
curl http://localhost:8105/health
```

You should see:
```json
{"service":"printer-service","status":"ok"}
```

---

## 7. Running the Application

### First Time Setup

1. **Start the Printer Service**:
   ```powershell
   cd C:\Users\YourUsername\Documents\wasla_backend
   .\start-printer-service.bat
   ```

2. **Launch Management Desktop**:
   - Open **Start Menu**
   - Search for "Wasla Management"
   - Click to open the app

3. **Login**:
   - Enter your credentials
   - The app will connect to the server at `192.168.0.193`

### Daily Usage

1. Open **Start Menu** → "Wasla Management"
2. Login with your credentials
3. The app will:
   - Get data from the server (192.168.0.193)
   - Print using the local printer service (localhost:8105)
   - The printer service sends to the Ethernet printer (192.168.192.168:9100)

### Printer Status

- Look for the printer icon in the top-right corner
- Green = Connected
- Red = Not Connected
- Press **F3** to change printer IP

---

## 8. Troubleshooting

### Issue: "Cannot connect to server"

**Solution**: Check your WiFi connection
```powershell
ping 192.168.0.193
```

### Issue: "Printer service not running"

**Solution**: Start the printer service
```powershell
cd C:\Users\YourUsername\Documents\wasla_backend
.\start-printer-service.bat
```

### Issue: "Cannot print"

**Check 1**: Is the printer service running?
```powershell
curl http://localhost:8105/health
```

**Check 2**: Can you reach the printer?
```powershell
ping 192.168.192.168
```

**Check 3**: Is port 9100 open?
```powershell
Test-NetConnection -ComputerName 192.168.192.168 -Port 9100
```

**Check 4**: Verify printer config
- Press **F3** in the app
- Check IP is `192.168.192.168`
- Test connection

### Issue: "Go build failed"

**Solution**: Make sure Go is installed correctly
```powershell
go version
go env GOROOT
go env GOPATH
```

### Issue: "npm install failed"

**Solution**: Clear npm cache and retry
```powershell
npm cache clean --force
npm install
```

### Issue: "Port 8105 already in use"

**Solution**: Kill the existing process
```powershell
# Find the process
netstat -ano | findstr :8105

# Kill it (replace PID with the actual number)
taskkill /F /PID <PID>
```

### Check Printer Service Logs

The printer service logs to stdout. To see logs:
1. Run the startup script from a terminal window
2. Or check Event Viewer for application logs

---

## 9. Quick Reference

### Important Files
- **Printer Service**: `C:\Users\YourUsername\Documents\wasla_backend\bin\printer-service.exe`
- **Management Desktop**: `C:\Users\YourUsername\Documents\wasla_management-\`
- **Startup Script**: `wasla_backend\start-printer-service.bat`

### Important URLs
- **Local Printer Service**: http://localhost:8105
- **Backend Server**: http://192.168.0.193
  - Auth: 192.168.0.193:8001
  - Queue: 192.168.0.193:8002
  - Booking: 192.168.0.193:8003
  - Websocket: ws://192.168.0.193:8004
  - Statistics: 192.168.0.193:8006

### Important IPs
- **Printer**: 192.168.192.168:9100
- **Your Computer WiFi**: 192.168.0.x
- **Your Computer Ethernet**: 192.168.192.100
- **Server**: 192.168.0.193

### Keyboard Shortcuts
- **F3**: Open printer configuration dialog
- **F6**: Open "Add Vehicle" modal
- **F5**: Refresh queue data

---

## 10. Production Deployment (Optional)

### Auto-Start Printer Service on Boot

Create a Windows Task Scheduler task:

1. Open **Task Scheduler**
2. Create **Basic Task**
3. Name: "Wasla Printer Service"
4. Trigger: "When the computer starts"
5. Action: "Start a program"
6. Program: `C:\Users\YourUsername\Documents\wasla_backend\bin\printer-service.exe`
7. Arguments: (leave empty)
8. Start in: `C:\Users\YourUsername\Documents\wasla_backend`

Add environment variable:
1. In the task properties, go to "General"
2. Check "Run whether user is logged on or not"
3. In "Actions" → "Start a program" → Configure for Windows 10
4. Add environment variable:
   - Variable: `PRINTER_SERVICE_PORT`
   - Value: `8105`

---

## Summary

✅ **Installed Go**: For building the printer service  
✅ **Installed Node.js**: For running management-desktop  
✅ **Built Printer Service**: Only the printer service is needed locally  
✅ **Built Management Desktop**: The Electron app  
✅ **Configured Printer**: IP set to 192.168.192.168  
✅ **Tested Connection**: Everything working  

The setup is complete! You can now:
1. Start the printer service (when needed)
2. Launch management-desktop
3. Login and use the application
4. Print tickets to the Ethernet printer

