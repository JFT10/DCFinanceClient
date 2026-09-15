# DemocracyCraft Finance Client

I'm building this application to provide an open source way to financially interact with businesses, banks, and other players.


## Intended features

### Balance history
An easy way to view your balance history, including who you've sent money to and who has sent you money. Additionally, subscriptions will be listed here.
### Subscriptions
You'll be able to set up subscriptions with businesses, agree on the terms, and automate the subscription for whenever you turn on the computer you set this up on. I'll also post explanations on how to set it up to use a free online service, so you'll never have to download anything on your computer.
### Simple payments
You'll be able to easily send money without even being in game. Simply type the name or view recent transactions, and send/request money. Rate limits apply.
### Moving money with a bank
We'll work with banks to implement a system where, using secret key exchange, you'll be able to easily transfer funds from bank account to player or vice versa.
### Updates
I want to constantly be able to update this client so that you'll have more ways to move money around. If you have ideas for changes, make it an issue on github! Click at the top of the screen where it says "issues" and I'll make some tags so I can filter through them.

Updates will be semi-automatic; that way, there's no way I'll be able to install malicious code on your device. I'll release patch notes with each one and it'll probably be a closable popup when you load the software. 

## Disclaimers

### Treasury key!
The app will require usage of your treasuryapi key. You will have to complete the exam for it, located on the 4th floor of the School of Sociology and Economics. 
You may be frightened by this—the server says to *never* give out that key. With this client, you're never giving it to anyone—read the code and compile it yourself if you'd like! You'll see that there is no possible way for someone to access your key ever. If someone asks for your key, do not listen.

### Your code?? On my computer??
I'm making this so that anyone can download it, run the installer, and be good to go for the future; this might be worrisome to some since you're basically downloading some random guy's code onto your computer, and that's reasonable. That's why I made it open source with AGPLv3 license; anyone can view it and it's *really* annoying for another group to distribute it. Also, since updates are going to be manual, there's no backdoor capability.

## Setup & Development

### Prerequisites
- **Node.js**: v18+ (Node 24 recommended)
- **Rust & Cargo**: Required for building native desktop binaries (`https://rustup.rs/` or `brew install rust`)

### Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure your Treasury API Key**:
   Create your `key.env` file from the example:
   ```bash
   cp key.env.example key.env
   ```
   Generate a key in-game using `/treasuryapi personal issue` (or `/treasuryapi business issue`), then paste the token into `key.env`:
   ```env
   TREASURY_API_KEY=your_jwt_here
   ```
   *(You can also configure or change this key inside the app Settings UI).*

3. **Run in Browser Preview Mode**:
   ```bash
   npm run dev
   ```

4. **Run Native Desktop Client (Tauri)**:
   ```bash
   npm run tauri dev
   ```

5. **Package for Distribution**:
   ```bash
   npm run tauri build
   ```
