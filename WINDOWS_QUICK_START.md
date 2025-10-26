# Wasla Management Desktop - Quick Start (Windows 11)

## ⚡ Quick Setup Checklist

### 1. Install Required Software

```powershell
# Check what's installed
go version          # Should show Go version
node --version      # Should show Node version
npm --version       # Should show npm version
git --version       # Should show Git version
```

**If any are missing:**
- Go: https://go.dev/dl/ → Download `go1.21.x.windows-amd64.msi`
- Node.js: https://nodejs.org/ → Download LTS version
- Git: https://git-scm.com/download/win

### 2. Clone and Build Backend (Printer Service Only)

```powershell
# Clone
git clone https://github.com/Samer-Gassouma/wasla_backend.git
cd wasla_backend

# Build printer service
go build -o bin\printer-service.exe .\cmd\printer-service\

# Verify
dir bin\printer-service.exe
```

### 3. Clone and Install Management Desktop

```powershell
# Clone
git clone https://github.com/N3on404/wasla_management-.git
cd wasla_management-

# Install dependencies
npm install

# Build for production (this creates the Windows installer)
npm run build
```

### 4. Install the App

After building, run:
```
release\0.1.0\Wasla Management-Windows-0.1.0-Setup.exe
```

### 5. Start Printer Service

Create `start-printer-service.bat`:

```batch
@echo off
cd /d "C:\Users\YourUsername\Documents\wasla_backend"
set PRINTER_SERVICE_PORT=8105
start "" "bin\printer-service.exe"
echo Printer service started on http://localhost:8105
pause
```

Double-click to start the printer service.

### 6. Launch Management Desktop

1. Open **Start Menu**
2. Search for **"Wasla Management"**
3. Click to launch
4. Login with your credentials

---

## 🎯 What Happens Next?

When you use the management-desktop app:

1. **You click "Add Vehicle"** or other actions
2. **App sends data request** → Server at `192.168.0.193`
3. **Server responds with data** → Back to your computer
4. **You click "Print"**
5. **App sends print request** → Local printer service at `localhost:8105`
6. **Printer service connects to printer** → `192.168.192.168:9100`
7. **Ticket prints!** 🎉

---

## 🔍 Verify Everything is Working

```powershell
# 1. Check printer service is running
curl http://localhost:8105/health

# 2. Check printer configuration
curl -X PUT http://localhost:8105/api/printer/config/printer1 ^
  -H "Content-Type: application/json" ^
  -d "{\"id\":\"printer1\",\"name\":\"Local Printer\",\"ip\":\"192.168.192.168\",\"port\":9100,\"width\":48,\"timeout\":5000,\"model\":\"ESC/POS\",\"enabled\":true,\"isDefault\":true}"

# 3. Test printer connection
curl -X POST http://localhost:8105/api/printer/test/printer1

# 4. Check you can reach the server
ping 192.168.0.193

# 5. Check you can reach the printer
ping 192.168.192.168
```

All should return success! ✅

---

## 📝 Configuration

### Network Setup
- **Your Computer (Ethernet)**: 192.168.192.100
- **Printer (Ethernet)**: 192.168.192.168:9100
- **Your Computer (WiFi)**: 192.168.0.x
- **Server (WiFi)**: 192.168.0.193

### Management Desktop Config
Location: `management-desktop\src\config.ts`

```typescript
export const API = {
  auth: "http://192.168.0.193:8001",
  queue: "http://192.168.0.193:8002",
  booking: "http://192.168.0.193:8003",
  ws: "ws://192.168.0.193:8004",
  printer: "http://localhost:8105",  // ← Local printer service!
  stats: "http://192.168.0.193:8006",
  statistics: "http://192.168.0.193:8006",
};
```

### Printer Config
Location: `management-desktop\src\services\printerIpConfigService.ts`

```typescript
private readonly DEFAULT_CONFIG: PrinterIpConfig = {
  ip: '192.168.192.168',
  port: 9100
};
```

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't install Go | Run installer as Administrator |
| `go build` fails | Ensure Go is in PATH: `go env` |
| Can't install npm packages | Clear cache: `npm cache clean --force` |
| Printer service won't start | Check port 8105 is free: `netstat -an \| findstr :8105` |
| Can't connect to server | Check WiFi connection, ping 192.168.0.193 |
| Can't print | Check printer is on Ethernet, ping 192.168.192.168 |
| App won't launch | Check `npm run dev` works, check logs |

---

## 📞 Need Help?

1. Check `WINDOWS_SETUP_GUIDE.md` for detailed instructions
2. Check `management-desktop\PRINTER_SETUP.md` for printer details
3. Check server connection: `ping 192.168.0.193`
4. Check printer connection: `ping 192.168.192.168`
5. Check printer service: `curl http://localhost:8105/health`

---

## ✅ Ready to Use!

1. ✅ Go installed
2. ✅ Node.js installed
3. ✅ Backend cloned and built
4. ✅ Management desktop cloned and built
5. ✅ App installed
6. ✅ Printer service configured
7. ✅ Everything tested

**Launch the app and start managing!** 🚀

