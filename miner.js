// Global variables
let memory_cost = 1500; // Fixed at 1500 KB
let difficulty = 1;
let account = '';
const stored_targets = ['XEN11', 'XUNI'];
let mining = false;
let totalMiningTime = 0;
let miningStartTime;

let lastAttempts = 0;
let lastSpeed = 0;
let lastUpdateTime = 0;

// Helper functions
function hash_value(value) {
    return CryptoJS.SHA256(value).toString();
}

function generate_random_sha256(max_length = 128) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    const random_string = Array.from({length: Math.floor(Math.random() * max_length) + 1}, () => characters[Math.floor(Math.random() * characters.length)]).join('');
    return CryptoJS.SHA256(random_string).toString();
}

function is_within_five_minutes_of_hour() {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes < 5 || minutes >= 55;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

async function mine_block() {
    const status_div = document.getElementById('status');
    status_div.innerHTML = 'Mining...';

    let found_valid_hash = false;
    const remove_prefix_address = account.slice(2);
    const salt = CryptoJS.enc.Hex.parse(remove_prefix_address);

    let attempts = 0;
    const start_time = Date.now();
    lastUpdateTime = start_time;

    function updateAttempts() {
        status_div.innerHTML = `Mining Hashes: ${formatNumber(attempts)}${getSpeedAndTimeString()}`;
    }

    function getSpeedAndTimeString() {
        return `, Speed: ${lastSpeed.toFixed(2)} H/s, Total Mining Time: ${formatTime(totalMiningTime)}`;
    }

    function updateSpeedAndTime() {
        const current_time = Date.now();
        const elapsed_time = (current_time - lastUpdateTime) / 1000;
        
        const newAttempts = attempts - lastAttempts;
        lastSpeed = newAttempts / elapsed_time;
        lastAttempts = attempts;
        totalMiningTime += Math.floor(elapsed_time);
        lastUpdateTime = current_time;

        updateAttempts();
    }

    // Set up interval for updating speed and time every 5 seconds
    const updateInterval = setInterval(() => {
        if (mining) {
            updateSpeedAndTime();
        } else {
            clearInterval(updateInterval);
        }
    }, 5000);

    while (mining) {
        attempts++;
        updateAttempts();

        const random_data = generate_random_sha256();
        
        try {
            const result = await argon2.hash({
                pass: random_data,
                salt: salt.toString(),
                time: difficulty,
                mem: memory_cost,
                parallelism: 1,
                type: argon2.ArgonType.Argon2id,
                hashLen: 32
            });

            const hashed_data = result.hashHex;

            for (const target of stored_targets) {
                if (hashed_data.indexOf(target) !== -1) {
                    if ((target === 'XUNI' && /XUNI[0-9]/.test(hashed_data) && is_within_five_minutes_of_hour()) || target === 'XEN11') {
                        found_valid_hash = true;
                        break;
                    }
                }
            }

            if (found_valid_hash) {
                updateSpeedAndTime(); // Update final status
                status_div.innerHTML += '<br>Valid hash found!';
                mining = false;
                break;
            }
        } catch (error) {
            console.error('Argon2 hashing error:', error);
            status_div.innerHTML = 'Error occurred during mining. Check console for details.';
            mining = false;
            break;
        }

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    clearInterval(updateInterval);

    if (!mining) {
        status_div.innerHTML += '<br>Mining stopped.';
    }
}

function startMining() {
    const accountInput = document.getElementById('account');
    account = accountInput.value;
    if (!account) {
        alert('Please enter your Ethereum address');
        return;
    }
    
    if (!mining) {
        mining = true;
        miningStartTime = Date.now();
        lastAttempts = 0;
        lastSpeed = 0;
        lastUpdateTime = miningStartTime;
        mine_block();
    } else {
        alert('Mining is already in progress.');
    }
}

function stopMining() {
    if (mining) {
        mining = false;
        totalMiningTime += Math.floor((Date.now() - lastUpdateTime) / 1000);
    }
}

// Load saved account address if available
window.onload = function() {
    const savedAccount = localStorage.getItem('xenBlocksAccount');
    if (savedAccount) {
        document.getElementById('account').value = savedAccount;
    }
};

// Save account address when mining starts
function saveAccount() {
    const accountInput = document.getElementById('account');
    localStorage.setItem('xenBlocksAccount', accountInput.value);
}
