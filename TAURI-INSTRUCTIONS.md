# 🚀 Tauri Desktop compilation & Auto-Update Guide

This guide contains everything you need to compile your **SyncPL Trading Dashboard** into a lightweight, high-performance Windows native executable (`.exe`) using **Tauri**, and set up automated GitHub builds with push updates!

We have already pre-configured the Tauri configuration and the GitHub Actions release workflow in this repository. When you run `git pull` on your local computer, these files will be added immediately.

---

## 🛠️ Step 1: Install Local Windows Prerequisites
Because Tauri compiles the application into native machine code (making it incredibly fast and under 10MB), you need the native Windows compiler tools on your PC:

1. **Install Rust**:
   * Download and run [rustup-init.exe](https://rustup.rs/) (choose option `1` to install default toolchain).
2. **Install C++ Build Tools**:
   * Download the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   * Run the installer and check **"Desktop development with C++"**, then complete the installation.
3. **Install Node.js** (which you already have).

---

## 📥 Step 2: Sync Your Local Repository
Open your terminal inside your local folder:
`C:\Users\1nath\OneDrive\Desktop\syncpl-trading-dashboard`

Run these commands to get the new configuration and install the Tauri CLI:
```bash
# Pull the latest code updates from GitHub
git pull

# Install the new @tauri-apps/cli developer dependency
npm install
```

---

## 💻 Step 3: Run and Build Locally

### 1. Test Your App in Desktop Dev Mode
You can run the dashboard inside a native native window with full hot-reloads:
```bash
npm run tauri dev
```

### 2. Compile to a Single Windows Installer (`.exe`)
To bundle your app into an installer locally on your PC:
```bash
npm run tauri build
```
Once complete, your standalone `.exe` installer will be located in:
`src-tauri/target/release/bundle/nsis/SyncPL Trading_1.0.0_x64-setup.exe`

---

## 🤖 Step 4: Setup Automatic `.exe` Builds with GitHub Actions
We have created a automated workflow file in `.github/workflows/tauri-build.yml`. Every time you publish a release version on GitHub, GitHub will automatically compile the Windows `.exe` and upload it for you!

### How to trigger a new release:
1. Update your app version in `src-tauri/tauri.conf.json` (e.g., change `"version": "1.0.0"` to `"1.0.1"`).
2. Commit and push your changes to GitHub.
3. Push a version tag from your terminal:
   ```bash
   # Create a version tag
   git tag v1.0.1
   
   # Push the tag to GitHub
   git push origin v1.0.1
   ```
4. **Watch the magic**: Go to the **Actions** tab on your GitHub repository. You will see a workflow running. Once finished, a new Release will be created on your repository with the Windows setup `.exe` attached and ready for download!

---

## 🔄 Step 5: Setting Up Auto-Updates & Preserving Previous Data

### How is user data kept safe?
Your app is integrated with **Firebase Authentication and Firestore Database**. Because user credentials, trade logs, and portfolios are stored securely in the cloud, users can install updates, change PCs, or clear their cache without **ever** losing their data!

### Seamless Auto-Updater Integration:
To notify users of updates directly inside the app, Tauri has a built-in auto-updater. Here is how to activate it:

1. Install the official updater plugin in your local directory:
   ```bash
   npm run tauri add updater
   ```
2. Enable it in your `src-tauri/tauri.conf.json` by adding the updater endpoint. The easiest and free way is to use a public update server or a GitHub releases updater JSON file.
3. When your friends open the app, it will query your GitHub Releases, see a newer version exists, and ask: *"A new version of SyncPL Trading is available! Would you like to install it now?"*

---

🎉 **You are fully configured!** Pull the latest updates on your computer to start building your Windows executable.
