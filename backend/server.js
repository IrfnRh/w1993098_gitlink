const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. MONGODB CONNECTION ---
const MONGO_URI = 'mongodb+srv://irfanur40_db_user:Irfanur24305@fyp.d5sc98s.mongodb.net/oob-auth?retryWrites=true&w=majority';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB!'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// --- 2. DATABASE SCHEMAS (UPDATED FOR DEVICE ID) ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    deviceId: { type: String, default: null } // NEW: Device Pairing Key
});
const User = mongoose.model('User', UserSchema);

const PostSchema = new mongoose.Schema({
    username: String,
    content: String,
    timestamp: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 }
});
const Post = mongoose.model('Post', PostSchema);

let pendingRequests = {}; 

// --- 3. AUTH ROUTES ---
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ error: "Username taken" });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await new User({ username, password: hashedPassword }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "DB error" }); }
});

//  DEVICE PAIRING ROUTE
app.post('/api/pair-device', async (req, res) => {
    try {
        const { username, password, deviceId } = req.body;
        
        // 1. Verify User exists and password is correct
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) return res.status(401).json({ error: "Invalid password" });

        // 2. Save the unique device ID to their database profile
        user.deviceId = deviceId;
        await user.save();
        
        console.log(`[SECURITY] Device successfully paired to ${username}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/login-init', async (req, res) => {
    const { username } = req.body;
    const userFound = await User.findOne({ username });
    if (!userFound) return res.status(404).json({ error: "User not found" });

    pendingRequests[username] = { 
        status: 'pending',
        nonce: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now()
    };
    res.json({ success: true });
});


app.get('/simulated-push', async (req, res) => {
    const { username, deviceId } = req.query;
    const request = pendingRequests[username];
    
    if (request && request.status === 'pending') {
        // SUPERVISOR CHECK: Does this phone's ID match the one in the database?
        const user = await User.findOne({ username });
        if (user && user.deviceId === deviceId) {
            res.json({ success: true, nonce: request.nonce });
        } else {
            console.log(`[SECURITY ALERT] Unpaired device attempted to intercept push for ${username}!`);
            res.json({ success: false, error: "Unrecognized Device" });
        }
    } else {
        res.json({ success: false });
    }
});

app.post('/auth-response', (req, res) => {
    const { username, approved, returnedNonce, returnedTimestamp } = req.body;
    const reqData = pendingRequests[username];

    if (!reqData || reqData.status !== 'pending') return res.status(400).json({ error: "No request" });

    if (approved && returnedNonce === reqData.nonce && (Date.now() - returnedTimestamp < 60000)) {
        pendingRequests[username].status = 'approved';
        res.json({ success: true });
    } else {
        pendingRequests[username].status = 'denied';
        res.json({ success: true });
    }
});

app.get('/check-status', (req, res) => {
    res.json({ status: pendingRequests[req.query.username]?.status || 'none' });
});


// --- 4. Z-NET SOCIAL ROUTES & BOTS (UNCHANGED) ---
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ timestamp: -1 }).limit(50);
        res.json({ success: true, posts });
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/posts', async (req, res) => {
    try {
        const { username, content } = req.body;
        const newPost = new Post({ username, content, likes: Math.floor(Math.random() * 50) });
        await newPost.save();
        res.json({ success: true, post: newPost });
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: "Post not found" });
        post.likes += 1;
        await post.save();
        res.json({ success: true, likes: post.likes });
    } catch (err) { res.status(500).json({ error: "DB Error" }); }
});

app.get('/api/profile/:username', async (req, res) => {
    try {
        const searchTerm = req.params.username;
        let matchedUsername = searchTerm;

        // 1. Try to find the user in the main database
        const user = await User.findOne({ username: { $regex: new RegExp(searchTerm, 'i') } });

        if (user) {
            matchedUsername = user.username;
        } else {
            // 2. If they aren't registered (like the automated Bots), check if they have posts
            const botPost = await Post.findOne({ username: { $regex: new RegExp(searchTerm, 'i') } });
            if (botPost) {
                matchedUsername = botPost.username;
            } else {
                return res.status(404).json({ error: "User not found" });
            }
        }

        // 3. Fetch all their transmissions
        const posts = await Post.find({ username: matchedUsername }).sort({ timestamp: -1 });
        res.json({ success: true, username: matchedUsername, posts });

    } catch (err) { 
        res.status(500).json({ error: "DB Error" }); 
    }
});
const zFighterBots = [
    { name: "Goku", quotes: ["Is anyone strong fighting today?", "Chi-Chi is making a feast tonight! 🍖", "I think I figured out a new transformation... maybe.", "Vegeta, let's spar!", "Just dropped by King Kai's planet. Gravity is still heavy!"] },
    { name: "Vegeta", quotes: ["Kakarot, I will surpass you!", "500x gravity is nothing.", "Bulma, where did you put my training armor?!", "These earthlings are so loud.", "Final Flash! ...Just practicing."] },
    { name: "Bulma", quotes: ["Server maintenance tonight at 0200 hours.", "Who broke the gravity chamber AGAIN?!", "Trunks needs his diapers changed, Vegeta get in here!", "Capsule Corp stocks are up 400% today. 💰"] },
    { name: "Piccolo", quotes: ["Meditating at the waterfall.", "Gohan needs to keep up his training.", "Stop asking me if I eat food. Water is fine.", "I can hear everything you guys are typing."] },
    { name: "Gohan", quotes: ["Finished my thesis on Ki-dynamics!", "Sorry guys, I have a conference today, can't fight.", "Pan just learned how to fly! So proud. 😭", "Does anyone know how to get ink out of a gi?"] },
    { name: "Frieza", quotes: ["You monkeys are insufferable.", "Looking to hire new Ginyu Force members. Apply within.", "Just conquered Sector 7. The weather is terrible.", "I will have my revenge."] }
];

setInterval(async () => {
    try {
        if (Math.random() > 0.6) {
            const bot = zFighterBots[Math.floor(Math.random() * zFighterBots.length)];
            const quote = bot.quotes[Math.floor(Math.random() * bot.quotes.length)];
            const likes = Math.floor(Math.random() * 9000) + 1000; 
            await new Post({ username: bot.name, content: quote, likes: likes }).save();
            console.log(`[Z-NET] ${bot.name} posted an update.`);
        }
    } catch (err) {}
}, 15000); 

setInterval(async () => {
    try {
        if (Math.random() > 0.3) {
            const recentPosts = await Post.find().sort({ timestamp: -1 }).limit(5);
            if (recentPosts.length > 0) {
                const randomPost = recentPosts[Math.floor(Math.random() * recentPosts.length)];
                randomPost.likes += 1;
                await randomPost.save();
            }
        }
    } catch (err) {}
}, 5000);

app.listen(3000, '0.0.0.0', () => console.log(`--- SECURE SERVER RUNNING ---`));