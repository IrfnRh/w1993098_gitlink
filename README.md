Section 1: Node.js Orchestration Server Setup
Ensure Node.js (v18.0.0 or higher) is installed on the host machine.
Navigate to the server root directory via the command line terminal.
Execute npm install express cors mongoose bcrypt crypto to download all required dependencies into the node_modules folder.
Open server.js and locate the API_URL configuration block. Update the IPv4 address to match the host machine's current local network address (e.g., 192.168.0.x). Do not use localhost or 127.0.0.1, as the mobile application cannot route traffic to a loopback address.
Execute node server.js to boot the orchestrator. The terminal will output --- SECURE SERVER RUNNING ---.

Section 2: MongoDB Atlas Configuration
Access the MongoDB Atlas cloud console and establish a new M0 Sandbox cluster.
Under "Network Access," whitelist the host machine's IP address to allow incoming data connections.
Generate a database user and copy the provided connection string.
Inject the connection string into the MONGO_URI variable within server.js, substituting the <password> tag with the newly generated credentials.

Section 3: React Native Mobile Compilation (Expo)
Ensure the Expo CLI toolchain is installed globally via npm install -g expo-cli.
Navigate to the mobile application root directory.
Open index.tsx and update the API_URL variable to match the exact IPv4 address configured in Section 1.
Execute npx expo start to compile the JavaScript bundle.
Download the "Expo Go" application on a physical iOS or Android smartphone. Ensure the smartphone is connected to the exact same Wi-Fi network as the host computer.
Scan the QR code rendered in the terminal to download the JavaScript bundle wirelessly to the physical device.
