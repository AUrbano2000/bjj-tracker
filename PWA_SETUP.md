# PWA Setup Instructions for iPhone/Safari

## How to Install on Your iPhone (No Hosting Needed!)

### Option 1: Run Flask Locally and Access from Phone

1. **Find your computer's local IP address:**
   - Windows: Open PowerShell and run `ipconfig`
   - Look for "IPv4 Address" (usually something like `192.168.1.X`)

2. **Run the Flask app:**
   ```
   python app.py
   ```

3. **On your iPhone:**
   - Connect to the SAME WiFi as your computer
   - Open Safari
   - Go to `http://YOUR_IP_ADDRESS:5000` (replace with your actual IP)
   - Example: `http://192.168.1.100:5000`

4. **Add to Home Screen:**
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Name it "BJJ Tracker"
   - Tap "Add"

5. **Done!** You now have an app icon on your home screen that works offline (once cached)

---

### Option 2: Deploy for Free (Actually Free, No Credit Card)

#### Using Python Anywhere (Free Tier):

1. Go to www.pythonanywhere.com
2. Create a free account
3. Upload your project files
4. Configure the web app with Flask
5. You get a URL like `yourusername.pythonanywhere.com`
6. Add to iPhone home screen from that URL

#### Using Render (Free Tier):

1. Push your code to GitHub
2. Go to render.com (no credit card for free tier)
3. Create new Web Service from GitHub repo
4. It auto-deploys when you push
5. You get a URL like `bjj-tracker.onrender.com`

---

### Option 3: Simplest for Personal Use (Recommended)

**Use your computer as a local server when training:**

1. Always run `python app.py` before training
2. Keep your computer on the same WiFi
3. Access from phone via local IP
4. Everything saves to your computer's database
5. No monthly fees, complete privacy

---

## Creating Icons (Optional)

If you want custom icons for the PWA, create two PNG images:

- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

Save them in the `static/` folder. You can use any BJJ-themed image or just your initials on a colored background.

---

## Troubleshooting

**Can't connect from phone:**
- Make sure both devices are on same WiFi
- Check Windows Firewall allows Python
- Try `python app.py --host=0.0.0.0`

**Data not saving:**
- The database (`bjj.db`) is on your computer
- Data only syncs when both devices are on same network
- For always-accessible data, use a free hosting option above

**Offline mode:**
- Once you visit pages, they cache for offline use
- New data requires internet/local network connection
- Perfect for reviewing moves offline
